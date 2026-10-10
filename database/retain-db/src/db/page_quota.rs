//! 按页额度（多用户模式）。余额是账本（page_ledger）的累加；每个收费任务在 job_page_charges
//! 有一行预扣记录。退回和确认由触发器在任务进入终态 / 被删时做（见 schema/migrations/v23_page_quota.sql），
//! 这里只管：查余额、预扣、提交失败时撤回预扣、管理员发放，以及算一个新任务该记在谁头上、
//! 文档有几页。

use std::collections::HashMap;

use anyhow::Result;
use rusqlite::{params, OptionalExtension, Transaction, TransactionBehavior};

use super::Db;

/// 沿 `source.artifact_job_id` 往回找上传最多走几步（防环、防异常长链）。
const MAX_SOURCE_HOPS: usize = 16;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PageLedgerEntry {
    pub entry_id: i64,
    pub delta: i64,
    /// grant / charge / refund
    pub kind: String,
    pub job_id: String,
    pub note: String,
    pub actor_user_id: String,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PageChargeRecord {
    pub job_id: String,
    pub user_id: String,
    pub pages: i64,
    /// reserved / settled / refunded
    pub status: String,
}

/// 新任务的页数从哪来、记在谁头上：和归属触发器同一条规则——有上传跟上传走，
/// 没有上传跟源任务走；页数取链条尽头那份上传的页数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BillingSource {
    pub owner_user_id: String,
    pub page_count: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PageReservation {
    /// 扣上了；balance 是扣完之后的余额。
    Reserved { balance: i64 },
    /// 余额不够，什么都没动。
    Insufficient { balance: i64 },
    /// 这个任务已经扣过（预扣中或已确认），不重复扣。
    AlreadyCharged,
}

/// 管理员扣减后余额会变成负数。
#[derive(Debug)]
pub struct PageBalanceWouldGoNegative {
    pub balance: i64,
}

impl std::fmt::Display for PageBalanceWouldGoNegative {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "page balance would go negative (current balance {})",
            self.balance
        )
    }
}

impl std::error::Error for PageBalanceWouldGoNegative {}

fn balance_in(tx: &Transaction<'_>, user_id: &str) -> rusqlite::Result<i64> {
    tx.query_row(
        "SELECT COALESCE(SUM(delta), 0) FROM page_ledger WHERE user_id = ?1",
        params![user_id],
        |row| row.get(0),
    )
}

impl Db {
    pub fn page_balance(&self, user_id: &str) -> Result<i64> {
        let conn = self.connect()?;
        Ok(conn.query_row(
            "SELECT COALESCE(SUM(delta), 0) FROM page_ledger WHERE user_id = ?1",
            params![user_id],
            |row| row.get(0),
        )?)
    }

    /// 所有有过账的人的余额（管理员的账号列表用；没账的人余额就是 0）。
    pub fn page_balances(&self) -> Result<HashMap<String, i64>> {
        let conn = self.connect()?;
        let mut stmt =
            conn.prepare("SELECT user_id, SUM(delta) FROM page_ledger GROUP BY user_id")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })?;
        Ok(rows.collect::<rusqlite::Result<HashMap<_, _>>>()?)
    }

    /// 最近的账目，新的在前。
    pub fn list_page_ledger(&self, user_id: &str, limit: usize) -> Result<Vec<PageLedgerEntry>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT entry_id, delta, kind, job_id, note, actor_user_id, created_at FROM page_ledger \
             WHERE user_id = ?1 ORDER BY entry_id DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![user_id, limit as i64], |row| {
            Ok(PageLedgerEntry {
                entry_id: row.get(0)?,
                delta: row.get(1)?,
                kind: row.get(2)?,
                job_id: row.get(3)?,
                note: row.get(4)?,
                actor_user_id: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn page_charge(&self, job_id: &str) -> Result<Option<PageChargeRecord>> {
        let conn = self.connect()?;
        Ok(conn
            .query_row(
                "SELECT job_id, user_id, pages, status FROM job_page_charges WHERE job_id = ?1",
                params![job_id],
                |row| {
                    Ok(PageChargeRecord {
                        job_id: row.get(0)?,
                        user_id: row.get(1)?,
                        pages: row.get(2)?,
                        status: row.get(3)?,
                    })
                },
            )
            .optional()?)
    }

    /// 管理员发放（正数）或扣减（负数）。扣减不能让余额变成负数。返回操作后的余额。
    pub fn grant_pages(
        &self,
        user_id: &str,
        delta: i64,
        note: &str,
        actor_user_id: &str,
        now: &str,
    ) -> Result<i64> {
        let mut conn = self.connect()?;
        // IMMEDIATE：先读余额再写，避免和并发的预扣交错（见 job_writes::cas_save_job 的说明）。
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let balance = balance_in(&tx, user_id)?;
        if balance + delta < 0 {
            return Err(PageBalanceWouldGoNegative { balance }.into());
        }
        tx.execute(
            "INSERT INTO page_ledger (user_id, delta, kind, note, actor_user_id, created_at) \
             VALUES (?1, ?2, 'grant', ?3, ?4, ?5)",
            params![user_id, delta, note, actor_user_id, now],
        )?;
        tx.commit()?;
        Ok(balance + delta)
    }

    /// 给任务预扣。查余额和扣减在同一个写事务里，并发提交不会把余额扣成负数。
    /// 同一个任务已经预扣中或已确认就不再扣；之前退回过的（失败后原地重新渲染接着做完）重新扣。
    pub fn reserve_job_pages(
        &self,
        job_id: &str,
        user_id: &str,
        pages: i64,
        now: &str,
    ) -> Result<PageReservation> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let existing: Option<String> = tx
            .query_row(
                "SELECT status FROM job_page_charges WHERE job_id = ?1",
                params![job_id],
                |row| row.get(0),
            )
            .optional()?;
        if matches!(existing.as_deref(), Some("reserved" | "settled")) {
            return Ok(PageReservation::AlreadyCharged);
        }
        let balance = balance_in(&tx, user_id)?;
        if balance < pages {
            return Ok(PageReservation::Insufficient { balance });
        }
        tx.execute(
            "INSERT INTO job_page_charges (job_id, user_id, pages, status, created_at, updated_at) \
             VALUES (?1, ?2, ?3, 'reserved', ?4, ?4) \
             ON CONFLICT(job_id) DO UPDATE SET user_id = excluded.user_id, pages = excluded.pages, \
             status = 'reserved', updated_at = excluded.updated_at",
            params![job_id, user_id, pages, now],
        )?;
        tx.execute(
            "INSERT INTO page_ledger (user_id, delta, kind, job_id, created_at) VALUES (?1, ?2, 'charge', ?3, ?4)",
            params![user_id, -pages, job_id, now],
        )?;
        tx.commit()?;
        Ok(PageReservation::Reserved {
            balance: balance - pages,
        })
    }

    /// 提交没成（预扣之后、任务开跑之前出错）：把预扣退回。只动 reserved 的。
    pub fn release_job_pages(&self, job_id: &str, note: &str, now: &str) -> Result<bool> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        tx.execute(
            "INSERT INTO page_ledger (user_id, delta, kind, job_id, note, created_at) \
             SELECT user_id, pages, 'refund', job_id, ?2, ?3 FROM job_page_charges \
             WHERE job_id = ?1 AND status = 'reserved'",
            params![job_id, note, now],
        )?;
        let released = tx.execute(
            "UPDATE job_page_charges SET status = 'refunded', updated_at = ?2 WHERE job_id = ?1 AND status = 'reserved'",
            params![job_id, now],
        )?;
        tx.commit()?;
        Ok(released > 0)
    }

    /// 新任务记在谁头上、文档几页。找不到上传（来源已被删）返回 None。
    pub fn billing_source(
        &self,
        upload_id: &str,
        artifact_job_id: &str,
    ) -> Result<Option<BillingSource>> {
        let conn = self.connect()?;
        let upload = |upload_id: &str| -> rusqlite::Result<Option<(String, u32)>> {
            conn.query_row(
                "SELECT owner_user_id, page_count FROM uploads WHERE upload_id = ?1",
                params![upload_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
        };
        if !upload_id.trim().is_empty() {
            return Ok(
                upload(upload_id.trim())?.map(|(owner_user_id, page_count)| BillingSource {
                    owner_user_id,
                    page_count,
                }),
            );
        }
        // 归属跟第一个源任务（与 jobs_inherit_owner 一致），页数跟链条尽头的上传。
        let mut owner: Option<String> = None;
        let mut current = artifact_job_id.trim().to_string();
        let mut visited = Vec::new();
        while !current.is_empty() && visited.len() < MAX_SOURCE_HOPS && !visited.contains(&current)
        {
            let row: Option<(String, Option<String>, Option<String>)> = conn
                .query_row(
                    "SELECT owner_user_id, upload_id, CASE WHEN json_valid(request_json) \
                     THEN json_extract(request_json, '$.source.artifact_job_id') END FROM jobs WHERE job_id = ?1",
                    params![current],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                )
                .optional()?;
            let Some((job_owner, job_upload, next)) = row else {
                break;
            };
            owner.get_or_insert(job_owner);
            if let Some(upload_id) = job_upload.filter(|id| !id.trim().is_empty()) {
                if let Some((_, page_count)) = upload(upload_id.trim())? {
                    return Ok(owner.map(|owner_user_id| BillingSource {
                        owner_user_id,
                        page_count,
                    }));
                }
            }
            visited.push(std::mem::take(&mut current));
            current = next.unwrap_or_default().trim().to_string();
        }
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::domain::UploadRecord;

    const NOW: &str = "2026-10-10T00:00:00Z";

    fn db(name: &str) -> (Db, std::path::PathBuf) {
        let root =
            std::env::temp_dir().join(format!("retain-page-quota-{name}-{}", fastrand::u64(..)));
        std::fs::create_dir_all(root.join("uploads")).unwrap();
        let db = Db::new(root.join("jobs.db"), root.clone());
        db.init().unwrap();
        (db, root)
    }

    fn upload(db: &Db, root: &std::path::Path, upload_id: &str, owner: &str, page_count: u32) {
        let path = root.join("uploads").join(format!("{upload_id}.pdf"));
        std::fs::write(&path, b"%PDF").unwrap();
        let record = UploadRecord {
            upload_id: upload_id.into(),
            filename: "a.pdf".into(),
            stored_path: path.to_string_lossy().into_owned(),
            bytes: 4,
            page_count,
            uploaded_at: NOW.into(),
            developer_mode: false,
            content_hash: format!("hash-{upload_id}"),
        };
        db.save_upload_with_document_for(&record, owner).unwrap();
    }

    fn insert_job(db: &Db, job_id: &str, upload_id: &str, artifact_job_id: &str) {
        let request =
            serde_json::json!({ "source": { "artifact_job_id": artifact_job_id } }).to_string();
        db.connect()
            .unwrap()
            .execute(
                "INSERT INTO jobs (job_id, workflow, status_json, created_at, updated_at, upload_id, command_json, request_json, log_tail_json) \
                 VALUES (?1, '\"book\"', '\"queued\"', ?2, ?2, ?3, '[]', ?4, '[]')",
                params![job_id, NOW, upload_id, request],
            )
            .unwrap();
    }

    fn set_status(db: &Db, job_id: &str, status: &str) {
        db.connect()
            .unwrap()
            .execute(
                "INSERT INTO jobs (job_id, workflow, status_json, created_at, updated_at, command_json, request_json, log_tail_json) \
                 VALUES (?1, '\"book\"', ?2, ?3, ?3, '[]', '{}', '[]') \
                 ON CONFLICT(job_id) DO UPDATE SET status_json = excluded.status_json",
                params![job_id, format!("\"{status}\""), NOW],
            )
            .unwrap();
    }

    #[test]
    fn reserve_needs_enough_balance_and_never_goes_negative() {
        let (db, _root) = db("reserve");
        assert_eq!(
            db.reserve_job_pages("j1", "u1", 5, NOW).unwrap(),
            PageReservation::Insufficient { balance: 0 }
        );
        assert_eq!(db.grant_pages("u1", 8, "内测", "admin", NOW).unwrap(), 8);
        assert_eq!(
            db.reserve_job_pages("j1", "u1", 5, NOW).unwrap(),
            PageReservation::Reserved { balance: 3 }
        );
        assert_eq!(
            db.reserve_job_pages("j1", "u1", 5, NOW).unwrap(),
            PageReservation::AlreadyCharged,
            "同一任务不重复扣"
        );
        assert_eq!(
            db.reserve_job_pages("j2", "u1", 5, NOW).unwrap(),
            PageReservation::Insufficient { balance: 3 }
        );
        assert_eq!(db.page_balance("u1").unwrap(), 3);
    }

    #[test]
    fn terminal_status_refunds_or_settles_exactly_once() {
        let (db, root) = db("terminal");
        upload(&db, &root, "up1", "u1", 10);
        db.grant_pages("u1", 30, "", "admin", NOW).unwrap();
        for job in ["ok", "bad", "gone", "stopped"] {
            insert_job(&db, job, "up1", "");
            db.reserve_job_pages(job, "u1", 5, NOW).unwrap();
        }
        assert_eq!(db.page_balance("u1").unwrap(), 10);

        set_status(&db, "ok", "running");
        set_status(&db, "ok", "succeeded");
        set_status(&db, "bad", "failed");
        set_status(&db, "bad", "failed"); // 终态重复写（重试持久化）不能退两次
        set_status(&db, "stopped", "canceled");
        db.delete_job("gone").unwrap();

        assert_eq!(db.page_charge("ok").unwrap().unwrap().status, "settled");
        for job in ["bad", "gone", "stopped"] {
            assert_eq!(
                db.page_charge(job).unwrap().unwrap().status,
                "refunded",
                "{job}"
            );
        }
        assert_eq!(db.page_balance("u1").unwrap(), 25, "只有成功的那 5 页算数");

        // 成功之后再失败（比如原地重新渲染失败）不退：译文已经交付过了。
        set_status(&db, "ok", "failed");
        assert_eq!(db.page_balance("u1").unwrap(), 25);
        let notes: Vec<String> = db
            .list_page_ledger("u1", 10)
            .unwrap()
            .into_iter()
            .map(|e| e.note)
            .collect();
        assert!(
            notes.contains(&"failed".to_string())
                && notes.contains(&"canceled".to_string())
                && notes.contains(&"deleted".to_string())
        );
    }

    #[test]
    fn refunded_job_is_charged_again_when_continued_in_place() {
        let (db, _root) = db("recharge");
        db.grant_pages("u1", 10, "", "admin", NOW).unwrap();
        set_status(&db, "j1", "queued");
        db.reserve_job_pages("j1", "u1", 4, NOW).unwrap();
        set_status(&db, "j1", "failed");
        assert_eq!(db.page_balance("u1").unwrap(), 10);
        // 原地重新渲染把它做完：重新扣。
        assert_eq!(
            db.reserve_job_pages("j1", "u1", 4, NOW).unwrap(),
            PageReservation::Reserved { balance: 6 }
        );
        set_status(&db, "j1", "succeeded");
        assert_eq!(db.page_charge("j1").unwrap().unwrap().status, "settled");
    }

    #[test]
    fn release_only_touches_reservations() {
        let (db, _root) = db("release");
        db.grant_pages("u1", 10, "", "admin", NOW).unwrap();
        db.reserve_job_pages("j1", "u1", 4, NOW).unwrap();
        assert!(db.release_job_pages("j1", "submit_failed", NOW).unwrap());
        assert!(
            !db.release_job_pages("j1", "submit_failed", NOW).unwrap(),
            "不重复退"
        );
        assert_eq!(db.page_balance("u1").unwrap(), 10);
    }

    #[test]
    fn admin_deduction_cannot_go_negative() {
        let (db, _root) = db("deduct");
        db.grant_pages("u1", 3, "", "admin", NOW).unwrap();
        let error = db.grant_pages("u1", -4, "", "admin", NOW).unwrap_err();
        assert_eq!(
            error
                .downcast_ref::<PageBalanceWouldGoNegative>()
                .unwrap()
                .balance,
            3
        );
        assert_eq!(db.grant_pages("u1", -3, "", "admin", NOW).unwrap(), 0);
        assert_eq!(db.page_balances().unwrap().get("u1"), Some(&0));
    }

    #[test]
    fn billing_source_follows_upload_then_source_job_chain() {
        let (db, root) = db("source");
        upload(&db, &root, "up1", "u1", 12);
        insert_job(&db, "root", "up1", "");
        insert_job(&db, "rerun1", "", "root");
        insert_job(&db, "rerun2", "", "rerun1");
        let expected = Some(BillingSource {
            owner_user_id: "u1".into(),
            page_count: 12,
        });
        assert_eq!(db.billing_source("up1", "").unwrap(), expected);
        assert_eq!(db.billing_source("", "rerun2").unwrap(), expected);
        assert_eq!(db.billing_source("", "missing").unwrap(), None);
        assert_eq!(db.billing_source("", "").unwrap(), None);
    }
}
