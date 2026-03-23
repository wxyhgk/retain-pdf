# Rendering 说明

`scripts/rendering` 负责把已经翻译好的页面数据变成最终 PDF。

这里不负责翻译，也不负责 OCR 解析，只负责“怎么渲染、怎么排版、怎么输出”。

## 渲染主路径

当前推荐路径是：

`translation JSON -> render_payloads -> typst_renderer -> PDF`

上层通常通过 `scripts/pipeline/render_stage.py` 调用这里的能力。渲染阶段支持几种主要输出思路：

- `typst`
  当前主路径。先把翻译结果整理成适合 Typst 的渲染块，再生成 Typst 源码并编译成 PDF。该路径支持背景渲染，失败时会回退到 overlay 路径。
- `direct`
  直接把翻译文本写回原 PDF 页面。适合需要尽量少依赖 Typst 的场景，也常作为兼容或兜底路径。
- `compact`
  和 `direct` 同属直接写回路径，但更偏向快速本地构建。
- `dual`
  生成左右并排的双页 PDF，左边原文，右边译文，便于对照检查。

## 模块分工

### `render_payload_parts/`

这一层负责把翻译后的 OCR payload 转成“可渲染块”。

主要做这些事情：

- 计算页面级字号、行距、文本密度等指标
- 把 `translation_unit` 级别的数据拆回到原始框
- 生成适合 Typst 的 markdown/plain text 结构
- 处理 `inline_equation` 占位符和公式映射
- 将一个页面内多个框的内容按容量分配，避免重叠和错位

这一层输出的不是 PDF，也不是 Typst 源码，而是中间态的渲染 payload。

### `typst_renderer/`

这一层负责把渲染块变成 Typst 代码，再把 Typst 代码编译成 PDF。

它是当前主渲染路径的核心，主要职责是：

- 生成单页或整书的 Typst 源码
- 编译单页、整书、背景渲染版本
- 处理 `typst` 的 overlay、background、dual 输出
- 在公式或特殊块无法稳定渲染时做回退处理

### `pdf_overlay_parts/`

这一层负责直接写回 PDF 的路径。

它主要处理：

- 删除或清理原 PDF 中的链接
- 按 bbox 删除原文字
- 在指定区域插入翻译文本
- 处理需要保留公式的文本插入
- 导出优化后的 PDF

这一层不依赖 Typst，更偏向直接操作 PDF 页面对象。

## 主要文件

- `render_payloads.py`
  对外门面，负责把翻译结果整理成渲染所需结构。
- `pdf_overlay.py`
  对外门面，提供直接写回 PDF 的接口。
- `typst_page_renderer.py`
  对外门面，提供 Typst 渲染的页面级和整书级接口。
- `font_fit.py`
  字号、行距、容量估算相关工具。
- `pdf_compress.py`
  PDF 后处理压缩工具。
- `math_utils.py`
  markdown、纯文本和公式格式化工具。
- `models.py`
  渲染层使用的数据结构定义。

## 典型调用关系

1. 上层把页面翻译结果交给 `render_payloads`
2. `render_payloads` 把 OCR 框整理成适合渲染的块
3. 如果走 `typst`，`typst_renderer` 生成 Typst 源码并编译 PDF
4. 如果走 `direct/compact`，`pdf_overlay` 直接把译文写回原 PDF
5. 如果走 `dual`，`typst_renderer` 生成左右对照 PDF
6. 最后统一做 PDF 优化和压缩

## 设计原则

- 渲染层只关心“怎么画”，不关心“怎么翻译”
- `render_payload_parts` 负责中间表示，避免渲染代码直接依赖 OCR 原始结构
- `typst_renderer` 和 `pdf_overlay` 各自独立，避免不同输出策略互相污染
- 所有对外入口尽量稳定，内部实现可以继续拆分

## 推荐入口

日常使用不建议直接调用内部子模块，而是让上层通过 `scripts/pipeline/render_stage.py` 统一调度渲染流程。
