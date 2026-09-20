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

## specs/ 是契约基准，不只是快照

`specs/translate.spec.json` 的 `params` key 集合被两边同时钉死：

- Rust：`retain-data` 的 `stage_specs_keep_python_loader_contract_keys` 断言今天写出的
  translate spec params 和这份 fixture **完全一致**（不是子集）。
- Python：`backend/pipeline/devtools/tests/test_stage_spec_contract.py` 断言这份
  fixture 的 params key 集合和 `TranslateStageParams` 的字段集合完全一致，并用
  `check_stage_specs_contract.py --strict` 把四份 spec 真的过一遍 loader。

所以 Rust 侧增删 translate params 时，必须同步刷新这份 fixture，然后 Python loader
会被下一条断言逼着跟上。这条链是为了防止 `render_prewarm_*` 那种四层死字段再次出现：
Rust 写、loader 解析、entrypoint 传参、stage 函数接住，最后没有任何消费者。
