# Studio

RetainPDF 的笔记软件（2026-11-02 从单独的 notes-studio 仓库搬进 `frontend/studio`）。一个在本机写计算化学笔记的工具，像 Notion：文章是普通的 Markdown 文件夹，Studio 用来写、整理、算、让 AI 帮忙。公式、分子结构、计算任务（xtb、CREST）、Gaussian/ORCA 输出、数据库、小程序都能放进笔记里。

代码在这个文件夹（`frontend/studio`），**笔记在另一个文件夹**（你自己的，比如一个 git 仓库）：Studio 打开那个文件夹，读写里面的 `blog/`。

## 准备

- Node.js 22.12 或更新（npm 自带）
- [pnpm](https://pnpm.io)：编辑器（Milkdown 的 fork）要用
- Rust（`cargo`）：Studio 的终端，以及 Mac 应用（`tools/studio-app`）
- 浏览器测试：`npx playwright install chromium webkit`
- 可选：Xcode（iPad 应用，`tools/studio-ipad`）；AI 功能要装 Claude Code、Codex 或 pi，或者在 Studio 里填 API key

## 第一次

```sh
git clone --recurse-submodules https://github.com/wxyhgk/retain-pdf.git
cd retain-pdf/frontend/studio
npm ci                        # Studio 自己一套依赖，不在仓库根目录的 npm workspaces 里
npm run milkdown:setup        # 编辑器：拉取 submodule、安装、生成它的样式
npm run terminal:build        # 终端的后台程序（Rust）
```

告诉 Studio 笔记在哪里：在这个文件夹（`frontend/studio`）建 `.studio-local.json`（只在本机，不进 git）：

```json
{ "notes": "../my-notes" }
```

路径可以是相对这个文件夹的，也可以是完整路径；也可以用环境变量 `STUDIO_NOTES_DIR`。笔记文件夹里放：

```text
my-notes/
├── blog/          文章，每篇一个文件夹（index.md、img/、assets/）
├── apps/          你自己的小程序（Studio 自带的在这个文件夹的 apps/）
├── templates/     页面模板
├── AGENTS.md …    给 AI 的写作约定、技能（.agents/skills/），AI 在这里干活时读
└── chats/ repos/ .studio-settings.json …   Studio 自己生成，别提交
```

没写 `.studio-local.json` 时，笔记就在这个文件夹里（`blog/` 等已在 `.gitignore`）。

## 运行和测试

```sh
npm run studio:serve          # http://localhost:4321/studio
npm test                      # 单元测试和后端测试
E2E_ISOLATED=1 npx playwright test -c tests/e2e/playwright.config.ts   # 浏览器测试（自己起服务器，不碰你的笔记）
npx tsc --noEmit -p .         # 类型检查
```

## 文档

- [Studio 怎么用](docs/studio.md)
- [开发和测试](docs/development.md)：目录结构、怎么跑测试、各部分怎么接起来
- [给大模型用的接口](docs/ai-tools.md)：`studio` 命令和 MCP 服务
- [插件](plugins/README.md)
- [超长文章](docs/long-articles.md)：改编辑器时要守的性能规矩
