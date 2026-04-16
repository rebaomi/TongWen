import type { EngineId, EngineConfig, TranslateOptions, TranslateResult } from '@/shared/types'
import type { TranslationEngine } from './types'
import { GoogleEngine } from './google'
import { DeepLEngine } from './deepl'
import { DeepSeekEngine } from './deepseek'
import { OpenAIEngine } from './openai'
import { BaiduEngine } from './baidu'
import { LocalEngine } from './local'
import { QwenEngine } from './qwen'
import { MinimaxEngine } from './minimax'
import { KimiEngine } from './kimi'
import { GlmEngine } from './glm'
import { GeminiEngine } from './gemini'
import { GrokEngine } from './grok'
import { ClaudeEngine } from './claude'
import { DoubaoEngine } from './doubao'

const engines: Record<EngineId, TranslationEngine> = {
  google:  new GoogleEngine(),
  deepl:   new DeepLEngine(),
  deepseek: new DeepSeekEngine(),
  openai:  new OpenAIEngine(),
  baidu:   new BaiduEngine(),
  local:   new LocalEngine(),
  qwen:    new QwenEngine(),
  minimax: new MinimaxEngine(),
  kimi:    new KimiEngine(),
  glm:     new GlmEngine(),
  gemini:  new GeminiEngine(),
  grok:    new GrokEngine(),
  claude:  new ClaudeEngine(),
  doubao:  new DoubaoEngine(),
}

export function getEngine(id: EngineId): TranslationEngine {
  return engines[id]
}

export async function translate(
  text: string,
  options: TranslateOptions,
  config: EngineConfig
): Promise<TranslateResult> {
  if (!text.trim()) return { original: text, translated: text, engine: options.engine }
  const engine = getEngine(options.engine)
  return engine.translate(text, options, config)
}

export async function translateBatch(
  texts: string[],
  options: TranslateOptions,
  config: EngineConfig
): Promise<TranslateResult[]> {
  const engine = getEngine(options.engine)
  if (engine.translateBatch) {
    return engine.translateBatch(texts, options, config)
  }
  // Fallback: sequential
  const results: TranslateResult[] = []
  for (const text of texts) {
    results.push(await engine.translate(text, options, config))
  }
  return results
}
