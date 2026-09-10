# Golden fixture: chem-6ada81-10p

来源：`data/jobs/20260709124749-6ada81`（Chemistry A European J — 10 页，paddle OCR + deepseek 翻译 + overlay 渲染，已完成 `finished/succeeded`，181s）。

用途：离线重放回归——跳过 OCR/翻译远端调用，只重放 `render-only` 并校验结构化不变量，支撑"已有成果当用例"的闭环。

包含（已脱敏，绝对路径替换为 `{JOB_ROOT}/{REPO_ROOT}/{UPLOADS_ROOT}` 占位）：

- `specs/{normalize,provider,translate,render}.spec.json` — 四份 stage spec
- `ocr/normalized/document.v1.json` + `document.v1.report.json` — 归一化文档
- `translated/{domain-context.json, translation-manifest.json, page-*-deepseek.json (10)}` — 翻译结果与 manifest
- `artifacts/pipeline_summary.json` — 期望的 pages_processed/render_mode 等

不包含：`source/*.pdf`（大文件，用 `tests/fixtures/pdfs/*.pdf` 或运行时拷贝）、`rendered/*.pdf`（渲染产物由 harness 产出后校验）。

不变量阈值（harness 断言）：
- manifest `pages.length == 10`
- `page-*.json` 均存在且非空，块数总和 ≈ 原 `document.v1.json` 的块数容差内
- `pipeline_summary.pages_processed == 10`, `effective_render_mode == overlay`
- 渲染后 PDF 页数 == 源 PDF 页数（由 harness 在运行时比对）

复原方法：`golden_harness.py` 会把占位符重写为临时 `job_root` 的真实路径后再调 `run_render_only`。
