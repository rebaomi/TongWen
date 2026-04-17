# 晓译 XiaoYi — AI 阅读翻译助手

> 专注网页与学术 PDF 翻译，集成 AI 对话、文本标注、截图分析，支持 14 个主流翻译/AI 引擎。

简体中文 | [繁體中文](./README.zh-TW.md) | [English](./README.en.md)

---

## ✨ 核心功能

### 🌐 网页翻译

| 模式 | 描述 |
|------|------|
| 📖 双语对照 | 原文下方插入译文，保留原版式 |
| 🔄 全文替换 | 直接替换页面文本为译文 |
| 🖱️ 划词翻译 | 选中文字即时弹出翻译气泡 + 「问 AI」按钮 |

- **快捷键**：`Alt+T` 翻译当前页，`Alt+M` 切换翻译模式
- **右键菜单**：翻译选中文字、整页、链接页面
- **悬浮操作面板**：可拖拽面板，一键访问所有功能（可在设置中开启）
- **动态内容支持**：MutationObserver 自动翻译页面后续加载的内容
- **智能跳过**：自动跳过代码块、代码片段、输入框等不适合翻译的区域
- **翻译缓存**：会话级缓存，相同内容秒速返回
- **失败自动重试**：网络抖动时最多重试 2 次

### 📄 学术 PDF 翻译

- 📐 **自动识别并保留 LaTeX 数学公式**（`$...$`、`$$...$$`、`\begin{}` 环境）
- 📖 **保留参考文献引用标记**（`[1]`、`(Author 2020)` 等）
- 🗂️ **双栏布局自动检测**：正确处理学术论文的双栏排版
- 📄 **段落级双语对照**：按段落合并翻译，格式与原文一致
- 📏 **页码范围翻译**：只翻译指定页，大幅节省 API 用量
- 💾 **进度自动保存**：中途关闭后可恢复翻译进度
- 🔗 **支持网络 PDF 直链**：粘贴 arXiv 等链接直接加载
- 📥 **导出双语 PDF**：原文页 + 译文页交替排列

### 🤖 AI 阅读助手

- **AI 侧边栏**：页面右侧全屏聊天面板，支持流式输出，可注入当前页面内容作为上下文
- **视觉分析**：截图发送给 AI 分析图表、表格、流程图等
- **选中问 AI**：选中任意文字 → 弹出工具栏 → 一键翻译或发给 AI 深度解读
- **划词问 AI**：悬浮翻译气泡底部附带「问 AI」按钮，无缝衔接深度解读
- **高亮标注**：5 种颜色标注重要内容，持久化保存，刷新后自动恢复
- **框选截图**：一键截取页面任意区域并自动发给 AI 分析

### ⚙️ 高级设置

- **自定义术语表**：填写专业术语的固定译法，翻译结果自动替换
- **按域名配置**：为不同网站单独设置引擎、翻译模式或完全禁用
- **排除域名**：在指定网站上完全关闭所有翻译功能（实时生效，无需刷新）

---

## 🔌 支持 14 个翻译/AI 引擎

| 引擎 | 特点 |
|------|------|
| 🚀 DeepSeek | 中文理解极佳，成本最低（推荐） |
| ✨ OpenAI GPT | 综合质量最高，支持视觉分析 |
| 🧡 Claude | Anthropic 出品，人文理解极佳，支持视觉 |
| 💎 Google Gemini | Google 最新多模态大模型，支持视觉 |
| ⚡ Grok | xAI 出品，推理能力强，支持视觉 |
| 🟣 通义千问 | 阿里云大模型，中文理解优秀 |
| 🌙 Kimi | 月之暗面，长上下文理解能力强 |
| 🔷 智谱 GLM | 清华智谱，学术场景友好 |
| 🌊 MiniMax | 国产大模型，长文本表现优秀 |
| 🫘 豆包 | 字节跳动大模型，国内访问稳定 |
| 🌐 Google 翻译 | 速度快，语言覆盖广 |
| 🔵 DeepL | 欧洲语言翻译质量最佳 |
| 🔴 百度翻译 | 国内访问稳定 |
| 💻 本地模型（Ollama） | 完全离线，无需 API Key |

> AI 对话功能支持：DeepSeek / OpenAI / Claude / Gemini / Grok / 通义千问 / Kimi / 智谱 / MiniMax / 豆包 / Ollama

---

## 🔒 安全设计

- API Key 存储于本地 `chrome.storage.local`，**不同步到云端**
- 内容脚本无法直接获取 API Key，Key 仅在 Service Worker 内存中短暂使用
- Service Worker 验证消息来源，拒绝非法调用
- 设置页面 API Key 字段默认掩码显示

---

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 构建

```bash
npm run build
```

### 加载到 Chrome

1. 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目目录下的 **`dist/`** 文件夹

> 每次修改源码后运行 `npm run build`，然后在扩展页面点击刷新按钮（↻）即可生效。

---

## 🔧 引擎配置

点击插件图标 → 右上角 ⚙️ → 进入设置页面，选择引擎并填入 API Key。

### 推荐配置

**DeepSeek（性价比最高）**
1. 访问 [platform.deepseek.com](https://platform.deepseek.com) 注册并创建 API Key
2. 填入设置页「DeepSeek」引擎的 API Key 栏

**本地模型（完全免费离线）**
1. 安装 [Ollama](https://ollama.ai)，拉取模型：`ollama pull qwen2.5:7b`
2. 必须设置 CORS，否则会报 403：

```powershell
# Windows（永久生效，需重启 Ollama）
[System.Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "*", "User")
```

```bash
# macOS / Linux
export OLLAMA_ORIGINS='*' && ollama serve
```

---

## 📁 项目结构

```
src/
├── background/
│   └── service-worker.ts        # 后台 SW：翻译、AI 聊天、截图、消息路由
├── content/
│   ├── index.ts                 # 内容脚本主入口
│   ├── bilingual.ts             # 双语对照模式
│   ├── hover.ts                 # 划词翻译气泡
│   ├── floating-panel.ts        # 悬浮操作面板（Shadow DOM）
│   ├── ai-sidebar.ts            # AI 对话侧边栏（Shadow DOM，流式输出）
│   ├── highlighter.ts           # 多色文本高亮 + 持久化
│   ├── selection-toolbar.ts     # 选中文字浮动工具栏
│   ├── screenshot.ts            # 框选截图 + AI 分析
│   ├── translator.ts            # 翻译调用 + 公式保护 + 自动重试
│   ├── formula-detector.ts      # LaTeX 公式识别
│   ├── ui.ts                    # Toast / 加载条
│   └── styles.css               # 注入样式
├── engines/                     # 翻译引擎适配器（14 个）
│   ├── chat.ts                  # AI 对话能力（流式，支持视觉）
│   ├── base-openai.ts           # OpenAI 兼容接口基类
│   ├── deepseek.ts / openai.ts / claude.ts / gemini.ts
│   ├── qwen.ts / kimi.ts / glm.ts / minimax.ts / grok.ts / doubao.ts
│   ├── google.ts / deepl.ts / baidu.ts / local.ts
│   └── index.ts                 # 引擎统一出口
├── pdf/
│   ├── PdfViewer.tsx            # PDF 查看器（URL 直链 & 本地文件）
│   ├── pdf-processor.ts         # PDF 解析、段落合并、双栏检测
│   ├── pdf-exporter.ts          # 导出双语 PDF（Canvas 渲染中文）
│   └── main.tsx
├── popup/                       # 弹窗界面
├── options/                     # 设置页面（含术语表、域名覆盖）
├── shared/
│   ├── types.ts                 # TypeScript 类型定义
│   └── constants.ts             # 引擎配置、默认设置
└── utils/
    ├── storage.ts               # Chrome Storage 封装（API Key 安全隔离）
    ├── messaging.ts             # Service Worker 消息重试工具
    └── usage.ts                 # 使用次数管理
```

---

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| Vite 5 + CRXJS | Chrome Extension 构建 |
| React 19 + TypeScript | UI 框架 |
| Tailwind CSS v4 | 样式 |
| PDF.js (Mozilla) | PDF 渲染与文本提取 |
| pdf-lib | 双语 PDF 生成 |
| Shadow DOM | 悬浮面板 / AI 侧边栏样式隔离 |
| Chrome Storage API | 设置与数据持久化 |
| Manifest V3 | Chrome 扩展规范 |
| Vitest + jsdom | 单元测试 |
| GitHub Actions | CI/CD 自动构建与发布 |

---

## 📄 License

MIT
