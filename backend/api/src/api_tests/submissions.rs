//! 建任务的每个入口的结果快照：返回、落库的任务、归属、书卡、事件、凭据库、页额度。
//!
//! 整理入口（只留一个提交函数）之前先把现状钉住，整理完快照不该变；有意改了才重新生成：
//!
//! ```text
//! UPDATE_SUBMISSIONS=1 cargo test -p retainpdf-api --lib submissions
//! ```
//!
//! 快照在 `backend/api/docs/submissions.txt`。任务不真跑：发射器只记下任务编号。

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use serde_json::{json, Value};

use crate::api_tests::jobs_common::minimal_pdf_bytes;
use crate::api_tests::jobs_retry::common::{
    seed_ambiguous_ocr_dispatch, seed_translation_result_files,
    source_job_with_artifacts,
};
use crate::app::{build_jobs_facade_with_launcher, build_state};
use crate::config::{AccountsConfig, AppConfig, DeploymentMode};
use crate::db::OwnedKind;
use crate::error::AppError;
use crate::models::api::{OcrAmbiguityResolutionRequest, RetryStageRequest};
use crate::models::request::CreateJobInput;
use crate::models::{now_iso, JobArtifacts, JobStatusKind, UploadRecord};
use crate::services::jobs::{JobRuntimeLauncher, JobsFacade};
use crate::test_support::config::TestDirs;
use crate::AppState;

const BASE_URL: &str = "http://retain.test";

struct Fixture {
    state: AppState,
    launched: Arc<Mutex<Vec<String>>>,
}

impl Fixture {
    fn new(name: &str, multi: bool) -> Self {
        let dirs = TestDirs::create(&format!("rust-api-submissions-{name}-{}", fastrand::u64(..)));
        let mut config = dirs.config();
        if multi {
            config = AppConfig {
                accounts: AccountsConfig {
                    mode: DeploymentMode::Multi,
                    session_cookie_secure: false,
                    ..AccountsConfig::default()
                },
                ..config
            };
        }
        let state = build_state(Arc::new(config)).expect("build state");
        Self {
            state,
            launched: Arc::new(Mutex::new(Vec::new())),
        }
    }

    fn jobs(&self) -> JobsFacade<'_> {
        let launched = self.launched.clone();
        build_jobs_facade_with_launcher(
            &self.state,
            JobRuntimeLauncher::new(Arc::new(move |job_id| launched.lock().unwrap().push(job_id))),
        )
    }

    fn data_root(&self) -> PathBuf {
        self.state.config.data_root.clone()
    }

    /// 一份上传 + 它的书（书的编号 = `doc-<upload>`），记在 `owner` 名下。
    fn seed_upload(&self, upload_id: &str, owner: &str, page_count: u32) -> UploadRecord {
        let dir = self.state.config.uploads_dir.join(upload_id);
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("input.pdf");
        std::fs::write(&path, minimal_pdf_bytes(595, 842)).unwrap();
        let upload = UploadRecord {
            upload_id: upload_id.to_string(),
            filename: "input.pdf".to_string(),
            stored_path: path.to_string_lossy().into_owned(),
            bytes: std::fs::metadata(&path).unwrap().len(),
            page_count,
            uploaded_at: now_iso(),
            developer_mode: false,
            content_hash: format!("doc-{upload_id}"),
        };
        self.state.db.save_upload_with_document_for(&upload, owner).unwrap();
        upload
    }

    fn seed_user(&self, user_id: &str, role: &str, pages: i64) {
        self.state
            .db
            .create_user(user_id, user_id, "hash", role, false, &now_iso())
            .unwrap();
        if pages > 0 {
            self.state.db.grant_pages(user_id, pages, "", "u_root", &now_iso()).unwrap();
        }
    }

    fn credential_count(&self) -> usize {
        crate::services::providers::list_credentials(&self.state.config.data_root)
            .map(|view| view.credentials.len())
            .unwrap_or(0)
    }
}

fn input(value: Value) -> CreateJobInput {
    CreateJobInput::from_api_value(value).expect("valid create-job payload")
}

fn document_input(value: Value) -> crate::models::api::DocumentJobRequest {
    crate::models::api::DocumentJobRequest::from_api_value(value).expect("valid create-job payload")
}

fn book_with_keys(upload_id: &str) -> Value {
    json!({
        "workflow": "book",
        "source": { "upload_id": upload_id },
        "ocr": { "provider": "mineru", "mineru_token": "mineru-user-token" },
        "translation": {
            "model": "deepseek-flash",
            "base_url": "https://api.deepseek.com/v1",
            "api_key": "sk-user-key"
        }
    })
}

/// 把一次提交的结果写成几行文字：返回、每个新任务落库的样子、凭据库和页额度的变化。
struct Recorder {
    out: String,
    names: BTreeMap<String, String>,
}

impl Recorder {
    fn new() -> Self {
        Self {
            out: String::new(),
            names: BTreeMap::new(),
        }
    }

    /// 随机编号换成按出现顺序的名字，快照才稳定。
    fn name(&mut self, raw: &str, kind: &str) -> String {
        if raw.is_empty() {
            return String::new();
        }
        let next = self.names.values().filter(|name| name.starts_with(&format!("<{kind}-"))).count() + 1;
        self.names
            .entry(raw.to_string())
            .or_insert_with(|| format!("<{kind}-{next}>"))
            .clone()
    }

    fn scrub(&mut self, text: &str, fixture: &Fixture) -> String {
        let mut text = text.replace(&fixture.data_root().to_string_lossy().to_string(), "<data>");
        for (raw, name) in &self.names {
            text = text.replace(raw.as_str(), name);
        }
        text
    }

    /// 结构里的凭据编号、新上传编号先登记名字。
    fn register_ids(&mut self, value: &Value) {
        match value {
            Value::String(text) if text.starts_with("cred_") => {
                self.name(text, "cred");
            }
            Value::Object(map) => {
                for (key, item) in map {
                    if key == "upload_id" {
                        if let Some(id) = item.as_str().filter(|id| !id.starts_with("up-")) {
                            self.name(id, "upload");
                        }
                    }
                    self.register_ids(item);
                }
            }
            Value::Array(items) => items.iter().for_each(|item| self.register_ids(item)),
            _ => {}
        }
    }

    async fn case<F, Fut>(&mut self, fixture: &Fixture, title: &str, quota_user: Option<&str>, call: F)
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = Result<Value, AppError>>,
    {
        let db = &fixture.state.db;
        let credentials_before = fixture.credential_count();
        let balance_before = quota_user.map(|user| db.page_balance(user).unwrap());
        fixture.launched.lock().unwrap().clear();
        let result = call().await;
        let launched: Vec<String> = fixture.launched.lock().unwrap().clone();

        let mut text = format!("## {title}\n");
        match &result {
            Ok(view) => {
                let mut view = view.clone();
                strip(&mut view);
                for id in &launched {
                    if !id.starts_with("src-") {
                        self.name(id, "job");
                    }
                }
                self.register_ids(&view);
                text.push_str(&format!("result: ok\n{}\n", serde_json::to_string_pretty(&view).unwrap()));
            }
            Err(error) => text.push_str(&format!("result: error {error:?}\n")),
        }
        text.push_str(&format!("launched: {}\n", launched.join(", ")));
        for job_id in &launched {
            let job = db.get_job(job_id).expect("launched job persisted");
            let mut request = serde_json::to_value(&job.request_payload).unwrap();
            strip(&mut request);
            self.register_ids(&request);
            let document = db.document_id_for_job(job_id).unwrap();
            let active = document
                .as_deref()
                .and_then(|id| db.get_document(id).ok())
                .is_some_and(|document| document.active_job_id.as_deref() == Some(job_id.as_str()));
            let events: Vec<String> = db
                .list_job_events(job_id, 100, 0)
                .unwrap()
                .into_iter()
                .map(|event| event.event)
                .collect();
            text.push_str(&format!(
                "job {job_id}: workflow={:?} status={:?} stage={}\n  owner={} document={} active={}\n  events={:?}\n  request={}\n",
                job.workflow,
                job.status,
                job.stage.as_deref().unwrap_or(""),
                db.resource_owner(OwnedKind::Job, job_id).unwrap().unwrap_or_default(),
                document.unwrap_or_default(),
                active,
                events,
                serde_json::to_string(&request).unwrap(),
            ));
        }
        text.push_str(&format!(
            "credentials: +{}\n",
            fixture.credential_count() - credentials_before
        ));
        if let (Some(user), Some(before)) = (quota_user, balance_before) {
            text.push_str(&format!("pages {user}: {before} -> {}\n", db.page_balance(user).unwrap()));
        }
        let text = self.scrub(&text, fixture);
        self.out.push_str(&text);
        self.out.push('\n');
    }
}

/// 链接、动作是按任务编号拼的地址，和入口无关；时间戳每次都变。
fn strip(value: &mut Value) {
    if let Value::Object(map) = value {
        map.remove("links");
        map.remove("actions");
        map.retain(|key, _| !key.ends_with("_at"));
        map.values_mut().for_each(strip);
    } else if let Value::Array(items) = value {
        items.iter_mut().for_each(strip);
    }
}

fn view<T: serde::Serialize>(result: Result<T, AppError>) -> Result<Value, AppError> {
    result.map(|view| serde_json::to_value(view).unwrap())
}

/// 失败过、带上传的源任务：OCR 重试、OCR 歧义用。
fn failed_ocr_source(fixture: &Fixture, job_id: &str, upload: &UploadRecord) {
    let mut job = source_job_with_artifacts(job_id, JobArtifacts::default());
    job.status = JobStatusKind::Failed;
    job.request_payload.source.upload_id = upload.upload_id.clone();
    job.request_payload.ocr.provider = "mineru".to_string();
    job.request_payload.ocr.mineru_token = "mineru-source-token".to_string();
    fixture.state.db.save_job(&job).unwrap();
}

/// 翻译完的源任务（OCR 结果 + 译文都在）：重渲染、重翻译、续跑用。
fn translated_source(fixture: &Fixture, job_id: &str, upload: &UploadRecord) {
    let mut job = source_job_with_artifacts(
        job_id,
        JobArtifacts {
            job_root: Some(format!("jobs/{job_id}")),
            source_pdf: Some(format!("jobs/{job_id}/source/input.pdf")),
            normalized_document_json: Some(format!("jobs/{job_id}/ocr/document.v1.json")),
            translations_dir: Some(format!("jobs/{job_id}/translated")),
            ocr_page_numbers: (1..=upload.page_count).collect(),
            ..JobArtifacts::default()
        },
    );
    job.status = JobStatusKind::Failed;
    job.request_payload.source.upload_id = upload.upload_id.clone();
    seed_translation_result_files(&fixture.state, &job);
    fixture.state.db.save_job(&job).unwrap();
    fixture.state.db.link_job_to_document(job_id, &upload.upload_id).unwrap();
}

fn retry(stage: &str, extra: Value) -> RetryStageRequest {
    let mut body = json!({ "stage": stage });
    body.as_object_mut().unwrap().extend(extra.as_object().cloned().unwrap_or_default());
    serde_json::from_value(body).unwrap()
}

async fn single_user_cases(recorder: &mut Recorder) {
    let fixture = Fixture::new("single", false);
    let jobs = fixture.jobs();
    let library = crate::routes::common::build_library_route_deps(&fixture.state).library;
    let upload = fixture.seed_upload("up-book", "local", 3);

    recorder
        .case(&fixture, "POST /jobs  book，带上传和明文 key", None, || async {
            view(jobs.create_submission(BASE_URL, &input(book_with_keys("up-book"))))
        })
        .await;
    recorder
        .case(&fixture, "POST /jobs  book，没带上传", None, || async {
            view(jobs.create_submission(BASE_URL, &input(json!({ "workflow": "book" }))))
        })
        .await;
    recorder
        .case(&fixture, "POST /jobs  book，上传不存在", None, || async {
            view(jobs.create_submission(BASE_URL, &input(book_with_keys("up-missing"))))
        })
        .await;
    recorder
        .case(&fixture, "POST /jobs  ocr，带上传", None, || async {
            view(jobs.create_submission(
                BASE_URL,
                &input(json!({
                    "workflow": "ocr",
                    "source": { "upload_id": "up-book" },
                    "ocr": { "provider": "mineru", "mineru_token": "mineru-user-token", "page_ranges": "1-2" },
                    "translation": { "api_key": "sk-unused" }
                })),
            ))
        })
        .await;
    recorder
        .case(&fixture, "POST /jobs  ocr，没有来源", None, || async {
            view(jobs.create_submission(
                BASE_URL,
                &input(json!({ "workflow": "ocr", "ocr": { "provider": "mineru", "mineru_token": "t" } })),
            ))
        })
        .await;

    // 客户端不许自己指定任务编号：已有编号会被覆盖，`..` 会跑出输出目录。
    for (title, job_id) in [
        ("POST /jobs  带 runtime.job_id（已有任务的编号）", "src-translated"),
        ("POST /jobs  带 runtime.job_id（路径穿越）", "../../escape"),
    ] {
        recorder
            .case(&fixture, title, None, || async {
                let mut request = book_with_keys("up-book");
                request["runtime"] = json!({ "job_id": job_id });
                view(jobs.create_submission(BASE_URL, &input(request)))
            })
            .await;
    }

    translated_source(&fixture, "src-translated", &upload);
    recorder
        .case(&fixture, "POST /jobs  render，用已有任务的译文", None, || async {
            view(jobs.create_submission(
                BASE_URL,
                &input(json!({ "workflow": "render", "source": { "artifact_job_id": "src-translated" } })),
            ))
        })
        .await;
    recorder
        .case(&fixture, "POST /jobs  render，没给源任务", None, || async {
            view(jobs.create_submission(BASE_URL, &input(json!({ "workflow": "render" }))))
        })
        .await;
    recorder
        .case(&fixture, "POST /jobs  translate，复用已有任务的 OCR", None, || async {
            view(jobs.create_submission(
                BASE_URL,
                &input(json!({
                    "workflow": "translate",
                    "source": { "artifact_job_id": "src-translated" },
                    "translation": {
                        "model": "deepseek-flash",
                        "base_url": "https://api.deepseek.com/v1",
                        "api_key": "sk-user-key"
                    }
                })),
            ))
        })
        .await;

    // 重试、续跑：从已有任务派生。
    let ocr_upload = fixture.seed_upload("up-ocr-src", "local", 1);
    failed_ocr_source(&fixture, "src-ocr-failed", &ocr_upload);
    recorder
        .case(&fixture, "POST /jobs/:id/retry-stage  ocr（新任务，只带上传）", None, || async {
            view(jobs.retry_stage_submission(BASE_URL, "src-ocr-failed", retry("ocr", json!({}))))
        })
        .await;
    recorder
        .case(&fixture, "POST /jobs/:id/retry-stage  translation（新任务，复用 OCR）", None, || async {
            view(jobs.retry_stage_submission(
                BASE_URL,
                "src-translated",
                retry("translation", json!({ "overrides": { "translation": { "workers": 7 } } })),
            ))
        })
        .await;
    // 同一个源任务已经有在跑的派生任务（上一条建的）：再重试 409 derived_job_active，什么都不建（2026-11-24 起）。
    recorder
        .case(&fixture, "POST /jobs/:id/retry-stage  render，源任务已有在跑的派生任务", None, || async {
            view(jobs.retry_stage_submission(BASE_URL, "src-translated", retry("render", json!({}))))
        })
        .await;
    translated_source(&fixture, "src-translated-render", &upload);
    recorder
        .case(&fixture, "POST /jobs/:id/retry-stage  render（新任务）", None, || async {
            view(jobs.retry_stage_submission(BASE_URL, "src-translated-render", retry("render", json!({}))))
        })
        .await;
    // 原地重跑会把源任务改成排队中，各用一个源任务。
    translated_source(&fixture, "src-rerun", &upload);
    recorder
        .case(&fixture, "POST /jobs/:id/rerun  续跑（译文都在：原地重渲染）", None, || async {
            view(jobs.rerun_submission(BASE_URL, "src-rerun", &json!({})))
        })
        .await;
    translated_source(&fixture, "src-in-place", &upload);
    recorder
        .case(&fixture, "POST /jobs/:id/retry-stage  render（原地）", None, || async {
            view(jobs.retry_stage_submission(
                BASE_URL,
                "src-in-place",
                retry("render", json!({ "create_new_job": false })),
            ))
        })
        .await;

    // OCR 结果不确定：两种处理方式各建一个恢复任务。
    let ambiguous_upload = fixture.seed_upload("up-ambiguous", "local", 1);
    for (job_id, title) in [
        ("src-ambiguous-a", "POST /jobs/:id/retry-stage  ocr，结果不确定，接受重复风险"),
        ("src-ambiguous-b", "POST /jobs/:id/ocr-ambiguity/resolve  绑定已有回执"),
    ] {
        failed_ocr_source(&fixture, job_id, &ambiguous_upload);
        fixture.state.db.set_job_document_id(job_id, "doc-up-ambiguous").unwrap();
        seed_ambiguous_ocr_dispatch(&fixture.state, job_id, "mineru", "create_extract_task");
        let revision = fixture
            .state
            .db
            .latest_pipeline_dispatch(job_id, "ocr-submit")
            .unwrap()
            .unwrap()
            .generation;
        recorder
            .case(&fixture, title, None, || async {
                if job_id.ends_with('a') {
                    view(jobs.retry_stage_submission(
                        BASE_URL,
                        job_id,
                        retry("ocr", json!({ "ambiguous_request_policy": "accept_duplicate_risk" })),
                    ))
                } else {
                    let request: OcrAmbiguityResolutionRequest = serde_json::from_value(json!({
                        "resolution": "bind_existing_receipt",
                        "resolution_revision": revision,
                        "task_id": "mineru-task-1"
                    }))
                    .unwrap();
                    view(jobs.resolve_ocr_ambiguity_submission(BASE_URL, job_id, request))
                }
            })
            .await;
    }

    // 书库：翻译、OCR 这本书。
    fixture.seed_upload("up-library", "local", 2);
    recorder
        .case(&fixture, "POST /documents/:id/translate", None, || async {
            let mut request = book_with_keys("");
            request["source"] = json!({});
            view(crate::services::library::translate_document_view(
                &library,
                &jobs,
                "doc-up-library",
                document_input(request),
                BASE_URL,
            ))
        })
        .await;
    recorder
        .case(&fixture, "POST /documents/:id/translate  带 runtime.job_id", None, || async {
            let mut request = book_with_keys("");
            request["source"] = json!({});
            request["runtime"] = json!({ "job_id": "custom-id" });
            view(crate::services::library::translate_document_view(
                &library,
                &jobs,
                "doc-up-library",
                document_input(request),
                BASE_URL,
            ))
        })
        .await;
    recorder
        .case(&fixture, "POST /documents/:id/ocr  带 runtime.job_id", None, || async {
            view(
                crate::services::library::ocr_document_view(
                    &library,
                    &jobs,
                    "doc-up-library",
                    document_input(json!({
                        "ocr": { "provider": "mineru", "mineru_token": "mineru-user-token" },
                        "runtime": { "job_id": "custom-id" }
                    })),
                    BASE_URL,
                )
                .await,
            )
        })
        .await;
    recorder
        .case(&fixture, "POST /documents/:id/translate  workflow=ocr", None, || async {
            view(crate::services::library::translate_document_view(
                &library,
                &jobs,
                "doc-up-library",
                document_input(json!({ "workflow": "ocr" })),
                BASE_URL,
            ))
        })
        .await;
    recorder
        .case(&fixture, "POST /documents/:id/ocr", None, || async {
            view(
                crate::services::library::ocr_document_view(
                    &library,
                    &jobs,
                    "doc-up-library",
                    document_input(json!({ "ocr": { "provider": "mineru", "mineru_token": "mineru-user-token" } })),
                    BASE_URL,
                )
                .await,
            )
        })
        .await;
    // 书的入口和 POST /jobs 一样严格：和入口矛盾的字段 400，不悄悄改写；先查请求再查状态。
    let ocr_settings = json!({ "provider": "mineru", "mineru_token": "mineru-user-token" });
    for (title, body) in [
        ("POST /documents/:id/ocr  workflow=book", json!({ "workflow": "book", "ocr": ocr_settings })),
        ("POST /documents/:id/ocr  带 source.artifact_job_id", json!({ "source": { "artifact_job_id": "some-job" }, "ocr": ocr_settings })),
        ("POST /documents/:id/ocr  带 source.source_url", json!({ "source": { "source_url": "https://example.com/a.pdf" }, "ocr": ocr_settings })),
    ] {
        recorder
            .case(&fixture, title, None, || async {
                view(
                    crate::services::library::ocr_document_view(&library, &jobs, "doc-up-library", document_input(body), BASE_URL)
                        .await,
                )
            })
            .await;
    }
    for (title, body) in [
        ("POST /documents/:id/translate  带 source.source_url", {
            let mut request = book_with_keys("");
            request["source"] = json!({ "source_url": "https://example.com/a.pdf" });
            request
        }),
        ("POST /documents/:id/translate  带 runtime.job_id、复用不存在的 OCR", json!({
            "workflow": "translate",
            "source": { "artifact_job_id": "missing-ocr" },
            "runtime": { "job_id": "custom-id" }
        })),
    ] {
        recorder
            .case(&fixture, title, None, || async {
                view(crate::services::library::translate_document_view(
                    &library,
                    &jobs,
                    "doc-up-library",
                    document_input(body),
                    BASE_URL,
                ))
            })
            .await;
    }
}

async fn multi_user_cases(recorder: &mut Recorder) {
    let fixture = Fixture::new("multi", true);
    let state = &fixture.state;
    crate::services::accounts::save_platform_settings(
        &state.db,
        &state.config.data_root,
        &state.config.accounts.platform,
        &state.config.provider_runtime.deepseek,
        "u_root",
        crate::services::accounts::SavePlatformSettingsInput {
            translation: crate::services::accounts::SaveTranslationSettings {
                model: "platform-model".into(),
                base_url: "https://platform.example/v1".into(),
                api_protocol: "openai".into(),
                thinking: "low".into(),
                max_workers: 3,
                api_key: Some("sk-platform-key-1234".into()),
            },
            ocr: crate::services::accounts::SaveOcrSettings {
                provider: "mineru".into(),
                token: Some("mineru-platform-token".into()),
            },
        },
    )
    .expect("save platform settings");
    fixture.seed_user("u_alice", "user", 4);
    fixture.seed_upload("up-alice", "u_alice", 3);
    let jobs = fixture.jobs();

    recorder
        .case(&fixture, "多用户  POST /jobs  book，自带 key（换成平台的，按页预扣）", Some("u_alice"), || async {
            view(jobs.create_submission(BASE_URL, &input(book_with_keys("up-alice"))))
        })
        .await;
    recorder
        .case(&fixture, "多用户  POST /jobs  book，页数不够", Some("u_alice"), || async {
            view(jobs.create_submission(BASE_URL, &input(book_with_keys("up-alice"))))
        })
        .await;
}

/// 只能服务器定的 OCR 选项（审计 A2，2026-10-22）：对外入口带了 400；老任务里存着的，重试、续跑复制时去掉，
/// 不因此 400；重试的 overrides 再带就 400。
async fn server_owned_ocr_option_cases(recorder: &mut Recorder) {
    let fixture = Fixture::new("server-owned", false);
    let jobs = fixture.jobs();
    let library = crate::routes::common::build_library_route_deps(&fixture.state).library;
    fixture.seed_upload("up-owned", "local", 2);

    recorder
        .case(&fixture, "POST /jobs  ocr，local 带 ocr.options.command", None, || async {
            view(jobs.create_submission(
                BASE_URL,
                &input(json!({
                    "workflow": "ocr",
                    "source": { "upload_id": "up-owned" },
                    "ocr": { "provider": "local", "options": { "command": "sh -c 'touch /tmp/pwned'" } }
                })),
            ))
        })
        .await;
    recorder
        .case(&fixture, "POST /jobs  book，带 ocr.options.raw_provider", None, || async {
            let mut request = book_with_keys("up-owned");
            request["ocr"]["options"] = json!({ "raw_provider": "attacker_adapter" });
            view(jobs.create_submission(BASE_URL, &input(request)))
        })
        .await;
    recorder
        .case(&fixture, "POST /documents/:id/ocr  带 ocr.options.command", None, || async {
            view(
                crate::services::library::ocr_document_view(
                    &library,
                    &jobs,
                    "doc-up-owned",
                    document_input(json!({
                        "ocr": { "provider": "local", "options": { "command": "/bin/evil" } }
                    })),
                    BASE_URL,
                )
                .await,
            )
        })
        .await;

    // 2026-10-22 之前建的任务，请求里可能存着这些键。
    let ocr_upload = fixture.seed_upload("up-owned-ocr", "local", 1);
    failed_ocr_source(&fixture, "src-owned-ocr", &ocr_upload);
    let mut job = fixture.state.db.get_job("src-owned-ocr").unwrap();
    job.request_payload.ocr.options.insert("command".into(), json!("/bin/evil"));
    job.request_payload.ocr.options.insert("raw_provider".into(), json!("attacker_adapter"));
    fixture.state.db.save_job(&job).unwrap();
    recorder
        .case(&fixture, "POST /jobs/:id/retry-stage  ocr，源任务请求里存着 command（复制时去掉）", None, || async {
            view(jobs.retry_stage_submission(BASE_URL, "src-owned-ocr", retry("ocr", json!({}))))
        })
        .await;
    let upload = fixture.seed_upload("up-owned-book", "local", 2);
    translated_source(&fixture, "src-owned-translated", &upload);
    let mut job = fixture.state.db.get_job("src-owned-translated").unwrap();
    job.request_payload.ocr.options.insert("command".into(), json!("/bin/evil"));
    fixture.state.db.save_job(&job).unwrap();
    recorder
        .case(&fixture, "POST /jobs/:id/retry-stage  translation，overrides 带 ocr.options.command", None, || async {
            view(jobs.retry_stage_submission(
                BASE_URL,
                "src-owned-translated",
                retry("translation", json!({ "overrides": { "ocr": { "options": { "command": "/bin/evil" } } } })),
            ))
        })
        .await;
    recorder
        .case(&fixture, "POST /jobs/:id/retry-stage  render（原地），overrides 带 ocr.options.raw_provider", None, || async {
            view(jobs.retry_stage_submission(
                BASE_URL,
                "src-owned-translated",
                retry(
                    "render",
                    json!({ "create_new_job": false, "overrides": { "ocr": { "options": { "raw_provider": "x" } } } }),
                ),
            ))
        })
        .await;
    recorder
        .case(&fixture, "POST /jobs/:id/retry-stage  translation，源任务请求里存着 command（复制时去掉）", None, || async {
            view(jobs.retry_stage_submission(BASE_URL, "src-owned-translated", retry("translation", json!({}))))
        })
        .await;
    recorder
        .case(&fixture, "POST /jobs/:id/rerun  续跑（原地重渲染），源任务请求里存着 command", None, || async {
            view(jobs.rerun_submission(BASE_URL, "src-owned-translated", &json!({})))
        })
        .await;
}

#[tokio::test]
async fn submission_snapshot() {
    let mut recorder = Recorder::new();
    single_user_cases(&mut recorder).await;
    multi_user_cases(&mut recorder).await;
    server_owned_ocr_option_cases(&mut recorder).await;
    let actual = format!(
        "# 建任务各入口的结果快照（UPDATE_SUBMISSIONS=1 cargo test -p retainpdf-api --lib submissions 重新生成）\n\n{}",
        recorder.out
    );
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("docs/submissions.txt");
    if std::env::var("UPDATE_SUBMISSIONS").as_deref() == Ok("1") {
        std::fs::write(&path, &actual).unwrap();
        return;
    }
    let expected = std::fs::read_to_string(&path).unwrap_or_default();
    if expected != actual {
        let first_diff = expected
            .lines()
            .zip(actual.lines())
            .position(|(a, b)| a != b)
            .unwrap_or_else(|| expected.lines().count().min(actual.lines().count()));
        panic!(
            "建任务的结果和快照不一致（从第 {} 行起）。有意改的话重新生成：\n  UPDATE_SUBMISSIONS=1 cargo test -p retainpdf-api --lib submissions\n\n期望：{:?}\n实际：{:?}",
            first_diff + 1,
            expected.lines().nth(first_diff),
            actual.lines().nth(first_diff),
        );
    }
}
