# rendering/source/preparation

## 负责什么

渲染前 PDF 预处理层。目前主要处理隐藏文本层剥离、pikepdf bbox
text strip 等前置准备。

## 对外入口

- `hidden_text_strip.py`
- `bbox_text_strip.py`

## bbox text strip 边界

- `bbox_text_strip.py` 是正式门面，只负责串联候选规划和 PDF 写回。
- `bbox_text_strip_types.py` 只放 bbox text strip 的结果、候选和单页计划数据结构。
- `bbox_text_strip_document.py` 只负责复制 PDF、逐页调用 engine、保存写回和
  统计结果。
- `bbox_text_strip_constants.py` 只放 bbox text strip 的阈值和 padding 常量。
- `bbox_text_strip_candidates.py` 只回答“哪些 bbox 需要删、哪些公式 bbox
  需要保护”，并只处理真实 `fitz.Page` 路径；单页决策集中在
  `plan_bbox_text_strip_page()`。
- `bbox_text_strip_accumulator.py` 只负责多页候选结果的 page map 和 skipped
  indices 累积。
- `bbox_text_strip_test_support.py` 只放测试/诊断用的 `page_height` 辅助构建，
  生产代码不要依赖。
- `bbox_text_strip_policy_adapter.py` 是 preparation 层访问
  `services.rendering.policy` 的唯一窄入口。
- `bbox_text_strip_items.py` 只负责把 translated item 过滤并转成 source/PDF
  rect iterator。
- `bbox_text_strip_geometry.py` 只做 OCR bbox 到 PDF rect 的转换、公式保护区和
  rect 切分。
- `bbox_text_strip_rects.py` 只保留 preparation 兼容导出，实际基础 rect
  合并逻辑来自 `services.rendering.source.rects`。
- `bbox_text_strip_segments.py` 只做文本 rect 避开公式后的 strip segment
  构建和扩边。
- `bbox_text_strip_page_gate.py` 只判断单页是否可做 bbox text strip，并返回
  skip reason。
- `bbox_text_strip_page_probe.py` 只做页面 content stream 大小和 text overlap
  探测。
- `bbox_text_strip_engine.py` 只处理 pikepdf content stream 的文本 op
  删除，不读取 OCR payload，也不决定公式策略。
- `bbox_text_strip_pdf_math.py` 只放 PDF matrix 计算和 operand 转换。
- `bbox_text_strip_text_ops.py` 只放文本展示 op、文本长度和估算 bbox 逻辑。
- `bbox_text_strip_hit_test.py` 只放删除区/保护区的 rect 命中判断。
- 行间公式不走 Typst 重绘；`formula` / `display_formula` bbox 是保护区，
  同页其他正文和图注仍可删除。

## 不该做什么

- 不做最终 redaction。
- 不生成 Typst。
- 不修改翻译 payload。
- 不新增页面级特殊规则；规则应先进 `services.rendering.policy`。
