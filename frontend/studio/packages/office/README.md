# @blog/office

在网页里看 Word、PowerPoint、Excel：博客和 Studio 都用这一份。文件只在浏览器里读，不上传到别处。

| 文件 | 内容 |
|---|---|
| `kinds.mjs` | 按扩展名认文件（`officeKind`）；哪些能当表格读（`tableSource`）；`fileSize` |
| `render.ts` | 画文件：docx-preview 画 Word，pptx-preview 画幻灯片，SheetJS 画表格；`firstSheetRows` 取第一张表 |
| `viewer.ts` | `openOfficeFile(url, name)`：在页面上的大窗口里看整个文件 |
| `card.ts` | 卡片：首页缩略图、名称、页数、大小，「预览」「下载」；`connectOfficeCards()` |
| `office.css` | 卡片和窗口的样式，用网站的颜色变量（`--gray`、`--surface`…） |

查看组件只在真的打开文件时才加载。

测试：`node --experimental-strip-types --test packages/office/test/*.test.ts`（仓库根目录的 `npm test` 会一起跑）。
