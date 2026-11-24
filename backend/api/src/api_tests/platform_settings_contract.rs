//! 平台设置契约 `platform-settings.v1` 的生产者锁（设置类第 2 批第 3～5 组，2026-11-24）：字体、同步、备份、健康检查。
//!
//! 返回：打真实接口，拿 serde 实际写出来的 JSON，对着 backend-root/contracts 里的定义核对类型和键集合
//! （多一个键、少一个键都红）。请求：`SyncSettingsInput` 是 `deny_unknown_fields`，契约的 `properties` 要和 Rust 认的字段一样。

use super::credentials_contract::{assert_exact, ok_data};
use super::job_view_contract::contract;
use super::jobs_common::test_state;

const CONTRACT: &str = "platform-settings.v1.schema.json";

#[tokio::test]
async fn font_list_matches_published_schema() {
    let state = test_state("platform-settings-fonts");
    let contract = contract(CONTRACT);
    // 测试的字体目录里放一个文件，列表里至少有一项（系统字体有没有看机器）。
    let fonts_dir = state.config.data_root.join("fonts");
    std::fs::create_dir_all(&fonts_dir).unwrap();
    std::fs::write(fonts_dir.join("ContractTest-Regular.otf"), b"not really a font").unwrap();

    let fonts = ok_data(&state, "GET", "/api/v1/fonts", None).await;
    super::job_view_contract::assert_definition(&fonts, &contract, "FontListView", "fonts");
    let items = fonts.as_array().expect("fonts is an array");
    assert!(!items.is_empty(), "{fonts}");
    for (index, item) in items.iter().enumerate() {
        assert_exact(item, &contract, "FontInfo", &format!("fonts[{index}]"));
    }
}

fn temp_folder(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("retain-sync-contract-{name}-{:016x}", fastrand::u64(..)));
    std::fs::create_dir_all(&dir).expect("create folder");
    std::fs::canonicalize(dir).expect("canonical folder")
}

fn assert_sync_status(value: &serde_json::Value, contract: &serde_json::Value, path: &str) {
    assert_exact(value, contract, "SyncStatusView", path);
    if !value["last_run"].is_null() {
        assert_exact(&value["last_run"], contract, "SyncRunView", &format!("{path}.last_run"));
    }
    if !value["last_maintenance"].is_null() {
        assert_exact(&value["last_maintenance"], contract, "SyncMaintenanceView", &format!("{path}.last_maintenance"));
    }
    for (index, peer) in value["peers"].as_array().expect("peers").iter().enumerate() {
        assert_exact(peer, contract, "SyncPeerView", &format!("{path}.peers[{index}]"));
    }
    for (index, item) in value["pending"].as_array().expect("pending").iter().enumerate() {
        assert_exact(item, contract, "SyncPendingItemView", &format!("{path}.pending[{index}]"));
    }
}

/// 两个后端共用一个同步文件夹：b 跑完以后 `peers` 里有 a、`last_run` 有值。
#[tokio::test]
async fn sync_views_match_published_schema() {
    let contract = contract(CONTRACT);
    let a = test_state("platform-settings-sync-a");
    let b = test_state("platform-settings-sync-b");
    let cloud = temp_folder("cloud");

    let off = ok_data(&a, "GET", "/api/v1/sync", None).await;
    assert_sync_status(&off, &contract, "get(off)");

    let tested = ok_data(&a, "POST", "/api/v1/sync/test", Some(serde_json::json!({ "folder": cloud.to_string_lossy() }))).await;
    assert_exact(&tested, &contract, "SyncTestView", "test");
    assert_eq!(tested["ok"], true, "{tested}");

    for (state, name) in [(&a, "Mac A"), (&b, "Mac B")] {
        let saved = ok_data(
            state,
            "PUT",
            "/api/v1/sync",
            Some(serde_json::json!({ "folder": cloud.to_string_lossy(), "enabled": true, "device_name": name })),
        )
        .await;
        assert_sync_status(&saved, &contract, "put");
    }
    let ran = ok_data(&a, "POST", "/api/v1/sync/run", None).await;
    assert_sync_status(&ran, &contract, "run(a)");
    assert!(ran["last_run"].is_object(), "{ran}");
    let ran = ok_data(&b, "POST", "/api/v1/sync/run", None).await;
    assert_sync_status(&ran, &contract, "run(b)");
    assert_eq!(ran["peers"].as_array().map(Vec::len), Some(1), "{ran}");
}

/// 等待区、整理同步文件夹的结果在上面的流程里不一定出现：拿 serde 写出来的样子核对键集合。
#[test]
fn sync_pending_and_maintenance_items_match_published_schema() {
    use crate::models::api::{SyncMaintenanceView, SyncPendingItemView};
    let contract = contract(CONTRACT);
    let pending = serde_json::to_value(SyncPendingItemView {
        kind: "file".into(),
        key: "k".into(),
        reason: "waiting".into(),
        attempts: 1,
    })
    .unwrap();
    assert_exact(&pending, &contract, "SyncPendingItemView", "pending[0]");
    let maintenance = serde_json::to_value(SyncMaintenanceView::default()).unwrap();
    assert_exact(&maintenance, &contract, "SyncMaintenanceView", "last_maintenance");
}

#[test]
fn sync_settings_input_accepts_exactly_the_contract_fields() {
    let contract = contract(CONTRACT);
    super::library_documents_contract::assert_request_fields_match::<crate::models::api::SyncSettingsInput>(
        &contract,
        "SyncSettingsInput",
    );
}

fn assert_backup_status(value: &serde_json::Value, contract: &serde_json::Value, path: &str) {
    assert_exact(value, contract, "BackupStatusView", path);
    if !value["last_restore"].is_null() {
        assert_exact(&value["last_restore"], contract, "LastRestoreView", &format!("{path}.last_restore"));
    }
    for (index, item) in value["items"].as_array().expect("items").iter().enumerate() {
        assert_exact(item, contract, "BackupItemView", &format!("{path}.items[{index}]"));
    }
}

/// 立即备份、恢复（有了 `last_restore`）、删掉恢复前自动存的那份。
#[tokio::test]
async fn backup_views_match_published_schema() {
    let contract = contract(CONTRACT);
    let state = test_state("platform-settings-backups");
    state.db.init().expect("init");

    let empty = ok_data(&state, "GET", "/api/v1/backups", None).await;
    assert_backup_status(&empty, &contract, "get(empty)");

    let made = ok_data(&state, "POST", "/api/v1/backups", None).await;
    assert_exact(&made, &contract, "BackupItemView", "create");
    let id = made["id"].as_str().expect("id").to_string();

    let restored = ok_data(&state, "POST", &format!("/api/v1/backups/{id}/restore"), None).await;
    assert_exact(&restored, &contract, "BackupRestoreView", "restore");
    assert_backup_status(&restored["status"], &contract, "restore.status");
    assert!(restored["status"]["last_restore"].is_object(), "{restored}");

    let safety = restored["safety_backup"].as_str().expect("safety_backup").to_string();
    let after_delete = ok_data(&state, "DELETE", &format!("/api/v1/backups/{safety}"), None).await;
    assert_backup_status(&after_delete, &contract, "delete");
}
