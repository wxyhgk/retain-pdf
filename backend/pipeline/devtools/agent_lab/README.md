# 翻译 agent 测试系统

测试翻译 agent 用的开发工具，不进生产流水线。方案见 `docs/ops/planning/translation-agent/`。

- `pages.py`：把文档整理成按页送给 agent 的输入。每块给类别、大概位置（第几页、哪一栏、上中下）、原文（行内公式 `$…$`、脚注标记 `{{fn:1}}`）、
  要不要翻、接续组、关系。跨页接续的后半段放进前半段那一页。现在的输入是 OCR 分类查看器的样例（`devtools/ocr_viewer/`）。
- `agent.py`：一次送一整页给模型（Anthropic Messages 接口，固定格式的工具调用交回译文）。接续组合成一条、用 `[[BREAK]]` 标出断点，
  模型在译文对应位置放同样的标记，再切回各块。不合格的块合成一次重翻，接续组整组重翻。请求和回答缓存在 `<out>/cache/`。
- `checks.py`：逐块校验——漏交、空、公式改动、`$` 不成对、引用和脚注标记丢失、数字丢失、没翻、截断；接续组相邻两块译文重复、断点标记数量不对。
- `report.py` + `report_template.html`：离线报告。原文页面上按框叠译文，浏览器里缩字号，缩到 5.5pt 还放不下的标出来；右栏是汇总、
  有问题的块、每块的原文译文和重翻前后。

```bash
cd backend/pipeline
../.venv/bin/python -m devtools.agent_lab --out /tmp/agent_lab     # 密钥从 ~/.config/retainpdf/test.env 读，不打印
open /tmp/agent_lab/report.html
```

同样的输入第二次跑走缓存；改了提示词（`PROMPT_VERSION`）或样例会自动重新请求；`--no-cache` 强制重跑，`--pages i,1` 只跑某几页。
离线测试（假模型，不发请求）在 `devtools/tests/agent_lab/`。
