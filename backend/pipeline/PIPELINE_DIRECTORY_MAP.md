# Python Pipeline Directory Map

这份文档只回答一个问题：

**现在要改 `backend/pipeline`，应该先进哪个目录。**

包内 canonical 命名空间是 `retainpdf_pipeline`。
三个 stage 目录（`ocr/`、`translate/`、`render/`）各自是独立进程入口：

- `python -m retainpdf_pipeline.ocr <provider-ocr|provider-case|normalize-ocr> --spec ...`
- `python -m retainpdf_pipeline.translate --spec ...`
- `python -m retainpdf_pipeline.render --spec ...`

生产 book 编排由 Rust 按顺序调这三个进程；
包内 [`runtime/pipeline/book_pipeline.py`](./retainpdf_pipeline/runtime/pipeline/book_pipeline.py)
只剩本地串联，不再是生产主链。

## 最常见入口

- 改人工执行入口：
  [`retainpdf_pipeline/entrypoints/`](./retainpdf_pipeline/entrypoints)
  （console-mode 实现；顶层 `entrypoints/` 已清空，不要再进）
- 改 book 本地串联：
  [`retainpdf_pipeline/runtime/pipeline/`](./retainpdf_pipeline/runtime/pipeline)
- 改 OCR provider 接入：
  [`retainpdf_pipeline/ocr/ocr_provider/`](./retainpdf_pipeline/ocr/ocr_provider)
- 改统一 OCR 契约：
  [`retainpdf_pipeline/ocr/document_schema/`](./retainpdf_pipeline/ocr/document_schema)
- 改翻译主链（含翻译阶段门面）：
  [`retainpdf_pipeline/translate/`](./retainpdf_pipeline/translate)
- 改渲染主链（含渲染阶段门面）：
  [`retainpdf_pipeline/render/`](./retainpdf_pipeline/render)

## 一眼看懂主链

### provider-backed 全流程

生产（Rust 顺序调三进程，不经过 book_pipeline）：

```text
python -m retainpdf_pipeline.ocr provider-case --spec <job_root>/specs/provider.spec.json
  -> ocr/ocr_provider/provider_pipeline.py
     -> ocr/mineru/* 或 ocr/ocr_provider/paddle_api.py
     -> ocr/document_schema/*
python -m retainpdf_pipeline.translate --spec <job_root>/specs/translate.spec.json
  -> translate/entrypoints/translate_only_pipeline.py
     -> translate/translation_stage.py
        -> translate/*
python -m retainpdf_pipeline.render --spec <job_root>/specs/render.spec.json
  -> render/workflow/render_only.py
     -> render/render_stage.py
        -> render/*
```

本地一次性串联仍可用
`retainpdf-pipeline provider-case --spec <job_root>/specs/provider.spec.json`
或包内 `runtime/pipeline/book_pipeline.py`（仅本地，不代表生产路径）。

### normalized OCR -> translate -> render

生产同样是 Rust 顺序调 translate / render 两个进程。
本地串联入口：

```text
retainpdf-pipeline book --spec <job_root>/specs/book.spec.json
  -> translate/entrypoints/from_ocr_pipeline.py
     -> runtime/pipeline/book_pipeline.py（仅本地串联）
        -> translate/translation_stage.py
        -> render/render_stage.py
```

### translate-only

```text
python -m retainpdf_pipeline.translate --spec <job_root>/specs/translate.spec.json
  -> translate/entrypoints/translate_only_pipeline.py
     -> translate/translation_stage.py
        -> translate/*
```

console 别名：`retainpdf-pipeline translate-only --spec <job_root>/specs/translate.spec.json`。

### render-only

```text
python -m retainpdf_pipeline.render --spec <job_root>/specs/render.spec.json
  -> render/workflow/render_only.py
     -> render/render_stage.py
        -> render/*
```

console 别名：`retainpdf-pipeline render-only --spec <job_root>/specs/render.spec.json`。

## 顶层目录地图

### `retainpdf_pipeline/entrypoints/`

- 作用：
  console-mode 入口实现，只做参数接收、异常包装、把调用导向各 stage 稳定入口。
- 不该做的事：
  不自己拼 provider 流程，不直接碰翻译/渲染深层实现。
- 典型入口（`retainpdf-pipeline <subcommand>` 经由 `console.py` 分发）：
  - `retainpdf-pipeline provider-case --spec <job_root>/specs/provider.spec.json`
    provider-backed full flow 本地总入口。
  - `retainpdf-pipeline book --spec <job_root>/specs/book.spec.json`
    normalized OCR -> translate -> render 本地总入口。
  - `retainpdf-pipeline translate-only --spec <job_root>/specs/translate.spec.json`
    纯翻译入口（生产等价物为 `python -m retainpdf_pipeline.translate`）。
  - `retainpdf-pipeline render-only --spec <job_root>/specs/render.spec.json`
    纯渲染入口（生产等价物为 `python -m retainpdf_pipeline.render`）。

注意：源码树顶层的 `entrypoints/` 已清空（仅剩历史 `__pycache__`），不要再进；
正式入口实现只在 `retainpdf_pipeline/entrypoints/`。

### `retainpdf_pipeline/runtime/pipeline/`

- 作用：
  本地串联收口，只剩 [`book_pipeline.py`](./retainpdf_pipeline/runtime/pipeline/book_pipeline.py)，
  负责把翻译阶段和渲染阶段在本地进程内串起来并汇总结果。
- 不该做的事：
  不理解 provider raw JSON，不吸收翻译策略细节，不实现 PDF 底层渲染；
  生产 book 编排不在这里，由 Rust 顺序调 `ocr / translate / render` 三进程。
- 关键文件：
  - [`book_pipeline.py`](./retainpdf_pipeline/runtime/pipeline/book_pipeline.py)
    本地 `translate -> render` 串联（生产不用这条路径）。

翻译 / 渲染的阶段门面已经搬进各自 stage 目录，不在这里：

  - 翻译阶段门面：
    [`translate/translation_stage.py`](./retainpdf_pipeline/translate/translation_stage.py)
  - 渲染阶段门面：
    [`render/render_stage.py`](./retainpdf_pipeline/render/render_stage.py)
  - 翻译产物读取：
    [`render/translation_loader.py`](./retainpdf_pipeline/render/translation_loader.py)
  - render-only 输入协议收口：
    [`render/render_inputs.py`](./retainpdf_pipeline/render/render_inputs.py)

### `retainpdf_pipeline/ocr/document_schema/`

- 作用：
  OCR 统一中间契约层。
- 进入条件：
  改 raw OCR -> `document.v1.json` 的适配、字段默认值、schema 校验时进这里。
- 关键文件：
  - [`normalize_pipeline.py`](./retainpdf_pipeline/ocr/document_schema/normalize_pipeline.py)
    normalize worker 入口（`python -m retainpdf_pipeline.ocr normalize-ocr`）。
  - [`adapters.py`](./retainpdf_pipeline/ocr/document_schema/adapters.py)
    raw provider -> normalized document 总适配口。
  - [`reporting.py`](./retainpdf_pipeline/ocr/document_schema/reporting.py)
    normalization summary/report 读取。

### `retainpdf_pipeline/ocr/ocr_provider/`

- 作用：
  provider-backed OCR 总入口与 provider 协议收口。
- 进入条件：
  改 provider 分发、Paddle API 调用、provider-backed worker 主线时进这里。
- 关键文件：
  - [`provider_pipeline.py`](./retainpdf_pipeline/ocr/ocr_provider/provider_pipeline.py)
    当前 provider-backed full flow 稳定入口，
    `python -m retainpdf_pipeline.ocr <provider-ocr|provider-case>` 即进这里。
  - [`paddle_api.py`](./retainpdf_pipeline/ocr/ocr_provider/paddle_api.py)
    Paddle 异步 API 接入。
  - [`paddle_markdown.py`](./retainpdf_pipeline/ocr/ocr_provider/paddle_markdown.py)
    Paddle Markdown 与图片产物落盘。
  - [`paddle_normalize.py`](./retainpdf_pipeline/ocr/ocr_provider/paddle_normalize.py)
    Paddle normalized document 几何修正等纯实现。

### `retainpdf_pipeline/ocr/mineru/`

- 作用：
  MinerU provider 的具体实现。
- 进入条件：
  只在改 MinerU provider transport、下载、解包和产物整理时进这里。
- 注意：
  这里是 provider 实现，不是 OCR 总线，也不是翻译/渲染主链。

### `retainpdf_pipeline/translate/`

- 作用：
  把 `document.v1.json` 变成稳定翻译产物；翻译阶段门面也在这里。
- 进入条件：
  改翻译策略、LLM 调度、continuation、payload 落盘、diagnostics 时进这里。
- 关键文件：
  - [`__main__.py`](./retainpdf_pipeline/translate/__main__.py)
    `python -m retainpdf_pipeline.translate` 进程入口。
  - [`translation_stage.py`](./retainpdf_pipeline/translate/translation_stage.py)
    翻译阶段门面（原 `runtime/pipeline/translation_stage.py` 已搬到这里）。
  - [`entrypoints/from_ocr_pipeline.py`](./retainpdf_pipeline/translate/entrypoints/from_ocr_pipeline.py)
    normalized OCR -> translate -> render 的 worker 包装入口。
  - [`entrypoints/translate_only_pipeline.py`](./retainpdf_pipeline/translate/entrypoints/translate_only_pipeline.py)
    translate-only worker 包装入口。
  - [`workflow/translation_workflow.py`](./retainpdf_pipeline/translate/workflow/translation_workflow.py)
    单页翻译流程。
  - [`llm/README.md`](./retainpdf_pipeline/translate/llm/README.md)
    LLM 目录边界说明。

### `retainpdf_pipeline/render/`

- 作用：
  把翻译产物和源 PDF 变成最终 PDF；渲染阶段门面也在这里。
- 进入条件：
  改 overlay、Typst、背景修复、压缩、render-only 协议时进这里。
- 关键文件：
  - [`__main__.py`](./retainpdf_pipeline/render/__main__.py)
    `python -m retainpdf_pipeline.render` 进程入口。
  - [`render_stage.py`](./retainpdf_pipeline/render/render_stage.py)
    渲染阶段门面（原 `runtime/pipeline/render_stage.py` 已搬到这里）。
  - [`translation_loader.py`](./retainpdf_pipeline/render/translation_loader.py)
    读取 `translation-manifest.json` 和逐页 payload。
  - [`render_inputs.py`](./retainpdf_pipeline/render/render_inputs.py)
    render-only 输入协议收口。
  - [`workflow/render_only.py`](./retainpdf_pipeline/render/workflow/render_only.py)
    render-only worker 包装入口。
  - [`workflow/`](./retainpdf_pipeline/render/workflow)
    渲染流程编排入口。
  - [`output/typst/`](./retainpdf_pipeline/render/output/typst)
    Typst 输出主链。

### `retainpdf_pipeline/services/pipeline_shared/`

- 作用：
  provider / translate / render 共享的 stdout contract、summary、events、JSON IO。
- 不该做的事：
  不放 provider 私有逻辑，也不放翻译/渲染算法细节。
- 注意：
  `retainpdf_pipeline/services/` 下只有 `pipeline_shared/` 仍有实体文件；
  `translation/`、`rendering/`、`ocr_provider/`、`document_schema/`、`mineru/` 等
  只是搬家后留下的空壳目录，不要再进，实体分别在顶层的
  `translate/`、`render/`、`ocr/` 下。

### `retainpdf_pipeline/foundation/`

- 作用：
  配置、路径、stage spec、共享工具、prompt loader。
- 进入条件：
  改跨模块共享配置或 stage spec 协议时进这里。

### `devtools/`

- 作用：
  调试、回归、探针、实验脚本。
- 不该做的事：
  不能反向成为主链路依赖。

## 快速判断

- “这是入口参数或 worker 启动方式变化吗？”
  先看 `retainpdf_pipeline/entrypoints/` 或各 stage 的 `__main__.py`
- “这是 book 阶段顺序或输入输出协议变化吗？”
  先看 `retainpdf_pipeline/runtime/pipeline/`（本地串联）与 Rust 三进程编排；
  生产行为以 Rust 侧为准
- “这是 raw OCR 适配或 schema 变化吗？”
  先看 `retainpdf_pipeline/ocr/document_schema/`
- “这是 provider 接入问题吗？”
  先看 `retainpdf_pipeline/ocr/ocr_provider/` 或 `retainpdf_pipeline/ocr/mineru/`
- “这是翻译结果不对吗？”
  先看 `retainpdf_pipeline/translate/`（含 `translation_stage.py`）
- “这是 PDF 渲染不对吗？”
  先看 `retainpdf_pipeline/render/`（含 `render_stage.py`）

## 三条边界红线

- 编排层（Rust 三进程编排 + 本地 `runtime/pipeline/book_pipeline.py`）
  不理解 provider raw JSON，也不直接 import provider 私有实现。
- `translate/` 和 `render/` 不消费 provider raw 结构，只消费稳定交接物。
- `entrypoints/` 只连稳定入口，不绕过各 stage 的 `*_pipeline.py` /
  `translation_stage.py` / `render_stage.py` / `render/workflow/render_only.py`
  直连深层实现。

## 新人阅读顺序

1. [`README.md`](./README.md)
   先知道整体目录和正式入口。
2. [`PIPELINE_DIRECTORY_MAP.md`](./PIPELINE_DIRECTORY_MAP.md)
   再知道改哪里。
3. [`retainpdf_pipeline/runtime/pipeline/README.md`](./retainpdf_pipeline/runtime/pipeline/README.md)
   看阶段边界（注意 book 生产编排在 Rust，包内仅本地串联）。
4. [`retainpdf_pipeline/services/README.md`](./retainpdf_pipeline/services/README.md)
   看 services 总分工（实体只剩 `pipeline_shared`）。
5. 再按模块进入 `translate/`、`render/`、`ocr/ocr_provider/`、`ocr/document_schema/`、
   `ocr/mineru/` 的 README。
