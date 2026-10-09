//! 命令运行的环境:配置、数据目录、后端开着没有。
//!
//! 同一个数据目录同一时间只能有一个程序写:后端开着(`~/.retainpdf/run/backend.json` 记着、
//! 进程在、数据目录相同、`/health` 应答)时,会改东西的命令都转给后端;后端没开时直接操作
//! 数据目录;记录说开着却连不上时,会改东西的命令拒绝执行。

use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::{bail, Context, Result};
use retain_config::{BackendRuntime, ConfigHome, Settings};
use serde_json::Value;

use retain_data::db::Db;

pub struct Ctx {
    pub json: bool,
    pub home: ConfigHome,
    pub data_dir: PathBuf,
    pub backend: BackendState,
}

pub enum BackendState {
    /// 没有在用这个数据目录的后端。
    Stopped,
    Running(Backend),
    /// 记录说在运行(进程也在),但连不上。
    Unreachable(BackendRuntime),
}

pub struct Backend {
    pub runtime: BackendRuntime,
    client: reqwest::blocking::Client,
}

/// 桌面版默认的数据目录(打包后的应用名是 RetainPDF)。
pub fn default_data_dir() -> PathBuf {
    let home = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")).map(PathBuf::from).unwrap_or_default();
    if cfg!(target_os = "macos") {
        home.join("Library/Application Support/RetainPDF/data")
    } else if cfg!(windows) {
        std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join("AppData/Roaming"))
            .join("RetainPDF/data")
    } else {
        std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".config"))
            .join("RetainPDF/data")
    }
}

fn same_dir(a: &Path, b: &Path) -> bool {
    match (std::fs::canonicalize(a), std::fs::canonicalize(b)) {
        (Ok(a), Ok(b)) => a == b,
        _ => a == b,
    }
}

impl Ctx {
    pub fn load(json: bool, data: Option<PathBuf>) -> Result<Self> {
        let home = ConfigHome::locate()?;
        let runtime = home.backend_runtime().unwrap_or(None);
        // 数据目录:--data > 配置(环境变量 / 文件)> 正在运行的后端用的 > 桌面版默认。
        let configured = home.settings().ok().and_then(|s| s.data_dir);
        let data_dir = data
            .or(configured)
            .or_else(|| runtime.as_ref().map(|r| PathBuf::from(&r.data_dir)))
            .unwrap_or_else(default_data_dir);
        let backend = match runtime {
            Some(runtime) if same_dir(Path::new(&runtime.data_dir), &data_dir) => {
                let backend = Backend::new(runtime.clone())?;
                if backend.healthy() {
                    BackendState::Running(backend)
                } else {
                    BackendState::Unreachable(runtime)
                }
            }
            _ => BackendState::Stopped,
        };
        Ok(Self { json, home, data_dir, backend })
    }

    pub fn settings(&self) -> Result<Settings> {
        self.home.settings()
    }

    pub fn db_path(&self) -> PathBuf {
        self.data_dir.join("db").join("jobs.db")
    }

    /// 直接打开数据库(会建表、补迁移)。只在后端没开时用来改东西。
    pub fn db(&self) -> Result<Db> {
        if !self.db_path().is_file() {
            bail!("{} 里还没有书库(数据库不存在)。先打开一次 RetainPDF,或用 --data 指定数据目录", self.data_dir.display());
        }
        Ok(Db::new(self.db_path(), self.data_dir.clone()))
    }

    /// 只读打开数据库(查状态用;后端开着时读也安全)。没有数据库为 None。
    pub fn read_db(&self) -> Result<Option<rusqlite::Connection>> {
        if !self.db_path().is_file() {
            return Ok(None);
        }
        let conn = rusqlite::Connection::open_with_flags(
            self.db_path(),
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
        .with_context(|| format!("无法打开 {}", self.db_path().display()))?;
        conn.busy_timeout(Duration::from_secs(5))?;
        Ok(Some(conn))
    }

    /// 会改东西的命令:后端开着返回它,没开返回 None,连不上报错。
    pub fn writer(&self) -> Result<Option<&Backend>> {
        match &self.backend {
            BackendState::Running(backend) => Ok(Some(backend)),
            BackendState::Stopped => Ok(None),
            BackendState::Unreachable(runtime) => bail!(
                "后端在运行(进程 {})但连不上 {}。等它启动完成再试,或者先退出 RetainPDF",
                runtime.pid,
                runtime.api_base
            ),
        }
    }
}

impl Backend {
    fn new(runtime: BackendRuntime) -> Result<Self> {
        let client = reqwest::blocking::Client::builder()
            .connect_timeout(Duration::from_secs(3))
            .timeout(Duration::from_secs(600))
            .build()?;
        Ok(Self { runtime, client })
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.runtime.api_base.trim_end_matches('/'), path)
    }

    fn healthy(&self) -> bool {
        self.client
            .get(self.url("/health"))
            .timeout(Duration::from_secs(3))
            .send()
            .is_ok_and(|r| r.status().is_success())
    }

    /// `/health` 的内容(不需要密钥)。
    pub fn health(&self) -> Result<Value> {
        let value: Value = self.client.get(self.url("/health")).timeout(Duration::from_secs(5)).send()?.json()?;
        Ok(value.get("data").cloned().unwrap_or(value))
    }

    pub fn ready(&self) -> Result<Value> {
        let value: Value = self.client.get(self.url("/ready")).timeout(Duration::from_secs(5)).send()?.json()?;
        Ok(value.get("data").cloned().unwrap_or(value))
    }

    /// 调接口,返回信封里的 `data`;失败时用后端给的说明报错。
    pub fn call(&self, method: reqwest::Method, path: &str, body: Option<&Value>) -> Result<Value> {
        let mut request = self.client.request(method, self.url(path)).header("X-API-Key", &self.runtime.api_key);
        if let Some(body) = body {
            request = request.json(body);
        }
        let response = request.send().with_context(|| format!("连不上后端 {}", self.runtime.api_base))?;
        let status = response.status();
        let value: Value = response.json().unwrap_or(Value::Null);
        if !status.is_success() {
            let message = value
                .get("message")
                .and_then(Value::as_str)
                .or_else(|| value.pointer("/error/message").and_then(Value::as_str))
                .unwrap_or("后端返回了错误");
            bail!("{message}(HTTP {})", status.as_u16());
        }
        Ok(value.get("data").cloned().unwrap_or(value))
    }

    pub fn get(&self, path: &str) -> Result<Value> {
        self.call(reqwest::Method::GET, path, None)
    }

    pub fn post(&self, path: &str, body: Option<&Value>) -> Result<Value> {
        self.call(reqwest::Method::POST, path, body)
    }
}
