use anyhow::Result;

use crate::job_events::cas_persist_job_with_resources;
use crate::models::domain::{job_stage_str, now_iso, JobRuntimeState, JobStage, JobStatusKind};

use super::super::{
    append_error_chain_log, attach_job_provider_failure, format_error_chain, job_artifacts_mut,
    refresh_job_failure, sync_runtime_state, ProcessRuntimeDeps,
};

/// 「这一行还归我推进吗」——本文件所有写入的前置条件。
///
/// 一行任务有两个并发写入者：driver（推进阶段）和用户（取消）。driver 手里的
/// `JobRuntimeState` 是阶段开始时取的内存快照，永远显示 running；整行无条件覆盖
/// 会把用户刚写进去的 canceled 盖回 running，是典型的 lost update。表现就是
/// 用户点了取消、任务却接着跑，最后还被写成「失败」。
///
/// 所以推进阶段一律走 CAS：只在 DB 里这行还是 queued/running 时才写。
const ACTIVE_JOB_STATUSES: &[&str] = &["queued", "running"];

pub(super) async fn save_ocr_job(
    deps: &ProcessRuntimeDeps,
    job: &JobRuntimeState,
    parent_job_id: Option<&str>,
) -> Result<()> {
    let updated = cas_persist_job_with_resources(
        deps.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &job.snapshot(),
        ACTIVE_JOB_STATUSES,
    )?;
    if !updated {
        // 别人已经把这个子任务写成终态了（几乎总是用户取消）。手里的快照更旧，
        // 写下去就是把终态复活。
        //
        // 不返回 Err：所有调用点都是 `save_ocr_job(..).await?`，报错会让整条 OCR
        // 流程以「失败」收场，而真相是「已取消」——正是这里要消灭的那种假失败。
        // 静默让步即可，流程自身的取消检查点会在下一轮收尾。
        //
        // 父任务镜像也一并跳过：要镜像的子任务状态已经被 DB 否定了，再往父任务
        // 写只会把一个过期的 running 传播出去。
        tracing::info!(
            job_id = %job.job_id,
            "ocr child job is already terminal in db, skip stage write"
        );
        return Ok(());
    }
    if let Some(parent_job_id) = parent_job_id {
        mirror_parent_ocr_status(deps, parent_job_id, job).await?;
    }
    Ok(())
}

async fn mirror_parent_ocr_status(
    deps: &ProcessRuntimeDeps,
    parent_job_id: &str,
    ocr_job: &JobRuntimeState,
) -> Result<()> {
    // 这里曾经先重读父任务、判终态就 return。那道守卫是 TOCTOU：读和写之间不
    // 原子，取消卡在中间照样能把终态行复活。现在由下面的 CAS 兜底，守卫删掉——
    // 留着不但白占一次判断，还会在终态时抢先短路，让 CAS 在测试里测不出来。
    // 重读本身保留：镜像要往父任务那一整行上写，必须先有那一行。
    let mut parent_job = deps.db.get_job(parent_job_id)?.into_runtime();
    let parent_artifacts = job_artifacts_mut(&mut parent_job);
    parent_artifacts.ocr_job_id = Some(ocr_job.job_id.clone());
    parent_artifacts.ocr_status = Some(ocr_job.status.clone());
    parent_artifacts.ocr_trace_id = ocr_job
        .artifacts
        .as_ref()
        .and_then(|item| item.trace_id.clone());
    parent_artifacts.ocr_provider_trace_id = ocr_job
        .artifacts
        .as_ref()
        .and_then(|item| item.provider_trace_id.clone());
    parent_artifacts.ocr_provider_diagnostics = ocr_job
        .artifacts
        .as_ref()
        .and_then(|item| item.ocr_provider_diagnostics.clone());

    if parent_stage_allows_ocr_mirror(parent_job.stage.as_deref()) {
        parent_job.status = JobStatusKind::Running;
        parent_job.stage = Some(parent_ocr_stage_from_child(ocr_job.stage.as_deref()).to_string());
        parent_job.stage_detail = ocr_job
            .stage_detail
            .as_ref()
            .map(|detail| format!("OCR 子任务：{detail}"))
            .or_else(|| Some("OCR 子任务运行中".to_string()));
        parent_job.progress_current = ocr_job.progress_current;
        parent_job.progress_total = ocr_job.progress_total;
        parent_job.updated_at = now_iso();
        parent_job.replace_failure_info(None);
        parent_job.sync_runtime_state();
    } else {
        parent_job.updated_at = now_iso();
    }
    // 镜像本来就是「顺带写一下父任务」的 best effort：父任务已是终态时，原先的
    // 守卫就是什么都不做。CAS 失败保持同一语义，不升级成错误。
    let updated = cas_persist_job_with_resources(
        deps.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &parent_job.snapshot(),
        ACTIVE_JOB_STATUSES,
    )?;
    if !updated {
        tracing::info!(
            parent_job_id = %parent_job_id,
            ocr_job_id = %ocr_job.job_id,
            "parent job is already terminal in db, skip ocr status mirror"
        );
    }
    Ok(())
}

fn parent_stage_allows_ocr_mirror(stage: Option<&str>) -> bool {
    matches!(
        normalize_stage(stage),
        None | Some("queued")
            | Some("running")
            | Some("ocr_submitting")
            | Some("ocr_upload")
            | Some("mineru_upload")
            | Some("ocr_processing")
            | Some("mineru_processing")
            | Some("ocr_result_ready")
            | Some("translation_prepare")
            | Some("normalizing")
    )
}

fn parent_ocr_stage_from_child(stage: Option<&str>) -> &'static str {
    match normalize_stage(stage) {
        Some("translation_prepare" | "ocr_result_ready") => "ocr_result_ready",
        Some("normalizing") => "normalizing",
        Some("ocr_upload") => "ocr_upload",
        Some("mineru_upload") => "mineru_upload",
        Some("mineru_processing") => "mineru_processing",
        Some("ocr_processing") => "ocr_processing",
        Some("queued") => "ocr_submitting",
        _ => "ocr_submitting",
    }
}

fn normalize_stage(stage: Option<&str>) -> Option<&str> {
    stage.map(str::trim).filter(|value| !value.is_empty())
}

pub(super) fn fail_missing_source_pdf(
    job: &mut JobRuntimeState,
    source_pdf_path: &std::path::Path,
) {
    let message = format!("source pdf not found: {}", source_pdf_path.display());
    job.status = JobStatusKind::Failed;
    job.stage = Some(job_stage_str(JobStage::Failed).to_string());
    job.stage_detail = Some("OCR 已完成，但任务源 PDF 缺失".to_string());
    job.error = Some(message.clone());
    job.updated_at = now_iso();
    job.finished_at = Some(now_iso());
    job.append_log(&message);
    refresh_job_failure(job);
    sync_runtime_state(job);
}

#[cfg(test)]
mod tests {
    use super::{parent_ocr_stage_from_child, parent_stage_allows_ocr_mirror};

    #[test]
    fn ocr_child_translation_prepare_is_exposed_as_ocr_result_ready() {
        assert_eq!(
            parent_ocr_stage_from_child(Some("translation_prepare")),
            "ocr_result_ready"
        );
    }

    #[test]
    fn translation_and_later_parent_stages_are_not_overwritten_by_ocr_child() {
        for stage in [
            "translating",
            "continuation_review",
            "page_policies",
            "domain_inference",
            "garbled_repair",
            "rendering",
            "saving",
            "finished",
        ] {
            assert!(
                !parent_stage_allows_ocr_mirror(Some(stage)),
                "{stage} should not allow OCR mirror"
            );
        }
    }

    #[test]
    fn ocr_parent_stages_can_still_follow_ocr_child_progress() {
        for stage in [
            None,
            Some("ocr_submitting"),
            Some("ocr_upload"),
            Some("ocr_processing"),
            Some("mineru_processing"),
            Some("ocr_result_ready"),
            Some("normalizing"),
        ] {
            assert!(parent_stage_allows_ocr_mirror(stage));
        }
    }
}

pub(super) fn fail_ocr_transport(job: &mut JobRuntimeState, err: &anyhow::Error) {
    let message = format_error_chain(err);
    append_error_chain_log(job, err);
    attach_job_provider_failure(job, &message);
    if let Some(response) =
        err.downcast_ref::<crate::ocr_provider::mineru::response_error::MineruResponseError>()
    {
        if let Some(trace) = &response.info.trace_id {
            job_artifacts_mut(job).provider_trace_id = Some(trace.clone());
        }
        crate::job_runner::ocr_provider_diagnostics_mut(job).last_error =
            Some(response.info.clone());
    }
    job.status = JobStatusKind::Failed;
    job.stage = Some(job_stage_str(JobStage::Failed).to_string());
    if job
        .stage_detail
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_none()
    {
        job.stage_detail = Some("OCR provider transport 失败".to_string());
    }
    job.error = Some(message);
    job.updated_at = now_iso();
    job.finished_at = Some(now_iso());
    refresh_job_failure(job);
    sync_runtime_state(job);
}

pub fn sync_parent_with_ocr_child(
    parent_job: &mut JobRuntimeState,
    ocr_finished: &JobRuntimeState,
) {
    let parent_artifacts = job_artifacts_mut(parent_job);
    parent_artifacts.ocr_job_id = Some(ocr_finished.job_id.clone());
    parent_artifacts.ocr_status = Some(ocr_finished.status.clone());

    if let Some(child_artifacts) = ocr_finished.artifacts.as_ref() {
        parent_artifacts.copy_ocr_checkpoint_from(&ocr_finished.job_id, child_artifacts);
    }
}

/// OCR 流程推进阶段时的写入，必须是 CAS，不能是无条件整行覆盖。
///
/// 真实的竞争是「driver 推进阶段」和「用户取消」并发写同一行，而 driver 手里的
/// `JobRuntimeState` 是阶段开始时的内存快照。单元测试插不进那个时间窗口，所以
/// 这里直接把窗口的**结果**摆进 DB：行已经是终态了，driver 却还揣着一个 running
/// 的旧快照来写。把 CAS 改回无条件写，下面每条断言都会翻红。
#[cfg(test)]
mod cas_write_contract {
    use super::save_ocr_job;
    use crate::job_runner::process_runner::tests::test_runtime_deps;
    use crate::job_runner::ProcessRuntimeDeps;
    use crate::models::domain::{JobSnapshot, JobStatusKind};
    use crate::models::request::CreateJobInput;

    /// 任何一次写都会把它刷成当前时间，所以它没被动过就等于这一行没被写过。
    const NEVER_WRITTEN_AT: &str = "1999-01-01T00:00:00Z";

    struct Fixture(ProcessRuntimeDeps);

    impl Fixture {
        fn new() -> Self {
            Self(test_runtime_deps(1))
        }

        fn deps(&self) -> &ProcessRuntimeDeps {
            &self.0
        }

        fn seed(&self, job_id: &str, status: JobStatusKind, stage: &str) -> JobSnapshot {
            let mut job = JobSnapshot::new(
                job_id.to_string(),
                CreateJobInput::default(),
                vec!["python".to_string()],
            );
            job.status = status;
            job.stage = Some(stage.to_string());
            job.updated_at = NEVER_WRITTEN_AT.to_string();
            job.sync_runtime_state();
            self.0.db.save_job(&job).expect("seed job row");
            job
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0.config.project_root);
        }
    }

    /// 子任务自己那一行：用户已经把它取消了，driver 的下一次阶段推进不许写回去。
    #[tokio::test]
    async fn stage_write_does_not_resurrect_a_canceled_child_row() {
        let fixture = Fixture::new();
        let canceled = fixture.seed("ocr-cas-child", JobStatusKind::Canceled, "canceled");

        let mut stale = canceled.clone().into_runtime();
        stale.status = JobStatusKind::Running;
        stale.stage = Some("ocr_processing".to_string());
        stale.stage_detail = Some("OCR provider 处理中".to_string());

        save_ocr_job(fixture.deps(), &stale, None)
            .await
            .expect("stage write must not fail on a terminal row");

        let stored = fixture.deps().db.get_job(&canceled.job_id).expect("reload");
        assert_eq!(stored.status, JobStatusKind::Canceled);
        assert_eq!(stored.stage.as_deref(), Some("canceled"));
        assert_eq!(stored.updated_at, NEVER_WRITTEN_AT);
    }

    /// 子任务还活着就照常写——CAS 的门槛不能顺手把正常流程一起挡掉。
    #[tokio::test]
    async fn stage_write_still_advances_a_running_child_row() {
        let fixture = Fixture::new();
        let running = fixture.seed("ocr-cas-child-live", JobStatusKind::Running, "ocr_upload");

        let mut next = running.clone().into_runtime();
        next.stage = Some("ocr_processing".to_string());
        next.updated_at = "2026-01-01T00:00:00Z".to_string();

        save_ocr_job(fixture.deps(), &next, None)
            .await
            .expect("stage write");

        let stored = fixture.deps().db.get_job(&running.job_id).expect("reload");
        assert_eq!(stored.stage.as_deref(), Some("ocr_processing"));
        assert_eq!(stored.updated_at, "2026-01-01T00:00:00Z");
    }

    /// 父任务那一行：镜像是顺带写，终态行一个字段都不许被它动。
    ///
    /// 这里的 stage 就是用户取消真正写下的 "canceled"，此时镜像走的是「不覆盖
    /// 阶段」那条分支——它只改 `updated_at` 和 artifacts，status 看着没事，所以
    /// 断言盯的是 `updated_at`：无条件写会把它刷成当前时间。
    #[tokio::test]
    async fn parent_mirror_does_not_touch_a_canceled_parent_row() {
        let fixture = Fixture::new();
        let parent = fixture.seed("ocr-cas-parent", JobStatusKind::Canceled, "canceled");
        let child = fixture.seed("ocr-cas-parent-ocr", JobStatusKind::Running, "ocr_upload");

        let mut child_progress = child.clone().into_runtime();
        child_progress.stage = Some("ocr_processing".to_string());

        save_ocr_job(fixture.deps(), &child_progress, Some(&parent.job_id))
            .await
            .expect("mirror must stay best effort");

        // 子任务确实写进去了，说明上面真的走到了镜像那一步。
        let stored_child = fixture
            .deps()
            .db
            .get_job(&child.job_id)
            .expect("reload child");
        assert_eq!(stored_child.stage.as_deref(), Some("ocr_processing"));

        let stored_parent = fixture
            .deps()
            .db
            .get_job(&parent.job_id)
            .expect("reload parent");
        assert_eq!(stored_parent.status, JobStatusKind::Canceled);
        assert_eq!(stored_parent.updated_at, NEVER_WRITTEN_AT);
    }

    /// 同一行的另一半：终态 + stage 还停在 OCR 阶段。
    ///
    /// 这正是 TOCTOU 窗口留下的状态——driver 读到父任务还在 `ocr_processing`，
    /// 取消在读与写之间落库。此时镜像走的是「跟随子任务阶段」那条分支，它会把
    /// status 显式设成 Running，无条件写就是把一个已取消的任务复活。
    #[tokio::test]
    async fn parent_mirror_does_not_revive_a_terminal_parent_to_running() {
        let fixture = Fixture::new();
        let parent = fixture.seed(
            "ocr-cas-parent-mid",
            JobStatusKind::Canceled,
            "ocr_processing",
        );
        let child = fixture.seed(
            "ocr-cas-parent-mid-ocr",
            JobStatusKind::Running,
            "ocr_upload",
        );

        let mut child_progress = child.clone().into_runtime();
        child_progress.stage = Some("ocr_processing".to_string());

        save_ocr_job(fixture.deps(), &child_progress, Some(&parent.job_id))
            .await
            .expect("mirror must stay best effort");

        let stored_parent = fixture
            .deps()
            .db
            .get_job(&parent.job_id)
            .expect("reload parent");
        assert_eq!(stored_parent.status, JobStatusKind::Canceled);
        assert_eq!(stored_parent.updated_at, NEVER_WRITTEN_AT);
    }
}
