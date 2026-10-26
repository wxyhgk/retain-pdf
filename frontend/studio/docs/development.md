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
  studio/             Studio 的前端；main.ts 把各部分接起来，plugins.ts、plugin-ui.ts 接插件
    shell/            外壳（左栏、顶栏、右栏的标签），React 画的（见下面「Studio 的外壳」）
      dialogs/        弹窗和 ⌘K 搜索框；ask.ts 是别处打开它们用的
    ui/ lib/          shadcn/ui 的组件和 cn()，外壳用
    editor/           编辑器（Milkdown）和它的块
    pages/            页面：页面树、页面操作、全部文章、页头属性、反链、目录、审阅条、页面快照
    ai/               AI 面板、AI 回答的显示、模型选择、编辑器里的 AI
    files/            文章的文件、资料库、文件面板
    panels/           右栏、终端、后台任务、小程序
    common/           提示条、右键菜单、时间、磁盘上的改动
    state/            打开的文章：保存、自动保存、审阅
    document/ api/    Markdown 文档的读写；和后端说话
    server/           Studio 的后端：api.mjs 是路由和安全检查，routes/ 是各个接口；模块按领域分：
      articles/       文章：读写、文件、发布前检查、git、历史版本、文献库、磁盘监视
      files/ drive/   文章的文件（含回收站）；资料库和它的全文
      ai/             AI 对话（ACP、Studio 里的 pi）、AI 助手和 AI 设置、编辑器里的 AI、识图
      tasks/ apps/    后台任务和 PDF 识别；小程序
      system/         终端、在 Finder 中显示、选文件夹
    ops/              给大模型用的页面操作（见 docs/ai-tools.md）
  plugins/studio-dev.mjs   把 Studio 挂到 astro dev 上：组装后端，接口在 studio/server/routes/
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

## Studio 的外壳

左栏、顶栏和右栏的标签是 React 19 画的，用 Tailwind 4 和 [shadcn/ui](https://ui.shadcn.com) 的组件，代码在 `src/studio/shell/`。编辑器、页面树、文件、终端、AI 面板还是原来的写法，直接操作 DOM。这三样只在 `astro dev` 里加载（`astro.config.mjs` 的 `studioPage`），构建的博客里没有。

- **两边怎么说话**：外壳显示什么，看 `shell/shell-state.ts` 里的状态，别的部分用 `shell.set({...})` 改它（比如 `shell/top-bar.ts` 设保存状态）。外壳上的按钮调用 `main.ts` 交给 `mountShell` 的那些函数。
- **外壳里的「宿主」元素**：React 画出元素，内容由原来的代码填，比如页面树 `#article-list`、插件命令 `#plugin-commands`。这种元素要加 `data-host`，React 从不往里面画。元素的 id 不变，原来的代码和测试照样能找到。
- **样式只管外壳**：Tailwind 的工具类和重置样式只作用在 `[data-ui]` 里面，`[data-host]` 里面除外（`shell/shell.css` 用 `@scope`）；编辑器和文章的 CSS 不受影响。颜色用 `global.css` 的黑白灰，暗色跟着 `html[data-theme='dark']` 切换。
- **加 shadcn 组件**：`npx shadcn@latest add dialog`，组件放进 `src/studio/ui/`。CLI 认不出 `@studio/lib/utils` 这个别名，会去装一个叫 `cn` 的 npm 包：装完卸掉这个包，再把组件里的 `from "cn"` 改成 `from "@studio/lib/utils"`。弹出层（Dialog、菜单）要放进带 `data-ui` 的容器里，否则没有样式。

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

接口按领域分在 `src/studio/server/routes/` 里（文章、文章的文件、资料库、AI、后台任务和小程序、插件），每个文件用 `api.get('/articles/:slug', …)` 这样登记。安全检查都在 `src/studio/server/api.mjs` 里统一做，登记的接口不用自己管：
- 只接受本机的请求；
- 只接受 Studio 自己页面发来的请求；
- POST、PUT 必须声明请求类型：默认是 JSON，上传文件的接口登记时写 `{ body: 'application/octet-stream' }`。

`src/plugins/studio-dev.mjs` 只负责把各个后端模块组装起来，再把请求交给这个路由。

## 插件

计算任务、分子查看器、书签、字数统计等都是插件，放在 `plugins/` 下面。怎么写插件、插件能用哪些服务，见 [plugins/README.md](../plugins/README.md)。
