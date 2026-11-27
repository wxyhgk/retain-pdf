//! 网络类失败的兜底判据（2026-11-27 细分）：没有结构化失败时，按任务的报错文字认。
//!
//! 和 Python 的 `structured_errors.py`（`TLS_CERTIFICATE_TOKENS` 那一组）同一套子串、同一个顺序，两边认出来的码一样：
//! 证书验证失败最先（报错里也有 SSL 字样）；代理在域名解析前；超时在握手失败前（「The handshake operation timed out」是超时）；
//! 连接被断开最后。子串都是小写，对着小写的全文找；覆盖标准库 urllib / ssl / socket、requests / urllib3、reqwest / rustls / hyper
//! 三种写法，errno 写了 macOS、Linux、Windows 三家的号。
//!
//! 以前这里只认域名解析和超时；agent 的网络错误还会被报成「限流」（`reason=rate_limited`），证书验证失败落到「未识别的异常」。

use crate::models::domain::{JobFailureInfo, JobRawDiagnostic, JobSnapshot, OcrProviderDiagnostics};

use super::job_failure_support::{
    build_failure, extract_upstream_host, first_error_excerpt, provider_name, select_relevant_log_line,
};

pub(super) const TLS_CERTIFICATE_TOKENS: &[&str] = &[
    "certificate_verify_failed",
    "certificate verify failed",
    "sslcertverificationerror",
    "invalid peer certificate",
    "unknownissuer",
    "unable to get local issuer certificate",
    "self signed certificate",
    "self-signed certificate",
    "certificate has expired",
    "certificate is not valid for",
    "notvalidforname",
    "hostname mismatch",
];
pub(super) const PROXY_FAILURE_TOKENS: &[&str] = &[
    "proxyerror",
    "unable to connect to proxy",
    "cannot connect to proxy",
    "tunnel connection failed",
    "proxy authentication required",
];
pub(super) const DNS_FAILURE_TOKENS: &[&str] = &[
    "failed to resolve",
    "temporary failure in name resolution",
    "nameresolutionerror",
    "socket.gaierror",
    "nodename nor servname provided",
    "name or service not known",
    "getaddrinfo failed",
    "no address associated with hostname",
    "failed to lookup address information",
    "dns error",
];
pub(super) const CONNECTION_REFUSED_TOKENS: &[&str] = &[
    "connection refused",
    "connectionrefusederror",
    "errno 61]",
    "errno 111]",
    "winerror 10061",
    "os error 61)",
    "os error 111)",
    "os error 10061)",
    "actively refused",
    "积极拒绝",
];
pub(super) const NETWORK_UNREACHABLE_TOKENS: &[&str] = &[
    "network is unreachable",
    "no route to host",
    "host is down",
    "errno 51]",
    "errno 65]",
    "errno 101]",
    "errno 113]",
    "winerror 10051",
    "winerror 10065",
    "os error 51)",
    "os error 101)",
];
pub(super) const TIMEOUT_TOKENS: &[&str] = &["readtimeout", "connecttimeout", "timed out", "timeouterror"];
pub(super) const TLS_HANDSHAKE_TOKENS: &[&str] = &[
    "sslerror",
    "[ssl:",
    "wrong_version_number",
    "wrong version number",
    "eof occurred in violation of protocol",
    "unexpected_eof_while_reading",
    "unexpected eof while reading",
    "tlsv1 alert",
    "sslv3 alert",
    "handshake failure",
    "record layer failure",
    "tls handshake",
];
pub(super) const CONNECTION_RESET_TOKENS: &[&str] = &[
    "connection reset",
    "connectionreseterror",
    "connection aborted",
    "connectionabortederror",
    "remotedisconnected",
    "remote end closed connection",
    "incompleteread",
    "connection closed before message completed",
    "errno 54]",
    "errno 104]",
    "winerror 10054",
    "os error 54)",
    "os error 104)",
    "os error 10054)",
];

const TLS_UNTRUSTED_ISSUER_SUGGESTION: &str = "这台机器不认这个服务的 HTTPS 证书，原样重试没用。常见原因：公司网络、代理、VPN 或杀毒软件拦截了 HTTPS\
（换成了它们自己的证书），或者自建的服务用的是自签证书。可以先关掉代理 / VPN 或换个网络再试；自建服务请换成受信任的证书。\
桌面版 2026.11.23 及更早的版本在 macOS 上用 agent 翻译时会误报这个错，升级到新版即可。";

/// 一种网络失败：码、给用户的一句话、原因、能不能原样重试、建议。
struct NetworkFailure {
    code: &'static str,
    summary: &'static str,
    root_cause: &'static str,
    retryable: bool,
    suggestion: &'static str,
    tokens: &'static [&'static str],
}

fn tls_certificate_suggestion(lowered: &str) -> &'static str {
    if lowered.contains("certificate has expired") || (lowered.contains("expired") && lowered.contains("certificate")) {
        return "证书过期了：先确认这台机器的日期和时间是否正确（时间不对会把有效证书当成过期）；时间没问题就是服务商的证书过期了，联系服务商或稍后再试。";
    }
    if ["hostname mismatch", "notvalidforname", "certificate is not valid for", "doesn't match"]
        .iter()
        .any(|token| lowered.contains(token))
    {
        return "证书上的域名和接口地址对不上：检查接口地址（base_url）有没有写错，或者是不是被代理改写了。";
    }
    TLS_UNTRUSTED_ISSUER_SUGGESTION
}

/// 按顺序找第一种对得上的；`lowered` 是小写的全文。
fn network_failure_for(lowered: &str) -> Option<NetworkFailure> {
    let failures = [
        NetworkFailure {
            code: "tls_certificate_untrusted",
            summary: "无法验证模型或 OCR 服务的 HTTPS 证书",
            root_cause: "请求在建立 HTTPS 连接时证书验证不过（签发者不认、自签、过期或域名对不上），任务中断",
            retryable: false,
            suggestion: tls_certificate_suggestion(lowered),
            tokens: TLS_CERTIFICATE_TOKENS,
        },
        NetworkFailure {
            code: "proxy_failed",
            summary: "代理连不上或拒绝转发",
            root_cause: "请求要经过代理，代理连不上、要认证或拒绝转发",
            retryable: true,
            suggestion: "代理连不上或拒绝转发：检查系统或 RetainPDF 里设置的代理地址、端口和账号；不需要代理就关掉再重试。",
            tokens: PROXY_FAILURE_TOKENS,
        },
        NetworkFailure {
            code: "dns_resolution_failed",
            summary: "外部服务域名解析失败",
            root_cause: "当前时刻解析不了上游服务的域名，任务中断",
            retryable: true,
            suggestion: "查不到服务地址里的域名：检查网络是否连上、接口地址（base_url）里的域名有没有拼错；开着代理、VPN 或改过 DNS 的，换一下再重试\
（Docker 请检查容器的 DNS）。",
            tokens: DNS_FAILURE_TOKENS,
        },
        NetworkFailure {
            code: "connection_refused",
            summary: "连不上服务：对方地址没有服务在监听",
            root_cause: "连接被对方拒绝：地址或端口上没有服务",
            retryable: true,
            suggestion: "对方地址上没有服务在监听：检查接口地址（base_url）和端口是否写对；用本机模型服务（Ollama、vLLM、LM Studio 等）的，\
确认服务已经启动、监听的地址和端口对得上。",
            tokens: CONNECTION_REFUSED_TOKENS,
        },
        NetworkFailure {
            code: "network_unreachable",
            summary: "这台机器现在连不上网络",
            root_cause: "本机没有到对方的网络路由（断网、Wi-Fi 或 VPN 没连上）",
            retryable: true,
            suggestion: "这台机器现在连不上网络：检查网线、Wi-Fi、VPN 是否连着，网络恢复后重试。",
            tokens: NETWORK_UNREACHABLE_TOKENS,
        },
        NetworkFailure {
            code: "upstream_timeout",
            summary: "外部服务请求超时",
            root_cause: "任务调用 OCR 或模型服务时等待过久，超过超时阈值",
            retryable: true,
            suggestion: "可直接重试；若频繁发生，建议降低并发或检查网络稳定性",
            tokens: TIMEOUT_TOKENS,
        },
        NetworkFailure {
            code: "tls_handshake_failed",
            summary: "和服务建立 HTTPS 加密连接失败",
            root_cause: "TLS 握手失败或加密连接中途出错",
            retryable: true,
            suggestion: "和服务建立加密连接时失败，多半是网络不稳或代理、VPN 干扰，可以直接重试；报 wrong version number 的，\
多半是接口地址的 http / https 写反了，或者代理端口不对。",
            tokens: TLS_HANDSHAKE_TOKENS,
        },
        NetworkFailure {
            code: "connection_reset",
            summary: "连接被中途断开",
            root_cause: "连接建立以后被对方或中间的网络设备断开",
            retryable: true,
            suggestion: "连接被中途断开，多半是网络不稳、代理或 VPN 断线、服务端重启，可以直接重试；反复出现请换个网络或检查代理。",
            tokens: CONNECTION_RESET_TOKENS,
        },
    ];
    failures.into_iter().find(|failure| failure.tokens.iter().any(|token| lowered.contains(token)))
}

/// 报错文字里有网络失败的迹象就归到对应的码；没有返回 None。
pub(super) fn classify_network_failure(
    failed_stage: &str,
    job: &JobSnapshot,
    error: &str,
    haystack: &str,
    diagnostics: Option<&OcrProviderDiagnostics>,
    raw_diagnostic: Option<&JobRawDiagnostic>,
) -> Option<JobFailureInfo> {
    let lowered = haystack.to_lowercase();
    let failure = network_failure_for(&lowered)?;
    Some(build_failure(
        failed_stage.to_string(),
        failure.code,
        None,
        failure.summary,
        Some(failure.root_cause.to_string()),
        failure.retryable,
        extract_upstream_host(haystack),
        provider_name(diagnostics),
        Some(failure.suggestion.to_string()),
        select_relevant_log_line(job, error, failure.tokens),
        first_error_excerpt(error, haystack),
        raw_diagnostic.cloned(),
    ))
}

#[cfg(test)]
mod tests {
    use super::network_failure_for;

    fn code(text: &str) -> Option<&'static str> {
        network_failure_for(&text.to_lowercase()).map(|failure| failure.code)
    }

    /// 实际见过或照着各家报错写法拼的样子：标准库、requests、reqwest / rustls，三个系统的 errno。
    #[test]
    fn network_errors_are_told_apart() {
        let cases = [
            // 2026-11-27 用户报的桌面版 macOS（标准库 urllib）
            ("model API still failing after 6 attempts: URLError: <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1006)>", "tls_certificate_untrusted"),
            ("error sending request for url (https://api.anthropic.com/v1/messages): invalid peer certificate: UnknownIssuer", "tls_certificate_untrusted"),
            ("SSLError(SSLCertVerificationError(1, '[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: certificate has expired (_ssl.c:1006)'))", "tls_certificate_untrusted"),
            ("ProxyError('Unable to connect to proxy', OSError('Tunnel connection failed: 407 Proxy Authentication Required'))", "proxy_failed"),
            ("<urlopen error [Errno 8] nodename nor servname provided, or not known>", "dns_resolution_failed"),
            ("NameResolutionError(\"<urllib3.connection.HTTPSConnection>: Failed to resolve 'api.deepseek.com'\")", "dns_resolution_failed"),
            ("<urlopen error [Errno 11001] getaddrinfo failed>", "dns_resolution_failed"),
            ("client error (Connect): dns error: failed to lookup address information: Name or service not known", "dns_resolution_failed"),
            ("<urlopen error [Errno 61] Connection refused>", "connection_refused"),
            ("NewConnectionError('<urllib3.connection.HTTPConnection>: Failed to establish a new connection: [Errno 111] Connection refused')", "connection_refused"),
            ("[WinError 10061] 由于目标计算机积极拒绝，无法连接。", "connection_refused"),
            ("tcp connect error: Connection refused (os error 61)", "connection_refused"),
            ("<urlopen error [Errno 51] Network is unreachable>", "network_unreachable"),
            ("OSError: [Errno 65] No route to host", "network_unreachable"),
            ("TimeoutError: The read operation timed out", "upstream_timeout"),
            ("ReadTimeout: HTTPSConnectionPool(host='api.anthropic.com', port=443): Read timed out. (read timeout=300)", "upstream_timeout"),
            ("_ssl.c:990: The handshake operation timed out", "upstream_timeout"),
            ("ssl.SSLError: [SSL: WRONG_VERSION_NUMBER] wrong version number (_ssl.c:1006)", "tls_handshake_failed"),
            ("SSLEOFError: EOF occurred in violation of protocol (_ssl.c:2427)", "tls_handshake_failed"),
            ("ssl.SSLError: [SSL] record layer failure (_ssl.c:2580)", "tls_handshake_failed"),
            ("ConnectionError: ('Connection aborted.', RemoteDisconnected('Remote end closed connection without response'))", "connection_reset"),
            ("ConnectionResetError: [Errno 54] Connection reset by peer", "connection_reset"),
            ("hyper::Error(IncompleteMessage): connection closed before message completed", "connection_reset"),
        ];
        for (text, expected) in cases {
            assert_eq!(code(text), Some(expected), "{text}");
        }
        assert_eq!(code("HTTP 429 Too Many Requests"), None);
        assert_eq!(code("translation agent stopped: reason=quota_exhausted pages_done=3/11"), None);
    }

    #[test]
    fn certificate_suggestion_follows_the_reason() {
        let expired = network_failure_for("certificate verify failed: certificate has expired").unwrap();
        assert!(expired.suggestion.contains("日期和时间"));
        let name = network_failure_for("invalid peer certificate: notvalidforname").unwrap();
        assert!(name.suggestion.contains("base_url"));
        let issuer = network_failure_for("certificate verify failed: unable to get local issuer certificate").unwrap();
        assert!(issuer.suggestion.contains("代理") && issuer.suggestion.contains("2026.11.23"));
        assert!(!issuer.retryable);
    }
}
