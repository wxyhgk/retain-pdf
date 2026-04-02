# Orchestration 说明

`scripts/services/translation/orchestration` 负责给 OCR payload 补齐“编排元数据”。

它既不直接翻译，也不直接渲染，作用是把原始 OCR 块整理成更适合翻译和排版使用的中间状态。

## 主要文件

- `zones.py`
  页面布局分析，识别单栏/双栏和布局区。
- `units.py`
  生成和整理 `translation_unit_id`、`skip_reason` 等标准字段。
- `document_orchestrator.py`
  把布局区标注、candidate continuation review、元数据收口串起来。

## 在总流程中的位置

`ocr payload -> orchestration -> translation policy / continuation / translation unit -> 翻译`
