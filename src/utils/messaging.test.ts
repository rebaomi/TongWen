import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import type { Mock } from 'vitest'

let mockSendMessage: Mock
let sendMessage: typeof import('./messaging').sendMessage

beforeAll(async () => {
  // Mock chrome API before importing the module
  mockSendMessage = vi.fn()
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: mockSendMessage,
      lastError: null as { message?: string } | null,
    },
  })
  const mod = await import('./messaging')
  sendMessage = mod.sendMessage
})

describe('sendMessage', () => {
  beforeEach(() => {
    mockSendMessage.mockReset()
    // Reset lastError to null before each test
    ;(globalThis as Record<string, unknown>).chrome = {
      runtime: {
        sendMessage: mockSendMessage,
        lastError: null as { message?: string } | null,
      },
    }
  })

  it('resolves with response on success', async () => {
    mockSendMessage.mockImplementation((_msg: unknown, cb: (r: unknown) => void) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).chrome.runtime.lastError = null
      cb({ success: true, data: 'hello' })
    })
    const result = await sendMessage({ type: 'TEST' })
    expect(result).toEqual({ success: true, data: 'hello' })
  })

  it('rejects when lastError is set', async () => {
    mockSendMessage.mockImplementation((_msg: unknown, cb: (r: unknown) => void) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).chrome.runtime.lastError = { message: 'Some error' }
      cb(null)
    })
    await expect(sendMessage({ type: 'TEST' }, 1)).rejects.toThrow('Some error')
  })

  it('retries on connection error and succeeds', async () => {
    let attempt = 0
    mockSendMessage.mockImplementation((_msg: unknown, cb: (r: unknown) => void) => {
      attempt++
      if (attempt === 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(globalThis as any).chrome.runtime.lastError = { message: 'Receiving end does not exist' }
        cb(null)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(globalThis as any).chrome.runtime.lastError = null
        cb({ success: true })
      }
    })
    const result = await sendMessage({ type: 'TEST' }, 3, 10)
    expect(result).toEqual({ success: true })
    expect(attempt).toBe(2)
  })
})
