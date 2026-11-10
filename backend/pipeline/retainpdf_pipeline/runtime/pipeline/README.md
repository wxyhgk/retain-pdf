# Pipeline 目录说明

`retainpdf_pipeline/runtime/pipeline/` 放两样跨阶段的东西（render 阶段不能 import 翻译包，跨阶段的编排只能放在这一层）：

- `render_only_pipeline.py`：**生产渲染进程的入口**。`python -m retainpdf_pipeline.render` 就转到这里：渲染前按 spec 精修译文
  （`refine.mode != off` 时），跑 render-only，成功后重算一次翻译 QA。精修和 QA 失败只记日志，不影响渲染结果。
- `book_pipeline.py`：本地 `retainpdf-pipeline book` 在一个进程里把翻译和渲染串起来。生产上阶段顺序由 Rust 编排，不走这里。

这里不承载具体的 OCR provider 解析、翻译模型调用或 PDF 低层渲染细节。

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
- render-only 主线现在要求 manifest-only；不再回退扫描旧的逐页 JSON 文件
- translation 阶段允许读取源 PDF 做领域推断或策略辅助，但不拥有源 PDF 的渲染控制权
- 如果启用了术语表，translation 阶段还会把术语表摘要写入 `translation-manifest.json`、诊断文件和 pipeline summary；这些字段属于元数据，不改变渲染输入协议
- pipeline summary 与 translation manifest 现在还会写入 `invocation` 字段，用来声明当前阶段 schema 版本
- 各阶段 worker 现在还会在 `logs/pipeline_events.jsonl` 追加统一阶段事件；这份文件是后续 Rust API 收口事件协议的过渡落点

### 3. Rendering 阶段

责任边界：

- 输入源 PDF、翻译产物和渲染参数
- 输出最终 PDF，以及必要的中间 overlay / typst / 压缩产物
- 到此为止，不负责 OCR provider 识别，不发起翻译模型请求

稳定交接点：

- rendering 主线只接受“源 PDF + 翻译产物”这组输入
- OCR 结构问题应回到 `document.v1.json` / `document.v1.report.json` 排查，而不是在渲染层补 provider 特判

## 模块分工

- `render_only_pipeline.py`
  生产渲染进程入口：精修 → `render/workflow/render_only.py` → 翻译 QA 重算（后两者经 `retainpdf_translation.public`）。
- `book_pipeline.py`
  本地整书串联，`run_book_pipeline(...)` 把翻译阶段和渲染阶段串起来并返回汇总结果。
- `__init__.py`
  懒加载转发 `book_pipeline` 里的几个名字（见下面「对外稳定入口」）。

阶段门面不在这里：翻译阶段门面是 `translate/translation_stage.py`，渲染阶段门面、翻译产物读取、render-only
输入协议、页范围和模式判定在 `render/`（`render_stage.py`、`translation_loader.py`、`render_inputs.py`、`render_mode.py`）。
跨阶段共享的 summary 在 `services/pipeline_shared/`，stdout 协议、`pipeline_events.jsonl` 事件流、JSON IO 在底座包 `retainpdf_base`。

## 协作方式

标准流程是：

`OCR JSON -> translation_stage -> translation JSON -> translation_loader/render_stage -> final PDF`

这里的 `OCR JSON` 默认指 `document.v1.json`。

Rust API 的完整 provider-backed workflow 也按这个边界串联：

- OCR 子任务先生成 `document.v1.json`
- translate-only 入口只生成逐页 translation payload 与 `translation-manifest.json`
- render-only 入口再消费源 PDF 与翻译产物生成最终 PDF

补充约定：

- 如果入口拿到的是 raw provider JSON，应先在 pipeline 外或 translation 入口处显式规范化
- pipeline 不负责理解 provider 私有 raw 结构
- 如果只是看 provider 探测、defaults 默认补齐或 schema 校验摘要，优先读取 `document.v1.report.json`
- 完整任务可以串联三阶段，但三阶段的输入/输出边界必须保持独立，不能靠私有内存对象隐式耦合
- 如果只重跑渲染，应复用已有 job 的 `source_pdf` 与 `translations_dir`，不要重新进入 OCR 或翻译阶段

## 对外稳定入口

`retainpdf_pipeline.runtime.pipeline` 懒加载转发这些名字（实现分别在 `book_pipeline.py`、`translate/translation_stage.py`、
`render/render_stage.py`、`render/render_mode.py`，`resolve_page_range` 来自 `retainpdf_translation.public`）：

- `run_book_pipeline(...)`
- `translate_book_pipeline(...)`
- `build_book_pipeline(...)`
- `build_book_from_translations(...)`
- `resolve_page_range(...)`
- `is_editable_pdf(...)`

`run_render_stage(...)` 在 `render/render_stage.py`，直接从那里 import。

补充约定：

- 阶段入口已经固定为 `--spec <stage-spec.json>` 协议
- normalize 阶段对应 `normalize.stage.v1`
- translate-only 阶段对应 `translate.stage.v1`
- render-only 阶段对应 `render.stage.v1`
- provider-backed 全流程当前对应 `provider.stage.v1`
  这是当前实现细节，不是上层流程命名要求
- 基于已规范化 OCR 的整链入口对应 `book.stage.v1`
- Rust 主工作流调用的 worker 入口现在要求 `--spec`
- 本地开发入口也已统一改为通过 stage spec 驱动

## 调用建议

- 本地 CLI、集成层要整书串联时依赖 `book_pipeline.py`；生产走 Rust 拉起的各阶段进程
- OCR 阶段完成后再进入 `runtime/pipeline/`；不要把 provider raw 处理逻辑塞回这里
- 只翻译时调用 `translate_book_pipeline(...)`
- 只渲染时调用 `build_book_pipeline(...)` 或 `run_render_stage(...)`
  调用时必须提供 `source_pdf_path`，以及下面两种翻译输入之一：
  - `translations_dir`
  - `translation_manifest_path`
- 如果两者都没给，或者目录里没有 `translation-manifest.json`，入口会直接抛出固定的 `Render-only input error`
- 渲染阶段不会再自行“猜”旧任务目录或旧页文件命名
- 不建议上层自己拼页范围、模式判定和翻译目录读取

## 解耦回归

当前专项回归覆盖：

- Python：manifest-only 翻译产物加载、Render-only 输入协议
- Rust：OCR-only job snapshot、Translate workflow、Render workflow、完整任务入口、artifact manifest 发现

常用检查命令：

```bash
PYTHONPATH=backend/pipeline python -m pytest backend/pipeline/devtools/tests -q
cargo test --manifest-path backend/api/Cargo.toml -q
```

## 协作规矩

`runtime/pipeline/` 适合单独由“编排负责人”维护，但职责必须收紧在阶段组织本身。

- 这里只负责阶段顺序、入口协议、任务目录和跨阶段结果汇总
- 不要把 provider 私有适配逻辑塞进 pipeline
- 不要把翻译策略细节或渲染实现细节回卷到 pipeline
- 如果修改阶段输入输出契约，必须同步更新上游模块 README、下游模块 README、CLI/API 入口和回归测试
- 如果只是某个模块内部 bug，优先在模块内修；pipeline 只保留必要的编排适配层
