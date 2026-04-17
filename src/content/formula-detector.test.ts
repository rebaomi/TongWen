import { describe, it, expect } from 'vitest'
import { extractFormulas, restoreFormulas, hasCitations, shouldSkipNode } from './formula-detector'

describe('extractFormulas', () => {
  it('extracts inline formula $...$', () => {
    const { text, formulas } = extractFormulas('The formula $E=mc^2$ is well known.')
    expect(text).not.toContain('$E=mc^2$')
    expect(formulas).toHaveLength(1)
    expect(formulas[0]).toBe('$E=mc^2$')
    expect(text).toContain('§FORMULA§0§')
  })

  it('extracts block formula $$...$$', () => {
    const { formulas } = extractFormulas('See $$\\sum_{i=1}^n x_i$$ here.')
    expect(formulas).toHaveLength(1)
    expect(formulas[0]).toContain('\\sum')
  })

  it('extracts \\begin{...}...\\end{...}', () => {
    const { formulas } = extractFormulas('\\begin{equation}x=1\\end{equation}')
    expect(formulas).toHaveLength(1)
  })

  it('preserves text outside formulas', () => {
    const { text } = extractFormulas('Hello world, no formula here.')
    expect(text).toBe('Hello world, no formula here.')
  })

  it('handles multiple formulas', () => {
    const { text, formulas } = extractFormulas('$a$ and $b$ and $c$')
    expect(formulas).toHaveLength(3)
    expect(text).toContain('§FORMULA§0§')
    expect(text).toContain('§FORMULA§1§')
    expect(text).toContain('§FORMULA§2§')
  })
})

describe('restoreFormulas', () => {
  it('restores formulas to translated text', () => {
    const { text, formulas } = extractFormulas('Use $E=mc^2$ here')
    const fakeTranslation = text.replace('Use', '使用').replace('here', '这里')
    const result = restoreFormulas(fakeTranslation, formulas)
    expect(result).toContain('$E=mc^2$')
  })

  it('round-trips correctly', () => {
    const original = 'The value is $\\alpha + \\beta = \\gamma$.'
    const { text, formulas } = extractFormulas(original)
    const restored = restoreFormulas(text, formulas)
    expect(restored).toBe(original)
  })
})

describe('hasCitations', () => {
  it('detects [1] style', () => {
    expect(hasCitations('See [1] for details.')).toBe(true)
  })

  it('detects (Author 2020) style', () => {
    expect(hasCitations('(Smith et al., 2021)')).toBe(true)
  })

  it('detects (Author, year) style', () => {
    expect(hasCitations('(Jones, 2019)')).toBe(true)
  })

  it('returns false for no citations', () => {
    expect(hasCitations('This is a plain sentence.')).toBe(false)
  })
})

describe('shouldSkipNode', () => {
  it('skips PRE element', () => {
    const pre = document.createElement('pre')
    document.body.appendChild(pre)
    expect(shouldSkipNode(pre)).toBe(true)
    pre.remove()
  })

  it('skips CODE element', () => {
    const code = document.createElement('code')
    document.body.appendChild(code)
    expect(shouldSkipNode(code)).toBe(true)
    code.remove()
  })

  it('skips SCRIPT element', () => {
    const script = document.createElement('script')
    document.body.appendChild(script)
    expect(shouldSkipNode(script)).toBe(true)
    script.remove()
  })

  it('skips element with translate="no"', () => {
    const div = document.createElement('div')
    div.setAttribute('translate', 'no')
    document.body.appendChild(div)
    expect(shouldSkipNode(div)).toBe(true)
    div.remove()
  })

  it('does not skip normal paragraph', () => {
    const p = document.createElement('p')
    document.body.appendChild(p)
    expect(shouldSkipNode(p)).toBe(false)
    p.remove()
  })

  it('skips element inside pre', () => {
    const pre = document.createElement('pre')
    const span = document.createElement('span')
    pre.appendChild(span)
    document.body.appendChild(pre)
    expect(shouldSkipNode(span)).toBe(true)
    pre.remove()
  })
})
