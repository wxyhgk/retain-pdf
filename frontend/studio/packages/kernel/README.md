# @blog/kernel

插件内核：Cordis（`@deepseek-ai/cordis`，DeepSeek Harness 的插件框架）加上我们每个环境都要的几个服务。怎么写插件见 `plugins/README.md`。

| 文件 | 内容 |
|---|---|
| `index.mjs` | 对外的 `Context`、`Service`；`applyPlugins`（一个个启动，一个失败不影响别的）、`pluginProblems`（谁在等服务、谁没启动起来） |
| `blocks.mjs` | `ctx.blocks`：代码块按语言归插件，一种只能归一个 |
| `routes.mjs` | `ctx.routes`：开发服务器上插件的接口；`created`、`readAnswer` |
| `node.mjs` | Node 里的加载：`buildKernel(root)`（博客构建）、`serverKernel(root, server)`（开发服务器）；读 `plugins/*/build.mjs`、`server.mjs` |
| `page.ts` | 博客页面：`ctx.page`、`startPage` |
| `studio.ts` | Studio：`ctx.studio`、`ctx.molecules`（分子编辑器接缝）、`ctx.sheetTabs`（弹窗页签插槽）、事件、`startStudio`（也启动 `theme.ts` 的两个服务） |
| `theme.ts` | 外观：`ctx.theme`（设计变量 `DESIGN_TOKENS`，只认清单里的名字）、`ctx.styles`（插件自己的 CSS） |
| `server.d.mts` | 开发服务器上的 `ctx.server` 是什么 |
| `testing.mjs` | 测试用：`buildBlocks(...插件)` |

浏览器两边（`page.ts`、`studio.ts`）由 `import.meta.glob('/plugins/*/…')` 找插件：页面在 `src/components/Plugins.astro`，Studio 在 `src/studio/plugins.ts`。

插件只从这里拿 Cordis 的东西，换框架只改这一层。
