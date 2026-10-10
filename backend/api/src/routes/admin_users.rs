//! 管理后台（/api/v1/admin/users*，只给管理员、只在多用户模式）：账号列表的搜索筛选排序分页、
//! 账号详情与统计、某个账号的任务、改身份、软删除与恢复。发放页数、重置密码、停用启用在 accounts.rs。
//!
//! 管理员看得到别人的账号和任务列表，但打不开别人的任务详情：/jobs/:id 这类接口按数据归属走，
//! 管理员的网站会话也只认自己的数据。

use std::collections::{BTreeMap, HashMap};

use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::accounts::{require_admin, require_multi};
use crate::db::{OwnerJobRow, UserListQuery, UserSortKey, UserStats, UserStatusFilter};
use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::routes::common::{
    build_accounts_route_deps, build_jobs_route_deps, ok_json, ApiJson, ApiPath, ApiQuery,
};
use crate::services::accounts::api::{admin_view, AdminUserView, Principal};
use crate::AppState;

const MAX_PAGE_SIZE: usize = 500;
const DEFAULT_JOBS_PAGE_SIZE: usize = 20;
const MAX_JOBS_PAGE_SIZE: usize = 200;

fn storage_error(error: anyhow::Error) -> AppError {
    AppError::internal(format!("account storage failed: {error:#}"))
}

fn invalid_query(name: &str, allowed: &str) -> AppError {
    AppError::account(
        StatusCode::BAD_REQUEST,
        "INVALID_QUERY",
        format!("查询参数 {name} 不对，可选：{allowed}"),
        json!({ "param": name }),
    )
}

fn admin_only(state: &AppState, principal: &Principal) -> Result<(), AppError> {
    require_multi(&build_accounts_route_deps(state))?;
    require_admin(principal)
}

async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, AppError> + Send + 'static,
) -> Result<T, AppError> {
    tokio::task::spawn_blocking(work)
        .await
        .map_err(|_| AppError::internal("admin task failed"))?
}

#[derive(Serialize)]
pub struct AdminUserListItem {
    #[serde(flatten)]
    pub user: AdminUserView,
    /// 剩余页数；管理员不限额，为 null。
    pub page_balance: Option<i64>,
}

#[derive(Serialize)]
pub struct AdminUserListView {
    pub users: Vec<AdminUserListItem>,
    /// 符合筛选条件的总数（不受 limit / offset 影响）。
    pub total: i64,
}

fn parse_list_query(params: &HashMap<String, String>) -> Result<UserListQuery, AppError> {
    let get = |name: &str| {
        params
            .get(name)
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
    };
    let mut query = UserListQuery {
        q: get("q").unwrap_or_default().to_string(),
        ..Default::default()
    };
    query.status = match get("status") {
        None => None,
        Some("active") => Some(UserStatusFilter::Active),
        Some("disabled") => Some(UserStatusFilter::Disabled),
        Some("deleted") => Some(UserStatusFilter::Deleted),
        Some(_) => return Err(invalid_query("status", "active、disabled、deleted")),
    };
    query.role = match get("role") {
        None => None,
        Some(role @ ("admin" | "user")) => Some(role.to_string()),
        Some(_) => return Err(invalid_query("role", "admin、user")),
    };
    query.sort = match get("sort") {
        None | Some("created_at") => UserSortKey::CreatedAt,
        Some("username") => UserSortKey::Username,
        Some("last_login_at") => UserSortKey::LastLoginAt,
        Some("page_balance") => UserSortKey::PageBalance,
        Some(_) => {
            return Err(invalid_query(
                "sort",
                "username、created_at、last_login_at、page_balance",
            ))
        }
    };
    query.descending = match get("order") {
        None | Some("asc") => false,
        Some("desc") => true,
        Some(_) => return Err(invalid_query("order", "asc、desc")),
    };
    query.limit = match get("limit") {
        None => None,
        Some(raw) => match raw.parse::<usize>() {
            Ok(limit) if (1..=MAX_PAGE_SIZE).contains(&limit) => Some(limit),
            _ => return Err(invalid_query("limit", &format!("1～{MAX_PAGE_SIZE}"))),
        },
    };
    query.offset = match get("offset") {
        None => 0,
        Some(raw) => raw
            .parse::<usize>()
            .map_err(|_| invalid_query("offset", "不小于 0 的整数"))?,
    };
    Ok(query)
}

/// GET /api/v1/admin/users?q=&status=&role=&sort=&order=&limit=&offset=
/// 不带参数：没删的全部账号，按建号时间排（和以前一样）。
pub async fn list_users_route(
    State(state): State<AppState>,
    principal: Principal,
    ApiQuery(params): ApiQuery<HashMap<String, String>>,
) -> Result<Json<ApiResponse<AdminUserListView>>, AppError> {
    admin_only(&state, &principal)?;
    let query = parse_list_query(&params)?;
    let db = state.db.clone();
    let page = blocking(move || db.list_users_page(&query).map_err(storage_error)).await?;
    let users = page
        .rows
        .iter()
        .map(|row| AdminUserListItem {
            page_balance: (row.user.role != "admin").then_some(row.page_balance),
            user: admin_view(&row.user),
        })
        .collect();
    Ok(ok_json(AdminUserListView {
        users,
        total: page.total,
    }))
}

#[derive(Serialize)]
pub struct AdminUserStatsView {
    pub jobs_total: i64,
    pub jobs_by_status: BTreeMap<String, i64>,
    pub documents: i64,
    pub uploads: i64,
    /// 上传的原始 PDF 合计字节数（不含任务产物）。
    pub upload_bytes: i64,
    /// 实际扣掉的页数：已确认的 + 还在预扣中的（退回的不算）。
    pub pages_charged: i64,
    pub pages_reserved: i64,
    pub last_submitted_at: Option<String>,
}

impl From<UserStats> for AdminUserStatsView {
    fn from(stats: UserStats) -> Self {
        Self {
            jobs_total: stats.jobs_total,
            jobs_by_status: stats.jobs_by_status,
            documents: stats.documents,
            uploads: stats.uploads,
            upload_bytes: stats.upload_bytes,
            pages_charged: stats.pages_charged,
            pages_reserved: stats.pages_reserved,
            last_submitted_at: stats.last_submitted_at,
        }
    }
}

#[derive(Serialize)]
pub struct AdminUserDetailView {
    pub user: AdminUserView,
    pub page_balance: Option<i64>,
    pub stats: AdminUserStatsView,
}

/// GET /api/v1/admin/users/:user_id（删了的也能看）
pub async fn user_detail_route(
    State(state): State<AppState>,
    principal: Principal,
    ApiPath(user_id): ApiPath<String>,
) -> Result<Json<ApiResponse<AdminUserDetailView>>, AppError> {
    admin_only(&state, &principal)?;
    let db = state.db.clone();
    let view = blocking(move || {
        let user = db
            .get_user(&user_id)
            .map_err(storage_error)?
            .ok_or_else(|| AppError::not_found(format!("user not found: {user_id}")))?;
        let page_balance = if user.role == "admin" {
            None
        } else {
            Some(db.page_balance(&user_id).map_err(storage_error)?)
        };
        let stats = db.user_stats(&user_id).map_err(storage_error)?;
        Ok(AdminUserDetailView {
            user: admin_view(&user),
            page_balance,
            stats: stats.into(),
        })
    })
    .await?;
    Ok(ok_json(view))
}

#[derive(Serialize)]
pub struct AdminUserJobView {
    pub job_id: String,
    pub workflow: String,
    pub status: String,
    /// 书名，没有就是上传的文件名。
    pub title: String,
    /// 源 PDF 总页数。
    pub document_pages: Option<i64>,
    /// 这个任务扣了几页（不计费的为 null）及其状态 reserved / settled / refunded。
    pub charged_pages: Option<i64>,
    pub charge_status: Option<String>,
    pub created_at: String,
    pub finished_at: Option<String>,
}

impl From<OwnerJobRow> for AdminUserJobView {
    fn from(row: OwnerJobRow) -> Self {
        Self {
            job_id: row.job_id,
            workflow: row.workflow,
            status: row.status,
            title: row.title,
            document_pages: row.document_pages,
            charged_pages: row.charged_pages,
            charge_status: row.charge_status,
            created_at: row.created_at,
            finished_at: row.finished_at,
        }
    }
}

#[derive(Serialize)]
pub struct AdminUserJobsView {
    pub jobs: Vec<AdminUserJobView>,
    pub total: i64,
}

#[derive(Debug, Deserialize)]
pub struct PageQuery {
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// GET /api/v1/admin/users/:user_id/jobs?limit=&offset=（新的在前，默认 20 条，最多 200）
pub async fn user_jobs_route(
    State(state): State<AppState>,
    principal: Principal,
    ApiPath(user_id): ApiPath<String>,
    ApiQuery(page): ApiQuery<PageQuery>,
) -> Result<Json<ApiResponse<AdminUserJobsView>>, AppError> {
    admin_only(&state, &principal)?;
    let limit = page.limit.unwrap_or(DEFAULT_JOBS_PAGE_SIZE);
    if !(1..=MAX_JOBS_PAGE_SIZE).contains(&limit) {
        return Err(invalid_query("limit", &format!("1～{MAX_JOBS_PAGE_SIZE}")));
    }
    let offset = page.offset.unwrap_or(0);
    let db = state.db.clone();
    let view = blocking(move || {
        db.get_user(&user_id)
            .map_err(storage_error)?
            .ok_or_else(|| AppError::not_found(format!("user not found: {user_id}")))?;
        let (rows, total) = db
            .list_jobs_for_owner_page(&user_id, limit, offset)
            .map_err(storage_error)?;
        Ok(AdminUserJobsView {
            jobs: rows.into_iter().map(AdminUserJobView::from).collect(),
            total,
        })
    })
    .await?;
    Ok(ok_json(view))
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SetRoleInput {
    pub role: String,
}

/// POST /api/v1/admin/users/:user_id/role，`{ "role": "admin" | "user" }`
pub async fn set_role_route(
    State(state): State<AppState>,
    principal: Principal,
    ApiPath(user_id): ApiPath<String>,
    ApiJson(input): ApiJson<SetRoleInput>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    admin_only(&state, &principal)?;
    let accounts = build_accounts_route_deps(&state);
    let user = blocking(move || accounts.set_role(&principal.user_id, &user_id, input.role.trim()))
        .await?;
    Ok(ok_json(json!({ "user": admin_view(&user) })))
}

/// DELETE /api/v1/admin/users/:user_id：软删除，踢掉会话，取消它还在排队 / 在跑的任务（按页数规则退回）。
pub async fn delete_user_route(
    State(state): State<AppState>,
    principal: Principal,
    ApiPath(user_id): ApiPath<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    admin_only(&state, &principal)?;
    let accounts = build_accounts_route_deps(&state);
    let target = user_id.clone();
    let user = blocking(move || accounts.soft_delete(&principal.user_id, &target)).await?;
    let db = state.db.clone();
    let owner = user_id.clone();
    let active =
        blocking(move || db.active_job_ids_for_owner(&owner).map_err(storage_error)).await?;
    let mut canceled = Vec::new();
    for job_id in active {
        // 尽力而为：任务可能刚好自己结束了，或者是父任务取消时连带结束的 OCR 子任务。
        match build_jobs_route_deps(&state)
            .jobs
            .cancel_submission("", &job_id, false)
            .await
        {
            Ok(_) => canceled.push(job_id),
            Err(error) => tracing::warn!(
                "admin: cancel job {job_id} of deleted user {user_id} failed: {error:?}"
            ),
        }
    }
    Ok(ok_json(
        json!({ "user": admin_view(&user), "canceled_jobs": canceled }),
    ))
}

/// POST /api/v1/admin/users/:user_id/restore
pub async fn restore_user_route(
    State(state): State<AppState>,
    principal: Principal,
    ApiPath(user_id): ApiPath<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AppError> {
    admin_only(&state, &principal)?;
    let accounts = build_accounts_route_deps(&state);
    let user = blocking(move || accounts.restore(&user_id)).await?;
    Ok(ok_json(json!({ "user": admin_view(&user) })))
}
