//! 路由的访问策略和路径参数分类要覆盖到每一条路由。访问策略写在接口登记表（`app/router/*.rs`），
//! 参数分类规则在账号包 `retainpdf-accounts` 的 `access.rs`；这两个测试要扫 rust_api 的路由源码，所以放在这里。
use crate::app::endpoints::route_policy;
use crate::services::accounts::{classify_param, ParamClass, RoutePolicy};
use crate::test_support::routes::router_source_files;

/// 路由源码里写的全部路由模板（带出处），去重。
fn route_templates() -> Vec<(String, String)> {
    let files = router_source_files();
    let mut templates = Vec::new();
    for file in files {
        let source = std::fs::read_to_string(&file).unwrap();
        for literal in source.split('"').skip(1).step_by(2).filter(|s| s.starts_with("/api/")) {
            templates.push((file.display().to_string(), literal.to_string()));
        }
    }
    templates.sort_by(|a, b| a.1.cmp(&b.1));
    templates.dedup_by(|a, b| a.1 == b.1);
    assert!(templates.len() > 80, "route scan found too few routes ({}); did the router move?", templates.len());
    templates
}

fn path_params(template: &str) -> impl Iterator<Item = &str> {
    template.split('/').filter(|s| s.starts_with(':') || s.starts_with('*')).map(|s| &s[1..])
}

/// 扫一遍路由源码，所有路径参数都必须分了类。新加路由带了新参数名，这里会红，提醒去决定它归谁。
#[test]
fn every_route_param_is_classified() {
    for (file, template) in route_templates() {
        for name in path_params(&template) {
            assert_ne!(
                classify_param(name),
                ParamClass::Unknown,
                "{file}: route `{template}` has unclassified path param `{name}`"
            );
        }
    }
}

/// 登录就能用、路径里又没有要核归属的编号的路由：中间件替它们做不了隔离（只能核查询串和
/// JSON 请求体里的编号），全靠处理函数按当前用户过滤或记归属。逐条写明怎么隔离的。
const SIGNED_WITHOUT_OWNED_PARAM: &[(&str, &str)] = &[
    ("/api/v1/account/pages", "只返回当前用户自己的页额度（accounts::my_pages_route）"),
    ("/api/v1/auth/login", "登录本身"),
    ("/api/v1/auth/logout", "只清当前会话"),
    ("/api/v1/auth/password", "只改当前用户的密码"),
    ("/api/v1/auth/register", "注册本身"),
    ("/api/v1/auth/session", "只返回当前会话"),
    ("/api/v1/collections", "列表按 owner_filter 过滤；新建记 owner_id；parent_id 由中间件核归属"),
    ("/api/v1/documents", "列表按 owner_filter 过滤（library_data::list_documents）"),
    ("/api/v1/fonts", "字体是全站共用的，不含用户数据"),
    ("/api/v1/glossaries", "列表按 owner_filter 过滤；新建记 owner_id"),
    ("/api/v1/glossaries/parse-csv", "只解析请求里的 CSV，不读不写存储"),
    ("/api/v1/jobs", "列表按 owner_filter 过滤；新建时 upload_id 由中间件核归属，任务继承上传的归属"),
    ("/api/v1/providers/ocr", "只读 OCR 服务商清单，不含用户数据"),
    ("/api/v1/search", "按 owner_filter 过滤"),
    ("/api/v1/uploads", "上传记当前用户为 owner"),
    ("/api/v1/usage", "按 owner_filter 过滤"),
];

#[test]
fn every_signed_route_without_owned_param_is_reviewed() {
    let templates = route_templates();
    for (file, template) in &templates {
        let signed = ["GET", "POST", "PUT", "PATCH", "DELETE"]
            .iter()
            .any(|method| route_policy(method, template) == RoutePolicy::Signed);
        let owned = path_params(template).any(|name| matches!(classify_param(name), ParamClass::Owned(_)));
        if signed && !owned {
            assert!(
                SIGNED_WITHOUT_OWNED_PARAM.iter().any(|(listed, _)| listed == template),
                "{file}: route `{template}` is open to accounts but has no owned path param; make its \
                 handler scope by the current user, then list it in SIGNED_WITHOUT_OWNED_PARAM"
            );
        }
    }
    // 登记表里不留已经不存在、或者已经不再是这种情况的条目。
    for (listed, _) in SIGNED_WITHOUT_OWNED_PARAM {
        assert!(templates.iter().any(|(_, template)| template == listed), "stale entry `{listed}`");
    }
}
