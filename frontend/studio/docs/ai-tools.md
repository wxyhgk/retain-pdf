# 给大模型用的接口

AI 可以通过两种方式操作博客的页面，功能完全一样，背后是同一套代码（`src/studio/ops/`）：

- **MCP 服务**：Claude Code 等支持 MCP 的工具直接调用，每个工具的参数都有说明。
- **`studio` 命令**：在终端里运行，结果是 JSON。你自己也能用。

两者都直接操作 `blog/` 里的文件，Studio 开不开都能用。Studio 开着时会照常发现改动；改的是正打开的那篇时，会把改动逐处标出来让你接受或拒绝。

和手工改文件相比，用这些工具会顺带做好几件容易忘的事：改名时改好别的页面里的链接，改动前把原版本存进历史，拆分时复制图片，发布前做检查。

## MCP 服务

项目根目录的 `.mcp.json` 登记了一个叫 `studio` 的服务。在项目根目录启动 Claude Code：

```sh
cd <项目根目录>
claude
```

第一次会问要不要启用这个项目的 MCP 服务，选「是」。之后用 `/mcp` 可以看到它和它的工具。AI 需要时会自己调用，你也可以直接说「用 studio 的工具在这篇下面建三个子页面」。

> 如果在某篇文章的文件夹里启动 Claude Code，它可能找不到根目录的 `.mcp.json`。这时回到根目录启动，或者让 AI 用下面的 `studio` 命令。

服务本身是 `bin/studio-mcp.mjs`（stdio，JSON-RPC 2.0），不依赖额外的包。别的 MCP 客户端也可以这样登记：

```json
{
  "mcpServers": {
    "studio": { "type": "stdio", "command": "node", "args": ["<项目根目录>/bin/studio-mcp.mjs"] }
  }
}
```

## `studio` 命令

Studio 的终端里直接有 `studio` 命令。在别的终端里，在项目根目录用：

```sh
node bin/studio.mjs <命令> [--参数 值 …]
# 或
npm run studio -- <命令> [--参数 值 …]
```

- `studio help`：列出全部命令；`studio help <命令>`：看它的参数。
- 参数写成 `--名字 值` 或 `--名字=值`。
- 值写 `-`：从标准输入读；写 `@路径`：读那个文件。长正文这样传。
- 标签这类列表：用逗号分开，或者把参数写几次。
- 成功时结果（JSON）打在标准输出，退出码 0；出错时 `{"error": "…"}` 打在标准错误，退出码 1。

例子：

```sh
# 看页面树
studio page-tree

# 在当前文章下面新建一页，正文来自文件
studio create-page --title 基组的选择 --parent "$STUDIO_ARTICLE" --body @/tmp/basis.md

# 正文从标准输入来
echo '先算一遍。' | studio update-page --slug note-20261021-120000 --body -

# 排在另一页后面
studio move-page --slug note-20261021-120000 --parent hf-project --after note-20261021-115900

# 把「计算方法」这一节拆成子页面
studio split-page --slug hf-project --heading 计算方法

# 检查、发布、提交（不推送）
studio check-page --slug hf-project
studio publish-page --slug hf-project
studio commit-page --slug ji-zu-de-xuan-ze --message "content: 基组的选择"
```

## 全部操作

MCP 工具名和命令一一对应（下划线换成连字符）。参数后面带 `?` 的可以不给。`slug` 是页面的文件夹名，也是它网址的最后一段。

| MCP 工具 | 命令 | 参数 | 做什么 |
|---|---|---|---|
| `list_pages` | `studio list-pages` | — | 列出所有页面：文件夹名、标题、上级（parent）、顺序（order）、是不是草稿、类型、标签、网址。 |
| `page_tree` | `studio page-tree` | — | 页面树：每个页面和它下面的页面，按 Studio 侧边栏的顺序。 |
| `read_page` | `studio read-page` | `slug` | 读一个页面：完整的 Markdown（含开头的属性）、属性、属性里的问题。 |
| `search_pages` | `studio search-pages` | `query`、`limit`? | 找标题或正文里有这些字的页面，每篇带上出现的几行。 |
| `backlinks` | `studio backlinks` | `slug` | 哪些页面链接到这一页，每处带上前后的话。 |
| `create_page` | `studio create-page` | `title`、`parent`?、`body`?、`slug`?、`props`?、`database`? | 新建一个草稿页面。给了 parent 就放在那个页面下面；给了 body 就以它为正文（正文里用到的上级的 ./img/、./assets/ 文件会复制过来）；上级页面有数据库时，`props` 是这一行的值（命令行写 JSON），它就成了那个数据库的一行（属性里写上 `database: <id>`）；上级有几个数据库时用 `database` 说是哪个。文件夹名自动起，发布时按标题改成可读的网址；也可以用 slug 指定。 |
| `update_page` | `studio update-page` | `slug`、`body`?、`title`?、`description`?、`tags`?、`icon`?、`props`? | 改一个页面：body 换掉整个正文；title、description、tags、icon 改属性；`props` 改它在数据库里那一行的值（只改给出的列，`null` 去掉）（改了 title，别的文章里文字是旧标题、指向它的链接跟着改成新标题）。改之前的版本存进它的历史版本；Studio 里开着这篇时，作者会看到改动并逐处接受或拒绝。 |
| `move_page` | `studio move-page` | `slug`、`parent`?、`before`?、`after`? | 把页面放到另一个页面下面（parent），或放到最上层（parent 为空）；给了 before 或 after（同一个上级下面的页面）就排在它前面或后面。不能放到它自己或它下面的页面下面。 |
| `rename_page` | `studio rename-page` | `slug`、`to` | 改页面的文件夹名（也就是网址）；别的页面里指向它的链接跟着改。已经发布的页面改名后旧网址会失效。 |
| `split_page` | `studio split-page` | `slug`、`heading` | 转成子页面：把某个标题开始的一节（到下一个同级或更高级的标题为止）变成这一页下面的新页面，标题作新页面的标题，用到的图片数据一起复制，原处留一条指向它的链接。 |
| `merge_page` | `studio merge-page` | `slug` | 并入上级页面：把这一页的正文作为一节放回上级页面（替换上级里指向它的那条链接，没有就接在末尾），它下面的页面挂到上级下面，指向它的链接改指向上级，它自己移到回收站。 |
| `delete_page` | `studio delete-page` | `slug`、`children`? | 把页面移到回收站（30 天内能用 restore_page 恢复）。children 为 delete（默认）时连同它下面的页面一起；为 lift 时只删这一页，下面的页面挂到它的上级下面。 |
| `list_trash` | `studio list-trash` | — | 回收站里的页面。 |
| `restore_page` | `studio restore-page` | `trashed` | 从回收站恢复一个页面。 |
| `check_page` | `studio check-page` | `slug` | 发布前检查：照现在的样子发布，哪些会让博客构建失败（error），哪些会在页面上显示出错（warning）。 |
| `list_apps` | `studio list-apps` | — | 作者的小程序：名字、文件夹、一页网页还是项目（项目代码在哪）、它给文章的块。 |
| `app_status` | `studio app-status` | `id` | 一个小程序现在怎么样：开发服务器在不在跑、最近的输出、页面最近出的错（要 Studio 开着）。 |
| `list_repos` | `studio list-repos` | — | 「代码仓库」里的仓库：Studio 自己的（`repos/`）和作者添加的本机仓库，各自的路径、说明、分支、最近提交、没提交的改动、语言。 |
| `add_repo` | `studio add-repo` | `path`，或 `found` | 把本机已有的 git 仓库加进「代码仓库」（只记路径）；`found: true` 先列出常见位置里还没加的。 |
| `create_repo` | `studio create-repo` | `name`、`description` | 在 `repos/` 里新建一个仓库（git、README、第一次提交）；代码写进仓库，不写进笔记。 |
| `remove_repo` | `studio remove-repo` | `id` | 把加进来的本机仓库从列表拿掉，文件夹不动。 |
| `preview_page` | `studio preview-page` | `slug`、`from`? | 页面显示出来是什么样：逐块说它显示成什么（页面链接、图、公式、表格、代码块、交互模块的框和它运行的文件、加载的脚本），附上发布前检查的问题。给看不到页面的 AI 用。 |
| `check_widgets` | `studio check-widgets` | `slug`、`widget`? | 把页面里的交互模块在后台浏览器（Playwright 的 Chromium，没有就用本机的 Chrome）里真的运行一遍：每个的报错（模块源码的第几行）、控制台的错、画出来多高、显示的字、画布有几个是空的、一张截图（存在文章的 `ai/shots/`）。给看不到页面的 AI 验自己写的模块。 |
| `publish_page` | `studio publish-page` | `slug` | 发布：先做发布前检查，有 error 就不发布；草稿改成已发布；文件夹名还是自动起的就按标题改成可读的网址（链接跟着改）。推送到 GitHub 之后网站才更新。 |
| `unpublish_page` | `studio unpublish-page` | `slug` | 撤回发布：改回草稿，下次构建后从博客上消失。 |
| `commit_page` | `studio commit-page` | `slug`、`message` | 把这一页的文件夹提交到 git（连同已经删掉的页面的文件夹），不推送。 |
| `git_status` | `studio git-status` | — | git 里还没提交的页面：changed 是有改动的页面（new 为新页面），vanished 是已经删掉的页面。 |
| `list_history` | `studio list-history` | `slug` | 一个页面存下的历史版本（写作时每 10 分钟自动存的，每次被外部改动前、恢复前存的），新的在前。 |
| `read_history` | `studio read-history` | `slug`、`name` | 读一个历史版本的完整 Markdown。 |
| `search_drive` | `studio search-drive` | `query`、`limit`? | 在资料库（作者选的本地文件夹，放论文、数据等）里按文件名和文字找文件；给出资料库的路径和每个文件在里面的路径。 |
| `list_books` | `studio list-books` | `query`?、`limit`? | RetainPDF 书库里的书：document_id、书名、作者、年份、页数、读到哪、最近读的任务（job_id）。最近读的在前。 |
| `search_books` | `studio search-books` | `query`、`document_id`?、`limit`? | 在 RetainPDF 的书里找字（原文和译文都找）：每处的书、job_id、第几页（从 1 起）、块（block）和前后的原文、译文。 |
| `read_book` | `studio read-book` | `document_id` 或 `job_id`、`from`?、`to`? | 读一本书的几页（页码从 1 起，一次最多 10 页，`next` 是下一次从哪页读）：每页的块按阅读顺序，每块有 block、类型、原文、译文。 |
| `read_passage` | `studio read-passage` | `job_id`、`block` | 取书里的一段：原文、译文、第几页，和放进笔记用的 `quote`（译文的 Markdown，前面一个 `[书名 · 第几页](retainpdf:…)` 链接写着出处；写进页面就和「摘到笔记」放进去的一样，是普通段落，右上角的标志点了回到原文）。 |
| `reading_now` | `studio reading-now` | — | 作者现在在「书库」里读哪本书、第几页，这本书的笔记页（要 Studio 开着）。 |

书的那几个操作读的是 RetainPDF（它要开着），走它的只读接口，地址和密钥在 Studio 的设置 › RetainPDF 里（见 [studio.md](studio.md) 的「AI 读书」）。

## 规矩

- 新建的页面都是草稿。文件夹名自动起（`note-…`），发布时按标题换成可读的网址，指向它的链接一起改好。
- 每次改页面之前，原来的版本先存进这一页的历史版本（`ai/history/`），可以在 Studio 里找回。
- 删除是移到回收站，30 天内能恢复。
- 发布前一定做检查，有会让博客构建失败的问题就不发布。
- 可以提交到 git，但**不会推送**；推送由作者做。
- AI 在 `blog/` 里写作的其他约定见笔记文件夹里的 `blog/AGENTS.md`，写法细节在那里 `.agents/skills/` 的技能里。

## 加一个新操作

在 `src/studio/ops/studio-ops.mjs` 里写好操作，再在 `src/studio/ops/operations.mjs` 的表里加一项（名字、说明、参数的 JSON schema、怎么调用）。命令行和 MCP 都从这张表读，不用分别改。测试在 `tests/studio-ops.test.ts`。
