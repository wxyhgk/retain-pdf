# pretext 第一层评估

评估对象：

- <https://github.com/chenglou/pretext>
- <https://github.com/chenglou/pretext/blob/main/STATUS.md>

评估结论：

`pretext` 值得进入 `layout-fit` 的候选方案清单，但第一阶段不要直接把它定为唯一测量内核。更稳妥的定位是：和原生 HTML/DOM 测量器并行，作为更可控、可缓存、低 reflow 的块级文本布局测量方案做小样本对照。

## 和 layout-fit 的匹配点

`layout-fit` 当前最重要的问题是块级拟合：给定文本、字体、目标宽高和候选排版参数，稳定计算行数、高度、宽度溢出，再选择最接近目标框的一组参数。

`pretext` 的核心方向正好贴近这部分问题：

- 它把文本布局拆成可编程的准备和布局步骤，而不是完全依赖 DOM reflow。
- 它暴露了 `prepare()` 和 `layout()` 这类基础入口，适合做“同一段文本，多组参数反复测量”的扫描。
- 它支持 `layoutWithLines()`、`prepareWithSegments()`、`measureLineStats()` 等更细粒度接口，适合拿到逐行结果和行统计信息。
- 它强调低分配、低延迟的文本布局路径，适合后续做批量样本扫描或实时调参。

## 可以直接服务的能力

第一层可复用能力主要是测量和布局，不是完整 PDF 恢复：

- 给定宽度约束后，计算文本如何换行。
- 拿到行数、行宽和整体高度一类布局指标。
- 支持在不同参数下重复运行布局，用于字号、行高和段宽扫描。
- 支持更细的文本片段输入，为后续处理中英文混排、强调样式或占位符保留提供空间。

## 不能直接解决的问题

这些能力仍然需要 `layout-fit` 自己做上层封装：

- 从 `document.v1.json`、`translated/page-XXX-deepseek.json` 抽取块级样本。
- 定义 `fixtures` 的样本格式和实验输出格式。
- 把测量结果映射到 Typst 的字号、行高、段落参数。
- 做页面级多块回放、碰撞检测和图文混排恢复。
- 验证 CJK、中英文混排、行内公式和 OCR 框坐标下的实际误差。
- 对比 DOM、`pretext`、Typst 三者在同一批样本上的行数和高度差异。

## 当前风险

主要风险不在于 `pretext` 是否有价值，而在于它和我们的最终排版目标是否足够接近：

- 它的排版模型不等同于 Typst，不能直接把输出当成 Typst 真值。
- 字体测量一致性仍然可能受浏览器、Canvas 字体加载和平台字体差异影响。
- 如果我们需要强控制 `letter-spacing`、段间距、中文标点压缩或公式占位符宽度，可能需要额外 adapter。
- 如果样本主要来自 OCR 框，目标是贴合原 PDF 块尺寸，普通文本布局指标可能还不够，需要另加 OCR/Typst 对照评分。

## 建议定位

下一步不要只做单轨 HTML/DOM 测量器，而是改成双轨：

- 轨道 A：HTML/DOM 基线测量器。
- 轨道 B：`pretext` 候选测量器。

两条轨道使用同一批 `fixtures`，输出同一组指标：

- `lineCount`
- `height`
- `maxLineWidth`
- `overflowX`
- `overflowY`
- `score`

第一轮 PoC 只需要回答一个问题：在 5 到 10 个真实文本块样本上，`pretext` 的行数、高度和溢出判断是否比 DOM 基线更稳定、更容易做参数扫描。

如果 PoC 结果稳定，再考虑把 `pretext` 包成 `scripts/` 或 `html/` 下的正式测量 adapter；如果结果和 DOM/Typst 差异过大，就只保留为参考方案。

## 当前实现状态

`layout-fit` 里已经补了浏览器侧 PoC 入口：

- `html/pretext.html`
- `package.json`

依赖通过国内镜像可以正常安装：

- `npm install --registry=https://registry.npmmirror.com`

另外已经确认一件重要事实：

- `@chenglou/pretext` 在当前 Node 环境里可以被导入。
- 但真正执行 `prepare()` / `prepareWithSegments()` 时需要 `OffscreenCanvas` 或 DOM canvas context。
- 因此当前最合理的 PoC 位置是浏览器侧，不是纯 Node CLI 脚本。
