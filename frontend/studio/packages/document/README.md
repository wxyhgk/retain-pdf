# @blog/document

文章的 Markdown 在 Studio 里怎么拆、怎么写回：开头的属性（frontmatter）和正文分开，正文切成一块块，每块记着在文件里的位置；编辑器交回来的正文只替换改过的块，没改的地方原样保留。编辑器、文章的打开和保存、Studio 的后端、给 AI 用的工具都用这一份。

| 文件 | 内容 |
|---|---|
| `index.ts` | 对外的入口：`parseStudioDocument`、`mergeMarkdownBody`、`serializeStudioDocument`、`updateStudioFrontmatter`… |
| `parse.ts` | 拆开：属性一段，正文按块切，各带行号和偏移 |
| `merge.ts` | 合并：编辑器给的新正文和原文逐块对齐，只换改动附近的块 |
| `serialize.ts` | 写回：属性和正文拼成文件，换正文时属性一个字不动 |
| `frontmatter.ts` | 改属性：页头改了标题、标签、图标…，只改 YAML 里对应的几行 |
| `source-lines.ts` | 选中的内容在文件的第几行到第几行（`sourceLinesOf`），告诉终端里或面板里的 AI 看哪里 |
| `empty-lines.ts` | 文末空行的处理 |
| `types.ts` | 类型；`ArticleProperties` 是页头的属性 |

测试在仓库根目录的 `tests/`（`studio-document*.test.ts`、`incremental-sync.test.ts`、`source-lines.test.ts`），`npm test` 会一起跑。
