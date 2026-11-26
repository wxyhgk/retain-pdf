//! 代装本机 agent（2026-11-26）：npm 用假的 npm 脚本（不联网），压缩包用本机造的 zip / tar.gz，起一个本机 HTTP 服务给它下。
//! 不运行装好的程序（真的 Antigravity 也不下、不跑）。
use super::*;
use axum::http::HeaderValue;
use axum::response::IntoResponse;
use std::io::Write;

const PLATFORM: &str = "test-os-arch";

struct Root(PathBuf);

impl Drop for Root {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn temp_root(name: &str) -> Root {
    let root = std::env::temp_dir().join(format!("retainpdf-acp-install-{name}-{}-{}", std::process::id(), fastrand::u64(..)));
    std::fs::create_dir_all(root.join("books")).unwrap();
    std::fs::create_dir_all(root.join("bin")).unwrap();
    Root(root)
}

fn config(root: &Path) -> AcpConfig {
    AcpConfig {
        multi_user: false,
        listens_on_loopback: true,
        data_root: root.to_path_buf(),
        python_bin: "/usr/bin/python3".into(),
        agent_keys: HashSet::new(),
        api_keys: HashSet::from(["main-key".to_string()]),
        backend_url: "http://127.0.0.1:41000".into(),
        local_agents_flag: None,
        path_var: Some(root.join("bin").into_os_string()),
        current_exe: None,
        backend_root: None,
        agents_dir: root.join(AGENTS_DIR_NAME),
        node_dir: None,
    }
}

fn local_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert("host", HeaderValue::from_static("127.0.0.1:41000"));
    headers
}

fn http_status(error: AppError) -> u16 {
    error.into_response().status().as_u16()
}

fn sha256_hex(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    Sha256::digest(bytes).iter().map(|byte| format!("{byte:02x}")).collect()
}

fn zip_bytes(entries: &[(&str, &[u8])]) -> Vec<u8> {
    let mut writer = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    let options = zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Stored).unix_permissions(0o644);
    for (name, data) in entries {
        writer.start_file(*name, options).unwrap();
        writer.write_all(data).unwrap();
    }
    writer.finish().unwrap().into_inner()
}

fn tar_gz_bytes(entries: &[(&str, &[u8])]) -> Vec<u8> {
    let mut builder = tar::Builder::new(flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default()));
    for (name, data) in entries {
        let mut header = tar::Header::new_gnu();
        header.set_size(data.len() as u64);
        header.set_mode(0o755);
        header.set_cksum();
        builder.append_data(&mut header, name, *data).unwrap();
    }
    builder.into_inner().unwrap().finish().unwrap()
}

/// 本机 HTTP 服务：每个请求都回 `body`，返回地址前缀（`http://127.0.0.1:<端口>`）。
async fn serve(body: Vec<u8>) -> String {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move {
        while let Ok((mut socket, _)) = listener.accept().await {
            let body = body.clone();
            tokio::spawn(async move {
                let mut request = Vec::new();
                let mut buffer = [0u8; 1024];
                while !request.windows(4).any(|window| window == b"\r\n\r\n") {
                    match socket.read(&mut buffer).await {
                        Ok(0) | Err(_) => return,
                        Ok(read) => request.extend_from_slice(&buffer[..read]),
                    }
                }
                let head = format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len());
                let _ = socket.write_all(head.as_bytes()).await;
                let _ = socket.write_all(&body).await;
            });
        }
    });
    format!("http://{address}")
}

fn binary_registry(id: &str, archive: &str, cmd: &str, sha256: &str) -> String {
    serde_json::json!({"agents": [{
        "id": id, "name": "Fake Antigravity", "version": "1.5.2",
        "distribution": {"binary": {PLATFORM: {"archive": archive, "cmd": cmd, "args": ["--uid="], "sha256": sha256}}}
    }]})
    .to_string()
}

fn binary_catalog(id: &str, archive: &str, cmd: &str, sha256: &str) -> registry::Catalog {
    let overrides = serde_json::json!({"default_install": [id]}).to_string();
    registry::build_catalog(&binary_registry(id, archive, cmd, sha256), &overrides).unwrap()
}

fn view_of(catalog: &registry::Catalog, config: &AcpConfig, id: &str) -> AgentView {
    registry::list_agents_on(catalog, PLATFORM, "", &config.lookup()).into_iter().find(|agent| agent.id == id).unwrap()
}

fn staging_is_empty(config: &AcpConfig) -> bool {
    std::fs::read_dir(config.agents_dir.join(".staging")).map(|mut entries| entries.next().is_none()).unwrap_or(true)
}

#[tokio::test]
async fn binary_agents_are_downloaded_checked_and_moved_into_place() {
    for (id, archive, format) in [
        ("fake-agy-zip", zip_bytes(&[("agy_acp_server.par", b"#!/bin/sh\nexit 0\n"), ("README", b"hi")]), "zip"),
        ("fake-agy-tgz", tar_gz_bytes(&[("bin/agy_acp_server.par", b"#!/bin/sh\nexit 0\n")]), "tar.gz"),
    ] {
        let root = temp_root(id);
        let config = config(&root.0);
        let cmd = if format == "zip" { "./agy_acp_server.par" } else { "./bin/agy_acp_server.par" };
        let url = format!("{}/agy-acp-server-1.5.2.{format}", serve(archive.clone()).await);

        // sha256 对不上：失败，什么都不留下
        let catalog = binary_catalog(id, &url, cmd, &"0".repeat(64));
        let before = view_of(&catalog, &config, id);
        let status_before = before.install_status.clone().unwrap();
        assert_eq!((status_before.state, status_before.installable, status_before.method), (InstallState::Missing, true, Some(InstallMethod::Binary)));
        assert!(before.reason.contains("RetainPDF 可以替你下载安装"), "{before:?}");
        install::install_defaults(&catalog, PLATFORM, &config.agents_dir, &config.lookup()).await;
        let failed = view_of(&catalog, &config, id).install_status.unwrap();
        assert_eq!(failed.state, InstallState::Failed);
        assert!(failed.error.contains("sha256"), "{failed:?}");
        assert!(!config.agents_dir.join("binary").join(id).exists());
        assert!(staging_is_empty(&config));

        // 对上了：解到 binary/<id>/<版本>/，命令能执行，参数照快照
        let catalog = binary_catalog(id, &url, cmd, &sha256_hex(&archive));
        install::install_defaults(&catalog, PLATFORM, &config.agents_dir, &config.lookup()).await;
        let view = view_of(&catalog, &config, id);
        assert!(view.available, "{view:?}");
        assert_eq!(view.launch.as_deref(), Some("agy_acp_server.par --uid="));
        let status = view.install_status.unwrap();
        assert_eq!(
            (status.state, status.managed, status.method, status.installed_version.as_deref()),
            (InstallState::Installed, true, Some(InstallMethod::Binary), Some("1.5.2"))
        );
        let platform_lookup = config.lookup();
        let agent = registry::find_agent(&catalog, id, PLATFORM).unwrap();
        let launch = registry::resolve_agent(agent, PLATFORM, &platform_lookup).unwrap();
        assert_eq!(launch.program, config.agents_dir.join("binary").join(id).join("1.5.2").join(cmd.trim_start_matches("./")));
        assert!(registry::is_executable(&launch.program));
        assert!(staging_is_empty(&config));
    }
}

#[tokio::test]
async fn unsafe_archives_and_missing_hashes_are_refused() {
    let root = temp_root("unsafe");
    let config = config(&root.0);
    let archive = zip_bytes(&[("../escape.par", b"x"), ("agy_acp_server.par", b"x")]);
    let url = format!("{}/a.zip", serve(archive.clone()).await);
    let catalog = binary_catalog("fake-agy-unsafe", &url, "./agy_acp_server.par", &sha256_hex(&archive));
    install::install_defaults(&catalog, PLATFORM, &config.agents_dir, &config.lookup()).await;
    let status = view_of(&catalog, &config, "fake-agy-unsafe").install_status.unwrap();
    assert!(status.state == InstallState::Failed && status.error.contains("不安全"), "{status:?}");
    assert!(!root.0.join("escape.par").exists() && !config.agents_dir.join("escape.par").exists());

    // 快照里没给 sha256、格式不认识的：不代装，说原因
    let registry = serde_json::json!({"agents": [
        {"id": "no-sha", "name": "No sha", "version": "1", "distribution": {"binary": {PLATFORM: {"archive": "https://example.com/a.zip", "cmd": "./a"}}}},
        {"id": "bz2", "name": "Bz2", "version": "1", "distribution": {"binary": {PLATFORM: {"archive": "https://example.com/a.tar.bz2", "cmd": "./a", "sha256": "0".repeat(64)}}}},
        {"id": "uv-only", "name": "uv", "version": "1", "distribution": {"uvx": {"package": "uv-only==1"}}}
    ]})
    .to_string();
    let catalog = registry::build_catalog(&registry, "{}").unwrap();
    let no_sha = view_of(&catalog, &config, "no-sha").install_status.unwrap();
    assert!(!no_sha.installable && no_sha.reason.contains("sha256"), "{no_sha:?}");
    assert!(view_of(&catalog, &config, "bz2").install_status.unwrap().reason.contains(".zip"));
    assert!(view_of(&catalog, &config, "uv-only").install_status.unwrap().reason.contains("uv"));
    let error = install_agent_on(&catalog, PLATFORM, &config, "uv-only", &local_headers()).unwrap_err();
    assert_eq!(http_status(error), 409);
}

/// 假 npm：把参数记下来，按 `--prefix` 在 node_modules/.bin 里建好每个包同名的命令（`a@1` → `a`，`@s/b@2` → `b`）。
#[cfg(unix)]
fn fake_node_dir(root: &Path, fail: bool) -> PathBuf {
    use std::os::unix::fs::PermissionsExt;
    let dir = root.join("node").join("bin");
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("node"), "#!/bin/sh\nexit 0\n").unwrap();
    let log = root.join("npm-args.txt");
    let script = if fail {
        "#!/bin/sh\necho 'npm ERR! 404 Not Found - GET https://registry.npmjs.org/nope' >&2\nexit 1\n".to_string()
    } else {
        format!(
            r#"#!/bin/sh
echo "PATH=$PATH" > "{log}"
echo "$@" >> "{log}"
prefix=""
next=0
for arg in "$@"; do
  if [ "$next" = 1 ]; then prefix="$arg"; next=0; continue; fi
  [ "$arg" = "--prefix" ] && next=1
done
/bin/mkdir -p "$prefix/node_modules/.bin"
for arg in "$@"; do
  case "$arg" in
    install|--*) ;;
    "$prefix") ;;
    *) name="${{arg%@*}}"; name="${{name##*/}}"; printf '#!/bin/sh\nexit 0\n' > "$prefix/node_modules/.bin/$name"; /bin/chmod 755 "$prefix/node_modules/.bin/$name" ;;
  esac
done
"#,
            log = log.display()
        )
    };
    std::fs::write(dir.join("npm"), script).unwrap();
    std::fs::set_permissions(dir.join("npm"), std::fs::Permissions::from_mode(0o755)).unwrap();
    root.join("node")
}

#[cfg(unix)]
fn npm_catalog(id: &str) -> registry::Catalog {
    let registry = serde_json::json!({"agents": [{
        "id": id, "name": "Fake pi", "version": "0.0.35",
        "distribution": {"npx": {"package": format!("{id}@0.0.35"), "env": {"FAKE_ENV": "1"}}}
    }]})
    .to_string();
    let overrides = serde_json::json!({
        "bins": {id: id},
        "requires": {id: {"bin": "fakepi", "package": "@fake/fakepi", "version": "1.6.1"}},
        "default_install": [id]
    })
    .to_string();
    registry::build_catalog(&registry, &overrides).unwrap()
}

#[cfg(unix)]
#[tokio::test]
async fn npm_agents_go_into_a_private_prefix_with_their_requirement() {
    let id = "fake-pi-acp";
    let root = temp_root("npm");
    let mut config = config(&root.0);
    let catalog = npm_catalog(id);

    // 没有 npm：不能代装，说怎么办
    let status = view_of(&catalog, &config, id).install_status.unwrap();
    assert!(!status.installable && status.reason.contains(NODE_DIR_ENV), "{status:?}");

    // 上次装到一半断了：临时目录里的不算装好，下次装时清掉
    let half = config.agents_dir.join(".staging").join(format!("{id}.00000000deadbeef")).join("prefix/node_modules/.bin");
    std::fs::create_dir_all(&half).unwrap();
    std::fs::write(half.join(id), "half").unwrap();
    assert_eq!(view_of(&catalog, &config, id).install_status.unwrap().state, InstallState::Missing);

    config.node_dir = Some(fake_node_dir(&root.0, false));
    let status = view_of(&catalog, &config, id).install_status.unwrap();
    assert_eq!((status.installable, status.method), (true, Some(InstallMethod::Npm)));
    install::install_defaults(&catalog, PLATFORM, &config.agents_dir, &config.lookup()).await;

    // npm 用的是自带 Node 目录里的，PATH 里它在最前；装的是 pi 和适配器，都带版本，装进临时 prefix
    let log = std::fs::read_to_string(root.0.join("npm-args.txt")).unwrap();
    let node_bin = root.0.join("node").join("bin");
    assert!(log.starts_with(&format!("PATH={}:", node_bin.display())), "{log}");
    assert!(log.contains("install --prefix") && log.contains(".staging"), "{log}");
    assert!(log.contains("@fake/fakepi@1.6.1 fake-pi-acp@0.0.35"), "{log}");
    assert!(staging_is_empty(&config), "staging left behind");

    let view = view_of(&catalog, &config, id);
    assert!(view.available, "{view:?}");
    let status = view.install_status.unwrap();
    assert_eq!(
        (status.state, status.managed, status.method, status.installed_version.as_deref()),
        (InstallState::Installed, true, Some(InstallMethod::Npm), Some("0.0.35"))
    );
    // 起它：程序在私有 prefix 的 .bin，PATH 前面是 Node 目录和 .bin（pi-acp 在那里找 pi），快照的环境变量照带
    let (process, _) = {
        let agent = registry::find_agent(&catalog, id, PLATFORM).unwrap();
        let launch = registry::resolve_agent(agent, PLATFORM, &config.lookup()).unwrap();
        (launch, ())
    };
    let bin_dir = config.agents_dir.join("npm").join(id).join("0.0.35").join("node_modules").join(".bin");
    assert_eq!(process.program, bin_dir.join(id));
    let env: std::collections::HashMap<_, _> = process.env.into_iter().collect();
    assert_eq!(env["FAKE_ENV"], "1");
    assert!(env["PATH"].starts_with(&format!("{}:{}:", node_bin.display(), bin_dir.display())), "{}", env["PATH"]);

    // 已经是快照的版本：再要装也不重装
    std::fs::remove_file(root.0.join("npm-args.txt")).unwrap();
    let again = install_agent_on(&catalog, PLATFORM, &config, id, &local_headers()).unwrap();
    assert_eq!(again.install_status.unwrap().state, InstallState::Installed);
    install::install_defaults(&catalog, PLATFORM, &config.agents_dir, &config.lookup()).await;
    assert!(!root.0.join("npm-args.txt").exists());
}

#[cfg(unix)]
#[tokio::test]
async fn install_endpoint_runs_in_the_background_and_reports_failures() {
    let id = "fake-pi-acp-endpoint";
    let root = temp_root("endpoint");
    let mut config = config(&root.0);
    let catalog = npm_catalog(id);
    config.node_dir = Some(fake_node_dir(&root.0, true));

    // 闸门：局域网地址、服务器部署不装；不认识的 404
    let mut lan = HeaderMap::new();
    lan.insert("host", HeaderValue::from_static("192.168.1.5:41000"));
    assert_eq!(http_status(install_agent_on(&catalog, PLATFORM, &config, id, &lan).unwrap_err()), 403);
    let mut server = config.clone();
    server.listens_on_loopback = false;
    assert_eq!(http_status(install_agent_on(&catalog, PLATFORM, &server, id, &local_headers()).unwrap_err()), 403);
    assert_eq!(http_status(install_agent_on(&catalog, PLATFORM, &config, "nope", &local_headers()).unwrap_err()), 404);
    assert_eq!(http_status(install_agent(&config, BUILTIN_AGENT_ID, &local_headers()).unwrap_err()), 400);

    let started = install_agent_on(&catalog, PLATFORM, &config, id, &local_headers()).unwrap();
    let state = started.install_status.unwrap().state;
    assert!(matches!(state, InstallState::Installing | InstallState::Failed), "{state:?}");
    let mut status_now = view_of(&catalog, &config, id).install_status.unwrap();
    for _ in 0..100 {
        if status_now.state != InstallState::Installing {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        status_now = view_of(&catalog, &config, id).install_status.unwrap();
    }
    assert_eq!(status_now.state, InstallState::Failed, "{status_now:?}");
    assert!(status_now.error.contains("404 Not Found"), "{status_now:?}");
    assert!(!config.agents_dir.join("npm").join(id).exists());
    assert!(staging_is_empty(&config));
}

#[cfg(unix)]
#[tokio::test]
async fn default_install_leaves_agents_the_user_installed_alone() {
    use std::os::unix::fs::PermissionsExt;
    let id = "fake-pi-acp-on-path";
    let root = temp_root("on-path");
    let mut config = config(&root.0);
    config.node_dir = Some(fake_node_dir(&root.0, false));
    for name in [id, "fakepi"] {
        let path = root.0.join("bin").join(name);
        std::fs::write(&path, "#!/bin/sh\nexit 0\n").unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
    }
    let catalog = npm_catalog(id);
    let status = view_of(&catalog, &config, id).install_status.unwrap();
    assert_eq!((status.state, status.managed), (InstallState::Installed, false));
    install::install_defaults(&catalog, PLATFORM, &config.agents_dir, &config.lookup()).await;
    assert!(!root.0.join("npm-args.txt").exists(), "npm should not run for an agent already on PATH");
    // 开关：桌面版设 1 才装
    assert!(install::default_install_enabled(Some("1")) && install::default_install_enabled(Some(" true ")));
    assert!(!install::default_install_enabled(None) && !install::default_install_enabled(Some("0")));
}
