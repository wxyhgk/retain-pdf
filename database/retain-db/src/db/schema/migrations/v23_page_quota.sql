-- 多用户：按页额度。余额 = page_ledger 里这个人全部 delta 之和（发放为正、扣页为负、退回为正），
-- 以后接充值也只是往账本里记一笔。每个收费任务在 job_page_charges 有一行：提交时预扣（reserved），
-- 成功了确认（settled），失败、取消、被删了退回（refunded）。
-- 退回和确认由触发器做：终态由 jobsd、API 取消、启动恢复好几处写，挂在哪一处都会漏。
-- 任务行全部经 ON CONFLICT DO UPDATE 写，会走 UPDATE 触发器；只认 reserved，重复触发也不会重复退。
CREATE TABLE IF NOT EXISTS page_ledger (
    entry_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       TEXT NOT NULL,
    delta         INTEGER NOT NULL,
    kind          TEXT NOT NULL CHECK (kind IN ('grant', 'charge', 'refund')),
    job_id        TEXT NOT NULL DEFAULT '',
    note          TEXT NOT NULL DEFAULT '',
    actor_user_id TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS page_ledger_by_user ON page_ledger(user_id, entry_id);
CREATE TABLE IF NOT EXISTS job_page_charges (
    job_id     TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    pages      INTEGER NOT NULL CHECK (pages > 0),
    status     TEXT NOT NULL CHECK (status IN ('reserved', 'settled', 'refunded')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS jobs_page_charge_refund AFTER UPDATE OF status_json ON jobs
WHEN NEW.status_json IN ('"failed"', '"canceled"', 'failed', 'canceled')
BEGIN
    INSERT INTO page_ledger (user_id, delta, kind, job_id, note, created_at)
        SELECT user_id, pages, 'refund', job_id, TRIM(NEW.status_json, '"'),
               strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        FROM job_page_charges WHERE job_id = NEW.job_id AND status = 'reserved';
    UPDATE job_page_charges SET status = 'refunded', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE job_id = NEW.job_id AND status = 'reserved';
END;
CREATE TRIGGER IF NOT EXISTS jobs_page_charge_settle AFTER UPDATE OF status_json ON jobs
WHEN NEW.status_json IN ('"succeeded"', 'succeeded')
BEGIN
    UPDATE job_page_charges SET status = 'settled', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE job_id = NEW.job_id AND status = 'reserved';
END;
CREATE TRIGGER IF NOT EXISTS jobs_page_charge_refund_on_delete AFTER DELETE ON jobs
BEGIN
    INSERT INTO page_ledger (user_id, delta, kind, job_id, note, created_at)
        SELECT user_id, pages, 'refund', job_id, 'deleted', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        FROM job_page_charges WHERE job_id = OLD.job_id AND status = 'reserved';
    UPDATE job_page_charges SET status = 'refunded', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE job_id = OLD.job_id AND status = 'reserved';
END;
