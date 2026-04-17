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

// 检测是否为双栏布局，返回分割的 X 中线（不是双栏则返回 null）
function detectTwoColumnSplit(items: TextItem[]): number | null {
  if (items.length < 20) return null

  // 收集所有文字 X 坐标（左边界）
  const xValues = items.map(it => it.transform[4]).sort((a, b) => a - b)
  const minX = xValues[0]
  const maxX = xValues[xValues.length - 1]
  const pageWidth = maxX - minX
  if (pageWidth < 100) return null

  // 将页面水平分成 20 个区间，找空白区
  const BINS = 20
  const binWidth = pageWidth / BINS
  const binCount = new Array<number>(BINS).fill(0)
  for (const x of xValues) {
    const bin = Math.min(Math.floor((x - minX) / binWidth), BINS - 1)
    binCount[bin]++
  }

  // 在中间 30%~70% 范围内找最空的 bin（栏间空白区）
  const lo = Math.floor(BINS * 0.3)
  const hi = Math.ceil(BINS * 0.7)
  let minCount = Infinity
  let splitBin = -1
  for (let i = lo; i < hi; i++) {
    if (binCount[i] < minCount) {
      minCount = binCount[i]
      splitBin = i
    }
  }

  // 如果该 bin 的密度显著低于平均（< 20%），认为是双栏
  const avgCount = xValues.length / BINS
  if (minCount < avgCount * 0.2) {
    return minX + (splitBin + 0.5) * binWidth
  }
  return null
}

// 将 PDF 文字元素按段落合并（支持双栏）
function groupTextItems(items: TextItem[], pageNum: number): PageTextBlock[] {
  if (items.length === 0) return []

  // 尝试检测双栏布局
  const splitX = detectTwoColumnSplit(items)
  if (splitX !== null) {
    // 分别处理左栏和右栏，然后合并（左栏优先）
    const leftItems = items.filter(it => it.transform[4] < splitX)
    const rightItems = items.filter(it => it.transform[4] >= splitX)
    return [
      ...groupSingleColumn(leftItems, pageNum),
      ...groupSingleColumn(rightItems, pageNum),
    ]
  }

  return groupSingleColumn(items, pageNum)
}

// 将单栏文字元素按段落合并
function groupSingleColumn(items: TextItem[], pageNum: number): PageTextBlock[] {
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
