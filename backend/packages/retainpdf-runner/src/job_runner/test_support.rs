//! job_runner 各子模块单测共用的小工具。
//!
//! 这些函数原先在 stage_contract / process_contract / process_runner /
//! translation_flow_support / worker_process / ocr_flow::provider_transport
//! 里各抄一份，逐字相同；收在这里，测试正文只留各自在意的差异。

use std::fs;
use std::path::{Path, PathBuf};

use crate::models::domain::{JobRuntimeState, JobSnapshot};
use crate::models::request::CreateJobInput;

/// 最朴素的运行态任务：id `job-test`、默认输入、命令只有 `python`。
/// 只关心状态流转、不关心命令内容的测试都用它。
pub(crate) fn runtime_job() -> JobRuntimeState {
    JobSnapshot::new(
        "job-test".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    )
    .into_runtime()
}

/// 建一个唯一的临时目录并返回；`name` 只为出问题时好认，唯一性靠随机后缀。
pub(crate) fn temp_root(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "retain-jobs-test-{name}-{}",
        fastrand::u64(..)
    ));
    fs::create_dir_all(&root).expect("create temp root");
    root
}

/// 带 `secrets/` 子目录的临时 data root，给凭据解析类测试用。
pub(crate) fn credential_test_root(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "retain-jobs-credential-{name}-{}",
        fastrand::u64(..)
    ));
    fs::create_dir_all(root.join("secrets")).expect("create credential test root");
    root
}

/// 写一份只含单条凭据的 vault。权限收到 0600：解析端会拒绝组/其他人可读的文件，
/// 不收紧的话测到的是权限错误而不是凭据解析。
pub(crate) fn write_credential_vault(
    root: &Path,
    credential_ref: &str,
    kind: &str,
    provider: &str,
    secret: &str,
) {
    let path = root.join("secrets").join("credentials.json");
    fs::write(
        &path,
        serde_json::json!({
            "schema": "retainpdf_credential_vault_v1",
            "credentials": {
                (credential_ref): {
                    "kind": kind,
                    "provider": provider,
                    "secret": secret
                }
            }
        })
        .to_string(),
    )
    .expect("write credential vault");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
            .expect("secure credential vault");
    }
}

/// 一棵临时目录树（data/jobs、data/uploads、data/db……）和指向它的 `AppConfig`。目录都建好。
pub(crate) fn test_app_config(root: &Path) -> crate::config::AppConfig {
    use std::collections::HashSet;
    use crate::config::AppConfig;
    let root = root.to_path_buf();
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

    AppConfig {
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
        shutdown_grace_secs: 1,
        upload_max_bytes: 0,
        upload_max_pages: 0,
        min_free_disk_bytes: 0,
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
        jobs_service: crate::config::JobsServiceConfig::default(),
        cleanup: crate::config::CleanupConfig::default(),
        db: crate::config::DbConfig::default(),
        accounts: Default::default(),
        origin_policy: Default::default(),
    }
}
