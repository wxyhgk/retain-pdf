//! 测试用的最小 WebDAV 服务:本机目录当存储,支持同步用到的方法,校验账号,数请求。
//! 行为照群晖:上级目录不存在时 PUT / MKCOL 回 409,已存在的目录 MKCOL 回 405;支持
//! `Range: bytes=N-` 续传。`cut_downloads` 设成 n:接下来 n 次下载文件包时只发一半就断开
//! (模拟慢线路上的断线)。

use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

pub(super) struct TestDav {
    /// 同步文件夹的地址(`http://127.0.0.1:端口/dav/retainpdf`)。
    pub url: String,
    pub requests: Arc<AtomicUsize>,
    pub root: PathBuf,
    pub cut_downloads: Arc<AtomicUsize>,
    /// 带 Range 的下载请求数(续传)。
    pub ranged: Arc<AtomicUsize>,
    /// 接下来这么多个请求一律不回复、直接断开(模拟网络抖动)。
    pub drop_requests: Arc<AtomicUsize>,
}

fn base64(input: &str) -> String {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes = input.as_bytes();
    let mut out = String::new();
    for chunk in bytes.chunks(3) {
        let n = (chunk[0] as u32) << 16
            | (*chunk.get(1).unwrap_or(&0) as u32) << 8
            | *chunk.get(2).unwrap_or(&0) as u32;
        for i in 0..4 {
            if i <= chunk.len() {
                out.push(TABLE[(n >> (18 - 6 * i) & 63) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}

impl TestDav {
    pub fn start(root: &Path, username: &str, password: &str) -> Self {
        fs::create_dir_all(root.join("dav")).unwrap();
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let requests = Arc::new(AtomicUsize::new(0));
        let expected = format!("Basic {}", base64(&format!("{username}:{password}")));
        let cut_downloads = Arc::new(AtomicUsize::new(0));
        let ranged = Arc::new(AtomicUsize::new(0));
        let drop_requests = Arc::new(AtomicUsize::new(0));
        let dropping = drop_requests.clone();
        let (root_owned, counter) = (root.to_path_buf(), requests.clone());
        let (cut, ranges) = (cut_downloads.clone(), ranged.clone());
        std::thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let (root, counter, expected) = (root_owned.clone(), counter.clone(), expected.clone());
                let (cut, ranges) = (cut.clone(), ranges.clone());
                if dropping.fetch_update(Ordering::SeqCst, Ordering::SeqCst, |n| n.checked_sub(1)).is_ok() {
                    let _ = stream.shutdown(std::net::Shutdown::Both);
                    continue;
                }
                std::thread::spawn(move || {
                    counter.fetch_add(1, Ordering::SeqCst);
                    let _ = handle(stream, &root, &expected, &cut, &ranges);
                });
            }
        });
        Self {
            url: format!("http://127.0.0.1:{port}/dav/retainpdf"),
            requests,
            root: root.to_path_buf(),
            cut_downloads,
            ranged,
            drop_requests,
        }
    }

    pub fn count(&self) -> usize {
        self.requests.load(Ordering::SeqCst)
    }
}

fn respond(stream: &mut TcpStream, code: u16, body: &[u8], head_only: bool) -> std::io::Result<()> {
    let reason = match code {
        200 => "OK",
        201 => "Created",
        204 => "No Content",
        206 => "Partial Content",
        207 => "Multi-Status",
        401 => "Unauthorized",
        404 => "Not Found",
        405 => "Method Not Allowed",
        409 => "Conflict",
        _ => "Other",
    };
    write!(
        stream,
        "HTTP/1.1 {code} {reason}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    )?;
    if !head_only {
        stream.write_all(body)?;
    }
    stream.flush()
}

fn local_path(root: &Path, url_path: &str) -> PathBuf {
    let trimmed = url_path.split('?').next().unwrap_or("").trim_matches('/');
    trimmed.split('/').filter(|p| !p.is_empty()).fold(root.to_path_buf(), |p, part| p.join(part))
}

fn handle(
    mut stream: TcpStream,
    root: &Path,
    expected_auth: &str,
    cut: &AtomicUsize,
    ranged: &AtomicUsize,
) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut line = String::new();
    reader.read_line(&mut line)?;
    let mut parts = line.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let target = parts.next().unwrap_or("/").to_string();
    let mut headers = HashMap::new();
    loop {
        let mut header = String::new();
        reader.read_line(&mut header)?;
        let header = header.trim_end();
        if header.is_empty() {
            break;
        }
        if let Some((name, value)) = header.split_once(':') {
            headers.insert(name.trim().to_ascii_lowercase(), value.trim().to_string());
        }
    }
    let length: usize = headers.get("content-length").and_then(|v| v.parse().ok()).unwrap_or(0);
    let mut body = vec![0u8; length];
    reader.read_exact(&mut body)?;
    if headers.get("authorization").map(String::as_str) != Some(expected_auth) {
        return respond(&mut stream, 401, b"", false);
    }
    let path = local_path(root, &target);
    let parent_exists = path.parent().is_some_and(Path::is_dir);
    match method.as_str() {
        "GET" if path.is_file() && target.ends_with(".pack") => {
            let bytes = fs::read(&path)?;
            let start: usize = headers
                .get("range")
                .and_then(|r| r.strip_prefix("bytes="))
                .and_then(|r| r.trim_end_matches('-').parse().ok())
                .unwrap_or(0);
            if start > 0 {
                ranged.fetch_add(1, Ordering::SeqCst);
            }
            if start >= bytes.len() && start > 0 {
                return respond(&mut stream, 416, b"", false);
            }
            let rest = &bytes[start..];
            let head = if start > 0 {
                format!(
                    "HTTP/1.1 206 Partial Content\r\nContent-Length: {}\r\nContent-Range: bytes {start}-{}/{}\r\nConnection: close\r\n\r\n",
                    rest.len(),
                    bytes.len() - 1,
                    bytes.len()
                )
            } else {
                format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", rest.len())
            };
            stream.write_all(head.as_bytes())?;
            let cut_now = cut
                .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |n| n.checked_sub(1))
                .is_ok();
            if cut_now {
                // 只发一半就断开。
                stream.write_all(&rest[..rest.len() / 2])?;
                stream.flush()?;
                return stream.shutdown(std::net::Shutdown::Both);
            }
            stream.write_all(rest)?;
            stream.flush()
        }
        "GET" | "HEAD" => match fs::read(&path) {
            Ok(bytes) if path.is_file() => respond(&mut stream, 200, &bytes, method == "HEAD"),
            _ if path.is_dir() && method == "HEAD" => respond(&mut stream, 200, b"", true),
            _ => respond(&mut stream, 404, b"", method == "HEAD"),
        },
        "PUT" => {
            if !parent_exists {
                return respond(&mut stream, 409, b"", false);
            }
            fs::write(&path, &body)?;
            respond(&mut stream, 201, b"", false)
        }
        "MKCOL" => {
            if path.exists() {
                respond(&mut stream, 405, b"", false)
            } else if !parent_exists {
                respond(&mut stream, 409, b"", false)
            } else {
                fs::create_dir(&path)?;
                respond(&mut stream, 201, b"", false)
            }
        }
        "MOVE" => {
            let destination = headers.get("destination").cloned().unwrap_or_default();
            let destination_path = destination.splitn(4, '/').nth(3).map(|p| format!("/{p}")).unwrap_or_default();
            fs::rename(&path, local_path(root, &destination_path))?;
            respond(&mut stream, 201, b"", false)
        }
        "DELETE" => {
            if path.is_dir() {
                fs::remove_dir_all(&path)?;
            } else if fs::remove_file(&path).is_err() {
                return respond(&mut stream, 404, b"", false);
            }
            respond(&mut stream, 204, b"", false)
        }
        "PROPFIND" => {
            if !path.is_dir() {
                return respond(&mut stream, 404, b"", false);
            }
            let base = format!("/{}/", target.trim_matches('/'));
            let mut xml = format!(r#"<?xml version="1.0"?><D:multistatus xmlns:D="DAV:"><D:response><D:href>{base}</D:href></D:response>"#);
            for entry in fs::read_dir(&path)? {
                let entry = entry?;
                let name = entry.file_name().to_string_lossy().to_string();
                let slash = if entry.path().is_dir() { "/" } else { "" };
                xml.push_str(&format!("<D:response><D:href>{base}{name}{slash}</D:href></D:response>"));
            }
            xml.push_str("</D:multistatus>");
            respond(&mut stream, 207, xml.as_bytes(), false)
        }
        _ => respond(&mut stream, 405, b"", false),
    }
}
