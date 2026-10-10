//! 管理后台：改身份、软删除与恢复。
//!
//! 软删除：账号 `deleted_at` 置上时间——不能登录、会话作废、不算可用管理员；数据、账目都留着，
//! 用户名继续占用；恢复就是清空它，回到删之前的启用 / 停用状态。删了的账号不能再停用、重置密码、
//! 发页数、改身份，要先恢复。
//!
//! 身份与额度：页数余额记在账本里，和身份无关。升成管理员后不限额（账本不动）；降回普通账号，
//! 余额就是账本里原来的数——管理员不能被发放页数，所以一般是升级前剩下的那些。

use axum::http::StatusCode;
use serde_json::json;

use super::{db_error, now, AccountsService};
use crate::db::UserRecord;
use crate::error::AppError;

pub(crate) fn account_deleted() -> AppError {
    AppError::account(
        StatusCode::CONFLICT,
        "ACCOUNT_DELETED",
        "账号已删除，先恢复再操作",
        json!({}),
    )
}

fn last_admin() -> AppError {
    AppError::account(
        StatusCode::BAD_REQUEST,
        "LAST_ADMIN",
        "至少要保留一个可用的管理员",
        json!({}),
    )
}

impl AccountsService {
    /// 管理员能操作的账号：存在且没删。
    pub(crate) fn require_live_user(&self, user_id: &str) -> Result<UserRecord, AppError> {
        let user = self.require_user(user_id)?;
        if user.is_deleted() {
            return Err(account_deleted());
        }
        Ok(user)
    }

    /// 这个账号现在是不是唯一一个可用的管理员（停用它、降级它、删了它都会让系统没有管理员）。
    fn is_last_active_admin(&self, user: &UserRecord) -> Result<bool, AppError> {
        Ok(user.role == "admin"
            && user.status == "active"
            && !user.is_deleted()
            && self.db.count_active_admins().map_err(db_error)? <= 1)
    }

    pub fn set_role(
        &self,
        acting_user_id: &str,
        user_id: &str,
        role: &str,
    ) -> Result<UserRecord, AppError> {
        if !matches!(role, "admin" | "user") {
            return Err(AppError::account(
                StatusCode::BAD_REQUEST,
                "INVALID_ROLE",
                "身份只能是 admin 或 user",
                json!({}),
            ));
        }
        let user = self.require_live_user(user_id)?;
        if user_id == acting_user_id {
            return Err(AppError::account(
                StatusCode::BAD_REQUEST,
                "CANNOT_CHANGE_OWN_ROLE",
                "不能改自己的身份",
                json!({}),
            ));
        }
        if user.role == role {
            return Ok(user);
        }
        if role == "user" && self.is_last_active_admin(&user)? {
            return Err(last_admin());
        }
        self.db
            .set_user_role(user_id, role, &now())
            .map_err(db_error)?;
        self.require_user(user_id)
    }

    /// 软删除并踢掉它所有会话。已经删了的原样返回。正在跑的任务由调用方取消（要用任务运行时）。
    pub fn soft_delete(&self, acting_user_id: &str, user_id: &str) -> Result<UserRecord, AppError> {
        let user = self.require_user(user_id)?;
        if user.is_deleted() {
            return Ok(user);
        }
        if user_id == acting_user_id {
            return Err(AppError::account(
                StatusCode::BAD_REQUEST,
                "CANNOT_DELETE_SELF",
                "不能删除自己的账号",
                json!({}),
            ));
        }
        if self.is_last_active_admin(&user)? {
            return Err(last_admin());
        }
        let at = now();
        self.db
            .set_user_deleted_at(user_id, &at, &at)
            .map_err(db_error)?;
        self.db
            .delete_user_sessions(user_id, None)
            .map_err(db_error)?;
        self.require_user(user_id)
    }

    /// 恢复软删除的账号；没删的原样返回。
    pub fn restore(&self, user_id: &str) -> Result<UserRecord, AppError> {
        let user = self.require_user(user_id)?;
        if !user.is_deleted() {
            return Ok(user);
        }
        self.db
            .set_user_deleted_at(user_id, "", &now())
            .map_err(db_error)?;
        self.require_user(user_id)
    }
}
