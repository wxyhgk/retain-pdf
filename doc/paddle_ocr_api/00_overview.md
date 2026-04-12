# 00 Overview

## 目标

Paddle OCR 对接层的目标是：

- 输入：Paddle OCR 原始 JSON
- 输出：符合当前主契约的 `normalized_document_v1`

也就是：

`Paddle raw payload -> provider adapter -> document.v1 -> translation/rendering`

## 当前识别口径

当前代码把下面这种 payload 识别为 Paddle：

- 顶层是 `dict`
- 存在 `layoutParsingResults`
- 存在 `dataInfo`

代码位置：

- `backend/scripts/services/document_schema/provider_adapters/paddle/adapter.py`
- `backend/scripts/services/document_schema/adapters.py`

## 当前目录职责

`provider_adapters/paddle/` 当前按职责拆成这些部分：

- `adapter.py`
  Paddle provider 总入口
- `payload_reader.py`
  读取顶层 payload，并按页构造 page spec
- `page_reader.py`
  构造 page context/page spec
- `block_reader.py`
  构造 block context/block spec
- `block_labels.py`
  `block_label -> type/sub_type/tags` 映射
- `trace.py`
  构造 `metadata/source/derived`
- `continuation.py`
  把 Paddle 的组信息映射成 `continuation_hint`
- `page_trace.py`
  页级 trace 和 layout_det 匹配
- `rich_content.py` 及相关文件
  富内容 trace 聚合

## 适配人的任务边界

适配 Paddle 的人只需要负责这几层：

1. Paddle 原始字段解释
2. 字段落位规则
3. `block_label` 语义映射
4. `continuation_hint` 映射
5. fixture 和回归

不要把这些事情混进任务里：

1. 翻译提示词
2. 排版覆盖
3. PDF 写回
4. 前端展示逻辑

## 交付标准

至少满足：

1. `adapt_path_to_document_v1()` 可以把 Paddle raw JSON 转成 `document.v1`
2. `validate_document_payload()` 通过
3. `extract_text_items()` smoke 通过
4. fixture 已登记进回归
5. 文档已经更新
