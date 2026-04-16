import type { EngineConfig, TranslateOptions, TranslateResult } from '@/shared/types'
import type { TranslationEngine } from './types'

export class GoogleEngine implements TranslationEngine {
  id = 'google'

  async translate(text: string, options: TranslateOptions, config: EngineConfig): Promise<TranslateResult> {
    const params = new URLSearchParams({
      key: config.apiKey ?? '',
      q: text,
      source: options.from === 'auto' ? '' : options.from,
      target: options.to,
      format: 'text',
    })

    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?${params}`,
      { method: 'POST' }
    )
    if (!res.ok) throw new Error(`Google API error: ${res.status}`)
    const data = await res.json()
    const translated = data.data.translations[0].translatedText as string
    return { original: text, translated, engine: 'google' }
  }

  async translateBatch(texts: string[], options: TranslateOptions, config: EngineConfig): Promise<TranslateResult[]> {
    const params = new URLSearchParams({ key: config.apiKey ?? '' })
    texts.forEach(t => params.append('q', t))
    params.set('target', options.to)
    if (options.from !== 'auto') params.set('source', options.from)

    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?${params}`,
      { method: 'POST' }
    )
    if (!res.ok) throw new Error(`Google API error: ${res.status}`)
    const data = await res.json()
    return data.data.translations.map((t: { translatedText: string }, i: number) => ({
      original: texts[i],
      translated: t.translatedText,
      engine: 'google' as const,
    }))
  }
}
