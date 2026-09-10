use std::num::NonZeroU64;

use super::env_vars::{env_u32, env_u64};

pub const DEFAULT_UPLOAD_MAX_BYTES: u64 = 512 * 1024 * 1024;

#[derive(Clone, Debug)]
pub struct UploadProcessingConfig {
    pub parse_workers: usize,
    pub repair_workers: usize,
    pub queue_capacity: usize,
    pub queue_wait_ms: u64,
    pub buffer_mib: u32,
}

impl UploadProcessingConfig {
    pub fn from_env() -> Self {
        let defaults = Self::default();
        Self {
            parse_workers: env_u32(
                "RUST_API_UPLOAD_PARSE_WORKERS",
                defaults.parse_workers as u32,
            )
            .clamp(1, 32) as usize,
            repair_workers: env_u32(
                "RUST_API_UPLOAD_REPAIR_WORKERS",
                defaults.repair_workers as u32,
            )
            .clamp(1, 8) as usize,
            queue_capacity: env_u32(
                "RUST_API_UPLOAD_QUEUE_CAPACITY",
                defaults.queue_capacity as u32,
            )
            .min(64) as usize,
            queue_wait_ms: env_u64("RUST_API_UPLOAD_QUEUE_WAIT_MS", defaults.queue_wait_ms)
                .clamp(1, 60_000),
            buffer_mib: env_u32("RUST_API_UPLOAD_BUFFER_MIB", defaults.buffer_mib).clamp(1, 16_384),
        }
    }
}

impl Default for UploadProcessingConfig {
    fn default() -> Self {
        Self {
            parse_workers: std::thread::available_parallelism()
                .map_or(1, |n| n.get())
                .min(4),
            repair_workers: 2,
            queue_capacity: 8,
            queue_wait_ms: 5_000,
            buffer_mib: 512,
        }
    }
}

pub fn effective_upload_max_bytes(configured_max_bytes: u64) -> NonZeroU64 {
    NonZeroU64::new(configured_max_bytes).unwrap_or_else(|| {
        NonZeroU64::new(DEFAULT_UPLOAD_MAX_BYTES).expect("default upload limit is non-zero")
    })
}

#[derive(Clone, Debug)]
pub struct UploadRuntimeConfig {
    pub upload_max_bytes: u64,
    pub upload_max_pages: u32,
}

impl UploadRuntimeConfig {
    pub fn from_env() -> Self {
        Self {
            upload_max_bytes: env_u64("RUST_API_UPLOAD_MAX_BYTES", 0),
            upload_max_pages: env_u32("RUST_API_UPLOAD_MAX_PAGES", 0),
        }
    }

    pub fn desktop_defaults() -> Self {
        Self {
            upload_max_bytes: 0,
            upload_max_pages: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn processing_defaults_bound_workers_queue_and_input_buffers() {
        let config = UploadProcessingConfig::default();
        assert!((1..=4).contains(&config.parse_workers));
        assert_eq!(config.repair_workers, 2);
        assert_eq!(config.queue_capacity, 8);
        assert_eq!(config.queue_wait_ms, 5000);
        assert_eq!(config.buffer_mib, 512);
    }

    #[test]
    fn effective_limit_preserves_non_zero_configuration() {
        assert_eq!(effective_upload_max_bytes(7).get(), 7);
    }

    #[test]
    fn effective_limit_uses_safe_default_for_zero_configuration() {
        assert_eq!(
            effective_upload_max_bytes(0).get(),
            DEFAULT_UPLOAD_MAX_BYTES
        );
    }
}
