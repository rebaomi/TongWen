import type { TranslateResult } from '@/shared/types'
import { extractFormulas, restoreFormulas, shouldSkipNode } from './formula-detector'

// 检测是否是「扩展上下文失效」错误（插件被重新加载）
function isContextInvalidated(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('Extension context invalidated') ||
    msg.includes('context invalidated') ||
    msg.includes('Cannot access a chrome')
}

// 向 background 发送翻译请求
// countAsUsage=true：本次调用计 1 次使用（划词、右键）
// countAsUsage=false（默认）：页面/PDF 批量翻译时由上层统一计次
export async function translateText(text: string, countAsUsage = false): Promise<TranslateResult> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        { type: 'TRANSLATE_TEXT', payload: { text, countAsUsage } },
        (response: { success: boolean; data: TranslateResult; error?: string }) => {
          if (chrome.runtime.lastError) {
            const err = new Error(chrome.runtime.lastError.message ?? 'Unknown error')
            if (isContextInvalidated(err)) {
              reject(new Error('CONTEXT_INVALIDATED'))
            } else {
              reject(err)
            }
            return
          }
          if (response?.success) resolve(response.data)
          else reject(new Error(response?.error ?? 'Translation failed'))
        }
      )
    } catch (e) {
      if (isContextInvalidated(e)) {
        reject(new Error('CONTEXT_INVALIDATED'))
      } else {
        reject(e)
      }
    }
  })
}

// 向 background 记录 1 次使用（页面翻译/PDF翻译触发时调用一次）
export async function recordOneUse(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        { type: 'INCREMENT_USAGE' },
        (response: { success: boolean; error?: string }) => {
          if (chrome.runtime.lastError) {
            // 上下文失效时直接放行（不阻止翻译，但也不计数）
            if (isContextInvalidated(new Error(chrome.runtime.lastError.message))) {
              resolve(true)
            } else {
              resolve(!!(response?.success))
            }
            return
          }
          resolve(response?.success ?? false)
        }
      )
    } catch (e) {
      if (isContextInvalidated(e)) resolve(true)
      else resolve(false)
    }
  })
}

// 获取页面中所有可翻译的段落节点
export function getTranslatableNodes(root: Document | Element = document): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.textContent?.trim()
      if (!text || text.length < 4) return NodeFilter.FILTER_REJECT
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (shouldSkipNode(parent)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const nodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    nodes.push(node as Text)
  }
  return nodes
}

// 合并相邻文本节点为段落块（减少 API 调用次数）
export function groupTextNodes(nodes: Text[], maxChars = 2000): string[][] {
  const groups: string[][] = []
  let current: string[] = []
  let charCount = 0

  for (const node of nodes) {
    const text = node.textContent ?? ''
    if (charCount + text.length > maxChars && current.length > 0) {
      groups.push(current)
      current = []
      charCount = 0
    }
    current.push(text)
    charCount += text.length
  }
  if (current.length > 0) groups.push(current)
  return groups
}

// 翻译时保护公式
export async function translateWithFormulaProtection(text: string): Promise<string> {
  const { text: protected_, formulas } = extractFormulas(text)
  const result = await translateText(protected_)
  return restoreFormulas(result.translated, formulas)
}
