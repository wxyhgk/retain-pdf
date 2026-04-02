# Rust API 接口文档

本文档描述当前后端服务的实际接口契约，面向三类使用者：

- 前端接入方
- 本地部署与运维人员
- 需要排查任务失败原因的开发者

相关文档：

- [前端请求示例](/home/wxyhgk/tmp/Code/backend/rust_api/frontend_request_example.md)
- [OCR-only 服务文档](/home/wxyhgk/tmp/Code/backend/rust_api/MinerU_OCR_Service_API.md)
- [拆分版文档目录](/home/wxyhgk/tmp/Code/doc/API.md)

## 1. 服务概览

当前后端分为两层：

- Rust：对外 HTTP API、鉴权、任务排队、任务状态落库、OCR provider transport
- Python：OCR 标准化、翻译、渲染、PDF 产物生成

主任务链路：

1. 上传 PDF
2. 创建主任务 `POST /api/v1/jobs`
3. 主任务内部创建 OCR 子任务 `{job_id}-ocr`
4. OCR 子任务完成后产出标准化 `document.v1.json`
5. 主任务继续翻译和渲染
6. 下载 PDF / Markdown / ZIP

默认端口：

- `41000`：完整 API
- `42000`：简便同步接口

基础路径：

- 健康检查：`GET /health`
- 业务前缀：`/api/v1`

## 2. 鉴权与配置

除 `GET /health` 外，其余接口默认都要求：

```http
X-API-Key: your-rust-api-key
```

注意区分两类密钥：

- `X-API-Key`：访问 Rust API 自身
- 请求体里的 `api_key`：访问下游模型服务

本地推荐配置文件：

- `backend/rust_api/auth.local.json`

示例：

```json
{
  "api_keys": ["replace-with-your-backend-key"],
  "max_running_jobs": 4,
  "simple_port": 42000
}
```

常用环境变量：

- `RUST_API_BIND_HOST`：监听地址，默认 `0.0.0.0`
- `RUST_API_PORT`：完整 API 端口，默认 `41000`
- `RUST_API_SIMPLE_PORT`：简便同步接口端口，默认 `42000`
- `RUST_API_KEYS`：后端允许的 API key 列表，逗号分隔
- `RUST_API_MAX_RUNNING_JOBS`：同时运行任务数，默认 `4`
- `RUST_API_DATA_ROOT`：数据根目录
- `PYTHON_BIN`：Python 可执行文件，默认 `python`

配置优先级：

1. 代码默认值
2. 本地配置文件
3. 环境变量
4. 启动参数
5. 请求体白名单业务参数

请求体不能覆盖路径、端口、数据根目录等基础设施配置。

## 3. 存储约定

当前运行时以 `DATA_ROOT` 作为唯一数据根目录。默认是仓库下的 `data/`。

主要目录：

- `DATA_ROOT/uploads/`：上传文件
- `DATA_ROOT/jobs/{job_id}/`：任务工作目录
- `DATA_ROOT/downloads/`：下载缓存
- `DATA_ROOT/db/jobs.db`：SQLite

任务目录标准结构：

- `source/`
- `ocr/`
- `translated/`
- `rendered/`
- `artifacts/`
- `logs/`

数据库内部已拆分为：

- `jobs`：任务元信息、状态、错误、日志尾部
- `artifacts`：产物索引
- `events`：结构化事件流

数据库与接口返回以相对路径为主，运行时再解析到真实文件。

## 4. 统一响应格式

成功：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

失败：

```json
{
  "code": 400,
  "message": "具体错误信息"
}
```

约定：

- `code = 0` 表示成功
- `message` 适合直接展示给前端用户
- 业务详情在 `data`

## 5. 主流程接口

### 5.1 上传 PDF

`POST /api/v1/uploads`

`multipart/form-data` 字段：

- `file`：必填，PDF 文件
- `developer_mode`：可选，`true/false`

成功示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "upload_id": "20260402073151-a80618",
    "filename": "paper.pdf",
    "bytes": 1832451,
    "page_count": 18,
    "uploaded_at": "2026-04-02T07:31:55+08:00"
  }
}
```

当前上传限制：

- 普通模式：默认仅支持 `10MB` 以内、`30` 页以内
- `developer_mode=true`：跳过普通模式限制
- MinerU provider 的硬限制仍然是：小于 `200MB` 且不超过 `600` 页

### 5.2 创建主任务

`POST /api/v1/jobs`

最常用请求体：

```json
{
  "workflow": "mineru",
  "upload_id": "20260402073151-a80618",
  "mode": "sci",
  "render_mode": "auto",
  "model": "deepseek-chat",
  "base_url": "https://api.deepseek.com/v1",
  "api_key": "sk-xxxx",
  "mineru_token": "mineru-xxxx",
  "batch_size": 1,
  "workers": 50,
  "compile_workers": 8,
  "rule_profile_name": "general_sci",
  "custom_rules_text": "",
  "page_ranges": ""
}
```

当前强制字段：

- `upload_id`
- `mineru_token`
- `base_url`
- `api_key`
- `model`

当前校验规则：

- `base_url` 必须以 `http://` 或 `https://` 开头
- `api_key` 不能看起来像 URL
- 当 workflow / provider 走 MinerU 时，会额外校验 `200MB / 600 页` 限制

### 5.3 查询任务详情

`GET /api/v1/jobs/{job_id}`

这是前端轮询的主接口。重点字段：

- `status`
- `stage`
- `stage_detail`
- `progress`
- `timestamps`
- `actions`
- `artifacts`
- `ocr_job`
- `error`
- `failure_diagnostic`
- `normalization_summary`
- `log_tail`

说明：

- 前端应以 `status` 判断任务是否结束
- 前端应以 `actions.*.enabled` 和 `artifacts.*.ready` 判断下载按钮是否可用
- 不要用进度百分比推断任务已经完成

### 5.4 查询任务列表

`GET /api/v1/jobs`

适合列表页。每项返回：

- `job_id`
- `workflow`
- `status`
- `stage`
- `created_at`
- `updated_at`
- `detail_url`

### 5.5 查询事件流

`GET /api/v1/jobs/{job_id}/events`

查询参数：

- `limit`
- `offset`

每条事件包含：

- `job_id`
- `seq`
- `ts`
- `level`
- `stage`
- `event`
- `message`
- `payload`

事件流也会落盘到：

- `DATA_ROOT/jobs/{job_id}/logs/events.jsonl`

### 5.6 下载产物

主任务下载接口：

- `GET /api/v1/jobs/{job_id}/pdf`
- `GET /api/v1/jobs/{job_id}/markdown`
- `GET /api/v1/jobs/{job_id}/markdown?raw=true`
- `GET /api/v1/jobs/{job_id}/markdown/images/*path`
- `GET /api/v1/jobs/{job_id}/download`
- `GET /api/v1/jobs/{job_id}/normalized-document`
- `GET /api/v1/jobs/{job_id}/normalization-report`

前端应优先读取任务详情里的返回值：

- `actions.download_pdf`
- `actions.open_markdown`
- `actions.open_markdown_raw`
- `actions.download_bundle`
- `artifacts.pdf`
- `artifacts.markdown`
- `artifacts.bundle`

如果 `ready=false` 或 `enabled=false`，不要自行拼接下载链接强行访问。

### 5.7 取消任务

`POST /api/v1/jobs/{job_id}/cancel`

当前语义：

- 已排队任务会被标记取消
- 运行中任务会进入取消流程
- 已完成任务不会被回滚

## 6. OCR-only 接口

适合只做 OCR，不做翻译与渲染：

- `POST /api/v1/ocr/jobs`
- `GET /api/v1/ocr/jobs`
- `GET /api/v1/ocr/jobs/{job_id}`
- `GET /api/v1/ocr/jobs/{job_id}/events`
- `GET /api/v1/ocr/jobs/{job_id}/artifacts`
- `GET /api/v1/ocr/jobs/{job_id}/normalized-document`
- `GET /api/v1/ocr/jobs/{job_id}/normalization-report`
- `POST /api/v1/ocr/jobs/{job_id}/cancel`

主任务详情中的 `ocr_job` 字段会给出 OCR 子任务摘要：

- `job_id`
- `status`
- `trace_id`
- `provider_trace_id`
- `detail_url`

## 7. 简便同步接口

`POST http://host:42000/api/v1/translate/bundle`

用途：

- 一次请求直接上传 PDF 并等待结果
- 返回最终 ZIP 或超时错误

适合：

- 内部工具
- 小型脚本
- 不想自己管理上传 + 轮询 + 下载三段式流程的调用方

不适合：

- 需要实时进度展示的前端页面
- 需要精细排错的场景

## 8. 状态与阶段

`status` 当前可能值：

- `queued`
- `running`
- `succeeded`
- `failed`
- `canceled`

主任务常见 `stage`：

- `queued`
- `ocr_submitting`
- `mineru_upload`
- `mineru_processing`
- `translation_prepare`
- `normalizing`
- `domain_inference`
- `continuation_review`
- `page_policies`
- `translating`
- `rendering`
- `saving`
- `finished`
- `failed`
- `canceled`

`stage_detail` 是当前最推荐展示给用户的阶段说明，粒度比 `stage` 更细。

## 9. 失败诊断

`GET /api/v1/jobs/{job_id}` 在失败时通常会返回：

- `error`：原始错误摘要
- `failure_diagnostic.stage`：失败阶段
- `failure_diagnostic.type`：归类后的错误类型
- `failure_diagnostic.summary`：简短摘要
- `failure_diagnostic.retryable`：是否建议重试
- `failure_diagnostic.root_cause`：识别出的根因
- `failure_diagnostic.suggestion`：建议动作
- `log_tail`：最近日志尾部

当前已重点覆盖的错误类型包括：

- 鉴权错误：如 `missing or invalid X-API-Key`
- 配置错误：如缺少 `mineru_token`、`api_key`、`model`
- 网络错误：如 DNS 解析失败、远端断连、请求超时
- OCR provider transport 错误：申请上传地址失败、轮询失败、下载 bundle 失败
- Python worker 错误：标准化、翻译、渲染阶段异常

前端建议：

- 失败时先展示 `failure_diagnostic.summary`
- 再展示 `suggestion`
- 开发模式下附带 `log_tail`

## 10. 常见排查点

### 10.1 任务失败但前端只显示“任务失败”

优先看：

1. `GET /api/v1/jobs/{job_id}`
2. `failure_diagnostic`
3. `log_tail`
4. `GET /api/v1/jobs/{job_id}/events`

### 10.2 下载按钮不可用

先确认：

- `status` 是否已结束
- `actions.*.enabled` 是否为 `true`
- `artifacts.*.ready` 是否为 `true`

不要只因为状态是 `running` 就猜测文件已经存在。

### 10.3 MinerU 相关失败

常见原因：

- `mineru_token` 缺失或过期
- 上传 PDF 超过 MinerU 限制
- DNS 或代理环境异常
- 远端接口短时断连或 CDN 拉取失败

### 10.4 DNS / 网络异常

典型报错包括：

- `Temporary failure in name resolution`
- `Server disconnected without sending a response`
- `Failed to fetch`

这类问题通常不在前端，而在后端宿主机网络、代理或 DNS 配置。

## 11. 接入建议

前端最稳妥的调用方式：

1. `POST /api/v1/uploads`
2. `POST /api/v1/jobs`
3. 轮询 `GET /api/v1/jobs/{job_id}`
4. 成功后读取 `actions` / `artifacts` 再下载
5. 失败时展示 `failure_diagnostic` 和 `log_tail`

如果你只需要一个最小实现，直接参考：

- [frontend_request_example.md](/home/wxyhgk/tmp/Code/backend/rust_api/frontend_request_example.md)
