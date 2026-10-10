-- 多用户：账号软删除。删了的账号 deleted_at 非空：不能登录、会话作废、不算可用管理员，
-- 数据和账目都留着，用户名继续占用；恢复就是清空它。
-- 不往 status 的 CHECK 里加 'deleted'：SQLite 改约束只能重建表，而 sessions 对 users 是
-- ON DELETE CASCADE，重建会把所有人的会话连带删掉。
ALTER TABLE users ADD COLUMN deleted_at TEXT NOT NULL DEFAULT '';
