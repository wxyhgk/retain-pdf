//! ai-conversations.v1 契约锁（生产者侧）。
//!
//! 后端测试镜像在 backend-root/contracts/ai-conversations.v1.schema.json。本测试保证
//! rust 的视图/输入结构体与契约逐字段一致（序列化键集合相等、输入按契约
//! 示例可反序列化、必填缺失即拒绝），且七个端点路径真实挂载在 router。
//! 消费者侧锁：ai_service tests/test_conversations_contract.py、
//! frontend tests/ai-conversations-contract.test.mjs。

use std::collections::BTreeSet;
use std::path::PathBuf;

use serde_json::{json, Value};

use crate::models::api::{
    AppendMessageInput, ConversationDetailView, ConversationListView, ConversationMutationResult,
    ConversationRecord, CreateConversationInput, ForkConversationInput, ForkMessageInput,
    ListConversationsQuery, MessageRecord, PatchConversationInput,
};

fn contract() -> Value {
    // api → backend-root
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("backend root")
        .join("contracts/ai-conversations.v1.schema.json");
    serde_json::from_str(&std::fs::read_to_string(path).expect("read contract"))
        .expect("parse contract")
}

fn schema_keys(contract: &Value, definition: &str) -> BTreeSet<String> {
    contract["definitions"][definition]["properties"]
        .as_object()
        .unwrap_or_else(|| panic!("definition {definition} missing properties"))
        .keys()
        .cloned()
        .collect()
}

fn value_keys(value: &Value) -> BTreeSet<String> {
    value
        .as_object()
        .expect("serialized struct must be object")
        .keys()
        .cloned()
        .collect()
}

fn sample_conversation() -> ConversationRecord {
    ConversationRecord {
        conversation_id: "conv-1".into(),
        title: "t".into(),
        document_id: None,
        created_at: "2026-01-01T00:00:00Z".into(),
        updated_at: "2026-01-01T00:00:00Z".into(),
        message_count: 0,
        head_id: String::new(),
    }
}

fn sample_message() -> MessageRecord {
    MessageRecord {
        message_id: "m-1".into(),
        conversation_id: "conv-1".into(),
        seq: 1,
        role: "user".into(),
        content: "hi".into(),
        citations_json: String::new(),
        tool_trace_json: String::new(),
        model: String::new(),
        created_at: "2026-01-01T00:00:00Z".into(),
        parent_id: String::new(),
    }
}

#[test]
fn output_views_serialize_exactly_to_contract_fields() {
    let contract = contract();

    let conv = serde_json::to_value(sample_conversation()).unwrap();
    assert_eq!(
        value_keys(&conv),
        schema_keys(&contract, "ConversationRecord")
    );

    let msg = serde_json::to_value(sample_message()).unwrap();
    assert_eq!(value_keys(&msg), schema_keys(&contract, "MessageRecord"));

    let list = serde_json::to_value(ConversationListView {
        conversations: vec![sample_conversation()],
        total: 1,
        limit: 50,
        offset: 0,
        has_more: false,
    })
    .unwrap();
    assert_eq!(
        value_keys(&list),
        schema_keys(&contract, "ConversationListView")
    );

    // DetailView = ConversationRecord 平铺 + messages（契约 flatten_of 语义）
    let detail = serde_json::to_value(ConversationDetailView {
        conversation: sample_conversation(),
        messages: vec![sample_message()],
    })
    .unwrap();
    let mut expected: BTreeSet<String> = schema_keys(&contract, "ConversationRecord");
    expected.extend(schema_keys(&contract, "ConversationDetailView"));
    assert_eq!(value_keys(&detail), expected);
    assert_eq!(
        contract["definitions"]["ConversationDetailView"]["flatten_of"],
        json!("ConversationRecord")
    );

    let deleted = serde_json::to_value(ConversationMutationResult { deleted: true }).unwrap();
    assert_eq!(
        value_keys(&deleted),
        schema_keys(&contract, "ConversationMutationResult")
    );
}

#[test]
fn inputs_accept_contract_shaped_payloads() {
    let contract = contract();

    // 全字段载荷（按契约 properties 逐项造值）必须可反序列化
    fn full_payload(contract: &Value, definition: &str) -> Value {
        let props = contract["definitions"][definition]["properties"]
            .as_object()
            .unwrap();
        let mut obj = serde_json::Map::new();
        for (key, spec) in props {
            let value = match spec["type"].as_str() {
                Some("integer") => json!(1),
                Some("boolean") => json!(true),
                _ => match spec["enum"].as_array() {
                    Some(options) => options[0].clone(),
                    None => json!("x"),
                },
            };
            obj.insert(key.clone(), value);
        }
        Value::Object(obj)
    }

    serde_json::from_value::<CreateConversationInput>(full_payload(
        &contract,
        "CreateConversationInput",
    ))
    .expect("CreateConversationInput full payload");
    serde_json::from_value::<ListConversationsQuery>(full_payload(
        &contract,
        "ListConversationsQuery",
    ))
    .expect("ListConversationsQuery full payload");
    serde_json::from_value::<PatchConversationInput>(full_payload(
        &contract,
        "PatchConversationInput",
    ))
    .expect("PatchConversationInput full payload");
    serde_json::from_value::<AppendMessageInput>(full_payload(&contract, "AppendMessageInput"))
        .expect("AppendMessageInput full payload");
    // fork 新增：单条 + 批量
    serde_json::from_value::<ForkMessageInput>(full_payload(&contract, "ForkMessageInput"))
        .expect("ForkMessageInput full payload");
    serde_json::from_value::<ForkConversationInput>(json!({
        "messages": [{"role":"user","content":"hi"}]
    }))
    .expect("ForkConversationInput minimal payload");

    // 必填约束与契约一致：required 之外全省略必须成功，缺 required 必须失败
    serde_json::from_value::<CreateConversationInput>(json!({})).expect("create: 全默认");
    serde_json::from_value::<PatchConversationInput>(json!({})).expect("patch: 全默认");
    serde_json::from_value::<AppendMessageInput>(json!({"role": "user", "content": "hi"}))
        .expect("append: 仅必填");
    assert!(
        serde_json::from_value::<AppendMessageInput>(json!({"content": "hi"})).is_err(),
        "append 缺 role 必须拒绝"
    );
    assert!(
        serde_json::from_value::<AppendMessageInput>(json!({"role": "user"})).is_err(),
        "append 缺 content 必须拒绝"
    );
    let required: Vec<&str> = contract["definitions"]["AppendMessageInput"]["required"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| item.as_str().unwrap())
        .collect();
    assert_eq!(required, vec!["role", "content"]);
}

#[test]
fn all_contract_endpoints_are_mounted_in_router() {
    let contract = contract();
    let router_source = include_str!("../app/router/ai.rs");
    for endpoint in contract["endpoints"].as_array().unwrap() {
        let path = endpoint["path"].as_str().unwrap();
        assert!(
            router_source.contains(&format!("\"{path}\"")),
            "契约端点未挂载: {path}"
        );
    }
}
