//! `Idempotency-Key` 请求头的记录（`idempotency_keys`，v38）。什么时候占位、重放、删掉由 rust_api 的
//! `app/idempotency.rs` 决定；这里只管存取。表的说明见迁移 `v38_duplicate_submissions.sql`。
//!
//! 一条记录按（用户，方法 + 路由模板，key）认；同一把 key 第二次来时，先删掉已经过期的那条再看，
//! 所以过期的记录等于不存在。

use anyhow::Result;
use chrono::{DateTime, Utc};
use rusqlite::{params, OptionalExtension, TransactionBehavior};

use super::Db;

/// 一把 key 归谁、用在哪个接口上。
#[derive(Debug, Clone, Copy)]
pub struct IdempotencyScope<'a> {
    pub owner_user_id: &'a str,
    /// 方法 + 路由模板，例如 `POST /api/v1/jobs/:job_id/actions/resume`。
    pub route: &'a str,
    pub key: &'a str,
}

/// 请求指纹：同一把 key 再来时，三样都一样才算同一个请求。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IdempotencyFingerprint<'a> {
    pub method: &'a str,
    /// 实际路径（含查询串）。
    pub path: &'a str,
    /// 请求体的 sha256（十六进制）。
    pub body_sha256: &'a str,
}

/// 存下来的成功响应。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredIdempotentResponse {
    pub status: u16,
    pub content_type: Option<String>,
    pub body: Vec<u8>,
}

/// [`Db::claim_idempotency_key`] 的结果。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IdempotencyClaim {
    /// 第一次见（或上一条已过期、已删）：占好位了，调用方去处理请求，完了调 complete / release。
    Claimed,
    /// 同一把 key 的请求还在处理。
    InFlight,
    /// 同一把 key，但请求不一样（方法、路径或请求体不同）。
    Mismatch,
    /// 处理过了：照存下的响应回。
    Completed(StoredIdempotentResponse),
}

/// 存库的时间格式：定长、UTC，按字符串比较就是按时间比较。
fn timestamp(at: DateTime<Utc>) -> String {
    at.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

impl Db {
    /// 占一把 key：没有（或已过期）就写一条「处理中」并返回 [`IdempotencyClaim::Claimed`]；
    /// 有就按状态、指纹回答。查和写在同一个 `BEGIN IMMEDIATE` 事务里，同一把 key 两个请求同时来只有一个占到。
    pub fn claim_idempotency_key(
        &self,
        scope: IdempotencyScope<'_>,
        fingerprint: IdempotencyFingerprint<'_>,
        now: DateTime<Utc>,
        ttl: chrono::Duration,
    ) -> Result<IdempotencyClaim> {
        let now_text = timestamp(now);
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        // 惰性清理：这把 key 过期了就当没有。
        tx.execute(
            "DELETE FROM idempotency_keys
             WHERE owner_user_id = ?1 AND route = ?2 AND idempotency_key = ?3 AND expires_at <= ?4",
            params![scope.owner_user_id, scope.route, scope.key, now_text],
        )?;
        type Row = (
            String,
            String,
            String,
            String,
            Option<i64>,
            Option<String>,
            Option<Vec<u8>>,
        );
        let existing: Option<Row> = tx
            .query_row(
                "SELECT request_method, request_path, request_body_sha256, status,
                        response_status, response_content_type, response_body
                 FROM idempotency_keys
                 WHERE owner_user_id = ?1 AND route = ?2 AND idempotency_key = ?3",
                params![scope.owner_user_id, scope.route, scope.key],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                        row.get(6)?,
                    ))
                },
            )
            .optional()?;
        let claim = match existing {
            None => {
                tx.execute(
                    "INSERT INTO idempotency_keys (
                        owner_user_id, route, idempotency_key, request_method, request_path,
                        request_body_sha256, status, created_at, expires_at
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'processing', ?7, ?8)",
                    params![
                        scope.owner_user_id,
                        scope.route,
                        scope.key,
                        fingerprint.method,
                        fingerprint.path,
                        fingerprint.body_sha256,
                        now_text,
                        timestamp(now + ttl),
                    ],
                )?;
                IdempotencyClaim::Claimed
            }
            Some((method, path, body_sha256, status, response_status, content_type, body)) => {
                let stored = IdempotencyFingerprint {
                    method: &method,
                    path: &path,
                    body_sha256: &body_sha256,
                };
                if stored != fingerprint {
                    IdempotencyClaim::Mismatch
                } else if status == "completed" {
                    IdempotencyClaim::Completed(StoredIdempotentResponse {
                        status: response_status
                            .and_then(|code| u16::try_from(code).ok())
                            .unwrap_or(200),
                        content_type,
                        body: body.unwrap_or_default(),
                    })
                } else {
                    IdempotencyClaim::InFlight
                }
            }
        };
        tx.commit()?;
        Ok(claim)
    }

    /// 处理成功：把占位改成「已完成」并存下响应。占位已经不在（被清理了）返回 false。
    pub fn complete_idempotency_key(
        &self,
        scope: IdempotencyScope<'_>,
        response: &StoredIdempotentResponse,
        now: DateTime<Utc>,
    ) -> Result<bool> {
        let conn = self.connect()?;
        let changed = conn.execute(
            "UPDATE idempotency_keys
             SET status = 'completed', response_status = ?4, response_content_type = ?5,
                 response_body = ?6, completed_at = ?7
             WHERE owner_user_id = ?1 AND route = ?2 AND idempotency_key = ?3 AND status = 'processing'",
            params![
                scope.owner_user_id,
                scope.route,
                scope.key,
                i64::from(response.status),
                response.content_type,
                response.body,
                timestamp(now),
            ],
        )?;
        Ok(changed == 1)
    }

    /// 处理失败：删掉占位，客户端可以带同一把 key 重试。只删「处理中」的。
    pub fn release_idempotency_key(&self, scope: IdempotencyScope<'_>) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            "DELETE FROM idempotency_keys
             WHERE owner_user_id = ?1 AND route = ?2 AND idempotency_key = ?3 AND status = 'processing'",
            params![scope.owner_user_id, scope.route, scope.key],
        )?;
        Ok(())
    }

    /// 删掉所有过期的记录（定期清理调），返回删了几条。
    pub fn delete_expired_idempotency_keys(&self, now: DateTime<Utc>) -> Result<usize> {
        let conn = self.connect()?;
        Ok(conn.execute(
            "DELETE FROM idempotency_keys WHERE expires_at <= ?1",
            params![timestamp(now)],
        )?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_db(name: &str) -> (Db, std::path::PathBuf) {
        let root =
            std::env::temp_dir().join(format!("retain-idempotency-{name}-{}", fastrand::u64(..)));
        std::fs::create_dir_all(root.join("db")).unwrap();
        let db = Db::new(root.join("db").join("jobs.db"), root.clone());
        db.init().unwrap();
        (db, root)
    }

    const SCOPE: IdempotencyScope<'static> = IdempotencyScope {
        owner_user_id: "local",
        route: "POST /api/v1/jobs",
        key: "key-1",
    };
    const PRINT: IdempotencyFingerprint<'static> = IdempotencyFingerprint {
        method: "POST",
        path: "/api/v1/jobs",
        body_sha256: "abc",
    };

    fn ttl() -> chrono::Duration {
        chrono::Duration::hours(24)
    }

    #[test]
    fn claim_complete_replay_and_mismatch() {
        let (db, root) = temp_db("flow");
        let now = Utc::now();
        assert_eq!(
            db.claim_idempotency_key(SCOPE, PRINT, now, ttl()).unwrap(),
            IdempotencyClaim::Claimed
        );
        assert_eq!(
            db.claim_idempotency_key(SCOPE, PRINT, now, ttl()).unwrap(),
            IdempotencyClaim::InFlight
        );
        let response = StoredIdempotentResponse {
            status: 200,
            content_type: Some("application/json".to_string()),
            body: br#"{"code":0}"#.to_vec(),
        };
        assert!(db.complete_idempotency_key(SCOPE, &response, now).unwrap());
        assert_eq!(
            db.claim_idempotency_key(SCOPE, PRINT, now, ttl()).unwrap(),
            IdempotencyClaim::Completed(response)
        );
        let other_body = IdempotencyFingerprint {
            body_sha256: "def",
            ..PRINT
        };
        assert_eq!(
            db.claim_idempotency_key(SCOPE, other_body, now, ttl())
                .unwrap(),
            IdempotencyClaim::Mismatch
        );
        // 别的用户、别的接口同名 key 互不相干。
        let other_owner = IdempotencyScope {
            owner_user_id: "u2",
            ..SCOPE
        };
        assert_eq!(
            db.claim_idempotency_key(other_owner, other_body, now, ttl())
                .unwrap(),
            IdempotencyClaim::Claimed
        );
        let other_route = IdempotencyScope {
            route: "POST /api/v1/documents/:document_id/translate",
            ..SCOPE
        };
        assert_eq!(
            db.claim_idempotency_key(other_route, other_body, now, ttl())
                .unwrap(),
            IdempotencyClaim::Claimed
        );
        std::fs::remove_dir_all(root).ok();
    }

    #[test]
    fn released_keys_can_be_claimed_again() {
        let (db, root) = temp_db("release");
        let now = Utc::now();
        assert_eq!(
            db.claim_idempotency_key(SCOPE, PRINT, now, ttl()).unwrap(),
            IdempotencyClaim::Claimed
        );
        db.release_idempotency_key(SCOPE).unwrap();
        assert_eq!(
            db.claim_idempotency_key(SCOPE, PRINT, now, ttl()).unwrap(),
            IdempotencyClaim::Claimed
        );
        std::fs::remove_dir_all(root).ok();
    }

    #[test]
    fn expired_keys_count_as_new() {
        let (db, root) = temp_db("expiry");
        let then = Utc::now() - chrono::Duration::hours(25);
        assert_eq!(
            db.claim_idempotency_key(SCOPE, PRINT, then, ttl()).unwrap(),
            IdempotencyClaim::Claimed
        );
        let response = StoredIdempotentResponse {
            status: 200,
            content_type: None,
            body: b"{}".to_vec(),
        };
        assert!(db.complete_idempotency_key(SCOPE, &response, then).unwrap());
        let other = IdempotencyScope {
            key: "key-2",
            ..SCOPE
        };
        assert_eq!(
            db.claim_idempotency_key(other, PRINT, then, ttl()).unwrap(),
            IdempotencyClaim::Claimed
        );

        // 过期了：同一把 key、不同请求体也是新请求。
        let now = Utc::now();
        let changed = IdempotencyFingerprint {
            body_sha256: "zzz",
            ..PRINT
        };
        assert_eq!(
            db.claim_idempotency_key(SCOPE, changed, now, ttl())
                .unwrap(),
            IdempotencyClaim::Claimed
        );
        // 定期清理删掉另一条过期的，新占的那条留着。
        assert_eq!(db.delete_expired_idempotency_keys(now).unwrap(), 1);
        assert_eq!(
            db.claim_idempotency_key(SCOPE, changed, now, ttl())
                .unwrap(),
            IdempotencyClaim::InFlight
        );
        std::fs::remove_dir_all(root).ok();
    }
}
