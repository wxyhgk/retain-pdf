//! 账号：登录会话、自己的页额度；管理后台：用户、邀请码、平台设置。

use crate::app::AppState;
use crate::routes::{accounts, admin_invites, admin_platform, admin_users};

crate::endpoints! {
    state: AppState;
    owner: accounts;
    /// 退出登录
    POST "/api/v1/auth/logout" => accounts::logout_route, signed by(multiuser);
    /// 改自己的密码
    POST "/api/v1/auth/password" => accounts::change_password_route, signed by(multiuser);
    /// 自己的页额度和用量
    GET "/api/v1/account/pages" => accounts::my_pages_route, signed by(multiuser);
    /// 用户列表
    GET "/api/v1/admin/users" => admin_users::list_users_route, admin by(multiuser);
    /// 新建用户
    POST "/api/v1/admin/users" => accounts::create_user_route, admin by(multiuser);
    /// 一个用户的详情
    GET "/api/v1/admin/users/:user_id" => admin_users::user_detail_route, admin by(multiuser);
    /// 删除用户（可恢复）
    DELETE "/api/v1/admin/users/:user_id" => admin_users::delete_user_route, admin by(multiuser);
    /// 一个用户的任务
    GET "/api/v1/admin/users/:user_id/jobs" => admin_users::user_jobs_route, admin by(multiuser);
    /// 改用户角色
    POST "/api/v1/admin/users/:user_id/role" => admin_users::set_role_route, admin by(multiuser);
    /// 恢复删除的用户
    POST "/api/v1/admin/users/:user_id/restore" => admin_users::restore_user_route, admin by(multiuser);
    /// 重置用户密码
    POST "/api/v1/admin/users/:user_id/reset-password" => accounts::reset_password_route, admin by(multiuser);
    /// 停用用户
    POST "/api/v1/admin/users/:user_id/disable" => accounts::disable_user_route, admin by(multiuser);
    /// 启用用户
    POST "/api/v1/admin/users/:user_id/enable" => accounts::enable_user_route, admin by(multiuser);
    /// 一个用户的页额度
    GET "/api/v1/admin/users/:user_id/pages" => accounts::user_pages_route, admin by(multiuser);
    /// 给用户加页额度
    POST "/api/v1/admin/users/:user_id/pages" => accounts::grant_pages_route, admin by(multiuser);
    /// 邀请码列表
    GET "/api/v1/admin/invites" => admin_invites::list_invites_route, admin by(multiuser);
    /// 新建邀请码
    POST "/api/v1/admin/invites" => admin_invites::create_invite_route, admin by(multiuser);
    /// 一个邀请码的详情和使用记录
    GET "/api/v1/admin/invites/:invite_id" => admin_invites::invite_detail_route, admin by(multiuser);
    /// 作废邀请码
    POST "/api/v1/admin/invites/:invite_id/revoke" => admin_invites::revoke_invite_route, admin by(multiuser);
    /// 平台设置（平台提供的翻译模型、OCR）
    GET "/api/v1/admin/platform" => admin_platform::get_platform_route, admin by(multiuser);
    /// 保存平台设置
    PUT "/api/v1/admin/platform" => admin_platform::put_platform_route, admin by(multiuser);
    /// 测试平台设置能不能连通
    POST "/api/v1/admin/platform/test" => admin_platform::test_platform_route, admin by(multiuser);
}
