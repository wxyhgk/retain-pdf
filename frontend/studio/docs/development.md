# 开发和测试

## 目录

```text
AGENTS.md             给 AI 的总说明：写笔记看 blog/AGENTS.md，改代码看本文
blog/                 文章，每篇一个文件夹（见 docs/README.md）；blog/AGENTS.md 是写作约定（CLAUDE.md 只引入它）
apps/                 小程序：每个一个文件夹（app.json + app.html），在 Studio 的「小程序」页面打开，可放侧栏、悬浮、全屏、新窗口（见 .agents/skills/studio-mini-apps）
.agents/skills/       给 AI 的技能（Claude Code、Codex、pi 都读；.claude/skills 指向这里）
.agents/memory/       AI 记下的作者偏好，只在本机（不进 git）
src/
  pages/ layouts/ components/   博客的页面
  articles/           文章的属性规则、页面树（parent、order）等，博客和 Studio 共用
  studio/             Studio 的前端；main.ts 造出各部分，plugins.ts、plugin-ui.ts 接插件
    wiring/           各项功能怎么用这些部分：页面操作、编辑器里的 AI、AI 问答、资料库、文献库、插件、全局快捷键
    shell/            外壳（左栏、顶栏、右栏的标签），React 画的（见下面「Studio 的外壳」）
      dialogs/        弹窗和 ⌘K 搜索框；ask.ts 是别处打开它们用的
    ui/ lib/          shadcn/ui 的组件和 cn()，外壳用
    windows/          独立窗口（显示方式 › 新窗口）：页面 /studio/window 和它与 Studio 主窗口之间的 BroadcastChannel
    editor/           编辑器（Milkdown）和它的块
    pages/            页面：页面树、页面操作、全部文章、页头属性、反链、目录、审阅条、页面快照
    ai/               AI 面板、AI 回答的显示、模型选择、编辑器里的 AI
    files/            文章的文件、资料库、文件面板（panel/、drive/，两者共用的改名框、拖放、状态行在 shared/）
    panels/           右栏、终端、后台任务、小程序
    common/           提示条、右键菜单、时间、磁盘上的改动
    state/            打开的文章：保存、自动保存、审阅
    api/              和后端说话
    server/           Studio 的后端：api.mjs 是路由和安全检查，routes/ 是各个接口；模块按领域分：
      articles/       文章：读写、文件、发布前检查、git、历史版本、文献库、磁盘监视
      files/ drive/   文章的文件（含回收站）；资料库和它的全文
      ai/             AI 对话（ACP、Studio 里的 pi）、AI 助手和 AI 设置、编辑器里的 AI、识图
      tasks/ apps/    后台任务和 PDF 识别；小程序
      system/         终端、在 Finder 中显示、选文件夹
    ops/              给大模型用的页面操作（见 docs/ai-tools.md）
  studio/serve.mjs         Studio 自己的服务器（Vite）：页面在 studio/page/（render.tsx 画出 /studio、/studio/window）
  plugins/studio-dev.mjs   组装后端（一个 Vite 插件），接口在 studio/server/routes/
packages/             博客和 Studio 共用的包（各有 README）
  markdown/           一篇笔记怎么写：构建、发布前检查、编辑器共用的规则
  science/            化学结构和公式
  compute/            ```job 计算块（xtb、CREST）
  office/             在网页里看 Word、PowerPoint、Excel
  kernel/             插件内核
  i18n/               Studio 的多语言：t('中文原文')，各语言的翻译表在 locales/
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

左栏、顶栏和右栏的标签是 React 19 画的，用 Tailwind 4 和 [shadcn/ui](https://ui.shadcn.com) 的组件，代码在 `src/studio/shell/`；弹窗、右键菜单、AI 面板、页头、页面树、文件面板和资料库也是。编辑器和终端还是原来的写法，直接操作 DOM。这三样只在 Studio 的服务器里加载（`src/studio/serve.mjs`），构建的博客里没有。

- **两边怎么说话**：外壳显示什么，看 `shell/shell-state.ts` 里的状态，别的部分用 `shell.set({...})` 改它（比如 `shell/top-bar.ts` 设保存状态）。外壳上的按钮调用 `main.ts` 交给 `mountShell` 的那些函数。
- **外壳里的「宿主」元素**：React 画出元素，内容由原来的代码填，比如页面树 `#article-list`、插件命令 `#plugin-commands`。这种元素要加 `data-host`，React 从不往里面画。元素的 id 不变，原来的代码和测试照样能找到。
- **样式只管外壳**：Tailwind 的工具类和重置样式只作用在 `[data-ui]` 里面，`[data-host]` 里面除外（`shell/shell.css` 用 `@scope`）；编辑器和文章的 CSS 不受影响。颜色用 `global.css` 的黑白灰，暗色跟着 `html[data-theme='dark']` 切换。
- **加 shadcn 组件**：`npx shadcn@latest add dialog`，组件放进 `src/studio/ui/`。CLI 认不出 `@studio/lib/utils` 这个别名，会去装一个叫 `cn` 的 npm 包：装完卸掉这个包，再把组件里的 `from "cn"` 改成 `from "@studio/lib/utils"`。弹出层（Dialog、菜单）要放进带 `data-ui` 的容器里，否则没有样式。

## 多语言

Studio 的界面、提示和服务器返回给界面的话，都已经交给 `t()`，可以换成别的语言。语言在左栏底部菜单的「设置 › 语言」里选，默认跟随系统，存在本机的 `.studio-settings.json`。现在只有中文一种。

- **写法**：代码里直接写中文，交给 `t()`：`t('已移动到 {path}', { path })`（`@blog/i18n/index.mjs`）。参数用 `{名字}`，不要用模板字符串拼。中文就是原文，不需要翻译表；别的语言是 `packages/i18n/locales/<语言>.json`，从中文原文对到译文，在 `locales/index.mjs` 里登记。表里没有的句子照样显示中文。
- **不要翻译的中文**：写进文章的内容（标题、图注、参考文献）、匹配用的正则、给 AI 的提示词。在这一行加注释 `i18n-ignore`。
- **页面**：服务器按设置（或浏览器的语言）定下语言，写在 `<html lang data-studio-locale>` 上；`main.ts` 第一个导入 `locale.ts` 设好语言，后面模块里的文字才会用这个语言。页面每个请求都带一个 `studio-locale` cookie。
- **服务器**：`api.mjs` 在请求自己的语言里处理它（`@blog/i18n/server.mjs`，AsyncLocalStorage），所以 `t()` 要在处理请求时调用，不要在模块顶层先算好。
- **检查**：`packages/i18n/test/i18n.test.ts` 检查 Studio 的代码（`src/studio`、`src/plugins`、`plugins`、`packages`）里没有漏掉的中文：要么交给 `t()`，要么标 `i18n-ignore`。

## 命令

| 命令 | 作用 |
|---|---|
| `npm run studio:serve` | Studio 的服务器，<http://localhost:4321/studio>（被占着就用下一个端口） |
| `npm run dev` | 博客的开发服务器（Astro），Studio 占着 4321 时用下一个端口 |
| `npm run build` | 构建博客到 `dist/` |
| `npm test` | 单元测试和后端测试 |
| `npm run test:unit` | 单元测试（`tests/`、`packages/*/test/`、`plugins/*/test/`） |
| `npm run test:server` | Studio 后端的测试 |
| `npm run test:terminal` | 终端后台程序的测试（Rust） |
| `npm run studio -- <命令>` | 页面操作的命令行（见 docs/ai-tools.md） |
| `npm run i18n:strings` | 列出要翻译的文字；`-- --left` 列出还没交给 `t()` 的中文，`-- --locale en` 更新英文的翻译表 |

## 浏览器测试

浏览器测试会自己起一个 Studio 服务器（端口 4400），用的是测试文章的副本和一个临时的项目根目录，不碰 `blog/`，也不碰你在 4321 上开着的服务器：

```sh
E2E_ISOLATED=1 npx playwright test -c tests/e2e/playwright.config.ts
```

- 只跑一个文件：在后面加文件名，比如 `tests/e2e/page-tree.spec.ts`；只跑名字里有某些字的测试：加 `-g "关键字"`。
- 默认同时开几个测试服务器（核数的六成，最多 6 个：端口 4400、4420、4440……），各用各的文件夹，测试文件分给它们跑。这台 10 核的机器开 6 个，全部跑一遍大约 4 分半钟。`E2E_WORKERS=n` 自己定几个。改代码时只跑相关的文件，提交前再全部跑一遍。
- 浏览器是 Playwright 自带的无头 Chromium，不是系统里的 Chrome：Google Chrome 启动时会带起自动更新和崩溃上报程序，它们在浏览器关掉后还占着它的输出好几分钟，测试进程要等它们，三个并行时一轮多等了十几分钟。缓存里没有这个 Playwright 要的那一版时，用缓存里最接近的一版（`~/Library/Caches/ms-playwright`），不会去下载。`E2E_CHROME_CHANNEL=chrome` 换回系统的 Chrome。
- WebKit（Mac 应用用的浏览器）：`E2E_CHROME_CHANNEL= … --browser=webkit`。
- 失败的测试默认只留截图。要 trace（能逐步回看的记录）加 `E2E_TRACE=1`：它存下页面加载的每个模块，每次失败要多写一分钟左右。
- 测试服务器和你自己的有两处不同：编辑器（Milkdown 的 fork）预先打成包（`STUDIO_MILKDOWN_BUNDLED=1`，见 `src/plugins/milkdown-source.mjs`），一页从一千多个请求降到四百个；终端的 zsh 不读你的 `~/.zshrc` 这些（`ZDOTDIR` 指向空文件夹），启动快，各台机器一样。
- 同一组端口上同时只能跑一轮：第二轮会直接报错，不会去清空第一轮正在用的文件夹。要同时跑，用 `E2E_PORT` 换一组端口。

测试服务器和 Studio.app 用的是同一个服务器（`startStudio`）。

**博客的 `astro dev` 同一个根目录上只开一个**：两个会同时写 `.astro/data-store.json`，互相弄坏。Studio 的服务器不碰 `.astro/`，和一个 `astro dev` 可以同时开（Studio 要看博客时自己就会开一个，见下面）。

## Studio 的服务器

`src/studio/serve.mjs`：一个 Vite 开发服务器，只有 Studio 的东西。

- 页面：`/studio` 和 `/studio/window` 由 `src/studio/page/render.tsx` 在服务器上画（外壳先画一遍，页面的脚本接着画）；样式按它列的顺序放进页面，每个都是 `<style data-vite-dev-id>` 加它的模块（和 Astro 开发时一样）：脚本里再引入同一个样式表（编辑器引入 Crepe 的）时改的是原来那个，顺序不乱，改了样式马上生效。
- 后端：`src/plugins/studio-dev.mjs`（组装各个模块、接口、小程序和文章的文件）。
- 依赖：启动时从 `src/studio/**/*.tsx` 找出来预先打包（和 Astro 一样），样式表不算依赖。
- 它在跑时把进程号和地址写进 `.studio-cache/server.json`；Studio.app 和 `studio` 命令从这里找到它。Studio.app 起的服务器，输出在 `.studio-cache/server.log`（上一次的在 `server.previous.log`），每次意外退出记进 `.studio-cache/server-exits.log`。
- 默认端口 4321，被占着就用下一个空着的。
- 博客（`astro dev`）里没有 Studio 了：`astro.config.mjs` 只有博客自己的东西；开发时文章的文件 `/article-assets/…` 由 `src/plugins/article-assets.mjs` 提供（以前是 Studio 的插件顺带提供的）。
- 博客的页面（`/blog/…`、`/wiki/…`、`/about`……）不归它：交给博客自己的 `astro dev`，开着就用（`.astro/dev.json`），没开就在下一个端口替你开一个、跟着 Studio 的服务器停（`blogPreview`，输出在 `.studio-cache/blog.log`），请求等它起来后跳过去。

## Studio 的接口

Studio 的前端通过 `/api/studio/*` 和后端说话，这些接口只接受本机的请求，也只接受本机页面发来的请求。它们是给 Studio 自己用的，没有承诺稳定；程序和 AI 要操作页面，请用 [studio 命令或 MCP 服务](ai-tools.md)，它们直接调用同样的后端模块。

接口按领域分在 `src/studio/server/routes/` 里（文章、文章的文件、资料库、AI、后台任务和小程序、插件），每个文件用 `api.get('/articles/:slug', …)` 这样登记。安全检查都在 `src/studio/server/api.mjs` 里统一做，登记的接口不用自己管：
- 只接受本机的请求；
- 只接受 Studio 自己页面发来的请求；
- POST、PUT 必须声明请求类型：默认是 JSON，上传文件的接口登记时写 `{ body: 'application/octet-stream' }`。

`src/plugins/studio-dev.mjs` 只负责把各个后端模块组装起来，再把请求交给这个路由。

## 最小启动：怎么改都能打开

不管插件、小程序、设置、甚至 Studio 自己的代码被改成什么样，Studio 都要能打开、能写文章。

- **插件**：每个插件的 `studio.ts` 单独载入（`src/studio/plugins.ts`）：有语法错误、一载入就出错、8 秒没载入完的，只算它自己没启动，说明原因，Studio 和别的插件照常。服务器和构建这边（`packages/kernel`）同样：`server.mjs`、`build.mjs` 载入或 `apply` 超过 10 秒算失败；某个块在构建时出错，只把那个块留成代码，并在发布前检查里说出来。
- **安全模式**：地址加 `?safe`，一个插件都不载入，顶上一条说明，按「正常启动」回去。前两次都没启动完（5 分钟内），下次自动进安全模式（`src/studio/safe-mode.ts`）。
- **Studio 自己的代码改坏了**：Studio 每次启动完（文章显示出来）告诉服务器（`POST /api/studio/started`），服务器在代码都已提交时把当前提交记成「上次能正常启动的版本」（`.studio-cache/last-good.json`，`src/studio/server/system/last-good.mjs`）。Studio.app 打开 Studio 后等它说启动完，两分半没等到、或者服务器起不来，就在起始页给出「用上次能正常启动的版本打开」：把那个提交检出到 `.studio-cache/rescue`（git worktree），`blog`、`apps`、`chats`、设置、回收站、`node_modules` 链到真的，在那里以安全模式启动（`STUDIO_RESCUE=1`，`?safe=rescue`）。在里面写的文章就是真的文章；改坏的代码原样留着，修好后关掉 Studio 再打开。
- 所以改 Studio 的代码时：改完跑测试再提交；没提交的改动不会被记成能用的版本。

## Studio.app 里才有的问题

浏览器测试（Chrome、Playwright 的 WebKit）里好好的，到 Studio.app（Tauri 外壳，WebKit 的 WKWebView）里不行的事，下面三件都是真碰到过的。

**先查记录，不要猜。** 真机上的窗口看不到，猜了改、改了再猜，往返好几轮也找不到原因；有记录就一次找到：

- 服务器为什么停：Studio.app 把每次退出写进 `.studio-cache/server-exits.log`（时间、退出码或信号、服务器最后几行输出、当时在跑的程序），上一次的完整输出在 `.studio-cache/server.previous.log`。（旧版本用 `astro dev` 时记在 `.astro/dev-exits.log`、`.astro/dev.previous.log`。）
- 页面里发生了什么：页面可以把要查的每一步用 `keepNote`（`src/studio/api/client.ts`）记进 `.studio-cache/studio-notes.log`。文章区被撑宽（底部出横向滚动条）时，`src/studio/pages/overflow-watch.ts` 会自己记下是谁伸出去了。
- 再拿时间去对 AI 的会话记录（`~/.pi/agent/sessions/`、`~/.claude/projects/`），常常能精确到秒。

**1. 服务器隔一会儿就断（2026-10-28，`467ed4a`）**

- 现象：用着用着服务器停了，退出记录（当时是 `.astro/dev-exits.log`）记的是被 SIGTERM 停掉。
- 原因：Studio.app 用 `node --import <看守>` 启动服务器，看守在 Studio.app 退出（标准输入关上）时停掉服务器。`--import` 在**每个 worker 线程**里也会跑一遍；worker 线程没有标准输入，一开始就关着，看守就以为 Studio.app 走了。pi 跑在服务器进程里，看图片时开 worker 线程缩放图片，所以每次看图就断（两次断开都和 pi 读图片在同一秒）。
- 修法：看守只在主线程里做事（`isMainThread`）。**用 `--import`、`--require` 注入的代码都要先判断是不是主线程。** Rust 测试 `a_worker_thread_does_not_stop_the_server` 管着。

**2. 拖右栏宽度非常卡（2026-10-28，`00f3691`）**

- 现象：有公式的长文章里，拖一步要半秒。
- 原因：拖动时每一步都改最外层 `.studio-shell` 上的 CSS 变量 `--panel-width`。CSS 变量会被继承，改它要把页面上每个元素的样式重算；一个公式由几十个小块组成，一篇文章几千个元素。不是 ResizeObserver，也不主要是排版（逐个隐藏代码块、表格、公式量出来的）。
- 修法：拖动时改不会被继承的 `grid-template-columns`，松手再改一次变量；中间文章拖动时固定宽度、单独排版（`contain: strict`），松手排一次；公式等宽度停下 150 毫秒再适配。**拖动、动画的每一帧都不要改大祖先元素上的 CSS 变量。**
- 量法：WebKit 里用 requestAnimationFrame 记每帧间隔，按下、拖动、松开分开看。

**3. 独立窗口放回 Studio 后关不掉（2026-10-28，`c89b279`）**

- 现象：AI 或小程序用「显示方式 › 新窗口」拿出去后，在那个窗口里选侧栏、悬浮、全屏，主窗口里已经放回去了，那个窗口却还在。
- 原因：网页只能关掉它自己用脚本打开的窗口，独立窗口是 Studio.app 开的。更坑的是，在 Tauri 开的窗口里调 `window.close()`，WebKit 当作已经关了（`window.closed` 变成 true），窗口其实还在（wry 没处理 WebKit 的关窗回调）；代码看到「已关」，后面的办法就都没走。记录里一眼看出：「Studio 已经放回 side」之后只有「先 window.close()」，再没有下文。
- 修法：在 Studio.app 的窗口里（`'__TAURI_INTERNALS__' in window`）不调 `window.close()`，把标题改成 `studio:close`，Studio.app 的 `on_document_title_changed` 看到就关（`tools/studio-app/src/main.rs`）；跳到 `studio-action://close` 作后备。浏览器里的弹出窗口照常 `window.close()`。**在 Studio.app 里别信 `window.close()` 和 `window.closed`。**

## 插件

计算任务、分子查看器、书签、字数统计等都是插件，放在 `plugins/` 下面。怎么写插件、插件能用哪些服务，见 [plugins/README.md](../plugins/README.md)。
