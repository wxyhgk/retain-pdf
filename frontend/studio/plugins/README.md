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
| Studio | `ctx.studio` | 打开的文章 `slug()`、`fileUrl(slug, path)`、`save()`、自己的接口 `api.get/post/put('/<插件>/…')` |
| Studio | `ctx.molecules` | 分子编辑器接缝：`register(editor)` 提供一个，`editor()` 取一个 |
| Studio | `ctx.sheetTabs` | 给别的块的弹窗加页签：`register('block-job', { key, label, draw(panel, detail) })` |
| Studio | `ctx.theme` | 改设计变量：`set({ 'editor-width': '720px' }, { scheme? })`；`tokens()` 列出全部和现在的值。见下面「改外观」 |
| Studio | `ctx.styles` | 加一段自己的 CSS：`add(css)` |
| Studio | 事件 `studio/files-changed (slug, paths)`、`studio/ready` | 磁盘上文章的文件变了；Studio 打开并稳定下来了 |
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

## 现有的插件

- `job/`：计算块（xtb / CREST）。四个环境都有，是写块插件最完整的例子。库在 `packages/compute`。
- `retainmol/`：RetainMol 分子编辑器。Studio 里注册成 `ctx.molecules` 的一个实现，服务器上负责构建和提供它。计算块和化学块的三维结构都通过 `ctx.molecules` 用它，换一个编辑器不用改那些块。

## 写一个新块

1. 建 `plugins/<名字>/`。
2. `build.mjs`：`ctx.blocks.register({ name, fence: '<语言>', remark })`，把代码块变成 figure（用 `data` 带上页面要的东西）。
3. `page.ts`（需要的话）：找到这些 figure，画出来。
4. `studio.ts`：用 `$fencedBlock` 和 `$view` 做编辑器节点，`ctx.blocks.register({ name, fence, milkdown: [...], menu })`。卡片加弹窗用 `@blog/ui` 的 `openBlockSheet`。
5. `server.mjs`（需要的话）：`ctx.routes` 挂接口，Studio 那边用 `ctx.studio.api` 调。
6. 测试放在 `test/`：`*.test.ts` 跟单元测试一起跑，`*.test.mjs` 跟服务器测试一起跑。构建的测试可以用 `@blog/kernel/testing.mjs` 的 `buildBlocks(插件)`，见 `job/test/build.test.ts`。

## 改了插件之后

- **Studio 这边（`studio.ts` 和它引用的文件）是热插拔的：** 新建、修改、删除插件文件夹，Studio 不刷新页面，先把旧插件撤掉（它注册的一切都撤），再装上新的，别的插件不动。右下角会提示「已重新载入插件：…」；启动失败就用红色提示原因，改好后会自动再试。
- 改的是块插件（注册了编辑器节点），正文会用新的块重新画一遍，没保存的输入不会丢。
- 模块里自己存的状态（全局变量、自己建的 DOM）要在卸载时清掉：放进 `ctx.effect(() => { …; return () => 清理 })`，或在 `apply` 里注册撤销函数。RetainMol 插件卸载时就会拿掉自己的 iframe。
- `page.ts` 改了，刷新博客页面就行。
- `server.mjs` 或 `build.mjs` 改了，要重启开发服务器。
