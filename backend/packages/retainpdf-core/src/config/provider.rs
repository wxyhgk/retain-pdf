use std::path::PathBuf;
use std::time::Duration;

use super::env_vars::{env_bool, env_string, env_u16, env_u64, env_usize};

/// Shared escape hatch for self-hosted/local OCR & LLM endpoints (e.g. Ollama on
/// localhost). When unset, client-supplied provider `base_url` values pointing at
/// loopback/link-local/private-network hosts are rejected to prevent SSRF /
/// credential-exfiltration via a spoofed `base_url`.
const ALLOW_PRIVATE_PROVIDER_URLS_ENV: &str = "RUST_API_ALLOW_PRIVATE_PROVIDER_URLS";

/// 密钥校验（MinerU、Paddle、翻译接口、余额）共用的超时，秒。要比网页端等的 30 秒短，
/// 不然对端挂起时前端先放弃、后端还在等。没设时认旧名 `RUST_API_DEEPSEEK_PROBE_TIMEOUT_SECS`。
const PROVIDER_PROBE_TIMEOUT_ENV: &str = "RUST_API_PROVIDER_PROBE_TIMEOUT_SECS";
const LEGACY_DEEPSEEK_PROBE_TIMEOUT_ENV: &str = "RUST_API_DEEPSEEK_PROBE_TIMEOUT_SECS";
const DEFAULT_PROVIDER_PROBE_TIMEOUT_SECS: u64 = 20;

fn provider_probe_timeout_secs() -> u64 {
    env_u64(
        PROVIDER_PROBE_TIMEOUT_ENV,
        env_u64(LEGACY_DEEPSEEK_PROBE_TIMEOUT_ENV, DEFAULT_PROVIDER_PROBE_TIMEOUT_SECS),
    )
}

/// 每家 OCR 服务商建任务时对上传文件的上限，按服务商 key 存。从服务商清单的 `limits` 读，
/// 环境变量覆盖（变量名也写在清单里，例如 `RUST_API_MINERU_MAX_PAGES`）。清单里没写 `limits` 的不限。
#[derive(Clone, Debug)]
pub struct ProviderLimitsConfig {
    by_provider: std::collections::BTreeMap<String, super::provider_config::OcrUploadLimits>,
}

#[derive(Clone, Debug)]
pub struct ProviderRuntimeConfig {
    pub ocr_provider_config_path: PathBuf,
    /// 密钥校验接口的超时（秒），三家共用；正式跑任务用各家自己的超时，不看它。
    pub probe_timeout_secs: u64,
    pub mineru: MineruRuntimeConfig,
    pub paddle: PaddleRuntimeConfig,
    pub deepseek: DeepSeekRuntimeConfig,
}

#[derive(Clone, Debug)]
pub struct MineruRuntimeConfig {
    pub default_base_url: String,
    pub request_timeout_secs: u64,
    /// 单次上传的基础超时；实际值按文件大小放宽，见 [`upload_timeout_for_bytes`]。
    pub upload_timeout_secs: u64,
    pub upload_timeout_per_mb_secs: u64,
    pub upload_timeout_max_secs: u64,
    /// 上传的重试次数。轮询、bundle 下载、bundle 就绪本来都有各自的重试上限，
    /// **只有上传没有** —— 一次传输抖动就让整个任务在 OCR 阶段死掉。
    /// 实测：最近 4 次失败里 3 次是 `failed to upload file`（timeout/ocr）。
    pub upload_retry_attempts: usize,
    pub upload_retry_base_delay_secs: u64,
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
    pub allow_private_urls: bool,
}

#[derive(Clone, Debug)]
pub struct PaddleRuntimeConfig {
    pub default_base_url: String,
    pub request_timeout_secs: u64,
    /// 本地文件提交（multipart 上传）单独的超时，不能复用 `request_timeout_secs`：
    /// 上行只有 25–60 KB/s 时 5.2 MB 就要 80 多秒，120s 的请求超时会把 3–7 MB
    /// 以上的文件全部判死。实际值按文件大小放宽，见 [`upload_timeout_for_bytes`]。
    pub upload_timeout_secs: u64,
    pub upload_timeout_per_mb_secs: u64,
    pub upload_timeout_max_secs: u64,
    pub download_timeout_secs: u64,
    pub request_retry_attempts: usize,
    pub request_retry_base_delay_millis: u64,
    pub max_input_images: u16,
    pub allow_private_urls: bool,
}

#[derive(Clone, Debug)]
pub struct DeepSeekRuntimeConfig {
    pub default_base_url: String,
    pub balance_url: String,
    pub probe_timeout_secs: u64,
    pub allow_private_urls: bool,
}

impl ProviderLimitsConfig {
    pub fn from_env() -> Self {
        let by_provider = super::provider_config::ocr_provider_definitions()
            .into_iter()
            .filter_map(|(key, definition)| {
                super::provider_config::upload_limits_from_definition(&definition)
                    .map(|limits| (key, limits))
            })
            .collect();
        Self { by_provider }
    }

    /// 这家服务商的上限；清单里没写 `limits` 返回 `None`（不限）。
    pub fn for_provider(&self, provider: &str) -> Option<super::provider_config::OcrUploadLimits> {
        self.by_provider
            .get(&provider.trim().to_ascii_lowercase())
            .copied()
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
            ocr_provider_config_path: super::provider_config::ocr_provider_config_path(),
            probe_timeout_secs: provider_probe_timeout_secs(),
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
            upload_timeout_per_mb_secs: env_u64("RUST_API_MINERU_UPLOAD_TIMEOUT_PER_MB_SECS", 45),
            upload_timeout_max_secs: env_u64("RUST_API_MINERU_UPLOAD_TIMEOUT_MAX_SECS", 1800),
            // 3 次：和 paddle 的 request_retry_attempts 一致。上传超时按文件大小在
            // 300–1800s 之间，所以小文件最坏 3×300s + 退避 ≈ 15 分钟才放弃 —— 后台
            // 任务可以接受，而且传输错误通常在连接阶段就快速失败，不会真的每次都
            // 耗满；用户等不及可以取消，取消会直接中断正在进行的上传。
            upload_retry_attempts: env_usize("RUST_API_MINERU_UPLOAD_RETRY_ATTEMPTS", 3),
            upload_retry_base_delay_secs: env_u64("RUST_API_MINERU_UPLOAD_RETRY_BASE_DELAY_SECS", 2),
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
            allow_private_urls: env_bool(ALLOW_PRIVATE_PROVIDER_URLS_ENV, false),
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
            upload_timeout_secs: env_u64("RUST_API_PADDLE_UPLOAD_TIMEOUT_SECS", 300),
            upload_timeout_per_mb_secs: env_u64("RUST_API_PADDLE_UPLOAD_TIMEOUT_PER_MB_SECS", 45),
            upload_timeout_max_secs: env_u64("RUST_API_PADDLE_UPLOAD_TIMEOUT_MAX_SECS", 1800),
            download_timeout_secs: env_u64("RUST_API_PADDLE_DOWNLOAD_TIMEOUT_SECS", 300),
            request_retry_attempts: env_usize("RUST_API_PADDLE_REQUEST_RETRY_ATTEMPTS", 3),
            request_retry_base_delay_millis: env_u64(
                "RUST_API_PADDLE_REQUEST_RETRY_BASE_DELAY_MILLIS",
                500,
            ),
            max_input_images: env_u16("RUST_API_PADDLE_MAX_INPUT_IMAGES", 999),
            allow_private_urls: env_bool(ALLOW_PRIVATE_PROVIDER_URLS_ENV, false),
        }
    }
}

impl MineruRuntimeConfig {
    pub fn upload_timeout_for_bytes(&self, file_bytes: u64) -> Duration {
        upload_timeout_for_bytes(
            self.upload_timeout_secs,
            self.upload_timeout_per_mb_secs,
            self.upload_timeout_max_secs,
            file_bytes,
        )
    }
}

impl PaddleRuntimeConfig {
    pub fn upload_timeout_for_bytes(&self, file_bytes: u64) -> Duration {
        upload_timeout_for_bytes(
            self.upload_timeout_secs,
            self.upload_timeout_per_mb_secs,
            self.upload_timeout_max_secs,
            file_bytes,
        )
    }
}

/// 上传超时 = 基础值 + 每 MB 若干秒，封顶。
///
/// 默认 300s + 45s/MB：45s/MB 约等于 23 KB/s，比实测最慢的上行（~25 KB/s）还宽一点。
/// 于是 5 MB → 525s、20 MB → 1200s，100 MB 封顶 1800s。超时设长是因为取消
/// 已经能直接中断上传（ocr_flow 里 select 了取消信号），不再需要靠超时兜底止损。
/// 上限小于基础值时按基础值算 —— 配错上限不该把超时缩到比默认还短。
pub fn upload_timeout_for_bytes(
    base_secs: u64,
    per_mb_secs: u64,
    max_secs: u64,
    file_bytes: u64,
) -> Duration {
    const MB: u64 = 1024 * 1024;
    let megabytes = file_bytes.div_ceil(MB);
    let scaled = base_secs.saturating_add(per_mb_secs.saturating_mul(megabytes));
    Duration::from_secs(scaled.min(max_secs.max(base_secs)))
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
            // 和 `ProviderRuntimeConfig::probe_timeout_secs` 同一个值（同一套环境变量）。
            probe_timeout_secs: provider_probe_timeout_secs(),
            allow_private_urls: env_bool(ALLOW_PRIVATE_PROVIDER_URLS_ENV, false),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::upload_timeout_for_bytes;

    /// 新名优先，没设新名时认 DeepSeek 的旧名，都没设是 20 秒。
    #[test]
    fn probe_timeout_prefers_the_shared_name_and_keeps_the_old_one() {
        use super::super::env_vars::env_test_lock;
        let _guard = env_test_lock();
        let clear = || {
            std::env::remove_var("RUST_API_PROVIDER_PROBE_TIMEOUT_SECS");
            std::env::remove_var("RUST_API_DEEPSEEK_PROBE_TIMEOUT_SECS");
        };
        clear();
        assert_eq!(super::provider_probe_timeout_secs(), 20);
        std::env::set_var("RUST_API_DEEPSEEK_PROBE_TIMEOUT_SECS", "12");
        assert_eq!(super::provider_probe_timeout_secs(), 12);
        std::env::set_var("RUST_API_PROVIDER_PROBE_TIMEOUT_SECS", "8");
        assert_eq!(super::provider_probe_timeout_secs(), 8);
        assert_eq!(super::DeepSeekRuntimeConfig::from_env().probe_timeout_secs, 8);
        assert_eq!(super::ProviderRuntimeConfig::from_env().probe_timeout_secs, 8);
        clear();
    }
    use std::time::Duration;

    const MB: u64 = 1024 * 1024;

    /// 5.2 MB 在 25–60 KB/s 上行下要 82s 以上，旧的 120s 一刀切只够勉强过；
    /// 按大小放宽之后得留出明显余量。
    #[test]
    fn upload_timeout_scales_with_file_size() {
        assert_eq!(upload_timeout_for_bytes(300, 45, 1800, 0), Duration::from_secs(300));
        // 不足 1 MB 也按 1 MB 算
        assert_eq!(upload_timeout_for_bytes(300, 45, 1800, 1), Duration::from_secs(345));
        // 5.2 MB → 向上取整 6 MB
        assert_eq!(
            upload_timeout_for_bytes(300, 45, 1800, 5 * MB + MB / 5),
            Duration::from_secs(570)
        );
    }

    #[test]
    fn upload_timeout_is_capped_but_never_below_base() {
        assert_eq!(
            upload_timeout_for_bytes(300, 45, 1800, 100 * MB),
            Duration::from_secs(1800)
        );
        // 上限配得比基础值还小：按基础值算
        assert_eq!(
            upload_timeout_for_bytes(300, 45, 60, 10 * MB),
            Duration::from_secs(300)
        );
        assert_eq!(
            upload_timeout_for_bytes(u64::MAX, u64::MAX, u64::MAX, u64::MAX),
            Duration::from_secs(u64::MAX)
        );
    }
}
