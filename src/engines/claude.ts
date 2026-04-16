import type { EngineConfig, TranslateOptions, TranslateResult } from '@/shared/types'
import type { TranslationEngine } from './types'

const SYSTEM_PROMPT = `You are a professional translator specializing in academic and scientific texts.
Rules:
1. Translate the given text accurately and naturally.
2. Preserve all LaTeX math formulas (e.g., $x^2$, $$\\int_0^1 f(x)dx$$) unchanged.
3. Preserve citation markers like [1], [Smith2020], (Author, Year) unchanged.
4. Preserve special characters, subscripts, and superscripts.
5. Return ONLY the translated text, no explanations.`

// Anthropic Claude：https://docs.anthropic.com/en/api/messages
export class ClaudeEngine implements TranslationEngine {
  id = 'claude'

  async translate(text: string, options: TranslateOptions, config: EngineConfig): Promise<TranslateResult> {
    const baseUrl = (config.apiUrl ?? 'https://api.anthropic.com').replace(/\/$/, '')
    const model = config.model?.trim() || 'claude-haiku-4-5'

    if (!config.apiKey) {
      throw new Error('not configured: 请在设置中填写 Claude API Key')
    }

    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Translate from ${options.from === 'auto' ? 'the detected language' : options.from} to ${options.to}:\n\n${text}`,
        }],
      }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      if (res.status === 401) throw new Error('not configured: Claude API Key 无效或已过期')
      if (res.status === 429) throw new Error('Claude 请求过于频繁，请稍后重试')
      throw new Error(`Claude API 错误：${res.status} ${err}`)
    }

    const data = await res.json() as { content: { type: string; text: string }[] }
    const translated = data.content.find(b => b.type === 'text')?.text?.trim() ?? ''
    return { original: text, translated, engine: 'claude' }
  }
}
