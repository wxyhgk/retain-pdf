# 服务总览

内部概览。对外接口用法看 [docs/api/](../../api/README.md)。

## 端口与入口

- `40001`：Docker 交付前端页面。
- `41000`：Rust 完整 API，包含上传、任务、产物、Provider 校验等接口。
- `42000`：第二个端口，只有 `GET /health`、`GET /ready`。
- `GET /health`：健康检查，不需要 `X-API-Key`。
- `/api/v1`：业务 API 前缀，需要 `X-API-Key`。

Docker Web 默认 `FRONT_API_BASE=` 为空，前端走同源 `/api/` 代理到后端；本地开发时前端会回落到当前 host 的 `41000`。

## 主链路

当前异步主链路：

1. `POST /api/v1/uploads` 上传 PDF。
2. `POST /api/v1/jobs` 创建主任务。
3. 没有 `source.artifact_job_id` 时，主任务创建 OCR 子任务 `{job_id}-ocr`；
   指定可复用 OCR 产物时，后端校验通过后直接跳过 OCR。
4. OCR 新产物或复用产物提供标准化 `document.v1` 与布局数据。
5. 根据 workflow 进入翻译和/或渲染。
6. 通过任务详情的 `actions`、`artifacts` 或 `GET /jobs/{job_id}/files` 下载产物。

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
- `ocr`：只做 OCR 和 normalize，不翻译、不渲染。

OCR-only 和其他任务一样走 `POST /api/v1/jobs`：先 `POST /api/v1/uploads` 上传 PDF，再用 `workflow: "ocr"`、`source.upload_id` 建任务（原 `POST /api/v1/ocr/jobs` 已于 2026-10-18 删除）。

## 返回包裹和前端读法

对外的信封、错误码、详情字段、按钮状态怎么读，都在 docs/api：[响应格式](../../api/00-约定/01-响应格式.md)、
[查询任务详情](../../api/01-任务/02-查询任务详情.md)、[下载总览](../../api/07-产物下载/01-下载总览.md)。这里不再重复（2026-11-24）。

## Provider

Docker 交付默认前端 OCR provider 是 `paddle`，但后端同时支持：

- `mineru`
- `paddle`
- `deepseek` 凭证校验

不要在 API 文档里写死某一个 Provider 是唯一主线。
