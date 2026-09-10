use std::net::{Ipv4Addr, Ipv6Addr};

use url::Host;

use crate::error::AppError;

/// Validate a client-supplied provider URL before it carries a bearer token.
/// This prevents probe endpoints from becoming SSRF or credential-exfiltration
/// primitives. Self-hosted deployments can explicitly allow private targets.
pub(super) fn validate_provider_base_url(
    raw_base_url: &str,
    allow_private_urls: bool,
) -> Result<(), AppError> {
    let trimmed = raw_base_url.trim();
    let parsed = url::Url::parse(trimmed)
        .map_err(|_| AppError::bad_request("base_url must be a valid absolute http(s) URL"))?;

    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(AppError::bad_request(
            "base_url scheme must be http or https",
        ));
    }

    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(AppError::bad_request(
            "base_url must not contain embedded credentials",
        ));
    }

    if allow_private_urls {
        return Ok(());
    }

    match parsed.host() {
        Some(Host::Domain(domain)) => {
            if domain.eq_ignore_ascii_case("localhost") {
                return Err(AppError::bad_request(
                    "base_url host is not allowed; localhost/private targets are blocked",
                ));
            }
        }
        Some(Host::Ipv4(ip)) => {
            if is_disallowed_ipv4(ip) {
                return Err(AppError::bad_request(
                    "base_url host is not allowed; loopback/private/link-local IPs are blocked",
                ));
            }
        }
        Some(Host::Ipv6(ip)) => {
            if is_disallowed_ipv6(ip) {
                return Err(AppError::bad_request(
                    "base_url host is not allowed; loopback/private/link-local IPs are blocked",
                ));
            }
        }
        None => {
            return Err(AppError::bad_request("base_url must include a host"));
        }
    }

    Ok(())
}

fn is_disallowed_ipv4(ip: Ipv4Addr) -> bool {
    ip.is_loopback() || ip.is_link_local() || ip.is_private() || ip.is_unspecified()
}

fn is_disallowed_ipv6(ip: Ipv6Addr) -> bool {
    if ip.is_loopback() || ip.is_unspecified() {
        return true;
    }
    if let Some(mapped) = ip.to_ipv4_mapped() {
        return is_disallowed_ipv4(mapped);
    }
    let segments = ip.segments();
    if segments[0] & 0xfe00 == 0xfc00 {
        return true;
    }
    if segments[0] & 0xffc0 == 0xfe80 {
        return true;
    }
    false
}
