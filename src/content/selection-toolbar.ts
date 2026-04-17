/**
 * 选中文字悬浮工具栏
 * 提供：翻译 / 高亮（多色）/ 问 AI
 */
import type { HighlightColor } from '@/shared/types'
import { highlightSelection } from './highlighter'

const TOOLBAR_ID = 'xiaoyi-selection-toolbar'
const COLORS: [HighlightColor, string, string][] = [
  ['yellow', '🟡', '#fef08a'],
  ['green',  '🟢', '#bbf7d0'],
  ['blue',   '🔵', '#bfdbfe'],
  ['pink',   '🩷', '#fecdd3'],
  ['orange', '🟠', '#fed7aa'],
]

type ToolbarCallbacks = {
  onTranslate: (text: string) => void
  onAskAi: (text: string, imageUrl?: string) => void
  onHighlight: (color: HighlightColor) => void
}

let toolbar: HTMLElement | null = null
let callbacks: ToolbarCallbacks | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

function removeToolbar() {
  toolbar?.remove()
  toolbar = null
}

function showToolbar(x: number, y: number, selectedText: string, cbs: ToolbarCallbacks) {
  removeToolbar()

  const el = document.createElement('div')
  el.id = TOOLBAR_ID
  el.style.cssText = [
    'position:fixed',
    `top:${y - 46}px`,
    `left:${Math.min(x, window.innerWidth - 260)}px`,
    'z-index:2147483647',
    'background:#1f2937',
    'border-radius:10px',
    'padding:6px 8px',
    'display:flex',
    'align-items:center',
    'gap:4px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.25)',
    'user-select:none',
    'animation:tw-tb-in 0.15s ease',
  ].join(';')

  // 动画
  const style = document.createElement('style')
  style.textContent = `@keyframes tw-tb-in { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }`
  el.appendChild(style)

  // 分隔线
  function sep() {
    const d = document.createElement('div')
    d.style.cssText = 'width:1px;height:20px;background:#374151;margin:0 2px;flex-shrink:0'
    return d
  }

  // 翻译按钮
  const btnTranslate = makeBtn('翻译', '🌐', '#60a5fa', () => {
    cbs.onTranslate(selectedText)
    removeToolbar()
  })
  el.appendChild(btnTranslate)
  el.appendChild(sep())

  // 高亮色块
  for (const [color, _emoji, bg] of COLORS) {
    const dot = document.createElement('button')
    dot.title = `高亮 ${color}`
    dot.style.cssText = [
      `background:${bg}`,
      'width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,0.2)',
      'cursor:pointer;transition:transform 0.1s;flex-shrink:0',
    ].join(';')
    dot.onmouseenter = () => { dot.style.transform = 'scale(1.25)' }
    dot.onmouseleave = () => { dot.style.transform = '' }
    dot.onclick = (e) => { e.stopPropagation(); cbs.onHighlight(color); removeToolbar() }
    el.appendChild(dot)
  }
  el.appendChild(sep())

  // 问 AI
  const btnAi = makeBtn('问 AI', '🤖', '#a78bfa', () => {
    cbs.onAskAi(selectedText)
    removeToolbar()
  })
  el.appendChild(btnAi)

  el.addEventListener('mousedown', e => e.stopPropagation())
  document.body.appendChild(el)
  toolbar = el

  // 越界修正
  const rect = el.getBoundingClientRect()
  if (rect.left < 8) el.style.left = '8px'
  if (rect.top < 8) el.style.top = `${y + 12}px`
}

function makeBtn(label: string, icon: string, color: string, onClick: () => void): HTMLElement {
  const btn = document.createElement('button')
  btn.style.cssText = [
    'display:flex;align-items:center;gap:4px',
    'background:none;border:none;cursor:pointer',
    `color:${color}`,
    'font-size:13px;font-weight:600;padding:3px 6px;border-radius:6px;transition:background 0.1s',
    'white-space:nowrap',
  ].join(';')
  btn.innerHTML = `${icon} <span style="color:#f9fafb">${label}</span>`
  btn.onmouseenter = () => { btn.style.background = 'rgba(255,255,255,0.08)' }
  btn.onmouseleave = () => { btn.style.background = '' }
  btn.onclick = (e) => { e.stopPropagation(); onClick() }
  return btn
}

// ── 全局 selection 监听 ───────────────────────────────────────

export function initSelectionToolbar(cbs: ToolbarCallbacks) {
  callbacks = cbs

  document.addEventListener('mouseup', (e) => {
    // 不在工具栏内部
    if (toolbar?.contains(e.target as Node)) return

    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      const sel = window.getSelection()
      const text = sel?.toString().trim() ?? ''

      if (!text || text.length < 2 || text.length > 5000) {
        removeToolbar()
        return
      }

      // 不在 XiaoYi 自己的 UI 里
      const target = e.target as Element
      if (
        target.id?.startsWith?.('xiaoyi') ||
        target.closest?.('#xiaoyi-ai-sidebar') ||
        target.closest?.('#xiaoyi-selection-toolbar')
      ) return

      const range = sel!.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      showToolbar(rect.left + window.scrollX, rect.top + window.scrollY, text, callbacks!)
    }, 80)
  })

  document.addEventListener('selectionchange', () => {
    const text = window.getSelection()?.toString().trim()
    if (!text) {
      if (hideTimer) clearTimeout(hideTimer)
      hideTimer = setTimeout(removeToolbar, 200)
    }
  })
}

export { highlightSelection }
