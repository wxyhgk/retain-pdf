# MinerU 官方输出类型与 RetainPDF 归一化基线

> 核对日期：2026-09-03
> 适用边界：MinerU `middle.json` / `content_list_v2.json` 进入 `document.v1` 之前的 provider adapter。
> 当前主输入：`middle.json`（仓库内兼容文件名为 `layout.json`）。

## 1. 边界原则

MinerU 标签描述 provider 识别到的版面元素；RetainPDF 的类型描述翻译、渲染和
前端可以依赖的稳定行为。两者不建立一一同名的公共契约：

- MinerU 原始 `type`、`sub_type`、bbox、角度和 raw path 保留在 provenance / metadata；
- RetainPDF 只对外暴露自己的 `content.kind`、layout / semantic / structure role 和 policy；
- 行内公式只作为文本 span，只有独立公式才成为 `formula` block；
- 行内公式的 segment type 是 `inline_formula`，line/span 原生 bbox 标为
  `bbox_precision=provider_layout`；
- `abstract` 是正文布局和正文翻译行为，不使用标题字号；
- 未知 provider 标签保守归为不可翻译 metadata/unknown，并写入归一化报告。

## 2. 官方来源和格式差异

- [MinerU 官方输出文件说明](https://opendatalab.github.io/MinerU/reference/output_files/)
- [MinerU 官方 `BlockType` / `ContentType` 枚举](https://github.com/opendatalab/MinerU/blob/master/mineru/utils/enum_class.py)
- [MinerU 官方 middle.json 生成代码](https://github.com/opendatalab/MinerU/blob/master/mineru/backend/pipeline/pipeline_middle_json_mkcontent.py)

当前官方说明明确区分三类结构化输出：

1. `model.json` 是模型原始输出，不作为稳定二次开发输入；
2. `content_list_v2.json` 从 MinerU 3.0 开始提供，但仍标注为 development version；
3. `middle.json` 保留页面尺寸、层级、line/span 和原始坐标，是 RetainPDF 当前用于
   PDF 原位渲染的主输入。

VLM 2.5 之后的输出与旧 pipeline backend 并不完全兼容，因此 adapter 必须基于
payload 结构和原始标签工作，不能只根据 `model_version=vlm` 猜格式。

## 3. middle.json 标签投影

下面是稳定的大类投影。细粒度身份继续保留在 role 和 provenance 中。

| MinerU 标签 | RetainPDF 投影 | 翻译行为 |
| --- | --- | --- |
| `text`, `vertical_text` | `text/body` | 翻译 |
| `abstract` | `text/body` + `semantic_role=abstract` | 翻译，正文排版 |
| `doc_title` | `text/title` | 翻译，标题排版 |
| `title`, `paragraph_title` | `text/heading` | 翻译，章节标题排版 |
| `list`, `index` | `text/body` + `layout_role=list_item` | 翻译 |
| `ref_text`, `list[sub_type=ref_text]` | `text/reference_entry` | 默认不翻译 |
| `interline_equation`, `equation` | `formula/display_formula` | 不送翻译 |
| `image`, `image_body`, `chart`, `chart_body` | `image/figure` | 不送翻译 |
| `table`, `table_body` | `table/table_body` | 不送翻译 |
| `code`, `code_body`, `algorithm` | `code/code_block` | 不送翻译 |
| `*_caption`, `caption` | `text` + caption role | 翻译 |
| image/table/chart/code `*_footnote` | `text` + footnote role | 翻译 |
| `header`, `footer`, `page_number`, `aside_text`, `page_footnote` | metadata/footnote | 默认不翻译 |
| `phonetic`, `formula_number`, `discarded` | metadata | 默认不翻译 |
| `header_image`, `footer_image` | `image/figure` | 不送翻译 |

官方 block 枚举的完整性由
`backend/pipeline/devtools/tests/document_schema/test_mineru_adapter.py` 锁定。官方新增
标签时，必须同时更新标签目录、投影决策、本文和 fixture。

## 4. 层级和 bbox 规则

`middle.json` 不是扁平 block 列表。图片、表格、图表和代码通常是父容器，其
`blocks` 内才包含 body、caption 和 footnote。归一化遵守以下规则：

1. 父容器只表达分组，不再和子块同时生成可消费 block；
2. body、caption、footnote 各自产出一个 block，并用 group metadata 保留关系；
3. caption/footnote 指向同组 body 的稳定 `block_id`；
4. list/index 聚合子行成为一个翻译单元，不重复输出父子文本；
5. 聚合后的 bbox 至少覆盖所有保留的子行 bbox，原始父 bbox 仍保存在 provenance；
6. `discarded_blocks` 不静默丢弃，而是以不可翻译辅助块进入归一化结果。

这样可以避免父容器 bbox（常包含标题区域）被错误当作图片/表格 body，也避免同一
段文字被翻译或渲染两次。

### 图片资源契约

MinerU body span 的 `image_path` 通常形如 `images/<name>`，但 Reader 的鉴权图片
接口只读取任务目录下的 `md/images/page-N/...`。归一化阶段因此执行以下投影：

1. 拒绝绝对路径、URL 和包含 `..` 的 provider 路径；
2. canonical asset ID 使用 `page-N/<relative-path>`；
3. top-level `assets[*].uri` 使用 `md/images/page-N/<relative-path>`；
4. 从解包目录的 `images/...` 建立 page-scoped hard-link，跨文件系统时退化为复制；
5. image/table/chart 同组 caption 和 footnote 复用 body 的 asset ID，并保留各自关系；
6. 未找到文件时保留 OCR block 和 provider path，但记录 `missing_page_asset_count`，
   不生成指向任务目录外的 URL。

表格 body 同时保留 preview asset 和 `content.table_html`。这样 Reader/Markdown 可以
优先使用结构化表格；只有表格 HTML 不可用时，才退回图片预览或空的非文本 block。

## 5. content_list_v2 的定位

官方 V2 常见类型包括 `title`、`paragraph`、`equation_interline`、`image`、
`table`、`chart`、`code`、`algorithm`、`list`、`index` 和页面辅助块；行内内容还
可能出现 `equation_inline`、`hyperlink`、`phonetic`、`md`、`code_inline`。

仓库保留 V2 adapter 用于实验和回归，但它的 bbox 是 0–1000 映射，缺少 PDF
真实页面尺寸，当前不能替代 `middle.json` 成为原位渲染的权威输入。后续若切换，
必须同时提供页面尺寸和坐标反归一化契约。

## 6. 升级门禁

升级 MinerU 或观察到新标签时：

1. 保存脱敏后的 `middle.json` 与 `content_list_v2.json` fixture；仓库当前固定样本为
   `mineru_middle_v3.golden.json` 和 `mineru_content_list_v2.golden.json`；
2. 对照官方枚举和输出说明确认层级、坐标单位及字段含义；
3. 未知标签必须进入 `unknown_block_types`，不能静默丢弃；
4. 检查父容器是否重复输出、caption/body 关系以及 bbox 包含关系；
5. 跑 MinerU adapter、document contract、translation payload 和 rendering 回归；
6. 用真实 PDF 做 normalized overlay 与最终 PDF 的视觉核对。
