# Scripts 总览

`scripts/` 是整套“PDF -> OCR -> 翻译 -> 保留排版渲染”的脚本工程目录。

现在顶层按职责分成五层：

- `runtime/`
  运行时编排层，只放 pipeline。
- `services/`
  OCR、MinerU、翻译、渲染等具体实现层。
- `foundation/`
  配置、共享工具和提示词资源。
- `entrypoints/`
  人工执行入口。
- `devtools/`
  实验、迁移、示例、测试探针、诊断脚本。

## 主链路

核心流程可以概括成：

`PDF -> OCR provider -> document_schema -> services/translation -> services/rendering -> PDF`

更具体一点：

1. 如果只有 PDF，先由 OCR provider 实现获取并解包原始 OCR 结果，再经 `document_schema` 生成统一中间层 `document.v1.json`
2. `services/translation/ocr` 读取 OCR 结果并抽取页面块
3. `services/translation/orchestration` 补齐布局区、continuation、translation_unit 元数据
4. `services/translation` 生成每页翻译 JSON
5. `services/rendering` 读取翻译 JSON 并生成最终 PDF
6. `runtime/pipeline` 负责把这些阶段编排成稳定总线

## 推荐入口

日常使用优先走这些入口：

- `scripts/entrypoints/run_case.py`
  已经有 OCR JSON 和 PDF 时，直接跑完整流程。
- `scripts/entrypoints/run_mineru_case.py`
  只有 PDF 时，先跑 MinerU，再翻译，再渲染。
- `scripts/entrypoints/translate_book.py`
  只翻译，不渲染。
- `scripts/entrypoints/build_book.py`
  只渲染，不重新翻译。
- `scripts/entrypoints/run_book.py`
  显式给出 JSON 和 PDF 的完整编排入口。
- `scripts/entrypoints/build_page.py`
  单页渲染调试入口。
- `scripts/entrypoints/translate_page.py`
  单页翻译调试入口。
- `scripts/entrypoints/check_math_cases.py`
  公式归一化回归检查。
- `scripts/entrypoints/validate_document_schema.py`
  校验 `document.v1.json`，或对 raw OCR JSON 执行 adapt + validate；也可列出当前已注册 provider。
- `scripts/devtools/tests/document_schema/regression_check.py`
  用真实样例跑 `document.v1`、provider 探测、raw layout、content_list_v2 的长期回归检查。

## 新 Provider 接入顺序

如果后续要接新的 OCR provider，先按这个顺序走，不要直接改翻译/渲染主线：

1. 先看 `scripts/services/ocr_provider/README.md`
   先把 provider API 层边界、状态、原始产物职责定义清楚。
2. 再看 `scripts/services/document_schema/README.md`
   明确字段应该落到 `type/sub_type`、`tags`、`derived`、`metadata/source` 的哪一层。
3. 准备最小 raw fixture
   放到 `scripts/devtools/tests/document_schema/fixtures/`。
4. 新增 provider 实现和 adapter
   通过 `scripts/services/document_schema/adapters.py` 接进统一 schema。
5. 把 fixture 登记到 `scripts/devtools/tests/document_schema/fixtures/registry.py`
   不要手改主线去兼容 provider 原始 JSON。
6. 跑 `scripts/devtools/tests/document_schema/regression_check.py`
   至少确认 detector、adapt、validation、extractor smoke 全都通过。

## 顶层目录说明

- `services/mineru`
  MinerU 接入、下载、解包、job 组织。
- `services/translation`
  OCR payload 到翻译 JSON。
- `services/rendering`
  翻译 JSON 到 PDF。
- `runtime/pipeline`
  翻译和渲染的总编排层。
- `services/README.md`
  具体能力实现层总说明。
- `foundation/config`
  路径、字体、版式和运行时默认配置。
- `foundation/shared`
  输入解析、job 目录、环境变量、提示词加载等共享能力。
- `foundation/prompts`
  可编辑提示词模板。
- `devtools/experiments`
  实验性流程，不属于稳定主链路。
- `devtools/tests`
  测试探针和排版实验。
- `devtools/tools`
  示例脚本、迁移工具和诊断脚本。

## 结构化输出

任务输出统一落到：

- `output/<job-id>/source`
- `output/<job-id>/ocr`
- `output/<job-id>/translated`
- `output/<job-id>/rendered`
- `output/<job-id>/artifacts`
- `output/<job-id>/logs`

其中：

- `ocr/unpacked/layout.json` 保留原始 MinerU OCR 输出
- `ocr/normalized/document.v1.json` 是当前翻译/渲染主链路使用的统一 OCR 输入
- `ocr/normalized/document.v1.report.json` 记录 adapter/provider 探测、defaults 默认补齐和 schema 校验摘要
- `translated/translations` 是中间翻译结果
- `rendered/*.pdf` 是最终输出 PDF
- `rendered/typst/` 保留 Typst 中间产物，便于查错和回溯
- `artifacts/` 放 summary、bundle 索引等下载产物
- `logs/` 放阶段日志和后续结构化事件输出

当前约定：

- 主链路优先消费 `document.v1.json`
- 如果入口给的是 raw `layout.json`，会先做一次显式规范化，再进入翻译主线
- raw MinerU 结构保留给 adapter、调试和回溯，不再作为主链路的隐式数据契约
- 如果只是做排错、状态展示或 API 输出摘要，优先消费 `document.v1.report.json`
- Python 侧统一通过 `services/document_schema/reporting.py` 读取 report 和生成 normalization summary
- `specs/` 保存阶段 spec JSON，当前已覆盖：
  - `normalize.spec.json` -> `normalize.stage.v1`
  - `translate.spec.json` -> `translate.stage.v1`
  - `render.spec.json` -> `render.stage.v1`
  - `mineru.spec.json` -> `mineru.stage.v1`
  - `book.spec.json` -> `book.stage.v1`

## Stage Spec 约定

当前 Rust API 到 Python worker 的稳定协议，已经固定为：

`python -u <entrypoint> --spec output/<job-id>/specs/<stage>.spec.json`

约定如下：

- spec 只保存阶段输入、参数和 job 引用，不再把 Python 内部实现细节暴露给 Rust
- `job.job_root` 是路径推导锚点；各阶段内部通过 `job_dirs.py` 派生 `source/ocr/translated/rendered/artifacts/logs`
- 密钥不明文写入 spec
  - 翻译 key 通过 `credential_ref=env:RETAIN_TRANSLATION_API_KEY`
  - MinerU token 通过 `credential_ref=env:RETAIN_MINERU_API_TOKEN`
  - 运行时由 Rust 注入环境变量，Python 通过 `stage_specs.resolve_credential_ref(...)` 读取
- Rust 主工作流和本地 book/translate 入口都已切到 spec-only
  - `run_normalize_ocr.py`
  - `run_translate_only.py`
  - `run_render_only.py`
  - `run_translate_from_ocr.py`
  - `run_mineru_case.py`
  - `run_book.py`
  - `translate_book.py`

本地开发入口当前也已统一到 stage spec 主路径：

- `entrypoints/run_mineru_case.py` -> `mineru.stage.v1`
- `services/document_schema/normalize_pipeline.py` -> `normalize.stage.v1`
- `services/translation/translate_only_pipeline.py` -> `translate.stage.v1`
- `services/rendering/render_only_pipeline.py` -> `render.stage.v1`
- `services/translation/from_ocr_pipeline.py` -> `book.stage.v1`
- `entrypoints/run_book.py` -> `book.stage.v1`

兼容说明：

- 旧任务目录如果还是 `originPDF/jsonPDF/transPDF/typstPDF`，当前后端会直接拒绝详情/下载接口，请重新跑任务生成标准 schema

## 子目录文档

- [foundation/config/README.md](./foundation/config/README.md)
- [foundation/shared/README.md](./foundation/shared/README.md)
- [runtime/pipeline/README.md](./runtime/pipeline/README.md)
- [services/README.md](./services/README.md)
- [services/ocr_provider/README.md](./services/ocr_provider/README.md)
- [services/translation/README.md](./services/translation/README.md)
- [services/translation/orchestration/README.md](./services/translation/orchestration/README.md)
- [services/translation/continuation/README.md](./services/translation/continuation/README.md)
- [services/translation/policy/README.md](./services/translation/policy/README.md)
- [services/rendering/README.md](./services/rendering/README.md)
- [services/mineru/README.md](./services/mineru/README.md)

## 设计边界

- `services/translation` 不直接操作 PDF
- `services/rendering` 不直接决定翻译策略
- `runtime/pipeline` 负责编排，不下沉到实现细节
- `foundation/` 不承载具体业务流程
- `entrypoints/` 只做入口，不承载核心实现
- `devtools/` 不能反向成为主链路依赖
