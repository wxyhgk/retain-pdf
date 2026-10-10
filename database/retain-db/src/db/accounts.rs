//! 账号与会话（多用户模式）。密码只存 Argon2id 哈希，会话只存令牌的 sha256；哈希和令牌的生成在
//! API 层（services/accounts），这里只管存取。

use anyhow::{bail, Result};
use rusqlite::{params, OptionalExtension, Row};

use super::Db;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserRecord {
    pub user_id: String,
    pub username: String,
    /// admin / user
    pub role: String,
    /// active / disabled
    pub status: String,
    pub must_change_password: bool,
    pub failed_logins: i64,
    /// 锁定到何时（RFC 3339）；空 = 没锁。
    pub locked_until: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_login_at: String,
    /// 软删除的时间（RFC 3339）；空 = 没删。
    pub deleted_at: String,
}

impl UserRecord {
    pub fn is_deleted(&self) -> bool {
        !self.deleted_at.is_empty()
    }
}

pub(super) const USER_COLUMNS: &str = "user_id, username, role, status, must_change_password, failed_logins, \
                            locked_until, created_at, updated_at, last_login_at, deleted_at";

pub(super) fn row_to_user(row: &Row<'_>) -> rusqlite::Result<UserRecord> {
    Ok(UserRecord {
        user_id: row.get(0)?,
        username: row.get(1)?,
        role: row.get(2)?,
        status: row.get(3)?,
        must_change_password: row.get::<_, i64>(4)? != 0,
        failed_logins: row.get(5)?,
        locked_until: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
        last_login_at: row.get(9)?,
        deleted_at: row.get(10)?,
    })
}

/// 用户名的比较键：去空白、小写。唯一约束建在它上面，用户名不区分大小写。
pub fn username_key(username: &str) -> String {
    username.trim().to_lowercase()
}

/// 建账号时用户名已被占用。
#[derive(Debug)]
pub struct UsernameTaken(pub String);

impl std::fmt::Display for UsernameTaken {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "username already exists: {}", self.0)
    }
}

impl std::error::Error for UsernameTaken {}

impl Db {
    pub fn create_user(
        &self,
        user_id: &str,
        username: &str,
        password_hash: &str,
        role: &str,
        must_change_password: bool,
        now: &str,
    ) -> Result<UserRecord> {
        if !matches!(role, "admin" | "user") {
            bail!("invalid role: {role}");
        }
        let conn = self.connect()?;
        let inserted = conn.execute(
            "INSERT INTO users (user_id, username, username_key, password_hash, role, status, \
             must_change_password, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, 'active', ?6, ?7, ?7) \
             ON CONFLICT(username_key) DO NOTHING",
            params![user_id, username.trim(), username_key(username), password_hash, role, must_change_password as i64, now],
        )?;
        if inserted == 0 {
            return Err(UsernameTaken(username.trim().to_string()).into());
        }
        self.get_user(user_id)?.ok_or_else(|| anyhow::anyhow!("user vanished after insert: {user_id}"))
    }

    pub fn get_user(&self, user_id: &str) -> Result<Option<UserRecord>> {
        let conn = self.connect()?;
        Ok(conn
            .query_row(&format!("SELECT {USER_COLUMNS} FROM users WHERE user_id = ?1"), params![user_id], row_to_user)
            .optional()?)
    }

    /// 登录用：按用户名找账号，连同密码哈希。
    pub fn user_for_login(&self, username: &str) -> Result<Option<(UserRecord, String)>> {
        let conn = self.connect()?;
        Ok(conn
            .query_row(
                &format!("SELECT {USER_COLUMNS}, password_hash FROM users WHERE username_key = ?1"),
                params![username_key(username)],
                |row| Ok((row_to_user(row)?, row.get::<_, String>(11)?)),
            )
            .optional()?)
    }

    pub fn password_hash(&self, user_id: &str) -> Result<Option<String>> {
        let conn = self.connect()?;
        Ok(conn
            .query_row("SELECT password_hash FROM users WHERE user_id = ?1", params![user_id], |row| row.get(0))
            .optional()?)
    }

    /// 没删的账号（删了的要查请用 list_users_page 带 status=deleted）。
    pub fn list_users(&self) -> Result<Vec<UserRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {USER_COLUMNS} FROM users WHERE deleted_at = '' ORDER BY created_at, username_key"
        ))?;
        let rows = stmt.query_map([], row_to_user)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn count_active_admins(&self) -> Result<i64> {
        let conn = self.connect()?;
        Ok(conn.query_row(
            "SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active' AND deleted_at = ''",
            [],
            |row| row.get(0),
        )?)
    }

    pub fn set_user_password(&self, user_id: &str, password_hash: &str, must_change_password: bool, now: &str) -> Result<bool> {
        let conn = self.connect()?;
        let updated = conn.execute(
            "UPDATE users SET password_hash = ?2, must_change_password = ?3, failed_logins = 0, \
             locked_until = '', updated_at = ?4 WHERE user_id = ?1",
            params![user_id, password_hash, must_change_password as i64, now],
        )?;
        Ok(updated > 0)
    }

    pub fn set_user_status(&self, user_id: &str, status: &str, now: &str) -> Result<bool> {
        if !matches!(status, "active" | "disabled") {
            bail!("invalid status: {status}");
        }
        let conn = self.connect()?;
        let updated = conn.execute(
            "UPDATE users SET status = ?2, failed_logins = 0, locked_until = '', updated_at = ?3 WHERE user_id = ?1",
            params![user_id, status, now],
        )?;
        Ok(updated > 0)
    }

    pub fn set_user_role(&self, user_id: &str, role: &str, now: &str) -> Result<bool> {
        if !matches!(role, "admin" | "user") {
            bail!("invalid role: {role}");
        }
        let conn = self.connect()?;
        let updated =
            conn.execute("UPDATE users SET role = ?2, updated_at = ?3 WHERE user_id = ?1", params![user_id, role, now])?;
        Ok(updated > 0)
    }

    /// 软删除（`deleted_at` 为删除时间）或恢复（空串）。
    pub fn set_user_deleted_at(&self, user_id: &str, deleted_at: &str, now: &str) -> Result<bool> {
        let conn = self.connect()?;
        let updated = conn.execute(
            "UPDATE users SET deleted_at = ?2, updated_at = ?3 WHERE user_id = ?1",
            params![user_id, deleted_at, now],
        )?;
        Ok(updated > 0)
    }

    /// 记一次输错；达到 `lock_after` 次就锁到 `lock_until`。返回累计失败次数。
    pub fn record_login_failure(&self, user_id: &str, lock_after: i64, lock_until: &str, now: &str) -> Result<i64> {
        let conn = self.connect()?;
        let failures: i64 = conn.query_row(
            "UPDATE users SET failed_logins = failed_logins + 1, updated_at = ?2 WHERE user_id = ?1 RETURNING failed_logins",
            params![user_id, now],
            |row| row.get(0),
        )?;
        if failures >= lock_after {
            conn.execute(
                "UPDATE users SET locked_until = ?2, failed_logins = 0 WHERE user_id = ?1",
                params![user_id, lock_until],
            )?;
        }
        Ok(failures)
    }

    pub fn record_login_success(&self, user_id: &str, now: &str) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            "UPDATE users SET failed_logins = 0, locked_until = '', last_login_at = ?2, updated_at = ?2 WHERE user_id = ?1",
            params![user_id, now],
        )?;
        Ok(())
    }

    pub fn create_session(&self, token_hash: &str, user_id: &str, now: &str, expires_at: &str) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)",
            params![token_hash, user_id, now, expires_at],
        )?;
        Ok(())
    }

    /// 会话对应的账号；过期、账号停用、已删除的不算（返回 None）。
    pub fn session_user(&self, token_hash: &str, now: &str) -> Result<Option<UserRecord>> {
        let conn = self.connect()?;
        let columns = USER_COLUMNS
            .split(", ")
            .map(|column| format!("u.{}", column.trim()))
            .collect::<Vec<_>>()
            .join(", ");
        Ok(conn
            .query_row(
                &format!(
                    "SELECT {columns} FROM sessions s JOIN users u ON u.user_id = s.user_id \
                     WHERE s.token_hash = ?1 AND s.expires_at > ?2 AND u.status = 'active' AND u.deleted_at = ''"
                ),
                params![token_hash, now],
                row_to_user,
            )
            .optional()?)
    }

    pub fn delete_session(&self, token_hash: &str) -> Result<()> {
        let conn = self.connect()?;
        conn.execute("DELETE FROM sessions WHERE token_hash = ?1", params![token_hash])?;
        Ok(())
    }

    /// 作废一个账号的会话；`keep` 是要保留的那一个（改密码时保留当前设备）。
    pub fn delete_user_sessions(&self, user_id: &str, keep: Option<&str>) -> Result<usize> {
        let conn = self.connect()?;
        Ok(conn.execute(
            "DELETE FROM sessions WHERE user_id = ?1 AND token_hash <> COALESCE(?2, '')",
            params![user_id, keep],
        )?)
    }

    pub fn purge_expired_sessions(&self, now: &str) -> Result<usize> {
        let conn = self.connect()?;
        Ok(conn.execute("DELETE FROM sessions WHERE expires_at <= ?1", params![now])?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db(name: &str) -> Db {
        let root = std::env::temp_dir().join(format!("retain-accounts-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();
        Db::new(root.join("jobs.db"), root)
    }

    #[test]
    fn usernames_are_unique_regardless_of_case() {
        let db = db("unique");
        let user = db.create_user("u1", "Alice", "hash", "user", true, "2026-10-10T00:00:00Z").unwrap();
        assert_eq!((user.username.as_str(), user.status.as_str(), user.must_change_password), ("Alice", "active", true));
        let error = db.create_user("u2", " alice ", "hash", "user", false, "2026-10-10T00:00:00Z").unwrap_err();
        assert!(error.downcast_ref::<UsernameTaken>().is_some());
        let (found, hash) = db.user_for_login("ALICE").unwrap().unwrap();
        assert_eq!((found.user_id.as_str(), hash.as_str()), ("u1", "hash"));
    }

    #[test]
    fn sessions_expire_and_die_with_a_disabled_account() {
        let db = db("sessions");
        db.create_user("u1", "bob", "hash", "user", false, "2026-10-10T00:00:00Z").unwrap();
        db.create_session("t1", "u1", "2026-10-10T00:00:00Z", "2026-10-11T00:00:00Z").unwrap();
        db.create_session("t2", "u1", "2026-10-10T00:00:00Z", "2026-10-11T00:00:00Z").unwrap();
        assert!(db.session_user("t1", "2026-10-10T12:00:00Z").unwrap().is_some());
        assert!(db.session_user("t1", "2026-10-11T00:00:01Z").unwrap().is_none(), "过期");
        assert_eq!(db.delete_user_sessions("u1", Some("t2")).unwrap(), 1, "保留当前设备");
        assert!(db.session_user("t2", "2026-10-10T12:00:00Z").unwrap().is_some());
        db.set_user_status("u1", "disabled", "2026-10-10T13:00:00Z").unwrap();
        assert!(db.session_user("t2", "2026-10-10T13:00:01Z").unwrap().is_none(), "停用后会话失效");
    }

    #[test]
    fn repeated_failures_lock_the_account() {
        let db = db("lock");
        db.create_user("u1", "carol", "hash", "user", false, "2026-10-10T00:00:00Z").unwrap();
        for attempt in 1..5 {
            assert_eq!(db.record_login_failure("u1", 5, "2026-10-10T00:15:00Z", "2026-10-10T00:00:00Z").unwrap(), attempt);
        }
        assert_eq!(db.get_user("u1").unwrap().unwrap().locked_until, "");
        db.record_login_failure("u1", 5, "2026-10-10T00:15:00Z", "2026-10-10T00:00:00Z").unwrap();
        let locked = db.get_user("u1").unwrap().unwrap();
        assert_eq!((locked.locked_until.as_str(), locked.failed_logins), ("2026-10-10T00:15:00Z", 0));
        db.record_login_success("u1", "2026-10-10T01:00:00Z").unwrap();
        assert_eq!(db.get_user("u1").unwrap().unwrap().locked_until, "");
    }
}
