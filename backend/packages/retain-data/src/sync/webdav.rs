//! 「存文件」的 WebDAV 实现:群晖 / 威联通 NAS、坚果云、Nextcloud 等。
//!
//! 只用 WebDAV 最基本的几个方法:GET / HEAD / PUT / MKCOL / MOVE / DELETE,以及
//! `PROPFIND Depth: 1` 列一层目录(不依赖 Depth: infinity,群晖默认关着)。改动记录段
//! 先 PUT 到同目录的临时名再 MOVE 过去,别的设备读不到写了一半的段。读文件包时整个
//! 下载到本机缓存(一个包一个请求),这一轮结束、后端释放时删掉缓存。
//!
//! 慢而不稳的线路(经 Tailscale 中转)上,几十 MB 的包下到一半断开是常事:下载断点续传
//! (`Range`),下了一半的部分留在 `webdav-partial/` 里跨轮保留,每轮内也重试几次;一个包
//! 这一轮实在下不下来,就记为失败、这一轮不再碰它(用到它的改动进等待区),不拖垮整轮。
//! 上传没法续传,失败时整包重试几次。
//!
//! 运行在同步线程里(阻塞式请求),不要从异步上下文直接调用。

use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use anyhow::{bail, Context, Result};
use reqwest::blocking::{Body, Client, Response};
use reqwest::{Method, StatusCode, Url};

use super::store::{Backend, Fetched};

/// WebDAV 连接设置。`url` 是同步文件夹本身(比如 `http://nas:5005/webdav/retainpdf`)。
#[derive(Debug, Clone)]
pub struct WebDavConfig {
    pub url: String,
    pub username: String,
    pub password: String,
}

enum Download {
    Complete,
    Incomplete,
    Missing,
}

pub struct WebDavBackend {
    client: Client,
    base: Url,
    username: String,
    password: String,
    cache_dir: PathBuf,
    cache: Mutex<HashMap<String, PathBuf>>,
    /// 下了一半的文件(跨轮保留,续传)。
    partial_dir: PathBuf,
    /// 这一轮已经下载失败的文件:不再反复尝试。
    failed: Mutex<HashSet<String>>,
    /// 这个后端已经确认存在(或建好)的目录。
    made: Mutex<HashSet<String>>,
}

fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let pair = std::str::from_utf8(&bytes[i + 1..i + 3]).ok();
            if let Some(byte) = pair.and_then(|p| u8::from_str_radix(p, 16).ok()) {
                out.push(byte);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

/// PROPFIND 回复里所有 `<…:href>` 的内容(不管命名空间前缀)。
fn hrefs(xml: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut rest = xml;
    while let Some(start) = rest.find('<') {
        rest = &rest[start + 1..];
        let Some(end) = rest.find('>') else { break };
        let tag = &rest[..end];
        rest = &rest[end + 1..];
        let local = tag.rsplit(':').next().unwrap_or(tag).trim();
        if tag.starts_with('/') || !local.eq_ignore_ascii_case("href") {
            continue;
        }
        let close = rest.find('<').unwrap_or(rest.len());
        out.push(rest[..close].trim().replace("&amp;", "&"));
        rest = &rest[close..];
    }
    out
}

fn status_error(status: StatusCode, action: &str, url: &Url) -> anyhow::Error {
    let reason = match status.as_u16() {
        401 => "WebDAV 账号或密码不对".to_string(),
        403 => "没有权限访问这个 WebDAV 目录".to_string(),
        405 => "WebDAV 服务不允许这个操作".to_string(),
        409 => "WebDAV 上的上级目录不存在".to_string(),
        423 => "WebDAV 上的文件被锁住了".to_string(),
        507 => "WebDAV 空间不足".to_string(),
        _ => format!("WebDAV 返回 {status}"),
    };
    anyhow::anyhow!("{reason}({action} {url})")
}

impl WebDavBackend {
    /// `cache_root`:本机缓存的上级目录(在它下面建一个这个后端独用的子目录)。
    pub fn new(config: &WebDavConfig, cache_root: &Path) -> Result<Self> {
        let mut text = config.url.trim().to_string();
        if !text.ends_with('/') {
            text.push('/');
        }
        let base = Url::parse(&text).with_context(|| format!("WebDAV 地址不对:{}", config.url))?;
        if !matches!(base.scheme(), "http" | "https") {
            bail!("WebDAV 地址要以 http:// 或 https:// 开头");
        }
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(15))
            // 文件包最大几十 MB;慢线路(经中转)也给足时间。
            .timeout(Duration::from_secs(1800))
            .build()?;
        let cache_dir = cache_root.join(format!("webdav-cache-{:016x}", fastrand::u64(..)));
        let partial_dir = cache_root.join("webdav-partial");
        Ok(Self {
            client,
            base,
            username: config.username.clone(),
            password: config.password.clone(),
            cache_dir,
            cache: Mutex::new(HashMap::new()),
            partial_dir,
            failed: Mutex::new(HashSet::new()),
            made: Mutex::new(HashSet::new()),
        })
    }

    fn url(&self, path: &str) -> Result<Url> {
        Ok(self.base.join(path)?)
    }

    fn request(&self, method: Method, url: Url) -> reqwest::blocking::RequestBuilder {
        let builder = self.client.request(method, url);
        if self.username.is_empty() {
            builder
        } else {
            builder.basic_auth(&self.username, Some(&self.password))
        }
    }

    /// 发请求;没拿到回复(连接断开、超时)时重试几次。带流式请求体的(上传)不能原样
    /// 重发,只发一次,由上层整包重试。
    fn send(&self, builder: reqwest::blocking::RequestBuilder, action: &str, url: &Url) -> Result<Response> {
        let mut attempt = 0u64;
        let mut builder = builder;
        loop {
            let retry = builder.try_clone();
            match builder.send() {
                Ok(response) => return Ok(response),
                Err(error) => match retry {
                    Some(next) if attempt < 3 => {
                        attempt += 1;
                        std::thread::sleep(Duration::from_millis(500 * attempt));
                        builder = next;
                    }
                    _ => return Err(error).with_context(|| format!("连不上 WebDAV 服务({action} {url})")),
                },
            }
        }
    }

    /// 建好 `path` 所在的每一级目录(同步文件夹本身也算)。
    fn ensure_dirs(&self, path: &str) -> Result<()> {
        let mut dirs = vec![String::new()];
        let parts: Vec<&str> = path.split('/').collect();
        for i in 1..parts.len() {
            dirs.push(format!("{}/", parts[..i].join("/")));
        }
        for dir in dirs {
            if self.made.lock().expect("webdav dirs poisoned").contains(&dir) {
                continue;
            }
            let url = self.url(&dir)?;
            let response = self.send(self.request(Method::from_bytes(b"MKCOL")?, url.clone()), "MKCOL", &url)?;
            let status = response.status();
            // 201 建好了;405 / 301 已经存在(有的服务对已存在的目录回 301 跳到带斜杠的地址)。
            if !(status.is_success() || status == StatusCode::METHOD_NOT_ALLOWED || status.is_redirection()) {
                return Err(status_error(status, "MKCOL", &url));
            }
            self.made.lock().expect("webdav dirs poisoned").insert(dir);
        }
        Ok(())
    }

    fn put(&self, url: &Url, body: Body) -> Result<()> {
        let response = self.send(self.request(Method::PUT, url.clone()).body(body), "PUT", url)?;
        if !response.status().is_success() {
            return Err(status_error(response.status(), "PUT", url));
        }
        Ok(())
    }

    /// 下载到 `partial`(已有的部分接着下)。
    fn download_resuming(&self, url: &Url, partial: &Path) -> Result<Download> {
        let have = fs::metadata(partial).map(|m| m.len()).unwrap_or(0);
        let mut builder = self.request(Method::GET, url.clone());
        if have > 0 {
            builder = builder.header("Range", format!("bytes={have}-"));
        }
        let mut response = self.send(builder, "GET", url)?;
        let status = response.status();
        let mut file = match status {
            StatusCode::NOT_FOUND => return Ok(Download::Missing),
            // 续上了:接在后面写。
            StatusCode::PARTIAL_CONTENT => fs::OpenOptions::new().append(true).open(partial)?,
            // 已经下完(请求的起点就是文件末尾)。
            StatusCode::RANGE_NOT_SATISFIABLE => return Ok(Download::Complete),
            // 服务端不支持续传或文件变了:从头下。
            status if status.is_success() => File::create(partial)?,
            status => return Err(status_error(status, "GET", url)),
        };
        let total = match status {
            StatusCode::PARTIAL_CONTENT => response
                .headers()
                .get("Content-Range")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.rsplit('/').next())
                .and_then(|v| v.parse::<u64>().ok()),
            _ => response.content_length(),
        };
        response.copy_to(&mut file)?;
        file.flush()?;
        let got = fs::metadata(partial)?.len();
        Ok(if total.map_or(true, |total| got >= total) { Download::Complete } else { Download::Incomplete })
    }

    fn delete(&self, url: &Url) -> Result<()> {
        let response = self.send(self.request(Method::DELETE, url.clone()), "DELETE", url)?;
        let status = response.status();
        if !(status.is_success() || status == StatusCode::NOT_FOUND) {
            return Err(status_error(status, "DELETE", url));
        }
        Ok(())
    }
}

impl Drop for WebDavBackend {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.cache_dir);
    }
}

impl Backend for WebDavBackend {
    fn describe(&self) -> String {
        let mut shown = self.base.clone();
        let _ = shown.set_password(None);
        let _ = shown.set_username("");
        shown.to_string()
    }

    fn read(&self, path: &str) -> Result<Fetched> {
        let url = self.url(path)?;
        let response = self.send(self.request(Method::GET, url.clone()), "GET", &url)?;
        match response.status() {
            StatusCode::NOT_FOUND => Ok(Fetched::Missing),
            status if status.is_success() => Ok(Fetched::Bytes(response.bytes()?.to_vec())),
            status => Err(status_error(status, "GET", &url)),
        }
    }

    fn exists(&self, path: &str) -> Result<bool> {
        let url = self.url(path)?;
        let response = self.send(self.request(Method::HEAD, url.clone()), "HEAD", &url)?;
        match response.status() {
            StatusCode::NOT_FOUND => Ok(false),
            status if status.is_success() => Ok(true),
            status => Err(status_error(status, "HEAD", &url)),
        }
    }

    fn write_atomic(&self, path: &str, bytes: &[u8]) -> Result<()> {
        self.ensure_dirs(path)?;
        let (dir, name) = path.rsplit_once('/').map_or(("", path), |(d, n)| (d, n));
        let temp_name = format!(".{name}.tmp-{:016x}", fastrand::u64(..));
        let temp = self.url(&if dir.is_empty() { temp_name } else { format!("{dir}/{temp_name}") })?;
        let target = self.url(path)?;
        self.put(&temp, Body::from(bytes.to_vec()))?;
        let moved = self
            .send(
                self.request(Method::from_bytes(b"MOVE")?, temp.clone())
                    .header("Destination", target.as_str())
                    .header("Overwrite", "T"),
                "MOVE",
                &temp,
            )
            .and_then(|response| {
                if response.status().is_success() {
                    Ok(())
                } else {
                    Err(status_error(response.status(), "MOVE", &temp))
                }
            });
        if moved.is_err() {
            let _ = self.delete(&temp);
        }
        moved
    }

    fn upload(&self, path: &str, source: &Path) -> Result<()> {
        self.ensure_dirs(path)?;
        let url = self.url(path)?;
        let mut last = None;
        for attempt in 0..3 {
            if attempt > 0 {
                std::thread::sleep(Duration::from_secs(2 * attempt));
            }
            let file = File::open(source).with_context(|| format!("failed to open {}", source.display()))?;
            let length = file.metadata()?.len();
            match self.put(&url, Body::sized(file, length)) {
                Ok(()) => return Ok(()),
                Err(error) => last = Some(error),
            }
        }
        Err(last.expect("at least one attempt")).with_context(|| format!("上传 {url} 失败(已重试)"))
    }

    fn list(&self, dir: &str) -> Result<Vec<String>> {
        let dir = format!("{}/", dir.trim_end_matches('/'));
        let url = self.url(&dir)?;
        let response = self.send(
            self.request(Method::from_bytes(b"PROPFIND")?, url.clone())
                .header("Depth", "1")
                .header("Content-Type", "application/xml")
                .body(r#"<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><resourcetype/></prop></propfind>"#),
            "PROPFIND",
            &url,
        )?;
        match response.status() {
            StatusCode::NOT_FOUND => return Ok(Vec::new()),
            status if status.is_success() => {}
            status => return Err(status_error(status, "PROPFIND", &url)),
        }
        let xml = response.text()?;
        let own = percent_decode(url.path().trim_end_matches('/'));
        let mut out = Vec::new();
        for href in hrefs(&xml) {
            // 可能是完整地址,也可能只是路径。
            let path = Url::parse(&href).map(|u| u.path().to_string()).unwrap_or(href);
            let path = percent_decode(path.trim_end_matches('/'));
            if path == own || path.is_empty() {
                continue;
            }
            if let Some(name) = path.rsplit('/').next().filter(|n| !n.is_empty()) {
                out.push(name.to_string());
            }
        }
        Ok(out)
    }

    fn local_copy(&self, path: &str) -> Result<Option<PathBuf>> {
        if let Some(cached) = self.cache.lock().expect("webdav cache poisoned").get(path) {
            return Ok(Some(cached.clone()));
        }
        if self.failed.lock().expect("webdav failed poisoned").contains(path) {
            return Ok(None);
        }
        let url = self.url(path)?;
        fs::create_dir_all(&self.partial_dir)?;
        fs::create_dir_all(&self.cache_dir)?;
        let partial = self.partial_dir.join(path.replace('/', "_"));
        let mut complete = false;
        let mut last_error = None;
        for attempt in 0..4 {
            if attempt > 0 {
                std::thread::sleep(Duration::from_secs(2 * attempt));
            }
            match self.download_resuming(&url, &partial) {
                Ok(Download::Complete) => {
                    complete = true;
                    break;
                }
                Ok(Download::Missing) => {
                    let _ = fs::remove_file(&partial);
                    return Ok(None);
                }
                Ok(Download::Incomplete) => {}
                Err(error) => last_error = Some(error),
            }
        }
        if !complete {
            // 这一轮放弃(已下的部分留着,下一轮接着下);用到它的改动进等待区。
            self.failed.lock().expect("webdav failed poisoned").insert(path.to_string());
            if let Some(error) = last_error {
                tracing::warn!("sync: download of {url} interrupted, will resume next cycle: {error:#}");
            }
            return Ok(None);
        }
        let local = self.cache_dir.join(path.replace('/', "_"));
        fs::rename(&partial, &local).with_context(|| format!("下载 {url} 失败"))?;
        self.cache
            .lock()
            .expect("webdav cache poisoned")
            .insert(path.to_string(), local.clone());
        Ok(Some(local))
    }

    fn remove(&self, path: &str) -> Result<()> {
        self.delete(&self.url(path)?)
    }

    fn end_cycle(&self) {
        self.cache.lock().expect("webdav cache poisoned").clear();
        self.failed.lock().expect("webdav failed poisoned").clear();
        let _ = fs::remove_dir_all(&self.cache_dir);
        // 续传用的目录空了就删(还有半截文件时留着,下一轮接着下)。
        let _ = fs::remove_dir(&self.partial_dir);
    }
}

#[cfg(test)]
mod tests {
    use super::{hrefs, percent_decode};

    #[test]
    fn hrefs_are_found_whatever_the_namespace_prefix() {
        let xml = r#"<?xml version="1.0"?><D:multistatus xmlns:D="DAV:"><D:response><D:href>/webdav/retainpdf/devices/</D:href></D:response><d:response><d:href>http://nas:5005/webdav/retainpdf/devices/0123456789abcdef/</d:href></d:response><response><href>/a%20b/</href></response></D:multistatus>"#;
        assert_eq!(
            hrefs(xml),
            vec![
                "/webdav/retainpdf/devices/",
                "http://nas:5005/webdav/retainpdf/devices/0123456789abcdef/",
                "/a%20b/"
            ]
        );
        assert_eq!(percent_decode("/a%20b/%E4%B8%AD"), "/a b/中");
        assert_eq!(percent_decode("100%"), "100%");
        assert_eq!(percent_decode("%中文"), "%中文");
    }
}
