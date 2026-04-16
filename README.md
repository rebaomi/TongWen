# 🎓 ScholarLens — AI 学术翻译 Chrome 插件

专注于网页翻译与学术 PDF 翻译，智能识别并保留数学公式与参考文献格式。

## ✨ 功能特性

### 网页翻译
| 模式 | 描述 |
|------|------|
| 📖 双语对照 | 原文下方插入译文，保留原版式 |
| 🔄 全文替换 | 直接替换页面文本为译文 |
| 🖱️ 悬浮翻译 | 划词即时显示翻译气泡 |

- **快捷键**：`Alt+T` 翻译当前页，`Alt+M` 切换模式
- **右键菜单**：支持翻译选中文字、整页、链接

### PDF 翻译（专为学术论文优化）
- 📐 **自动识别并保留 LaTeX 数学公式**（$...$、$$...$$、\begin{} 环境）
- 📖 **保留参考文献引用标记**（[1]、(Author 2020) 等）
- 🖼️ **在线预览**：原始 PDF 渲染 + 双语译文对照
- 📥 **导出双语 PDF**：原文 + 译文交替排列
- 支持拖拽上传、URL 参数打开

### 多引擎支持
| 引擎 | 特点 |
|------|------|
| 🚀 DeepSeek | 中文理解极佳，成本最低（推荐） |
| ✨ OpenAI GPT | 综合质量最高，上下文感知 |
| 🌐 Google 翻译 | 速度快，语言覆盖广 |
| 🔵 DeepL | 欧洲语言翻译质量最佳 |
| 🔴 百度翻译 | 国内访问稳定 |
| 💻 本地模型 | 完全离线，基于 Ollama |

### 免费 vs Pro
| | 免费版 | Pro 版 |
|--|--------|--------|
| 每日次数 | 5 次 | 无限 |
| 翻译引擎 | 全部支持 | 全部支持 |
| PDF 翻译 | ✓ | ✓ |
| 导出双语 PDF | ✓ | ✓ |
| 批量处理 | — | ✓ |
| 客服支持 | — | 优先 |

## 🚀 快速开始

### 安装开发环境

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 加载到 Chrome

1. 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `dist/` 目录

## 🔧 配置说明

首次使用请点击插件图标 → 右上角 ⚙️ → 进入设置页面配置 API 密钥。

### DeepSeek（推荐）
1. 访问 [platform.deepseek.com](https://platform.deepseek.com) 注册账号
2. 创建 API Key
3. 在设置页面填入即可

### 本地模型（完全免费离线）
1. 安装 [Ollama](https://ollama.ai)
2. 运行 `ollama pull qwen2.5:7b`
3. 启动 `ollama serve`
4. 插件设置中启用「本地模型」即可

## 📁 项目结构

```
src/
├── background/          # Service Worker（后台进程）
│   └── service-worker.ts
├── content/             # 内容脚本（注入到网页）
│   ├── index.ts         # 主控制器
│   ├── bilingual.ts     # 双语对照模式
│   ├── hover.ts         # 悬浮翻译模式
│   ├── translator.ts    # 翻译调用
│   ├── formula-detector.ts  # 公式识别
│   ├── ui.ts            # Toast / 加载条
│   └── styles.css       # 注入样式
├── engines/             # 翻译引擎适配器
│   ├── google.ts
│   ├── deepl.ts
│   ├── deepseek.ts
│   ├── openai.ts
│   ├── baidu.ts
│   └── local.ts
├── pdf/                 # PDF 翻译模块
│   ├── PdfViewer.tsx    # PDF 查看器 React 组件
│   ├── pdf-processor.ts # PDF 解析与翻译
│   ├── pdf-exporter.ts  # 导出双语 PDF
│   └── main.tsx
├── popup/               # 弹窗界面
│   ├── App.tsx
│   └── main.tsx
├── options/             # 设置页面
│   ├── App.tsx
│   └── main.tsx
├── shared/              # 共享类型与常量
│   ├── types.ts
│   └── constants.ts
└── utils/               # 工具函数
    ├── storage.ts       # Chrome Storage 封装
    └── usage.ts         # 使用次数管理
```

## 🛠️ 技术栈

- **构建**：Vite + CRXJS（Chrome Extension 专用）
- **框架**：React 19 + TypeScript
- **样式**：Tailwind CSS v4
- **PDF 解析**：PDF.js (Mozilla)
- **PDF 生成**：pdf-lib
- **状态**：Chrome Storage API
- **扩展标准**：Manifest V3
