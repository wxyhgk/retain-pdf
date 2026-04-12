# MinerU 集成说明

这一层只负责 MinerU 接入，不负责翻译策略，也不负责 PDF 渲染。

如果你现在关注的是“外部 OCR API 应该如何独立抽象，而不是耦合到当前工作流里”，先读：

- `scripts/services/ocr_provider/README.md`

`services/mineru/` 只是 MinerU 这个 provider 的具体实现。

## 作用边界

- 向 MinerU 提交任务
- 查询任务状态
- 下载并解包 MinerU 结果
- 组织 `output/<job-id>/source`、`ocr`、`translated`、`rendered`、`artifacts`、`logs`
- 保留 raw `layout.json` 供 adapter、调试和回溯使用
- 产出统一中间层 `document.v1.json`

这里不做的事情：

- 不做 OCR 后处理
- 不做翻译
- 不做 PDF 渲染
- 不决定 `fast/sci/precise` 的翻译策略

## 推荐入口

- `scripts/entrypoints/run_mineru_case.py`
  推荐的一条命令入口，适合日常使用。输入 PDF 后，会按“解析 -> 解包 -> 翻译 -> 渲染”的顺序串起来。
- `mineru_pipeline.py`
  `entrypoints/run_mineru_case.py` 背后的稳定实现。
- `mineru_job.py`
  只做解析和解包，适合先拿 MinerU 结果再手动接翻译。
- `mineru_api.py`
  最底层 API 调用封装，只在需要直接调 MinerU 接口时使用。
- `scripts/devtools/tools/mineru_api_example.py`
  最小示例，适合调通接口和查看返回结构。
- `scripts/devtools/tools/migrate_legacy_output.py`
  把旧输出目录迁移到新的 job 目录结构。

## 目录结构

- `output/<job-id>/source`
- `output/<job-id>/ocr`
- `output/<job-id>/translated`
- `output/<job-id>/rendered`
- `output/<job-id>/artifacts`
- `output/<job-id>/logs`

## 默认约定

- MinerU 阶段会同时产出：
  - `ocr/unpacked/layout.json`
  - `ocr/normalized/document.v1.json`
  - `ocr/normalized/document.v1.report.json`
- 当前翻译/渲染主链路默认要求并优先使用 `ocr/normalized/document.v1.json`
- `ocr/unpacked/layout.json` 保留给适配器、调试和回溯，不再作为主链路的隐式 fallback
- `content_list_v2.json` 目前仅用于实验和适配，不是主路径
- 如果只想做 provider / compat / validation 摘要展示，优先读取 `document.v1.report.json`

职责拆分：

- `document_v1.py`
  只负责 MinerU 的 `layout.json -> document.v1.json`
- `artifacts.py`
  只负责 MinerU 产物路径和主链路 source JSON 选择
- `contracts.py`
  只负责 MinerU 主线共享约定：产物文件名、目录名、stdout 标签
- `job_flow.py`
  只负责任务编排、下载解包和持久化
- `mineru_pipeline.py`
  只负责把规范化后的 OCR 输入送进翻译/渲染主链路

现在这条链路已经通过 `services/document_schema/adapters.py` 暴露为统一 adapter，
也就是 MinerU 不再直接把自己的原始结构泄漏到翻译主线。

## 与主流程的关系

典型链路是：

1. `mineru_job.py` 或 `mineru_pipeline.py` 向 MinerU 提交 PDF
2. 轮询直到任务完成
3. 下载并解包结果
4. 把原始 PDF 复制到 `source`
5. 把解析结果放到 `ocr/unpacked`
6. 同时生成 `ocr/normalized/document.v1.json`
7. 后续由 `runtime/pipeline` 调 `services/translation` 和 `services/rendering` 完成剩余流程

当前 `pipeline_summary.json` 里还会写入一份 `schema_validation`，用于快速确认
规范化文档是否满足当前 `document.v1` 契约；同时会带上 `normalization_report`
和 `normalization_summary`，避免外层再次自己解析 raw OCR。

也就是说，这一层的职责是“把 PDF 变成主链路可消费的 OCR 输入”，而不是承担后续业务。

兼容说明：

- 老任务目录如果还是 `originPDF/jsonPDF/transPDF/typstPDF`，当前后端会直接拒绝详情/下载接口，请重新跑任务

## 协作规矩

如果 OCR 这块单独分人维护，这里只负责“拿到 provider 结果，并把它整理成主链路可消费的 OCR 输入”。

- 允许在这里改 provider API 接入、下载解包、任务目录整理和 provider 侧兼容
- 不要在这里直接补翻译规则、术语逻辑或 PDF 渲染逻辑
- 如果发现下游需要的字段不够，优先通过 `document_schema` 提升成稳定字段，不要把 raw provider 字段直接泄漏给 translation / rendering
- 如果改了 OCR 产物目录约定、stdout 标签或主链路输入位置，必须同步更新 `document_schema`、`runtime/pipeline` 和对应测试
