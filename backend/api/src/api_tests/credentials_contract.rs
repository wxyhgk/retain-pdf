//! 凭据契约 `credentials.v1` 的生产者锁（设置类第 2 批第 2 组，2026-11-24）。
//!
//! 返回：打真实接口，拿 serde 实际写出来的 JSON，对着 backend-root/contracts 里的定义核对类型和键集合
//! （多一个键、少一个键都红）。请求：每个请求类型都是 `deny_unknown_fields`，契约的 `properties` 要和 Rust 认的字段一样。

use axum::http::StatusCode;
use serde_json::{json, Value};

use super::job_view_contract::{assert_definition, assert_exact_object_keys, contract};
use super::jobs_common::test_state;
use super::library_documents_contract::assert_request_fields_match;
use super::library_paging::send;
use crate::services::providers::{CreateCredentialInput, DeleteCredentialQuery, UpdateCredentialInput};

const CONTRACT: &str = "credentials.v1.schema.json";

pub(super) async fn ok_data(state: &crate::AppState, method: &str, uri: &str, body: Option<Value>) -> Value {
    let (status, payload) = send(state, method, uri, body).await;
    assert_eq!(status, StatusCode::OK, "{method} {uri}: {payload}");
    payload["data"].clone()
}

pub(super) fn assert_exact(value: &Value, contract: &Value, name: &str, path: &str) {
    assert_definition(value, contract, name, path);
    assert_exact_object_keys(value, contract, name, path);
}

fn assert_mutation(value: &Value, contract: &Value, path: &str) {
    assert_exact(value, contract, "CredentialMutationView", path);
    assert_exact(&value["credential"], contract, "CredentialMetadataView", &format!("{path}.credential"));
}

#[tokio::test]
async fn credential_views_match_published_schema() {
    let state = test_state("credentials-contract");
    let contract = contract(CONTRACT);

    let empty = ok_data(&state, "GET", "/api/v1/credentials", None).await;
    assert_exact(&empty, &contract, "CredentialListView", "list(empty)");

    let created = ok_data(
        &state,
        "POST",
        "/api/v1/credentials",
        Some(json!({ "kind": "ocr_provider_token", "provider": "paddle", "label": "Paddle", "secret": "s-1", "expected_revision": 0 })),
    )
    .await;
    assert_mutation(&created, &contract, "create");
    let credential_ref = created["credential"]["credential_ref"].as_str().expect("credential_ref").to_string();
    assert_eq!(created["credential"]["configured"], true);

    let list = ok_data(&state, "GET", "/api/v1/credentials", None).await;
    assert_exact(&list, &contract, "CredentialListView", "list");
    assert_exact(&list["credentials"][0], &contract, "CredentialMetadataView", "list.credentials[0]");

    let one = ok_data(&state, "GET", &format!("/api/v1/credentials/{credential_ref}"), None).await;
    assert_mutation(&one, &contract, "get");

    let updated = ok_data(
        &state,
        "PUT",
        &format!("/api/v1/credentials/{credential_ref}"),
        Some(json!({ "kind": "ocr_provider_token", "label": "Paddle 2", "secret": "s-2", "expected_credential_revision": 1 })),
    )
    .await;
    assert_mutation(&updated, &contract, "update");
    assert_eq!(updated["credential"]["revision"], 2);

    let revision = updated["revision"].as_u64().expect("revision");
    let deleted = ok_data(
        &state,
        "DELETE",
        &format!("/api/v1/credentials/{credential_ref}?expected_revision={revision}&force=false"),
        None,
    )
    .await;
    assert_exact(&deleted, &contract, "CredentialDeleteView", "delete");
}

#[test]
fn request_bodies_and_queries_accept_exactly_the_contract_fields() {
    let contract = contract(CONTRACT);
    assert_request_fields_match::<CreateCredentialInput>(&contract, "CreateCredentialInput");
    assert_request_fields_match::<UpdateCredentialInput>(&contract, "UpdateCredentialInput");
    assert_request_fields_match::<DeleteCredentialQuery>(&contract, "DeleteCredentialQuery");
}
