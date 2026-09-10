//! Application-owned HTTP gateway for the retainpdf-ai sidecar.
use crate::config::AiProxyConfig;
use crate::error::AppError;
use reqwest::{Method, Response};
use serde_json::Value;

pub struct AiGateway {
    client: reqwest::Client,
    base_url: String,
    config: AiProxyConfig,
    status: fn() -> u8,
}

impl AiGateway {
    pub(crate) fn idle_timeout(&self) -> std::time::Duration {
        self.config.idle_timeout
    }

    pub fn new(
        config: &AiProxyConfig,
        fallback_base: String,
        status: fn() -> u8,
    ) -> Result<Self, reqwest::Error> {
        Ok(Self {
            client: reqwest::Client::builder()
                .connect_timeout(config.connect_timeout)
                .build()?,
            base_url: config.service_base.clone().unwrap_or(fallback_base),
            config: config.clone(),
            status,
        })
    }

    async fn send(
        &self,
        method: Method,
        path: &str,
        api_key: &str,
        payload: Option<&Value>,
    ) -> Result<Response, AppError> {
        if (self.status)() == crate::runtime::ai_supervisor::AI_STATUS_UNHEALTHY {
            return Err(AppError::service_unavailable(
                "AI 服务暂不可用（监督器正在重启它），请稍后重试",
            ));
        }
        let mut request = self
            .client
            .request(method, format!("{}{path}", self.base_url))
            .header("X-API-Key", api_key.trim());
        // Configuration replies are finite; do not apply this total deadline to SSE.
        if path == "/v1/runtime-config" {
            request = request.timeout(self.config.runtime_config_timeout);
        }
        if let Some(payload) = payload {
            request = request.json(payload);
        }
        tokio::time::timeout(self.config.header_timeout, request.send())
            .await
            .map_err(|_| AppError::bad_gateway("AI service response headers timed out"))?
            .map_err(|error| {
                AppError::bad_gateway(format!(
                    "AI service unreachable at {}: {error}",
                    self.base_url
                ))
            })
    }

    pub(crate) async fn ask(&self, api_key: &str, payload: &Value) -> Result<Response, AppError> {
        self.send(Method::POST, "/v1/ask", api_key, Some(payload))
            .await
    }
    pub(crate) async fn get_runtime_config(&self, api_key: &str) -> Result<Response, AppError> {
        self.send(Method::GET, "/v1/runtime-config", api_key, None)
            .await
    }
    pub(crate) async fn update_runtime_config(
        &self,
        api_key: &str,
        payload: &Value,
    ) -> Result<Response, AppError> {
        self.send(Method::PUT, "/v1/runtime-config", api_key, Some(payload))
            .await
    }
}
