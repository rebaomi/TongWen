// 悬浮翻译模式：选中文字后显示气泡翻译

import { translateWithFormulaProtection, recordOneUse } from './translator'

let tooltip: HTMLElement | null = null
let hideTimer: number | undefined

// 问 AI 的回调，由 index.ts 在初始化后注入
export let onAskAiFromHover: ((text: string) => void) | null = null
export function setAskAiCallback(fn: (text: string) => void) { onAskAiFromHover = fn }

function getOrCreateTooltip(): HTMLElement {
  if (tooltip) return tooltip

  tooltip = document.createElement('div')
  tooltip.id = 'scholar-hover-tooltip'
  tooltip.className = 'scholar-tooltip'
  document.body.appendChild(tooltip)

  tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimer))
  tooltip.addEventListener('mouseleave', hideTooltip)

  return tooltip
}

function showTooltip(text: string, x: number, y: number): void {
  const el = getOrCreateTooltip()
  el.innerHTML = `<div class="scholar-tooltip-content">${escapeHtml(text)}</div>
    <div class="scholar-tooltip-loader" style="display:none">
      <span class="scholar-spinner"></span> 翻译中…
    </div>`
  el.style.left = `${Math.min(x, window.innerWidth - 320)}px`
  el.style.top = `${y + 12}px`
  el.style.display = 'block'
  el.classList.add('scholar-tooltip-visible')
}

function setTooltipLoading(): void {
  const el = getOrCreateTooltip()
  const content = el.querySelector('.scholar-tooltip-content') as HTMLElement
  const loader = el.querySelector('.scholar-tooltip-loader') as HTMLElement
  if (content) content.style.display = 'none'
  if (loader) loader.style.display = 'flex'
}

function setTooltipResult(translated: string, original: string): void {
  const el = getOrCreateTooltip()
  el.innerHTML = `
    <div class="scholar-tooltip-translated">${escapeHtml(translated)}</div>
    <div class="scholar-tooltip-original">${escapeHtml(original)}</div>
    <div class="scholar-tooltip-footer">
      <span class="scholar-copy-btn" title="复制译文">📋 复制</span>
      <span class="scholar-ask-ai-btn" title="在 AI 助手中继续探讨">🤖 问 AI</span>
    </div>`

  el.querySelector('.scholar-copy-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(translated)
  })
  el.querySelector('.scholar-ask-ai-btn')?.addEventListener('click', () => {
    if (onAskAiFromHover) {
      onAskAiFromHover(`原文：${original}\n译文：${translated}\n\n请帮我深入解释这句话的含义。`)
    }
    hideTooltip()
  })
}

function setTooltipError(msg: string): void {
  const el = getOrCreateTooltip()
  el.innerHTML = `<div class="scholar-tooltip-error">⚠️ ${escapeHtml(msg)}</div>`
}

function hideTooltip(): void {
  hideTimer = window.setTimeout(() => {
    if (tooltip) {
      tooltip.style.display = 'none'
      tooltip.classList.remove('scholar-tooltip-visible')
    }
  }, 300)
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

let lastSelection = ''

async function onSelectionChange(): Promise<void> {
  const selection = window.getSelection()
  const text = selection?.toString().trim() ?? ''

  if (!text || text === lastSelection || text.length < 2) return
  if (text.length > 1000) return // 太长了不适合悬浮显示

  lastSelection = text
  const range = selection!.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  const x = rect.left + window.scrollX
  const y = rect.bottom + window.scrollY

  showTooltip(text, x, y)
  setTooltipLoading()

  try {
    // 划词翻译：先记 1 次使用
    const allowed = await recordOneUse()
    if (!allowed) {
      setTooltipError('今日免费次数已用完，请升级 Pro')
      return
    }
    const translated = await translateWithFormulaProtection(text)
    setTooltipResult(translated, text)
  } catch (err) {
    const msg = String(err)
    if (msg.includes('CONTEXT_INVALIDATED')) {
      setTooltipError('插件已更新，请刷新页面后重试 (F5)')
    } else if (msg.includes('LIMIT_EXCEEDED')) {
      setTooltipError('今日免费次数已用完，请升级 Pro')
    } else if (msg.includes('OLLAMA_CORS_403')) {
      setTooltipError('Ollama 403：需设置 OLLAMA_ORIGINS=* 并重启 Ollama（见插件设置页）')
    } else if (msg.includes('OLLAMA_UNREACHABLE')) {
      setTooltipError('无法连接 Ollama，请确认已运行 ollama serve 并设置 OLLAMA_ORIGINS=*')
    } else if (msg.includes('OLLAMA_NO_MODEL')) {
      setTooltipError('Ollama 未安装任何模型，请运行：ollama pull qwen2.5:7b')
    } else if (msg.includes('OLLAMA_MODEL_NOT_FOUND')) {
      const modelMatch = msg.match(/ollama pull (.+)/)
      setTooltipError(`模型未找到，请运行：${modelMatch ? modelMatch[0] : 'ollama pull qwen2.5:7b'}`)
    } else if (msg.includes('not configured') || msg.includes('Engine')) {
      setTooltipError('翻译引擎未配置，请点击插件图标 → ⚙️ 设置 API Key')
    } else {
      const brief = msg.replace(/^Error:\s*/, '').replace(/^[A-Z_]+:\s*/, '').slice(0, 80)
      setTooltipError(`翻译失败：${brief}`)
    }
  }
}

export function enableHoverMode(): void {
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection()
    if (!sel?.toString().trim()) hideTooltip()
  })
}

function onMouseUp(e: MouseEvent): void {
  if (tooltip && tooltip.contains(e.target as Node)) return
  setTimeout(onSelectionChange, 50) // 等待 selection 稳定
}

export function disableHoverMode(): void {
  document.removeEventListener('mouseup', onMouseUp)
  tooltip?.remove()
  tooltip = null
}
