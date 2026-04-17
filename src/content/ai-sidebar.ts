/**
 * AI 阅读助手侧边栏
 * Shadow DOM 实现，支持流式输出 / 页面上下文 / 历史记录
 */
import type { ChatMessage } from '@/shared/types'

// ── 样式 ──────────────────────────────────────────────────────
const CSS = `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

#sidebar {
  position: fixed;
  top: 0; right: 0;
  width: 380px;
  height: 100vh;
  z-index: 2147483646;
  background: #fff;
  border-left: 1px solid #e5e7eb;
  box-shadow: -4px 0 24px rgba(0,0,0,0.12);
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 14px;
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
}
#sidebar.open { transform: translateX(0); }

/* 顶栏 */
#header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  background: linear-gradient(135deg,#1a73e8,#6c5ce7);
  color: #fff;
}
#header-title { flex: 1; font-weight: 600; font-size: 15px; }
#ctx-badge {
  font-size: 11px;
  background: rgba(255,255,255,0.2);
  padding: 2px 8px;
  border-radius: 12px;
  cursor: pointer;
  user-select: none;
}
#ctx-badge:hover { background: rgba(255,255,255,0.35); }
#close-btn {
  background: none; border: none; cursor: pointer; color: #fff;
  font-size: 18px; line-height: 1; padding: 2px 4px; border-radius: 4px;
  opacity: 0.8;
}
#close-btn:hover { opacity: 1; background: rgba(255,255,255,0.15); }

/* 消息区 */
#messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-behavior: smooth;
}
#messages::-webkit-scrollbar { width: 4px; }
#messages::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }

.msg {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 94%;
}
.msg.user { align-self: flex-end; align-items: flex-end; }
.msg.assistant { align-self: flex-start; align-items: flex-start; }

.msg-bubble {
  padding: 10px 14px;
  border-radius: 16px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}
.msg.user .msg-bubble {
  background: #1a73e8;
  color: #fff;
  border-bottom-right-radius: 4px;
}
.msg.assistant .msg-bubble {
  background: #f3f4f6;
  color: #111827;
  border-bottom-left-radius: 4px;
}
.msg.assistant .msg-bubble.streaming { opacity: 0.85; }
.msg.assistant .msg-bubble code {
  background: #e5e7eb;
  padding: 1px 5px;
  border-radius: 4px;
  font-family: "Fira Code", Consolas, monospace;
  font-size: 12px;
}
.msg.assistant .msg-bubble pre {
  background: #1f2937;
  color: #f9fafb;
  padding: 10px 12px;
  border-radius: 8px;
  margin: 6px 0;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
}
.msg-time { font-size: 11px; color: #9ca3af; }
.msg-img { max-width: 200px; border-radius: 8px; margin-bottom: 4px; }

/* 空状态 */
#empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #9ca3af;
  gap: 8px;
  text-align: center;
  padding: 24px;
}
#empty-state .icon { font-size: 40px; }
#empty-state .tips { font-size: 13px; line-height: 1.8; }

/* 输入区 */
#input-area {
  flex-shrink: 0;
  padding: 12px 16px 16px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
#image-preview-row {
  display: none;
  align-items: center;
  gap: 8px;
}
#image-preview-row.active { display: flex; }
#image-thumb { width: 48px; height: 48px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; }
#remove-image { background: none; border: none; cursor: pointer; color: #6b7280; font-size: 18px; }
#input-row { display: flex; gap: 8px; align-items: flex-end; }
#input {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 14px;
  resize: none;
  outline: none;
  font-family: inherit;
  line-height: 1.5;
  max-height: 120px;
  min-height: 42px;
  overflow-y: auto;
  transition: border-color 0.15s;
}
#input:focus { border-color: #1a73e8; }
#send-btn {
  flex-shrink: 0;
  width: 40px; height: 40px;
  border-radius: 12px;
  background: #1a73e8;
  border: none; cursor: pointer; color: #fff;
  font-size: 18px;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
#send-btn:hover { background: #1557b0; }
#send-btn:disabled { background: #9ca3af; cursor: not-allowed; }
#bottom-actions {
  display: flex;
  gap: 8px;
}
.bottom-btn {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: none;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.15s;
}
.bottom-btn:hover { border-color: #1a73e8; color: #1a73e8; background: #f0f7ff; }

/* 打字动画 */
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
.cursor { display: inline-block; width: 2px; height: 1em; background: currentColor; margin-left: 2px; animation: blink 0.8s step-start infinite; vertical-align: text-bottom; }
`

// ── 工具函数 ──────────────────────────────────────────────────
function escHtml(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

/** 简单 Markdown 渲染：代码块 / 行内代码 / 加粗 / 换行 */
function renderMd(text: string): string {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => `<pre><code>${escHtml(code.trim())}</code></pre>`)
    .replace(/`([^`]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#{1,3}\s+(.+)$/gm, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

function timeStr(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// ── AI 侧边栏主类 ─────────────────────────────────────────────
export interface AiSidebarApi {
  show: () => void
  hide: () => void
  toggle: () => void
  sendMessage: (text: string, imageUrl?: string) => void
  setContext: (ctx: string) => void
  isOpen: () => boolean
}

export function createAiSidebar(): AiSidebarApi {
  // Shadow DOM 容器
  const host = document.createElement('div')
  host.id = 'xiaoyi-ai-sidebar'
  document.documentElement.appendChild(host)
  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = CSS
  shadow.appendChild(style)

  // 结构
  const sidebar = document.createElement('div')
  sidebar.id = 'sidebar'
  sidebar.innerHTML = `
    <div id="header">
      <span style="font-size:18px">🤖</span>
      <span id="header-title">AI 阅读助手</span>
      <span id="ctx-badge">📄 无上下文</span>
      <button id="close-btn" title="关闭">✕</button>
    </div>
    <div id="messages">
      <div id="empty-state">
        <div class="icon">💬</div>
        <div class="tips">
          选中页面文字后点击「问 AI」<br>
          或直接在下方输入问题<br>
          <span style="color:#d1d5db">支持截图分析 · 高亮追问</span>
        </div>
      </div>
    </div>
    <div id="input-area">
      <div id="image-preview-row">
        <img id="image-thumb" src="" alt="截图" />
        <button id="remove-image" title="移除图片">✕</button>
        <span style="font-size:12px;color:#6b7280">图片将随消息发送</span>
      </div>
      <div id="input-row">
        <textarea id="input" placeholder="输入问题，Ctrl+Enter 发送…" rows="1"></textarea>
        <button id="send-btn" title="发送">↑</button>
      </div>
      <div id="bottom-actions">
        <button class="bottom-btn" id="clear-btn">🗑 清空对话</button>
        <button class="bottom-btn" id="ctx-toggle-btn">📄 注入页面上下文</button>
      </div>
    </div>
  `
  shadow.appendChild(sidebar)

  // 状态
  const messages: ChatMessage[] = []
  let pageContext = ''
  let pendingImageUrl = ''
  let streaming = false
  let contextEnabled = false

  const $ = (sel: string) => shadow.querySelector(sel) as HTMLElement
  const messagesEl = $('') // placeholder, use real refs below
  void messagesEl

  function getEl<T extends HTMLElement>(sel: string): T {
    return shadow.querySelector(sel) as T
  }

  const msgArea = getEl<HTMLDivElement>('#messages')
  const inputEl = getEl<HTMLTextAreaElement>('#input')
  const sendBtn = getEl<HTMLButtonElement>('#send-btn')
  const clearBtn = getEl<HTMLButtonElement>('#clear-btn')
  const ctxBadge = getEl<HTMLSpanElement>('#ctx-badge')
  const ctxToggleBtn = getEl<HTMLButtonElement>('#ctx-toggle-btn')
  const imagePreviewRow = getEl<HTMLDivElement>('#image-preview-row')
  const imageThumb = getEl<HTMLImageElement>('#image-thumb')
  const removeImageBtn = getEl<HTMLButtonElement>('#remove-image')

  // ── 渲染消息 ──────────────────────────────────────────────
  function renderMessages() {
    const empty = getEl<HTMLDivElement>('#empty-state')
    if (messages.length === 0) {
      if (empty) empty.style.display = ''
      // remove all msg nodes
      Array.from(msgArea.querySelectorAll('.msg')).forEach(el => el.remove())
      return
    }
    if (empty) empty.style.display = 'none'

    // Rebuild all - simple approach for correctness
    Array.from(msgArea.querySelectorAll('.msg')).forEach(el => el.remove())
    for (const msg of messages) {
      const div = document.createElement('div')
      div.className = `msg ${msg.role}`
      div.dataset.id = msg.id

      if (msg.imageUrl && msg.role === 'user') {
        const img = document.createElement('img')
        img.className = 'msg-img'
        img.src = msg.imageUrl
        div.appendChild(img)
      }

      const bubble = document.createElement('div')
      bubble.className = 'msg-bubble'
      if (msg.role === 'assistant') {
        bubble.innerHTML = renderMd(msg.content)
      } else {
        bubble.textContent = msg.content
      }
      div.appendChild(bubble)

      const time = document.createElement('span')
      time.className = 'msg-time'
      time.textContent = timeStr(msg.timestamp)
      div.appendChild(time)

      msgArea.appendChild(div)
    }
    msgArea.scrollTop = msgArea.scrollHeight
  }

  function appendStreamingBubble(): { update: (chunk: string) => void; finalize: () => void } {
    getEl<HTMLDivElement>('#empty-state').style.display = 'none'
    const div = document.createElement('div')
    div.className = 'msg assistant'

    const bubble = document.createElement('div')
    bubble.className = 'msg-bubble streaming'

    const cursor = document.createElement('span')
    cursor.className = 'cursor'
    bubble.appendChild(cursor)
    div.appendChild(bubble)
    msgArea.appendChild(div)
    msgArea.scrollTop = msgArea.scrollHeight

    let text = ''
    return {
      update(chunk: string) {
        text += chunk
        bubble.innerHTML = renderMd(text)
        const newCursor = document.createElement('span')
        newCursor.className = 'cursor'
        bubble.appendChild(newCursor)
        msgArea.scrollTop = msgArea.scrollHeight
      },
      finalize() {
        bubble.classList.remove('streaming')
        bubble.innerHTML = renderMd(text)
        const time = document.createElement('span')
        time.className = 'msg-time'
        time.textContent = timeStr(Date.now())
        div.appendChild(time)
        msgArea.scrollTop = msgArea.scrollHeight
        messages.push({
          role: 'assistant',
          content: text,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        })
      },
    }
  }

  // ── 发送消息 ─────────────────────────────────────────────
  function doSend(text: string, imgUrl?: string) {
    if (!text.trim() && !imgUrl) return
    if (streaming) return

    const msg: ChatMessage = {
      role: 'user',
      content: text.trim(),
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      imageUrl: imgUrl,
    }
    messages.push(msg)
    renderMessages()
    inputEl.value = ''
    inputEl.style.height = 'auto'
    pendingImageUrl = ''
    imagePreviewRow.classList.remove('active')

    streaming = true
    sendBtn.disabled = true
    const streamer = appendStreamingBubble()

    const port = chrome.runtime.connect({ name: 'xiaoyi-ai-chat' })
    port.postMessage({
      messages: messages.slice(0, -1).concat(msg),  // all including current
      context: contextEnabled ? pageContext : undefined,
      imageUrl: imgUrl,
    })
    port.onMessage.addListener((m: { type: string; text?: string; error?: string }) => {
      if (m.type === 'chunk' && m.text) {
        streamer.update(m.text)
      } else if (m.type === 'done') {
        streamer.finalize()
        streaming = false
        sendBtn.disabled = false
        port.disconnect()
      } else if (m.type === 'error') {
        streamer.finalize()
        // Replace last message content with error
        const errDiv = document.createElement('div')
        errDiv.className = 'msg assistant'
        errDiv.innerHTML = `<div class="msg-bubble" style="background:#fef2f2;color:#dc2626">⚠️ ${escHtml(m.error ?? '未知错误')}</div>`
        msgArea.replaceChild(errDiv, msgArea.querySelector('.msg.assistant:last-child')!)
        streaming = false
        sendBtn.disabled = false
        port.disconnect()
      }
    })
    port.onDisconnect.addListener(() => {
      streaming = false
      sendBtn.disabled = false
    })
  }

  // ── 事件 ─────────────────────────────────────────────────
  getEl<HTMLButtonElement>('#close-btn').onclick = () => hide()

  sendBtn.onclick = () => doSend(inputEl.value, pendingImageUrl || undefined)

  inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      doSend(inputEl.value, pendingImageUrl || undefined)
    }
  })

  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto'
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px'
  })

  clearBtn.onclick = () => {
    messages.length = 0
    renderMessages()
  }

  ctxBadge.onclick = () => {
    contextEnabled = !contextEnabled
    updateCtxBadge()
  }

  ctxToggleBtn.onclick = () => {
    contextEnabled = !contextEnabled
    updateCtxBadge()
  }

  removeImageBtn.onclick = () => {
    pendingImageUrl = ''
    imagePreviewRow.classList.remove('active')
  }

  function updateCtxBadge() {
    if (contextEnabled && pageContext) {
      ctxBadge.textContent = '📄 已注入上下文'
      ctxBadge.style.background = 'rgba(255,255,255,0.35)'
      ctxToggleBtn.textContent = '❌ 移除页面上下文'
    } else {
      ctxBadge.textContent = pageContext ? '📄 点击注入上下文' : '📄 无上下文'
      ctxBadge.style.background = 'rgba(255,255,255,0.2)'
      ctxToggleBtn.textContent = '📄 注入页面上下文'
    }
  }

  // ── 公开 API ─────────────────────────────────────────────
  function show() {
    sidebar.classList.add('open')
    setTimeout(() => inputEl.focus(), 300)
  }

  function hide() {
    sidebar.classList.remove('open')
  }

  function toggle() {
    if (sidebar.classList.contains('open')) hide()
    else show()
  }

  return {
    show,
    hide,
    toggle,
    isOpen: () => sidebar.classList.contains('open'),
    setContext(ctx: string) {
      pageContext = ctx
      updateCtxBadge()
    },
    sendMessage(text: string, imgUrl?: string) {
      if (imgUrl) {
        pendingImageUrl = imgUrl
        imageThumb.src = imgUrl
        imagePreviewRow.classList.add('active')
      }
      if (text) {
        inputEl.value = text
        inputEl.dispatchEvent(new Event('input'))
      }
      show()
      if (text || imgUrl) {
        setTimeout(() => doSend(text, imgUrl), 100)
      }
    },
  }
}
