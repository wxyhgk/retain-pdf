//! jobs-control.v1 契约锁（消费者侧：壳）。
//!
//! 后端测试镜像在 backend-root/contracts/jobs-control.v1.schema.json。壳发往 jobsd 的
//! 路径集合必须与契约端点**双向相等**——壳打了契约外的路径（jobsd 返 404）
//! 或契约里有壳从不使用的端点（死接口）都红。生产者侧锁在
//! crates/retain-jobsd/src/contract_lock.rs。

use std::collections::BTreeSet;
use std::path::PathBuf;

use serde_json::Value;

fn contract() -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("backend root")
        .join("contracts/jobs-control.v1.schema.json");
    serde_json::from_str(&std::fs::read_to_string(path).expect("read jobs-control contract"))
        .expect("parse jobs-control contract")
}

/// 壳侧用 `format!("/internal/v1/jobs/{job_id}/cancel")` 这种内联插值写法，
/// 字面量里的 `{job_id}` 与契约的 `{job_id}` 恰好同形，可直接比对。
fn shell_request_paths() -> BTreeSet<String> {
    let source = include_str!("../services/runtime_gateway.rs");
    source
        .split('"')
        .skip(1)
        .step_by(2)
        .filter(|literal| literal.starts_with("/internal/"))
        .map(str::to_string)
        .collect()
}

#[test]
fn shell_paths_match_contract_exactly() {
    let contract = contract();
    let expected: BTreeSet<String> = contract["endpoints"]
        .as_array()
        .expect("endpoints array")
        .iter()
        .map(|endpoint| endpoint["path"].as_str().expect("path").to_string())
        .collect();

    let used = shell_request_paths();
    assert!(
        !used.is_empty(),
        "未从 runtime_gateway 提取到任何内部路径——扫描逻辑可能失效"
    );
    assert_eq!(
        used, expected,
        "壳发往 jobsd 的路径与 jobs-control.v1 契约不一致"
    );
}

#[test]
fn every_contract_op_traces_back_to_the_seam_it_replaced() {
    // 契约的每个操作都必须标注它取代了拆分前哪个接缝函数，否则说明有人
    // 凭空加了一个进程间操作——那正是"接缝只有这几个"这条约束该拦住的。
    let contract = contract();
    let seams: BTreeSet<&str> = contract["endpoints"]
        .as_array()
        .unwrap()
        .iter()
        .map(|endpoint| endpoint["seam_origin"].as_str().expect("seam_origin"))
        .collect();
    let expected: BTreeSet<&str> = [
        "JobRuntimeLauncher::launch",
        "RuntimeControl::request_cancel",
        "RuntimeControl::clear_cancel",
        "terminate_runtime_process",
    ]
    .into_iter()
    .collect();
    assert_eq!(
        seams, expected,
        "jobs-control 契约的操作集合必须与 runtime_gateway 的接缝一一对应"
    );
}

#[test]
fn default_mode_stays_in_process_so_topology_is_opt_in() {
    // 这一刀的安全网：不显式开 remote 时，行为与拆分前逐字节一致。
    let config = crate::config::JobsServiceConfig::default();
    assert!(
        !config.is_remote(),
        "默认必须是进程内——远端拓扑只应显式开启"
    );
}
