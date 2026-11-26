use super::*;
use axum::http::HeaderValue;
use axum::response::IntoResponse;

fn status(error: AppError) -> u16 {
    error.into_response().status().as_u16()
}

struct Root(PathBuf);

impl Drop for Root {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn temp_root(name: &str) -> Root {
    let root = std::env::temp_dir().join(format!("retainpdf-acp-{name}-{}-{}", std::process::id(), fastrand::u64(..)));
    std::fs::create_dir_all(root.join("books")).unwrap();
    std::fs::create_dir_all(root.join("bin")).unwrap();
    Root(root)
}

#[cfg(unix)]
fn fake_command(root: &Path, name: &str) {
    use std::os::unix::fs::PermissionsExt;
    let path = root.join("bin").join(name);
    std::fs::write(&path, "#!/bin/sh\nexit 0\n").unwrap();
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
}

fn config(root: &Path) -> AcpConfig {
    AcpConfig {
        multi_user: false,
        listens_on_loopback: true,
        data_root: root.to_path_buf(),
        python_bin: "/usr/bin/python3".into(),
        agent_keys: HashSet::from(["agent-b".to_string(), "agent-a".to_string()]),
        api_keys: HashSet::from(["main-key".to_string()]),
        backend_url: "http://127.0.0.1:41000".into(),
        local_agents_flag: None,
        path_var: Some(root.join("bin").into_os_string()),
        current_exe: Some(root.join("bin").join("rust_api")),
        backend_root: Some(root.join("backend")),
        agents_dir: root.join(AGENTS_DIR_NAME),
        node_dir: None,
        node_bin: None,
        openui_dir: None,
        openui_check_dir: None,
    }
}

fn local_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert("host", HeaderValue::from_static("127.0.0.1:41000"));
    headers
}

#[cfg(unix)]
#[test]
fn lists_builtin_and_installed_local_agents() {
    let root = temp_root("list");
    // 只装了 claude 和 npx、没装适配器：不现场 npx 下载（下到一半断开会留下坏缓存），列成不能用、给安装命令
    fake_command(&root.0, "claude");
    fake_command(&root.0, "npx");
    fake_command(&root.0, "codex-acp");
    fake_command(&root.0, "gemini");
    let view = agents_view(&config(&root.0));
    assert!(view.local_agents.enabled);
    let by_id = |id: &str| view.agents.iter().find(|agent| agent.id == id).unwrap().clone();
    assert!(by_id("retainpdf").available && by_id("retainpdf").kind == AgentKind::Builtin);
    let claude = by_id("claude-code");
    assert!(!claude.available && claude.launch.is_none(), "{claude:?}");
    assert!(claude.reason.contains("npm install -g @agentclientprotocol/claude-agent-acp"), "{claude:?}");
    assert_eq!(claude.install.as_deref(), Some("npm install -g @agentclientprotocol/claude-agent-acp"));
    let codex = by_id("codex");
    assert!(codex.available && codex.launch.as_deref() == Some("codex-acp"), "{codex:?}");
    assert!(by_id("retainpdf").install.is_none());
    assert_eq!(by_id("gemini").launch.as_deref(), Some("gemini --acp"));
    assert_eq!(prepare_agent(&config(&root.0), "claude-code", &local_headers(), &AcpConnectQuery::default(), None).map(|_| ()).map_err(status).unwrap_err(), 404);

    // 服务器上：本机 agent 全关，自带的照样能用
    let mut server = config(&root.0);
    server.listens_on_loopback = false;
    let view = agents_view(&server);
    assert!(!view.local_agents.enabled);
    assert!(view.agents.iter().all(|agent| agent.kind == AgentKind::Builtin || (!agent.available && agent.reason == view.local_agents.reason)));
    let json = serde_json::to_value(&view).unwrap();
    assert_eq!(json["agents"][0]["kind"], "builtin");
    assert!(json["agents"][0].get("launch").is_none());
}

#[cfg(unix)]
#[test]
fn local_agent_handshake_is_gated_and_gets_the_mcp_server() {
    let root = temp_root("local");
    fake_command(&root.0, "gemini");
    fake_command(&root.0, "retainpdf");
    let config = config(&root.0);
    let (process, defaults) = prepare_agent(&config, "gemini", &local_headers(), &AcpConnectQuery::default(), None).unwrap();
    assert_eq!(process.program, root.0.join("bin").join("gemini"));
    assert_eq!(process.args, vec!["--acp"]);
    assert_eq!(defaults.cwd.as_deref(), Some(root.0.join("books").as_path()));
    let server = defaults.mcp_server.unwrap();
    assert_eq!(server["command"], root.0.join("bin").join("retainpdf").to_string_lossy().as_ref());
    assert_eq!(server["env"][0]["value"], "agent-a");

    // 局域网地址、经过代理、服务器部署、没装、不认识的 agent
    let mut lan = HeaderMap::new();
    lan.insert("host", HeaderValue::from_static("192.168.1.5:41000"));
    assert_eq!(prepare_agent(&config, "gemini", &lan, &AcpConnectQuery::default(), None).map(|_| ()).map_err(status).unwrap_err(), 403);
    let mut proxied = local_headers();
    proxied.insert("x-forwarded-for", HeaderValue::from_static("192.168.1.9"));
    assert_eq!(prepare_agent(&config, "gemini", &proxied, &AcpConnectQuery::default(), None).map(|_| ()).map_err(status).unwrap_err(), 403);
    let mut server = config.clone();
    server.multi_user = true;
    assert_eq!(prepare_agent(&server, "gemini", &local_headers(), &AcpConnectQuery::default(), None).map(|_| ()).map_err(status).unwrap_err(), 403);
    assert_eq!(prepare_agent(&config, "codex", &local_headers(), &AcpConnectQuery::default(), None).map(|_| ()).map_err(status).unwrap_err(), 404);
    assert_eq!(prepare_agent(&config, "bash", &local_headers(), &AcpConnectQuery::default(), None).map(|_| ()).map_err(status).unwrap_err(), 404);
}

#[cfg(unix)]
fn write_vault(root: &Path) {
    use std::os::unix::fs::PermissionsExt;
    let dir = root.join("secrets");
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700)).unwrap();
    let path = dir.join("credentials.json");
    std::fs::write(&path, r#"{"schema":"retainpdf_credential_vault_v1","credentials":{"cred_ask":{"kind":"translation_api_key","provider":"anthropic","secret":"synthetic-secret-value"}}}"#).unwrap();
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).unwrap();
}

#[cfg(unix)]
#[test]
fn builtin_agent_gets_the_model_config_and_key_through_its_environment() {
    let root = temp_root("builtin");
    write_vault(&root.0);
    let mut server = config(&root.0);
    // 服务器上也能用自带的，握手的 Host 不查
    server.listens_on_loopback = false;
    let query = AcpConnectQuery {
        model: "claude-haiku-5-5".into(),
        base_url: "https://api.anthropic.com/v1".into(),
        api_protocol: "anthropic".into(),
        thinking: "low".into(),
        credential_ref: "cred_ask".into(),
        job_id: String::new(),
        conversation_id: String::new(),
    };
    let (process, _) = prepare_agent(&server, "retainpdf", &HeaderMap::new(), &query, None).unwrap();
    assert_eq!(process.program, PathBuf::from("/usr/bin/python3"));
    assert_eq!(process.args, vec!["-m", "retainpdf_ask_agent"]);
    let env: std::collections::HashMap<_, _> = process.env.into_iter().collect();
    assert_eq!(env[ASK_ENV_MODEL], "claude-haiku-5-5");
    assert_eq!(env[ASK_ENV_API_PROTOCOL], "anthropic");
    assert_eq!(env[ASK_ENV_THINKING], "low");
    assert_eq!(env[ASK_ENV_API_KEY], "synthetic-secret-value");
    // 没给书：不给读书的东西（和以前一样只靠 prompt 里的上下文）；后端地址和密钥照给（记忆工具用，2026-11-26），没给对话不给对话编号
    assert!(!env.contains_key(ASK_ENV_JOB_ID) && !env.contains_key(ASK_ENV_DOCUMENT_ID));
    assert_eq!((env[ASK_ENV_BACKEND_URL].as_str(), env[ASK_ENV_BACKEND_KEY].as_str()), ("http://127.0.0.1:41000", "agent-a"));
    assert!(!env.contains_key(ASK_ENV_CONVERSATION_ID));
    // 握手带了对话：交给 agent；写法不对 400
    let with_conversation = AcpConnectQuery { conversation_id: " conv-20261126-abc ".into(), ..query.clone() };
    let (process, _) = prepare_agent(&server, "retainpdf", &HeaderMap::new(), &with_conversation, None).unwrap();
    let env: std::collections::HashMap<_, _> = process.env.into_iter().collect();
    assert_eq!(env[ASK_ENV_CONVERSATION_ID], "conv-20261126-abc");
    let bad_conversation = AcpConnectQuery { conversation_id: "../x".into(), ..query.clone() };
    assert_eq!(prepare_agent(&server, "retainpdf", &HeaderMap::new(), &bad_conversation, None).map_err(status).unwrap_err(), 400);

    let bad = |change: fn(&mut AcpConnectQuery)| {
        let mut query = query.clone();
        change(&mut query);
        prepare_agent(&server, "retainpdf", &HeaderMap::new(), &query, None).map(|_| ()).map_err(status).unwrap_err()
    };
    assert_eq!(bad(|q| q.model.clear()), 400);
    assert_eq!(bad(|q| q.api_protocol = "grpc".into()), 400);
    assert_eq!(bad(|q| q.base_url = "file:///etc".into()), 400);
    assert_eq!(bad(|q| q.credential_ref.clear()), 400);
    assert_eq!(bad(|q| q.credential_ref = "cred_missing".into()), 400);
}

#[cfg(unix)]
#[test]
fn builtin_agent_with_a_book_gets_the_backend_and_a_reading_key() {
    let root = temp_root("book");
    write_vault(&root.0);
    let query = AcpConnectQuery {
        model: "claude-haiku-5-5".into(),
        api_protocol: "anthropic".into(),
        credential_ref: "cred_ask".into(),
        job_id: "job-1".into(),
        ..AcpConnectQuery::default()
    };
    let book = AskBook { job_id: "job-1".into(), document_id: Some("doc-1".into()) };
    let env_of = |config: &AcpConfig| -> std::collections::HashMap<String, String> {
        prepare_agent(config, "retainpdf", &HeaderMap::new(), &query, Some(&book)).unwrap().0.env.into_iter().collect()
    };
    let env = env_of(&config(&root.0));
    assert_eq!(env[ASK_ENV_JOB_ID], "job-1");
    assert_eq!(env[ASK_ENV_DOCUMENT_ID], "doc-1");
    assert_eq!(env[ASK_ENV_BACKEND_URL], "http://127.0.0.1:41000");
    // 有 AI 专用密钥用它（排序后的第一把）
    assert_eq!(env[ASK_ENV_BACKEND_KEY], "agent-a");
    // 没配 AI 专用密钥：用本机主密钥
    let mut no_agent_keys = config(&root.0);
    no_agent_keys.agent_keys.clear();
    assert_eq!(env_of(&no_agent_keys)[ASK_ENV_BACKEND_KEY], "main-key");
    // 一把都没有：不给读书的东西
    no_agent_keys.api_keys.clear();
    assert!(!env_of(&no_agent_keys).contains_key(ASK_ENV_JOB_ID));
}

#[test]
fn job_id_from_the_handshake_is_checked() {
    let with = |job_id: &str| AcpConnectQuery { job_id: job_id.into(), ..AcpConnectQuery::default() };
    assert_eq!(ask_job_id(&with("")).unwrap(), None);
    assert_eq!(ask_job_id(&with("  ")).unwrap(), None);
    assert_eq!(ask_job_id(&with("20261125-abc_1")).unwrap().as_deref(), Some("20261125-abc_1"));
    let merged = format!("merged-{}-{}", "a".repeat(64), "b".repeat(16));
    assert_eq!(ask_job_id(&with(&merged)).unwrap().as_deref(), Some(merged.as_str()));
    let long = "x".repeat(201);
    for bad in ["../etc", "a/b", "a b", "a?x=1", long.as_str()] {
        assert_eq!(ask_job_id(&with(bad)).map_err(status).unwrap_err(), 400, "{bad}");
    }
}

#[test]
fn backend_url_is_the_loopback_address() {
    assert_eq!(loopback_base_url("127.0.0.1", 41000), "http://127.0.0.1:41000");
    assert_eq!(loopback_base_url("0.0.0.0", 41000), "http://127.0.0.1:41000");
    assert_eq!(loopback_base_url("::", 8), "http://[::1]:8");
    assert_eq!(loopback_base_url("::1", 8), "http://[::1]:8");
    assert_eq!(loopback_base_url("localhost", 8), "http://localhost:8");
}

#[cfg(unix)]
#[test]
fn registry_agents_are_detected_on_path_with_their_fixed_args_and_env() {
    let root = temp_root("registry");
    let config = config(&root.0);
    let by_id = |id: &str| agents_view(&config).agents.into_iter().find(|agent| agent.id == id);

    // pi-acp 要 PATH 上另有 pi：只装了适配器时说清楚还缺什么
    fake_command(&root.0, "pi-acp");
    let pi = by_id("pi-acp").unwrap();
    assert!(!pi.available && pi.reason.contains("pi") && pi.reason.contains("@earendil-works/pi-coding-agent"), "{pi:?}");
    assert_eq!(pi.install.as_deref(), Some("npm install -g @earendil-works/pi-coding-agent pi-acp"));
    assert_eq!(pi.registry_id.as_deref(), Some("pi-acp"));
    assert_eq!(pi.distribution, Some(AgentDistribution::Npx));
    assert!(pi.featured && pi.homepage.is_some() && pi.version.is_some());
    assert_eq!(prepare_agent(&config, "pi-acp", &local_headers(), &AcpConnectQuery::default(), None).map(|_| ()).map_err(status).unwrap_err(), 404);
    fake_command(&root.0, "pi");
    let pi = by_id("pi-acp").unwrap();
    assert!(pi.available && pi.launch.as_deref() == Some("pi-acp"), "{pi:?}");
    assert_eq!(pi.install.as_deref(), Some("npm install -g pi-acp"));
    let (process, defaults) = prepare_agent(&config, "pi-acp", &local_headers(), &AcpConnectQuery::default(), None).unwrap();
    assert_eq!(process.program, root.0.join("bin").join("pi-acp"));
    assert!(process.args.is_empty() && process.env.is_empty());
    assert_eq!(defaults.cwd.as_deref(), Some(root.0.join("books").as_path()));
    // 闸门照旧：局域网地址不起
    let mut lan = HeaderMap::new();
    lan.insert("host", HeaderValue::from_static("192.168.1.5:41000"));
    assert_eq!(prepare_agent(&config, "pi-acp", &lan, &AcpConnectQuery::default(), None).map(|_| ()).map_err(status).unwrap_err(), 403);

    // 登记表的固定参数和环境变量（droid 关自动更新）
    fake_command(&root.0, "droid");
    let (process, _) = prepare_agent(&config, "factory-droid", &local_headers(), &AcpConnectQuery::default(), None).unwrap();
    assert_eq!(process.args, vec!["exec", "--output-format", "acp-daemon"]);
    let env: std::collections::HashMap<_, _> = process.env.into_iter().collect();
    assert_eq!(env["DROID_DISABLE_AUTO_UPDATE"], "true");

    // uvx 的命令名就是包名，安装命令是 uv tool install
    let fast = by_id("fast-agent").unwrap();
    assert!(!fast.available && fast.reason.contains("fast-agent-acp"), "{fast:?}");
    assert_eq!(fast.install.as_deref(), Some("uv tool install fast-agent-acp"));
    assert_eq!(fast.distribution, Some(AgentDistribution::Uvx));

    // 装了的排在前面（自带的之后），再按推荐顺序
    fake_command(&root.0, "qwen");
    let agents = agents_view(&config).agents;
    let ids: Vec<&str> = agents.iter().map(|agent| agent.id.as_str()).collect();
    // retainpdf-pi 紧跟在 retainpdf 后面（这里没放 backend/pi-agent，不能用）
    assert_eq!(&ids[..5], ["retainpdf", "retainpdf-pi", "pi-acp", "qwen-code", "factory-droid"], "{ids:?}");
    assert_eq!(agents[3].launch.as_deref(), Some("qwen --acp --experimental-skills"));
    let first_missing = agents.iter().skip(2).position(|agent| !agent.available).unwrap() + 2;
    assert_eq!(agents[first_missing].id, "claude-code");
    assert!(agents[first_missing..].iter().all(|agent| !agent.available));
}

#[cfg(unix)]
#[test]
fn old_ids_stay_and_registry_ids_are_aliases() {
    let root = temp_root("alias");
    fake_command(&root.0, "claude-agent-acp");
    let config = config(&root.0);
    let view = agents_view(&config);
    let claude = view.agents.iter().find(|agent| agent.id == "claude-code").unwrap();
    assert_eq!(claude.name, "Claude Code");
    assert_eq!(claude.registry_id.as_deref(), Some("claude-acp"));
    assert_eq!(view.agents.iter().find(|agent| agent.id == "codex").unwrap().registry_id.as_deref(), Some("codex-acp"));
    // 登记表 id 不另列一行，但握手时也认
    assert!(view.agents.iter().all(|agent| agent.id != "claude-acp" && agent.id != "codex-acp"));
    let (by_old, _) = prepare_agent(&config, "claude-code", &local_headers(), &AcpConnectQuery::default(), None).unwrap();
    let (by_registry, _) = prepare_agent(&config, "claude-acp", &local_headers(), &AcpConnectQuery::default(), None).unwrap();
    assert_eq!(by_old.program, by_registry.program);
    assert_eq!(by_old.program, root.0.join("bin").join("claude-agent-acp"));

    // 不列的（付费市场、旧 id）列表里没有，也起不了
    for hidden in ["agoragentic-acp", "opencode-v2", "kimi"] {
        assert!(view.agents.iter().all(|agent| agent.registry_id.as_deref() != Some(hidden)), "{hidden}");
        assert_eq!(prepare_agent(&config, hidden, &local_headers(), &AcpConnectQuery::default(), None).map(|_| ()).map_err(status).unwrap_err(), 404, "{hidden}");
    }
    // 自带的 id 不会被登记表占掉
    assert_eq!(view.agents.iter().filter(|agent| agent.id == BUILTIN_AGENT_ID).count(), 1);
}

#[cfg(unix)]
#[test]
fn binary_agents_use_the_archive_command_for_this_platform() {
    let registry = r#"{"agents":[
        {"id":"goose","name":"goose","version":"1.0.0","description":"d","website":"https://goose.example","distribution":{"binary":{
            "linux-x86_64":{"archive":"https://example.com/goose-linux.tar.gz","cmd":"./goose","args":["acp"],"env":{"GOOSE_X":"1"}},
            "darwin-aarch64":{"archive":"https://example.com/goose-mac.tar.gz","cmd":"./goose","args":["acp"]}}}},
        {"id":"cursor","name":"Cursor","distribution":{"binary":{
            "linux-x86_64":{"archive":"https://example.com/cursor.tar.gz","cmd":"./dist-package/cursor-agent","args":["acp"]}}}},
        {"id":"mac-only","name":"Mac only","distribution":{"binary":{
            "darwin-aarch64":{"archive":"https://example.com/m.zip","cmd":"./m"}}}},
        {"id":"npx-unknown","name":"No bin","distribution":{"npx":{"package":"x@1"}}}]}"#;
    let catalog = registry::build_catalog(registry, "{}").unwrap();
    let root = temp_root("binary");
    fake_command(&root.0, "goose");
    let path = root.0.join("bin").into_os_string();
    let lookup = registry::Lookup { path_var: Some(&path), ..Default::default() };
    let views = registry::list_agents_on(&catalog, "linux-x86_64", "", &lookup);
    let ids: Vec<&str> = views.iter().map(|agent| agent.id.as_str()).collect();
    // 这个平台没有压缩包的、npx 又没核过命令名的不列
    assert_eq!(ids, ["retainpdf", "goose", "cursor"]);
    let goose = &views[1];
    assert!(goose.available && goose.launch.as_deref() == Some("goose acp"), "{goose:?}");
    assert_eq!(goose.distribution, Some(AgentDistribution::Binary));
    let cursor = &views[2];
    assert!(!cursor.available && cursor.install.is_none(), "{cursor:?}");
    assert_eq!(cursor.install_url.as_deref(), Some("https://example.com/cursor.tar.gz"));
    assert!(cursor.reason.contains("cursor-agent") && cursor.reason.contains("https://example.com/cursor.tar.gz"), "{cursor:?}");
    // 本机 agent 关着：一律不能用，原因是闸门的
    let views = registry::list_agents_on(&catalog, "darwin-aarch64", "多用户模式不起本机 agent", &lookup);
    assert_eq!(views.len(), 3);
    assert!(views[1..].iter().all(|agent| !agent.available && agent.reason == "多用户模式不起本机 agent"));
}

// ---------- retainpdf-pi（2026-11-26） ----------

/// 仓库里 retainpdf-pi 要的文件：包装脚本、扩展、自带 agent 的两份提示词。
#[cfg(unix)]
fn fake_pi_agent(root: &Path) {
    let backend = root.join("backend");
    std::fs::create_dir_all(backend.join("pi-agent/bin")).unwrap();
    std::fs::create_dir_all(backend.join("pi-agent/extension")).unwrap();
    std::fs::create_dir_all(backend.join("ask-agent/retainpdf_ask_agent/prompts")).unwrap();
    std::fs::write(backend.join("pi-agent/bin/retainpdf-pi"), "#!/bin/sh\n").unwrap();
    std::fs::write(backend.join("pi-agent/extension/index.ts"), "export default () => {};\n").unwrap();
    for name in ["ask_system.txt", "ask_tools.txt"] {
        std::fs::write(backend.join("ask-agent/retainpdf_ask_agent/prompts").join(name), "prompt").unwrap();
    }
}

#[cfg(unix)]
fn pi_query() -> AcpConnectQuery {
    AcpConnectQuery {
        model: "claude-haiku-5-5".into(),
        base_url: "https://api.anthropic.com/v1".into(),
        api_protocol: "anthropic".into(),
        thinking: String::new(),
        credential_ref: "cred_ask".into(),
        job_id: "job-1".into(),
        conversation_id: String::new(),
    }
}

#[cfg(unix)]
#[test]
fn retainpdf_pi_is_listed_as_builtin_and_says_what_is_missing() {
    let root = temp_root("pi-list");
    let config = config(&root.0);
    let pi_row = |config: &AcpConfig| agents_view(config).agents.into_iter().find(|agent| agent.id == PI_AGENT_ID).unwrap();

    // 没装 pi-acp、pi：给登记表里的安装命令（两个一起装）
    fake_pi_agent(&root.0);
    let row = pi_row(&config);
    assert_eq!(row.kind, AgentKind::Builtin);
    assert!(!row.available && row.reason.contains("pi-acp"), "{row:?}");
    assert_eq!(row.install.as_deref(), Some("npm install -g @earendil-works/pi-coding-agent pi-acp"));
    // 只装了 pi-acp：说清楚还缺 pi
    fake_command(&root.0, "pi-acp");
    let row = pi_row(&config);
    assert!(!row.available && row.reason.contains("@earendil-works/pi-coding-agent"), "{row:?}");
    // 都装了：能用，排在 retainpdf 后面
    fake_command(&root.0, "pi");
    let view = agents_view(&config);
    assert_eq!(view.agents[1].id, PI_AGENT_ID);
    assert!(view.agents[1].available && view.agents[1].reason.is_empty() && view.agents[1].install.is_none(), "{:?}", view.agents[1]);
    let json = serde_json::to_value(&view.agents[1]).unwrap();
    assert_eq!(json["kind"], "builtin");
    assert!(json.get("launch").is_none() && json.get("registry_id").is_none());

    // 安装包没带 backend/pi-agent
    let mut no_files = config.clone();
    no_files.backend_root = None;
    assert!(pi_row(&no_files).reason.contains("backend/pi-agent"));
    // 服务器上：和本机 agent 一样关着（Python 的 retainpdf 照样能用）
    let mut server = config.clone();
    server.listens_on_loopback = false;
    let view = agents_view(&server);
    let row = view.agents.iter().find(|agent| agent.id == PI_AGENT_ID).unwrap();
    assert!(!row.available && row.reason == view.local_agents.reason);
    assert!(view.agents[0].available);
}

#[cfg(unix)]
#[test]
fn retainpdf_pi_handshake_is_gated_and_launches_pi_acp_through_the_wrapper() {
    let root = temp_root("pi-launch");
    write_vault(&root.0);
    fake_pi_agent(&root.0);
    fake_command(&root.0, "pi-acp");
    fake_command(&root.0, "pi");
    let config = config(&root.0);
    let book = AskBook { job_id: "job-1".into(), document_id: Some("doc-1".into()) };
    assert!(is_builtin_agent(PI_AGENT_ID) && is_builtin_agent(BUILTIN_AGENT_ID) && !is_builtin_agent("pi-acp"));

    // 闸门：局域网地址、经过代理、多用户、关了本机 agent 都不起
    let mut lan = HeaderMap::new();
    lan.insert("host", HeaderValue::from_static("192.168.1.5:41000"));
    assert_eq!(prepare_agent(&config, PI_AGENT_ID, &lan, &pi_query(), Some(&book)).map(|_| ()).map_err(status).unwrap_err(), 403);
    let mut proxied = local_headers();
    proxied.insert("x-forwarded-for", HeaderValue::from_static("192.168.1.9"));
    assert_eq!(prepare_agent(&config, PI_AGENT_ID, &proxied, &pi_query(), Some(&book)).map(|_| ()).map_err(status).unwrap_err(), 403);
    let mut off = config.clone();
    off.local_agents_flag = Some("0".into());
    assert_eq!(prepare_agent(&off, PI_AGENT_ID, &local_headers(), &pi_query(), Some(&book)).map(|_| ()).map_err(status).unwrap_err(), 403);
    // 模型配置和自带的一样要
    let mut no_credential = pi_query();
    no_credential.credential_ref.clear();
    assert_eq!(prepare_agent(&config, PI_AGENT_ID, &local_headers(), &no_credential, Some(&book)).map(|_| ()).map_err(status).unwrap_err(), 400);
    assert!(!root.0.join("ask-pi/connections").exists() || std::fs::read_dir(root.0.join("ask-pi/connections")).unwrap().next().is_none());

    let (process, defaults) = prepare_agent(&config, PI_AGENT_ID, &local_headers(), &pi_query(), Some(&book)).unwrap();
    assert_eq!(process.program, root.0.join("bin").join("pi-acp"));
    assert!(process.args.is_empty());
    assert_eq!(process.cwd.as_deref(), Some(root.0.join("books").as_path()));
    // pi-acp 不把 MCP 交给 pi：不补 retainpdf mcp
    assert!(defaults.mcp_server.is_none());
    assert_eq!(defaults.cwd.as_deref(), Some(root.0.join("books").as_path()));
    let env: std::collections::HashMap<_, _> = process.env.iter().cloned().collect();
    assert_eq!(env["PI_ACP_PI_COMMAND"], root.0.join("backend/pi-agent/bin/retainpdf-pi").to_string_lossy());
    assert_eq!(env["RETAIN_PI_BIN"], root.0.join("bin/pi").to_string_lossy());
    assert_eq!(env["RETAIN_PI_PROMPTS_DIR"], root.0.join("backend/ask-agent/retainpdf_ask_agent/prompts").to_string_lossy());
    assert_eq!(env["RETAIN_PI_THINKING"], "low");
    assert_eq!(env["HOME"], root.0.join("ask-pi/home").to_string_lossy());
    assert_eq!(env["RETAIN_PI_SESSION_DIR"], root.0.join("ask-pi/sessions").to_string_lossy());
    assert_eq!(env["PI_OFFLINE"], "1");
    assert_eq!(env["PI_TELEMETRY"], "0");
    assert_eq!(env[ASK_ENV_MODEL], "claude-haiku-5-5");
    assert_eq!(env[ASK_ENV_API_KEY], "synthetic-secret-value");
    assert_eq!(env[ASK_ENV_JOB_ID], "job-1");
    assert_eq!(env[ASK_ENV_DOCUMENT_ID], "doc-1");
    assert_eq!(env[ASK_ENV_BACKEND_KEY], "agent-a");

    // 私有配置目录：models.json 只有 retainpdf 一家、密钥只写变量名；settings.json 关掉保温、统计、项目信任；没有 auth.json
    let agent_dir = process.scratch_dir.clone().unwrap();
    assert_eq!(env["PI_CODING_AGENT_DIR"], agent_dir.to_string_lossy());
    assert!(agent_dir.starts_with(root.0.join("ask-pi/connections")));
    let models: serde_json::Value = serde_json::from_slice(&std::fs::read(agent_dir.join("models.json")).unwrap()).unwrap();
    let provider = &models["providers"]["retainpdf"];
    assert_eq!(models["providers"].as_object().unwrap().len(), 1);
    assert_eq!(provider["baseUrl"], "https://api.anthropic.com");
    assert_eq!(provider["api"], "anthropic-messages");
    assert_eq!(provider["apiKey"], "$RETAIN_ASK_API_KEY");
    assert_eq!(provider["models"][0]["id"], "claude-haiku-5-5");
    assert_eq!(provider["models"][0]["compat"]["forceAdaptiveThinking"], true);
    let settings: serde_json::Value = serde_json::from_slice(&std::fs::read(agent_dir.join("settings.json")).unwrap()).unwrap();
    assert_eq!(
        settings["defaultTools"],
        serde_json::json!(["read_pages", "search_book", "view_page", "openui_spec", "openui_check"])
    );
    assert_eq!(settings["cacheWarming"], "off");
    assert_eq!(settings["defaultProjectTrust"], "never");
    assert_eq!(settings["enableInstallTelemetry"], false);
    assert!(!agent_dir.join("auth.json").exists());
    for entry in std::fs::read_dir(&agent_dir).unwrap() {
        let text = std::fs::read_to_string(entry.unwrap().path()).unwrap();
        assert!(!text.contains("synthetic-secret-value"), "{text}");
    }

    // 没给书：不给读书的东西
    let (process, _) = prepare_agent(&config, PI_AGENT_ID, &local_headers(), &pi_query(), None).unwrap();
    assert!(process.env.iter().all(|(name, _)| name != ASK_ENV_JOB_ID && name != ASK_ENV_BACKEND_KEY));
}

#[cfg(unix)]
#[test]
fn stale_pi_connection_dirs_are_swept() {
    let root = temp_root("pi-sweep");
    write_vault(&root.0);
    fake_pi_agent(&root.0);
    fake_command(&root.0, "pi-acp");
    fake_command(&root.0, "pi");
    let old = root.0.join("ask-pi/connections/1-old");
    std::fs::create_dir_all(&old).unwrap();
    let three_days_ago = std::time::SystemTime::now() - std::time::Duration::from_secs(3 * 24 * 3600);
    std::fs::File::open(&old).unwrap().set_modified(three_days_ago).unwrap();
    let fresh = root.0.join("ask-pi/connections/2-fresh");
    std::fs::create_dir_all(&fresh).unwrap();
    prepare_agent(&config(&root.0), PI_AGENT_ID, &local_headers(), &pi_query(), None).unwrap();
    assert!(!old.exists() && fresh.exists());
}

#[test]
fn settings_map_onto_pi() {
    use super::pi::{pi_base_url, pi_thinking};
    assert_eq!(pi_thinking("anthropic", ""), "low");
    assert_eq!(pi_thinking("anthropic", "auto"), "low");
    assert_eq!(pi_thinking("openai", ""), "off");
    assert_eq!(pi_thinking("openai", "off"), "off");
    assert_eq!(pi_thinking("openai", "Medium"), "medium");
    // max 照传，模型在 pi 里没有这一档时 pi 自己就近换（GPT 换成 high）；Claude 的 off 和 model_wire 一样是 low
    assert_eq!(pi_thinking("openai_responses", "max"), "max");
    assert_eq!(pi_thinking("anthropic", "off"), "low");
    assert_eq!(pi_base_url("anthropic", ""), "https://api.anthropic.com");
    assert_eq!(pi_base_url("anthropic", "https://api.anthropic.com/v1/"), "https://api.anthropic.com");
    assert_eq!(pi_base_url("anthropic", "https://x.example.com/anthropic/v1/messages"), "https://x.example.com/anthropic");
    assert_eq!(pi_base_url("openai", ""), "https://api.deepseek.com/v1");
    assert_eq!(pi_base_url("openai", "https://dashscope.aliyuncs.com/compatible-mode/v1/"), "https://dashscope.aliyuncs.com/compatible-mode/v1");

    let settings = |protocol: &str, base_url: &str| ModelSettings {
        model: "m".into(),
        base_url: base_url.into(),
        protocol: protocol.into(),
        thinking: String::new(),
        secret: "s".into(),
    };
    let qwen = super::pi::models_json(&settings("openai", "https://dashscope.aliyuncs.com/compatible-mode/v1"));
    assert_eq!(qwen["providers"]["retainpdf"]["api"], "openai-completions");
    // DashScope 不认 developer 角色（2026-11-26 实测 400）；思考开关是 enable_thinking（pi 的 qwen 写法），只有 off / high 两档
    assert_eq!(qwen["providers"]["retainpdf"]["models"][0]["compat"]["supportsDeveloperRole"], false);
    assert_eq!(qwen["providers"]["retainpdf"]["models"][0]["compat"]["thinkingFormat"], "qwen");
    assert_eq!(qwen["providers"]["retainpdf"]["models"][0]["thinkingLevelMap"], serde_json::json!({"minimal": null, "low": null, "medium": null}));
    let deepseek = super::pi::models_json(&settings("openai", ""));
    assert_eq!(deepseek["providers"]["retainpdf"]["models"][0]["thinkingLevelMap"], serde_json::json!({"minimal": null, "low": null, "medium": null}));
    let claude = |model: &str| {
        let settings = ModelSettings { model: model.into(), ..settings("anthropic", "") };
        super::pi::models_json(&settings)["providers"]["retainpdf"]["models"][0]["thinkingLevelMap"].clone()
    };
    // 新 Claude：low / medium / high / xhigh / max（不发也思考，没有 off）；Sonnet 4.6：off / low / medium / high / max
    assert_eq!(claude("claude-haiku-5-5"), serde_json::json!({"minimal": null, "off": null, "xhigh": "xhigh", "max": "max"}));
    assert_eq!(claude("claude-sonnet-4-6"), serde_json::json!({"minimal": null, "max": "max"}));
    let openai = super::pi::models_json(&settings("openai_responses", "https://api.openai.com/v1"));
    assert_eq!(openai["providers"]["retainpdf"]["api"], "openai-responses");
    assert_eq!(openai["providers"]["retainpdf"]["models"][0]["compat"], serde_json::json!({}));
    assert!(openai["providers"]["retainpdf"]["models"][0].get("thinkingLevelMap").is_none());
    assert!(!qwen.to_string().contains("\"s\""));
}

// ---------- 互动块（OpenUI，2026-11-26） ----------

/// 假的 contracts/openui（说明文件只要 version 和 intro）、检查器包、自带的 Node。
#[cfg(unix)]
fn fake_openui(root: &Path, config: &mut AcpConfig) {
    use std::os::unix::fs::PermissionsExt;
    let contracts = root.join("contracts/openui");
    std::fs::create_dir_all(&contracts).unwrap();
    std::fs::write(contracts.join("ask-openui-prompt.v1.json"), r#"{"version": 1, "intro": "  ## 互动块\n先 openui_spec  ", "sections": []}"#).unwrap();
    std::fs::write(contracts.join("ask-openui-library.v1.json"), "{}").unwrap();
    let check = root.join("backend/openui-check");
    std::fs::create_dir_all(check.join("bin")).unwrap();
    std::fs::write(check.join("bin/openui-check.mjs"), "").unwrap();
    let node_dir = root.join("node/bin");
    std::fs::create_dir_all(&node_dir).unwrap();
    std::fs::write(node_dir.join("node"), "#!/bin/sh\n").unwrap();
    std::fs::set_permissions(node_dir.join("node"), std::fs::Permissions::from_mode(0o755)).unwrap();
    config.openui_dir = default_openui_dir(None, root);
    config.openui_check_dir = default_openui_check_dir(None, root);
    config.node_dir = Some(root.join("node"));
}

#[test]
fn openui_dirs_come_from_the_environment_or_the_project_root() {
    let root = temp_root("openui-dirs");
    assert_eq!(default_openui_dir(None, &root.0), None, "missing directories are None");
    std::fs::create_dir_all(root.0.join("contracts/openui")).unwrap();
    std::fs::create_dir_all(root.0.join("backend/openui-check")).unwrap();
    assert_eq!(default_openui_dir(None, &root.0), Some(root.0.join("contracts/openui")));
    assert_eq!(default_openui_check_dir(None, &root.0), Some(root.0.join("backend/openui-check")));
    let elsewhere = root.0.join("books");
    assert_eq!(default_openui_dir(Some(elsewhere.as_os_str()), Path::new("/nonexistent")), Some(elsewhere.clone()));
    assert_eq!(default_openui_check_dir(Some(std::ffi::OsStr::new("")), &root.0), Some(root.0.join("backend/openui-check")));
}

#[cfg(unix)]
#[test]
fn all_three_kinds_of_agent_get_the_openui_files() {
    let root = temp_root("openui");
    write_vault(&root.0);
    fake_pi_agent(&root.0);
    fake_command(&root.0, "pi-acp");
    fake_command(&root.0, "pi");
    fake_command(&root.0, "retainpdf");
    fake_command(&root.0, "gemini");
    let mut config = config(&root.0);
    fake_openui(&root.0, &mut config);
    let expected = [
        ("RETAIN_OPENUI_PROMPT", root.0.join("contracts/openui/ask-openui-prompt.v1.json")),
        ("RETAIN_OPENUI_LIBRARY", root.0.join("contracts/openui/ask-openui-library.v1.json")),
        ("RETAIN_OPENUI_CHECK", root.0.join("backend/openui-check/bin/openui-check.mjs")),
        ("RETAIN_OPENUI_NODE", root.0.join("node/bin/node")),
    ];

    // 自带 retainpdf：进程环境
    let (process, _) = prepare_agent(&config, BUILTIN_AGENT_ID, &local_headers(), &pi_query(), None).unwrap();
    let env: std::collections::HashMap<_, _> = process.env.into_iter().collect();
    for (name, path) in &expected {
        assert_eq!(env[*name], path.to_string_lossy(), "{name}");
    }

    // retainpdf-pi：进程环境，外加 L0 写进私有配置目录（去掉首尾空白）
    let (process, _) = prepare_agent(&config, PI_AGENT_ID, &local_headers(), &pi_query(), None).unwrap();
    let env: std::collections::HashMap<_, _> = process.env.iter().cloned().collect();
    let agent_dir = process.scratch_dir.clone().unwrap();
    assert_eq!(env["RETAIN_PI_OPENUI_INTRO"], agent_dir.join("openui-intro.md").to_string_lossy());
    assert_eq!(std::fs::read_to_string(agent_dir.join("openui-intro.md")).unwrap(), "## 互动块\n先 openui_spec");
    assert_eq!(env["RETAIN_OPENUI_CHECK"], expected[2].1.to_string_lossy());

    // 本机 agent：补进 session/new 的 retainpdf mcp 的 env
    let (_, defaults) = prepare_agent(&config, "gemini", &local_headers(), &AcpConnectQuery::default(), None).unwrap();
    let server = defaults.mcp_server.unwrap();
    let mcp_env: Vec<(String, String)> = server["env"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| (item["name"].as_str().unwrap().to_string(), item["value"].as_str().unwrap().to_string()))
        .collect();
    assert_eq!(mcp_env[0], ("RETAINPDF_AGENT_KEY".to_string(), "agent-a".to_string()));
    for (name, path) in &expected {
        assert!(mcp_env.contains(&(name.to_string(), path.to_string_lossy().into_owned())), "{name}");
    }

    // 没有自带的 Node：用 PATH 上的；PATH 上也没有就不给 RETAIN_OPENUI_NODE（agent 自己再找）
    let mut no_node = config.clone();
    no_node.node_dir = None;
    let (process, _) = prepare_agent(&no_node, BUILTIN_AGENT_ID, &local_headers(), &pi_query(), None).unwrap();
    assert!(process.env.iter().all(|(name, _)| name != "RETAIN_OPENUI_NODE"));
    fake_command(&root.0, "node");
    let (process, _) = prepare_agent(&no_node, BUILTIN_AGENT_ID, &local_headers(), &pi_query(), None).unwrap();
    assert!(process.env.contains(&("RETAIN_OPENUI_NODE".to_string(), root.0.join("bin/node").to_string_lossy().into_owned())));

    // 说明文件读不到（或不是 v1）：什么都不给，pi 也不写 L0
    std::fs::write(root.0.join("contracts/openui/ask-openui-prompt.v1.json"), r#"{"version": 2, "intro": "x"}"#).unwrap();
    let (process, _) = prepare_agent(&config, PI_AGENT_ID, &local_headers(), &pi_query(), None).unwrap();
    assert!(process.env.iter().all(|(name, _)| !name.starts_with("RETAIN_OPENUI_") && name != "RETAIN_PI_OPENUI_INTRO"));
    assert!(!process.scratch_dir.unwrap().join("openui-intro.md").exists());
    let mut none = config.clone();
    none.openui_dir = None;
    let (_, defaults) = prepare_agent(&none, "gemini", &local_headers(), &AcpConnectQuery::default(), None).unwrap();
    assert_eq!(defaults.mcp_server.unwrap()["env"].as_array().unwrap().len(), 1);
}

/// openui-check 的 node：`RUST_API_NODE_DIR` → `RETAINPDF_NODE_BIN`（桌面版的 Electron 本体）→ PATH（2026-11-26）。
#[test]
#[cfg(unix)]
fn openui_node_falls_back_to_the_desktop_electron_binary() {
    use std::os::unix::fs::PermissionsExt;
    let root = temp_root("openui-node-order");
    let mut config = config(&root.0);
    let electron = root.0.join("Electron");
    std::fs::write(&electron, "#!/bin/sh\n").unwrap();
    std::fs::set_permissions(&electron, std::fs::Permissions::from_mode(0o755)).unwrap();
    // PATH 上也有一个 node：Electron 优先
    let path_dir = root.0.join("path-bin");
    std::fs::create_dir_all(&path_dir).unwrap();
    std::fs::write(path_dir.join("node"), "#!/bin/sh\n").unwrap();
    std::fs::set_permissions(path_dir.join("node"), std::fs::Permissions::from_mode(0o755)).unwrap();
    config.path_var = Some(path_dir.clone().into_os_string());
    config.node_bin = Some(electron.clone());
    assert_eq!(super::openui::find_node(&config), Some(electron.clone()));
    // 自带的 Node 目录优先于 Electron
    let node_dir = root.0.join("node/bin");
    std::fs::create_dir_all(&node_dir).unwrap();
    std::fs::write(node_dir.join("node"), "#!/bin/sh\n").unwrap();
    config.node_dir = Some(root.0.join("node"));
    assert_eq!(super::openui::find_node(&config), Some(node_dir.join("node")));
    // 都没有、或 Electron 路径不存在：退回 PATH
    config.node_dir = None;
    config.node_bin = Some(root.0.join("missing"));
    assert_eq!(super::openui::find_node(&config), Some(path_dir.join("node")));
}
