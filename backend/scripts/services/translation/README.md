# Translation 说明

这一层只做一件事：把 OCR payload 变成可落盘、可回填、可渲染的翻译结果。

这里不负责 PDF 读取和写回，也不负责 MinerU 解包。

## 子目录

- `ocr/`
  OCR JSON 读取和数据抽取。主线优先读取 `normalized_document_v1`，raw provider JSON 只在入口处先经过 adapter、compat 和 schema 校验，再进入这里。
- `orchestration/`
  布局区、continuation、translation unit 元数据。
- `classification/`
  `precise` 模式下的可疑块分类。
- `continuation/`
  段落连续性判断、candidate pair 导出和审阅。
- `policy/`
  翻译策略配置、正文噪声过滤、元数据过滤和策略应用。
- `llm/`
  模型请求、缓存、重试、领域推断。
- `payload/`
  payload 协议、公式占位、翻译 JSON 读写。
- `workflow/`
  单页翻译流程入口。

## 主要流程

1. `ocr/` 读取统一中间层 `document.v1.json` 并抽取页面块
2. 如果入口给的是 provider 原始 JSON，则先由 `document_schema/adapters.py` 转成 `document.v1`
3. `workflow/translation_workflow.py` 生成每页翻译模板并加载 payload
4. `orchestration` 补齐布局区和编排元数据
5. `continuation` 把跨行、跨页连续段落合并成统一 translation unit
6. `policy` 根据模式决定跳过哪些块
7. `llm` 按 batch 调模型翻译、缓存和重试
8. `payload` 把翻译结果回填到 page payload，并保存最终 JSON

补充约定：

- translation 主线不应该直接理解某个 OCR provider 的 raw JSON 结构
- `document.v1` 里凡是已经带 `skip_translation` tag 的块，必须在 `ocr/json_extractor.py` 抽取阶段就被挡掉，不能再漏进翻译候选
- `abstract` 这类正文扩展语义可以继续进入翻译；`reference_entry`、`formula_number` 这类 provider 已明确标记跳过的块不应进入 payload
- 抽取阶段会把 `derived.role / sub_type` 继续种成 `structure_role`；当前 `abstract/title/heading/image_caption/table_caption/table_footnote/...` 会进一步转成 `style_hint` 送给翻译提示层
- 如果只想排查 OCR 规范化是否有问题，优先看 `document.v1.report.json`
- Python 侧读取 report 摘要时，优先走 `document_schema/reporting.py`

## 模式说明

- `fast`
  不启用分类器。
- `sci`
  面向论文和技术文档，还会做领域推断。
- `precise`
  启用 LLM 分类器，只对可疑 OCR 块做额外判断。
