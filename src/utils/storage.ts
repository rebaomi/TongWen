import type { UserSettings, UsageRecord, SubscriptionInfo, EngineId } from '@/shared/types'
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/shared/constants'

// ─────────────────────────────────────────────
// 设置（不含 API Key）存 sync，方便多设备同步
// API Key 单独存 local，不上云
// ─────────────────────────────────────────────

const APIKEYS_STORAGE_KEY = 'scholar_lens_apikeys'

type ApiKeys = Partial<Record<EngineId, string>>

/** 读取所有 API Key（仅限 Service Worker 调用）。首次调用时自动迁移旧格式 */
export async function getApiKeys(): Promise<ApiKeys> {
  const result = await chrome.storage.local.get(APIKEYS_STORAGE_KEY)
  const stored = result[APIKEYS_STORAGE_KEY] as ApiKeys | undefined

  if (stored) return stored

  // ── 一次性迁移：把旧版存在 storage.sync settings 里的 apiKey 搬过来 ──
  const syncResult = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS)
  const oldSettings = syncResult[STORAGE_KEYS.SETTINGS] as Record<string, unknown> | undefined
  const oldEngines = (oldSettings?.engines ?? {}) as Record<string, { apiKey?: string }>
  const migrated: ApiKeys = {}
  for (const [id, cfg] of Object.entries(oldEngines)) {
    if (cfg?.apiKey) {
      migrated[id as EngineId] = cfg.apiKey
      // 清掉 sync 里的 apiKey，避免重复
      delete oldEngines[id].apiKey
    }
  }
  if (Object.keys(migrated).length > 0) {
    await chrome.storage.local.set({ [APIKEYS_STORAGE_KEY]: migrated })
    // 把清理后的 settings 写回 sync
    await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: oldSettings })
    return migrated
  }

  // 没有旧数据，初始化空对象
  await chrome.storage.local.set({ [APIKEYS_STORAGE_KEY]: {} })
  return {}
}

/** 保存单个引擎的 API Key */
export async function saveApiKey(engineId: EngineId, apiKey: string): Promise<void> {
  const current = await getApiKeys()
  await chrome.storage.local.set({
    [APIKEYS_STORAGE_KEY]: { ...current, [engineId]: apiKey },
  })
}

/** 删除某个引擎的 API Key */
export async function deleteApiKey(engineId: EngineId): Promise<void> {
  const current = await getApiKeys()
  delete current[engineId]
  await chrome.storage.local.set({ [APIKEYS_STORAGE_KEY]: current })
}

/** 读取设置（不含 API Key） */
export async function getSettings(): Promise<UserSettings> {
  const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS)
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] ?? {}) }
}

/** 读取完整设置并注入 API Key（仅 Service Worker 内部使用） */
export async function getSettingsWithKeys(): Promise<UserSettings> {
  const [settings, keys] = await Promise.all([getSettings(), getApiKeys()])
  const engines = { ...settings.engines }
  for (const [id, key] of Object.entries(keys)) {
    const engineId = id as EngineId
    if (engines[engineId]) {
      engines[engineId] = { ...engines[engineId], apiKey: key }
    }
  }
  return { ...settings, engines }
}

/** 保存设置（自动剥离 API Key 另存） */
export async function saveSettings(settings: Partial<UserSettings>): Promise<void> {
  // 如果 settings 里包含引擎配置，把 apiKey 剥离出来单独保存
  if (settings.engines) {
    for (const [id, cfg] of Object.entries(settings.engines)) {
      if (cfg?.apiKey !== undefined) {
        await saveApiKey(id as EngineId, cfg.apiKey)
        // 从 sync 存储里去掉 apiKey
        cfg.apiKey = undefined
      }
    }
  }
  const current = await getSettings()
  await chrome.storage.sync.set({
    [STORAGE_KEYS.SETTINGS]: { ...current, ...settings },
  })
}

// ─────────────────────────────────────────────
// 使用量（存 local）
// ─────────────────────────────────────────────

export async function getUsage(): Promise<UsageRecord> {
  const today = new Date().toISOString().slice(0, 10)
  const result = await chrome.storage.local.get(STORAGE_KEYS.USAGE)
  const stored = result[STORAGE_KEYS.USAGE] as UsageRecord | undefined
  if (!stored || stored.date !== today) {
    return { date: today, count: 0, charCount: 0 }
  }
  return stored
}

export async function incrementUsage(charCount: number): Promise<UsageRecord> {
  const usage = await getUsage()
  const updated: UsageRecord = {
    ...usage,
    count: usage.count + 1,
    charCount: usage.charCount + charCount,
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.USAGE]: updated })
  return updated
}

// ─────────────────────────────────────────────
// 订阅信息（存 sync）
// ─────────────────────────────────────────────

export async function getSubscription(): Promise<SubscriptionInfo> {
  const result = await chrome.storage.sync.get(STORAGE_KEYS.SUBSCRIPTION)
  return (result[STORAGE_KEYS.SUBSCRIPTION] as SubscriptionInfo | undefined) ?? { isPro: false }
}

export async function saveSubscription(info: SubscriptionInfo): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEYS.SUBSCRIPTION]: info })
}

export async function isProActive(): Promise<boolean> {
  const sub = await getSubscription()
  if (!sub.isPro) return false
  if (sub.expiresAt && Date.now() > sub.expiresAt) return false
  return true
}
