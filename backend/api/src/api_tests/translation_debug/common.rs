use std::fs;

use serde_json::json;

use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot};

pub(super) const JOB_ID: &str = "job-translation-debug";
pub(super) const ITEM_ID: &str = "p001-b001";

pub(super) fn seed_translation_debug_job(state: &crate::AppState) {
    let job_root = state.config.output_root.join(JOB_ID);
    let artifacts_dir = job_root.join("artifacts");
    let translated_dir = job_root.join("translated");
    fs::create_dir_all(&artifacts_dir).expect("artifacts dir");
    fs::create_dir_all(&translated_dir).expect("translated dir");
    fs::create_dir_all(state.config.scripts_dir.join("devtools")).expect("create devtools dir");
    fs::write(
        artifacts_dir.join("translation_diagnostics.json"),
        serde_json::to_vec_pretty(&json!({
            "api_key": "sk-debug-secret",
            "message": "contains sk-debug-secret"
        }))
        .expect("diagnostics json"),
    )
    .expect("write diagnostics");
    fs::write(
        translated_dir.join("page-1.json"),
        serde_json::to_vec_pretty(&json!([
            {
                "item_id": ITEM_ID,
                "page_idx": 0,
                "source_text": "English sk-debug-secret",
                "api_key": "sk-debug-secret"
            }
        ]))
        .expect("page json"),
    )
    .expect("write page");
    fs::write(
        translated_dir.join("translation-manifest.json"),
        serde_json::to_vec_pretty(&json!({
            "pages": [{"page_index": 0, "path": "page-1.json"}]
        }))
        .expect("manifest json"),
    )
    .expect("write manifest");
    fs::write(
        state
            .config
            .scripts_dir
            .join("devtools")
            .join("replay_translation_item.py"),
        r#"#!/usr/bin/env python3
import json
print(json.dumps({"api_key": "sk-debug-secret", "message": "replay sk-debug-secret"}))
"#,
    )
    .expect("write replay script");

    let mut input = CreateJobInput::default();
    input.translation.api_key = "sk-debug-secret".to_string();
    let mut job = JobSnapshot::new(JOB_ID.to_string(), input, vec!["python".to_string()]);
    job.artifacts = Some(JobArtifacts {
        job_root: Some(job_root.to_string_lossy().to_string()),
        translations_dir: Some(translated_dir.to_string_lossy().to_string()),
        ..JobArtifacts::default()
    });
    state.db.save_job(&job).expect("save job");
}
