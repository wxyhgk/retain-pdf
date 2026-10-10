//! `~/.retainpdf/` 目录:读写两个配置文件(保留注释)和「正在运行的后端」记录。

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use toml_edit::{DocumentMut, Item, Table};

use crate::keys::{describe_key, parse_value, KeyInfo, Store};

const CONFIG_FILE: &str = "config.toml";
const CREDENTIALS_FILE: &str = "credentials.toml";
const RUNTIME_FILE: &str = "run/backend.json";

const CONFIG_TEMPLATE: &str = r#"# RetainPDF 配置。命令行 `retainpdf config` 和桌面版设置页都读写这个文件,也可以直接改。
# 接口密钥不在这里,在同目录的 credentials.toml。
# 环境变量优先于这里(比如 RETAINPDF_TRANSLATION_MODEL),见 `retainpdf config show`。

[translation]
# 翻译用哪个服务商:deepseek / qwen / openai / anthropic / zhipu / custom
provider = "deepseek"

# 各服务商的设置;不写就用内置默认。workers 是同时发出的请求数(并发)。
# thinking 是思考深度:auto(默认,能关就关) / off / low / medium / high / max。
# [providers.deepseek]
# model = "deepseek-flash"
# workers = 50
# thinking = "auto"
#
# protocol 是接口协议:openai(/chat/completions,默认)、openai_responses(/responses)
# 或 anthropic(/messages)。
# [providers.custom]
# base_url = "https://llm.example.com/v1"
# protocol = "openai"
# model = "my-model"
# workers = 5

[ocr]
# paddle / mineru
provider = "paddle"

# [assistant]
# 阅读页 AI 助手;不写就和翻译用同一个服务商
# provider = "deepseek"
# model = "deepseek-flash"

# [backend]
# data_dir = "~/RetainPDF"     # 不写用桌面版的默认位置
# max_running_jobs = 2
"#;

const CREDENTIALS_TEMPLATE: &str = r#"# RetainPDF 的接口密钥(明文,只有本人可读)。用 `retainpdf setup` 或
# `retainpdf config set providers.deepseek.api_key` 填,也可以直接改。
"#;

/// 正在运行的后端(后端启动时写,退出时删)。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BackendRuntime {
    /// 例如 `http://127.0.0.1:41000`。
    pub api_base: String,
    /// 本机访问用的密钥(X-API-Key)。
    pub api_key: String,
    pub data_dir: String,
    pub pid: u32,
    pub started_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigHome {
    dir: PathBuf,
}

fn user_home() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
}

/// `~` 开头的路径展开成用户目录下。
pub fn expand_home(raw: &str) -> PathBuf {
    match raw.strip_prefix('~') {
        Some(rest) if rest.is_empty() || rest.starts_with('/') || rest.starts_with('\\') => {
            let home = user_home().unwrap_or_default();
            home.join(rest.trim_start_matches(['/', '\\']))
        }
        _ => PathBuf::from(raw),
    }
}

fn write_private(path: &Path, bytes: &[u8], private: bool) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| format!("failed to create {}", parent.display()))?;
    }
    let temp = path.with_extension(format!("tmp-{:016x}", fastrand::u64(..)));
    let result = (|| -> Result<()> {
        let mut options = fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        if private {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&temp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        fs::rename(&temp, path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result.with_context(|| format!("failed to write {}", path.display()))
}

impl ConfigHome {
    /// `RETAINPDF_HOME`,否则 `~/.retainpdf`。
    pub fn locate() -> Result<Self> {
        if let Some(dir) = std::env::var_os("RETAINPDF_HOME").filter(|v| !v.is_empty()) {
            return Ok(Self::at(expand_home(&dir.to_string_lossy())));
        }
        let Some(home) = user_home() else {
            bail!("找不到用户目录(HOME),请用 RETAINPDF_HOME 指定配置目录");
        };
        Ok(Self::at(home.join(".retainpdf")))
    }

    pub fn at(dir: impl Into<PathBuf>) -> Self {
        Self { dir: dir.into() }
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    pub fn config_path(&self) -> PathBuf {
        self.dir.join(CONFIG_FILE)
    }

    pub fn credentials_path(&self) -> PathBuf {
        self.dir.join(CREDENTIALS_FILE)
    }

    pub fn runtime_path(&self) -> PathBuf {
        self.dir.join(RUNTIME_FILE)
    }

    fn path_of(&self, store: Store) -> PathBuf {
        match store {
            Store::Config => self.config_path(),
            Store::Credentials => self.credentials_path(),
        }
    }

    /// 读一个文件;不存在时为空文档。
    pub fn read_document(&self, store: Store) -> Result<DocumentMut> {
        let path = self.path_of(store);
        match fs::read_to_string(&path) {
            Ok(text) => text
                .parse::<DocumentMut>()
                .with_context(|| format!("{} 格式不对,请检查(TOML)", path.display())),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(DocumentMut::new()),
            Err(error) => Err(error).with_context(|| format!("failed to read {}", path.display())),
        }
    }

    fn write_document(&self, store: Store, document: &DocumentMut) -> Result<()> {
        write_private(&self.path_of(store), document.to_string().as_bytes(), store == Store::Credentials)
    }

    pub(crate) fn write_document_pub(&self, store: Store, document: &DocumentMut) -> Result<()> {
        self.write_document(store, document)
    }

    /// 两个文件不存在就写下带注释的默认内容。
    pub fn ensure_files(&self) -> Result<()> {
        for (store, template) in [(Store::Config, CONFIG_TEMPLATE), (Store::Credentials, CREDENTIALS_TEMPLATE)] {
            let path = self.path_of(store);
            if !path.exists() {
                write_private(&path, template.as_bytes(), store == Store::Credentials)?;
            }
        }
        Ok(())
    }

    fn checked(path: &str) -> Result<KeyInfo> {
        describe_key(path).ok_or_else(|| anyhow::anyhow!("没有这个配置项:{path}(`retainpdf config keys` 列出全部)"))
    }

    /// 文件里写的值(不含默认与环境变量);没写为 None。
    pub fn get(&self, path: &str) -> Result<Option<toml_edit::Value>> {
        let key = Self::checked(path)?;
        let document = self.read_document(key.store)?;
        let mut item: &Item = document.as_item();
        for part in path.split('.') {
            match item.get(part) {
                Some(next) => item = next,
                None => return Ok(None),
            }
        }
        Ok(item.as_value().cloned())
    }

    /// 改一个值(校验后写进对应的文件,保留文件里的注释与其它内容)。
    pub fn set(&self, path: &str, raw: &str) -> Result<()> {
        let key = Self::checked(path)?;
        let value = parse_value(&key, raw)?;
        self.ensure_files()?;
        let mut document = self.read_document(key.store)?;
        let parts: Vec<&str> = path.split('.').collect();
        let mut table: &mut Table = document.as_table_mut();
        for part in &parts[..parts.len() - 1] {
            let entry = table.entry(part).or_insert_with(|| {
                let mut t = Table::new();
                t.set_implicit(true);
                Item::Table(t)
            });
            table = entry
                .as_table_mut()
                .ok_or_else(|| anyhow::anyhow!("{} 里的 {part} 不是一个表,请手动检查", self.path_of(key.store).display()))?;
        }
        table.insert(parts[parts.len() - 1], Item::Value(value));
        self.write_document(key.store, &document)
    }

    /// 删掉一个值(回到默认)。原来没写过为 false。
    pub fn unset(&self, path: &str) -> Result<bool> {
        let key = Self::checked(path)?;
        let mut document = self.read_document(key.store)?;
        let parts: Vec<&str> = path.split('.').collect();
        let mut table: &mut Table = document.as_table_mut();
        for part in &parts[..parts.len() - 1] {
            match table.get_mut(part).and_then(Item::as_table_mut) {
                Some(next) => table = next,
                None => return Ok(false),
            }
        }
        let removed = table.remove(parts[parts.len() - 1]).is_some();
        if removed {
            self.write_document(key.store, &document)?;
        }
        Ok(removed)
    }

    /// 正在运行的后端;没有记录、或记录的进程已经不在为 None。
    pub fn backend_runtime(&self) -> Result<Option<BackendRuntime>> {
        let text = match fs::read_to_string(self.runtime_path()) {
            Ok(text) => text,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error.into()),
        };
        let Ok(runtime) = serde_json::from_str::<BackendRuntime>(&text) else {
            return Ok(None);
        };
        Ok(process_alive(runtime.pid).then_some(runtime))
    }

    /// 后端启动后记下自己在哪(本机访问密钥也在里面,所以文件只有本人可读)。
    pub fn write_backend_runtime(&self, runtime: &BackendRuntime) -> Result<()> {
        write_private(&self.runtime_path(), &serde_json::to_vec_pretty(runtime)?, true)
    }

    /// 后端退出时删掉自己的记录(别的进程后来写的不删)。
    pub fn clear_backend_runtime(&self, pid: u32) -> Result<()> {
        if let Ok(text) = fs::read_to_string(self.runtime_path()) {
            if serde_json::from_str::<BackendRuntime>(&text).is_ok_and(|r| r.pid == pid) {
                let _ = fs::remove_file(self.runtime_path());
            }
        }
        Ok(())
    }
}

#[cfg(unix)]
fn process_alive(pid: u32) -> bool {
    // kill -0:只问进程在不在,不发信号。
    std::process::Command::new("kill")
        .args(["-0", &pid.to_string()])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok_and(|s| s.success())
}

#[cfg(not(unix))]
fn process_alive(_pid: u32) -> bool {
    // Windows:不判断,交给调用方连一下看看。
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_home() -> ConfigHome {
        let dir = std::env::temp_dir().join(format!("retain-config-{:016x}", fastrand::u64(..)));
        ConfigHome::at(dir)
    }

    #[test]
    fn set_keeps_comments_and_puts_secrets_in_a_private_file() {
        let home = temp_home();
        home.set("providers.deepseek.workers", "64").unwrap();
        home.set("providers.deepseek.api_key", "sk-test-1234567890").unwrap();
        home.set("translation.provider", "deepseek").unwrap();
        let config = fs::read_to_string(home.config_path()).unwrap();
        assert!(config.contains("# RetainPDF 配置"), "template comments kept:\n{config}");
        assert!(config.contains("[providers.deepseek]\nworkers = 64"), "{config}");
        assert!(!config.contains("sk-test"), "secrets never land in config.toml");
        let credentials = fs::read_to_string(home.credentials_path()).unwrap();
        assert!(credentials.contains("api_key = \"sk-test-1234567890\""), "{credentials}");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = fs::metadata(home.credentials_path()).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600);
        }
        // 手写的注释在改值之后还在。
        let edited = config.replace("[ocr]", "# 我自己的备注\n[ocr]");
        fs::write(home.config_path(), edited).unwrap();
        home.set("ocr.provider", "mineru").unwrap();
        let after = fs::read_to_string(home.config_path()).unwrap();
        assert!(after.contains("# 我自己的备注"));
        assert!(after.contains("provider = \"mineru\""));
        assert_eq!(home.get("providers.deepseek.workers").unwrap().and_then(|v| v.as_integer()), Some(64));

        assert!(home.unset("providers.deepseek.workers").unwrap());
        assert!(!home.unset("providers.deepseek.workers").unwrap());
        assert!(home.get("providers.deepseek.workers").unwrap().is_none());
        assert!(home.set("providers.deepseek.workers", "1000").is_err());
        assert!(home.set("no.such.key", "1").is_err());
        fs::remove_dir_all(home.dir()).unwrap();
    }

    #[test]
    fn a_broken_file_is_reported_not_overwritten() {
        let home = temp_home();
        fs::create_dir_all(home.dir()).unwrap();
        fs::write(home.config_path(), "[translation\nprovider = ").unwrap();
        let error = home.set("translation.provider", "qwen").unwrap_err().to_string();
        assert!(error.contains("格式不对"), "{error}");
        assert_eq!(fs::read_to_string(home.config_path()).unwrap(), "[translation\nprovider = ");
        fs::remove_dir_all(home.dir()).unwrap();
    }

    #[test]
    fn the_backend_record_is_ignored_once_its_process_is_gone() {
        let home = temp_home();
        let mine = BackendRuntime {
            api_base: "http://127.0.0.1:41000".into(),
            api_key: "local".into(),
            data_dir: "/data".into(),
            pid: std::process::id(),
            started_at: "t".into(),
        };
        home.write_backend_runtime(&mine).unwrap();
        assert_eq!(home.backend_runtime().unwrap(), Some(mine.clone()));
        home.write_backend_runtime(&BackendRuntime { pid: 999_999_999, ..mine.clone() }).unwrap();
        assert_eq!(home.backend_runtime().unwrap(), None);
        // 别的进程的记录不删。
        home.clear_backend_runtime(std::process::id()).unwrap();
        assert!(home.runtime_path().exists());
        home.clear_backend_runtime(999_999_999).unwrap();
        assert!(!home.runtime_path().exists());
        fs::remove_dir_all(home.dir()).unwrap();
    }

    #[test]
    fn home_relative_paths_expand() {
        let home = user_home().unwrap();
        assert_eq!(expand_home("~/RetainPDF"), home.join("RetainPDF"));
        assert_eq!(expand_home("/abs/path"), PathBuf::from("/abs/path"));
        assert_eq!(expand_home("~other"), PathBuf::from("~other"));
    }
}
