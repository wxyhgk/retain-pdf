# 0004 渲染层按 workflow/analysis/source/layout/output 分层

## 背景

渲染层同时处理页面画像、原 PDF 清理、背景重建、译文排版、Typst 生成和 PDF 写出。旧结构按技术文件自然增长，导致 `source`、`layout`、`output` 之间出现桥接逻辑堆叠，后续修字体、删除策略或 overlay 时容易互相影响。

典型问题是：

- `source/background` 既构建 layout block，又做 redaction，又合并 overlay。
- 通用 PDF 保存能力放在 `output/pdf_writer.py`，导致 source 层反向依赖 output。
- `layout/typography/measurement.py` 同时包含 bbox 测量、行数预测、紧凑度、正文候选和页基准字号。
- `RenderLayoutBlock` 和 `RenderBlock` 双轨存在，字段计算重复。

## 决策

渲染层一级目录按稳定职责分层：

- `workflow`：流程编排。
- `analysis`：页面/文档事实和路线判断。
- `document`：文档级通用能力，比如 metadata、page map、PDF 保存辅助。
- `source`：原 PDF 准备、清理、背景重建和压缩。
- `layout`：译文排版、字体、行距、bbox fit、渲染块模型。
- `output`：Typst/PDF overlay 输出。
- `legacy`：旧入口兼容，不放新业务逻辑。

这次重构落实了几个边界：

- `source/background/redaction_plan.py` 只消费 `RenderBlock`，不再调用 `layout.payload.blocks`。
- `build_render_blocks` 上移到 `output/typst/source_page_overlay.py` 这一桥接层。
- `save_optimized_pdf` 和 `strip_page_links` 下沉到 `document/pdf_ops.py`。
- `layout/model/block_view.py` 作为 `RenderLayoutBlock -> RenderBlock` 的统一视图。
- `output/typst/block_fields.py` 统一 Typst emitter 的 bbox/font/color 字段计算。
- Typst overlay 路径使用“文本容器自带背景”，不再为普通译文块输出独立 `rect(...)` 白块。
- `layout/typography/measurement.py` 保留兼容导出，真实逻辑拆到单职责模块。

## 后果

- 新代码不能随意跨层 import，必须通过 `backend/scripts/devtools/check_pipeline_architecture.py`。
- `legacy/` 只能 re-export 或兼容旧调用方，不应承载新逻辑。
- `source` 可以操作 PDF 页面对象，但不应知道 Typst 输出细节，也不应自己构建 layout payload。
- `layout` 只产出排版模型，不直接清理 PDF 或生成 Typst。
- output 层可以做桥接，但需要避免把 OCR/翻译判断带进来。
- 视觉遮盖和文本层清理分开处理。Typst/Word 的文本容器背景只负责视觉层，PDF 原文本层仍由 `source/cleanup` / redaction 策略负责。

## 验证

当前基础验证：

```bash
python3 -m pytest backend/scripts/devtools/tests/rendering -q
python3 -m pytest backend/scripts/devtools/tests/text_layout -q
python3 -m compileall -q backend/scripts
python3 backend/scripts/devtools/check_pipeline_architecture.py
```

真实 PDF render-only 回归：

```bash
python3 backend/scripts/devtools/run_golden_flow.py \
  --job-root data/jobs/golden-fullflow-book-20260511170519 \
  --render-only \
  --bbox-item p001-b013

python3 backend/scripts/devtools/run_golden_flow.py \
  --job-root data/jobs/golden-pseudo-20260512-full \
  --render-only \
  --bbox-item p001-b013
```

这两个样本分别覆盖可编辑论文 PDF 和伪可编辑 PDF。

## 替代方案

- 继续按文件自然拆分，不加边界检查。短期快，但会继续积累跨层补丁。
- 直接引入 `tach` 或 `import-linter`。更系统，但当前已有 `check_pipeline_architecture.py` 足够先守住关键边界。
- 一次性合并 `RenderLayoutBlock` 和 `RenderBlock`。理论更干净，但会同时影响 Typst 输出、redaction 和 page spec，风险过高；先用 `block_view` 渐进统一。
