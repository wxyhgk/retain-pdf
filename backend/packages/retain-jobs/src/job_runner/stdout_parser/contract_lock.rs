//! pipeline-stdout.v1 契约锁（消费者侧）。
//!
//! 后端测试镜像在 backend-root/contracts/pipeline-stdout.v1.schema.json；本测试保证
//! rust 解析器与契约逐项一致：标签集合相等、artifact_published key 集合相等、
//! 指标/状态/前缀行的契约示例真的能驱动解析器落值。改协议先改 schema，
//! 两端（此处 + scripts/devtools/tests/pipeline）测试同步变绿才算完成。

use std::collections::BTreeSet;
use std::path::PathBuf;

use serde_json::Value;

use super::apply_line;
use super::artifact_fields::{artifact_field_from_key, ARTIFACT_LABEL_RULES};
use crate::models::domain::JobSnapshot;
use crate::models::request::CreateJobInput;

fn contract_path() -> PathBuf {
    // backend/packages/retain-jobs → packages → backend (test mirror).
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(2)
        .expect("backend root")
        .join("contracts/pipeline-stdout.v1.schema.json")
}

fn load_contract() -> Value {
    let raw = std::fs::read_to_string(contract_path()).expect("read pipeline-stdout contract");
    serde_json::from_str(&raw).expect("parse pipeline-stdout contract json")
}

fn build_job() -> JobSnapshot {
    JobSnapshot::new(
        "job-contract-lock".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    )
}

fn artifacts_json(job: &JobSnapshot) -> String {
    serde_json::to_string(&job.artifacts).expect("serialize artifacts")
}

#[test]
fn label_set_matches_contract_exactly() {
    let contract = load_contract();
    let schema_labels: BTreeSet<&str> = contract["artifact_labels"]
        .as_object()
        .expect("artifact_labels object")
        .keys()
        .map(String::as_str)
        .collect();
    let rust_labels: BTreeSet<&str> = ARTIFACT_LABEL_RULES
        .iter()
        .map(|(label, _)| *label)
        .collect();
    assert_eq!(
        rust_labels, schema_labels,
        "rust 标签表与契约不一致：改一侧必须同步另一侧与 schema"
    );
}

#[test]
fn every_labeled_line_example_lands_in_artifacts() {
    let contract = load_contract();
    for (label, _) in contract["artifact_labels"].as_object().unwrap() {
        let mut job = build_job();
        let value = format!("/contract-lock/{}", label.replace(' ', "-"));
        apply_line(&mut job, &format!("{label}: {value}"));
        assert!(
            artifacts_json(&job).contains(&value),
            "标签行 `{label}: <value>` 未被解析进 artifacts"
        );
    }
}

#[test]
fn emit_only_labels_are_ignored_by_parser() {
    let contract = load_contract();
    for (label, _) in contract["emit_only_labels"].as_object().unwrap() {
        let mut job = build_job();
        let value = format!("/emit-only/{}", label.replace(' ', "-"));
        apply_line(&mut job, &format!("{label}: {value}"));
        assert!(
            !artifacts_json(&job).contains(&value),
            "emit-only 标签 `{label}` 不应被 rust 当工件行解析；若开始消费请把它移入 artifact_labels"
        );
    }
}

#[test]
fn artifact_event_keys_match_contract_exactly() {
    let contract = load_contract();
    let keys_obj = contract["artifact_event"]["artifact_keys"]
        .as_object()
        .expect("artifact_keys object");

    // 正向：契约里每个 canonical key + 别名都被接受，且事件行真的落值
    let mut contract_keys: BTreeSet<String> = BTreeSet::new();
    for (canonical, aliases) in keys_obj {
        contract_keys.insert(canonical.clone());
        assert!(
            artifact_field_from_key(canonical).is_some(),
            "契约 key `{canonical}` 未被 rust 接受"
        );
        for alias in aliases.as_array().unwrap() {
            let alias = alias.as_str().unwrap();
            contract_keys.insert(alias.to_string());
            assert!(
                artifact_field_from_key(alias).is_some(),
                "契约别名 `{alias}` 未被 rust 接受"
            );
        }
        let mut job = build_job();
        let path = format!("/event/{canonical}");
        let line = format!(
            r#"{{"event_type": "artifact_published", "payload": {{"artifact_key": "{canonical}", "path": "{path}"}}}}"#
        );
        apply_line(&mut job, &line);
        assert!(
            artifacts_json(&job).contains(&path),
            "artifact_published key `{canonical}` 未落进 artifacts"
        );
    }

    // emit-only key：python 发射但 rust 明确不消费；若开始消费必须移入 artifact_keys
    for (key, _) in contract["artifact_event"]["emit_only_keys"]
        .as_object()
        .expect("emit_only_keys object")
    {
        assert!(
            artifact_field_from_key(key).is_none(),
            "emit-only key `{key}` 被 rust 接受了——请把它移入契约 artifact_keys"
        );
    }

    // 反向：rust 源码 match 臂里出现的 key 不得超出契约（扫源码字符串字面量）
    let source = include_str!("artifact_fields.rs");
    let body = source
        .split("fn artifact_field_from_key")
        .nth(1)
        .expect("artifact_field_from_key body");
    let rust_keys: BTreeSet<String> = body
        .split('"')
        .skip(1)
        .step_by(2)
        .map(str::to_string)
        .collect();
    assert_eq!(
        rust_keys, contract_keys,
        "rust artifact_field_from_key 接受的 key 集合与契约不一致"
    );
}

#[test]
fn metric_line_examples_parse_and_match_patterns() {
    let contract = load_contract();
    for entry in contract["metric_lines"].as_array().unwrap() {
        let metric = entry["metric"].as_str().unwrap();
        let pattern = entry["pattern"].as_str().unwrap();
        let example = entry["example"].as_str().unwrap();

        let re = regex::Regex::new(pattern).expect("契约 pattern 必须是合法正则");
        assert!(re.is_match(example), "契约示例不匹配自身 pattern：{metric}");

        let mut job = build_job();
        apply_line(&mut job, example);
        let artifacts = serde_json::to_value(&job.artifacts).unwrap();
        // 指标名即 JobArtifacts 字段名；示例行必须让该字段非空
        let field = artifacts.get(metric).cloned().unwrap_or(Value::Null);
        assert!(
            !field.is_null(),
            "指标行示例未落进 JobArtifacts.{metric}：{example}"
        );
    }
}

#[test]
fn provider_state_and_stage_prefix_examples_drive_state_machine() {
    let contract = load_contract();

    let separator = contract["provider_state_lines"]["separator"]
        .as_str()
        .unwrap();
    for example in contract["provider_state_lines"]["examples"]
        .as_array()
        .unwrap()
    {
        let example = example.as_str().unwrap();
        let mut job = build_job();
        apply_line(&mut job, example);
        // 状态行的 <id> 必须写入 provider 诊断（handle.batch_id/task_id）
        let id = example
            .split(separator)
            .next()
            .and_then(|head| head.split_whitespace().last())
            .expect("state line id");
        assert!(
            artifacts_json(&job).contains(id),
            "provider 状态行示例未把 id 写入诊断：{example}"
        );
    }

    for rule in contract["stage_prefix_rules"].as_array().unwrap() {
        let example = rule["example"].as_str().unwrap();
        let mut job = build_job();
        let before = (job.stage.clone(), job.stage_detail.clone());
        apply_line(&mut job, example);
        assert_ne!(
            before,
            (job.stage.clone(), job.stage_detail.clone()),
            "阶段前缀行示例未推动 stage：{example}"
        );
    }
}

#[test]
fn checkpoint_event_example_is_accepted_by_durable_parser() {
    let contract = load_contract();
    let example = contract["checkpoint_event"]["example"]
        .as_str()
        .expect("checkpoint event example");
    let parsed = super::parse_pipeline_checkpoint_line(example)
        .expect("checkpoint contract example must parse");
    assert_eq!(parsed.schema, "pipeline_checkpoint_v1");
    assert_eq!(parsed.stage, "translate");
    assert_eq!(parsed.committed_pages.len(), 1);
    assert_eq!(parsed.committed_pages[0].page_hash.len(), 64);
    assert!(!parsed.committed_pages[0].changed_item_ids.is_empty());
}

#[test]
fn stage_observation_example_is_accepted_by_durable_parser() {
    let contract = load_contract();
    let example = contract["stage_observation_event"]["example"]
        .as_str()
        .expect("stage observation example");
    let parsed = super::parse_pipeline_stage_observation_line(example)
        .expect("stage observation contract example must parse");
    assert_eq!(parsed.schema, "pipeline_stage_observation_v1");
    assert_eq!(parsed.event_type, "stage_progress");
    assert_eq!(parsed.user_stage, "translation");
}
