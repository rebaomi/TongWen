import { translate } from '@/engines'
import {
  getSettings, getSettingsWithKeys, saveSettings,
  incrementUsage, isProActive, getUsage, saveApiKey, deleteApiKey, getApiKeys,
} from '@/utils/storage'
import { getUsageStatus } from '@/utils/usage'
import { FREE_DAILY_LIMIT } from '@/shared/types'
import type { Message, MessageResponse, TranslateOptions, EngineId } from '@/shared/types'

// 安装时初始化右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'scholar-translate-selection',
    title: '翻译选中文本',
    contexts: ['selection'],
  })
  chrome.contextMenus.create({
    id: 'scholar-translate-page',
    title: '翻译整个页面',
    contexts: ['page'],
  })
  chrome.contextMenus.create({
    id: 'scholar-translate-link',
    title: '打开并翻译链接',
    contexts: ['link'],
  })
})

// 右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
  if (!tab?.id) return

  if (info.menuItemId === 'scholar-translate-selection' && info.selectionText) {
    const result = await handleTranslateText(info.selectionText)
    chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_TRANSLATION_POPUP',
      payload: result,
    })
  }
  if (info.menuItemId === 'scholar-translate-page') {
    chrome.tabs.sendMessage(tab.id, { type: 'TRANSLATE_PAGE' })
  }
  if (info.menuItemId === 'scholar-translate-link' && info.linkUrl) {
    chrome.tabs.create({ url: info.linkUrl, active: true }, (newTab: chrome.tabs.Tab) => {
      if (!newTab.id) return
      chrome.tabs.onUpdated.addListener(function listener(tabId: number, changeInfo: { status?: string }) {
        if (tabId === newTab.id && changeInfo.status === 'complete') {
          chrome.tabs.sendMessage(tabId, { type: 'TRANSLATE_PAGE' })
          chrome.tabs.onUpdated.removeListener(listener)
        }
      })
    })
  }
})

// 键盘快捷键
chrome.commands.onCommand.addListener((command: string, tab?: chrome.tabs.Tab) => {
  if (!tab?.id) return
  if (command === 'translate-page') {
    chrome.tabs.sendMessage(tab.id, { type: 'TRANSLATE_PAGE' })
  }
  if (command === 'toggle-mode') {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_MODE' })
  }
})

// 消息处理：只接受来自插件自身（扩展页面或内容脚本）的消息
chrome.runtime.onMessage.addListener((message: Message, sender: chrome.runtime.MessageSender, sendResponse: (r: MessageResponse) => void) => {
  // 过滤掉非法来源（理论上只允许同一扩展的消息）
  if (sender.id && sender.id !== chrome.runtime.id) {
    sendResponse({ success: false, error: 'Unauthorized sender' })
    return false
  }
  handleMessage(message, sender).then(sendResponse)
  return true
})

/** 判断消息是否来自扩展内部页面（popup / options / pdf），而非注入到网页的内容脚本 */
function isFromExtensionPage(sender: chrome.runtime.MessageSender): boolean {
  // 方式1：URL 以自身 chrome-extension://ID 开头（options/pdf 等以 tab 打开的页面）
  if (sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}`)) return true
  // 方式2：sender 没有关联的 tab，说明来自 popup 或其他扩展内部上下文
  if (sender.id === chrome.runtime.id && !sender.tab) return true
  return false
}

async function handleMessage(message: Message, sender: chrome.runtime.MessageSender): Promise<MessageResponse> {
  try {
    switch (message.type) {
      case 'TRANSLATE_TEXT': {
        const { text, options, countAsUsage } = message.payload as {
          text: string
          options?: Partial<TranslateOptions>
          countAsUsage?: boolean
        }
        const result = await handleTranslateText(text, options, countAsUsage ?? false)
        return { success: true, data: result }
      }

      case 'INCREMENT_USAGE': {
        const pro = await isProActive()
        if (!pro) {
          const usage = await getUsage()
          if (usage.count >= FREE_DAILY_LIMIT) {
            return { success: false, error: 'LIMIT_EXCEEDED' }
          }
          await incrementUsage(0)
        }
        return { success: true }
      }

      case 'GET_SETTINGS': {
        const settings = await getSettings()
        // 内容脚本只拿非敏感字段，API Key 永远不出 Service Worker
        if (!isFromExtensionPage(sender)) {
          const safe = {
            translateMode: settings.translateMode,
            targetLang: settings.targetLang,
            sourceLang: settings.sourceLang,
            autoTranslatePage: settings.autoTranslatePage,
            preserveFormulas: settings.preserveFormulas,
            theme: settings.theme,
          }
          return { success: true, data: safe }
        }
        // 扩展内部页面返回完整设置（也不含 apiKey，key 单独由 GET_APIKEY_HINT 获取）
        return { success: true, data: settings }
      }

      case 'UPDATE_SETTINGS': {
        // 只允许扩展内部页面修改设置
        if (!isFromExtensionPage(sender)) {
          return { success: false, error: 'Unauthorized' }
        }
        await saveSettings(message.payload as Record<string, unknown>)
        return { success: true }
      }

      case 'SAVE_API_KEY': {
        // 只允许扩展内部页面保存 API Key
        if (!isFromExtensionPage(sender)) {
          return { success: false, error: 'Unauthorized' }
        }
        const { engineId, apiKey } = message.payload as { engineId: EngineId; apiKey: string }
        if (apiKey) {
          await saveApiKey(engineId, apiKey)
        } else {
          await deleteApiKey(engineId)
        }
        return { success: true }
      }

      case 'GET_APIKEY_HINT': {
        // 只允许扩展内部页面读取 key（返回脱敏版，仅用于 UI 展示）
        if (!isFromExtensionPage(sender)) {
          return { success: false, error: 'Unauthorized' }
        }
        const keys = await getApiKeys()
        const { engineId } = message.payload as { engineId: EngineId }
        const key = keys[engineId] ?? ''
        // 脱敏：只返回前4位和后4位
        const hint = key.length > 8
          ? `${key.slice(0, 4)}${'*'.repeat(key.length - 8)}${key.slice(-4)}`
          : key ? '****' : ''
        return { success: true, data: { hint, hasKey: key.length > 0 } }
      }

      case 'OPEN_OPTIONS': {
        chrome.runtime.openOptionsPage()
        return { success: true }
      }

      case 'GET_USAGE': {
        const status = await getUsageStatus()
        return { success: true, data: status }
      }

      case 'CHECK_PRO': {
        const pro = await isProActive()
        return { success: true, data: { isPro: pro } }
      }

      default:
        return { success: false, error: 'Unknown message type' }
    }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// countAsUsage=true：本次翻译自己计 1 次（划词/右键）
// countAsUsage=false：由上层统一计次，本次只检查限制不递增
async function handleTranslateText(
  text: string,
  opts?: Partial<TranslateOptions>,
  countAsUsage = false
) {
  // 翻译时使用注入了 API Key 的完整设置（Key 仅在 SW 内存中短暂存在）
  const settings = await getSettingsWithKeys()
  const pro = await isProActive()

  // 始终检查限制（确保批量翻译中途也能中止）
  if (!pro) {
    const usage = await getUsage()
    if (usage.count >= FREE_DAILY_LIMIT) {
      throw new Error('LIMIT_EXCEEDED')
    }
  }

  const options: TranslateOptions = {
    from: settings.sourceLang,
    to: settings.targetLang,
    engine: settings.activeEngine,
    preserveFormulas: settings.preserveFormulas,
    preserveCitations: settings.preserveCitations,
    ...opts,
  }

  const engineConfig = settings.engines[options.engine]
  if (!engineConfig) throw new Error(`Engine ${options.engine} not configured`)

  const result = await translate(text, options, engineConfig)

  // 只有明确要求计次时才递增（划词、右键单次翻译）
  if (countAsUsage && !pro) {
    await incrementUsage(text.length)
  }

  return result
}
