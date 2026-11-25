# retainpdf-table-agent

RetainPDF 的表格 agent：一张表一个有上限的循环，翻格子、逐格校验（数字、上下标、真翻了、同表同译），
到了上限还有格子没定就整表保留原文，不半翻。表格模型标了结构不可信的表，先看原表截图用结构工具修（定结构），
修好了再翻。方案见
[表格 agent 独立成包](../../docs/ops/planning/table-translation/20261123-表格agent独立成包.md)。

包里有两个 Python 包：

- `retainpdf_table_agent`：核心（循环、动作、校验、术语记忆、整表译文、定结构、交接格式 `contract.py`），**只用标准库**，测试钉着。
  模型调用由调用方传进来：`translate_table(table_model, chat_fn=…, memory=…, context=…)`，`chat_fn(messages, *, purpose, response_format)`
  返回 `ChatResult` 或字符串。提示词在 `retainpdf_table_agent/prompts/`。
- `retainpdf_table_agent_engine`：接线，`table_chat_fn(model=…, base_url=…, api_key=…)` 接翻译底座的 `request_chat_content`
  （同一套重试、协议、Rust 执行器开关、用量台账）；`table_screenshot_part(page, bbox)` 截原表（PyMuPDF 的页由调用方给）。
  装的时候带 extra：`retainpdf-table-agent[engine]`（流水线就这么依赖）。

调用方：流水线的表格翻译阶段 `retainpdf_pipeline/translate/tables_stage.py`，评测脚本 `backend/pipeline/devtools/table_agent_eval.py`。

## 定结构（G4 前半，`structure.py`）

`fix_structure(table_model, source=StructureSource(...), chat_fn=…)`，只修有文字层、OCR 给了网格的表
（`row_swallows_rows`、`columns_not_found`；没文字层、OCR 没给网格的照旧跳过）。

- 调用方给 `StructureSource`：文字层每一行的字、结构初稿（每格起始行列和跨度、每行表格占哪几行文字）、`rebuild(draft)`
  （流水线按改过的结构重新从文字层取格子原文、重算 issues，`ocr/tables/structure.py`）、`screenshot()`（原表截图，
  长边约 1000 像素，核心不看内容，原样放进 user 消息）。
- 模型每轮回一个 `edit`（一组改动 + `done`）或 `give_up`。工具：`move_to_caption`、`split_row`、`confirm_rows`、`set_span`、
  `delete_cell`、`delete_column`、`merge_cells`、`set_header_rows`。编号按这一轮开头给它看的结构。
- 每条改动做完就重建、用文字层核对：表格行里的字一个都不能丢（落进某个格子，或者是移出去的表题表注），丢了就撤回、连原因退回。
  规则检查（`row_swallows_rows`、`columns_not_found`）都过了、字一个没丢才算修好；最多 3 轮，不行整张保留原表。
- 提示词版本 `table_structure.v1`；要定结构的表缓存键另带初稿和文字层的指纹（`structure_fingerprint`），不定结构的表键不变。
- 请求的 `purpose` 是 `table_structure`，接线里请求标签 `table-translate-structure`（用量台账照旧记表格翻译）。

## 来历

2026-11-25（G1）从普通翻译包的 `retainpdf_translation_classic/services/tables`（T3）原样搬来：提示词、提示词版本 `table_translate.v1`、
缓存键都没变，已有的表格缓存照样命中。核心不能 import 翻译底座，从模型回复取 JSON 的函数逐字抄了一份（`json_text.py`），
`tests/test_engine_wiring.py` 拿同一批输入和底座的结果比。同日 G4 加了定结构（见
[G4 定结构实现记录](../../docs/ops/planning/table-translation/20261125-G4定结构实现记录.md)）。

## 测试

```bash
python -m pytest backend/table-agent/tests
```
