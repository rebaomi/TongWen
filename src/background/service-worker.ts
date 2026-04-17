import { translate } from '@/engines'
import {
  chatOpenAICompatible, chatGemini, chatClaude, supportsChatEngine,
} from '@/engines/chat'
import {
  getSettings, getSettingsWithKeys, saveSettings,
  incrementUsage, isProActive, getUsage, saveApiKey, deleteApiKey, getApiKeys,
} from '@/utils/storage'
import { getUsageStatus } from '@/utils/usage'
import { FREE_DAILY_LIMIT } from '@/shared/types'
import type { Message, MessageResponse, TranslateOptions, EngineId, ChatMessage, Highlight } from '@/shared/types'

// Session-level translation cache: key = "engine:from:to:text" → translated
const translationCache = new Map<string, string>()

// ── 高亮标注持久化 ────────────────────────────────────────────
const HIGHLIGHTS_KEY = 'xiaoyi_highlights'

async function getAllHighlights(): Promise<Highlight[]> {
  const r = await chrome.storage.local.get(HIGHLIGHTS_KEY)
  return (r[HIGHLIGHTS_KEY] as Highlight[]) ?? []
}

async function saveHighlight(h: Highlight): Promise<void> {
  const list = await getAllHighlights()
  list.push(h)
  await chrome.storage.local.set({ [HIGHLIGHTS_KEY]: list })
}

async function deleteHighlight(id: string): Promise<void> {
  const list = await getAllHighlights()
  await chrome.storage.local.set({ [HIGHLIGHTS_KEY]: list.filter(h => h.id !== id) })
}

// ── AI Chat 流式端口 ──────────────────────────────────────────
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'xiaoyi-ai-chat') return

  port.onMessage.addListener(async (msg: {
    messages: ChatMessage[]
    context?: string
    imageUrl?: string
  }) => {
    try {
      const settings = await getSettingsWithKeys()
      const engineId = settings.activeEngine
      const config = settings.engines[engineId]

      if (!supportsChatEngine(engineId)) {
        port.postMessage({ type: 'error', error: `当前引擎「${config?.name ?? engineId}」不支持 AI 对话，请在设置中切换到 DeepSeek / OpenAI / Gemini 等支持对话的引擎` })
        return
      }

      // 注入页面上下文作为 system 消息
      const systemContent = msg.context
        ? `你是一个智能阅读助手，正在帮助用户阅读以下内容：\n\n${msg.context.slice(0, 3000)}\n\n请根据内容回答用户的问题，使用中文回答。`
        : '你是一个智能阅读助手，帮助用户理解学术文章和网页内容。请使用中文回答。'

      const allMessages: ChatMessage[] = [
        { role: 'user', content: systemContent, id: 'sys', timestamp: 0 },
        ...msg.messages,
      ]

      const onChunk = (chunk: string) => {
        try { port.postMessage({ type: 'chunk', text: chunk }) } catch { /* port closed */ }
      }

      if (engineId === 'gemini') {
        await chatGemini(allMessages, config, onChunk, msg.imageUrl)
      } else if (engineId === 'claude') {
        await chatClaude(allMessages, config, onChunk, msg.imageUrl)
      } else {
        // OpenAI 兼容引擎
        const ENGINE_URLS: Partial<Record<EngineId, { url: string; model: string }>> = {
          openai:   { url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
          deepseek: { url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
          qwen:     { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
          minimax:  { url: 'https://api.minimaxi.chat/v1', model: 'MiniMax-Text-01' },
          kimi:     { url: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
          glm:      { url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
          grok:     { url: 'https://api.x.ai/v1', model: 'grok-3-mini' },
          doubao:   { url: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-pro-4k' },
          local:    { url: 'http://127.0.0.1:11434/v1', model: '' },
        }
        const defaults = ENGINE_URLS[engineId] ?? { url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }
        const baseUrl = config.apiUrl?.trim() || defaults.url
        const model = config.model?.trim() || defaults.model
        await chatOpenAICompatible(allMessages, config, baseUrl, model, config.name, onChunk, msg.imageUrl)
      }

      port.postMessage({ type: 'done' })
    } catch (e) {
      try { port.postMessage({ type: 'error', error: String(e).replace(/^Error:\s*/, '') }) } catch { /* port closed */ }
    }
  })
})

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
            showFloatingPanel: settings.showFloatingPanel,
            siteOverrides: settings.siteOverrides ?? {},
            excludedDomains: settings.excludedDomains ?? [],
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

      // ── 高亮标注 ──────────────────────────────────────────
      case 'SAVE_HIGHLIGHT': {
        await saveHighlight(message.payload as Highlight)
        return { success: true }
      }

      case 'GET_HIGHLIGHTS': {
        const { url } = message.payload as { url: string }
        const all = await getAllHighlights()
        return { success: true, data: all.filter(h => h.url === url) }
      }

      case 'DELETE_HIGHLIGHT': {
        const { id } = message.payload as { id: string }
        await deleteHighlight(id)
        return { success: true }
      }

      // ── 截图 ──────────────────────────────────────────────
      case 'TAKE_SCREENSHOT': {
        try {
          const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' })
          return { success: true, data: { dataUrl } }
        } catch (e) {
          return { success: false, error: String(e) }
        }
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

  // 查缓存（仅限同一 session，SW 重启自动清空）
  const cacheKey = `${options.engine}:${options.from}:${options.to}:${text}`
  if (translationCache.has(cacheKey)) {
    return { original: text, translated: translationCache.get(cacheKey)!, engine: options.engine }
  }

  const result = await translate(text, options, engineConfig)

  // 应用自定义术语表（后处理替换）
  const glossary = settings.glossary ?? {}
  if (Object.keys(glossary).length > 0) {
    let translated = result.translated
    for (const [term, replacement] of Object.entries(glossary)) {
      if (term && replacement) {
        translated = translated.replaceAll(term, replacement)
      }
    }
    result.translated = translated
  }

  // 写缓存（限制大小，防止无限增长）
  if (translationCache.size > 2000) {
    const firstKey = translationCache.keys().next().value
    if (firstKey !== undefined) translationCache.delete(firstKey)
  }
  translationCache.set(cacheKey, result.translated)

  // 只有明确要求计次时才递增（划词、右键单次翻译）
  if (countAsUsage && !pro) {
    await incrementUsage(text.length)
  }

  return result
}
