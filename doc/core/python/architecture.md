# Python 后端架构边界

这份文档描述 `backend/scripts` 的长期维护边界。目标不是减少文件数量，而是保证代码增长后仍能定位、测试和修改。

## 总体分层

```text
entrypoints
  -> runtime/pipeline
    -> services/*
      -> foundation
```

职责：

- `entrypoints/`
  命令行入口，只解析参数并调用稳定服务入口。
- `runtime/pipeline/`
  阶段编排层，负责 OCR、翻译、渲染的顺序、阶段 spec、事件和产物交接。
- `services/`
  具体能力层，包含 OCR provider、document schema、translation、rendering 等业务能力。
- `foundation/`
  配置、共享基础工具和跨服务底层能力。

## 稳定子系统

```text
services/document_schema
services/ocr_provider
services/mineru
services/translation
services/rendering
services/pipeline_shared
runtime/pipeline
```

核心规则：

- OCR provider raw payload 必须先进入 `document_schema`，产出 `document.v1`。
- 翻译主链只消费 `document.v1` 和 translation stage spec。
- 渲染主链只消费源 PDF、translation manifest、逐页翻译 payload 和 render stage spec。
- `runtime/pipeline` 只负责编排，不吸收 provider、LLM、Typst、redaction 的细节。

## 渲染层边界

```text
services/rendering/workflow
  -> document / analysis
  -> source
  -> layout
  -> output
```

职责：

- `workflow/`
  串联渲染模式，选择 overlay、dual、background typst 等路径。
- `analysis/`
  页面画像、页面分类和页面渲染路线决策。
- `document/`
  页码映射、目录/书签复制和文档级辅助。
- `source/background/`
  生成 cleaned background PDF。
- `source/cleanup/`
  直接操作 PDF page，负责删除或覆盖原文区域。
- `layout/`
  把 translated items 转成 `RenderBlock` / page specs。
- `output/typst/`
  生成 Typst source，编译 overlay PDF，执行 overlay merge。
- `source/compression/`
  PDF 压缩。
- `layout/model/`
  渲染公共数据模型。

禁止方向：

- `output/typst` 不 import `source/cleanup`。
- `layout` 不 import `output/typst`、`source/cleanup`、`source/prepare`。
- `source/cleanup` 不 import `output/typst` 或高层 layout 逻辑。
- `runtime/pipeline` 不直接 import `services.rendering.output.typst`、`services.rendering.source.cleanup`、`services.rendering.layout`。

## 翻译层边界

```text
services/translation/workflow
  -> context
  -> policy
  -> memory
  -> llm
  -> payload
```

职责：

- `workflow/`
  翻译请求入口和执行门面。
- `context/`
  domain guidance、memory guidance 组合。
- `policy/`
  是否翻译、如何处理保留排版等策略。
- `memory/`
  job 级术语和保留排版记忆。
- `llm/`
  provider 调用、重试、校验和 fallback。
- `payload/`
  翻译产物协议。

禁止方向：

- `runtime/pipeline/translation_stage.py` 不直接 import `policy`、`llm`、`diagnostics` 内部细节。
- `translation` 不 import `services.rendering`。
- `translation` 不消费 provider raw JSON。

## OCR 边界

```text
ocr_provider / mineru
  -> document_schema
  -> document.v1
```

禁止方向：

- `ocr_provider` 不 import `services.translation`。
- `ocr_provider` 不 import `services.rendering`。
- `translation` 和 `rendering` 不 import `services.ocr_provider` 或 `services.mineru`。

## 公共入口

上层优先只调用这些入口：

- `services.ocr_provider.provider_pipeline`
- `services.document_schema.normalize_pipeline`
- `services.translation.workflow`
- `services.rendering.workflow.execute_render_plan`
- `runtime.pipeline.book_pipeline`

如果新增入口，必须同时更新：

- 本文档。
- 对应目录 README。
- `backend/scripts/devtools/check_pipeline_architecture.py`。

## 什么时候才继续拆文件

满足下面任一条件再拆：

- 一个文件超过 300 行且包含 3 种以上职责。
- 改一个小功能需要跨 5 个以上目录。
- 出现循环依赖。
- 同一逻辑重复出现在多个模块。
- 测试很难写，因为 IO、策略、数据结构混在一个函数里。

不满足这些条件时，优先补测试、补文档、补架构检查，而不是继续拆文件。
