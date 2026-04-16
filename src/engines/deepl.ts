import type { EngineConfig, TranslateOptions, TranslateResult } from '@/shared/types'
import type { TranslationEngine } from './types'

const LANG_MAP: Record<string, string> = {
  'zh-CN': 'ZH',
  'zh-TW': 'ZH',
  en: 'EN-US',
  ja: 'JA',
  ko: 'KO',
  fr: 'FR',
  de: 'DE',
  es: 'ES',
  it: 'IT',
  pt: 'PT-PT',
  ru: 'RU',
}

export class DeepLEngine implements TranslationEngine {
  id = 'deepl'

  private mapLang(code: string): string {
    return LANG_MAP[code] ?? code.toUpperCase()
  }

  async translate(text: string, options: TranslateOptions, config: EngineConfig): Promise<TranslateResult> {
    const body: Record<string, unknown> = {
      text: [text],
      target_lang: this.mapLang(options.to),
    }
    if (options.from !== 'auto') body.source_lang = this.mapLang(options.from)

    const baseUrl = config.apiUrl ?? 'https://api-free.deepl.com/v2'
    const res = await fetch(`${baseUrl}/translate`, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`DeepL API error: ${res.status}`)
    const data = await res.json()
    return {
      original: text,
      translated: data.translations[0].text,
      engine: 'deepl',
    }
  }
}
