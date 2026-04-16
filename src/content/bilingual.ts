// 双语对照模式：在原文下方插入译文

const TRANSLATION_ATTR = 'data-scholar-translated'
const TRANSLATION_CLASS = 'scholar-translation'

export function injectBilingualTranslation(node: Text, translated: string): void {
  const parent = node.parentElement
  if (!parent || parent.getAttribute(TRANSLATION_ATTR)) return

  parent.setAttribute(TRANSLATION_ATTR, 'true')

  const translationEl = document.createElement('span')
  translationEl.className = TRANSLATION_CLASS
  translationEl.textContent = translated
  translationEl.setAttribute('data-scholar-role', 'translation')

  // 在文本节点后面插入译文
  const nextSibling = node.nextSibling
  if (nextSibling) {
    parent.insertBefore(translationEl, nextSibling)
  } else {
    parent.appendChild(translationEl)
  }
}

export function removeBilingualTranslations(): void {
  document.querySelectorAll(`.${TRANSLATION_CLASS}`).forEach(el => el.remove())
  document.querySelectorAll(`[${TRANSLATION_ATTR}]`).forEach(el => {
    el.removeAttribute(TRANSLATION_ATTR)
  })
}

export function isTranslated(): boolean {
  return document.querySelectorAll(`.${TRANSLATION_CLASS}`).length > 0
}
