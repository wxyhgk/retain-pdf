# 错误排查

更细的任务详情、事件流、失败协议和阶段时间线，请优先看 [Rust API 说明](../rust_api/README.md)。

## 优先看什么

任务失败时按这个顺序排查：

1. `GET /api/v1/jobs/{job_id}`
2. `failure`
3. `failure_diagnostic`
4. `log_tail`
5. `GET /api/v1/jobs/{job_id}/progress/events`
6. `runtime.stage_history`

`failure` 是结构化失败真源；`failure_diagnostic` 是给旧前端和简化展示保留的兼容视图。

## 常用命令

```bash
curl http://127.0.0.1:41000/health

curl -H "X-API-Key: your-key" \
  http://127.0.0.1:41000/api/v1/jobs/{job_id}

curl -H "X-API-Key: your-key" \
  "http://127.0.0.1:41000/api/v1/jobs/{job_id}/progress/events?limit=200"

curl -H "X-API-Key: your-key" \
  http://127.0.0.1:41000/api/v1/jobs/{job_id}/files
```

## 任务目录

重点看：

- `DATA_ROOT/jobs/{job_id}/logs/pipeline_events.jsonl`
- `DATA_ROOT/jobs/{job_id}/ocr/`
- `DATA_ROOT/jobs/{job_id}/translated/`
- `DATA_ROOT/jobs/{job_id}/rendered/`
- `DATA_ROOT/jobs/{job_id}/artifacts/`

历史任务可能使用 `logs/events.jsonl`。

## 后端一启动就退出：「另一个任务运行时正在使用任务库」

同一个任务库（默认 `DATA_ROOT/db/jobs.db`）同一时刻只能有一个任务运行时：进程内模式的 rust_api，或者 retain-jobsd。
第二个进程拿不到 `jobs.db.runtime-owner.lock` 的锁就直接退出，不做启动对账——对账会把第一个进程正在跑的 worker 当成孤儿杀掉。
常见原因是另一个 worktree 或另一个端口上的开发后端指向了同一个 `data/`。先停掉那个进程，或者给这个实例换一个
`RUST_API_DATA_ROOT`。锁随进程退出自动释放，不需要手动删锁文件。

## 对上某个请求的后端日志

2026-10-24 起每个回应都带 `X-Request-ID`（浏览器开发者工具的网络面板里能看到）。后端日志里请求期间打的每一行都带着
`request{method=… path=… request_id=…}`，用编号搜就能找到那个请求；路径不带查询串。
跑任务的日志带 `job{job_id=…}`。

- 拿到回应头超过 1 秒的请求记一条 info：`slow request`（`status`、`latency_ms`），日志目标是 `retainpdf_api::access`。
- 每个请求都记一条的完整访问日志默认关着：在默认的 `RUST_LOG`（见 `backend/api/src/main.rs` 的 `DEFAULT_LOG_FILTER`）后面加
  `,retainpdf_api::access=debug`。
- 5xx 照旧由 `tower_http` 记 error。
- 没有 Prometheus 这类指标接口（单机桌面版用不上）；`GET /health` 有运行时、磁盘、子服务的状态。

## 机器上设了 HTTP_PROXY / ALL_PROXY

后端连本机的几个服务都不走系统代理：rust_api 转给 retain-jobsd 的发射、取消、终止，探测 jobsd 是否活着，
`retainpdf` 命令行连后端。所以设了代理、`NO_PROXY` 里没写 `127.0.0.1` 也不影响它们。

连 jobsd 的请求连接最多等 2 秒、整个请求最多 10 秒（终止进程树再加 `RUST_API_WORKER_TERMINATE_GRACE_SECS`）。
jobsd 卡住时取消、强删会在这之后报错或打警告，不会一直挂着；任务最后的状态照旧以库里的为准。

## 下载按钮不可用

不要只看 `status`。应检查：

- `actions.download_pdf.enabled`
- `actions.open_markdown.enabled`
- `actions.open_markdown_raw.enabled`
- `actions.download_bundle.enabled`
- `artifacts.pdf.ready`
- `artifacts.markdown.ready`
- `artifacts.bundle.ready`
- `GET /jobs/{job_id}/files` 里每一项的 `ready`

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

- `GET /api/v1/jobs/{job_id}/reports/translation`
- `GET /api/v1/jobs/{job_id}/translations`
- `GET /api/v1/jobs/{job_id}/translations/{item_id}`
- `POST /api/v1/jobs/{job_id}/translations/{item_id}/replay`

这些接口面向开发和排障，不建议作为普通用户主流程依赖。

## 常见错误码

- `40000`：请求错误，如字段缺失、JSON 结构不符合契约。
- `40100`：缺少或错误的 `X-API-Key`。
- `40400`：任务、artifact 或资源不存在。
- `40900`：任务状态冲突。
- `50000`：后端内部错误。响应只带编号（`error.details.error_id`），到后端日志里搜 `error_id=<编号>` 看完整原因。
