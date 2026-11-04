use std::path::Path;

use anyhow::{anyhow, Result};
use serde_json::Value;

use crate::job_runner::stage_contract::resolve_checkpoint_page_source;
use crate::models::domain::JobStatusKind;
use crate::storage_paths::{
    build_job_paths, TRANSLATION_CHECKPOINT_FILE_NAME, TRANSLATION_MANIFEST_FILE_NAME,
    TRANSLATION_REQUEST_JOURNAL_FILE_NAME,
};

const DOMAIN_CONTEXT_FILE_NAME: &str = "domain-context.json";
/// 跨栏 / 跨页连续段复核的结论（Python `workflow/phases/continuation_memo.py` 写）。跟着拷过去，重试不再把复核请求重发一遍。
const CONTINUATION_REVIEW_MEMO_FILE_NAME: &str = "continuation-review-memo.json";

pub(super) fn import_translation_checkpoint_candidate(
    output_root: &Path,
    source_job_id: &str,
    source_status: &JobStatusKind,
    target_translated_dir: &Path,
) -> Result<bool> {
    if !matches!(
        source_status,
        JobStatusKind::Failed | JobStatusKind::Canceled
    ) {
        return Ok(false);
    }
    let target_checkpoint = target_translated_dir.join(TRANSLATION_CHECKPOINT_FILE_NAME);
    if target_checkpoint.exists() {
        // This attempt already owns a newer local checkpoint. Never overwrite it
        // with the parent attempt's older snapshot.
        return Ok(false);
    }
    let target_manifest = target_translated_dir.join(TRANSLATION_MANIFEST_FILE_NAME);
    if target_manifest.exists() {
        return Err(anyhow!(
            "new translation attempt unexpectedly contains a committed manifest: {}",
            target_manifest.display()
        ));
    }

    let source_paths = build_job_paths(output_root, source_job_id)?;
    let source_checkpoint = source_paths
        .translated_dir
        .join(TRANSLATION_CHECKPOINT_FILE_NAME);
    if !source_checkpoint.is_file() {
        copy_request_journal_if_present(&source_paths.translated_dir, target_translated_dir)?;
        return Ok(false);
    }
    let payload: Value = serde_json::from_slice(&std::fs::read(&source_checkpoint)?)
        .map_err(|error| anyhow!("invalid translation checkpoint for {source_job_id}: {error}"))?;
    if payload.get("schema").and_then(Value::as_str) != Some("translation_checkpoint_v1")
        || payload.get("schema_version").and_then(Value::as_u64) != Some(1)
    {
        return Err(anyhow!(
            "unsupported translation checkpoint contract for {source_job_id}"
        ));
    }
    if !matches!(
        payload.get("status").and_then(Value::as_str),
        Some("in_progress" | "complete")
    ) {
        return Ok(false);
    }

    let pages = payload
        .get("pages")
        .and_then(Value::as_array)
        .ok_or_else(|| anyhow!("translation checkpoint pages missing for {source_job_id}"))?;
    std::fs::create_dir_all(target_translated_dir)?;
    for page in pages {
        let committed = resolve_checkpoint_page_source(
            page,
            &source_paths.translated_dir,
            source_job_id,
            true,
        )?;
        if let Some(snapshot_relative) = committed.snapshot_relative.as_ref() {
            let target_snapshot = target_translated_dir.join(snapshot_relative);
            std::fs::create_dir_all(
                target_snapshot
                    .parent()
                    .ok_or_else(|| anyhow!("translation checkpoint snapshot has no parent"))?,
            )?;
            copy_checkpoint_file(&committed.source_path, &target_snapshot)?;
        }
        copy_checkpoint_file(
            &committed.source_path,
            &target_translated_dir.join(&committed.file_name),
        )?;
    }
    for file_name in [DOMAIN_CONTEXT_FILE_NAME, CONTINUATION_REVIEW_MEMO_FILE_NAME] {
        let source = source_paths.translated_dir.join(file_name);
        if source.is_file() {
            copy_checkpoint_file(&source, &target_translated_dir.join(file_name))?;
        }
    }
    copy_request_journal_if_present(&source_paths.translated_dir, target_translated_dir)?;
    // The checkpoint is the commit marker for the imported page snapshot, so
    // publish it last. A failed copy can never look like a resumable import.
    copy_checkpoint_file(&source_checkpoint, &target_checkpoint)?;
    Ok(true)
}

fn copy_request_journal_if_present(source_dir: &Path, target_dir: &Path) -> Result<()> {
    let source = source_dir.join(TRANSLATION_REQUEST_JOURNAL_FILE_NAME);
    let target = target_dir.join(TRANSLATION_REQUEST_JOURNAL_FILE_NAME);
    if source.is_file() && !target.exists() {
        std::fs::create_dir_all(target_dir)?;
        copy_checkpoint_file(&source, &target)?;
    }
    Ok(())
}

fn copy_checkpoint_file(source: &Path, target: &Path) -> Result<()> {
    let metadata = std::fs::symlink_metadata(source)?;
    if !metadata.file_type().is_file() {
        return Err(anyhow!(
            "translation checkpoint source is not a regular file: {}",
            source.display()
        ));
    }
    let temp = target.with_extension("resume-copy.tmp");
    let copy_result = (|| -> std::io::Result<()> {
        std::fs::copy(source, &temp)?;
        std::fs::rename(&temp, target)
    })();
    if copy_result.is_err() {
        let _ = std::fs::remove_file(&temp);
    }
    copy_result?;
    Ok(())
}

#[cfg(test)]
#[path = "translation_checkpoint_resume/tests.rs"]
mod tests;
