//! 后端自己管的本机 agent 安装目录（2026-11-26）：`<数据目录>/acp-agents/`。
//! 方案：docs/ops/planning/reader-ask/20261126-本机agent默认安装.md。
//!
//! - npm 包装进私有 prefix：`npm/<登记表 id>/<版本>/node_modules/.bin/<命令>`，不碰用户全局。npm、node 先找
//!   `RUST_API_NODE_DIR`（桌面版自带的 Node），没有就用 PATH 上的；起托管的 npm 包时把 Node 目录和 `.bin` 放在子进程 PATH 前面
//!   （npm 包的入口是 `#!/usr/bin/env node`；pi-acp 要在 PATH 上找到同一目录里的 `pi`）。
//! - 压缩包按这个平台从快照取地址，下载后核对快照里的 sha256，解到 `binary/<登记表 id>/<版本>/`，命令和参数照快照。
//!   快照里没给 sha256 的不代装。
//! - 都先装进 `.staging/` 下的临时目录，装好了再一次改名到位。装到一半断了只留下临时目录，下次装同一个时清掉，
//!   不会被当成装好了（以前 npx 现场下载留下半个可执行文件，之后每次 spawn -88，见 `registry.rs` 的 `resolve_agent`）。
//! - 同一个 agent 同时只有一个安装在跑（进程内登记，[`begin`]）；装到哪一步、失败原因只记在内存里，重启后从头看目录。
use std::collections::HashMap;
use std::ffi::OsString;
use std::path::{Component, Path, PathBuf};
use std::process::Stdio;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use serde::Serialize;
use sha2::{Digest, Sha256};
use tokio::io::AsyncWriteExt;

use super::registry::{
    env_pairs, find_in_path, is_executable, AgentDistribution, BinaryTarget, Catalog, CatalogAgent, Lookup, ResolvedLaunch,
};

/// 安装目录在数据目录下的名字。
pub const AGENTS_DIR_NAME: &str = "acp-agents";
/// 桌面版自带的 Node：放 `node`、`npm` 的目录（也可以是 Node 发行包的根，下面有 `bin/`）。
pub const NODE_DIR_ENV: &str = "RUST_API_NODE_DIR";
/// 打开「启动后在后台把默认名单里没装的装上」（桌面版设 1）。
pub const DEFAULT_INSTALL_ENV: &str = "RUST_API_ACP_DEFAULT_INSTALL";

const STAGING_DIR: &str = ".staging";
const NPM_DIR: &str = "npm";
const BINARY_DIR: &str = "binary";
/// Claude Code 的适配器第一次要下几百 MB，慢网上也给够时间。
const NPM_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const CHUNK_TIMEOUT: Duration = Duration::from_secs(60);
const MAX_ARCHIVE_BYTES: u64 = 2 << 30;
/// 失败原因里带 npm 输出的最后几行。
const OUTPUT_TAIL_LINES: usize = 4;

/// 后端怎么代装。
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum InstallMethod {
    /// `npm install --prefix <安装目录>/npm/<id>/<版本>`。
    Npm,
    /// 下载压缩包、核对 sha256、解到 `<安装目录>/binary/<id>/<版本>`。
    Binary,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum InstallState {
    /// 没装（安装目录和 PATH 上都没有）。
    Missing,
    /// 后端正在装。
    Installing,
    /// 装好了（安装目录里或 PATH 上）。
    Installed,
    /// 上一次代装失败了（`error` 是原因）；可以再装。
    Failed,
}

/// `GET /ai/agents` 每个本机 agent 的 `install_status`。
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct AgentInstallView {
    pub state: InstallState,
    /// 装在后端自己的安装目录里（false：没装，或者是用户自己装在 PATH 上的）。
    pub managed: bool,
    /// 后端能代装（`POST /ai/agents/:agent_id/install`）。
    pub installable: bool,
    /// 装好的是怎么装的；没装的是后端会怎么装。不能代装、又不是托管的没有。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method: Option<InstallMethod>,
    /// 安装目录里装的版本（托管的才有）。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub installed_version: Option<String>,
    /// `failed` 时的原因。
    #[serde(skip_serializing_if = "String::is_empty")]
    pub error: String,
    /// 不能代装的原因（`installable` 为 false 时）。
    #[serde(skip_serializing_if = "String::is_empty")]
    pub reason: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum ArchiveFormat {
    Zip,
    TarGz,
}

/// 后端会怎么装一个 agent。
#[derive(Clone, Debug)]
pub(super) enum InstallPlan {
    Npm {
        npm: PathBuf,
        /// 交给 npm 的包（带版本）：还要另有的命令在前（pi），适配器在后（pi-acp）。
        packages: Vec<String>,
        /// 装好后 `.bin` 里必须有的命令。
        bins: Vec<String>,
    },
    Binary {
        url: String,
        sha256: String,
        format: ArchiveFormat,
        /// 压缩包里命令的相对路径。
        cmd: PathBuf,
    },
}

impl InstallPlan {
    pub(super) fn method(&self) -> InstallMethod {
        match self {
            InstallPlan::Npm { .. } => InstallMethod::Npm,
            InstallPlan::Binary { .. } => InstallMethod::Binary,
        }
    }
}

// ---------- 目录 ----------

fn kind_dir(method: InstallMethod) -> &'static str {
    match method {
        InstallMethod::Npm => NPM_DIR,
        InstallMethod::Binary => BINARY_DIR,
    }
}

/// 版本做目录名：只留字母、数字和 `.-_+`。
pub(super) fn version_dir_name(version: &str) -> String {
    let name: String = version
        .trim()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | '+') { c } else { '_' })
        .collect();
    if name.is_empty() || name.starts_with('.') { format!("v{name}") } else { name }
}

/// 一个 agent 装过的版本目录：快照的版本在前，其余按名字倒序（`.` 开头的不算）。
fn version_dirs(root: &Path, preferred: &str) -> Vec<(String, PathBuf)> {
    let preferred = version_dir_name(preferred);
    let mut others: Vec<String> = std::fs::read_dir(root)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .filter(|entry| entry.path().is_dir())
                .filter_map(|entry| entry.file_name().into_string().ok())
                .filter(|name| name != &preferred && !name.starts_with('.'))
                .collect()
        })
        .unwrap_or_default();
    others.sort();
    others.reverse();
    std::iter::once(preferred)
        .chain(others)
        .map(|name| {
            let dir = root.join(&name);
            (name, dir)
        })
        .filter(|(_, dir)| dir.is_dir())
        .collect()
}

/// 目录里的命令（Windows 上 npm 的 `.bin` 是 `<命令>.cmd`）。
fn command_in(dir: &Path, name: &str) -> Option<PathBuf> {
    let names: Vec<String> =
        if cfg!(windows) { vec![format!("{name}.cmd"), format!("{name}.exe"), name.to_string()] } else { vec![name.to_string()] };
    names.into_iter().map(|name| dir.join(name)).find(|path| is_executable(path))
}

/// 压缩包里命令的相对路径（`./dist-package/cursor-agent`）：不许绝对路径和 `..`。
fn relative_cmd(cmd: &str) -> Option<PathBuf> {
    let mut out = PathBuf::new();
    for component in Path::new(cmd).components() {
        match component {
            Component::CurDir => {}
            Component::Normal(part) => out.push(part),
            _ => return None,
        }
    }
    (!out.as_os_str().is_empty()).then_some(out)
}

fn archive_format(url: &str) -> Option<ArchiveFormat> {
    let path = url.split(['?', '#']).next().unwrap_or(url).to_ascii_lowercase();
    if path.ends_with(".zip") {
        Some(ArchiveFormat::Zip)
    } else if path.ends_with(".tar.gz") || path.ends_with(".tgz") {
        Some(ArchiveFormat::TarGz)
    } else {
        None
    }
}

// ---------- Node ----------

/// `RUST_API_NODE_DIR` 里真正放 node 的目录：给的是 Node 发行包的根（下面有 `bin/node`）就用 `bin/`。
pub(super) fn node_bin_dir(node_dir: &Path) -> PathBuf {
    let bin = node_dir.join("bin");
    let node = if cfg!(windows) { "node.exe" } else { "node" };
    if bin.join(node).is_file() { bin } else { node_dir.to_path_buf() }
}

fn find_npm(lookup: &Lookup) -> Option<PathBuf> {
    let names: &[&str] = if cfg!(windows) { &["npm.cmd", "npm.exe", "npm"] } else { &["npm"] };
    if let Some(node_dir) = lookup.node_dir {
        let dir = node_bin_dir(node_dir);
        if let Some(npm) = names.iter().map(|name| dir.join(name)).find(|path| path.is_file()) {
            return Some(npm);
        }
    }
    names.iter().find_map(|name| find_in_path(name, lookup.path_var))
}

/// 起 npm、起托管的 npm 包用的 PATH：自带的 Node 目录、`extra`（`.bin`）放在原来的 PATH 前面。
fn child_path(lookup: &Lookup, extra: &[&Path]) -> Option<OsString> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Some(node_dir) = lookup.node_dir {
        dirs.push(node_bin_dir(node_dir));
    }
    dirs.extend(extra.iter().map(|dir| dir.to_path_buf()));
    if let Some(path) = lookup.path_var {
        dirs.extend(std::env::split_paths(path));
    }
    std::env::join_paths(dirs).ok()
}

// ---------- 装了没 ----------

/// 安装目录里装好的起法：先找压缩包装的，再找 npm 装的；快照的版本优先，旧版本也认（默认安装时会换成快照的版本）。
pub(super) fn managed_launch(agent: &CatalogAgent, platform: &str, lookup: &Lookup) -> Option<ResolvedLaunch> {
    let dir = lookup.agents_dir?;
    if let Some(target) = agent.binary.get(platform) {
        if let Some(cmd) = relative_cmd(&target.cmd) {
            for (version, version_dir) in version_dirs(&dir.join(BINARY_DIR).join(&agent.registry_id), &agent.version) {
                let program = version_dir.join(&cmd);
                if is_executable(&program) {
                    return Some(ResolvedLaunch {
                        program,
                        args: target.args.clone(),
                        env: env_pairs(&target.env),
                        distribution: AgentDistribution::Binary,
                        managed_version: Some(version),
                    });
                }
            }
        }
    }
    if let (Some(npx), Some(bin)) = (&agent.npx, &agent.npx_bin) {
        for (version, version_dir) in version_dirs(&dir.join(NPM_DIR).join(&agent.registry_id), &agent.version) {
            let bin_dir = version_dir.join("node_modules").join(".bin");
            let Some(program) = command_in(&bin_dir, bin) else { continue };
            if let Some(requirement) = &agent.requires {
                if command_in(&bin_dir, &requirement.bin).is_none() && find_in_path(&requirement.bin, lookup.path_var).is_none() {
                    continue;
                }
            }
            let mut env = env_pairs(&npx.env);
            if let Some(path) = child_path(lookup, &[&bin_dir]).and_then(|path| path.into_string().ok()) {
                env.push(("PATH".into(), path));
            }
            return Some(ResolvedLaunch {
                program,
                args: npx.args.clone(),
                env,
                distribution: AgentDistribution::Npx,
                managed_version: Some(version),
            });
        }
    }
    None
}

// ---------- 怎么装 ----------

fn binary_plan(target: &BinaryTarget) -> Result<InstallPlan, String> {
    let sha256 = target
        .sha256
        .as_deref()
        .map(str::trim)
        .filter(|sha| sha.len() == 64 && sha.bytes().all(|byte| byte.is_ascii_hexdigit()))
        .ok_or("ACP 登记表没给这个压缩包的 sha256，RetainPDF 不代装")?;
    let format = archive_format(&target.archive).ok_or("压缩包格式不认识（只认 .zip、.tar.gz），RetainPDF 不代装")?;
    let cmd = relative_cmd(&target.cmd).ok_or("登记表里的命令路径不对，RetainPDF 不代装")?;
    Ok(InstallPlan::Binary { url: target.archive.clone(), sha256: sha256.to_ascii_lowercase(), format, cmd })
}

/// 后端会怎么装：有 npm 包、找得到 npm 就用 npm；否则这个平台的压缩包（要有 sha256）；都不行返回原因。
pub(super) fn install_plan(agent: &CatalogAgent, platform: &str, lookup: &Lookup) -> Result<InstallPlan, String> {
    let npm_package = agent.npx.as_ref().zip(agent.npx_bin.as_ref());
    if let Some((npx, bin)) = npm_package {
        if let Some(npm) = find_npm(lookup) {
            let mut packages = Vec::new();
            let mut bins = vec![bin.clone()];
            if let Some(requirement) = &agent.requires {
                packages.push(requirement.spec());
                bins.push(requirement.bin.clone());
            }
            packages.push(npx.package.clone());
            return Ok(InstallPlan::Npm { npm, packages, bins });
        }
    }
    if let Some(target) = agent.binary.get(platform) {
        match binary_plan(target) {
            Ok(plan) => return Ok(plan),
            Err(reason) if npm_package.is_none() => return Err(reason),
            Err(_) => {}
        }
    }
    if npm_package.is_some() {
        return Err(format!("没找到 npm：先装 Node.js（桌面版自带 Node 时由 {NODE_DIR_ENV} 指过来）"));
    }
    if agent.has_uvx() {
        return Err("用 uv 装的 agent RetainPDF 不代装，在终端运行安装命令".into());
    }
    Err("这个平台没有 RetainPDF 能代装的发行包".into())
}

// ---------- 进程内登记：谁在装、谁失败了 ----------

#[derive(Clone, Debug)]
enum Tracked {
    Installing,
    Failed(String),
}

fn tracker() -> &'static Mutex<HashMap<String, Tracked>> {
    static TRACKER: OnceLock<Mutex<HashMap<String, Tracked>>> = OnceLock::new();
    TRACKER.get_or_init(Default::default)
}

fn tracked(registry_id: &str) -> Option<Tracked> {
    tracker().lock().unwrap_or_else(|poisoned| poisoned.into_inner()).get(registry_id).cloned()
}

/// 登记开始装；已经有一个在装返回 false。
pub(super) fn begin(registry_id: &str) -> bool {
    let mut map = tracker().lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if matches!(map.get(registry_id), Some(Tracked::Installing)) {
        return false;
    }
    map.insert(registry_id.to_string(), Tracked::Installing);
    true
}

pub(super) fn finish(registry_id: &str, result: &Result<PathBuf, String>) {
    let mut map = tracker().lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    match result {
        Ok(dir) => {
            tracing::info!(agent = registry_id, dir = %dir.display(), "acp agent installed");
            map.remove(registry_id);
        }
        Err(error) => {
            tracing::warn!(agent = registry_id, "acp agent install failed: {error}");
            map.insert(registry_id.to_string(), Tracked::Failed(error.clone()));
        }
    }
}

/// 列表里的 `install_status`。`resolved` 是这次找到的起法（安装目录或 PATH）。
pub(super) fn install_view(
    agent: &CatalogAgent,
    platform: &str,
    lookup: &Lookup,
    resolved: &Result<ResolvedLaunch, String>,
) -> AgentInstallView {
    let plan = if lookup.agents_dir.is_some() {
        install_plan(agent, platform, lookup)
    } else {
        Err("后端没有安装目录".into())
    };
    let managed_version = resolved.as_ref().ok().and_then(|launch| launch.managed_version.clone());
    let method = match (resolved, &plan) {
        (Ok(launch), _) if launch.managed_version.is_some() => Some(match launch.distribution {
            AgentDistribution::Binary => InstallMethod::Binary,
            _ => InstallMethod::Npm,
        }),
        (_, Ok(plan)) => Some(plan.method()),
        _ => None,
    };
    let (state, error) = match (tracked(&agent.registry_id), resolved) {
        (Some(Tracked::Installing), _) => (InstallState::Installing, String::new()),
        (_, Ok(_)) => (InstallState::Installed, String::new()),
        (Some(Tracked::Failed(error)), Err(_)) => (InstallState::Failed, error),
        (None, Err(_)) => (InstallState::Missing, String::new()),
    };
    AgentInstallView {
        state,
        managed: managed_version.is_some(),
        installable: plan.is_ok(),
        method,
        installed_version: managed_version,
        error,
        reason: plan.err().unwrap_or_default(),
    }
}

// ---------- 装 ----------

/// 一次安装要的东西（都是自己的，可以交给后台任务）。
#[derive(Clone, Debug)]
pub(super) struct InstallJob {
    pub(super) registry_id: String,
    pub(super) version: String,
    pub(super) plan: InstallPlan,
    pub(super) agents_dir: PathBuf,
    /// 起 npm 用的 PATH（自带的 Node 在前）。
    pub(super) path_env: Option<OsString>,
}

impl InstallJob {
    pub(super) fn new(agent: &CatalogAgent, plan: InstallPlan, agents_dir: &Path, lookup: &Lookup) -> Self {
        InstallJob {
            registry_id: agent.registry_id.clone(),
            version: agent.version.clone(),
            plan,
            agents_dir: agents_dir.to_path_buf(),
            path_env: child_path(lookup, &[]),
        }
    }
}

/// 清掉这个 agent 以前没装完的临时目录（`<id>.<随机>`；调用方已经 [`begin`] 过，进程里没有别的在装它）。
fn clear_staging(staging_root: &Path, registry_id: &str) {
    let prefix = format!("{registry_id}.");
    let Ok(entries) = std::fs::read_dir(staging_root) else { return };
    for entry in entries.filter_map(Result::ok) {
        if entry.file_name().to_str().is_some_and(|name| name.starts_with(&prefix)) {
            let _ = std::fs::remove_dir_all(entry.path());
        }
    }
}

/// 装一个 agent：装进临时目录，装好了改名到 `<安装目录>/<npm|binary>/<id>/<版本>`，返回那个目录。
pub(super) async fn run_install(job: &InstallJob) -> Result<PathBuf, String> {
    let staging_root = job.agents_dir.join(STAGING_DIR);
    std::fs::create_dir_all(&staging_root).map_err(|error| format!("建不了安装目录 {}：{error}", staging_root.display()))?;
    clear_staging(&staging_root, &job.registry_id);
    let staging = staging_root.join(format!("{}.{:016x}", job.registry_id, fastrand::u64(..)));
    std::fs::create_dir_all(&staging).map_err(|error| format!("建不了临时目录：{error}"))?;
    let built = match &job.plan {
        InstallPlan::Npm { npm, packages, bins } => npm_install(npm, packages, bins, job.path_env.as_deref(), &staging).await,
        InstallPlan::Binary { url, sha256, format, cmd } => binary_install(url, sha256, *format, cmd, &staging).await,
    };
    let outcome = built.and_then(|ready| move_into_place(job, &staging_root, &ready));
    let _ = std::fs::remove_dir_all(&staging);
    outcome
}

fn move_into_place(job: &InstallJob, staging_root: &Path, ready: &Path) -> Result<PathBuf, String> {
    let method = job.plan.method();
    let root = job.agents_dir.join(kind_dir(method)).join(&job.registry_id);
    std::fs::create_dir_all(&root).map_err(|error| format!("建不了 {}：{error}", root.display()))?;
    let target = root.join(version_dir_name(&job.version));
    // 同一个版本重装：旧的先挪开（改名是一步），新的改名到位后再删
    let old = target.exists().then(|| staging_root.join(format!("{}.old-{:016x}", job.registry_id, fastrand::u64(..))));
    if let Some(old) = &old {
        std::fs::rename(&target, old).map_err(|error| format!("挪不开旧的 {}：{error}", target.display()))?;
    }
    std::fs::rename(ready, &target).map_err(|error| format!("装好的放不到 {}：{error}", target.display()))?;
    if let Some(old) = old {
        let _ = std::fs::remove_dir_all(old);
    }
    // 别的版本、另一种装法装的，都删掉
    if let Ok(entries) = std::fs::read_dir(&root) {
        for entry in entries.filter_map(Result::ok) {
            if entry.path() != target {
                let _ = std::fs::remove_dir_all(entry.path());
            }
        }
    }
    let other = match method {
        InstallMethod::Npm => InstallMethod::Binary,
        InstallMethod::Binary => InstallMethod::Npm,
    };
    let _ = std::fs::remove_dir_all(job.agents_dir.join(kind_dir(other)).join(&job.registry_id));
    Ok(target)
}

fn output_tail(output: &std::process::Output) -> String {
    let text = if output.stderr.iter().any(|byte| !byte.is_ascii_whitespace()) { &output.stderr } else { &output.stdout };
    let text = String::from_utf8_lossy(text);
    let lines: Vec<&str> = text.lines().map(str::trim).filter(|line| !line.is_empty()).collect();
    let tail = lines[lines.len().saturating_sub(OUTPUT_TAIL_LINES)..].join(" / ");
    tail.chars().take(600).collect()
}

async fn npm_install(
    npm: &Path,
    packages: &[String],
    bins: &[String],
    path_env: Option<&std::ffi::OsStr>,
    staging: &Path,
) -> Result<PathBuf, String> {
    let prefix = staging.join("prefix");
    std::fs::create_dir_all(&prefix).map_err(|error| format!("建不了临时目录：{error}"))?;
    let mut command = tokio::process::Command::new(npm);
    command
        .arg("install")
        .arg("--prefix")
        .arg(&prefix)
        .args(["--no-audit", "--no-fund", "--no-update-notifier", "--loglevel=error"])
        .args(packages)
        .current_dir(&prefix)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    if let Some(path) = path_env {
        command.env("PATH", path);
    }
    let output = tokio::time::timeout(NPM_TIMEOUT, command.output())
        .await
        .map_err(|_| format!("npm install 超过 {} 分钟没装完", NPM_TIMEOUT.as_secs() / 60))?
        .map_err(|error| format!("npm 起不来（{}）：{error}", npm.display()))?;
    if !output.status.success() {
        let code = output.status.code().map(|code| code.to_string()).unwrap_or_else(|| "被信号结束".into());
        return Err(format!("npm install {} 失败（{code}）：{}", packages.join(" "), output_tail(&output)));
    }
    let bin_dir = prefix.join("node_modules").join(".bin");
    for bin in bins {
        if command_in(&bin_dir, bin).is_none() {
            return Err(format!("npm 装完了，但没有 {bin} 命令"));
        }
    }
    Ok(prefix)
}

async fn binary_install(url: &str, sha256: &str, format: ArchiveFormat, cmd: &Path, staging: &Path) -> Result<PathBuf, String> {
    let archive = staging.join(match format {
        ArchiveFormat::Zip => "archive.zip",
        ArchiveFormat::TarGz => "archive.tar.gz",
    });
    download(url, &archive, sha256).await?;
    let out = staging.join("out");
    let (archive_path, out_dir) = (archive.clone(), out.clone());
    tokio::task::spawn_blocking(move || extract(&archive_path, &out_dir, format))
        .await
        .map_err(|_| "解压时出错了".to_string())??;
    let program = out.join(cmd);
    if !program.is_file() {
        return Err(format!("压缩包里没有 {}", cmd.display()));
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&program, std::fs::Permissions::from_mode(0o755))
            .map_err(|error| format!("改不了 {} 的权限：{error}", cmd.display()))?;
    }
    Ok(out)
}

/// 下载到 `into`，边下边算 sha256，和快照里的对不上就失败。
async fn download(url: &str, into: &Path, expected_sha256: &str) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .build()
        .map_err(|error| format!("建不了下载客户端：{error}"))?;
    let mut response = client
        .get(url)
        .send()
        .await
        .and_then(|response| response.error_for_status())
        .map_err(|error| format!("下载 {url} 失败：{error}"))?;
    let mut file = tokio::fs::File::create(into).await.map_err(|error| format!("写不了下载的文件：{error}"))?;
    let mut hasher = Sha256::new();
    let mut done: u64 = 0;
    loop {
        let chunk = tokio::time::timeout(CHUNK_TIMEOUT, response.chunk())
            .await
            .map_err(|_| format!("下载 {url}：{} 秒没收到数据", CHUNK_TIMEOUT.as_secs()))?
            .map_err(|error| format!("下载 {url} 断了：{error}"))?;
        let Some(chunk) = chunk else { break };
        done += chunk.len() as u64;
        if done > MAX_ARCHIVE_BYTES {
            return Err(format!("下载 {url}：文件超过 {} GB", MAX_ARCHIVE_BYTES >> 30));
        }
        hasher.update(&chunk);
        file.write_all(&chunk).await.map_err(|error| format!("写不了下载的文件：{error}"))?;
    }
    file.flush().await.map_err(|error| format!("写不了下载的文件：{error}"))?;
    let digest: String = hasher.finalize().iter().map(|byte| format!("{byte:02x}")).collect();
    if !digest.eq_ignore_ascii_case(expected_sha256) {
        return Err(format!("下载的 {url} sha256 对不上（下载的是 {digest}，快照里是 {expected_sha256}）"));
    }
    Ok(())
}

fn extract(archive: &Path, out: &Path, format: ArchiveFormat) -> Result<(), String> {
    std::fs::create_dir_all(out).map_err(|error| format!("建不了解压目录：{error}"))?;
    let file = std::fs::File::open(archive).map_err(|error| format!("打不开下载的文件：{error}"))?;
    match format {
        ArchiveFormat::TarGz => {
            let mut tar = tar::Archive::new(flate2::read::GzDecoder::new(std::io::BufReader::new(file)));
            tar.set_preserve_permissions(true);
            // unpack 不会写到 out 外面（`..`、绝对路径的条目被拒）
            tar.unpack(out).map_err(|error| format!("解不开 tar.gz：{error}"))
        }
        ArchiveFormat::Zip => {
            let mut zip = zip::ZipArchive::new(file).map_err(|error| format!("解不开 zip：{error}"))?;
            for index in 0..zip.len() {
                let mut entry = zip.by_index(index).map_err(|error| format!("解不开 zip：{error}"))?;
                let Some(relative) = entry.enclosed_name().map(Path::to_path_buf) else {
                    return Err(format!("zip 里有不安全的路径：{}", entry.name()));
                };
                let target = out.join(&relative);
                if entry.is_dir() {
                    std::fs::create_dir_all(&target).map_err(|error| format!("解不开 zip：{error}"))?;
                    continue;
                }
                if let Some(parent) = target.parent() {
                    std::fs::create_dir_all(parent).map_err(|error| format!("解不开 zip：{error}"))?;
                }
                let mut written = std::fs::File::create(&target).map_err(|error| format!("解不开 zip：{error}"))?;
                std::io::copy(&mut entry, &mut written).map_err(|error| format!("解不开 zip：{error}"))?;
                #[cfg(unix)]
                if let Some(mode) = entry.unix_mode() {
                    use std::os::unix::fs::PermissionsExt;
                    let _ = std::fs::set_permissions(&target, std::fs::Permissions::from_mode(mode & 0o755));
                }
            }
            Ok(())
        }
    }
}

// ---------- 默认装 ----------

pub(super) fn default_install_enabled(flag: Option<&str>) -> bool {
    flag.is_some_and(|value| matches!(value.trim().to_ascii_lowercase().as_str(), "1" | "true" | "on" | "yes"))
}

/// 把名单 `default_install` 里没装的装上（一个一个来）：安装目录里已经是快照的版本、或用户自己在 PATH 上装了的跳过；
/// 安装目录里是旧版本的换成快照的版本。失败只记日志和状态。
pub(super) async fn install_defaults(catalog: &Catalog, platform: &str, agents_dir: &Path, lookup: &Lookup<'_>) {
    for registry_id in &catalog.default_install {
        let Some(agent) = super::registry::find_agent(catalog, registry_id, platform) else {
            tracing::warn!(agent = %registry_id, "acp default install: not available on {platform}");
            continue;
        };
        match super::registry::resolve_agent(agent, platform, lookup) {
            Ok(launch) if launch.managed_version.is_none() => continue,
            Ok(launch) if launch.managed_version.as_deref() == Some(version_dir_name(&agent.version).as_str()) => continue,
            _ => {}
        }
        let plan = match install_plan(agent, platform, lookup) {
            Ok(plan) => plan,
            Err(reason) => {
                tracing::warn!(agent = %registry_id, "acp default install skipped: {reason}");
                continue;
            }
        };
        if !begin(registry_id) {
            continue;
        }
        tracing::info!(agent = %registry_id, method = ?plan.method(), "acp default install: installing");
        let job = InstallJob::new(agent, plan, agents_dir, lookup);
        let result = run_install(&job).await;
        finish(registry_id, &result);
    }
}
