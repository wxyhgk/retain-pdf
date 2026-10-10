//! 按页额度（多用户模式）。
//!
//! 规则（2026-10 内测版定下的）：
//! - 计费单位是用户一次提交实际选中的页数。内部派生的 `{id}-ocr` 子任务不经 start_job_execution，
//!   不会重复计；文档翻译拆成几段时每段只算自己那几页。
//! - 提交时预扣，余额不够直接拒绝；失败、取消、被删全额退回——退回由数据库触发器做
//!   （见 db/schema/migrations/v23_page_quota.sql），终态无论谁写都退得到。
//! - 纯 OCR 和翻译各算一次。
//! - 只重新渲染（含精修）不计费。例外：源任务失败退过款、再用渲染把它做完的，补扣原来的页数——
//!   否则「失败全额退 + 渲染免费」就成了白拿一份完整译文。
//! - 管理员不限额；单机模式、内部服务建的任务（归属 local）不计费。

use std::collections::BTreeSet;

use axum::http::StatusCode;
use serde::Serialize;
use serde_json::json;

use crate::config::LOCAL_USER_ID;
use crate::db::{Db, PageBalanceWouldGoNegative, PageLedgerEntry, PageReservation};
use crate::error::AppError;
use crate::job_runner::parse_page_ranges;
use crate::models::domain::{JobSnapshot, ResolvedJobSpec, WorkflowKind};
use crate::models::now_iso;

/// 账户页、管理员查看时列出的最近账目条数。
pub const LEDGER_VIEW_LIMIT: usize = 50;
/// 管理员一次发放 / 扣减的上限，防手滑多打几个零。
pub const MAX_GRANT_PAGES: i64 = 1_000_000;
const MAX_NOTE_CHARS: usize = 200;

fn db_error(error: anyhow::Error) -> AppError {
    AppError::internal(format!("page quota storage failed: {error:#}"))
}

/// 这个任务按页算是几页。`document_pages` 是源 PDF 的总页数。
///
/// OCR 先按 `ocr.page_ranges` 选页；翻译再在 OCR 的结果里按 `translation.page_ranges`（文档页号）
/// 或 `start_page..=end_page`（OCR 结果里的序号，从 0 起，-1 = 到最后）选。翻译的页数不会超过
/// OCR 的页数。选页写错的照常算（至少 1 页）：任务会失败，失败就全额退。
pub fn billable_pages(spec: &ResolvedJobSpec, document_pages: u32) -> u32 {
    if document_pages == 0 {
        return 0;
    }
    let ocr_pages = parse_page_ranges(&spec.ocr.page_ranges, document_pages)
        .map(|pages| pages.len() as u32)
        .unwrap_or(document_pages);
    match spec.workflow {
        WorkflowKind::Render => 0,
        WorkflowKind::Ocr => ocr_pages,
        WorkflowKind::Book | WorkflowKind::Translate => {
            let translation = &spec.translation;
            let selected = if !translation.page_ranges.is_empty() {
                translation
                    .page_ranges
                    .iter()
                    .filter(|page| (1..=document_pages).contains(*page))
                    .collect::<BTreeSet<_>>()
                    .len() as u32
            } else {
                let start = translation.start_page.max(0) as u32;
                let end = if translation.end_page < 0 {
                    ocr_pages.saturating_sub(1)
                } else {
                    translation.end_page as u32
                };
                if start > end {
                    0
                } else {
                    end - start + 1
                }
            };
            selected.min(ocr_pages).max(1)
        }
    }
}

fn quota_exceeded(required: i64, balance: i64) -> AppError {
    AppError::account(
        StatusCode::PAYMENT_REQUIRED,
        "PAGE_QUOTA_EXCEEDED",
        format!("页数额度不够：这次要 {required} 页，还剩 {balance} 页，请联系管理员"),
        json!({ "required_pages": required, "balance": balance }),
    )
}

/// 新任务开跑前预扣。返回 true 表示这次扣上了（提交没成要调 [`release_for_job`] 退回）；
/// false 表示不用扣（不计费的任务、不计费的人，或者这个任务早就扣过）。
pub(crate) fn reserve_for_job(db: &Db, job: &JobSnapshot) -> Result<bool, AppError> {
    let spec = &job.request_payload;
    let Some(source) = db
        .billing_source(&spec.source.upload_id, &spec.source.artifact_job_id)
        .map_err(db_error)?
    else {
        // 找不到上传（多用户下网站账号不能从网址建任务），没法定价也没人可记。
        return Ok(false);
    };
    if source.owner_user_id == LOCAL_USER_ID {
        return Ok(false);
    }
    match db.get_user(&source.owner_user_id).map_err(db_error)? {
        Some(user) if user.role != "admin" => {}
        _ => return Ok(false),
    }
    let pages = if spec.workflow == WorkflowKind::Render {
        // 原地重新渲染时 artifact_job_id 就是它自己。
        match db
            .page_charge(&spec.source.artifact_job_id)
            .map_err(db_error)?
        {
            Some(charge) if charge.status == "refunded" => charge.pages,
            _ => return Ok(false),
        }
    } else {
        i64::from(billable_pages(spec, source.page_count))
    };
    if pages <= 0 {
        return Ok(false);
    }
    match db
        .reserve_job_pages(&job.job_id, &source.owner_user_id, pages, &now_iso())
        .map_err(db_error)?
    {
        PageReservation::Reserved { .. } => Ok(true),
        PageReservation::AlreadyCharged => Ok(false),
        PageReservation::Insufficient { balance } => Err(quota_exceeded(pages, balance)),
    }
}

/// 预扣之后提交没成：退回。尽力而为，失败只记日志（不能盖住提交本身的错误）。
pub(crate) fn release_for_job(db: &Db, job_id: &str) {
    if let Err(error) = db.release_job_pages(job_id, "submit_failed", &now_iso()) {
        tracing::warn!("page quota: release reservation for job {job_id} failed: {error:#}");
    }
}

// ---------------------------------------------------------------- 查看与发放

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct PageLedgerEntryView {
    pub entry_id: i64,
    /// 正数是加（发放、退回），负数是减（扣页、管理员扣减）。
    pub delta: i64,
    /// grant / charge / refund
    pub kind: String,
    pub job_id: String,
    pub note: String,
    pub actor_user_id: String,
    pub created_at: String,
}

impl From<PageLedgerEntry> for PageLedgerEntryView {
    fn from(entry: PageLedgerEntry) -> Self {
        Self {
            entry_id: entry.entry_id,
            delta: entry.delta,
            kind: entry.kind,
            job_id: entry.job_id,
            note: entry.note,
            actor_user_id: entry.actor_user_id,
            created_at: entry.created_at,
        }
    }
}

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct PageQuotaView {
    /// 不限额（管理员、单机模式）时为 true，此时 balance 为 null、entries 为空。
    pub unlimited: bool,
    pub balance: Option<i64>,
    /// 最近的账目，新的在前，最多 [`LEDGER_VIEW_LIMIT`] 条。
    pub entries: Vec<PageLedgerEntryView>,
}

impl PageQuotaView {
    pub fn unlimited() -> Self {
        Self {
            unlimited: true,
            balance: None,
            entries: Vec::new(),
        }
    }
}

pub fn quota_view(db: &Db, user_id: &str) -> Result<PageQuotaView, AppError> {
    Ok(PageQuotaView {
        unlimited: false,
        balance: Some(db.page_balance(user_id).map_err(db_error)?),
        entries: db
            .list_page_ledger(user_id, LEDGER_VIEW_LIMIT)
            .map_err(db_error)?
            .into_iter()
            .map(PageLedgerEntryView::from)
            .collect(),
    })
}

/// 管理员给普通账号发放（正数）或扣减（负数）页数，返回操作后的余额。
pub fn grant_pages(
    db: &Db,
    acting_admin_id: &str,
    target_user_id: &str,
    delta: i64,
    note: &str,
) -> Result<i64, AppError> {
    let user = db
        .get_user(target_user_id)
        .map_err(db_error)?
        .ok_or_else(|| AppError::not_found(format!("user not found: {target_user_id}")))?;
    if user.is_deleted() {
        return Err(crate::services::accounts::admin::account_deleted());
    }
    if user.role == "admin" {
        return Err(AppError::account(
            StatusCode::BAD_REQUEST,
            "ADMIN_UNLIMITED",
            "管理员不限额，不用发放",
            json!({}),
        ));
    }
    if delta == 0 || delta.abs() > MAX_GRANT_PAGES {
        return Err(AppError::account(
            StatusCode::BAD_REQUEST,
            "INVALID_PAGE_DELTA",
            format!("页数要是 1～{MAX_GRANT_PAGES} 之间的正数（发放）或负数（扣减）"),
            json!({ "max": MAX_GRANT_PAGES }),
        ));
    }
    let note = note.trim();
    if note.chars().count() > MAX_NOTE_CHARS {
        return Err(AppError::account(
            StatusCode::BAD_REQUEST,
            "NOTE_TOO_LONG",
            format!("备注最多 {MAX_NOTE_CHARS} 个字"),
            json!({ "max": MAX_NOTE_CHARS }),
        ));
    }
    match db.grant_pages(target_user_id, delta, note, acting_admin_id, &now_iso()) {
        Ok(balance) => Ok(balance),
        Err(error) => match error.downcast_ref::<PageBalanceWouldGoNegative>() {
            Some(negative) => Err(AppError::account(
                StatusCode::BAD_REQUEST,
                "PAGE_BALANCE_NEGATIVE",
                format!("扣完余额会变成负数：现在只有 {} 页", negative.balance),
                json!({ "balance": negative.balance }),
            )),
            None => Err(db_error(error)),
        },
    }
}

#[cfg(test)]
mod tests;
