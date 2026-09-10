# RetainPDF Web 主站

`frontend/web` 是当前生产 Web 前端。它是由三个静态 HTML 入口组成的 MPA，构建后可直接由静态文件服务器或桌面宿主加载。

| 页面 | HTML | React 入口 | 构建产物 |
|------|------|------------|----------|
| 主页 | `index.html` | `src/app/home/entry.tsx` | `dist/app.bundle.js` |
| 任务详情 | `detail.html` | `src/app/detail/entry.tsx` | `dist/detail.bundle.js` |
| PDF 阅读器 | `reader.html` | `src/app/reader/entry.tsx` | `dist/reader.bundle.js` |

CSS 按页面分别构建到 `dist/css/{home,detail,reader}.css`。HTML 引用的查询参数由构建脚本按内容哈希更新。

## 目录

| 目录 | 说明 |
|------|------|
| `src/app` | 装配层：三页入口、主页 composition、页面外壳、桌面首启 |
| `src/features` | 15 个产品功能，每个内部分 `ui/` 与 `domain/`，`index.ts` 是唯一出口 |
| `src/platform` | 跨功能基础设施：API 网关、配置、契约、store 框架、mock、导航 |
| `src/ui` | 共享 UI 组件与 React 原语（shadcn 生成物、hooks、主题、装饰） |
| `src/styles` | home/detail 样式以及 Reader 样式代理入口 |
| `scripts` | JS/CSS 构建、静态服务器、smoke 与视觉检查 |
| `tests` | Node 单测、架构/契约门禁和视觉基线 |

`src/` 的四层结构、依赖方向与门禁清单见 [`src/FEATURES.md`](src/FEATURES.md)。

阅读器的组件、hooks、PDF 逻辑和样式真值位于 `frontend/packages/reader`。`frontend/web` 只通过 `@retainpdf/reader` 的公开 exports 使用它，并注入 RetainPDF 的 API、凭据、收藏、下载和 AI 能力。边界见 [`src/app/reader/README.md`](src/app/reader/README.md)。

## 弹窗 UI 契约

主页与任务详情页的普通弹窗必须使用 `src/ui/components/dialog.tsx`；危险操作确认使用 `src/ui/components/confirm-dialog.tsx`，不得调用浏览器 `alert/confirm/prompt`。共享层统一负责遮罩、居中、纸面壳、28px 圆角、标题/正文/页脚、关闭按钮、动画、焦点与嵌套层级；业务组件只选择 `compact`、`standard`、`wide`、`workspace` 尺寸并实现内部内容。

筛选菜单、范围选择器、Toast 等非模态浮层使用 `app-floating-surface` / `app-floating-close` 的 18px 纸面浮层语言。全屏 Reader 宿主是独立 surface，不套普通弹窗尺寸；Reader 内部浮层由包内同名职责契约维护。

业务 feature 不得直接导入 Radix Dialog；`tests/architecture/architecture-boundaries.test.mjs` 会阻止绕开共享边界或重新引入浏览器阻塞式确认框。

“添加 PDF”使用 `standard` 尺寸和单一上传入口：文件上传完成后，在同一动作区选择“仅收藏”“仅 OCR”或“翻译”。页码范围与术语表作为主弹窗内的可展开翻译选项，不再打开第二层弹窗。

## 与 `frontend/web-react`

`frontend/web-react` 是独立的 Vite 迁移/实验工作区，开发端口为 40002；它不是 `frontend/web` 的生产入口。日常主站开发、测试和发版以本目录为准。

## 常用命令

从仓库根目录运行：

```bash
npm run build:web
npm run test:web
npm --prefix frontend/web run typecheck
```

也可以在本目录运行：

```bash
npm run build            # workspace packages + vendor + version + CSS + JS + cache stamp
npm run build:js
npm run build:css
npm run typecheck
npm test
python3 scripts/serve_static.py --host 127.0.0.1 --port 40001 --root .
```

真实浏览器视觉检查是独立门禁：

```bash
npm run visual:check
```

运行时配置由 `runtime-config.js` 提供默认值；本机覆盖写入被 Git 忽略的 `runtime-config.local.js`，可从 `runtime-config.local.example.js` 开始。不要提交 API Key 或供应商凭据。

AI Agent 的模型 Key / FX Gateway Key 通过“设置 → API 设置 → AI Agent”一次性
提交到本机后端，前端不持久化也不回填原文；后端只返回掩码和运行模式。该入口
与 `runtime-config.js` 中用于前端访问本机 Rust API 的 `xApiKey` 不是同一种
凭据。运行模式分为 Markdown 检索问答、OpenAI 兼容 Agent 与 FX Gateway Agent：
前两者使用模型 URL、模型名和模型 Key，FX 模式检查 Gateway Key，并可配置独立
Gateway URL。FX 0.0.5 的自定义 URL 仅支持带端口的回环 HTTP 地址；留空使用
官方 Gateway，远程域名、局域网 IP 或 HTTPS 地址应使用 OpenAI 兼容 Agent。

PDF 翻译支持在“设置 → API 设置 → 翻译 API”中填写第三方 OpenAI 兼容接口的
API URL、模型名称和 API Key。连通性检测使用该服务的 `/models` 端点；余额
查询仅适用于 DeepSeek 官方接口。

## 相关文档

| 文件 | 内容 |
|------|------|
| [`src/FEATURES.md`](src/FEATURES.md) | 页面、领域层与装配边界 |
| [`src/app/home/composition/README.md`](src/app/home/composition/README.md) | 主页接线规则 |
| [`src/app/reader/README.md`](src/app/reader/README.md) | Reader 包与 Web 宿主边界 |
| [`src/app/detail/README.md`](src/app/detail/README.md) | 详情页职责 |
| [`src/styles/README.md`](src/styles/README.md) | 三页 CSS 构建与归属 |
| [`tests/README.md`](tests/README.md) | 测试命令与测试边界 |
