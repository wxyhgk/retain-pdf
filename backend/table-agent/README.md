# retainpdf-table-agent

RetainPDF 的表格 agent：一张表一个有上限的循环，翻格子、逐格校验（数字、上下标、真翻了、同表同译），
到了上限还有格子没定就整表保留原文，不半翻。方案见
[表格 agent 独立成包](../../docs/ops/planning/table-translation/20261123-表格agent独立成包.md)。

包里有两个 Python 包：

- `retainpdf_table_agent`：核心（循环、动作、校验、术语记忆、整表译文、交接格式 `contract.py`），**只用标准库**，测试钉着。
  模型调用由调用方传进来：`translate_table(table_model, chat_fn=…, memory=…, context=…)`，`chat_fn(messages, *, purpose, response_format)`
  返回 `ChatResult` 或字符串。提示词在 `retainpdf_table_agent/prompts/`。
- `retainpdf_table_agent_engine`：接线，`table_chat_fn(model=…, base_url=…, api_key=…)` 接翻译底座的 `request_chat_content`
  （同一套重试、协议、Rust 执行器开关、用量台账）。装的时候带 extra：`retainpdf-table-agent[engine]`（流水线就这么依赖）。

调用方：流水线的表格翻译阶段 `retainpdf_pipeline/translate/tables_stage.py`，评测脚本 `backend/pipeline/devtools/table_agent_eval.py`。

## 来历

2026-11-25（G1）从普通翻译包的 `retainpdf_translation_classic/services/tables`（T3）原样搬来：提示词、提示词版本 `table_translate.v1`、
缓存键都没变，已有的表格缓存照样命中。核心不能 import 翻译底座，从模型回复取 JSON 的函数逐字抄了一份（`json_text.py`），
`tests/test_engine_wiring.py` 拿同一批输入和底座的结果比。

## 测试

```bash
python -m pytest backend/table-agent/tests
```
