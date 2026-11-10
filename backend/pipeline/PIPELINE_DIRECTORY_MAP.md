# Python Pipeline Directory Map

这份文档只回答一个问题：

**现在要改 `backend/pipeline`，应该先进哪个目录。**

包内命名空间是 `retainpdf_pipeline`，翻译逻辑在独立包 [`backend/translation/`](../translation/README.md)
（`retainpdf_translation`）。源码树顶层只有 `retainpdf_pipeline/` 和 `devtools/`。

## 生产上 Rust 怎么调 Python

整书编排在 Rust（`retainpdf-runner` 的 `job_runner`），Python 每个阶段是一个独立进程，只靠文件交接
（spec 进、产物出）。阶段命令统一是 `python -m <模块> [子命令] --spec <job_root>/specs/<阶段>.spec.json`，
在 `backend/packages/retainpdf-data/src/worker_command/entrypoints.rs` 里拼：

```text
OCR        Rust 自己提交、轮询、下载（MinerU、Paddle 官方 HTTP）
           或 python -m retainpdf_pipeline.ocr provider-ocr     本地命令型 OCR、Paddle 官方 CLI、
             -> ocr/ocr_provider/provider_pipeline.py          OCR 和翻译并行（目前只有 GLM-OCR）
规范化     python -m retainpdf_pipeline.ocr normalize-ocr
             -> ocr/document_schema/normalize_pipeline.py
领域预热   python -m retainpdf_pipeline.translate.entrypoints.domain_prewarm
翻译       python -m retainpdf_pipeline.translate
             -> translate/entrypoints/translate_only_pipeline.py
                -> translate/translation_stage.py -> retainpdf_translation
渲染准备   python -m retainpdf_pipeline.render.workflow.prepare_stage
渲染       python -m retainpdf_pipeline.render
             -> runtime/pipeline/render_only_pipeline.py      渲染前跑 refine、渲染后刷新译文质检
                -> render/workflow/render_only.py -> render/render_stage.py
```

渲染一定要经过 `runtime/pipeline/render_only_pipeline.py`：直接调 `render/workflow/render_only.py` 会悄悄跳过
refine 和质检（`render/__main__.py` 的说明）。

辅助任务走安装后的命令 `retainpdf-pipeline <子命令>`（命令名可用 `RUST_API_PIPELINE_COMMAND` 改）：
`merge-translated-artifacts`、`merge-translated-pdf`（书库合并）、`side-by-side-pdf`、`layout-docx`（衍生产物）、
`translation-revise`（改一条译文）、`diagnose-failure`（失败诊断）。
`RUST_API_PYTHON_ENTRYPOINT_MODE` 已退役，设了也只告警。

## 只在本地用的入口

`retainpdf-pipeline` 的这几个子命令 Rust 不调，只给人工本地跑：

- `book` / `translate-from-ocr`：`translate/entrypoints/from_ocr_pipeline.py` -> `runtime/pipeline/book_pipeline.py`，
  在一个进程里串起 normalized OCR -> 翻译 -> 渲染。
- `provider-case`：OCR 到渲染一条龙。
- `provider-ocr`、`normalize-ocr`、`translate-only`、`render-only`：和上面生产阶段同一套实现，方便单独跑一段。

子命令的分发在 [`retainpdf_pipeline/entrypoints/console.py`](./retainpdf_pipeline/entrypoints/console.py)。

## 最常见入口

- 改命令行入口：
  [`retainpdf_pipeline/entrypoints/`](./retainpdf_pipeline/entrypoints)，以及各阶段的 `__main__.py`
- 改 OCR 服务商接入：
  [`retainpdf_pipeline/ocr/ocr_provider/`](./retainpdf_pipeline/ocr/ocr_provider)
- 改统一 OCR 契约：
  [`retainpdf_pipeline/ocr/document_schema/`](./retainpdf_pipeline/ocr/document_schema)
- 改翻译主链：独立包 [`backend/translation/`](../translation/README.md)；
  流水线里的 [`retainpdf_pipeline/translate/`](./retainpdf_pipeline/translate) 只是 worker 外壳
- 改渲染主链：
  [`retainpdf_pipeline/render/`](./retainpdf_pipeline/render)
- 改渲染前后的 refine、质检：
  [`retainpdf_pipeline/runtime/pipeline/`](./retainpdf_pipeline/runtime/pipeline)

## 顶层目录地图

### `retainpdf_pipeline/entrypoints/`

- 作用：
  `retainpdf-pipeline` 命令的分发（`console.py`）和几个只属于命令行的入口（`revise_translation_item.py`、
  `diagnose_failure_with_ai.py`）。
- 不该做的事：
  不自己拼服务商流程，不直接碰翻译、渲染的深层实现。

### `retainpdf_pipeline/runtime/pipeline/`

- 作用：
  - [`render_only_pipeline.py`](./retainpdf_pipeline/runtime/pipeline/render_only_pipeline.py)：
    生产渲染进程的入口，渲染前跑 refine、渲染后刷新译文质检。
  - [`book_pipeline.py`](./retainpdf_pipeline/runtime/pipeline/book_pipeline.py)：
    本地 `book` 命令在一个进程里串翻译和渲染；生产不走这里。
- 不该做的事：
  不理解服务商原始 JSON，不吸收翻译策略细节，不实现 PDF 底层渲染。

### `retainpdf_pipeline/ocr/document_schema/`

- 作用：
  OCR 统一中间契约层。
- 进入条件：
  改原始 OCR -> `document.v1.json` 的适配、字段默认值、schema 校验时进这里。
- 关键文件：
  - [`normalize_pipeline.py`](./retainpdf_pipeline/ocr/document_schema/normalize_pipeline.py)
    规范化 worker（`python -m retainpdf_pipeline.ocr normalize-ocr`）。
  - [`adapters.py`](./retainpdf_pipeline/ocr/document_schema/adapters.py)
    原始结果 -> 规范化文档的总适配口；各家适配器在 `provider_adapters/`。
  - [`pdf_geometry.py`](./retainpdf_pipeline/ocr/document_schema/pdf_geometry.py)
    各家通用的几何：缩放到原文 PDF、没有真实行的块补行。
  - [`estimated_lines.py`](./retainpdf_pipeline/ocr/document_schema/estimated_lines.py)
    估行、拆行内公式片段。
  - [`finalize.py`](./retainpdf_pipeline/ocr/document_schema/finalize.py)
    规范化的最后几步（缩放 → 补行 → 刷新报告），所有规范化路径都调。
  - [`page_bounds.py`](./retainpdf_pipeline/ocr/document_schema/page_bounds.py)
    略微超出页边的块夹回页内。
  - [`reporting.py`](./retainpdf_pipeline/ocr/document_schema/reporting.py)
    规范化报告的读取和摘要。

### `retainpdf_pipeline/ocr/ocr_provider/`

- 作用：
  `provider-ocr` 的入口和服务商分发。
- 进入条件：
  改服务商分发、Python 侧的 Paddle / GLM-OCR 调用、OCR 流式公布时进这里。
- 关键文件：
  - [`provider_pipeline.py`](./retainpdf_pipeline/ocr/ocr_provider/provider_pipeline.py)
    `python -m retainpdf_pipeline.ocr provider-ocr` 的实现。
  - [`drivers.py`](./retainpdf_pipeline/ocr/ocr_provider/drivers.py)
    按 spec 里的服务商分发。
  - [`paddle_api.py`](./retainpdf_pipeline/ocr/ocr_provider/paddle_api.py)
    Paddle 异步 API 接入。
  - [`paddle_normalize.py`](./retainpdf_pipeline/ocr/ocr_provider/paddle_normalize.py)
    Paddle 的规范化文档落盘；几何在 `document_schema/pdf_geometry.py`。

### `retainpdf_pipeline/ocr/mineru_provider/`

- 作用：
  MinerU 的 Python 实现：产物路径和文件名约定（规范化阶段在用），以及手动跑 `provider-ocr` 时的提交、下载。
  生产上 MinerU 的提交、轮询、下载由 Rust 做（`retainpdf-runner` 的 `ocr_flow/mineru*.rs`）。

### `retainpdf_pipeline/translate/`（翻译 worker 外壳）

- 作用：
  Rust 用 `python -m retainpdf_pipeline.translate` 启动的翻译 worker 外壳：读 stage spec、建任务目录、写事件和 stdout 标签。
  把 `document.v1.json` 变成翻译产物的逻辑在翻译包。
- 进入条件：
  改 worker 的 spec 读取、stdout 协议、任务目录时进这里；改翻译策略、LLM 调度、续句、payload 落盘、诊断去翻译包。
- 关键文件：
  - [`__main__.py`](./retainpdf_pipeline/translate/__main__.py)
    `python -m retainpdf_pipeline.translate` 进程入口。
  - [`translation_stage.py`](./retainpdf_pipeline/translate/translation_stage.py)
    翻译阶段门面。
  - [`entrypoints/translate_only_pipeline.py`](./retainpdf_pipeline/translate/entrypoints/translate_only_pipeline.py)
    翻译 worker 包装入口。
  - [`entrypoints/domain_prewarm.py`](./retainpdf_pipeline/translate/entrypoints/domain_prewarm.py)
    领域预热进程入口。
  - [`entrypoints/from_ocr_pipeline.py`](./retainpdf_pipeline/translate/entrypoints/from_ocr_pipeline.py)
    本地 `book` / `translate-from-ocr` 命令的入口。

### `retainpdf_pipeline/render/`

- 作用：
  把翻译产物和源 PDF 变成最终 PDF。
- 进入条件：
  改 overlay、Typst、背景修复、压缩、render-only 协议时进这里。目录说明见
  [`render/README.md`](./retainpdf_pipeline/render/README.md)。
- 关键文件：
  - [`__main__.py`](./retainpdf_pipeline/render/__main__.py)
    `python -m retainpdf_pipeline.render` 进程入口（转到 `runtime/pipeline/render_only_pipeline.py`）。
  - [`render_stage.py`](./retainpdf_pipeline/render/render_stage.py)
    渲染阶段门面。
  - [`translation_loader.py`](./retainpdf_pipeline/render/translation_loader.py)
    读取 `translation-manifest.json` 和逐页 payload。
  - [`render_inputs.py`](./retainpdf_pipeline/render/render_inputs.py)
    render-only 输入协议收口。
  - [`workflow/render_only.py`](./retainpdf_pipeline/render/workflow/render_only.py)
    渲染 worker 本体。
  - [`workflow/prepare_stage.py`](./retainpdf_pipeline/render/workflow/prepare_stage.py)
    渲染准备进程入口。
  - [`output/typst/`](./retainpdf_pipeline/render/output/typst)
    Typst 输出主链。

### `retainpdf_pipeline/services/pipeline_shared/`

- 作用：
  只有依赖 OCR 规范化报告的 pipeline summary（`summary.py`）。stdout 标签、事件、JSON IO
  在底座包 [`backend/base`](../base/README.md)（`retainpdf_base`），流水线和翻译都从那里拿。
  `retainpdf_pipeline/services/` 下只有这一个子目录。

### `retainpdf_pipeline/foundation/`

- 作用：
  配置（`config/`）、提示词模板（`prompts/`）、共享工具（`shared/`：任务目录、stage spec、结构化错误等）。
- 进入条件：
  改跨阶段共享的配置或 stage spec 协议时进这里。

### `devtools/`

- 作用：
  测试、架构检查、调试、回归、探针、实验脚本。
- 不该做的事：
  不能反向成为主链路依赖。

## 快速判断

- “这是 worker 启动方式变化吗？”
  先看 Rust 的 `worker_command/entrypoints.rs`，再看各阶段 `__main__.py` 和 `retainpdf_pipeline/entrypoints/`
- “这是阶段顺序或阶段之间的输入输出变化吗？”
  先看 Rust 的 `retainpdf-runner` `job_runner`；生产行为以 Rust 侧为准
- “这是原始 OCR 适配或 schema 变化吗？”
  先看 `retainpdf_pipeline/ocr/document_schema/`
- “这是服务商接入问题吗？”
  先看 Rust 的 `ocr_flow/`（MinerU、Paddle HTTP），再看 `retainpdf_pipeline/ocr/ocr_provider/`（GLM-OCR、Paddle CLI、本地命令）
- “这是翻译结果不对吗？”
  先看翻译包 `backend/translation/retainpdf_translation/`；worker 外壳在 `retainpdf_pipeline/translate/`
- “这是 PDF 渲染不对吗？”
  先看 `retainpdf_pipeline/render/`

## 三条边界红线

- 编排（Rust `job_runner`、本地 `runtime/pipeline/book_pipeline.py`）不理解服务商原始 JSON，也不直接 import 服务商私有实现。
- `translate/`、`render/` 和翻译包不消费服务商原始结构，只消费 `document.v1.json` 和翻译产物这些交接物。
- `ocr/`、`translate/`、`render/` 三个阶段之间不互相 import；共享的读写契约照抄一份，由
  `devtools/architecture_checks/stage_contract_duplicates.py` 盯着不分叉。

## 新人阅读顺序

1. [`README.md`](./README.md)
   整体目录、阶段契约和产物。
2. 这份地图
   知道改哪里。
3. [`retainpdf_pipeline/runtime/pipeline/README.md`](./retainpdf_pipeline/runtime/pipeline/README.md)
   渲染进程的前后处理和本地串联。
4. 再按模块进入 `ocr/ocr_provider/`、`ocr/document_schema/`、`render/` 的 README，以及翻译包的 README。
