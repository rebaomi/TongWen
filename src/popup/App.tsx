import { useState, useEffect } from 'react'
import type { UserSettings, TranslateMode } from '@/shared/types'
import type { UsageStatus } from '@/utils/usage'
import { ENGINE_INFO, SUPPORTED_LANGUAGES } from '@/shared/constants'
import { FREE_DAILY_LIMIT } from '@/shared/types'
import { sendMessage } from '@/utils/messaging'

const MODE_CONFIG: Record<TranslateMode, { label: string; icon: string; desc: string }> = {
  bilingual: { label: '双语对照', icon: '📖', desc: '原文下方显示译文' },
  replace:   { label: '全文替换', icon: '🔄', desc: '直接替换原文' },
  hover:     { label: '悬浮翻译', icon: '🖱️', desc: '划词即时翻译' },
}

/** 判断 URL 是否为 PDF 直链 */
function isPdfUrl(url: string): boolean {
  try {
    const u = new URL(url)
    // 路径以 .pdf 结尾
    if (u.pathname.toLowerCase().endsWith('.pdf')) return true
    // 常见 PDF 托管路径模式
    const pdfPatterns = [
      /arxiv\.org\/pdf\//i,
      /\/pdf\//i,
      /pdfjs/i,
    ]
    return pdfPatterns.some(p => p.test(u.pathname))
  } catch {
    return false
  }
}

export default function App() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [usage, setUsage] = useState<UsageStatus | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [activeTab, setActiveTab] = useState<'main' | 'settings'>('main')
  const [currentTabUrl, setCurrentTabUrl] = useState<string>('')

  useEffect(() => {
    sendMessage<{ success: boolean; data: UserSettings }>({ type: 'GET_SETTINGS' })
      .then(r => { if (r?.success) setSettings(r.data) })
      .catch(() => {})

    sendMessage<{ success: boolean; data: UsageStatus }>({ type: 'GET_USAGE' })
      .then(r => { if (r?.success) setUsage(r.data) })
      .catch(() => {})

    // 获取当前标签 URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? ''
      setCurrentTabUrl(url)
    })
  }, [])

  const sendToPage = (type: string, payload?: unknown) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
      if (tabs[0]?.id) chrome.tabs.sendMessage(tabs[0].id, { type, payload })
    })
  }

  const handleTranslatePage = () => {
    setIsTranslating(true)
    sendToPage('TRANSLATE_PAGE')
    setTimeout(() => setIsTranslating(false), 2000)
  }

  const handleModeChange = (mode: TranslateMode) => {
    const updated = { ...settings!, translateMode: mode }
    setSettings(updated)
    sendMessage({ type: 'UPDATE_SETTINGS', payload: { translateMode: mode } }).catch(() => {})
    sendToPage('SET_MODE', mode)
  }

  const handleEngineChange = (engineId: string) => {
    const updated = { ...settings!, activeEngine: engineId as UserSettings['activeEngine'] }
    setSettings(updated)
    sendMessage({ type: 'UPDATE_SETTINGS', payload: { activeEngine: engineId } }).catch(() => {})
  }

  const handleTargetLangChange = (lang: string) => {
    const updated = { ...settings!, targetLang: lang }
    setSettings(updated)
    sendMessage({ type: 'UPDATE_SETTINGS', payload: { targetLang: lang } }).catch(() => {})
  }

  const openOptions = () => chrome.runtime.openOptionsPage()

  const openPdfPage = () => chrome.tabs.create({ url: chrome.runtime.getURL('pdf/index.html') })

  /** 把当前标签的 PDF URL 带入插件 PDF 阅读器 */
  const openCurrentPdfInViewer = () => {
    const pdfUrl = chrome.runtime.getURL('pdf/index.html')
    chrome.tabs.create({ url: `${pdfUrl}?url=${encodeURIComponent(currentTabUrl)}` })
  }

  const isCurrentTabPdf = isPdfUrl(currentTabUrl)

  const enabledEngines = settings
    ? Object.entries(settings.engines).filter(([, cfg]) => cfg.enabled)
    : []

  const usagePercent = usage && !usage.isPro
    ? Math.round((usage.used / FREE_DAILY_LIMIT) * 100)
    : 0

  if (!settings) {
    return (
      <div className="w-80 h-40 flex items-center justify-center bg-white">
        <div className="animate-spin text-2xl">⟳</div>
      </div>
    )
  }

  return (
    <div className="w-80 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans select-none">
      {/* 头部 */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎓</span>
            <div>
              <div className="font-bold text-white text-base leading-none">通文 TongWen</div>
              <div className="text-blue-200 text-xs">AI 学术翻译</div>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('main')}
              className={`px-2 py-1 rounded text-xs transition-colors ${activeTab === 'main' ? 'bg-white/20 text-white' : 'text-blue-200 hover:text-white'}`}
            >
              主页
            </button>
            <button
              onClick={openOptions}
              className="px-2 py-1 rounded text-xs text-blue-200 hover:text-white transition-colors"
              title="打开设置"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* 使用量 */}
        {!usage?.isPro && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-blue-200 mb-1">
              <span>今日剩余次数</span>
              <span className="font-medium text-white">
                {usage ? `${usage.remaining} / ${FREE_DAILY_LIMIT}` : '—'}
              </span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${usagePercent >= 100 ? 'bg-red-400' : 'bg-white'}`}
                style={{ width: `${Math.min(100, usagePercent)}%` }}
              />
            </div>
            {usage?.isExhausted && (
              <button
                onClick={openOptions}
                className="mt-2 w-full text-center py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors"
              >
                ✨ 升级 Pro 无限使用
              </button>
            )}
          </div>
        )}

        {usage?.isPro && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-300 font-medium">Pro — 无限翻译</span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* 翻译按钮 */}
        <button
          onClick={handleTranslatePage}
          disabled={isTranslating || (usage?.isExhausted ?? false)}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white dark:disabled:text-gray-400 font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          {isTranslating ? (
            <><span className="animate-spin">⟳</span> 翻译中…</>
          ) : (
            <><span>🌐</span> 翻译当前页面</>
          )}
        </button>

        {/* 当前页是 PDF 时显示专属横幅 */}
        {isCurrentTabPdf && (
          <button
            onClick={openCurrentPdfInViewer}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            📄 在插件中翻译此 PDF
          </button>
        )}

        {/* 快捷操作 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => sendToPage('TOGGLE_TRANSLATION')}
            className="py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 font-medium transition-colors"
          >
            ↩ 显示/隐藏
          </button>
          <button
            onClick={openPdfPage}
            className="py-2 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-sm text-amber-700 dark:text-amber-400 font-medium transition-colors"
          >
            📄 PDF 翻译
          </button>
        </div>

        {/* 悬浮框唤醒按钮 */}
        <button
          onClick={() => sendToPage('SHOW_PANEL')}
          className="w-full py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 font-medium transition-colors flex items-center justify-center gap-1.5"
        >
          🎓 显示页面悬浮框
        </button>

        {/* 翻译模式选择 */}
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">翻译模式</div>
          <div className="space-y-1.5">
            {(Object.entries(MODE_CONFIG) as [TranslateMode, typeof MODE_CONFIG[TranslateMode]][]).map(([mode, cfg]) => (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${settings.translateMode === mode
                  ? 'bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700'
                  : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent'
                  }`}
              >
                <span className="text-base">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${settings.translateMode === mode ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {cfg.label}
                  </div>
                  <div className="text-xs text-gray-400">{cfg.desc}</div>
                </div>
                {settings.translateMode === mode && (
                  <span className="text-blue-600 dark:text-blue-400 text-sm">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 引擎 & 语言 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">翻译引擎</div>
            <select
              value={settings.activeEngine}
              onChange={e => handleEngineChange(e.target.value)}
              className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-gray-700 dark:text-gray-300"
            >
              {enabledEngines.length === 0 && (
                <option value={settings.activeEngine}>
                  {ENGINE_INFO[settings.activeEngine].name}（未配置）
                </option>
              )}
              {enabledEngines.map(([id]) => (
                <option key={id} value={id}>
                  {ENGINE_INFO[id as keyof typeof ENGINE_INFO].icon} {ENGINE_INFO[id as keyof typeof ENGINE_INFO].name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">目标语言</div>
            <select
              value={settings.targetLang}
              onChange={e => handleTargetLangChange(e.target.value)}
              className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-gray-700 dark:text-gray-300"
            >
              {SUPPORTED_LANGUAGES.filter(l => l.code !== 'auto').map(l => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <button
            onClick={openOptions}
            className="text-xs text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-1"
          >
            ⚙️ API 设置
          </button>
          <div className="text-xs text-gray-400">
            Alt+T 翻译页面
          </div>
        </div>
      </div>
    </div>
  )
}
