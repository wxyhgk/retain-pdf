//! 跑真的 `retainpdf`:配置目录与数据目录都是临时的,后端没开(或假装开着却连不上)。

use std::path::{Path, PathBuf};
use std::process::{Command, Output};

use serde_json::Value;

struct Sandbox {
    root: PathBuf,
}

impl Sandbox {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("retainpdf-cli-{:016x}", fastrand_u64()));
        std::fs::create_dir_all(root.join("data")).unwrap();
        Self { root }
    }

    fn home(&self) -> PathBuf {
        self.root.join("home")
    }

    fn data(&self) -> PathBuf {
        self.root.join("data")
    }

    fn run(&self, args: &[&str]) -> Output {
        Command::new(env!("CARGO_BIN_EXE_retainpdf"))
            .args(["--data", self.data().to_str().unwrap()])
            .args(args)
            .env("RETAINPDF_HOME", self.home())
            .env_remove("RETAINPDF_TRANSLATION_API_KEY")
            .env_remove("RETAINPDF_DATA_DIR")
            .output()
            .unwrap()
    }

    fn json(&self, args: &[&str]) -> Value {
        let mut all = vec!["--json"];
        all.extend_from_slice(args);
        let out = self.run(&all);
        assert!(out.status.success(), "{args:?}: {}", String::from_utf8_lossy(&out.stderr));
        serde_json::from_slice(&out.stdout).unwrap()
    }

    fn library(&self) {
        let db = retain_data::db::Db::new(self.data().join("db").join("jobs.db"), self.data());
        db.init().unwrap();
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn fastrand_u64() -> u64 {
    use std::hash::{BuildHasher, Hasher};
    let mut h = std::collections::hash_map::RandomState::new().build_hasher();
    h.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
    h.finish()
}

fn setting<'a>(show: &'a Value, key: &str) -> &'a Value {
    show["settings"].as_array().unwrap().iter().find(|s| s["key"] == key).unwrap()
}

#[test]
fn config_set_show_and_unset_with_secrets_masked() {
    let sb = Sandbox::new();
    sb.json(&["config", "set", "translation.provider", "custom"]);
    sb.json(&["config", "set", "providers.custom.base_url", "https://llm.example.com/v1"]);
    sb.json(&["config", "set", "providers.custom.model", "m1"]);
    sb.json(&["config", "set", "providers.custom.workers", "8"]);
    sb.json(&["config", "set", "providers.custom.api_key", "sk-cli-test-12345678"]);
    let show = sb.json(&["config", "show"]);
    assert_eq!(setting(&show, "translation.model")["value"], "m1");
    assert_eq!(setting(&show, "translation.workers")["value"], "8");
    assert_eq!(setting(&show, "translation.api_key")["value"], "****5678");
    assert!(!show.to_string().contains("sk-cli-test"), "secret leaked: {show}");
    assert_eq!(sb.json(&["config", "get", "providers.custom.api_key"])["value"], "****5678");

    // 不对的值:不写,说清楚原因。
    let bad = sb.run(&["config", "set", "providers.custom.workers", "0"]);
    assert_eq!(bad.status.code(), Some(1));
    assert!(String::from_utf8_lossy(&bad.stderr).contains("1 到 100"));
    let unknown = sb.run(&["config", "set", "providers.custom.colour", "red"]);
    assert!(String::from_utf8_lossy(&unknown.stderr).contains("没有这个配置项"));

    // 环境变量优先,来源写明。
    let out = Command::new(env!("CARGO_BIN_EXE_retainpdf"))
        .args(["--json", "config", "show"])
        .env("RETAINPDF_HOME", sb.home())
        .env("RETAINPDF_TRANSLATION_WORKERS", "3")
        .output()
        .unwrap();
    let show: Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(setting(&show, "translation.workers")["value"], "3");
    assert_eq!(setting(&show, "translation.workers")["source"], "环境变量 RETAINPDF_TRANSLATION_WORKERS");

    assert_eq!(sb.json(&["config", "unset", "providers.custom.workers"])["removed"], true);
    let show = sb.json(&["config", "show"]);
    assert_eq!(setting(&show, "translation.workers")["value"], "5", "back to the provider default");
}

#[test]
fn status_and_doctor_work_without_a_library_or_backend() {
    let sb = Sandbox::new();
    let status = sb.json(&["status"]);
    assert_eq!(status["backend"]["state"], "stopped");
    assert!(status["library"].is_null());
    let out = sb.run(&["--json", "doctor"]);
    // 没有密钥:检查不通过(退出码 2),但能把每一项说清楚。
    assert_eq!(out.status.code(), Some(2));
    let report: Value = serde_json::from_slice(&out.stdout).unwrap();
    let key = report["checks"].as_array().unwrap().iter().find(|c| c["check"] == "翻译 API Key").unwrap();
    assert_eq!(key["level"], "bad");
}

#[test]
fn backups_and_sync_work_directly_on_the_data_directory_when_no_backend_runs() {
    let sb = Sandbox::new();
    sb.library();
    let made = sb.json(&["backup", "create"]);
    let id = made["id"].as_str().unwrap().to_string();
    let list = sb.json(&["backup", "list"]);
    assert_eq!(list[0]["id"], id.as_str());
    // 恢复要确认:脚本里不加 --yes 就拒绝。
    let refused = sb.run(&["backup", "restore", "1"]);
    assert_eq!(refused.status.code(), Some(1));
    let restored = sb.json(&["backup", "restore", "1", "--yes"]);
    assert_eq!(restored["restored"], id.as_str());
    assert!(restored["safety_backup"].as_str().unwrap().starts_with("before-restore-"));

    let cloud = sb.root.join("cloud");
    std::fs::create_dir_all(&cloud).unwrap();
    let off = sb.run(&["sync", "on"]);
    assert!(String::from_utf8_lossy(&off.stderr).contains("请先选择同步文件夹"));
    sb.json(&["sync", "set", "--folder", cloud.to_str().unwrap(), "--device-name", "命令行"]);
    sb.json(&["sync", "on"]);
    let after = sb.json(&["sync", "run"]);
    assert_eq!(after["last_run"]["ok"], true, "{after}");
    assert_eq!(after["device_name"], "命令行");
    assert!(Path::new(&cloud.join("RetainPDF-Sync/format.json")).is_file());
    assert_eq!(sb.json(&["sync", "test"])["ok"], true);
}

#[test]
fn a_backend_that_is_recorded_but_unreachable_blocks_changes() {
    let sb = Sandbox::new();
    sb.library();
    std::fs::create_dir_all(sb.home().join("run")).unwrap();
    // 进程在(就是这个测试进程),端口没人听。
    let record = serde_json::json!({
        "api_base": "http://127.0.0.1:9", "api_key": "x",
        "data_dir": std::fs::canonicalize(sb.data()).unwrap(), "pid": std::process::id(), "started_at": "t",
    });
    std::fs::write(sb.home().join("run/backend.json"), record.to_string()).unwrap();
    let out = sb.run(&["backup", "create"]);
    assert_eq!(out.status.code(), Some(1));
    assert!(String::from_utf8_lossy(&out.stderr).contains("连不上"), "{}", String::from_utf8_lossy(&out.stderr));
    // 只读的照样能看。
    assert_eq!(sb.json(&["status"])["backend"]["state"], "unreachable");
}
