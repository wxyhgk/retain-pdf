# Pipeline 总览

`pipeline/` 是整套“PDF -> OCR -> 翻译 -> 保留排版渲染”的脚本工程目录。

**script-mode 仅桌面兼容；正式入口为 `retainpdf-pipeline` console-mode。**

安装后的唯一 Python 命名空间是 `retainpdf_pipeline`。源码树顶层分成三部分：

- `retainpdf_pipeline/`
  canonical package；内部包含 `runtime/`、`services/`、`foundation/` 和正式 `entrypoints/`。
- `entrypoints/`
  只保留 Rust/桌面 script mode 需要的源码兼容包装器，不进入 wheel。
- `devtools/`
  实验、迁移、示例、测试探针、诊断脚本。

其中 `services/` 内部现在又明确分成两类：

- provider / translation / rendering 这类能力模块
- `services/pipeline_shared/` 这类跨阶段共享协议模块

## 主链路

核心流程可以概括成：

`PDF -> OCR provider -> document_schema -> translate -> render -> PDF`

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

日常使用优先走 `retainpdf-pipeline` console-mode：

- `retainpdf-pipeline book --spec <job_root>/specs/book.spec.json`
  当前最上层完整入口。通过 `book.stage.v1` 串起 `normalize -> translate -> render`，适合人工本地跑整条主链路。
- `retainpdf-pipeline provider-case --spec <job_root>/specs/provider.spec.json`
  本地一条命令跑“provider -> normalize -> translate -> render”的通用入口名。底层由 provider 分发层决定具体 OCR 实现，入口名不暴露 provider。
- `retainpdf-pipeline normalize-ocr --spec <job_root>/specs/normalize.spec.json`
  顶层 normalize worker。把 raw OCR JSON 收口成 `document.v1.json`。
- `retainpdf-pipeline provider-ocr --spec <job_root>/specs/provider.spec.json`
  本地 OCR-only 通用入口名。只跑 provider -> unpack -> normalize。
- `retainpdf-pipeline translate-only --spec <job_root>/specs/translate.spec.json`
  顶层 translate worker。只接受已经标准化的 `document.v1.json`。
- `retainpdf-pipeline render-only --spec <job_root>/specs/render.spec.json`
  顶层 render worker。只接受翻译产物和 PDF。
- `retainpdf-pipeline translate-from-ocr --spec <job_root>/specs/book.spec.json`
  provider/normalize 后继续翻译和渲染的入口之一（顶层垫片已删除，只有包内入口和 console 子命令）。
- `retainpdf-pipeline diagnose-failure --spec <job_root>/specs/<stage>.spec.json`
  失败诊断入口。
- `run_document_flow.py`（script-mode，仅桌面兼容，无 console 等价物）
  已经有 OCR JSON 和 PDF 时，优先用这个中性入口名跑完整流程。
- `translate_book.py`（script-mode，仅桌面兼容，无 console 等价物）
  只翻译，不渲染。
- `build_book.py`（script-mode，仅桌面兼容，无 console 等价物）
  只渲染，不重新翻译。
- `build_page.py`（script-mode，仅桌面兼容，无 console 等价物）
  单页渲染调试入口。
- `translate_page.py`（script-mode，仅桌面兼容，无 console 等价物）
  单页翻译调试入口。
- `validate_document_schema.py`（script-mode，仅桌面兼容，无 console 等价物）
  契约排错入口。只用于检查 `document.v1` 或 adapter 行为，不是日常整链路入口。
- `backend/pipeline/devtools/tests/document_schema/regression_check.py`
  长期回归工具，不是主流程入口。

未安装 retainpdf-pipeline 的桌面兼容目录回退到 python backend/pipeline/entrypoints/run_*.py --spec <job_root>/specs/<stage>.spec.json。

不要把测试脚本当主入口。正常验证整条链路时，优先跑：

1. `retainpdf-pipeline book --spec <job_root>/specs/book.spec.json`
2. 或 Rust API 提交 job，让 Rust 通过 spec 驱动三个 worker

如果要改翻译链路，推荐阅读顺序是：

1. `retainpdf_pipeline/translate/README.md`
2. `retainpdf_pipeline/translate/llm/README.md`
3. 再按需要进入 `retainpdf_pipeline/translate/llm/providers/` 或 `retainpdf_pipeline/translate/llm/shared/orchestration/`

## 新 Provider 接入顺序

如果后续要接新的 OCR provider，先按这个顺序走，不要直接改翻译/渲染主线：

1. 先看 `retainpdf_pipeline/ocr/ocr_provider/README.md`
   先把 provider API 层边界、状态、原始产物职责定义清楚。
2. 再看 `retainpdf_pipeline/ocr/document_schema/README.md`
   明确字段应该落到 `geometry/content/layout_role/semantic_role/structure_role/policy/provenance` 的哪一层。
3. 准备最小 raw fixture
   放到 `devtools/tests/document_schema/fixtures/`。
4. 新增 provider 实现和 adapter
   通过 `retainpdf_pipeline/ocr/document_schema/adapters.py` 接进统一 schema.
5. 把 fixture 登记到 `devtools/tests/document_schema/fixtures/registry.py`
   不要手改主线去兼容 provider 原始 JSON。
6. 跑 `devtools/tests/document_schema/regression_check.py`
   至少确认 detector、adapt、validation、extractor smoke 全都通过。

## 顶层目录说明

顶层只有 `retainpdf_pipeline/`（canonical 包）、`devtools/` 与若干空壳兼容目录；
`ocr/`、`translate/`、`render/` 三 stage 目录都在 `retainpdf_pipeline/` 下，
各自是独立进程入口（`python -m retainpdf_pipeline.{ocr,translate,render}`）。
生产 book 由 Rust 顺序调三进程，包内 `runtime/pipeline/book_pipeline.py` 只剩本地串联。

- `retainpdf_pipeline/ocr/mineru`
  MinerU 接入、下载、解包、job 组织。
- `retainpdf_pipeline/services/pipeline_shared`
  provider / translate / render 共用的阶段协议、summary 和 JSON IO。
  `retainpdf_pipeline/services/` 下只有它仍有实体文件，其余子目录是搬家空壳。
- `retainpdf_pipeline/translate`
  OCR payload 到翻译 JSON（含 `translation_stage.py` 阶段门面）。
- `retainpdf_pipeline/render`
  翻译 JSON 到 PDF（含 `render_stage.py`、`translation_loader.py`、`render_inputs.py` 阶段门面）。
- `retainpdf_pipeline/runtime/pipeline`
  本地 book 串联收口（仅 `book_pipeline.py`）；生产编排在 Rust 侧。
- `retainpdf_pipeline/entrypoints`
  console-mode 入口实现；顶层 `entrypoints/` 已清空，不要再进。
- `retainpdf_pipeline/services/README.md`
  具体能力实现层总说明。
- `retainpdf_pipeline/foundation/config`
  路径、字体、版式和运行时默认配置。
- `retainpdf_pipeline/foundation/shared`
  输入解析、job 目录、环境变量、提示词加载等共享能力。
- `retainpdf_pipeline/foundation/prompts`
  可编辑提示词模板。
- `devtools/experiments`
  实验性流程，不属于稳定主链路。
- `devtools/tests`
  测试探针和排版实验。
- `devtools/tools`
  示例脚本、迁移工具和诊断脚本。

## 结构化输出

任务输出统一落到标准 job root 下。Rust API 默认是：

- `DATA_ROOT/jobs/<job-id>/source`
- `DATA_ROOT/jobs/<job-id>/ocr`
- `DATA_ROOT/jobs/<job-id>/translated`
- `DATA_ROOT/jobs/<job-id>/rendered`
- `DATA_ROOT/jobs/<job-id>/artifacts`
- `DATA_ROOT/jobs/<job-id>/logs`

其中：

- `ocr/unpacked/` 或 provider raw 目录保留 OCR provider 原始产物；MinerU 常见为 `layout.json`，Paddle HTTP 常见为 `paddle_result.json` / `paddle_raw`，可选 CLI transport 保存在 `ocr/paddle_cli/run-*/`
- `ocr/normalized/document.v1.json` 是当前翻译/渲染主链路使用的统一 OCR 输入
- `ocr/normalized/document.v1.report.json` 记录 adapter/provider 探测、defaults 默认补齐和 schema 校验摘要
- `translated/translation-manifest.json` 与其引用的逐页 payload 是翻译阶段正式产物
- `rendered/*.pdf` 是最终输出 PDF
- `rendered/typst/` 保留 Typst 中间产物，便于查错和回溯
- `artifacts/` 放 summary、bundle 索引等下载产物
- `logs/` 放阶段日志和结构化事件输出

当前约定：

- 主链路优先消费 `document.v1.json`
- `document.v1.json` 的正式消费口径是 `geometry/content/layout_role/semantic_role/structure_role/policy/provenance`
- 如果入口给的是 raw `layout.json`，会先做一次显式规范化，再进入翻译主线
- raw MinerU 结构保留给 adapter、调试和回溯，不再作为主链路的隐式数据契约
- 如果只是做排错、状态展示或 API 输出摘要，优先消费 `document.v1.report.json`
- Python 侧统一通过 `ocr/document_schema/reporting.py` 读取 report 和生成 normalization summary
- `specs/` 保存阶段 spec JSON，当前已覆盖：
  - `normalize.spec.json` -> `normalize.stage.v1`
  - `translate.spec.json` -> `translate.stage.v1`
  - `render.spec.json` -> `render.stage.v1`
  - `provider.spec.json` -> `provider.stage.v1`
  - `book.spec.json` -> `book.stage.v1`

## Stage Spec 约定

当前 Rust API 到 Python worker 的稳定协议，已经固定为：

`retainpdf-pipeline <subcommand> --spec DATA_ROOT/jobs/<job-id>/specs/<stage>.spec.json`

未安装 retainpdf-pipeline 的桌面兼容目录回退到 python backend/pipeline/entrypoints/run_*.py --spec DATA_ROOT/jobs/<job-id>/specs/<stage>.spec.json。

约定如下：

- spec 只保存阶段输入、参数和 job 引用，不再把 Python 内部实现细节暴露给 Rust
- `job.job_root` 是路径推导锚点；各阶段内部通过 `job_dirs.py` 派生 `source/ocr/translated/rendered/artifacts/logs`
- 密钥不明文写入 spec
  - 翻译 key 通过 `credential_ref=env:RETAIN_TRANSLATION_API_KEY`
  - 如果 provider 是 `mineru`，对应 token 通过 `credential_ref=env:RETAIN_MINERU_API_TOKEN`
  - 运行时由 Rust 注入环境变量，Python 通过 `stage_specs.resolve_credential_ref(...)` 读取
- Rust 主工作流和本地 book/translate 入口都已切到 spec-only
  - `retainpdf-pipeline normalize-ocr --spec <job_root>/specs/normalize.spec.json`
  - `retainpdf-pipeline provider-ocr --spec <job_root>/specs/provider.spec.json`
  - `retainpdf-pipeline translate-only --spec <job_root>/specs/translate.spec.json`
  - `retainpdf-pipeline render-only --spec <job_root>/specs/render.spec.json`
  - `retainpdf-pipeline translate-from-ocr --spec <job_root>/specs/book.spec.json`（顶层垫片已删除，只有包内入口和 console 子命令）
  - `retainpdf-pipeline provider-case --spec <job_root>/specs/provider.spec.json`
  - `retainpdf-pipeline book --spec <job_root>/specs/book.spec.json`
  - `run_document_flow.py`（script-mode，仅桌面兼容，无 console 等价物）
  - `translate_book.py`（script-mode，仅桌面兼容，无 console 等价物）

本地开发入口当前也已统一到 stage spec 主路径：

- `retainpdf-pipeline provider-case --spec <job_root>/specs/provider.spec.json` -> 当前 provider-backed full workflow 的本地通用入口
- `run_document_flow.py`（script-mode，仅桌面兼容，无 console 等价物） -> 当前 normalized-document full flow 的本地通用入口名
- `retainpdf-pipeline provider-ocr --spec <job_root>/specs/provider.spec.json` -> 当前 OCR-only provider flow 的本地通用入口
- `retainpdf_pipeline/ocr/document_schema/normalize_pipeline.py` -> `normalize.stage.v1`
- `retainpdf_pipeline/translate/entrypoints/translate_only_pipeline.py` -> `translate.stage.v1`
- `retainpdf_pipeline/render/workflow/render_only.py` -> `render.stage.v1`
- `retainpdf_pipeline/translate/entrypoints/from_ocr_pipeline.py` -> `book.stage.v1`
- `retainpdf-pipeline book --spec <job_root>/specs/book.spec.json` -> `book.stage.v1`

历史任务需要按当前转换规则重建 `document.v1.json` 时，使用同一条 normalize
构建链路的回填工具：

```bash
# 默认只读检查；输出哪些任务会变化，不写任务目录或数据库
python backend/pipeline/devtools/backfill_normalized_documents.py \
  --jobs-root data/jobs \
  --require-complete \
  --report /tmp/normalized-backfill-dry-run.json

# 先限定一个 succeeded 任务写入；document/report 成对备份回滚，
# Markdown 只在缺失时生成，FTS 使用自己的 SQLite transaction
python backend/pipeline/devtools/backfill_normalized_documents.py \
  --jobs-root data/jobs \
  --job-id <job-id> \
  --require-complete \
  --write \
  --report /tmp/normalized-backfill-write.json
```

安全约定：

- 没有 `--write` 时永远不改 `data/jobs` 或 `jobs.db`
- 工具只使用已下载的 provider payload 和本地产物，不调用 Paddle、其他 OCR 服务或 LLM
- 默认只处理数据库中 `succeeded` 的任务；failed/running/orphan 必须显式传
  `--include-non-succeeded`，数据库缺失时也只允许 dry-run
- 只有校验通过且（启用 `--require-complete` 时）无完整性警告才写入
- `document.v1.json` 与 report 在写入前成对备份；任一写失败都会恢复旧版本
- 已存在的 `md/full.md` 被视为 provider 权威产物，永不覆盖；只有缺失时才调用
  `materialize_document_markdown_fallback`
- `translation-manifest.json` 使用正式 loader 校验 schema、相对路径、引用文件和 JSON array；
  缺失或损坏但仍有逐页翻译 payload 时标记 `incomplete`，绝不猜测补写 manifest
- Reader regions 和 PDF metadata 是 Rust API 请求时即时派生的 view，没有独立文件可回填；
  CLI 只验证 document bbox、manifest page payload 和 source PDF 是否足以派生
- 只刷新 `documents.active_job_id` 对应任务的 FTS；历史非 active job 不覆盖当前索引
- FTS 使用独立 SQLite transaction；它不与 document/Markdown 文件写入宣称跨介质原子性，
  失败会在单任务结果中单独报告，整次批处理最后汇总失败任务
- `--skip-fts` 可显式跳过数据库刷新；数据库不存在时仍可 dry-run，写入则必须显式传
  `--include-non-succeeded` 表明接受未注册任务风险
- Paddle 旧 JSONL 的 `dataInfo` 完整性推断会写入报告，但工具不修改 provider raw；
  official CLI `doc_parsing` 的 page-only geometry 也继续保持 `complete=false`
- `--report` 必须放在 jobs root 之外，避免运维报告覆盖 provider raw 或任务产物

也就是说，当前“最上层整个流程”的真实执行口径是：

- 本地：`retainpdf-pipeline book --spec <job_root>/specs/book.spec.json`
- Rust API：创建 job，由 Rust 生成 `specs/*.spec.json` 并依次启动 worker
- 测试脚本：只做回归，不代表主执行路径

未安装 retainpdf-pipeline 的桌面兼容目录回退到 python backend/pipeline/entrypoints/run_book.py --spec <job_root>/specs/book.spec.json。

## Python 包与依赖真相源

Pipeline 是可独立安装的 `retainpdf-pipeline` 包，依赖真相源是本目录的
[`pyproject.toml`](./pyproject.toml)。后端 workspace 根是
[`backend/pyproject.toml`](../pyproject.toml)，组合 `pipeline` 与 `ai` 两个成员；
monorepo 根不再持有 Python workspace 真相源。

wheel 只发布 `retainpdf_pipeline.*`；不会再安装通用顶层包名
`services`、`foundation`、`runtime` 或 `entrypoints`。

修改依赖后，从后端 workspace 根更新并检查锁文件：

```bash
uv lock
uv lock --check
```

独立后端仓只维护 workspace `pyproject.toml`、成员包 `pyproject.toml` 与
`uv.lock`。Docker 直接从锁文件导出依赖；desktop 等产品级消费者如需快照，
由各自仓库的集成脚本生成，后端工具不会反向写入消费端目录。

安装后可通过稳定入口运行，例如：

```bash
retainpdf-pipeline translate-only --spec /path/to/translation.spec.json
retainpdf-pipeline render-only --spec /path/to/render.spec.json
```

过渡期内原有 `backend/pipeline/entrypoints/run_*.py` 文件仍保留（script-mode，仅桌面兼容），Rust API 和已存在部署不会被迫同时迁移。

Rust API 默认采用自动模式：如果 `PATH` 中能够找到 `retainpdf-pipeline`，worker
命令会保存为 `retainpdf-pipeline <subcommand> --spec ...`；未安装 retainpdf-pipeline 的桌面兼容目录回退到 python backend/pipeline/entrypoints/run_*.py --spec ...。可以通过以下环境变量显式控制：

- `RUST_API_PYTHON_ENTRYPOINT_MODE=auto|console|script`
- `RUST_API_PIPELINE_COMMAND=/absolute/path/to/retainpdf-pipeline`

Docker 镜像安装 pipeline 包并固定使用 `console` 模式；尚未安装包的桌面兼容目录
继续使用脚本模式。

兼容说明：

- 旧任务目录如果还是 `originPDF/jsonPDF/transPDF/typstPDF`，当前后端会直接拒绝详情/下载接口，请重新跑任务生成标准 schema
- 旧的逐页 translation JSON 直扫模式已经退出主线；render-only 必须提供 `translation-manifest.json`

## 子目录文档

- [PIPELINE_DIRECTORY_MAP.md](./PIPELINE_DIRECTORY_MAP.md)
- [foundation/config/README.md](./retainpdf_pipeline/foundation/config/README.md)
- [foundation/shared/README.md](./retainpdf_pipeline/foundation/shared/README.md)
- [runtime/pipeline/README.md](./retainpdf_pipeline/runtime/pipeline/README.md)
- [services/README.md](./retainpdf_pipeline/services/README.md)
- [ocr/ocr_provider/README.md](./retainpdf_pipeline/ocr/ocr_provider/README.md)
- [translate/README.md](./retainpdf_pipeline/translate/README.md)
- [render/README.md](./retainpdf_pipeline/render/README.md)
- [ocr/mineru/README.md](./retainpdf_pipeline/ocr/mineru/README.md)

## 设计边界

- `translate` 不直接操作 PDF
- `render` 不直接决定翻译策略
- `runtime/pipeline` 负责编排，不下沉到实现细节
- `foundation/` 不承载具体业务流程
- `entrypoints/` 只做入口，不承载核心实现
- `devtools/` 不能反向成为主链路依赖

## 架构检查

日常改动建议至少跑这两条：

- `python3 backend/api/scripts/check_architecture.py`
- `PYTHONPATH=backend/pipeline python3 backend/pipeline/devtools/check_pipeline_architecture.py`

第二条负责卡住 Python 主链最容易回退的边界：

- `runtime/pipeline` 重新直接 import `ocr.ocr_provider` / `ocr.mineru`
- `runtime/pipeline` 重新理解 provider raw token，例如 `layoutParsingResults`
- `translate` / `render` 重新碰 provider raw adapter
- `entrypoints/*` 绕过稳定入口，直接连深层实现
- `ocr/ocr_provider/__init__.py` 丢掉显式公共导出面
- `ocr/ocr_provider/provider_pipeline.py` 丢掉稳定 compat symbol 或不再承担主链 handoff
- `ocr/ocr_provider/paddle_*` 反向依赖 `runtime/pipeline` / `translate` / `render`
