# 错误排查

## 1. 优先查看的字段

排查任务失败时，优先看：

1. `stage`
2. `stage_detail`
3. `error`
4. `failure_diagnostic`
5. `log_tail`
6. `/api/v1/jobs/{job_id}/events`

## 2. 当前错误保留能力

后端已经增强了 OCR provider 失败时的错误保留：

- `jobs.error` 会保存完整 error chain
- `log_tail` 会写入 `ERROR:` 和 `CAUSE[n]:`
- 如果能识别，会保留 provider 的 `trace_id`

例如以前只会看到：

```text
MinerU apply upload url failed
```

现在会尽量保留成：

```text
MinerU apply upload url failed
Caused by:
- POST https://mineru.net/api/v4/file-urls/batch failed
- ...
```

## 3. 常见排查路径

### 3.1 先看接口

```bash
curl http://127.0.0.1:41000/health
curl -H "X-API-Key: your-key" http://127.0.0.1:41000/api/v1/jobs/{job_id}
curl -H "X-API-Key: your-key" http://127.0.0.1:41000/api/v1/jobs/{job_id}/events
```

### 3.2 再看任务目录

重点目录：

- `data/jobs/{job_id}/logs/`
- `data/jobs/{job_id}/ocr/`
- `data/jobs/{job_id}/translated/`
- `data/jobs/{job_id}/rendered/`

### 3.3 MinerU 类错误

如果失败发生在 OCR transport：

- 看 `provider_trace_id`
- 看 `failure_diagnostic`
- 看 `log_tail` 里的 `CAUSE[n]`
- 必要时对照 MinerU 上游接口返回
