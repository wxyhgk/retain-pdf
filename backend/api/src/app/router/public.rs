//! 不需要登录的接口：健康检查，登录注册。挂在认证之外。

use crate::app::AppState;
use crate::routes::{accounts, health};

crate::endpoints! {
    state: AppState;
    owner: accounts;
    /// 进程活着（不要密钥）
    GET "/health" => health::health, public by(desktop, cli, ops) owner(platform);
    /// 能接请求了（库能用；受监督的 AI 服务、jobsd 也就绪）。不就绪 503，看 HTTP 状态码（不要密钥）
    GET "/ready" => health::ready, public by(cli, ops) owner(platform);
    /// 现在是什么模式、登没登录（前端据此决定显示不显示登录页）
    GET "/api/v1/auth/session" => accounts::session_route, public by(web);
    /// 登录
    POST "/api/v1/auth/login" => accounts::login_route, public by(multiuser);
    /// 注册
    POST "/api/v1/auth/register" => accounts::register_route, public by(multiuser);
}
