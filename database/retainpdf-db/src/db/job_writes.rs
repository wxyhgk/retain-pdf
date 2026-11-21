use anyhow::Result;
use rusqlite::{params, OptionalExtension, TransactionBehavior};

use crate::models::domain::{ocr_parent_job_id, JobArtifactRecord, JobSnapshot, JobStatusKind};
use crate::storage_paths::{
    collect_job_artifact_entries, normalize_job_paths_for_storage, restore_previous_output_pdf,
};

use super::Db;

/// [`Db::cas_save_job_as_new_run`] 的结果。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NewRunWrite {
    /// 写进去了，新的运行代次。
    Started(u64),
    /// 行还在，但已经不是读到时的状态 / 代次（别的请求先开跑了，或者那一次都跑完了）。
    Changed {
        current_status: Option<JobStatusKind>,
        current_generation: u64,
    },
    /// 行没了（任务被删了）。
    Missing,
}

pub(super) struct PreparedJobWrite {
    stored_job: JobSnapshot,
    artifacts_json: Option<String>,
    artifact_entries: Vec<JobArtifactRecord>,
    runtime_json: Option<String>,
    failure_json: Option<String>,
}

pub(super) fn prepare_job_write(db: &Db, job: &JobSnapshot) -> Result<PreparedJobWrite> {
    let mut stored_job = job.clone();
    stored_job.sync_runtime_state();
    // 原地重跑没跑成：接回上一份译文 PDF（见 storage_paths::restore_previous_output_pdf）。
    // 放在落库这一层，取消、失败、启动恢复……谁落的终态都一样。
    restore_previous_output_pdf(&mut stored_job, &db.data_root);
    normalize_job_paths_for_storage(&db.data_root, &mut stored_job)?;
    let artifacts_json = stored_job
        .artifacts
        .as_ref()
        .map(serde_json::to_string)
        .transpose()?;
    let artifact_entries = collect_job_artifact_entries(&stored_job, &db.data_root)?;
    let runtime_json = stored_job
        .runtime
        .as_ref()
        .map(serde_json::to_string)
        .transpose()?;
    let failure_json = stored_job
        .failure
        .as_ref()
        .map(serde_json::to_string)
        .transpose()?;
    Ok(PreparedJobWrite {
        stored_job,
        artifacts_json,
        artifact_entries,
        runtime_json,
        failure_json,
    })
}

pub(super) fn persist_prepared_job(
    tx: &rusqlite::Transaction<'_>,
    prepared: PreparedJobWrite,
) -> Result<()> {
    let PreparedJobWrite {
        stored_job,
        artifacts_json,
        artifact_entries,
        runtime_json,
        failure_json,
    } = prepared;
    tx.execute(
        r#"
        INSERT INTO jobs (
            job_id, workflow, status, created_at, updated_at, started_at, finished_at,
            upload_id, pid, command_json, request_json, error, stage, stage_detail,
            progress_current, progress_total, log_tail_json, result_json, runtime_json, failure_json,
            parent_job_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            -- OCR 子任务指向父任务（编号 `{父任务}-ocr`）；父任务不在库里时留空，免得外键挡住写入。
            (SELECT job_id FROM jobs WHERE job_id = ?21))
        ON CONFLICT(job_id) DO UPDATE SET
            workflow=excluded.workflow,
            status=excluded.status,
            parent_job_id=excluded.parent_job_id,
            created_at=excluded.created_at,
            updated_at=excluded.updated_at,
            started_at=excluded.started_at,
            finished_at=excluded.finished_at,
            upload_id=excluded.upload_id,
            pid=excluded.pid,
            command_json=excluded.command_json,
            request_json=excluded.request_json,
            error=excluded.error,
            stage=excluded.stage,
            stage_detail=excluded.stage_detail,
            progress_current=excluded.progress_current,
            progress_total=excluded.progress_total,
            log_tail_json=excluded.log_tail_json,
            result_json=excluded.result_json,
            runtime_json=excluded.runtime_json,
            failure_json=excluded.failure_json
        "#,
        params![
            stored_job.job_id,
            stored_job.workflow.as_str(),
            stored_job.status.as_str(),
            stored_job.created_at,
            stored_job.updated_at,
            stored_job.started_at,
            stored_job.finished_at,
            stored_job.upload_id,
            stored_job.pid.map(|v| v as i64),
            serde_json::to_string(&stored_job.command)?,
            serde_json::to_string(&stored_job.request_payload)?,
            stored_job.error,
            stored_job.stage,
            stored_job.stage_detail,
            stored_job.progress_current,
            stored_job.progress_total,
            serde_json::to_string(&stored_job.log_tail)?,
            serde_json::to_string(&stored_job.result)?,
            runtime_json,
            failure_json,
            ocr_parent_job_id(&stored_job.job_id),
        ],
    )?;
    persist_job_artifacts(tx, &stored_job.job_id, artifacts_json, &artifact_entries)
}

impl Db {
    pub fn save_job(&self, job: &JobSnapshot) -> Result<()> {
        let prepared = prepare_job_write(self, job)?;
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        persist_prepared_job(&tx, prepared)?;
        tx.commit()?;
        Ok(())
    }

    /// 开始新的一次运行：整行落库（同 `save_job`），并在**同一个事务里**把 `run_generation` 加一，
    /// 返回新的代次。建任务、原地重跑（`relaunch_in_place`）走这里；此后上一次运行遗留的 driver
    /// 拿着旧代次做的 CAS 写全部落空。
    ///
    /// 代次只在这里变：`save_job` / `cas_save_job` 的 upsert 都不写这一列，所以启动恢复等别的
    /// 整行写不会把它冲掉。
    pub fn save_job_as_new_run(&self, job: &JobSnapshot) -> Result<u64> {
        let prepared = prepare_job_write(self, job)?;
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        persist_prepared_job(&tx, prepared)?;
        tx.execute(
            "UPDATE jobs SET run_generation = run_generation + 1 WHERE job_id = ?1",
            params![job.job_id],
        )?;
        let generation: i64 = tx.query_row(
            "SELECT run_generation FROM jobs WHERE job_id = ?1",
            params![job.job_id],
            |row| row.get(0),
        )?;
        tx.commit()?;
        Ok(generation.max(0) as u64)
    }

    /// 原地重跑开始新的一次运行（`relaunch_in_place`）：只有库里这一行**还是读到时的样子**——状态是
    /// `expected_status`、代次是 `expected_generation`——才整行落库并把代次加一，判断和写在同一个
    /// `BEGIN IMMEDIATE` 事务里。两个请求读到同一个终态、一前一后来写，后一个看到的已经是前一个
    /// 落下的 queued（或前一个已经跑完，代次变了），写不进去。
    ///
    /// 不写时什么都不改；调用方据此报 409，并且不做「落库成功之后」才该做的事（挪文件、清子任务）。
    pub fn cas_save_job_as_new_run(
        &self,
        job: &JobSnapshot,
        expected_status: &JobStatusKind,
        expected_generation: u64,
    ) -> Result<NewRunWrite> {
        let prepared = prepare_job_write(self, job)?;
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let current: Option<(String, i64)> = tx
            .query_row(
                "SELECT status, run_generation FROM jobs WHERE job_id = ?1",
                params![job.job_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        let Some((status, generation)) = current else {
            return Ok(NewRunWrite::Missing);
        };
        let current_status = super::rows::parse_status_text(&status);
        let current_generation = generation.max(0) as u64;
        if current_status.as_ref() != Some(expected_status) || current_generation != expected_generation {
            return Ok(NewRunWrite::Changed {
                current_status,
                current_generation,
            });
        }
        persist_prepared_job(&tx, prepared)?;
        tx.execute(
            "UPDATE jobs SET run_generation = run_generation + 1 WHERE job_id = ?1",
            params![job.job_id],
        )?;
        tx.commit()?;
        Ok(NewRunWrite::Started(current_generation + 1))
    }

    /// 只读任务当前的运行代次；没有这条任务返回 None。
    pub fn job_run_generation(&self, job_id: &str) -> Result<Option<u64>> {
        let conn = self.connect()?;
        let generation: Option<i64> = conn
            .query_row(
                "SELECT run_generation FROM jobs WHERE job_id = ?1",
                params![job_id],
                |row| row.get(0),
            )
            .optional()?;
        Ok(generation.map(|value| value.max(0) as u64))
    }

    /// CAS terminal write: only succeeds if current DB status is in expected_statuses.
    /// Returns true if row was updated, false if already terminal (no-op).
    ///
    /// 行不存在也返回 false，**绝不 INSERT**：CAS 只更新已有的行。行没了说明任务被删了
    /// （强制删除运行中的任务 / 整本书），写的人（runner）应当当作「被取消」收手；
    /// 以前这里 upsert，删除后 runner 的下一次落库把任务复活成没有 document_id 的幽灵行，
    /// worker 接着在被重建的目录里跑完。新建行用 `save_job`。
    pub fn cas_save_job(&self, job: &JobSnapshot, expected_statuses: &[&str]) -> Result<bool> {
        // 和 `save_job` 同一份准备和同一条 upsert（以前这里把两样各抄了一遍）。
        let prepared = prepare_job_write(self, job)?;
        let mut conn = self.connect()?;
        // BEGIN IMMEDIATE，不能用默认的 DEFERRED：本事务先 SELECT 再写，
        // DEFERRED 会先拿 SHARED 读锁、写时再升级成写锁，而 SQLite 对**锁升级**
        // 不应用 busy_timeout（两个连接都持 SHARED 又都想升级时等待必然死锁，
        // 所以直接返回 SQLITE_BUSY）。表现就是配了 5s 超时却瞬间 "database is
        // locked"。IMMEDIATE 在 BEGIN 时就取写锁，此时 busy_timeout 正常生效。
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        // Check current status
        let current_row: Option<(String, i64)> = tx
            .query_row(
                "SELECT status, run_generation FROM jobs WHERE job_id = ?1",
                params![prepared.stored_job.job_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        let Some((current, current_generation)) = current_row else {
            return Ok(false);
        };
        let is_expected = expected_statuses.iter().any(|s| current == *s);
        if !is_expected {
            return Ok(false);
        }
        // 状态对得上还不够：行可能已经被原地重跑重新排队（状态又是 queued），而写的人
        // 还是上一次运行遗留的 driver。代次不同就是别人的运行，一律不写。
        if prepared.stored_job.run_generation != current_generation.max(0) as u64 {
            return Ok(false);
        }
        persist_prepared_job(&tx, prepared)?;
        tx.commit()?;
        Ok(true)
    }
}

fn persist_job_artifacts(
    tx: &rusqlite::Transaction<'_>,
    job_id: &str,
    artifacts_json: Option<String>,
    artifact_entries: &[JobArtifactRecord],
) -> Result<()> {
    if let Some(artifacts_json) = artifacts_json {
        tx.execute(
            r#"
            INSERT INTO artifacts (job_id, artifacts_json)
            VALUES (?1, ?2)
            ON CONFLICT(job_id) DO UPDATE SET
                artifacts_json=excluded.artifacts_json
            "#,
            params![job_id, artifacts_json],
        )?;
    } else {
        tx.execute("DELETE FROM artifacts WHERE job_id = ?1", params![job_id])?;
    }
    tx.execute(
        "DELETE FROM job_artifact_entries WHERE job_id = ?1",
        params![job_id],
    )?;
    for item in artifact_entries {
        tx.execute(
            r#"
            INSERT INTO job_artifact_entries (
                job_id, artifact_key, artifact_group, artifact_kind, relative_path,
                file_name, content_type, ready, size_bytes, checksum, source_stage,
                created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
            "#,
            params![
                item.job_id,
                item.artifact_key,
                item.artifact_group,
                item.artifact_kind,
                item.relative_path,
                item.file_name,
                item.content_type,
                if item.ready { 1 } else { 0 },
                item.size_bytes.map(|value| value as i64),
                item.checksum,
                item.source_stage,
                item.created_at,
                item.updated_at,
            ],
        )?;
    }
    Ok(())
}
