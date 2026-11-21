-- 2026-11-21：任务的状态、流程改存纯文本，加父任务列（数据库重做第 1a 步，
-- docs/ops/planning/database-redesign/20261120-数据库重做总体设计.md）。
--
-- - `status_json`（存的是 JSON 字符串 `"succeeded"`）换成 `status`（纯文本 `succeeded`），取值用 CHECK 钉住；
-- - `workflow` 原地换成纯文本（`"book"` → `book`），同样 CHECK；
-- - 加 `parent_job_id`：book/translate 任务的 OCR 子任务（编号 `{父任务}-ocr`）指向父任务。以前只能靠编号拼，
--   现在由数据库层在写任务时填（父任务在才填）。父任务删掉时置空（删除流程自己会先删子任务，行为不变）。
--
-- SQLite 不能原地改列的取值和约束：加新列 → 搬值 → 删旧列。用到 `status_json` 的两个扣页数触发器先删、最后按新列重建
-- （多用户冻结，触发器的行为照旧）。老库里不认识的取值会让 CHECK 失败、整个迁移回滚，升级前照旧自动备份。
DROP TRIGGER IF EXISTS jobs_page_charge_refund;
DROP TRIGGER IF EXISTS jobs_page_charge_settle;

ALTER TABLE jobs ADD COLUMN status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'canceled'));
UPDATE jobs SET status = CASE
    WHEN json_valid(status_json) AND json_type(status_json) = 'text' THEN json_extract(status_json, '$')
    ELSE status_json
END;
ALTER TABLE jobs DROP COLUMN status_json;

ALTER TABLE jobs RENAME COLUMN workflow TO workflow_json;
ALTER TABLE jobs ADD COLUMN workflow TEXT NOT NULL DEFAULT 'book'
    CHECK (workflow IN ('book', 'ocr', 'translate', 'render'));
UPDATE jobs SET workflow = CASE
    WHEN json_valid(workflow_json) AND json_type(workflow_json) = 'text' THEN json_extract(workflow_json, '$')
    ELSE workflow_json
END;
ALTER TABLE jobs DROP COLUMN workflow_json;

ALTER TABLE jobs ADD COLUMN parent_job_id TEXT REFERENCES jobs(job_id) ON DELETE SET NULL;
UPDATE jobs SET parent_job_id = substr(job_id, 1, length(job_id) - 4)
WHERE job_id LIKE '%-ocr'
  AND substr(job_id, 1, length(job_id) - 4) IN (SELECT job_id FROM jobs);
CREATE INDEX IF NOT EXISTS idx_jobs_parent ON jobs(parent_job_id) WHERE parent_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, updated_at DESC);

CREATE TRIGGER IF NOT EXISTS jobs_page_charge_refund AFTER UPDATE OF status ON jobs
WHEN NEW.status IN ('failed', 'canceled')
BEGIN
    INSERT INTO page_ledger (user_id, delta, kind, job_id, note, created_at)
        SELECT user_id, pages, 'refund', job_id, NEW.status,
               strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        FROM job_page_charges WHERE job_id = NEW.job_id AND status = 'reserved';
    UPDATE job_page_charges SET status = 'refunded', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE job_id = NEW.job_id AND status = 'reserved';
END;
CREATE TRIGGER IF NOT EXISTS jobs_page_charge_settle AFTER UPDATE OF status ON jobs
WHEN NEW.status = 'succeeded'
BEGIN
    UPDATE job_page_charges SET status = 'settled', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE job_id = NEW.job_id AND status = 'reserved';
END;
