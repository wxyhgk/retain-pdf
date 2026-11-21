-- 2026-11-21：进度流不再复制一份事件内容（数据库重做第 3 步，docs/ops/planning/database-redesign/20261120-数据库重做总体设计.md
-- 「要定的」第 1 条选 A）。
--
-- 进度流（event_feed_items）是给前端进度页的读模型：把任务自己、OCR 子任务的事件和任务目录里的 pipeline_events.jsonl
-- 合在一起、排好序、脱敏、整理成统一的样子，带稳定的位置和游标。以前每条都把整理好的内容存一份（真实库 12.5 万条、
-- 约 120MB，单条约是原始事件的 3–4 倍），而 99% 的条目来自 events 表，内容可以随时从那条原始事件按同一套规则算出来。
--
-- 现在：
-- - 来自 events 的条目只存「它是哪条原始事件」（source_event_uid），内容读的时候现算（任务包 progress/event_feed）；
-- - 来自 jsonl 文件的条目照旧存内容（很少，文件也可能被改写）；
-- - 首次建流时排序要用的 raw.source_seq 单独成列（以前从内容里取）。
-- 原始事件按保留期过期时，events_source_versions 的 revision 会变，进度流随之重建，不会留下指向已删事件的条目。
-- 位置（seq）、event_id、游标都不变，前端无感。升级前照旧自动备份；腾出来的空间（真实库约 200MB）在迁移提交以后
-- 当场还给磁盘（`run_versioned_migrations` 跑过迁移就做一次增量收缩；同一个事务里删表腾出的页还收不回来）。
CREATE TABLE event_feed_items_v35 (
    owner_job_id TEXT NOT NULL REFERENCES event_feeds(owner_job_id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    source_key TEXT NOT NULL,
    event_id TEXT NOT NULL,
    ts TEXT NOT NULL,
    source_seq INTEGER,
    source_event_uid TEXT,
    payload_json TEXT,
    PRIMARY KEY (owner_job_id, seq),
    UNIQUE (owner_job_id, event_id),
    UNIQUE (owner_job_id, source_key),
    CHECK (payload_json IS NOT NULL OR source_event_uid IS NOT NULL)
);

INSERT INTO event_feed_items_v35
    (owner_job_id, seq, source_key, event_id, ts, source_seq, source_event_uid, payload_json)
SELECT owner_job_id, seq, source_key, event_id, ts,
       CASE WHEN json_valid(payload_json) THEN json_extract(payload_json, '$.raw.source_seq') END,
       -- source_key 是 db:<来源任务>:<事件 uid>（任务编号里没有冒号）
       CASE WHEN source_key LIKE 'db:%' THEN substr(source_key, instr(substr(source_key, 4), ':') + 4) END,
       CASE WHEN source_key LIKE 'db:%' THEN NULL ELSE payload_json END
FROM event_feed_items;

DROP TABLE event_feed_items;
ALTER TABLE event_feed_items_v35 RENAME TO event_feed_items;
