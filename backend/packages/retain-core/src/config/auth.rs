use std::collections::HashSet;
use std::path::Path;

use anyhow::{bail, Context, Result};
use serde::Deserialize;

use super::env_vars::{env_u16, env_usize};

#[derive(Clone, Debug)]
pub struct AuthRuntimeConfig {
    pub api_keys: HashSet<String>,
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
            max_running_jobs: resolve_max_running_jobs(local_auth.as_ref()),
            simple_port: resolve_simple_port(local_auth.as_ref()),
        })
    }

    pub fn from_desktop(simple_port: u16, api_key: String, max_running_jobs: usize) -> Self {
        Self {
            api_keys: [api_key].into_iter().collect(),
            max_running_jobs,
            simple_port,
        }
    }
}

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

fn resolve_api_keys(local_auth: Option<&LocalAuthConfig>) -> Result<HashSet<String>> {
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

    let raw = std::env::var("RUST_API_KEYS").context(
        "auth.local.json or RUST_API_KEYS is required and must contain at least one API key",
    )?;
    let keys: HashSet<String> = raw
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .collect();
    if keys.is_empty() {
        bail!("auth.local.json or RUST_API_KEYS is required and must contain at least one API key");
    }
    Ok(keys)
}

fn resolve_max_running_jobs(local_auth: Option<&LocalAuthConfig>) -> usize {
    if let Some(value) = local_auth
        .and_then(|cfg| cfg.max_running_jobs)
        .filter(|value| *value > 0)
    {
        return value;
    }
    env_usize("RUST_API_MAX_RUNNING_JOBS", 4)
}

fn resolve_simple_port(local_auth: Option<&LocalAuthConfig>) -> u16 {
    if let Some(value) = local_auth.and_then(|cfg| cfg.simple_port) {
        return value;
    }
    env_u16("RUST_API_SIMPLE_PORT", 42000)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn configuration_priority_is_verified_in_isolated_processes() {
        for case in ["file", "missing", "empty", "malformed", "no_keys"] {
            let result = std::process::Command::new(std::env::current_exe().unwrap())
                .args(["--ignored", "--exact", "config::auth::tests::environment_probe"])
                .env("RETAIN_AUTH_TEST_CASE", case)
                .env("RUST_API_KEYS", if case == "no_keys" { "" } else { "env-test-key" })
                .env("RUST_API_MAX_RUNNING_JOBS", "7")
                .env("RUST_API_SIMPLE_PORT", "43000")
                .output().unwrap();
            assert!(result.status.success(), "isolated auth case failed: {case}");
            assert!(String::from_utf8_lossy(&result.stdout).contains("1 passed"), "auth probe was not executed: {case}");
        }
    }

    #[test]
    #[ignore = "invoked by configuration_priority_is_verified_in_isolated_processes"]
    fn environment_probe() {
        let Ok(case) = std::env::var("RETAIN_AUTH_TEST_CASE") else { return };
        let root = std::env::temp_dir().join(format!("retain-auth-config-{}", fastrand::u64(..)));
        std::fs::create_dir(&root).unwrap();
        let path = root.join("auth.local.json");
        match case.as_str() {
            "file" => std::fs::write(&path, r#"{"api_keys":["file-test-key"],"max_running_jobs":2,"simple_port":42010}"#).unwrap(),
            "empty" => std::fs::write(&path, r#"{"api_keys":[" "]}"#).unwrap(),
            "malformed" => std::fs::write(&path, "not-json").unwrap(),
            "missing" | "no_keys" => {},
            _ => panic!("unknown test case"),
        }
        let result = AuthRuntimeConfig::from_env_or_file(&path);
        std::fs::remove_dir_all(root).unwrap();
        if case == "malformed" || case == "no_keys" {
            assert!(result.is_err());
        } else {
            let config = result.unwrap();
            let file = case == "file";
            assert_eq!(config.api_keys, [if file { "file-test-key" } else { "env-test-key" }.to_owned()].into_iter().collect());
            assert_eq!(config.max_running_jobs, if file { 2 } else { 7 });
            assert_eq!(config.simple_port, if file { 42010 } else { 43000 });
        }
    }
}
