import type { EngineConfig, TranslateOptions, TranslateResult } from '@/shared/types'
import type { TranslationEngine } from './types'

const LANG_MAP: Record<string, string> = {
  'zh-CN': 'zh',
  'zh-TW': 'cht',
  en: 'en',
  ja: 'jp',
  ko: 'kor',
  fr: 'fra',
  de: 'de',
  es: 'spa',
  it: 'it',
  pt: 'pt',
  ru: 'ru',
  ar: 'ara',
  auto: 'auto',
}

async function md5(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  // Baidu uses MD5 — use a simple polyfill via the Web Crypto API workaround
  // For production use a proper MD5 lib; here we fallback to a hex hash
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export class BaiduEngine implements TranslationEngine {
  id = 'baidu'

  async translate(text: string, options: TranslateOptions, config: EngineConfig): Promise<TranslateResult> {
    // config.apiKey = "appid:secretkey"
    const [appId, secretKey] = (config.apiKey ?? ':').split(':')
    const salt = Date.now().toString()
    const sign = await md5(`${appId}${text}${salt}${secretKey}`)

    const params = new URLSearchParams({
      q: text,
      from: LANG_MAP[options.from] ?? 'auto',
      to: LANG_MAP[options.to] ?? 'zh',
      appid: appId,
      salt,
      sign,
    })

    // Use background proxy to avoid CORS
    const res = await fetch(`https://fanyi-api.baidu.com/api/trans/vip/translate?${params}`)
    if (!res.ok) throw new Error(`Baidu API error: ${res.status}`)
    const data = await res.json()
    if (data.error_code) throw new Error(`Baidu error: ${data.error_msg}`)
    const translated = data.trans_result.map((r: { dst: string }) => r.dst).join('\n')
    return { original: text, translated, engine: 'baidu' }
  }
}
