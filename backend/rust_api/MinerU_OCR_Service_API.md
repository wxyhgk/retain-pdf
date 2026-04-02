# MinerU OCR 微服务 API 说明

这份文档只说明 OCR-only 微服务接口。

它的目标很明确：

- 只做 OCR 解析
- 只做 raw OCR -> `document.v1.json` / `document.v1.report.json` 标准化
- 不做翻译
- 不做 Typst
- 不做 PDF 渲染

当前这套接口已经挂在现有 `rust_api` 服务里，但逻辑上是独立的 OCR 微服务接口族：

- `/api/v1/ocr/jobs`
- `/api/v1/ocr/jobs/{job_id}`
- `/api/v1/ocr/jobs/{job_id}/artifacts`
- `/api/v1/ocr/jobs/{job_id}/normalized-document`
- `/api/v1/ocr/jobs/{job_id}/normalization-report`
- `/api/v1/ocr/jobs/{job_id}/cancel`

当前首个 provider 是 `mineru`。

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
    "provider_backends": ["mineru"],
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

`POST /api/v1/ocr/jobs`

这是一个 `multipart/form-data` 接口。

支持两种提交方式，二选一：

- 上传本地 PDF：`file`
- 提交远程 PDF：`source_url`

### 必填字段

- `provider`
  当前固定填：`mineru`
- `mineru_token`
  MinerU API key
- `timeout_seconds`
  OCR 任务总超时秒数

### 常用可选字段

- `file`
- `source_url`
- `model_version`
- `is_ocr`
- `disable_formula`
- `disable_table`
- `language`
- `page_ranges`
- `data_id`
- `no_cache`
- `cache_tolerance`
- `extra_formats`
- `poll_interval`
- `poll_timeout`
- `job_id`

### 本地文件示例

```bash
curl -X POST "http://127.0.0.1:41000/api/v1/ocr/jobs" \
  -H "X-API-Key: your-rust-api-key" \
  -F "provider=mineru" \
  -F "mineru_token=your-mineru-token" \
  -F "timeout_seconds=1800" \
  -F "model_version=vlm" \
  -F "file=@/path/to/paper.pdf"
```

### 远程 URL 示例

```bash
curl -X POST "http://127.0.0.1:41000/api/v1/ocr/jobs" \
  -H "X-API-Key: your-rust-api-key" \
  -F "provider=mineru" \
  -F "mineru_token=your-mineru-token" \
  -F "timeout_seconds=1800" \
  -F "source_url=https://example.com/paper.pdf"
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
      "self_path": "/api/v1/ocr/jobs/20260331033736-c2bcda",
      "self_url": "http://127.0.0.1:41000/api/v1/ocr/jobs/20260331033736-c2bcda",
      "artifacts_path": "/api/v1/ocr/jobs/20260331033736-c2bcda/artifacts",
      "artifacts_url": "http://127.0.0.1:41000/api/v1/ocr/jobs/20260331033736-c2bcda/artifacts",
      "cancel_path": "/api/v1/ocr/jobs/20260331033736-c2bcda/cancel",
      "cancel_url": "http://127.0.0.1:41000/api/v1/ocr/jobs/20260331033736-c2bcda/cancel"
    }
  }
}
```

### 校验规则

- `provider` 目前只能是 `mineru`
- `mineru_token` 不能为空
- `mineru_token` 不能是 URL
- `source_url` 如果提供，必须以 `http://` 或 `https://` 开头
- `timeout_seconds` 必须大于 `0`

## 5. OCR 任务列表

`GET /api/v1/ocr/jobs`

支持参数：

- `limit`
- `offset`
- `status`
- `provider`

示例：

```bash
curl -H "X-API-Key: your-rust-api-key" \
  "http://127.0.0.1:41000/api/v1/ocr/jobs?limit=20&offset=0&status=failed&provider=mineru"
```

返回示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "job_id": "20260331033736-c2bcda",
        "workflow": "ocr",
        "status": "succeeded",
        "trace_id": "ocr-20260331033736-c2bcda",
        "stage": "finished",
        "created_at": "2026-03-31T03:37:36Z",
        "updated_at": "2026-03-31T03:37:41Z",
        "detail_path": "/api/v1/ocr/jobs/20260331033736-c2bcda",
        "detail_url": "http://127.0.0.1:41000/api/v1/ocr/jobs/20260331033736-c2bcda"
      }
    ]
  }
}
```

## 6. OCR 任务详情

`GET /api/v1/ocr/jobs/{job_id}`

示例：

```bash
curl -H "X-API-Key: your-rust-api-key" \
  "http://127.0.0.1:41000/api/v1/ocr/jobs/20260331033736-c2bcda"
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

## 7. 获取产物索引

`GET /api/v1/ocr/jobs/{job_id}/artifacts`

这个接口是 OCR 微服务最重要的接口之一。

它会返回下游真正关心的产物索引。

返回重点：

- `schema_version`
- `provider_raw_dir`
- `provider_zip`
- `provider_summary_json`
- `normalized_document`
- `normalization_report`

真实示例字段形态：

```json
{
  "schema_version": "document.v1",
  "provider_raw_dir": "output/20260331033736-c2bcda/ocr/unpacked",
  "provider_zip": "output/20260331033736-c2bcda/ocr/mineru_bundle.zip",
  "provider_summary_json": "output/20260331033736-c2bcda/ocr/mineru_result.json",
  "normalized_document": {
    "ready": true,
    "path": "/api/v1/ocr/jobs/20260331033736-c2bcda/normalized-document"
  },
  "normalization_report": {
    "ready": true,
    "path": "/api/v1/ocr/jobs/20260331033736-c2bcda/normalization-report"
  }
}
```

字段语义：

- `provider_raw_dir`
  MinerU 解包后的原始目录
- `provider_zip`
  MinerU 原始 zip
- `provider_summary_json`
  MinerU 原始返回结果
- `normalized_document`
  标准化后的 `document.v1.json`
- `normalization_report`
  标准化报告 `document.v1.report.json`

补充说明：

- `provider_summary_json` / `provider_zip` / `provider_raw_dir` 属于 provider raw artifacts
- `normalized_document` / `normalization_report` 属于 normalized artifacts
- 这两层需要同时保留，前者用于排 OCR provider 问题，后者用于排 `document_schema` 适配问题

## 8. 下载标准化 OCR 结果

### 下载 `document.v1.json`

`GET /api/v1/ocr/jobs/{job_id}/normalized-document`

### 下载 `document.v1.report.json`

`GET /api/v1/ocr/jobs/{job_id}/normalization-report`

用途：

- `document.v1.json` 给翻译主线直接消费
- `document.v1.report.json` 给排错、前端诊断、schema 检查使用

## 9. 取消 OCR 任务

`POST /api/v1/ocr/jobs/{job_id}/cancel`

示例：

```bash
curl -X POST \
  -H "X-API-Key: your-rust-api-key" \
  "http://127.0.0.1:41000/api/v1/ocr/jobs/20260331033736-c2bcda/cancel"
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
- `ocr/unpacked/`：MinerU 解包原始内容
- `ocr/normalized/`：给主链路消费的标准化结果

## 11. 当前限制和边界

当前这套 OCR 微服务接口已经能跑通 `MinerU -> document.v1`。

但要注意：

- 目前 provider 仍然只有 `mineru`
- MinerU 的 submit/poll/download 目前还是通过 Python worker 执行
- Rust 侧现在已经负责：
  - HTTP API
  - 任务状态
  - 分页列表
  - trace_id
  - 取消/超时
  - artifacts 索引
- 后续如果进入下一阶段，会把 MinerU 的真实 HTTP 调用继续迁到 Rust provider client

## 12. 推荐对接方式

如果你后续要让主系统接这套 OCR 微服务，建议固定按这个顺序：

1. `POST /api/v1/ocr/jobs`
2. `GET /api/v1/ocr/jobs/{job_id}`
3. `GET /api/v1/ocr/jobs/{job_id}/artifacts`
4. 下载：
   - `/normalized-document`
   - `/normalization-report`

主系统不要直接读 provider raw JSON。

主系统应该优先消费：

- `document.v1.json`
- `document.v1.report.json`
- `schema_version`
- `trace_id`
- `provider_trace_id`

这样后续替换 OCR provider 时，翻译和渲染主线不需要一起改。
