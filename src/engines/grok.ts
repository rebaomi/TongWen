import { OpenAICompatibleEngine } from './base-openai'

// Grok（xAI）：https://docs.x.ai/api
export class GrokEngine extends OpenAICompatibleEngine {
  constructor() {
    super('grok', 'https://api.x.ai/v1', 'grok-3-mini', 'Grok')
  }
}
