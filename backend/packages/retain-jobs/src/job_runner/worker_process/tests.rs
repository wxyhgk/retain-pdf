use std::fs;
use std::path::PathBuf;

use super::super::runtime_credentials::OCR_PROVIDER_CREDENTIAL_KIND;
use super::*;
use crate::job_runner::test_support::{credential_test_root, write_credential_vault};
use crate::models::domain::{JobSnapshot, OcrProviderKind};
use crate::models::request::CreateJobInput;

fn job_with_ocr_ref(provider: &str, credential_ref: &str) -> JobRuntimeState {
    let mut input = CreateJobInput::default();
    input.ocr.provider = provider.to_string();
    input.ocr.credential_ref = credential_ref.to_string();
    JobSnapshot::new("job-ocr-ref".to_string(), input, vec!["true".to_string()]).into_runtime()
}

fn command_env(command: &Command, name: &str) -> Option<String> {
    command
        .as_std()
        .get_envs()
        .find(|(key, _)| *key == std::ffi::OsStr::new(name))
        .and_then(|(_, value)| value)
        .map(|value| value.to_string_lossy().into_owned())
}

#[test]
fn builtin_ocr_credential_ref_is_resolved_into_provider_env() {
    let root = credential_test_root("builtin");
    let credential_ref = "cred_ocr_paddle";
    let secret = "paddle-vault-secret";
    write_credential_vault(
        &root,
        credential_ref,
        OCR_PROVIDER_CREDENTIAL_KIND,
        "  Paddle  ",
        secret,
    );
    let job = job_with_ocr_ref("paddle", credential_ref);
    let mut command = Command::new("true");

    let runtime_secrets =
        apply_job_credentials(&mut command, &root, &job).expect("apply OCR credential");

    let env_name = provider_token_env_name(&OcrProviderKind::Paddle).expect("paddle env");
    assert_eq!(command_env(&command, env_name).as_deref(), Some(secret));
    assert_eq!(runtime_secrets, vec![secret.to_string()]);
}

fn model_job() -> JobRuntimeState {
    let profile:retain_core::model_connection::ModelConnection=serde_json::from_value(serde_json::json!({"id":"qwen-main","revision":1,"provider":"qwen","base_url":"https://dashscope.aliyuncs.com/compatible-mode/v1","model":"qwen3.8-flash","credential_ref":"cred_translation","concurrency":2})).unwrap();
    let mut input = CreateJobInput::default();
    input.translation.model = profile.model.clone();
    input.translation.base_url = profile.base_url.clone();
    input.translation.credential_ref = profile.credential_ref.clone();
    input.translation.workers = 2;
    input.translation.execution_connection = Some(profile);
    JobSnapshot::new(
        "model-job".into(),
        input,
        vec![
            "python".into(),
            "-m".into(),
            "retainpdf_pipeline.translate".into(),
        ],
    )
    .into_runtime()
}

#[test]
fn model_worker_uses_capability_without_resolving_translation_key() {
    let root = credential_test_root("model-capability");
    let db = retain_data::db::Db::new(root.join("jobs.db"), root.clone());
    db.init().unwrap();
    let job = model_job();
    db.save_job(&JobSnapshot {
        record: job.record.clone(),
        artifacts: job.artifacts.clone(),
    })
    .unwrap();
    // There is intentionally no translation credential vault. The worker
    // launcher must not need or resolve it to issue a capability.
    let binding = prepare_model_worker_binding(&db, &job, Some("http://127.0.0.1:41000"))
        .unwrap()
        .unwrap();
    assert_eq!(binding.capability.len(), 64);
    let hash: String = Sha256::digest(binding.capability.as_bytes())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    assert!(db
        .authorize_model_session("model-job", &hash, chrono_now_seconds())
        .unwrap()
        .is_some());
    assert!(db
        .authorize_model_session("other-job", &hash, chrono_now_seconds())
        .unwrap()
        .is_none());
    let mut command = Command::new("python");
    let secrets = apply_job_credentials(&mut command, &root, &job).unwrap();
    assert!(secrets.is_empty());
    for name in [
        "RETAIN_TRANSLATION_API_KEY",
        "DEEPSEEK_API_KEY",
        "OPENAI_API_KEY",
        "DASHSCOPE_API_KEY",
        "RETAIN_REVIEWER_API_KEY",
    ] {
        assert!(command
            .as_std()
            .get_envs()
            .any(|(key, value)| key == std::ffi::OsStr::new(name) && value.is_none()));
    }
    let lease = ModelWorkerLease::for_job(&db, &job);
    db.reserve_model_operation("model-job", "op", "unit", "hash", "primary")
        .unwrap();
    assert!(db.claim_model_operation("model-job", "op").unwrap());
    drop(lease);
    assert!(db
        .authorize_model_session("model-job", &hash, chrono_now_seconds())
        .unwrap()
        .is_none());
    assert_eq!(
        db.get_model_operation("model-job", "op")
            .unwrap()
            .unwrap()
            .status,
        "ambiguous"
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn model_worker_rejects_remote_or_mismatched_configuration() {
    let root = credential_test_root("model-binding-policy");
    let db = retain_data::db::Db::new(root.join("jobs.db"), root.clone());
    db.init().unwrap();
    let job = model_job();
    db.save_job(&JobSnapshot {
        record: job.record.clone(),
        artifacts: None,
    })
    .unwrap();
    for url in [
        None,
        Some("http://example.org"),
        Some("http://user:secret@127.0.0.1"),
        Some("http://127.0.0.1/?key=secret"),
    ] {
        assert!(prepare_model_worker_binding(&db, &job, url).is_err());
    }
    let mut changed = job.clone();
    changed
        .request_payload
        .translation
        .execution_connection
        .as_mut()
        .unwrap()
        .thinking = retain_core::model_connection::Thinking::On;
    assert!(
        prepare_model_worker_binding(&db, &changed, Some("http://127.0.0.1:41000")).is_err()
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn configured_ocr_credential_ref_is_available_through_generic_env() {
    let root = credential_test_root("configured");
    let credential_ref = "cred_ocr_local";
    let secret = "local-vault-secret";
    write_credential_vault(
        &root,
        credential_ref,
        OCR_PROVIDER_CREDENTIAL_KIND,
        "local",
        secret,
    );
    let job = job_with_ocr_ref("local", credential_ref);
    let mut command = Command::new("true");

    let runtime_secrets =
        apply_job_credentials(&mut command, &root, &job).expect("apply OCR credential");

    assert_eq!(
        command_env(&command, "RETAIN_OCR_CREDENTIAL").as_deref(),
        Some(secret)
    );
    assert_eq!(runtime_secrets, vec![secret.to_string()]);
}

#[test]
fn ocr_credential_provider_mismatch_fails_without_leaking_secret() {
    let root = credential_test_root("mismatch");
    let credential_ref = "cred_ocr_wrong_provider";
    let secret = "must-not-appear-in-error";
    write_credential_vault(
        &root,
        credential_ref,
        OCR_PROVIDER_CREDENTIAL_KIND,
        "mineru",
        secret,
    );
    let job = job_with_ocr_ref("paddle", credential_ref);
    let mut command = Command::new("true");

    let error = apply_job_credentials(&mut command, &root, &job)
        .expect_err("provider mismatch must fail");
    let message = format!("{error:#}");

    assert!(message.contains("OCR credential provider mismatch"));
    assert!(message.contains("expected paddle"));
    assert!(!message.contains(secret));
    assert!(command_env(&command, "RETAIN_OCR_CREDENTIAL").is_none());
}

#[test]
fn credential_child_process_helper() {
    let Some(output_root) = std::env::var_os("RUST_API_OUTPUT_ROOT") else {
        return;
    };
    let Some(secret) = std::env::var_os("RETAIN_PADDLE_API_TOKEN") else {
        return;
    };
    fs::write(
        PathBuf::from(output_root).join("credential-child.txt"),
        secret.to_string_lossy().as_bytes(),
    )
    .expect("write child credential observation");
}

#[tokio::test]
async fn spawned_worker_process_receives_vault_credential() {
    let root = credential_test_root("spawned-process");
    let data_root = root.join("data");
    let output_root = root.join("output");
    fs::create_dir_all(data_root.join("secrets")).expect("create data secrets root");
    fs::create_dir_all(&output_root).expect("create worker output root");
    let credential_ref = "cred_ocr_spawned_process";
    let secret = "spawned-process-vault-secret";
    write_credential_vault(
        &data_root,
        credential_ref,
        OCR_PROVIDER_CREDENTIAL_KIND,
        "paddle",
        secret,
    );

    let executable = std::env::current_exe().expect("current test executable");
    let mut input = CreateJobInput::default();
    input.ocr.provider = "paddle".to_string();
    input.ocr.credential_ref = credential_ref.to_string();
    let job = JobSnapshot::new(
        "job-spawned-credential".to_string(),
        input,
        vec![
            executable.to_string_lossy().into_owned(),
            "--exact".to_string(),
            "job_runner::worker_process::tests::credential_child_process_helper".to_string(),
            "--nocapture".to_string(),
        ],
    )
    .into_runtime();
    let persisted = serde_json::to_string(&job).expect("serialize persisted runtime state");
    assert!(persisted.contains(credential_ref));
    assert!(!persisted.contains(secret));
    let restored_job: JobRuntimeState =
        serde_json::from_str(&persisted).expect("restore runtime state after restart");
    let provider_config = root.join("ocr-providers.json");
    let config = WorkerProcessRuntimeConfig {
        project_root: &root,
        data_root: &data_root,
        output_root: &output_root,
        ocr_provider_config_path: &provider_config,
        worker_terminate_grace_secs: 1,
        worker_output_drain_secs: 5,
        worker_terminate_poll_ms: 10,
    };

    let (child, runtime_secrets) = spawn_worker_process(&config, &restored_job, None)
        .expect("spawn credential child from restored state");
    let output = child
        .wait_with_output()
        .await
        .expect("wait for credential child");

    assert!(
        output.status.success(),
        "credential child failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert_eq!(runtime_secrets, vec![secret.to_string()]);
    assert_eq!(
        fs::read_to_string(output_root.join("credential-child.txt"))
            .expect("read child credential observation"),
        secret
    );
}

#[test]
fn reviewer_credential_ref_is_resolved_into_its_own_env() {
    let root = credential_test_root("reviewer");
    write_credential_vault(
        &root,
        "cred_reviewer",
        "translation_api_key",
        "openai_compatible",
        "reviewer-vault-secret",
    );
    let mut input = CreateJobInput::default();
    input.translation.api_key = "translation-inline-secret".to_string();
    input.translation.reviewer_credential_ref = "cred_reviewer".to_string();
    let job = JobSnapshot::new("job-reviewer".to_string(), input, vec!["true".to_string()])
        .into_runtime();
    let mut command = Command::new("true");

    let runtime_secrets =
        apply_job_credentials(&mut command, &root, &job).expect("apply reviewer credential");

    assert_eq!(
        command_env(&command, "RETAIN_TRANSLATION_API_KEY").as_deref(),
        Some("translation-inline-secret")
    );
    assert_eq!(
        command_env(&command, "RETAIN_REVIEWER_API_KEY").as_deref(),
        Some("reviewer-vault-secret")
    );
    assert!(runtime_secrets.contains(&"reviewer-vault-secret".to_string()));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn reviewer_env_is_absent_when_reviewer_is_not_configured() {
    let root = credential_test_root("reviewer-absent");
    let mut input = CreateJobInput::default();
    input.translation.api_key = "translation-inline-secret".to_string();
    let job = JobSnapshot::new("job-no-reviewer".to_string(), input, vec!["true".to_string()])
        .into_runtime();
    let mut command = Command::new("true");

    let runtime_secrets = apply_job_credentials(&mut command, &root, &job).expect("apply");

    assert!(command_env(&command, "RETAIN_REVIEWER_API_KEY").is_none());
    assert_eq!(runtime_secrets, vec!["translation-inline-secret".to_string()]);
    let _ = std::fs::remove_dir_all(root);
}
