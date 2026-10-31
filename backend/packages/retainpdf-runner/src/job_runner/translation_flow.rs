use std::path::{Path, PathBuf};

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
    StreamingTranslationInputs,
};
use self::translation_flow_support::finalize_parent_after_ocr;
use super::attach_job_paths;
use super::domain_prewarm::{start_domain_prewarm, DOMAIN_PREWARM_FINISH_TIMEOUT};
use super::ocr_flow::{execute_ocr_job, sync_parent_with_ocr_child};
use super::ocr_stream::mark_ocr_stream_failed;
use super::pipeline_plan::{PipelinePlan, PipelineStage};
use super::ProcessRuntimeDeps;
use translation_flow_executor::run_after_translation_stage;

pub(super) async fn resume_translation_stage_from_durable_state(
    deps: ProcessRuntimeDeps,
    job: JobRuntimeState,
    render_after_translation: bool,
) -> Result<JobRuntimeState> {
    let job_paths = build_job_paths(&deps.persist.output_root, &job.job_id)?;
    let translation_stage =
        run_translation_stage(&deps, job, &job_paths, render_after_translation, None).await?;
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
    let translation_stage =
        run_translation_stage(&deps, job, &job_paths, render_after_translation, None).await?;
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
    let translation_stage = run_translation_stage(&deps, job, &job_paths, true, None).await?;
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
    let ocr_child_id = ocr_child.job_id.clone();
    // 识别领域只读源 PDF 的文本层，OCR 的这半分钟里先做掉（domain_prewarm）；失败、没等到都只是翻译阶段自己问
    let domain_prewarm = deps
        .db
        .get_upload(&source.upload_id)
        .ok()
        .and_then(|upload| {
            start_domain_prewarm(&deps, &parent_job, &parent_job_paths, Path::new(&upload.stored_path))
        });

    if parent_job.ocr_streams_pages() && plan.next_after(PipelineStage::Ocr) == Some(PipelineStage::Translate) {
        let upload_path = deps.db.get_upload(&source.upload_id)?.stored_path;
        // 装箱：两条流程的 future 合在一起很大，直接内联进这个 future 会把 job worker 线程的栈撑爆（测试线程先爆，2026-10-31）
        return Box::pin(run_ocr_and_translation_together(
            deps,
            parent_job,
            plan,
            parent_job_paths,
            ocr_child,
            domain_prewarm,
            PathBuf::from(upload_path),
        ))
        .await;
    }

    let ocr_finished = match execute_ocr_job(
        deps.clone(),
        ocr_child,
        Some(parent_job.job_id.clone()),
        Some(parent_job.job_id.clone()),
    )
    .await
    {
        Ok(job) => job,
        Err(err) => {
            translation_flow_child::settle_ocr_child_after_error(&deps, &ocr_child_id, &err);
            return Err(err);
        }
    };
    let ocr_finished = persist_ocr_child_result(&deps, ocr_finished)?;
    // 子任务的 attempt 没有顶层 driver 收尾，这里跟着它的终态一起落。
    translation_flow_child::finish_ocr_child_attempt(&deps, &ocr_child_id);
    sync_parent_with_ocr_child(&mut parent_job, &ocr_finished);
    record_ocr_child_finished(&deps, &parent_job, &ocr_finished);

    if finalize_parent_after_ocr(&mut parent_job, &ocr_finished, now_iso())? {
        return Ok(parent_job);
    }

    // 这里曾有一道「重读 DB 判终态」的守卫(见 98381cbc)。它已经并入
    // `prepare_translation_stage` 的 CAS 写:那一步只在 DB 里还是 queued/running
    // 时才落库,否则原样返回 DB 的真实状态,整条链在 spawn 之前收口。
    // 重读是 check-then-act,两步之间仍有窗口;CAS 是一步,严格更强,所以不再叠一层。
    if let Some(prewarm) = domain_prewarm {
        prewarm.finish(DOMAIN_PREWARM_FINISH_TIMEOUT).await;
    }
    let render_follows = plan.next_after(PipelineStage::Translate) == Some(PipelineStage::Render);
    let translation_stage =
        run_translation_stage(&deps, parent_job, &parent_job_paths, render_follows, None).await?;
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

/// 子任务收尾也要走 CAS,否则会把 `save_ocr_job` 刚挡下的复活又放回去。
///
/// `ocr_finished` 是 `execute_ocr_job` 返回的**内存**结果。取消若落在子任务
/// 自查之后,`save_ocr_job` 的 CAS 会拒绝写入、DB 保持 canceled——而这里若是
/// 无条件写,就会把内存里的 Succeeded 原样盖回去,等于绕过那道保护。
fn persist_ocr_child_result(deps: &ProcessRuntimeDeps, ocr_finished: JobRuntimeState) -> Result<JobRuntimeState> {
    let updated = cas_persist_job_with_resources(
        deps.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &ocr_finished.snapshot(),
        &["queued", "running"],
    )?;
    if updated {
        Ok(ocr_finished)
    } else {
        // 别人已经给子任务落了终态,以 DB 为准往下走。
        Ok(deps.db.get_job(&ocr_finished.job_id)?.into_runtime())
    }
}

/// OCR 和翻译并行（2026-10-31）：OCR 能一片片公布页（`ocr_streams_pages`，现在只有 GLM-OCR）时，OCR 子任务和翻译阶段
/// 同时拉起。翻译 worker 跟着 `ocr/stream/` 的清单一轮轮翻（Python `workflow/streaming_flow.py`），OCR 做完它也就快翻完了。
///
/// - OCR 子任务照旧一行自己的记录、一个自己的进程；翻译跑在父任务上。两边写的不是同一行：OCR worker 跑起来以后
///   只写子任务的行（`save_ocr_job` 的父任务镜像只在 driver 推进阶段时写，那几次都在进程拉起之前）。
/// - OCR 没做成（失败、取消、进程被杀）时，补标清单失败（`mark_ocr_stream_failed`），等着的翻译马上退出；父任务按 OCR
///   的结果收尾。用户取消父任务时两个进程各自被停（翻译是父任务的进程，OCR 认父任务的取消）。
/// - 两边都成了，把 OCR 的产物并回父任务，照旧渲染。渲染准备要整份文档，不和翻译并行拉起。
async fn run_ocr_and_translation_together(
    deps: ProcessRuntimeDeps,
    parent_job: JobRuntimeState,
    plan: PipelinePlan,
    parent_job_paths: crate::storage_paths::JobPaths,
    ocr_child: JobRuntimeState,
    domain_prewarm: Option<super::domain_prewarm::DomainPrewarmProcess>,
    upload_path: PathBuf,
) -> Result<JobRuntimeState> {
    let ocr_child_id = ocr_child.job_id.clone();
    let parent_job_id = parent_job.job_id.clone();
    let streaming = StreamingTranslationInputs {
        normalized_path: parent_job_paths.ocr_dir.join("normalized").join("document.v1.json"),
        source_pdf_path: upload_path,
        ocr_stream_dir: parent_job_paths.ocr_dir.clone(),
    };
    let render_follows = plan.next_after(PipelineStage::Translate) == Some(PipelineStage::Render);
    let ocr = Box::pin(async {
        let result = execute_ocr_job(
            deps.clone(),
            ocr_child,
            Some(parent_job_id.clone()),
            Some(parent_job_id.clone()),
        )
        .await;
        let failure = match &result {
            Ok(job) if matches!(job.status, JobStatusKind::Succeeded) => None,
            Ok(job) => Some(format!(
                "OCR child {:?}: {}",
                job.status,
                job.error.clone().or(job.stage_detail.clone()).unwrap_or_default()
            )),
            Err(err) => Some(format!("OCR child error: {err:#}")),
        };
        if let Some(reason) = failure {
            if let Err(err) = mark_ocr_stream_failed(&parent_job_paths.ocr_dir, &reason) {
                tracing::warn!(job_id = %parent_job_id, error = %format!("{err:#}"), "failed to mark ocr stream failed");
            }
        }
        result
    });
    let translation = Box::pin(run_translation_stage(
        &deps,
        parent_job.clone(),
        &parent_job_paths,
        render_follows,
        Some(&streaming),
    ));
    let (ocr_result, translation_result) = tokio::join!(ocr, translation);

    let ocr_finished = match ocr_result {
        Ok(job) => job,
        Err(err) => {
            translation_flow_child::settle_ocr_child_after_error(&deps, &ocr_child_id, &err);
            return Err(err);
        }
    };
    let ocr_finished = persist_ocr_child_result(&deps, ocr_finished)?;
    translation_flow_child::finish_ocr_child_attempt(&deps, &ocr_child_id);
    record_ocr_child_finished(&deps, &parent_job, &ocr_finished);
    if let Some(prewarm) = domain_prewarm {
        prewarm.finish(DOMAIN_PREWARM_FINISH_TIMEOUT).await;
    }
    let translation_stage = translation_result?;

    if !matches!(ocr_finished.status, JobStatusKind::Succeeded) {
        // OCR 没做成：翻译读到失败的清单已经退出了，父任务按 OCR 的结果收尾（和串行时一样的说法）。
        let mut parent = deps.db.get_job(&parent_job.job_id)?.into_runtime();
        sync_parent_with_ocr_child(&mut parent, &ocr_finished);
        finalize_parent_after_ocr(&mut parent, &ocr_finished, now_iso())?;
        return Ok(parent);
    }
    let mut translated_job = translation_stage.job;
    if !matches!(translated_job.status, JobStatusKind::Succeeded) {
        return Ok(translated_job);
    }
    // OCR 产物只并进内存里的任务，不在这里写库：翻译是中间阶段，内存里的 status 已经是 Succeeded（给调用方判成没成），
    // 写下去就是把父任务落成终态，渲染阶段启动时的 CAS 会被拒、渲染不跑（2026-10-31 开发栈实测，任务直接"成功"、没有译文 PDF）。
    // 渲染阶段启动时会连同这些产物一起写库（和串行时 OCR 产物随翻译阶段启动一起写一样）。
    sync_parent_with_ocr_child(&mut translated_job, &ocr_finished);
    // 渲染用 OCR 子任务落在任务目录里的那份原文（选页时是切出来的子 PDF），和串行时一样
    let source_pdf_path = translated_job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.source_pdf.clone())
        .map(PathBuf::from)
        .unwrap_or(streaming.source_pdf_path);
    Box::pin(run_after_translation_stage(deps, &plan, translated_job, &parent_job_paths, &source_pdf_path)).await
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
        // 串行和并行（OCR 和翻译同时跑）两条路都在拿到 OCR 结果后、并回父任务前走这一个函数
        for (start, end) in [
            ("let ocr_finished = match execute_ocr_job(", "sync_parent_with_ocr_child(&mut parent_job, &ocr_finished);"),
            ("let (ocr_result, translation_result) = tokio::join!", "sync_parent_with_ocr_child(&mut translated_job, &ocr_finished);"),
        ] {
            let from = source.find(start).expect("找不到 OCR 收尾那一段");
            let to = from + source[from..].find(end).expect("OCR 收尾必须调用 sync_parent_with_ocr_child");
            assert!(
                source[from..to].contains("persist_ocr_child_result(&deps, ocr_finished)"),
                "子任务收尾必须走 persist_ocr_child_result：{start}"
            );
        }
        let body_start = source.find("fn persist_ocr_child_result(").expect("persist_ocr_child_result");
        let body = &source[body_start..body_start + source[body_start..].find("\n}\n").expect("函数结尾")];
        assert!(
            body.contains("cas_persist_job_with_resources("),
            "子任务收尾必须走 CAS：无条件写会把 save_ocr_job 挡下的复活放回去"
        );
        assert!(!body.contains("persist_runtime_job_with_resources("), "这里不该有无条件覆盖写");
    }

    /// OCR 和翻译并行时，翻译成功后不能先把父任务写库：翻译是中间阶段，内存里 status 已是 Succeeded，写下去父任务就成了终态，
    /// 渲染阶段启动时的 CAS 被拒、渲染不跑（2026-10-31 开发栈实测：任务"成功"了，却没有译文 PDF）。
    #[test]
    fn parallel_flow_does_not_persist_the_parent_between_translation_and_render() {
        let source = include_str!("translation_flow.rs");
        let from = source
            .find("sync_parent_with_ocr_child(&mut translated_job, &ocr_finished);")
            .expect("并行流程要把 OCR 产物并回父任务");
        let to = from + source[from..].find("run_after_translation_stage(").expect("接着走翻译之后的阶段");
        assert!(
            !source[from..to].contains("cas_persist_job_with_resources("),
            "翻译和渲染之间写库会把父任务提前落成终态"
        );
    }
}

#[cfg(test)]
#[path = "translation_flow_dispatch_crash_tests.rs"]
mod translation_flow_dispatch_crash_tests;
