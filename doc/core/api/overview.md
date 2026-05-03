# 服务总览

## 端口与入口

- `40001`：Docker 交付前端页面。
- `41000`：Rust 完整 API，包含上传、任务、产物、Provider 校验等接口。
- `42000`：简便同步 API，主要提供 `POST /api/v1/translate/bundle`。
- `GET /health`：健康检查，不需要 `X-API-Key`。
- `/api/v1`：业务 API 前缀，需要 `X-API-Key`。

Docker Web 默认 `FRONT_API_BASE=` 为空，前端走同源 `/api/` 代理到后端；本地开发时前端会回落到当前 host 的 `41000`。

## 主链路

当前异步主链路：

1. `POST /api/v1/uploads` 上传 PDF。
2. `POST /api/v1/jobs` 创建主任务。
3. 主任务创建 OCR 子任务 `{job_id}-ocr`。
4. OCR 完成后生成标准化 `document.v1`。
5. 进入翻译和渲染。
6. 通过任务详情、actions、artifacts 或 manifest 下载产物。

正式任务 JSON 只使用分组结构：

- `workflow`
- `source`
- `ocr`
- `translation`
- `render`
- `runtime`

`workflow` 当前支持：

- `book`：OCR -> Normalize -> Translate -> Render。
- `translate`：OCR -> Normalize -> Translate，不进入渲染。
- `render`：基于已有任务 artifact 重跑渲染。

OCR-only 使用独立 multipart 入口 `POST /api/v1/ocr/jobs`。

## 返回包裹

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

错误响应：

```json
{
  "code": 40000,
  "message": "bad request"
}
```

常见错误业务码：

- `40000`：请求错误。
- `40100`：鉴权失败。
- `40400`：资源不存在。
- `40900`：状态冲突。
- `50000`：服务内部错误。

前端会自动 unwrap `{code, message, data}`；新接口文档应继续保持这个包裹格式。

## 前端依赖重点

任务详情页不只依赖 `status`，还会读取：

- `stage` / `stage_detail` / `progress`
- `runtime.current_stage` / `runtime.stage_history`
- `actions.download_pdf` / `actions.open_markdown` / `actions.open_markdown_raw` / `actions.download_bundle` / `actions.cancel`
- `artifacts.pdf` / `artifacts.markdown` / `artifacts.bundle`
- `failure` / `failure_diagnostic` / `log_tail`

下载和按钮状态应以 `actions.*.enabled`、`artifacts.*.ready`、`artifacts-manifest.items[].ready` 为准。

## Provider

Docker 交付默认前端 OCR provider 是 `paddle`，但后端同时支持：

- `mineru`
- `paddle`
- `deepseek` 凭证校验

不要在 API 文档里写死某一个 Provider 是唯一主线。
