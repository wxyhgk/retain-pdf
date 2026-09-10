use axum::body::Body;
use axum::http::{header, Method, Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use super::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::domain::JobSnapshot;
use crate::models::request::CreateJobInput;

async fn request(
    app: axum::Router,
    method: Method,
    uri: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header("X-API-Key", "test-key");
    let body = if let Some(value) = body {
        builder = builder.header(header::CONTENT_TYPE, "application/json");
        Body::from(value.to_string())
    } else {
        Body::empty()
    };
    let response = app
        .oneshot(builder.body(body).expect("credential request"))
        .await
        .expect("credential response");
    let status = response.status();
    (status, read_json(response).await)
}

#[tokio::test]
async fn credential_api_persists_only_safe_metadata_in_responses() {
    let state = test_state("credentials-roundtrip");
    let app = build_app(state.clone());
    let secret = "sk-backend-only-value";
    let (status, created) = request(
        app.clone(),
        Method::POST,
        "/api/v1/credentials",
        Some(json!({
            "kind": "translation_api_key",
            "provider": "deepseek",
            "label": "Primary translation model",
            "secret": secret,
            "expected_revision": 0
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{created}");
    let credential_ref = created["data"]["credential"]["credential_ref"]
        .as_str()
        .expect("credential ref")
        .to_string();
    assert!(credential_ref.starts_with("cred_"));
    assert_eq!(created["data"]["revision"], 1);
    assert_eq!(created["data"]["credential"]["configured"], true);
    assert_eq!(created["data"]["credential"]["revision"], 1);
    assert!(!created.to_string().contains(secret));
    assert!(created["data"]["credential"].get("secret").is_none());

    let (status, listed) = request(app.clone(), Method::GET, "/api/v1/credentials", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(listed["data"]["revision"], 1);
    assert_eq!(
        listed["data"]["credentials"][0]["credential_ref"],
        credential_ref
    );
    assert!(!listed.to_string().contains(secret));

    let (status, stale) = request(
        app.clone(),
        Method::PUT,
        &format!("/api/v1/credentials/{credential_ref}"),
        Some(json!({"label": "stale", "expected_revision": 0})),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{stale}");

    let (status, deleted) = request(
        app,
        Method::DELETE,
        &format!("/api/v1/credentials/{credential_ref}?expected_revision=1"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{deleted}");
    assert_eq!(deleted["data"]["deleted"], true);

    let persisted = std::fs::read_to_string(
        state
            .config
            .data_root
            .join("secrets")
            .join("credentials.json"),
    )
    .expect("credential vault file");
    assert!(
        !persisted.contains(secret),
        "deleted secrets must leave the vault"
    );

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        let secrets_dir = state.config.data_root.join("secrets");
        let lock_metadata = std::fs::metadata(secrets_dir.join(".credentials.lock"))
            .expect("credential vault process lock");
        assert_eq!(lock_metadata.permissions().mode() & 0o777, 0o600);
        assert_eq!(
            std::fs::metadata(secrets_dir)
                .expect("credential vault directory")
                .permissions()
                .mode()
                & 0o777,
            0o700
        );
    }
}

#[tokio::test]
async fn credential_update_uses_record_revision_instead_of_unrelated_vault_revision() {
    let state = test_state("credential-record-revision");
    let app = build_app(state);
    let (_, target) = request(
        app.clone(),
        Method::POST,
        "/api/v1/credentials",
        Some(json!({
            "kind": "translation_api_key",
            "provider": "deepseek",
            "label": "Translation",
            "secret": "translation-secret",
            "expected_revision": 0
        })),
    )
    .await;
    let target_ref = target["data"]["credential"]["credential_ref"]
        .as_str()
        .expect("target credential ref");

    let (status, _) = request(
        app.clone(),
        Method::POST,
        "/api/v1/credentials",
        Some(json!({
            "kind": "ocr_provider_token",
            "provider": "paddle",
            "label": "OCR",
            "secret": "ocr-secret",
            "expected_revision": 1
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (status, updated) = request(
        app.clone(),
        Method::PUT,
        &format!("/api/v1/credentials/{target_ref}"),
        Some(json!({
            "label": "Translation updated",
            "expected_revision": 1,
            "expected_credential_revision": 1
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{updated}");
    assert_eq!(updated["data"]["revision"], 3);
    assert_eq!(updated["data"]["credential"]["revision"], 2);

    let (status, conflict) = request(
        app,
        Method::PUT,
        &format!("/api/v1/credentials/{target_ref}"),
        Some(json!({
            "label": "Stale overwrite",
            "expected_revision": 3,
            "expected_credential_revision": 1
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{conflict}");
    assert_eq!(conflict["error"]["code"], "CREDENTIAL_REVISION_CONFLICT");
}

#[tokio::test]
async fn credential_delete_requires_force_while_persisted_jobs_reference_it() {
    let state = test_state("credential-delete-reference-guard");
    let app = build_app(state.clone());
    let secret = "sk-delete-reference-guard";
    let (status, created) = request(
        app.clone(),
        Method::POST,
        "/api/v1/credentials",
        Some(json!({
            "kind": "translation_api_key",
            "provider": "deepseek",
            "label": "Protected translation model",
            "secret": secret,
            "expected_revision": 0
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{created}");
    let credential_ref = created["data"]["credential"]["credential_ref"]
        .as_str()
        .expect("credential ref")
        .to_string();

    let mut input = CreateJobInput::default();
    input.translation.credential_ref = credential_ref.clone();
    let job = JobSnapshot::new(
        "job-referencing-credential".to_string(),
        input,
        vec!["python3".to_string()],
    );
    state.db.save_job(&job).expect("persist referencing job");

    let (status, conflict) = request(
        app.clone(),
        Method::DELETE,
        &format!("/api/v1/credentials/{credential_ref}?expected_revision=1"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{conflict}");
    assert_eq!(conflict["code"], "CREDENTIAL_IN_USE");
    assert_eq!(conflict["error"]["code"], "CREDENTIAL_IN_USE");
    assert!(!conflict.to_string().contains(secret));
    assert!(!conflict.to_string().contains("job-referencing-credential"));

    let (status, still_present) = request(
        app.clone(),
        Method::GET,
        &format!("/api/v1/credentials/{credential_ref}"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{still_present}");
    assert_eq!(still_present["data"]["revision"], 1);

    let (status, deleted) = request(
        app.clone(),
        Method::DELETE,
        &format!("/api/v1/credentials/{credential_ref}?expected_revision=1&force=true"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{deleted}");
    assert_eq!(deleted["data"]["deleted"], true);
    assert_eq!(deleted["data"]["revision"], 2);

    let (status, missing) = request(
        app,
        Method::GET,
        &format!("/api/v1/credentials/{credential_ref}"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{missing}");
}

#[tokio::test]
async fn credential_delete_is_blocked_by_persisted_ocr_reference() {
    let state = test_state("credential-delete-ocr-reference-guard");
    let app = build_app(state.clone());
    let secret = "ocr-delete-reference-guard";
    let (status, created) = request(
        app.clone(),
        Method::POST,
        "/api/v1/credentials",
        Some(json!({
            "kind": "ocr_provider_token",
            "provider": "paddle",
            "label": "Protected OCR provider",
            "secret": secret,
            "expected_revision": 0
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{created}");
    let credential_ref = created["data"]["credential"]["credential_ref"]
        .as_str()
        .expect("credential ref")
        .to_string();

    let mut input = CreateJobInput::default();
    input.ocr.credential_ref = credential_ref.clone();
    let job = JobSnapshot::new(
        "job-referencing-ocr-credential".to_string(),
        input,
        vec!["python3".to_string()],
    );
    state.db.save_job(&job).expect("persist referencing job");

    let (status, conflict) = request(
        app,
        Method::DELETE,
        &format!("/api/v1/credentials/{credential_ref}?expected_revision=1"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{conflict}");
    assert_eq!(conflict["code"], "CREDENTIAL_IN_USE");
    assert!(!conflict.to_string().contains(secret));
    assert!(!conflict
        .to_string()
        .contains("job-referencing-ocr-credential"));
}

#[tokio::test]
async fn credential_delete_detects_agent_runtime_references() {
    let state = test_state("credential-agent-runtime-reference-guard");
    let app = build_app(state.clone());
    let (status, created) = request(
        app.clone(),
        Method::POST,
        "/api/v1/credentials",
        Some(json!({
            "kind": "agent_llm_api_key",
            "provider": "deepseek",
            "label": "Agent model",
            "secret": "sk-agent-runtime-reference",
            "expected_revision": 0
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{created}");
    let credential_ref = created["data"]["credential"]["credential_ref"]
        .as_str()
        .expect("credential ref");
    let runtime_path = state.config.data_root.join("secrets/ai-runtime.json");
    std::fs::write(
        &runtime_path,
        json!({
            "schema": "retainpdf_ai_runtime_credentials_v1",
            "revision": 1,
            "llm_credential_ref": credential_ref
        })
        .to_string(),
    )
    .expect("write AI runtime config");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&runtime_path, std::fs::Permissions::from_mode(0o600))
            .expect("secure AI runtime config");
    }

    let (status, conflict) = request(
        app,
        Method::DELETE,
        &format!("/api/v1/credentials/{credential_ref}?expected_revision=1"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{conflict}");
    assert_eq!(conflict["code"], "CREDENTIAL_IN_USE");
}
