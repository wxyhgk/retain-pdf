use std::path::Path;

use retainpdf_data::db::Db;
use retainpdf_api_base::error::AppError;
use retainpdf_core::config::PlatformModels;
use retainpdf_core::models::domain::JobSnapshot;
use retainpdf_accounts::PlatformSource;

use crate::runtime_gateway::JobRuntimeLauncher;

#[derive(Clone)]
pub struct JobLaunchDeps<'a> {
    pub db: &'a Db,
    pub data_root: &'a Path,
    pub output_root: &'a Path,
    pub runtime: JobRuntimeLauncher,
    /// 多用户模式：所有任务改用平台的模型和 OCR（见 [`apply_platform_models`]），建任务时现读，
    /// 管理后台改了下一个任务就生效。单机模式为 None。
    pub platform: Option<PlatformSource<'a>>,
    /// 多用户模式：新任务开跑前按页预扣（见 [`retainpdf_accounts::page_quota`]）。单机模式为 false。
    pub page_quota: bool,
    /// 数据目录所在磁盘至少留多少空间（字节）才接新任务、原地重跑；0 是不查（`RUST_API_MIN_FREE_DISK_MB`）。
    pub min_free_disk_bytes: u64,
    /// 排队任务到这么多就不接新任务、不原地重跑（`RUST_API_MAX_QUEUED_JOBS`）；0 是不限。
    pub max_queued_jobs: u64,
}

impl<'a> JobLaunchDeps<'a> {
    pub fn new(
        db: &'a Db,
        data_root: &'a Path,
        output_root: &'a Path,
        runtime: JobRuntimeLauncher,
    ) -> Self {
        Self {
            db,
            data_root,
            output_root,
            runtime,
            platform: None,
            page_quota: false,
            min_free_disk_bytes: 0,
            max_queued_jobs: 0,
        }
    }

    pub fn with_platform(mut self, platform: Option<PlatformSource<'a>>) -> Self {
        self.platform = platform;
        self
    }

    pub fn with_page_quota(mut self, enabled: bool) -> Self {
        self.page_quota = enabled;
        self
    }

    pub fn with_min_free_disk(mut self, bytes: u64) -> Self {
        self.min_free_disk_bytes = bytes;
        self
    }

    pub fn with_max_queued_jobs(mut self, max: u64) -> Self {
        self.max_queued_jobs = max;
        self
    }
}

/// 多用户模式下，任务一律用平台的模型、地址、凭据和 OCR；客户端带来的密钥、模型、地址、
/// 审校模型、执行器连接、OCR 令牌和接口地址全部丢掉（平台出钱，也防止拿平台的钥匙去打
/// 用户指定的地址）。凭据不在请求里：管理员事先经凭据接口存好，这里只填编号。
pub(crate) fn apply_platform_models(job: &mut JobSnapshot, platform: &PlatformModels) -> Result<(), AppError> {
    let request = &mut job.request_payload;
    apply_platform_models_to(
        &request.workflow,
        &request.source.artifact_job_id,
        &request.source.source_url,
        &mut request.translation,
        &mut request.ocr,
        platform,
    )
}

/// 同上，作用在请求上：要在建任务、校验参数之前换（否则会先因为「缺 OCR 令牌」被拒）。
pub(crate) fn apply_platform_models_to_input(
    input: &mut retainpdf_core::models::request::CreateJobInput,
    platform: &PlatformModels,
) -> Result<(), AppError> {
    apply_platform_models_to(
        &input.workflow,
        &input.source.artifact_job_id,
        &input.source.source_url,
        &mut input.translation,
        &mut input.ocr,
        platform,
    )
}

fn apply_platform_models_to(
    workflow: &retainpdf_core::models::domain::WorkflowKind,
    artifact_job_id: &str,
    source_url: &str,
    translation: &mut retainpdf_core::models::request::TranslationInput,
    ocr: &mut retainpdf_core::models::request::OcrInput,
    platform: &PlatformModels,
) -> Result<(), AppError> {
    use retainpdf_core::models::domain::WorkflowKind;
    let translates = matches!(workflow, WorkflowKind::Book | WorkflowKind::Translate);
    let runs_ocr = match workflow {
        WorkflowKind::Ocr => true,
        WorkflowKind::Book | WorkflowKind::Translate => artifact_job_id.trim().is_empty(),
        WorkflowKind::Render => false,
    };
    if !source_url.trim().is_empty() {
        return Err(AppError::bad_request("多用户模式下只能从上传的文件建任务"));
    }
    translation.api_key.clear();
    translation.reviewer_api_key.clear();
    translation.reviewer_credential_ref.clear();
    translation.reviewer_model.clear();
    translation.reviewer_base_url.clear();
    translation.reviewer_api_protocol.clear();
    translation.execution_connection = None;
    translation.model = platform.translation_model.clone();
    translation.base_url = platform.translation_base_url.clone();
    translation.api_protocol = platform.translation_api_protocol.clone();
    // 思考深度由平台定；平台留空 =「用默认」，要换成任务的默认值，而不是空串（任务校验不收空串）。
    translation.thinking = if platform.translation_thinking.trim().is_empty() {
        retainpdf_core::models::request::TranslationInput::default().thinking
    } else {
        platform.translation_thinking.clone()
    };
    translation.reviewer_thinking.clear();
    if platform.translation_max_workers > 0
        && (translation.workers <= 0 || translation.workers > platform.translation_max_workers)
    {
        translation.workers = platform.translation_max_workers;
    }
    translation.credential_ref = platform.translation_credential_ref.clone();
    if translates && !platform.translation_ready() {
        return Err(AppError::ServiceUnavailable("平台还没配置翻译模型，请联系管理员".into()));
    }
    ocr.mineru_token.clear();
    ocr.paddle_token.clear();
    ocr.paddle_api_url.clear();
    ocr.options.clear();
    ocr.provider = platform.ocr_provider.clone();
    ocr.credential_ref = platform.ocr_credential_ref.clone();
    if runs_ocr && !platform.ocr_ready() {
        return Err(AppError::ServiceUnavailable("平台还没配置 OCR，请联系管理员".into()));
    }
    Ok(())
}

/// 新任务归到哪本书：写 `jobs.document_id`，并把书卡（`documents.active_job_id`）指向它。
///
/// 建任务的唯一入口（creation::submit_job）落库后调它 —— 主页卡片靠 active_job_id 找运行中任务，
/// 「这本书的任务」（list_jobs_for_document / 阅读页的打开计划 / 全文索引 / 删书级联）
/// 靠 jobs.document_id。以前只有带 upload_id 的任务在这里关联；重新渲染、重试、继续/重跑
/// 这些从已有任务派生出来的任务只带 `source.artifact_job_id`，各入口各补一半（有的只改
/// 书卡、没写归属），没补到的要等重启回填才出现在这本书下。
///
/// 规则：先按 upload_id（经 uploads.content_hash）关联；查不到再沿 artifact_job_id 继承源任务的
/// 归属（源任务的 jobs.document_id，退回它 upload 的 content_hash）；还查不到、而调用方知道它是
/// 从哪个任务派生的（`derived_from`：OCR 重试只带 upload_id / source_url、不带 artifact_job_id），
/// 再按那个任务继承。
///
/// 尽力而为：失败只记日志，绝不影响提交；终态 lifecycle 还会再对账一次。
pub(crate) fn link_new_job_to_document(db: &Db, job: &JobSnapshot, derived_from: Option<&str>, version: VersionLink<'_>) {
    // 归属：插入时触发器已按上传 / source.artifact_job_id 继承；只有调用方知道的源任务在这里补。
    if let Some(from) = derived_from.map(str::trim).filter(|from| !from.is_empty()) {
        if let Err(error) = db.inherit_job_owner(&job.job_id, from) {
            tracing::warn!("accounts: inherit owner for job {} from {from} failed: {error}", job.job_id);
        }
    }
    let Some(document_id) = resolve_new_job_document(db, job, derived_from) else {
        return;
    };
    if let Err(error) = db.set_document_active_job(&document_id, &job.job_id, None) {
        tracing::warn!("library: set active job for {document_id} at submit failed: {error}");
    }
    if let Err(error) = link_translation_version(db, &document_id, job, derived_from, version) {
        tracing::warn!("library: translation version for job {} failed: {error}", job.job_id);
    }
}

/// 新任务属于哪个译文版本（v30，规则见迁移 `v30_translation_versions.sql`）。
#[derive(Debug, Clone, Copy, Default)]
pub enum VersionLink<'a> {
    /// 按任务自己判断：OCR 任务不是版本；重新排版（render）加进来源任务的版本；
    /// 翻译（book / translate）开一个新版本，来源任务有版本的话就是它的来源版本（只翻一部分页时其余页沿用它）。
    #[default]
    Auto,
    /// 续跑、OCR 恢复：和这个任务是同一份译文，加进它的版本。
    JoinVersionOf(&'a str),
    /// 加进已有的版本（书库整本翻译拆成几段：后几段加进第一段的版本）。
    Existing(&'a str),
    /// 开新版本并指定来源版本（书库只翻一部分页时，其余页沿用用户正在看的版本）。
    New { base: Option<&'a str>, origin: &'a str },
}

fn link_translation_version(
    db: &Db,
    document_id: &str,
    job: &JobSnapshot,
    derived_from: Option<&str>,
    version: VersionLink<'_>,
) -> anyhow::Result<()> {
    use retainpdf_core::models::domain::WorkflowKind;
    // 原地重跑走的也是这里：已经在某个版本里的任务不动
    if db.translation_version_of_job(&job.job_id)?.is_some() {
        return Ok(());
    }
    let source = job.source_job_id().or(derived_from).map(str::trim).filter(|id| !id.is_empty());
    let source_version = |source: Option<&str>| -> anyhow::Result<Option<String>> {
        Ok(match source {
            Some(source) => db.translation_version_of_job(source)?,
            None => None,
        })
    };
    let version_id = match version {
        VersionLink::Existing(version_id) => Some(version_id.to_string()),
        VersionLink::New { base, origin } => Some(db.create_translation_version(document_id, base, origin)?),
        VersionLink::JoinVersionOf(from) => match source_version(Some(from))? {
            Some(version_id) => Some(version_id),
            None if job.workflow == WorkflowKind::Ocr => None,
            None => Some(db.create_translation_version(document_id, None, "translate")?),
        },
        VersionLink::Auto => match job.workflow {
            WorkflowKind::Ocr => None,
            WorkflowKind::Render => source_version(source)?,
            WorkflowKind::Book | WorkflowKind::Translate => {
                let base = source_version(source)?;
                let origin = if source.is_some() { "retranslate" } else { "translate" };
                Some(db.create_translation_version(document_id, base.as_deref(), origin)?)
            }
        },
    };
    if let Some(version_id) = version_id {
        db.add_job_to_translation_version(&version_id, &job.job_id)?;
    }
    Ok(())
}

fn resolve_new_job_document(
    db: &Db,
    job: &JobSnapshot,
    derived_from: Option<&str>,
) -> Option<String> {
    if let Some(upload_id) = job.upload_id.as_deref().filter(|id| !id.is_empty()) {
        match db.link_job_to_document(&job.job_id, upload_id) {
            Ok(Some(document_id)) => return Some(document_id),
            Ok(None) => {}
            Err(error) => tracing::warn!(
                "library: link job {} to document at submit failed: {error}",
                job.job_id
            ),
        }
    }
    let document_id = [job.source_job_id(), derived_from]
        .into_iter()
        .flatten()
        .map(str::trim)
        .filter(|source| !source.is_empty())
        .find_map(|source| document_of_job(db, source))?;
    if let Err(error) = db.set_job_document_id(&job.job_id, &document_id) {
        tracing::warn!(
            "library: link job {} to {document_id} at submit failed: {error}",
            job.job_id
        );
        return None;
    }
    Some(document_id)
}

/// 源任务归属的书：jobs.document_id，退回它 upload 的 content_hash。
fn document_of_job(db: &Db, job_id: &str) -> Option<String> {
    match db.document_id_for_job(job_id) {
        Ok(Some(document_id)) => Some(document_id),
        Ok(None) | Err(_) => match db.get_document_by_job_id(job_id) {
            Ok(document) => document.map(|document| document.document_id),
            Err(error) => {
                tracing::warn!("library: resolve document for source job {job_id} failed: {error}");
                None
            }
        },
    }
}

#[cfg(test)]
mod platform_tests {
    use super::*;
    use retainpdf_core::models::domain::WorkflowKind;
    use retainpdf_core::models::request::CreateJobInput;

    fn platform() -> PlatformModels {
        PlatformModels {
            translation_model: "platform-model".into(),
            translation_base_url: "https://platform.example/v1".into(),
            translation_api_protocol: String::new(),
            translation_thinking: "low".into(),
            translation_max_workers: 4,
            translation_credential_ref: "cred-translation".into(),
            ocr_provider: "mineru".into(),
            ocr_credential_ref: "cred-ocr".into(),
        }
    }

    #[test]
    fn thinking_is_set_by_the_platform_and_workers_are_capped() {
        for (asked, expected) in [(0, 4), (2, 2), (16, 4)] {
            let mut input = CreateJobInput::default();
            input.workflow = WorkflowKind::Book;
            input.translation.thinking = "max".into();
            input.translation.workers = asked;
            apply_platform_models_to_input(&mut input, &platform()).unwrap();
            assert_eq!((input.translation.thinking.as_str(), input.translation.workers), ("low", expected), "{asked}");
        }
        let mut uncapped = platform();
        uncapped.translation_max_workers = 0;
        let mut input = CreateJobInput::default();
        input.workflow = WorkflowKind::Book;
        input.translation.workers = 16;
        apply_platform_models_to_input(&mut input, &uncapped).unwrap();
        assert_eq!(input.translation.workers, 16, "0 = 不限");
    }

    #[test]
    fn empty_platform_thinking_means_the_job_default_not_an_empty_string() {
        let mut platform = platform();
        platform.translation_thinking.clear();
        let mut input = CreateJobInput::default();
        input.workflow = WorkflowKind::Book;
        input.translation.thinking = "max".into();
        apply_platform_models_to_input(&mut input, &platform).unwrap();
        assert_eq!(input.translation.thinking, retainpdf_core::models::request::TranslationInput::default().thinking);
    }

    #[test]
    fn client_models_keys_and_urls_are_replaced_by_the_platform() {
        let mut input = CreateJobInput::default();
        input.workflow = WorkflowKind::Book;
        input.translation.api_key = "user-key".into();
        input.translation.model = "user-model".into();
        input.translation.base_url = "https://attacker.example".into();
        input.translation.reviewer_api_key = "user-reviewer-key".into();
        input.translation.reviewer_base_url = "https://attacker.example".into();
        input.ocr.provider = "paddle".into();
        input.ocr.paddle_token = "user-token".into();
        input.ocr.paddle_api_url = "https://attacker.example".into();
        apply_platform_models_to_input(&mut input, &platform()).unwrap();
        let t = &input.translation;
        assert_eq!(
            (t.api_key.as_str(), t.model.as_str(), t.base_url.as_str(), t.credential_ref.as_str()),
            ("", "platform-model", "https://platform.example/v1", "cred-translation")
        );
        assert!(t.reviewer_api_key.is_empty() && t.reviewer_base_url.is_empty());
        let o = &input.ocr;
        assert_eq!((o.provider.as_str(), o.credential_ref.as_str()), ("mineru", "cred-ocr"));
        assert!(o.paddle_token.is_empty() && o.paddle_api_url.is_empty());
    }

    /// 翻译 agent 三种接口协议都能用（2026-11-18 起），平台模型是哪种协议都不把 engine 退回 legacy。
    #[test]
    fn agent_engine_survives_every_platform_protocol() {
        for protocol in ["", "openai", "openai_responses", "anthropic"] {
            let mut platform = platform();
            platform.translation_api_protocol = protocol.into();
            let mut input = CreateJobInput::default();
            input.workflow = WorkflowKind::Book;
            input.translation.engine = "agent".into();
            apply_platform_models_to_input(&mut input, &platform).unwrap();
            assert_eq!(input.translation.engine, "agent", "{protocol:?}");
        }
    }

    #[test]
    fn url_sources_and_missing_platform_settings_are_refused() {
        let mut input = CreateJobInput::default();
        input.workflow = WorkflowKind::Book;
        input.source.source_url = "http://169.254.169.254/latest".into();
        assert!(matches!(apply_platform_models_to_input(&mut input, &platform()), Err(AppError::BadRequest(_))));
        let mut input = CreateJobInput::default();
        input.workflow = WorkflowKind::Render;
        // 只重新渲染：不翻译不 OCR，平台没配也能跑。
        apply_platform_models_to_input(&mut input, &PlatformModels::default()).unwrap();
    }
}

#[cfg(test)]
mod version_tests {
    use super::*;
    use retainpdf_core::models::domain::{now_iso, JobSnapshot, UploadRecord, WorkflowKind};
    use retainpdf_core::models::request::CreateJobInput;

    struct Fixture {
        root: std::path::PathBuf,
        db: Db,
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.root);
        }
    }

    fn fixture() -> Fixture {
        let root = std::env::temp_dir().join(format!("jobs-version-link-{:016x}", fastrand::u64(..)));
        std::fs::create_dir_all(&root).unwrap();
        let db = Db::new(root.join("jobs.db"), root.clone());
        db.init().unwrap();
        let upload = UploadRecord {
            upload_id: "up-book".into(),
            filename: "book.pdf".into(),
            stored_path: "uploads/up-book/book.pdf".into(),
            bytes: 10,
            page_count: 3,
            uploaded_at: now_iso(),
            developer_mode: false,
            content_hash: "doc-book".into(),
        };
        db.save_upload(&upload).unwrap();
        db.upsert_document_from_upload(&upload).unwrap();
        Fixture { root, db }
    }

    /// 存一个任务并像提交时那样关联到书、挂进版本。
    fn submit(db: &Db, job_id: &str, workflow: WorkflowKind, source: &str, link: VersionLink<'_>) -> JobSnapshot {
        let mut input = CreateJobInput::default();
        input.workflow = workflow.clone();
        if source.is_empty() {
            input.source.upload_id = "up-book".into();
        } else {
            input.source.artifact_job_id = source.into();
        }
        let mut job = JobSnapshot::new(job_id.to_string(), input, vec![]);
        job.workflow = workflow;
        db.save_job(&job).unwrap();
        link_new_job_to_document(db, &job, None, link);
        job
    }

    #[test]
    fn new_jobs_get_the_version_their_kind_calls_for() {
        let f = fixture();
        let db = &f.db;
        submit(db, "ocr", WorkflowKind::Ocr, "", VersionLink::Auto);
        assert_eq!(db.translation_version_of_job("ocr").unwrap(), None, "OCR jobs are not translations");

        submit(db, "whole", WorkflowKind::Book, "", VersionLink::Auto);
        let whole = db.translation_version_of_job("whole").unwrap().expect("a fresh translation opens a version");
        assert_eq!(db.get_translation_version(&whole).unwrap().unwrap().origin, "translate");

        submit(db, "relayout", WorkflowKind::Render, "whole", VersionLink::Auto);
        assert_eq!(db.translation_version_of_job("relayout").unwrap().as_deref(), Some(whole.as_str()), "re-layout joins its source");

        submit(db, "resume", WorkflowKind::Book, "whole", VersionLink::JoinVersionOf("whole"));
        assert_eq!(db.translation_version_of_job("resume").unwrap().as_deref(), Some(whole.as_str()), "resume continues the same translation");

        submit(db, "retranslate", WorkflowKind::Book, "whole", VersionLink::Auto);
        let retranslated = db.get_translation_version(&db.translation_version_of_job("retranslate").unwrap().unwrap()).unwrap().unwrap();
        assert_ne!(retranslated.version_id, whole);
        assert_eq!((retranslated.origin.as_str(), retranslated.base_version_id.as_deref()), ("retranslate", Some(whole.as_str())));

        // 书库只翻一部分页：指定来源版本；拆成几段的后几段加进同一个版本
        submit(db, "seg-1", WorkflowKind::Translate, "ocr", VersionLink::New { base: Some(&whole), origin: "translate" });
        let segments = db.translation_version_of_job("seg-1").unwrap().unwrap();
        submit(db, "seg-2", WorkflowKind::Translate, "ocr", VersionLink::Existing(&segments));
        let record = db.get_translation_version(&segments).unwrap().unwrap();
        assert_eq!((record.job_ids.len(), record.base_version_id.as_deref()), (2, Some(whole.as_str())));

        // 原地重跑走同一个入口：已经在版本里的不动
        let job = db.get_job("whole").unwrap();
        link_new_job_to_document(db, &job, None, VersionLink::Auto);
        assert_eq!(db.translation_version_of_job("whole").unwrap().as_deref(), Some(whole.as_str()));
        assert_eq!(db.list_translation_versions("doc-book", false).unwrap().len(), 3);
    }
}
