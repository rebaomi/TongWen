import type { TranslateMode } from '@/shared/types'

type PanelCallbacks = {
  onTranslatePage: () => void
  onToggleTranslation: () => void
  onModeChange: (mode: TranslateMode) => void
  onOpenSettings: () => void
  onOpenPdf: () => void
  onOpenAi?: () => void
  onScreenshot?: () => void
}

const PANEL_CSS = `
  :host { all: initial; }

  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }

  #panel {
    position: fixed;
    z-index: 2147483647;
    bottom: 80px;
    right: 20px;
    width: 220px;
    background: #ffffff;
    border: 1px solid #e0e0e0;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1);
    overflow: hidden;
    user-select: none;
    transition: box-shadow 0.2s;
  }

  #panel.dragging {
    box-shadow: 0 16px 48px rgba(0,0,0,0.25);
    cursor: grabbing;
  }

  #panel.minimized #body { display: none; }
  #panel.minimized { width: auto; border-radius: 50%; }

  /* 标题栏 */
  #header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    background: linear-gradient(135deg, #1a73e8 0%, #6c5ce7 100%);
    cursor: grab;
    color: #fff;
  }

  #header:active { cursor: grabbing; }

  #logo { font-size: 15px; }

  #title {
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.3px;
  }

  .header-btn {
    background: rgba(255,255,255,0.2);
    border: none;
    color: #fff;
    cursor: pointer;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    line-height: 1;
    transition: background 0.15s;
    padding: 0;
  }

  .header-btn:hover { background: rgba(255,255,255,0.35); }

  /* 面板主体 */
  #body { padding: 10px; display: flex; flex-direction: column; gap: 8px; }

  /* 主按钮 */
  .btn-primary {
    width: 100%;
    padding: 8px 12px;
    border-radius: 10px;
    border: none;
    background: #1a73e8;
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: center;
    transition: background 0.15s, transform 0.1s;
  }

  .btn-primary:hover { background: #1557b0; }
  .btn-primary:active { transform: scale(0.97); }
  .btn-primary:disabled { background: #c5c5c5; cursor: not-allowed; transform: none; }

  /* 次级按钮 */
  .btn-secondary {
    width: 100%;
    padding: 7px 12px;
    border-radius: 10px;
    border: 1px solid #e0e0e0;
    background: #f8f9fa;
    color: #3c4043;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: center;
    transition: background 0.15s;
  }

  .btn-secondary:hover { background: #e8eaed; }

  /* 模式选择器 */
  #mode-label { font-size: 10px; font-weight: 600; color: #80868b; text-transform: uppercase; letter-spacing: 0.5px; }

  #mode-tabs {
    display: flex;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e0e0e0;
  }

  .mode-tab {
    flex: 1;
    padding: 5px 4px;
    border: none;
    background: #f8f9fa;
    color: #5f6368;
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    text-align: center;
    white-space: nowrap;
  }

  .mode-tab + .mode-tab { border-left: 1px solid #e0e0e0; }
  .mode-tab.active { background: #1a73e8; color: #fff; }
  .mode-tab:hover:not(.active) { background: #e8eaed; }

  /* 进度条 */
  #progress-bar {
    height: 3px;
    background: #e8eaed;
    border-radius: 2px;
    overflow: hidden;
    display: none;
  }

  #progress-bar.visible { display: block; }

  #progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #1a73e8, #34a853);
    border-radius: 2px;
    transition: width 0.3s;
    width: 0%;
  }

  /* 底部 */
  #footer {
    display: flex;
    gap: 6px;
    padding-top: 2px;
    border-top: 1px solid #f1f3f4;
    margin-top: 2px;
  }

  .btn-icon {
    flex: 1;
    padding: 6px 4px;
    border: none;
    background: none;
    color: #80868b;
    font-size: 13px;
    cursor: pointer;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    transition: background 0.15s, color 0.15s;
  }

  .btn-icon span { font-size: 9px; }
  .btn-icon:hover { background: #f1f3f4; color: #1a73e8; }

  /* 最小化按钮（气泡模式） */
  #bubble {
    display: none;
    position: fixed;
    z-index: 2147483647;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1a73e8, #6c5ce7);
    box-shadow: 0 4px 16px rgba(26,115,232,0.4);
    cursor: pointer;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    border: 2px solid rgba(255,255,255,0.3);
    transition: transform 0.2s, box-shadow 0.2s;
    user-select: none;
  }

  #bubble:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(26,115,232,0.5);
  }

  /* 翻译中状态 */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  /* 暗色模式 */
  @media (prefers-color-scheme: dark) {
    #panel { background: #2d2d2d; border-color: #444; }
    .btn-secondary { background: #3c3c3c; border-color: #555; color: #e8eaed; }
    .btn-secondary:hover { background: #484848; }
    #mode-tabs { border-color: #555; }
    .mode-tab { background: #3c3c3c; color: #9aa0a6; }
    .mode-tab + .mode-tab { border-left-color: #555; }
    .mode-tab:hover:not(.active) { background: #484848; }
    #footer { border-top-color: #3c3c3c; }
    .btn-icon { color: #9aa0a6; }
    .btn-icon:hover { background: #3c3c3c; }
    #progress-bar { background: #444; }
    #mode-label { color: #9aa0a6; }
  }
`

export function createFloatingPanel(
  initialMode: TranslateMode,
  callbacks: PanelCallbacks,
): {
  setMode: (m: TranslateMode) => void
  setTranslating: (v: boolean, progress?: number) => void
  show: () => void
  destroy: () => void
} {
  // Shadow DOM 宿主
  const host = document.createElement('div')
  host.id = 'xiaoyi-panel-host'
  const shadow = host.attachShadow({ mode: 'open' })

  // 注入样式
  const style = document.createElement('style')
  style.textContent = PANEL_CSS
  shadow.appendChild(style)

  let currentMode: TranslateMode = initialMode
  let isTranslating = false

  // ─── 主面板 ───
  const panel = document.createElement('div')
  panel.id = 'panel'

  // 从 localStorage 恢复位置
  const savedPos = loadPos()
  if (savedPos) {
    panel.style.right = 'auto'
    panel.style.bottom = 'auto'
    panel.style.left = `${savedPos.x}px`
    panel.style.top = `${savedPos.y}px`
  }

  // 标题栏
  const header = document.createElement('div')
  header.id = 'header'
  header.innerHTML = `
    <span id="logo">🎓</span>
    <span id="title">晓译 XiaoYi</span>
    <button class="header-btn" id="btn-minimize" title="最小化">─</button>
    <button class="header-btn" id="btn-close" title="关闭">×</button>
  `

  // 面板主体
  const body = document.createElement('div')
  body.id = 'body'

  // 翻译按钮
  const btnTranslate = document.createElement('button')
  btnTranslate.className = 'btn-primary'
  btnTranslate.id = 'btn-translate'
  btnTranslate.innerHTML = `<span>🌐</span><span id="btn-translate-text">翻译此页面</span>`

  // 显示/隐藏按钮
  const btnToggle = document.createElement('button')
  btnToggle.className = 'btn-secondary'
  btnToggle.innerHTML = `<span>↩</span><span>显示 / 隐藏译文</span>`

  // 进度条
  const progressBar = document.createElement('div')
  progressBar.id = 'progress-bar'
  const progressFill = document.createElement('div')
  progressFill.id = 'progress-fill'
  progressBar.appendChild(progressFill)

  // 模式选择
  const modeLabel = document.createElement('div')
  modeLabel.id = 'mode-label'
  modeLabel.textContent = '翻译模式'

  const modeTabs = document.createElement('div')
  modeTabs.id = 'mode-tabs'
  const modes: { id: TranslateMode; label: string; icon: string }[] = [
    { id: 'bilingual', label: '双语', icon: '📖' },
    { id: 'replace',   label: '替换', icon: '🔄' },
    { id: 'hover',     label: '划词', icon: '🖱️' },
  ]
  modes.forEach(({ id, label, icon }) => {
    const tab = document.createElement('button')
    tab.className = 'mode-tab' + (id === currentMode ? ' active' : '')
    tab.dataset.mode = id
    tab.innerHTML = `${icon} ${label}`
    tab.onclick = () => {
      if (id !== currentMode) {
        currentMode = id
        updateModeTabs()
        callbacks.onModeChange(id)
      }
    }
    modeTabs.appendChild(tab)
  })

  // 底部图标按钮
  const footer = document.createElement('div')
  footer.id = 'footer'

  const btnSettings = document.createElement('button')
  btnSettings.className = 'btn-icon'
  btnSettings.innerHTML = `⚙️<span>设置</span>`
  btnSettings.onclick = callbacks.onOpenSettings

  const btnPdf = document.createElement('button')
  btnPdf.className = 'btn-icon'
  btnPdf.innerHTML = `📄<span>PDF</span>`
  btnPdf.onclick = callbacks.onOpenPdf

  const btnAi = document.createElement('button')
  btnAi.className = 'btn-icon'
  btnAi.innerHTML = `🤖<span>AI</span>`
  btnAi.title = 'AI 阅读助手'
  btnAi.onclick = () => callbacks.onOpenAi?.()

  const btnShot = document.createElement('button')
  btnShot.className = 'btn-icon'
  btnShot.innerHTML = `📷<span>截图</span>`
  btnShot.title = '框选截图 + AI 分析'
  btnShot.onclick = () => callbacks.onScreenshot?.()

  footer.appendChild(btnSettings)
  footer.appendChild(btnPdf)
  footer.appendChild(btnAi)
  footer.appendChild(btnShot)

  // 组装 body
  body.appendChild(btnTranslate)
  body.appendChild(btnToggle)
  body.appendChild(progressBar)
  body.appendChild(modeLabel)
  body.appendChild(modeTabs)
  body.appendChild(footer)

  panel.appendChild(header)
  panel.appendChild(body)

  // ─── 气泡按钮（最小化状态）───
  const bubble = document.createElement('div')
  bubble.id = 'bubble'
  bubble.textContent = '🎓'
  if (savedPos) {
    bubble.style.left = `${savedPos.x}px`
    bubble.style.top = `${savedPos.y}px`
  } else {
    bubble.style.right = '20px'
    bubble.style.bottom = '80px'
  }

  shadow.appendChild(panel)
  shadow.appendChild(bubble)
  document.documentElement.appendChild(host)

  // 如果用户曾经关闭过面板，默认隐藏（等待 popup 唤醒）
  try {
    if (localStorage.getItem('xiaoyi-panel-closed') === '1') {
      panel.style.display = 'none'
      bubble.style.display = 'none'
    }
  } catch { /* ignore */ }

  // ─── 事件绑定 ───

  btnTranslate.onclick = () => {
    if (!isTranslating) callbacks.onTranslatePage()
  }
  btnToggle.onclick = () => callbacks.onToggleTranslation()

  const btnMinimize = shadow.getElementById('btn-minimize')!
  const btnClose = shadow.getElementById('btn-close')!

  btnMinimize.onclick = (e) => {
    e.stopPropagation()
    setMinimized(true)
  }

  btnClose.onclick = (e) => {
    e.stopPropagation()
    // 隐藏而非销毁，记录关闭状态
    panel.style.display = 'none'
    bubble.style.display = 'none'
    try { localStorage.setItem('xiaoyi-panel-closed', '1') } catch { /* ignore */ }
  }

  bubble.onclick = () => {
    setMinimized(false)
    try { localStorage.removeItem('xiaoyi-panel-closed') } catch { /* ignore */ }
  }

  // ─── 拖拽逻辑（面板 & 气泡共用）───

  function makeDraggable(el: HTMLElement, handle: HTMLElement) {
    let startX = 0, startY = 0, startLeft = 0, startTop = 0

    handle.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      startX = e.clientX
      startY = e.clientY
      startLeft = rect.left
      startTop = rect.top

      el.style.right = 'auto'
      el.style.bottom = 'auto'
      el.style.left = `${startLeft}px`
      el.style.top = `${startTop}px`
      panel.classList.add('dragging')

      function onMove(e: MouseEvent) {
        const dx = e.clientX - startX
        const dy = e.clientY - startY
        const x = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, startLeft + dx))
        const y = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, startTop + dy))
        el.style.left = `${x}px`
        el.style.top = `${y}px`
        // 同步气泡位置
        if (el === panel) {
          bubble.style.left = `${x}px`
          bubble.style.top = `${y}px`
          bubble.style.right = 'auto'
          bubble.style.bottom = 'auto'
        }
      }

      function onUp(_e: MouseEvent) {
        panel.classList.remove('dragging')
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        const rect = el.getBoundingClientRect()
        savePos(rect.left, rect.top)
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  }

  makeDraggable(panel, header)
  makeDraggable(bubble, bubble)

  // ─── 辅助函数 ───

  function setMinimized(v: boolean) {
    if (v) {
      panel.style.display = 'none'
      bubble.style.display = 'flex'
    } else {
      panel.style.display = ''
      bubble.style.display = 'none'
    }
  }

  function updateModeTabs() {
    modeTabs.querySelectorAll('.mode-tab').forEach((tab) => {
      ;(tab as HTMLElement).classList.toggle('active', (tab as HTMLElement).dataset.mode === currentMode)
    })
  }

  function loadPos(): { x: number; y: number } | null {
    try {
      const s = localStorage.getItem('xiaoyi-panel-pos')
      return s ? JSON.parse(s) : null
    } catch { return null }
  }

  function savePos(x: number, y: number) {
    try { localStorage.setItem('xiaoyi-panel-pos', JSON.stringify({ x, y })) } catch { /* ignore */ }
  }

  // ─── 公开 API ───

  return {
    setMode(m: TranslateMode) {
      currentMode = m
      updateModeTabs()
    },
    setTranslating(v: boolean, progress = 0) {
      isTranslating = v
      const textEl = shadow.getElementById('btn-translate-text')!
      if (v) {
        btnTranslate.disabled = true
        textEl.innerHTML = `<span class="spinner"></span>&nbsp;翻译中 ${progress}%`
        progressBar.classList.add('visible')
        progressFill.style.width = `${progress}%`
      } else {
        btnTranslate.disabled = false
        textEl.textContent = '翻译此页面'
        progressBar.classList.remove('visible')
        progressFill.style.width = '0%'
      }
    },
    /** 显示面板（从关闭/隐藏状态唤醒） */
    show() {
      panel.style.display = ''
      bubble.style.display = 'none'
      try { localStorage.removeItem('xiaoyi-panel-closed') } catch { /* ignore */ }
    },
    destroy() { host.remove() },
  }
}
