use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::net::{IpAddr, SocketAddr};

pub use retain_core::model_connection::{Deadlines, ModelConnection, Provider, Thinking};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ModelRequest {
    pub operation_id: String,
    pub unit_id: String,
    /// primary, or the single content-protocol repair after a successful response.
    pub purpose: String,
    pub messages: Vec<Message>,
    pub temperature: f64,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub response_format: Option<Value>,
}

fn identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 160
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_.:".contains(&b))
}

impl ModelRequest {
    pub fn validate(&self) -> Result<()> {
        if !identifier(&self.operation_id) || !identifier(&self.unit_id) {
            bail!("invalid operation or unit ID");
        }
        if !matches!(self.purpose.as_str(), "primary" | "repair") {
            bail!("invalid purpose");
        }
        if self.messages.is_empty()
            || self.messages.len() > 64
            || self
                .messages
                .iter()
                .any(|m| !matches!(m.role.as_str(), "system" | "user" | "assistant"))
            || self.messages.iter().map(|m| m.content.len()).sum::<usize>() > 512 * 1024
        {
            bail!("invalid messages");
        }
        if !self.temperature.is_finite()
            || !(0.0..=2.0).contains(&self.temperature)
            || self.max_tokens.is_some_and(|n| n == 0 || n > 32768)
        {
            bail!("invalid generation limits");
        }
        if let Some(format) = &self.response_format {
            if !format.is_object()
                || !matches!(
                    format["type"].as_str(),
                    Some("text" | "json_object" | "json_schema")
                )
                || serde_json::to_vec(format)?.len() > 64 * 1024
            {
                bail!("invalid response format");
            }
        }
        Ok(())
    }
}

pub trait ModelConnectionPolicy {
    fn validate(&self) -> Result<url::Url>;
    fn streaming(&self) -> bool;
    fn body(&self, request: &ModelRequest) -> Value;
    fn addresses(
        &self,
        url: &url::Url,
    ) -> impl std::future::Future<Output = Result<Vec<SocketAddr>>> + Send;
}

impl ModelConnectionPolicy for ModelConnection {
    fn validate(&self) -> Result<url::Url> {
        if !identifier(&self.id)
            || self.model.trim().is_empty()
            || self.model.len() > 256
            || !self.credential_ref.starts_with("cred_")
            || self.credential_ref.len() > 64
            || !self
                .credential_ref
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b"_-".contains(&b))
            || !(1..=100).contains(&self.concurrency)
        {
            bail!("invalid connection configuration");
        }
        for deadline in [
            self.deadlines.queue_ms,
            self.deadlines.connect_ms,
            self.deadlines.idle_ms,
            self.deadlines.total_ms,
        ] {
            if !(1..=900_000).contains(&deadline) {
                bail!("deadline outside supported range");
            }
        }
        if self.provider == Provider::OpenaiCompatible && self.thinking != Thinking::Auto {
            bail!("custom connections require an explicit supported provider policy for thinking");
        }
        if self.provider == Provider::Deepseek && self.thinking != Thinking::Auto {
            bail!(
                "explicit DeepSeek thinking policy is not supported yet; select its model instead"
            );
        }
        let mut url =
            url::Url::parse(&self.base_url).map_err(|_| anyhow::anyhow!("invalid endpoint URL"))?;
        if !matches!(url.scheme(), "http" | "https")
            || url.host_str().is_none()
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
        {
            bail!("endpoint must be HTTP(S), without credentials, query or fragment");
        }
        let base_path = url.path().trim_end_matches('/');
        let path = if base_path.ends_with("/chat/completions") {
            base_path.to_owned()
        } else {
            format!("{base_path}/chat/completions")
        };
        url.set_path(&path);
        Ok(url)
    }

    fn streaming(&self) -> bool {
        self.stream
            .unwrap_or(self.provider != Provider::OpenaiCompatible)
    }

    fn body(&self, request: &ModelRequest) -> Value {
        let mut body = json!({"model":self.model,"messages":request.messages,"temperature":request.temperature,"stream":self.streaming()});
        if self.streaming() {
            body["stream_options"] = json!({"include_usage":true});
        }
        if let Some(limit) = request.max_tokens {
            body["max_tokens"] = json!(limit);
        }
        if let Some(format) = &request.response_format {
            body["response_format"] =
                if self.provider == Provider::Deepseek && format["type"] == "json_schema" {
                    json!({"type":"json_object"})
                } else {
                    format.clone()
                };
        }
        if self.provider == Provider::Qwen {
            match self.thinking {
                Thinking::Off => body["enable_thinking"] = json!(false),
                Thinking::On => body["enable_thinking"] = json!(true),
                Thinking::Auto if self.model.eq_ignore_ascii_case("qwen3.8-flash") => {
                    body["enable_thinking"] = json!(false)
                }
                _ => {}
            }
        }
        body
    }

    /// Resolve and pin the validated addresses, preventing DNS rebinding between
    /// the policy check and reqwest's connection. No environment proxy is used.
    async fn addresses(&self, url: &url::Url) -> Result<Vec<SocketAddr>> {
        let host = url.host_str().unwrap_or("").trim_matches(['[', ']']);
        let addresses: Vec<_> =
            tokio::net::lookup_host((host, url.port_or_known_default().unwrap_or(443)))
                .await
                .map_err(|_| anyhow::anyhow!("endpoint DNS resolution failed"))?
                .collect();
        if addresses.is_empty()
            || (!self.allow_private_endpoint && addresses.iter().any(|a| !public_ip(a.ip())))
        {
            bail!("private/reserved endpoint requires explicit opt-in");
        }
        Ok(addresses)
    }
}

fn public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let [a, b, c, _] = ip.octets();
            !(ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_unspecified()
                || ip.is_multicast()
                || ip.is_broadcast()
                || a == 0
                || a >= 240
                || (a == 100 && (64..=127).contains(&b))
                || (a == 192 && b == 0)
                || (a == 198 && (b == 18 || b == 19 || (b == 51 && c == 100)))
                || (a == 203 && b == 0 && c == 113))
        }
        IpAddr::V6(ip) => ip
            .to_ipv4_mapped()
            .map(|v| public_ip(IpAddr::V4(v)))
            .unwrap_or_else(|| {
                let s = ip.segments();
                // Only global unicast; exclude documentation space.
                s[0] & 0xe000 == 0x2000 && !(s[0] == 0x2001 && s[1] == 0xdb8)
            }),
    }
}
