# retainpdf-base

RetainPDF Python worker 的底座包：流水线（`retainpdf-pipeline`）和翻译都要用、但不属于其中任何一个的东西放在这里。
只依赖标准库；这里的模块不 import 流水线，也不 import 翻译。

| 模块 | 作用 |
| --- | --- |
| `contracts` | worker stdout 标签、`pipeline_summary.json` / `pipeline_events.jsonl` 文件名（契约见 `backend/contracts/pipeline-stdout.v1.schema.json`） |
| `events` | 阶段事件 writer：`PipelineEventWriter`、`pipeline_event_writer_scope`、`emit_stage_progress` 等；没有活动 writer 时什么都不写 |
| `upstream_wait` | 服务商限流等待（429/529/503 退避）报进阶段进度：`upstream_wait_scope(...)` 包住原来的 sleep，开始、结束各一条 `stage_progress`（payload `upstream_wait`），并发等待合并；契约见 `pipeline-stdout.v1` 的 `stage_observation_event.upstream_wait` |
| `io` | JSON 落盘：`save_json`（流式）、`save_json_atomic`、`load_json` |
| `paths` | 仓库根、`OUTPUT_ROOT` 输出根，以及翻译单元缓存、领域推断缓存、排版记忆这些输出根下的目录 |
| `output_layout` | 任务目录里 `source/`、`ocr/`、`translated/`、`rendered/`、`artifacts/`、`logs/` 的名字（可用环境变量改） |
| `local_env` | 读本地 `.env` 目录里的密钥（默认 `backend/pipeline/.env`，`RETAIN_PDF_ENV_DIR` 可改） |
| `credentials` | 解析 stage spec 里的 `credential_ref`（现在只支持 `env:<变量名>`） |
| `upstream` | 任务失败的上游信息 `{provider, http_status, code}`：翻译接口地址 → 错误码目录的服务商编号、各家响应体里的错误码、从异常上读（结构化失败的 `upstream`，见 `docs/api/08-调试诊断/01-失败结构.md`） |

## 测试

```sh
cd backend && uv run --package retainpdf-base pytest base/tests -q
```

事件协议本身的测试在流水线那边：`pipeline/devtools/tests/translation/test_pipeline_events_protocol.py`、
`pipeline/devtools/tests/pipeline/test_stdout_contract_schema.py`。
