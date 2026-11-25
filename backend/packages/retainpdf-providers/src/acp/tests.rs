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
    };
    let (process, _) = prepare_agent(&server, "retainpdf", &HeaderMap::new(), &query, None).unwrap();
    assert_eq!(process.program, PathBuf::from("/usr/bin/python3"));
    assert_eq!(process.args, vec!["-m", "retainpdf_ask_agent"]);
    let env: std::collections::HashMap<_, _> = process.env.into_iter().collect();
    assert_eq!(env[ASK_ENV_MODEL], "claude-haiku-5-5");
    assert_eq!(env[ASK_ENV_API_PROTOCOL], "anthropic");
    assert_eq!(env[ASK_ENV_THINKING], "low");
    assert_eq!(env[ASK_ENV_API_KEY], "synthetic-secret-value");
    // 没给书：不给读书的东西（和以前一样只靠 prompt 里的上下文）
    assert!(!env.contains_key(ASK_ENV_JOB_ID) && !env.contains_key(ASK_ENV_BACKEND_KEY));

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
