import type { EngineConfig, TranslateOptions, TranslateResult } from '@/shared/types'

export interface TranslationEngine {
  id: string
  translate(text: string, options: TranslateOptions, config: EngineConfig): Promise<TranslateResult>
  translateBatch?(texts: string[], options: TranslateOptions, config: EngineConfig): Promise<TranslateResult[]>
}
