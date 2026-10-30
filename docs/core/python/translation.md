# 翻译层说明

本文记录当前 Python 翻译层的稳定边界、目录职责和排查入口。这里描述的是主线契约，不记录临时迁移过程。

## 位置与职责

翻译层是独立包 `retainpdf-translation`（`import retainpdf_translation`），和流水线、公式包、底座包并列：

```text
backend/translation/retainpdf_translation/
```

流水线里的 `backend/pipeline/retainpdf_pipeline/translate/` 只剩 worker 外壳（`__main__.py`、`entrypoints/`、
`translation_stage.py`）：Rust 照旧用 `python -m retainpdf_pipeline.translate --spec ...` 启动，外壳读 spec、建任务目录，
再调翻译包的 `retainpdf_translation.public`。翻译包只依赖 `retainpdf_base`、`retainpdf_math`，不 import 流水线。
翻译的测试仍在 `backend/pipeline/devtools/tests/translation`。

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
- `backend/translation/retainpdf_translation/public`
  翻译包对外的门面；worker 外壳 `backend/pipeline/retainpdf_pipeline/translate/translation_stage.py` 通过这里进入翻译执行。

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
  page-001.json
  page-002.json
  ...
artifacts/
  translation_diagnostics.json
  translation_debug_index.json
```

每页文件名不带模型名（`workflow/legacy/page_translation.py` 的 `default_page_translation_name`）。2026-10-30 以前叫 `page-001-deepseek.json`；
旧任务的目录照旧能读（读的一侧只认 `translation-manifest.json` 里登记的路径），升级前开始、升级后续跑的任务，已有旧名字文件的那一页沿用旧名字（`page_translation_path`），不会出现同一页两份。

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

### 一段话占好几个框：模型翻整段，程序切回各框

跨栏、跨页的续接组（`cg-*`）和摘要组（`abstract:*`）都是一个翻译单元（`__cg__:…`）：

1. **拼原文**：成员原文按阅读顺序拼成一段（`core/payload/parts/units.py::join_member_sources`）。
   栏尾连字符直接接上；OCR 把前一块末尾的半个词补全、后一块开头仍留着后半截时（"calculations." + "tions in…"），删掉残片和多补的句号。
2. **翻译**：模型只翻这一整段，不知道、也不负责框的分界。
3. **切回各框**：`core/payload/parts/group_split.py::split_group_protected_translation` 按各成员原文的长度比例找切点，
   优先切在句末、分句标点之后，下一块不以标点开头。公式（`$…$`、`<f1-abc/>`、`[[FORMULA_n]]`）不可拆；
   direct_typst 下 `$` 不成对时整段放进第一个框，不切。

不要让模型按原来的分界逐框返回译文：英文在句中断栏，中文语序对不上（目的状语前置、复合词被切开），
模型会把跨分界的半句挪进前一块翻完，再把后一块原样交回英文，而整段检查看不出来。

### 逐段请求的提示词排法

逐段请求（整批失败后的逐段重试、续接组、长段）的 user 消息按固定顺序排
（`llm/shared/prompt_protocols.py::direct_typst_single_user_prompt` / `plain_text_single_user_prompt`）：

```text
任务说明
【前文开始（仅供理解，禁止翻译进输出）】…【前文结束】
【后文开始（仅供理解，禁止翻译进输出）】…【后文结束】
【当前原文开始】…【当前原文结束】
针对这段原文的注意事项（公式定界符、术语、结构、风格、续接、半句照翻）
现在直接输出【当前原文】的…译文。（最后一行）
```

作答要求必须是最后一行，原文后面不要再跟上下文。以前作答要求夹在中间、原文后面还跟着「后文上下文：……」，
模型读完一串「某某：内容」的小节，会照着格式自己补一个「译文：」再写译文。
不要靠事后删标签来补：模型输出出现标签，先回头看提示词哪里留了这个空。

只改这两个函数不会让翻译缓存失效：缓存键里的 `prompt_hash` 只覆盖 `prompts/*.txt`。

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
uv run --project backend python -m compileall -q backend/translation/retainpdf_translation backend/pipeline/retainpdf_pipeline/translate
uv run --project backend python -m pytest backend/translation/tests -q
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
