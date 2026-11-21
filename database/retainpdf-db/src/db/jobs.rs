use anyhow::{Context, Result};
use rusqlite::{params, params_from_iter, types::Value, OptionalExtension, Row};

use crate::models::domain::{
    JobFailureInfo, JobSnapshot, JobStatusKind, WorkflowKind,
};

use super::rows::{row_to_job_snapshot, JOB_SELECT_SQL, JOB_SELECT_SQL_WITH_GENERATION};
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
    /// 小写的子串：所属文档的标题（`documents.title`，ASCII 小写后）含这段就算命中。
    /// 命中和 `matches` 回调是「或」的关系，所以只给要搜书名的调用方；会连带 join 上传表。
    pub title_contains: Option<&'a str>,
    pub limit: Option<u32>,
    pub offset: u32,
    /// 只要这个账号的任务（多用户模式）；None = 不按归属过滤。
    pub owner: Option<&'a str>,
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
            conditions.push("jobs.status = ?");
            values.push(status.as_str().to_string().into());
        }
        if let Some(workflow) = selection.workflow {
            conditions.push("jobs.workflow = ?");
            values.push(workflow.as_str().to_string().into());
        }
        if let Some(owner) = selection.owner {
            conditions.push("jobs.owner_user_id = ?");
            values.push(owner.to_string().into());
        }
        if selection.exclude_ocr {
            conditions.push("jobs.workflow != ?");
            values.push(WorkflowKind::Ocr.as_str().to_string().into());
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
        let joined = selection.include_upload_filename || selection.title_contains.is_some();
        let query = if joined {
            values.push(UPLOAD_ID_WHITESPACE.to_string().into());
            // 第 28 列：书名命中（没要搜书名时恒为 0）。命中条件放在 JOIN 里，参数顺序跟着文本走。
            let (title_column, title_join) = match selection.title_contains {
                Some(needle) => {
                    values.push(needle.to_string().into());
                    (
                        "documents.document_id IS NOT NULL",
                        " LEFT JOIN documents ON documents.document_id = uploads.content_hash \
                         AND instr(lower(documents.title), ?) > 0",
                    )
                }
                None => ("0", ""),
            };
            format!(
                "SELECT candidates.*, uploads.filename, uploads.stored_path, uploads.bytes, \
                 uploads.page_count, uploads.uploaded_at, uploads.developer_mode, uploads.content_hash, \
                 {title_column} \
                 FROM ({JOB_SELECT_SQL} {predicate}) AS candidates \
                 LEFT JOIN uploads ON uploads.upload_id = trim(candidates.upload_id, ?){title_join} \
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
                    tracing::warn!("[db] skipping malformed job row during select_jobs: {error}");
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
            let title_hit = selection.title_contains.is_some()
                && row.get::<_, i64>(28).map(|hit| hit != 0).unwrap_or(false);
            if !title_hit && !matches(&job, upload_filename.as_deref()) {
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
        // 「没有这条记录」和「有记录但读不出来」要分开报：后者通常是进程版本比写入方旧（新任务带了
        // 它不认识的字段），报成 not found 会让人去查错地方。
        // 同一条语句顺带取 run_generation（追加在 JOB_SELECT_SQL 末尾，列号 21）：CAS 写拿它认「哪一次运行」。
        match conn.query_row(
            &format!("{JOB_SELECT_SQL_WITH_GENERATION} WHERE jobs.job_id = ?1"),
            params![job_id],
            |row| {
                let mut job = row_to_job_snapshot(row)?;
                job.run_generation = row.get::<_, i64>(21)?.max(0) as u64;
                Ok(job)
            },
        ) {
            Ok(job) => Ok(job),
            // 保留原始错误：调用方按 QueryReturnedNoRows 判 404。
            Err(error @ rusqlite::Error::QueryReturnedNoRows) => {
                Err(error).with_context(|| format!("job not found: {job_id}"))
            }
            Err(error) => Err(error).with_context(|| {
                format!("job {job_id} exists but could not be read (is this process older than the one that wrote it?)")
            }),
        }
    }

    pub fn list_jobs(
        &self,
        limit: u32,
        offset: u32,
        status: Option<&JobStatusKind>,
        workflow: Option<&WorkflowKind>,
    ) -> Result<Vec<JobSnapshot>> {
        let conn = self.connect()?;
        let status_text = status.map(JobStatusKind::as_str);
        let workflow_text = workflow.map(WorkflowKind::as_str);
        let base_sql = JOB_SELECT_SQL;
        let query = match (status_text.as_ref(), workflow_text.as_ref()) {
            (Some(_), Some(_)) => format!("{base_sql} WHERE jobs.status = ?1 AND jobs.workflow = ?2 ORDER BY jobs.updated_at DESC, jobs.job_id DESC LIMIT ?3 OFFSET ?4"),
            (Some(_), None) => format!("{base_sql} WHERE jobs.status = ?1 ORDER BY jobs.updated_at DESC, jobs.job_id DESC LIMIT ?2 OFFSET ?3"),
            (None, Some(_)) => format!("{base_sql} WHERE jobs.workflow = ?1 ORDER BY jobs.updated_at DESC, jobs.job_id DESC LIMIT ?2 OFFSET ?3"),
            (None, None) => format!("{base_sql} ORDER BY jobs.updated_at DESC, jobs.job_id DESC LIMIT ?1 OFFSET ?2"),
        };
        let mut stmt = conn.prepare(&query)?;
        let rows = match (status_text.as_ref(), workflow_text.as_ref()) {
            (Some(status_text), Some(workflow_text)) => stmt.query_map(
                params![status_text, workflow_text, limit as i64, offset as i64],
                row_to_job_snapshot,
            )?,
            (Some(status_text), None) => stmt.query_map(
                params![status_text, limit as i64, offset as i64],
                row_to_job_snapshot,
            )?,
            (None, Some(workflow_text)) => stmt.query_map(
                params![workflow_text, limit as i64, offset as i64],
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
                    tracing::warn!("[db] skipping malformed job row during list_jobs: {error}");
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
        // 和 select_jobs / list_jobs 一样：读不出来的行跳过并记日志，一本书里有一条坏行不该让整本书的任务列表打不开。
        let mut jobs = Vec::new();
        for row in rows {
            match row {
                Ok(job) => jobs.push(job),
                Err(error) => {
                    tracing::warn!(
                        "[db] skipping malformed job row during list_jobs_for_document: {error}"
                    );
                }
            }
        }
        Ok(jobs)
    }

    /// job 归属的 document(= 源文件字节的 sha256)。
    ///
    /// `JOB_SELECT_SQL` 不选这一列，所以 `JobSnapshot` 上拿不到。单独查一次比
    /// 给所有 job 读路径多带一列便宜 —— 只有「找同一本书的其它 job」这一个
    /// 场景需要它。
    ///
    /// 归属是 `link_job_to_document` 在建 job 之后补写的，也可能被回填补上，
    /// 所以**空字符串和 NULL 都当作没归属**，返回 None。
    /// 还没归属到书的任务（`document_id` 是 NULL 或空串），按建任务时间排。
    pub fn jobs_without_document(&self) -> Result<Vec<String>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT job_id FROM jobs WHERE document_id IS NULL OR document_id = '' ORDER BY created_at",
        )?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
    }

    pub fn document_id_for_job(&self, job_id: &str) -> Result<Option<String>> {
        let conn = self.connect()?;
        let document_id: Option<String> = conn
            .query_row(
                "SELECT document_id FROM jobs \
                 WHERE job_id = ?1 AND document_id IS NOT NULL AND document_id <> ''",
                params![job_id],
                |row| row.get(0),
            )
            .optional()?;
        Ok(document_id)
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
    /// translation (including the reviewer key) or OCR credential. Historical terminal jobs are deliberately
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
                OR json_extract(request_json, '$.translation.reviewer_credential_ref') = ?1
                OR json_extract(request_json, '$.ocr.credential_ref') = ?1
              )
            "#,
            params![credential_ref],
            |row| row.get(0),
        )?;
        Ok(count.max(0) as u64)
    }

    /// 只读一个任务的状态，不解码整行（取消检查这种高频、只关心状态的地方用）。没有这条任务返回 None。
    pub fn job_status(&self, job_id: &str) -> Result<Option<JobStatusKind>> {
        let conn = self.connect()?;
        let raw: Option<String> = conn
            .query_row("SELECT status FROM jobs WHERE job_id = ?1", params![job_id], |row| row.get(0))
            .optional()?;
        let Some(raw) = raw else {
            return Ok(None);
        };
        let status = super::rows::parse_status_text(&raw)
            .with_context(|| format!("unreadable status for job {job_id}: {raw}"))?;
        Ok(Some(status))
    }

    pub fn list_jobs_with_status(&self, status: &JobStatusKind) -> Result<Vec<JobSnapshot>> {
        let conn = self.connect()?;
        let status_text = status.as_str();
        let query =
            format!("{JOB_SELECT_SQL} WHERE jobs.status = ?1 ORDER BY jobs.updated_at DESC");
        let mut stmt = conn.prepare(&query)?;
        let rows = stmt.query_map(params![status_text], row_to_job_snapshot)?;
        let mut jobs = Vec::new();
        for row in rows {
            match row {
                Ok(job) => jobs.push(job),
                Err(error) => {
                    tracing::warn!(
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
        let status_text = status.as_str();
        let mut stmt = conn.prepare(
            r#"
            SELECT job_id, pid, stage, updated_at, worker_identity
            FROM jobs
            WHERE status = ?1
            ORDER BY updated_at DESC
            "#,
        )?;
        let rows = stmt.query_map(params![status_text], job_process_record_from_row)?;
        let mut jobs = Vec::new();
        for row in rows {
            jobs.push(row?);
        }
        Ok(jobs)
    }

    /// 状态为 `status`、库里记的 worker pid 是 `pid` 的任务（正常情况下至多一条）。
    /// jobsd 的 terminate 接口据此判断这个 pid 是不是它登记过的 worker。
    pub fn list_job_process_records_with_pid(
        &self,
        pid: u32,
        status: &JobStatusKind,
    ) -> Result<Vec<JobProcessRecord>> {
        let conn = self.connect()?;
        let status_text = status.as_str();
        let mut stmt = conn.prepare(
            r#"
            SELECT job_id, pid, stage, updated_at, worker_identity
            FROM jobs
            WHERE pid = ?1 AND status = ?2
            "#,
        )?;
        let rows = stmt.query_map(params![pid as i64, status_text], job_process_record_from_row)?;
        let mut jobs = Vec::new();
        for row in rows {
            jobs.push(row?);
        }
        Ok(jobs)
    }

    /// 一个任务的 pid 和进程身份；任务不存在时 None。
    pub fn job_process_record(&self, job_id: &str) -> Result<Option<JobProcessRecord>> {
        let conn = self.connect()?;
        conn.query_row(
            "SELECT job_id, pid, stage, updated_at, worker_identity FROM jobs WHERE job_id = ?1",
            params![job_id],
            job_process_record_from_row,
        )
        .optional()
        .map_err(Into::into)
    }

    /// 记下刚 spawn 的 worker 的进程身份（`<pid>@<指纹>`，读不到时 None）。
    ///
    /// 要在把新 pid 写进任务行**之前**调：身份串自带 pid，中间崩了，库里的旧 pid 和新身份对不上，
    /// 核对时按「没有身份信息」处理；反过来先写 pid 再写身份，中间崩了新 worker 就没有身份可核对。
    /// 任务行的 upsert（`save_job` 等）不碰这一列，所以清 pid 时它会留着，但它和下一个 pid 对不上，不会被误认。
    pub fn record_worker_identity(&self, job_id: &str, identity: Option<&str>) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            "UPDATE jobs SET worker_identity = ?2 WHERE job_id = ?1",
            params![job_id, identity],
        )?;
        Ok(())
    }

    pub fn recover_stale_running_job(
        &self,
        job_id: &str,
        detail: &str,
        timestamp: &str,
    ) -> Result<()> {
        let conn = self.connect()?;
        let failed_status = JobStatusKind::Failed.as_str();
        // 查目录而不是在这里写死:新增失败类型只该改 job_failure_catalogue 一处。
        let recovery = retainpdf_core::job_failure_catalogue::recovery_for("worker_process_missing");
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
        // 运行信息（v33 起）只存进入当前阶段、最后出错的时间；当前阶段、结束原因、最终失败从下面这几列算。
        // 以前这里整块覆盖 runtime_json，连阶段历史一起清空、耗时写成空；现在阶段历史留着，耗时读的时候照常算。
        conn.execute(
            r#"
            UPDATE jobs
            SET status = ?1,
                updated_at = ?2,
                finished_at = ?3,
                pid = NULL,
                error = ?4,
                stage = 'failed',
                stage_detail = 'startup stale running job recovered',
                stage_entered_at = ?3,
                last_error_at = ?3,
                failure_json = ?5
            WHERE job_id = ?6
            "#,
            params![
                failed_status,
                timestamp,
                timestamp,
                detail,
                serde_json::to_string(&failure)?,
                job_id,
            ],
        )?;
        Ok(())
    }

    pub fn count_jobs_with_status(&self, status: &JobStatusKind) -> Result<i64> {
        let conn = self.connect()?;
        let status_text = status.as_str();
        let count = conn.query_row(
            "SELECT COUNT(*) FROM jobs WHERE status = ?1",
            params![status_text],
            |row| row.get::<_, i64>(0),
        )?;
        Ok(count)
    }
}

fn job_process_record_from_row(row: &Row<'_>) -> rusqlite::Result<JobProcessRecord> {
    Ok(JobProcessRecord {
        job_id: row.get(0)?,
        pid: row.get::<_, Option<i64>>(1)?.map(|value| value as u32),
        stage: row.get(2)?,
        updated_at: row.get(3)?,
        worker_identity: row.get(4)?,
    })
}
