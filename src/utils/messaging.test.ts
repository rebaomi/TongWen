import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock chrome API
const mockSendMessage = vi.fn()
vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: mockSendMessage,
    lastError: null,
  },
})

// Import after stub
const { sendMessage } = await import('./messaging')

describe('sendMessage', () => {
  beforeEach(() => {
    mockSendMessage.mockReset()
    Object.defineProperty(chrome.runtime, 'lastError', { value: null, writable: true })
  })

  it('resolves with response on success', async () => {
    mockSendMessage.mockImplementation((_msg: unknown, cb: (r: unknown) => void) => {
      cb({ success: true, data: 'hello' })
    })
    const result = await sendMessage({ type: 'TEST' })
    expect(result).toEqual({ success: true, data: 'hello' })
  })

  it('rejects when lastError is set', async () => {
    mockSendMessage.mockImplementation((_msg: unknown, cb: (r: unknown) => void) => {
      Object.defineProperty(chrome.runtime, 'lastError', {
        value: { message: 'Some error' },
        writable: true,
      })
      cb(null)
    })
    await expect(sendMessage({ type: 'TEST' }, 1)).rejects.toThrow('Some error')
  })

  it('retries on connection error and succeeds', async () => {
    let attempt = 0
    mockSendMessage.mockImplementation((_msg: unknown, cb: (r: unknown) => void) => {
      attempt++
      if (attempt === 1) {
        Object.defineProperty(chrome.runtime, 'lastError', {
          value: { message: 'Receiving end does not exist' },
          writable: true,
        })
        cb(null)
      } else {
        Object.defineProperty(chrome.runtime, 'lastError', { value: null, writable: true })
        cb({ success: true })
      }
    })
    const result = await sendMessage({ type: 'TEST' }, 3, 10)
    expect(result).toEqual({ success: true })
    expect(attempt).toBe(2)
  })
})
