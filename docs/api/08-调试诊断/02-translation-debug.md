# Translation Debug API

这些接口用于排查翻译缺失、错误输出、模型异常和 replay。

## Diagnostics

```http
GET /api/v1/jobs/{job_id}/translation/diagnostics
```

读取 `artifacts/translation_diagnostics.json`，返回翻译运行统计、provider 统计、重试统计等信息。

## Item 列表

```http
GET /api/v1/jobs/{job_id}/translation/items
```

常用查询参数：

- `page`
- `final_status`
- `error_type`
- `route`
- `q`
- `limit`
- `offset`

优先读取 `translation_debug_index.json`；缺失时可从 translation manifest 回退构造索引。

## 单 item

```http
GET /api/v1/jobs/{job_id}/translation/items/{item_id}
```

从 translation manifest 指向的 page payload 里查原始 item。

## Replay

```http
POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay
```

Replay 是一次即时调试调用：

- 不创建新 job。
- 不进入队列。
- 不修改原任务状态。
- 后端同步调用 `backend/pipeline/devtools/replay_translation_item.py`。
- 可使用当前 job 的翻译 API key。

## 脱敏规则

debug/replay 返回前会对 job request 里的敏感值脱敏。前端不要假设能拿到原始 API key 或 provider token。
