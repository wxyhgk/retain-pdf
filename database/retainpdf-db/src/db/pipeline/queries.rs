use anyhow::Result;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;

use super::types::{
    PipelineCheckpoint, PipelineDispatchRecord, PipelineStageState, PipelineUnitRecord,
};
use crate::db::Db;

impl Db {
    pub fn has_pipeline_attempt(&self, job_id: &str) -> Result<bool> {
        let conn = self.connect()?;
        let exists = conn
            .query_row(
                "SELECT 1 FROM pipeline_attempts WHERE job_id = ?1 LIMIT 1",
                params![job_id],
                |_| Ok(()),
            )
            .optional()?
            .is_some();
        Ok(exists)
    }

    pub fn has_running_pipeline_attempt(&self, job_id: &str) -> Result<bool> {
        let conn = self.connect()?;
        let exists = conn
            .query_row(
                r#"
                SELECT 1 FROM pipeline_attempts
                WHERE job_id = ?1 AND status = 'running'
                ORDER BY attempt DESC LIMIT 1
                "#,
                params![job_id],
                |_| Ok(()),
            )
            .optional()?
            .is_some();
        Ok(exists)
    }

    pub fn running_pipeline_stage_key(&self, job_id: &str) -> Result<Option<String>> {
        let conn = self.connect()?;
        conn.query_row(
            r#"
            SELECT current_stage FROM pipeline_attempts
            WHERE job_id = ?1 AND status = 'running'
            ORDER BY attempt DESC LIMIT 1
            "#,
            params![job_id],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .map(|value| value.flatten())
        .map_err(Into::into)
    }

    pub fn list_resumable_pipeline_job_ids(&self) -> Result<Vec<String>> {
        let conn = self.connect()?;
        let queued = crate::models::domain::JobStatusKind::Queued.as_str();
        let mut stmt = conn.prepare(
            r#"
            SELECT DISTINCT jobs.job_id
            FROM jobs
            JOIN pipeline_attempts ON pipeline_attempts.job_id = jobs.job_id
            WHERE jobs.status = ?1 AND pipeline_attempts.status = 'running'
            -- 排除 OCR 子任务:它由父任务的 driver 内联执行,不该被独立驱动。
            --
            -- 子任务 id 是 `{parent}-ocr`(见 translation_flow_child.rs 的
            -- create_ocr_child_job),而 driver registry 按 **id** 去重——父 driver
            -- 注册的是父 id,拦不住这里再给子任务起一个 driver。两个 driver 同时
            -- 跑同一个子任务,就是两次 OCR 提交、两份钱。
            --
            -- 只在父任务那一行**确实存在**时才排除:名字碰巧叫 `foo-ocr` 的独立
            -- OCR 任务不受影响。
              AND NOT EXISTS (
                SELECT 1 FROM jobs AS parent
                WHERE jobs.job_id = parent.job_id || '-ocr'
              )
            ORDER BY jobs.updated_at, jobs.job_id
            "#,
        )?;
        let rows = stmt.query_map(params![queued], |row| row.get::<_, String>(0))?;
        rows.collect::<std::result::Result<Vec<_>, _>>()
            .map_err(Into::into)
    }

    /// Queued jobs that never started a durable attempt and therefore are
    /// invisible to [`Self::list_resumable_pipeline_job_ids`].
    ///
    /// Startup-only contract: right after a runtime (re)start no driver task
    /// exists for any queued job, so every id returned here is safe to
    /// re-drive exactly once. Never call this outside startup: a live driver
    /// may own the job and a second driver would duplicate execution.
    pub fn list_stuck_queued_job_ids(&self) -> Result<Vec<String>> {
        let conn = self.connect()?;
        let queued = crate::models::domain::JobStatusKind::Queued.as_str();
        let mut stmt = conn.prepare(
            r#"
            SELECT jobs.job_id
            FROM jobs
            WHERE jobs.status = ?1
              AND NOT EXISTS (
                SELECT 1 FROM pipeline_attempts
                WHERE pipeline_attempts.job_id = jobs.job_id
                  AND pipeline_attempts.status = 'running'
              )
            -- 排除 OCR 子任务:它由父任务的 driver 内联执行,不该被独立驱动。
            --
            -- 子任务 id 是 `{parent}-ocr`(见 translation_flow_child.rs 的
            -- create_ocr_child_job),而 driver registry 按 **id** 去重——父 driver
            -- 注册的是父 id,拦不住这里再给子任务起一个 driver。两个 driver 同时
            -- 跑同一个子任务,就是两次 OCR 提交、两份钱。
            --
            -- 只在父任务那一行**确实存在**时才排除:名字碰巧叫 `foo-ocr` 的独立
            -- OCR 任务不受影响。
              AND NOT EXISTS (
                SELECT 1 FROM jobs AS parent
                WHERE jobs.job_id = parent.job_id || '-ocr'
              )
            ORDER BY jobs.updated_at, jobs.job_id
            "#,
        )?;
        let rows = stmt.query_map(params![queued], |row| row.get::<_, String>(0))?;
        rows.collect::<std::result::Result<Vec<_>, _>>()
            .map_err(Into::into)
    }

    /// 父任务已终态、自己却没收尾的 OCR 子任务：行还停在 queued/running，或者 attempt 还是
    /// running。返回 `(子任务 id, 父任务状态)`。
    ///
    /// 子任务由父 driver 内联执行，lifecycle 只收尾父任务自己的 attempt；子任务的 attempt
    /// 历史上从没人收尾。父任务都结束了，不会再有 driver 来推进它们（恢复查询也把
    /// `{parent}-ocr` 排除在外），只能在启动时一次性落终态。
    ///
    /// 启动专用：父任务还在 queued/running 的子任务不碰 —— 它们会随父任务恢复。
    pub fn list_unsettled_ocr_children(
        &self,
    ) -> Result<Vec<(String, crate::models::domain::JobStatusKind)>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT child.job_id, parent.status
            FROM jobs AS child
            JOIN jobs AS parent ON child.job_id = parent.job_id || '-ocr'
            WHERE parent.status IN ('succeeded', 'failed', 'canceled')
              AND (
                child.status IN ('queued', 'running')
                OR EXISTS (
                    SELECT 1 FROM pipeline_attempts a
                    WHERE a.job_id = child.job_id AND a.status = 'running'
                )
              )
            ORDER BY child.job_id
            "#,
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        let mut children = Vec::new();
        for row in rows {
            let (child_id, parent_status) = row?;
            children.push((
                child_id,
                super::super::rows::parse_status_text(&parent_status)
                    .ok_or_else(|| anyhow::anyhow!("unreadable status for job {parent_status}"))?,
            ));
        }
        Ok(children)
    }

    pub fn running_pipeline_stage_state(&self, job_id: &str) -> Result<Option<PipelineStageState>> {
        let conn = self.connect()?;
        conn.query_row(
            r#"
            SELECT a.attempt, a.current_stage, s.generation, s.status,
                   s.raw_stage, s.substage, s.stage_detail,
                   s.progress_current, s.progress_total, s.progress_unit,
                   s.producer_seq, s.observation_payload_json
            FROM pipeline_attempts a
            JOIN pipeline_stages s
              ON s.job_id = a.job_id AND s.attempt = a.attempt
             AND s.stage_key = a.current_stage
            WHERE a.job_id = ?1 AND a.status = 'running'
            ORDER BY a.attempt DESC LIMIT 1
            "#,
            params![job_id],
            |row| {
                let payload_json: String = row.get(11)?;
                Ok(PipelineStageState {
                    job_id: job_id.to_string(),
                    attempt: row.get::<_, i64>(0)? as u32,
                    stage_key: row.get(1)?,
                    generation: row.get::<_, i64>(2)? as u64,
                    status: row.get(3)?,
                    raw_stage: row.get(4)?,
                    substage: row.get(5)?,
                    stage_detail: row.get(6)?,
                    progress_current: row.get(7)?,
                    progress_total: row.get(8)?,
                    progress_unit: row.get(9)?,
                    producer_seq: row.get::<_, Option<i64>>(10)?.map(|value| value as u64),
                    payload: serde_json::from_str(&payload_json).unwrap_or(Value::Null),
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    pub fn pipeline_checkpoint(
        &self,
        job_id: &str,
        attempt: u32,
        stage_key: &str,
    ) -> Result<Option<PipelineCheckpoint>> {
        let conn = self.connect()?;
        conn.query_row(
            r#"
            SELECT a.generation, s.last_committed_unit_key,
                   s.last_committed_unit_order, s.last_page_hash
            FROM pipeline_attempts a
            JOIN pipeline_stages s ON s.job_id = a.job_id AND s.attempt = a.attempt
            WHERE a.job_id = ?1 AND a.attempt = ?2 AND s.stage_key = ?3
            "#,
            params![job_id, attempt, stage_key],
            |row| {
                Ok(PipelineCheckpoint {
                    job_id: job_id.to_string(),
                    attempt,
                    generation: row.get::<_, i64>(0)? as u64,
                    stage_key: stage_key.to_string(),
                    last_committed_unit_key: row.get(1)?,
                    last_committed_unit_order: row.get::<_, Option<i64>>(2)?.map(|v| v as u64),
                    last_page_hash: row.get(3)?,
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    pub fn list_pipeline_units(
        &self,
        job_id: &str,
        attempt: u32,
        stage_key: &str,
    ) -> Result<Vec<PipelineUnitRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT unit_key, unit_order, generation, producer_generation,
                   page_index, page_hash, payload_json
            FROM pipeline_units
            WHERE job_id = ?1 AND attempt = ?2 AND stage_key = ?3
            ORDER BY unit_order, unit_key
            "#,
        )?;
        let rows = stmt.query_map(params![job_id, attempt, stage_key], |row| {
            let payload_json: String = row.get(6)?;
            Ok(PipelineUnitRecord {
                attempt,
                unit_key: row.get(0)?,
                unit_order: row.get::<_, i64>(1)? as u64,
                generation: row.get::<_, i64>(2)? as u64,
                producer_generation: row.get::<_, Option<i64>>(3)?.map(|v| v as u64),
                page_index: row.get::<_, Option<i64>>(4)?.map(|v| v as u32),
                page_hash: row.get(5)?,
                payload: serde_json::from_str(&payload_json).unwrap_or(Value::Null),
            })
        })?;
        rows.collect::<std::result::Result<Vec<_>, _>>()
            .map_err(Into::into)
    }

    pub fn latest_pipeline_unit_for_page(
        &self,
        job_id: &str,
        stage_key: &str,
        page_index: u32,
    ) -> Result<Option<PipelineUnitRecord>> {
        let conn = self.connect()?;
        conn.query_row(
            r#"
            SELECT attempt, unit_key, unit_order, generation, producer_generation,
                   page_index, page_hash, payload_json
            FROM pipeline_units
            WHERE job_id = ?1 AND stage_key = ?2 AND page_index = ?3
              AND status = 'committed'
            ORDER BY attempt DESC, generation DESC
            LIMIT 1
            "#,
            params![job_id, stage_key, page_index],
            |row| {
                let payload_json: String = row.get(7)?;
                Ok(PipelineUnitRecord {
                    attempt: row.get::<_, i64>(0)? as u32,
                    unit_key: row.get(1)?,
                    unit_order: row.get::<_, i64>(2)? as u64,
                    generation: row.get::<_, i64>(3)? as u64,
                    producer_generation: row.get::<_, Option<i64>>(4)?.map(|v| v as u64),
                    page_index: row.get::<_, Option<i64>>(5)?.map(|v| v as u32),
                    page_hash: row.get(6)?,
                    payload: serde_json::from_str(&payload_json).unwrap_or(Value::Null),
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    pub fn pipeline_stage_state(
        &self,
        job_id: &str,
        attempt: u32,
        stage_key: &str,
    ) -> Result<Option<PipelineStageState>> {
        let conn = self.connect()?;
        conn.query_row(
            r#"
            SELECT generation, status, raw_stage, substage, stage_detail,
                   progress_current, progress_total, progress_unit,
                   producer_seq, observation_payload_json
            FROM pipeline_stages
            WHERE job_id = ?1 AND attempt = ?2 AND stage_key = ?3
            "#,
            params![job_id, attempt, stage_key],
            |row| {
                let payload_json: String = row.get(9)?;
                Ok(PipelineStageState {
                    job_id: job_id.to_string(),
                    attempt,
                    stage_key: stage_key.to_string(),
                    generation: row.get::<_, i64>(0)? as u64,
                    status: row.get(1)?,
                    raw_stage: row.get(2)?,
                    substage: row.get(3)?,
                    stage_detail: row.get(4)?,
                    progress_current: row.get(5)?,
                    progress_total: row.get(6)?,
                    progress_unit: row.get(7)?,
                    producer_seq: row.get::<_, Option<i64>>(8)?.map(|value| value as u64),
                    payload: serde_json::from_str(&payload_json).unwrap_or(Value::Null),
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    pub fn pipeline_dispatch(
        &self,
        job_id: &str,
        attempt: u32,
        dispatch_key: &str,
    ) -> Result<Option<PipelineDispatchRecord>> {
        let conn = self.connect()?;
        dispatch_record_by_identity(&conn, job_id, attempt, dispatch_key)
    }

    pub fn latest_pipeline_dispatch(
        &self,
        job_id: &str,
        dispatch_key: &str,
    ) -> Result<Option<PipelineDispatchRecord>> {
        super::tx::validate_identity("dispatch_key", dispatch_key)?;
        let conn = self.connect()?;
        let attempt = conn
            .query_row(
                r#"
                SELECT attempt FROM pipeline_dispatches
                WHERE job_id = ?1 AND dispatch_key = ?2
                ORDER BY attempt DESC LIMIT 1
                "#,
                params![job_id, dispatch_key],
                |row| row.get::<_, i64>(0),
            )
            .optional()?;
        attempt
            .map(|attempt| dispatch_record_by_identity(&conn, job_id, attempt as u32, dispatch_key))
            .transpose()
            .map(Option::flatten)
    }

    /// 用户看到的任务 `job_id` 的 OCR 提交派发记录。
    ///
    /// 记录写在真正调服务商的那个任务名下：book/translate 任务的 OCR 在 `{job_id}-ocr` 子任务里
    /// 内联执行（记录挂在子任务上），单独的 OCR 任务就是它自己。所有按用户任务编号找记录的地方
    /// （歧义闸门、失败诊断、解除歧义）都走这里，先看子任务，没有再看任务自己。
    pub fn latest_ocr_dispatch_for_job(
        &self,
        job_id: &str,
    ) -> Result<Option<PipelineDispatchRecord>> {
        for owner in [crate::models::domain::ocr_child_job_id(job_id), job_id.to_string()] {
            if let Some(record) = self.latest_pipeline_dispatch(&owner, "ocr-submit")? {
                return Ok(Some(record));
            }
        }
        Ok(None)
    }
}

pub(super) fn dispatch_record_by_identity(
    conn: &Connection,
    job_id: &str,
    attempt: u32,
    dispatch_key: &str,
) -> Result<Option<PipelineDispatchRecord>> {
    conn.query_row(
        r#"
        SELECT stage_key, generation, provider, operation, request_hash,
               status, receipt_json, ambiguity_reason
        FROM pipeline_dispatches
        WHERE job_id = ?1 AND attempt = ?2 AND dispatch_key = ?3
        "#,
        params![job_id, attempt, dispatch_key],
        |row| {
            let receipt_json: Option<String> = row.get(6)?;
            Ok(PipelineDispatchRecord {
                job_id: job_id.to_string(),
                attempt,
                stage_key: row.get(0)?,
                dispatch_key: dispatch_key.to_string(),
                generation: row.get::<_, i64>(1)? as u64,
                provider: row.get(2)?,
                operation: row.get(3)?,
                request_hash: row.get(4)?,
                status: row.get(5)?,
                receipt: receipt_json
                    .as_deref()
                    .and_then(|value| serde_json::from_str(value).ok()),
                ambiguity_reason: row.get(7)?,
            })
        },
    )
    .optional()
    .map_err(Into::into)
}
