# Golden PDF 样本目录

这里放 RetainPDF 的真实 PDF 回归样本。

这些 PDF 用来验证 OCR、翻译和渲染稳定性，尤其是：

- 可编辑论文 PDF
- 多栏论文 PDF
- 公式很多的 PDF
- 图片型扫描 PDF
- 黑底白字 PDF
- 编程/技术手册 PDF
- 有书签的 PDF

## 放置规则

PDF 文件直接放在当前目录。

建议文件名使用：

```text
editable-paper-formula.pdf
scan-image-only.pdf
dark-background.pdf
programming-manual.pdf
bookmarks.pdf
multi-column-paper.pdf
```

文件名尽量只用英文、数字、短横线和下划线，避免空格和中文。

## 清单

放入 PDF 后，在 `manifest.csv` 增加一行，说明这个样本主要覆盖什么风险。

字段说明：

- `id`：稳定样本 ID。
- `file`：PDF 文件名。
- `category`：样本类型。
- `pages`：大概页数。
- `focus`：主要回归点。
- `notes`：补充说明。

## Git 约定

目前清单里登记了文件的 PDF 都已提交进 Git（多数超过 1 MB），并随源码归档
（`ops/release/build_source_archive.py` 整体打包 `tests/fixtures`）一起发出。
CI 不读取这里的任何 PDF，它们只服务下面的手动脚本。

新增样本前先想清楚是否值得进仓库：单个文件尽量控制在 1 MB 以内，并确认版权允许。
没有登记进 `manifest.csv` 的 PDF 不会被任何入口用到，不要放进来。

`manifest.csv` 里 `dark-background`、`programming-manual`、`bookmarks`、
`multi-column-paper` 四行的 `file` 为空，是待补的样本类型占位，`--list-samples`
会把它们标成不可用。

## 表格样本

`editable-tables.pdf`（5 页，约 190 KB）是合成的英文报告，用来测表格翻译（建任务时 `translation.tables = "translate"`）。
内容全是虚构的，源文件 `editable-tables.typ`，改了以后用 `typst compile editable-tables.typ editable-tables.pdf` 重新生成。
7 张表各覆盖一种情况：简单数值（表 1）、单元格长句（表 2）、跨列两层表头（表 3）、首列跨行的全框线表（表 4）、
化学式和上下标（表 5）、8 列宽表（表 6）、跨页续表（表 7，第 4–5 页，续页重复表头）。

## 本地回归脚本

完整跑 OCR、翻译、渲染：

```bash
RETAIN_TRANSLATION_API_KEY=... uv run --project backend \
  python backend/pipeline/devtools/run_golden_flow.py \
  --sample-id editable-paper-formula
```

查看当前可用样本：

```bash
uv run --project backend \
  python backend/pipeline/devtools/run_golden_flow.py --list-samples
```

只校验样本清单：

```bash
uv run --project backend \
  python backend/pipeline/devtools/run_golden_flow.py --check-manifest
```

复用已有 job 做检查：

```bash
uv run --project backend python backend/pipeline/devtools/run_golden_flow.py \
  --job-root data/jobs/<job-id> \
  --skip-run
```

脚本会检查：

- 翻译诊断中没有非白名单 unresolved 项。
- 最终 PDF 存在且页数和源 PDF 一致。
- 抽样 item 的 Typst 放置坐标和 OCR bbox 左上角一致，默认检查 `p001-b013`。

## 渲染速度基准集

`manifest.csv` 里 `focus` 含 `background-render` 的 7 个样本另组成渲染基准集，
覆盖 10–166 页、中英论文，用于回归渲染耗时与首编成功率：

| id | 页数 | 用途 |
|---|---|---|
| navier-stokes-166 | 166 | 大体量；p143 曾因公式内 CJK 命令首编失败（CJK 预筛回归样本） |
| d3cs00837a-69 | 69 | 翻译含 `\unicode` 转义曾致首编失败（unicode 预筛回归样本） |
| cr5c00021-55 | 55 | 中等体量速度回归 |
| tibetan-plateau-21 | 21 | 小体量速度回归 |
| lda-lithiation-zh-17 | 17 | 中文文档 CJK 覆盖 |
| yakubenko-halogen-10 | 10 | 小体量速度回归 |
| babeldoc-10 | 10 | 小体量速度回归 |

可跑用例定义在 `backend/pipeline/devtools/render_speed_cases.json`
（PDF 指本目录，翻译产物指各 `data/jobs`，只读引用），一键冷跑：

```bash
PYTHONPATH=backend/pipeline python backend/pipeline/devtools/run_render_speed_bench.py [--cases ID,...]
```

每个 case 起全新 job 目录（构造上无缓存，保证冷启动可比），结果落
`tmp/render-speed-bench/<stamp>/results.json`。当前基线（M1 Max，166p 冷启动约 30s）。
