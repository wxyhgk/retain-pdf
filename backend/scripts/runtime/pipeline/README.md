# Pipeline 目录说明

`scripts/runtime/pipeline/` 负责把 OCR JSON、翻译流程和渲染流程串成一条稳定的总线。

这里不承载具体的 OCR 解析、翻译模型调用或 PDF 低层渲染细节，而是负责“怎么把这些能力按正确顺序组织起来”。

## 模块分工

- `book_pipeline.py`
  统一编排入口。对外保留最稳定的调用面，负责把翻译阶段和渲染阶段串起来，并返回整条流程的汇总结果。
- `translation_stage.py`
  只负责翻译阶段。输入 OCR JSON 和输出目录，完成页范围裁剪、学术模式策略装配和全书翻译，输出 per-page translation JSON。
- `render_stage.py`
  只负责渲染阶段。输入源 PDF 和翻译 JSON，按 `overlay`、`typst`、`dual` 等模式生成最终 PDF。
- `render_mode.py`
  只负责页范围和 `auto` 模式判定，包括是否更适合走可编辑 PDF 路径。
- `translation_loader.py`
  只负责读取和筛选翻译结果文件，把 per-page translation JSON 组织成渲染阶段可消费的数据结构。
- `book_translation_flow.py`
  负责全书翻译的内部编排，包括 continuation、策略应用、批量翻译、结果回填和落盘。

## 协作方式

标准流程是：

`OCR JSON -> translation_stage -> translation JSON -> translation_loader/render_stage -> final PDF`

这里的 `OCR JSON` 默认指 `document.v1.json`。

补充约定：

- 如果入口拿到的是 raw provider JSON，应先在 pipeline 外或 translation 入口处显式规范化
- pipeline 不负责理解 provider 私有 raw 结构
- 如果只是看 provider 探测、compat 默认补齐或 schema 校验摘要，优先读取 `document.v1.report.json`

## 对外稳定入口

当前建议优先使用下面这些入口：

- `run_book_pipeline(...)`
- `translate_book_pipeline(...)`
- `build_book_pipeline(...)`
- `build_book_from_translations(...)`
- `run_render_stage(...)`
- `resolve_page_range(...)`
- `is_editable_pdf(...)`

## 调用建议

- CLI、API、集成层优先只依赖 `book_pipeline.py`
- 只翻译时调用 `translate_book_pipeline(...)`
- 只渲染时调用 `build_book_pipeline(...)` 或 `run_render_stage(...)`
- 不建议上层自己拼页范围、模式判定和翻译目录读取
