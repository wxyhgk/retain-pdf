//! 能接的 agent 登记表：自带的（Python `retainpdf_ask_agent`）和本机装的（ACP 官方登记表里的那些）。
//!
//! 本机 agent 2026-11-26 起从 ACP 官方登记表（cdn.agentclientprotocol.com/registry/v1）来：仓库里一份快照
//! `registry-snapshot.json`（`ops/development/update_acp_registry.py` 刷新，运行时不联网取），配一份人工名单
//! `agents.json`（对外 id、推荐顺序、不列的、npx 装好后的命令名、还要另装的命令）。
//! 方案：docs/ops/planning/reader-ask/20261126-ACP官方登记表.md。
//!
//! 只起快照里有的 agent，命令名、参数、环境变量都是快照和名单里写死的，不收客户端给的。
//! 「装了」就是 PATH 上有那个命令（不经 shell）：binary 发行的是压缩包里的命令名，npx 的查名单 `bins`
//! （登记表没写，按 npm 的 bin 核过），uvx 的就是包名。不现场 npx / uvx 下载（见 [`resolve_agent`]），没装的给安装办法。
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

pub const BUILTIN_AGENT_ID: &str = "retainpdf";
/// 自带 agent 的 Python 模块（`python_bin -m retainpdf_ask_agent`，和翻译 worker 同一个环境）。
pub const BUILTIN_AGENT_MODULE: &str = "retainpdf_ask_agent";

const REGISTRY_SNAPSHOT: &str = include_str!("registry-snapshot.json");
const AGENT_OVERRIDES: &str = include_str!("agents.json");

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentKind {
    Builtin,
    Local,
}

/// 本机 agent 怎么发行的（也就是怎么装）。
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentDistribution {
    /// 下载压缩包，把里面的命令放进 PATH。
    Binary,
    /// npm 包：`npm install -g <包>`。
    Npx,
    /// Python 包：`uv tool install <包>`。
    Uvx,
}

// ---------- 快照和名单的形状（只读认识的字段） ----------

#[derive(Debug, Deserialize)]
struct RegistryIndex {
    agents: Vec<RegistryAgent>,
}

#[derive(Debug, Deserialize)]
struct RegistryAgent {
    id: String,
    name: String,
    #[serde(default)]
    version: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    website: Option<String>,
    #[serde(default)]
    repository: Option<String>,
    #[serde(default)]
    license: Option<String>,
    distribution: RegistryDistribution,
}

#[derive(Debug, Default, Deserialize)]
struct RegistryDistribution {
    #[serde(default)]
    binary: BTreeMap<String, BinaryTarget>,
    #[serde(default)]
    npx: Option<PackageTarget>,
    #[serde(default)]
    uvx: Option<PackageTarget>,
}

#[derive(Clone, Debug, Deserialize)]
struct BinaryTarget {
    archive: String,
    cmd: String,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    env: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Deserialize)]
struct PackageTarget {
    package: String,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    env: BTreeMap<String, String>,
}

#[derive(Debug, Default, Deserialize)]
struct Overrides {
    #[serde(default)]
    aliases: HashMap<String, String>,
    #[serde(default)]
    names: HashMap<String, String>,
    #[serde(default)]
    featured: Vec<String>,
    #[serde(default)]
    hidden: HashMap<String, String>,
    #[serde(default)]
    bins: HashMap<String, String>,
    #[serde(default)]
    requires: HashMap<String, Requirement>,
}

/// 还要 PATH 上另有的命令（pi-acp 要 `pi`）。
#[derive(Clone, Debug, Deserialize)]
struct Requirement {
    bin: String,
    package: String,
}

// ---------- 合起来的目录 ----------

/// 登记表里的一个 agent（已套上名单）。
#[derive(Debug)]
struct CatalogAgent {
    /// 对外 id（WebSocket 地址里的 `:agent_id`）：名单 `aliases` 改写过的，没改写就是登记表 id。
    id: String,
    registry_id: String,
    name: String,
    version: String,
    description: String,
    homepage: Option<String>,
    license: Option<String>,
    /// 在名单 `featured` 里的位置。
    featured: Option<usize>,
    binary: BTreeMap<String, BinaryTarget>,
    npx: Option<PackageTarget>,
    uvx: Option<PackageTarget>,
    /// npx 装好后的命令名（名单 `bins`）。
    npx_bin: Option<String>,
    requires: Option<Requirement>,
}

/// 一种起法：在 PATH 里找 `bin`，带上固定的参数和环境变量。
#[derive(Clone, Debug)]
struct Candidate {
    bin: String,
    args: Vec<String>,
    env: Vec<(String, String)>,
    distribution: AgentDistribution,
}

#[derive(Debug)]
pub(super) struct Catalog {
    agents: Vec<CatalogAgent>,
}

fn catalog() -> &'static Catalog {
    static CATALOG: OnceLock<Catalog> = OnceLock::new();
    CATALOG.get_or_init(|| build_catalog(REGISTRY_SNAPSHOT, AGENT_OVERRIDES).expect("acp registry snapshot and agents.json are valid"))
}

pub(super) fn build_catalog(registry: &str, overrides: &str) -> Result<Catalog, String> {
    let index: RegistryIndex = serde_json::from_str(registry).map_err(|error| format!("registry snapshot: {error}"))?;
    let mut overrides: Overrides = serde_json::from_str(overrides).map_err(|error| format!("agents.json: {error}"))?;
    let mut agents = Vec::new();
    for agent in index.agents {
        if overrides.hidden.contains_key(&agent.id) {
            continue;
        }
        let registry_id = agent.id;
        let id = overrides.aliases.remove(&registry_id).unwrap_or_else(|| registry_id.clone());
        let featured = overrides.featured.iter().position(|featured| featured == &registry_id);
        agents.push(CatalogAgent {
            name: overrides.names.remove(&registry_id).unwrap_or(agent.name),
            version: agent.version,
            description: agent.description,
            homepage: agent.website.or(agent.repository).filter(|url| !url.trim().is_empty()),
            license: agent.license.filter(|license| !license.trim().is_empty()),
            featured,
            binary: agent.distribution.binary,
            npx: agent.distribution.npx,
            uvx: agent.distribution.uvx,
            npx_bin: overrides.bins.remove(&registry_id),
            requires: overrides.requires.remove(&registry_id),
            id,
            registry_id,
        });
    }
    // 对外 id 不能撞：别名不能和别的登记表 id 重名，也不能叫 retainpdf
    let mut seen = std::collections::HashSet::from([BUILTIN_AGENT_ID.to_string()]);
    for agent in &agents {
        if !seen.insert(agent.id.clone()) {
            return Err(format!("duplicate agent id {}", agent.id));
        }
    }
    Ok(Catalog { agents })
}

/// 本机的平台在登记表 `binary` 里的写法：`darwin-aarch64`、`linux-x86_64`、`linux-x86_64-musl`、`windows-x86_64`……
pub fn current_platform() -> String {
    let os = match std::env::consts::OS {
        "macos" => "darwin",
        other => other,
    };
    let musl = if cfg!(target_env = "musl") { "-musl" } else { "" };
    format!("{os}-{}{musl}", std::env::consts::ARCH)
}

/// 压缩包里命令的文件名（`./dist-package/cursor-agent` → `cursor-agent`）。
fn command_name(cmd: &str) -> String {
    cmd.rsplit(['/', '\\']).next().unwrap_or(cmd).to_string()
}

/// `@scope/name@1.2.3` → `@scope/name`；`name==1.2.3`（uvx）→ `name`。
fn package_name(spec: &str) -> &str {
    if let Some((name, _)) = spec.split_once("==") {
        return name;
    }
    match spec.rfind('@') {
        Some(at) if at > 0 => &spec[..at],
        _ => spec,
    }
}

fn env_pairs(env: &BTreeMap<String, String>) -> Vec<(String, String)> {
    env.iter().map(|(name, value)| (name.clone(), value.clone())).collect()
}

impl CatalogAgent {
    /// 这个平台上的起法，按 binary、npx、uvx 的顺序（找到哪个用哪个）。
    fn candidates(&self, platform: &str) -> Vec<Candidate> {
        let mut candidates = Vec::new();
        if let Some(target) = self.binary.get(platform) {
            candidates.push(Candidate {
                bin: command_name(&target.cmd),
                args: target.args.clone(),
                env: env_pairs(&target.env),
                distribution: AgentDistribution::Binary,
            });
        }
        if let (Some(npx), Some(bin)) = (&self.npx, &self.npx_bin) {
            candidates.push(Candidate { bin: bin.clone(), args: npx.args.clone(), env: env_pairs(&npx.env), distribution: AgentDistribution::Npx });
        }
        if let Some(uvx) = &self.uvx {
            // uvx 起的就是和包同名的命令
            let bin = package_name(&uvx.package).to_string();
            candidates.push(Candidate { bin, args: uvx.args.clone(), env: env_pairs(&uvx.env), distribution: AgentDistribution::Uvx });
        }
        candidates
    }

    /// 这个平台上能不能起（没有这个平台的压缩包、npx 又没核过命令名的不列）。
    fn runs_on(&self, platform: &str) -> bool {
        !self.candidates(platform).is_empty()
    }

    /// 一条装好的命令（npm / uv）；只有压缩包的没有。还要另有的命令（pi-acp 要 pi）PATH 上没有时一起装。
    fn install_command(&self, path_var: Option<&std::ffi::OsStr>) -> Option<String> {
        if let (Some(npx), Some(_)) = (&self.npx, &self.npx_bin) {
            let mut packages = Vec::new();
            if let Some(requirement) = self.requires.as_ref().filter(|requirement| find_in_path(&requirement.bin, path_var).is_none()) {
                packages.push(requirement.package.as_str());
            }
            packages.push(package_name(&npx.package));
            return Some(format!("npm install -g {}", packages.join(" ")));
        }
        self.uvx.as_ref().map(|uvx| format!("uv tool install {}", package_name(&uvx.package)))
    }

    fn install_url(&self, platform: &str) -> Option<String> {
        self.binary.get(platform).map(|target| target.archive.clone())
    }

    /// 没装时怎么跟用户说。
    fn missing_reason(&self, platform: &str, candidates: &[Candidate], path_var: Option<&std::ffi::OsStr>) -> String {
        let bin = candidates.first().map(|candidate| candidate.bin.as_str()).unwrap_or(&self.registry_id);
        if let Some(install) = self.install_command(path_var) {
            return format!("没装 {bin}：先在终端运行 {install}");
        }
        let archive = self.install_url(platform).unwrap_or_default();
        match &self.homepage {
            Some(homepage) => format!("没装 {bin}：下载 {archive} 解压，把 {bin} 放进 PATH（说明见 {homepage}）"),
            None => format!("没装 {bin}：下载 {archive} 解压，把 {bin} 放进 PATH"),
        }
    }
}

/// 选中的起法：绝对路径的程序、参数、加的环境变量（都来自快照）。
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ResolvedLaunch {
    pub program: PathBuf,
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
    pub distribution: AgentDistribution,
}

/// 在 PATH 里找可执行文件（不经 shell）。
pub fn find_in_path(program: &str, path_var: Option<&std::ffi::OsStr>) -> Option<PathBuf> {
    let path_var = path_var?;
    std::env::split_paths(path_var)
        .map(|dir| dir.join(program))
        .find(|candidate| is_executable(candidate))
}

fn is_executable(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        path.metadata().map(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0).unwrap_or(false)
    }
    #[cfg(not(unix))]
    {
        path.is_file()
    }
}

/// 找装好的那个起法。不现场 npx / uvx 下载：2026-11-25 以前没装单独的适配器时用 `npx -y <包>` 现场下载再起，
/// Claude Code 的适配器第一次要下约 384 MB，下到一半连接断了，桥结束 npx，`~/.npm/_npx` 里留下只写了一半的
/// 可执行文件，之后每次都报 `spawn ... -88`（macOS EBADMACHO），自己恢复不了。现在没装就列成不能用、给安装办法。
fn resolve_agent(agent: &CatalogAgent, platform: &str, path_var: Option<&std::ffi::OsStr>) -> Result<ResolvedLaunch, String> {
    let candidates = agent.candidates(platform);
    let found = candidates
        .iter()
        .find_map(|candidate| find_in_path(&candidate.bin, path_var).map(|program| (candidate, program)));
    let Some((candidate, program)) = found else {
        return Err(agent.missing_reason(platform, &candidates, path_var));
    };
    if let Some(requirement) = &agent.requires {
        if find_in_path(&requirement.bin, path_var).is_none() {
            return Err(format!(
                "{} 要 PATH 上有 {}：先在终端运行 npm install -g {}",
                candidate.bin, requirement.bin, requirement.package
            ));
        }
    }
    Ok(ResolvedLaunch { program, args: candidate.args.clone(), env: candidate.env.clone(), distribution: candidate.distribution })
}

fn find_agent<'a>(catalog: &'a Catalog, id: &str, platform: &str) -> Option<&'a CatalogAgent> {
    // 对外 id 和登记表 id 都认（claude-code 和 claude-acp 是同一个）
    catalog
        .agents
        .iter()
        .find(|agent| (agent.id == id || agent.registry_id == id) && agent.runs_on(platform))
}

/// 本机 agent 的起法（`id` 不认识、这个平台起不了返回 None）。
pub fn resolve_local_agent(id: &str, path_var: Option<&std::ffi::OsStr>) -> Option<Result<ResolvedLaunch, String>> {
    let platform = current_platform();
    find_agent(catalog(), id, &platform).map(|agent| resolve_agent(agent, &platform, path_var))
}

pub fn is_local_agent(id: &str) -> bool {
    find_agent(catalog(), id, &current_platform()).is_some()
}

/// `GET /ai/agents` 里的一项。
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct AgentView {
    pub id: String,
    pub name: String,
    pub kind: AgentKind,
    pub available: bool,
    /// 不能用的原因；能用时是空串。
    pub reason: String,
    /// 本机 agent 实际怎么起（给用户看）；自带的、没装的没有。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub launch: Option<String>,
    /// 本机 agent 的安装命令（在终端跑一次）；自带的、只有压缩包的没有。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub install: Option<String>,
    /// 以下 2026-11-26 加（只增）：ACP 官方登记表里的 id（`claude-code` 在登记表里叫 `claude-acp`）。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registry_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// 快照里登记的版本（不是本机装的版本）。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub license: Option<String>,
    /// 装了的按找到的那种；没装的按推荐的装法（有 npm / uv 命令的用它，不然压缩包）。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub distribution: Option<AgentDistribution>,
    /// 只有压缩包的：这个平台的下载地址。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub install_url: Option<String>,
    /// 推荐的几个（名单 `featured`）；前端可以把其余没装的折起来。
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub featured: bool,
}

fn builtin_view() -> AgentView {
    AgentView {
        id: BUILTIN_AGENT_ID.into(),
        name: "RetainPDF 自带模型".into(),
        kind: AgentKind::Builtin,
        available: true,
        reason: String::new(),
        launch: None,
        install: None,
        registry_id: None,
        description: None,
        version: None,
        homepage: None,
        license: None,
        distribution: None,
        install_url: None,
        featured: false,
    }
}

fn local_view(agent: &CatalogAgent, local_reason: &str, platform: &str, path_var: Option<&std::ffi::OsStr>) -> AgentView {
    let candidates = agent.candidates(platform);
    let install = agent.install_command(path_var);
    let preferred = if install.is_some() {
        candidates.iter().find(|candidate| candidate.distribution != AgentDistribution::Binary)
    } else {
        candidates.first()
    };
    let mut distribution = preferred.map(|candidate| candidate.distribution);
    let (available, reason, launch) = if !local_reason.is_empty() {
        (false, local_reason.to_string(), None)
    } else {
        match resolve_agent(agent, platform, path_var) {
            Ok(resolved) => {
                distribution = Some(resolved.distribution);
                let program = resolved.program.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default();
                (true, String::new(), Some([program].into_iter().chain(resolved.args).collect::<Vec<_>>().join(" ")))
            }
            Err(reason) => (false, reason, None),
        }
    };
    AgentView {
        id: agent.id.clone(),
        name: agent.name.clone(),
        kind: AgentKind::Local,
        available,
        reason,
        launch,
        install_url: if install.is_none() { agent.install_url(platform) } else { None },
        install,
        registry_id: Some(agent.registry_id.clone()),
        description: Some(agent.description.clone()).filter(|text| !text.trim().is_empty()),
        version: Some(agent.version.clone()).filter(|text| !text.trim().is_empty()),
        homepage: agent.homepage.clone(),
        license: agent.license.clone(),
        distribution,
        featured: agent.featured.is_some(),
    }
}

/// 列出所有 agent：自带的排第一，本机的能用的在前，再按推荐顺序，其余按名字。
/// `local_reason` 不空时本机 agent 一律不能用（服务器、多用户、监听非回环……）。
pub fn list_agents(local_reason: &str, path_var: Option<&std::ffi::OsStr>) -> Vec<AgentView> {
    list_agents_on(catalog(), &current_platform(), local_reason, path_var)
}

pub(super) fn list_agents_on(catalog: &Catalog, platform: &str, local_reason: &str, path_var: Option<&std::ffi::OsStr>) -> Vec<AgentView> {
    let mut locals: Vec<(Option<usize>, AgentView)> = catalog
        .agents
        .iter()
        .filter(|agent| agent.runs_on(platform))
        .map(|agent| (agent.featured, local_view(agent, local_reason, platform, path_var)))
        .collect();
    locals.sort_by(|(rank_a, a), (rank_b, b)| {
        (!a.available, rank_a.unwrap_or(usize::MAX), a.name.to_lowercase())
            .cmp(&(!b.available, rank_b.unwrap_or(usize::MAX), b.name.to_lowercase()))
    });
    std::iter::once(builtin_view()).chain(locals.into_iter().map(|(_, view)| view)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_and_overrides_parse_and_agree() {
        let catalog = build_catalog(REGISTRY_SNAPSHOT, AGENT_OVERRIDES).unwrap();
        let overrides: Overrides = serde_json::from_str(AGENT_OVERRIDES).unwrap();
        let index: RegistryIndex = serde_json::from_str(REGISTRY_SNAPSHOT).unwrap();
        let registry_ids: Vec<&str> = index.agents.iter().map(|agent| agent.id.as_str()).collect();
        // 名单里写的 id 都在快照里（刷新快照后有 agent 被删了，这里会红）
        let named = overrides
            .aliases
            .keys()
            .chain(overrides.names.keys())
            .chain(overrides.featured.iter())
            .chain(overrides.hidden.keys())
            .chain(overrides.bins.keys())
            .chain(overrides.requires.keys());
        for id in named {
            assert!(registry_ids.contains(&id.as_str()), "agents.json names {id}, which is not in the registry snapshot");
        }
        // 2026-11-25 前端就用的三个 id 还在
        for (id, registry_id) in [("claude-code", "claude-acp"), ("codex", "codex-acp"), ("gemini", "gemini")] {
            let agent = catalog.agents.iter().find(|agent| agent.id == id).unwrap();
            assert_eq!(agent.registry_id, registry_id);
        }
        assert!(catalog.agents.iter().all(|agent| !overrides.hidden.contains_key(&agent.registry_id)));
        // 只有 npx 的都核过命令名（没核过的这个平台上列不出来）
        for agent in &catalog.agents {
            if agent.binary.is_empty() && agent.uvx.is_none() {
                assert!(agent.npx_bin.is_some(), "{} is npx-only but has no bins entry in agents.json", agent.registry_id);
            }
        }
    }

    #[test]
    fn aliases_must_not_collide() {
        let registry = r#"{"agents":[
            {"id":"a","name":"A","distribution":{"uvx":{"package":"a"}}},
            {"id":"b","name":"B","distribution":{"uvx":{"package":"b"}}}]}"#;
        assert!(build_catalog(registry, r#"{"aliases":{"a":"b"}}"#).unwrap_err().contains("duplicate"));
        assert!(build_catalog(registry, r#"{"aliases":{"a":"retainpdf"}}"#).unwrap_err().contains("duplicate"));
        assert!(build_catalog(registry, "{}").is_ok());
    }

    #[test]
    fn names_from_the_registry_entries() {
        assert_eq!(command_name("./dist-package/cursor-agent"), "cursor-agent");
        assert_eq!(command_name("./dist-package\\cursor-agent.cmd"), "cursor-agent.cmd");
        assert_eq!(command_name("harn.exe"), "harn.exe");
        assert_eq!(package_name("@google/gemini-cli@0.71.1"), "@google/gemini-cli");
        assert_eq!(package_name("pi-acp@0.0.35"), "pi-acp");
        assert_eq!(package_name("pi-acp"), "pi-acp");
        assert_eq!(package_name("fast-agent-acp==0.10.66"), "fast-agent-acp");
        let platform = current_platform();
        assert!(platform.contains('-') && !platform.starts_with("macos"), "{platform}");
    }
}
