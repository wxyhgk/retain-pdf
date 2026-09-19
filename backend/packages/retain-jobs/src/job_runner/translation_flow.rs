use anyhow::Result;

use crate::job_events::persist_runtime_job_with_resources;
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
    persist_runtime_job_with_resources(
        deps.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &ocr_finished,
    )?;
    sync_parent_with_ocr_child(&mut parent_job, &ocr_finished);
    record_ocr_child_finished(&deps, &parent_job, &ocr_finished);

    if finalize_parent_after_ocr(&mut parent_job, &ocr_finished, now_iso())? {
        return Ok(parent_job);
    }

    // OCR 期间用户可能已经取消了父任务。取消走的是独立的 CAS 写,而 `parent_job`
    // 是这个 driver 在阶段开始时取的内存快照——它会一直显示 Running。
    //
    // 不重读就往下走的话:`prepare_translation_stage` 会用一次**无条件覆盖写**
    // 把 DB 里的 canceled 复活成 running,于是 `spawn_job_with_workflow` 里那道
    // 「canceled 不要覆盖」的守卫失效,任务最终被写成 failed。用户点了取消,看到
    // 的却是「失败」外加一条内部错误,而 OCR 的钱已经花掉了。
    //
    // 这里重读一次就够:终态就停,把 DB 的真实状态返回上去。
    // 隔壁 `ocr_flow::support::mirror_parent_ocr_status` 一直是这么做的。
    let persisted_parent = deps.db.get_job(&parent_job.job_id)?;
    if matches!(
        persisted_parent.status,
        JobStatusKind::Succeeded | JobStatusKind::Failed | JobStatusKind::Canceled
    ) {
        return Ok(persisted_parent.into_runtime());
    }

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
mod terminal_guard_contract {
    /// OCR 跑完后进翻译之前,必须**重读数据库**判终态,不能看内存快照。
    ///
    /// 为什么盯源码而不是写单测:这条守卫真正要挡的场景是「OCR 期间用户取消了
    /// 父任务」,复现它要完整跑一遍 book 流程(起 OCR 子任务、中途取消、等子任务
    /// 成功),单元测试够不着。而这里最容易被后人改坏的正是「重读」这个动作——
    /// 把 `deps.db.get_job(...)` 换成手边的 `parent_job.status`,编译通过、所有
    /// 单测全绿,但 bug 原样回来:内存快照永远是 Running,于是 canceled 被一次
    /// 无条件覆盖写复活,任务最后写成 failed。
    ///
    /// 参见 job 20260919094352-fa6af6:用户点了取消,结果显示「失败」,OCR 的钱白花。
    #[test]
    fn translation_entry_rereads_status_from_db() {
        let source = include_str!("translation_flow.rs");
        let anchor = source
            .find("let translation_stage = run_translation_stage(&deps, parent_job")
            .expect("run_job_with_ocr 必须调用 run_translation_stage");
        // 窗口取「finalize_parent_after_ocr 之后、run_translation_stage 之前」,
        // 避免被文件里别处的 get_job 蒙混过关。按锚点切而不是按字节数退,
        // 否则会切进中文注释的多字节字符里。
        let prev = source[..anchor]
            .rfind("finalize_parent_after_ocr(&mut parent_job")
            .expect("守卫必须在 finalize_parent_after_ocr 之后");
        let window = &source[prev..anchor];
        assert!(
            window.contains("deps.db.get_job(&parent_job.job_id)"),
            "进翻译前必须重读数据库:内存里的 parent_job 是阶段开始时的快照,\
             期间的取消它看不见"
        );
        assert!(
            window.contains("JobStatusKind::Canceled"),
            "重读之后必须把 Canceled 当成终态停下,否则守卫形同虚设"
        );
    }
}
