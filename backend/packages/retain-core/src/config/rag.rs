use super::env_vars::env_usize;

const DEFAULT_MAX_CHUNK_CHARS: usize = 1_600;
const DEFAULT_SNIPPET_CHARS: usize = 240;

#[derive(Clone, Debug)]
pub struct RagConfig {
    pub max_chunk_chars: usize,
    pub snippet_chars: usize,
}

impl RagConfig {
    pub fn from_env() -> Self {
        Self {
            max_chunk_chars: env_usize("RUST_API_RAG_MAX_CHUNK_CHARS", DEFAULT_MAX_CHUNK_CHARS),
            snippet_chars: env_usize("RUST_API_RAG_SNIPPET_CHARS", DEFAULT_SNIPPET_CHARS),
        }
    }

    pub fn max_chunk_chars() -> usize {
        Self::from_env().max_chunk_chars
    }

    pub fn snippet_chars() -> usize {
        Self::from_env().snippet_chars
    }
}

impl Default for RagConfig {
    fn default() -> Self {
        Self::from_env()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::env_vars::env_test_lock;

    fn with_env<F>(key: &str, value: Option<&str>, f: F)
    where
        F: FnOnce(),
    {
        let prev = std::env::var(key).ok();
        match value {
            Some(v) => std::env::set_var(key, v),
            None => std::env::remove_var(key),
        }
        f();
        match prev {
            Some(v) => std::env::set_var(key, v),
            None => std::env::remove_var(key),
        }
    }

    #[test]
    fn defaults_match_hardcoded_constants() {
        let _g = env_test_lock();
        with_env("RUST_API_RAG_MAX_CHUNK_CHARS", None, || {
            with_env("RUST_API_RAG_SNIPPET_CHARS", None, || {
                let cfg = RagConfig::from_env();
                assert_eq!(cfg.max_chunk_chars, 1_600);
                assert_eq!(cfg.snippet_chars, 240);
            });
        });
    }

    #[test]
    fn env_overrides_rag_config() {
        let _g = env_test_lock();
        with_env("RUST_API_RAG_MAX_CHUNK_CHARS", Some("2000"), || {
            let cfg = RagConfig::from_env();
            assert_eq!(cfg.max_chunk_chars, 2000);
        });
        with_env("RUST_API_RAG_SNIPPET_CHARS", Some("300"), || {
            let cfg = RagConfig::from_env();
            assert_eq!(cfg.snippet_chars, 300);
        });
    }

    #[test]
    fn invalid_or_zero_falls_back() {
        let _g = env_test_lock();
        with_env("RUST_API_RAG_MAX_CHUNK_CHARS", Some("0"), || {
            let cfg = RagConfig::from_env();
            assert_eq!(cfg.max_chunk_chars, 1_600);
        });
        with_env("RUST_API_RAG_SNIPPET_CHARS", Some("bad"), || {
            let cfg = RagConfig::from_env();
            assert_eq!(cfg.snippet_chars, 240);
        });
    }
}
