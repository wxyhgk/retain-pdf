use serde::{Deserialize, Serialize};

use crate::models::{
    build_job_id, CreateJobInput, OcrInput, RenderInput, ResolvedSourceSpec, RuntimeInput,
    TranslationInput, WorkflowKind,
};

pub const DEFAULT_DEEPSEEK_TRANSLATION_WORKERS: i64 = 1000;
pub const DEFAULT_GENERIC_TRANSLATION_WORKERS: i64 = 4;

pub fn default_deepseek_workers() -> i64 {
    env_workers(
        "RUST_API_DEFAULT_DEEPSEEK_WORKERS",
        DEFAULT_DEEPSEEK_TRANSLATION_WORKERS,
    )
}

pub fn default_generic_workers() -> i64 {
    env_workers(
        "RUST_API_DEFAULT_GENERIC_WORKERS",
        DEFAULT_GENERIC_TRANSLATION_WORKERS,
    )
}

fn env_workers(name: &str, fallback: i64) -> i64 {
    std::env::var(name)
        .ok()
        .and_then(|value| value.trim().parse::<i64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(fallback)
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ResolvedJobSpec {
    pub workflow: WorkflowKind,
    pub job_id: String,
    pub source: ResolvedSourceSpec,
    pub ocr: OcrInput,
    pub translation: TranslationInput,
    pub render: RenderInput,
    pub runtime: RuntimeInput,
}

impl ResolvedJobSpec {
    pub fn from_input(input: CreateJobInput) -> Self {
        let job_id = if input.runtime.job_id.trim().is_empty() {
            build_job_id()
        } else {
            input.runtime.job_id.trim().to_string()
        };
        Self {
            workflow: input.workflow,
            job_id,
            source: ResolvedSourceSpec {
                upload_id: input.source.upload_id.trim().to_string(),
                source_url: input.source.source_url.trim().to_string(),
                artifact_job_id: input.source.artifact_job_id.trim().to_string(),
            },
            ocr: input.ocr,
            translation: input.translation,
            render: input.render,
            runtime: input.runtime,
        }
    }

    pub fn resolved_workers(&self) -> i64 {
        if self.translation.workers > 0 {
            return self.translation.workers;
        }
        let model = self.translation.model.to_lowercase();
        let base = self.translation.base_url.to_lowercase();
        if model.contains("deepseek") || base.contains("deepseek.com") {
            default_deepseek_workers()
        } else {
            default_generic_workers()
        }
    }
}

impl From<CreateJobInput> for ResolvedJobSpec {
    fn from(value: CreateJobInput) -> Self {
        ResolvedJobSpec::from_input(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::env_vars::env_test_lock;
    use crate::models::CreateJobInput;

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
    fn defaults_follow_const_when_env_unset() {
        let _g = env_test_lock();
        with_env("RUST_API_DEFAULT_DEEPSEEK_WORKERS", None, || {
            with_env("RUST_API_DEFAULT_GENERIC_WORKERS", None, || {
                assert_eq!(default_deepseek_workers(), 1000);
                assert_eq!(default_generic_workers(), 4);
                let mut input = CreateJobInput::default();
                input.translation.model = "deepseek-chat".to_string();
                let spec = ResolvedJobSpec::from_input(input);
                assert_eq!(spec.resolved_workers(), 1000);
                let mut input2 = CreateJobInput::default();
                input2.translation.model = "gpt-4".to_string();
                let spec2 = ResolvedJobSpec::from_input(input2);
                assert_eq!(spec2.resolved_workers(), 4);
            });
        });
    }

    #[test]
    fn env_overrides_default_workers() {
        let _g = env_test_lock();
        with_env("RUST_API_DEFAULT_DEEPSEEK_WORKERS", Some("42"), || {
            assert_eq!(default_deepseek_workers(), 42);
            let mut input = CreateJobInput::default();
            input.translation.model = "deepseek-v3".to_string();
            let spec = ResolvedJobSpec::from_input(input);
            assert_eq!(spec.resolved_workers(), 42);
        });
        with_env("RUST_API_DEFAULT_GENERIC_WORKERS", Some("7"), || {
            assert_eq!(default_generic_workers(), 7);
            let mut input = CreateJobInput::default();
            input.translation.model = "openai-gpt".to_string();
            let spec = ResolvedJobSpec::from_input(input);
            assert_eq!(spec.resolved_workers(), 7);
        });
    }

    #[test]
    fn invalid_or_zero_env_falls_back() {
        let _g = env_test_lock();
        with_env("RUST_API_DEFAULT_DEEPSEEK_WORKERS", Some("0"), || {
            assert_eq!(default_deepseek_workers(), 1000);
        });
        with_env(
            "RUST_API_DEFAULT_DEEPSEEK_WORKERS",
            Some("not_a_number"),
            || {
                assert_eq!(default_deepseek_workers(), 1000);
            },
        );
        with_env("RUST_API_DEFAULT_GENERIC_WORKERS", Some("-5"), || {
            assert_eq!(default_generic_workers(), 4);
        });
    }
}
