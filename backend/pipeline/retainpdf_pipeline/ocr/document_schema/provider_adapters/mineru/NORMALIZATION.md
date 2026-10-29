# MinerU 归一化说明（provider_adapters/mineru）

> 维护者文档：只讲 MinerU 两条输入如何变成 `document.v1`。
> 背景与全链路约定见 [document_schema README](../../README.md) 与
> [MinerU 链路 README](../../../mineru/README.md)，本文不重复。

权威符号按节标注；凡与代码不一致，以代码为准。

## 1. 输入形状与 bbox 单位/原点

本目录只消费 **middle.json**（主路径）；`content_list_v2`（实验路径）由隔壁
`../mineru_content_list_v2_adapter.py` 消费。旧版 `content_list.json`（v1）在本仓
**无适配器**（`grep content_list_v1` 零命中），若误投只会走探测失败或未知 label 路径。

| 输入 | 形状（逐层键） | 探测（`adapters.py` 注册顺序：generic → v2 → mineru → paddle，首中即停） |
|---|---|---|
| middle.json | `pdf_info[]` → 每页 `para_blocks[]` + `discarded_blocks[]`（L1 根，按 `block.index` 排序，见 `ordered_page_roots`）→ `block.blocks[]`（L2 子块）→ `lines[]` → `spans[]`；页尺寸 `page_size`；版本信号 `_backend` / `_version_name` | `mineru/__init__.looks_like_mineru_layout`：`pdf_info` 为 list，且空或首页含 `para_blocks` |
| content_list_v2 | 顶层为 `list`（每页一块 `list`）→ block `{type, bbox, sub_type?, content}`；文本类经 `*_content` 键取值，`list`/`index` 经 `content.list_items[]`（`item_content`），`code`/`algorithm` 经 `code_content`/`algorithm_content`，行间公式经 `math_content`（见 `extract_text_structure`） | `looks_like_mineru_content_list_v2`：顶层 list，首块含 `type` + `content` |

bbox 单位/原点：

| 输入 | block/line/span bbox 写法 | 页尺寸 | `source` 落盘标记 |
|---|---|---|---|
| middle.json | provider 原样透传（`effective_block_bbox`；仅 `list`/`index` 聚合时对有效子行 bbox 取并集） | `page_size` 原样，`unit="pt"` | `raw_unit="pt"`, `raw_origin="top_left"`，`raw_path=/pdf_info/{i}/…` |
| content_list_v2 | `common/normalize.normalize_bbox` 只做 float 化（非法→`[0,0,0,0]`，不做缩放） | 固定 `1000×1000`，包含留白和空白页；`unit="pt"` 为中间契约名义值，须按原 PDF 页尺寸重缩放后才是物理点 | `raw_unit="normalized_1000"`, `raw_origin="top_left"`，无 `raw_path` |

span 类型归一（两条路径一致）：`inline_equation`→`inline_formula`，
`interline_equation`/`equation`→`formula`，其余→`text`；
`hyperlink` 的子 span 被展平混入（`iter_spans` / v2 `normalize_segments`）。
v2 另有 label 翻译层 `_V2_TO_MIDDLE_LABEL`：
`paragraph`→`text`，`equation_interline`→`interline_equation`，
`page_header`→`header`，`page_footer`→`footer`，`page_aside_text`→`aside_text`，
之后复用同一 `project_mineru_block`。

### 1.1 跨页合段必须先恢复物理页

MinerU middle 的 `para_blocks` 可能把下一页文字并到上一页段落，保留下一页
坐标并在 span 上设置 `cross_page: true`；原位置成为 `lines_deleted` 空壳。
在按页发射记录前，`cross_page.restore_cross_page_spans` 用原始 span 类型、文字、
坐标与 `preproc_blocks` 做唯一匹配，恢复目标段落并移除上一页的跨页副本。
只有原始 span 覆盖完整、目标段落唯一时才恢复；缺失或歧义会报错，不猜页码。
同页合并空壳仍跳过，未标记的离散行仍使用原来的 orphan 拆分规则。

修复不改原始 payload，归一化块保留实际页码、目标 raw_path 与恢复来源元数据；
报告包含 `cross_page_recovered_block_count` / `cross_page_recovered_span_count`。
拆回以后，前一页那段和后一页那段用 `continuation_hint` 连成一组（`source=provider`、`scope=cross_page`、`role` 依次是
head → … → tail，`group_id = mineru-cross-page-<头一段的 block_id>`），报告里记 `cross_page_linked_group_count`
（`adapter.py` 的 `link_cross_page_continuations`，2026-10-29 起；以前拆完不留任何关联，两半各翻各的）。
已有任务可用 `backend/pipeline/devtools/repair_mineru_cross_page.py` 在新目录离线
重建：要求文字块一一对应，复用译文并生成新的 checkpoint。验收、备份后才能发布；
发布时还需通过持久化状态接口提交新快照，不能仅替换 PDF 或篡改旧快照哈希。

## 2. label 映射全表

provider 事实在 `label_catalog.py`（`MinerULabelDefinition`：`provider_label` /
`element_type` / `hierarchy` / `content_carrier` / `relation_intents`，
`MINERU_MIDDLE_TAXONOMY_PROFILE="mineru.middle.current"`）；
RetainPDF 策略在 `projection.py:project_mineru_block`。
下表 `type/sub_type` 即 `MinerUBlockProjection.content_kind/sub_type`，
`角色` = layout / semantic / structure。

### 2.1 文本系（`content_carrier="text"`）

| raw label | type / sub_type | 角色 | 翻译 | 发射方式 |
|---|---|---|---|---|
| `text`, `paragraph`, `vertical_text` | text / body | paragraph / body / body | ✅ `provider_body_whitelist:text` | 直接发射 |
| `abstract` | text / body | paragraph / abstract / body | ✅ `provider_body_whitelist:abstract` | 直接发射（derived role=abstract, 0.98） |
| `title` | text / heading | heading / unknown / heading | ✅ `provider_heading_candidate` | 直接发射 |
| `doc_title` | text / title | title / unknown / document_title | ✅ `provider_title_candidate` | 直接发射 |
| `paragraph_title` | text / heading | heading / unknown / heading | ✅ `provider_heading_candidate` | 直接发射 |
| `list`, `index`（catalog 标 container） | text / body（layout=list_item） | list_item / body / body | ✅ `provider_body_whitelist:list` | **聚合发射**：`MINERU_TEXT_AGGREGATE_CONTAINERS`，子孙行文本合并、bbox 取并集，容器本身不拆 |
| `list`/`index` + `sub_type∈{ref_text,reference_list}` | text / reference_entry | paragraph / reference / reference_entry | ❌ `provider_non_body:reference_entry` | 聚合发射（同上） |
| `ref_text` | text / reference_entry | paragraph / reference / reference_entry | ❌ 同上 | 直接发射 |
| `caption`, `image_caption`, `table_caption`, `chart_caption`, `code_caption`, `algorithm_caption` | text / raw label 本身 | caption / unknown / figure_caption \| table_caption \| code_caption \| caption | ✅ `provider_caption_whitelist:<raw>` | 直接发射；若同属 image/table/chart/code 组且组内有 kind∈{image,table,code} 目标，经 `relations.attach_mineru_group_relations` 反向挂接（derived role=caption, 0.98） |
| `footnote` | text / footnote | footnote / metadata / footnote | ❌ `provider_non_body:footnote` | 直接发射 |
| `image_footnote`, `table_footnote`, `chart_footnote`, `code_footnote` | text / raw label 本身 | footnote / metadata / footnote | ✅ `provider_footnote_whitelist:<raw>` | 直接发射（组内挂接同上） |
| `page_footnote` | text / page_footnote | footnote / metadata / footnote | ❌ `provider_non_body:page_footnote` | 直接发射（见 §2.3 不对称） |

### 2.2 元数据系（translate 全否，tags 含 `metadata` + `skip_translation`）

| raw label | type / sub_type | 角色 | reason |
|---|---|---|---|
| `header` / `footer` | text / metadata | header \| footer / metadata / metadata | `provider_non_body:<raw>` |
| `page_number` | text / page_number | page_number / metadata / metadata | 同上 |
| `aside_text`, `phonetic`, `formula_number`, `discarded` | text / metadata | unknown / metadata / metadata | 同上（注意 `discarded_blocks` 根仍被 `ordered_page_roots` 遍历，只是内容判为元数据） |

### 2.3 非文本系（translate 全否）

| raw label | type / sub_type | reason / tags | 发射方式 |
|---|---|---|---|
| `interline_equation`, `equation`（v2 `equation_interline` 先映射至此） | formula / display_formula | `provider_non_text:formula` / `formula` | 直接发射 |
| `image`, `image_body`, `chart`, `chart_body`, `header_image`, `footer_image` | image / figure | `provider_non_text:image` / `image,skip_translation` | 有 children → **拆分不发射**（`skipped_container_count++`，`provider_group_type/bbox/raw_path` 经 `parent_group` 下发给子块）；无 children → 保守回退发射 |
| `table`, `table_body` | table / table_body | `provider_non_text:table` / `table,skip_translation` | 同上 |
| `code`, `code_body`, `algorithm`（或 `sub_type=="algorithm"`） | code / code_block | `provider_non_text:code` / `code,skip_translation` | 同上 |
| 未知 label | 有文本→text/metadata；无文本→unknown/"" | `provider_non_body:<label>` / `provider_unknown:<label>` | 直接发射；计入 `derived.provider_signals.unknown_block_types`（见 §5） |

### 2.4 已知缺口（事实，非计划）

- `chart_body` 并入 `image/figure`：适配层无 `chart` kind，`contract_v1` 的资产统计认
  `content.kind∈{image,chart}`，其中 `chart` 实际到不了 MinerU 分支。
- `page_footnote` 不翻译，而四类 `*_footnote` 翻译（`projection._footnote` 的 `visual` 集合所致）。
- `formula_number` 为元数据，不与公式块关联。
- `index` 容器按 `list` 聚合成正文翻译。
- 组挂接只认首个 kind∈{image,table,code} 的子块为目标（`_build_page_record.visit_block`），
  且只挂接 `layout_role∈{caption,footnote}` 的 related 块；`caption_target_block_id` /
  `footnote_target_block_id`、`relation_source="provider_container"` 均由
  `attach_mineru_group_relations` 写入，目标侧 `content.caption(s)` /
  `caption_block_ids`（footnote 对称）同步回填。

## 3. 坐标旅程（谁做哪段）

1. **透传（adapter）**：`records.build_block_record` / v2 `build_block_spec`
   原样拷贝 provider bbox（block/line/span 三级）；`block_id=p{页:03d}-b{序:04d}`；
   合法性只用 `valid_bbox`（4 元 float、x1≥x0、y1≥y0）过滤，无效时回退到 provider 原值。
   span/line 具有效 bbox 者打 `bbox_precision="provider_layout"`。
2. **补默认（`adapters.adapt_payload_to_document_v1_with_report` → `defaults.apply_document_defaults_with_report(in_place=True)`）**：
   硬键 `HARD_REQUIRED_*` 缺失即错；软默认 `SOFT_DEFAULT_DOCUMENT_FIELDS={derived,markers}`、
   `SOFT_DEFAULT_PAGE_FIELDS={}`、`SOFT_DEFAULT_BLOCK_FIELDS={reading_order,tags,metadata,source}`，
   命中计数进 report `defaults`（`document_defaults/page_defaults/block_defaults` + `pages_seen/blocks_seen`）。
3. **补契约（同函数 → `contract_v1.enrich_document_contract_v1`）**：
   补 `doc_id/page/reading_order/geometry/content/layout_role/semantic_role/structure_role/block_class/policy/provenance`、
   汇总 `document.assets`。`_build_policy` **保留** adapter 给出的 `translate` 布尔值
   （缺失才按 kind/role 重算）；`_build_provenance` 把 adapter 的 `source` 搬运为
   `provenance`（`raw_label` 取 `raw_type`）；`_build_content` 从
   `metadata.asset_keys` 派生 `content.asset_id/asset_ids`（markdown 图加 `page-{n}/` 前缀）。
4. **重缩放到 PDF 点（`normalize_pipeline.build_normalized_artifacts` →
   `ocr_provider/paddle_normalize.rescale_document_geometry_to_pdf`）**：
   逐页用 fitz 真实页矩形求 `scale_x/scale_y`（独立双轴，3 位小数），重写
   page 宽高（`unit="pt"`）与 block/geometry/line/span/segment 五级 bbox；
   零尺寸页只纠正页尺寸不缩放子块。随后 `derived.coordinate_space="pdf_point"`，
   并经 `_refresh_report_for_final_document` 重建 validation，打上
   `validation.coordinate_space="pdf_point"`。

## 4. 文本 / 公式 / 表格 / 图片 / 代码

- **文本**：`normalize_text` 先 `repair_math_control_chars`
  （仅修复遗留 MinerU 数学控制字节 `[\x00-\x08\x0b\x0c\x0e-\x1f]`），再空白折叠；
  仅 `code/code_body/algorithm` 用 `preserve_lines`（保留换行、`\n` 连接），其余空格连接。
  空 span 丢弃（`normalized_line_and_segments`）。v2 同语义经
  `common` 的 `build_text_segments/build_line_records` + `text_flow.classify_text_flow`。
- **公式**：块 kind=`formula`，行内/行间经 segment `type=inline_formula/formula` 区分。
  **适配/OCR 阶段无 `formula_map`**（`build_block_record` 从不写该键）：
  占位符→latex 映射是下游 `document_schema/protected_formula_tokens.py`
 （及 render 侧 `formula_map`/`protected_text`）的事；下游若见公式 segment 无 map，
  应按“未保护原文”处理，不得反推。
- **表格**：取块内首个 span `html` → `content={kind:table, table_html}`，
  同时 `metadata.provider_table_html_available/count` + `content_format="html_table"`
 （`provider_payload_metadata` / `first_provider_table_html`）。
- **图片**：span `image_path` **只进 metadata，不进 content**
 （`provider_payload_metadata` → `provider_image_paths` +
  `assets.build_mineru_asset_metadata` → `asset_key(s)/asset_path(s)`、
  `asset_kind="markdown_image"`、`asset_resolved=False`、`asset_resolved_count=0`；
  页级再汇总 `metadata.markdown.images: {relative: md/images/page-{n}/{relative}}`）。
  路径清洗 `normalize_mineru_image_path`：反斜杠转义、去 `./` 前缀、拒绝绝对路径/URL/
  `..`、剥离 `images/` 或 `md/images/` 前缀。真正的 `content.asset_id` 与顶层
  `assets` 由 `contract_v1._build_content/_collect_assets` 派生，文件落地链接由
  `mineru/artifacts.py`（消费 `provider_image_paths` + 同一清洗函数）完成。
- **代码**：`preserve_lines` + `\n` 连接原文；kind=`code` 使组挂接与翻译策略按非文本处理。

## 5. 校验 / 报告字段与下游信任判断

`adapt_*_with_report`（`adapters.py:152-239`）产出 `(document, report)`：

- `report` 顶层：`source_json_path` / `document_id` / `provider` /
  `provider_version` / `defaults` / `validation` / `provider_signals`（有才附）；
  路径版追加 `detected_provider` / `detection{matched,provider,attempts}` /
  `provider_was_explicit` / `provider_mismatch_allowed`。
  显式 provider 与探测不一致且未显式允许时直接抛错（不猜）。
- `derived.provider_signals`（`adapter.build_mineru_document`）：
  `taxonomy_profile`（`mineru.middle.current`）、`backend`、`mineru_version`、
  `raw_block_type_counts`（全量原始 label 计数）、`unknown_block_types`、
  `structural_containers_not_emitted`（拆分计数）。
- `validation`（`validator.build_validation_report`，先 `validate_document_payload`，
  不合法直接抛 `DocumentSchemaValidationError`，故 `valid` 恒真）：
  `complete = not warnings`；计数 `page/block/asset/referenced/unreferenced`；
  `provider_markdown_image_count/covered/uncovered`；
  `asset_block/linked/unlinked`；`zero_segment_bbox_count`（bbox 缺失）、
  `approximate_segment_bbox_count`（`bbox_precision∈{block,line}`）、
  `provider_segment_bbox_count` / `formula_segment_count` /
  `provider_formula_segment_bbox_count` / `approximate_formula_segment_bbox_count` /
  `line_bbox_precision_counts`；`geometry_bbox_consistent` 与
  `segment_bbox_within_block` 当前为字面 `True`（未做真几何校验，见函数尾）。
- `reporting.build_normalization_summary` 是 report 的下游摘要：
  `provider/detected_provider/provider_was_explicit/pages_observed/blocks_observed/defaulted_*_fields/any_defaults_applied/valid/complete/warnings/…counts/coordinate_space/geometry_bbox_consistent/detection_matched/detection_attempts`；
  只想看摘要优先读 `document.v1.report.json`，勿重跑适配。

下游信任规则：`valid==False` 不可能落盘（早抛）；`complete==False` 时读 `warnings`
逐条处置（`unlinked` 资产块、`uncovered` Markdown 图、零 bbox segment 为三类常见不可信信号）；
`coordinate_space=="pdf_point"` 是重缩放已发生的唯一凭证；
`provider_segment_bbox_count` vs `approximate/zero` 说明几何可信度；
`unknown_block_types` 非空说明有 label 掉出 §2 表，按 unknown 路径发射（多为元数据或 unknown kind）。

## 6. 权威符号索引

- 输入/探测：`mineru/__init__.looks_like_mineru_layout`，
  `mineru_content_list_v2_adapter.looks_like_mineru_content_list_v2` /
  `build_mineru_content_list_v2_document` / `build_block_spec` / `extract_text_structure` /
  `TEXTUAL_BLOCK_TYPES` / `_V2_TO_MIDDLE_LABEL`，`adapters._ADAPTER_BUILDERS/_ADAPTER_DETECTORS/register_ocr_adapter`，
  `providers.PROVIDER_MINERU/PROVIDER_MINERU_CONTENT_LIST_V2`，
  `mineru/contracts.MINERU_CONTENT_LIST_V2_FILE_NAME`。
- 编排（`adapter.py`）：`build_mineru_document` /
  `build_normalized_document_from_layout_payload/_path` /
  `_build_page_record.visit_block`（容器递归、组挂接、页元数据）/ `_collect_raw_label_counts`。
- 记录装配（`records.py`）：`ordered_page_roots` / `build_block_record` /
  `block_record_from_lines` / `effective_block_bbox` / `make_raw_path` /
  `default_derived` / `derived_for_projection` / `provider_payload_metadata` /
  `first_provider_table_html`。
- 文本抽取（`text.py`）：`extract_text_structure` / `normalized_line_and_segments` /
  `iter_spans` / `iter_child_blocks` / `iter_descendant_lines` / `iter_direct_lines` /
  `iter_layout_pages` / `join_line_texts` / `normalize_text` / `repair_math_control_chars`。
- 几何（`geometry.py`）：`valid_bbox` / `intersect_bbox` /
  `clamp_descendant_bboxes` / `split_orphan_line_runs`。
- 目录/投影/关系/资产：`label_catalog.get_mineru_label_definition/is_mineru_structural_container/MINERU_TEXT_AGGREGATE_CONTAINERS/MINERU_MIDDLE_BLOCK_LABELS/MINERU_MIDDLE_SPAN_LABELS`，
  `projection.project_mineru_block/MinerUBlockProjection`，
  `relations.attach_mineru_group_relations`，
  `assets.normalize_mineru_image_path/build_mineru_asset_metadata`。
- 管线/校验/摘要：`adapters.adapt_payload_to_document_v1_with_report/adapt_path_to_document_v1_with_report/detect_ocr_provider_with_report`，
  `defaults.apply_document_defaults_with_report`，
  `contract_v1.enrich_document_contract_v1`，
  `normalize_pipeline.build_normalized_artifacts/_refresh_report_for_final_document`，
  `ocr_provider/paddle_normalize.rescale_document_geometry_to_pdf`，
  `validator.build_validation_report/validate_document_payload`，
  `reporting.build_normalization_summary/load_normalization_report`。
