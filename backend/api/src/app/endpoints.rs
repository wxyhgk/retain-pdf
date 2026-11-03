//! 接口登记表：一个接口一条，写明方法、地址、处理函数、多用户下谁能用、一句话说明。
//!
//! 每个领域的路由文件（`app/router/<领域>.rs`、`app/router/jobs/<类>.rs`）用 [`endpoints!`] 写自己的表，
//! 同一张表同时生成两样东西：
//! - `routes()`：注册进 axum 的路由；
//! - `ENDPOINTS`：这些接口的说明，接口目录（`docs/api/00-接口目录.md`）和接口清单快照
//!   （`docs/routes.txt`）都从这里汇总。
//!
//! 所以加一个接口就是在表里加一条，说明不写编译不过；地址、方法、谁能用都在同一行，diff 里一眼看见。
//! 方案见 docs/ops/planning/api-reorg/20261017-接口登记表.md。

/// 多用户模式下网站账号能不能用。单机模式、内部服务钥匙不受它限制。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Access {
    /// 不需要登录（登录注册、健康检查）。
    Public,
    /// 登录了就能用（路径里的资源编号仍要是自己的）。
    Signed,
    /// 只给管理员。
    Admin,
    /// 这一期对网站账号关闭（回 404）。
    Closed,
}

impl Access {
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn label(self) -> &'static str {
        match self {
            Access::Public => "public",
            Access::Signed => "signed",
            Access::Admin => "admin",
            Access::Closed => "closed",
        }
    }
}

/// 多用户模式下，这个方法、这个路由模板（axum 的 `MatchedPath`）归哪一种访问策略。
///
/// - 登记过的方法和地址：用登记表里写的；
/// - 地址登记过、方法没登记（axum 会回 405，访问控制的中间件也会先跑一遍）：取这个地址各方法里最严的一种，
///   和原来按地址判断时一样，网站账号照旧看到 405，不会因为方法写错就被判成"没有这个接口"；
/// - 地址也没登记：当关闭，宁可错拒，不可错放。
pub fn route_policy(method: &str, template: &str) -> crate::services::accounts::RoutePolicy {
    use crate::services::accounts::RoutePolicy;
    use std::collections::HashMap;
    use std::sync::OnceLock;
    struct Policies {
        exact: HashMap<(&'static str, &'static str), Access>,
        strictest_by_path: HashMap<&'static str, Access>,
    }
    fn strictness(access: Access) -> u8 {
        match access {
            Access::Public => 0,
            Access::Signed => 1,
            Access::Admin => 2,
            Access::Closed => 3,
        }
    }
    static POLICIES: OnceLock<Policies> = OnceLock::new();
    let policies = POLICIES.get_or_init(|| {
        let endpoints = crate::app::registered_endpoints();
        let mut strictest_by_path: HashMap<&'static str, Access> = HashMap::new();
        for endpoint in &endpoints {
            let entry = strictest_by_path.entry(endpoint.path).or_insert(endpoint.access);
            if strictness(endpoint.access) > strictness(*entry) {
                *entry = endpoint.access;
            }
        }
        Policies {
            exact: endpoints.iter().map(|e| ((e.method, e.path), e.access)).collect(),
            strictest_by_path,
        }
    });
    let access = policies
        .exact
        .get(&(method, template))
        .or_else(|| policies.strictest_by_path.get(template));
    match access {
        // 公开的接口挂在认证之外，走不到这里；真走到了也只是登录就能用。
        Some(Access::Public | Access::Signed) => RoutePolicy::Signed,
        Some(Access::Admin) => RoutePolicy::AdminOnly,
        Some(Access::Closed) | None => RoutePolicy::Closed,
    }
}

/// 登记表里的一条。说明、处理函数这些字段只有接口目录用（测试里生成）。
#[derive(Clone, Copy, Debug)]
#[cfg_attr(not(test), allow(dead_code))]
pub struct Endpoint {
    /// `GET`、`POST`……
    pub method: &'static str,
    /// axum 的路由模板，例如 `/api/v1/jobs/:job_id/actions`。
    pub path: &'static str,
    /// 处理函数，例如 `actions::get_stage_actions`。
    pub handler: &'static str,
    pub access: Access,
    /// 一句话说明。旧地址可以不写，写 `old` 指向它的新地址。
    pub summary: &'static str,
    /// 旧地址：它的新地址。新地址上线后旧地址还能用，接口目录里列在新地址下面。
    pub replaced_by: Option<&'static str>,
    /// 登记在哪个路由文件（模块路径），接口目录按它分组。
    pub module: &'static str,
}

/// 写一张登记表，生成 `pub(crate) fn routes()` 和 `pub(crate) const ENDPOINTS`。
///
/// ```ignore
/// endpoints! {
///     state: AppState;
///     /// 现在能做哪些操作
///     GET "/api/v1/jobs/:job_id/actions" => actions::get_stage_actions, signed;
///     GET "/api/v1/jobs/:job_id/stage-actions" => actions::get_stage_actions, signed
///         old "/api/v1/jobs/:job_id/actions";
///     /// 上传 PDF（不限请求体大小）
///     POST "/api/v1/uploads" => uploads::upload_pdf, signed [unlimited_body];
/// }
/// ```
///
/// - 说明写在 `///` 里；旧地址在行尾写 `old "<新地址>"`，说明可以省。
/// - 同一地址只换方法（例如 GET 换成 POST）：新方法登记成新的一行，旧方法那行行尾写 `old "<同一地址>"`，
///   接口目录里旧地址那一栏带上方法显示（合集工作区 2026-10-19 这样换过，旧的 GET 10-22 删了；整个接口 2026-11-03 跟 AI 服务一起删了，这里只当例子）：
///
///   ```ignore
///   POST "/api/v1/collections/:collection_id/agent-workspace" => collections::collection_agent_workspace_route, closed;
///   GET "/api/v1/collections/:collection_id/agent-workspace" => collections::collection_agent_workspace_route, closed
///       old "/api/v1/collections/:collection_id/agent-workspace";
///   ```
/// - 访问：`public`、`signed`、`admin`、`closed`。
/// - 方括号里是附加选项，现在只有 `unlimited_body`：去掉默认的请求体大小限制（上传文件的接口）。
#[macro_export]
macro_rules! endpoints {
    (
        state: $state:ty;
        $(
            $(#[doc = $doc:literal])*
            $method:ident $path:literal => $handler:path, $access:ident
            $([$($flag:ident),* $(,)?])?
            $(old $replaced_by:literal)?
            ;
        )*
    ) => {
        pub(crate) fn routes() -> ::axum::Router<$state> {
            let router = ::axum::Router::new();
            $(
                let router = router.route(
                    $path,
                    $crate::endpoints!(@method_router $method, $handler $($(, $flag)*)?),
                );
            )*
            router
        }

        #[allow(dead_code)]
        pub(crate) const ENDPOINTS: &[$crate::app::endpoints::Endpoint] = &[
            $(
                $crate::app::endpoints::Endpoint {
                    method: stringify!($method),
                    path: $path,
                    handler: stringify!($handler),
                    access: $crate::endpoints!(@access $access),
                    summary: $crate::endpoints!(@summary $($doc)*),
                    replaced_by: $crate::endpoints!(@replaced_by $($replaced_by)?),
                    module: module_path!(),
                },
            )*
        ];
    };

    (@method_router GET, $handler:path $(, $flag:ident)*) => { $crate::endpoints!(@flags ::axum::routing::get($handler) $(, $flag)*) };
    (@method_router POST, $handler:path $(, $flag:ident)*) => { $crate::endpoints!(@flags ::axum::routing::post($handler) $(, $flag)*) };
    (@method_router PUT, $handler:path $(, $flag:ident)*) => { $crate::endpoints!(@flags ::axum::routing::put($handler) $(, $flag)*) };
    (@method_router PATCH, $handler:path $(, $flag:ident)*) => { $crate::endpoints!(@flags ::axum::routing::patch($handler) $(, $flag)*) };
    (@method_router DELETE, $handler:path $(, $flag:ident)*) => { $crate::endpoints!(@flags ::axum::routing::delete($handler) $(, $flag)*) };

    (@flags $router:expr) => { $router };
    (@flags $router:expr, unlimited_body $(, $rest:ident)*) => {
        $crate::endpoints!(@flags $router.layer(::axum::extract::DefaultBodyLimit::disable()) $(, $rest)*)
    };

    (@access public) => { $crate::app::endpoints::Access::Public };
    (@access signed) => { $crate::app::endpoints::Access::Signed };
    (@access admin) => { $crate::app::endpoints::Access::Admin };
    (@access closed) => { $crate::app::endpoints::Access::Closed };

    (@summary) => { "" };
    (@summary $($doc:literal)+) => { $crate::app::endpoints::trim_summary(concat!($($doc),+)) };

    (@replaced_by) => { None };
    (@replaced_by $replaced_by:literal) => { Some($replaced_by) };
}

/// `///` 行开头的空格去掉；多行说明连成一行（中文不加空格）。
pub const fn trim_summary(doc: &'static str) -> &'static str {
    let bytes = doc.as_bytes();
    let mut start = 0;
    while start < bytes.len() && bytes[start] == b' ' {
        start += 1;
    }
    // const fn 里不能拼字符串，多行说明保持 concat! 的结果，只去掉开头的空格。
    let (_, rest) = bytes.split_at(start);
    match std::str::from_utf8(rest) {
        Ok(text) => text,
        Err(_) => doc,
    }
}
