# 03 Semantics Rules

## 总原则

适配 Paddle 时，先判断字段属于哪一类：

1. 稳定结构
2. 稳定语义
3. 仅供排错的原始 trace

## 哪些进核心结构层

只有跨 provider 也大概率稳定的内容，才允许进入核心结构层：

- `type`
- `sub_type`
- `bbox`
- `text`
- `lines`
- `segments`
- `tags`
- `derived`
- `continuation_hint`

## 哪些进 `tags`

`tags` 适合放轻量、可组合、下游可能会用到的结构提示。

当前 Paddle 已在用的示例：

- `title`
- `abstract`
- `heading`
- `caption`
- `image_caption`
- `table_caption`
- `reference_zone`
- `skip_translation`
- `image`
- `table`
- `formula`

## 哪些进 `derived`

`derived` 适合放更强的语义结论，并注明是谁给的结论。

当前格式：

```json
{
  "role": "title",
  "by": "provider_rule",
  "confidence": 0.98
}
```

适合进 `derived` 的例子：

- title
- abstract
- reference_entry
- formula_number
- header/footer
- caption/footnote 这类 provider 已明确识别的角色

## 哪些只留在 `metadata/source`

Paddle 私有字段默认都应该先留在 trace 层：

- `raw_group_id`
- `raw_global_group_id`
- `raw_global_block_id`
- `raw_block_order`
- `raw_polygon`
- `layout_det_*`
- `model_settings`
- `markdown.images`

只有在多个 provider 都稳定产出、并且下游确实需要时，才考虑上提。

## 当前 trace 分层

当前 Paddle trace 分层建议：

1. 核心结构层
2. 通用 trace 层
3. provider raw trace 层

其中：

- `content_format / asset_* / markdown_match_*` 更偏“通用 trace 层”
- `layout_det_* / model_settings / 原始 group id` 更偏“provider raw trace 层”

## 规则变更要求

如果对 `block_label -> type/sub_type/tags/derived` 做变更，必须同时更新：

1. 本目录文档
2. 相关 fixture
3. regression check
4. 如有必要，translation extractor smoke
