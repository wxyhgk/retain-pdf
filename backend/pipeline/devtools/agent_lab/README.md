# 翻译 agent 测试系统

持续评测翻译 agent 包（`retainpdf-translation-agent`）用的开发工具，不进生产流水线。方案见 `docs/ops/planning/translation-agent/`。

- `pages.py`：把文档整理成按页送给 agent 的输入。每块给类别、大概位置（第几页、哪一栏、上中下）、原文（行内公式 `$…$`、脚注标记 `{{fn:1}}`）、
  要不要翻、接续组、关系。跨页接续的后半段放进前半段那一页。现在的输入是 OCR 分类查看器的样例（`devtools/ocr_viewer/`）。
- 翻译 agent 本身（提示词、调用模型、校验、重翻、接续组断点、改稿）在独立的包 `retainpdf-translation-agent`
  （`backend/translation-agent/`），这里只负责造样例、整理成包的输入格式、跑、出报告。
- `long_book.py` + `long_sample.py`：长样例，一本约 20 页的 A5 小书（前言 + 7 章，文风各不相同），埋了跨章术语、
  同词异义（kernel、token）、缩写先用后定义、同一人和工具多种写法、期刊名和工具名、跨章引用、每章各自编号的参考文献。
- `metrics.py`：长样例的硬指标：术语一致率、同词异义按章正确率、保留原文正确率、缩写首次括注率、语气词保留率、人称保留率、
  跨章引用正确率。
- `report.py` + `report_template.html`：离线报告。原文页面上按框叠译文，浏览器里缩字号，缩到 5.5pt 还放不下的标出来；右栏是汇总、
  有问题的块、每块的原文译文和重翻前后。

```bash
cd backend/pipeline
../.venv/bin/python -m devtools.agent_lab --out /tmp/agent_lab     # 密钥从 ~/.config/retainpdf/test.env 读，不打印
open /tmp/agent_lab/report.html
```

长样例：`--sample long`；`--no-memory` 不带术语记忆和上下文包，用来对比。调度的状态（进度、术语表各版本、台账）在 `<out>/state/`。

同样的输入第二次跑走缓存；改了提示词（`PROMPT_VERSION`）或样例会自动重新请求；`--no-cache` 强制重跑，`--pages i,1` 只跑某几页。
离线测试（假模型，不发请求）在 `devtools/tests/agent_lab/`。
