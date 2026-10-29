//! 建新任务的唯一入口 [`submit_job`]，和原地重跑已有任务的 [`relaunch_in_place`]。
//!
//! 所有"建一个新任务并开跑"的地方都走 `submit_job`：`POST /jobs`、
//! 书库的翻译和 OCR、重试、续跑、OCR 歧义恢复。下面每一步只在这里写一次：
//!
//! 1. 翻译类的新提交补开发栈的默认值（OCR 歧义恢复沿用源任务的设置，不补）；
//! 2. 多用户模式换成平台的模型和 OCR——在校验和凭据入库之前，网站账号自带的 key 不进服务器的凭据库；
//! 3. 数据目录所在磁盘剩余空间低于下限就 503（`reason` 是 `insufficient_storage`），排队任务已经满了就 429
//!    （`reason` 是 `queue_full`），再按 workflow 校验参数、建任务；
//! 4. 明文 key 导入凭据库换成引用，加使用锁，锁到落库之后；
//! 5. 落库（多用户模式按页预扣）、归到书下、发射。
//!
//! 任务运行时内部派生的 `{id}-ocr` 子任务不经这里，所以不会重复计费。

use retainpdf_api_base::disk_space::ensure_free_space;
use serde_json::Value;

use retainpdf_data::db::backup::RestoreInProgress;
use retainpdf_data::db::{NewRunWrite, PipelineDispatchRecord};
use retainpdf_api_base::error::AppError;
use retainpdf_data::job_events::{
    cas_persist_job_as_new_run_with_resources, persist_job_as_new_run_with_resources,
};
use retainpdf_core::models::domain::{JobSnapshot, JobStatusKind, WorkflowKind};
use retainpdf_core::storage_paths::plan_previous_output_pdf_move;
use crate::views::ActionBlockReason;
use retainpdf_core::models::request::CreateJobInput;
use crate::deps::JobSubmitDeps;
use crate::lifecycle::launcher::{
    apply_platform_models, apply_platform_models_to_input, link_new_job_to_document, JobLaunchDeps,
};

use super::dev_defaults::with_dev_translation_defaults;
use super::job_builders::{build_ocr_job_snapshot, build_translation_job_snapshot};
use super::ocr_credentials::{acquire_job_credential_usage_lock, secure_job_credentials};

/// 要建的新任务。
pub struct NewJob<'a> {
    input: CreateJobInput,
    derived_from: Option<&'a str>,
    document_id: Option<&'a str>,
    ocr_recovery: Option<OcrRecovery<'a>>,
}

/// OCR 请求结果不确定之后的恢复任务：和"源任务那次 OCR 已处理"写在同一个事务里，
/// 两个请求同时来只有一个能建成。不计费。
struct OcrRecovery<'a> {
    dispatch: &'a PipelineDispatchRecord,
    resolution: &'a str,
    receipt: Option<&'a Value>,
}

impl<'a> NewJob<'a> {
    pub fn new(input: CreateJobInput) -> Self {
        Self {
            input,
            derived_from: None,
            document_id: None,
            ocr_recovery: None,
        }
    }

    /// 从哪个任务派生出来的（OCR 重试只带 upload_id、不带 artifact_job_id）：
    /// 按上传归不到书时，归属从这个任务继承。
    pub(crate) fn derived_from(mut self, job_id: &'a str) -> Self {
        self.derived_from = Some(job_id);
        self
    }

    /// 书库发起的提交：建完要确认任务确实归到了这本书下。
    pub(crate) fn for_document(mut self, document_id: &'a str) -> Self {
        self.document_id = Some(document_id);
        self
    }

    /// OCR 歧义恢复。`resolution` 是处理方式，`receipt` 是绑定的已有回执。
    pub(crate) fn resolving_ocr_ambiguity(
        mut self,
        dispatch: &'a PipelineDispatchRecord,
        resolution: &'a str,
        receipt: Option<&'a Value>,
    ) -> Self {
        self.ocr_recovery = Some(OcrRecovery {
            dispatch,
            resolution,
            receipt,
        });
        self
    }
}

/// 对外入口（`POST /jobs`、书库的翻译和 OCR）收到的请求，
/// 不许带 `runtime.job_id`：任务编号由服务器分配。落库是 upsert，客户端自己指定编号
/// 会覆盖已有任务，带 `..` 还会在输出目录外建目录。
/// 重试、续跑这些内部提交自己清空这个字段，不经这里。
pub fn reject_client_job_id(request: &CreateJobInput) -> Result<(), AppError> {
    if request.runtime.job_id.trim().is_empty() {
        return Ok(());
    }
    Err(AppError::bad_request(
        "runtime.job_id is set by the server; do not send it",
    ))
}

/// 任务编号只许 `[A-Za-z0-9_-]{1,128}`（服务器生成的是 `<时间戳>-<6 位十六进制>`）。
fn is_valid_job_id(job_id: &str) -> bool {
    (1..=128).contains(&job_id.len())
        && job_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}

/// 建新任务并开跑。见模块说明。
pub fn submit_job(deps: &JobSubmitDeps<'_>, new: NewJob<'_>) -> Result<JobSnapshot, AppError> {
    let NewJob {
        mut input,
        derived_from,
        document_id,
        ocr_recovery,
    } = new;
    // 恢复备份期间不建：建出来的行会被换库盖掉，任务目录却留着。守卫拿到落库完（见 `Db::hold_off_restore`）。
    let _no_restore = deps.launcher.db.hold_off_restore().map_err(restore_in_progress)?;
    // 兜底：调用方指定了编号的话，必须合法、且库里还没有（落库是 upsert，重名会整行覆盖）。
    // 放在建任务目录之前，拒绝时不留副作用；没指定的由 ResolvedJobSpec 生成合法编号。
    let requested_job_id = input.runtime.job_id.trim();
    if !requested_job_id.is_empty() {
        if !is_valid_job_id(requested_job_id) {
            return Err(AppError::bad_request(
                "job id may only contain letters, digits, '_' and '-' (1-128 characters)",
            ));
        }
        if deps.launcher.db.get_job(requested_job_id).is_ok() {
            return Err(AppError::conflict(format!(
                "job already exists: {requested_job_id}"
            )));
        }
    }
    let ocr_only = matches!(input.workflow, WorkflowKind::Ocr);
    if !ocr_only && ocr_recovery.is_none() {
        input = with_dev_translation_defaults(&input);
    }
    if let Some(source) = deps.launcher.platform {
        apply_platform_models_to_input(&mut input, &source.resolve()?)?;
    }
    // 建任务目录、落库之前：磁盘快满了、排队的已经满了就不接新任务（已经在跑的不管）。
    ensure_free_space(deps.launcher.data_root, deps.launcher.min_free_disk_bytes, "create a job")?;
    ensure_queue_room(&deps.launcher)?;

    let job = if ocr_only {
        build_ocr_job_snapshot(&deps.snapshot, &input, None)?
    } else {
        build_translation_job_snapshot(&deps.snapshot, &input)?
    };
    let job = secure_job_credentials(deps, job)?;
    let _credential_guard = acquire_job_credential_usage_lock(deps, &job)?;

    let job = match ocr_recovery {
        None => persist_and_launch(&deps.launcher, job, derived_from, None)?,
        Some(recovery) => persist_ocr_recovery(&deps.launcher, job, recovery)?,
    };
    if let Some(document_id) = document_id {
        if deps.launcher.db.document_id_for_job(&job.job_id)?.as_deref() != Some(document_id) {
            return Err(AppError::internal(format!(
                "job {} was not bound to document {document_id}",
                job.job_id
            )));
        }
    }
    Ok(job)
}

/// 原地重跑之前读到的那一行：状态和运行代次。[`relaunch_in_place`] 只在库里还是这样时才写。
///
/// 在把快照改成 queued 之前取（`RunFence::of(&读到的任务)`）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunFence {
    status: JobStatusKind,
    run_generation: u64,
}

impl RunFence {
    pub fn of(job: &JobSnapshot) -> Self {
        Self {
            status: job.status.clone(),
            run_generation: job.run_generation,
        }
    }
}

/// 原地重跑已有任务（续跑出的重渲染、原地重渲染、原地精修）：任务编号不变，重新落库并发射。
/// 新任务一律走 [`submit_job`]，这里不接没落过库的任务。
///
/// 落库是 CAS：只有库里还是 `read_as` 记下的终态和代次才写（两个请求读到同一个终态，只有先来的
/// 那个开跑；后来的 409，不把已经开跑的那一次盖回 queued）。拒绝时（503、额度、409……）什么都没动：
/// 上一份 PDF、`-ocr` 子任务都原样留着。落库成功之后、发射之前，把上一份译文 PDF 挪到渲染不会写的
/// 名字（见 `storage_paths::plan_previous_output_pdf_move`）。调用方要做的清理放在这个函数返回 Ok 之后。
pub fn relaunch_in_place(
    deps: &JobLaunchDeps<'_>,
    job: JobSnapshot,
    read_as: &RunFence,
) -> Result<JobSnapshot, AppError> {
    if deps.db.get_job(&job.job_id).is_err() {
        return Err(AppError::internal(format!(
            "relaunch_in_place only re-runs an existing job; {} is new — submit it with submit_job",
            job.job_id
        )));
    }
    if matches!(read_as.status, JobStatusKind::Queued | JobStatusKind::Running) {
        return Err(ActionBlockReason::JobActive.conflict(
            "job is already queued or running; cancel it before rerunning it in place",
        ));
    }
    // 拒绝时什么都没动（见上），所以放在挪旧 PDF、落库之前。
    let _no_restore = deps.db.hold_off_restore().map_err(restore_in_progress)?;
    ensure_free_space(deps.data_root, deps.min_free_disk_bytes, "rerun this job")?;
    ensure_queue_room(deps)?;
    persist_and_launch(deps, job, None, Some(read_as))
}

/// 正在恢复备份：409 `restore_in_progress`。
fn restore_in_progress(refusal: RestoreInProgress) -> AppError {
    AppError::conflict_because(RestoreInProgress::REASON, refusal.to_string())
}

/// 排队满了时 429 的 `error.details.reason`。
pub const QUEUE_FULL: &str = "queue_full";

/// 排队（还没开跑）的任务已经有 `max_queued_jobs` 个了就 429。数的是库里的 queued 行，进程内和 jobsd 两种模式一样；
/// 两个请求同时数到差一个满，会一起进去，多出一两个不要紧，这是挡跑飞的脚本，不是精确配额。
fn ensure_queue_room(deps: &JobLaunchDeps<'_>) -> Result<(), AppError> {
    if deps.max_queued_jobs == 0 {
        return Ok(());
    }
    let queued = deps.db.count_jobs_with_status(&JobStatusKind::Queued)?;
    if u64::try_from(queued).unwrap_or(0) >= deps.max_queued_jobs {
        tracing::warn!(queued, max = deps.max_queued_jobs, "refusing a new job run: the queue is full");
        return Err(AppError::too_many_requests_because(
            QUEUE_FULL,
            format!(
                "{queued} jobs are already waiting to run (limit {}); try again after some of them start",
                deps.max_queued_jobs
            ),
        ));
    }
    Ok(())
}

fn persist_and_launch(
    deps: &JobLaunchDeps<'_>,
    mut job: JobSnapshot,
    derived_from: Option<&str>,
    in_place: Option<&RunFence>,
) -> Result<JobSnapshot, AppError> {
    if let Some(source) = deps.platform {
        apply_platform_models(&mut job, &source.resolve()?)?;
    }
    // The new contract must never silently use the legacy Python transport.
    // Worker rollout is a separate, explicit gate while migration is in flight.
    if job.uses_model_executor()
        && (std::env::var("RETAIN_MODEL_EXECUTOR_ENABLED").as_deref() != Ok("1")
            || std::env::var("RETAIN_MODEL_WORKER_ENABLED").as_deref() != Ok("1"))
    {
        return Err(AppError::ServiceUnavailable("Rust model worker rollout is not enabled; execution_connection will not fall back to Python transport".into()));
    }
    let previous_pdf_move = in_place
        .and_then(|_| plan_previous_output_pdf_move(&mut job, deps.data_root, deps.output_root));
    // 预扣放在落库之前：余额不够就不留下任务行。原地重跑也经过这里（只重新渲染不计费，
    // 规则见 accounts::page_quota）。
    let reserved = deps.page_quota && retainpdf_accounts::reserve_for_job(deps.db, &job)?;
    // 落库同时把运行代次加一：此后上一次运行遗留的 driver（取消后还在收尾的、成功后还在善后的）
    // 写不进这一次运行的行，也占不住这一次的发射。
    let persisted = match in_place {
        None => persist_job_as_new_run_with_resources(deps.db, deps.data_root, deps.output_root, &job)
            .map_err(AppError::from),
        Some(fence) => match cas_persist_job_as_new_run_with_resources(
            deps.db,
            deps.data_root,
            deps.output_root,
            &job,
            &fence.status,
            fence.run_generation,
        ) {
            Ok(Ok(persisted)) => Ok(persisted),
            Ok(Err(refused)) => Err(relaunch_refused(&job.job_id, refused)),
            Err(error) => Err(error.into()),
        },
    };
    match persisted {
        Ok(persisted) => job = persisted,
        Err(error) => {
            if reserved {
                retainpdf_accounts::release_for_job(deps.db, &job.job_id);
            }
            return Err(error);
        }
    }
    if let Some(planned) = previous_pdf_move {
        // 挪不成（文件刚被删了之类）只是排队期间读不到上一份，不影响这一次运行。
        if let Err(error) = planned.apply() {
            tracing::warn!(
                "job {}: could not move the previous output pdf aside: {error}",
                job.job_id
            );
        }
    }
    link_new_job_to_document(deps.db, &job, derived_from);
    deps.runtime.launch(job.job_id.clone());
    Ok(job)
}

/// 原地重跑的 CAS 没写进去。还在排队 / 在跑：别的请求先开跑了（`job_active`）；
/// 又是终态但不是读到的那一次：读到的已经过期，刷新再试（`stale_resolution`）。
fn relaunch_refused(job_id: &str, refused: NewRunWrite) -> AppError {
    match refused {
        NewRunWrite::Missing => AppError::not_found(format!("job not found: {job_id}")),
        NewRunWrite::Changed {
            current_status: Some(JobStatusKind::Queued | JobStatusKind::Running),
            ..
        } => ActionBlockReason::JobActive.conflict(
            "job was started by another request; cancel it before rerunning it in place",
        ),
        _ => ActionBlockReason::StaleResolution.conflict(
            "job changed after it was read (another run started or finished); reload it and retry",
        ),
    }
}

fn persist_ocr_recovery(
    deps: &JobLaunchDeps<'_>,
    job: JobSnapshot,
    recovery: OcrRecovery<'_>,
) -> Result<JobSnapshot, AppError> {
    if !deps
        .db
        .create_ocr_recovery_job_state(recovery.dispatch, &job, recovery.resolution, recovery.receipt)?
    {
        return Err(ActionBlockReason::StaleResolution.conflict(
            "OCR ambiguity was already resolved by another request",
        ));
    }
    // 恢复任务只带 upload_id，upload 没有 content_hash 时按发生歧义的源任务继承归属。
    link_new_job_to_document(deps.db, &job, Some(&recovery.dispatch.job_id));
    deps.runtime.launch(job.job_id.clone());
    Ok(job)
}
