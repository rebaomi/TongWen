# 🎓 通文 TongWen — AI 学术翻译 Chrome 插件

专注于网页翻译与学术 PDF 翻译，支持 14 个主流 AI 翻译引擎，智能识别并保留数学公式与参考文献格式。

## ✨ 功能特性

### 网页翻译

| 模式 | 描述 |
|------|------|
| 📖 双语对照 | 原文下方插入译文，保留原版式 |
| 🔄 全文替换 | 直接替换页面文本为译文 |
| 🖱️ 划词翻译 | 选中文字即时显示翻译气泡 |

- **快捷键**：`Alt+T` 翻译当前页，`Alt+M` 切换翻译模式
- **右键菜单**：支持翻译选中文字、整页、链接页面
- **页面悬浮框**：可拖拽的悬浮操作面板（可在设置中开启）

### PDF 翻译（专为学术论文优化）

- 📐 **自动识别并保留 LaTeX 数学公式**（`$...$`、`$$...$$`、`\begin{}` 环境）
- 📖 **保留参考文献引用标记**（`[1]`、`(Author 2020)` 等）
- 📄 **段落级双语对照**：按段落合并翻译，格式与原文一致
- 🔗 **支持网络 PDF 直链**：粘贴 arXiv 等链接直接加载翻译（Popup 检测到 PDF 页面时自动提示）
- 📥 **导出双语 PDF**：原文页 + 译文页交替排列，支持中文字体渲染

### 支持 14 个翻译引擎

| 引擎 | 特点 |
|------|------|
| 🚀 DeepSeek | 中文理解极佳，成本最低（推荐） |
| ✨ OpenAI GPT | 综合质量最高，支持上下文理解 |
| 🧡 Claude | Anthropic 出品，人文理解极佳 |
| 💎 Google Gemini | Google 最新多模态大模型 |
| ⚡ Grok | xAI 出品，推理能力强 |
| 🟣 通义千问 | 阿里云大模型，中文理解优秀 |
| 🌙 Kimi | 月之暗面，长上下文理解能力强 |
| 🔷 智谱 GLM | 清华智谱，学术场景友好 |
| 🌊 MiniMax | 国产大模型，长文本表现优秀 |
| 🫘 豆包 | 字节跳动大模型，国内访问稳定 |
| 🌐 Google 翻译 | 速度快，语言覆盖广 |
| 🔵 DeepL | 欧洲语言翻译质量最佳 |
| 🔴 百度翻译 | 国内访问稳定 |
| 💻 本地模型（Ollama） | 完全离线，无需 API Key |

### 安全设计

- API Key 存储在本地 `chrome.storage.local`，**不同步到云端**
- 内容脚本无法获取 API Key，Key 仅在 Service Worker 内存中短暂使用
- Service Worker 验证消息来源，拒绝非法调用

### 免费额度

- 每日 **100 次**免费翻译
- 整页翻译 / PDF 翻译各计 1 次，不按文本块叠加计数

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 构建生产版本

```bash
npm run build
```

### 加载到 Chrome

1. 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目根目录下的 `dist/` 目录

## 🔧 引擎配置

点击插件图标 → 右上角 ⚙️ → 进入设置页面，选择引擎并填入 API Key。

### 推荐引擎

**DeepSeek（性价比最高）**
1. 访问 [platform.deepseek.com](https://platform.deepseek.com) 注册
2. 创建 API Key 填入设置

**通义千问**
1. 访问 [dashscope.aliyun.com](https://dashscope.aliyun.com) 获取 API Key
2. 默认模型 `qwen-plus`，可改为 `qwen-max` / `qwen-turbo`

**本地模型（完全免费离线）**
1. 安装 [Ollama](https://ollama.ai)
2. 拉取模型：`ollama pull qwen2.5:7b`
3. 启动服务：`ollama serve`
4. **必须设置 CORS 环境变量**，否则会报 403：

```powershell
# Windows PowerShell（永久生效）
[System.Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "*", "User")
# 然后重启 Ollama
```

```bash
# macOS / Linux
export OLLAMA_ORIGINS='*'
ollama serve
```

## 📁 项目结构

```
src/
├── background/
│   └── service-worker.ts      # 后台 Service Worker，处理翻译请求与消息路由
├── content/
│   ├── index.ts               # 内容脚本主控制器
│   ├── bilingual.ts           # 双语对照模式
│   ├── hover.ts               # 划词翻译气泡
│   ├── floating-panel.ts      # 页面悬浮操作框（Shadow DOM 隔离）
│   ├── translator.ts          # 翻译调用与公式保护
│   ├── formula-detector.ts    # LaTeX 公式识别
│   ├── ui.ts                  # Toast / 加载条
│   └── styles.css             # 注入样式
├── engines/                   # 翻译引擎适配器（14 个）
│   ├── base-openai.ts         # OpenAI 兼容接口通用基类
│   ├── deepseek.ts
│   ├── openai.ts
│   ├── claude.ts              # Anthropic（独立接口）
│   ├── gemini.ts              # Google Gemini（独立接口）
│   ├── qwen.ts
│   ├── kimi.ts
│   ├── glm.ts
│   ├── minimax.ts
│   ├── grok.ts
│   ├── doubao.ts
│   ├── google.ts
│   ├── deepl.ts
│   ├── baidu.ts
│   └── local.ts               # Ollama 本地模型
├── pdf/
│   ├── PdfViewer.tsx          # PDF 查看器（支持 URL 直链 & 本地文件）
│   ├── pdf-processor.ts       # PDF 解析、段落合并、翻译
│   ├── pdf-exporter.ts        # 导出双语 PDF（Canvas 渲染中文）
│   └── main.tsx
├── popup/                     # 弹窗界面
├── options/                   # 设置页面
├── shared/
│   ├── types.ts               # TypeScript 类型定义
│   └── constants.ts           # 引擎配置、默认设置
└── utils/
    ├── storage.ts             # Chrome Storage 封装（API Key 安全隔离）
    ├── messaging.ts           # Service Worker 消息重试工具
    └── usage.ts               # 使用次数管理
```

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| Vite 5 + CRXJS | Chrome Extension 构建 |
| React 19 + TypeScript | UI 框架 |
| Tailwind CSS v4 | 样式 |
| PDF.js (Mozilla) | PDF 渲染与文本提取 |
| pdf-lib | PDF 文件生成 |
| Shadow DOM | 悬浮面板样式隔离 |
| Chrome Storage API | 设置与数据持久化 |
| Manifest V3 | Chrome 扩展规范 |

## 📄 License

MIT
