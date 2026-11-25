use std::collections::HashSet;
use std::net::IpAddr;
use std::path::Path;

use anyhow::{bail, Context, Result};
use serde::Deserialize;

use super::env_vars::{env_optional_string, env_usize};

#[derive(Clone, Debug)]
pub struct AuthRuntimeConfig {
    pub api_keys: HashSet<String>,
    /// AI 专用密钥（`RUST_API_AGENT_KEYS`，逗号分隔，可以不设）：只能调接口登记表里标了 `agent` 的接口。
    pub agent_keys: HashSet<String>,
    pub max_running_jobs: usize,
    pub simple_port: u16,
}

#[derive(Debug, Deserialize)]
struct LocalAuthConfig {
    #[serde(default)]
    api_keys: Vec<String>,
    max_running_jobs: Option<usize>,
    simple_port: Option<u16>,
}

impl AuthRuntimeConfig {
    pub fn from_env_or_file(auth_config_path: &Path) -> Result<Self> {
        let local_auth = load_local_auth_config(auth_config_path)?;
        Ok(Self {
            api_keys: resolve_api_keys(local_auth.as_ref())?,
            agent_keys: resolve_agent_keys(),
            max_running_jobs: resolve_max_running_jobs(local_auth.as_ref()),
            simple_port: resolve_simple_port(local_auth.as_ref())?,
        })
    }

    pub fn from_desktop(simple_port: u16, api_key: String, max_running_jobs: usize) -> Self {
        Self {
            api_keys: [api_key].into_iter().collect(),
            agent_keys: resolve_agent_keys(),
            max_running_jobs,
            simple_port,
        }
    }

    /// 同一把 key 既是主密钥又是 AI 专用密钥：拒绝启动。中间件先认 AI 专用密钥（宁可收窄），但配成这样多半是填错了。
    pub fn validate_agent_keys(&self) -> Result<()> {
        if self.agent_keys.iter().any(|key| self.api_keys.contains(key)) {
            bail!("RUST_API_AGENT_KEYS must not reuse a main API key (RUST_API_KEYS / auth.local.json / desktop key)");
        }
        Ok(())
    }

    pub fn validate_bind_host(&self, host: &str) -> Result<()> {
        let _: IpAddr = host.parse().context("bind host must be an IP address")?;
        if super::origin_policy::bind_host_is_loopback(host) {
            return Ok(());
        }
        if self.api_keys.contains("dev-local-key") || self.agent_keys.contains("dev-local-key") {
            bail!("the default development API key is not allowed for non-loopback listening");
        }
        // 只报长度，不把 key 本身写进报错。
        if let Some(short) = self
            .api_keys
            .iter()
            .chain(&self.agent_keys)
            .map(|key| key.chars().count())
            .find(|len| *len < MIN_NON_LOOPBACK_API_KEY_CHARS)
        {
            bail!(
                "API keys must be at least {MIN_NON_LOOPBACK_API_KEY_CHARS} characters for non-loopback listening (one configured key has {short})"
            );
        }
        Ok(())
    }

    /// 非本机监听还在用交付包的公开占位 key 时给一句警告。不拒绝：容器里后端总是监听 0.0.0.0，
    /// 分不清宿主机端口是不是只开在 127.0.0.1；旧 compose 没挂共享目录、入口脚本换不掉它时还得能起来。
    pub fn placeholder_key_warning(&self, host: &str) -> Option<String> {
        if super::origin_policy::bind_host_is_loopback(host)
            || !self.api_keys.contains(DELIVERY_PLACEHOLDER_API_KEY)
        {
            return None;
        }
        Some(format!(
            "warning: the API key is still the public placeholder `{DELIVERY_PLACEHOLDER_API_KEY}` from the Docker delivery bundle; \
             anyone who can reach port 41000 can use it. Replace it in docker/auth.local.json and web.env, \
             or use the current docker-compose.yml, which generates a random key on first start"
        ))
    }
}

/// 非本机监听时 key 的最短长度。容器入口脚本生成的是 64 位十六进制。
pub const MIN_NON_LOOPBACK_API_KEY_CHARS: usize = 16;

/// 交付包 `docker/auth.local.json`、`docker/web.env` 里的公开占位 key，和
/// `ops/deployment/docker/backend/api-key.sh` 里的同一个字面量。
pub const DELIVERY_PLACEHOLDER_API_KEY: &str = "replace-with-your-backend-key";

fn load_local_auth_config(path: &Path) -> Result<Option<LocalAuthConfig>> {
    if !path.exists() {
        return Ok(None);
    }
    let text = std::fs::read_to_string(path)
        .with_context(|| format!("failed to read {}", path.display()))?;
    let config: LocalAuthConfig = serde_json::from_str(&text)
        .with_context(|| format!("failed to parse {}", path.display()))?;
    Ok(Some(config))
}

/// 请求带来的 key 是不是配置里的某一把。每一把都逐字节比完、不在第一个对不上的字节处停，
/// 耗时不随"猜对了前几个字节"而变；长度不同直接不等（key 的长度不算秘密）。空集合谁都不放。
/// rust_api、retain-jobsd、助手终端握手都用它，不要再写 `api_keys.contains(...)`。
pub fn api_key_matches(api_keys: &HashSet<String>, candidate: &str) -> bool {
    let candidate = candidate.as_bytes();
    let mut matched = false;
    for key in api_keys {
        matched |= bytes_equal_in_constant_time(key.as_bytes(), candidate);
    }
    matched
}

fn bytes_equal_in_constant_time(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    let difference = left
        .iter()
        .zip(right)
        .fold(0u8, |acc, (a, b)| acc | (a ^ b));
    std::hint::black_box(difference) == 0
}

fn resolve_api_keys(local_auth: Option<&LocalAuthConfig>) -> Result<HashSet<String>> {
    // Explicit deployment settings override the local file. In particular, an
    // operator rotating a key must not keep accepting a stale file-owned key.
    if let Ok(raw) = std::env::var("RUST_API_KEYS") {
        let keys: HashSet<String> = raw
            .split(',')
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
            .collect();
        if keys.is_empty() {
            bail!("RUST_API_KEYS must contain at least one API key when set");
        }
        return Ok(keys);
    }
    if let Some(local_auth) = local_auth {
        let keys: HashSet<String> = local_auth
            .api_keys
            .iter()
            .map(String::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
            .collect();
        if !keys.is_empty() {
            return Ok(keys);
        }
    }

    bail!("auth.local.json or RUST_API_KEYS is required and must contain at least one API key")
}

/// `RUST_API_AGENT_KEYS`：逗号分隔，空的忽略；不设就是没有 AI 专用密钥（2026-11-25）。
fn resolve_agent_keys() -> HashSet<String> {
    env_optional_string("RUST_API_AGENT_KEYS")
        .map(|raw| {
            raw.split(',')
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

fn resolve_max_running_jobs(local_auth: Option<&LocalAuthConfig>) -> usize {
    if env_optional_string("RUST_API_MAX_RUNNING_JOBS").is_some() {
        return env_usize("RUST_API_MAX_RUNNING_JOBS", 4);
    }
    if let Some(value) = local_auth
        .and_then(|cfg| cfg.max_running_jobs)
        .filter(|value| *value > 0)
    {
        return value;
    }
    env_usize("RUST_API_MAX_RUNNING_JOBS", 4)
}

fn resolve_simple_port(local_auth: Option<&LocalAuthConfig>) -> Result<u16> {
    let port = match env_optional_string("RUST_API_SIMPLE_PORT") {
        Some(raw) => raw
            .parse::<u16>()
            .context("RUST_API_SIMPLE_PORT must be a valid port")?,
        None => local_auth.and_then(|cfg| cfg.simple_port).unwrap_or(42000),
    };
    if port == 0 {
        bail!("simple API port must be between 1 and 65535");
    }
    Ok(port)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_key_matches_only_exact_configured_keys() {
        let keys: HashSet<String> = ["first-key-0123456789".into(), "second-key-abcdefghij".into()].into();
        assert!(api_key_matches(&keys, "first-key-0123456789"));
        assert!(api_key_matches(&keys, "second-key-abcdefghij"));
        for wrong in ["", "first-key-012345678", "first-key-01234567890", "First-key-0123456789"] {
            assert!(!api_key_matches(&keys, wrong), "{wrong:?}");
        }
        assert!(!api_key_matches(&HashSet::new(), ""), "an empty key set admits nobody");
        assert!(!api_key_matches(&HashSet::new(), "anything"));
    }

    #[test]
    fn configuration_priority_is_verified_in_isolated_processes() {
        for case in [
            "file",
            "file_only",
            "empty_env",
            "missing",
            "empty",
            "malformed",
            "no_keys",
            "invalid_port",
            "zero_port",
        ] {
            let mut command = std::process::Command::new(std::env::current_exe().unwrap());
            command
                .args([
                    "--ignored",
                    "--exact",
                    "config::auth::tests::environment_probe",
                ])
                .env("RETAIN_AUTH_TEST_CASE", case)
                .env(
                    "RUST_API_KEYS",
                    if matches!(case, "no_keys" | "empty_env") {
                        " , "
                    } else {
                        "env-test-key"
                    },
                )
                .env("RUST_API_MAX_RUNNING_JOBS", "7")
                .env(
                    "RUST_API_SIMPLE_PORT",
                    match case {
                        "invalid_port" => "invalid",
                        "zero_port" => "0",
                        _ => "43000",
                    },
                );
            if case == "file_only" {
                command
                    .env_remove("RUST_API_KEYS")
                    .env_remove("RUST_API_MAX_RUNNING_JOBS")
                    .env_remove("RUST_API_SIMPLE_PORT");
            }
            let result = command.output().unwrap();
            assert!(result.status.success(), "isolated auth case failed: {case}");
            assert!(
                String::from_utf8_lossy(&result.stdout).contains("1 passed"),
                "auth probe was not executed: {case}"
            );
        }
    }

    #[test]
    #[ignore = "invoked by configuration_priority_is_verified_in_isolated_processes"]
    fn environment_probe() {
        let Ok(case) = std::env::var("RETAIN_AUTH_TEST_CASE") else {
            return;
        };
        let root = std::env::temp_dir().join(format!("retain-auth-config-{}", fastrand::u64(..)));
        std::fs::create_dir(&root).unwrap();
        let path = root.join("auth.local.json");
        match case.as_str() {
            "file" | "file_only" | "empty_env" | "invalid_port" | "zero_port" => std::fs::write(
                &path,
                r#"{"api_keys":["file-test-key"],"max_running_jobs":2,"simple_port":42010}"#,
            )
            .unwrap(),
            "empty" => std::fs::write(&path, r#"{"api_keys":[" "]}"#).unwrap(),
            "malformed" => std::fs::write(&path, "not-json").unwrap(),
            "missing" | "no_keys" => {}
            _ => panic!("unknown test case"),
        }
        let result = AuthRuntimeConfig::from_env_or_file(&path);
        std::fs::remove_dir_all(root).unwrap();
        if matches!(
            case.as_str(),
            "malformed" | "no_keys" | "empty_env" | "invalid_port" | "zero_port"
        ) {
            assert!(result.is_err());
        } else {
            let config = result.unwrap();
            let file = case == "file_only";
            assert_eq!(
                config.api_keys,
                [if file {
                    "file-test-key"
                } else {
                    "env-test-key"
                }
                .to_owned()]
                .into_iter()
                .collect()
            );
            assert_eq!(config.max_running_jobs, if file { 2 } else { 7 });
            assert_eq!(config.simple_port, if file { 42010 } else { 43000 });
        }
    }

    #[test]
    fn default_development_key_is_confined_to_loopback() {
        let config = AuthRuntimeConfig::from_desktop(42000, "dev-local-key".into(), 4);
        for host in ["127.0.0.1", "127.0.0.2", "::1", "::ffff:127.0.0.1"] {
            config.validate_bind_host(host).expect("loopback");
        }
        for host in ["0.0.0.0", "::", "192.168.1.2", "::ffff:192.168.1.2"] {
            assert!(config.validate_bind_host(host).is_err());
        }
        let config = AuthRuntimeConfig::from_desktop(42000, "explicit-test-key".into(), 4);
        config.validate_bind_host("0.0.0.0").expect("explicit key");
    }

    #[test]
    fn short_keys_are_confined_to_loopback() {
        let config = AuthRuntimeConfig::from_desktop(42000, "a".repeat(15), 4);
        config.validate_bind_host("127.0.0.1").expect("loopback");
        let error = config.validate_bind_host("0.0.0.0").unwrap_err().to_string();
        assert!(error.contains("at least 16 characters"), "{error}");
        assert!(!error.contains(&"a".repeat(15)), "the key must not be echoed: {error}");

        let mut config = AuthRuntimeConfig::from_desktop(42000, "b".repeat(16), 4);
        config.validate_bind_host("0.0.0.0").expect("16 characters is enough");
        // 多把 key 里只要有一把太短就拒绝。
        config.api_keys.insert("short".into());
        assert!(config.validate_bind_host("192.168.1.2").is_err());
    }

    #[test]
    fn delivery_placeholder_key_only_warns_off_loopback() {
        let config =
            AuthRuntimeConfig::from_desktop(42000, DELIVERY_PLACEHOLDER_API_KEY.into(), 4);
        // 旧 compose 拉新镜像时要能起来，所以只警告不拒绝。
        config.validate_bind_host("0.0.0.0").expect("placeholder still starts");
        let warning = config.placeholder_key_warning("0.0.0.0").expect("warning");
        assert!(warning.contains("public placeholder"), "{warning}");
        assert_eq!(config.placeholder_key_warning("127.0.0.1"), None);

        let config = AuthRuntimeConfig::from_desktop(42000, "c".repeat(64), 4);
        assert_eq!(config.placeholder_key_warning("0.0.0.0"), None);
    }

    #[test]
    fn agent_keys_must_not_reuse_a_main_key() {
        let mut config = AuthRuntimeConfig::from_desktop(42000, "main-key-0123456789".into(), 4);
        config.agent_keys = ["agent-key-0123456789".to_string()].into_iter().collect();
        assert!(config.validate_agent_keys().is_ok());
        config.agent_keys.insert("main-key-0123456789".into());
        let error = config.validate_agent_keys().unwrap_err().to_string();
        assert!(error.contains("RUST_API_AGENT_KEYS"), "{error}");
        assert!(!error.contains("main-key-0123456789"), "不把 key 写进报错: {error}");
    }

    #[test]
    fn short_agent_keys_are_refused_for_non_loopback_listening() {
        let mut config = AuthRuntimeConfig::from_desktop(42000, "c".repeat(64), 4);
        config.agent_keys = ["short".to_string()].into_iter().collect();
        assert!(config.validate_bind_host("127.0.0.1").is_ok());
        assert!(config.validate_bind_host("0.0.0.0").is_err());
    }
}
