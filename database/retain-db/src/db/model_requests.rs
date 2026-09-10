//! Durable control plane; the caller supplies only hashes and secret-free data.
use anyhow::{bail, Context, Result};
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::Db;
use crate::models::domain::now_iso;

#[derive(Clone, Debug)]
pub struct ModelSession {
    pub job_id: String,
    pub profile: Value,
    pub paused: bool,
}

/// A capability rotation attempted to replace the frozen connection snapshot.
/// Kept distinct from SQLite failures while preserving the database Result API.
#[derive(Debug)]
pub struct ModelSessionConflict;

impl std::fmt::Display for ModelSessionConflict {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("model session configuration conflict")
    }
}

impl std::error::Error for ModelSessionConflict {}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ModelOperation {
    pub job_id: String,
    pub operation_id: String,
    pub unit_id: String,
    pub purpose: String,
    pub status: String,
    pub result: Option<Value>,
    pub error_code: Option<String>,
}

pub enum ModelReservation {
    Created(ModelOperation),
    Existing(ModelOperation),
    Conflict,
    Paused,
    UnitBudgetExceeded,
}

/// Secret-free recovery projection, read from a single SQLite snapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelRecoverySummary {
    pub paused: bool,
    pub queued: u64,
    pub running: u64,
    pub succeeded: u64,
    pub failed: u64,
    pub ambiguous: u64,
    pub cancelled: u64,
}

impl Db {
    pub fn model_recovery_summary(&self, job_id: &str) -> Result<Option<ModelRecoverySummary>> {
        self.connect()?
            .query_row(
                "SELECT s.paused,
             COUNT(CASE WHEN o.status='queued' THEN 1 END),
             COUNT(CASE WHEN o.status='running' THEN 1 END),
             COUNT(CASE WHEN o.status='succeeded' THEN 1 END),
             COUNT(CASE WHEN o.status='failed' THEN 1 END),
             COUNT(CASE WHEN o.status='ambiguous' THEN 1 END),
             COUNT(CASE WHEN o.status='cancelled' THEN 1 END)
             FROM model_sessions s LEFT JOIN model_operations o ON o.job_id=s.job_id
             WHERE s.job_id=?1 GROUP BY s.job_id",
                [job_id],
                |row| {
                    Ok(ModelRecoverySummary {
                        paused: row.get(0)?,
                        queued: row.get(1)?,
                        running: row.get(2)?,
                        succeeded: row.get(3)?,
                        failed: row.get(4)?,
                        ambiguous: row.get(5)?,
                        cancelled: row.get(6)?,
                    })
                },
            )
            .optional()
            .map_err(Into::into)
    }
    /// Frozen configuration cannot be changed by rotating a worker capability.
    pub fn create_model_session(
        &self,
        job_id: &str,
        token_hash: &str,
        expires_at: i64,
        profile: &Value,
    ) -> Result<()> {
        let conn = self.connect()?;
        let profile = serde_json::to_string(profile)?;
        let changed = conn.execute(
            "INSERT INTO model_sessions(job_id,token_hash,expires_at,profile_json,created_at)
             VALUES (?1,?2,?3,?4,?5)
             ON CONFLICT(job_id) DO UPDATE SET token_hash=excluded.token_hash, expires_at=excluded.expires_at
             WHERE model_sessions.profile_json=excluded.profile_json",
            params![job_id, token_hash, expires_at, profile, now_iso()],
        )?;
        if changed == 0 {
            return Err(ModelSessionConflict.into());
        }
        Ok(())
    }

    pub fn authorize_model_session(
        &self,
        job_id: &str,
        token_hash: &str,
        now: i64,
    ) -> Result<Option<ModelSession>> {
        let conn = self.connect()?;
        let row = conn.query_row(
            "SELECT profile_json,paused FROM model_sessions WHERE job_id=?1 AND token_hash=?2 AND expires_at>?3",
            params![job_id, token_hash, now],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, bool>(1)?)),
        ).optional()?;
        row.map(|(profile, paused)| {
            Ok(ModelSession {
                job_id: job_id.to_owned(),
                profile: serde_json::from_str(&profile)?,
                paused,
            })
        })
        .transpose()
    }

    pub fn reserve_model_operation(
        &self,
        job_id: &str,
        operation_id: &str,
        unit_id: &str,
        request_hash: &str,
        purpose: &str,
    ) -> Result<ModelReservation> {
        if !matches!(purpose, "primary" | "repair") {
            bail!("invalid model operation purpose");
        }
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let existing: Option<(String,String,String)> = tx
            .query_row(
                "SELECT request_hash,unit_id,purpose FROM model_operations WHERE job_id=?1 AND operation_id=?2",
                params![job_id, operation_id],
                |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?)),
            )
            .optional()?;
        if let Some((hash, existing_unit, existing_purpose)) = existing {
            // Include unit and purpose in the caller's canonical request hash.
            tx.commit()?;
            return Ok(
                if hash == request_hash && existing_unit == unit_id && existing_purpose == purpose {
                    ModelReservation::Existing(
                        self.get_model_operation(job_id, operation_id)?
                            .context("reserved operation disappeared")?,
                    )
                } else {
                    ModelReservation::Conflict
                },
            );
        }
        let paused: bool = tx.query_row(
            "SELECT paused FROM model_sessions WHERE job_id=?1",
            [job_id],
            |r| r.get(0),
        )?;
        if paused {
            return Ok(ModelReservation::Paused);
        }
        let count: i64 = tx.query_row(
            "SELECT COUNT(*) FROM model_operations WHERE job_id=?1 AND unit_id=?2",
            params![job_id, unit_id],
            |r| r.get(0),
        )?;
        if (purpose == "primary" && count != 0) || (purpose == "repair" && count != 1) {
            return Ok(ModelReservation::UnitBudgetExceeded);
        }
        if purpose == "repair" {
            let succeeded: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM model_operations WHERE job_id=?1 AND unit_id=?2 AND purpose='primary' AND status='succeeded')", params![job_id,unit_id], |r| r.get(0))?;
            if !succeeded {
                return Ok(ModelReservation::UnitBudgetExceeded);
            }
        }
        tx.execute("INSERT INTO model_operations(job_id,operation_id,unit_id,request_hash,purpose,status,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,'queued',?6,?6)", params![job_id,operation_id,unit_id,request_hash,purpose,now_iso()])?;
        tx.commit()?;
        Ok(ModelReservation::Created(
            self.get_model_operation(job_id, operation_id)?
                .context("created operation disappeared")?,
        ))
    }

    pub fn get_model_operation(
        &self,
        job_id: &str,
        operation_id: &str,
    ) -> Result<Option<ModelOperation>> {
        let conn = self.connect()?;
        let row = conn.query_row("SELECT unit_id,purpose,status,result_json,error_code FROM model_operations WHERE job_id=?1 AND operation_id=?2", params![job_id,operation_id], |r| Ok((r.get::<_, String>(0)?,r.get::<_, String>(1)?,r.get::<_, String>(2)?,r.get::<_, Option<String>>(3)?,r.get::<_, Option<String>>(4)?))).optional()?;
        row.map(|(unit_id, purpose, status, result, error_code)| {
            Ok(ModelOperation {
                job_id: job_id.to_owned(),
                operation_id: operation_id.to_owned(),
                unit_id,
                purpose,
                status,
                result: result.map(|v| serde_json::from_str(&v)).transpose()?,
                error_code,
            })
        })
        .transpose()
    }

    /// Commit dispatch intent BEFORE touching the network. A pause fences queued work.
    pub fn claim_model_operation(&self, job_id: &str, operation_id: &str) -> Result<bool> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let claimed = tx.execute("UPDATE model_operations SET status='running',updated_at=?3 WHERE job_id=?1 AND operation_id=?2 AND status='queued' AND EXISTS(SELECT 1 FROM model_sessions WHERE job_id=?1 AND paused=0 AND expires_at>?4)", params![job_id,operation_id,now_iso(),chrono::Utc::now().timestamp()])? == 1;
        if !claimed {
            // A capability may expire while this request waits for a permit.
            // Leave a definitive no-dispatch receipt instead of queued forever.
            tx.execute("UPDATE model_operations SET status='cancelled',error_code='dispatch_fenced',updated_at=?3 WHERE job_id=?1 AND operation_id=?2 AND status='queued'", params![job_id,operation_id,now_iso()])?;
        }
        tx.commit()?;
        Ok(claimed)
    }

    pub fn finish_model_operation(
        &self,
        job_id: &str,
        operation_id: &str,
        status: &str,
        result: Option<&Value>,
        error_code: Option<&str>,
    ) -> Result<bool> {
        if !matches!(status, "succeeded" | "failed" | "ambiguous" | "cancelled") {
            bail!("invalid terminal model status");
        }
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let changed = tx.execute("UPDATE model_operations SET status=?3,result_json=?4,error_code=?5,updated_at=?6 WHERE job_id=?1 AND operation_id=?2 AND status IN ('queued','running')", params![job_id,operation_id,status,result.map(serde_json::to_string).transpose()?,error_code,now_iso()])? == 1;
        if changed
            && (status == "ambiguous"
                || matches!(
                    error_code,
                    Some(
                        "authentication_failed" | "payment_required" | "provider_rejected_request"
                    )
                ))
        {
            tx.execute(
                "UPDATE model_sessions SET paused=1 WHERE job_id=?1",
                [job_id],
            )?;
            tx.execute("UPDATE model_operations SET status='cancelled',error_code='job_paused',updated_at=?2 WHERE job_id=?1 AND status='queued'", params![job_id,now_iso()])?;
        }
        tx.commit()?;
        Ok(changed)
    }

    pub fn cancel_model_operation(&self, job_id: &str, operation_id: &str) -> Result<bool> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let changed = tx.execute("UPDATE model_operations SET status=CASE WHEN status='running' THEN 'ambiguous' ELSE 'cancelled' END,error_code='cancel_requested',updated_at=?3 WHERE job_id=?1 AND operation_id=?2 AND status IN ('queued','running')",params![job_id,operation_id,now_iso()])? == 1;
        tx.execute("UPDATE model_sessions SET paused=1 WHERE job_id=?1 AND EXISTS(SELECT 1 FROM model_operations WHERE job_id=?1 AND operation_id=?2 AND status='ambiguous')",params![job_id,operation_id])?;
        tx.execute("UPDATE model_operations SET status='cancelled',error_code='job_paused',updated_at=?2 WHERE job_id=?1 AND status='queued' AND EXISTS(SELECT 1 FROM model_sessions WHERE job_id=?1 AND paused=1)",params![job_id,now_iso()])?;
        tx.commit()?;
        Ok(changed)
    }

    /// Revoke a stopped worker's authority and fence every remaining dispatch.
    /// Completed receipts survive; active requests become billing-ambiguous.
    pub fn close_model_worker_session(&self, job_id: &str) -> Result<()> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        tx.execute(
            "UPDATE model_sessions SET expires_at=0,paused=1 WHERE job_id=?1",
            [job_id],
        )?;
        tx.execute("UPDATE model_operations SET status=CASE WHEN status='running' THEN 'ambiguous' ELSE 'cancelled' END,error_code='worker_stopped',updated_at=?2 WHERE job_id=?1 AND status IN ('queued','running')",params![job_id,now_iso()])?;
        tx.commit()?;
        Ok(())
    }

    /// Called once by the owning API on startup, not by jobsd or each request.
    pub fn recover_model_operations(&self) -> Result<usize> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        tx.execute("UPDATE model_sessions SET paused=1 WHERE job_id IN (SELECT job_id FROM model_operations WHERE status='running')", [])?;
        let count = tx.execute("UPDATE model_operations SET status='ambiguous',error_code='executor_restarted',updated_at=?1 WHERE status='running'", [now_iso()])?;
        tx.execute("UPDATE model_operations SET status='cancelled',error_code='executor_restarted_before_dispatch',updated_at=?1 WHERE status='queued'", [now_iso()])?;
        tx.commit()?;
        Ok(count)
    }
}
