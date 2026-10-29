---
name: studio-mini-apps
description: 作者要一个小工具、小程序、小应用（单位换算、输入文件生成器、查数据库、批量处理文件、用 React/TypeScript 写的编辑器……）在 Studio 里用时，用这个做成「小程序」：仓库根目录 apps/ 下的一个文件夹，在 Studio 里以悬浮窗打开；可以是一页网页，也可以是带 npm 包和后端的完整项目。
---

# 做一个小程序

小程序是 Studio 里的工具：左侧「小程序」是一整页，每个小程序一张卡片（能搜），点开整页使用，也能「弹出」成悬浮窗口边写文章边用。它只给作者自己用，不随文章发布；要放进文章、随文章发布的交互内容，用交互模块（技能 `notes-widgets`）。

## 从哪开始

作者在 Studio 的「小程序」页面点「新建小程序」（或 ⌘K 输入 `> 新建小程序`），起个名字、选模板，Studio 就建好文件夹，打开它，再把「做小程序……我想要：」放进 AI 面板，作者说完要什么交给你。模板有两个：

- **一页网页**：`app.json` + `app.html`。
- **React + TypeScript 项目**：`app.json`（带 `dev`）、`index.html`、`vite.config.ts`、`src/main.tsx`、`src/App.tsx`、`src/studio.d.ts`（`window.studio` 的类型）。它用仓库根目录已有的 React 和 Vite，建好就能跑；要别的 npm 包，在它自己的文件夹里 `npm install`。

作者没点新建、直接让你做时，你自己照下面建文件夹也一样。

## 放在哪、有哪些文件

仓库根目录 `apps/<名字>/`，名字用小写英文和连字符（如 `energy-units`）：

| 文件 | 是什么 |
|---|---|
| `app.json` | 名字、图标、说明、窗口大小 |
| `app.html` | 入口页面：界面和逻辑 |
| 别的文件 | 随便放：脚本、样式、图片、数据、分子文件（`lib.js`、`style.css`、`data.json`、`a.png`、`mol.sdf`……），页面里照普通网页用相对路径加载：`<script src="./lib.js">`、`<script type="module">`、`fetch('./data.json')`、`<img src="./a.png">` |

常用的库放在仓库的 `public/vendor/<库>@<版本>/` 里（比如 RDKit 已经在 `/vendor/rdkit/`），页面里用 `/vendor/...` 加载，断网也能用。只这个小程序用的库，直接放进它自己的文件夹。

```json
{
  "name": "能量单位换算",
  "icon": "⚡",
  "description": "Hartree、eV、kcal/mol、kJ/mol、cm⁻¹ 互换，结果可以插进文章",
  "width": 360,
  "height": 420
}
```

`width`、`height` 是第一次打开时的大小（至少 420×520，不超过 Studio 的窗口），之后作者可以拖四边改，页面要能跟着伸缩。

写好就能用，不用重启 Studio：左侧「小程序」页面里会有它的卡片（`app.json` 的 `description` 就是卡片上那句话，写清楚它做什么，小程序多了靠它找）；文件一保存，开着的窗口自己重新加载（点标题栏的 ↻ 也行）。同一个文件夹里的别的页面（`./second.html`）也有 `studio`。

## 完整项目：React、TypeScript、npm 包、后端

一页网页不够时（要 npm 包、TypeScript、React、WASM、自己的后端），小程序可以是一个用 Vite 开发的项目，Studio 用它自己的开发服务器跑它，改了热更新（设计见 `docs/apps-design.md`）。`app.json` 里加 `dev`：

```json
{
  "name": "结构式编辑器",
  "icon": "⬡",
  "width": 1000,
  "height": 700,
  "dev": {
    "command": ["npm", "run", "dev", "--", "--port", "{port}", "--strictPort", "--base", "{base}"],
    "backend": ["npm", "run", "backend"]
  }
}
```

- `dev.command` 启动开发服务器：`{port}` 会换成 Studio 挑的端口，`{base}` 换成 `/studio-apps/<名字>/`。两个都要传给 Vite。
- `dev.backend`（可选）是它的后端，另起一个进程。
- 项目就在 `apps/<名字>/` 里时不用写 `cwd`；`npm install` 在它自己的文件夹里装，不并进仓库根目录。
- 项目在仓库外面（作者另有仓库的，比如 structura）时，`apps/<名字>/` 里只放 `app.json`，项目的位置写进同一文件夹的 `app.local.json`（不提交，仓库是公开的）：`{ "dev": { "cwd": "/本机/路径" } }`。不要把本机路径写进 `app.json`，写了 Studio 不运行它。
- **所有请求都要带上 base**：页面挂在 `/studio-apps/<名字>/` 下，写死的 `/api/…`、`/x.png` 会打到 Studio 上。用 `import.meta.env.BASE_URL` 开头（`${import.meta.env.BASE_URL}api/templates`）；Vite 的 `server.proxy`、插件里 `server.middlewares.use('/api/…')` 也要照顾到 base。
- 打开它的窗口时才启动，标题栏显示状态（启动中、运行中、已停止、出错）；≡ 是开发服务器的输出，「重启」再起一次。Studio 关掉时它跟着停。
- 页面里照样有 `studio`（Studio 在它的 HTML 里加上），颜色变量也在；样式是它自己的，Studio 不加。

## 出了错

窗口里的页面出错（没接住的异常、`console.error`、脚本加载失败），标题栏会出现红点和次数，作者点开能看到错误，点「让 AI 修」就把错误和开发服务器最近的输出交给你。修的时候：

- 先看错误和输出，找到原因再改，不要乱试。
- 不用自己先提交：作者点「让 AI 修」「AI」之前，Studio 已经给这个小程序的文件存了检查点，改坏了作者在窗口的 ⋯ →「回到检查点…」一键回去。不要为此去提交作者的仓库。
- 改完用工具 `app_status`（`studio app-status --id <名字>`）看它的开发服务器输出和页面最近的错误清掉没有；`list_apps` 列出所有小程序。
- 修了三次还不行，就停下来，告诉作者卡在哪里。

## 命令

`app.json` 里写 `commands`，作者在 ⌘K 里输入 `>` 就能找到并运行（Emacs 的 M-x 那样）：

```json
"commands": [{ "id": "convert", "title": "换算一个数", "entry": "app.html#convert" }]
```

运行一条命令就是打开小程序的窗口，停在 `entry`（它的某个页面，或页面自己读的 `#…`）。每个小程序本来就有一条「打开小程序「名字」」。

## 文章里的块

小程序也可以给文章提供一种块（比如结构式编辑器的 ```` ```structura ````）：在 `app.json` 里写 `blocks`，文章里写这种代码块，Studio 就用小程序的一个页面画它。

```json
"blocks": [{ "fence": "structura", "entry": "block.html", "height": 460, "title": "结构式" }]
```

- `fence`：块的名字（小写英文，不要和已有的块重名，比如 widget、smiles）。`entry`：画块的页面，在小程序文件夹里（项目型就是它开发服务器上的页面）。`height`：块的高度，文章里可以用 `height=…` 改。`title`：斜杠菜单里的名字。
- **代码块的正文就是块的状态**（一般是 JSON）。画块的页面里：
  - `studio.block.get()`：`{ state, meta }`，state 是正文，meta 是代码块名字后面那一截（`height=300` 之类）；不在块里（在窗口里）是 null。
  - `studio.block.set(state)`：写回正文。拖动、输入时别每一步都写，停一下（几百毫秒）再写一次。写回不会让框重新加载。
  - `studio.block.picture(svg文字)` 或 `studio.block.picture(pngDataUrl, 'image/png')`：存一张博客上用的图（博客是静态的，块在博客上就是这张图）。每次写回之后存一张；打开时状态不空也存一张。
- 新加的块要刷新 Studio（⌘R）才出现在编辑器里。
- 文章里这种块的正文由小程序写，不要手写。

## 能做什么：`studio`

小程序是作者自己的工具，不在沙盒里：它跟 Studio 同一个来源（地址是 `/studio-apps/<名字>/`），能用浏览器的一切（`localStorage`、剪贴板、模块脚本），所有调用都直接可用，不用申请权限。页面里自带一个 `studio` 对象，做网页自己做不了的事，都返回 Promise：

| 调用 | 作用 |
|---|---|
| `studio.article()` | 当前文章：`{ slug, title, source }`（source 是整个 index.md） |
| `studio.insert(markdown)` | 在正文光标处插入 Markdown（按 blog/AGENTS.md 的写法） |
| `studio.files.list()` | 当前文章的文件：`[{ path, kind, size }]` |
| `studio.files.read(path)` | 读文章里的一个文本文件，如 `assets/opt.log` |
| `studio.files.write(path, text)` | 写一个文本文件进文章（同名覆盖），如 `assets/data.csv` |
| `studio.fetch(url, { method, headers, body })` | 由 Studio 代为请求，不受浏览器跨域限制，本机和局域网的地址也行；返回 `{ status, ok, headers, text }` |
| `studio.run(argv, { inArticle })` | 在后台运行一条命令（`argv` 是参数数组，不经 shell），右下角能看进度；做完返回 `{ state, log, error }`。`inArticle: true` 在当前文章的文件夹里运行，否则在仓库根目录 |
| `studio.toast(text)` | 在 Studio 底部提示一句话 |
| `studio.appFile(name)` | 读自己文件夹里的一个文件，返回文字（也可以直接 `fetch('./name')`） |
| `studio.storage.get(key)`、`studio.storage.set(key, value)` | 存自己的设置（只在这台电脑上）；也可以直接用 `localStorage` |
| `studio.openPage(slug, { find })` | 打开一篇文章；给了 `find`（一行代码、一个图片路径）就滚到第一个含它的块并闪一下 |
| `studio.notes.code()` | 所有笔记里的代码，Studio 统一收集好：文章里的代码块，加上文章文件夹里的脚本和计算输入（`ai/work/opt.py`、`.gjf`）。同一段代码只算一条，`places` 列出它在哪几篇、哪个小标题下、第几行（文件是 `path`）。见下面「所有笔记里的东西」 |
| `studio.notes.images()` | 所有笔记里的图片：文章里显示的（包括网上的），加上只放在文件夹里没用上的（`referenced: false`）。同一张图只算一条，`url` 能直接放进 `<img>` |
| `studio.notes.onChange(fn)` | 任何一篇笔记或它的文件改了就调用 `fn`（连着改只调一次），这时重新取一遍 |
| `studio.repos.list()`、`studio.repos.tree(id, dir)`、`studio.repos.file(id, path)` | 代码仓库：本机的 git 仓库（Studio 自己的在 `repos/`，加上作者添加的本机仓库）。`list` 每个仓库的名字、说明（README 第一段）、分支、最近一次提交、没提交的改动数、语言；`tree` 一个文件夹里的文件夹和文件（git 看得见的，不含忽略的），连同那里的 README（HTML）；`file` 一个文件的文字和高亮（每行 `[[文字, 类别]]`，类别 k 关键字、c 注释、s 字符串、f 函数名、n 数字），图片给 `raw` 地址 |
| `studio.repos.found()`、`studio.repos.add(path)`、`studio.repos.create(name, description)`、`studio.repos.remove(id)` | 找本机常见位置（~/Code 等，往下两层）里还没加的仓库；加一个；在 `repos/` 里新建一个（git、README、第一次提交）；把加进来的从列表拿掉（文件夹不动）。只在本机，不推送 |
| `studio.block.get()`、`studio.block.set(state)`、`studio.block.picture(data, type)` | 画文章里的块时：读、写块的状态，存博客上用的图（见上面「文章里的块」）；在窗口里 get 是 null |
| `studio.theme`、`studio.onTheme(fn)`、`studio.color('ink')` | 深浅色和颜色 |

### 所有笔记里的东西

要做「把散在几百篇笔记里的东西收拢起来」的小程序（代码库、图片库这类），不要自己去读 blog/：用 `studio.notes.*`，Studio 只重读改过的笔记，几百篇也很快。

- `studio.notes.code()` 每一条：`{ id, kind, language, title, text, lines, modified, places }`。`kind` 是 `block`（文章里的代码块）、`file`（文件夹里的脚本）、`plugin`（插件的块：分子、计算任务、能量图……，不算代码，一般不显示）、`output`（运行结果）。`places` 每一项 `{ slug, title, heading, line, path, modified }`。
- `studio.notes.images()` 每一条：`{ id, url, name, alt, size, remote, referenced, modified, places }`，`places` 每一项多一个 `referenced`。
- 跳回原处：代码块用 `studio.openPage(slug, { find: 代码里第一行不空的 })`；文件和图片用 `studio.openPage(slug, { find: path })`（文章里引用了它的话）。
- 数据始终在笔记里：小程序只是把它们找出来、整理、显示；要改代码或图片，回到笔记里改。

联网也可以直接用浏览器的 `fetch`，但只有对方允许跨域时才行（比如 PubChem 的 PUG REST）；不确定就用 `studio.fetch`。

## 样子

- 只用黑、白、灰：CSS 变量 `var(--ink)`（墨色）、`var(--muted)`、`var(--line)`、`var(--soft)`、`var(--surface)`，出错用 `var(--danger)`，深浅色会自动切换（颜色取自博客的 global.css）；画布里用 `studio.color('ink')` 取颜色，`studio.onTheme(draw)` 在切换时重画。红色只用来表示出错。
- 按钮、输入框已经有基本样式，不用自己写太多。
- 窗口不大，排版要紧凑；内容多就让页面自己滚动。
- 库优先放本地（自己文件夹里，或 `/vendor/`），断网也能用；非得从网上加载时写死版本号（如 `https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/plotly.min.js`）。

## 做完之后

- 告诉作者：左侧「小程序」里点开它。
- 做好的小程序会提交进公开的仓库，不要写进 key、token、本机路径；要 key 的服务，让小程序在界面上请作者填，用 `studio.storage` 存。
- 参考已有的：`apps/energy-units/`（换算、插入文章）、`apps/gaussian-input/`（生成输入文件、写进文章的 assets/）。
