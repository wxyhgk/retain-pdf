use serde_json::Value;

use crate::error::AppError;
use crate::models::domain::{CreateJobInput, ResolvedJobSpec};

pub(super) fn apply_retry_overrides(
    input: &mut CreateJobInput,
    overrides: &Value,
) -> Result<(), AppError> {
    apply_retry_overrides_to_sections(
        overrides,
        |patch| {
            let switch = ocr_secret_source_switch(&patch);
            let patched = merge_json(to_json_value(&input.ocr)?, patch)?;
            input.ocr = serde_json::from_value(patched)
                .map_err(|err| AppError::bad_request(format!("invalid ocr overrides: {err}")))?;
            apply_ocr_secret_source_switch(&mut input.ocr, switch);
            Ok(())
        },
        |patch| {
            let switch = translation_secret_source_switch(&patch);
            let patched = merge_json(to_json_value(&input.translation)?, patch)?;
            input.translation = serde_json::from_value(patched).map_err(|err| {
                AppError::bad_request(format!("invalid translation overrides: {err}"))
            })?;
            apply_translation_secret_source_switch(
                &mut input.translation.api_key,
                &mut input.translation.credential_ref,
                switch,
            );
            Ok(())
        },
        |patch| {
            let patched = merge_json(to_json_value(&input.render)?, patch)?;
            input.render = serde_json::from_value(patched)
                .map_err(|err| AppError::bad_request(format!("invalid render overrides: {err}")))?;
            Ok(())
        },
        |patch| {
            let patched = merge_json(to_json_value(&input.runtime)?, patch)?;
            input.runtime = serde_json::from_value(patched).map_err(|err| {
                AppError::bad_request(format!("invalid runtime overrides: {err}"))
            })?;
            input.runtime.job_id.clear();
            Ok(())
        },
    )
}

pub(super) fn apply_retry_overrides_to_resolved_spec(
    spec: &mut ResolvedJobSpec,
    overrides: &Value,
) -> Result<(), AppError> {
    apply_retry_overrides_to_sections(
        overrides,
        |patch| {
            let switch = ocr_secret_source_switch(&patch);
            let patched = merge_json(to_json_value(&spec.ocr)?, patch)?;
            spec.ocr = serde_json::from_value(patched)
                .map_err(|err| AppError::bad_request(format!("invalid ocr overrides: {err}")))?;
            apply_ocr_secret_source_switch(&mut spec.ocr, switch);
            Ok(())
        },
        |patch| {
            let switch = translation_secret_source_switch(&patch);
            let patched = merge_json(to_json_value(&spec.translation)?, patch)?;
            spec.translation = serde_json::from_value(patched).map_err(|err| {
                AppError::bad_request(format!("invalid translation overrides: {err}"))
            })?;
            apply_translation_secret_source_switch(
                &mut spec.translation.api_key,
                &mut spec.translation.credential_ref,
                switch,
            );
            Ok(())
        },
        |patch| {
            let patched = merge_json(to_json_value(&spec.render)?, patch)?;
            spec.render = serde_json::from_value(patched)
                .map_err(|err| AppError::bad_request(format!("invalid render overrides: {err}")))?;
            Ok(())
        },
        |patch| {
            let patched = merge_json(to_json_value(&spec.runtime)?, patch)?;
            spec.runtime = serde_json::from_value(patched).map_err(|err| {
                AppError::bad_request(format!("invalid runtime overrides: {err}"))
            })?;
            Ok(())
        },
    )
}

#[derive(Clone, Copy)]
enum TranslationSecretSourceSwitch {
    Keep,
    Inline,
    Reference,
}

#[derive(Clone, Copy)]
enum OcrSecretSourceSwitch {
    Keep,
    Inline,
    Reference,
}

fn ocr_secret_source_switch(patch: &Value) -> OcrSecretSourceSwitch {
    let Some(object) = patch.as_object() else {
        return OcrSecretSourceSwitch::Keep;
    };
    let inline = ["mineru_token", "paddle_token"]
        .into_iter()
        .any(|key| non_empty_string_field(object, key))
        || object
            .get("options")
            .and_then(Value::as_object)
            .is_some_and(|options| {
                ["credential", "token", "api_key"]
                    .into_iter()
                    .any(|key| non_empty_string_field(options, key))
            });
    let reference = non_empty_string_field(object, "credential_ref");
    match (inline, reference) {
        (true, false) if !object.contains_key("credential_ref") => OcrSecretSourceSwitch::Inline,
        (false, true)
            if !object.contains_key("mineru_token")
                && !object.contains_key("paddle_token")
                && !object.contains_key("options") =>
        {
            OcrSecretSourceSwitch::Reference
        }
        _ => OcrSecretSourceSwitch::Keep,
    }
}

fn non_empty_string_field(object: &serde_json::Map<String, Value>, key: &str) -> bool {
    object
        .get(key)
        .and_then(Value::as_str)
        .is_some_and(|value| !value.trim().is_empty())
}

fn apply_ocr_secret_source_switch(
    ocr: &mut crate::models::request::OcrInput,
    switch: OcrSecretSourceSwitch,
) {
    match switch {
        OcrSecretSourceSwitch::Keep => {}
        OcrSecretSourceSwitch::Inline => ocr.credential_ref.clear(),
        OcrSecretSourceSwitch::Reference => {
            ocr.mineru_token.clear();
            ocr.paddle_token.clear();
            for key in ["credential", "token", "api_key"] {
                ocr.options.remove(key);
            }
        }
    }
}

pub(super) fn discard_ocr_secret_sources(ocr: &mut crate::models::request::OcrInput) {
    ocr.credential_ref.clear();
    ocr.mineru_token.clear();
    ocr.paddle_token.clear();
    for key in ["credential", "token", "api_key"] {
        ocr.options.remove(key);
    }
}

pub(super) fn discard_translation_secret_sources(
    translation: &mut crate::models::request::TranslationInput,
) {
    translation.api_key.clear();
    translation.credential_ref.clear();
}

fn translation_secret_source_switch(patch: &Value) -> TranslationSecretSourceSwitch {
    let Some(object) = patch.as_object() else {
        return TranslationSecretSourceSwitch::Keep;
    };
    let inline = object
        .get("api_key")
        .and_then(Value::as_str)
        .is_some_and(|value| !value.trim().is_empty());
    let reference = object
        .get("credential_ref")
        .and_then(Value::as_str)
        .is_some_and(|value| !value.trim().is_empty());
    match (inline, reference) {
        (true, false) if !object.contains_key("credential_ref") => {
            TranslationSecretSourceSwitch::Inline
        }
        (false, true) if !object.contains_key("api_key") => {
            TranslationSecretSourceSwitch::Reference
        }
        _ => TranslationSecretSourceSwitch::Keep,
    }
}

fn apply_translation_secret_source_switch(
    api_key: &mut String,
    credential_ref: &mut String,
    switch: TranslationSecretSourceSwitch,
) {
    match switch {
        TranslationSecretSourceSwitch::Keep => {}
        TranslationSecretSourceSwitch::Inline => credential_ref.clear(),
        TranslationSecretSourceSwitch::Reference => api_key.clear(),
    }
}

fn apply_retry_overrides_to_sections(
    overrides: &Value,
    mut apply_ocr: impl FnMut(Value) -> Result<(), AppError>,
    mut apply_translation: impl FnMut(Value) -> Result<(), AppError>,
    mut apply_render: impl FnMut(Value) -> Result<(), AppError>,
    mut apply_runtime: impl FnMut(Value) -> Result<(), AppError>,
) -> Result<(), AppError> {
    if overrides.is_null() {
        return Ok(());
    }
    let Some(object) = overrides.as_object() else {
        return Err(AppError::bad_request("overrides must be a JSON object"));
    };
    for (section, patch) in object {
        match section.as_str() {
            "ocr" => apply_ocr(patch.clone())?,
            "translation" => apply_translation(patch.clone())?,
            "render" => apply_render(patch.clone())?,
            "runtime" => apply_runtime(patch.clone())?,
            other => {
                return Err(AppError::bad_request(format!(
                    "unsupported overrides section: {other}"
                )));
            }
        }
    }
    Ok(())
}

fn to_json_value<T: serde::Serialize>(value: &T) -> Result<Value, AppError> {
    serde_json::to_value(value)
        .map_err(|err| AppError::internal(format!("failed to encode retry override base: {err}")))
}

fn merge_json(mut base: Value, patch: Value) -> Result<Value, AppError> {
    let Some(base_object) = base.as_object_mut() else {
        return Err(AppError::internal("override base is not an object"));
    };
    let Some(patch_object) = patch.as_object() else {
        return Err(AppError::bad_request(
            "override sections must be JSON objects",
        ));
    };
    for (key, value) in patch_object {
        base_object.insert(key.clone(), value.clone());
    }
    Ok(base)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retry_override_can_migrate_inline_secret_to_credential_reference() {
        let mut input = CreateJobInput::default();
        input.translation.api_key = "sk-legacy".to_string();

        apply_retry_overrides(
            &mut input,
            &serde_json::json!({
                "translation": {
                    "credential_ref": "cred_translation_primary",
                    "model": "deepseek-chat",
                    "base_url": "https://api.deepseek.com/v1"
                }
            }),
        )
        .expect("apply retry overrides");

        assert!(input.translation.api_key.is_empty());
        assert_eq!(input.translation.credential_ref, "cred_translation_primary");
    }

    #[test]
    fn retry_override_can_temporarily_fall_back_to_inline_secret() {
        let mut input = CreateJobInput::default();
        input.translation.credential_ref = "cred_translation_primary".to_string();

        apply_retry_overrides(
            &mut input,
            &serde_json::json!({"translation": {"api_key": "sk-temporary"}}),
        )
        .expect("apply retry overrides");

        assert_eq!(input.translation.api_key, "sk-temporary");
        assert!(input.translation.credential_ref.is_empty());
    }

    #[test]
    fn ocr_retry_override_can_switch_reference_to_inline_compatibility_token() {
        let mut input = CreateJobInput::default();
        input.ocr.provider = "paddle".to_string();
        input.ocr.credential_ref = "cred_ocr_primary".to_string();

        apply_retry_overrides(
            &mut input,
            &serde_json::json!({"ocr": {"paddle_token": "paddle-temporary"}}),
        )
        .expect("apply OCR retry inline override");

        assert_eq!(input.ocr.paddle_token, "paddle-temporary");
        assert!(input.ocr.credential_ref.is_empty());
    }

    #[test]
    fn ocr_retry_override_can_migrate_legacy_inline_secret_to_reference() {
        let mut input = CreateJobInput::default();
        input.ocr.mineru_token = "mineru-legacy".to_string();
        input.ocr.options.insert(
            "credential".to_string(),
            Value::String("configured-legacy".to_string()),
        );

        apply_retry_overrides(
            &mut input,
            &serde_json::json!({"ocr": {"credential_ref": "cred_ocr_primary"}}),
        )
        .expect("apply OCR retry reference override");

        assert_eq!(input.ocr.credential_ref, "cred_ocr_primary");
        assert!(input.ocr.mineru_token.is_empty());
        assert!(input.ocr.paddle_token.is_empty());
        assert!(!input.ocr.options.contains_key("credential"));
    }
}
