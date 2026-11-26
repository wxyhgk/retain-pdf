# Orchestration 说明

`retainpdf_translation/core/orchestration` 负责给 OCR payload 补齐“编排元数据”。

它既不直接翻译，也不直接渲染，作用是把原始 OCR 块整理成更适合翻译和排版使用的中间状态。

## 主要文件

- `zones.py`
  页面布局分析，识别单栏/双栏和布局区。
- `units.py`
  生成和整理 `translation_unit_id`、`skip_reason` 等标准字段。
  第一步先把重新分出来的接续组里「有译文的块和没译的块拼在一起」的拆开（`keep_translated_blocks_out_of_mixed_groups`，续跑用，
  见 `services/continuation/README.md`）：上一轮整组一起译完的单元留在一起，只把没译的块挪出去；拆不回原单元的块只留它自己那一段译文。
跨页 continuation review 已迁到 `services/continuation/orchestrator.py`。这一层只保留纯布局和元数据整理。

## 在总流程中的位置

`ocr payload -> orchestration -> translation policy / continuation / translation unit -> 翻译`
