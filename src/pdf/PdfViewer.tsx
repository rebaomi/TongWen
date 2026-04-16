import { useState, useRef, useCallback, useEffect } from 'react'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api'
import { loadPdf, extractPdfText, translateBlock, renderPageToCanvas } from './pdf-processor'
import type { TranslatedPage } from './pdf-processor'
import { exportBilingualPdf, downloadFile } from './pdf-exporter'

type ViewMode = 'original' | 'bilingual' | 'translated'

export default function PdfViewer() {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('bilingual')
  const [isLoading, setIsLoading] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [translatedPages, setTranslatedPages] = useState<Map<number, TranslatedPage>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string>('')     // 来自 URL 参数的远程地址
  const [urlInput, setUrlInput] = useState<string>('')       // 手动输入框

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 渲染当前页
  const renderPage = useCallback(async (page: PDFPageProxy) => {
    if (!canvasRef.current) return
    const scale = window.devicePixelRatio || 1.5
    await renderPageToCanvas(page, canvasRef.current, scale * 1.0)
  }, [])

  useEffect(() => {
    if (!pdfDoc || !currentPage) return
    pdfDoc.getPage(currentPage).then(renderPage)
  }, [pdfDoc, currentPage, renderPage])

  // 启动时读取 ?url= 参数，自动加载远程 PDF
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const remoteUrl = params.get('url')
    if (remoteUrl) {
      setSourceUrl(remoteUrl)
      handleUrlLoad(remoteUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 从 URL 加载 PDF（支持 arxiv 等直链）
  const handleUrlLoad = async (url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    setIsLoading(true)
    setError(null)
    setSourceUrl(trimmed)
    setPdfDoc(null)
    setTranslatedPages(new Map())
    try {
      // 通过插件后台 fetch 绕过页面级 CORS（extension page 有 host_permissions）
      const doc = await loadPdf(trimmed)
      setPdfDoc(doc)
      setTotalPages(doc.numPages)
      setCurrentPage(1)
    } catch (e) {
      setError(`无法加载 PDF：${e}\n\n如果是跨域问题，请尝试下载后再拖入。`)
    } finally {
      setIsLoading(false)
    }
  }

  // 从本地文件加载 PDF
  const handleFileLoad = async (file: File) => {
    setIsLoading(true)
    setError(null)
    setSourceUrl('')
    setPdfDoc(null)
    setTranslatedPages(new Map())
    try {
      const buffer = await file.arrayBuffer()
      const doc = await loadPdf(buffer)
      setPdfDoc(doc)
      setTotalPages(doc.numPages)
      setCurrentPage(1)
    } catch (e) {
      setError(`无法加载 PDF：${e}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 翻译所有页面
  const handleTranslateAll = async () => {
    if (!pdfDoc) return
    setIsTranslating(true)
    setProgress(0)

    const newMap = new Map(translatedPages)

    try {
      // PDF 整体翻译只计 1 次使用
      const allowed = await new Promise<boolean>((resolve) => {
        chrome.runtime.sendMessage({ type: 'INCREMENT_USAGE' }, (res: { success: boolean }) => {
          resolve(res?.success ?? false)
        })
      })
      if (!allowed) {
        setError('今日翻译次数已用完，请升级 Pro')
        setIsTranslating(false)
        return
      }

      const allPageBlocks = await extractPdfText(pdfDoc)

      for (let i = 0; i < allPageBlocks.length; i++) {
        const pageNum = i + 1
        const blocks = allPageBlocks[i]
        const translatedTexts: string[] = []

        for (const block of blocks) {
          try {
            const translated = await translateBlock(block)
            translatedTexts.push(translated)
          } catch (err) {
            if (String(err).includes('LIMIT_EXCEEDED')) {
              setError('今日翻译次数已用完，请升级 Pro')
              setIsTranslating(false)
              return
            }
            translatedTexts.push(block.text) // 失败时保留原文
          }
        }

        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale: 1 })

        newMap.set(pageNum, {
          pageNum,
          originalBlocks: blocks,
          translatedTexts,
          width: viewport.width,
          height: viewport.height,
        })

        setTranslatedPages(new Map(newMap))
        setProgress(Math.round(((i + 1) / allPageBlocks.length) * 100))
      }
    } finally {
      setIsTranslating(false)
    }
  }

  const [isExporting, setIsExporting] = useState(false)

  const handleExportBilingual = async () => {
    if (translatedPages.size === 0 || !pdfDoc) return
    setIsExporting(true)
    setError(null)
    try {
      const pages = Array.from(translatedPages.values()).sort((a, b) => a.pageNum - b.pageNum)
      const pdfBytes = await exportBilingualPdf(pages, pdfDoc)
      downloadFile(pdfBytes, 'bilingual_translated.pdf')
    } catch (e) {
      setError(`导出失败：${String(e)}`)
    } finally {
      setIsExporting(false)
    }
  }

  const currentTranslated = translatedPages.get(currentPage)

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* 侧边控制面板 */}
      <aside className="w-72 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            🎓 PDF 学术翻译
          </h1>
        </div>

        <div className="p-4 flex flex-col gap-3 flex-1 overflow-y-auto">
          {/* 来源标签 */}
          {sourceUrl && (
            <div className="px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-xs text-blue-700 dark:text-blue-300 break-all">
              🔗 {sourceUrl}
            </div>
          )}

          {/* URL 输入区 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">粘贴 PDF 网址（如 arXiv 链接）</label>
            <div className="flex gap-1.5">
              <input
                type="url"
                placeholder="https://arxiv.org/pdf/..."
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUrlLoad(urlInput)}
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100 min-w-0"
              />
              <button
                onClick={() => handleUrlLoad(urlInput)}
                disabled={!urlInput.trim() || isLoading}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs font-medium transition-colors whitespace-nowrap"
              >
                加载
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <span>或</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>

          {/* 本地文件上传区域 */}
          <div
            className="border-2 border-dashed border-blue-300 rounded-xl p-5 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file?.type === 'application/pdf') handleFileLoad(file)
            }}
          >
            <div className="text-2xl mb-1">📄</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              点击或拖拽本地 PDF<br />
              <span className="text-xs text-gray-400">支持学术论文、书籍、报告</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleFileLoad(file)
              }}
            />
          </div>

          {/* 翻译模式 */}
          {pdfDoc && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">显示模式</label>
                <div className="flex rounded-lg overflow-hidden border border-gray-200">
                  {(['original', 'bilingual', 'translated'] as ViewMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`flex-1 py-1.5 text-xs font-medium transition-colors ${viewMode === mode
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      {mode === 'original' ? '原文' : mode === 'bilingual' ? '双语' : '译文'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 翻译按钮 */}
              <button
                onClick={handleTranslateAll}
                disabled={isTranslating}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {isTranslating ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    翻译中 {progress}%
                  </>
                ) : '🚀 开始翻译全文'}
              </button>

              {/* 进度条 */}
              {isTranslating && (
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              {/* 导出 */}
              {translatedPages.size > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">导出</label>
                  <button
                    onClick={handleExportBilingual}
                    disabled={isExporting}
                    className="w-full py-2 rounded-lg border border-blue-600 text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {isExporting ? (
                      <><span className="animate-spin">⟳</span> 生成中…</>
                    ) : '📥 下载双语 PDF'}
                  </button>
                </div>
              )}

              {/* 页面导航 */}
              <div className="mt-auto space-y-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  页面 {currentPage} / {totalPages}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="flex-1 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-sm"
                  >
                    ← 上一页
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="flex-1 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-sm"
                  >
                    下一页 →
                  </button>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto p-6">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl animate-spin mb-4">⟳</div>
              <div className="text-gray-600">加载 PDF 中…</div>
            </div>
          </div>
        )}

        {!pdfDoc && !isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <div className="text-6xl mb-4">📚</div>
              <div className="text-lg font-medium">打开 PDF 开始翻译</div>
              <div className="text-sm mt-2 space-y-1 text-gray-400">
                <div>📎 粘贴 arXiv / 网络 PDF 链接</div>
                <div>📄 或拖拽本地 PDF 文件</div>
              </div>
              <div className="text-xs mt-3 text-gray-300">自动识别并保留数学公式和参考文献</div>
            </div>
          </div>
        )}

        {pdfDoc && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* PDF 原始渲染 */}
            {(viewMode === 'original' || viewMode === 'bilingual') && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
                <canvas ref={canvasRef} className="w-full" />
              </div>
            )}

            {/* 译文面板 */}
            {(viewMode === 'bilingual' || viewMode === 'translated') && currentTranslated && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 space-y-5">
                <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700 pb-2">
                  第 {currentPage} 页
                </h3>
                {currentTranslated.originalBlocks.map((block, i) => (
                  <div
                    key={i}
                    className={`rounded-lg overflow-hidden ${viewMode === 'bilingual'
                      ? 'border border-gray-100 dark:border-gray-700'
                      : ''}`}
                  >
                    {/* 双语模式：上方原文 */}
                    {viewMode === 'bilingual' && (
                      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50">
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                          {block.text}
                        </p>
                        {(block.isFormula || block.isCitation) && (
                          <span className="mt-1 inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            {block.isFormula ? '📐 公式已保留' : '📖 引用已保留'}
                          </span>
                        )}
                      </div>
                    )}
                    {/* 译文 */}
                    <div className={viewMode === 'bilingual' ? 'px-4 py-3' : ''}>
                      <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
                        {currentTranslated.translatedTexts[i] || block.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 翻译中占位 */}
            {(viewMode === 'bilingual' || viewMode === 'translated') && !currentTranslated && pdfDoc && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 text-center text-gray-400">
                <div className="text-3xl mb-2">🌐</div>
                <div>点击「开始翻译全文」获取中文译文</div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
