# 0002 使用 Typst 作为翻译文字叠加渲染引擎

## 背景

RetainPDF 需要在原 PDF 上叠加翻译文本，同时尽量保留公式、图片、表格和页面视觉结构。纯 PyMuPDF 写字能力有限，复杂 markdown、公式和自动 fit 的表达力不足。

## 决策

渲染主路径使用 Typst 生成 overlay，再与清理后的 PDF 背景合成。

PyMuPDF 继续负责：

- 读取和保存 PDF。
- 复制书签。
- 页面 redaction / 背景清理。
- 最终 PDF 合并和压缩。

Typst 负责：

- 翻译文本排版。
- markdown / 公式渲染。
- overlay 页面编译。

## 后果

- 渲染层必须维护 `layout -> RenderBlock -> Typst source -> overlay PDF` 的清晰链路。
- Typst 层不应该直接理解 OCR provider 或翻译策略。
- redaction 和 layout 的错误会反映到 Typst overlay 视觉结果，但职责不能混在一起。

## 替代方案

- 只用 PyMuPDF 直接写文字。实现简单，但复杂公式、markdown 和 fit 能力不足。
- 把原 PDF 全页转图片再叠字。视觉稳定，但输出文件会明显变大，并且会损失可复制文本和书签等 PDF 结构。
