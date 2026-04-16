import { PDFDocument } from 'pdf-lib'
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api'
import type { TranslatedPage } from './pdf-processor'
import { renderPageToCanvas } from './pdf-processor'

/**
 * 导出双语 PDF：
 * - 原文页：原始 PDF 页面渲染为图片嵌入
 * - 译文页：用 Canvas + 系统字体渲染中文，嵌为图片
 * 完全绕过 pdf-lib 不支持 CJK 字体的问题。
 */
export async function exportBilingualPdf(
  pages: TranslatedPage[],
  pdfDoc: PDFDocumentProxy,
): Promise<Uint8Array> {
  const output = await PDFDocument.create()

  for (const pageData of pages) {
    // ── 1. 原始页面渲染为 PNG ──────────────────────────────────────
    const origPage = await pdfDoc.getPage(pageData.pageNum)
    const origCanvas = document.createElement('canvas')
    await renderPageToCanvas(origPage, origCanvas, 2)          // 2x 分辨率
    const origPng = canvasToBytes(origCanvas)
    const origImg = await output.embedPng(origPng)

    // 添加原文页（保持原始宽高比）
    const displayW = origCanvas.width / 2
    const displayH = origCanvas.height / 2
    const p1 = output.addPage([displayW, displayH])
    p1.drawImage(origImg, { x: 0, y: 0, width: displayW, height: displayH })

    // ── 2. 译文页：用 Canvas 渲染中文文本 ─────────────────────────
    if (pageData.translatedTexts.some(t => t)) {
      const transCanvas = renderTranslationCanvas(pageData, origCanvas.width)
      const transPng = canvasToBytes(transCanvas)
      const transImg = await output.embedPng(transPng)

      const tW = transCanvas.width / 2
      const tH = transCanvas.height / 2
      const p2 = output.addPage([tW, tH])
      p2.drawImage(transImg, { x: 0, y: 0, width: tW, height: tH })
    }
  }

  return output.save()
}

// ── Canvas → Uint8Array（PNG）────────────────────────────────────────
function canvasToBytes(canvas: HTMLCanvasElement): Uint8Array {
  const dataUrl = canvas.toDataURL('image/png')
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// ── 用 Canvas 渲染译文（支持中文）────────────────────────────────────
function renderTranslationCanvas(pageData: TranslatedPage, width: number): HTMLCanvasElement {
  const SCALE = 2
  const MARGIN = 40 * SCALE
  const FONT_SIZE_ORIG = 11 * SCALE
  const FONT_SIZE_TRANS = 13 * SCALE
  const LINE_H_ORIG = FONT_SIZE_ORIG * 1.6
  const LINE_H_TRANS = FONT_SIZE_TRANS * 1.7
  const PARA_GAP = 16 * SCALE
  const MAX_W = width - MARGIN * 2

  const canvas = document.createElement('canvas')
  canvas.width = width

  // 先用 offscreen canvas 计算总高度
  const measureCtx = canvas.getContext('2d')!

  function measureLines(text: string, fontSize: number, font: string): string[] {
    measureCtx.font = `${fontSize}px ${font}`
    const words = text.split(/\s+/)
    const lines: string[] = []
    let line = ''
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      if (measureCtx.measureText(test).width > MAX_W && line) {
        lines.push(line)
        line = w
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
    return lines.length ? lines : [text]
  }

  // 计算总高度
  let totalH = MARGIN
  const paragraphs: { origLines: string[]; transLines: string[] }[] = []

  for (let i = 0; i < pageData.originalBlocks.length; i++) {
    const origLines = measureLines(
      pageData.originalBlocks[i].text, FONT_SIZE_ORIG,
      '-apple-system, Arial, sans-serif'
    )
    const transText = pageData.translatedTexts[i] || pageData.originalBlocks[i].text
    const transLines = measureLines(
      transText, FONT_SIZE_TRANS,
      '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'
    )
    paragraphs.push({ origLines, transLines })
    totalH += origLines.length * LINE_H_ORIG + 6 * SCALE
    totalH += transLines.length * LINE_H_TRANS
    totalH += PARA_GAP
    if (i < pageData.originalBlocks.length - 1) totalH += 10 * SCALE // 分隔线间距
  }
  totalH += MARGIN

  canvas.height = Math.max(totalH, 100)

  // 正式绘制
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // 页眉
  ctx.fillStyle = '#1a73e8'
  ctx.fillRect(0, 0, canvas.width, 6 * SCALE)

  let y = MARGIN + 10 * SCALE

  for (let i = 0; i < paragraphs.length; i++) {
    const { origLines, transLines } = paragraphs[i]

    // 原文（灰色小字）
    ctx.font = `${FONT_SIZE_ORIG}px -apple-system, Arial, sans-serif`
    ctx.fillStyle = '#888888'
    for (const line of origLines) {
      ctx.fillText(line, MARGIN, y)
      y += LINE_H_ORIG
    }
    y += 6 * SCALE

    // 译文（深色大字）
    ctx.font = `${FONT_SIZE_TRANS}px "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`
    ctx.fillStyle = '#1a1a2e'
    for (const line of transLines) {
      ctx.fillText(line, MARGIN, y)
      y += LINE_H_TRANS
    }
    y += PARA_GAP

    // 段落分隔线
    if (i < paragraphs.length - 1) {
      ctx.strokeStyle = '#e8eaed'
      ctx.lineWidth = SCALE
      ctx.beginPath()
      ctx.moveTo(MARGIN, y)
      ctx.lineTo(canvas.width - MARGIN, y)
      ctx.stroke()
      y += 10 * SCALE
    }
  }

  return canvas
}

// ── 触发浏览器下载 ───────────────────────────────────────────────────
export function downloadFile(data: Uint8Array, filename: string): void {
  // 注意：直接用 data 而非 data.buffer，避免共享缓冲区偏移问题
  const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
