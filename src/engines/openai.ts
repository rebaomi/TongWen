import type { EngineConfig, TranslateOptions, TranslateResult } from '@/shared/types'
import type { TranslationEngine } from './types'

const SYSTEM_PROMPT = `You are an expert academic translator.
Rules:
1. Produce accurate, fluent, natural-sounding translations.
2. Preserve all LaTeX expressions (inline $...$ and block $$...$$) exactly.
3. Keep citation markers [1], (Author Year), etc. unchanged.
4. Preserve technical terminology appropriately.
5. Output ONLY the translation, with no extra commentary.`

export class OpenAIEngine implements TranslationEngine {
  id = 'openai'

  async translate(text: string, options: TranslateOptions, config: EngineConfig): Promise<TranslateResult> {
    const baseUrl = config.apiUrl ?? 'https://api.openai.com/v1'
    const model = config.model ?? 'gpt-4o-mini'

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
            content: `Translate to ${options.to}:\n\n${text}`,
          },
        ],
        temperature: 0.1,
      }),
    })
    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)
    const data = await res.json()
    return {
      original: text,
      translated: data.choices[0].message.content.trim(),
      engine: 'openai',
    }
  }
}
