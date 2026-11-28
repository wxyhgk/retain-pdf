//! 令牌和脱敏（密钥安全，见方案「密钥安全」一节）：
//! - 邀请码、设备令牌、单的凭证都是随机的，库里只存 SHA-256；原文只在生成那一刻给出去一次。
//! - 上游的报错转回客户端、写进日志之前，去掉看起来像 key 的东西，以及我们自己 key 的原文。

use sha2::{Digest, Sha256};

/// `前缀_` + 32 字节随机数的十六进制。
pub fn new_token(prefix: &str) -> String {
    let mut bytes = [0u8; 32];
    getrandom::getrandom(&mut bytes).expect("system random source");
    format!("{prefix}_{}", hex(&bytes))
}

pub fn hash_token(token: &str) -> String {
    hex(&Sha256::digest(token.trim().as_bytes()))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// 去掉 key 的样子：我们自己的 key 原文（`known` 里给的）、`sk-…`、`Bearer …`、`x-api-key: …`。
pub fn redact(text: &str, known: &[String]) -> String {
    let mut out = text.to_string();
    for secret in known.iter().filter(|secret| secret.len() >= 8) {
        out = out.replace(secret.as_str(), "[redacted]");
    }
    for marker in ["Bearer ", "bearer ", "x-api-key: ", "x-api-key\":\"", "sk-"] {
        out = redact_after(&out, marker);
    }
    out
}

/// `marker` 后面连着的一串 key 字符（字母、数字、`-_.`）换成 `[redacted]`。
fn redact_after(text: &str, marker: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(index) = rest.find(marker) {
        out.push_str(&rest[..index + marker.len()]);
        rest = &rest[index + marker.len()..];
        let end = rest
            .char_indices()
            .find(|(_, c)| !(c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.')))
            .map(|(i, _)| i)
            .unwrap_or(rest.len());
        if end >= 8 {
            out.push_str("[redacted]");
            rest = &rest[end..];
        }
    }
    out.push_str(rest);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokens_are_random_and_only_their_hash_is_kept() {
        let (a, b) = (new_token("dev"), new_token("dev"));
        assert_ne!(a, b);
        assert!(a.starts_with("dev_") && a.len() == 4 + 64);
        assert_eq!(hash_token(&a), hash_token(&format!(" {a} ")));
        assert_ne!(hash_token(&a), a);
    }

    #[test]
    fn key_looking_strings_are_redacted() {
        let ours = "zhipu-secret-0123456789".to_string();
        let text = format!(
            "invalid x-api-key: sk-ant-api03-AbCdEf0123456789 header Authorization: Bearer abcdefghijkl0123 key={ours} short sk-ab"
        );
        let cleaned = redact(&text, &[ours.clone()]);
        assert!(!cleaned.contains("AbCdEf0123456789"), "{cleaned}");
        assert!(!cleaned.contains("abcdefghijkl0123"), "{cleaned}");
        assert!(!cleaned.contains(&ours), "{cleaned}");
        assert!(cleaned.contains("short sk-ab"), "太短的不当 key：{cleaned}");
    }
}
