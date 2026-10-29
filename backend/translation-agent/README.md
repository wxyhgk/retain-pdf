# retainpdf-translation-agent

RetainPDF 的翻译 agent：像人一样，看一整页的块（类别、大概位置、原文、上下文）再逐块翻译；只管翻准，不管排版。
排版由以后的重排 agent（`retainpdf-layout-agent`）负责，放不下的块用改稿要求交回这里。两边只靠 `contract.py` 的格式交接。

```python
from retainpdf_translation_agent import BlockInput, PageInput, RevisionRequest, TranslationAgent

agent = TranslationAgent(cache_dir=Path("cache"))         # 模型、密钥读 ANTHROPIC_MODEL / ANTHROPIC_API_KEY
results, info = agent.translate_page(PageInput(page_label="1", blocks=[...], document={...}))
fixed = agent.revise(page, [RevisionRequest("p001-b003", results["p001-b003"].translation, max_chars=40)])
```

- `contract.py`：交接格式（`translation_agent.v1`）。只加不改，改了升版本。
- `agent.py`：一页一次请求，模型用固定格式的工具调用交回；接续组（分栏、分页拆开的同一段）合成一条、用 `[[BREAK]]` 切回；
  附必须交回的编号清单；不合格的块合成一次重翻，接续组整组重翻；`revise` 按改稿要求改写；请求和回答可缓存。
- `checks.py`：逐块校验（漏交、空、公式、引用和脚注标记、数字、没翻、截断）和接续组校验（相邻两块重复、占比）。

只用标准库（调模型用 `urllib`），测试里钉着。测试：`python -m pytest backend/translation-agent/tests`（假模型，不发请求）。
真模型评测用测试系统 `backend/pipeline/devtools/agent_lab/`，实测记录在 `docs/ops/planning/translation-agent/`。
