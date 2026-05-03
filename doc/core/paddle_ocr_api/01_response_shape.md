# 01 Response Shape

## 顶层结构

当前 Paddle adapter 依赖的顶层字段主要有：

- `layoutParsingResults`
  按页的解析结果列表
- `dataInfo`
  页尺寸等元信息
- `preprocessedImages`
  预处理图像列表，可选

当前最小识别条件见：

- `backend/scripts/services/document_schema/provider_adapters/paddle/adapter.py`

## 页级结构

对每一页，当前 adapter 主要读取：

- `prunedResult`
- `prunedResult.parsing_res_list`
- `prunedResult.layout_det_res.boxes`
- `markdown.text`
- `markdown.images`

页面尺寸优先顺序：

1. `dataInfo.pages[i].width / height`
2. `prunedResult.width / height`
3. 缺省为 `0`

## block 级结构

当前 block reader 主要读取这些字段：

- `block_label`
- `block_bbox`
- `block_content`
- `block_polygon_points`
- `block_id`
- `group_id`
- `global_block_id`
- `global_group_id`
- `block_order`

说明：

- `block_label` 决定主结构映射
- `block_content` 是文本主来源
- `group_id / global_group_id / block_order` 当前主要服务于 `continuation_hint`

## 当前页构造流程

当前 page adapter 流程是：

1. 从 `layoutParsingResults[page_index]` 读一页 payload
2. 构造 `PaddlePageContext`
3. 从 `prunedResult.parsing_res_list` 逐块构造 block spec
4. 补页级 `metadata`
5. 交给 common builder 生成 `document.v1`

代码入口：

- `backend/scripts/services/document_schema/provider_adapters/paddle/payload_reader.py`
- `backend/scripts/services/document_schema/provider_adapters/paddle/page_reader.py`

## 文档维护建议

如果后续 Paddle API 结构变了，这个文件要优先更新：

1. 顶层字段是否变了
2. 页级字段路径是否变了
3. block 级字段路径是否变了
4. 哪些字段已经不再可靠
