import type { EngineConfig, TranslateOptions, TranslateResult } from '@/shared/types'
import type { TranslationEngine } from './types'

const SYSTEM_INSTRUCTION = `You are a professional translator specializing in academic and scientific texts.
Rules:
1. Translate the given text accurately and naturally.
2. Preserve all LaTeX math formulas (e.g., $x^2$, $$\\int_0^1 f(x)dx$$) unchanged.
3. Preserve citation markers like [1], [Smith2020], (Author, Year) unchanged.
4. Preserve special characters, subscripts, and superscripts.
5. Return ONLY the translated text, no explanations.`

// Google Gemini：https://ai.google.dev/gemini-api/docs
export class GeminiEngine implements TranslationEngine {
  id = 'gemini'

  async translate(text: string, options: TranslateOptions, config: EngineConfig): Promise<TranslateResult> {
    const model = config.model?.trim() || 'gemini-2.0-flash'
    const baseUrl = (config.apiUrl ?? 'https://generativelanguage.googleapis.com').replace(/\/$/, '')

    if (!config.apiKey) {
      throw new Error('not configured: 请在设置中填写 Gemini API Key')
    }

    const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${config.apiKey}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{
          parts: [{
            text: `Translate from ${options.from === 'auto' ? 'the detected language' : options.from} to ${options.to}:\n\n${text}`,
          }],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      if (res.status === 400 && err.includes('API_KEY')) throw new Error('not configured: Gemini API Key 无效')
      if (res.status === 429) throw new Error('Gemini 请求过于频繁，请稍后重试')
      throw new Error(`Gemini API 错误：${res.status} ${err}`)
    }

    const data = await res.json() as {
      candidates: { content: { parts: { text: string }[] } }[]
    }
    const translated = data.candidates[0]?.content?.parts[0]?.text?.trim() ?? ''
    return { original: text, translated, engine: 'gemini' }
  }
}
