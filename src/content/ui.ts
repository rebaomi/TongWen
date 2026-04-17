// 内容脚本 UI 工具函数

export function showErrorToast(message: string): void {
  const existing = document.getElementById('xiaoyi-error-toast')
  existing?.remove()

  const toast = document.createElement('div')
  toast.id = 'xiaoyi-error-toast'
  toast.className = 'scholar-error-toast'
  toast.innerHTML = `<span>⚠️ ${escapeHtml(message)}</span>`
  document.body.appendChild(toast)
  setTimeout(() => toast?.remove(), 6000)
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

let loadingBar: HTMLElement | null = null

export function showLoadingBar(): void {
  loadingBar?.remove()
  loadingBar = document.createElement('div')
  loadingBar.id = 'scholar-loading-bar'
  loadingBar.className = 'scholar-loading-bar'
  document.body.appendChild(loadingBar)
}

export function hideLoadingBar(): void {
  loadingBar?.remove()
  loadingBar = null
}

export function showProUpgradeToast(): void {
  if (document.getElementById('scholar-pro-toast')) return

  const toast = document.createElement('div')
  toast.id = 'scholar-pro-toast'
  toast.className = 'scholar-pro-toast'
  toast.innerHTML = `
    <div class="scholar-pro-toast-icon">🎓</div>
    <div class="scholar-pro-toast-body">
      <strong>今日免费翻译次数已用完</strong>
      <p>免费版每天 5 次，升级 Pro 无限使用</p>
    </div>
    <a class="scholar-pro-toast-btn" href="chrome-extension://${chrome.runtime.id}/options/index.html#upgrade" target="_blank">
      升级 Pro
    </a>
    <button class="scholar-pro-toast-close" onclick="this.parentElement.remove()">×</button>
  `
  document.body.appendChild(toast)
  setTimeout(() => toast?.remove(), 8000)
}
