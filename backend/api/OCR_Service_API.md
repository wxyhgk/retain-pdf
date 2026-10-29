# OCR-only API 说明

这份文档说明只做 OCR 的任务（`workflow: "ocr"`）怎么建、怎么查、怎么取结果。

说明：

- 这是一份 OCR-only 专项说明，正式 API 总入口先看 [RetainPDF 后端 API 总入口](../../docs/core/api/index.md)，运行主链看 [CURRENT_API_MAP](CURRENT_API_MAP.md)
- 当前 provider 选择看请求里的 `provider` / `ocr.provider`，实际支持集以健康检查和 `OCR_PROVIDER_CONTRACT.md` 为准

它的目标很明确：

- 只做 OCR 解析
- 只做 raw OCR -> `document.v1.json` / `document.v1.report.json` 标准化
- 不做翻译
- 不做 Typst
- 不做 PDF 渲染

OCR-only 任务和其他任务走同一组 `/jobs` 接口，用 `workflow: "ocr"` 区分，没有单独的接口族。
原来的 `/api/v1/ocr/jobs` 一组地址已于 **2026-10-18 删除**（请求返回 404），对照如下：

| 已删除的旧地址 | 现在用 |
|---|---|
| `POST /api/v1/ocr/jobs`（multipart） | 先 `POST /api/v1/uploads`，再 `POST /api/v1/jobs`（JSON，`workflow: "ocr"`，`source.upload_id`） |
| `GET /api/v1/ocr/jobs` | `GET /api/v1/jobs?workflow=ocr` |
| `GET /api/v1/ocr/jobs/{job_id}` | `GET /api/v1/jobs/{job_id}` |
| `GET /api/v1/ocr/jobs/{job_id}/events` | `GET /api/v1/jobs/{job_id}/progress/events` |
| `GET /api/v1/ocr/jobs/{job_id}/artifacts`、`/artifacts-manifest` | `GET /api/v1/jobs/{job_id}/files` |
| `GET /api/v1/ocr/jobs/{job_id}/normalized-document` | `GET /api/v1/jobs/{job_id}/files/internal/normalized-document.json` |
| `GET /api/v1/ocr/jobs/{job_id}/normalization-report` | `GET /api/v1/jobs/{job_id}/files/internal/normalization-report.json` |
| `POST /api/v1/ocr/jobs/{job_id}/cancel` | `POST /api/v1/jobs/{job_id}/actions/cancel` |

`/jobs/{job_id}` 下 9 类地址见 [任务接口分类](../../docs/api/01-任务/04-任务接口分类.md)，全部接口见 [接口目录](../../docs/api/00-接口目录.md)。

当前示例仍以 `mineru` 为主，但这只是 provider 示例，不代表 OCR-only 协议默认绑定 MinerU。

这条 OCR-only 流程在整套系统中的位置是：

1. OCR API 负责把 provider 原始结果收口成 `document.v1`
2. 完整翻译链再由上层 `normalize -> translate -> render` 主流程继续消费
3. OCR API 不是测试脚本，也不是翻译/渲染入口；它是正式生产链路里的 normalize 前半段

当前 `document.v1` 交给下游时的正式消费口径是：

- `geometry`
- `content`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy`
- `provenance`

兼容字段 `type/sub_type/bbox/text/lines/segments` 可以保留，但不应再被下游当成主要语义入口。

内部实现说明：

- 路由登记在 `app/router/jobs/` 的接口登记表里，OCR-only 和其他任务共用 `/jobs` 的处理函数（`routes/jobs/*`）
- `routes/jobs/lifecycle.rs` 负责任务创建入口和查询；上传 PDF 走 `/uploads`
- `routes/jobs/actions.rs` / `routes/jobs/files.rs` 负责取消和产物下载
- `routes/job_requests.rs` 负责请求解析
- `routes/common.rs` / `routes/download_response/**` / `routes/job_helpers.rs` 负责 OCR / 通用 job 的公共 response 与下载辅助逻辑
- 下面几条的 `services/jobs/...` 是逻辑路径，代码在任务包 `backend/packages/retainpdf-jobs/src/`
- `services/jobs/facade.rs` 负责稳定服务入口
- `services/jobs/lifecycle/creation/submit.rs`（`submit_job`）负责 OCR job 构建
- `services/jobs/lifecycle/validation.rs` 负责 provider 参数校验
- `services/jobs/lifecycle/snapshot_factory.rs` 负责 snapshot / command 组装
- `services/jobs/lifecycle/launcher.rs` 负责执行启动

如果你在排查接口行为，请以这些拆分后的模块职责为准，而不是旧版集中式文件结构。

## 1. 基础信息

- 服务端口：`41000`
- 基础前缀：`/api/v1`
- 健康检查：`GET /health`
- 鉴权方式：请求头 `X-API-Key`
- 响应格式：除下载接口外，默认返回 JSON

请求头示例：

```http
X-API-Key: your-rust-api-key
```

统一返回包：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

说明：

- `code=0` 表示成功
- 非 `0` 表示失败
- `message` 可以直接给前端展示

## 2. OCR 任务状态

任务总状态：

- `queued`
- `running`
- `succeeded`
- `failed`
- `canceled`

常见阶段：

- `queued`
- `mineru_upload`
- `mineru_processing`
- `normalizing`
- `finished`
- `failed`
- `canceled`

补充说明：

- `queued`：已入队，等待执行槽位
- `mineru_upload`：文件已上传给 MinerU，等待处理
- `mineru_processing`：MinerU 正在解析
- `normalizing`：正在生成 `document.v1`
- `finished`：OCR + 标准化完成

## 3. 健康检查

`GET /health`

返回示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "status": "up",
    "db": "ok",
    "queue_depth": 0,
    "running_jobs": 0,
    "provider_backends": ["mineru", "paddle"],
    "time": "2026-03-31T03:33:44Z"
  }
}
```

字段说明：

- `status`：`up` 或 `degraded`
- `db`：SQLite 是否可用
- `queue_depth`：当前排队任务数
- `running_jobs`：当前运行中任务数
- `provider_backends`：当前已接入的 OCR provider

## 4. 创建 OCR 任务

分两步：

1. `POST /api/v1/uploads`（`multipart/form-data`，字段 `file`）上传 PDF，拿到 `upload_id`；
2. `POST /api/v1/jobs`，请求体是 JSON，`workflow` 填 `ocr`。

OCR-only 任务只跑 OCR provider 和 normalize，不需要 `translation`、`render` 段。请求体里不认识的字段一律 `400`。

实现补充：

- 请求体解析在 `routes/job_requests.rs`
- 创建入口在 `routes/jobs/lifecycle.rs`
- facade 收口在 `services/jobs/facade.rs`
- 创建前的 provider / token / URL / timeout 校验在 `services/jobs/lifecycle/validation.rs`
- OCR job 的 snapshot 构建与启动由 `services/jobs/lifecycle/creation/submit.rs`（`submit_job`）、`services/jobs/lifecycle/snapshot_factory.rs` 和 `services/jobs/lifecycle/launcher.rs` 协作完成

提交方式二选一：

- 上传本地 PDF：先 `POST /api/v1/uploads`，再在 `source.upload_id` 里填返回的编号
- 提交远程 PDF：`source.source_url`（不用上传）

### 必填字段

- `workflow`：固定 `ocr`
- `source.upload_id` 或 `source.source_url`
- `ocr.provider`
  当前常用值：`mineru`；其他 provider 以当前部署启用项为准
- `ocr.mineru_token`（或 `ocr.credential_ref`）
  当 `ocr.provider=mineru` 时必填
- `runtime.timeout_seconds`
  OCR 任务总超时秒数

### 常用可选字段

旧表单里的字段现在都在 JSON 对应的段里：

- `ocr.model_version`
- `ocr.is_ocr`
- `ocr.disable_formula`
- `ocr.disable_table`
- `ocr.language`

  上面这几个是 MinerU 的选项。`provider=paddle` 时 `disable_formula`、`disable_table` 不生效（Paddle 的网络接口没有对应开关，任务日志里记一句
  `paddle provider note: ... will be ignored`），`language`、`is_ocr`、`model_version` 也不传给 Paddle；Paddle 用的模型和参数见
  `backend/config/ocr_providers.json` 和 `retainpdf_pipeline/ocr/ocr_provider/paddle_api.py` 的 `build_optional_payload`。
- `ocr.page_ranges`
- `ocr.data_id`
- `ocr.no_cache`
- `ocr.cache_tolerance`
- `ocr.extra_formats`
- `ocr.poll_interval`
- `ocr.poll_timeout`
- `ocr.options`：provider 专用的非密钥参数
- `runtime.job_id`

字段的完整定义见 `contracts/create-job.v1.schema.json`。

### 本地文件示例

```bash
# 1. 上传 PDF，记下返回的 upload_id
curl -X POST "http://127.0.0.1:41000/api/v1/uploads" \
  -H "X-API-Key: your-rust-api-key" \
  -F "file=@/path/to/paper.pdf"

# 2. 用 upload_id 建 OCR 任务
curl -X POST "http://127.0.0.1:41000/api/v1/jobs" \
  -H "X-API-Key: your-rust-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": "ocr",
    "source": {"upload_id": "20260331033700-ab12cd"},
    "ocr": {"provider": "mineru", "mineru_token": "your-mineru-token", "model_version": "vlm"},
    "runtime": {"timeout_seconds": 1800}
  }'
```

### 远程 URL 示例

```bash
curl -X POST "http://127.0.0.1:41000/api/v1/jobs" \
  -H "X-API-Key: your-rust-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": "ocr",
    "source": {"source_url": "https://example.com/paper.pdf"},
    "ocr": {"provider": "mineru", "mineru_token": "your-mineru-token"},
    "runtime": {"timeout_seconds": 1800}
  }'
```

### 返回示例

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "20260331033736-c2bcda",
    "status": "queued",
    "workflow": "ocr",
    "links": {
      "self_path": "/api/v1/jobs/20260331033736-c2bcda",
      "self_url": "http://127.0.0.1:41000/api/v1/jobs/20260331033736-c2bcda",
      "artifacts_path": "/api/v1/jobs/20260331033736-c2bcda/files",
      "artifacts_url": "http://127.0.0.1:41000/api/v1/jobs/20260331033736-c2bcda/files",
      "cancel_path": "/api/v1/jobs/20260331033736-c2bcda/actions/cancel",
      "cancel_url": "http://127.0.0.1:41000/api/v1/jobs/20260331033736-c2bcda/actions/cancel"
    }
  }
}
```

### 校验规则

- `ocr.provider` 必须是当前服务支持的 OCR provider
- 当 `ocr.provider=mineru` 时，`ocr.mineru_token` 和 `ocr.credential_ref` 必须给一个
- 当传入 `ocr.mineru_token` 时，它不能是 URL
- `source.source_url` 如果提供，必须以 `http://` 或 `https://` 开头
- `runtime.timeout_seconds` 必须大于 `0`

## 5. OCR 任务列表

`GET /api/v1/jobs?workflow=ocr`

支持参数：

- `limit`
- `offset`
- `status`
- `workflow`：填 `ocr` 只看 OCR-only 任务
- `provider`

示例：

```bash
curl -H "X-API-Key: your-rust-api-key" \
  "http://127.0.0.1:41000/api/v1/jobs?workflow=ocr&limit=20&offset=0&status=failed&provider=mineru"
```

返回的列表项结构见 [任务列表](../../docs/api/01-任务/03-任务列表.md)。

## 6. OCR 任务详情

`GET /api/v1/jobs/{job_id}`

示例：

```bash
curl -H "X-API-Key: your-rust-api-key" \
  "http://127.0.0.1:41000/api/v1/jobs/20260331033736-c2bcda"
```

详情里重点看这些字段：

- `status`
- `stage`
- `stage_detail`
- `trace_id`
- `provider_trace_id`
- `ocr_provider_diagnostics`
- `artifacts`

说明：

- `trace_id` 是 OCR 微服务内部链路 ID
- `provider_trace_id` 是 provider 返回的链路 ID
- `ocr_provider_diagnostics` 用于排错
- `ocr_provider_diagnostics.artifacts` 只放 provider transport/raw 产物和 normalize 产物路径摘要，不直接展开 `document.v1` 内部字段

边界约定：

- provider 原始状态、错误、raw bundle 信息保留在 `ocr_provider_diagnostics`
- `document.v1.json` / `document.v1.report.json` 仍然是下游主契约
- 不把 provider 私有字段直接塞进 `document.v1`

## 7. 获取文件清单

`GET /api/v1/jobs/{job_id}/files`

这个接口是 OCR 任务最重要的接口之一，取代已删除的 `/ocr/jobs/{job_id}/artifacts` 和 `/artifacts-manifest`。

它按 `output`、`pages`、`internal` 三组列出任务的文件，每一项带 `name`、`url`、`content_type`、`ready`、
`size_bytes`、`updated_at`、`stage`。完整结构见 [下载总览](../../docs/api/07-产物下载/01-下载总览.md)。

OCR-only 任务下游真正关心的在 `internal` 组（单机模式能看到，多用户模式只给管理员）：

| `internal` 里的文件名 | 内容 |
|---|---|
| `normalized-document.json` | 标准化后的 `document.v1.json` |
| `normalization-report.json` | 标准化报告 `document.v1.report.json` |
| `ocr-provider/result.json` | provider 原始返回结果 |
| `ocr-provider/raw.zip` | provider 原始 zip |

`output` 组里有 `ocr.md`（原文 Markdown）和 `ocr.zip`（Markdown + 图片）。

每个文件都能直接按清单里的 `url` 取，例如：

```text
/api/v1/jobs/20260331033736-c2bcda/files/internal/normalized-document.json
/api/v1/jobs/20260331033736-c2bcda/files/internal/normalization-report.json
```

补充说明：

- `ocr-provider/result.json` / `ocr-provider/raw.zip` 属于 provider raw artifacts
- `normalized-document.json` / `normalization-report.json` 属于 normalized artifacts
- 这两层需要同时保留，前者用于排 OCR provider 问题，后者用于排 `document_schema` 适配问题
- 清单不再返回 `schema_version` 和 provider 的目录路径（`provider_raw_dir` 等）；目录下载不了

## 8. 下载标准化 OCR 结果

### 下载 `document.v1.json`

`GET /api/v1/jobs/{job_id}/files/internal/normalized-document.json`

### 下载 `document.v1.report.json`

`GET /api/v1/jobs/{job_id}/files/internal/normalization-report.json`

用途：

- `document.v1.json` 给翻译主线直接消费
- `document.v1.report.json` 给排错、前端诊断、schema 检查使用

## 9. 取消 OCR 任务

`POST /api/v1/jobs/{job_id}/actions/cancel`

示例：

```bash
curl -X POST \
  -H "X-API-Key: your-rust-api-key" \
  "http://127.0.0.1:41000/api/v1/jobs/20260331033736-c2bcda/actions/cancel"
```

当前取消规则：

- 如果任务还在排队，直接取消
- 如果任务还在 provider 阶段，停止后续轮询/执行
- 如果任务已经进入 `normalizing`，会先完成当前 normalize，再丢弃标准化产物，然后标记 `canceled`

## 10. 当前目录落盘约定

以任务 `20260331033736-c2bcda` 为例：

```text
output/20260331033736-c2bcda/
├── source/
│   └── font_test.pdf
└── ocr/
    ├── mineru_result.json
    ├── mineru_bundle.zip
    ├── unpacked/
    └── normalized/
        ├── document.v1.json
        └── document.v1.report.json
```

说明：

- `source/`：原始 PDF
- `ocr/unpacked/`：provider 解包原始内容
- `ocr/normalized/`：给主链路消费的标准化结果

## 11. 当前限制和边界

当前这套 OCR 微服务接口已经能跑通 `provider raw -> document.v1`。

但要注意：

- 当前 provider 已不止 `mineru`，但不同部署启用的 provider 集合可能不同
- Rust 侧已经负责 MinerU / Paddle provider transport 的提交、轮询、结果下载或 raw 产物落盘
- Python 侧仍负责 raw OCR -> `document.v1.json` 的 normalize，以及后续 translate / render worker
- Rust 侧还负责：
  - HTTP API
  - 任务状态
  - 分页列表
  - trace_id
  - 取消/超时
  - 文件清单

## 12. 推荐对接方式

如果你后续要让主系统接这套 OCR 微服务，建议固定按这个顺序：

1. `POST /api/v1/uploads`
2. `POST /api/v1/jobs`（`workflow: "ocr"`）
3. `GET /api/v1/jobs/{job_id}`（或 `GET /api/v1/jobs/{job_id}/progress/events`）
4. `GET /api/v1/jobs/{job_id}/files`
5. 下载：
   - `/files/internal/normalized-document.json`
   - `/files/internal/normalization-report.json`

主系统不要直接读 provider raw JSON。

主系统应该优先消费：

- `document.v1.json`
- `document.v1.report.json`
- `schema_version`
- `trace_id`
- `provider_trace_id`

这样后续替换 OCR provider 时，翻译和渲染主线不需要一起改。
