use super::env_vars::{env_string, env_usize};

const DEFAULT_MAX_BYTES: usize = 20 * 1024 * 1024;
const DEFAULT_ALLOWED_MIMES: &str = "image/png,image/jpeg,image/webp";

const ENV_MAX_BYTES: &str = "RUST_API_ASSET_MAX_BYTES";
const ENV_ALLOWED_MIMES: &str = "RUST_API_ASSET_ALLOWED_MIMES";

#[derive(Clone, Debug)]
pub struct AssetConfig {
    pub max_bytes: usize,
    pub allowed_mimes: Vec<String>,
}

impl AssetConfig {
    pub fn from_env() -> Self {
        let max_bytes = env_usize(ENV_MAX_BYTES, DEFAULT_MAX_BYTES);
        let raw = env_string(ENV_ALLOWED_MIMES, DEFAULT_ALLOWED_MIMES);
        let allowed_mimes = raw
            .split(',')
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>();
        // Fallback to default if env yields empty list (e.g. ",,").
        let allowed_mimes = if allowed_mimes.is_empty() {
            DEFAULT_ALLOWED_MIMES
                .split(',')
                .map(|value| value.to_string())
                .collect()
        } else {
            allowed_mimes
        };
        Self {
            max_bytes,
            allowed_mimes,
        }
    }

    pub fn is_allowed(&self, mime: &str) -> bool {
        self.allowed_mimes.iter().any(|value| value == mime)
    }
}

impl Default for AssetConfig {
    fn default() -> Self {
        Self::from_env()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn parses_default_mimes() {
        let _g = ENV_LOCK.lock().unwrap();
        std::env::remove_var(ENV_ALLOWED_MIMES);
        std::env::remove_var(ENV_MAX_BYTES);
        let config = AssetConfig::from_env();
        assert_eq!(config.max_bytes, DEFAULT_MAX_BYTES);
        assert_eq!(
            config.allowed_mimes,
            vec!["image/png", "image/jpeg", "image/webp"]
        );
    }

    #[test]
    fn parses_custom_mimes_with_spaces() {
        let _g = ENV_LOCK.lock().unwrap();
        std::env::remove_var(ENV_MAX_BYTES);
        std::env::set_var(ENV_ALLOWED_MIMES, "image/png, image/svg+xml , image/webp");
        let config = AssetConfig::from_env();
        assert_eq!(
            config.allowed_mimes,
            vec!["image/png", "image/svg+xml", "image/webp"]
        );
        std::env::remove_var(ENV_ALLOWED_MIMES);
    }

    #[test]
    fn parses_custom_max_bytes() {
        let _g = ENV_LOCK.lock().unwrap();
        std::env::remove_var(ENV_ALLOWED_MIMES);
        std::env::set_var(ENV_MAX_BYTES, "1024");
        let config = AssetConfig::from_env();
        assert_eq!(config.max_bytes, 1024);
        std::env::remove_var(ENV_MAX_BYTES);
    }
}
