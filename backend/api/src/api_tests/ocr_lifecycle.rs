use std::fs;
use std::time::Duration;

use axum::body::{to_bytes, Body};
use axum::http::{header, Request, StatusCode};
use serde_json::Value;
use tower::util::ServiceExt;

use super::jobs_common::{minimal_pdf_bytes, read_json, test_state};
use crate::app::build_app;
use crate::models::domain::{JobSnapshot, JobStatusKind, WorkflowKind};

const FAKE_OCR_WORKER: &str = r##"
import argparse
import json
import pathlib
import shutil

parser = argparse.ArgumentParser()
parser.add_argument("subcommand", nargs="?")
parser.add_argument("--spec", required=True)
args = parser.parse_args()

spec = json.loads(pathlib.Path(args.spec).read_text(encoding="utf-8"))
job_root = pathlib.Path(spec["job"]["job_root"])
source_input = pathlib.Path(spec["source"]["file_path"])
source_pdf = job_root / "source" / "input.pdf"
normalized = job_root / "ocr" / "normalized" / "document.v1.json"
report = job_root / "ocr" / "normalized" / "document.v1.report.json"
markdown = job_root / "md" / "full.md"

source_pdf.parent.mkdir(parents=True, exist_ok=True)
normalized.parent.mkdir(parents=True, exist_ok=True)
markdown.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(source_input, source_pdf)
normalized.write_text(json.dumps({
    "schema": "normalized_document_v1",
    "schema_version": "1.1",
    "page_count": 1,
    "assets": {},
    "pages": [{
        "page_index": 0,
        "width": 595.0,
        "height": 842.0,
        "unit": "pt",
        "blocks": [{
            "block_id": "p001-b0000",
            "bbox": [24.0, 36.0, 280.0, 72.0],
            "geometry": {"bbox": [24.0, 36.0, 280.0, 72.0]},
            "reading_order": 0,
            "content": {"kind": "text", "text": "OCR lifecycle source text"},
            "text": "OCR lifecycle source text",
            "type": "text"
        }]
    }]
}), encoding="utf-8")
report.write_text(json.dumps({"validation": {"valid": True}}), encoding="utf-8")
markdown.write_text("# OCR lifecycle\n\nOCR lifecycle source text\n", encoding="utf-8")

print(f"job root: {job_root}", flush=True)
print(f"source pdf: {source_pdf}", flush=True)
print(f"normalized document json: {normalized}", flush=True)
print(f"normalization report json: {report}", flush=True)
print("schema version: 1.1", flush=True)
"##;

fn multipart_ocr_request(boundary: &str, pdf_bytes: &[u8]) -> Vec<u8> {
    let mut body = Vec::new();
    for (name, value) in [
        ("workflow", "ocr"),
        ("provider", "local"),
        ("ocr_options", r#"{"command":"fake-local-ocr"}"#),
        ("timeout_seconds", "10"),
    ] {
        body.extend_from_slice(
            format!(
                "--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n"
            )
            .as_bytes(),
        );
    }
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"ocr-only.pdf\"\r\nContent-Type: application/pdf\r\n\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(pdf_bytes);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    body
}

async fn wait_for_terminal_job(state: &crate::AppState, job_id: &str) -> JobSnapshot {
    tokio::time::timeout(Duration::from_secs(10), async {
        loop {
            let job = state.db.get_job(job_id).expect("load OCR job");
            if matches!(
                job.status,
                JobStatusKind::Succeeded | JobStatusKind::Failed | JobStatusKind::Canceled
            ) {
                return job;
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    })
    .await
    .expect("OCR job should reach a terminal state")
}

#[tokio::test]
async fn ocr_only_submission_reaches_reader_and_document_outputs() {
    let mut state = test_state("ocr-only-lifecycle");
    let bin_dir = state.config.data_root.join("bin");
    // Stage workers run as `python -m retainpdf_pipeline.<stage>`, so the
    // fake worker is a stub package plus a python wrapper that exposes it
    // through PYTHONPATH (mirrors production, where the bundled/dev/docker
    // python always has the real package importable).
    let fake_lib = bin_dir.join("fakelib");
    let fake_stage = fake_lib.join("retainpdf_pipeline").join("ocr");
    fs::create_dir_all(&fake_stage).expect("create fake stage package");
    fs::write(fake_lib.join("retainpdf_pipeline").join("__init__.py"), b"").expect("write fake package init");
    fs::write(fake_stage.join("__init__.py"), b"").expect("write fake stage init");
    fs::write(fake_stage.join("__main__.py"), FAKE_OCR_WORKER).expect("write fake stage worker");
    let python_stub = bin_dir.join("python3");
    fs::write(
        &python_stub,
        format!(
            "#!/bin/sh\nexport PYTHONPATH=\"{}:$PYTHONPATH\"\nexec python3 \"$@\"\n",
            fake_lib.to_string_lossy()
        ),
    )
    .expect("write fake python wrapper");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&python_stub, fs::Permissions::from_mode(0o700))
            .expect("make stub executable");
    }
    let mut config = (*state.config).clone();
    config.python_bin = python_stub.to_string_lossy().to_string();
    state.config = std::sync::Arc::new(config);
    let app = build_app(state.clone());
    let boundary = "retainpdf-ocr-lifecycle-boundary";

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/ocr/jobs")
                .header("X-API-Key", "test-key")
                .header(
                    header::CONTENT_TYPE,
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(Body::from(multipart_ocr_request(
                    boundary,
                    &minimal_pdf_bytes(595, 842),
                )))
                .expect("OCR create request"),
        )
        .await
        .expect("OCR create response");

    assert_eq!(create_response.status(), StatusCode::OK);
    let create_payload = read_json(create_response).await;
    assert_eq!(create_payload["data"]["status"], "queued");
    assert_eq!(create_payload["data"]["workflow"], "ocr");
    let job_id = create_payload["data"]["job_id"]
        .as_str()
        .expect("created job id")
        .to_string();

    let job = wait_for_terminal_job(&state, &job_id).await;
    assert_eq!(job.workflow, WorkflowKind::Ocr);
    assert_eq!(
        job.status,
        JobStatusKind::Succeeded,
        "OCR worker failed: error={:?} logs={:?}",
        job.error,
        job.log_tail
    );
    let document = state
        .db
        .get_document_by_job_id(&job_id)
        .expect("lookup OCR document")
        .expect("OCR job should be linked to its upload document");
    assert_eq!(document.active_job_id.as_deref(), Some(job_id.as_str()));
    assert_eq!(
        state
            .db
            .job_ids_for_document(&document.document_id)
            .expect("document jobs"),
        vec![job_id.clone()]
    );

    let document_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/documents?job_id={job_id}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("document request"),
        )
        .await
        .expect("document response");
    assert_eq!(document_response.status(), StatusCode::OK);
    let document_payload = read_json(document_response).await;
    assert_eq!(
        document_payload["data"]["documents"][0]["document_id"],
        document.document_id
    );
    assert_eq!(
        document_payload["data"]["documents"][0]["active_job_id"],
        job_id
    );

    let normalized_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{job_id}/normalized-document"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("normalized document request"),
        )
        .await
        .expect("normalized document response");
    assert_eq!(normalized_response.status(), StatusCode::OK);
    let normalized: Value = serde_json::from_slice(
        &to_bytes(normalized_response.into_body(), usize::MAX)
            .await
            .expect("normalized body"),
    )
    .expect("normalized JSON");
    assert_eq!(
        normalized["pages"][0]["blocks"][0]["block_id"],
        "p001-b0000"
    );

    let regions_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{job_id}/reader/regions"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("Reader regions request"),
        )
        .await
        .expect("Reader regions response");
    assert_eq!(regions_response.status(), StatusCode::OK);
    let regions_payload = read_json(regions_response).await;
    assert_eq!(regions_payload["data"]["items"][0]["item_id"], "p001-b0000");
    assert_eq!(regions_payload["data"]["items"][0]["status"], "source_only");
    assert_eq!(
        regions_payload["data"]["items"][0]["source"]["text"],
        "OCR lifecycle source text"
    );

    let markdown_response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{job_id}/markdown?raw=true"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("markdown request"),
        )
        .await
        .expect("markdown response");
    assert_eq!(markdown_response.status(), StatusCode::OK);
    let markdown = to_bytes(markdown_response.into_body(), usize::MAX)
        .await
        .expect("markdown body");
    assert_eq!(
        std::str::from_utf8(&markdown).expect("markdown UTF-8"),
        "# OCR lifecycle\n\nOCR lifecycle source text\n"
    );
}
