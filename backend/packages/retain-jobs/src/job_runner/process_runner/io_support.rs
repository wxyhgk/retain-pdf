use std::collections::HashSet;
use std::fs::File;
use std::io::Read;
use std::sync::Arc;

use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::RwLock;

use crate::db::{PipelineAttemptCursor, PipelineStageObservation, PipelineUnitCommit};
use crate::job_events::persist_runtime_job_with_resources;
use crate::models::api::{redact_text, sensitive_values};
use crate::models::domain::{job_user_stage, now_iso, JobRuntimeState};

use crate::job_runner::JobPersistDeps;

use super::super::cancel_registry::is_cancel_requested_any;
use super::super::runtime_state::apply_job_stdout_line;
use super::super::stdout_parser::{
    parse_artifact_published_line, parse_pipeline_checkpoint_line,
    parse_pipeline_stage_observation_line, PipelineStageObservationLine, PublishedArtifactLine,
};
use super::checkpoint_commit::apply_durable_checkpoint;

pub(super) async fn read_stream<R>(reader: R, secrets: Vec<String>) -> Result<String>
where
    R: tokio::io::AsyncRead + Unpin,
{
    let mut lines = BufReader::new(reader).lines();
    let mut out = String::new();
    while let Some(line) = lines.next_line().await? {
        out.push_str(&redact_text(&line, &secrets));
        out.push('\n');
    }
    Ok(out)
}

pub(super) async fn read_stdout(
    persist: JobPersistDeps,
    canceled_jobs: Arc<RwLock<HashSet<String>>>,
    mut job: JobRuntimeState,
    stdout: tokio::process::ChildStdout,
    runtime_secrets: Vec<String>,
    extra_cancel_job_ids: Vec<String>,
) -> Result<(String, JobRuntimeState)> {
    let mut out = String::new();
    let mut secrets = sensitive_values(&job.request_payload);
    secrets.extend(runtime_secrets);
    let mut lines = BufReader::new(stdout).lines();
    let stage_key = durable_stage_key(job.stage.as_deref());
    let worker_id = format!(
        "{}:{}",
        job.job_id,
        job.pid
            .map(|pid| pid.to_string())
            .unwrap_or_else(|| "no-pid".to_string())
    );
    let mut pipeline_cursor = persist.db.acquire_pipeline_attempt(
        &job.job_id,
        &worker_id,
        stage_key,
        durable_stage_order(stage_key),
    )?;
    while let Some(raw_line) = lines.next_line().await? {
        let line = redact_text(&raw_line, &secrets);
        if is_cancel_requested_any(&canceled_jobs, &job.job_id, &extra_cancel_job_ids).await
            && !should_continue_after_cancel(&job)
        {
            break;
        }
        out.push_str(&line);
        out.push('\n');
        apply_job_stdout_line(&mut job, &line);
        if let Some(observation) = parse_pipeline_stage_observation_line(&line) {
            apply_durable_stage_observation(
                persist.db.as_ref(),
                &mut pipeline_cursor,
                observation,
            )?;
        }
        if let Some(observation) = parse_pipeline_checkpoint_line(&line) {
            apply_durable_checkpoint(
                persist.db.as_ref(),
                &mut pipeline_cursor,
                &mut job,
                observation,
            )?;
        }
        if let Some(artifact) = parse_artifact_published_line(&line) {
            apply_durable_artifact_commit(persist.db.as_ref(), &mut pipeline_cursor, artifact)?;
        }
        if is_cancel_requested_any(&canceled_jobs, &job.job_id, &extra_cancel_job_ids).await
            && !should_continue_after_cancel(&job)
        {
            break;
        }
        job.updated_at = now_iso();
        persist_runtime_job_with_resources(
            persist.db.as_ref(),
            &persist.data_root,
            &persist.output_root,
            &job,
        )?;
    }
    Ok((out, job))
}

fn apply_durable_artifact_commit(
    db: &crate::db::Db,
    cursor: &mut PipelineAttemptCursor,
    artifact: PublishedArtifactLine,
) -> Result<()> {
    if cursor.stage_key != "render" || artifact.artifact_key != "output_pdf" {
        return Ok(());
    }
    let path = std::path::Path::new(&artifact.path);
    if !path.is_file() {
        anyhow::bail!(
            "published render output is not a regular file for job {}: {}",
            cursor.job_id,
            path.display()
        );
    }
    let output_hash = sha256_file(path)?;
    let checkpoint = db.commit_pipeline_unit(
        cursor,
        &PipelineUnitCommit {
            unit_key: "output-pdf".to_string(),
            // Reserve the largest SQLite INTEGER order for the final artifact;
            // any future page units can remain naturally ordered below it.
            unit_order: i64::MAX as u64,
            page_index: None,
            page_hash: output_hash,
            producer_generation: None,
            payload: serde_json::json!({
                "unit_kind": "render_output",
                "artifact_key": artifact.artifact_key,
                "path": artifact.path,
                "hash_kind": "sha256",
            }),
        },
    )?;
    cursor.generation = checkpoint.generation;
    let checkpoint = db.complete_pipeline_stage(cursor)?;
    cursor.generation = checkpoint.generation;
    Ok(())
}

fn sha256_file(path: &std::path::Path) -> Result<String> {
    let mut file = File::open(path)
        .with_context(|| format!("failed to open durable artifact {}", path.display()))?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 1024 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .with_context(|| format!("failed to hash durable artifact {}", path.display()))?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(digest
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

fn apply_durable_stage_observation(
    db: &crate::db::Db,
    cursor: &mut PipelineAttemptCursor,
    observation: PipelineStageObservationLine,
) -> Result<()> {
    if observation.job_id.trim() != cursor.job_id {
        anyhow::bail!(
            "pipeline stage observation job mismatch: worker={} authoritative={}",
            observation.job_id,
            cursor.job_id
        );
    }
    let Some(stage_key) = durable_stage_key_for_observation(&observation) else {
        return Ok(());
    };
    let activate_stage = observation.substage.trim() != "render_prewarm";
    let next = db.observe_pipeline_stage(
        cursor,
        stage_key,
        durable_stage_order(stage_key),
        activate_stage,
        &PipelineStageObservation {
            producer_seq: observation.seq,
            producer_ts: observation.ts,
            event_type: observation.event_type,
            raw_stage: observation.stage,
            substage: optional_text(observation.substage),
            stage_detail: optional_text(observation.stage_detail),
            message: observation.message,
            provider: optional_text(observation.provider),
            provider_stage: optional_text(observation.provider_stage),
            progress_current: observation.progress_current,
            progress_total: observation.progress_total,
            progress_unit: optional_text(observation.progress_unit),
            payload: observation.payload,
        },
    )?;
    *cursor = next;
    Ok(())
}

fn durable_stage_key_for_observation(
    observation: &PipelineStageObservationLine,
) -> Option<&'static str> {
    match observation.user_stage.trim() {
        "ocr" => Some("ocr"),
        "translate" | "translation" => Some("translate"),
        "render" => Some("render"),
        _ => match job_user_stage(Some(observation.stage.trim())) {
            Some("ocr") => Some("ocr"),
            Some("translation") => Some("translate"),
            Some("render") => Some("render"),
            _ => None,
        },
    }
}

fn optional_text(value: String) -> Option<String> {
    let value = value.trim();
    (!value.is_empty()).then(|| value.to_string())
}

fn durable_stage_key(stage: Option<&str>) -> &'static str {
    match job_user_stage(stage) {
        Some("ocr") => "ocr",
        Some("translation") => "translate",
        Some("render") => "render",
        _ => "pipeline",
    }
}

fn durable_stage_order(stage: &str) -> u32 {
    match stage {
        "ocr" => 0,
        "translate" => 1,
        "render" => 2,
        _ => 0,
    }
}

pub(super) fn should_continue_after_cancel(job: &JobRuntimeState) -> bool {
    matches!(job.stage.as_deref(), Some("normalizing"))
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;
    use crate::db::Db;
    use crate::models::domain::JobSnapshot;
    use crate::models::request::CreateJobInput;

    #[test]
    fn published_render_output_commits_final_unit_and_completes_stage() {
        let root = std::env::temp_dir().join(format!(
            "retain-render-output-{}-{}",
            std::process::id(),
            fastrand::u64(..)
        ));
        fs::create_dir_all(&root).expect("fixture root");
        let db = Db::new(root.join("jobs.db"), root.clone());
        db.init().expect("init db");
        db.save_job(&JobSnapshot::new(
            "job-1".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        ))
        .expect("seed job");
        let output = root.join("output.pdf");
        fs::write(&output, b"stable rendered pdf bytes").expect("render output");
        let mut cursor = db
            .acquire_pipeline_attempt("job-1", "worker-a", "render", 2)
            .expect("render attempt");

        apply_durable_artifact_commit(
            &db,
            &mut cursor,
            PublishedArtifactLine {
                artifact_key: "output_pdf".to_string(),
                path: output.to_string_lossy().into_owned(),
            },
        )
        .expect("commit render output");

        let units = db
            .list_pipeline_units("job-1", cursor.attempt, "render")
            .expect("render units");
        assert_eq!(units.len(), 1);
        assert_eq!(units[0].unit_key, "output-pdf");
        assert_eq!(units[0].page_index, None);
        assert_eq!(units[0].payload["unit_kind"], "render_output");
        let stage = db
            .running_pipeline_stage_state("job-1")
            .expect("stage state")
            .expect("running attempt stage");
        assert_eq!(stage.stage_key, "render");
        assert_eq!(stage.status, "completed");

        let _ = fs::remove_dir_all(root);
    }
}
