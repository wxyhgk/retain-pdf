# retainpdf-translation-classic

普通翻译引擎（`import retainpdf_translation_classic`），2026-11-20 从翻译包 `retainpdf-translation` 拆出来
（方案见 [翻译包拆成底座和两个引擎](../../docs/ops/planning/translation-package/20261120-翻译包拆成底座和两个引擎.md)）。
任务的 `translation.engine=legacy`（默认）时跑它。

- 管什么：批量逐块翻（`workflow/book_flow.py`、`workflow/batching/`、`workflow/scheduling/`、`llm/shared/orchestration/`）、
  流式跟着 OCR 翻（`workflow/streaming_flow.py`）、乱码重构和修复兜底（`services/agents/`、`services/postprocess/`）、
  译前准备（`services/preparation/`、`workflow/preparation_step.py`）、精修和编辑部（`services/refine/`、`services/editorial/`）、
  表格翻译（`services/tables/`）、任务记忆（`services/memory/`）、结果缓存（`llm/shared/cache/`）。
- 目录结构和翻译包一样：原来的 `retainpdf_translation.workflow.book_flow` 现在是 `retainpdf_translation_classic.workflow.book_flow`，
  别的路径照此类推。同一个目录里留在底座的（规则审查器、审校汇总、记忆更新器协议、并发参数）还在翻译包。
- 依赖翻译包（底座：读文档、接续段、页面策略、回填、断点、清单、质检、请求层、提示词），**翻译包不依赖这里**：
  执行入口经引擎登记表 `retainpdf_translation.workflow.engines` 按「模块:函数」字符串延迟加载。提示词留在翻译包的 `prompts/`。
- 给流水线的门面：`retainpdf_translation_classic.public`（渲染前精修 `run_refine_for_render`、表格翻译）。
- 边界由流水线架构检查 `backend/pipeline/devtools/architecture_checks/translation_engines.py` 卡：
  哪些模块属于这里（`CLASSIC_MODULES`）、放没放对包、翻译包有没有 import 这里。别的翻译规则（分层、私有符号……）
  把这个包当成翻译包挂进来的一部分，规则照旧写 `retainpdf_translation.X`。
- 测试：行为测试和翻译包一起在 `backend/pipeline/devtools/tests/translation`（`run_translation_tests.py`）；
  这里的 `tests/` 只有冒烟测试。
