use super::env_vars::{env_string, env_u16, env_u32, env_u64, env_usize};

#[derive(Clone, Debug)]
pub struct ProviderLimitsConfig {
    pub mineru_max_bytes: u64,
    pub mineru_max_pages: u32,
    pub paddle_max_bytes: u64,
    pub paddle_max_pages: u32,
}

#[derive(Clone, Debug)]
pub struct ProviderRuntimeConfig {
    pub mineru: MineruRuntimeConfig,
    pub paddle: PaddleRuntimeConfig,
    pub deepseek: DeepSeekRuntimeConfig,
}

#[derive(Clone, Debug)]
pub struct MineruRuntimeConfig {
    pub default_base_url: String,
    pub request_timeout_secs: u64,
    pub upload_timeout_secs: u64,
    pub download_timeout_secs: u64,
    pub poll_retry_limit: usize,
    pub poll_retry_base_delay_secs: u64,
    pub poll_retry_max_delay_secs: u64,
    pub bundle_download_retry_limit: usize,
    pub bundle_download_base_delay_secs: u64,
    pub bundle_ready_retry_limit: usize,
    pub bundle_ready_base_delay_secs: u64,
    pub bundle_ready_timeout_cap_secs: u64,
    pub bundle_retry_max_delay_secs: u64,
    pub waiting_file_grace_secs: u64,
}

#[derive(Clone, Debug)]
pub struct PaddleRuntimeConfig {
    pub default_base_url: String,
    pub request_timeout_secs: u64,
    pub download_timeout_secs: u64,
    pub request_retry_attempts: usize,
    pub request_retry_base_delay_millis: u64,
    pub max_input_images: u16,
}

#[derive(Clone, Debug)]
pub struct DeepSeekRuntimeConfig {
    pub default_base_url: String,
    pub balance_url: String,
    pub probe_timeout_secs: u64,
}

impl ProviderLimitsConfig {
    pub fn from_env() -> Self {
        Self {
            mineru_max_bytes: env_u64("RUST_API_MINERU_MAX_BYTES", 200 * 1024 * 1024),
            mineru_max_pages: env_u32("RUST_API_MINERU_MAX_PAGES", 600),
            paddle_max_bytes: env_u64("RUST_API_PADDLE_MAX_BYTES", 100 * 1024 * 1024),
            paddle_max_pages: env_u32("RUST_API_PADDLE_MAX_PAGES", 999),
        }
    }
}

impl Default for ProviderLimitsConfig {
    fn default() -> Self {
        Self::from_env()
    }
}

impl ProviderRuntimeConfig {
    pub fn from_env() -> Self {
        Self {
            mineru: MineruRuntimeConfig::from_env(),
            paddle: PaddleRuntimeConfig::from_env(),
            deepseek: DeepSeekRuntimeConfig::from_env(),
        }
    }
}

impl Default for ProviderRuntimeConfig {
    fn default() -> Self {
        Self::from_env()
    }
}

impl MineruRuntimeConfig {
    pub fn from_env() -> Self {
        Self {
            default_base_url: env_string("RUST_API_MINERU_BASE_URL", "https://mineru.net"),
            request_timeout_secs: env_u64("RUST_API_MINERU_REQUEST_TIMEOUT_SECS", 120),
            upload_timeout_secs: env_u64("RUST_API_MINERU_UPLOAD_TIMEOUT_SECS", 300),
            download_timeout_secs: env_u64("RUST_API_MINERU_DOWNLOAD_TIMEOUT_SECS", 300),
            poll_retry_limit: env_usize("RUST_API_MINERU_POLL_RETRY_LIMIT", 5),
            poll_retry_base_delay_secs: env_u64("RUST_API_MINERU_POLL_RETRY_BASE_DELAY_SECS", 2),
            poll_retry_max_delay_secs: env_u64("RUST_API_MINERU_POLL_RETRY_MAX_DELAY_SECS", 10),
            bundle_download_retry_limit: env_usize(
                "RUST_API_MINERU_BUNDLE_DOWNLOAD_RETRY_LIMIT",
                8,
            ),
            bundle_download_base_delay_secs: env_u64(
                "RUST_API_MINERU_BUNDLE_DOWNLOAD_BASE_DELAY_SECS",
                2,
            ),
            bundle_ready_retry_limit: env_usize("RUST_API_MINERU_BUNDLE_READY_RETRY_LIMIT", 8),
            bundle_ready_base_delay_secs: env_u64(
                "RUST_API_MINERU_BUNDLE_READY_BASE_DELAY_SECS",
                2,
            ),
            bundle_ready_timeout_cap_secs: env_u64(
                "RUST_API_MINERU_BUNDLE_READY_TIMEOUT_CAP_SECS",
                120,
            ),
            bundle_retry_max_delay_secs: env_u64("RUST_API_MINERU_BUNDLE_RETRY_MAX_DELAY_SECS", 12),
            waiting_file_grace_secs: env_u64("RUST_API_MINERU_WAITING_FILE_GRACE_SECS", 90),
        }
    }
}

impl PaddleRuntimeConfig {
    pub fn from_env() -> Self {
        Self {
            default_base_url: env_string(
                "RUST_API_PADDLE_BASE_URL",
                "https://paddleocr.aistudio-app.com",
            ),
            request_timeout_secs: env_u64("RUST_API_PADDLE_REQUEST_TIMEOUT_SECS", 120),
            download_timeout_secs: env_u64("RUST_API_PADDLE_DOWNLOAD_TIMEOUT_SECS", 300),
            request_retry_attempts: env_usize("RUST_API_PADDLE_REQUEST_RETRY_ATTEMPTS", 3),
            request_retry_base_delay_millis: env_u64(
                "RUST_API_PADDLE_REQUEST_RETRY_BASE_DELAY_MILLIS",
                500,
            ),
            max_input_images: env_u16("RUST_API_PADDLE_MAX_INPUT_IMAGES", 999),
        }
    }
}

impl DeepSeekRuntimeConfig {
    pub fn from_env() -> Self {
        Self {
            default_base_url: env_string(
                "RUST_API_DEEPSEEK_BASE_URL",
                "https://api.deepseek.com/v1",
            ),
            balance_url: env_string(
                "RUST_API_DEEPSEEK_BALANCE_URL",
                "https://api.deepseek.com/user/balance",
            ),
            probe_timeout_secs: env_u64("RUST_API_DEEPSEEK_PROBE_TIMEOUT_SECS", 20),
        }
    }
}
