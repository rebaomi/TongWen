# 🎓 通文 TongWen — AI 學術翻譯 Chrome 插件

專注於網頁翻譯與學術 PDF 翻譯，支援 14 個主流 AI 翻譯引擎，智慧識別並保留數學公式與參考文獻格式。

[简体中文](./README.md) | 繁體中文 | [English](./README.en.md)

## ✨ 功能特色

### 網頁翻譯

| 模式 | 描述 |
|------|------|
| 📖 雙語對照 | 原文下方插入譯文，保留原版式 |
| 🔄 全文替換 | 直接替換頁面文字為譯文 |
| 🖱️ 劃詞翻譯 | 選取文字即時顯示翻譯氣泡 |

- **快速鍵**：`Alt+T` 翻譯目前頁，`Alt+M` 切換翻譯模式
- **右鍵選單**：支援翻譯選取文字、整頁、連結頁面
- **頁面懸浮框**：可拖曳的懸浮操作面板（可在設定中開啟）

### PDF 翻譯（專為學術論文最佳化）

- 📐 **自動識別並保留 LaTeX 數學公式**（`$...$`、`$$...$$`、`\begin{}` 環境）
- 📖 **保留參考文獻引用標記**（`[1]`、`(Author 2020)` 等）
- 📄 **段落級雙語對照**：依段落合併翻譯，格式與原文一致
- 🔗 **支援網路 PDF 直連**：貼上 arXiv 等連結直接載入翻譯
- 📥 **匯出雙語 PDF**：原文頁 + 譯文頁交替排列，支援中文字型渲染

### 支援 14 個翻譯引擎

| 引擎 | 特點 |
|------|------|
| 🚀 DeepSeek | 中文理解極佳，成本最低（推薦） |
| ✨ OpenAI GPT | 綜合品質最高，支援上下文理解 |
| 🧡 Claude | Anthropic 出品，人文理解極佳 |
| 💎 Google Gemini | Google 最新多模態大型模型 |
| ⚡ Grok | xAI 出品，推理能力強 |
| 🟣 通義千問 | 阿里雲大型模型，中文理解優秀 |
| 🌙 Kimi | 月之暗面，長上下文理解能力強 |
| 🔷 智譜 GLM | 清華智譜，學術場景友好 |
| 🌊 MiniMax | 國產大型模型，長文字表現優秀 |
| 🫘 豆包 | 字節跳動大型模型，國內存取穩定 |
| 🌐 Google 翻譯 | 速度快，語言覆蓋廣 |
| 🔵 DeepL | 歐洲語言翻譯品質最佳 |
| 🔴 百度翻譯 | 國內存取穩定 |
| 💻 本地模型（Ollama） | 完全離線，無需 API Key |

### 安全設計

- API Key 儲存於本地 `chrome.storage.local`，**不同步到雲端**
- 內容腳本無法取得 API Key，Key 僅在 Service Worker 記憶體中短暫使用
- Service Worker 驗證訊息來源，拒絕非法呼叫

### 免費額度

- 每日 **100 次**免費翻譯
- 整頁翻譯 / PDF 翻譯各計 1 次，不按文字區塊疊加計數

## 🚀 快速開始

### 安裝相依套件

```bash
npm install
```

### 建置生產版本

```bash
npm run build
```

### 載入到 Chrome

1. 開啟 `chrome://extensions/`
2. 開啟右上角「開發人員模式」
3. 點擊「載入未封裝項目」
4. 選擇專案根目錄下的 `dist/` 目錄

## 🔧 引擎設定

點擊插件圖示 → 右上角 ⚙️ → 進入設定頁面，選擇引擎並填入 API Key。

### 本地模型（完全免費離線）

1. 安裝 [Ollama](https://ollama.ai)
2. 下載模型：`ollama pull qwen2.5:7b`
3. 啟動服務：`ollama serve`
4. **必須設定 CORS 環境變數**，否則會報 403：

```powershell
# Windows PowerShell（永久生效）
[System.Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "*", "User")
```

```bash
# macOS / Linux
export OLLAMA_ORIGINS='*'
ollama serve
```

## 🛠️ 技術堆疊

| 技術 | 用途 |
|------|------|
| Vite 5 + CRXJS | Chrome Extension 建置 |
| React 19 + TypeScript | UI 框架 |
| Tailwind CSS v4 | 樣式 |
| PDF.js (Mozilla) | PDF 渲染與文字擷取 |
| pdf-lib | PDF 檔案產生 |
| Shadow DOM | 懸浮面板樣式隔離 |
| Chrome Storage API | 設定與資料持久化 |
| Manifest V3 | Chrome 擴充功能規範 |

## 📄 授權

MIT
