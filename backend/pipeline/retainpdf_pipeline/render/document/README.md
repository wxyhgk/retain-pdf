# render/document

## 负责什么

渲染阶段的 PDF 文档级辅助能力：页码映射、目录/书签复制、链接挪到译文上、PDF 保存和压缩、按页拼合。

## 对外入口

- `page_map.py`：页码映射
- `metadata.py`：目录/书签复制（`copy_toc`、`copy_toc_for_page_map`）
- `link_relocation.py`：把保留下来的链接热区挪到译文对应位置
- `pdf_ops.py`：PyMuPDF 的保存、压缩、去链接
- `pikepdf_pages.py`、`pikepdf_overlay.py`：pikepdf 的拷贝、抽页、按页叠加

## 不该做什么

- 不做页面 redaction。
- 不生成 Typst。
- 不做 OCR/翻译判断。
