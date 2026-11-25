//! 起本机 agent 的闸门。Claude Code、Codex 这类 agent 能在本机跑命令，桥等于一个能起本机进程的入口，所以只在
//! 「本机用户自己在本机的页面上」时打开（方案：docs/ops/planning/reader-ask/20261125-后端ACP桥和自带agent.md「安全」）。
//!
//! - 整个后端：单机模式、监听回环地址、没设 `RUST_API_LOCAL_AGENTS=0`（[`local_agents_reason`]）；
//! - 每次握手：`Host` 是 `localhost` 或回环 IP，没有 `Forwarded` / `X-Forwarded-*`（经过代理、局域网共享的不放）
//!   （[`handshake_reason`]）。来源（`Origin`）由调用方照 CORS 那套另查。
use std::net::IpAddr;

use axum::http::{header, HeaderMap};

pub const LOCAL_AGENTS_ENV: &str = "RUST_API_LOCAL_AGENTS";

/// 后端整体能不能起本机 agent：能就返回空串，不能返回原因（写进 `GET /ai/agents`）。
pub fn local_agents_reason(multi_user: bool, listens_on_loopback: bool, env_flag: Option<&str>) -> String {
    if multi_user {
        return "多用户模式不起本机 agent".into();
    }
    if !listens_on_loopback {
        return "后端不是只在本机监听（服务器、Docker 部署），不起本机 agent".into();
    }
    if env_flag.is_some_and(|value| matches!(value.trim().to_ascii_lowercase().as_str(), "0" | "false" | "off" | "no")) {
        return format!("{LOCAL_AGENTS_ENV}=0，本机 agent 已关");
    }
    String::new()
}

fn host_is_loopback(host: &str) -> bool {
    let host = host.trim();
    let name = if let Some(rest) = host.strip_prefix('[') {
        rest.split(']').next().unwrap_or("")
    } else {
        host.rsplit_once(':').map(|(name, port)| if port.chars().all(|c| c.is_ascii_digit()) { name } else { host }).unwrap_or(host)
    };
    name.eq_ignore_ascii_case("localhost") || name.parse::<IpAddr>().is_ok_and(|ip| ip.is_loopback())
}

/// 这次握手能不能起本机 agent：能就返回 None，不能返回原因。
pub fn handshake_reason(headers: &HeaderMap) -> Option<&'static str> {
    for forwarded in ["forwarded", "x-forwarded-for", "x-forwarded-host", "x-real-ip"] {
        if headers.contains_key(forwarded) {
            return Some("经过代理的连接不起本机 agent");
        }
    }
    let host = headers.get(header::HOST).and_then(|value| value.to_str().ok()).unwrap_or("");
    if !host_is_loopback(host) {
        return Some("只有本机地址（localhost、127.0.0.1）打开的页面能起本机 agent");
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn whole_backend_switch() {
        assert_eq!(local_agents_reason(false, true, None), "");
        assert_eq!(local_agents_reason(false, true, Some("1")), "");
        assert!(local_agents_reason(true, true, None).contains("多用户"));
        assert!(local_agents_reason(false, false, None).contains("Docker"));
        assert!(local_agents_reason(false, true, Some(" Off ")).contains("RUST_API_LOCAL_AGENTS"));
    }

    #[test]
    fn handshake_needs_a_loopback_host_and_no_proxy() {
        let headers = |pairs: &[(&str, &str)]| {
            let mut map = HeaderMap::new();
            for (name, value) in pairs {
                map.insert(axum::http::HeaderName::from_bytes(name.as_bytes()).unwrap(), value.parse().unwrap());
            }
            map
        };
        for host in ["localhost:41000", "127.0.0.1:41000", "[::1]:41000", "LOCALHOST", "127.0.0.2"] {
            assert_eq!(handshake_reason(&headers(&[("host", host)])), None, "{host}");
        }
        for host in ["192.168.1.5:41000", "retainpdf.example.com", "localhost.evil.com", ""] {
            assert!(handshake_reason(&headers(&[("host", host)])).is_some(), "{host}");
        }
        assert!(handshake_reason(&headers(&[("host", "localhost"), ("x-forwarded-for", "192.168.1.9")])).is_some());
        assert!(handshake_reason(&headers(&[("host", "localhost"), ("forwarded", "for=1.2.3.4")])).is_some());
    }
}
