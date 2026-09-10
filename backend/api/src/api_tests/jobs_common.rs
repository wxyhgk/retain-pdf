use std::collections::HashSet;
use std::fs;
use std::sync::Arc;

use axum::body::to_bytes;

use crate::app::build_state;
use crate::config::AppConfig;
pub(crate) fn test_state(test_name: &str) -> crate::AppState {
    let root = std::env::temp_dir().join(format!(
        "rust-api-query-routes-{test_name}-{}",
        fastrand::u64(..)
    ));
    let data_root = root.join("data");
    let output_root = data_root.join("jobs");
    let downloads_dir = data_root.join("downloads");
    let uploads_dir = data_root.join("uploads");
    let rust_api_root = root.join("rust_api");
    let scripts_dir = root.join("scripts");
    fs::create_dir_all(&output_root).expect("create output root");
    fs::create_dir_all(&downloads_dir).expect("create downloads dir");
    fs::create_dir_all(&uploads_dir).expect("create uploads dir");
    fs::create_dir_all(&rust_api_root).expect("create rust_api root");
    fs::create_dir_all(&scripts_dir).expect("create scripts dir");

    build_state(Arc::new(AppConfig {
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
        simple_port: 42000,
        upload_max_bytes: 0,
        upload_max_pages: 0,
        upload_processing: Default::default(),
        api_keys: HashSet::from(["test-key".to_string()]),
        max_running_jobs: 1,
        provider_limits: crate::config::ProviderLimitsConfig::default(),
        provider_runtime: crate::config::ProviderRuntimeConfig::default(),
        job_runner: crate::config::JobRunnerConfig::default(),
        ai_service: crate::config::AiServiceConfig::default(),
        jobs_service: crate::config::JobsServiceConfig::default(),
        asset: crate::config::AssetConfig::default(),
        cleanup: crate::config::CleanupConfig::default(),
        db: crate::config::DbConfig::default(),
        ai_proxy: crate::config::AiProxyConfig::default(),
        reader_llm: crate::config::ReaderLlmConfig::default(),
        rag: crate::config::RagConfig::default(),
    }))
    .expect("build state")
}

pub(crate) async fn read_json(response: axum::response::Response) -> serde_json::Value {
    serde_json::from_slice(
        &to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body"),
    )
    .expect("parse json")
}

pub(crate) fn minimal_pdf_bytes(width: i64, height: i64) -> Vec<u8> {
    let objects = [
        "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_string(),
        format!("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width} {height}] >>"),
    ];
    let mut bytes = b"%PDF-1.4\n".to_vec();
    let mut offsets = vec![0usize];
    for (idx, object) in objects.iter().enumerate() {
        offsets.push(bytes.len());
        bytes.extend_from_slice(format!("{} 0 obj\n{}\nendobj\n", idx + 1, object).as_bytes());
    }
    let xref_offset = bytes.len();
    bytes.extend_from_slice(format!("xref\n0 {}\n", offsets.len()).as_bytes());
    bytes.extend_from_slice(b"0000000000 65535 f \n");
    for offset in offsets.iter().skip(1) {
        bytes.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
    }
    bytes.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF\n",
            offsets.len(),
            xref_offset
        )
        .as_bytes(),
    );
    bytes
}
