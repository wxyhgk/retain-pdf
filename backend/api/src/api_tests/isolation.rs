//! 多用户模式的数据隔离：每个网站账号只看得见、碰得到自己的上传、任务、书、术语表、文件夹。

use std::sync::Arc;

use axum::body::Body;
use axum::http::{header, Method, Request, StatusCode};
use axum::response::Response;
use serde_json::{json, Value};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{minimal_pdf_bytes, read_json};
use crate::app::{build_app, build_state};
use crate::config::{AccountsConfig, AppConfig, DeploymentMode};
use crate::test_support::config::TestDirs;

const ADMIN_PASSWORD: &str = "bootstrap-pass";
const BOUNDARY: &str = "retain-isolation-boundary";

struct Fixture {
    state: crate::AppState,
    alice: String,
    bob: String,
}

impl Fixture {
    async fn new(name: &str) -> Self {
        let dirs = TestDirs::create(&format!("rust-api-isolation-{name}-{}", fastrand::u64(..)));
        let config = AppConfig {
            accounts: AccountsConfig {
                mode: DeploymentMode::Multi,
                session_cookie_secure: false,
                bootstrap_admin: Some(("root".into(), ADMIN_PASSWORD.into())),
                ..AccountsConfig::default()
            },
            ..dirs.config()
        };
        let state = build_state(Arc::new(config)).expect("build state");
        let admin = login(&state, "root", ADMIN_PASSWORD).await;
        let mut sessions = Vec::new();
        for username in ["alice", "bob"] {
            let created = read_json(
                send(&state, Method::POST, "/api/v1/admin/users", Some(&admin), Some(json!({ "username": username }))).await,
            )
            .await;
            let initial = created["data"]["initial_password"].as_str().unwrap().to_string();
            sessions.push(login(&state, username, &initial).await);
        }
        let bob = sessions.pop().unwrap();
        let alice = sessions.pop().unwrap();
        Self { state, alice, bob }
    }

    async fn get(&self, cookie: &str, uri: &str) -> Response {
        send(&self.state, Method::GET, uri, Some(cookie), None).await
    }

    async fn upload(&self, cookie: &str) -> Value {
        let mut body = format!(
            "--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"paper.pdf\"\r\n\
             Content-Type: application/pdf\r\n\r\n"
        )
        .into_bytes();
        body.extend(minimal_pdf_bytes(595, 842));
        body.extend(format!("\r\n--{BOUNDARY}--\r\n").into_bytes());
        let request = Request::builder()
            .method(Method::POST)
            .uri("/api/v1/uploads")
            .header(header::COOKIE, format!("retain_session={cookie}"))
            .header(header::CONTENT_TYPE, format!("multipart/form-data; boundary={BOUNDARY}"))
            .body(Body::from(body))
            .unwrap();
        let response = build_app(self.state.clone()).oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        read_json(response).await["data"].clone()
    }

    /// 直接在库里存一条任务（不真的跑），归属由触发器跟着上传走。
    fn insert_job(&self, job_id: &str, upload_id: &str) {
        let mut input = crate::models::request::CreateJobInput::default();
        input.source.upload_id = upload_id.to_string();
        let mut job = crate::models::domain::JobSnapshot::new(job_id.to_string(), input, vec!["python".to_string()]);
        job.upload_id = Some(upload_id.to_string());
        job.status = crate::models::domain::JobStatusKind::Succeeded;
        self.state.db.save_job(&job).unwrap();
    }
}

async fn send(
    state: &crate::AppState,
    method: Method,
    uri: &str,
    cookie: Option<&str>,
    body: Option<Value>,
) -> Response {
    let mut builder = Request::builder().method(method).uri(uri);
    if let Some(cookie) = cookie {
        builder = builder.header(header::COOKIE, format!("retain_session={cookie}"));
    }
    let body = match body {
        Some(value) => {
            builder = builder.header(header::CONTENT_TYPE, "application/json");
            Body::from(value.to_string())
        }
        None => Body::empty(),
    };
    build_app(state.clone()).oneshot(builder.body(body).unwrap()).await.unwrap()
}

async fn login(state: &crate::AppState, username: &str, password: &str) -> String {
    let response = send(
        state,
        Method::POST,
        "/api/v1/auth/login",
        None,
        Some(json!({ "username": username, "password": password })),
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK, "login {username}");
    let raw = response.headers()[header::SET_COOKIE].to_str().unwrap().to_string();
    raw.split(';').next().unwrap().trim_start_matches("retain_session=").to_string()
}

fn ids(list: &Value, key: &str) -> Vec<String> {
    list.as_array()
        .unwrap()
        .iter()
        .map(|item| item[key].as_str().unwrap().to_string())
        .collect()
}

#[tokio::test]
async fn the_same_pdf_is_two_private_books_for_two_accounts() {
    let fx = Fixture::new("same-pdf").await;
    let a = fx.upload(&fx.alice).await;
    let b = fx.upload(&fx.bob).await;
    let (a_doc, b_doc) = (a["document_id"].as_str().unwrap(), b["document_id"].as_str().unwrap());
    assert_ne!(a_doc, b_doc, "同一份 PDF 在两个账号下是两本书");

    let alice_docs = read_json(fx.get(&fx.alice, "/api/v1/documents").await).await;
    assert_eq!(ids(&alice_docs["data"]["documents"], "document_id"), vec![a_doc.to_string()]);
    let bob_docs = read_json(fx.get(&fx.bob, "/api/v1/documents").await).await;
    assert_eq!(ids(&bob_docs["data"]["documents"], "document_id"), vec![b_doc.to_string()]);

    assert_eq!(fx.get(&fx.alice, &format!("/api/v1/documents/{a_doc}")).await.status(), StatusCode::OK);
    for uri in [
        format!("/api/v1/documents/{a_doc}"),
        format!("/api/v1/documents/{a_doc}/source.pdf"),
        format!("/api/v1/documents/{a_doc}/jobs"),
        format!("/api/v1/search?q=anything&document_id={a_doc}"),
    ] {
        assert_eq!(fx.get(&fx.bob, &uri).await.status(), StatusCode::NOT_FOUND, "{uri}");
    }
}

#[tokio::test]
async fn jobs_are_listed_and_opened_only_by_their_owner() {
    let fx = Fixture::new("jobs").await;
    let a = fx.upload(&fx.alice).await;
    let upload_id = a["upload_id"].as_str().unwrap();
    fx.insert_job("job-alice", upload_id);

    let alice_jobs = read_json(fx.get(&fx.alice, "/api/v1/jobs").await).await;
    assert_eq!(ids(&alice_jobs["data"]["items"], "job_id"), vec!["job-alice".to_string()]);
    let bob_jobs = read_json(fx.get(&fx.bob, "/api/v1/jobs").await).await;
    assert!(bob_jobs["data"]["items"].as_array().unwrap().is_empty());
    let bob_books = read_json(fx.get(&fx.bob, "/api/v1/library/books").await).await;
    assert!(bob_books["data"]["items"].as_array().unwrap().is_empty());

    for uri in [
        "/api/v1/jobs/job-alice",
        "/api/v1/jobs/job-alice/data",
        "/api/v1/library/books/job-alice",
        "/api/v1/library/books?job_ids=job-alice",
        "/api/v1/documents?job_id=job-alice",
    ] {
        assert_eq!(fx.get(&fx.bob, uri).await.status(), StatusCode::NOT_FOUND, "{uri}");
    }
    // 不存在的和别人的一个样：都是 404，不泄露「这个编号存在」。
    let missing = fx.get(&fx.bob, "/api/v1/jobs/no-such-job").await;
    assert_eq!(missing.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn ids_in_request_bodies_are_checked_too() {
    let fx = Fixture::new("body").await;
    let a = fx.upload(&fx.alice).await;
    let upload_id = a["upload_id"].as_str().unwrap();
    // bob 拿 alice 的上传建任务：在进处理函数之前就被拦下。
    let response = send(
        &fx.state,
        Method::POST,
        "/api/v1/jobs",
        Some(&fx.bob),
        Some(json!({ "workflow": "book", "source": { "upload_id": upload_id } })),
    )
    .await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    // 文件夹：bob 把 alice 的书放进自己的文件夹也不行。
    let folder = read_json(
        send(&fx.state, Method::POST, "/api/v1/collections", Some(&fx.bob), Some(json!({ "name": "mine" }))).await,
    )
    .await;
    let folder_id = folder["data"]["collection_id"].as_str().unwrap().to_string();
    let response = send(
        &fx.state,
        Method::POST,
        &format!("/api/v1/collections/{folder_id}/documents"),
        Some(&fx.bob),
        Some(json!({ "document_ids": [a["document_id"]] })),
    )
    .await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    // alice 看不到 bob 的文件夹，也改不了。
    let alice_folders = read_json(fx.get(&fx.alice, "/api/v1/collections").await).await;
    assert!(alice_folders["data"]["collections"].as_array().unwrap().is_empty());
    let response = send(
        &fx.state,
        Method::PATCH,
        &format!("/api/v1/collections/{folder_id}"),
        Some(&fx.alice),
        Some(json!({ "name": "stolen" })),
    )
    .await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn glossaries_are_private() {
    let fx = Fixture::new("glossary").await;
    let created = read_json(
        send(
            &fx.state,
            Method::POST,
            "/api/v1/glossaries",
            Some(&fx.alice),
            Some(json!({ "name": "physics", "entries": [{ "source": "band gap", "target": "带隙" }] })),
        )
        .await,
    )
    .await;
    let glossary_id = created["data"]["glossary_id"].as_str().unwrap().to_string();
    let alice = read_json(fx.get(&fx.alice, "/api/v1/glossaries").await).await;
    assert_eq!(alice["data"]["items"].as_array().unwrap().len(), 1);
    let bob = read_json(fx.get(&fx.bob, "/api/v1/glossaries").await).await;
    assert!(bob["data"]["items"].as_array().unwrap().is_empty());
    let response = fx.get(&fx.bob, &format!("/api/v1/glossaries/{glossary_id}")).await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn admin_only_and_closed_routes() {
    let fx = Fixture::new("routes").await;
    for uri in ["/api/v1/credentials", "/api/v1/sync", "/api/v1/backups", "/api/v1/ai/runtime-config"] {
        assert_eq!(fx.get(&fx.alice, uri).await.status(), StatusCode::FORBIDDEN, "{uri}");
    }
    for uri in ["/api/v1/ai/conversations", "/api/v1/ocr/jobs"] {
        assert_eq!(fx.get(&fx.alice, uri).await.status(), StatusCode::NOT_FOUND, "{uri}");
    }
    assert_eq!(fx.get(&fx.alice, "/api/v1/providers/ocr").await.status(), StatusCode::OK);
    let usage = read_json(fx.get(&fx.alice, "/api/v1/usage").await).await;
    assert_eq!(usage["code"], 0);
}

#[tokio::test]
async fn jobs_refuse_to_start_until_the_platform_models_are_configured() {
    let fx = Fixture::new("platform").await;
    let a = fx.upload(&fx.alice).await;
    let response = send(
        &fx.state,
        Method::POST,
        "/api/v1/jobs",
        Some(&fx.alice),
        Some(json!({
            "workflow": "book",
            "source": { "upload_id": a["upload_id"] },
            "translation": { "api_key": "user-supplied", "model": "their-model", "base_url": "https://example.invalid" }
        })),
    )
    .await;
    let status = response.status();
    let body = read_json(response).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE, "{body}");
    assert!(body["message"].as_str().unwrap().contains("平台还没配置翻译模型"), "{body}");
    assert!(fx.state.db.job_ids_for_owner(&owner_of(&fx, &fx.alice).await).unwrap().is_empty());
}

async fn owner_of(fx: &Fixture, cookie: &str) -> String {
    let session = read_json(fx.get(cookie, "/api/v1/auth/session").await).await;
    session["data"]["user"]["user_id"].as_str().unwrap().to_string()
}

#[tokio::test]
async fn ocr_only_jobs_go_through_the_jobs_endpoint() {
    let fx = Fixture::new("ocr-json").await;
    let a = fx.upload(&fx.alice).await;
    // 平台没配 OCR：走到了 OCR 的建任务路径（而不是「use /api/v1/ocr/jobs」的 400）。
    let response = send(
        &fx.state,
        Method::POST,
        "/api/v1/jobs",
        Some(&fx.alice),
        Some(json!({ "workflow": "ocr", "source": { "upload_id": a["upload_id"] } })),
    )
    .await;
    let status = response.status();
    let body = read_json(response).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE, "{body}");
    assert!(body["message"].as_str().unwrap().contains("平台还没配置 OCR"), "{body}");
}
