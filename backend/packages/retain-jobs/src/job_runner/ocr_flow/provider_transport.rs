use anyhow::{anyhow, Result};
use std::future::Future;
use std::path::Path;
use std::pin::Pin;

use crate::config::{MineruRuntimeConfig, PaddleRuntimeConfig};
use crate::models::domain::JobRuntimeState;
use crate::ocr_provider::mineru::MineruClient;
use crate::ocr_provider::paddle::PaddleClient;
use crate::ocr_provider::{provider_definition, OcrProviderKind};

use super::transport::{prepare_local_upload_source, recover_remote_source_pdf};
use super::workspace::OcrWorkspace;
use super::{mineru, paddle};
use crate::job_runner::cancel_registry::is_cancel_requested_with_registry;
use crate::job_runner::runtime_credentials::resolve_ocr_provider_token;
use crate::job_runner::ProcessRuntimeDeps;

type TransportFuture<'a> = Pin<Box<dyn Future<Output = Result<()>> + Send + 'a>>;
type LocalTransportFn = for<'a> fn(
    &'a ProcessRuntimeDeps,
    &'a mut JobRuntimeState,
    &'a OcrWorkspace,
    &'a std::path::Path,
    Option<&'a str>,
) -> TransportFuture<'a>;
type RemoteTransportFn = for<'a> fn(
    &'a ProcessRuntimeDeps,
    &'a mut JobRuntimeState,
    &'a OcrWorkspace,
    Option<&'a str>,
) -> TransportFuture<'a>;

struct OcrProviderTransport {
    key: &'static str,
    local: LocalTransportFn,
    remote: RemoteTransportFn,
}

static REGISTERED_TRANSPORTS: &[OcrProviderTransport] = &[
    OcrProviderTransport {
        key: "mineru",
        local: execute_mineru_local_transport,
        remote: execute_mineru_remote_transport,
    },
    OcrProviderTransport {
        key: "paddle",
        local: execute_paddle_local_transport,
        remote: execute_paddle_remote_transport,
    },
];

pub(super) async fn execute_provider_transport(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    provider_kind: &OcrProviderKind,
    workspace: &OcrWorkspace,
    parent_job_id: Option<&str>,
) -> Result<std::path::PathBuf> {
    let transport = resolve_provider_transport(provider_kind)?;
    if let Some(upload_path) =
        prepare_local_upload_source(deps.db.as_ref(), job, &workspace.source_dir)?
    {
        (transport.local)(deps, job, workspace, &upload_path, parent_job_id).await?;
        return Ok(upload_path);
    }

    (transport.remote)(deps, job, workspace, parent_job_id).await?;

    if is_cancel_requested_with_registry(deps.canceled_jobs.as_ref(), &job.job_id).await {
        return Ok(std::path::PathBuf::new());
    }

    recover_remote_source_pdf(
        provider_kind,
        job,
        &workspace.source_dir,
        &workspace.provider_raw_dir,
    )
    .await
}

fn resolve_provider_transport(
    provider_kind: &OcrProviderKind,
) -> Result<&'static OcrProviderTransport> {
    let key = provider_definition(provider_kind)
        .map(|definition| definition.key)
        .ok_or_else(|| anyhow!("unsupported OCR provider"))?;
    REGISTERED_TRANSPORTS
        .iter()
        .find(|transport| transport.key == key)
        .ok_or_else(|| anyhow!("{key} OCR provider is only supported by provider stage script"))
}

fn build_mineru_client(
    data_root: &Path,
    job: &JobRuntimeState,
    runtime: MineruRuntimeConfig,
) -> Result<MineruClient> {
    let token = resolve_ocr_provider_token(data_root, job)?
        .unwrap_or_else(|| job.request_payload.ocr.mineru_token.clone());
    Ok(MineruClient::with_runtime("", token, runtime))
}

fn build_paddle_client(
    data_root: &Path,
    job: &JobRuntimeState,
    runtime: PaddleRuntimeConfig,
) -> Result<PaddleClient> {
    let token = resolve_ocr_provider_token(data_root, job)?
        .unwrap_or_else(|| job.request_payload.ocr.paddle_token.clone());
    Ok(PaddleClient::with_runtime(
        job.request_payload.ocr.paddle_api_url.clone(),
        token,
        runtime,
    ))
}

fn execute_mineru_local_transport<'a>(
    deps: &'a ProcessRuntimeDeps,
    job: &'a mut JobRuntimeState,
    workspace: &'a OcrWorkspace,
    upload_path: &'a std::path::Path,
    parent_job_id: Option<&'a str>,
) -> TransportFuture<'a> {
    Box::pin(async move {
        let client =
            build_mineru_client(&deps.persist.data_root, job, deps.mineru_runtime().clone())?;
        mineru::run_local_ocr_transport_mineru(
            deps,
            job,
            &client,
            upload_path,
            &workspace.provider_result_json_path,
            parent_job_id,
        )
        .await
    })
}

fn execute_paddle_local_transport<'a>(
    deps: &'a ProcessRuntimeDeps,
    job: &'a mut JobRuntimeState,
    workspace: &'a OcrWorkspace,
    upload_path: &'a std::path::Path,
    parent_job_id: Option<&'a str>,
) -> TransportFuture<'a> {
    Box::pin(async move {
        let client =
            build_paddle_client(&deps.persist.data_root, job, deps.paddle_runtime().clone())?;
        paddle::run_local_ocr_transport_paddle(
            deps,
            job,
            &client,
            upload_path,
            &workspace.provider_result_json_path,
            &workspace.job_paths.root,
            parent_job_id,
        )
        .await
    })
}

fn execute_mineru_remote_transport<'a>(
    deps: &'a ProcessRuntimeDeps,
    job: &'a mut JobRuntimeState,
    workspace: &'a OcrWorkspace,
    parent_job_id: Option<&'a str>,
) -> TransportFuture<'a> {
    Box::pin(async move {
        let client =
            build_mineru_client(&deps.persist.data_root, job, deps.mineru_runtime().clone())?;
        mineru::run_remote_ocr_transport_mineru(
            deps,
            job,
            &client,
            &workspace.provider_result_json_path,
            parent_job_id,
        )
        .await
    })
}

fn execute_paddle_remote_transport<'a>(
    deps: &'a ProcessRuntimeDeps,
    job: &'a mut JobRuntimeState,
    workspace: &'a OcrWorkspace,
    parent_job_id: Option<&'a str>,
) -> TransportFuture<'a> {
    Box::pin(async move {
        let client =
            build_paddle_client(&deps.persist.data_root, job, deps.paddle_runtime().clone())?;
        paddle::run_remote_ocr_transport_paddle(
            deps,
            job,
            &client,
            &workspace.provider_result_json_path,
            &workspace.job_paths.root,
            parent_job_id,
        )
        .await
    })
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};

    use super::*;
    use crate::models::domain::JobSnapshot;
    use crate::models::request::CreateJobInput;

    fn test_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "retainpdf-ocr-transport-credential-{name}-{}",
            fastrand::u64(..)
        ));
        fs::create_dir_all(root.join("secrets")).expect("create credential test root");
        root
    }

    fn write_credential(root: &Path, credential_ref: &str, provider: &str, secret: &str) {
        let path = root.join("secrets").join("credentials.json");
        fs::write(
            &path,
            serde_json::json!({
                "schema": "retainpdf_credential_vault_v1",
                "credentials": {
                    (credential_ref): {
                        "kind": "ocr_provider_token",
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

    fn job_with_ocr_ref(provider: &str, credential_ref: &str) -> JobRuntimeState {
        let mut input = CreateJobInput::default();
        input.ocr.provider = provider.to_string();
        input.ocr.credential_ref = credential_ref.to_string();
        JobSnapshot::new(
            "job-ocr-transport-ref".to_string(),
            input,
            vec!["true".to_string()],
        )
        .into_runtime()
    }

    #[test]
    fn paddle_transport_client_uses_vault_credential_without_rehydrating_job() {
        let root = test_root("paddle");
        let credential_ref = "cred_paddle_transport";
        let secret = "paddle-vault-secret";
        write_credential(&root, credential_ref, "paddle", secret);
        let job = job_with_ocr_ref("paddle", credential_ref);

        let client = build_paddle_client(&root, &job, PaddleRuntimeConfig::from_env())
            .expect("build Paddle client from credential reference");

        assert_eq!(client.token, secret);
        let persisted = serde_json::to_string(&job).expect("serialize job");
        assert!(persisted.contains(credential_ref));
        assert!(!persisted.contains(secret));
        assert!(job.request_payload.ocr.paddle_token.is_empty());
    }

    #[test]
    fn mineru_transport_client_uses_vault_credential_without_rehydrating_job() {
        let root = test_root("mineru");
        let credential_ref = "cred_mineru_transport";
        let secret = "mineru-vault-secret";
        write_credential(&root, credential_ref, "mineru", secret);
        let job = job_with_ocr_ref("mineru", credential_ref);

        let client = build_mineru_client(&root, &job, MineruRuntimeConfig::from_env())
            .expect("build MinerU client from credential reference");

        assert_eq!(client.token, secret);
        let persisted = serde_json::to_string(&job).expect("serialize job");
        assert!(persisted.contains(credential_ref));
        assert!(!persisted.contains(secret));
        assert!(job.request_payload.ocr.mineru_token.is_empty());
    }
}
