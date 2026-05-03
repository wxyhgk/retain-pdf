# 存储结构

运行时根目录由 `RUST_API_DATA_ROOT` 决定；下文用 `DATA_ROOT` 代指这个解析后的目录。

## 主要路径

- `DATA_ROOT/uploads/`：上传文件。
- `DATA_ROOT/jobs/{job_id}/`：任务工作目录。
- `DATA_ROOT/downloads/`：下载缓存。
- `DATA_ROOT/db/jobs.db`：SQLite 数据库。

## 任务目录

标准任务目录：

```text
jobs/{job_id}/
├── source/
├── ocr/
├── translated/
├── rendered/
├── artifacts/
└── logs/
```

常见产物：

- `ocr/`：Provider 原始结果、解包结果、标准化输入。
- `translated/`：翻译中间产物和 `translation-manifest.json`。
- `rendered/`：渲染输出。
- `artifacts/`：对外发布的稳定产物、诊断文件和索引。
- `logs/pipeline_events.jsonl`：当前事件落盘主文件。

历史兼容：

- 老任务可能只有 `logs/events.jsonl`。
- 当前读取逻辑会优先读取 `pipeline_events.jsonl`，再回退到旧文件名。

## SQLite

SQLite 主要承担：

- `jobs`：任务状态、阶段、错误摘要、日志尾部。
- `events`：结构化事件流。
- `artifacts`：产物索引。

接口返回和数据库记录尽量使用相对路径，运行时再解析到真实文件，避免把机器路径暴露给前端。

## 边界约定

- Rust 负责分配任务目录和登记 artifacts。
- Python worker 只消费 Rust 传入的路径。
- 前端和外部调用方不应该依赖任务目录内部布局。
- 正式产物发现入口是 `GET /api/v1/jobs/{job_id}/artifacts-manifest`。
