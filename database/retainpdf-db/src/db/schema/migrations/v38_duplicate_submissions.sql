-- 2026-11-24：防重复提交（docs/ops/planning/api-reorg/20261124-防重复提交.md）。
--
-- 1. job_derivations：续跑、重试阶段从一个源任务派生出的新任务记一行（新任务编号 → 源任务编号）。
--    派生新任务落库时，和「这个源任务有没有排队中 / 运行中的派生任务」在同一个 BEGIN IMMEDIATE 事务里查和写：
--    有就不建（409 derived_job_active），两个请求同时来也只建成一个。新任务删了这一行跟着删。
--    不回填老任务（升级前建的派生任务查不到，只影响升级那一刻还在跑的几个）；不同步（各设备自己判断）。
-- 2. idempotency_keys：带 Idempotency-Key 请求头的建任务请求，按（用户，方法 + 路由模板，key）记一行。
--    先占位（processing），成功（2xx）存下状态码和响应体（completed），失败删掉占位。保留 24 小时，过期的
--    查的时候顺手删、定期清理也删。不同步、不进备份比对（只是短期的重放缓存）。
CREATE TABLE IF NOT EXISTS job_derivations (
    job_id TEXT PRIMARY KEY REFERENCES jobs(job_id) ON DELETE CASCADE,
    source_job_id TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_derivations_source ON job_derivations(source_job_id);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    owner_user_id TEXT NOT NULL,
    -- 方法 + 路由模板，例如 `POST /api/v1/jobs/:job_id/actions/resume`
    route TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    -- 请求指纹：方法、实际路径（含查询串）、请求体的 sha256（十六进制）
    request_method TEXT NOT NULL,
    request_path TEXT NOT NULL,
    request_body_sha256 TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('processing', 'completed')),
    response_status INTEGER,
    response_content_type TEXT,
    response_body BLOB,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    -- 过期时间（UTC，`YYYY-MM-DDTHH:MM:SS.mmmZ`，按字符串比较）
    expires_at TEXT NOT NULL,
    PRIMARY KEY (owner_user_id, route, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires ON idempotency_keys(expires_at);
