# 🎓 TongWen — AI Academic Translation Chrome Extension

A Chrome extension focused on web page and academic PDF translation, supporting 14 mainstream AI translation engines with intelligent detection and preservation of mathematical formulas and citation formats.

[简体中文](./README.md) | [繁體中文](./README.zh-TW.md) | English

## ✨ Features

### Web Page Translation

| Mode | Description |
|------|-------------|
| 📖 Bilingual | Insert translation below original text, preserving layout |
| 🔄 Replace | Replace page content with translated text |
| 🖱️ Hover | Instant translation bubble on text selection |

- **Shortcuts**: `Alt+T` to translate current page, `Alt+M` to switch mode
- **Context Menu**: Translate selected text, full page, or linked pages
- **Floating Panel**: Draggable floating control panel (enable in settings)

### PDF Translation (Optimized for Academic Papers)

- 📐 **Auto-detects and preserves LaTeX math formulas** (`$...$`, `$$...$$`, `\begin{}` environments)
- 📖 **Preserves citation markers** (`[1]`, `(Author 2020)`, etc.)
- 📄 **Paragraph-level bilingual view**: Merges lines into paragraphs matching the original layout
- 🔗 **Remote PDF support**: Paste arXiv or any PDF URL to load and translate directly
- 📥 **Export bilingual PDF**: Alternating original and translated pages with proper CJK font rendering via Canvas

### 14 Translation Engines

| Engine | Highlights |
|--------|-----------|
| 🚀 DeepSeek | Best Chinese comprehension, lowest cost (recommended) |
| ✨ OpenAI GPT | Highest overall quality with context awareness |
| 🧡 Claude | Anthropic's model, excellent for humanities |
| 💎 Google Gemini | Google's latest multimodal model |
| ⚡ Grok | xAI's model with strong reasoning |
| 🟣 Qwen (Tongyi) | Alibaba Cloud model, great Chinese support |
| 🌙 Kimi | Moonshot AI, strong long-context understanding |
| 🔷 GLM | Zhipu AI, academic-friendly |
| 🌊 MiniMax | Long-text performance, domestic model |
| 🫘 Doubao | ByteDance model, stable access in China |
| 🌐 Google Translate | Fast, wide language coverage |
| 🔵 DeepL | Best quality for European languages |
| 🔴 Baidu Translate | Stable access in China |
| 💻 Local Model (Ollama) | Fully offline, no API key required |

### Security Design

- API Keys stored in `chrome.storage.local` — **never synced to the cloud**
- Content scripts cannot access API Keys; keys only exist briefly in Service Worker memory
- Service Worker validates message origins, rejecting unauthorized callers

### Free Quota

- **100 free translations per day**
- Full-page translation and PDF translation each count as 1 use, not per text chunk

## 🚀 Getting Started

### Install Dependencies

```bash
npm install
```

### Build for Production

```bash
npm run build
```

### Load into Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder in the project root

## 🔧 Engine Configuration

Click the extension icon → ⚙️ (top right) → Settings page → select an engine and enter your API Key.

### Recommended: DeepSeek

1. Sign up at [platform.deepseek.com](https://platform.deepseek.com)
2. Create an API Key and paste it into settings

### Local Model (Free & Offline)

1. Install [Ollama](https://ollama.ai)
2. Pull a model: `ollama pull qwen2.5:7b`
3. Start the service: `ollama serve`
4. **You must set the CORS environment variable** or you'll get 403 errors:

```powershell
# Windows PowerShell (permanent)
[System.Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "*", "User")
# Then restart Ollama
```

```bash
# macOS / Linux
export OLLAMA_ORIGINS='*'
ollama serve
```

## 📁 Project Structure

```
src/
├── background/
│   └── service-worker.ts      # Background SW: handles translation requests & message routing
├── content/
│   ├── index.ts               # Main content script controller
│   ├── bilingual.ts           # Bilingual mode injection
│   ├── hover.ts               # Hover/selection translation bubble
│   ├── floating-panel.ts      # Draggable floating panel (Shadow DOM isolated)
│   ├── translator.ts          # Translation calls with formula protection
│   ├── formula-detector.ts    # LaTeX formula detection & restoration
│   ├── ui.ts                  # Toast notifications & loading bar
│   └── styles.css             # Injected styles
├── engines/                   # Translation engine adapters (14 engines)
│   ├── base-openai.ts         # Shared base class for OpenAI-compatible APIs
│   ├── deepseek.ts
│   ├── openai.ts
│   ├── claude.ts              # Anthropic API (custom format)
│   ├── gemini.ts              # Google Gemini API (custom format)
│   ├── qwen.ts
│   ├── kimi.ts
│   ├── glm.ts
│   ├── minimax.ts
│   ├── grok.ts
│   ├── doubao.ts
│   ├── google.ts
│   ├── deepl.ts
│   ├── baidu.ts
│   └── local.ts               # Ollama local model
├── pdf/
│   ├── PdfViewer.tsx          # PDF viewer (supports URL & local file)
│   ├── pdf-processor.ts       # PDF parsing, paragraph merging & translation
│   ├── pdf-exporter.ts        # Bilingual PDF export (Canvas-based CJK rendering)
│   └── main.tsx
├── popup/                     # Extension popup UI
├── options/                   # Settings page
├── shared/
│   ├── types.ts               # TypeScript type definitions
│   └── constants.ts           # Engine configs & default settings
└── utils/
    ├── storage.ts             # Chrome Storage wrapper (API Key security isolation)
    ├── messaging.ts           # Service Worker message retry utility
    └── usage.ts               # Daily usage tracking
```

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| Vite 5 + CRXJS | Chrome Extension build toolchain |
| React 19 + TypeScript | UI framework |
| Tailwind CSS v4 | Styling |
| PDF.js (Mozilla) | PDF rendering & text extraction |
| pdf-lib | PDF file generation |
| Shadow DOM | Floating panel style isolation |
| Chrome Storage API | Settings & data persistence |
| Manifest V3 | Chrome Extension standard |

## 🗺️ Roadmap

- [ ] Translation cache (avoid re-translating identical text)
- [ ] Two-column PDF layout detection (common in academic papers)
- [ ] MutationObserver for SPA dynamic content
- [ ] Skip `<code>` / `<pre>` blocks
- [ ] Page range selection for PDF translation
- [ ] Custom terminology glossary
- [ ] Per-site engine/mode configuration
- [ ] GitHub Actions CI for automated builds

## 📄 License

MIT
