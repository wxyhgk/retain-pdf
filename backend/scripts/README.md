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

其中 `services/` 内部现在又明确分成两类：

- provider / translation / rendering 这类能力模块
- `services/pipeline_shared/` 这类跨阶段共享协议模块

## 主链路

核心流程可以概括成：

`PDF -> OCR provider -> document_schema -> services/translation -> services/rendering -> PDF`

更具体一点：

1. `normalize.stage.v1`
   OCR provider 原始结果进入 `document_schema`，产出 `ocr/normalized/document.v1.json` 和 `document.v1.report.json`
2. `translate.stage.v1`
   翻译链只读取 `document.v1.json`，抽取正文白名单 block，补 continuation / orchestration 元数据，输出 `translated/`
3. `render.stage.v1`
   渲染链只读取翻译产物和源 PDF，输出 `rendered/*.pdf`
4. `book.stage.v1`
   顶层整书流程，只负责编排 `normalize -> translate -> render`，不再让下游直接猜 provider 原始结构

现在的正式块级契约是：

- `geometry`
- `content`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy`
- `provenance`

说明：

- `type/sub_type/bbox/text/lines/segments` 仍保留，但已经降级为兼容字段
- translation / rendering 主线不应该再基于 raw OCR 字段或 `derived/sub_type` 重新猜正文
- 是否进入翻译，以 `policy.translate` 为唯一正式入口
- translation payload 的正式消费口径也已固定为 strict top-level contract，不再依赖 `metadata` 镜像

## 推荐入口

日常使用优先走这些入口：

- `scripts/entrypoints/run_book.py`
  当前最上层完整入口。通过 `book.stage.v1` 串起 `normalize -> translate -> render`，适合人工本地跑整条主链路。
- `scripts/entrypoints/run_provider_case.py`
  本地一条命令跑“provider -> normalize -> translate -> render”的通用入口名。底层由 provider 分发层决定具体 OCR 实现，入口名不暴露 provider。
- `scripts/entrypoints/run_document_flow.py`
  已经有 OCR JSON 和 PDF 时，优先用这个中性入口名跑完整流程。
- `scripts/entrypoints/run_normalize_ocr.py`
  顶层 normalize worker。把 raw OCR JSON 收口成 `document.v1.json`。
- `scripts/entrypoints/run_provider_ocr.py`
  本地 OCR-only 通用入口名。只跑 provider -> unpack -> normalize。
- `scripts/entrypoints/run_translate_only.py`
  顶层 translate worker。只接受已经标准化的 `document.v1.json`。
- `scripts/entrypoints/run_render_only.py`
  顶层 render worker。只接受翻译产物和 PDF。
- `scripts/entrypoints/translate_book.py`
  只翻译，不渲染。
- `scripts/entrypoints/build_book.py`
  只渲染，不重新翻译。
- `scripts/entrypoints/build_page.py`
  单页渲染调试入口。
- `scripts/entrypoints/translate_page.py`
  单页翻译调试入口。
- `scripts/entrypoints/validate_document_schema.py`
  契约排错入口。只用于检查 `document.v1` 或 adapter 行为，不是日常整链路入口。
- `scripts/devtools/tests/document_schema/regression_check.py`
  长期回归工具，不是主流程入口。

不要把测试脚本当主入口。正常验证整条链路时，优先跑：

1. `run_book.py --spec <job_root>/specs/book.spec.json`
2. 或 Rust API 提交 job，让 Rust 通过 spec 驱动三个 worker

如果要改翻译链路，推荐阅读顺序是：

1. `services/translation/README.md`
2. `services/translation/llm/README.md`
3. 再按需要进入 `services/translation/llm/providers/` 或 `services/translation/llm/shared/orchestration/`

## 新 Provider 接入顺序

如果后续要接新的 OCR provider，先按这个顺序走，不要直接改翻译/渲染主线：

1. 先看 `scripts/services/ocr_provider/README.md`
   先把 provider API 层边界、状态、原始产物职责定义清楚。
2. 再看 `scripts/services/document_schema/README.md`
   明确字段应该落到 `geometry/content/layout_role/semantic_role/structure_role/policy/provenance` 的哪一层。
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
- `services/pipeline_shared`
  provider / translate / render 共用的阶段协议、summary 和 JSON IO。
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
- `document.v1.json` 的正式消费口径是 `geometry/content/layout_role/semantic_role/structure_role/policy/provenance`
- 如果入口给的是 raw `layout.json`，会先做一次显式规范化，再进入翻译主线
- raw MinerU 结构保留给 adapter、调试和回溯，不再作为主链路的隐式数据契约
- 如果只是做排错、状态展示或 API 输出摘要，优先消费 `document.v1.report.json`
- Python 侧统一通过 `services/document_schema/reporting.py` 读取 report 和生成 normalization summary
- `specs/` 保存阶段 spec JSON，当前已覆盖：
  - `normalize.spec.json` -> `normalize.stage.v1`
  - `translate.spec.json` -> `translate.stage.v1`
  - `render.spec.json` -> `render.stage.v1`
  - `provider.spec.json` -> `provider.stage.v1`
  - `book.spec.json` -> `book.stage.v1`

## Stage Spec 约定

当前 Rust API 到 Python worker 的稳定协议，已经固定为：

`python -u <entrypoint> --spec output/<job-id>/specs/<stage>.spec.json`

约定如下：

- spec 只保存阶段输入、参数和 job 引用，不再把 Python 内部实现细节暴露给 Rust
- `job.job_root` 是路径推导锚点；各阶段内部通过 `job_dirs.py` 派生 `source/ocr/translated/rendered/artifacts/logs`
- 密钥不明文写入 spec
  - 翻译 key 通过 `credential_ref=env:RETAIN_TRANSLATION_API_KEY`
  - 如果 provider 是 `mineru`，对应 token 通过 `credential_ref=env:RETAIN_MINERU_API_TOKEN`
  - 运行时由 Rust 注入环境变量，Python 通过 `stage_specs.resolve_credential_ref(...)` 读取
- Rust 主工作流和本地 book/translate 入口都已切到 spec-only
  - `run_normalize_ocr.py`
  - `run_provider_ocr.py`
  - `run_translate_only.py`
  - `run_render_only.py`
  - `run_translate_from_ocr.py`
  - `run_document_flow.py`
  - `run_provider_case.py`
  - `run_book.py`
  - `translate_book.py`

本地开发入口当前也已统一到 stage spec 主路径：

- `entrypoints/run_provider_case.py` -> 当前 provider-backed full workflow 的本地通用入口名
- `entrypoints/run_document_flow.py` -> 当前 normalized-document full flow 的本地通用入口名
- `entrypoints/run_provider_ocr.py` -> 当前 OCR-only provider flow 的本地通用入口名
- `services/document_schema/normalize_pipeline.py` -> `normalize.stage.v1`
- `services/translation/translate_only_pipeline.py` -> `translate.stage.v1`
- `services/rendering/workflow/render_only.py` -> `render.stage.v1`
- `services/translation/from_ocr_pipeline.py` -> `book.stage.v1`
- `entrypoints/run_book.py` -> `book.stage.v1`

也就是说，当前“最上层整个流程”的真实执行口径是：

- 本地：`run_book.py --spec .../book.spec.json`
- Rust API：创建 job，由 Rust 生成 `specs/*.spec.json` 并依次启动 worker
- 测试脚本：只做回归，不代表主执行路径

## Python 依赖真相源

当前 Python 依赖已经收敛到仓库根目录的 [`pyproject.toml`](/home/wxyhgk/tmp/Code/pyproject.toml)。

不要直接手改这些 requirements 文件：

- [`docker/requirements-app.txt`](/home/wxyhgk/tmp/Code/docker/requirements-app.txt)
- [`docker/requirements-test.txt`](/home/wxyhgk/tmp/Code/docker/requirements-test.txt)
- [`desktop/requirements-desktop-posix.txt`](/home/wxyhgk/tmp/Code/desktop/requirements-desktop-posix.txt)
- [`desktop/requirements-desktop-windows.txt`](/home/wxyhgk/tmp/Code/desktop/requirements-desktop-windows.txt)
- [`desktop/requirements-desktop-macos.txt`](/home/wxyhgk/tmp/Code/desktop/requirements-desktop-macos.txt)

修改依赖后统一执行：

```bash
python backend/scripts/devtools/sync_python_requirements.py --repo-root .
```

只检查是否漂移：

```bash
python backend/scripts/devtools/sync_python_requirements.py --repo-root . --check
```

兼容说明：

- 旧任务目录如果还是 `originPDF/jsonPDF/transPDF/typstPDF`，当前后端会直接拒绝详情/下载接口，请重新跑任务生成标准 schema
- 旧的逐页 translation JSON 直扫模式已经退出主线；render-only 必须提供 `translation-manifest.json`

## 子目录文档

- [PIPELINE_DIRECTORY_MAP.md](./PIPELINE_DIRECTORY_MAP.md)
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

## 架构检查

日常改动建议至少跑这两条：

- `python3 backend/rust_api/scripts/check_architecture.py`
- `python3 backend/scripts/devtools/check_pipeline_architecture.py`

第二条负责卡住 Python 主链最容易回退的边界：

- `runtime/pipeline` 重新直接 import `services.ocr_provider` / `services.mineru`
- `runtime/pipeline` 重新理解 provider raw token，例如 `layoutParsingResults`
- `services/translation` / `services/rendering` 重新碰 provider raw adapter
- `entrypoints/*` 绕过稳定入口，直接连深层实现
- `services/ocr_provider/__init__.py` 丢掉显式公共导出面
- `services/ocr_provider/provider_pipeline.py` 丢掉稳定 compat symbol 或不再承担主链 handoff
- `services/ocr_provider/paddle_*` 反向依赖 `runtime/pipeline` / `services/translation` / `services/rendering`
