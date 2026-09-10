# Render Options Contract

这份文档规定 Rust API 对外接收的 `render` 参数。原则是：

- Rust API 是参数契约入口，负责默认值、允许值和基础校验。
- Python worker 只消费 Rust 写出的 stage spec，不再自己猜默认语义。
- 新增渲染选项必须先更新这里、`API_SPEC.md`、Rust validation 和 stage spec 写入逻辑。

## 当前字段

| 字段 | 类型 | 默认值 | 允许值 / 范围 | 说明 |
| --- | --- | --- | --- | --- |
| `render.render_mode` | string | `auto` | `auto`, `overlay`, `typst`, `typst_visual`, `dual` | 渲染主路径。`auto` 会由 Python 根据 PDF 可编辑性和页面特征选择实际模式。 |
| `render.compile_workers` | integer | `0` | `>= 0` | Typst 编译并发。`0` 表示使用 worker 默认策略。 |
| `render.typst_font_family` | string | `Source Han Serif SC` | 非结构化字符串 | Typst 默认中文字体族。 |
| `render.pdf_compress_dpi` | integer | `0` | `>= 0` | PDF 图片压缩 DPI。`0` 表示不做额外图片压缩。 |
| `render.translated_pdf_name` | string | `""` | 任意文件名字符串 | 输出 PDF 文件名。空值使用后端默认命名。 |
| `render.body_font_size_factor` | number | `0.95` | `> 0` 且 finite | 正文字号全局倍率。 |
| `render.body_leading_factor` | number | `1.08` | `> 0` 且 finite | 正文行间距全局倍率。 |
| `render.font_unify_mode` | string | `role_min` | `role_min`, `off` | 字体统一策略。`role_min` 按角色统一到稳定下界，`off` 关闭统一但不关闭 fit/碰撞/背景规则。 |
| `render.source_cleanup_strategy` | string | `pikepdf_text_strip` | `typst_fill`, `pikepdf_text_strip`, `bbox_text_strip`, `legacy`, `redact_restore_formulas` | 原文处理策略。默认先做路径级 text-op 删除，再由 Typst 背景块做视觉覆盖；`typst_fill` 可显式关闭删除。 |
| `render.inner_bbox_shrink_x` | number | `0.0` | `>= 0` 且 finite | 普通 bbox 横向内缩。 |
| `render.inner_bbox_shrink_y` | number | `0.0` | `>= 0` 且 finite | 普通 bbox 纵向内缩。 |
| `render.inner_bbox_dense_shrink_x` | number | `0.0` | `>= 0` 且 finite | 密集 bbox 横向内缩。 |
| `render.inner_bbox_dense_shrink_y` | number | `0.0` | `>= 0` 且 finite | 密集 bbox 纵向内缩。 |

## `source_cleanup_strategy`

这是当前最重要的渲染行为开关。

- `typst_fill`
  保留原始 PDF 文本层，不跑 bbox text strip。每个可翻译文本块由 Typst 生成带背景色的翻译块覆盖原文。
- `pikepdf_text_strip`
  默认策略。渲染前用 pikepdf 按 bbox 删除原 PDF content stream 中的文本显示操作；遇到 `formula` / `display_formula` bbox 时只作为保护区，不删除公式内部文本，不因一页存在行间公式而整页跳过。overlay 阶段根据 `source_text_precleaned_page_indices` 跳过旧的页内 PyMuPDF redaction/visual cover，视觉遮盖仍由 Typst 文本块背景承担。
- `bbox_text_strip`
  兼容别名，当前行为等同 `pikepdf_text_strip`。保留给旧配置和历史任务。
- `redact_restore_formulas`
  兼容旧名称，当前行为等同 `pikepdf_text_strip`。名称保留是为了历史任务和旧 spec 可回放；不要再按“删后贴回公式”的语义扩展它。
- `legacy`
  旧策略别名，当前行为等同 `pikepdf_text_strip`。

默认使用 `pikepdf_text_strip` 的原因：

- 尽量减少原文从 Typst 背景块边缘漏出的概率。
- pikepdf 路径级 text-op 删除比旧的 PyMuPDF redaction 更适合正式 PDF 写入。
- `formula` / `display_formula` bbox 会作为保护区保留，视觉遮盖仍由 Typst 背景块兜底。
- 如果某类 PDF 删除风险更高，可以显式设置 `typst_fill` 只做覆盖。

## Stage Spec 映射

Rust 写出的 stage spec 必须包含这些字段：

- `provider.spec.json.render.source_cleanup_strategy`
- `book.spec.json.render.source_cleanup_strategy`
- `render.spec.json.params.source_cleanup_strategy`
- `translate.spec.json.params.render_prewarm_source_cleanup_strategy`

翻译阶段预热渲染 source 时必须使用和最终渲染一致的 `source_cleanup_strategy`，否则预热 manifest 会因为 fingerprint 不一致而失效。

## Job 快照

每个 job 创建时，Rust API 会把 resolved render 参数写入：

```text
DATA_ROOT/jobs/<job_id>/artifacts/render_config.json
```

该文件是调试某个历史任务时的权威渲染配置快照，artifact key 为 `render_config_json`。
Python 的 `pipeline_summary.json` 可以补充运行结果和诊断，但不应取代这个 Rust 侧配置快照。

## 修改规则

新增或修改 render 参数时，必须同时完成：

1. 更新 Rust `RenderInput` 默认值。
2. 更新 Rust validation。
3. 更新 stage spec 写入和 Python loader。
4. 更新 `API_SPEC.md` 和本文档。
5. 至少增加一个 Rust validation 测试或 stage spec 测试。

不要让 Python 默默接受未知值并回退默认值。未知值应在 Rust API 层直接返回 `400`，这样前端问题能尽早暴露。
