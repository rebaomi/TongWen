import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy, TextItem } from 'pdfjs-dist/types/src/display/api'
import { extractFormulas, restoreFormulas } from '@/content/formula-detector'

// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

export interface PageTextBlock {
  pageNum: number
  text: string
  items: TextItem[]
  isFormula: boolean
  isCitation: boolean
}

export interface TranslatedPage {
  pageNum: number
  originalBlocks: PageTextBlock[]
  translatedTexts: string[]
  width: number
  height: number
}

// 提取 PDF 每页文本块
export async function extractPdfText(pdfDoc: PDFDocumentProxy): Promise<PageTextBlock[][]> {
  const allPages: PageTextBlock[][] = []

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i)
    const textContent = await page.getTextContent()
    const blocks = groupTextItems(textContent.items as TextItem[], i)
    allPages.push(blocks)
    page.cleanup()
  }

  return allPages
}

// 将 PDF 文字元素按段落合并
function groupTextItems(items: TextItem[], pageNum: number): PageTextBlock[] {
  if (items.length === 0) return []

  // ── 第一阶段：按 Y 坐标合并成行 ──────────────────────────────────
  type Line = { y: number; items: TextItem[]; text: string }
  const lines: Line[] = []
  let lineItems: TextItem[] = []
  let lastY = -Infinity

  for (const item of items) {
    const y = item.transform[5]
    if (Math.abs(y - lastY) > 3 && lineItems.length > 0) {
      const text = lineItems.map(i => i.str).join('').trim()
      if (text) lines.push({ y: lastY, items: lineItems, text })
      lineItems = []
    }
    if (item.str.trim()) lineItems.push(item)
    lastY = y
  }
  if (lineItems.length > 0) {
    const text = lineItems.map(i => i.str).join('').trim()
    if (text) lines.push({ y: lastY, items: lineItems, text })
  }

  if (lines.length === 0) return []

  // PDF 坐标系 Y 轴向上，从下到上排。按 Y 降序 = 从上到下阅读顺序
  lines.sort((a, b) => b.y - a.y)

  // ── 第二阶段：计算典型行距，判断段落边界 ────────────────────────
  const gaps: number[] = []
  for (let i = 1; i < lines.length; i++) {
    gaps.push(lines[i - 1].y - lines[i].y) // 行间距（正值）
  }
  // 取中位数作为「正常行距」基准
  const sorted = [...gaps].sort((a, b) => a - b)
  const medianGap = sorted[Math.floor(sorted.length / 2)] || 12

  // 超过正常行距 1.6 倍视为段落分隔
  const PARA_THRESHOLD = medianGap * 1.6

  // ── 第三阶段：将行合并为段落 ─────────────────────────────────────
  const paragraphs: PageTextBlock[] = []
  let paraLines: Line[] = [lines[0]]

  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i - 1].y - lines[i].y
    if (gap > PARA_THRESHOLD) {
      // 到达段落边界，提交当前段落
      paragraphs.push(mergeLines(pageNum, paraLines))
      paraLines = []
    }
    paraLines.push(lines[i])
  }
  if (paraLines.length > 0) paragraphs.push(mergeLines(pageNum, paraLines))

  return paragraphs.filter(b => b.text.trim().length > 0)
}

type Line = { y: number; items: TextItem[]; text: string }

function mergeLines(pageNum: number, lines: Line[]): PageTextBlock {
  // 合并行文本时，如果前一行末尾有连字符，去掉它直接拼接
  let text = ''
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].text
    if (i === 0) {
      text = t
    } else if (text.endsWith('-')) {
      // 连字符：去掉连字符，直接拼接
      text = text.slice(0, -1) + t
    } else {
      // 正常行接续：加空格
      text = text + ' ' + t
    }
  }
  const allItems = lines.flatMap(l => l.items)
  return createBlock(pageNum, text.trim(), allItems)
}

function createBlock(pageNum: number, text: string, items: TextItem[]): PageTextBlock {
  const isFormula = /\$.*\$|\\[a-zA-Z]+\{|\\begin\{/.test(text)
  const isCitation = /\[\d+\]|\[[A-Za-z]+\d{4}\]|\([A-Za-z]+ et al/.test(text)
  return { pageNum, text, items, isFormula, isCitation }
}

// 加载 PDF
export async function loadPdf(source: string | ArrayBuffer): Promise<PDFDocumentProxy> {
  const loadingTask = pdfjsLib.getDocument(
    typeof source === 'string' ? source : { data: source }
  )
  return loadingTask.promise
}

// 渲染单页到 Canvas
export async function renderPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale = 1.5
): Promise<void> {
  const viewport = page.getViewport({ scale })
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport, canvas }).promise
}

// 翻译文本块（保护公式和引用）
export async function translateBlock(block: PageTextBlock): Promise<string> {
  if (block.isFormula) return block.text // 不翻译公式

  const { text: protected_, formulas } = extractFormulas(block.text)

  return new Promise((resolve, reject) => {
    // PDF 批量翻译不单独计次，由 PdfViewer 统一在翻译开始前计 1 次
    chrome.runtime.sendMessage(
      { type: 'TRANSLATE_TEXT', payload: { text: protected_, countAsUsage: false } },
      (response: { success: boolean; data: { translated: string }; error?: string }) => {
        if (!response?.success) {
          reject(new Error(response?.error ?? 'Translation failed'))
          return
        }
        const translated = response.data.translated
        resolve(restoreFormulas(translated, formulas))
      }
    )
  })
}
