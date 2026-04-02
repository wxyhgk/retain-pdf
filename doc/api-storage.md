# 存储结构

当前统一使用 `DATA_ROOT` 作为运行时根目录。

## 1. 主要路径

- `DATA_ROOT/uploads/`：上传文件
- `DATA_ROOT/jobs/{job_id}/`：单任务工作目录
- `DATA_ROOT/downloads/`：下载缓存
- `DATA_ROOT/db/jobs.db`：SQLite

## 2. 任务目录结构

```text
jobs/{job_id}/
├── source/
├── ocr/
├── translated/
├── rendered/
├── artifacts/
└── logs/
```

## 3. 事件文件

任务事件会同时写入：

- `DATA_ROOT/jobs/{job_id}/logs/events.jsonl`

## 4. 当前设计约定

- `DATA_ROOT` 是唯一运行时存储根
- Rust 负责分配任务目录
- Python worker 只消费 Rust 传入的路径
- SQLite 当前承担 `jobs / events / artifacts` 三类持久化信息
