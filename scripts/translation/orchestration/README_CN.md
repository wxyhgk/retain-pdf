# Orchestration 说明

`scripts/translation/orchestration` 负责给 OCR payload 补齐“编排元数据”。

它既不直接翻译，也不直接渲染，作用是把原始 OCR 块整理成更适合翻译和排版使用的中间状态。

## 这一层解决什么问题

原始 OCR 块通常只知道：

- 自己是什么类型
- 自己在页面上的 bbox
- 自己的文本内容

但翻译和渲染阶段真正需要的还包括：

- 当前块属于单栏还是双栏
- 在页面里位于左栏、右栏还是跨栏区域
- 当前块是不是某个连续段落的一部分
- 当前块最终应该归属于哪个 `translation_unit`
- 当前块如果被跳过，跳过原因是什么

这些信息就是 orchestration 层负责补上的。

## 主要文件

- `zones.py`
  负责页面布局分析，识别单栏/双栏和布局区。
- `units.py`
  负责生成和整理 `translation_unit_id`、`skip_reason` 等面向翻译/渲染的标准字段。
- `document_orchestrator.py`
  负责把布局区标注、candidate continuation review、元数据收口串起来。

## 在总流程中的位置

它位于 `ocr` 和 `translation` 之间，更准确地说是嵌在翻译主流程内部：

`ocr payload -> orchestration -> translation policy / continuation / translation unit -> 翻译`

典型顺序是：

1. 先根据页面内容标注布局区。
2. 再挑出可疑的 continuation 边界对。
3. 必要时让模型只审阅这些模糊 pair。
4. 最后统一写回 `translation_unit_id`、`skip_reason` 等字段。

## 设计边界

- 这里只负责“结构整理”，不负责模型翻译
- 这里只负责“元数据确定”，不负责字体和排版
- 它产出的字段应该尽量稳定，因为 translation 和 rendering 都依赖这些字段

## 工程意义

如果没有这一层：

- 翻译层会直接操作原始 OCR 字段，越来越乱
- 渲染层会被迫理解 continuation 和布局判断逻辑
- 同一套规则会在多个模块重复实现

所以 orchestration 的价值不是功能多，而是把“结构判断”和“业务动作”分开。
