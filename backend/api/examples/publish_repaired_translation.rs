//! Publish an already-verified offline repair as a NEW durable attempt.
//! Does not invoke providers, overwrite historical snapshots, or change job status.
//! Usage: publish_repaired_translation DATA_ROOT JOB_ID
use std::{fs, path::PathBuf};

use anyhow::{ensure, Context, Result};
use rusqlite::{params, Connection, OpenFlags};
use rust_api::db::{Db, PipelineUnitCommit};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

fn hash(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn main() -> Result<()> {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    ensure!(args.len() == 2, "expected DATA_ROOT JOB_ID");
    let data_root = PathBuf::from(&args[0]).canonicalize()?;
    let job_id = &args[1];
    ensure!(
        !job_id.contains('/') && !job_id.contains('\\') && !job_id.starts_with('.'),
        "invalid job id"
    );
    let root = data_root.join("jobs").join(job_id).canonicalize()?;
    ensure!(
        root.starts_with(data_root.join("jobs")),
        "job escapes data root"
    );
    let report: Value = serde_json::from_slice(&fs::read(
        root.join("artifacts/mineru-cross-page-repair.json"),
    )?)?;
    ensure!(
        report["job_id"].as_str() == Some(job_id),
        "repair job mismatch"
    );
    ensure!(
        report["provider_calls"].as_u64() == Some(0),
        "not an offline repair"
    );
    let checkpoint: Value = serde_json::from_slice(&fs::read(
        root.join("translated/translation-checkpoint.v1.json"),
    )?)?;
    ensure!(
        checkpoint["status"] == "complete",
        "checkpoint is not complete"
    );
    // 死信留在 pending_item_count 里(重翻靠它捞回来)但不阻断发布，所以问的是
    // blocking_item_count；旧 checkpoint 没有这个字段，退回 pending。
    let blocking = checkpoint["progress"]["blocking_item_count"]
        .as_u64()
        .or_else(|| checkpoint["progress"]["pending_item_count"].as_u64());
    ensure!(blocking == Some(0), "checkpoint has blocking items");
    let normalized = fs::read(root.join("ocr/normalized/document.v1.json"))?;
    ensure!(
        checkpoint["normalized_document_sha256"].as_str() == Some(hash(&normalized).as_str()),
        "document hash mismatch"
    );
    let generation = checkpoint["generation"]
        .as_u64()
        .context("missing producer generation")?;
    let translated = root.join("translated");
    let mut units = Vec::new();
    for page in checkpoint["pages"]
        .as_array()
        .context("missing checkpoint pages")?
    {
        let name = page["path"].as_str().context("missing page path")?;
        ensure!(
            name.starts_with("page-")
                && name.ends_with(".json")
                && !name.contains('/')
                && !name.contains('\\'),
            "invalid page path"
        );
        let bytes = fs::read(translated.join(name))?;
        let page_hash = hash(&bytes);
        ensure!(
            page["page_hash"].as_str() == Some(page_hash.as_str()),
            "page hash mismatch: {name}"
        );
        let snapshot = translated
            .join(".translation-checkpoints")
            .join(format!("generation-{generation}"))
            .join(name);
        ensure!(
            hash(&fs::read(snapshot)?) == page_hash,
            "snapshot hash mismatch"
        );
        let items: Vec<Value> = serde_json::from_slice(&bytes)?;
        let Some(last) = page["last_committed_unit"].as_object() else {
            continue;
        };
        units.push(PipelineUnitCommit {
            unit_key: last["unit_key"].as_str().context("missing unit key")?.into(),
            unit_order: last["unit_order"].as_u64().context("missing unit order")?,
            page_index: Some(page["page_index"].as_u64().context("missing page index")? as u32),
            page_hash,
            producer_generation: Some(generation),
            payload: json!({"repair": "mineru_cross_page", "changed_item_ids": items.iter().map(|item| item["item_id"].clone()).collect::<Vec<_>>()}),
        });
    }
    ensure!(!units.is_empty(), "no repaired pages");
    let db_path = data_root.join("db/jobs.db");
    let connection = Connection::open_with_flags(&db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let status: String = connection.query_row(
        "SELECT status_json FROM jobs WHERE job_id=?1",
        [job_id],
        |row| row.get(0),
    )?;
    ensure!(
        status == "\"succeeded\"",
        "only succeeded jobs can be repaired"
    );
    let active: i64 = connection.query_row(
        "SELECT COUNT(*) FROM pipeline_attempts WHERE job_id=?1 AND status='running'",
        [job_id],
        |row| row.get(0),
    )?;
    ensure!(active == 0, "job has an active worker");
    let already: i64 = connection.query_row(
        "SELECT COUNT(*) FROM pipeline_units WHERE job_id=?1 AND producer_generation=?2",
        params![job_id, generation],
        |row| row.get(0),
    )?;
    ensure!(already == 0, "repair generation was already published");
    drop(connection);
    let db = Db::new(db_path, data_root);
    let cursor =
        db.acquire_pipeline_attempt(job_id, "offline-mineru-page-repair", "translate", 2)?;
    let committed = db.commit_pipeline_units(&cursor, &units)?;
    let completed = db.complete_pipeline_stage(&rust_api::db::PipelineAttemptCursor {
        generation: committed.generation,
        ..cursor
    })?;
    db.finish_latest_pipeline_attempt(job_id, "succeeded")?;
    println!(
        "published repair: job={job_id} attempt={} pages={} generation={generation}",
        completed.attempt,
        units.len()
    );
    Ok(())
}
