#[cfg(test)]
use crate::models::domain::JobArtifacts;
use crate::models::domain::JobRuntimeState;
use anyhow::Result;

use super::ProcessRuntimeDeps;

mod checkpoint_commit;
mod completion;
mod completion_pipeline;
mod execution;
mod failure_ai_diagnosis;
mod io_support;
mod result_support;
mod startup;
mod timeout_support;

#[cfg(test)]
use self::completion::apply_process_completion;
#[cfg(test)]
use self::completion::is_shutdown_noise;
#[cfg(test)]
use self::completion::ProcessCompletionKind;
#[cfg(test)]
use self::completion::{classify_process_completion, should_treat_shutdown_noise_as_success};
// 生产路径要用,不能挂在上面那个 #[cfg(test)] 后面。
pub(crate) use self::completion::ProcessStageKind;
use self::completion_pipeline::finalize_completed_process;
use self::execution::{collect_process_execution, ProcessExecution};
#[cfg(test)]
use self::failure_ai_diagnosis::maybe_attach_ai_failure_diagnosis;
use self::startup::spawn_started_process;
#[cfg(test)]
use self::timeout_support::apply_timeout_failure;
#[cfg(test)]
use self::timeout_support::timeout_detail_for_stage;

pub(crate) async fn execute_process_job(
    deps: ProcessRuntimeDeps,
    job: JobRuntimeState,
    extra_cancel_job_ids: &[String],
) -> Result<JobRuntimeState> {
    execute_process_job_stage(deps, job, extra_cancel_job_ids, ProcessStageKind::Final).await
}

/// 与 [`execute_process_job`] 相同,但由调用方声明这一步是否为流程终点。
/// 见 [`ProcessStageKind`]:翻译阶段跑完后面还有渲染,不能落终态。
pub(crate) async fn execute_process_job_stage(
    deps: ProcessRuntimeDeps,
    job: JobRuntimeState,
    extra_cancel_job_ids: &[String],
    stage_kind: ProcessStageKind,
) -> Result<JobRuntimeState> {
    let _model_lease = super::worker_process::ModelWorkerLease::for_job(deps.db.as_ref(), &job);
    let worker_runtime = deps.worker_process_runtime();
    let (job, child, runtime_secrets) = spawn_started_process(
        &deps.persist,
        &deps.canceled_jobs,
        &worker_runtime,
        job,
        extra_cancel_job_ids,
    )
    .await?;
    let execution = collect_process_execution(
        &deps.persist,
        &deps.canceled_jobs,
        &worker_runtime,
        child,
        job,
        runtime_secrets,
        extra_cancel_job_ids,
    )
    .await?;
    let completed = match execution {
        ProcessExecution::Completed(completed) => completed,
        ProcessExecution::TimedOut(timed_out_job) => return Ok(timed_out_job),
    };
    finalize_completed_process(
        &deps,
        &worker_runtime,
        completed,
        extra_cancel_job_ids,
        stage_kind,
    )
    .await
}

#[cfg(test)]
pub(super) mod tests {
    use std::collections::HashSet;
    use std::fs;
    use std::sync::Arc;

    use super::*;
    use crate::config::AppConfig;
    use crate::db::Db;
    use crate::job_events::persist_runtime_job_with_resources;
    use crate::models::domain::{now_iso, JobFailureInfo, JobSnapshot, JobStatusKind};
    use crate::models::request::CreateJobInput;
    use crate::ocr_provider::{provider_token_env_name, OcrProviderKind};
    use std::time::Duration;
    use tokio::sync::{RwLock, Semaphore};

    /// 拆分说明：原测试借用主 crate 的 `AppState` 仅当作
    /// {config, db, canceled_jobs, job_slots} 的打包容器，并不依赖其行为。
    /// job_runner 抽入 retain-jobs 后不能反向依赖主 crate，
    /// 故用本地同形测试结构体替代，测试逻辑与断言不变。
    struct TestState {
        config: Arc<crate::config::AppConfig>,
        db: Arc<Db>,
        canceled_jobs: Arc<RwLock<HashSet<String>>>,
        job_slots: Arc<Semaphore>,
    }

    pub(in crate::job_runner) fn test_runtime_deps(slots: usize) -> ProcessRuntimeDeps {
        let state = test_state(&format!("driver-{}", fastrand::u64(..)));
        let mut config = (*state.config).clone();
        config.job_runner.queue_poll_interval_ms = 1;
        ProcessRuntimeDeps::new(
            Arc::new(config),
            state.db,
            state.canceled_jobs,
            Arc::new(Semaphore::new(slots)),
            Arc::default(),
        )
    }

    fn build_job() -> JobRuntimeState {
        JobSnapshot::new(
            "job-test".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        )
        .into_runtime()
    }

    #[tokio::test]
    async fn startup_rejects_canceled_snapshot_before_spawning() {
        let deps = test_runtime_deps(1);
        let stale = build_job();
        let mut canceled = stale.snapshot();
        canceled.status = JobStatusKind::Canceled;
        deps.db.save_job(&canceled).unwrap();
        let result = spawn_started_process(
            &deps.persist,
            &deps.canceled_jobs,
            &deps.worker_process_runtime(),
            stale,
            &[],
        )
        .await;
        assert!(result
            .err()
            .unwrap()
            .to_string()
            .contains("no longer eligible"));
        assert_eq!(
            deps.db.get_job(&canceled.job_id).unwrap().status,
            JobStatusKind::Canceled
        );
        fs::remove_dir_all(&deps.config.project_root).unwrap();
    }

    fn test_state(test_name: &str) -> TestState {
        let root = std::env::temp_dir().join(format!(
            "rust-api-process-runner-{test_name}-{}-{}",
            std::process::id(),
            now_iso().replace([':', '.'], "-")
        ));
        let data_root = root.join("data");
        let output_root = data_root.join("jobs");
        let downloads_dir = data_root.join("downloads");
        let uploads_dir = data_root.join("uploads");
        let db_dir = data_root.join("db");
        let rust_api_root = root.join("rust_api");
        let scripts_dir = root.join("scripts");
        fs::create_dir_all(&output_root).expect("create output root");
        fs::create_dir_all(&downloads_dir).expect("create downloads dir");
        fs::create_dir_all(&uploads_dir).expect("create uploads dir");
        fs::create_dir_all(&db_dir).expect("create db dir");
        fs::create_dir_all(&rust_api_root).expect("create rust_api root");
        fs::create_dir_all(&scripts_dir).expect("create scripts dir");

        let config = Arc::new(AppConfig {
            project_root: root.clone(),
            rust_api_root,
            data_root: data_root.clone(),
            scripts_dir: scripts_dir.clone(),
            uploads_dir,
            downloads_dir,
            jobs_db_path: data_root.join("db").join("jobs.db"),
            output_root,
            python_bin: "python3".to_string(),
            pipeline_command: "retainpdf-pipeline".to_string(),
            bind_host: "127.0.0.1".to_string(),
            port: 41000,
            simple_port: 41001,
            upload_max_bytes: 0,
            upload_max_pages: 0,
            upload_processing: Default::default(),
            api_keys: HashSet::new(),
            max_running_jobs: 1,
            provider_limits: crate::config::ProviderLimitsConfig::default(),
            provider_runtime: crate::config::ProviderRuntimeConfig::default(),
            job_runner: crate::config::JobRunnerConfig {
                // 收尾上限默认 30 秒,那是生产该等的时长,不是测试该等的。
                // 正常路径下管道一关 join 就瞬时返回,压到 2 秒不影响任何
                // 正常用例,只让"读取任务卡住"那条路径能在秒级内被断言。
                worker_output_drain_secs: 2,
                ..crate::config::JobRunnerConfig::default()
            },
            ai_service: crate::config::AiServiceConfig::default(),
            jobs_service: crate::config::JobsServiceConfig::default(),
            asset: crate::config::AssetConfig::default(),
            cleanup: crate::config::CleanupConfig::default(),
            db: crate::config::DbConfig::default(),
            ai_proxy: crate::config::AiProxyConfig::default(),
            reader_llm: crate::config::ReaderLlmConfig::default(),
            rag: crate::config::RagConfig::default(),
        });

        let db = Arc::new(Db::new(
            config.jobs_db_path.clone(),
            config.data_root.clone(),
        ));
        db.init().expect("init db");

        TestState {
            config,
            db,
            canceled_jobs: Arc::new(RwLock::new(HashSet::new())),
            job_slots: Arc::new(Semaphore::new(1)),
        }
    }

    #[test]
    fn shutdown_noise_requires_known_patterns() {
        assert!(is_shutdown_noise("Exception ignored in sys.unraisablehook"));
        assert!(is_shutdown_noise("Exception ignored in"));
        assert!(!is_shutdown_noise("normal stderr"));
    }

    #[test]
    fn shutdown_noise_success_requires_written_artifacts() {
        let mut job = build_job();
        job.artifacts = Some(JobArtifacts {
            output_pdf: Some("/definitely/missing.pdf".to_string()),
            summary: Some("/definitely/missing.json".to_string()),
            ..JobArtifacts::default()
        });
        assert!(!should_treat_shutdown_noise_as_success(
            &job,
            "Exception ignored in sys.unraisablehook"
        ));
    }

    #[test]
    fn timeout_detail_distinguishes_normalizing_stage() {
        assert_eq!(
            timeout_detail_for_stage(Some("normalizing")),
            "normalization timeout"
        );
        assert_eq!(
            timeout_detail_for_stage(Some("translating")),
            "provider timeout"
        );
        assert_eq!(timeout_detail_for_stage(None), "provider timeout");
    }

    #[test]
    fn classify_process_completion_prefers_cancel_then_success_then_noise() {
        assert_eq!(
            classify_process_completion(true, true, true),
            ProcessCompletionKind::Canceled
        );
        assert_eq!(
            classify_process_completion(false, true, true),
            ProcessCompletionKind::Succeeded
        );
        assert_eq!(
            classify_process_completion(false, false, true),
            ProcessCompletionKind::SucceededWithShutdownNoise
        );
        assert_eq!(
            classify_process_completion(false, false, false),
            ProcessCompletionKind::Failed
        );
    }

    #[test]
    fn apply_timeout_failure_marks_job_failed() {
        let mut job = JobSnapshot::new(
            "job-test".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.stage = Some("normalizing".to_string());
        apply_timeout_failure(&mut job, "2026-04-04T00:00:00Z".to_string());
        assert_eq!(job.status, JobStatusKind::Failed);
        assert_eq!(job.stage.as_deref(), Some("failed"));
        assert_eq!(job.stage_detail.as_deref(), Some("normalization timeout"));
        assert_eq!(job.error.as_deref(), Some("normalization timeout"));
    }

    #[tokio::test]
    async fn execute_process_job_preserves_timeout_process_output() {
        let state = test_state("timeout-output");
        let mut job = JobSnapshot::new(
            "job-timeout-output".to_string(),
            CreateJobInput::default(),
            vec![
                "python3".to_string(),
                "-c".to_string(),
                "import sys, time; print('stdout-before-timeout', flush=True); print('stderr-before-timeout', file=sys.stderr, flush=True); time.sleep(5)".to_string(),
            ],
        )
        .into_runtime();
        job.request_payload.runtime.job_id = job.job_id.clone();
        job.request_payload.runtime.timeout_seconds = 1;

        let finished = execute_process_job(
            ProcessRuntimeDeps::new(
                state.config.clone(),
                state.db.clone(),
                state.canceled_jobs.clone(),
                state.job_slots.clone(),
                Arc::default(),
            ),
            job,
            &[],
        )
        .await
        .expect("execute process job");

        assert_eq!(finished.status, JobStatusKind::Failed);
        assert_eq!(finished.stage_detail.as_deref(), Some("provider timeout"));
        let result = finished.result.as_ref().expect("process result");
        assert!(!result.success);
        assert_eq!(result.return_code, -1);
        assert_eq!(
            finished
                .failure
                .as_ref()
                .and_then(|failure| failure.failure_code.as_deref()),
            Some("process_timeout")
        );
        assert_eq!(
            finished
                .failure
                .as_ref()
                .and_then(|failure| failure.failure_category.as_deref()),
            Some("timeout")
        );
        assert!(finished
            .failure
            .as_ref()
            .and_then(|failure| failure.root_cause.as_deref())
            .is_some_and(|root_cause| root_cause.contains("timeout_seconds=1")));
        assert!(result.stdout.contains("stdout-before-timeout"));
        assert!(result.stderr.contains("stderr-before-timeout"));
        assert!(result.duration_seconds >= 1.0);
        assert!(finished
            .log_tail
            .iter()
            .any(|line| line.contains("stdout-before-timeout")));
        assert!(finished
            .log_tail
            .iter()
            .any(|line| line.contains("stderr-before-timeout")));
    }

    /// 卡死的 worker 必须被空闲超时截住,而不是等满 timeout_seconds。
    ///
    /// `timeout_seconds` 要按最坏情况给——一本大部头翻译几小时是正常的——
    /// 于是"打完第一行就再没动静"这种卡死也要等满那几小时。这个用例把两个
    /// 阈值拉开两个数量级(总 600 秒 / 空闲 2 秒),再让 worker 打一行就睡死:
    /// 若空闲检测不生效,用例会撞上外层的 30 秒 timeout。
    #[tokio::test]
    async fn silent_worker_is_cut_by_the_no_output_timeout_not_the_total_one() {
        let state = test_state("no-output-timeout");
        let mut job = JobSnapshot::new(
            "job-no-output".to_string(),
            CreateJobInput::default(),
            vec![
                "python3".to_string(),
                "-c".to_string(),
                "import sys, time; print('first-line', flush=True); time.sleep(600)".to_string(),
            ],
        )
        .into_runtime();
        job.request_payload.runtime.job_id = job.job_id.clone();
        job.request_payload.runtime.timeout_seconds = 600;
        job.request_payload.runtime.no_output_timeout_seconds = 2;

        let finished = tokio::time::timeout(
            Duration::from_secs(30),
            execute_process_job(
                ProcessRuntimeDeps::new(
                    state.config.clone(),
                    state.db.clone(),
                    state.canceled_jobs.clone(),
                    state.job_slots.clone(),
                    Arc::default(),
                ),
                job,
                &[],
            ),
        )
        .await
        .expect("空闲 2 秒就该收掉,不该等满 timeout_seconds=600")
        .expect("execute process job");

        assert_eq!(finished.status, JobStatusKind::Failed);
        assert_eq!(
            finished.stage_detail.as_deref(),
            Some("no output for 2s"),
            "必须说明是卡住不动,而不是笼统的 provider timeout——两者的排查方向不同"
        );
        // 已经收到的输出仍要保留,那是排查卡在哪一步的唯一线索。
        let result = finished.result.as_ref().expect("process result");
        assert!(
            result.stdout.contains("first-line"),
            "被空闲超时收掉时,卡死之前的输出不能丢"
        );
    }

    /// 不设 `no_output_timeout_seconds`(默认 0)时,空闲检测必须完全不介入。
    ///
    /// 各阶段的正常静默时长差别很大(等 provider 响应、单页 OCR),所以这个
    /// 功能默认关闭。这条用例守的就是"默认关闭"本身:worker 静默 3 秒后
    /// 正常打印并成功退出,不得被判成超时。
    #[tokio::test]
    async fn silence_is_allowed_when_no_output_timeout_is_disabled() {
        let state = test_state("no-output-disabled");
        let mut job = JobSnapshot::new(
            "job-silent-ok".to_string(),
            CreateJobInput::default(),
            vec![
                "python3".to_string(),
                "-c".to_string(),
                "import time; time.sleep(3); print('late-line', flush=True)".to_string(),
            ],
        )
        .into_runtime();
        job.request_payload.runtime.job_id = job.job_id.clone();
        job.request_payload.runtime.timeout_seconds = 60;
        assert_eq!(
            job.request_payload.runtime.no_output_timeout_seconds, 0,
            "前置条件:这个功能必须默认关闭"
        );

        let finished = execute_process_job(
            ProcessRuntimeDeps::new(
                state.config.clone(),
                state.db.clone(),
                state.canceled_jobs.clone(),
                state.job_slots.clone(),
                Arc::default(),
            ),
            job,
            &[],
        )
        .await
        .expect("execute process job");

        assert_ne!(
            finished.stage_detail.as_deref(),
            Some("no output for 0s"),
            "关闭时不得触发空闲超时"
        );
        assert!(
            finished
                .result
                .as_ref()
                .is_some_and(|result| result.stdout.contains("late-line")),
            "静默之后的输出必须照常收到:{:?}",
            finished.stage_detail
        );
    }

    /// worker 退出后,孙进程仍握着 stdout 管道时,runner 不能永久挂住。
    ///
    /// 这里的 worker 派生一个 `setsid()` 脱离进程组的孙进程再立刻退出。
    /// 孙进程继承了 stdout 的写端,组杀打不到它,管道于是不会关闭——
    /// `lines.next_line()` 永远不返回 `None`,读取任务永远不结束。
    ///
    /// 收尾 join 若无上限,`execute_process_job` 会卡在这里不返回:job 在 DB 里
    /// 停在 running,再没有任何东西推进它,也没有一行日志说明原因。所以外层
    /// 套一个远大于收尾上限的 timeout —— 它红就意味着 runner 挂死了。
    #[tokio::test]
    async fn worker_exit_completes_even_when_a_detached_grandchild_holds_stdout() {
        let state = test_state("stdout-held-by-grandchild");
        let mut job = JobSnapshot::new(
            "job-stdout-held".to_string(),
            CreateJobInput::default(),
            vec![
                "python3".to_string(),
                "-c".to_string(),
                // 父进程立刻退出;孙进程脱组后抱着 stdout 睡 60 秒。
                //
                // 这个 60 秒是本用例的全部证明力所在:它必须远大于外层
                // timeout,否则"无上限地等下去"也能等到管道自然关闭,用例
                // 照样绿——第一版就是这么写的(睡 10 秒),反证时只是从 4 秒
                // 变成 10 秒,根本没红。
                "import os, sys, time\n\
                 sys.stdout.write('parent-line\\n'); sys.stdout.flush()\n\
                 if os.fork() == 0:\n\
                 \x20   os.setsid()\n\
                 \x20   time.sleep(60)\n\
                 \x20   os._exit(0)\n\
                 os._exit(0)\n"
                    .to_string(),
            ],
        )
        .into_runtime();
        job.request_payload.runtime.job_id = job.job_id.clone();
        job.request_payload.runtime.timeout_seconds = 60;

        let started = std::time::Instant::now();
        let finished = tokio::time::timeout(
            Duration::from_secs(20),
            execute_process_job(
                ProcessRuntimeDeps::new(
                    state.config.clone(),
                    state.db.clone(),
                    state.canceled_jobs.clone(),
                    state.job_slots.clone(),
                    Arc::default(),
                ),
                job,
                &[],
            ),
        )
        .await
        .expect("worker 已退出,runner 不得卡在等待 stdout 读取任务上")
        .expect("execute process job");

        let elapsed = started.elapsed();

        assert!(
            matches!(
                finished.status,
                JobStatusKind::Succeeded | JobStatusKind::Failed
            ),
            "放弃收集输出之后仍必须落到终态,而不是停在 running：{:?}",
            finished.status
        );
        // 返回必须是收尾上限促成的,而不是靠孙进程自己睡醒把管道关掉。
        assert!(
            elapsed < Duration::from_secs(15),
            "耗时 {elapsed:?}：说明 runner 是等到孙进程退出才返回的,收尾上限没起作用"
        );
    }

    #[test]
    fn apply_process_completion_marks_cancel_and_clears_runtime_artifacts() {
        let mut job = build_job();
        job.artifacts = Some(JobArtifacts {
            normalized_document_json: Some("/tmp/doc.json".to_string()),
            normalization_report_json: Some("/tmp/doc.report.json".to_string()),
            schema_version: Some("document.v1".to_string()),
            ..JobArtifacts::default()
        });
        apply_process_completion(
            &mut job,
            ProcessCompletionKind::Canceled,
            "",
            ProcessStageKind::Final,
        );
        assert_eq!(job.status, JobStatusKind::Canceled);
        assert_eq!(job.stage.as_deref(), Some("canceled"));
        let artifacts = job.artifacts.as_ref().unwrap();
        assert!(artifacts.normalized_document_json.is_none());
        assert!(artifacts.normalization_report_json.is_none());
        assert!(artifacts.schema_version.is_none());
    }

    #[tokio::test]
    async fn maybe_attach_ai_failure_diagnosis_persists_ai_result_and_event() {
        let mut state = test_state("ai-diagnosis");
        let bin_dir = state.config.data_root.join("bin");
        fs::create_dir_all(&bin_dir).expect("create stub bin dir");
        let stub = bin_dir.join("retainpdf-pipeline");
        let script = r#"#!/usr/bin/env python3
import argparse
import json
import os
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("subcommand", nargs="?")
parser.add_argument("--input-json", required=True)
parser.add_argument("--model")
parser.add_argument("--base-url")
args = parser.parse_args()

payload = json.loads(Path(args.input_json).read_text(encoding="utf-8"))
assert payload["failure"]["category"] == "unknown"
assert payload["request_payload"]["translation"]["api_key"] == ""
assert payload["request_payload"]["translation"]["api_key_configured"] is True
assert payload["request_payload"]["ocr"]["mineru_token"] == ""
assert payload["request_payload"]["ocr"]["mineru_token_configured"] is False
assert os.environ.get("RETAIN_TRANSLATION_API_KEY") == "sk-test"
print(json.dumps({
    "status": "ok",
    "summary": "AI diagnosis summary",
    "root_cause": "AI root cause",
    "suggestion": "AI suggestion",
    "confidence": "medium",
    "observed_signals": ["unknown-category", "runtime-test"]
}))
"#;
        fs::write(&stub, script).expect("write stub pipeline command");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&stub, fs::Permissions::from_mode(0o700))
                .expect("make stub executable");
        }
        let mut config = (*state.config).clone();
        config.pipeline_command = stub.to_string_lossy().to_string();
        state.config = Arc::new(config);

        let mut job = build_job();
        job.job_id = "job-ai-diagnosis".to_string();
        job.request_payload.runtime.job_id = job.job_id.clone();
        job.request_payload.translation.api_key = "sk-test".to_string();
        job.request_payload.translation.model = "deepseek-flash".to_string();
        job.request_payload.translation.base_url = "https://api.deepseek.com/v1".to_string();
        job.status = JobStatusKind::Failed;
        job.stage = Some("failed".to_string());
        job.stage_detail = Some("Python worker 执行失败".to_string());
        job.error = Some("Traceback (most recent call last):\nRuntimeError: boom".to_string());
        job.failure = Some(JobFailureInfo {
            stage: "translation".to_string(),
            category: "unknown".to_string(),
            code: None,
            failed_stage: Some("translation".to_string()),
            failure_code: Some("unknown".to_string()),
            failure_category: Some("internal".to_string()),
            provider_stage: None,
            provider_code: None,
            summary: "任务失败，但暂未识别出明确根因".to_string(),
            root_cause: Some("Traceback (most recent call last):".to_string()),
            retryable: true,
            upstream_host: None,
            provider: Some("translation".to_string()),
            suggestion: Some("查看日志".to_string()),
            last_log_line: Some("RuntimeError: boom".to_string()),
            raw_excerpt: Some("RuntimeError: boom".to_string()),
            raw_error_excerpt: Some("RuntimeError: boom".to_string()),
            raw_diagnostic: None,
            ai_diagnostic: None,
            resume_from: None,
            recovery_hint: None,
        });
        job.artifacts = Some(JobArtifacts {
            job_root: Some(format!("jobs/{}", job.job_id)),
            ..JobArtifacts::default()
        });
        persist_runtime_job_with_resources(
            state.db.as_ref(),
            &state.config.data_root,
            &state.config.output_root,
            &job,
        )
        .expect("persist runtime job");

        maybe_attach_ai_failure_diagnosis(
            state.db.as_ref(),
            &state.config.failure_ai_diagnosis_runtime(),
            &mut job,
        )
        .await;

        let failure = job.failure.as_ref().expect("failure");
        assert_eq!(failure.category, "unknown");
        let ai = failure.ai_diagnostic.as_ref().expect("ai diagnosis");
        assert_eq!(ai.summary, "AI diagnosis summary");
        assert_eq!(ai.root_cause.as_deref(), Some("AI root cause"));
        assert_eq!(ai.suggestion.as_deref(), Some("AI suggestion"));
        assert_eq!(ai.confidence.as_deref(), Some("medium"));
        assert_eq!(
            ai.observed_signals,
            vec!["unknown-category".to_string(), "runtime-test".to_string()]
        );

        let request_log = state
            .config
            .output_root
            .join(&job.job_id)
            .join("logs")
            .join("failure-ai-diagnosis.request.json");
        let response_log = state
            .config
            .output_root
            .join(&job.job_id)
            .join("logs")
            .join("failure-ai-diagnosis.response.json");
        assert!(request_log.exists());
        assert!(response_log.exists());
        let request_payload: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&request_log).expect("read request log"))
                .expect("parse request log");
        assert_eq!(
            request_payload["request_payload"]["translation"]["api_key"],
            ""
        );
        assert_eq!(
            request_payload["request_payload"]["translation"]["api_key_configured"],
            true
        );
        assert_eq!(
            request_payload["request_payload"]["ocr"]["mineru_token"],
            ""
        );
        assert_eq!(
            request_payload["request_payload"]["ocr"]["mineru_token_configured"],
            false
        );
        assert!(!fs::read_to_string(&request_log)
            .expect("request log text")
            .contains("sk-test"));

        let events = state
            .db
            .list_job_events(&job.job_id, 20, 0)
            .expect("list events");
        let event = events
            .iter()
            .find(|item| item.event == "failure_ai_diagnosed")
            .expect("failure_ai_diagnosed event");
        let payload = event.payload.as_ref().expect("event payload");
        assert_eq!(payload["category"], "unknown");
        assert_eq!(payload["summary"], "任务失败，但暂未识别出明确根因");
        assert_eq!(payload["ai_diagnostic"]["summary"], "AI diagnosis summary");
    }

    #[tokio::test]
    async fn execute_process_job_injects_provider_and_translation_envs() {
        let state = test_state("provider-envs");
        let credential_ref = "cred_translation_env";
        let translation_secret = "sk-env-test";
        let secrets_dir = state.config.data_root.join("secrets");
        fs::create_dir_all(&secrets_dir).expect("create secrets directory");
        let vault_path = secrets_dir.join("credentials.json");
        fs::write(
            &vault_path,
            serde_json::json!({
                "schema": "retainpdf_credential_vault_v1",
                "revision": 1,
                "credentials": {
                    (credential_ref): {
                        "kind": "translation_api_key",
                        "provider": "deepseek",
                        "label": "test",
                        "secret": translation_secret,
                        "created_at": "now",
                        "updated_at": "now"
                    }
                }
            })
            .to_string(),
        )
        .expect("write credential vault");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&vault_path, fs::Permissions::from_mode(0o600))
                .expect("secure credential vault");
        }
        let paddle_env = provider_token_env_name(&OcrProviderKind::Paddle).expect("paddle env");
        let mineru_env = provider_token_env_name(&OcrProviderKind::Mineru).expect("mineru env");
        let mut job = JobSnapshot::new(
            "job-provider-envs".to_string(),
            CreateJobInput::default(),
            vec![
                "python3".to_string(),
                "-c".to_string(),
                format!(
                    r#"import json, os
print(json.dumps({{
  "translation": os.environ.get("RETAIN_TRANSLATION_API_KEY", ""),
  "paddle": os.environ.get({paddle_env:?}, ""),
  "mineru": os.environ.get({mineru_env:?}, ""),
  "provider_config": os.environ.get("RETAIN_OCR_PROVIDER_CONFIG", "")
}}, ensure_ascii=False))"#
                ),
            ],
        )
        .into_runtime();
        job.request_payload.runtime.job_id = job.job_id.clone();
        job.request_payload.translation.api_key.clear();
        job.request_payload.translation.credential_ref = credential_ref.to_string();
        job.request_payload.ocr.provider = "paddle".to_string();
        job.request_payload.ocr.paddle_token = "paddle-env-test".to_string();
        job.request_payload.ocr.mineru_token = String::new();

        let finished = execute_process_job(
            ProcessRuntimeDeps::new(
                state.config.clone(),
                state.db.clone(),
                state.canceled_jobs.clone(),
                state.job_slots.clone(),
                Arc::default(),
            ),
            job,
            &[],
        )
        .await
        .expect("execute process job");

        assert_eq!(finished.status, JobStatusKind::Succeeded);
        let result = finished.result.as_ref().expect("process result");
        assert!(result.success);
        // The worker process genuinely received the credentials via env vars
        // (that's what this test guards), but the raw stdout persisted into
        // result_json must have them redacted rather than leaking them into
        // the job's stored logs.
        assert!(!result.stdout.contains("sk-env-test"));
        assert!(!result.stdout.contains("paddle-env-test"));
        assert!(result.stdout.contains("\"translation\": \"[REDACTED]\""));
        assert!(result.stdout.contains("\"paddle\": \"[REDACTED]\""));
        assert!(result.stdout.contains("\"mineru\": \"\""));
        assert_eq!(
            finished.request_payload.translation.credential_ref,
            credential_ref
        );
        assert!(finished.request_payload.translation.api_key.is_empty());
        let provider_config_path = state
            .config
            .provider_runtime
            .ocr_provider_config_path
            .to_string_lossy();
        assert!(result.stdout.contains(provider_config_path.as_ref()));
    }
}
