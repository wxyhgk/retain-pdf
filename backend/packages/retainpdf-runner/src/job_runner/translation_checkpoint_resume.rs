use std::path::Path;
use std::time::Duration;

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
/// 表格翻译的结果和缓存（`pipeline/translate/tables_stage.py`）：按表的缓存键（引擎、提示词版本、格子、表题表注）复用。
const TABLES_FILE_NAME: &str = "tables.v1.json";
/// 正文翻译定下的术语记忆（`translation-classic` `pending_units.py`）：表格翻译查它，和导入的页是同一次翻译的产物。
const JOB_MEMORY_FILE_NAME: &str = "job-memory.json";
/// 目录 agent 的结果和缓存（`toc-agent` `run.py`）：输入（条目、标题、术语表、模型、提示词版本）一样才复用。
const TOC_AGENT_FILE_NAME: &str = "toc-agent.v1.json";
/// 译前准备的术语库、风格指南（`translation-classic` `services/preparation`）：带 `inputs_fingerprint`，对不上就重做。
/// 它们的哈希进断点参数，重做出来不一样会让导入的断点整本作废，所以一定要带过去。
const TERM_BASE_FILE_NAME: &str = "term-base.v1.json";
const STYLE_GUIDE_FILE_NAME: &str = "style-guide.v1.json";
/// 修订日志（`workflow/revision.py`）：用户手改的译文已经在导入的页里，历史（和「改过 N 处」）也要跟着。
const TRANSLATION_REVISIONS_FILE_NAME: &str = "revisions.v1.jsonl";
/// agent 引擎的状态目录（`translation-agent` `agent_flow.py`）：里面的 `fingerprint.json` 记着块、原文、模型、引擎版本，
/// 对不上时 agent 自己清掉重来，所以拷过去不会沿用别的输入的进度。
const AGENT_STATE_DIR_NAME: &str = "agent";

/// 跟着断点一起拷的附属文件：都在译文目录里，源里没有的跳过。修订写到一半的意图记录
/// （`.translation-revision-intent.v1.json`）不拷：它对的是源任务的断点。
const ATTACHED_STATE_FILE_NAMES: [&str; 8] = [
    DOMAIN_CONTEXT_FILE_NAME,
    CONTINUATION_REVIEW_MEMO_FILE_NAME,
    TABLES_FILE_NAME,
    JOB_MEMORY_FILE_NAME,
    TOC_AGENT_FILE_NAME,
    TERM_BASE_FILE_NAME,
    STYLE_GUIDE_FILE_NAME,
    TRANSLATION_REVISIONS_FILE_NAME,
];

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
    for file_name in ATTACHED_STATE_FILE_NAMES {
        let source = source_paths.translated_dir.join(file_name);
        if source.is_file() {
            copy_checkpoint_file(&source, &target_translated_dir.join(file_name))?;
        }
    }
    copy_state_dir_if_present(
        &source_paths.translated_dir.join(AGENT_STATE_DIR_NAME),
        &target_translated_dir.join(AGENT_STATE_DIR_NAME),
    )?;
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
        retry_io(&TRANSIENT_IO_BACKOFF, is_transient_windows_io_error, || {
            std::fs::copy(source, &temp)
        })?;
        retry_io(&TRANSIENT_IO_BACKOFF, is_transient_windows_io_error, || {
            std::fs::rename(&temp, target)
        })
    })();
    if copy_result.is_err() {
        let _ = std::fs::remove_file(&temp);
    }
    copy_result?;
    Ok(())
}

/// 整个目录递归拷过去：先拷进旁边的临时目录，拷完再一次改名，半路失败不会留下拷了一半的状态目录。
/// 源里没有就跳过；目标里已经有了（这次运行自己的状态）不覆盖。只拷普通文件和目录，符号链接跳过。
fn copy_state_dir_if_present(source: &Path, target: &Path) -> Result<()> {
    match std::fs::symlink_metadata(source) {
        Ok(metadata) if metadata.file_type().is_dir() => {}
        Ok(_) => return Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.into()),
    }
    if std::fs::symlink_metadata(target).is_ok() {
        return Ok(());
    }
    let file_name = target
        .file_name()
        .ok_or_else(|| anyhow!("translation state dir has no name: {}", target.display()))?;
    let temp = target.with_file_name(format!(".{}.resume-copy.tmp", file_name.to_string_lossy()));
    if std::fs::symlink_metadata(&temp).is_ok() {
        std::fs::remove_dir_all(&temp)?;
    }
    let copy_result = copy_dir_contents(source, &temp).and_then(|()| {
        retry_io(&TRANSIENT_IO_BACKOFF, is_transient_windows_io_error, || {
            std::fs::rename(&temp, target)
        })
        .map_err(Into::into)
    });
    if copy_result.is_err() {
        let _ = std::fs::remove_dir_all(&temp);
    }
    copy_result
}

fn copy_dir_contents(source: &Path, target: &Path) -> Result<()> {
    std::fs::create_dir_all(target)?;
    for entry in std::fs::read_dir(source)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let destination = target.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_contents(&entry.path(), &destination)?;
        } else if file_type.is_file() {
            let path = entry.path();
            retry_io(&TRANSIENT_IO_BACKOFF, is_transient_windows_io_error, || {
                std::fs::copy(&path, &destination)
            })?;
        }
    }
    Ok(())
}

/// Windows 上杀毒软件、索引服务短暂占着文件时，拷贝、改名会报「拒绝访问」「正被另一进程使用」：退避几次再试
/// （设计 Z5 的 Windows 重试；这里先管住导入断点这一处）。别的平台不重试。
const TRANSIENT_IO_BACKOFF: [Duration; 4] = [
    Duration::from_millis(50),
    Duration::from_millis(100),
    Duration::from_millis(200),
    Duration::from_millis(400),
];

fn is_transient_windows_io_error(error: &std::io::Error) -> bool {
    // 5 = ERROR_ACCESS_DENIED，32 = ERROR_SHARING_VIOLATION，33 = ERROR_LOCK_VIOLATION
    cfg!(windows)
        && (error.kind() == std::io::ErrorKind::PermissionDenied
            || matches!(error.raw_os_error(), Some(5 | 32 | 33)))
}

/// 跑 `op`，`is_transient` 认的错按 `backoff` 依次等一会再试，试完还错就把最后一个错交出去。
fn retry_io<T>(
    backoff: &[Duration],
    is_transient: impl Fn(&std::io::Error) -> bool,
    mut op: impl FnMut() -> std::io::Result<T>,
) -> std::io::Result<T> {
    let mut delays = backoff.iter();
    loop {
        match op() {
            Ok(value) => return Ok(value),
            Err(error) if is_transient(&error) => match delays.next() {
                Some(delay) => std::thread::sleep(*delay),
                None => return Err(error),
            },
            Err(error) => return Err(error),
        }
    }
}

#[cfg(test)]
#[path = "translation_checkpoint_resume/tests.rs"]
mod tests;
