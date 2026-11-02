# Studio 搬进 RetainPDF

2026-11-02。接着 [书和笔记接在一起](./20261101-书和笔记接在一起.md)：那份说「先不搬家，两边各自开着、用消息接起来」，这份改成搬。

## 为什么

两边接起来以后用户还是觉得别扭：每点一次出处 PDF 就重新加载（已先补了 [同一本书原地翻页](../frontend-migration/20261102-同一本书原地翻页.md)），
读到哪、摘录、AI 都要经过握手和消息。用户：「我们得做这个，这是最核心的！」——阅读器直接做成 Studio 里的组件，
不再页面套页面：不用握手，不会重新加载，书和笔记用同一份数据。

## 用户定的

- Studio 放在 `frontend/studio/`，带完整历史（360 个提交，每个提交的路径都改到 `frontend/studio/` 下，按文件查历史查得到）。
- 可以公开：跟着 RetainPDF（MIT）推送。Studio 原来「只提交不推送」的规矩到此为止，搬进来以后照仓库根目录的 `CLAUDE.md`。
- 先搬家，再改阅读器。

## 四步

1. **搬家**（这一份做的）：Studio 照原样能跑、测试照原样能过；Studio.app 改指新位置。笔记文件夹原地不动，不进仓库。
2. **阅读器改成组件**：`@retainpdf/reader` 现在从地址栏读任务、往地址栏写页码，适配是全局一份，主题写在 `<html>` 上，
   快捷键挂在 window 上，样式不分范围，一页只能有一个。改成给任务和位置的组件，这些都只管自己那块；RetainPDF 自己的阅读页改用它，行为不变。
3. **Studio 的「翻译」直接放阅读器**：摘录、读到哪、AI、跳转都直接调用，去掉 iframe 和握手。浏览器里的阅读器经 Studio 的服务器
   去问 RetainPDF（服务器带密钥，密钥不进浏览器）。
4. **其余页面也进 Studio，桌面版合一**：书库、上传、任务进度做成 Studio 的视图，去掉 studio-bridge；合成一个 RetainPDF 桌面版。
   桌面版用 RetainPDF 现有的 Electron：它已经会带上后端引擎，自己带 Node，能直接跑 Studio 的服务器；Studio.app（Tauri）要本机装好 Node，发不出去。

## 搬家做了什么

- 历史：在单独的克隆里用 `git filter-branch --index-filter` 把每个提交挪到 `frontend/studio/` 下，再
  `git merge --allow-unrelated-histories` 合进来。提交号变了，Studio 文档和提交说明里写的旧提交号对不上新的；原仓库留在本机不动。
- 搬之前查过全部历史：没有密钥（常见密钥格式、`api_key = "…"` 这类赋值），没有本机路径和邮箱；作者都是同一个人。
- 子模块：编辑器 `third_party/milkdown`（公开的 fork `wxyhgk/milkdown`）登记到仓库根目录的
  `.gitmodules`，路径 `frontend/studio/third_party/milkdown`；Studio 里的 `.gitmodules` 删掉。
  合并后才发现用到的提交 f4925260 只在本机：fork 的 `studio` 分支在 GitHub 上落后 23 个提交（搬之前看的是本机过期的
  远程分支记录）。用户同意后推了 fork（`fc3a1378..f4925260`），之后才推送 RetainPDF。以后核对提交公开没有用 `git ls-remote`；
  改了编辑器先推 fork，再推 RetainPDF。
- npm：Studio 自己一套依赖（`frontend/studio/package-lock.json`），不进仓库根目录的 npm workspaces；在 `frontend/studio` 里
  `npm ci`，npm 认它是独立的项目。第 3 步要用 `@retainpdf/reader` 时再定怎么接。
- Cargo：Studio 的两个 Rust 小工具（`tools/studio-app`、`tools/studio-terminal`）各自加 `[workspace]`，不并进根目录的 Cargo 工作区（那是后端的）。
- 忽略规则：根目录 `.gitignore` 的 `*.log` 会吃掉计算输出的测试样本，Studio 的 `.gitignore` 放行 `packages/compute/test/fixtures/**/*.log`。
- Studio.app：`build.sh` 默认打包它所在的 Studio（两层上去），不再用 git 顶层；「用上次能正常启动的版本打开」不再给整个仓库开 git worktree
  （RetainPDF 整个检出 255MB），改成 `git archive` 只取那个提交里的 Studio 文件夹，加了测试。
- 规矩：`frontend/studio/AGENTS.md` 去掉「不要推送」，写明搬进来了、照根目录的 `CLAUDE.md`；加 `frontend/studio/CLAUDE.md` 引用它。

## 验过的

- Studio：类型检查；单元 494、服务器 274；Studio.app 的 Rust 测试 3（新加 1：Studio 在仓库的子文件夹里时只取这个文件夹）、终端 1；
  浏览器测试整套（隔离的测试服务器）。
- RetainPDF：两个架构检查、根目录 `cargo metadata`、文档和 CI 约定 216、前端 2442、桌面端 60。

## 还没做的

- CI 还不跑 Studio 的测试（要拉子模块、装 pnpm 和 Playwright 的浏览器），第 2 步开始前加。
- 作者用的 Studio.app 还指着原来的 notes-studio：合并以后在新位置装好依赖、`.studio-local.json` 写笔记文件夹、重新 `build.sh`，
  作者说重启再换。原来的 notes-studio 仓库以后不再改。
- 网页版、Docker 版带不带笔记，从别的设备访问时 RetainPDF 的地址：还是 [书和笔记接在一起](./20261101-书和笔记接在一起.md) 里那几条，第 4 步前定。
