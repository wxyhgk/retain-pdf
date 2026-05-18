# rendering/source/cleanup

## 负责什么

PDF 原页面清理层。这里直接操作 PyMuPDF 页面对象，处理原文删除、视觉遮盖、
背景填充和相关诊断。它不负责 Typst 源码、译文排版、OCR provider 原始数据或
workflow 编排。

## 稳定入口

外部优先使用 source 层 facade：

- `services.rendering.source.redaction.redact_source_text_areas`
- `services.rendering.source.redaction.redact_translated_text_areas`

cleanup 子包内部的稳定入口：

- `redaction.py`：对外 redaction 入口。
- `strategy.py`：用户可见/配置层 redaction strategy 解析。
- `routes.py`：根据已解析路线分发到具体执行分支。

其它模块默认视为实现细节；新增调用时优先依赖具体实现模块，不要回到聚合 facade。

## 已移除的旧兼容入口

这些旧聚合/兼容模块已经删除；调用方必须改用具体实现模块或 source 层 primitive：

- `analysis.py`
- `document_ops.py`
- `fill.py`
- `geometry.py`
- `math_protection.py`
- `ops.py`
- `plan.py`
- `route_selection.py`
- `shared.py`
- `text_analysis.py`
- `text_draw.py`
- `text_match.py`
- `vector_analysis.py`

基础能力位置：

- 背景填充：`source/background/fill.py`
- 基础矩形工具：`source/rects.py`
- translated item 读取：`source/items.py`
- PDF 文档操作：`source/document_ops.py`
- dev overlay：`source/dev_overlay/`

## 实现分组

### Text Matching
- `text_matching.py`：item 到可删除文本矩形的主匹配流程。
- `text_safe_direct.py`：单个 span 与 OCR bbox 足够接近时的安全直删判断。
- `text_ownership.py`：重叠 bbox 场景下 word/span/block 归属判断。
- `text_math_guard.py`：公式保护区过滤和 display math 侵入检测。
- `text_rects.py`：word/block 匹配结果到 redaction rect 的转换。
- `text_extract.py`：PyMuPDF 文本 blocks/spans/words 提取。
- `text_intrusion.py`：检测页面里疑似侵入 display math 区域的大号短文本 span。

### Route And Plan
- `auto.py`：自动清理路线的执行细节；`routes.py` 只做 route selection 后的分发。
- `valid_items.py`：将 translated item 转成 cleanup 可执行 item 列表。
- `route_decision.py`：redaction route decision 的类型定义。
- `route_context.py`：从 plan/page 生成路线选择所需的 image/drawing facts。
- `route_decider.py`：根据 route、context 和 fill policy 选择具体执行分支。
- `plan_types.py`：`RedactionPlan` 类型定义。
- `page_facts.py`：采集 image page、drawing rects 和 drawing count。
- `plan_builder.py`：从页面和 translated items 构造 `RedactionPlan`。
- `plan_policy.py`：基于 plan 的页面级 cover/vector-heavy 判断 helper。
- `empty_result.py`：空 redaction 输入的稳定诊断结果。
- `redaction_flow.py`：对外 redaction 入口背后的流程编排。

### Execution Routes
- `standard.py`：标准文本层清理路线入口，保留历史 monkeypatch/debug 入口。
- `standard_policy.py`：标准路线的 item/page 级策略判断。
- `standard_thresholds.py`：标准路线阈值常量。
- `standard_execution.py`：页面级 cover+text cleanup 和 redaction annotation 执行 helper。
- `cover_only.py`：高绘制数量页面的纯遮盖+文本层清理执行分支。
- `image_page.py`：图片页清理路线，先准备背景覆盖，再删除文本层，最后回贴背景。
- `vector_heavy.py`：矢量复杂页清理路线，直接覆盖并删除可安全清理的文本层。
- `visual_cover_execution.py`：视觉遮盖路线的执行 helper，包括 flat/normal cover 和可选文本层删除。
- `layer_items.py`：按 cleanup item plan 提取 visual cover rect 和 bbox text strip rect。

### Math And Vector Guards
- `math_fonts.py`：特殊公式字体识别。
- `math_spans.py`：从页面文本 span 采集公式保护 rect 和普通文本高度。
- `math_intrusion.py`：判断公式保护 rect 是否侵入可删除文本区域。
- `vector_overlap.py`：计算 item bbox 与页面绘制 rect 的 overlap 数量和面积比例。
- `vector_item_policy.py`：根据 overlap 统计判断 item 是否只能走视觉遮盖。

### Legacy / Dev Overlay
- 旧 `text_layer.py` / `visual_cover.py` 兼容包装已移除；调用方必须使用
  `routes.py` 或具体执行模块。
- 旧 `text_draw.py` / `builders.py` 兼容包装已移除；调用方必须使用
  `source/dev_overlay/`。

## 边界规则

- 不被 `source/background/` 直接 import；background 只能通过 source 层 facade
  或 primitive 调用。
- 不从 layout/output/workflow 层反向 import；只接收 source/page/item 层输入。
- 新代码不要 import 兼容入口；架构门禁会拦截 cleanup 内部对这些 facade 的依赖。
- 基础 geometry、item 读取、PDF 文档操作需要共享时，上移到 `source/rects.py`、
  `source/items.py`、`source/document_ops.py`。
