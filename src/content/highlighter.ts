/**
 * 文本高亮标注系统
 * 支持多色 / chrome.storage 持久化 / 页面恢复
 */
import type { Highlight, HighlightColor } from '@/shared/types'

const COLOR_MAP: Record<HighlightColor, string> = {
  yellow: '#fef08a',
  green:  '#bbf7d0',
  blue:   '#bfdbfe',
  pink:   '#fecdd3',
  orange: '#fed7aa',
}

const MARK_CLASS = 'xiaoyi-highlight'
const MARK_ATTR = 'data-xiaoyi-id'

// 注入样式
function injectHighlightStyles() {
  if (document.getElementById('xiaoyi-highlight-styles')) return
  const style = document.createElement('style')
  style.id = 'xiaoyi-highlight-styles'
  style.textContent = Object.entries(COLOR_MAP)
    .map(([color, bg]) => `.${MARK_CLASS}[data-color="${color}"] { background: ${bg}; border-radius: 2px; cursor: pointer; }`)
    .join('\n')
    + `\n.${MARK_CLASS} { transition: outline 0.1s; }
       .${MARK_CLASS}:hover { outline: 2px solid rgba(0,0,0,0.2); }`
  document.head.appendChild(style)
}

// ── 高亮操作 ──────────────────────────────────────────────────

export function highlightSelection(color: HighlightColor, onAskAi?: (text: string, id: string) => void): Highlight | null {
  injectHighlightStyles()
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null

  const range = sel.getRangeAt(0)
  const text = sel.toString().trim()
  if (!text || text.length > 5000) return null

  // 上下文（前后各 80 字符）
  const before = getContextBefore(range, 80)
  const after = getContextAfter(range, 80)

  const id = crypto.randomUUID()
  const mark = document.createElement('mark')
  mark.className = MARK_CLASS
  mark.setAttribute('data-color', color)
  mark.setAttribute(MARK_ATTR, id)
  mark.style.background = COLOR_MAP[color]

  try {
    range.surroundContents(mark)
  } catch {
    // 选区跨越了多个元素，用 extractContents 包裹
    const frag = range.extractContents()
    mark.appendChild(frag)
    range.insertNode(mark)
  }

  sel.removeAllRanges()

  // 右键菜单/点击：删除或追问
  mark.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    showHighlightMenu(mark, id, text, color, onAskAi)
  })

  const highlight: Highlight = {
    id,
    text,
    color,
    url: location.href,
    before,
    after,
    createdAt: Date.now(),
  }

  // 保存
  chrome.runtime.sendMessage({ type: 'SAVE_HIGHLIGHT', payload: highlight })
  return highlight
}

export function removeHighlight(id: string) {
  const mark = document.querySelector(`[${MARK_ATTR}="${id}"]`)
  if (!mark) return
  const parent = mark.parentNode
  if (!parent) return
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
  parent.removeChild(mark)
  chrome.runtime.sendMessage({ type: 'DELETE_HIGHLIGHT', payload: { id } })
}

// ── 页面恢复 ──────────────────────────────────────────────────

export async function restoreHighlights(onAskAi?: (text: string, id: string) => void) {
  injectHighlightStyles()
  const response = await new Promise<{ success: boolean; data: Highlight[] }>((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'GET_HIGHLIGHTS', payload: { url: location.href } },
      resolve,
    )
  })
  if (!response?.success) return

  for (const h of response.data) {
    if (document.querySelector(`[${MARK_ATTR}="${h.id}"]`)) continue  // 已存在
    tryRestoreHighlight(h, onAskAi)
  }
}

function tryRestoreHighlight(h: Highlight, onAskAi?: (text: string, id: string) => void) {
  // 在页面文本中查找：前缀 + 目标文本 + 后缀
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    const full = node.textContent ?? ''
    const idx = full.indexOf(h.text)
    if (idx === -1) continue
    // 简单上下文验证
    if (h.before && !full.slice(Math.max(0, idx - 80), idx).includes(h.before.slice(-20))) continue

    try {
      const range = document.createRange()
      range.setStart(node, idx)
      range.setEnd(node, idx + h.text.length)

      const mark = document.createElement('mark')
      mark.className = MARK_CLASS
      mark.setAttribute('data-color', h.color)
      mark.setAttribute(MARK_ATTR, h.id)
      mark.style.background = COLOR_MAP[h.color]
      range.surroundContents(mark)

      mark.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        showHighlightMenu(mark, h.id, h.text, h.color, onAskAi)
      })
      break
    } catch { /* skip */ }
  }
}

// ── 高亮右键菜单 ──────────────────────────────────────────────

function showHighlightMenu(
  mark: Element,
  id: string,
  text: string,
  _color: HighlightColor,
  onAskAi?: (text: string, id: string) => void,
) {
  document.getElementById('xiaoyi-hl-menu')?.remove()

  const menu = document.createElement('div')
  menu.id = 'xiaoyi-hl-menu'
  const rect = mark.getBoundingClientRect()
  menu.style.cssText = [
    'position:fixed',
    `top:${rect.bottom + 6}px`,
    `left:${Math.min(rect.left, window.innerWidth - 180)}px`,
    'z-index:2147483646',
    'background:#fff',
    'border:1px solid #e5e7eb',
    'border-radius:10px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.12)',
    'padding:6px 0',
    'min-width:150px',
    'font:14px/1 -apple-system,sans-serif',
  ].join(';')

  const items: [string, () => void][] = [
    ['🤖 追问 AI', () => { onAskAi?.(text, id); menu.remove() }],
    ['🗑 删除高亮', () => { removeHighlight(id); menu.remove() }],
    ['📋 复制文本', () => { navigator.clipboard.writeText(text); menu.remove() }],
  ]

  for (const [label, fn] of items) {
    const item = document.createElement('button')
    item.textContent = label
    item.style.cssText = 'display:block;width:100%;padding:8px 14px;background:none;border:none;text-align:left;cursor:pointer;color:#374151;transition:background 0.1s'
    item.onmouseenter = () => { item.style.background = '#f3f4f6' }
    item.onmouseleave = () => { item.style.background = '' }
    item.onclick = fn
    menu.appendChild(item)
  }

  document.body.appendChild(menu)
  const close = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) { menu.remove(); document.removeEventListener('click', close) }
  }
  setTimeout(() => document.addEventListener('click', close), 0)
}

// ── 上下文提取 ───────────────────────────────────────────────

function getContextBefore(range: Range, len: number): string {
  try {
    const r = document.createRange()
    r.setStart(document.body, 0)
    r.setEnd(range.startContainer, range.startOffset)
    return r.toString().slice(-len)
  } catch { return '' }
}

function getContextAfter(range: Range, len: number): string {
  try {
    const r = document.createRange()
    r.setStart(range.endContainer, range.endOffset)
    r.setEnd(document.body, document.body.childNodes.length)
    return r.toString().slice(0, len)
  } catch { return '' }
}
