# 人造 OCR 原始输出样例（快照守卫）

每个目录是一份人造的 OCR 原始输出：框的类型、坐标都是我们自己定的，所以"归一化以后应该长什么样"能逐项写死。
2026-10-29 由几个 Sonnet 子代理按 `../../../../../retainpdf_pipeline/ocr/document_schema/provider_adapters/` 里各家适配器读的真实字段造出来，
再逐份审过（能适配、能校验、页数和 `case.json` 一致、块在页内、行在块内、片段在行内、没有零面积框）。

| 文件 | 内容 |
|---|---|
| `raw.json` | 原始输出（MinerU middle.json、MinerU content_list_v2、Paddle VL、命令型 OCR 的通用格式） |
| `case.json` | 服务商、原文 PDF 每页的尺寸（`pdf_pages`，点）、原始坐标的页面尺寸（`raw_pages`）、每个要点在哪（`features`：页、原始路径、期望）、几何边界情况、难点 |
| `raw_rejected.json` | 故意越界、现在会被校验器拒绝的版本（`case.json` 的 `validator_rejects` 记着是哪条规则拒的） |
| `expected.document.v1.json` | 走完整归一化（适配 → 缩放到 `pdf_pages` 大小的 PDF → 补行 → 校验）以后的整份文档 |
| `expected.report.json` | 同一次归一化的报告 |

覆盖（2026-10-29）：MinerU 块类型 42/42、片段类型 8/8，Paddle 官方标签 25/25，content_list_v2 类型 8/8；几何上有跨页段落、旋转块、横版页、
空白页、2 倍 / 1.5 倍像素坐标、1000×1000 画布、块重叠、行超出块、跑出块框的行、极小的块、贴边的块、两栏文字塞进一个块。

`test_synthetic_snapshots.py` 拿 `expected.*` 逐字节比；改了归一化、输出确实该变时：

```bash
UPDATE_OCR_SNAPSHOTS=1 backend/.venv/bin/python -m pytest backend/pipeline/devtools/tests/document_schema/test_synthetic_snapshots.py
```

然后看 `git diff` 里只有预期的改动。

真实服务商的原始输出以后补（`docs/ops/planning/ocr-normalization/20261029-归一化拆分方案.md`「用户的决定」第 1 条）。
注意 `mineru_content_list_v2*` 的表格、图片、列表、代码字段名是按 MinerU 官方格式写的，仓库里的文档只列了类型名，没有字段定义，要拿真实输出核一次。
