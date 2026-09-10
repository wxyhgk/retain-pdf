# 流水线内部共享服务

这里是 Python 包内部的 `retainpdf_pipeline/services/`，不是仓库根目录已迁移的
旧 `services/`。当前仅保留 [pipeline_shared](pipeline_shared/README.md)：
跨阶段事件、stdout 协议、JSON IO、输入选择及 summary 等中性共享能力。

## 当前模块归属

| 职责 | 实际位置 |
| --- | --- |
| OCR provider、MinerU、文档结构与适配 | [ocr](../ocr/ocr_provider/README.md)、[document_schema](../ocr/document_schema/README.md)、[mineru](../ocr/mineru/README.md) |
| 翻译策略、模型调用与结果回填 | [translate](../translate/README.md) |
| 排版、渲染与 PDF 输出 | [render](../render/README.md) |
| 流程编排 | [runtime/pipeline](../runtime/pipeline/README.md) |
| 公共配置与基础工具 | [foundation/config](../foundation/config/README.md)、[foundation/shared](../foundation/shared/README.md) |

原先将这些实现列在本目录下的说明已经过时；不要重新创建
`services/translation`、`services/rendering` 或 provider 实现副本。

## 边界

- `pipeline_shared` 不放 provider 私有语义、翻译策略或渲染实现。
- OCR 原始输出先经文档适配层转成规范输入，再交给后续阶段消费。
- 修改跨阶段协议时同步上下游消费者及测试，不通过移动目录改变协议。
- 模块专用测试与开发工具仍跟随对应模块；这里不引入新的公共库层级。
