# 开发和测试

## 目录

```text
AGENTS.md             给 AI 的总说明：写笔记看 blog/AGENTS.md，改代码看本文
blog/                 文章，每篇一个文件夹（见 docs/README.md）；blog/AGENTS.md 是写作约定（CLAUDE.md 只引入它）
apps/                 小程序：每个一个文件夹（app.json + app.html），在 Studio 里以悬浮窗打开（见 .agents/skills/studio-mini-apps）
.agents/skills/       给 AI 的技能（Claude Code、Codex、pi 都读；.claude/skills 指向这里）
.agents/memory/       AI 记下的作者偏好，只在本机（不进 git）
src/
  pages/ layouts/ components/   博客的页面
  articles/           文章的属性规则、页面树（parent、order）等，博客和 Studio 共用
  studio/             Studio 的前端（编辑器、侧边栏、面板）
    server/           Studio 的后端：读写文章、回收站、历史版本、git、资料库、终端
    ops/              给大模型用的页面操作（见 docs/ai-tools.md）
  plugins/studio-dev.mjs   把 Studio 挂到 astro dev 上：/studio 页面和 /api/studio/* 接口
packages/             博客和 Studio 共用的包（各有 README）
  markdown/           一篇笔记怎么写：构建、发布前检查、编辑器共用的规则
  science/            化学结构和公式
  compute/            ```job 计算块（xtb、CREST）
  office/             在网页里看 Word、PowerPoint、Excel
  kernel/             插件内核
  ui/                 共用的页面部件
plugins/              插件：计算任务、分子、书签……（见 plugins/README.md）
bin/                  studio 命令和 MCP 服务
tools/studio-terminal/    Studio 终端的后台程序（Rust）
tools/studio-app/         Studio 的 Mac 应用（Rust、Tauri）：起服务器、开窗口；网页里的 alert/confirm/prompt 由它显示成系统对话框
third_party/milkdown/     编辑器 Milkdown 的 fork（git submodule）
tests/                单元测试；tests/e2e/ 浏览器测试
```

## 编辑器

Studio 的编辑器用 `third_party/milkdown`：一个 git submodule，来自 fork `wxyhgk/milkdown` 的 `studio` 分支。dev 时直接用它的源码，改了保存就生效，不用构建。第一次要拉取：

```sh
npm run milkdown:setup
```

Studio 用到了只有 fork 里才有的扩展，`src/studio/editor/milkdown-fork.d.ts` 列出了它们。发布的博客不含编辑器。

改编辑器时注意别让长文章变慢：几十万字的文章是分段显示的，公式到屏幕附近才画，要在 WebKit 里测。见 [超长文章：开发记录](long-articles.md)。

## 命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 本机开发服务器，博客在 <http://localhost:4321>，Studio 在 `/studio` |
| `npm run build` | 构建博客到 `dist/` |
| `npm test` | 单元测试和后端测试 |
| `npm run test:unit` | 单元测试（`tests/`、`packages/*/test/`、`plugins/*/test/`） |
| `npm run test:server` | Studio 后端的测试 |
| `npm run test:terminal` | 终端后台程序的测试（Rust） |
| `npm run studio -- <命令>` | 页面操作的命令行（见 docs/ai-tools.md） |

## 浏览器测试

浏览器测试会自己起一个 Studio 服务器（端口 4400），用的是测试文章的副本和一个临时的项目根目录，不碰 `blog/`，也不碰你在 4321 上开着的服务器：

```sh
E2E_ISOLATED=1 npx playwright test -c tests/e2e/playwright.config.ts
```

- 只跑一个文件：在后面加文件名，比如 `tests/e2e/page-tree.spec.ts`；只跑名字里有某些字的测试：加 `-g "关键字"`。
- 全部跑一遍大约 8 到 10 分钟。改代码时只跑相关的文件，提交前再全部跑一遍。
- `E2E_WORKERS=3`：同时开三个测试服务器（端口 4400、4420、4440），各用各的文件夹，测试文件分给它们跑。机器空闲时更快；开着别的服务器、机器忙的时候反而更慢，所以默认是一个。
- 用的是系统里装的 Chrome，不用另外下载浏览器。

**不要在仓库根目录上再开第二个 `astro dev`**：两个服务器会同时写 `.astro/data-store.json`，互相弄坏。测试、预览都用上面这种独立的根目录。

## Studio 的接口

Studio 的前端通过 `/api/studio/*` 和后端说话，这些接口只接受本机的请求，也只接受本机页面发来的请求。它们是给 Studio 自己用的，没有承诺稳定；程序和 AI 要操作页面，请用 [studio 命令或 MCP 服务](ai-tools.md)，它们直接调用同样的后端模块。

## 插件

计算任务、分子查看器、书签、字数统计等都是插件，放在 `plugins/` 下面。怎么写插件、插件能用哪些服务，见 [plugins/README.md](../plugins/README.md)。
