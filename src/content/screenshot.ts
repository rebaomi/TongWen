/**
 * 框选截图 + AI 视觉分析
 * 先截全屏，再让用户拖拽选区，裁剪后可发给 AI
 */

type ScreenshotCallback = (dataUrl: string) => void

let active = false

export function startScreenshotSelection(onCapture: ScreenshotCallback) {
  if (active) return
  active = true

  // 1. 先从 service worker 获取截图
  chrome.runtime.sendMessage({ type: 'TAKE_SCREENSHOT' }, (res: { success: boolean; data?: { dataUrl: string }; error?: string }) => {
    if (!res?.success || !res.data?.dataUrl) {
      active = false
      return
    }
    showSelectionOverlay(res.data.dataUrl, onCapture)
  })
}

function showSelectionOverlay(screenshotUrl: string, onCapture: ScreenshotCallback) {
  // 覆盖层：用截图作背景，让用户看到"冻结"的页面
  const overlay = document.createElement('div')
  overlay.id = 'xiaoyi-screenshot-overlay'
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    `background:url(${screenshotUrl}) no-repeat top left / cover`,
    'cursor:crosshair',
  ].join(';')

  // 遮罩（半透明暗色）
  const mask = document.createElement('canvas')
  mask.style.cssText = 'position:absolute;inset:0;pointer-events:none'
  mask.width = window.innerWidth
  mask.height = window.innerHeight
  overlay.appendChild(mask)
  const mctx = mask.getContext('2d')!
  mctx.fillStyle = 'rgba(0,0,0,0.35)'
  mctx.fillRect(0, 0, mask.width, mask.height)

  // 选区画布
  const selCanvas = document.createElement('canvas')
  selCanvas.style.cssText = 'position:absolute;inset:0;pointer-events:none'
  selCanvas.width = window.innerWidth
  selCanvas.height = window.innerHeight
  overlay.appendChild(selCanvas)
  const sctx = selCanvas.getContext('2d')!

  // 提示
  const hint = document.createElement('div')
  hint.textContent = '拖动鼠标框选截图区域 · 按 Esc 取消'
  hint.style.cssText = [
    'position:absolute;top:16px;left:50%;transform:translateX(-50%)',
    'background:rgba(0,0,0,0.75);color:#fff',
    'padding:8px 20px;border-radius:20px;font:14px system-ui',
    'pointer-events:none',
  ].join(';')
  overlay.appendChild(hint)

  document.body.appendChild(overlay)

  let startX = 0, startY = 0, dragging = false

  overlay.addEventListener('mousedown', (e) => {
    startX = e.clientX
    startY = e.clientY
    dragging = true
  })

  overlay.addEventListener('mousemove', (e) => {
    if (!dragging) return
    const x = Math.min(e.clientX, startX)
    const y = Math.min(e.clientY, startY)
    const w = Math.abs(e.clientX - startX)
    const h = Math.abs(e.clientY - startY)

    sctx.clearRect(0, 0, selCanvas.width, selCanvas.height)
    // 选区高亮
    sctx.strokeStyle = '#1a73e8'
    sctx.lineWidth = 2
    sctx.setLineDash([6, 3])
    sctx.strokeRect(x, y, w, h)
    sctx.fillStyle = 'rgba(26,115,232,0.08)'
    sctx.fillRect(x, y, w, h)
    // 尺寸标注
    sctx.font = '12px system-ui'
    sctx.fillStyle = '#1a73e8'
    sctx.fillText(`${Math.round(w)} × ${Math.round(h)}`, x + 4, y - 4)
  })

  overlay.addEventListener('mouseup', (e) => {
    if (!dragging) return
    dragging = false
    const x = Math.min(e.clientX, startX)
    const y = Math.min(e.clientY, startY)
    const w = Math.abs(e.clientX - startX)
    const h = Math.abs(e.clientY - startY)

    overlay.remove()
    active = false

    if (w < 10 || h < 10) return

    // 裁剪选区
    cropScreenshot(screenshotUrl, x, y, w, h, onCapture)
  })

  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      overlay.remove()
      active = false
      document.removeEventListener('keydown', escHandler)
    }
  })
}

function cropScreenshot(src: string, x: number, y: number, w: number, h: number, cb: ScreenshotCallback) {
  const dpr = window.devicePixelRatio || 1
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = w * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, w * dpr, h * dpr)
    cb(canvas.toDataURL('image/png'))
  }
  img.src = src
}
