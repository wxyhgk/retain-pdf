# 插件

除了普通 Markdown，网站和 Studio 能做的事都可以写成插件：一种代码块（```job），一个分子编辑器（RetainMol）。加一个插件就是在这里加一个文件夹，**不用改核心代码**。

内核在 `packages/kernel`，底下是 DeepSeek Harness 用的插件框架 Cordis（`@deepseek-ai/cordis`，版本锁死）。插件只通过 `@blog/kernel` 用它。

## 一个插件是什么

一个文件夹，每个运行环境一个入口，用不到的环境就不写：

| 文件 | 在哪里跑 | 做什么 |
|---|---|---|
| `build.mjs` | 博客构建（Node） | 把自己的代码块变成页面上的 HTML；发布前检查也用它 |
| `page.ts` | 博客页面（浏览器） | 让构建留下的东西动起来：卡片、弹窗、图 |
| `studio.ts` | Studio（浏览器） | 编辑器里的块、斜杠菜单、弹窗；或给别人提供服务（分子编辑器） |
| `server.mjs` | Studio 开发服务器（Node） | 自己的接口、跑任务 |

每个入口导出同样的三样：

```js
export const name = 'block-job';             // 名字
export const inject = ['blocks'];            // 要用的服务；都就绪了才会启动
export function apply(ctx) { … }             // 在这里注册
```

`apply` 里注册的东西（块、路由、监听、计时器）在插件卸载时会自动撤掉。自己开的资源用 `ctx.effect(() => { 开; return () => 关 })` 包起来，也会跟着撤。

## 各环境有哪些服务

| 环境 | 服务 | 用途 |
|---|---|---|
| 全部 | `ctx.on` / `ctx.emit` | 事件 |
| 构建 | `ctx.blocks.register({ name, fence, remark(node, file) })` | 认领一种代码块；`remark` 返回替换它的节点，`file.message(…)` 报给发布前检查 |
| 页面 | `ctx.page` | `articleSlug`、`fileUrl(path)`：文章发布出去的文件地址 |
| Studio | `ctx.blocks.register({ name, fence, milkdown, menu })` | 编辑器节点（Milkdown 插件）和斜杠菜单里的一项（`insert(view)`） |
| Studio | `ctx.studio` | 打开的文章 `slug()`、`article()`（`{ slug, title }`，标题是正在编辑的）、整个文件 `source()`（编辑器里的样子，没保存的也算，**含开头的 `---` 属性**）、`fileUrl(slug, path)`、`save()`；编辑器 `editor.view()`（ProseMirror）、`editor.insert(markdown)`（插成独立的块）、`editor.insertText(文字)`（插在光标所在的行里）；`toast(文字, 出错?)`、`showPanel(key)`；自己的接口 `api.get/post/put('/<插件>/…')` |
| Studio | `ctx.panels` | 右栏的页签：`register({ key, label, order?, draw(pane) })`，见下面「界面：面板和命令」 |
| Studio | `ctx.commands` | 命令：`register({ id, label, run, keys?, places? })`，可以挂快捷键、斜杠菜单、⋯ 菜单、左栏；`run(id)` 跑别人的命令 |
| Studio | `ctx.molecules` | 分子编辑器接缝：`register(editor)` 提供一个，`editor()` 取一个 |
| 全部 | `ctx.jobs`（由 `job` 插件提供） | 计算程序：`register(program)`、`get(name)`、`list()`；见「写一个计算程序」 |
| Studio | `ctx.sheetTabs` | 给别的块的弹窗加页签：`register('block-job', { key, label, draw(panel, detail) })` |
| Studio | `ctx.theme` | 改设计变量：`set({ 'editor-width': '720px' }, { scheme? })`；`tokens()` 列出全部和现在的值。见下面「改外观」 |
| Studio | `ctx.styles` | 加一段自己的 CSS：`add(css)` |
| Studio | 事件 `studio/source-changed (slug, source)` | 打开的文章变了（打字、换文章、磁盘上被改），停下 250 毫秒后通知一次；`source` 和 `ctx.studio.source()` 一样。要跟着正文更新就听它，不要定时去查 |
| Studio | 事件 `studio/article-opened (slug)` | 打开了一篇文章（换了一篇，或同一篇从磁盘重新载入） |
| Studio | 事件 `studio/files-changed (slug, paths)`、`studio/ready`、`studio/plugins-changed (names)` | 磁盘上文章的文件变了；Studio 打开并稳定下来了；有插件装上或撤下了 |
| 服务器 | `ctx.routes.get/post/put('/<插件>/…', handler)` | 接口，挂在 `/api/studio/plugins/` 下；`handler({ params, query, json() })` 的返回值就是 JSON 回答，`created(值)` 回 201；错误的 `statusCode` 和信息会变成回答 |
| 服务器 | `ctx.server` | `projectRoot`、`blogRoot`、`settingsFile`、`privateFile(名字)`、`testing`、`files`（`articleFolder(slug)`、`inside(…)`、`writeText(…)`）、`logger` |

开发服务器先做了检查（只许本机、只许本机页面；改动必须是 JSON），插件的路由不用自己再查。

## 改外观

先用设计变量，变量做不到的再写 CSS。两样都在插件卸载时撤掉，界面回到原样。

```ts
// plugins/look-compact/studio.ts
import type { Context } from '@blog/kernel/index.mjs';
import type {} from '@blog/kernel/studio.ts';

export const name = 'look-compact';
export const inject = ['theme', 'styles'];

export function apply(ctx: Context): void {
	ctx.theme.set({ 'editor-width': '720px', 'editor-font-size': '16px', 'editor-line-height': '1.6' });
	ctx.theme.set({ surface: '#161616' }, { scheme: 'dark' });   // 只在暗色模式
	ctx.styles.add('.page-head { padding-top: 24px; }');
}
```

设计变量（全部在 `packages/kernel/theme.ts` 的 `DESIGN_TOKENS`，默认值在 `src/styles/global.css` 和 `src/studio/tokens.css`）：

| 类 | 名字 |
|---|---|
| 颜色 | `accent`、`accent-strong`、`on-accent`、`heading`、`text`、`text-soft`、`line`、`surface`、`surface-soft`、`surface-hover`、`code-bg`、`code-text` |
| 字体 | `font-text`、`font-mono` |
| 版面 | `editor-width`、`editor-padding`、`editor-font-size`、`editor-line-height`、`title-size`、`sidebar-width`、`panel-width` |

- 名字写错会直接报错，列出全部名字；值里不能有 `; { } < > \` 和注释。
- `heading`、`text`、`text-soft`、`line` 写 `#rrggbb` 就行（内部存成 `r, g, b`）。
- 不写 `scheme` 就是亮色、暗色都改。
- `ctx.styles` 的 CSS 排在 Studio 自己的样式后面；同样的选择器不生效，就写得更具体些。
- **配色只用黑、白、灰；红色只用于删除和出错。** 改颜色时守住这一条。
- 插件自己的 CSS（面板内容等）也用这些变量，暗色模式就自动跟着变：文字 `rgb(var(--gray-dark))`、次要文字 `rgb(var(--gray))`、线 `rgb(var(--gray-light))`、底色 `var(--surface)`、浅底 `var(--surface-soft)`、悬停 `var(--surface-hover)`、强调 `var(--accent)`（上面的字用 `var(--on-accent)`）；字体 `var(--font-text)`、`var(--font-mono)`。类名加上插件名做前缀（如 `.word-count-card`），免得和别人撞。

## 界面：面板和命令

插件可以在 Studio 里加自己的页签和命令，不用改 Studio 的代码，也不用写 CSS 去挪别人的元素。

```ts
// plugins/scratch/studio.ts
import type { Context } from '@blog/kernel/index.mjs';
import type {} from '@blog/kernel/studio.ts';
import type {} from '@blog/kernel/ui.ts';

export const name = 'scratch';
export const inject = ['studio', 'panels', 'commands'];

export function apply(ctx: Context): void {
	// 右栏的一个页签，排在「文件 / 终端 / 资料库」后面；第一次显示时才画。
	ctx.panels.register({
		key: 'scratch',
		label: '草稿',
		draw(pane) {
			const area = document.createElement('textarea');
			pane.append(area);
			return () => area.remove();   // 页签撤下时调用（可以不写）
		},
	});
	// 一个命令：左栏一个按钮，打开上面的页签。
	ctx.commands.register({ id: 'scratch.open', label: '草稿', icon: '✎', places: ['sidebar'], run: () => ctx.studio.showPanel('scratch') });
	// 另一个：⌘⌥D，或斜杠菜单里的「插入今天的日期」。
	ctx.commands.register({
		id: 'scratch.today',
		label: '插入今天的日期',
		keys: 'Mod-Alt-d',
		keywords: ['date', 'riqi'],
		places: ['slash', 'page-menu'],
		run: () => ctx.studio.editor.insert(new Date().toISOString().slice(0, 10)),
	});
}
```

**面板**（`ctx.panels.register`）
- `key`：小写字母开头，只含字母、数字、`-`、`_`；`files`、`terminal`、`drive` 是 Studio 自己的。重名直接报错。
- `order`：插件页签之间的先后，小的在前；都排在 Studio 自己的三个后面。
- `draw(pane)`：页签第一次显示时调用一次，`pane` 是一个空的竖向 flex 容器，内容超出时整体滚动。画的时候出错，错误会显示在页签里。
- `draw` 返回的函数在页签撤下时调用：插件被关掉、被改了重新载入、被删掉。在 `draw` 里开的计时器、`ctx.on(...)` 的监听、自己建的元素，都在这里收掉（`ctx.on` 返回的就是取消函数）。
- `shown(pane)` / `hidden(pane)`（可选）：页签出现在屏幕上（第一次 `draw` 之后也会调一次）、离开屏幕（选了别的页签、右栏收起）时调用。只在看得见时才有意义的事（重算、动画）可以等到 `shown` 再做。页签撤下时不调 `hidden`，那是 `draw` 返回的函数的事。
- 上次选中的页签会记住；刷新后，等插件装好就切回它。
- 完整的例子是 `word-count/`：一个跟着正文更新的面板，加两个命令。

**命令**（`ctx.commands.register`）
- `id`：小写字母开头，只含字母、数字、`.`、`-`、`_`，建议写成 `插件.动作`。重名直接报错。
- `places`：除了快捷键，还显示在哪里。`slash` 是斜杠菜单里的「插件」组（先删掉打的 `/…`，再运行），`page-menu` 是右上角的 ⋯ 菜单，`sidebar` 是左栏「资料库」下面的按钮。
- `icon`：一段 SVG 或一个字符，用在斜杠菜单和左栏。`keywords`：斜杠菜单搜索时多认的词。
- `keys`：快捷键，写成 `Mod-Shift-d` 这样（`Mod` 在 Mac 上是 ⌘，别处是 Ctrl）。
  - 必须按着 Mod 或 Alt（F1–F12 除外），否则会占掉打字用的键。
  - Studio、编辑器和浏览器自己的键不能用：⌘K、⌘S、⌘J、⌘B、⌘C、⌘Z 这些，全部列在 `packages/kernel/ui.ts` 的 `RESERVED_KEYS`。两个插件用同一个键也会报错。
  - 光标在编辑器里时，编辑器自己处理的键优先。
- `run({ from })`：`from` 说明是从哪里触发的（`keys`、`slash`、`page-menu`、`sidebar`，或别的插件用 `ctx.commands.run(id)` 调的 `call`）。可以是 async；出错时右下角用红色显示「命令名：原因」，所以条件不满足时直接 `throw new Error('还没有打开文章')` 就行。

改了斜杠菜单里的命令（加、删、热替换），正文会重新画一遍，和块插件一样，没保存的输入不会丢。

## 现有的插件

- `job/`：计算块。四个环境都有，是写块插件最完整的例子。库在 `packages/compute`。它提供 `ctx.jobs`（计算程序接缝），跑哪个程序由程序插件决定。
- `xtb/`、`crest/`：计算程序。四个环境都把自己注册进 `ctx.jobs`；加一个程序见下面「写一个计算程序」。
- `bookmark/`：网页书签（```bookmark）。四个环境都有，是一个小而完整的块插件：`bookmark.mjs` 是格式和卡片（构建和 Studio 共用一份 HAST），`server.mjs` 在 Studio 里读一次网页（DOI 问 doi.org），读到的写进文章，构建不联网。
- `word-count/`：字数统计。只有 `studio.ts`：右栏页签（听 `studio/source-changed`，只在看得见时重算）、左栏按钮、一个插入统计的命令。写界面插件可以照着它。
- `retainmol/`：RetainMol 分子编辑器。Studio 里注册成 `ctx.molecules` 的一个实现，服务器上负责构建和提供它。计算块和化学块的三维结构都通过 `ctx.molecules` 用它，换一个编辑器不用改那些块。

## 写一个新块

1. 建 `plugins/<名字>/`。
2. `build.mjs`：`ctx.blocks.register({ name, fence: '<语言>', remark })`，把代码块变成 figure（用 `data` 带上页面要的东西）。
3. `page.ts`（需要的话）：找到这些 figure，画出来。
4. `studio.ts`：用 `$fencedBlock` 和 `$view` 做编辑器节点，`ctx.blocks.register({ name, fence, milkdown: [...], menu })`。卡片加弹窗用 `@blog/ui` 的 `openBlockSheet`。
5. `server.mjs`（需要的话）：`ctx.routes` 挂接口，Studio 那边用 `ctx.studio.api` 调。
6. 测试放在 `test/`：`*.test.ts` 跟单元测试一起跑，`*.test.mjs` 跟服务器测试一起跑。构建的测试可以用 `@blog/kernel/testing.mjs` 的 `buildBlocks(插件)`，见 `job/test/build.test.ts`。

## 写一个计算程序

计算块不认识任何具体程序，程序是各自的插件。以 ORCA 为例，建 `plugins/orca/`：

1. `program.mjs`：程序的定义，四个环境共用（类型见 `packages/compute/programs.d.mts`）：
   - `name`（围栏里的 `program=`、命令名、计算机器里路径的键）、`label`、`order`（列表里的先后）、`starter`（新块的命令行）；
   - `read(args)` / `write(options)` / `describe(options)`：命令行和表单互相转换，一行说明；
   - `fields`：表单的字段（选项、数字，什么时候显示，怎么读写选项）。xtb 系的电荷、未成对电子、溶剂可以直接用 `@blog/compute/job-options.mjs` 的 `XTB_COMMON_FIELDS`；
   - `command(input, args, threads)`：运行时执行的命令；`output`：输出文件；`live`：运行中跟踪的文件；`scratch`：不算结果的文件；`beside`：在计算机器上到哪些程序旁边找它。
2. `view.ts`：浏览器里怎么画它的结果：`draw(context)` 和 `summarize(context, summary)`，用 `@blog/compute/browser/job-view.ts` 里的零件（数值表、优化曲线、红外光谱、结构、构象表）。输出的解析器放在插件里或 `packages/compute/parsers/`。
3. 四个入口都只有一句：`inject: ['jobs']`，`apply(ctx) { ctx.jobs.register(…) }`。`build.mjs`、`server.mjs` 注册 `program`；`page.ts`、`studio.ts` 注册 `{ ...program, ...view }`。
4. 测试放在 `test/`，见 `xtb/test/program.test.ts`。

装上之后：表单、斜杠菜单、计算机器窗口（路径和检测）、运行、结果页都会认它，计算块的代码不用改。没有插件认识的程序，块照样显示命令行，发布前检查会提示。

## 开关

Studio 左栏底部的「插件」列出 `plugins/` 里的每个插件：它在哪些环境里、现在怎么样（运行中、没能启动及原因、在等服务）、一个开关。

- 关掉一个插件：它的 `studio.ts` 和 `server.mjs` 马上撤下（注册的一切都撤），不用刷新、不用重启；块插件关掉后，那种代码块在编辑器里显示成普通代码。
- 开关记在 `.studio-settings.json` 的 `plugins.disabled`（不进 git）。博客构建和发布的页面不看它，照常用全部插件。
- `studio.ts` 可以导出 `description`，一句话说明插件是做什么的，显示在这个面板里。

## 改了插件之后

- **Studio 这边（`studio.ts` 和它引用的文件）是热插拔的：** 新建、修改、删除插件文件夹，Studio 不刷新页面，先把旧插件撤掉（它注册的一切都撤），再装上新的，别的插件不动。右下角会提示「已重新载入插件：…」；启动失败就用红色提示原因，改好后会自动再试。
- 改的是块插件（注册了编辑器节点）或斜杠菜单里的命令，正文会用新的块重新画一遍，没保存的输入不会丢。面板和别的命令直接换上，正文不动。
- 模块里自己存的状态（全局变量、自己建的 DOM）要在卸载时清掉：放进 `ctx.effect(() => { …; return () => 清理 })`，或在 `apply` 里注册撤销函数。RetainMol 插件卸载时就会拿掉自己的 iframe。
- `page.ts` 改了，刷新博客页面就行。
- `server.mjs` 或 `build.mjs` 改了，要重启开发服务器。
