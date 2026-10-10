-- 多用户：账号与会话。单机模式下这两张表是空的（只有一个固定的本机用户，不落库）。
-- 会话只存令牌的 sha256，库泄露了也拿不到能用的令牌。
CREATE TABLE IF NOT EXISTS users (
    user_id              TEXT PRIMARY KEY,
    username             TEXT NOT NULL,
    username_key         TEXT NOT NULL UNIQUE,
    password_hash        TEXT NOT NULL,
    role                 TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    status               TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
    must_change_password INTEGER NOT NULL DEFAULT 0,
    failed_logins        INTEGER NOT NULL DEFAULT 0,
    locked_until         TEXT NOT NULL DEFAULT '',
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    last_login_at        TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS sessions (
    token_hash   TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at   TEXT NOT NULL,
    expires_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_by_user ON sessions(user_id);
