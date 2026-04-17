/**
 * AI 对话能力层
 * 为支持的引擎提供流式 chat 接口（SSE / streaming）
 */
import type { EngineConfig, ChatMessage, EngineId } from '@/shared/types'

/** 不支持 chat 的纯翻译引擎 */
const TRANSLATE_ONLY: EngineId[] = ['google', 'deepl', 'baidu']

export function supportsChatEngine(id: EngineId): boolean {
  return !TRANSLATE_ONLY.includes(id)
}

/** 是否支持视觉（图片输入） */
const VISION_ENGINES: EngineId[] = ['openai', 'gemini', 'claude', 'grok']

export function supportsVision(id: EngineId): boolean {
  return VISION_ENGINES.includes(id)
}

export type ChunkCallback = (chunk: string) => void

// ── OpenAI 兼容流式 chat ─────────────────────────────────────
export async function chatOpenAICompatible(
  messages: ChatMessage[],
  config: EngineConfig,
  baseUrl: string,
  model: string,
  engineLabel: string,
  onChunk: ChunkCallback,
  imageUrl?: string,
): Promise<void> {
  if (!config.apiKey) throw new Error(`not configured: 请在设置中填写 ${engineLabel} API Key`)

  const apiMessages = messages.map(m => {
    if (m.imageUrl && supportsVision(config.id)) {
      return {
        role: m.role,
        content: [
          { type: 'text', text: m.content },
          { type: 'image_url', image_url: { url: m.imageUrl } },
        ],
      }
    }
    return { role: m.role, content: m.content }
  })

  // 如果传入了 imageUrl 且最后一条是 user，把图片附加上去
  if (imageUrl && supportsVision(config.id)) {
    const last = apiMessages[apiMessages.length - 1]
    if (last.role === 'user' && typeof last.content === 'string') {
      apiMessages[apiMessages.length - 1] = {
        role: 'user',
        content: [
          { type: 'text', text: last.content as string },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      }
    }
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: apiMessages, stream: true, temperature: 0.7 }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    if (res.status === 401) throw new Error(`not configured: ${engineLabel} API Key 无效`)
    throw new Error(`${engineLabel} 错误：${res.status} ${err.slice(0, 200)}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data) as { choices: { delta: { content?: string } }[] }
        const chunk = json.choices[0]?.delta?.content
        if (chunk) onChunk(chunk)
      } catch { /* skip parse errors */ }
    }
  }
}

// ── Gemini 流式 chat ─────────────────────────────────────────
export async function chatGemini(
  messages: ChatMessage[],
  config: EngineConfig,
  onChunk: ChunkCallback,
  imageUrl?: string,
): Promise<void> {
  if (!config.apiKey) throw new Error('not configured: 请在设置中填写 Gemini API Key')

  const model = config.model?.trim() || 'gemini-2.0-flash'
  const base = (config.apiUrl ?? 'https://generativelanguage.googleapis.com').replace(/\/$/, '')
  const url = `${base}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${config.apiKey}`

  type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } }
  const contents = messages.map(m => {
    const parts: GeminiPart[] = [{ text: m.content }]
    if (m.imageUrl && m.role === 'user') {
      const b64 = m.imageUrl.split(',')[1] ?? m.imageUrl
      parts.push({ inlineData: { mimeType: 'image/png', data: b64 } })
    }
    return { role: m.role === 'assistant' ? 'model' : 'user', parts }
  })

  if (imageUrl) {
    const last = contents[contents.length - 1]
    if (last.role === 'user') {
      last.parts.push({ inlineData: { mimeType: 'image/png', data: imageUrl.split(',')[1] ?? imageUrl } })
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.7 } }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Gemini 错误：${res.status} ${err.slice(0, 200)}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const json = JSON.parse(line.slice(6)) as {
          candidates: { content: { parts: { text: string }[] } }[]
        }
        const text = json.candidates[0]?.content?.parts[0]?.text
        if (text) onChunk(text)
      } catch { /* skip */ }
    }
  }
}

// ── Claude 流式 chat ─────────────────────────────────────────
export async function chatClaude(
  messages: ChatMessage[],
  config: EngineConfig,
  onChunk: ChunkCallback,
  imageUrl?: string,
): Promise<void> {
  if (!config.apiKey) throw new Error('not configured: 请在设置中填写 Claude API Key')

  const model = config.model?.trim() || 'claude-3-5-sonnet-20241022'
  const base = (config.apiUrl ?? 'https://api.anthropic.com').replace(/\/$/, '')

  type ClaudePart = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  const apiMessages = messages.map(m => {
    const parts: ClaudePart[] = [{ type: 'text', text: m.content }]
    if (m.imageUrl && m.role === 'user') {
      const b64 = m.imageUrl.split(',')[1] ?? m.imageUrl
      parts.unshift({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } })
    }
    return { role: m.role, content: parts.length === 1 ? m.content : parts }
  })

  if (imageUrl) {
    const last = apiMessages[apiMessages.length - 1]
    if (last.role === 'user' && typeof last.content === 'string') {
      apiMessages[apiMessages.length - 1] = {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageUrl.split(',')[1] ?? imageUrl } },
          { type: 'text', text: last.content },
        ] as ClaudePart[],
      }
    }
  }

  const res = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages: apiMessages, max_tokens: 4096, stream: true }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Claude 错误：${res.status} ${err.slice(0, 200)}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const json = JSON.parse(line.slice(6)) as {
          type: string
          delta?: { type: string; text: string }
        }
        if (json.type === 'content_block_delta' && json.delta?.text) {
          onChunk(json.delta.text)
        }
      } catch { /* skip */ }
    }
  }
}
