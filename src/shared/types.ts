// ===== 翻译引擎 =====
export type EngineId =
  | 'google' | 'deepl' | 'deepseek' | 'openai' | 'baidu' | 'local' | 'qwen'
  | 'minimax' | 'kimi' | 'glm' | 'gemini' | 'grok' | 'claude' | 'doubao'

export interface EngineConfig {
  id: EngineId
  name: string
  apiKey?: string
  apiUrl?: string
  model?: string
  enabled: boolean
  rateLimit?: number // requests per minute
}

export interface TranslateOptions {
  from: string
  to: string
  engine: EngineId
  preserveFormulas?: boolean
  preserveCitations?: boolean
}

export interface TranslateResult {
  original: string
  translated: string
  engine: EngineId
  confidence?: number
}

// ===== 翻译模式 =====
export type TranslateMode = 'bilingual' | 'replace' | 'hover'

// ===== 用户设置 =====
export interface UserSettings {
  engines: Record<EngineId, EngineConfig>
  activeEngine: EngineId
  translateMode: TranslateMode
  sourceLang: string
  targetLang: string
  autoTranslatePdf: boolean
  autoTranslatePage: boolean
  excludedDomains: string[]
  fontSizeScale: number
  showOriginalOnHover: boolean
  preserveFormulas: boolean
  preserveCitations: boolean
  theme: 'light' | 'dark' | 'system'
  showFloatingPanel: boolean
}

// ===== 使用量 & Pro =====
export interface UsageRecord {
  date: string            // YYYY-MM-DD
  count: number
  charCount: number
}

export interface SubscriptionInfo {
  isPro: boolean
  expiresAt?: number      // timestamp
  licenseKey?: string
  email?: string
}

export const FREE_DAILY_LIMIT = 100

// ===== PDF =====
export type PdfExportMode = 'bilingual' | 'translated-only' | 'text-only'

export interface PdfTranslateOptions extends TranslateOptions {
  exportMode: PdfExportMode
  pageRange?: number[]    // undefined = all pages
  preserveFormulas: boolean
  preserveCitations: boolean
  preserveLayout: boolean
}

// ===== 消息通信 =====
export type MessageType =
  | 'TRANSLATE_TEXT'
  | 'TRANSLATE_PAGE'
  | 'TOGGLE_TRANSLATION'
  | 'SET_MODE'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'GET_USAGE'
  | 'CHECK_PRO'
  | 'OPEN_PDF'
  | 'CONTEXT_TRANSLATE'
  | 'INCREMENT_USAGE'
  | 'SAVE_API_KEY'
  | 'GET_APIKEY_HINT'
  | 'OPEN_OPTIONS'
  | 'SHOW_PANEL'

export interface Message<T = unknown> {
  type: MessageType
  payload?: T
}

export interface MessageResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
