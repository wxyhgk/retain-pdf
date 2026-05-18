use crate::error::AppError;
use crate::models::{ApiResponse, CreateJobInput, JobSubmissionView};
use crate::routes::job_requests::{parse_ocr_job_request, parse_translate_bundle_request};
use crate::AppState;
use axum::extract::{Multipart, State};
use axum::http::HeaderMap;
use axum::Json;
use serde_json::Value;

use super::common::{build_jobs_route_deps, jobs_facade, ok_json, request_base_url};

pub async fn create_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let request = CreateJobInput::from_api_value(payload)
        .map_err(|e| AppError::bad_request(format!("invalid job payload: {e}")))?;
    let deps = build_jobs_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port);
    Ok(ok_json(
        jobs_facade(deps).create_submission(&base_url, &request)?,
    ))
}

pub async fn create_ocr_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let parsed = parse_ocr_job_request(&mut multipart).await?;
    let upload = match (parsed.filename, parsed.file_bytes, parsed.developer_mode) {
        (Some(filename), Some(bytes), developer_mode) => Some((filename, bytes, developer_mode)),
        (None, None, _) => None,
        _ => return Err(AppError::bad_request("file upload is incomplete")),
    };
    let deps = build_jobs_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port);
    let view = jobs_facade(deps)
        .create_ocr_submission(&base_url, &parsed.request, upload)
        .await?;
    Ok(ok_json(view))
}

pub async fn translate_bundle(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let parsed = parse_translate_bundle_request(&mut multipart).await?;
    let deps = build_jobs_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port);
    let view = jobs_facade(deps)
        .create_translation_bundle_submission(
            &base_url,
            parsed.request,
            parsed.filename,
            parsed.file_bytes,
            parsed.developer_mode,
        )
        .await?;
    Ok(ok_json(view))
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;
    use std::sync::Arc;

    use axum::body::{to_bytes, Body};
    use axum::http::{header, Request, StatusCode};
    use lopdf::content::{Content, Operation};
    use lopdf::{dictionary, Document, Object, Stream};
    use serde_json::Value;
    use tokio::sync::{Mutex, RwLock, Semaphore};
    use tower::util::ServiceExt;

    use crate::app::build_simple_app;
    use crate::config::AppConfig;
    use crate::db::Db;
    use crate::AppState;

    fn test_state(test_name: &str) -> AppState {
        let root = std::env::temp_dir().join(format!(
            "rust-api-create-route-{test_name}-{}",
            fastrand::u64(..)
        ));
        let data_root = root.join("data");
        let output_root = data_root.join("jobs");
        let downloads_dir = data_root.join("downloads");
        let uploads_dir = data_root.join("uploads");
        let rust_api_root = root.join("rust_api");
        let scripts_dir = root.join("scripts");
        std::fs::create_dir_all(&output_root).expect("create output root");
        std::fs::create_dir_all(&downloads_dir).expect("create downloads dir");
        std::fs::create_dir_all(&uploads_dir).expect("create uploads dir");
        std::fs::create_dir_all(&rust_api_root).expect("create rust_api root");
        std::fs::create_dir_all(&scripts_dir).expect("create scripts dir");

        let config = Arc::new(AppConfig {
            project_root: root.clone(),
            rust_api_root,
            data_root: data_root.clone(),
            scripts_dir: scripts_dir.clone(),
            run_provider_case_script: scripts_dir.join("run_provider_case.py"),
            run_provider_ocr_script: scripts_dir.join("run_provider_ocr.py"),
            run_normalize_ocr_script: scripts_dir.join("run_normalize_ocr.py"),
            run_translate_from_ocr_script: scripts_dir.join("run_translate_from_ocr.py"),
            run_translate_only_script: scripts_dir.join("run_translate_only.py"),
            run_render_only_script: scripts_dir.join("run_render_only.py"),
            run_failure_ai_diagnosis_script: scripts_dir.join("diagnose_failure_with_ai.py"),
            uploads_dir,
            downloads_dir,
            jobs_db_path: data_root.join("db").join("jobs.db"),
            output_root,
            python_bin: "python3".to_string(),
            bind_host: "127.0.0.1".to_string(),
            port: 41000,
            simple_port: 42000,
            upload_max_bytes: 0,
            upload_max_pages: 0,
            api_keys: HashSet::from(["test-key".to_string()]),
            max_running_jobs: 1,
            provider_limits: crate::config::ProviderLimitsConfig::default(),
            provider_runtime: crate::config::ProviderRuntimeConfig::default(),
            job_runner: crate::config::JobRunnerConfig::default(),
        });

        AppState {
            config: config.clone(),
            db: Arc::new(Db::new(
                config.jobs_db_path.clone(),
                config.data_root.clone(),
            )),
            downloads_lock: Arc::new(Mutex::new(())),
            canceled_jobs: Arc::new(RwLock::new(HashSet::new())),
            job_slots: Arc::new(Semaphore::new(1)),
        }
    }

    fn build_test_pdf_bytes() -> Vec<u8> {
        let dir =
            std::env::temp_dir().join(format!("rust-api-create-route-pdf-{}", fastrand::u64(..)));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        let path = dir.join("input.pdf");
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let font_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Courier",
        });
        let resources_id = doc.add_object(dictionary! {
            "Font" => dictionary! { "F1" => font_id, },
        });
        let content = Content {
            operations: vec![
                Operation::new("BT", vec![]),
                Operation::new("Tf", vec!["F1".into(), 18.into()]),
                Operation::new("Td", vec![72.into(), 720.into()]),
                Operation::new("Tj", vec![Object::string_literal("Hello")]),
                Operation::new("ET", vec![]),
            ],
        };
        let content_id = doc.add_object(Stream::new(
            dictionary! {},
            content.encode().expect("encode content"),
        ));
        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "Contents" => content_id,
        });
        doc.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => vec![Object::Reference(page_id)],
                "Count" => 1,
                "Resources" => resources_id,
                "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
            }),
        );
        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);
        doc.compress();
        doc.save(&path).expect("save test pdf");
        std::fs::read(path).expect("read test pdf")
    }

    #[tokio::test]
    async fn translate_bundle_route_returns_async_job_submission_json() {
        let state = test_state("translate-bundle-async");
        let boundary = "retainpdf-test-boundary";
        let pdf_bytes = build_test_pdf_bytes();
        let mut body = Vec::new();
        body.extend_from_slice(
            format!(
                "--{boundary}\r\nContent-Disposition: form-data; name=\"workflow\"\r\n\r\nbook\r\n"
            )
            .as_bytes(),
        );
        body.extend_from_slice(
            format!(
                "--{boundary}\r\nContent-Disposition: form-data; name=\"api_key\"\r\n\r\nsk-test\r\n"
            )
            .as_bytes(),
        );
        body.extend_from_slice(
            format!(
                "--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\ndeepseek-v4-flash\r\n"
            )
            .as_bytes(),
        );
        body.extend_from_slice(
            format!(
                "--{boundary}\r\nContent-Disposition: form-data; name=\"base_url\"\r\n\r\nhttps://api.deepseek.com/v1\r\n"
            )
            .as_bytes(),
        );
        body.extend_from_slice(
            format!(
                "--{boundary}\r\nContent-Disposition: form-data; name=\"mineru_token\"\r\n\r\nmineru-token\r\n"
            )
            .as_bytes(),
        );
        body.extend_from_slice(
            format!(
                "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"input.pdf\"\r\nContent-Type: application/pdf\r\n\r\n"
            )
            .as_bytes(),
        );
        body.extend_from_slice(&pdf_bytes);
        body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());

        let response = build_simple_app(state)
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/translate/bundle")
                    .header("X-API-Key", "test-key")
                    .header(
                        header::CONTENT_TYPE,
                        format!("multipart/form-data; boundary={boundary}"),
                    )
                    .body(Body::from(body))
                    .expect("request"),
            )
            .await
            .expect("response");

        assert_eq!(response.status(), StatusCode::OK);
        let content_type = response
            .headers()
            .get(header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("");
        assert!(content_type.starts_with("application/json"));
        let payload: Value = serde_json::from_slice(
            &to_bytes(response.into_body(), usize::MAX)
                .await
                .expect("body"),
        )
        .expect("json");
        assert_eq!(payload["data"]["status"], "queued");
        assert_eq!(payload["data"]["workflow"], "book");
        assert!(payload["data"]["job_id"].as_str().unwrap_or("").len() > 8);
    }
}
