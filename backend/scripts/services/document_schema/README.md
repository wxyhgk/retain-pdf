# Document Schema 说明

`scripts/services/document_schema/` 定义统一中间文档结构。

当前正式使用的是：

- schema 名称：`normalized_document_v1`
- schema 版本：`1.0`
- 默认文件名：`document.v1.json`
- 默认报告文件名：`document.v1.report.json`
- 机器可读 schema：`document.v1.schema.json`
- Python 校验器：`validator.py`

这份 JSON 现在已经是翻译/渲染主链路的标准 OCR 输入。

## 阶段边界

`document_schema` 这一层只负责 OCR / Normalize 阶段的交接，不向下游承担翻译或渲染职责。

正式输入和输出固定为：

- 输入：
  provider 原始 OCR payload、provider raw 文件目录、源 PDF 的必要上下文
- 输出：
  `document.v1.json` 和 `document.v1.report.json`

明确不负责的事情：

- 不负责翻译策略、术语控制和翻译产物落盘
- 不负责排版覆盖、Typst 编译和最终 PDF 输出
- 不负责在下游阶段继续暴露 provider 私有字段作为主契约

稳定交接点：

- OCR 阶段到此结束时，下游应只依赖 `document.v1.json`
- `document.v1.report.json` 只服务于校验、排错和兼容性摘要，不是翻译/渲染主输入
- provider raw trace 保留用于回溯，但禁止变成 translation / rendering 主逻辑依赖

## 字段分层规范

`document.v1` 里的字段，不应再被当成“一锅粥”。当前约定分成三层：

1. 核心结构层
2. 通用 trace 层
3. provider raw trace 层

### 1. 核心结构层

这层是翻译、渲染、策略代码可以直接依赖的稳定字段。

顶层：

- `schema`
- `schema_version`
- `document_id`
- `source.provider`
- `page_count`
- `pages`
- `derived`
- `markers`

页面级：

- `page_index`
- `width`
- `height`
- `unit`
- `blocks`

块级：

- `block_id`
- `page_index`
- `order`
- `type`
- `sub_type`
- `bbox`
- `text`
- `lines`
- `segments`
- `tags`
- `derived`
- `continuation_hint`

原则：

- 下游主逻辑优先只读这层
- 新 provider 接入时，第一目标是把原始 JSON 先稳定映射到这层

### 2. 通用 trace 层

这层不是主链路硬依赖，但多个 provider 都建议尽量往这套字段靠。

当前已经出现并可继续沿用的字段包括：

- `content_is_rich`
- `content_format`
- `content_length`
- `content_line_count`
- `asset_key`
- `asset_url`
- `asset_resolved`
- `markdown_match_text`
- `markdown_match_found`
- `markdown_match_count`

原则：

- 这层主要服务于排错、调优、后续增强功能
- 可以被策略代码谨慎读取
- 不应替代 `type/sub_type/tags/derived`

### 3. Provider Raw Trace 层

这层只用于回溯和排错，禁止下游业务逻辑直接依赖。

包括但不限于：

- `source.raw_*`
- `metadata.raw_*`
- `layout_det_*`
- provider 原始 id/path/score/label
- Paddle 的 `model_settings`
- Paddle 的 `layout_det_res`
- Paddle 的原始 `markdown.images`
- 其他 provider 的原始检测字段

原则：

- 这层可以保留得很全
- 但不应被当成统一语义入口
- 如果某个字段未来被多个 provider 稳定提供，再考虑提升到“通用 trace 层”

### 下游读取原则

推荐顺序：

1. 先读核心结构层
2. 必要时再读通用 trace 层
3. 只有排错或 provider 研究脚本才读 raw trace 层

也就是说：

- 翻译/渲染主链路优先使用 `type/sub_type/bbox/text/lines/segments/tags/derived`
- 如果需要增强判断，可谨慎读取 `content_format` 这类通用 trace
- 不要直接基于 `layout_det_score`、`source.raw_type`、`metadata.raw_*` 写主逻辑

## 设计目标

- 把上游 OCR provider 的原始结构隔离在 adapter 层
- 给翻译、渲染、策略、API 一个稳定的中间层契约
- 不过度设计，不把 OCR 很难稳定判断的语义强行塞进主类型系统

## 当前链路

主链路约定：

1. 上游 provider 先输出自己的原始结果
2. adapter 把原始结果转成 `normalized_document_v1`
3. `services/translation` 和 `services/rendering` 只围绕这份统一结构工作

以 MinerU 为例：

- 原始 OCR：`ocr/unpacked/layout.json`
- 统一中间层：`ocr/normalized/document.v1.json`
- 归一化报告：`ocr/normalized/document.v1.report.json`

注意：

- raw `layout.json` 保留给 adapter、调试和回溯
- 翻译/渲染主链路优先消费 `document.v1.json`
- `document.v1.report.json` 用于查 adapter 探测、compat 默认补齐和 schema 校验摘要

## Adapter 约定

provider 原始 OCR 不应直接进入翻译/渲染主线。

统一入口在：

- `services/document_schema/adapters.py`

当前 adapter 接口：

- `detect_ocr_provider(payload)`
- `adapt_payload_to_document_v1(...)`
- `adapt_payload_to_document_v1_with_report(...)`
- `adapt_path_to_document_v1(...)`
- `adapt_path_to_document_v1_with_report(...)`
- `register_ocr_adapter(...)`

共享约定入口：

- `services/document_schema/providers.py`
  稳定 OCR provider 标识常量，adapter、fixture registry、回归脚本优先共用这一层
- `services/mineru/contracts.py`
  MinerU 主线的原始文件名、目录名和 stdout 标签约定

当前正式 provider adapter 有：

- `mineru -> document.v1`
- `mineru_content_list_v2 -> document.v1`
- `generic_flat_ocr -> document.v1`
- `paddle -> document.v1`

## Provider Adapter 分层

现在的 adapter 分成两层：

1. 通用骨架
2. provider 装配层

通用骨架位于：

- `services/document_schema/provider_adapters/common/`

当前包含：

- `document_builder.py`
  负责统一拼装顶层 `document.v1`
- `page_builder.py`
  负责统一拼装 page record
- `block_builder.py`
  负责统一拼装 block record
- `normalize.py`
  负责 `bbox/polygon/segments/lines` 等通用归一化 helper
- `relations.py`
  提供“按前一个锚点推断当前块语义”的页内关系骨架
- `specs.py`
  定义 provider 内部先落到的中间 block/page spec

原则：

- `common/` 不直接读取某个 OCR provider 的原始字段名
- `common/` 只接收已经被 provider 解析好的中间 spec
- 这样未来接新的 OCR，只需要自己把原始 JSON 先转成 spec，再交给通用 builder

provider 装配层位于：

- `services/document_schema/provider_adapters/`

其中：

- `paddle/`
  采用目录化拆分，负责把 Paddle 原始 `layoutParsingResults` 解析成通用 spec
  当前又细分为 reader、relations、page trace、rich-content trace。
  现在 reader 层内部再通过 page/block context 收敛接口，不再散传 markdown/layout trace 参数。
- `mineru_content_list_v2_adapter.py`
  已经接入通用 builder，但还没有像 Paddle 一样完全目录化
- `generic_flat_ocr_adapter.py`
  目前仍是最薄的一层 passthrough adapter
- `mineru`
  主线仍在 `services/mineru/document_v1.py`，当前不在这轮通用化范围内

也就是说，后续扩展 OCR provider 时，优先目标不是继续堆“大 adapter 文件”，而是：

1. provider 原始 JSON -> provider 内部 spec
2. spec -> `common` builder
3. adapter 注册到 `adapters.py`
4. fixture 接入回归

Paddle 当前 rich-content trace 也已经继续拆分成三层：

- 内容画像：`content_profile.py`
- 资源引用：`asset_links.py`
- markdown 轻匹配：`markdown_match.py`

`rich_content.py` 只保留聚合入口，不再承载具体解析细节。

注意：

- Paddle 的 `content_format / asset_* / markdown_match_*` 当前归入“通用 trace 层”
- Paddle 的 `layout_det_* / model_settings / markdown.images` 当前归入“provider raw trace 层”

新 provider 可以参考：

- `services/document_schema/provider_adapters/provider_adapter_template.py`
- `services/document_schema/provider_adapters/paddle/`

后续新增 OCR provider 时，正确做法是：

1. 新增一个 provider adapter
2. 把原始 JSON 转成 `normalized_document_v1`
3. 在 adapter 输出后立刻做 schema 校验
4. 下游继续只消费 `document.v1.json`

推荐接入顺序：

1. 先明确字段落位规则
   也就是先决定哪些是 `type/sub_type`，哪些是 `tags/derived`，哪些只留在 `metadata/source`。
2. 准备最小 raw fixture
   放到 `scripts/devtools/tests/document_schema/fixtures/`。
3. 写并注册 adapter
   优先复用 `providers.py` 里的共享 provider 常量，不要在 adapter、fixture、回归入口里各写一份裸字符串。
   如果原始结构比较复杂，优先按 `payload_reader / block_labels / relations / content_extract / trace` 这种职责拆分，而不是继续堆单文件。
4. 把 fixture 登记到 `fixtures/registry.py`
5. 跑 `regression_check.py`
   让 detector、adapt、validation、extractor smoke 一次过。

## 检查入口

长期检查入口：

- `scripts/entrypoints/validate_document_schema.py`
- `scripts/devtools/tests/document_schema/regression_check.py`

现在支持两种用法：

1. 直接校验已经生成好的 `document.v1.json`
2. 对 raw OCR JSON 执行 `adapter -> compat -> validation`，并输出 report

示例：

```bash
python scripts/entrypoints/validate_document_schema.py output/.../ocr/normalized/document.v1.json
python scripts/entrypoints/validate_document_schema.py output/.../ocr/unpacked/layout.json --adapt --document-id demo --write-report /tmp/document-schema-report.json
```

report 里当前会包含：

- 输入路径
- adapter/provider 探测结果
- compat 默认补齐统计
- schema 校验摘要

`validate_document_schema.py --write-report` 当前约定：

- `mode = "adapt"` 时：
  - `input_path`
  - `normalization`
  - `normalization_summary`
  - `validation`
- `mode = "validate"` 时：
  - `input_path`
  - `validation`

也就是说：

- 完整 adapter / compat / detection 细节看 `normalization`
- 稳定轻量摘要优先看 `normalization_summary`
- 顶层校验结果看 `validation`

统一消费入口：

- `services/document_schema/reporting.py`
- `load_normalization_report(path)`
- `build_normalization_summary(report)`

约定：

- Python 侧如果只是想展示 provider / detected provider / compat pages / compat blocks / validation 摘要，优先走这两个 helper
- 不要在 `mineru/summary.py`、排错脚本或后续 API 层里各自重新手写 `report['compat']['pages_seen']` 这类读取
- 需要完整原始 report 时，再直接使用 report dict，本身不阻止保留原始字段

回归 smoke 检查：

```bash
python scripts/devtools/tests/document_schema/regression_check.py
python scripts/devtools/tests/document_schema/regression_check.py --write-report /tmp/document-schema-regression.json
```

这个回归脚本现在不是简单打印日志，而是会硬校验：

- adapter 注册表里必须包含当前正式 provider
- 新旧 `document.v1.json` 都必须能通过 schema 校验
- legacy 文档经过 compat 升级后，`derived` 等软字段必须被稳定补齐
- raw layout / `content_list_v2.json` / generic fixture / paddle fixture 都必须能被自动探测、适配并再次通过 schema 校验
- 显式指定 provider 的路径也必须可用，防止“自动探测能过，显式调用反而退化”
- Paddle 这类 provider 还要额外做语义断言，至少锁死：
  - `header/footer`
  - `image_caption/table_caption`
  - `table_footnote`
  - `display_formula -> formula segment`

建议：

- 新 provider 至少补一条“provider 语义断言”
- 不要只看 `pages / blocks`，否则分类回归很容易漏掉

## 兼容升级规则

旧版 `document.v1.json` 进入主线前，会先经过 compat 升级。

### 硬字段

这些字段不能自动猜，缺失时应该视为结构错误：

- 文档级：
  - `schema`
  - `schema_version`
  - `document_id`
  - `source`
  - `pages`
- 页面级：
  - `width`
  - `height`
  - `unit`
  - `blocks`
- block 级：
  - `block_id`
  - `type`
  - `sub_type`
  - `bbox`
  - `text`
  - `lines`
  - `segments`

### 软字段

这些字段允许 compat 层补默认值：

- 文档级：
  - `derived -> {}`
  - `markers -> {}`
  - `page_count -> len(pages)`
- 页面级：
  - `page_index -> 当前页序号`
- block 级：
  - `page_index -> 当前页序号`
  - `order -> 当前块顺序`
  - `tags -> []`
  - `derived -> {role:\"\", by:\"\", confidence:0.0}`
  - `continuation_hint -> {source:\"\", group_id:\"\", role:\"\", scope:\"\", reading_order:-1, confidence:0.0}`
  - `metadata -> {}`
  - `source -> {}`

原则：

- compat 只补“稳定默认值明确”的字段
- compat 不负责猜结构语义
- 真正的结构错误仍然交给 validator 拦截

## 顶层结构

顶层字段：

- `schema: str`
  固定为 `normalized_document_v1`
- `schema_version: str`
  当前最新版本为 `1.1`
  validator 兼容接受 `1.0` 和 `1.1`，compat 会把旧版 `1.0` 补齐后再进入主线
- `document_id: str`
  文档标识，通常对应 job 或输入文档
- `source: dict`
  顶层来源信息，记录 provider 和原始文件
- `page_count: int`
  页数
- `pages: list[dict]`
  页面列表
- `derived: dict`
  文档级派生说明或后处理备注
- `markers: dict`
  文档级稳定标记，例如参考文献起点

示例：

```json
{
  "schema": "normalized_document_v1",
  "schema_version": "1.1",
  "document_id": "20260330145544-14ab20",
  "source": {},
  "page_count": 1,
  "pages": [],
  "derived": {},
  "markers": {}
}
```

## 页面结构

每个页面对象当前包含：

- `page_index: int`
  从 `0` 开始
- `width: number`
  页面宽度
- `height: number`
  页面高度
- `unit: str`
  当前使用 `pt`
- `blocks: list[dict]`
  页面块列表

约束：

- `pages[i].page_index` 应与数组顺序一致
- `blocks` 内的块顺序由 `order` 明确指定

## Block 结构

每个 block 当前包含：

- `block_id: str`
  稳定块 id，例如 `p001-b0000`
- `page_index: int`
  所在页
- `order: int`
  页内顺序
- `type: str`
  稳定主类型
- `sub_type: str`
  稳定子类型
- `bbox: [x0, y0, x1, y1]`
  块级边界框
- `text: str`
  块的归一化纯文本
- `lines: list[dict]`
  行级结构
- `segments: list[dict]`
  span/segment 扁平结构
- `tags: list[str]`
  轻量派生标记
- `derived: dict`
  更强的派生语义结论
- `continuation_hint: dict`
  provider 或上游结构层给出的段落连续性提示
- `metadata: dict`
  调试/映射元数据
- `source: dict`
  provider 原始来源信息

## `continuation_hint` 约定

`continuation_hint` 是 block 级稳定字段，用来承接 OCR provider 或后续结构层给出的“这些块本来属于同一段”的提示。

当前字段：

- `source`
  目前保留 `"" | "provider"`
- `group_id`
  同一连续组的稳定 id
- `role`
  `"" | "single" | "head" | "middle" | "tail"`
- `scope`
  `"" | "intra_page" | "cross_page"`
- `reading_order`
  provider 给出的组内阅读顺序；未知时为 `-1`
- `confidence`
  `0.0 ~ 1.0`

当前行为约束：

- `document.v1` 只负责把提示稳定落盘，不在 schema 层硬编码某个 provider 的私有字段
- translation 主线当前优先消费 `source="provider"` 且 `scope="intra_page"` 的提示
- `cross_page` 提示只在 translation 层满足相邻页、顺序明确、layout zone 边界安全、文本长度足够等受控条件时消费；schema 层只负责定义和保存契约
- 新 OCR provider 如果也能稳定产出连续组信息，应优先写入这个字段，而不是把私有 raw 字段直接暴露给下游

## `type / sub_type` 约定

`type / sub_type` 只承载稳定结构，不强行塞入 OCR 很难稳定判断的高层语义。

当前主类型：

- `text`
- `formula`
- `image`
- `table`
- `code`
- `unknown`

当前已使用的 `sub_type` 示例：

- `title`
- `body`
- `metadata`
- `header`
- `footer`
- `page_number`
- `footnote`
- `display_formula`
- `figure`
- `table_body`
- `code_block`

规则：

- 能稳定映射的结构，优先进入 `type / sub_type`
- 不稳定的高层语义，不要直接扩主类型系统
- 先问“这是结构，还是语义判断”
- 先问“跨 provider 是否大概率都能稳定落下来”

示例：

- 正文段落：
  - `type = "text"`
  - `sub_type = "body"`
- 页眉：
  - `type = "text"`
  - `sub_type = "header"`
- 行间公式：
  - `type = "formula"`
  - `sub_type = "display_formula"`
- 代码块：
  - `type = "code"`
  - `sub_type = "code_block"`
- OCR 无法稳定细分，但能确认是文字：
  - `type = "text"`
  - `sub_type = "metadata"` 或 `body`

反例：

- 不要把 `caption` 直接塞进 `type`
- 不要把 `reference_entry` 直接塞进 `sub_type`
- 不要因为单个 provider 有特殊字段，就扩一套新的主类型

接 provider 时可以按下面这个判断：

- `text/header/footer/page_number/footnote` 这类版面结构稳定，进 `type / sub_type`
- `formula/display_formula`、`image/figure`、`table/table_body`、`code/code_block` 这类块级结构稳定，进 `type / sub_type`
- `image_caption/table_caption/table_footnote/reference_entry/reference_heading` 这类更像“语义标签”，优先进 `tags`
- 如果本地规则或后续 LLM 已经对某块做出更强结论，再写进 `derived.role`
- `author/date/affiliation/doi` 这类 OCR 经常分不稳、provider 差异又大的内容，默认不要扩成新的稳定 `sub_type`

## `tags / markers / derived` 分层

这是当前 schema 最重要的设计约定。

### `tags`

`tags` 是块级轻量标记。

适合放：

- `caption`
- `image_caption`
- `table_caption`
- `table_footnote`
- `image_footnote`
- `reference_heading`
- `reference_entry`
- `reference_zone`

特点：

- 轻量
- 可并列
- 适合规则快速消费

适合放进 `tags` 的例子：

- 一个块同时是 `caption`，并且还能细分成 `image_caption`
- 一个块已经进入参考文献区，可额外打 `reference_zone`

不适合放进 `tags` 的例子：

- 正文 / 页眉 / 页脚这类稳定结构
- provider 的临时调试字段

### `markers`

`markers` 是文档级稳定标记。

当前已经使用：

- `reference_start`

示例：

```json
{
  "reference_start": {
    "page_index": 10,
    "block_id": "p011-b0021",
    "order": 21
  }
}
```

适合放进 `markers` 的例子：

- 文档级的 `reference_start`

不适合放进 `markers` 的例子：

- 单个 block 的语义
- 只对某一页临时有意义的调试信息

### `derived`

`derived` 是更强的派生语义结论。

块级 `derived` 当前结构：

- `role: str`
- `by: str`
- `confidence: float`

例如：

- `role = "caption"`
- `role = "reference_heading"`
- `role = "reference_entry"`

`derived` 的意义：

- 允许 provider 规则写入
- 允许本地规则写入
- 后续也允许 LLM 写入

也就是说，`derived` 是后续继续进化语义层的主要入口。

适合放进 `derived` 的例子：

- `role = "caption"`
- `role = "reference_heading"`
- `role = "reference_entry"`
- `role = "algorithm"`，但前提是这个结论来自本地规则或更高层判定，而不是硬把 provider 原字段抄进主契约

不适合放进 `derived` 的例子：

- 原始 provider 的 `raw_type`
- 可以直接稳定落进 `type / sub_type` 的结构
- 只对某个本地脚本有意义的临时标记

一个实用判断：

- 如果下游逻辑希望“快速筛一批块”，优先考虑 `tags`
- 如果下游逻辑希望“把这块当成某种明确语义对象处理”，优先考虑 `derived.role`
- 如果这是布局基础事实，不要放 `tags/derived`，直接落到 `type / sub_type`

## `metadata` 与 `source` 的边界

### `metadata`

`metadata` 放本地映射、调试和结构追踪信息。

当前已使用示例：

- `raw_index`
- `raw_angle`
- `raw_sub_type`
- `parent_block_id`

特点：

- 偏本地实现
- 偏调试/追踪
- 不建议上层强绑定太多业务逻辑

### `source`

`source` 放 provider 来源信息。

当前已使用示例：

- `provider`
- `raw_page_index`
- `raw_path`
- `raw_type`
- `raw_sub_type`
- `raw_bbox`
- `raw_text_excerpt`

特点：

- 保留原始映射
- 便于回溯 provider 输出
- 不应成为翻译/渲染主逻辑的长期依赖

## 行和段结构

`lines[*]` 当前字段：

- `bbox`
- `spans`

`lines[*].spans[*]` 当前字段：

- `type`
- `raw_type`
- `text`
- `bbox`
- `score`

`segments[*]` 当前字段：

- `type`
- `raw_type`
- `text`
- `bbox`
- `score`

约定：

- `segments` 是块内扁平序列，便于翻译和公式保护
- `lines` 保留行级结构，便于排版与局部分析
- 行内公式不作为 block 主类型，保留在 `segments/spans` 中

## 稳定契约与非稳定字段

当前建议视为稳定契约的字段：

- 顶层：`schema`, `schema_version`, `document_id`, `page_count`, `pages`, `markers`
- 页面：`page_index`, `width`, `height`, `unit`, `blocks`
- block：`block_id`, `page_index`, `order`, `type`, `sub_type`, `bbox`, `text`, `lines`, `segments`, `tags`, `derived`, `continuation_hint`, `metadata`, `source`
- `derived.role/by/confidence`

当前不建议外部强绑定的部分：

- `metadata` 内部细节
- `source.raw_*` 的具体字段集合
- 某些 provider 专属 `tags`

换句话说：

- 上层业务应优先依赖 `type / sub_type / tags / derived / markers`
- 不要把 provider 原始字段重新当成主契约

## 版本演进原则

`v1` 当前已经可用，但还不是“一次定终身”的终极版本。

后续演进原则：

- 小改动尽量追加字段，不轻易改语义
- 如果要破坏现有稳定契约，升级到 `v2`
- provider 适配器负责把上游变化吸收掉，不把变化直接泄漏到主链路

### 当前结论

现阶段不建议启动 `document.v2`。

原因：

- 当前主线刚完成 `raw -> adapter -> compat -> validator -> document.v1` 的收口，首要目标是把 `v1` 打磨稳定
- 现有新增需求大多还属于 adapter 扩展、`tags/derived/markers` 语义沉淀和回归覆盖增强，还没有到必须破坏契约的程度
- 如果过早开 `v2`，会把 provider 接入、翻译主线、渲染主线和历史任务兼容同时拉进来，收益不如先把 `v1` 做稳

### 只有满足这些条件，才考虑开 `v2`

至少满足其中一类：

1. `v1` 的稳定字段定义必须被整体替换。
   例如：
   - `type / sub_type` 体系需要大改
   - `lines / segments` 的基本组织方式需要改变
   - `tags / derived / markers` 的职责边界需要整体重划

2. 出现跨 provider 的长期共性需求，但无法用“加字段”兼容表达。
   例如：
   - 多个 OCR provider 都稳定产出某类结构，而 `v1` 无法无损承载
   - 现有字段语义已经逼得下游持续写兼容分支

3. 历史兼容成本开始明显高于升级成本。
   例如：
   - compat 默认补齐越来越像“半重写”
   - validator 和主链路需要长期维护两套相互冲突的假设

### 在此之前的默认策略

- 优先扩 adapter，不扩主链路契约
- 优先补 `tags / derived / markers` 语义，不轻易改 `type / sub_type`
- 优先追加 machine-readable schema 和回归样本，不先升级版本号

## 当前最重要的实现原则

- 主链路优先围绕 `document.v1.json`
- adapter 层负责 `raw -> normalized`
- 业务层优先消费：
  - `type / sub_type`
  - `tags`
  - `derived`
  - `markers`

不要再把 MinerU 的原始 JSON 结构当成翻译/渲染主契约。

## 协作规矩

这一层是 OCR 和下游模块之间最重要的协议边界。

- `document.v1.json` 是 translation / rendering 可以直接依赖的正式契约
- `document.v1.report.json` 用于校验、排错和兼容摘要，不是下游主输入
- 新增字段时，优先补到核心结构层或通用 trace 层，不要让下游长期依赖 raw trace
- 如果修改 `document.v1` 结构、字段语义或默认文件名，必须同时更新 adapter、README、fixture、schema 校验和下游兼容测试
- translation / rendering 负责人如果需要更多语义，应先在这里定义清楚，再进入各自模块实现，不能直接绕开这一层读取 provider 私有字段
