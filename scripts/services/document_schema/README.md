# Document Schema 说明

`scripts/services/document_schema/` 存放统一中间文档结构的版本定义。

当前第一版目标很克制：

- 先定义 `normalized_document_v1`
- 只覆盖当前主链路真正消费的稳定字段
- 不试图一次性替代所有上游 OCR 语义

当前约定：

- schema 名称：`normalized_document_v1`
- schema 版本：`1.0`
- 默认文件名：`document.v1.json`

语义分层约定：

- `type / sub_type`
  表示稳定的原始块结构，不要求把所有高层语义都提前猜出来。
- `tags / markers`
  表示轻量派生标记，例如参考文献区、caption 等。
- `derived`
  表示更强的后处理语义结论，允许由 provider 规则、本地规则或后续大模型判断写入。

第一阶段只要求 `services/mineru` 双写这份产物：

- 原始 OCR：`ocr/unpacked/layout.json`
- 统一中间层：`ocr/normalized/document.v1.json`

主链路仍然默认读取原始 `layout.json`，后续再逐步切换到统一 schema。
