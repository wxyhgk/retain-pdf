# Translation 说明

这一层只做一件事：把 OCR payload 变成可落盘、可回填、可渲染的翻译结果。

这里不负责 PDF 读取和写回，也不负责 MinerU 解包。

## 子目录

- `ocr/`
  OCR JSON 读取和数据抽取。主线优先读取 `normalized_document_v1`，raw provider JSON 只在入口处先适配再进入这里。
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
2. `workflow/translation_workflow.py` 生成每页翻译模板并加载 payload
3. `orchestration` 补齐布局区和编排元数据
4. `continuation` 把跨行、跨页连续段落合并成统一 translation unit
5. `policy` 根据模式决定跳过哪些块
6. `llm` 按 batch 调模型翻译、缓存和重试
7. `payload` 把翻译结果回填到 page payload，并保存最终 JSON

## 模式说明

- `fast`
  不启用分类器。
- `sci`
  面向论文和技术文档，还会做领域推断。
- `precise`
  启用 LLM 分类器，只对可疑 OCR 块做额外判断。
