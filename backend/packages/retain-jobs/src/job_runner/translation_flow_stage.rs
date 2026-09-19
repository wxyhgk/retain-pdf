use std::path::{Path, PathBuf};

use anyhow::Result;

use crate::job_events::{
    cas_persist_job_with_resources, record_custom_runtime_event_with_resources,
};
use crate::models::domain::{
    job_stage_detail, job_stage_str, now_iso, JobRuntimeState, JobStage, JobStatusKind,
};
use crate::storage_paths::JobPaths;
use crate::storage_paths::TRANSLATION_CHECKPOINT_FILE_NAME;
use crate::worker_command::{build_worker_stage_command, WorkerStageCommand};

use crate::job_runner::{
    clear_job_failure, execute_process_job, execute_process_job_stage, sync_runtime_state,
    ProcessRuntimeDeps, ProcessStageKind,
};

use crate::job_runner::stage_contract::{
    ensure_translations_dir_ready, ocr_ready_inputs_for_translation,
};

pub(super) struct TranslationStageResult {
    pub(super) job: JobRuntimeState,
    pub(super) source_pdf_path: PathBuf,
}

pub(super) fn record_ocr_child_finished(
    deps: &ProcessRuntimeDeps,
    parent_job: &JobRuntimeState,
    ocr_finished: &JobRuntimeState,
) {
    let ocr_finished_status = ocr_finished.status.clone();
    record_custom_runtime_event_with_resources(
        deps.persist.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &parent_job.snapshot(),
        if matches!(ocr_finished_status, JobStatusKind::Failed) {
            "error"
        } else {
            "info"
        },
        "ocr_child_finished",
        format!("OCR 子任务结束，状态={:?}", ocr_finished_status),
        Some(serde_json::json!({
            "ocr_job_id": ocr_finished.job_id.clone(),
            "status": format!("{:?}", ocr_finished_status).to_ascii_lowercase(),
        })),
    );
}

pub(super) async fn run_translation_stage(
    deps: &ProcessRuntimeDeps,
    mut parent_job: JobRuntimeState,
    parent_job_paths: &JobPaths,
) -> Result<TranslationStageResult> {
    let translate_inputs = ocr_ready_inputs_for_translation(&parent_job, &deps.persist.data_root)?;
    let normalized_path = translate_inputs.normalized_path;
    let source_pdf_path = translate_inputs.source_pdf_path;
    let layout_json_path = translate_inputs.layout_json_path;
    if !prepare_translation_stage(
        deps,
        &mut parent_job,
        parent_job_paths,
        &normalized_path,
        &source_pdf_path,
        layout_json_path.as_deref(),
    )? {
        // 这一行已经被另一个写入者推进到终态了(绝大多数情况是用户点了取消)。
        // 必须在这里就停住:再往下就是 spawn worker,而那会让一个已取消的任务
        // 继续烧钱,最后还被写成 failed。
        //
        // 把 DB 的真实状态带上去就够了——四个调用方无一例外只在
        // `Succeeded` 时才继续跑渲染,于是整条链自然收口。
        let persisted = deps.persist.db.get_job(&parent_job.job_id)?;
        return Ok(TranslationStageResult {
            job: persisted.into_runtime(),
            source_pdf_path,
        });
    }
    // 翻译跑完后面一定还有渲染——四个调用方(book / translate / 两条 artifacts
    // 复用路径)无一例外。所以这一步成功时不能落终态,否则 stage_history 会多出
    // 一条 finished/succeeded 夹在 translating 与 rendering 之间。
    let job = execute_process_job_stage(
        deps.clone(),
        parent_job,
        &[],
        ProcessStageKind::Intermediate,
    )
    .await?;
    Ok(TranslationStageResult {
        job,
        source_pdf_path,
    })
}

fn prepare_translation_stage(
    deps: &ProcessRuntimeDeps,
    parent_job: &mut JobRuntimeState,
    parent_job_paths: &JobPaths,
    normalized_path: &Path,
    source_pdf_path: &Path,
    layout_json_path: Option<&Path>,
) -> Result<bool> {
    let checkpoint_path = parent_job_paths
        .translated_dir
        .join(TRANSLATION_CHECKPOINT_FILE_NAME)
        .to_string_lossy()
        .to_string();
    parent_job
        .artifacts
        .get_or_insert_with(Default::default)
        .translation_checkpoint_json = Some(checkpoint_path);
    parent_job.command = build_worker_stage_command(
        &deps.worker_command_runtime(),
        &parent_job.request_payload,
        parent_job_paths,
        WorkerStageCommand::Translate {
            source_json_path: normalized_path,
            source_pdf_path,
            layout_json_path,
        },
    )?;
    parent_job.stage = Some(job_stage_str(JobStage::Translating).to_string());
    parent_job.stage_detail = Some(job_stage_detail(JobStage::Translating).to_string());
    parent_job.progress_current = None;
    parent_job.progress_total = None;
    parent_job.updated_at = now_iso();
    sync_runtime_state(parent_job);
    // CAS 而不是无条件覆盖写。`parent_job` 是这个 driver 在阶段开始时取的内存
    // 快照,它一直显示 Running;而取消走的是另一条独立的 CAS 写。整行盖下去就是
    // 一次 lost update:DB 里的 canceled 被复活成 running,随后 spawn 前那道
    // 「canceled 不要覆盖」的守卫失效,任务最终被写成 failed——用户点了取消却看到
    // 「失败」,OCR 的钱还白花了(job 20260919094352-fa6af6)。
    //
    // 返回 false 表示这一行已经不归我推进了,由调用方决定怎么收口。
    cas_persist_job_with_resources(
        deps.persist.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &parent_job.snapshot(),
        &["queued", "running"],
    )
}

pub(super) async fn run_render_stage_after_translation(
    deps: ProcessRuntimeDeps,
    mut job: JobRuntimeState,
    job_paths: &JobPaths,
    source_pdf_path: &Path,
) -> Result<JobRuntimeState> {
    ensure_translations_dir_ready(&job_paths.translated_dir, &job.job_id)?;
    job.command = build_worker_stage_command(
        &deps.worker_command_runtime(),
        &job.request_payload,
        job_paths,
        WorkerStageCommand::Render {
            source_pdf_path,
            translations_dir: &job_paths.translated_dir,
        },
    )?;
    job.status = JobStatusKind::Running;
    job.stage = Some(job_stage_str(JobStage::Rendering).to_string());
    job.stage_detail = Some(job_stage_detail(JobStage::Rendering).to_string());
    // 进入新阶段就把进度清零,和 `prepare_translation_stage` 对称。
    //
    // 这对字段是 job 级的、跨阶段不自动重置。渲染阶段的进度走的是 stage
    // snapshot(stages.render 那个 2/3),从不写 job.progress_*,于是它整段都
    // 停在翻译留下的值上——stage_history 把渲染和 finished 两条都归档成了
    // 「59/59」,而那是翻译的块数,不是渲染的页数。
    job.progress_current = None;
    job.progress_total = None;
    job.updated_at = now_iso();
    clear_job_failure(&mut job);
    sync_runtime_state(&mut job);
    // 同 `prepare_translation_stage`:翻译与渲染之间同样有取消窗口,而且这里的
    // `job.status = Running` 是显式赋的,无条件写下去必然把终态抹掉。
    let updated = cas_persist_job_with_resources(
        deps.persist.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &job.snapshot(),
        &["queued", "running"],
    )?;
    if !updated {
        return Ok(deps.persist.db.get_job(&job.job_id)?.into_runtime());
    }
    execute_process_job(deps, job, &[]).await
}

#[cfg(test)]
#[path = "translation_flow_stage_tests.rs"]
mod translation_flow_stage_tests;

#[cfg(test)]
mod stage_kind_contract {
    /// 翻译阶段必须以「中间阶段」跑,这条锁的是调用点本身。
    ///
    /// 单测只能锁住 `apply_process_completion` 在收到 `Intermediate` 时的行为;
    /// 把这里的调用改回 `Final`,那些单测照样全绿——实测过。真正会坏的是
    /// stage_history 的顺序,而那要跑完整的 book 流程才看得出来,单元测试够不着。
    /// 所以这里直接盯调用点。
    #[test]
    fn translation_stage_runs_as_an_intermediate_step() {
        let source = include_str!("translation_flow_stage.rs");
        let call = source
            .find("execute_process_job_stage(")
            .expect("翻译阶段必须走 execute_process_job_stage");
        let tail = &source[call..];
        let end = tail.find(").await").expect("调用应当被 await");
        assert!(
            tail[..end].contains("ProcessStageKind::Intermediate"),
            "翻译跑完后面还有渲染：这一步落终态会让 stage_history 出现 finished 夹在 rendering 前面"
        );
    }
}
