# Translation 说明

这一层只做一件事：把 OCR payload 变成可落盘、可回填、可渲染的翻译结果。

这里不负责 PDF 读取和写回，也不负责 MinerU 解包。

现在这一层按职责拆成几个稳定子目录：

- `ocr/`
  负责 OCR JSON 读取和数据抽取。
- `orchestration/`
  负责布局区、continuation、translation unit 等编排元数据。
- `classification/`
  负责 `precise` 模式下的可疑块分类。
- `continuation/`
  负责段落连续性判断、candidate pair 导出和审阅。
- `policy/`
  负责翻译策略配置、正文噪声过滤、元数据片段过滤和策略应用流程。
- `llm/`
  负责模型请求、缓存、重试、领域推断。
- `payload/`
  负责 payload 协议、公式占位、翻译 JSON 读写。
- `workflow/`
  负责单页翻译流程入口。

## 负责的事情

- 读取和保存翻译 JSON
- 保护和恢复 inline formula
- 处理 continuation group 和 translation unit
- 应用 translation policy
- 进行批量翻译和重试
- 维护 `should_translate`、`classification_label`、`translation_unit_id` 等字段
- 在 `sci` 模式下做文档领域推断并注入翻译指导

## 不负责的事情

- 不直接解析原始 PDF
- 不负责 MinerU API 调用
- 不负责 PDF 渲染和导出
- 不负责前端或 job 管理

## 主要流程

1. `workflow/translation_workflow.py` 生成每页翻译模板并加载 payload
2. `orchestration` 给 payload 补齐布局区和编排元数据
3. `continuation` 把跨行、跨页连续段落合并成统一 translation unit
4. `policy` 根据模式决定跳过哪些块，`precise` 才会走 `classification`
5. `llm` 按 batch 调模型翻译、缓存和重试
6. `payload` 把翻译结果回填到 page payload，并保存最终 JSON

## 模式说明

- `fast`
  不启用分类器，适合常规批量翻译。
- `sci`
  面向论文和技术文档，默认跳过标题和尾部参考文献区，还会做领域推断。
- `precise`
  启用 LLM 分类器，只对可疑 OCR 块做额外判断，适合高精度场景。

## 目录索引

- `ocr/`
  OCR 数据抽取相关模块。
- `orchestration/`
  continuation、布局区和 translation unit 元数据模块。
- `classification/`
  `precise` 模式下的块级分类模块。
- `continuation/`
  continuation 规则、状态写回、candidate pair 和 review。
- `policy/`
  模式配置、过滤规则和 payload 策略应用。
- `llm/`
  OpenAI-compatible 客户端、缓存、批量翻译重试、领域推断。
- `payload/`
  公式保护、payload 协议、翻译 JSON 模板与读写。
- `workflow/`
  单页翻译流程入口。

## 与其他层的关系

- 上游依赖 `ocr` 和 `orchestration` 给出的结构化 payload
- 下游把结果交给 `rendering`
- `pipeline` 只编排这一层，不进入内部细节

## 使用建议

- 如果只想生成翻译 JSON，优先走 `translate_book.py` 或 `translate_book_pipeline(...)`
- 如果要修改模式规则，优先看 `policy/`
- 如果要修改 continuation 规则，优先看 `continuation/`
- 如果要修改模型调用和缓存，优先看 `llm/`
- 如果要修改 payload 字段协议，优先看 `payload/`
