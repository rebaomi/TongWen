import type { TranslateMode } from '@/shared/types'
import { getTranslatableNodes, translateWithFormulaProtection, recordOneUse } from './translator'
import { injectBilingualTranslation, removeBilingualTranslations, isTranslated } from './bilingual'
import { enableHoverMode, disableHoverMode, setAskAiCallback } from './hover'
import { showProUpgradeToast, showLoadingBar, hideLoadingBar, showErrorToast } from './ui'
import { createFloatingPanel } from './floating-panel'
import { shouldSkipNode } from './formula-detector'
import { createAiSidebar } from './ai-sidebar'
import type { AiSidebarApi } from './ai-sidebar'
import { initSelectionToolbar, highlightSelection } from './selection-toolbar'
import { restoreHighlights } from './highlighter'
import { startScreenshotSelection } from './screenshot'

let sidebarApi: AiSidebarApi | null = null

let currentMode: TranslateMode = 'bilingual'
let isPageTranslating = false
let isPageTranslated = false   // 标记当前页是否已完成翻译（SPA 路由变化后重置）
let originalTexts = new Map<Text, string>() // 用于 replace 模式恢复
let panelApi: ReturnType<typeof createFloatingPanel> | null = null
let mutationObserver: MutationObserver | null = null
const translatedNodes = new WeakSet<Text>()  // 追踪已翻译节点，避免重复翻译

/**
 * 当前页是否被"排除域名"覆盖（全局守卫）
 * 所有翻译入口都必须先检查此标志，包括消息监听器
 */
let isExcluded = false

/** 检查域名是否应排除，支持精确匹配和子域名匹配，自动去除空白 */
function checkDomainExcluded(excludedDomains: string[]): boolean {
  const hostname = location.hostname.toLowerCase()
  return excludedDomains
    .map(d => d.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0])
    .filter(Boolean)
    .some(d => hostname === d || hostname.endsWith('.' + d))
}

/** 监听设置变更，实时更新排除状态（无需刷新页面） */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return
  const settingsKey = Object.keys(changes).find(k => k === 'xiaoyi_settings')
  if (!settingsKey) return
  const newVal = changes[settingsKey].newValue as Record<string, unknown> | undefined
  if (!newVal) return

  const newExcluded = (newVal['excludedDomains'] as string[] | undefined) ?? []
  const newSiteOverrides = (newVal['siteOverrides'] as Record<string, { disabled?: boolean }> | undefined) ?? {}
  const hostname = location.hostname

  const wasExcluded = isExcluded
  isExcluded = checkDomainExcluded(newExcluded) || !!(newSiteOverrides[hostname]?.disabled)

  if (!wasExcluded && isExcluded) {
    // 刚被排除：停止悬浮模式
    disableHoverMode()
    stopMutationObserver()
  }
})

// ===== 主控制 =====

async function translatePage(): Promise<void> {
  if (isExcluded) return
  if (isPageTranslating) return
  isPageTranslating = true
  showLoadingBar()
  panelApi?.setTranslating(true, 0)

  try {
    const allowed = await recordOneUse()
    if (!allowed) {
      showProUpgradeToast()
      return
    }

    const nodes = getTranslatableNodes()
    const BATCH = 20

    for (let i = 0; i < nodes.length; i += BATCH) {
      const batch = nodes.slice(i, i + BATCH)
      await Promise.allSettled(batch.map(node => translateNode(node)))
      const pct = Math.round(((i + BATCH) / nodes.length) * 100)
      panelApi?.setTranslating(true, Math.min(pct, 99))
    }

    isPageTranslated = true
    startMutationObserver()

    // 翻译完成后注入页面上下文到侧边栏
    if (sidebarApi) {
      const ctx = collectPageContext()
      sidebarApi.setContext(ctx)
    }
  } catch (err) {
    console.error('[xiaoyi] Page translation error:', err)
  } finally {
    isPageTranslating = false
    hideLoadingBar()
    panelApi?.setTranslating(false)
  }
}

async function translateNode(node: Text): Promise<void> {
  const original = node.textContent?.trim()
  if (!original || original.length < 4) return
  if (translatedNodes.has(node)) return

  try {
    const translated = await translateWithFormulaProtection(original)
    translatedNodes.add(node)

    if (currentMode === 'bilingual') {
      injectBilingualTranslation(node, translated)
    } else if (currentMode === 'replace') {
      originalTexts.set(node, node.textContent ?? '')
      node.textContent = translated
    }
  } catch (err) {
    const msg = String(err)
    if (msg.includes('CONTEXT_INVALIDATED')) {
      showErrorToast('插件已更新，请刷新页面后重试 (F5)')
    } else if (msg.includes('LIMIT_EXCEEDED')) {
      showProUpgradeToast()
    } else if (msg.includes('OLLAMA_UNREACHABLE')) {
      showErrorToast('无法连接 Ollama，请运行 ollama serve 并设置 OLLAMA_ORIGINS=*')
    } else if (msg.includes('not configured')) {
      showErrorToast('请先在设置页面配置 API Key')
    } else {
      showErrorToast('翻译出错：' + String(err).replace(/^Error:\s*/, '').slice(0, 60))
    }
    isPageTranslating = false
  }
}

function revertPage(): void {
  stopMutationObserver()
  isPageTranslated = false
  if (currentMode === 'bilingual') {
    removeBilingualTranslations()
  } else if (currentMode === 'replace') {
    for (const [node, original] of originalTexts) {
      node.textContent = original
    }
    originalTexts.clear()
  }
}

// ===== MutationObserver（SPA 动态内容翻译）=====

// 防抖队列，避免对每个 mutation 单独翻译
let mutationDebounceTimer: ReturnType<typeof setTimeout> | null = null
const pendingMutationNodes = new Set<Text>()

function startMutationObserver(): void {
  if (mutationObserver) return
  mutationObserver = new MutationObserver((mutations) => {
    if (!isPageTranslated) return
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        collectTextNodes(node, pendingMutationNodes)
      }
    }
    if (pendingMutationNodes.size === 0) return
    if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer)
    mutationDebounceTimer = setTimeout(flushPendingMutations, 600)
  })
  mutationObserver.observe(document.body, { childList: true, subtree: true })
}

function stopMutationObserver(): void {
  if (mutationObserver) {
    mutationObserver.disconnect()
    mutationObserver = null
  }
  if (mutationDebounceTimer) {
    clearTimeout(mutationDebounceTimer)
    mutationDebounceTimer = null
  }
  pendingMutationNodes.clear()
}

function collectTextNodes(node: Node, set: Set<Text>): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = node as Text
    const text = t.textContent?.trim()
    if (text && text.length >= 4 && !translatedNodes.has(t)) {
      const parent = t.parentElement
      if (parent && !shouldSkipNode(parent)) {
        set.add(t)
      }
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    for (const child of node.childNodes) {
      collectTextNodes(child, set)
    }
  }
}

async function flushPendingMutations(): Promise<void> {
  const nodes = Array.from(pendingMutationNodes).filter(n => !translatedNodes.has(n))
  pendingMutationNodes.clear()
  if (nodes.length === 0) return
  await Promise.allSettled(nodes.map(node => translateNode(node)))
}

function toggleTranslation(): void {
  if (isTranslated() || originalTexts.size > 0) {
    revertPage()
  } else {
    translatePage()
  }
}

// ===== 消息监听 =====

chrome.runtime.onMessage.addListener((message: { type: string; payload: unknown }, _sender, sendResponse) => {
  switch (message.type) {
    case 'TRANSLATE_PAGE':
      if (isExcluded) { sendResponse({ success: false, reason: 'excluded' }); break }
      translatePage()
      sendResponse({ success: true })
      break

    case 'TOGGLE_TRANSLATION':
      if (isExcluded) { sendResponse({ success: false, reason: 'excluded' }); break }
      toggleTranslation()
      sendResponse({ success: true })
      break

    case 'SET_MODE': {
      const newMode = message.payload as TranslateMode
      if (newMode === currentMode) break
      revertPage()
      disableHoverMode()
      currentMode = newMode
      panelApi?.setMode(newMode)
      if (!isExcluded && newMode === 'hover') enableHoverMode()
      sendResponse({ success: true })
      break
    }

    case 'TOGGLE_MODE': {
      if (isExcluded) { sendResponse({ success: false, reason: 'excluded' }); break }
      const modes: TranslateMode[] = ['bilingual', 'replace', 'hover']
      const idx = modes.indexOf(currentMode)
      const next = modes[(idx + 1) % modes.length]
      chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: { translateMode: next } })
      revertPage()
      disableHoverMode()
      currentMode = next
      panelApi?.setMode(next)
      if (next === 'hover') enableHoverMode()
      showModeToast(next)
      sendResponse({ success: true })
      break
    }

    case 'SHOW_PANEL': {
      if (panelApi) {
        panelApi.show()
      } else {
        // 面板尚未创建（设置为关闭时），临时创建
        panelApi = createFloatingPanel(currentMode, {
          onTranslatePage: translatePage,
          onToggleTranslation: toggleTranslation,
          onModeChange: (mode) => {
            revertPage()
            disableHoverMode()
            currentMode = mode
            chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: { translateMode: mode } })
            if (mode === 'hover') enableHoverMode()
          },
          onOpenSettings: () => chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' }),
          onOpenPdf: () => chrome.tabs.create?.({ url: chrome.runtime.getURL('pdf/index.html') }),
          onOpenAi: () => { if (!sidebarApi) sidebarApi = createAiSidebar(); sidebarApi.toggle() },
          onScreenshot: () => startScreenshotSelection((dataUrl) => {
            if (!sidebarApi) sidebarApi = createAiSidebar()
            sidebarApi.sendMessage('请分析这张截图，描述其内容并提供洞察。', dataUrl)
          }),
        })
      }
      sendResponse({ success: true })
      break
    }

    case 'SHOW_TRANSLATION_POPUP': {
      const { original, translated } = message.payload as { original: string; translated: string }
      showTranslationPopup(original, translated)
      break
    }

    case 'TOGGLE_AI_SIDEBAR': {
      if (!sidebarApi) sidebarApi = createAiSidebar()
      sidebarApi.toggle()
      sendResponse({ success: true })
      break
    }

    case 'SEND_TO_AI': {
      const { text, imageUrl } = message.payload as { text?: string; imageUrl?: string }
      if (!sidebarApi) sidebarApi = createAiSidebar()
      sidebarApi.sendMessage(text ?? '', imageUrl)
      sendResponse({ success: true })
      break
    }
  }
  return true
})

// ===== 初始化 =====

function init(): void {
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response: {
    success: boolean
    data: {
      translateMode?: TranslateMode
      autoTranslatePage?: boolean
      showFloatingPanel?: boolean
      siteOverrides?: Record<string, { engine?: string; translateMode?: TranslateMode; disabled?: boolean }>
      excludedDomains?: string[]
    }
  }) => {
    if (!response?.success) return
    const settings = response.data

    // 设置全局排除标志（消息监听器和 translatePage 都会检查）
    const hostname = location.hostname
    const excluded = settings.excludedDomains ?? []
    const siteOverride = (settings.siteOverrides ?? {})[hostname]
    isExcluded = checkDomainExcluded(excluded) || !!(siteOverride?.disabled)

    // 被排除的域名：不初始化任何翻译功能
    if (isExcluded) return

    // 域名覆盖模式
    currentMode = siteOverride?.translateMode ?? settings.translateMode ?? 'bilingual'

    if (currentMode === 'hover') enableHoverMode()
    if (settings.autoTranslatePage) translatePage()

    // ── 初始化 AI 侧边栏 ──────────────────────────────────────
    sidebarApi = createAiSidebar()

    // 注入"问 AI"回调到悬浮翻译气泡
    setAskAiCallback((text) => {
      sidebarApi!.sendMessage(text)
    })

    // ── 初始化选中文字工具栏 ──────────────────────────────────
    initSelectionToolbar({
      onTranslate: (text) => {
        sidebarApi!.sendMessage(`请翻译以下内容为中文：\n\n${text}`)
      },
      onAskAi: (text) => {
        sidebarApi!.sendMessage(`请帮我解释以下内容：\n\n${text}`)
      },
      onHighlight: (color) => {
        highlightSelection(color, (hlText, _id) => {
          // 高亮后可选追问
          sidebarApi!.sendMessage(`请帮我解释这段高亮内容：\n\n${hlText}`)
        })
      },
    })

    // ── 恢复页面高亮 ──────────────────────────────────────────
    restoreHighlights((hlText, _id) => {
      sidebarApi!.sendMessage(`请帮我解释这段高亮内容：\n\n${hlText}`)
    })

    // ── 仅在用户开启后才创建悬浮面板 ─────────────────────────
    if (settings.showFloatingPanel) {
      panelApi = createFloatingPanel(currentMode, {
        onTranslatePage: translatePage,
        onToggleTranslation: toggleTranslation,
        onModeChange: (mode) => {
          revertPage()
          disableHoverMode()
          currentMode = mode
          chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: { translateMode: mode } })
          if (mode === 'hover') enableHoverMode()
        },
        onOpenSettings: () => {
          chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' })
        },
        onOpenPdf: () => {
          chrome.tabs.create?.({ url: chrome.runtime.getURL('pdf/index.html') })
        },
        onOpenAi: () => sidebarApi!.toggle(),
        onScreenshot: () => startScreenshotSelection((dataUrl) => {
          sidebarApi!.sendMessage('请分析这张截图，描述其内容并提供洞察。', dataUrl)
        }),
      })
    }
  })
}

// 收集页面当前的翻译文本作为 AI 上下文
function collectPageContext(): string {
  const translated = document.querySelectorAll('.xiaoyi-translated')
  if (translated.length > 0) {
    return Array.from(translated).map(el => el.textContent?.trim()).filter(Boolean).slice(0, 50).join('\n')
  }
  // 回退：取正文段落文本
  const paras = Array.from(document.querySelectorAll('p, h1, h2, h3, article'))
    .map(el => el.textContent?.trim())
    .filter(t => t && t.length > 20)
    .slice(0, 30)
  return paras.join('\n').slice(0, 4000)
}

const MODE_NAMES: Record<TranslateMode, string> = {
  bilingual: '双语对照',
  replace: '全文替换',
  hover: '悬浮翻译',
}

// 右键菜单翻译结果的悬浮面板（带原文+译文，可复制，自动消失）
function showTranslationPopup(original: string, translated: string): void {
  // 移除已有面板
  document.getElementById('xiaoyi-translation-popup')?.remove()

  const panel = document.createElement('div')
  panel.id = 'xiaoyi-translation-popup'
  panel.style.cssText = [
    'position:fixed', 'bottom:24px', 'right:24px', 'z-index:2147483647',
    'max-width:380px', 'min-width:260px', 'background:#fff',
    'border:1px solid #e5e7eb', 'border-radius:16px',
    'box-shadow:0 8px 32px rgba(0,0,0,0.15)', 'font-family:system-ui,sans-serif',
    'overflow:hidden', 'animation:xiaoyi-slide-in 0.2s ease',
  ].join(';')

  panel.innerHTML = `
    <style>
      @keyframes xiaoyi-slide-in { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
    </style>
    <div style="padding:12px 14px 8px;background:#f8faff;border-bottom:1px solid #e5e7eb">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span style="font-size:11px;font-weight:600;color:#6b7280;letter-spacing:.05em;text-transform:uppercase">原文</span>
        <button id="tw-popup-close" style="background:none;border:none;cursor:pointer;color:#9ca3af;font-size:16px;line-height:1;padding:0 2px">✕</button>
      </div>
      <p style="margin:6px 0 0;font-size:13px;color:#374151;line-height:1.6;max-height:80px;overflow:auto">${escapeHtml(original)}</p>
    </div>
    <div style="padding:12px 14px 14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:11px;font-weight:600;color:#2563eb;letter-spacing:.05em;text-transform:uppercase">译文</span>
        <button id="tw-popup-copy" style="background:none;border:1px solid #d1d5db;cursor:pointer;color:#6b7280;font-size:11px;padding:2px 8px;border-radius:6px;transition:all .15s">复制</button>
      </div>
      <p id="tw-popup-text" style="margin:0;font-size:14px;color:#111827;line-height:1.7;max-height:120px;overflow:auto">${escapeHtml(translated)}</p>
    </div>
  `

  document.body.appendChild(panel)

  const closeBtn = panel.querySelector('#tw-popup-close') as HTMLElement
  const copyBtn = panel.querySelector('#tw-popup-copy') as HTMLElement
  closeBtn.onclick = () => panel.remove()
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(translated).then(() => {
      copyBtn.textContent = '已复制 ✓'
      copyBtn.style.color = '#16a34a'
      copyBtn.style.borderColor = '#86efac'
      setTimeout(() => {
        copyBtn.textContent = '复制'
        copyBtn.style.color = '#6b7280'
        copyBtn.style.borderColor = '#d1d5db'
      }, 1500)
    })
  }

  // 8 秒后自动消失
  const timer = setTimeout(() => panel.remove(), 8000)
  panel.addEventListener('mouseenter', () => clearTimeout(timer))
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function showModeToast(mode: TranslateMode): void {
  const toast = document.createElement('div')
  toast.className = 'scholar-toast'
  toast.textContent = `翻译模式：${MODE_NAMES[mode]}`
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 2500)
}

init()
