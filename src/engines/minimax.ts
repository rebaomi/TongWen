import { OpenAICompatibleEngine } from './base-openai'

// MiniMax：https://platform.minimaxi.com/document/ChatCompletion%20v2
export class MinimaxEngine extends OpenAICompatibleEngine {
  constructor() {
    super('minimax', 'https://api.minimax.chat/v1', 'MiniMax-Text-01', 'MiniMax')
  }
}
