# retainpdf-math

RetainPDF 的公式处理包。翻译流水线从这里拿关于公式的判断，规则只有一份（以前 AI 服务也用，2026-11-03 删了）。

| 模块 | 作用 |
| --- | --- |
| `registry` | LaTeX 命令登记表（`latex_commands.json`）：哪些命令渲染器支持、哪些写法等价、哪些会被模型改写、渲染不了时提示换成什么 |
| `spans` | 从文本里找公式：`$...$` 行内、`$$...$$` 行间 |
| `checks` | 不用渲染器就能判断的问题：花括号不配对、翻译时丢了 LaTeX 命令 |
| `direct_typst` | direct_typst 译文的机械格式规整（公式和中文之间的空格、相邻公式、双反斜杠）、`$` 是否成对、提示词里「渲染不了的命令换成什么」的替换表 |
| `render_check` | 交给排版引擎同一套 MathJax 试渲染，「ok」就等于能排进 PDF |
| `render_prep`、`source_repair` | 单个公式交给渲染器之前的改写；`source_repair` 只修 OCR 把原文写坏的地方（写重的 `\\mu`、同一个底数连写两个下标或上标 `F_1_*` → `F_1{}_*`），翻译阶段的公式渲染检查用同一份改写 |

## render_check 怎么找到引擎

- 引擎目录：`RETAIN_RPR_ENGINE_DIR`，没设时用仓库里的 `backend/rendering-engine`（和流水线的 rpr 引擎同一个变量）；
  检查服务是其中的 `engine/bin/rpr-math-check.js`，需要 `node_modules/mathjax-full`（`npm ci --omit=dev`）。
- Node：`RETAINPDF_NODE_BIN`（桌面端指向 Electron 本体，自动配 `ELECTRON_RUN_AS_NODE=1`）→ PATH 里的 `node`。
- 找不到、子进程崩了或超时：记一次警告后关掉这项检查，调用方拿到 `None`，当作「没查」——不让翻译因此失败。
- `RETAIN_MATH_RENDER_CHECK=0` 关闭。

## 测试

```sh
cd backend && uv run --package retainpdf-math pytest math/tests -q
```
