use anyhow::{Context, Result};
use rusqlite::{params, params_from_iter, types::Value, Row};

use crate::models::domain::{
    JobFailureInfo, JobRuntimeInfo, JobSnapshot, JobStatusKind, WorkflowKind,
};

use super::rows::{row_to_job_snapshot, JOB_SELECT_SQL};
use super::{Db, JobProcessRecord};

/// Read-side selection. Pagination is applied to valid, matching snapshots, not
/// to raw rows which may subsequently be rejected by decoding or presentation.
#[derive(Default)]
pub struct JobListSelection<'a> {
    pub status: Option<&'a JobStatusKind>,
    pub workflow: Option<&'a WorkflowKind>,
    pub provider: Option<&'a str>,
    pub exclude_ocr: bool,
    pub job_ids: Option<&'a [String]>,
    /// Join source metadata only for callers that actually search filenames.
    pub include_upload_filename: bool,
    pub limit: Option<u32>,
    pub offset: u32,
}

// The Unicode White_Space set used by Rust str::trim, for legacy upload IDs.
const UPLOAD_ID_WHITESPACE: &str = "\t\n\u{b}\u{c}\r \u{85}\u{a0}\u{1680}\u{2000}\u{2001}\u{2002}\u{2003}\u{2004}\u{2005}\u{2006}\u{2007}\u{2008}\u{2009}\u{200a}\u{2028}\u{2029}\u{202f}\u{205f}\u{3000}";

#[cfg(test)]
#[path = "jobs/tests.rs"]
mod tests;

fn joined_upload_filename(row: &Row<'_>, data_root: &std::path::Path) -> Option<String> {
    // Match get_upload's failure behavior: malformed metadata or an unsafe path
    // must fall back to the source URL, not introduce a new searchable filename.
    let filename: String = row.get(21).ok()?;
    let stored_path: String = row.get(22).ok()?;
    row.get::<_, i64>(23).ok()?;
    row.get::<_, i64>(24).ok()?;
    row.get::<_, String>(25).ok()?;
    row.get::<_, i64>(26).ok()?;
    row.get::<_, String>(27).ok()?;
    crate::storage_paths::resolve_data_path(data_root, &stored_path).ok()?;
    Some(filename)
}

impl Db {
    /// Stream SQL-filtered candidates and stop after the requested matching page.
    /// The optional joined upload filename lets callers preserve domain-specific
    /// search rules without opening one upload query for every historical job.
    pub fn select_jobs(
        &self,
        selection: &JobListSelection<'_>,
        mut matches: impl FnMut(&JobSnapshot, Option<&str>) -> bool,
    ) -> Result<Vec<JobSnapshot>> {
        if selection.limit == Some(0) {
            return Ok(Vec::new());
        }
        let mut conditions = Vec::new();
        let mut values: Vec<Value> = Vec::new();
        if let Some(status) = selection.status {
            conditions.push("jobs.status_json = ?");
            values.push(serde_json::to_string(status)?.into());
        }
        if let Some(workflow) = selection.workflow {
            conditions.push("jobs.workflow = ?");
            values.push(serde_json::to_string(workflow)?.into());
        }
        if selection.exclude_ocr {
            conditions.push("jobs.workflow != ?");
            values.push(serde_json::to_string(&WorkflowKind::Ocr)?.into());
        }
        let provider = selection.provider.map(str::to_ascii_lowercase);
        if let Some(provider) = provider.as_ref() {
            // CASE guards malformed JSON: SQLite's json_extract alone would
            // otherwise fail the whole request instead of skipping diagnostics.
            conditions.push("CASE WHEN json_valid(artifacts.artifacts_json) THEN json_extract(artifacts.artifacts_json, '$.ocr_provider_diagnostics.provider') END = ?");
            values.push(provider.clone().into());
        }
        if let Some(ids) = selection.job_ids {
            // One bound JSON array avoids SQLite's parameter-count limit for
            // large exact-ID sets and keeps IDs out of interpolated SQL.
            conditions.push("jobs.job_id IN (SELECT value FROM json_each(?))");
            values.push(serde_json::to_string(ids)?.into());
        }
        let predicate = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };
        let query = if selection.include_upload_filename {
            values.push(UPLOAD_ID_WHITESPACE.to_string().into());
            format!(
                "SELECT candidates.*, uploads.filename, uploads.stored_path, uploads.bytes, \
                 uploads.page_count, uploads.uploaded_at, uploads.developer_mode, uploads.content_hash \
                 FROM ({JOB_SELECT_SQL} {predicate}) AS candidates \
                 LEFT JOIN uploads ON uploads.upload_id = trim(candidates.upload_id, ?) \
                 ORDER BY candidates.updated_at DESC, candidates.job_id DESC"
            )
        } else {
            format!("{JOB_SELECT_SQL} {predicate} ORDER BY jobs.updated_at DESC, jobs.job_id DESC")
        };
        let conn = self.connect()?;
        let mut stmt = conn.prepare(&query)?;
        let mut rows = stmt.query(params_from_iter(values))?;
        let mut jobs = Vec::new();
        let mut remaining_offset = selection.offset;
        while let Some(row) = rows.next()? {
            let job = match row_to_job_snapshot(row) {
                Ok(job) => job,
                Err(error) => {
                    eprintln!("[db] skipping malformed job row during select_jobs: {error}");
                    continue;
                }
            };
            // The complete artifacts object may be malformed even when its
            // provider string passed the SQL prefilter. Preserve typed semantics.
            if let Some(provider) = provider.as_deref() {
                let actual = job
                    .artifacts
                    .as_ref()
                    .and_then(|artifacts| artifacts.ocr_provider_diagnostics.as_ref())
                    .map(|diag| format!("{:?}", diag.provider).to_ascii_lowercase());
                if actual.as_deref() != Some(provider) {
                    continue;
                }
            }
            let upload_filename = selection
                .include_upload_filename
                .then(|| joined_upload_filename(row, &self.data_root))
                .flatten();
            if !matches(&job, upload_filename.as_deref()) {
                continue;
            }
            if remaining_offset > 0 {
                remaining_offset -= 1;
                continue;
            }
            jobs.push(job);
            if selection
                .limit
                .is_some_and(|limit| jobs.len() >= limit as usize)
            {
                break;
            }
        }
        Ok(jobs)
    }

    pub fn get_job(&self, job_id: &str) -> Result<JobSnapshot> {
        let conn = self.connect()?;
        let job = conn
            .query_row(
                &format!("{JOB_SELECT_SQL} WHERE jobs.job_id = ?1"),
                params![job_id],
                row_to_job_snapshot,
            )
            .with_context(|| format!("job not found: {job_id}"))?;
        Ok(job)
    }

    pub fn list_jobs(
        &self,
        limit: u32,
        offset: u32,
        status: Option<&JobStatusKind>,
        workflow: Option<&WorkflowKind>,
    ) -> Result<Vec<JobSnapshot>> {
        let conn = self.connect()?;
        let status_json = status.map(serde_json::to_string).transpose()?;
        let workflow_json = workflow.map(serde_json::to_string).transpose()?;
        let base_sql = JOB_SELECT_SQL;
        let query = match (status_json.as_ref(), workflow_json.as_ref()) {
            (Some(_), Some(_)) => format!("{base_sql} WHERE jobs.status_json = ?1 AND jobs.workflow = ?2 ORDER BY jobs.updated_at DESC, jobs.job_id DESC LIMIT ?3 OFFSET ?4"),
            (Some(_), None) => format!("{base_sql} WHERE jobs.status_json = ?1 ORDER BY jobs.updated_at DESC, jobs.job_id DESC LIMIT ?2 OFFSET ?3"),
            (None, Some(_)) => format!("{base_sql} WHERE jobs.workflow = ?1 ORDER BY jobs.updated_at DESC, jobs.job_id DESC LIMIT ?2 OFFSET ?3"),
            (None, None) => format!("{base_sql} ORDER BY jobs.updated_at DESC, jobs.job_id DESC LIMIT ?1 OFFSET ?2"),
        };
        let mut stmt = conn.prepare(&query)?;
        let rows = match (status_json.as_ref(), workflow_json.as_ref()) {
            (Some(status_json), Some(workflow_json)) => stmt.query_map(
                params![status_json, workflow_json, limit as i64, offset as i64],
                row_to_job_snapshot,
            )?,
            (Some(status_json), None) => stmt.query_map(
                params![status_json, limit as i64, offset as i64],
                row_to_job_snapshot,
            )?,
            (None, Some(workflow_json)) => stmt.query_map(
                params![workflow_json, limit as i64, offset as i64],
                row_to_job_snapshot,
            )?,
            (None, None) => {
                stmt.query_map(params![limit as i64, offset as i64], row_to_job_snapshot)?
            }
        };
        let mut jobs = Vec::new();
        for row in rows {
            match row {
                Ok(job) => jobs.push(job),
                Err(error) => {
                    eprintln!("[db] skipping malformed job row during list_jobs: {error}");
                }
            }
        }
        Ok(jobs)
    }

    pub fn list_jobs_for_document(
        &self,
        document_id: &str,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<JobSnapshot>> {
        let conn = self.connect()?;
        let query = format!(
            "{JOB_SELECT_SQL} WHERE jobs.document_id = ?1 \
             ORDER BY jobs.updated_at DESC, jobs.job_id DESC LIMIT ?2 OFFSET ?3"
        );
        let mut stmt = conn.prepare(&query)?;
        let rows = stmt.query_map(
            params![document_id, i64::from(limit), i64::from(offset)],
            row_to_job_snapshot,
        )?;
        let mut jobs = Vec::new();
        for row in rows {
            jobs.push(row?);
        }
        Ok(jobs)
    }

    pub fn count_jobs_for_document(&self, document_id: &str) -> Result<u64> {
        let conn = self.connect()?;
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM jobs WHERE document_id = ?1",
            params![document_id],
            |row| row.get(0),
        )?;
        Ok(count.max(0) as u64)
    }

    /// Counts persisted jobs whose replayable request references an opaque
    /// translation or OCR credential. Historical terminal jobs are deliberately
    /// included because retry and rerun rebuild work from `request_json`.
    pub fn count_jobs_referencing_credential(&self, credential_ref: &str) -> Result<u64> {
        let conn = self.connect()?;
        let count: i64 = conn.query_row(
            r#"
            SELECT COUNT(*)
            FROM jobs
            WHERE json_valid(request_json)
              AND (
                json_extract(request_json, '$.translation.credential_ref') = ?1
                OR json_extract(request_json, '$.ocr.credential_ref') = ?1
              )
            "#,
            params![credential_ref],
            |row| row.get(0),
        )?;
        Ok(count.max(0) as u64)
    }

    pub fn list_jobs_with_status(&self, status: &JobStatusKind) -> Result<Vec<JobSnapshot>> {
        let conn = self.connect()?;
        let status_json = serde_json::to_string(status)?;
        let query =
            format!("{JOB_SELECT_SQL} WHERE jobs.status_json = ?1 ORDER BY jobs.updated_at DESC");
        let mut stmt = conn.prepare(&query)?;
        let rows = stmt.query_map(params![status_json], row_to_job_snapshot)?;
        let mut jobs = Vec::new();
        for row in rows {
            match row {
                Ok(job) => jobs.push(job),
                Err(error) => {
                    eprintln!(
                        "[db] skipping malformed job row during list_jobs_with_status: {error}"
                    );
                }
            }
        }
        Ok(jobs)
    }

    pub fn delete_job(&self, job_id: &str) -> Result<bool> {
        let conn = self.connect()?;
        conn.execute("DELETE FROM events WHERE job_id = ?1", params![job_id])?;
        let changed = conn.execute("DELETE FROM jobs WHERE job_id = ?1", params![job_id])?;
        Ok(changed > 0)
    }

    pub fn list_job_process_records_with_status(
        &self,
        status: &JobStatusKind,
    ) -> Result<Vec<JobProcessRecord>> {
        let conn = self.connect()?;
        let status_json = serde_json::to_string(status)?;
        let mut stmt = conn.prepare(
            r#"
            SELECT job_id, pid, stage, updated_at
            FROM jobs
            WHERE status_json = ?1
            ORDER BY updated_at DESC
            "#,
        )?;
        let rows = stmt.query_map(params![status_json], |row| {
            Ok(JobProcessRecord {
                job_id: row.get(0)?,
                pid: row.get::<_, Option<i64>>(1)?.map(|value| value as u32),
                stage: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;
        let mut jobs = Vec::new();
        for row in rows {
            jobs.push(row?);
        }
        Ok(jobs)
    }

    pub fn recover_stale_running_job(
        &self,
        job_id: &str,
        detail: &str,
        timestamp: &str,
    ) -> Result<()> {
        let conn = self.connect()?;
        let failed_status_json = serde_json::to_string(&JobStatusKind::Failed)?;
        // 查目录而不是在这里写死:新增失败类型只该改 job_failure_catalogue 一处。
        let recovery = retain_core::job_failure_catalogue::recovery_for("worker_process_missing");
        let failure = JobFailureInfo {
            stage: "startup_recovery".to_string(),
            category: "worker_process_missing".to_string(),
            code: None,
            failed_stage: Some("startup_recovery".to_string()),
            failure_code: Some("worker_process_missing".to_string()),
            failure_category: Some("internal".to_string()),
            provider_stage: None,
            provider_code: None,
            summary: "后端启动时回收了遗留 running 任务".to_string(),
            root_cause: Some(detail.to_string()),
            retryable: true,
            upstream_host: None,
            provider: None,
            suggestion: Some("该任务对应的 worker 已不在运行；请重新提交或手动重试".to_string()),
            last_log_line: Some(detail.to_string()),
            raw_excerpt: Some(detail.to_string()),
            raw_error_excerpt: Some(detail.to_string()),
            raw_diagnostic: None,
            ai_diagnostic: None,
            resume_from: recovery.resume_from.map(|s| s.as_str().to_string()),
            recovery_hint: Some(recovery.hint.to_string()),
        };
        let runtime = JobRuntimeInfo {
            current_stage: Some("failed".to_string()),
            stage_started_at: Some(timestamp.to_string()),
            last_stage_transition_at: Some(timestamp.to_string()),
            terminal_reason: Some("failed".to_string()),
            last_error_at: Some(timestamp.to_string()),
            final_failure_category: Some(failure.category.clone()),
            final_failure_summary: Some(failure.summary.clone()),
            ..JobRuntimeInfo::default()
        };
        conn.execute(
            r#"
            UPDATE jobs
            SET status_json = ?1,
                updated_at = ?2,
                finished_at = ?3,
                pid = NULL,
                error = ?4,
                stage = 'failed',
                stage_detail = 'startup stale running job recovered',
                runtime_json = ?5,
                failure_json = ?6
            WHERE job_id = ?7
            "#,
            params![
                failed_status_json,
                timestamp,
                timestamp,
                detail,
                serde_json::to_string(&runtime)?,
                serde_json::to_string(&failure)?,
                job_id,
            ],
        )?;
        Ok(())
    }

    pub fn count_jobs_with_status(&self, status: &JobStatusKind) -> Result<i64> {
        let conn = self.connect()?;
        let status_json = serde_json::to_string(status)?;
        let count = conn.query_row(
            "SELECT COUNT(*) FROM jobs WHERE status_json = ?1",
            params![status_json],
            |row| row.get::<_, i64>(0),
        )?;
        Ok(count)
    }
}
