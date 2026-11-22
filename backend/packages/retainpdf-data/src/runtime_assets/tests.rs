use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use super::manifest::{AssetSpec, FileSpec, PackageSpec, Registry, MANIFEST};
use super::{ensure_specs, status_of, store, wait_for_specs};

fn temp_root(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!("runtime-assets-{name}-{}-{:016x}", std::process::id(), fastrand::u64(..)));
    std::fs::create_dir_all(&root).unwrap();
    root
}

fn sha256(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|byte| format!("{byte:02x}")).collect()
}

/// npm 打出来的那种 tarball：gzip 的 ustar，文件在 package/ 下。
fn npm_tarball(files: &[(&str, &[u8])]) -> Vec<u8> {
    let mut tar = Vec::new();
    for (name, body) in files {
        let mut header = [0u8; 512];
        let path = format!("package/{name}");
        header[..path.len()].copy_from_slice(path.as_bytes());
        header[100..108].copy_from_slice(b"0000644\0");
        header[124..136].copy_from_slice(format!("{:011o}\0", body.len()).as_bytes());
        header[156] = b'0';
        header[257..263].copy_from_slice(b"ustar\0");
        header[148..156].copy_from_slice(b"        ");
        let checksum: u32 = header.iter().map(|byte| *byte as u32).sum();
        header[148..156].copy_from_slice(format!("{checksum:06o}\0 ").as_bytes());
        tar.extend_from_slice(&header);
        tar.extend_from_slice(body);
        tar.resize(tar.len().div_ceil(512) * 512, 0);
    }
    tar.extend_from_slice(&[0u8; 1024]);
    let mut gz = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::fast());
    gz.write_all(&tar).unwrap();
    gz.finish().unwrap()
}

fn spec(id: &'static str, files: &[(&str, &[u8])], executable: Option<&str>) -> AssetSpec {
    AssetSpec {
        id,
        title: id.into(),
        version: "1.0".into(),
        dir_name: "1.0".into(),
        package: PackageSpec {
            title: String::new(),
            version: String::new(),
            package: format!("@retainpdf/test-{id}"),
            package_version: "1.0.0".into(),
            files: files
                .iter()
                .map(|(name, body)| FileSpec {
                    path: name.to_string(),
                    sha256: sha256(body),
                    size: body.len() as u64,
                    executable: Some(*name) == executable,
                })
                .collect(),
        },
        bin: executable.map(str::to_string),
    }
}

/// 只认一个 tarball 路径的 HTTP 服务；返回地址和请求计数。
async fn serve(path: String, body: Vec<u8>) -> (String, Arc<AtomicUsize>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = format!("http://{}", listener.local_addr().unwrap());
    let hits = Arc::new(AtomicUsize::new(0));
    let counter = hits.clone();
    tokio::spawn(async move {
        loop {
            let Ok((mut socket, _)) = listener.accept().await else { return };
            let (path, body, counter) = (path.clone(), body.clone(), counter.clone());
            tokio::spawn(async move {
                let mut request = vec![0u8; 4096];
                let read = socket.read(&mut request).await.unwrap_or(0);
                let line = String::from_utf8_lossy(&request[..read]).lines().next().unwrap_or_default().to_string();
                counter.fetch_add(1, Ordering::SeqCst);
                let response = if line.contains(&format!(" {path} ")) {
                    let mut head = format!("HTTP/1.1 200 OK\r\ncontent-length: {}\r\nconnection: close\r\n\r\n", body.len()).into_bytes();
                    head.extend_from_slice(&body);
                    head
                } else {
                    b"HTTP/1.1 404 Not Found\r\ncontent-length: 0\r\nconnection: close\r\n\r\n".to_vec()
                };
                let _ = socket.write_all(&response).await;
            });
        }
    });
    (address, hits)
}

fn registry(url: &str) -> Registry {
    Registry { name: url.to_string(), url: url.to_string(), preferred_time_zones: Vec::new() }
}

fn states(data_root: &Path, specs: &[AssetSpec]) -> Vec<String> {
    status_of(data_root, None, specs).into_iter().map(|view| view.state).collect()
}

#[test]
fn the_real_manifest_parses_and_lists_fonts_and_this_platforms_typst() {
    let assets = super::manifest::assets_for_platform(&MANIFEST, "darwin-arm64");
    assert_eq!(assets.iter().map(|asset| asset.id).collect::<Vec<_>>(), ["fonts", "typst"]);
    assert_eq!(assets[1].bin.as_deref(), Some("typst"));
    assert_eq!(assets[1].dir_name, "0.15.1-darwin-arm64");
    let windows = super::manifest::assets_for_platform(&MANIFEST, "win32-x64");
    assert_eq!(windows[1].bin.as_deref(), Some("typst.exe"));
    assert_eq!(super::manifest::assets_for_platform(&MANIFEST, "unknown").len(), 1, "没有 Typst 包的平台只下字体");
    assert_eq!(
        super::download::tarball_url("https://registry.npmmirror.com/", "@retainpdf/font-source-han-serif-sc", "2.3.0"),
        "https://registry.npmmirror.com/@retainpdf/font-source-han-serif-sc/-/font-source-han-serif-sc-2.3.0.tgz"
    );
}

#[tokio::test]
async fn a_download_is_verified_installed_recorded_and_not_repeated() {
    let data_root = temp_root("install");
    let files: &[(&str, &[u8])] = &[("tool", b"#!/bin/sh\necho hi\n"), ("LICENSE", b"license text")];
    // 不叫 typst：开发机 PATH 上有 typst 会被当成包里带着
    let asset = spec("tool", files, Some("tool"));
    let tarball = npm_tarball(&[("tool", b"#!/bin/sh\necho hi\n"), ("LICENSE", b"license text"), ("package.json", b"{}")]);
    let (address, hits) = serve("/@retainpdf/test-tool/-/test-tool-1.0.0.tgz".into(), tarball).await;
    // 第一个源不通，换第二个
    let registries = [registry("http://127.0.0.1:9"), registry(&address)];
    let specs = [asset];
    assert_eq!(states(&data_root, &specs), ["missing"]);

    assert!(ensure_specs(&data_root, None, &specs, &registries).await.unwrap());
    assert_eq!(states(&data_root, &specs), ["ready"]);
    let dir = data_root.join("runtime-assets/tool/1.0");
    assert_eq!(std::fs::read(dir.join("LICENSE")).unwrap(), b"license text");
    assert!(!dir.join("package.json").exists(), "清单没列的文件不解出来");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(std::fs::metadata(dir.join("tool")).unwrap().permissions().mode() & 0o111, 0o111);
    }
    let current: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(data_root.join("runtime-assets/current.json")).unwrap()).unwrap();
    assert_eq!(current["assets"]["tool"], serde_json::json!({"version": "1.0", "dir": "tool/1.0", "bin": "tool"}));
    assert!(!data_root.join("runtime-assets/.download.lock").exists(), "下完放锁");

    let before = hits.load(Ordering::SeqCst);
    assert!(ensure_specs(&data_root, None, &specs, &registries).await.unwrap());
    assert_eq!(hits.load(Ordering::SeqCst), before, "有缓存就不再下");
    std::fs::remove_dir_all(data_root).ok();
}

#[tokio::test]
async fn a_file_that_does_not_match_the_manifest_is_rejected_and_reported() {
    let data_root = temp_root("mismatch");
    let asset = spec("fonts", &[("font.otf", b"the real font")], None);
    let tarball = npm_tarball(&[("font.otf", b"something else")]);
    let (address, _) = serve("/@retainpdf/test-fonts/-/test-fonts-1.0.0.tgz".into(), tarball).await;
    let specs = [asset];
    assert!(ensure_specs(&data_root, None, &specs, &[registry(&address)]).await.unwrap());
    let view = &status_of(&data_root, None, &specs)[0];
    assert_eq!(view.state, "failed");
    assert!(view.error.contains("对不上"), "{}", view.error);
    assert!(!data_root.join("runtime-assets/fonts/1.0").exists(), "对不上的不装");
    assert!(!data_root.join("runtime-assets/current.json").exists());
    std::fs::remove_dir_all(data_root).ok();
}

#[tokio::test]
async fn fonts_in_the_package_are_not_downloaded() {
    let data_root = temp_root("bundled");
    let project = data_root.join("app");
    std::fs::create_dir_all(project.join("resources/fonts")).unwrap();
    std::fs::write(project.join("resources/fonts/font.otf"), b"bundled").unwrap();
    let specs = [spec("fonts", &[("font.otf", b"bundled")], None)];
    assert_eq!(status_of(&data_root, Some(&project), &specs)[0].state, "bundled");
    // 源是坏的也不碰：根本不下
    assert!(ensure_specs(&data_root, Some(&project), &specs, &[registry("http://127.0.0.1:9")]).await.unwrap());
    assert!(!data_root.join("runtime-assets/progress.json").exists());
    std::fs::remove_dir_all(data_root).ok();
}

#[tokio::test]
async fn another_process_holding_the_lock_is_waited_for_then_given_up_on() {
    let data_root = temp_root("lock");
    let specs = [spec("fonts", &[("font.otf", b"x")], None)];
    let _held = store::try_lock(&data_root).unwrap().expect("lock");
    super::download::report(&data_root, "fonts", "downloading", 1, 2, "npmjs", "");
    assert!(!ensure_specs(&data_root, None, &specs, &[registry("http://127.0.0.1:9")]).await.unwrap(), "别人在下就不重复下");
    assert_eq!(states(&data_root, &specs), ["downloading"]);
    let started = std::time::Instant::now();
    wait_for_specs(&data_root, None, &specs, &[], Duration::from_millis(1500)).await;
    assert!(started.elapsed() >= Duration::from_millis(1400), "等到超时才走");
    std::fs::remove_dir_all(data_root).ok();
}

#[test]
fn a_new_manifest_version_is_not_mistaken_for_the_old_download() {
    let data_root = temp_root("version");
    let old = spec("fonts", &[("font.otf", b"x")], None);
    std::fs::create_dir_all(data_root.join("runtime-assets/fonts/1.0")).unwrap();
    std::fs::write(data_root.join("runtime-assets/fonts/1.0/font.otf"), b"x").unwrap();
    store::record_current(&data_root, "fonts", store::CurrentEntry { version: "1.0".into(), dir: "fonts/1.0".into(), bin: None }).unwrap();
    assert_eq!(states(&data_root, std::slice::from_ref(&old)), ["ready"]);
    let mut newer = old.clone();
    newer.version = "2.0".into();
    newer.dir_name = "2.0".into();
    assert_eq!(states(&data_root, &[newer]), ["missing"]);
    std::fs::remove_dir_all(data_root).ok();
}
