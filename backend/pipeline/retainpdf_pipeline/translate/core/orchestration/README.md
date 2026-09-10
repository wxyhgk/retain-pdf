# Orchestration 说明

`scripts/translate/core/orchestration` 负责给 OCR payload 补齐“编排元数据”。

它既不直接翻译，也不直接渲染，作用是把原始 OCR 块整理成更适合翻译和排版使用的中间状态。

## 主要文件

- `zones.py`
  页面布局分析，识别单栏/双栏和布局区。
- `units.py`
  生成和整理 `translation_unit_id`、`skip_reason` 等标准字段。
跨页 continuation review 已迁到 `services/continuation/orchestrator.py`。这一层只保留纯布局和元数据整理。

## 在总流程中的位置

`ocr payload -> orchestration -> translation policy / continuation / translation unit -> 翻译`
