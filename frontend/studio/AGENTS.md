# 这个仓库

「计算化学手记」：一个 Astro 博客，加上本机写作用的 Studio。文章是 `blog/` 下的纯 Markdown，博客和 Studio 读同一份。

- **写笔记、改文章**：先读 [`blog/AGENTS.md`](blog/AGENTS.md)（在 `blog/` 里面打开时会自动读到；从这里打开时要自己去读）。写法细节在 [`.agents/skills/`](.agents/skills/) 的技能里，作者的偏好在 `.agents/memory/preferences.md`（只在本机）。
- **改博客或 Studio 的代码**：看 [`docs/development.md`](docs/development.md)，测试怎么跑也在那里。
- **不要动 Studio 的开发服务器**（Studio.app 开着的那个，一般是 4321）：不要再开 `npm run dev` / `astro dev`，不要停它、重启它、`kill` 它，Studio 和 AI 对话都靠它。规矩细节在 `blog/AGENTS.md`「Studio 的服务器」；改代码时要测试用独立的测试服务器（`docs/development.md`）。
- 可以提交，**不要推送**。仓库是公开的：不要写进本机路径、用户名、主机名。
