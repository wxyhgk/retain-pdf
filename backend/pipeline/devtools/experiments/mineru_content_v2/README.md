# MinerU `content_list_v2` 适配实验

这条实验路线把 MinerU 的 `content_list_v2.json` 转成一份更规整的中间 JSON，
方便后续做翻译和渲染研究。

它和稳定主链路刻意隔离，不直接作为默认入口。

当前建议：

- 主链路优先使用 `ocr/normalized/document.v1.json`
- `ocr/unpacked/layout.json` 只保留给 adapter、调试和回溯
- `content_list_v2.json` 只用于更细粒度文本/公式结构实验

## 输入

- `output/<job-id>/ocr/unpacked/content_list_v2.json`

## 输出

输出是一份规整后的 JSON，主要包含：

- 页面列表
- 规范化后的块结构
- 展平后的带文本块及其 `segments`
- 非文本块保留原始 MinerU payload

## 运行方式

```bash
python scripts/devtools/experiments/mineru_content_v2/adapt_content_list_v2.py \
  --input output/<job-id>/ocr/unpacked/content_list_v2.json \
  --output output/<job-id>/ocr/mineru_content_v2_adapted.json
```

## 当前覆盖范围

- 支持 `title`、`paragraph`、`list`、`page_header`、`page_footer`、`page_number`
- `image`、`table`、`equation_interline` 会保留为不可翻译块
- MinerU 的 list item 会展开成独立的规范化块

## 已知限制

- 还不做逐行几何重建
- list item 复用父级 list 的 bbox，因为 MinerU 输入没有逐 item bbox
- 当前不建议作为默认 MinerU 接入路线
