# Rendering 说明

`retainpdf_pipeline/render` 负责把已经翻译好的页面数据变成最终 PDF。

这里不负责翻译，也不负责 OCR 解析，只负责“怎么渲染、怎么排版、怎么输出”。

## 阶段边界

Rendering 阶段的正式输入和输出固定为：

- 输入：
  源 PDF、翻译产物、渲染参数
- 输出：
  最终 PDF，以及必要的 overlay / typst / 压缩中间产物

明确不负责的事情：

- 不直接消费 provider raw OCR JSON
- 不负责把 raw OCR 规范化成 `document.v1.json`
- 不负责向翻译模型发请求，也不负责生成翻译文本

当前稳定交接点：

- rendering 主线只接受“源 PDF + 翻译产物”这一组输入
- 渲染阶段固定读取 `translation-manifest.json`；没有 manifest 的旧翻译目录不再支持直接渲染
- Render-only 调用协议固定为：`source_pdf_path + translations_dir` 或 `source_pdf_path + translation_manifest_path`
- Render-only 入口已支持 `job_root/specs/render.spec.json`（`render.stage.v1`）
- 如果输入不满足协议，入口统一抛出 `Render-only input error`，而不是在后续 Typst/PDF 阶段才报模糊错误
- 如果怀疑 OCR 结构有问题，应该先回到 `document.v1.json` / `document.v1.report.json` 排查
- 如果怀疑翻译内容或术语策略有问题，应该先回到 translation payload，而不是在 rendering 层补翻译逻辑
- API 凭证不写入 render stage spec；spec 中使用 `credential_ref`，由运行时环境注入真实 key

### 阶段契约副本（stage-contract duplicate）

阶段之间禁止互相 import，边界上共享的读写契约因此是**照抄一份文件**，文件头用
`Duplicated from retainpdf_pipeline.xxx.yyy` 标出源模块。复制是有意设计，不要合并回去。

改这类文件时**两份都要改**：一边加了字段另一边漏改不会报错，只会让下游永远读不到新字段。
`devtools/architecture_checks/stage_contract_duplicates.py` 会比对副本与源中同名顶层符号的
字面量契约（dict 键集合、封闭词表成员、标量常量、正则 pattern），分叉即报错；
只在一边存在的符号被跳过，所以「故意只抄一部分」的副本仍然合法。

## 当前目录结构

```text
retainpdf_pipeline/render/
  __init__.py
  README.md
  legacy/          旧调用方兼容入口；新逻辑不要放这里
  workflow/        渲染阶段编排，只调度，不做具体 PDF/Typst 细节
  analysis/        页面画像、页面分类和页面路线决策
  document/        源 PDF、页码映射、书签/目录等文档级辅助
  source/          原 PDF 准备、清理、背景重建和压缩
  layout/          翻译块到渲染块的排版计算
  output/          Typst 源码生成、编译、overlay 合成和 PDF 写出
```

推荐理解顺序：

`workflow -> document/analysis -> source/layout -> output`

`legacy/` 是旧调用方兼容门面，不应该继续堆业务逻辑。

## 渲染主路径

当前主路径可以概括为：

`translation JSON -> layout/payload -> output/typst -> PDF`

上层通常通过 [render_stage.py](./render_stage.py) 调用这里的能力。

输入边界：

- rendering 主线消费的是翻译后的 page payload 和源 PDF
- 当前逐页 translation payload 与 `translation-manifest.json` 是上游默认交付物；渲染层只负责读取，不负责定义 OCR/翻译阶段协议
- 如果上游只想重跑渲染，可以显式传 `translation_manifest_path`，不必依赖固定目录扫描
- OCR provider 的 raw JSON 不应该直接流入这里
- 如果上游 OCR 结构有问题，应先回到 `document.v1.json` / `document.v1.report.json` 这一层排查，而不是在渲染层补 provider 特判

## 模块分工

- `legacy/`
  旧调用方兼容门面。新业务逻辑不要写在这里，只转发到具体模块。
- `workflow/`
  编排渲染流程，负责选择模式、串联 Typst/背景/redaction，不直接写复杂算法。
- `workflow/render_only.py`
  render-only worker 包装入口。
- `analysis/profile/`
  单页事实采集层。只回答“这一页是什么样”，不决定怎么渲染。
- `analysis/route/`
  单页路线决策层。只根据 profile 决定路线，不直接操作 PDF。
- `layout/payload/`
  把翻译后的 OCR payload 转成可渲染块。
- `layout/typography/`
  排版测量和几何工具层。
- `layout/inline_content/`
  公式、Markdown、Typst inline 文本归一化。
- `source/render_source.py`
  源 PDF 渲染前准备，包括隐藏文本剥离和压缩副本选择。
- `source/cleanup/`
  直接操作 PDF 页面对象，负责删字、盖底和写回。
- `source/background/`
  大背景图页面的局部背景重建。
- `source/compression/`
  PDF 图片型压缩。
- `output/typst/`
  负责把渲染块变成 Typst 源码并编译成 PDF。
- `output/pdf_writer.py`
  兼容旧 import 的 re-export；新代码优先使用 `document/pdf_ops.py`。
- `document/pdf_ops.py`
  通用 PDF 保存和页面链接处理辅助。它属于文档级基础能力，不属于 Typst 输出层。
- `document/pikepdf_overlay.py` / `document/pikepdf_pages.py`
  正式 PDF 结构写入优先入口。用于内容流级 overlay 合并、整本/选页复制和路径级优化。
- `layout/model/`
  渲染层公共数据结构和排版文本 helper。
- `layout/page_specs.py`
  页面级渲染规格组装，连接翻译 payload、页面几何和输出层。

## 背景遮盖策略

Typst overlay 路径优先使用“文本容器自带背景”：

```typst
place(...,
  block(width: ..., height: ..., fill: ...)[
    译文内容
  ]
)
```

不要再为普通译文块单独输出一层 `rect(...)` 白块再输出文字。文本容器自带背景可以让白底和文字天然绑定，减少层级、错位和覆盖顺序问题。

需要区分两件事：

- 视觉遮盖：由 Typst block 的 `fill` 或 Word 白底文本框完成。
- 文本层清理：仍由 `source/cleanup` 和 redaction 策略处理，不能只靠视觉遮盖替代。

## PDF 写入原则

正式产物的 PDF 结构修改优先走 `pikepdf`：

- content stream text-op 删除
- hidden text strip
- 整本 Typst overlay 合并
- 无源页清理需求的逐页 Typst fallback overlay 合并
- 无源页修改需求的 single-PDF overlay 合并
- 路径级 bbox rect text-op 删除
- PDF 复制、选页抽取和结构重写
- 图片对象压缩 / 替换

PyMuPDF 主要保留在读和分析场景：

- 页面尺寸、文字、bbox、drawing 分析
- 截图和调试预览
- 颜色采样、首行缩进检测等视觉辅助

不要在新主链中继续新增 PyMuPDF destructive write：

- 不新增 `apply_redactions`
- 不新增 `show_pdf_page` 作为正式 overlay 合并
- 不新增 `insert_pdf + doc.save` 作为结构复制路径

现有 PyMuPDF 写入只作为 legacy/fallback 保留，迁移时优先用 `document/pikepdf_*` 或
`source_cleanup` 中的路径级工具替代。
页内 `remove_text_under_rects_with_pymupdf_redaction` 属于 legacy redaction 边界；新增文本层清理优先使用 `source_cleanup` 包的路径级 pikepdf rect-strip 能力。pikepdf text strip 只删除可翻译文本块，`formula` / `display_formula` bbox 作为保护区保留原 PDF 公式；公式页中的其他正文/图注仍可删除，不再因为一页存在公式而整页跳过。
渲染前处理会向 workflow 传递 `source_text_precleaned_page_indices`，其中包括实际删除过 text-op 的页面和检测到无原文重叠的页面；overlay 阶段用它判断是否可以跳过旧的页内 visual cover/redaction。
`source_cleanup_strategy=pikepdf_text_strip` 是正式策略名，后续新配置应使用这个名字。
渲染 diagnostics 会记录 `legacy_pymupdf_redaction_pages`、`legacy_pymupdf_overlay_pages` 和 `legacy_pdf_write_reasons`；真实样本回归时优先观察这些值是否仍非零。

## 纯 Typst 编译速度

大文档 overlay 路径不要退化成逐页 Typst 编译。逐页 PDF 会重复嵌入字体和资源，最终文件体积容易膨胀。

当前分片是显式 opt-in 策略，不作为默认路径。默认仍优先整本 Typst 编译，因为这通常体积最小，并且很多大文档整本编译并不慢。

显式开启后，策略是体积受控的大块分片：

- 只有设置 `RETAIN_TYPST_OVERLAY_CHUNKED=1` 且可以用 `pikepdf` 合并 overlay 的大文档才启用。
- 默认 `256` 页以上启用分片，默认每片 `128` 页。
- 每片生成一个多页 overlay PDF，再由 `pikepdf` 一次性合并回源 PDF。
- 小文档继续走整本 Typst 编译，保持体积最优。

可调环境变量：

- `RETAIN_TYPST_OVERLAY_CHUNKED=1` 开启分片编译。
- `RETAIN_TYPST_OVERLAY_CHUNK_MIN_PAGES` 调整启用阈值。
- `RETAIN_TYPST_OVERLAY_CHUNK_PAGES` 调整每片页数。不要轻易设得太小，除非已经确认文件体积可接受。

## Render Prewarm 复用

`render_prewarm` 同时承载两类产物：

- source 产物：预处理后的源 PDF、bbox text-strip candidates。
- payload 产物：首行缩进、effective inner bbox、颜色 profile、背景模式 page specs。

render-only 阶段必须同时复用这两类产物。特别注意：同步刷新 source manifest 时不能清空既有
`payload_prewarm`，否则 overlay 渲染会重新跑 payload prepare 和颜色采样。

真实 635 页样本中，payload prewarm 命中后：

- `color_adapt_elapsed_seconds` 从约 `14.1s` 降到约 `0.1s`。
- `payload_prepare_elapsed_seconds` 从约 `22.3s` 降到约 `9.9s`。
- 总 render-only 从约 `49s` 降到约 `23s`。

## 失败、缓存与选页边界

- Typst 内容错误才进入公式清理、逐块探测和逐页回退。启动失败、超时或进程被信号终止
  必须保留原 `TypstCompileError` 向上传递，不得通过修改译文重试；并行编译取消尚未开始
  的任务，已运行的任务仍受各自的编译超时约束。
- Overlay 源码缓存身份包含字体、页面尺寸、内容和覆盖模式。同一字体可复用源码，字体
  改变必须重新生成；旧缓存若没有完整指纹，不得仅凭页面尺寸判断可复用。
- 选页渲染必须同步映射运行期页索引、预处理数据和视觉采样数据。原始 PDF 的采样窗口
  必须与抽取后的渲染页对应，不能用清理后的页面代替原图采样；稳定的 item/document ID
  不变，也不能原地改写调用方 payload。`RETAINPDF_RENDER_NO_CACHE` 同样适用于选页路径。

## 真实 PDF 回归

真实样本放在
[tests/fixtures/pdfs](../../../../tests/fixtures/pdfs)。

常用命令：

```bash
python3 backend/pipeline/devtools/run_golden_flow.py --check-manifest
python3 backend/pipeline/devtools/run_golden_flow.py --list-samples
python3 backend/pipeline/devtools/run_golden_flow.py \
  --job-root data/jobs/golden-fullflow-book-20260511170519 \
  --render-only \
  --bbox-item p001-b013
python3 backend/pipeline/devtools/run_golden_flow.py \
  --job-root data/jobs/golden-pseudo-20260512-full \
  --render-only \
  --bbox-item p001-b013
```

当前最小回归集：

- `editable-paper-formula`：可编辑论文 PDF，覆盖文本层、公式和常规 Typst 背景渲染。
- `pseudo-editable`：伪可编辑 PDF，覆盖扫描/背景图风险和文本层保留风险。

回归脚本会检查：

- 样本清单合法。
- 最终 PDF 页数与源 PDF 一致。
- 翻译诊断没有 unresolved 项。
- 抽样 block 的 Typst 放置坐标与 OCR bbox 左上角一致。

## Import 边界

- runtime/pipeline 只应调用 `workflow/` 的稳定入口。
- `analysis/route/` 可以依赖 `analysis/profile/`，但 `analysis/profile/` 不应反向依赖 `analysis/route/`。
- `layout/` 不应直接调用 source cleanup；它只生成排版/渲染块。
- `output/typst/` 不应重新做 OCR/翻译判断；需要页面事实时从 profile/route 传入。
- `source/cleanup/` 可以操作 PDF 页面对象，但不应生成 Typst 源码。
- 新代码优先 import 具体模块，不要依赖包根 `__init__.py` 的 re-export。

## 推荐入口

- [render_stage.py](./render_stage.py)
- [render/workflow](workflow)

## 公式回归

如果新增了一条公式归一化规则，直接把坏例子补到
[`devtools/tests/translation/test_formula_math_markers.py`](../../devtools/tests/translation/test_formula_math_markers.py)
里的参数化回归测试。

## 协作规矩

如果渲染模块单独分人维护，这里只负责“读取翻译产物并生成最终 PDF”。

- 允许在这里改 overlay、Typst、背景处理、压缩、红框擦除和版面回填
- 不要在这里补 OCR provider 特判，也不要在这里追加翻译请求或术语替换逻辑
- 正式输入边界是 `source_pdf_path + translations_dir/translation_manifest_path`
- 如果修改渲染输入协议、manifest 读取方式或最终产物命名，必须同步更新 `runtime/pipeline`、调用入口、README 和测试
- 遇到上游 OCR 或翻译问题，优先把问题退回对应模块修，不要在 rendering 层堆跨层补丁
