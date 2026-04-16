import type { EngineConfig, TranslateOptions, TranslateResult } from '@/shared/types'
import type { TranslationEngine } from './types'

const SYSTEM_PROMPT = `You are a professional translator specializing in academic and scientific texts.
Rules:
1. Translate the given text accurately and naturally.
2. Preserve all LaTeX math formulas (e.g., $x^2$, $$\\int_0^1 f(x)dx$$) unchanged.
3. Preserve citation markers like [1], [Smith2020], (Author, Year) unchanged.
4. Preserve special characters, subscripts, and superscripts.
5. Return ONLY the translated text, no explanations.`

export class DeepSeekEngine implements TranslationEngine {
  id = 'deepseek'

  async translate(text: string, options: TranslateOptions, config: EngineConfig): Promise<TranslateResult> {
    const baseUrl = config.apiUrl ?? 'https://api.deepseek.com/v1'
    const model = config.model ?? 'deepseek-chat'

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Translate the following text from ${options.from === 'auto' ? 'the detected language' : options.from} to ${options.to}:\n\n${text}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`DeepSeek API error: ${res.status} ${err}`)
    }
    const data = await res.json()
    return {
      original: text,
      translated: data.choices[0].message.content.trim(),
      engine: 'deepseek',
    }
  }
}
