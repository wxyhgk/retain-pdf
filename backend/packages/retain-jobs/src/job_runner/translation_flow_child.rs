use anyhow::{anyhow, Result};

use crate::db::Db;
use crate::job_events::{
    cas_persist_job_with_resources, persist_runtime_job_with_resources,
    record_custom_runtime_event_with_resources,
};
use crate::models::domain::{now_iso, JobRuntimeState, JobSnapshot, JobStatusKind, WorkflowKind};
use crate::storage_paths::JobPaths;

use crate::job_runner::{
    attach_job_paths, clear_job_failure, sync_runtime_state, ProcessRuntimeDeps,
};

pub(super) struct TranslationUploadSource {
    pub(super) upload_id: String,
}

pub(super) fn load_translation_upload_source(
    db: &Db,
    parent_job: &JobRuntimeState,
) -> Result<TranslationUploadSource> {
    let upload_id = parent_job
        .upload_id
        .clone()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| anyhow!("parent translation job is missing upload_id"))?;
    let upload = db.get_upload(&upload_id)?;
    if !std::path::Path::new(&upload.stored_path).exists() {
        return Err(anyhow!("uploaded file missing: {}", upload.stored_path));
    }
    Ok(TranslationUploadSource { upload_id })
}

pub(super) fn mark_parent_ocr_submitting(
    deps: &ProcessRuntimeDeps,
    parent_job: &mut JobRuntimeState,
) -> Result<()> {
    parent_job.status = JobStatusKind::Running;
    parent_job.started_at = Some(now_iso());
    parent_job.updated_at = now_iso();
    parent_job.stage = Some("ocr_submitting".to_string());
    parent_job.stage_detail = Some("正在启动 OCR 子任务".to_string());
    clear_job_failure(parent_job);
    sync_runtime_state(parent_job);
    // 父任务行有两个写入者：这个 driver 和点「取消」的用户。`parent_job` 只是
    // driver 在阶段开始时取的内存快照，永远显示 Running；无条件整行覆盖会把用户
    // 刚落库的 canceled 又盖回 running，接着白跑一整轮付费 OCR。CAS 把这次推进
    // 限定在「DB 里还是 queued/running」时才生效。
    let updated = cas_persist_job_with_resources(
        deps.persist.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &parent_job.snapshot(),
        &["queued", "running"],
    )?;
    if !updated {
        // 已经有人把父任务推进到终态了，绝大多数情况是用户取消。下一步就是建
        // OCR 子任务并调付费接口，一步都不该再走。
        //
        // 上抛而不是静默返回：`spawn_job_with_workflow` 见 Canceled 就不会再把
        // 任务写成 failed，终态由先到的那个写入者说了算。与
        // `spawn_started_process` 里的 "job is no longer eligible for worker
        // startup" 是同一套路。
        anyhow::bail!("parent job is no longer eligible for OCR submission");
    }
    Ok(())
}

pub(super) fn create_ocr_child_job(
    deps: &ProcessRuntimeDeps,
    parent_job: &mut JobRuntimeState,
    parent_job_paths: &JobPaths,
    source: &TranslationUploadSource,
) -> Result<JobRuntimeState> {
    let ocr_job_id = format!("{}-ocr", parent_job.job_id);
    let mut ocr_request = parent_job.request_payload.clone();
    ocr_request.workflow = WorkflowKind::Ocr;
    ocr_request.job_id = ocr_job_id.clone();
    ocr_request.source.upload_id = source.upload_id.clone();

    let mut ocr_child = JobSnapshot::new(
        ocr_job_id.clone(),
        ocr_request.clone(),
        vec!["ocr-child-pending-provider".to_string()],
    )
    .into_runtime();
    attach_job_paths(&mut ocr_child, parent_job_paths);
    if let Some(artifacts) = ocr_child.artifacts.as_mut() {
        artifacts.trace_id = Some(format!("ocr-{ocr_job_id}"));
        artifacts.schema_version = Some("document.v1".to_string());
    }
    ocr_child.stage = Some("queued".to_string());
    ocr_child.stage_detail = Some("OCR 子任务已创建".to_string());
    sync_runtime_state(&mut ocr_child);
    // ALLOW-UNCONDITIONAL-JOB-WRITE: 建新行，不是更新。
    // 这一处是**建新行**，不是更新：`ocr_job_id` 刚拼出来，DB 里通常没有这一行。
    // 所以它不参与父任务那场「driver vs 取消」的竞争，CAS 在这里没有可防的东西。
    // 反过来还会有害：父任务重试时 `{parent}-ocr` 可能残留着上一轮的终态行，
    // CAS 会以为「有人抢先了」而拒绝写入，把重试卡死。保持无条件写。
    persist_runtime_job_with_resources(
        deps.persist.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &ocr_child,
    )?;

    // 子任务也要有文档归属，否则它的 OCR 产物永远无法被复用：
    // validate_ocr_artifact_reuse 的第一道校验就是 get_document_by_job_id，
    // 查不到归属即判 document_mismatch。主任务的归属由 lifecycle.rs 的
    // update_document_after_job 在终态时补上，而 OCR 子任务由本文件独立创建、
    // 直接落库，从不经过那条流程，于是 document_id 一直是 NULL——表现就是
    // 「OCR 明明成功了，重试却还要整本重跑一遍 OCR」。
    //
    // 尽力而为：link 依赖 uploads.content_hash，失败只记日志，不影响任务本身。
    if let Err(error) = deps
        .persist
        .db
        .link_job_to_document(&ocr_job_id, &source.upload_id)
    {
        tracing::warn!(
            "library: link ocr child {} to document failed: {error}",
            ocr_job_id
        );
    }

    if let Some(artifacts) = parent_job.artifacts.as_mut() {
        artifacts.ocr_job_id = Some(ocr_job_id.clone());
        artifacts.ocr_trace_id = Some(format!("ocr-{ocr_job_id}"));
        artifacts.ocr_status = Some(JobStatusKind::Queued);
    }
    sync_runtime_state(parent_job);
    // 同 `mark_parent_ocr_submitting`：写的是已存在的父任务行，用 CAS 顶住取消。
    let updated = cas_persist_job_with_resources(
        deps.persist.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &parent_job.snapshot(),
        &["queued", "running"],
    )?;
    if !updated {
        // 取消恰好卡在建子任务的这个窗口里。子任务行虽然已经落库，但调用方就此
        // 停下、不会去驱动它，也就不会产生 OCR 调用；下一次重试会原地覆盖它。
        anyhow::bail!("parent job became terminal while creating the OCR child job");
    }
    record_custom_runtime_event_with_resources(
        deps.persist.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &parent_job.snapshot(),
        "info",
        "ocr_child_created",
        "OCR 子任务已创建",
        Some(serde_json::json!({ "ocr_job_id": ocr_job_id })),
    );

    Ok(ocr_child)
}

#[cfg(test)]
#[path = "translation_flow_child_tests.rs"]
mod translation_flow_child_tests;
