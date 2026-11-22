//! 从 npm 源下一份资源：取 tarball、只解出清单列的文件、逐个核对大小和 sha256，全对了才挪进缓存目录。
//! 一个源失败（连不上、文件对不上）就换下一个源；都失败返回最后一个错误。

use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::{anyhow, bail, Context, Result};
use sha2::{Digest, Sha256};
use tokio::io::AsyncWriteExt;

use super::manifest::{AssetSpec, Registry, MANIFEST};
use super::store::{self, AssetProgress, CurrentEntry};

/// 换源测试、自建镜像用：逗号分隔的 npm 源地址，给了就只用这些。
pub(crate) const REGISTRY_OVERRIDE_ENV: &str = "RETAIN_PDF_RUNTIME_ASSETS_REGISTRY";

/// 试源的先后：设了环境变量就用它；本地时区是东八区（国内）先 npmmirror，否则先 npmjs。
pub(crate) fn registry_order() -> Vec<Registry> {
    if let Ok(raw) = std::env::var(REGISTRY_OVERRIDE_ENV) {
        let custom: Vec<Registry> = raw
            .split(',')
            .map(str::trim)
            .filter(|url| !url.is_empty())
            .map(|url| Registry { name: url.to_string(), url: url.to_string(), preferred_time_zones: Vec::new() })
            .collect();
        if !custom.is_empty() {
            return custom;
        }
    }
    let mut registries = MANIFEST.registries.clone();
    let in_china_time = chrono::Local::now().offset().local_minus_utc() == 8 * 3600;
    registries.sort_by_key(|registry| !(in_china_time && !registry.preferred_time_zones.is_empty()));
    registries
}

pub(crate) fn tarball_url(registry: &str, package: &str, version: &str) -> String {
    let bare = package.rsplit('/').next().unwrap_or(package);
    format!("{}/{package}/-/{bare}-{version}.tgz", registry.trim_end_matches('/'))
}

/// 下载、校验、装进缓存，并在 current.json 里记下来。调用方先拿好下载锁。
pub(crate) async fn install(
    data_root: &Path,
    spec: &AssetSpec,
    client: &reqwest::Client,
    registries: &[Registry],
) -> Result<PathBuf> {
    let mut last_error = anyhow!("no registry configured");
    for registry in registries {
        match install_from(data_root, spec, client, registry).await {
            Ok(dir) => return Ok(dir),
            Err(error) => {
                tracing::warn!("runtime asset {} from {} failed: {error:#}", spec.id, registry.name);
                last_error = error.context(format!("{} 下载失败", registry.name));
            }
        }
    }
    Err(last_error)
}

async fn install_from(data_root: &Path, spec: &AssetSpec, client: &reqwest::Client, registry: &Registry) -> Result<PathBuf> {
    let root = store::root(data_root);
    tokio::fs::create_dir_all(&root).await?;
    let url = tarball_url(&registry.url, &spec.package.package, &spec.package.package_version);
    let tarball = root.join(format!(".{}-{:016x}.tgz", spec.id, fastrand::u64(..)));
    let result = async {
        fetch(data_root, spec, client, &registry.name, &url, &tarball).await?;
        let staging = root.join(format!(".{}-{:016x}", spec.id, fastrand::u64(..)));
        let unpacked = {
            let (tarball, staging, spec) = (tarball.clone(), staging.clone(), spec.clone());
            tokio::task::spawn_blocking(move || unpack_and_verify(&tarball, &staging, &spec)).await?
        };
        if let Err(error) = unpacked {
            let _ = std::fs::remove_dir_all(&staging);
            return Err(error);
        }
        let target = root.join(spec.id).join(&spec.dir_name);
        if target.exists() {
            std::fs::remove_dir_all(&target)?;
        }
        std::fs::create_dir_all(target.parent().context("asset dir has no parent")?)?;
        std::fs::rename(&staging, &target)?;
        store::record_current(
            data_root,
            spec.id,
            CurrentEntry { version: spec.version.clone(), dir: format!("{}/{}", spec.id, spec.dir_name), bin: spec.bin.clone() },
        )?;
        store::remove_other_versions(data_root, spec);
        Ok(target)
    }
    .await;
    let _ = tokio::fs::remove_file(&tarball).await;
    result
}

async fn fetch(data_root: &Path, spec: &AssetSpec, client: &reqwest::Client, source: &str, url: &str, into: &Path) -> Result<()> {
    let mut response = client.get(url).send().await?.error_for_status()?;
    let total = response.content_length().unwrap_or_else(|| spec.total_bytes());
    let mut file = tokio::fs::File::create(into).await?;
    let mut done: u64 = 0;
    let mut last_report = std::time::Instant::now() - Duration::from_secs(10);
    loop {
        let chunk = tokio::time::timeout(Duration::from_secs(60), response.chunk())
            .await
            .map_err(|_| anyhow!("60 秒没收到数据"))??;
        let Some(chunk) = chunk else { break };
        file.write_all(&chunk).await?;
        done += chunk.len() as u64;
        if last_report.elapsed() >= Duration::from_millis(500) {
            last_report = std::time::Instant::now();
            report(data_root, spec.id, "downloading", done, total, source, "");
        }
    }
    file.flush().await?;
    report(data_root, spec.id, "downloading", done, total.max(done), source, "");
    Ok(())
}

pub(crate) fn report(data_root: &Path, id: &str, state: &str, done: u64, total: u64, source: &str, error: &str) {
    let progress = AssetProgress {
        state: state.to_string(),
        bytes_done: done,
        bytes_total: total,
        source: source.to_string(),
        error: error.to_string(),
        updated_at: crate::models::domain::now_iso(),
    };
    if let Err(err) = store::write_progress(data_root, id, Some(progress)) {
        tracing::warn!("write runtime asset progress failed: {err:#}");
    }
}

/// 解开 npm 的 tarball（gzip 的 tar，文件都在 `package/` 下），只取清单列的文件，逐个核对，放进 `staging`。
pub(crate) fn unpack_and_verify(tarball: &Path, staging: &Path, spec: &AssetSpec) -> Result<()> {
    std::fs::create_dir_all(staging)?;
    let reader = flate2::read::GzDecoder::new(std::io::BufReader::new(std::fs::File::open(tarball)?));
    let mut wanted: std::collections::HashMap<&str, &super::manifest::FileSpec> =
        spec.package.files.iter().map(|file| (file.path.as_str(), file)).collect();
    for_each_tar_file(reader, |name, entry| {
        let Some(relative) = name.strip_prefix("package/") else { return Ok(()) };
        let Some(file) = wanted.remove(relative) else { return Ok(()) };
        let target = staging.join(&file.path);
        let mut out = std::fs::File::create(&target)?;
        let mut hasher = Sha256::new();
        let mut size: u64 = 0;
        let mut buffer = vec![0u8; 1 << 16];
        loop {
            let read = entry.read(&mut buffer)?;
            if read == 0 {
                break;
            }
            hasher.update(&buffer[..read]);
            std::io::Write::write_all(&mut out, &buffer[..read])?;
            size += read as u64;
        }
        let digest: String = hasher.finalize().iter().map(|byte| format!("{byte:02x}")).collect();
        if size != file.size || digest != file.sha256 {
            bail!("{} 和清单对不上：大小 {size}（应为 {}），sha256 {digest}（应为 {}）", file.path, file.size, file.sha256);
        }
        #[cfg(unix)]
        if file.executable {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&target, std::fs::Permissions::from_mode(0o755))?;
        }
        Ok(())
    })?;
    if !wanted.is_empty() {
        let mut missing: Vec<&str> = wanted.keys().copied().collect();
        missing.sort();
        bail!("包里缺文件：{missing:?}");
    }
    Ok(())
}

/// 最小的 tar 读取（ustar；npm 打的包就是这种）：普通文件交给 `visit`，pax 扩展头、目录等跳过。
fn for_each_tar_file<R: Read>(mut reader: R, mut visit: impl FnMut(&str, &mut dyn Read) -> Result<()>) -> Result<()> {
    let mut header = [0u8; 512];
    let mut long_name: Option<String> = None;
    loop {
        if !read_block(&mut reader, &mut header)? || header.iter().all(|byte| *byte == 0) {
            return Ok(());
        }
        let size = parse_octal(&header[124..136]).context("tar 头里的大小读不出来")?;
        let kind = header[156];
        let mut name = long_name.take().unwrap_or_else(|| {
            let prefix = field_str(&header[345..500]);
            let base = field_str(&header[0..100]);
            if prefix.is_empty() { base } else { format!("{prefix}/{base}") }
        });
        let padded = size.div_ceil(512) * 512;
        let mut body = (&mut reader).take(size);
        match kind {
            b'0' | 0 => {
                name = name.trim_start_matches("./").to_string();
                visit(&name, &mut body)?;
                std::io::copy(&mut body, &mut std::io::sink())?;
            }
            b'x' => {
                let mut pax = String::new();
                body.read_to_string(&mut pax)?;
                long_name = pax.lines().find_map(|line| line.split_once(" path=").map(|(_, path)| path.to_string()));
            }
            _ => {
                std::io::copy(&mut body, &mut std::io::sink())?;
            }
        }
        std::io::copy(&mut (&mut reader).take(padded - size), &mut std::io::sink())?;
    }
}

fn read_block<R: Read>(reader: &mut R, block: &mut [u8; 512]) -> Result<bool> {
    let mut filled = 0;
    while filled < block.len() {
        let read = reader.read(&mut block[filled..])?;
        if read == 0 {
            return if filled == 0 { Ok(false) } else { Err(anyhow!("tar 在头中间断了")) };
        }
        filled += read;
    }
    Ok(true)
}

fn field_str(bytes: &[u8]) -> String {
    let end = bytes.iter().position(|byte| *byte == 0).unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..end]).trim().to_string()
}

fn parse_octal(bytes: &[u8]) -> Option<u64> {
    let text = field_str(bytes);
    let text = text.trim();
    if text.is_empty() {
        return Some(0);
    }
    u64::from_str_radix(text, 8).ok()
}
