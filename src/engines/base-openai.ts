import type { EngineConfig, TranslateOptions, TranslateResult, EngineId } from '@/shared/types'
import type { TranslationEngine } from './types'

const SYSTEM_PROMPT = `You are a professional translator specializing in academic and scientific texts.
Rules:
1. Translate the given text accurately and naturally.
2. Preserve all LaTeX math formulas (e.g., $x^2$, $$\\int_0^1 f(x)dx$$) unchanged.
3. Preserve citation markers like [1], [Smith2020], (Author, Year) unchanged.
4. Preserve special characters, subscripts, and superscripts.
5. Return ONLY the translated text, no explanations.`

/** OpenAI 兼容接口的通用翻译引擎基类 */
export class OpenAICompatibleEngine implements TranslationEngine {
  id: string
  private defaultBaseUrl: string
  private defaultModel: string
  private engineLabel: string

  constructor(id: string, defaultBaseUrl: string, defaultModel: string, engineLabel: string) {
    this.id = id
    this.defaultBaseUrl = defaultBaseUrl
    this.defaultModel = defaultModel
    this.engineLabel = engineLabel
  }

  async translate(text: string, options: TranslateOptions, config: EngineConfig): Promise<TranslateResult> {
    const baseUrl = (config.apiUrl ?? this.defaultBaseUrl).replace(/\/$/, '')
    const model = config.model?.trim() || this.defaultModel

    if (!config.apiKey) {
      throw new Error(`not configured: 请在设置中填写 ${this.engineLabel} API Key`)
    }

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
            content: `Translate from ${options.from === 'auto' ? 'the detected language' : options.from} to ${options.to}:\n\n${text}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      if (res.status === 401) throw new Error(`not configured: ${this.engineLabel} API Key 无效或已过期`)
      if (res.status === 429) throw new Error(`${this.engineLabel} 请求过于频繁，请稍后重试`)
      throw new Error(`${this.engineLabel} API 错误：${res.status} ${err}`)
    }

    const data = await res.json() as { choices: { message: { content: string } }[] }
    return {
      original: text,
      translated: data.choices[0].message.content.trim(),
      engine: this.id as EngineId,
    }
  }
}
