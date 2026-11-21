-- 2026-11-21：任务的运行信息拆开（数据库重做第 1b 步，docs/ops/planning/database-redesign/20261120-数据库重做总体设计.md）。
--
-- 以前整块存在 `jobs.runtime_json`。真实库 153 个任务核对过：
-- - 当前阶段、结束原因、最终失败分类和摘要、阶段切换时间、两个耗时，每次写任务前都按任务的别的列重算一遍
--   （`JobRecord::sync_runtime_info`），和 `stage`、状态、`failure_json`、各时间点完全重复 → 不再存，读的时候按同一套规则算；
-- - **阶段历史**（每段的阶段、说明、进出时间、耗时、离开时的进度）：断点续跑表只记大段、时间对不上，进度事件 30 天过期，
--   前端「进度」页每一站的运行时间读的就是它 → 单独一张只追加的表 `job_stage_history`；
-- - 进入当前阶段的时间、最后一次出错的时间、重试次数和最后一次重试的时间：算不出来 → `jobs` 上的普通列。
--
-- 接口返回的 `runtime` 不变（数据库层从这几处拼回 `JobRuntimeInfo`）。升级前照旧自动备份。
CREATE TABLE IF NOT EXISTS job_stage_history (
    job_id TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    stage TEXT NOT NULL,
    detail TEXT,
    enter_at TEXT NOT NULL,
    exit_at TEXT,
    duration_ms INTEGER,
    terminal_status TEXT CHECK (terminal_status IN ('queued', 'running', 'succeeded', 'failed', 'canceled')),
    progress_current INTEGER,
    progress_total INTEGER,
    PRIMARY KEY (job_id, seq)
);

INSERT INTO job_stage_history (
    job_id, seq, stage, detail, enter_at, exit_at, duration_ms, terminal_status, progress_current, progress_total
)
SELECT jobs.job_id, CAST(entry.key AS INTEGER),
       json_extract(entry.value, '$.stage'), json_extract(entry.value, '$.detail'),
       json_extract(entry.value, '$.enter_at'), json_extract(entry.value, '$.exit_at'),
       json_extract(entry.value, '$.duration_ms'), json_extract(entry.value, '$.terminal_status'),
       json_extract(entry.value, '$.progress_current'), json_extract(entry.value, '$.progress_total')
FROM jobs, json_each(jobs.runtime_json, '$.stage_history') AS entry
WHERE json_valid(jobs.runtime_json) AND json_type(jobs.runtime_json, '$.stage_history') = 'array';

ALTER TABLE jobs ADD COLUMN stage_entered_at TEXT;
ALTER TABLE jobs ADD COLUMN last_error_at TEXT;
ALTER TABLE jobs ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN last_retry_at TEXT;
UPDATE jobs SET
    stage_entered_at = json_extract(runtime_json, '$.stage_started_at'),
    last_error_at = json_extract(runtime_json, '$.last_error_at'),
    retry_count = COALESCE(json_extract(runtime_json, '$.retry_count'), 0),
    last_retry_at = json_extract(runtime_json, '$.last_retry_at')
WHERE json_valid(runtime_json);
ALTER TABLE jobs DROP COLUMN runtime_json;

-- 同步：阶段历史属于任务这一种实体（和产物登记一样），改了就把任务记成待发。
CREATE TRIGGER IF NOT EXISTS sync_dirty_job_stage_history_insert AFTER INSERT ON job_stage_history
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER IF NOT EXISTS sync_dirty_job_stage_history_update AFTER UPDATE ON job_stage_history
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER IF NOT EXISTS sync_dirty_job_stage_history_delete AFTER DELETE ON job_stage_history
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', OLD.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
