# Pipeline 目录说明

`scripts/pipeline/` 负责把 OCR JSON、翻译流程和渲染流程串成一条稳定的总线。

这里不承载具体的 OCR 解析、翻译模型调用或 PDF 低层渲染细节，而是负责“怎么把这些能力按正确顺序组织起来”。

## 模块分工

- `book_pipeline.py`
  统一编排入口。对外保留最稳定的调用面，负责把翻译阶段和渲染阶段串起来，并返回整条流程的汇总结果。
- `translation_stage.py`
  只负责翻译阶段。输入 OCR JSON 和输出目录，完成页范围裁剪、学术模式策略装配和全书翻译，输出 per-page translation JSON。
- `render_stage.py`
  只负责渲染阶段。输入源 PDF 和翻译 JSON，按 `compact`、`direct`、`typst`、`dual` 等模式生成最终 PDF。
- `render_mode.py`
  只负责页范围和 `auto` 模式判定，包括是否更适合走可编辑 PDF 路径。
- `translation_loader.py`
  只负责读取和筛选翻译结果文件，把 per-page translation JSON 组织成渲染阶段可消费的数据结构。
- `book_translation_flow.py`
  负责全书翻译的内部编排，包括 continuation、策略应用、批量翻译、结果回填和落盘。它是翻译阶段的执行核心，但不建议作为上层入口直接依赖。

## 协作方式

标准流程是：

`OCR JSON -> translation_stage -> translation JSON -> translation_loader/render_stage -> final PDF`

更具体地说：

1. `book_pipeline.py` 先调用 `translation_stage.py` 完成翻译。
2. `translation_stage.py` 读取 OCR JSON，生成页面区间，然后交给 `book_translation_flow.py` 执行。
3. 翻译完成后，`book_pipeline.py` 再调用 `render_stage.py`。
4. `render_stage.py` 通过 `translation_loader.py` 读取翻译结果，并根据 `render_mode.py` 选择最终渲染路径。
5. 最终输出 PDF。

这种拆分的目的，是把“流程编排”和“具体实现”分开，让后续修改翻译策略或渲染策略时，不必反复改总入口。

## 对外稳定入口

当前建议优先使用下面这些入口：

- `run_book_pipeline(...)`
  一条调用完成翻译和渲染，是最完整的总入口。
- `translate_book_pipeline(...)`
  只做翻译，不做渲染。
- `build_book_pipeline(...)`
  只做渲染，适合已经有翻译 JSON 的场景。
- `build_book_from_translations(...)`
  从翻译目录直接构建 PDF，是更底层的渲染入口。
- `run_render_stage(...)`
  渲染阶段的统一入口，带模式判定和结果装配。
- `resolve_page_range(...)`
  统一页范围裁剪工具。
- `is_editable_pdf(...)`
  用于判断 PDF 是否更适合走可编辑路径。

## 调用建议

- CLI、API、集成层优先只依赖 `book_pipeline.py`
- 只翻译时调用 `translate_book_pipeline(...)`
- 只渲染时调用 `build_book_pipeline(...)` 或 `run_render_stage(...)`
- 不建议上层自己拼页范围、模式判定和翻译目录读取，这些逻辑已经下沉到 `render_mode.py`、`translation_loader.py` 和 `render_stage.py`

## 设计目标

- 保持上层调用简单
- 降低翻译和渲染之间的耦合
- 让新增模式或替换策略时，改动尽量局部化
- 保留旧入口兼容性，避免 CLI 和 FastAPI 层频繁跟着变
