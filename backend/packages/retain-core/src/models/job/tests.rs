use crate::models::{CreateJobInput, JobSnapshot, JobStatusKind};

/// 一个阶段不得归档上一阶段的进度。
///
/// `progress_current/total` 是 job 级的、跨阶段不自动重置。渲染阶段的进度
/// 走 stage snapshot,从不写这对字段,所以若进入渲染时不清零,它整段都停在
/// 翻译留下的值上——真实任务里 stage_history 把 rendering 和 finished 两条
/// 都归档成了「59/59」,而那是翻译的文本块数,不是渲染的页数。
#[test]
fn a_stage_must_not_archive_the_previous_stages_progress() {
    let mut job = JobSnapshot::new(
        "job-stage-bleed".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.started_at = Some("2026-04-04T00:00:00Z".to_string());

    job.updated_at = "2026-04-04T00:00:01Z".to_string();
    job.stage = Some("translating".to_string());
    job.sync_runtime_state();
    job.updated_at = "2026-04-04T00:00:05Z".to_string();
    job.progress_current = Some(59);
    job.progress_total = Some(59);
    job.sync_runtime_state();

    // 进入渲染:调用方清零,渲染自己的进度不走这对字段
    job.updated_at = "2026-04-04T00:00:06Z".to_string();
    job.stage = Some("rendering".to_string());
    job.progress_current = None;
    job.progress_total = None;
    job.sync_runtime_state();
    job.updated_at = "2026-04-04T00:00:08Z".to_string();
    job.sync_runtime_state();

    let history = &job.runtime.as_ref().expect("runtime").stage_history;
    let rendering = history
        .iter()
        .find(|entry| entry.stage == "rendering")
        .expect("rendering entry");
    assert_eq!(
        (rendering.progress_current, rendering.progress_total),
        (None, None),
        "渲染阶段不得带着翻译的 59/59"
    );
    let translating = history
        .iter()
        .find(|entry| entry.stage == "translating")
        .expect("translating entry");
    assert_eq!(
        (translating.progress_current, translating.progress_total),
        (Some(59), Some(59)),
        "翻译自己的归档不能因此丢失"
    );
}

/// 阶段结束时要把当时的进度留在历史里,否则任务跑完就查不到
/// 「这次翻译了多少块」——`stages.*.progress` 只反映当前活跃阶段,
/// 阶段一结束就回到 null。
#[test]
fn stage_history_archives_the_progress_each_stage_ended_with() {
    let mut job = JobSnapshot::new(
        "job-stage-progress".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.started_at = Some("2026-04-04T00:00:00Z".to_string());

    // 按真实时序:进入阶段时还没有进度(translation_flow_stage 会显式清空),
    // 进度是运行中一次次更新上来的。这一步很关键——若把 50/50 直接写在
    // 进入那一次,用例就只走了 push 分支,删掉「活跃期间更新」的代码它照样
    // 绿(实测过)。
    job.updated_at = "2026-04-04T00:00:05Z".to_string();
    job.stage = Some("translating".to_string());
    job.progress_current = None;
    job.progress_total = None;
    job.sync_runtime_state();

    // 运行中推进到 50/50
    job.updated_at = "2026-04-04T00:00:09Z".to_string();
    job.progress_current = Some(50);
    job.progress_total = Some(50);
    job.sync_runtime_state();

    // 进入渲染:job 上的进度会被改写成渲染自己的口径
    job.updated_at = "2026-04-04T00:00:12Z".to_string();
    job.stage = Some("rendering".to_string());
    job.progress_current = Some(1);
    job.progress_total = Some(4);
    job.sync_runtime_state();

    let history = &job.runtime.as_ref().expect("runtime").stage_history;
    let translating = history
        .iter()
        .find(|entry| entry.stage == "translating")
        .expect("translating entry");
    assert_eq!(
        (translating.progress_current, translating.progress_total),
        (Some(50), Some(50)),
        "翻译阶段结束时的进度必须留在历史里，不能被后一阶段的口径冲掉"
    );

    // 当前阶段还没结束,历史条目里先不填
    let rendering = history
        .iter()
        .find(|entry| entry.stage == "rendering")
        .expect("rendering entry");
    assert_eq!(rendering.exit_at, None);
}

#[test]
fn sync_runtime_state_tracks_stage_history_and_elapsed() {
    let mut job = JobSnapshot::new(
        "job-runtime-metrics".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.started_at = Some("2026-04-04T00:00:00Z".to_string());
    job.updated_at = "2026-04-04T00:00:05Z".to_string();
    job.stage = Some("running".to_string());
    job.stage_detail = Some("正在运行".to_string());
    job.sync_runtime_state();

    job.updated_at = "2026-04-04T00:00:12Z".to_string();
    job.stage = Some("rendering".to_string());
    job.stage_detail = Some("正在渲染".to_string());
    job.sync_runtime_state();

    job.updated_at = "2026-04-04T00:00:20Z".to_string();
    job.finished_at = Some("2026-04-04T00:00:20Z".to_string());
    job.status = JobStatusKind::Succeeded;
    job.sync_runtime_state();

    let runtime = job.runtime.as_ref().expect("runtime");
    assert_eq!(runtime.stage_history.len(), 3);
    assert_eq!(runtime.total_elapsed_ms, Some(20_000));
    assert_eq!(runtime.retry_count, 0);
    assert_eq!(runtime.stage_history[0].stage, "queued");
    assert_eq!(runtime.stage_history[1].duration_ms, Some(7_000));
    assert_eq!(
        runtime
            .stage_history
            .last()
            .and_then(|item| item.duration_ms),
        Some(8_000)
    );
}

#[test]
fn register_retry_updates_runtime_retry_counters() {
    let mut job = JobSnapshot::new(
        "job-runtime-retry".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.updated_at = "2026-04-04T00:00:10Z".to_string();
    job.register_retry();
    job.register_retry();

    let runtime = job.runtime.as_ref().expect("runtime");
    assert_eq!(runtime.retry_count, 2);
    assert_eq!(
        runtime.last_retry_at.as_deref(),
        Some("2026-04-04T00:00:10Z")
    );
}

/// 渲染阶段里的精修子步骤（Python `substage=refining`）归到 render，进度单位 step。
#[test]
fn refining_substage_is_a_render_step() {
    use crate::models::{
        event_progress_unit, public_stage_for_raw_stage, public_stage_for_substage,
    };
    assert_eq!(public_stage_for_substage(Some("refining")), Some("render"));
    assert_eq!(public_stage_for_raw_stage(Some("refining")), Some("render"));
    assert_eq!(event_progress_unit(Some("refining"), "stage_progress"), "step");
    assert_eq!(event_progress_unit(Some("refining"), "stage_start"), "step");
}
