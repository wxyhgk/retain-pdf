# Python Pipeline Directory Map

这份文档只回答一个问题：

**现在要改 `backend/scripts`，应该先进哪个目录。**

## 最常见入口

- 改人工执行入口：
  [`entrypoints/`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints)
- 改阶段编排总线：
  [`runtime/pipeline/`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline)
- 改 OCR provider 接入：
  [`services/ocr_provider/`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider)
- 改统一 OCR 契约：
  [`services/document_schema/`](/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema)
- 改翻译主链：
  [`services/translation/`](/home/wxyhgk/tmp/Code/backend/scripts/services/translation)
- 改渲染主链：
  [`services/rendering/`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering)

## 一眼看懂主链

### provider-backed 全流程

```text
entrypoints/run_provider_case.py
  -> services/ocr_provider/provider_pipeline.py
     -> services/mineru/* 或 services/ocr_provider/paddle_api.py
     -> services/document_schema/*
     -> runtime/pipeline/book_pipeline.py
        -> runtime/pipeline/translation_stage.py
           -> services/translation/*
        -> runtime/pipeline/render_stage.py
           -> services/rendering/*
```

### normalized OCR -> translate -> render

```text
entrypoints/run_book.py
  -> services/translation/from_ocr_pipeline.py
     -> runtime/pipeline/book_pipeline.py
        -> translation_stage.py
        -> render_stage.py
```

### translate-only

```text
entrypoints/run_translate_only.py
  -> services/translation/translate_only_pipeline.py
     -> runtime/pipeline/translation_stage.py
        -> services/translation/*
```

### render-only

```text
entrypoints/run_render_only.py
  -> services/rendering/workflow/render_only.py
     -> runtime/pipeline/render_stage.py
        -> services/rendering/*
```

## 顶层目录地图

### `entrypoints/`

- 作用：
  最外层入口，只做参数接收、异常包装、把调用导向稳定入口。
- 不该做的事：
  不自己拼 provider 流程，不直接碰翻译/渲染深层实现。
- 典型文件：
  - [`run_provider_case.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_provider_case.py)
    provider-backed full flow 总入口。
  - [`run_book.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_book.py)
    normalized OCR -> translate -> render 总入口。
  - [`run_translate_only.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_translate_only.py)
    纯翻译入口。
  - [`run_render_only.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_render_only.py)
    纯渲染入口。

### `runtime/pipeline/`

- 作用：
  阶段编排总线，只负责组织顺序、阶段输入输出和汇总结果。
- 不该做的事：
  不理解 provider raw JSON，不吸收翻译策略细节，不实现 PDF 底层渲染。
- 关键文件：
  - [`book_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/book_pipeline.py)
    顶层 `translate -> render` 编排。
  - [`translation_stage.py`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/translation_stage.py)
    纯翻译阶段入口。
  - [`render_stage.py`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/render_stage.py)
    纯渲染阶段入口。
  - [`translation_loader.py`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/translation_loader.py)
    读取 `translation-manifest.json` 和逐页 payload。
  - [`render_inputs.py`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/render_inputs.py)
    render-only 输入协议收口。

### `services/document_schema/`

- 作用：
  OCR 统一中间契约层。
- 进入条件：
  改 raw OCR -> `document.v1.json` 的适配、字段默认值、schema 校验时进这里。
- 关键文件：
  - [`normalize_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema/normalize_pipeline.py)
    normalize worker 入口。
  - [`adapters.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema/adapters.py)
    raw provider -> normalized document 总适配口。
  - [`reporting.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema/reporting.py)
    normalization summary/report 读取。

### `services/ocr_provider/`

- 作用：
  provider-backed OCR 总入口与 provider 协议收口。
- 进入条件：
  改 provider 分发、Paddle API 调用、provider-backed worker 主线时进这里。
- 关键文件：
  - [`provider_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/provider_pipeline.py)
    当前 provider-backed full flow 稳定入口，也是脚本/测试依赖的兼容面。
  - [`paddle_api.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_api.py)
    Paddle 异步 API 接入。
  - [`paddle_markdown.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_markdown.py)
    Paddle Markdown 与图片产物落盘。
  - [`paddle_normalize.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_normalize.py)
    Paddle normalized document 几何修正等纯实现。

### `services/mineru/`

- 作用：
  MinerU provider 的具体实现。
- 进入条件：
  只在改 MinerU provider transport、下载、解包和产物整理时进这里。
- 注意：
  这里是 provider 实现，不是 OCR 总线，也不是翻译/渲染主链。

### `services/translation/`

- 作用：
  把 `document.v1.json` 变成稳定翻译产物。
- 进入条件：
  改翻译策略、LLM 调度、continuation、payload 落盘、diagnostics 时进这里。
- 关键文件：
  - [`from_ocr_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/translation/from_ocr_pipeline.py)
    normalized OCR -> translate -> render 的 worker 包装入口。
  - [`translate_only_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/translation/translate_only_pipeline.py)
    translate-only worker 包装入口。
  - [`workflow/translation_workflow.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/translation/workflow/translation_workflow.py)
    单页翻译流程。
  - [`llm/README.md`](/home/wxyhgk/tmp/Code/backend/scripts/services/translation/llm/README.md)
    LLM 目录边界说明。

### `services/rendering/`

- 作用：
  把翻译产物和源 PDF 变成最终 PDF。
- 进入条件：
  改 overlay、Typst、背景修复、压缩、render-only 协议时进这里。
- 关键文件：
  - [`workflow/render_only.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/workflow/render_only.py)
    render-only worker 包装入口。
  - [`workflow/`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/workflow)
    渲染流程编排入口。
  - [`output/typst/`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/output/typst)
    Typst 输出主链。

### `services/pipeline_shared/`

- 作用：
  provider / translate / render 共享的 stdout contract、summary、events、JSON IO。
- 不该做的事：
  不放 provider 私有逻辑，也不放翻译/渲染算法细节。

### `foundation/`

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
  先看 `entrypoints/`
- “这是阶段顺序或输入输出协议变化吗？”
  先看 `runtime/pipeline/`
- “这是 raw OCR 适配或 schema 变化吗？”
  先看 `services/document_schema/`
- “这是 provider 接入问题吗？”
  先看 `services/ocr_provider/` 或 `services/mineru/`
- “这是翻译结果不对吗？”
  先看 `services/translation/`
- “这是 PDF 渲染不对吗？”
  先看 `services/rendering/`

## 三条边界红线

- `runtime/pipeline/` 不理解 provider raw JSON，也不直接 import provider 私有实现。
- `services/translation/` 和 `services/rendering/` 不消费 provider raw 结构，只消费稳定交接物。
- `entrypoints/` 只连稳定入口，不绕过 `*_pipeline.py` 或 `runtime/pipeline/*` 直连深层实现。

## 新人阅读顺序

1. [`README.md`](/home/wxyhgk/tmp/Code/backend/scripts/README.md)
   先知道整体目录和正式入口。
2. [`PIPELINE_DIRECTORY_MAP.md`](/home/wxyhgk/tmp/Code/backend/scripts/PIPELINE_DIRECTORY_MAP.md)
   再知道改哪里。
3. [`runtime/pipeline/README.md`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/README.md)
   看阶段边界。
4. [`services/README.md`](/home/wxyhgk/tmp/Code/backend/scripts/services/README.md)
   看 services 总分工。
5. 再按模块进入 `translation/`、`rendering/`、`ocr_provider/` 的 README。
