use anyhow::Result;

use crate::job_events::cas_persist_job_with_resources;
use crate::models::domain::{now_iso, JobRuntimeState, JobStatusKind};
use crate::storage_paths::build_job_paths;

#[path = "translation_checkpoint_resume.rs"]
mod translation_checkpoint_resume;
#[path = "translation_flow_artifacts.rs"]
mod translation_flow_artifacts;
#[path = "translation_flow_child.rs"]
mod translation_flow_child;
#[path = "translation_flow_executor.rs"]
mod translation_flow_executor;
#[path = "translation_flow_stage.rs"]
mod translation_flow_stage;
#[path = "translation_flow_support.rs"]
mod translation_flow_support;

use self::translation_flow_child::{
    create_ocr_child_job, load_translation_upload_source, mark_parent_ocr_submitting,
};
use self::translation_flow_stage::{
    record_ocr_child_finished, run_render_stage_after_translation, run_translation_stage,
};
use self::translation_flow_support::finalize_parent_after_ocr;
use super::attach_job_paths;
use super::ocr_flow::{execute_ocr_job, sync_parent_with_ocr_child};
use super::pipeline_plan::PipelinePlan;
use super::ProcessRuntimeDeps;
use translation_flow_executor::run_after_translation_stage;

pub(super) async fn resume_translation_stage_from_durable_state(
    deps: ProcessRuntimeDeps,
    job: JobRuntimeState,
    render_after_translation: bool,
) -> Result<JobRuntimeState> {
    let job_paths = build_job_paths(&deps.persist.output_root, &job.job_id)?;
    let translation_stage = run_translation_stage(&deps, job, &job_paths).await?;
    let translated_job = translation_stage.job;
    if !matches!(translated_job.status, JobStatusKind::Succeeded) || !render_after_translation {
        return Ok(translated_job);
    }
    run_render_stage_after_translation(
        deps,
        translated_job,
        &job_paths,
        &translation_stage.source_pdf_path,
    )
    .await
}

pub(super) async fn resume_render_stage_from_durable_state(
    deps: ProcessRuntimeDeps,
    job: JobRuntimeState,
) -> Result<JobRuntimeState> {
    let job_paths = build_job_paths(&deps.persist.output_root, &job.job_id)?;
    let artifacts = job
        .artifacts
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("durable render resume is missing job artifacts"))?;
    let render_inputs = crate::job_runner::stage_contract::translation_ready_inputs_for_render(
        artifacts,
        &deps.persist.data_root,
        &job.job_id,
    )?;
    run_render_stage_after_translation(deps, job, &job_paths, &render_inputs.source_pdf_path).await
}

pub(super) async fn run_translation_job_with_ocr(
    deps: ProcessRuntimeDeps,
    parent_job: JobRuntimeState,
) -> Result<JobRuntimeState> {
    if !parent_job
        .request_payload
        .source
        .artifact_job_id
        .trim()
        .is_empty()
    {
        return run_book_job_from_artifacts(deps, parent_job).await;
    }
    run_job_with_ocr(deps, parent_job, PipelinePlan::book_with_ocr()).await
}

pub(super) async fn run_translate_only_job_with_ocr(
    deps: ProcessRuntimeDeps,
    parent_job: JobRuntimeState,
) -> Result<JobRuntimeState> {
    if !parent_job
        .request_payload
        .source
        .artifact_job_id
        .trim()
        .is_empty()
    {
        return run_translate_only_job_from_artifacts(deps, parent_job).await;
    }
    run_job_with_ocr(deps, parent_job, PipelinePlan::translate_with_ocr()).await
}

async fn run_translate_only_job_from_artifacts(
    deps: ProcessRuntimeDeps,
    job: JobRuntimeState,
) -> Result<JobRuntimeState> {
    let render_after_translation = job.request_payload.runtime.render_after_translation;
    let source_job_id = job
        .request_payload
        .source
        .artifact_job_id
        .trim()
        .to_string();
    let (job, _source_pdf_path) = translation_flow_artifacts::prepare_job_from_ocr_artifacts(
        &deps.persist,
        job,
        &source_job_id,
        "继续翻译",
    )
    .await?;
    let job_paths = build_job_paths(&deps.persist.output_root, &job.job_id)?;
    let translation_stage = run_translation_stage(&deps, job, &job_paths).await?;
    let translated_job = translation_stage.job;
    if !render_after_translation || !matches!(translated_job.status, JobStatusKind::Succeeded) {
        return Ok(translated_job);
    }
    run_render_stage_after_translation(
        deps,
        translated_job,
        &job_paths,
        &translation_stage.source_pdf_path,
    )
    .await
}

async fn run_book_job_from_artifacts(
    deps: ProcessRuntimeDeps,
    job: JobRuntimeState,
) -> Result<JobRuntimeState> {
    let source_job_id = job
        .request_payload
        .source
        .artifact_job_id
        .trim()
        .to_string();
    let (job, _source_pdf_path) = translation_flow_artifacts::prepare_job_from_ocr_artifacts(
        &deps.persist,
        job,
        &source_job_id,
        "继续翻译并渲染",
    )
    .await?;
    let job_paths = build_job_paths(&deps.persist.output_root, &job.job_id)?;
    let translation_stage = run_translation_stage(&deps, job, &job_paths).await?;
    let translated_job = translation_stage.job;
    let source_pdf_path = translation_stage.source_pdf_path;
    if !matches!(translated_job.status, JobStatusKind::Succeeded) {
        return Ok(translated_job);
    }
    run_render_stage_after_translation(deps, translated_job, &job_paths, &source_pdf_path).await
}

async fn run_job_with_ocr(
    deps: ProcessRuntimeDeps,
    mut parent_job: JobRuntimeState,
    plan: PipelinePlan,
) -> Result<JobRuntimeState> {
    let parent_job_paths = build_job_paths(&deps.persist.output_root, &parent_job.job_id)?;
    attach_job_paths(&mut parent_job, &parent_job_paths);
    let source = load_translation_upload_source(deps.db.as_ref(), &parent_job)?;
    mark_parent_ocr_submitting(&deps, &mut parent_job)?;
    let ocr_child = create_ocr_child_job(&deps, &mut parent_job, &parent_job_paths, &source)?;

    let ocr_finished = execute_ocr_job(
        deps.clone(),
        ocr_child,
        Some(parent_job.job_id.clone()),
        Some(parent_job.job_id.clone()),
    )
    .await?;
    // 子任务收尾也要走 CAS,否则会把 `save_ocr_job` 刚挡下的复活又放回去。
    //
    // `ocr_finished` 是 `execute_ocr_job` 返回的**内存**结果。取消若落在子任务
    // 自查之后,`save_ocr_job` 的 CAS 会拒绝写入、DB 保持 canceled——而这里若是
    // 无条件写,就会把内存里的 Succeeded 原样盖回去,等于绕过那道保护。
    let ocr_finished = {
        let updated = cas_persist_job_with_resources(
            deps.db.as_ref(),
            &deps.persist.data_root,
            &deps.persist.output_root,
            &ocr_finished.snapshot(),
            &["queued", "running"],
        )?;
        if updated {
            ocr_finished
        } else {
            // 别人已经给子任务落了终态,以 DB 为准往下走。
            deps.db.get_job(&ocr_finished.job_id)?.into_runtime()
        }
    };
    sync_parent_with_ocr_child(&mut parent_job, &ocr_finished);
    record_ocr_child_finished(&deps, &parent_job, &ocr_finished);

    if finalize_parent_after_ocr(&mut parent_job, &ocr_finished, now_iso())? {
        return Ok(parent_job);
    }

    // 这里曾有一道「重读 DB 判终态」的守卫(见 98381cbc)。它已经并入
    // `prepare_translation_stage` 的 CAS 写:那一步只在 DB 里还是 queued/running
    // 时才落库,否则原样返回 DB 的真实状态,整条链在 spawn 之前收口。
    // 重读是 check-then-act,两步之间仍有窗口;CAS 是一步,严格更强,所以不再叠一层。
    let translation_stage = run_translation_stage(&deps, parent_job, &parent_job_paths).await?;
    let translated_job = translation_stage.job;
    let source_pdf_path = translation_stage.source_pdf_path;

    if !matches!(translated_job.status, JobStatusKind::Succeeded) {
        return Ok(translated_job);
    }
    run_after_translation_stage(
        deps,
        &plan,
        translated_job,
        &parent_job_paths,
        &source_pdf_path,
    )
    .await
}

#[cfg(test)]
mod ocr_child_persist_contract {
    /// OCR 子任务收尾的那次写必须走 CAS。
    ///
    /// 盯调用点而非结果:这一段在 `run_job_with_ocr` 里,要复现得跑完整的 OCR
    /// 流程(起子任务、中途取消、等它返回),单测够不着。而最容易被改坏的恰恰是
    /// 「用 CAS 还是无条件写」这一个选择——退回 `persist_runtime_job_with_resources`
    /// 编译通过、133 个测试全绿,但 `save_ocr_job` 那道 CAS 刚挡下的复活会被
    /// 这里原样盖回去,保护形同虚设。
    #[test]
    fn ocr_child_result_is_persisted_with_cas() {
        let source = include_str!("translation_flow.rs");
        let anchor = source
            .find("sync_parent_with_ocr_child(&mut parent_job, &ocr_finished);")
            .expect("OCR 收尾必须调用 sync_parent_with_ocr_child");
        let prev = source[..anchor]
            .rfind("let ocr_finished = execute_ocr_job(")
            .expect("这段之前必须是 execute_ocr_job");
        let window = &source[prev..anchor];
        assert!(
            window.contains("cas_persist_job_with_resources("),
            "子任务收尾必须走 CAS：无条件写会把 save_ocr_job 挡下的复活放回去"
        );
        assert!(
            !window.contains("persist_runtime_job_with_resources("),
            "这一段不该再有无条件覆盖写"
        );
    }
}
