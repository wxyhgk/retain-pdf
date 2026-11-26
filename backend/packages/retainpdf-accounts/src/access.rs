//! 多用户模式下「网站账号能访问什么」。只管浏览器会话来的请求；单机模式、内部服务钥匙、助手临时授权
//! 都不经过这里（它们本来就是全权的，或者另有授权）。
//!
//! 两道关：
//! 1. 按路由：有的路由只给管理员（凭据、同步、备份、运行配置……），有的这一期对网站账号整个关掉
//!    （助手相关——助手能读全部数据、跑命令，等按用户隔离做完再开）。每条路由归哪一种写在 rust_api 的
//!    接口登记表里（`app/router/*.rs`，2026-10-17 起），调用方查好 [`RoutePolicy`] 传进来，这里不再按地址前缀猜。
//! 2. 按路径参数：路径里出现任务 / 书 / 术语表 / 文件夹编号的，必须是自己的；别人的一律当不存在。
//!
//! 宁可错拒，不可错放：
//! - 登记表里没有的路由当关闭；
//! - 路径参数名不在下面的分类里就拒绝。
//! 测试会扫一遍所有路由：每个参数都要分了类；登录就能用、路径里又没有资源编号的接口（列表、新建……）
//! 只能靠处理函数自己按当前用户过滤，必须逐条登记、写明怎么隔离的。

use retainpdf_data::db::OwnedKind;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RoutePolicy {
    /// 登录了就能用（路径参数仍要过归属）。
    Signed,
    /// 只给管理员。
    AdminOnly,
    /// 这一期对网站账号关闭（回 404，看起来就是没有这个接口）。
    Closed,
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
        "tag_id" => ParamClass::Owned(OwnedKind::Tag),
        // version_id：书下面的译文版本，处理函数核对它属于这本书
        "item_id" | "page_idx" | "page" | "name" | "dataset" | "artifact_key" | "suggestion_id" | "path" | "version_id" => {
            ParamClass::Nested
        }
        // 只在管理员路由或已关闭路由里出现。
        // operation_id：内部的模型请求（/internal/model/jobs/:job_id/requests/:operation_id）
        "user_id" | "invite_id" | "backup_id" | "credential_ref" | "operation_id" | "artifact_id" => ParamClass::Nested,
        // agent_id：阅读页提问的 agent，登记表里写死的名字（/ai/agents/:agent_id/acp），不属于哪个用户
        "agent_id" => ParamClass::Nested,
        // thread_id：书下面的问答记录（/documents/:document_id/ask-threads/:thread_id），处理函数按书查，不在这本书上 404
        "thread_id" => ParamClass::Nested,
        // conversation_id、memory_id：阅读页提问的对话和记忆（/ai/ask-conversations/:conversation_id、/ai/memories/:memory_id），
        // 全局的用户数据没有归属列，只出现在多用户下关闭的路由里（2026-11-26）
        "conversation_id" | "memory_id" => ParamClass::Nested,
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
        "tag_id" | "tag_ids" => Some(OwnedKind::Tag),
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
    fn references_in_query_and_body() {
        assert_eq!(
            query_references("/api/v1/jobs", "job_ids=a,%20b,&limit=5&q=job_id"),
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
}
