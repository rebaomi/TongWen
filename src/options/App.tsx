import { useState, useEffect } from 'react'
import type { UserSettings, EngineId, SubscriptionInfo } from '@/shared/types'
import { ENGINE_INFO, SUPPORTED_LANGUAGES, DEFAULT_SETTINGS } from '@/shared/constants'
import { FREE_DAILY_LIMIT } from '@/shared/types'
import type { UsageStatus } from '@/utils/usage'
import { sendMessage } from '@/utils/messaging'

type Section = 'engines' | 'translation' | 'advanced' | 'upgrade'

export default function OptionsApp() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [subscription, setSubscription] = useState<SubscriptionInfo>({ isPro: false })
  const [usage, setUsage] = useState<UsageStatus | null>(null)
  const [activeSection, setActiveSection] = useState<Section>('engines')
  const [saved, setSaved] = useState(false)
  const [licenseKey, setLicenseKey] = useState('')
  const [licenseError, setLicenseError] = useState('')
  const [ollamaTestState, setOllamaTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [ollamaTestMsg, setOllamaTestMsg] = useState('')
  // API Key 输入框的临时值（从不在 state 里长期存放 key 明文）
  const [apiKeyInputs, setApiKeyInputs] = useState<Partial<Record<EngineId, string>>>({})
  const [apiKeyHints, setApiKeyHints] = useState<Partial<Record<EngineId, string>>>({})  // 脱敏提示

  useEffect(() => {
    // 处理 URL hash 跳转（如 #upgrade）
    const hash = window.location.hash.replace('#', '') as Section
    if (hash) setActiveSection(hash as Section)

    sendMessage<{ success: boolean; data: UserSettings }>({ type: 'GET_SETTINGS' })
      .then(r => {
        if (r?.success) {
          setSettings({ ...DEFAULT_SETTINGS, ...r.data })
          const engineIds: EngineId[] = [
          'google', 'deepl', 'deepseek', 'openai', 'baidu', 'local',
          'qwen', 'minimax', 'kimi', 'glm', 'gemini', 'grok', 'claude', 'doubao',
        ]
          engineIds.forEach(id => {
            sendMessage<{ success: boolean; data: { hint: string; hasKey: boolean } }>(
              { type: 'GET_APIKEY_HINT', payload: { engineId: id } }
            ).then(hr => {
              if (hr?.success && hr.data.hasKey) {
                setApiKeyHints(prev => ({ ...prev, [id]: hr.data.hint }))
              }
            }).catch(() => {})
          })
        }
      }).catch(() => {})

    sendMessage<{ success: boolean; data: UsageStatus }>({ type: 'GET_USAGE' })
      .then(r => { if (r?.success) setUsage(r.data) }).catch(() => {})

    sendMessage<{ success: boolean; data: SubscriptionInfo }>({ type: 'CHECK_PRO' })
      .then(r => { if (r?.success) setSubscription(r.data) }).catch(() => {})
  }, [])

  const save = async (partial: Partial<UserSettings>) => {
    const updated = { ...settings, ...partial }
    setSettings(updated)
    sendMessage({ type: 'UPDATE_SETTINGS', payload: partial as Record<string, unknown> }).catch(() => {})
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const updateEngine = (engineId: EngineId, patch: Record<string, unknown>) => {
    // API Key 单独走 SAVE_API_KEY 通道，不混入普通设置
    if ('apiKey' in patch) {
      const key = patch.apiKey as string
      sendMessage({ type: 'SAVE_API_KEY', payload: { engineId, apiKey: key } }).catch(() => {})
      // 更新脱敏提示（只存 hint，不存明文）
      if (key) {
        const hint = key.length > 8
          ? `${key.slice(0, 4)}${'*'.repeat(Math.min(key.length - 8, 12))}${key.slice(-4)}`
          : '****'
        setApiKeyHints(prev => ({ ...prev, [engineId]: hint }))
      } else {
        setApiKeyHints(prev => { const n = { ...prev }; delete n[engineId]; return n })
      }
      const { apiKey: _, ...rest } = patch
      if (Object.keys(rest).length === 0) return
      patch = rest
    }

    const updated = {
      ...settings,
      engines: {
        ...settings.engines,
        [engineId]: { ...settings.engines[engineId], ...patch },
      },
    }
    setSettings(updated)
    sendMessage({ type: 'UPDATE_SETTINGS', payload: { engines: updated.engines } as Record<string, unknown> }).catch(() => {})
  }

  const activateLicense = () => {
    if (licenseKey.length < 16) {
      setLicenseError('许可证密钥格式不正确')
      return
    }
    // 实际产品中应向服务器验证
    const info: SubscriptionInfo = {
      isPro: true,
      licenseKey,
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    }
    chrome.storage.sync.set({ scholar_lens_subscription: info })
    setSubscription(info)
    setLicenseKey('')
    setLicenseError('')
  }

  const testOllamaConnection = async () => {
    const apiUrl = (settings.engines.local.apiUrl ?? 'http://127.0.0.1:11434').replace(/\/$/, '')
    setOllamaTestState('testing')
    setOllamaTestMsg('')
    try {
      const res = await fetch(`${apiUrl}/api/tags`)
      if (res.status === 403) throw new Error('CORS_403')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { models?: { name: string }[] }
      const models = (data.models ?? []).map((m: { name: string }) => m.name)

      if (models.length === 0) {
        setOllamaTestState('ok')
        setOllamaTestMsg('连接成功，但未找到已安装模型，请运行：ollama pull qwen2.5:7b')
        return
      }

      // 若模型名未填，自动填入第一个已安装模型
      if (!settings.engines.local.model?.trim()) {
        updateEngine('local', { model: models[0] })
      }

      setOllamaTestState('ok')
      setOllamaTestMsg(`连接成功！已安装模型：${models.join('、')}`)
    } catch (e) {
      setOllamaTestState('error')
      const msg = String(e)
      if (msg.includes('CORS_403')) {
        setOllamaTestMsg('返回 403：请设置 OLLAMA_ORIGINS=* 后重启 Ollama（见下方说明）')
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setOllamaTestMsg('无法连接，请确认：① ollama serve 已运行 ② 端口正确（默认 11434）')
      } else {
        setOllamaTestMsg(`连接失败：${msg}`)
      }
    }
  }

  const NAV: { id: Section; label: string; icon: string }[] = [
    { id: 'engines', label: '翻译引擎', icon: '⚙️' },
    { id: 'translation', label: '翻译设置', icon: '🌐' },
    { id: 'advanced', label: '高级选项', icon: '🔧' },
    { id: 'upgrade', label: '升级 Pro', icon: '✨' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      {/* 侧边导航 */}
      <aside className="w-56 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-2 mb-6 px-2">
          <span className="text-2xl">🎓</span>
          <div>
            <div className="font-bold text-gray-900 dark:text-white">ScholarLens</div>
            <div className="text-xs text-gray-400">设置</div>
          </div>
        </div>
        <nav className="space-y-1">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${activeSection === item.id
                ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
            >
              <span>{item.icon}</span>
              {item.label}
              {item.id === 'upgrade' && !subscription.isPro && (
                <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">免费</span>
              )}
              {item.id === 'upgrade' && subscription.isPro && (
                <span className="ml-auto text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Pro</span>
              )}
            </button>
          ))}
        </nav>

        {saved && (
          <div className="mt-4 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-50 text-green-700 text-sm">
            ✓ 已保存
          </div>
        )}
      </aside>

      {/* 主内容 */}
      <main className="flex-1 p-8 max-w-3xl">
        {/* ===== 翻译引擎 ===== */}
        {activeSection === 'engines' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">翻译引擎配置</h2>
              <p className="text-sm text-gray-500 mt-1">配置你的 API 密钥，启用对应引擎</p>
            </div>

            {(Object.keys(ENGINE_INFO) as EngineId[]).map(engineId => {
              const info = ENGINE_INFO[engineId]
              const cfg = settings.engines[engineId]
              return (
                <div key={engineId} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{info.icon}</span>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">{info.name}</div>
                        <div className="text-sm text-gray-500">{info.description}</div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cfg?.enabled ?? false}
                        onChange={e => updateEngine(engineId, { enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                    </label>
                  </div>

                  {cfg?.enabled && (
                    <div className="space-y-3">
                      {info.requiresKey && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            {info.keyLabel}
                            <a href={info.docsUrl} target="_blank" rel="noreferrer" className="ml-2 text-blue-500 hover:underline">获取 →</a>
                          </label>
                          <div className="relative">
                            <input
                              type="password"
                              placeholder={
                                apiKeyHints[engineId]
                                  ? `当前：${apiKeyHints[engineId]}（输入新值可覆盖）`
                                  : engineId === 'baidu' ? 'APPID:密钥' : 'sk-...'
                              }
                              value={apiKeyInputs[engineId] ?? ''}
                              onChange={e => setApiKeyInputs(prev => ({ ...prev, [engineId]: e.target.value }))}
                              onBlur={e => {
                                const val = e.target.value.trim()
                                if (val) {
                                  updateEngine(engineId, { apiKey: val })
                                  setApiKeyInputs(prev => ({ ...prev, [engineId]: '' }))
                                }
                              }}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 font-mono"
                            />
                            {apiKeyHints[engineId] && !apiKeyInputs[engineId] && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600">✓ 已设置</span>
                            )}
                          </div>
                        </div>
                      )}

                      {(engineId === 'deepseek' || engineId === 'openai') && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">模型（可选）</label>
                          <input
                            type="text"
                            placeholder={engineId === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'}
                            value={cfg.model ?? ''}
                            onChange={e => updateEngine(engineId, { model: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      )}

                      {engineId === 'local' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            模型名称
                            <span className="ml-1 text-blue-500">（点击「测试连接」可自动填入）</span>
                          </label>
                          <input
                            type="text"
                            placeholder="留空则自动使用第一个已安装模型"
                            value={cfg.model ?? ''}
                            onChange={e => updateEngine(engineId, { model: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      )}

                      {(engineId === 'local' || engineId === 'openai') && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            API 地址（可选）
                          </label>
                          <input
                            type="text"
                            placeholder={engineId === 'local' ? 'http://localhost:11434' : 'https://api.openai.com/v1'}
                            value={cfg.apiUrl ?? ''}
                            onChange={e => updateEngine(engineId, { apiUrl: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      )}

                      {engineId === 'local' && (
                        <div className="space-y-3">
                          {/* 连接测试 */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={testOllamaConnection}
                              disabled={ollamaTestState === 'testing'}
                              className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-sm font-medium transition-colors flex items-center gap-1.5"
                            >
                              {ollamaTestState === 'testing' ? (
                                <><span className="animate-spin inline-block">⟳</span> 测试中…</>
                              ) : '🔌 测试连接'}
                            </button>
                            {ollamaTestState === 'ok' && (
                              <span className="text-xs text-green-600 font-medium">✓ {ollamaTestMsg}</span>
                            )}
                            {ollamaTestState === 'error' && (
                              <span className="text-xs text-red-600">{ollamaTestMsg}</span>
                            )}
                          </div>

                          {/* CORS 说明 */}
                          <div className="bg-red-50 border border-red-300 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🚫</span>
                              <span className="font-bold text-red-800 text-sm">必须配置 OLLAMA_ORIGINS，否则会报 403</span>
                            </div>
                            <p className="text-xs text-red-700">
                              Chrome 扩展的来源是 <code className="bg-red-100 px-1 rounded font-mono">chrome-extension://...</code>，
                              Ollama 默认不允许此来源，会直接返回 403 拒绝。需要设置环境变量告知 Ollama 放行。
                            </p>

                            <div className="space-y-2">
                              <div className="text-xs font-bold text-red-800">① Windows —— 永久生效（推荐）</div>
                              <div className="text-xs text-red-700">在 PowerShell 中执行（只需一次），然后重启 Ollama：</div>
                              <code className="block bg-white border border-red-200 px-3 py-2 rounded-lg text-xs text-red-900 font-mono select-all cursor-text whitespace-pre-wrap break-all">
                                [System.Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', '*', 'User')
                              </code>
                            </div>

                            <div className="space-y-2">
                              <div className="text-xs font-bold text-red-800">① Windows —— 仅本次会话</div>
                              <div className="text-xs text-red-700">在 CMD 或 PowerShell 中启动 Ollama（每次开机都要做）：</div>
                              <code className="block bg-white border border-red-200 px-3 py-2 rounded-lg text-xs text-red-900 font-mono select-all cursor-text">
                                {`set OLLAMA_ORIGINS=*\nollama serve`}
                              </code>
                            </div>

                            <div className="space-y-2">
                              <div className="text-xs font-bold text-red-800">① macOS / Linux</div>
                              <code className="block bg-white border border-red-200 px-3 py-2 rounded-lg text-xs text-red-900 font-mono select-all cursor-text">
                                {`OLLAMA_ORIGINS=* ollama serve`}
                              </code>
                            </div>

                            <div className="text-xs text-red-600 pt-1 border-t border-red-200">
                              设置后重启 Ollama，再点击「测试连接」验证。
                            </div>
                          </div>

                          {/* 推荐模型 */}
                          <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                            <div className="font-medium text-gray-700 mb-1">推荐模型（中文翻译效果好）</div>
                            <div className="space-y-0.5 font-mono">
                              <div>ollama pull qwen2.5:7b &nbsp;&nbsp;<span className="text-gray-400">（推荐，~4.7GB）</span></div>
                              <div>ollama pull qwen2.5:14b <span className="text-gray-400">（更准，~9GB）</span></div>
                              <div>ollama pull llama3.1:8b <span className="text-gray-400">（英文强）</span></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ===== 翻译设置 ===== */}
        {activeSection === 'translation' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">翻译设置</h2>
              <p className="text-sm text-gray-500 mt-1">自定义翻译行为和显示方式</p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {/* 默认语言 */}
              <div className="p-5 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">原始语言</label>
                  <select
                    value={settings.sourceLang}
                    onChange={e => save({ sourceLang: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                  >
                    {SUPPORTED_LANGUAGES.map(l => (
                      <option key={l.code} value={l.code}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">目标语言</label>
                  <select
                    value={settings.targetLang}
                    onChange={e => save({ targetLang: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                  >
                    {SUPPORTED_LANGUAGES.filter(l => l.code !== 'auto').map(l => (
                      <option key={l.code} value={l.code}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 学术特性 */}
              {[
                { key: 'showFloatingPanel', label: '显示页面悬浮框', desc: '在每个网页右下角显示翻译悬浮操作框', icon: '🎓' },
                { key: 'preserveFormulas', label: '保留数学公式', desc: '自动识别并保留 LaTeX 公式（$...$ 和 $$...$$）', icon: '📐' },
                { key: 'preserveCitations', label: '保留参考文献格式', desc: '保留 [1], (Author 2020) 等引用标记', icon: '📖' },
                { key: 'autoTranslatePdf', label: '自动翻译 PDF', desc: '打开 PDF 时自动开始翻译', icon: '📄' },
                { key: 'autoTranslatePage', label: '自动翻译网页', desc: '访问新页面时自动翻译（可能影响性能）', icon: '🌐' },
              ].map(item => (
                <div key={item.key} className="p-5 flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</div>
                      <div className="text-xs text-gray-500">{item.desc}</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings[item.key as keyof UserSettings] as boolean}
                      onChange={e => save({ [item.key]: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                  </label>
                </div>
              ))}

              {/* 译文字号 */}
              <div className="p-5">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">译文字号比例</label>
                  <span className="text-sm text-blue-600 font-mono">{Math.round(settings.fontSizeScale * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.2"
                  step="0.05"
                  value={settings.fontSizeScale}
                  onChange={e => save({ fontSizeScale: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>70%</span><span>100%</span><span>120%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== 高级选项 ===== */}
        {activeSection === 'advanced' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">高级选项</h2>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  排除域名（每行一个，在这些网站上不激活翻译）
                </label>
                <textarea
                  rows={5}
                  value={settings.excludedDomains.join('\n')}
                  onChange={e => save({ excludedDomains: e.target.value.split('\n').filter(Boolean) })}
                  placeholder="example.com&#10;mail.google.com&#10;..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">主题</label>
                <div className="flex gap-2">
                  {(['system', 'light', 'dark'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => save({ theme: t })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${settings.theme === t
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      {t === 'system' ? '🖥 跟随系统' : t === 'light' ? '☀️ 浅色' : '🌙 深色'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 今日使用统计 */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">📊 今日使用统计</h3>
                <button
                  onClick={async () => {
                    await chrome.storage.local.remove('scholar_lens_usage')
                    // 刷新 usage 数据
                    sendMessage<{ success: boolean; data: UsageStatus }>({ type: 'GET_USAGE' })
                      .then(r => { if (r?.success) setUsage(r.data) }).catch(() => {})
                  }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50"
                  title="重置今日使用次数（用于测试）"
                >
                  🔄 重置次数
                </button>
              </div>
              {usage && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{usage.used}</div>
                    <div className="text-xs text-gray-500 mt-1">今日已用</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/30 rounded-xl">
                    <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                      {usage.isPro ? '∞' : usage.remaining}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">剩余次数</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== 升级 Pro ===== */}
        {activeSection === 'upgrade' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">升级 Pro</h2>
            </div>

            {subscription.isPro ? (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-200 dark:border-green-800 p-8 text-center">
                <div className="text-5xl mb-3">🎉</div>
                <h3 className="text-xl font-bold text-green-800 dark:text-green-300">你是 Pro 用户</h3>
                <p className="text-green-700 dark:text-green-400 mt-2">享受无限翻译，感谢你的支持！</p>
                {subscription.expiresAt && (
                  <p className="text-sm text-gray-500 mt-3">
                    有效期至 {new Date(subscription.expiresAt).toLocaleDateString('zh-CN')}
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* 免费 vs Pro 对比 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                    <div className="text-base font-bold text-gray-700 dark:text-gray-300 mb-3">免费版</div>
                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex items-center gap-2"><span className="text-green-500">✓</span> 每日 {FREE_DAILY_LIMIT} 次翻译</li>
                      <li className="flex items-center gap-2"><span className="text-green-500">✓</span> 所有翻译模式</li>
                      <li className="flex items-center gap-2"><span className="text-green-500">✓</span> PDF 基础翻译</li>
                      <li className="flex items-center gap-2"><span className="text-red-400">✗</span> 无限次数</li>
                      <li className="flex items-center gap-2"><span className="text-red-400">✗</span> 批量 PDF 处理</li>
                      <li className="flex items-center gap-2"><span className="text-red-400">✗</span> 优先客服支持</li>
                    </ul>
                  </div>
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-5 text-white">
                    <div className="text-base font-bold mb-1">Pro 版 ✨</div>
                    <div className="text-3xl font-bold mb-3">¥29<span className="text-sm font-normal text-blue-200">/月</span></div>
                    <ul className="space-y-2 text-sm text-blue-100">
                      <li className="flex items-center gap-2"><span className="text-white">✓</span> <strong className="text-white">无限次翻译</strong></li>
                      <li className="flex items-center gap-2"><span className="text-white">✓</span> 所有翻译引擎</li>
                      <li className="flex items-center gap-2"><span className="text-white">✓</span> 批量 PDF 翻译</li>
                      <li className="flex items-center gap-2"><span className="text-white">✓</span> 导出双语 PDF</li>
                      <li className="flex items-center gap-2"><span className="text-white">✓</span> 优先客服支持</li>
                      <li className="flex items-center gap-2"><span className="text-white">✓</span> 新功能抢先体验</li>
                    </ul>
                  </div>
                </div>

                {/* 激活许可证 */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">已有许可证？激活它</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={licenseKey}
                      onChange={e => setLicenseKey(e.target.value)}
                      placeholder="SL-XXXX-XXXX-XXXX-XXXX"
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono"
                    />
                    <button
                      onClick={activateLicense}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                    >
                      激活
                    </button>
                  </div>
                  {licenseError && (
                    <p className="text-red-500 text-xs mt-2">{licenseError}</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
