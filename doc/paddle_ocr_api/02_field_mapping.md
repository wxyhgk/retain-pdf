# 02 Field Mapping

## 核心原则

映射时只问一件事：

- 这个 Paddle 字段应该落到 `document.v1` 的哪一层

当前允许的落位层：

1. 核心结构层：`type/sub_type/bbox/text/lines/segments/tags/derived`
2. 通用 trace 层：多个 provider 可能共用的 `metadata`
3. provider raw trace 层：Paddle 私有字段，保留在 `metadata/source`

## 顶层映射

| Paddle 字段 | `document.v1` 字段 | 说明 |
| --- | --- | --- |
| provider 固定值 | `source.provider` | 当前固定为 `paddle` |
| 输入文件路径 | `source.raw_files.source_json` | 由 adapter 外层注入 |
| 页数 | `page_count` | 由 pages 数量确定 |

## 页面映射

| Paddle 字段 | `document.v1` 字段 | 说明 |
| --- | --- | --- |
| `dataInfo.pages[i].width` | `pages[i].width` | 首选 |
| `dataInfo.pages[i].height` | `pages[i].height` | 首选 |
| `prunedResult.width` | `pages[i].width` | 兜底 |
| `prunedResult.height` | `pages[i].height` | 兜底 |
| 页序号 | `pages[i].page_index` | 从 0 开始 |
| 固定值 | `pages[i].unit` | 当前固定 `pt` |

## block 映射

| Paddle 字段 | `document.v1` 字段 | 说明 |
| --- | --- | --- |
| `block_bbox` | `bbox` | 归一化 bbox |
| `block_content` | `text` | 归一化文本 |
| `block_label` | `type/sub_type/tags` | 走 `block_labels.py` |
| 行/段拆分结果 | `lines/segments` | 走 `content_extract.py` |
| `block_id` | `source.raw_block_id` | 保留原始来源 |
| `block_label` | `source.raw_type` | 保留原始类型 |
| `block_bbox` | `source.raw_bbox` | 保留原始 bbox |
| `block_content[:200]` | `source.raw_text_excerpt` | 排错用 |
| 原始路径 | `source.raw_path` | 指向原始 JSON 路径 |

## 当前 label 映射

当前主要规则见：

- `backend/scripts/services/document_schema/provider_adapters/paddle/block_labels.py`

已实现映射示例：

| `block_label` | `type` | `sub_type` | `tags` |
| --- | --- | --- | --- |
| `doc_title` | `text` | `title` | `title` |
| `abstract` | `text` | `abstract` | `abstract` |
| `text` | `text` | `body` | 空 |
| `paragraph_title` | `text` | `heading` | `heading` |
| `reference_content` | `text` | `reference_entry` | `reference_entry, reference_zone, skip_translation` |
| `formula_number` | `text` | `formula_number` | `formula_number, skip_translation` |
| `table` | `table` | `table_html` | `table` |
| `image` | `image` | `image_body` | `image, skip_translation` |
| `algorithm` | `code` | `code_block` | `code` |
| `display_formula` | `formula` | `display_formula` | `formula` |

## `derived` 映射

当前 `derived` 主要由 provider 规则生成，见：

- `backend/scripts/services/document_schema/provider_adapters/paddle/trace.py`

典型规则：

- `doc_title -> derived.role = title`
- `abstract -> derived.role = abstract`
- `reference_content -> derived.role = reference_entry`
- `formula_number -> derived.role = formula_number`
- `header/footer -> derived.role = header/footer`

## 不要这么做

1. 不要把 Paddle 私有字段直接塞成新的主契约字段。
2. 不要在 translation 层再重新解释 `block_label`。
3. 不要为了单个 fixture 临时改 `type/sub_type` 语义。
