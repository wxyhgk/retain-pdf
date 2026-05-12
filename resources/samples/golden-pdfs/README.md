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

默认不建议把大 PDF 提交进 Git。这个目录主要作为本地/CI 私有样本入口。

如果后续要提交小型公开样本，单个文件建议控制在 1 MB 以内，并确认版权允许。

## 本地回归脚本

完整跑 OCR、翻译、渲染：

```bash
RETAIN_TRANSLATION_API_KEY=... python3 backend/scripts/devtools/run_golden_flow.py \
  --sample-id editable-paper-formula
```

查看当前可用样本：

```bash
python3 backend/scripts/devtools/run_golden_flow.py --list-samples
```

只校验样本清单：

```bash
python3 backend/scripts/devtools/run_golden_flow.py --check-manifest
```

复用已有 job 做检查：

```bash
python3 backend/scripts/devtools/run_golden_flow.py \
  --job-root data/jobs/<job-id> \
  --skip-run
```

脚本会检查：

- 翻译诊断中没有非白名单 unresolved 项。
- 最终 PDF 存在且页数和源 PDF 一致。
- 抽样 item 的 Typst 放置坐标和 OCR bbox 左上角一致，默认检查 `p001-b013`。
