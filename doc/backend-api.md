# 后端 API 文档

本文档描述当前后端服务的实际接口契约，面向三类使用者：

- 前端接入方
- 本地部署与运维人员
- 需要排查任务失败原因的开发者

相关文档：

- [前端请求示例](/home/wxyhgk/tmp/Code/backend/rust_api/frontend_request_example.md)
- [OCR-only 服务文档](/home/wxyhgk/tmp/Code/backend/rust_api/MinerU_OCR_Service_API.md)
- [API 总入口](/home/wxyhgk/tmp/Code/doc/API.md)

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

当前 canonical JSON 请求体是分组结构，不再接受旧的扁平 JSON：

```json
{
  "workflow": "mineru",
  "source": {
    "upload_id": "20260402073151-a80618"
  },
  "ocr": {
    "provider": "mineru",
    "mineru_token": "mineru-xxxx",
    "page_ranges": ""
  },
  "translation": {
    "mode": "sci",
    "model": "deepseek-chat",
    "base_url": "https://api.deepseek.com/v1",
    "api_key": "sk-xxxx",
    "skip_title_translation": false,
    "batch_size": 1,
    "workers": 50,
    "rule_profile_name": "general_sci",
    "custom_rules_text": "",
    "glossary_id": "",
    "glossary_entries": []
  },
  "render": {
    "render_mode": "auto",
    "compile_workers": 8
  },
  "runtime": {
    "job_id": "",
    "timeout_seconds": 1800
  }
}
```

当前支持的 `workflow`：

- `mineru`：完整链路，OCR -> Normalize -> Translate -> Render
- `translate`：OCR -> Normalize -> Translate，不进入渲染
- `render`：基于已有 job artifacts 重跑渲染

接口边界：

- `POST /api/v1/jobs` 面向 `mineru` / `translate` / `render`
- `workflow=ocr` 使用独立入口 `POST /api/v1/ocr/jobs`

不同 workflow 的 `source` 约定：

- `mineru` / `translate`：通常使用 `source.upload_id`
- `render`：使用 `source.artifact_job_id`

当前强制字段按 workflow 和 provider 决定，常见要求：

- `mineru` / `translate` 走 MinerU 时，需要 `ocr.mineru_token`
- 需要大模型翻译时，需要 `translation.base_url`、`translation.api_key`、`translation.model`
- `render` workflow 不要求 OCR 或翻译凭据

常用翻译控制字段：

- `translation.skip_title_translation=false`：翻译标题
- `translation.skip_title_translation=true`：跳过标题翻译，保留原文标题

当前校验规则：

- `translation.base_url` 必须以 `http://` 或 `https://` 开头
- `translation.api_key` 不能看起来像 URL
- 当 workflow / provider 走 MinerU 时，会额外校验 `200MB / 600 页` 限制

术语表 v1 约定：

- `translation.glossary_id`：可选，引用后端里已保存的命名术语表
- `translation.glossary_entries`：可选，直接随任务提交的术语条目数组，元素结构是 `{source, target, note}`
- 如果两者同时传，后端会先加载命名术语表，再用 inline 术语按 `source` 归一化覆盖
- v1 只做提示词注入和结果记录，不做翻译后的强制替换
- 前端如果让用户上传 Excel，应先在前端解析成 JSON，再传给后端；后端只接受 JSON 条目，或通过下面的 CSV 解析辅助接口接收 `csv_text`
- 翻译完成后，`translation-manifest.json`、诊断文件和 pipeline summary 会附带术语表命中摘要

兼容性说明：

- `POST /api/v1/jobs` 的 JSON 入口只接受分组结构
- 历史扁平字段只保留在少数 `multipart/form-data` 辅助入口的表单映射里，不再视为正式 JSON 契约

### 5.2.1 术语表资源接口

命名术语表接口：

- `POST /api/v1/glossaries`
- `GET /api/v1/glossaries`
- `GET /api/v1/glossaries/{glossary_id}`
- `PUT /api/v1/glossaries/{glossary_id}`
- `DELETE /api/v1/glossaries/{glossary_id}`
- `POST /api/v1/glossaries/parse-csv`

创建或更新请求体：

```json
{
  "name": "semiconductor",
  "entries": [
    {"source": "band gap", "target": "带隙", "note": "materials"},
    {"source": "density of states", "target": "态密度", "note": ""}
  ]
}
```

返回字段：

- `glossary_id`
- `name`
- `entry_count`
- `entries`
- `created_at`
- `updated_at`

CSV 解析辅助接口请求体：

```json
{
  "csv_text": "source,target,note\nband gap,带隙,materials\n"
}
```

这个接口只负责把 CSV 文本解析成标准 JSON 条目，不负责直接接收 Excel 文件。

### 5.3 查询任务详情

`GET /api/v1/jobs/{job_id}`

这是前端轮询的主接口。重点字段：

- `status`
- `stage`
- `stage_detail`
- `progress`
- `timestamps`
- `request_payload`
- `actions`
- `artifacts`
- `glossary_summary`
- `ocr_job`
- `runtime`
- `failure`
- `error`
- `failure_diagnostic`
- `normalization_summary`
- `log_tail`

说明：

- 前端应以 `status` 判断任务是否结束
- 前端应以 `actions.*.enabled` 和 `artifacts.*.ready` 判断下载按钮是否可用
- `failure` 是结构化失败信息真源，`failure_diagnostic` 是兼容旧前端的简化视图
- `runtime.stage_history` 回答“任务阶段如何演进、每阶段花了多久”
- 不要用进度百分比推断任务已经完成

### 5.4 查询任务列表

`GET /api/v1/jobs`

适合列表页。每项返回：

- `job_id`
- `display_name`
- `workflow`
- `status`
- `trace_id`
- `stage`
- `created_at`
- `updated_at`
- `detail_path`
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

事件契约：

- 结果按 `seq` 升序返回
- `seq` 是同一任务内的单调递增序号
- `stage` 表示事件发生时的当前阶段
- `/events` 是排障时的追加型事件真源
- `runtime.stage_history` 是详情页里的阶段时间线真源

事件流也会落盘到：

- `DATA_ROOT/jobs/{job_id}/logs/events.jsonl`

### 5.6 查询产物清单

`GET /api/v1/jobs/{job_id}/artifacts-manifest`

这个接口是正式的产物发现入口。每个条目至少包含：

- `artifact_key`
- `artifact_group`
- `artifact_kind`
- `ready`
- `content_type`
- `relative_path`
- `source_stage`
- `resource_path`
- `resource_url`

前端或脚本应优先：

1. 查询 `artifacts-manifest`
2. 找目标 `artifact_key`
3. 判断 `ready`
4. 再使用 `resource_path` / `resource_url`

其中：

- `artifacts` 详情块适合页面直接判断按钮状态
- `artifacts-manifest` 适合做完整的机器发现和下载映射

### 5.7 下载产物

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

补充：

- `artifacts.pdf` / `artifacts.markdown` / `artifacts.bundle` 这些嵌套对象是当前推荐读取字段
- 同级的 `pdf_url` / `markdown_url` / `bundle_url` 等字段保留为兼容别名，语义上更接近 path alias，不建议作为新前端主读取字段

如果 `ready=false` 或 `enabled=false`，不要自行拼接下载链接强行访问。

### 5.8 取消任务

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
- `GET /api/v1/ocr/jobs/{job_id}/artifacts-manifest`
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

- `failure.stage`：结构化失败阶段
- `failure.category`：结构化失败分类
- `failure.summary`：结构化失败摘要
- `failure.retryable`：是否建议重试
- `failure.root_cause`：识别出的根因
- `failure.suggestion`：建议动作
- `failure_diagnostic.failed_stage`：兼容旧前端的失败阶段字段
- `failure_diagnostic.error_kind`：兼容旧前端的失败类型字段
- `error`：原始错误摘要
- `log_tail`：最近日志尾部

当前已重点覆盖的错误类型包括：

- 鉴权错误：如 `missing or invalid X-API-Key`
- 配置错误：如缺少 `mineru_token`、`api_key`、`model`
- 网络错误：如 DNS 解析失败、远端断连、请求超时
- OCR provider transport 错误：申请上传地址失败、轮询失败、下载 bundle 失败
- Python worker 错误：标准化、翻译、渲染阶段异常

前端建议：

- 失败时先展示 `failure.summary`
- 再展示 `failure.suggestion`
- 如果前端还没切到新字段，可继续读 `failure_diagnostic.summary`
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
