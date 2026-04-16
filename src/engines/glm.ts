import { OpenAICompatibleEngine } from './base-openai'

// 智谱 GLM：https://bigmodel.cn/dev/api/normal-model/glm-4
export class GlmEngine extends OpenAICompatibleEngine {
  constructor() {
    super('glm', 'https://open.bigmodel.cn/api/paas/v4', 'glm-4-flash', '智谱 GLM')
  }
}
