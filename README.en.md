# XiaoYi — AI Reading & Translation Assistant

> Focused on webpage and academic PDF translation, with integrated AI chat, text annotation, and screenshot analysis. Supports 14 major translation/AI engines.

[简体中文](./README.md) | [繁體中文](./README.zh-TW.md) | English

---

## ✨ Core Features

### 🌐 Webpage Translation

| Mode | Description |
|------|-------------|
| 📖 Bilingual | Insert translation below original text, preserving layout |
| 🔄 Replace | Replace page text directly with translation |
| 🖱️ Hover | Instant translation bubble on text selection + "Ask AI" button |

- **Shortcuts**: `Alt+T` translate page, `Alt+M` cycle through modes
- **Context menu**: Translate selection, full page, or linked pages
- **Floating panel**: Draggable control panel for quick access (enable in settings)
- **Dynamic content**: MutationObserver auto-translates content loaded after initial page render
- **Smart skip**: Automatically skips code blocks, input fields, and non-translatable elements
- **Translation cache**: Session-level cache for instant repeat lookups
- **Auto retry**: Up to 2 automatic retries on network errors

### 📄 Academic PDF Translation

- 📐 **Preserves LaTeX math formulas** (`$...$`, `$$...$$`, `\begin{}` environments)
- 📖 **Preserves citation markers** (`[1]`, `(Author 2020)`, etc.)
- 🗂️ **Two-column layout detection**: Correctly handles academic paper dual-column formats
- 📄 **Paragraph-level bilingual view**: Translated paragraphs align with original
- 📏 **Page range translation**: Translate only selected pages to save API costs
- 💾 **Progress auto-save**: Resume interrupted translations across sessions
- 🔗 **Direct URL support**: Paste arXiv or other PDF links to load directly
- 📥 **Export bilingual PDF**: Alternating original and translated pages

### 🤖 AI Reading Assistant

- **AI Sidebar**: Full-height chat panel on the right side with streaming output; can inject current page content as context
- **Visual analysis**: Capture any screen region and send to AI for chart/table/diagram analysis
- **Select & Ask AI**: Select any text → floating toolbar → translate or send to AI for deep analysis
- **Hover & Ask AI**: "Ask AI" button in hover translation bubble for seamless deep reading
- **Text highlights**: 5-color annotation with persistence — highlights restored automatically on page reload
- **Screenshot selection**: Drag to select any area of the page and auto-send to AI

### ⚙️ Advanced Settings

- **Custom glossary**: Define fixed translations for domain-specific terms
- **Per-site configuration**: Set different engine, mode, or disable translation per domain
- **Excluded domains**: Completely disable all translation features on specified sites (takes effect immediately, no reload needed)

---

## 🔌 14 Supported Engines

| Engine | Highlights |
|--------|------------|
| 🚀 DeepSeek | Best Chinese understanding, lowest cost (recommended) |
| ✨ OpenAI GPT | Highest quality, vision support |
| 🧡 Claude | Anthropic, excellent humanities understanding, vision support |
| 💎 Google Gemini | Latest multimodal model from Google, vision support |
| ⚡ Grok | xAI, strong reasoning, vision support |
| 🟣 Qwen (Tongyi) | Alibaba Cloud, excellent Chinese |
| 🌙 Kimi | Moonshot AI, long context understanding |
| 🔷 GLM (Zhipu) | Tsinghua, academic-friendly |
| 🌊 MiniMax | Domestic LLM, great for long texts |
| 🫘 Doubao | ByteDance, stable domestic access |
| 🌐 Google Translate | Fast, wide language coverage |
| 🔵 DeepL | Best quality for European languages |
| 🔴 Baidu Translate | Stable access in mainland China |
| 💻 Local (Ollama) | Fully offline, no API key required |

> AI chat supported by: DeepSeek / OpenAI / Claude / Gemini / Grok / Qwen / Kimi / GLM / MiniMax / Doubao / Ollama

---

## 🔒 Security

- API Keys stored in local `chrome.storage.local` — **never synced to the cloud**
- Content scripts cannot access API Keys directly; keys only reside briefly in Service Worker memory
- Service Worker validates message origin to reject unauthorized calls
- API Key fields are masked by default in the settings UI

---

## 🚀 Getting Started

### Install dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the **`dist/`** folder inside the project directory

> After modifying source code, run `npm run build`, then click the refresh button (↻) on the extension card.

---

## 🔧 Engine Setup

Click the extension icon → ⚙️ Settings → choose your engine and enter the API Key.

### Recommended

**DeepSeek (best value)**
1. Register at [platform.deepseek.com](https://platform.deepseek.com) and create an API Key
2. Paste it into the DeepSeek engine field in settings

**Local model (completely free, offline)**
1. Install [Ollama](https://ollama.ai) and pull a model: `ollama pull qwen2.5:7b`
2. Set CORS or you'll get a 403 error:

```powershell
# Windows (permanent, restart Ollama after)
[System.Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "*", "User")
```

```bash
# macOS / Linux
export OLLAMA_ORIGINS='*' && ollama serve
```

---

## 📁 Project Structure

```
src/
├── background/
│   └── service-worker.ts        # Background SW: translation, AI chat, screenshot, routing
├── content/
│   ├── index.ts                 # Content script main entry
│   ├── bilingual.ts             # Bilingual display mode
│   ├── hover.ts                 # Hover translation bubble
│   ├── floating-panel.ts        # Floating control panel (Shadow DOM)
│   ├── ai-sidebar.ts            # AI chat sidebar (Shadow DOM, streaming)
│   ├── highlighter.ts           # Multi-color text highlights + persistence
│   ├── selection-toolbar.ts     # Floating toolbar for text selections
│   ├── screenshot.ts            # Region screenshot + AI analysis
│   ├── translator.ts            # Translation calls + formula protection + retry
│   ├── formula-detector.ts      # LaTeX formula detection
│   ├── ui.ts                    # Toast / loading bar
│   └── styles.css               # Injected styles
├── engines/                     # 14 engine adapters
│   ├── chat.ts                  # AI chat capability (streaming, vision support)
│   ├── base-openai.ts           # OpenAI-compatible base class
│   └── ...                      # deepseek, openai, claude, gemini, qwen, etc.
├── pdf/
│   ├── PdfViewer.tsx            # PDF viewer (URL & local file)
│   ├── pdf-processor.ts         # Parsing, paragraph merging, two-column detection
│   ├── pdf-exporter.ts          # Bilingual PDF export (Canvas Chinese rendering)
│   └── main.tsx
├── popup/                       # Popup UI
├── options/                     # Settings page (glossary, per-site overrides)
├── shared/
│   ├── types.ts                 # TypeScript type definitions
│   └── constants.ts             # Engine config, default settings
└── utils/
    ├── storage.ts               # Chrome Storage wrapper (API Key isolation)
    ├── messaging.ts             # Service Worker message retry utility
    └── usage.ts                 # Usage quota management
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| Vite 5 + CRXJS | Chrome Extension build toolchain |
| React 19 + TypeScript | UI framework |
| Tailwind CSS v4 | Styling |
| PDF.js (Mozilla) | PDF rendering and text extraction |
| pdf-lib | Bilingual PDF generation |
| Shadow DOM | Style isolation for panels and sidebar |
| Chrome Storage API | Settings and data persistence |
| Manifest V3 | Chrome Extension specification |
| Vitest + jsdom | Unit testing |
| GitHub Actions | CI/CD auto-build and release |

---

## 📄 License

MIT
