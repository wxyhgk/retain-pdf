//! 多用户模式下「网站账号能访问什么」。只管浏览器会话来的请求；单机模式、内部服务钥匙、助手临时授权
//! 都不经过这里（它们本来就是全权的，或者另有授权）。
//!
//! 两道关：
//! 1. 按路由：有的路由只给管理员（凭据、同步、备份、运行配置……），有的这一期对网站账号整个关掉
//!    （助手相关——助手能读全部数据、跑命令，等按用户隔离做完再开）。
//! 2. 按路径参数：路径里出现任务 / 书 / 术语表 / 文件夹编号的，必须是自己的；别人的一律当不存在。
//!
//! 宁可错拒，不可错放：路径参数名不在下面的分类里就拒绝（测试会扫一遍所有路由，保证每个参数都分了类）。

use crate::db::OwnedKind;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RoutePolicy {
    /// 登录了就能用（路径参数仍要过归属）。
    Signed,
    /// 只给管理员。
    AdminOnly,
    /// 这一期对网站账号关闭（回 404，看起来就是没有这个接口）。
    Closed,
}

/// 路由模板（axum 的 MatchedPath，例如 `/api/v1/jobs/:job_id`）对应的策略。
pub fn route_policy(method: &str, template: &str) -> RoutePolicy {
    let starts = |prefix: &str| template == prefix || template.starts_with(&format!("{prefix}/"));
    if starts("/api/v1/ai/runtime-config") {
        return RoutePolicy::AdminOnly;
    }
    if starts("/api/v1/ai")
        || starts("/api/v1/assets")
        || starts("/api/v1/internal")
        || starts("/api/v1/translate/bundle")
        // 旧别名，网站前端不用；它还能带文件建任务，多一个入口就多一处要核归属。
        || starts("/api/v1/ocr")
        || template.ends_with("/agent-versions")
        || template.ends_with("/agent-workspace")
    {
        return RoutePolicy::Closed;
    }
    if starts("/api/v1/credentials")
        || starts("/api/v1/sync")
        || starts("/api/v1/backups")
        || starts("/api/v1/admin")
        || (starts("/api/v1/providers") && !(method == "GET" && template == "/api/v1/providers/ocr"))
        || template == "/api/v1/fonts/upload"
    {
        return RoutePolicy::AdminOnly;
    }
    RoutePolicy::Signed
}

/// 路径参数的分类。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ParamClass {
    /// 有归属的资源编号：必须是自己的。
    Owned(OwnedKind),
    /// 挂在某个有归属的资源下面的子编号（页号、条目号、产物名……），父资源核过就行；
    /// 或者只出现在只给管理员 / 已关闭的路由里。
    Nested,
    /// 没分类：拒绝。
    Unknown,
}

pub fn classify_param(name: &str) -> ParamClass {
    match name {
        "job_id" => ParamClass::Owned(OwnedKind::Job),
        "document_id" => ParamClass::Owned(OwnedKind::Document),
        "glossary_id" => ParamClass::Owned(OwnedKind::Glossary),
        "collection_id" => ParamClass::Owned(OwnedKind::Collection),
        "item_id" | "page_idx" | "page" | "name" | "dataset" | "artifact_key" | "suggestion_id" | "path" => {
            ParamClass::Nested
        }
        // 只在管理员路由或已关闭路由里出现。
        "user_id" | "backup_id" | "credential_ref" | "operation_id" | "conversation_id" | "calculation_id"
        | "artifact_id" | "asset_id" => ParamClass::Nested,
        _ => ParamClass::Unknown,
    }
}

/// 查询串、JSON 请求体里按名字认出来的资源编号（值为空的跳过）。
/// `job_ids` 在查询串里是逗号分隔的一串。`parent_id` 只在文件夹接口里是文件夹编号。
pub fn key_kind(template: &str, key: &str) -> Option<OwnedKind> {
    match key {
        "upload_id" => Some(OwnedKind::Upload),
        "job_id" | "job_ids" | "artifact_job_id" | "active_job_id" | "base_job_id" => Some(OwnedKind::Job),
        "document_id" | "document_ids" => Some(OwnedKind::Document),
        "glossary_id" | "glossary_ids" => Some(OwnedKind::Glossary),
        "collection_id" | "collection_ids" => Some(OwnedKind::Collection),
        "parent_id" if template.starts_with("/api/v1/collections") => Some(OwnedKind::Collection),
        _ => None,
    }
}

pub fn query_references(template: &str, query: &str) -> Vec<(OwnedKind, String)> {
    let pairs: Vec<(String, String)> = serde_urlencoded::from_str(query).unwrap_or_default();
    let mut found = Vec::new();
    for (key, value) in pairs {
        if let Some(kind) = key_kind(template, &key) {
            found.extend(
                value.split(',').map(str::trim).filter(|id| !id.is_empty()).map(|id| (kind, id.to_string())),
            );
        }
    }
    found
}

pub fn json_references(template: &str, value: &serde_json::Value) -> Vec<(OwnedKind, String)> {
    fn walk(template: &str, value: &serde_json::Value, found: &mut Vec<(OwnedKind, String)>) {
        match value {
            serde_json::Value::Object(map) => {
                for (key, child) in map {
                    if let Some(kind) = key_kind(template, key) {
                        let ids: Vec<&str> = match child {
                            serde_json::Value::String(id) => vec![id.as_str()],
                            serde_json::Value::Array(items) => items.iter().filter_map(|item| item.as_str()).collect(),
                            _ => Vec::new(),
                        };
                        found.extend(
                            ids.into_iter().map(str::trim).filter(|id| !id.is_empty()).map(|id| (kind, id.to_string())),
                        );
                    }
                    walk(template, child, found);
                }
            }
            serde_json::Value::Array(items) => items.iter().for_each(|item| walk(template, item, found)),
            _ => {}
        }
    }
    let mut found = Vec::new();
    walk(template, value, &mut found);
    found
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_policies() {
        assert_eq!(route_policy("GET", "/api/v1/jobs"), RoutePolicy::Signed);
        assert_eq!(route_policy("GET", "/api/v1/jobs/:job_id"), RoutePolicy::Signed);
        assert_eq!(route_policy("GET", "/api/v1/providers/ocr"), RoutePolicy::Signed);
        assert_eq!(route_policy("GET", "/api/v1/fonts"), RoutePolicy::Signed);
        assert_eq!(route_policy("POST", "/api/v1/providers/deepseek/balance"), RoutePolicy::AdminOnly);
        assert_eq!(route_policy("POST", "/api/v1/fonts/upload"), RoutePolicy::AdminOnly);
        assert_eq!(route_policy("GET", "/api/v1/ai/runtime-config"), RoutePolicy::AdminOnly);
        assert_eq!(route_policy("GET", "/api/v1/credentials/:credential_ref"), RoutePolicy::AdminOnly);
        assert_eq!(route_policy("POST", "/api/v1/backups"), RoutePolicy::AdminOnly);
        assert_eq!(route_policy("POST", "/api/v1/sync/run"), RoutePolicy::AdminOnly);
        assert_eq!(route_policy("POST", "/api/v1/ai/ask"), RoutePolicy::Closed);
        assert_eq!(route_policy("GET", "/api/v1/ai/conversations"), RoutePolicy::Closed);
        assert_eq!(route_policy("GET", "/api/v1/documents/:document_id/agent-versions"), RoutePolicy::Closed);
        assert_eq!(route_policy("POST", "/api/v1/internal/model/jobs/:job_id/requests"), RoutePolicy::Closed);
        // 前缀要按段比较，别把 /api/v1/aix 当成 /api/v1/ai。
        assert_eq!(route_policy("GET", "/api/v1/aix"), RoutePolicy::Signed);
    }

    #[test]
    fn references_in_query_and_body() {
        assert_eq!(
            query_references("/api/v1/library/books", "job_ids=a,%20b,&limit=5&q=job_id"),
            vec![(OwnedKind::Job, "a".into()), (OwnedKind::Job, "b".into())]
        );
        let body = serde_json::json!({
            "source": { "upload_id": "up1", "artifact_job_id": "", "source_url": "" },
            "translation": { "glossary_id": "g1" },
            "items": [{ "document_id": "d1" }],
            "document_ids": ["d2", 3],
            "parent_id": "p1"
        });
        let mut found = json_references("/api/v1/jobs", &body);
        found.sort_by(|a, b| a.1.cmp(&b.1));
        assert_eq!(
            found,
            vec![
                (OwnedKind::Document, "d1".into()),
                (OwnedKind::Document, "d2".into()),
                (OwnedKind::Glossary, "g1".into()),
                (OwnedKind::Upload, "up1".into()),
            ]
        );
        assert!(json_references("/api/v1/collections", &body).contains(&(OwnedKind::Collection, "p1".into())));
    }

    /// 扫一遍路由源码，所有路径参数都必须分了类。新加路由带了新参数名，这里会红，提醒去决定它归谁。
    #[test]
    fn every_route_param_is_classified() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
        let mut files = vec![root.join("app/router.rs"), root.join("routes/model_requests.rs")];
        files.extend(
            std::fs::read_dir(root.join("app/router"))
                .unwrap()
                .map(|entry| entry.unwrap().path())
                .filter(|path| path.extension().is_some_and(|ext| ext == "rs")),
        );
        let mut seen = 0;
        for file in files {
            let source = std::fs::read_to_string(&file).unwrap();
            for literal in source.split('"').skip(1).step_by(2).filter(|s| s.starts_with("/api/")) {
                for segment in literal.split('/').filter(|s| s.starts_with(':') || s.starts_with('*')) {
                    let name = &segment[1..];
                    seen += 1;
                    assert_ne!(
                        classify_param(name),
                        ParamClass::Unknown,
                        "{}: route `{literal}` has unclassified path param `{name}`",
                        file.display()
                    );
                }
            }
        }
        assert!(seen > 50, "route scan found too few params ({seen}); did the router move?");
    }
}
