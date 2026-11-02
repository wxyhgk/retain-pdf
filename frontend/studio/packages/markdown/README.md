# @blog/markdown

一篇笔记怎么写：博客构建、Studio 发布前检查、Studio 编辑器都按这一份规则来。

| 目录 | 内容 |
|---|---|
| `articles/` | 一篇文章是一个文件夹：哪些子文件夹随文章发布（`rules.mjs`），正文里怎么引用自己的文件（`article-references.mjs`） |
| `plugins/` | remark/rehype 插件：GFM 选项、`\(` `\[` 公式、插件认领的块（`remark-blocks`、`rehype-blocks`）、提示框、图注、文献引用、代码文件、Office 卡片、HTML 安全、KaTeX + mhchem |
| `syntax.mjs` | 文章的 Markdown 语法：GFM（按我们的选项）加公式。构建、Studio 切块比较、找链接、找文件引用、找小节都用它读，所以结果一致（编辑器是 Milkdown 自己的解析器，用同样的选项） |
| `pipeline.mjs` | `markdownPlugins({ macrosFor, blocks })`：按顺序排好的全部插件，给 unified 或 Astro 用；`blocks` 是插件认领的块（`@blog/kernel`，化学块、交互模块、计算块都在 `plugins/` 里） |
| `callouts/`、`figures/`、`references/`、`code-files/` | 每种写法自己的规则、样式和浏览器里的代码 |

网站要提供的东西：

- 公式宏：`markdownPlugins({ macrosFor })`，`macrosFor(文章的 macros)` 返回网站的宏加文章的宏（本仓库在 `src/math-macros.mjs`）。
- 文章的文件发布在 `/article-assets/<slug>/…`（本仓库的 `src/plugins/article-assets.mjs` 负责复制）。

测试：`node --experimental-strip-types --test packages/markdown/test/*.test.ts`（仓库根目录的 `npm test` 会一起跑）。
