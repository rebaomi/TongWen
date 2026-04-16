import type { TranslateMode } from '@/shared/types'
import { getTranslatableNodes, translateWithFormulaProtection, recordOneUse } from './translator'
import { injectBilingualTranslation, removeBilingualTranslations, isTranslated } from './bilingual'
import { enableHoverMode, disableHoverMode } from './hover'
import { showProUpgradeToast, showLoadingBar, hideLoadingBar, showErrorToast } from './ui'
import { createFloatingPanel } from './floating-panel'

let currentMode: TranslateMode = 'bilingual'
let isPageTranslating = false
let originalTexts = new Map<Text, string>() // 用于 replace 模式恢复
let panelApi: ReturnType<typeof createFloatingPanel> | null = null

// ===== 主控制 =====

async function translatePage(): Promise<void> {
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
  } catch (err) {
    console.error('[ScholarLens] Page translation error:', err)
  } finally {
    isPageTranslating = false
    hideLoadingBar()
    panelApi?.setTranslating(false)
  }
}

async function translateNode(node: Text): Promise<void> {
  const original = node.textContent?.trim()
  if (!original || original.length < 4) return

  try {
    const translated = await translateWithFormulaProtection(original)

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
  if (currentMode === 'bilingual') {
    removeBilingualTranslations()
  } else if (currentMode === 'replace') {
    for (const [node, original] of originalTexts) {
      node.textContent = original
    }
    originalTexts.clear()
  }
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
      translatePage()
      sendResponse({ success: true })
      break

    case 'TOGGLE_TRANSLATION':
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
      if (newMode === 'hover') enableHoverMode()
      sendResponse({ success: true })
      break
    }

    case 'TOGGLE_MODE': {
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
        })
      }
      sendResponse({ success: true })
      break
    }

    case 'SHOW_TRANSLATION_POPUP': {
      const { translated } = message.payload as { original: string; translated: string }
      const toast = document.createElement('div')
      toast.className = 'scholar-toast'
      toast.textContent = translated
      document.body.appendChild(toast)
      setTimeout(() => toast.remove(), 4000)
      break
    }
  }
  return true
})

// ===== 初始化 =====

function init(): void {
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response: {
    success: boolean
    data: { translateMode?: TranslateMode; autoTranslatePage?: boolean; showFloatingPanel?: boolean }
  }) => {
    if (!response?.success) return
    const settings = response.data
    currentMode = settings.translateMode ?? 'bilingual'

    if (currentMode === 'hover') enableHoverMode()
    if (settings.autoTranslatePage) translatePage()

    // 仅在用户开启后才创建悬浮面板
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
      })
    }
  })
}

const MODE_NAMES: Record<TranslateMode, string> = {
  bilingual: '双语对照',
  replace: '全文替换',
  hover: '悬浮翻译',
}

function showModeToast(mode: TranslateMode): void {
  const toast = document.createElement('div')
  toast.className = 'scholar-toast'
  toast.textContent = `翻译模式：${MODE_NAMES[mode]}`
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 2500)
}

init()
