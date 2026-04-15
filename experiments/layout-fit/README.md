# Layout Fit Lab

当前绝对路径：

`/home/wxyhgk/tmp/Code/experiments/layout-fit`

现有任务数据目录：

`/home/wxyhgk/tmp/Code/data`

现有任务目录：

`/home/wxyhgk/tmp/Code/data/jobs`

这个目录是排版实验区，目标是探索两类能力：

1. 用 `HTML/CSS` 做文本块排版拟合
2. 用实验结果反向辅助 `Typst` 选择更合适的字号、行高、字距和段落参数

这里不是生产代码区。短期目标是把方法论和实验结果做出来，而不是直接接入主流程。

## 当前最小工作方式

目前不要从上传、OCR、翻译重新跑全流程。  
当前阶段只需要基于已有 `data/jobs/{job_id}` 里面的产物做重新渲染和排版拟合实验。

也就是说，实验人员优先从这里取数据：

`/home/wxyhgk/tmp/Code/data/jobs/{job_id}`

一个典型任务目录通常包含：

- `source/`
  原始 PDF。
- `ocr/`
  OCR 和 MinerU 相关产物。
- `translated/`
  翻译后的中间产物。
- `rendered/`
  已渲染结果和 Typst 相关产物。
- `artifacts/`
  对外登记的下载产物。
- `logs/`
  运行日志。

当前实验的原则：

- 优先复用 `data/jobs` 里的现有结果
- 不要重新调用 MinerU
- 不要重新调用大模型翻译
- 不要修改原始 job 目录里的文件
- 如果需要生成实验结果，写到 `experiments/layout-fit/output/`
- 如果需要复制小样本，复制到 `experiments/layout-fit/fixtures/`

这样做的目的很明确：先把“同一份 OCR/翻译结果，换不同排版算法能否更好渲染”这个问题验证清楚。

## 重点 JSON 在哪里看

如果只是做排版、字体、行高、块拟合实验，优先看下面这些文件：

- 主 OCR 统一结构：
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/ocr/normalized/document.v1.json`
- OCR 统一结构说明文档：
  `/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema/README.md`
- OCR 统一结构机器 schema：
  `/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema/document.v1.schema.json`
- OCR 原始 provider 结果摘要：
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/ocr/mineru_result.json`
- OCR 原始 unpacked 内容：
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/ocr/unpacked/layout.json`
- OCR 原始 content list：
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/ocr/unpacked/content_list_v2.json`
- 翻译页级结果：
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/translated/page-XXX-deepseek.json`
- 领域上下文：
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/translated/domain-context.json`
- Typst 排版输入与输出：
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/rendered/typst/book-overlays/book-overlay.typ`
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/rendered/typst/book-overlays/book-overlay.pdf`
- 事件流：
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/logs/events.jsonl`
- 任务汇总：
  `/home/wxyhgk/tmp/Code/data/jobs/{job_id}/artifacts/pipeline_summary.json`

## 实验时优先把哪个 JSON 当真源

排版实验时，优先级要明确：

1. `document.v1.json`
   这是当前主链路已经标准化后的 OCR 真源，最适合做块级排版拟合。
2. `translated/page-XXX-deepseek.json`
   用来看每页翻译后的块内容、保护占位符和翻译结果。
3. `book-overlay.typ`
   用来看当前 Typst 实际是怎么落参数和排版的。
4. `layout.json` / `content_list_v2.json`
   只在需要回溯原始 OCR provider 输出时再看，不要把它们当主实验输入。

简单说：

- 想研究“块怎么排”，先看 `document.v1.json`
- 想研究“翻译后文本是什么”，再看 `translated/*.json`
- 想研究“当前 Typst 到底怎么排出来的”，再看 `book-overlay.typ`

## 让别人先看哪里

如果是新接手的人，先按下面顺序看：

1. 本文件：
   `/home/wxyhgk/tmp/Code/experiments/layout-fit/README.md`
2. OCR 统一结构说明：
   `/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema/README.md`
3. 选一个真实任务目录：
   `/home/wxyhgk/tmp/Code/data/jobs/{job_id}`
4. 先打开：
   - `ocr/normalized/document.v1.json`
   - `translated/page-001-deepseek.json`
   - `rendered/typst/book-overlays/book-overlay.typ`

这样基本就能知道：

- OCR 标准化后长什么样
- 翻译结果长什么样
- Typst 当前吃什么输入并产出什么版面

## 为什么单独建这个目录

当前主工程已经有稳定的前端、Rust API、Python 管线和 Typst 渲染链路。  
但“字体大小怎么选、行间距怎么定、一个文本块怎样在目标框里尽量贴合”这类问题，本质上仍然是实验问题，不适合直接塞进生产代码。

因此这里单独做一个实验场：

- 不污染 `backend/` 和 `frontend/`
- 可以快速试错
- 可以保留多个思路并行存在
- 实验成熟后，再把稳定部分迁回正式链路

## 目录约定

- `fixtures/`
  放实验输入数据。建议是小而精的样本，不要直接塞整本书。
- `html/`
  放 HTML/CSS/JS 排版实验页面。
- `typst/`
  放 Typst 对照样例，用于比较 HTML 拟合结果和 Typst 当前策略。
- `scripts/`
  放自动化脚本，例如参数扫描、误差评分、结果汇总。
- `notes/`
  放阶段结论、参数记录、失败案例、后续想法。
- `output/`
  放本地产物，例如截图、评分结果、调试 JSON。该目录默认不进 Git。

## 推荐研究边界

不要一开始就做“整页恢复”。先从最小、最可控的问题入手。

推荐分三层：

1. `text metrics`
   只研究单个文本块的字号、行高、字距、段宽。
2. `block layout`
   让一个文本块在给定目标框内尽量贴合。
3. `page composition`
   把多个已经拟合好的块重新放回页面，再看是否发生碰撞、溢出、顺序错乱。

短期最重要的是第 1 和第 2 层。

## 适合探索的具体问题

### 1. 字号拟合

输入：

- 文本内容
- 目标框宽高
- 字体族
- 初始字号范围

输出：

- 最优字号
- 在该字号下的行数、总高度、溢出情况

### 2. 行高拟合

输入：

- 固定字号
- 不同行高候选值

输出：

- 哪个行高最接近目标框高度
- 是否导致孤行、溢出、压缩过度

### 3. 字距与段落压缩

输入：

- 固定字号和行高
- 不同字距、词距、段前段后设置

输出：

- 在不明显伤害阅读体验的前提下，是否能让文本更贴近目标框

### 4. Typst 参数反推

目标不是用 HTML 替代 Typst，而是利用 HTML 实验得出的结果去回答：

- 这个块更适合多大字号
- 行高应该更松还是更紧
- 某些版面密度下，Typst 当前默认参数是不是偏保守

## 明确不做的事情

以下内容先不要碰，避免把问题做散：

- 不要先做整本 PDF 的完整 HTML 重排
- 不要先做复杂的图文混排恢复
- 不要先做表格、公式、浮动图注的终极方案
- 不要直接改生产渲染链路
- 不要在这里做和布局无关的翻译策略实验

## 推荐输入样本

建议从现有任务里抽取 5 到 10 个块级样本，覆盖以下类型：

- 单段正文
- 两到三段连续正文
- 标题
- 带行内公式的段落
- 中英文混排段落
- 稠密小字号段落
- 稀疏大字号段落

每个样本建议最少包含：

- 原始文本
- 翻译后文本
- 目标框坐标与尺寸
- 页宽页高
- 当前 Typst 使用的参数
- 渲染结果截图或参考图

## 推荐技术路线

### 路线 A：HTML 作为测量器

思路：

- 用浏览器排版引擎计算文本在目标宽度下的真实布局
- 扫描字号、行高、字距
- 选择误差最小的一组参数

优点：

- 迭代快
- 可视化方便
- 适合先做块级实验

缺点：

- 和 Typst 的排版模型并不完全一致
- 只能作为“拟合参考”，不是最终真值

### 路线 B：HTML 辅助 Typst

思路：

- 先用 HTML 搜一个较好的参数区间
- 再把参数喂给 Typst 样例做二次验证

优点：

- 更接近真实生产链路
- 能把实验结果迁移回主系统

缺点：

- 实现复杂度更高
- 调试速度比纯 HTML 慢

当前建议优先做 `路线 A`，然后再补 `路线 B`。

## 建议先做的最小闭环

1. 在 `fixtures/` 放入 5 到 10 个文本块样本
2. 在 `html/` 写一个最小实验页，支持：
   - 输入文本
   - 输入目标宽高
   - 切换字体
   - 扫描字号、行高、字距
3. 在 `scripts/` 写一个评分器，输出：
   - 高度误差
   - 宽度越界情况
   - 行数
   - 是否溢出
4. 在 `notes/` 记录每类样本的最佳参数分布
5. 在 `typst/` 做对应对照样例，看这些参数能否迁回 Typst

## 建议评分方式

先不要追求过于复杂的损失函数，先做一个简单可解释的版本：

- 高度误差越小越好
- 宽度溢出直接重罚
- 行数偏差可以适度惩罚
- 过小字号要惩罚
- 过大行高要惩罚

可以先用类似下面的思路：

`score = height_error * a + overflow_penalty * b + line_count_penalty * c + readability_penalty * d`

重点不是公式多漂亮，而是评分结果稳定、可解释、能迭代。

## 交付要求

接手这个目录的人，至少需要交付下面这些东西：

1. 一个可以本地打开的最小 HTML 实验页
2. 一组小规模但有代表性的样本
3. 一个最基础的参数扫描或评分脚本
4. 一篇阶段总结，说明：
   - 哪些块容易拟合
   - 哪些块难拟合
   - 哪些参数最敏感
   - HTML 结果和 Typst 结果差多少
5. 对主工程的建议：
   - 是否值得接入
   - 适合接在哪一层
   - 风险是什么

## 交接要求

如果你是来接这个实验的人，请先做这几件事：

1. 先读完本文件
2. 先在 `notes/` 写一页你的实验计划
3. 不要直接改主工程
4. 每次只验证一个假设，不要一口气混入多个变量
5. 结论必须配样本、截图或评分结果，不能只写主观判断

## 当前建议

当前最合理的切入点不是“整页 HTML 排版”，而是“块级拟合器”。

因为一旦块级拟合器做稳，后面可以有三种用途：

- 直接服务 HTML 渲染
- 给 Typst 提供更好的初始参数
- 为后续 Word/DOCX 导出提供字号和段落样式参考

这一步如果做不稳，直接上整页恢复只会把问题放大。
