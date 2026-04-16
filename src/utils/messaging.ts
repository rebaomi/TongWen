/**
 * MV3 Service Worker 可能因空闲被 Chrome 终止。
 * 发送消息时若遇到"Receiving end does not exist"，自动等待 SW 唤醒后重试。
 */
export async function sendMessage<T = unknown>(
  message: unknown,
  retries = 3,
  delayMs = 300,
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await new Promise<T>((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response: T) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message ?? 'Unknown error'))
          } else {
            resolve(response)
          }
        })
      })
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isSwDead =
        msg.includes('Receiving end does not exist') ||
        msg.includes('Could not establish connection') ||
        msg.includes('The message port closed')

      if (isSwDead && attempt < retries - 1) {
        // 等待 SW 唤醒后重试
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)))
        continue
      }
      throw err
    }
  }
  throw new Error('sendMessage: max retries exceeded')
}
