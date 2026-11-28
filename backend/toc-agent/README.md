# retainpdf-toc-agent

RetainPDF 的目录 agent：一本书的目录一次翻完，逐条检查，正文里同名的标题用同一个译名。
方案见 [表格和目录的 agent 翻译与排版](../../docs/ops/planning/toc-agent/20261125-用户定：表格和目录的agent翻译与排版.md)。

## 怎么跑

和普通翻译**同步**：任务的 `translation.toc` 是 `agent` 时，流水线（`retainpdf_pipeline/translate/toc_stage.py`）给翻译请求一个
`fixed_translations_fn`；翻译一开头，底座（`retainpdf_translation/workflow/fixed_translations.py`）在另一个线程里调它，和领域识别同时跑，
引擎开始翻之前等它。它返回 {块号: 定译}——目录条目（「章号 译名」）和正文里对上的标题——写进块的元数据，两个引擎见了都不再发请求。
它失败（网络、Key、模型回的不对）只打日志，照常翻，不会比没有它差。

1. 取条目：归一化时按文字层拆出来的目录条目块（`structure_role = toc_entry`）；带公式的、不翻的不碰。
2. 一轮：同样的原文只问一次（「References」每章都有），模型回 `{"translations": [{"k", "zh"}]}`；逐条检查（空的、没译、
   多了原文没有的数字——章号页码混进来、丢了数字、太长、没按术语表、写成多行），没过的连原因退回重交，最多 3 轮；还没过的不给定译。
3. 正文标题：原文一样（不计大小写、空白、首尾标点）就用同一个译名；带章号的去掉章号比，译文前面照样带章号。
4. 结果和缓存：`translated/toc-agent.v1.json`。输入一样（条目、标题、术语表、模型、提示词版本）续跑直接用，定译不变。定译不进翻译 checkpoint 的指纹（2026-11-26 起；以前进，目录 agent 第一次失败、重试成功时整本作废重翻）。

包里有两个 Python 包：

- `retainpdf_toc_agent`：核心（循环、检查、标题对照、交接格式 `contract.py`；认上下文在子包 `context`），**只用标准库**，测试钉着。
  `translate_toc(entries, headings, chat_fn=…, glossary=…)`，`chat_fn(messages, *, purpose, response_format)` 返回 `ChatResult` 或字符串。
- `retainpdf_toc_agent_engine`：接线，`toc_chat_fn` 接翻译底座的 `request_chat_content`（同一套重试、协议、Rust 执行器、用量台账，
  阶段记成 `toc_translation`）；`toc_fixed_translations(document, …)` 从 document.v1 取条目和标题、读写缓存。

## 认上下文（R2，2026-11-28）

原位替换只换标题的字，要先搞清楚哪几段字是同一条、每段字是什么。方案见
[R2：认上下文的 agent](../../docs/ops/planning/toc-agent/20261128-R2：认上下文的agent.md)。

- 翻译开始前（流水线 `translate/toc_context_stage.py`）：流水线按拆条目的规则出草稿（`toc_pages.page_draft`，每段字的角色
  title / number / label / leader / page / author / header / other、归哪一条；规则不认的块也给候选）。
- 核心 `retainpdf_toc_agent.context`：算「拿不准」的信号（条目少、页码少、页码倒退、双栏、页码在左、字族多、没认出的作者行、
  没页码的多行条目、看不见的文字层、和正文标题对不上、翻译检查退回、规则不认）；**没有信号的页不问模型**。有信号的页给模型看截图和
  行片段，模型只能用工具改角色和归属（`set_role`、`merge`、`split`、`attach`、`keep`、`set_level`、`continue_from_prev_page`、
  `not_toc`、`done`、`give_up`），改完就检查，最多 3 轮；不过按规则草稿走，规则草稿也不过整页保留原文。
- 接线 `retainpdf_toc_agent_engine.context`：文字层看不看得见、截图（长边 1400 像素，叠行号）、结果和缓存 `translated/toc-context.v1.json`
  （输入一样重放，不再调模型）；请求标签 `toc-translate-context`。改过的条目由流水线写回归一化文档（`toc_pages.apply_toc_context`），
  字段和拆条目时一样，另加 `toc_entry_keep_original`、`toc_entry_author_lines`、`toc_entry_text_layer` 等。
- 子开关 `RETAINPDF_TOC_CONTEXT`（挂在 `translation.toc = agent` 下）：`off`（默认，R3 实测前不开）/ `rules`（只记信号、不发请求）/ `model`。

## 还没做

- 扫描件的目录页（没有文字层、没拆出条目）：看页面截图认条目（执行器已能收图）。认上下文要文字层的片段，没有文字层的页不进它。
- 跟着 OCR 翻（`ocr_stream_dir`）时，后面才到的页上的正文标题拿不到定译（目录在前几页，条目照样有）。

## 测试

```bash
python -m pytest backend/toc-agent/tests
```
