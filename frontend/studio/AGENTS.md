# Studio（`frontend/studio`）

RetainPDF 的笔记软件 Studio：一个在本机写 Markdown 笔记的工具（编辑器、AI 面板、计算块、小程序……）。2026-11-02 从单独的
notes-studio 仓库带着历史搬进 RetainPDF（方案见仓库的 `docs/ops/planning/studio-workbench/20261102-搬进RetainPDF.md`）；
分支、合并、推送照仓库根目录的 `CLAUDE.md`。笔记不在这里，在 `.studio-local.json` 指向的笔记文件夹里（见 [README](README.md)）。

- **改代码**：先读 [`docs/development.md`](docs/development.md)：目录、怎么接、测试怎么跑。
- **测试用独立的测试服务器**（`E2E_ISOLATED=1`，端口 4400 起），不要用开着的那个。
- **不要动作者开着的 Studio 服务器**（一般是 4321，`.studio-cache/server.json`；RetainPDF.app 起的）：不要再开一个、停它、重启它或 `kill` 它，作者的 Studio 和 AI 对话都靠它。
- **不要碰作者的笔记**（`.studio-local.json` 指向的文件夹）：测试有自己的测试文章（`tests/e2e/fixtures/`、`tests/fixtures/`）。
- 仓库是公开的：不要写进本机路径、用户名、主机名、密钥。
- 编辑器是 `third_party/milkdown`（Milkdown 的 fork，git submodule）：改它要在它自己的仓库里提交，再在这里提交 submodule 的新位置。
