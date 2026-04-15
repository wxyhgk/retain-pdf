# Layout-Fit 跨页/跨栏问题说明

## 问题现象

在 `layout-fit/html/pretext.html` 的 PDF 覆盖预览里，部分区域虽然单框拟合看起来接近，但遇到跨页、跨栏段落时会出现明显错误：

- 第三页底部和第四页开头本来是同一段文字，却被当成两个独立块重新排版。
- 某些块显示英文原文，而不是中文译文。
- 自动拟合的高度、行数、断行结果看起来“差一点”，但实际上是系统性偏差。

## 根因

这次问题不是单一原因，而是几层错误叠加：

### 1. 错把跨页续接段落当成独立 block

上游翻译和 Typst 为了方便处理，把一个跨页段落拆成了两个 item。

例如：

- `p003-b0005 -> p004-b0000`
- `p005-b0005 -> p006-b0000`
- `p007-b0004 -> p008-b0000`
- `p009-b0006 -> p010-b0000`

在 Typst overlay 里，这些也是两个独立的 `pX_item_*`，不是一个天然连续流动的对象。

但旧版 preview 仍按“一个 sample = 一个独立文本框”处理，所以：

- 前一页尾部只排前半段
- 后一页开头又从自己的文本重新开始排

这会导致跨页段落无法正确续接。

### 2. 翻译 JSON 里部分续接块本身没有译文

例如：

- `p003-b0005`
- `p004-b0000`

在 `translated/page-003-deepseek.json` 和 `translated/page-004-deepseek.json` 里，这两个块的 `translated_text` 是空字符串。

因此旧逻辑会退回 `source_text`，页面上就显示成英文原文。

### 3. `pretext` 测量单位和 PDF 坐标单位混用

`pretext` 的测量基于浏览器像素，而 PDF 的目标框是 `pt`。旧实现直接把 PDF `pt` 宽高喂给 `pretext`，又把结果当 `pt` 用回覆盖层和评分，导致：

- 断行不稳定
- 行高和高度评分偏差
- 看起来像“拟合不太对”

## 解决方案

### 1. 把跨页 block 恢复成 flow group

在 [extract_block_samples.py](/home/wxyhgk/tmp/Code/experiments/layout-fit/scripts/extract_block_samples.py) 中增加了跨页续接检测：

- 顺序扫描 OCR text block
- 如果上一块以英文词中间结尾、下一块以小写或续接样式开头，并且跨页相邻
- 就把它们标记为同一个 `flow`

然后将 `flow` 信息写入 fixture：

- `group_id`
- `index`
- `count`
- `prev_block_id`
- `next_block_id`
- `block_ids`

这样前端不再把这些块当彼此独立。

### 2. 前端改成多框串流，而不是单框独立拟合

在 [pretext.html](/home/wxyhgk/tmp/Code/experiments/layout-fit/html/pretext.html) 中：

- 对属于同一 `flow` 的多个 box，先把文本拼成一个连续段落
- 用 `pretext.layoutNextLine()` 按 box 顺序逐框消费行
- 前一个框放不下的剩余内容，继续流到下一个框

这一步修复了跨页、跨栏本质问题。

### 3. 翻译缺失时回退到 Typst markdown 文本

在同一个抽取脚本里，增加了对 Typst overlay 中 `*_md` 的解析。

如果某个 block：

- `translated_text` 为空
- 但 Typst 里对应 `markdown_text` 存在

就把 Typst 的中文 markdown 作为 `translated_text / fit_text` 的回退来源。

这一步修复了第三页底部、第四页开头显示英文的问题。

### 4. 统一 `pretext` 与 PDF 的单位系

前端拟合时改成：

- 先按 PDF 页图的像素密度把字号、宽度、行高换成像素
- 用 `pretext` 在该像素坐标系里排版
- 再把结果换回 PDF `pt` 用于评分和覆盖层绘制

这样断行和 PDF 覆盖终于在同一个坐标系里。

## 当前效果

修复后：

- 第三页底部和第四页开头会显示中文
- 两者不再各自从头排，而是同一个段落连续串流
- 预览层已经能够识别并处理多组跨页续接

已识别的跨页 flow 包括：

- `p003-b0005 -> p004-b0000`
- `p005-b0005 -> p006-b0000`
- `p007-b0004 -> p008-b0000`
- `p009-b0006 -> p010-b0000`

## 经验总结

这类问题不能只从“字号、行高、两端对齐”去调。

如果上游翻译/排版为了工程方便把段落拆碎，preview 层必须恢复“段落流”的语义；否则无论 `pretext` 怎么调，都会在跨页和跨栏场景里出现结构性错误。
