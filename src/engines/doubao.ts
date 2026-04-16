import { OpenAICompatibleEngine } from './base-openai'

// 豆包（字节跳动 / 火山方舟）：https://www.volcengine.com/docs/82379/1302008
// 模型名填写「接入点 ID」，如 ep-xxxxxxxx-yyyy，可在火山方舟控制台创建
export class DoubaoEngine extends OpenAICompatibleEngine {
  constructor() {
    super('doubao', 'https://ark.volces.com/api/v3', 'doubao-pro-32k', '豆包')
  }
}
