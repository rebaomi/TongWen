import { OpenAICompatibleEngine } from './base-openai'

// Kimi（月之暗面）：https://platform.moonshot.cn/docs/api/chat
export class KimiEngine extends OpenAICompatibleEngine {
  constructor() {
    super('kimi', 'https://api.moonshot.cn/v1', 'moonshot-v1-8k', 'Kimi')
  }
}
