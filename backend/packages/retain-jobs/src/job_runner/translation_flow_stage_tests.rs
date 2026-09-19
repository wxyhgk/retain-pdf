//! driver 推进阶段时的写必须是 CAS，不能是无条件覆盖写。
//!
//! 一行任务有两个并发写入者：driver（推进阶段）和用户（取消）。driver 手里的
//! `JobRuntimeState` 是阶段开始时取的内存快照，它永远显示 Running；取消走的是
//! 另一条独立的 CAS 写。driver 若整行盖下去，就是一次 lost update——DB 里的
//! canceled 被复活成 running，spawn 前那道「canceled 不要覆盖」的守卫随之失效，
//! 任务最后写成 failed。用户点了取消却看到「失败」，OCR 的钱还白花了。
//!
//! 下面的用例就是按这个竞争摆的：DB 已是终态、driver 快照仍是 Running。
//! 把 CAS 改回 `persist_runtime_job_with_resources` 它们必红。

use std::sync::Arc;

use super::{prepare_translation_stage, run_render_stage_after_translation};
use crate::job_runner::ProcessRuntimeDeps;
use crate::models::domain::{JobSnapshot, JobStatusKind};
use crate::models::request::CreateJobInput;
use crate::storage_paths::{JobPaths, TRANSLATION_MANIFEST_FILE_NAME};

fn snapshot(job_id: &str) -> JobSnapshot {
    JobSnapshot::new(
        job_id.to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    )
}

/// 落一行终态的任务，并把这一行的目录结构准备好。
fn seed_terminal_row(deps: &ProcessRuntimeDeps, job_id: &str, status: JobStatusKind) -> JobPaths {
    let mut terminal = snapshot(job_id);
    terminal.status = status;
    terminal.stage = Some("canceled".to_string());
    deps.db.save_job(&terminal).expect("seed terminal row");
    let paths = JobPaths::for_job(&deps.persist.output_root, job_id);
    paths.create_all().expect("create job dirs");
    paths
}

fn cleanup(deps: &ProcessRuntimeDeps) {
    let _ = std::fs::remove_dir_all(&deps.config.project_root);
}

#[test]
fn prepare_translation_stage_refuses_to_revive_a_canceled_row() {
    let deps = crate::job_runner::process_runner::tests::test_runtime_deps(1);
    let job_id = "job-cas-translate";
    let paths = seed_terminal_row(&deps, job_id, JobStatusKind::Canceled);

    let mut stale = snapshot(job_id).into_runtime();
    stale.status = JobStatusKind::Running;

    let normalized = paths.ocr_dir.join("normalized.json");
    let source_pdf = paths.source_dir.join("source.pdf");
    let advanced =
        prepare_translation_stage(&deps, &mut stale, &paths, &normalized, &source_pdf, None)
            .expect("prepare translation stage");

    assert!(
        !advanced,
        "DB 已是 canceled，这一步不该写成功——写成功就意味着调用方会继续 spawn worker"
    );
    let persisted = deps.db.get_job(job_id).expect("read back");
    assert_eq!(
        persisted.status,
        JobStatusKind::Canceled,
        "取消被覆盖回 running 了：这正是用户点取消却看到「失败」的那个 bug"
    );
    assert_ne!(
        persisted.stage.as_deref(),
        Some("translating"),
        "终态行的 stage 也不该被推进"
    );
    cleanup(&deps);
}

/// 反面用例：行还在 running 时 CAS 必须真的写进去，否则上面那条断言可以靠
/// 「永远返回 false」作弊通过，而翻译阶段再也起不来。
#[test]
fn prepare_translation_stage_still_advances_a_running_row() {
    let deps = crate::job_runner::process_runner::tests::test_runtime_deps(1);
    let job_id = "job-cas-translate-running";
    let mut running = snapshot(job_id);
    running.status = JobStatusKind::Running;
    deps.db.save_job(&running).expect("seed running row");
    let paths = JobPaths::for_job(&deps.persist.output_root, job_id);
    paths.create_all().expect("create job dirs");

    let mut job = running.clone().into_runtime();
    let normalized = paths.ocr_dir.join("normalized.json");
    let source_pdf = paths.source_dir.join("source.pdf");
    let advanced =
        prepare_translation_stage(&deps, &mut job, &paths, &normalized, &source_pdf, None)
            .expect("prepare translation stage");

    assert!(advanced, "running 的行必须能被推进，否则翻译永远起不来");
    assert_eq!(
        deps.db.get_job(job_id).expect("read back").stage.as_deref(),
        Some("translating")
    );
    cleanup(&deps);
}

#[tokio::test]
async fn render_stage_refuses_to_revive_a_canceled_row() {
    let deps = crate::job_runner::process_runner::tests::test_runtime_deps(1);
    let job_id = "job-cas-render";
    let paths = seed_terminal_row(&deps, job_id, JobStatusKind::Canceled);
    std::fs::write(
        paths.translated_dir.join(TRANSLATION_MANIFEST_FILE_NAME),
        b"{}",
    )
    .expect("write translation manifest");
    let source_pdf = paths.source_dir.join("source.pdf");
    std::fs::write(&source_pdf, b"%PDF-1.4\n").expect("write source pdf");

    // 兜底：万一 CAS 被改回无条件写，spawn 前这道注册表守卫会拦住它，
    // 测试跑不出真实 worker 进程（那会烧付费配额）。断言仍然只盯 DB 状态。
    Arc::clone(&deps.canceled_jobs)
        .write()
        .await
        .insert(job_id.to_string());

    let mut stale = snapshot(job_id).into_runtime();
    stale.status = JobStatusKind::Running;

    let finished =
        run_render_stage_after_translation(deps.clone(), stale, &paths, &source_pdf).await;

    // 先断言 DB，再断言返回值：被覆盖掉的终态才是这条用例真正要挡的东西，
    // 而返回值那条断言在无条件写的版本里会先被 spawn 守卫的 Err 抢走。
    assert_eq!(
        deps.db.get_job(job_id).expect("read back").status,
        JobStatusKind::Canceled,
        "渲染阶段把 canceled 覆盖成 running 了"
    );
    assert_eq!(
        finished
            .expect("渲染阶段遇到终态行应当原样收口，而不是报错")
            .status,
        JobStatusKind::Canceled,
        "返回的必须是 DB 的真实状态，调用链据此停止"
    );
    cleanup(&deps);
}
