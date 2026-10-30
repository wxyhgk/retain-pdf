# retainpdf-translation-agent

RetainPDF 的翻译 agent：像人一样，看一整页的块（类别、大概位置、原文、上下文）再逐块翻译；只管翻准，不管排版。
排版由以后的重排 agent（`retainpdf-layout-agent`）负责，放不下的块用改稿要求交回这里。两边只靠 `contract.py` 的格式交接。

```python
from retainpdf_translation_agent import BlockInput, PageInput, RevisionRequest, TranslationAgent

agent = TranslationAgent(cache_dir=Path("cache"))         # 模型、密钥读 ANTHROPIC_MODEL / ANTHROPIC_API_KEY
results, info = agent.translate_page(PageInput(page_label="1", blocks=[...], document={...}))
fixed = agent.revise(page, [RevisionRequest("p001-b003", results["p001-b003"].translation, max_chars=40)])
```

整篇翻译用调度，带术语记忆和上下文包，写台账和进度，中断能接着跑：

```python
from retainpdf_translation_agent import DocumentRun, Glossary

glossary = Glossary()
glossary.add("layout element", "版面元素", reason="用户给的")             # 用户给的术语是锁定的
outcome = DocumentRun(agent, Path("state"), glossary=glossary).run(pages)  # pages: 按阅读顺序的 PageInput，带 chapter
outcome.status, outcome.results, outcome.glossary.tickets                  # done / stopped（额度用完等）、每块结果、歧义单
```

- `contract.py`：交接格式（`translation_agent.v1`）。只加不改，改了升版本。
- `agent.py`：一页一次请求，模型用固定格式的工具调用交回；接续组（分栏、分页拆开的同一段）合成一条、用 `[[BREAK]]` 切回；
  附必须交回的编号清单；不合格的块合成一次重翻，接续组整组重翻；`revise` 按改稿要求改写；请求和回答可缓存。
- `checks.py`：逐块校验（漏交、空、公式、引用和脚注标记、数字、没翻、截断）和接续组校验（相邻两块重复、占比）；
  术语校验（定好的译法、保留原文、缩写）；语气信号（表示保留的词、第一人称，只记 info 算指标）。
- `memory.py`：术语表。条目有类别（术语、保留原文、缩写）、作用域（章）、状态（候选、审定、锁定）、版本；
  同一译法两块报过才升审定，两种译法打架记歧义单；同一章两处声明同词异义，加一条只管这一章的术语。程序抓"全称 (缩写)"。
- `context.py`：每页固定大小的上下文包（默认约 7000 token）：风格、术语、保留原文、缩写、相邻页、摘要，超了按顺序砍。
- `runner.py`：调度。逐页建上下文包、翻、把译者报的术语交给术语表（块要过校验、原文要有这个词），写 `pages/`、
  `glossary/vN.json`、`ledger.jsonl`、`progress.json`；`StopRun`（额度用完、密钥不对、一直限流）时保存进度停下。
- `reader.py`：翻译前通读。程序挑候选（反复出现的词组、专名）加全部标题和样张，一次请求定体裁、人名规则（理工保留原文、人文"中文译名（原文）"）、
  文风说明、全文统一的术语和人名、标题和目录的译法；`DocumentRun(read_first=True)` 用它。
- `review.py`：审校。每页正文类块交给审校只开问题单（错译、漏译添加、数字术语、不通顺、语气偏离），逐字引用原文译文，
  程序核对后只替换被指出的那段，错误和警告只许减少；`DocumentRun(review=True)` 用它。
- `breaks.py`：接续组断点放少了时按原文长度比例在中文标点处切开。
- 重翻后还不合格的块状态是 `fallback_source`：不交没过校验的译文，显示原文、待人看。每块 `meta` 记模型、提示词版本、
  角色、术语表版本、`used_terms`、上下文包哈希。`TranslationAgent(models={"reviser": ...})` 按角色另指定模型。

只用标准库（调模型用 `urllib`），测试里钉着。测试：`python -m pytest backend/translation-agent/tests`（假模型，不发请求）。
真模型评测用测试系统 `backend/pipeline/devtools/agent_lab/`，实测记录在 `docs/ops/planning/translation-agent/`。
