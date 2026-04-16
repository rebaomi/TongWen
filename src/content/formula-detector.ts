// 检测并保护 LaTeX 公式，防止翻译时被破坏

const FORMULA_PLACEHOLDER_PREFIX = '§FORMULA§'

interface FormulaExtract {
  text: string        // 替换后的文本（公式已替换为占位符）
  formulas: string[]  // 原始公式列表
}

const FORMULA_PATTERNS = [
  // Block formulas
  /\$\$[\s\S]*?\$\$/g,
  // Inline formulas
  /\$[^$\n]+?\$/g,
  // \(...\)
  /\\\([\s\S]*?\\\)/g,
  // \[...\]
  /\\\[[\s\S]*?\\\]/g,
  // \begin{...}...\end{...}
  /\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g,
]

export function extractFormulas(text: string): FormulaExtract {
  const formulas: string[] = []
  let result = text

  for (const pattern of FORMULA_PATTERNS) {
    result = result.replace(pattern, (match) => {
      const idx = formulas.length
      formulas.push(match)
      return `${FORMULA_PLACEHOLDER_PREFIX}${idx}§`
    })
  }

  return { text: result, formulas }
}

export function restoreFormulas(text: string, formulas: string[]): string {
  return text.replace(/§FORMULA§(\d+)§/g, (_, idx) => formulas[parseInt(idx)] ?? '')
}

// 检测文本是否包含学术引用
export function hasCitations(text: string): boolean {
  const citationPatterns = [
    /\[\d+\]/,
    /\[[A-Za-z]+\d{4}\]/,
    /\([A-Za-z]+ et al\.,? \d{4}\)/,
    /\([A-Za-z]+,? \d{4}\)/,
  ]
  return citationPatterns.some(p => p.test(text))
}

// 检测节点是否应该跳过翻译（代码、公式等）
export function shouldSkipNode(node: Element): boolean {
  const skipTags = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'MATH', 'SVG', 'NOSCRIPT']
  const skipClasses = ['MathJax', 'katex', 'highlight', 'hljs', 'code', 'prism']

  if (skipTags.includes(node.tagName)) return true
  if (node.closest('code, pre, math, .MathJax, .katex')) return true
  if (skipClasses.some(cls => node.className?.includes?.(cls))) return true
  return false
}
