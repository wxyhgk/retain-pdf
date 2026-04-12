# Pipeline 目录说明

`scripts/runtime/pipeline/` 负责把 OCR 标准化产物、翻译流程和渲染流程串成一条稳定的总线。

这里不承载具体的 OCR provider 解析、翻译模型调用或 PDF 低层渲染细节，而是负责“怎么把这些能力按正确顺序组织起来”。

## 阶段契约

### 1. OCR / Normalize 阶段

责任边界：

- 输入 provider 原始 OCR 结果、源 PDF 和 provider 元数据
- 输出统一中间层 `document.v1.json` 与 `document.v1.report.json`
- 到此为止，不继续承担翻译和最终 PDF 渲染

稳定交接点：

- translation / rendering 主线只应把 `document.v1.json` 当成 OCR 阶段完成后的正式输入
- provider raw JSON、zip、unpacked 目录仅保留给 adapter、排错和回溯

### 2. Translation 阶段

责任边界：

- 输入 `document.v1.json`、翻译策略参数和翻译输出目录
- 输出逐页 translation payload、`translation-manifest.json`、翻译摘要和诊断信息
- 到此为止，不负责 provider raw 解析，不负责源 PDF 写回和最终 PDF 交付

稳定交接点：

- rendering 阶段只应消费翻译产物协议，不应反向读取 provider raw OCR 结构
- 当前默认翻译产物协议由逐页 translation payload 加 `translation-manifest.json` 组成
- translation 阶段允许读取源 PDF 做领域推断或策略辅助，但不拥有源 PDF 的渲染控制权
- 如果启用了术语表，translation 阶段还会把术语表摘要写入 `translation-manifest.json`、诊断文件和 pipeline summary；这些字段属于元数据，不改变渲染输入协议

### 3. Rendering 阶段

责任边界：

- 输入源 PDF、翻译产物和渲染参数
- 输出最终 PDF，以及必要的中间 overlay / typst / 压缩产物
- 到此为止，不负责 OCR provider 识别，不发起翻译模型请求

稳定交接点：

- rendering 主线只接受“源 PDF + 翻译产物”这组输入
- OCR 结构问题应回到 `document.v1.json` / `document.v1.report.json` 排查，而不是在渲染层补 provider 特判

## 模块分工

- `book_pipeline.py`
  统一编排入口。对外保留最稳定的调用面，负责把翻译阶段和渲染阶段串起来，并返回整条流程的汇总结果。
- `translation_stage.py`
  只负责翻译阶段。输入 `document.v1.json` 和输出目录，完成页范围裁剪、学术模式策略装配和全书翻译，输出逐页 translation payload。
- `render_stage.py`
  只负责渲染阶段。输入源 PDF 和翻译产物，按 `overlay`、`typst`、`dual` 等模式生成最终 PDF。
- `render_inputs.py`
  只负责校验 Render-only 调用协议，把 `source_pdf_path + translations_dir/translation_manifest_path` 规范化成渲染阶段可消费的稳定输入。
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

Rust API 的完整 `mineru` workflow 也按这个边界串联：

- OCR 子任务先生成 `document.v1.json`
- translate-only 入口只生成逐页 translation payload 与 `translation-manifest.json`
- render-only 入口再消费源 PDF 与翻译产物生成最终 PDF

补充约定：

- 如果入口拿到的是 raw provider JSON，应先在 pipeline 外或 translation 入口处显式规范化
- pipeline 不负责理解 provider 私有 raw 结构
- 如果只是看 provider 探测、compat 默认补齐或 schema 校验摘要，优先读取 `document.v1.report.json`
- 完整任务可以串联三阶段，但三阶段的输入/输出边界必须保持独立，不能靠私有内存对象隐式耦合
- 如果只重跑渲染，应复用已有 job 的 `source_pdf` 与 `translations_dir`，不要重新进入 OCR 或翻译阶段

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
- OCR 阶段完成后再进入 `runtime/pipeline/`；不要把 provider raw 处理逻辑塞回这里
- 只翻译时调用 `translate_book_pipeline(...)`
- 只渲染时调用 `build_book_pipeline(...)` 或 `run_render_stage(...)`
  调用时必须提供 `source_pdf_path`，以及下面两种翻译输入之一：
  - `translations_dir`
  - `translation_manifest_path`
- 如果两者都没给，或者目录里既没有 `translation-manifest.json` 也没有兼容旧版的 `page-*-deepseek.json`，入口会直接抛出固定的 `Render-only input error`
- 不建议上层自己拼页范围、模式判定和翻译目录读取

## 解耦回归

当前专项回归覆盖：

- Python：manifest 优先、旧 `page-*-deepseek.json` fallback、Render-only 输入协议
- Rust：OCR-only job snapshot、Translate workflow、Render workflow、完整任务兼容命令、artifact manifest 发现

常用检查命令：

```bash
PYTHONPATH=backend/scripts python -m pytest backend/scripts/devtools/tests -q
cd backend/rust_api && cargo test -q
```

## 协作规矩

`runtime/pipeline/` 适合单独由“编排负责人”维护，但职责必须收紧在阶段组织本身。

- 这里只负责阶段顺序、入口协议、任务目录和跨阶段结果汇总
- 不要把 provider 私有适配逻辑塞进 pipeline
- 不要把翻译策略细节或渲染实现细节回卷到 pipeline
- 如果修改阶段输入输出契约，必须同步更新上游模块 README、下游模块 README、CLI/API 入口和回归测试
- 如果只是某个模块内部 bug，优先在模块内修；pipeline 只保留必要的编排兼容层
