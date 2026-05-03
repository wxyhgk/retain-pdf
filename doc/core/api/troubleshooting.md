# 错误排查

## 优先看什么

任务失败时按这个顺序排查：

1. `GET /api/v1/jobs/{job_id}`
2. `failure`
3. `failure_diagnostic`
4. `log_tail`
5. `GET /api/v1/jobs/{job_id}/events`
6. `runtime.stage_history`

`failure` 是结构化失败真源；`failure_diagnostic` 是给旧前端和简化展示保留的兼容视图。

## 常用命令

```bash
curl http://127.0.0.1:41000/health

curl -H "X-API-Key: your-key" \
  http://127.0.0.1:41000/api/v1/jobs/{job_id}

curl -H "X-API-Key: your-key" \
  "http://127.0.0.1:41000/api/v1/jobs/{job_id}/events?limit=200"

curl -H "X-API-Key: your-key" \
  http://127.0.0.1:41000/api/v1/jobs/{job_id}/artifacts-manifest
```

## 任务目录

重点看：

- `DATA_ROOT/jobs/{job_id}/logs/pipeline_events.jsonl`
- `DATA_ROOT/jobs/{job_id}/ocr/`
- `DATA_ROOT/jobs/{job_id}/translated/`
- `DATA_ROOT/jobs/{job_id}/rendered/`
- `DATA_ROOT/jobs/{job_id}/artifacts/`

历史任务可能使用 `logs/events.jsonl`。

## 下载按钮不可用

不要只看 `status`。应检查：

- `actions.download_pdf.enabled`
- `actions.open_markdown.enabled`
- `actions.open_markdown_raw.enabled`
- `actions.download_bundle.enabled`
- `artifacts.pdf.ready`
- `artifacts.markdown.ready`
- `artifacts.bundle.ready`
- `artifacts-manifest.items[].ready`

如果 `ready=false` 或 `enabled=false`，不要自行拼接下载链接强行访问。

## Provider 错误

常见原因：

- `mineru_token`、`paddle_token`、`api_key` 缺失或无效。
- PDF 超过上游 Provider 限制。
- 后端宿主机 DNS、代理或网络异常。
- 上游接口短时断连。

优先看：

- `provider_trace_id`
- `failure.provider`
- `failure.root_cause`
- `failure.suggestion`
- `log_tail` 里的 `CAUSE[n]`

## 翻译调试

翻译阶段异常时查看：

- `GET /api/v1/jobs/{job_id}/translation/diagnostics`
- `GET /api/v1/jobs/{job_id}/translation/items`
- `GET /api/v1/jobs/{job_id}/translation/items/{item_id}`
- `POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay`

这些接口面向开发和排障，不建议作为普通用户主流程依赖。

## 常见错误码

- `40000`：请求错误，如字段缺失、JSON 结构不符合契约。
- `40100`：缺少或错误的 `X-API-Key`。
- `40400`：任务、artifact 或资源不存在。
- `40900`：任务状态冲突。
- `50000`：后端内部错误。
