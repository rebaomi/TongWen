import type { EngineConfig, TranslateOptions, TranslateResult } from '@/shared/types'
import type { TranslationEngine } from './types'

const SYSTEM_PROMPT = `You are a professional translator specializing in academic and scientific texts.
Rules:
1. Translate the given text accurately and naturally.
2. Preserve all LaTeX math formulas (e.g., $x^2$, $$\\int_0^1 f(x)dx$$) unchanged.
3. Preserve citation markers like [1], [Smith2020], (Author, Year) unchanged.
4. Preserve special characters, subscripts, and superscripts.
5. Return ONLY the translated text, no explanations.`

// 千问通过阿里云 DashScope 提供 OpenAI 兼容接口
const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DEFAULT_MODEL = 'qwen-plus'

export class QwenEngine implements TranslationEngine {
  id = 'qwen'

  async translate(text: string, options: TranslateOptions, config: EngineConfig): Promise<TranslateResult> {
    const baseUrl = (config.apiUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    const model = config.model?.trim() || DEFAULT_MODEL

    if (!config.apiKey) {
      throw new Error('not configured: 请在设置中填写千问（通义千问）API Key')
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
            content: `Translate the following text from ${options.from === 'auto' ? 'the detected language' : options.from} to ${options.to}:\n\n${text}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      if (res.status === 401) throw new Error('not configured: API Key 无效或已过期，请检查设置')
      if (res.status === 429) throw new Error('千问 API 请求过于频繁，请稍后重试')
      throw new Error(`千问 API 错误：${res.status} ${err}`)
    }

    const data = await res.json() as { choices: { message: { content: string } }[] }
    return {
      original: text,
      translated: data.choices[0].message.content.trim(),
      engine: 'qwen',
    }
  }
}
