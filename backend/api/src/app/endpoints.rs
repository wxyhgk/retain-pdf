//! 接口登记表：一个接口一条，写明方法、地址、处理函数、多用户下谁能用、谁在用、一句话说明；每张表写明归哪个领域负责。
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

/// 这个接口归哪个领域负责（2026-11-22）：业务逻辑在哪个领域包里，改它、删它找谁。和 `services/` 下的 8 个领域一一对应。
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Owner {
    Accounts,
    Providers,
    Ingest,
    /// 文件包（`retainpdf-files`）。现在没有接口直接归它（文件出口的接口按任务、书登记），留着给以后。
    #[allow(dead_code)]
    Files,
    Jobs,
    Library,
    Glossaries,
    Platform,
}

impl Owner {
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn label(self) -> &'static str {
        match self {
            Owner::Accounts => "accounts",
            Owner::Providers => "providers",
            Owner::Ingest => "ingest",
            Owner::Files => "files",
            Owner::Jobs => "jobs",
            Owner::Library => "library",
            Owner::Glossaries => "glossaries",
            Owner::Platform => "platform",
        }
    }
}

/// 谁在调这个接口（2026-11-22）。依据是代码里的调用和 rust_api 的按接口计数（`app/route_usage.rs`）。
/// 加接口必须写；写 `none` 的是后端先加、还没有调用方的，接口目录里单独列出来。
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum User {
    /// 前端页面（`frontend/web`、`frontend/packages`；浏览器和桌面窗口里是同一套）。
    Web,
    /// 桌面壳主进程（`frontend/desktop/src/main`）。
    Desktop,
    /// Python 流水线（翻译、排版的 worker 回调）。
    Worker,
    /// 命令行 `retainpdf`（`backend/cli`）。
    Cli,
    /// 运维和调试：部署探活、开发脚本、手动 curl。
    Ops,
    /// 只有多用户网站版用（2026-10-16 商业版停了，代码冻结）。
    Multiuser,
    /// 还没有调用方。
    None,
}

impl User {
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn label(self) -> &'static str {
        match self {
            User::Web => "web",
            User::Desktop => "desktop",
            User::Worker => "worker",
            User::Cli => "cli",
            User::Ops => "ops",
            User::Multiuser => "multiuser",
            User::None => "none",
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
    /// 归哪个领域负责：表头的 `owner:`，个别条目用 `owner(…)` 另写。
    pub owner: Owner,
    /// 谁在用（`by(…)`，至少一个）。
    pub users: &'static [User],
    /// 一句话说明。旧地址可以不写，写 `old` 指向它的新地址。
    pub summary: &'static str,
    /// 旧地址：它的新地址。新地址上线后旧地址还能用，接口目录里列在新地址下面。
    pub replaced_by: Option<&'static str>,
    /// 登记在哪个路由文件（模块路径），接口目录按它分组。
    pub module: &'static str,
    /// 接受 `Idempotency-Key` 请求头（`[idempotent]`，见 `app/idempotency.rs`）。
    pub idempotent: bool,
}

/// 写一张登记表，生成 `pub(crate) fn routes()` 和 `pub(crate) const ENDPOINTS`。
///
/// ```ignore
/// endpoints! {
///     state: AppState;
///     owner: jobs;
///     /// 现在能做哪些操作
///     GET "/api/v1/jobs/:job_id/actions" => actions::get_stage_actions, signed by(web);
///     GET "/api/v1/jobs/:job_id/stage-actions" => actions::get_stage_actions, signed by(none)
///         old "/api/v1/jobs/:job_id/actions";
///     /// 上传 PDF（不限请求体大小）
///     POST "/api/v1/uploads" => uploads::upload_pdf, signed by(web) [unlimited_body] owner(ingest);
/// }
/// ```
///
/// - 表头 `owner:` 写这张表归哪个领域负责（`accounts`、`providers`、`ingest`、`files`、`jobs`、`library`、`glossaries`、
///   `platform`）；表里个别条目归别的领域，在行尾 `owner(…)` 另写。
/// - `by(…)` 写谁在用，必填：`web`、`desktop`、`worker`、`cli`、`ops`、`multiuser`、`none`，可以写几个（见 [`User`]）。
///   没有调用方就不该加接口；后端先加、调用方随后接的写 `none`，接口目录里会单独列出来。
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
/// - 方括号里是附加选项：`unlimited_body` 去掉默认的请求体大小限制（上传文件的接口）；`large_body` 放宽到
///   `LARGE_BODY_LIMIT_BYTES`（带 base64 图片的 JSON）；`idempotent` 接受 `Idempotency-Key` 请求头
///   （会建要花钱的任务的接口，见 `app/idempotency.rs`）。
#[macro_export]
macro_rules! endpoints {
    (
        state: $state:ty;
        owner: $table_owner:ident;
        $(
            $(#[doc = $doc:literal])*
            $method:ident $path:literal => $handler:path, $access:ident by($($user:ident),+ $(,)?)
            $([$($flag:ident),* $(,)?])?
            $(owner($owner:ident))?
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
                    owner: $crate::endpoints!(@owner $table_owner $($owner)?),
                    users: &[$($crate::endpoints!(@user $user)),+],
                    summary: $crate::endpoints!(@summary $($doc)*),
                    replaced_by: $crate::endpoints!(@replaced_by $($replaced_by)?),
                    module: module_path!(),
                    idempotent: $crate::endpoints!(@idempotent $($($flag),*)?),
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
    // 只是登记：`Idempotency-Key` 由 `app/idempotency.rs` 的中间层按登记表处理，这里不挂东西。
    (@flags $router:expr, idempotent $(, $rest:ident)*) => {
        $crate::endpoints!(@flags $router $(, $rest)*)
    };
    (@flags $router:expr, unlimited_body $(, $rest:ident)*) => {
        $crate::endpoints!(@flags $router.layer(::axum::extract::DefaultBodyLimit::disable()) $(, $rest)*)
    };
    // 带图片的 JSON（base64）：比默认的 2 MB 大，又不像上传那样不设上限
    (@flags $router:expr, large_body $(, $rest:ident)*) => {
        $crate::endpoints!(@flags $router.layer(::axum::extract::DefaultBodyLimit::max($crate::app::endpoints::LARGE_BODY_LIMIT_BYTES)) $(, $rest)*)
    };

    (@idempotent) => { false };
    (@idempotent idempotent $(, $rest:ident)*) => { true };
    (@idempotent $other:ident $(, $rest:ident)*) => { $crate::endpoints!(@idempotent $($rest),*) };

    (@access public) => { $crate::app::endpoints::Access::Public };
    (@access signed) => { $crate::app::endpoints::Access::Signed };
    (@access admin) => { $crate::app::endpoints::Access::Admin };
    (@access closed) => { $crate::app::endpoints::Access::Closed };

    (@owner $table:ident $entry:ident) => { $crate::endpoints!(@owner $entry) };
    (@owner accounts) => { $crate::app::endpoints::Owner::Accounts };
    (@owner providers) => { $crate::app::endpoints::Owner::Providers };
    (@owner ingest) => { $crate::app::endpoints::Owner::Ingest };
    (@owner files) => { $crate::app::endpoints::Owner::Files };
    (@owner jobs) => { $crate::app::endpoints::Owner::Jobs };
    (@owner library) => { $crate::app::endpoints::Owner::Library };
    (@owner glossaries) => { $crate::app::endpoints::Owner::Glossaries };
    (@owner platform) => { $crate::app::endpoints::Owner::Platform };

    (@user web) => { $crate::app::endpoints::User::Web };
    (@user desktop) => { $crate::app::endpoints::User::Desktop };
    (@user worker) => { $crate::app::endpoints::User::Worker };
    (@user cli) => { $crate::app::endpoints::User::Cli };
    (@user ops) => { $crate::app::endpoints::User::Ops };
    (@user multiuser) => { $crate::app::endpoints::User::Multiuser };
    (@user none) => { $crate::app::endpoints::User::None };

    (@summary) => { "" };
    (@summary $($doc:literal)+) => { $crate::app::endpoints::trim_summary(concat!($($doc),+)) };

    (@replaced_by) => { None };
    (@replaced_by $replaced_by:literal) => { Some($replaced_by) };
}

/// `large_body` 标记的接口的请求体上限：带几张 base64 图片的 JSON（问模型时最多 4 张、每张 4 MB）。
pub const LARGE_BODY_LIMIT_BYTES: usize = 24 * 1024 * 1024;

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
