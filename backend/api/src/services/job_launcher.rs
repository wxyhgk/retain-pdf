use std::path::Path;

use crate::db::Db;
use crate::error::AppError;
use crate::job_events::persist_job_with_resources;
use crate::config::PlatformModels;
use crate::models::domain::JobSnapshot;

use super::runtime_gateway::JobRuntimeLauncher;

#[derive(Clone)]
pub struct JobLaunchDeps<'a> {
    pub db: &'a Db,
    pub data_root: &'a Path,
    pub output_root: &'a Path,
    pub runtime: JobRuntimeLauncher,
    /// 多用户模式：所有任务改用平台的模型和 OCR（见 [`apply_platform_models`]）。单机模式为 None。
    pub platform: Option<&'a PlatformModels>,
    /// 多用户模式：新任务开跑前按页预扣（见 [`crate::services::page_quota`]）。单机模式为 false。
    pub page_quota: bool,
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
        }
    }

    pub fn with_platform(mut self, platform: Option<&'a PlatformModels>) -> Self {
        self.platform = platform;
        self
    }

    pub fn with_page_quota(mut self, enabled: bool) -> Self {
        self.page_quota = enabled;
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
    input: &mut crate::models::request::CreateJobInput,
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
    workflow: &crate::models::domain::WorkflowKind,
    artifact_job_id: &str,
    source_url: &str,
    translation: &mut crate::models::request::TranslationInput,
    ocr: &mut crate::models::request::OcrInput,
    platform: &PlatformModels,
) -> Result<(), AppError> {
    use crate::models::domain::WorkflowKind;
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

pub fn start_job_execution(
    deps: &JobLaunchDeps<'_>,
    mut job: JobSnapshot,
) -> Result<JobSnapshot, AppError> {
    if let Some(platform) = deps.platform {
        apply_platform_models(&mut job, platform)?;
    }
    // The new contract must never silently use the legacy Python transport.
    // Worker rollout is a separate, explicit gate while migration is in flight.
    if job
        .request_payload
        .translation
        .execution_connection
        .is_some()
        && (std::env::var("RETAIN_MODEL_EXECUTOR_ENABLED").as_deref() != Ok("1")
            || std::env::var("RETAIN_MODEL_WORKER_ENABLED").as_deref() != Ok("1"))
    {
        return Err(AppError::ServiceUnavailable("Rust model worker rollout is not enabled; execution_connection will not fall back to Python transport".into()));
    }
    // 所有「建任务即开跑」的入口都经过这里（内部派生的 OCR 子任务、OCR 歧义恢复不经过，正好不计费）。
    // 预扣放在落库之前：余额不够就不留下任务行。
    let reserved = deps.page_quota && crate::services::page_quota::reserve_for_job(deps.db, &job)?;
    if let Err(error) = persist_job_with_resources(deps.db, deps.data_root, deps.output_root, &job) {
        if reserved {
            crate::services::page_quota::release_for_job(deps.db, &job.job_id);
        }
        return Err(error.into());
    }
    link_new_job_to_document(deps.db, &job, None);
    deps.runtime.launch(job.job_id.clone());
    Ok(job)
}

/// 新任务归到哪本书：写 `jobs.document_id`，并把书卡（`documents.active_job_id`）指向它。
///
/// 所有「建任务即开跑」的入口都要经过这里 —— 主页卡片靠 active_job_id 找运行中任务，
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
pub(crate) fn link_new_job_to_document(db: &Db, job: &JobSnapshot, derived_from: Option<&str>) {
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
    let document_id = [Some(job.request_payload.source.artifact_job_id.as_str()), derived_from]
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
    use crate::models::domain::WorkflowKind;
    use crate::models::request::CreateJobInput;

    fn platform() -> PlatformModels {
        PlatformModels {
            translation_model: "platform-model".into(),
            translation_base_url: "https://platform.example/v1".into(),
            translation_api_protocol: String::new(),
            translation_credential_ref: "cred-translation".into(),
            ocr_provider: "mineru".into(),
            ocr_credential_ref: "cred-ocr".into(),
        }
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
