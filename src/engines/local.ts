import type { EngineConfig, TranslateOptions, TranslateResult } from '@/shared/types'
import type { TranslationEngine } from './types'

// 支持 Ollama 本地部署的模型（如 qwen2.5, llama3 等）
export class LocalEngine implements TranslationEngine {
  id = 'local'

  async translate(text: string, options: TranslateOptions, config: EngineConfig): Promise<TranslateResult> {
    const baseUrl = (config.apiUrl ?? 'http://127.0.0.1:11434').replace(/\/$/, '')

    // 若用户没填模型名，自动获取第一个已安装模型
    let model = config.model?.trim()
    if (!model) {
      const installed = await this.testConnection(baseUrl).catch(() => [])
      if (installed.length === 0) {
        throw new Error('OLLAMA_NO_MODEL: 未找到已安装模型，请先运行 ollama pull <模型名>，例如：ollama pull qwen2.5:7b')
      }
      model = installed[0]
    }

    const prompt = `Translate the following text to ${options.to}. Preserve LaTeX formulas and citation markers unchanged. Output ONLY the translated text:\n\n${text}`

    let res: Response
    try {
      res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: { temperature: 0.1 },
        }),
      })
    } catch (fetchErr) {
      const msg = String(fetchErr)
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch')) {
        throw new Error(
          `OLLAMA_UNREACHABLE: 无法连接到 Ollama (${baseUrl})。` +
          `请确认：① Ollama 已启动（运行 ollama serve）② 端口正确 ③ 已设置 OLLAMA_ORIGINS=*`
        )
      }
      throw new Error(`OLLAMA_FETCH_ERROR: ${msg}`)
    }

    if (res.status === 403) {
      throw new Error(
        'OLLAMA_CORS_403: Ollama 拒绝了扩展的请求（CORS 403）。' +
        '请设置环境变量 OLLAMA_ORIGINS=* 后重启 Ollama。' +
        '详见插件设置页面 → 翻译引擎 → 本地模型。'
      )
    }
    if (res.status === 404) {
      throw new Error(`OLLAMA_MODEL_NOT_FOUND: 模型 "${model}" 未找到，请先运行 ollama pull ${model}`)
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`OLLAMA_HTTP_ERROR: HTTP ${res.status} — ${body || '请检查 Ollama 是否正常运行'}`)
    }

    let data: { response?: string; error?: string }
    try {
      data = await res.json()
    } catch {
      throw new Error('OLLAMA_PARSE_ERROR: 响应解析失败，Ollama 返回了非 JSON 数据')
    }

    if (data.error) {
      throw new Error(`OLLAMA_API_ERROR: ${data.error}`)
    }
    if (!data.response) {
      throw new Error('OLLAMA_EMPTY_RESPONSE: Ollama 返回了空响应')
    }

    return {
      original: text,
      translated: data.response.trim(),
      engine: 'local',
    }
  }

  /** 测试连接：返回已安装模型列表 */
  async testConnection(baseUrl: string): Promise<string[]> {
    const url = baseUrl.replace(/\/$/, '')
    const res = await fetch(`${url}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { models?: { name: string }[] }
    return (data.models ?? []).map(m => m.name)
  }
}
