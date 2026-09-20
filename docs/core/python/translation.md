# 翻译层说明

本文记录当前 Python 翻译层的稳定边界、目录职责和排查入口。这里描述的是主线契约，不记录临时迁移过程。

## 位置与职责

翻译层位于：

```text
backend/pipeline/retainpdf_pipeline/translate/
```

它只负责把标准化 OCR 文档变成可渲染的翻译产物：

```text
document.v1.json
-> per-page translation payload
-> translation-manifest.json
-> translation diagnostics/debug index
```

翻译层不负责：

- 调用 OCR provider、下载 provider zip 或解析 provider raw JSON。
- 修改源 PDF、擦除英文、生成 Typst overlay 或写最终 PDF。
- 直接处理 Rust API 的 HTTP 请求和 job 状态机。

稳定上游输入是 `ocr/normalized/document.v1.json`。稳定下游输出是 `translated/translation-manifest.json` 加逐页 payload JSON。

## 主入口

外部和 stage worker 不应直接拼翻译内部模块，优先走这些入口：

- `python -m retainpdf_pipeline.translate --spec <job_root>/specs/translate.spec.json`
  `translate.stage.v1` worker，要求 `--spec <job_root>/specs/translate.spec.json`。
- `retainpdf-pipeline translate-from-ocr --spec <job_root>/specs/book.spec.json`
  provider/normalize 后继续翻译和渲染的入口之一（顶层垫片已删除，只有包内入口 `backend/pipeline/retainpdf_pipeline/translate/entrypoints/from_ocr_pipeline.py` 和 console 子命令，仅桌面兼容注脚）。
- `backend/pipeline/retainpdf_pipeline/translate/workflow`
  翻译层内部 facade，`backend/pipeline/retainpdf_pipeline/translate/translation_stage.py` 通过这里进入翻译执行。

Rust 固定使用配置的 `PYTHON_BIN` 启动上述模块入口，不再回退到旧脚本。
`retainpdf-pipeline translate-only` 仍可用于手动调用相同的翻译阶段。

当前 stage spec 里的 `start_page` / `end_page` 是 0 基页码，`end_page=0` 表示只处理第一页，不能被当成未设置值。

## 目录分层

当前一级目录按职责拆分：

| 目录 | 职责 |
| --- | --- |
| `workflow/` | 翻译流程编排：加载输入、生成执行计划、跑 continuation/policy/batch、写 manifest 和 summary。 |
| `ocr/` | 只读取 `document.v1.json`，抽取可翻译 block，投影成 translation payload item。 |
| `payload/` | payload 协议、模板、公式保护、结果回填、manifest 写出。 |
| `policy/` | 是否翻译、技术块 hint、正文过滤、模式配置。 |
| `context/` | 翻译上下文、邻近窗口、执行上下文模型。 |
| `continuation/` | 同页/跨页连续段候选、规则和审阅。 |
| `orchestration/` | translation unit、layout zone、文档级编排元数据。 |
| `batching/` | pending item 收集、去重、快路径、批次划分、并发队列入口。 |
| `results/` | 翻译结果应用、重复 item 展开、job memory 更新、周期性刷盘。 |
| `llm/` | provider runtime、prompt 协议、缓存、响应解析、重试和校验。 |
| `memory/` | job 级术语/缩写/稳定翻译记忆的候选、过滤、摘要和持久化。 |
| `terms/` | 术语表归一化、提示词注入和术语命中统计。 |
| `diagnostics/` | 翻译诊断、debug index、item 级定位信息。 |
| `classification/` | `precise` 模式下的可疑块分类。 |
| `fast_path/` | 明确无需模型翻译的 keep-origin 快路径。 |
| `postprocess/` | 翻译后轻量修复，例如乱码候选恢复。 |

历史路径 `backend/scripts/runtime/pipeline/book_translation_*.py` 的兼容 shim
已删除。新代码不要再依赖 `runtime.pipeline.book_translation_*`。

## 数据契约

### 输入

翻译层默认只消费 `document.v1` 的正式字段：

- `geometry`
- `content`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy`
- `provenance`

正文白名单是：

```text
content.kind == "text"
policy.translate == true
```

是否进入翻译应由 normalize/adapter 阶段显式决定。翻译层不再从 provider raw 字段、旧 `sub_type` 或 `metadata` 里重新猜正文。

### 输出

翻译输出固定为：

```text
translated/
  translation-manifest.json
  page-0001.json
  page-0002.json
  ...
artifacts/
  translation_diagnostics.json
  translation_debug_index.json
```

逐页 payload 的正式字段优先放在顶层，例如：

- `block_kind`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy_translate`
- `asset_id`
- `reading_order`
- `raw_block_type`
- `normalized_sub_type`

`metadata` 只用于调试、provider trace 和少量桥接信息，不作为新逻辑的正式语义入口。

## 执行流程

主流程可以简化为：

```text
load document.v1
-> extract text items
-> ensure page payload templates
-> initial continuation pass
-> optional continuation review
-> page policy/classification
-> finalize orchestration metadata
-> annotate context windows
-> collect pending translation units
-> dedupe / fast path / queue split
-> LLM translate with cache/retry/validation
-> apply results and flush pages
-> garbled reconstruction
-> write manifest, diagnostics, debug index
```

这里的 batch 执行已经从旧 runtime pipeline 拆出：

- `batching/` 决定哪些 item 进入哪些队列。
- `workflow/batch_runner.py` 执行串行或并行 batch。
- `results/` 负责回填和刷盘。

## 凭证与页范围

API key 不写入 stage spec。spec 只保存：

```json
"credential_ref": "env:RETAIN_TRANSLATION_API_KEY"
```

运行时由环境变量注入真实 key。

页范围字段是 0 基闭区间：

- `start_page=0, end_page=0`：只处理第一页。
- `start_page=0, end_page=-1`：从第一页处理到末页。

stage spec loader 必须保留合法的 `0`，不能用 `value or default` 解析页码。

## 调试入口

排查某个 job 的翻译问题时，优先看：

```text
data/jobs/<job_id>/translated/translation-manifest.json
data/jobs/<job_id>/artifacts/translation_diagnostics.json
data/jobs/<job_id>/artifacts/translation_debug_index.json
data/jobs/<job_id>/logs/pipeline_events.jsonl
```

判断一个 item 为什么未翻译、降级或保留原文：

1. 在 `translation_debug_index.json` 里找 item。
2. 看 `translation_diagnostics` 的 `route_path`、`output_mode_path`、`error_trace`、`fallback_to`。
3. 如需复现，使用已有 replay/debug 工具，不要手改 payload。

## 验证命令

翻译层改动后至少跑：

```bash
uv run --project backend python -m compileall -q backend/pipeline/retainpdf_pipeline/translate
PYTHONPATH=backend/pipeline uv run --project backend python -m pytest backend/pipeline/devtools/tests/translation -q
PYTHONPATH=backend/pipeline uv run --project backend python backend/pipeline/devtools/check_pipeline_architecture.py
```

如果改了 stage spec、页范围或 provider-backed workflow，还要跑：

```bash
PYTHONPATH=backend/pipeline uv run --project backend python -m pytest backend/pipeline/devtools/tests/document_schema/test_normalize_stage_spec.py -q
PYTHONPATH=backend/pipeline uv run --project backend python -m pytest backend/pipeline/devtools/tests/test_stage_spec_contract.py -q
```

`check_stage_specs_contract.py` 手动跑可以指一个真实 job 目录：

```bash
PYTHONPATH=backend/pipeline uv run --project backend python backend/pipeline/devtools/check_stage_specs_contract.py data/jobs --strict
```

注意 `--strict`：不加的话，扫不到任何 spec（干净 checkout 和 CI 上 `data/jobs` 就是
空的）直接返回 0，等于什么都没验。CI 里跑的是上面那条 pytest——它用
`tests/fixtures/golden-jobs/chem-6ada81-10p` 里固化的真实 spec 当输入，并额外断言
Rust 写出的 params key 集合和 Python loader 的字段集合完全相同。

## 边界规则

翻译层禁止反向依赖：

- `render`
- provider 私有 raw 结构
- `runtime.pipeline.book_translation_*`

新增代码应优先放进已有分层目录。架构边界以：

```text
backend/pipeline/devtools/check_pipeline_architecture.py
```

为准。
