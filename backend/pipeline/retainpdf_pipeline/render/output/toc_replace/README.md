# render/output/toc_replace

## 负责什么

目录页「原位替换」（2026-11-28 用户定，`docs/ops/planning/toc-agent/20261128-用户定：目录页原位替换.md`）：
目录页不重排，只把每条目录标题的字换成译文；章号、标签列（Chapter 1）、点线、页码、页眉都留在原图上。
开关是渲染参数 `toc_mode`：`reflow`（默认，旧的整条重排 + 页码补画）/ `replace`（这里）。

- `plan.py`：排版前在原文 PDF 上逐页定计划（每条译文写在哪几行、多大字号、擦哪些字），在这一页的副本上试擦、跑检查；
  擦坏了别的字、擦不干净的条目改成保留原文再试，还不行这一页退回重排。定好的页，目录条目和页码小块在正文排版里当保留原文。
- `apply.py`：正文排完以后，在译文 PDF 上照计划擦字、叠上译文那一层，再跑一遍检查，结果写进渲染诊断 `toc_replace`；
  有阅读页的版面（rpr_fit 排的）就把擦的框和写的字补进去（`rpr_fit/reader_layout.py` 的 `add_reader_layout_toc`）。
- `page_ops.py`：擦字（文字层按字打细探针；扫描件在图上盖这一行周围的底色）和检查 R1–R9。
- `text.py`：读字、找字体、量宽（PyMuPDF 读正文同一份字体文件）、切行、把条目译文剪成只剩标题。

条目的拆分和每行标题的框来自归一化（`ocr/document_schema/toc_pages.py` 的 `toc_entry_title_lines`，R0）；
认不清条目（作者行、双栏……）是认上下文的 agent（R2，`backend/toc-agent/`）的事，这里只照数据换字。

## 对外入口

- `plan_toc_replace`、`TocReplacePlan.hold`：`render/render_plan.py` 在 `toc_mode = replace` 时调用
- `apply_toc_replace`：`render/workflow/executor.py` 排完正文后调用（出错只记一笔）

## 不该做什么

- 不改拆条目的规则、不判断哪些字是标题（R0 / R2 的事）。
- 不重排目录：放不下的条目缩字号（最低 0.8 倍），再不行保留原文，不挪别的东西。
- 不改默认：`toc_mode` 缺省是 `reflow`。
