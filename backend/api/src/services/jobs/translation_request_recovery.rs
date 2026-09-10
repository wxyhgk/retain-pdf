use std::collections::{HashMap, HashSet};
use std::path::Path;

use serde_json::Value;

use crate::models::api::TranslationRequestRecoveryView;
use crate::models::domain::JobSnapshot;
use crate::storage_paths::resolve_translation_request_journal;

const JOURNAL_SCHEMA: &str = "translation_request_journal_v1";
const JOURNAL_SCHEMA_VERSION: u64 = 1;

pub(crate) fn load_translation_request_recovery(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<TranslationRequestRecoveryView> {
    // Legacy stage planners have no database handle. Never mistake absence of
    // a Python journal for permission to retry a Rust-owned request.
    if job
        .request_payload
        .translation
        .execution_connection
        .is_some()
    {
        return Some(model_retry_blocked_view());
    }
    let path = resolve_translation_request_journal(job, data_root)?;
    Some(parse_translation_request_journal(&path))
}

fn model_retry_blocked_view() -> TranslationRequestRecoveryView {
    let mut view = corrupt_view(
        "Rust model recovery requires receipt-preserving retry support; legacy retry is disabled",
    );
    view.status = "blocked".into();
    view.journal_ready = false;
    view
}

pub(crate) fn load_translation_request_recovery_with_db(
    db: &crate::db::Db,
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<TranslationRequestRecoveryView> {
    if job
        .request_payload
        .translation
        .execution_connection
        .is_none()
    {
        return load_translation_request_recovery(job, data_root);
    }
    let summary = match db.model_recovery_summary(&job.job_id) {
        Ok(Some(summary)) => summary,
        Ok(None) => return Some(model_retry_blocked_view()),
        Err(_) => return Some(corrupt_view("Rust model recovery state cannot be read")),
    };
    Some(TranslationRequestRecoveryView {
        status: if summary.ambiguous > 0 { "ambiguous" } else if summary.running > 0 { "running" } else if summary.paused { "paused" } else { "clean" }.into(),
        journal_ready: true,
        unresolved_dispatches: summary.running,
        active_ambiguous_request_keys: summary.ambiguous,
        historical_ambiguous_request_keys: summary.ambiguous,
        requires_confirmation: summary.ambiguous > 0 || summary.running > 0,
        // Acknowledgement alone cannot yet preserve successful receipts in a
        // new job. Do not advertise a recovery operation we cannot execute.
        supported_retry_policies: vec!["block".into()],
        detail: Some("Rust model receipts are preserved; legacy translation retry is disabled until receipt-preserving recovery is available".into()),
    })
}

fn parse_translation_request_journal(path: &Path) -> TranslationRequestRecoveryView {
    let raw = match std::fs::read(path) {
        Ok(raw) => raw,
        Err(_) => return corrupt_view("translation request journal cannot be read"),
    };
    let complete_len = if raw.ends_with(b"\n") {
        raw.len()
    } else {
        raw.iter()
            .rposition(|byte| *byte == b'\n')
            .map_or(0, |index| index + 1)
    };
    let mut open_dispatches: HashMap<String, String> = HashMap::new();
    let mut active_ambiguous_keys: HashSet<String> = HashSet::new();
    let mut historical_ambiguous_keys: HashSet<String> = HashSet::new();

    for raw_line in raw[..complete_len].split(|byte| *byte == b'\n') {
        if raw_line.iter().all(u8::is_ascii_whitespace) {
            continue;
        }
        let event: Value = match serde_json::from_slice(raw_line) {
            Ok(event) => event,
            Err(_) => return corrupt_view("translation request journal contains invalid JSON"),
        };
        if event.get("schema").and_then(Value::as_str) != Some(JOURNAL_SCHEMA)
            || event.get("schema_version").and_then(Value::as_u64) != Some(JOURNAL_SCHEMA_VERSION)
        {
            return corrupt_view("translation request journal contract is unsupported");
        }
        let token = event
            .get("request_token")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let request_key = event
            .get("request_key")
            .and_then(Value::as_str)
            .unwrap_or_default();
        match event.get("event").and_then(Value::as_str) {
            Some("dispatch") if !token.is_empty() && !request_key.is_empty() => {
                open_dispatches.insert(token.to_string(), request_key.to_string());
            }
            Some("terminal") if !token.is_empty() => {
                let resolved_key = open_dispatches
                    .remove(token)
                    .unwrap_or_else(|| request_key.to_string());
                if resolved_key.is_empty() {
                    continue;
                }
                if event.get("outcome").and_then(Value::as_str) == Some("ambiguous") {
                    active_ambiguous_keys.insert(resolved_key.clone());
                    historical_ambiguous_keys.insert(resolved_key);
                } else {
                    // A later terminal result for the same deterministic request
                    // resolves the content-recovery ambiguity, while historical
                    // billing risk remains visible separately.
                    active_ambiguous_keys.remove(&resolved_key);
                    if open_dispatches.values().any(|key| key == &resolved_key) {
                        historical_ambiguous_keys.insert(resolved_key.clone());
                        open_dispatches.retain(|_, key| key != &resolved_key);
                    }
                }
            }
            _ => {}
        }
    }

    active_ambiguous_keys.extend(open_dispatches.values().cloned());
    historical_ambiguous_keys.extend(active_ambiguous_keys.iter().cloned());
    let requires_confirmation = !active_ambiguous_keys.is_empty();
    TranslationRequestRecoveryView {
        status: if requires_confirmation {
            "ambiguous".to_string()
        } else {
            "clean".to_string()
        },
        journal_ready: true,
        unresolved_dispatches: open_dispatches.len() as u64,
        active_ambiguous_request_keys: active_ambiguous_keys.len() as u64,
        historical_ambiguous_request_keys: historical_ambiguous_keys.len() as u64,
        requires_confirmation,
        supported_retry_policies: supported_retry_policies(),
        detail: requires_confirmation.then(|| {
            "translation retry is paused until duplicate-request risk is explicitly accepted"
                .to_string()
        }),
    }
}

fn corrupt_view(detail: &str) -> TranslationRequestRecoveryView {
    TranslationRequestRecoveryView {
        status: "corrupt".to_string(),
        journal_ready: true,
        unresolved_dispatches: 0,
        active_ambiguous_request_keys: 0,
        historical_ambiguous_request_keys: 0,
        requires_confirmation: true,
        supported_retry_policies: vec!["block".to_string()],
        detail: Some(detail.to_string()),
    }
}

fn supported_retry_policies() -> Vec<String> {
    vec!["block".to_string(), "accept_duplicate_risk".to_string()]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_path(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "retain-request-recovery-{name}-{}",
            std::process::id()
        ))
    }

    #[test]
    fn unmatched_dispatch_requires_confirmation_and_torn_tail_is_ignored() {
        let path = test_path("unmatched");
        std::fs::write(
            &path,
            concat!(
                "{\"schema\":\"translation_request_journal_v1\",\"schema_version\":1,",
                "\"event\":\"dispatch\",\"request_token\":\"t1\",\"request_key\":\"k1\"}\n",
                "{\"schema\":\"translation_request_journal_v1\""
            ),
        )
        .expect("write journal");
        let view = parse_translation_request_journal(&path);
        assert_eq!(view.status, "ambiguous");
        assert_eq!(view.unresolved_dispatches, 1);
        assert_eq!(view.active_ambiguous_request_keys, 1);
        assert!(view.requires_confirmation);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn later_success_resolves_active_ambiguity_but_preserves_history() {
        let path = test_path("resolved");
        std::fs::write(
            &path,
            concat!(
                "{\"schema\":\"translation_request_journal_v1\",\"schema_version\":1,\"event\":\"dispatch\",\"request_token\":\"t0\",\"request_key\":\"k1\"}\n",
                "{\"schema\":\"translation_request_journal_v1\",\"schema_version\":1,\"event\":\"dispatch\",\"request_token\":\"t1\",\"request_key\":\"k1\"}\n",
                "{\"schema\":\"translation_request_journal_v1\",\"schema_version\":1,\"event\":\"terminal\",\"request_token\":\"t1\",\"request_key\":\"k1\",\"outcome\":\"ambiguous\"}\n",
                "{\"schema\":\"translation_request_journal_v1\",\"schema_version\":1,\"event\":\"dispatch\",\"request_token\":\"t2\",\"request_key\":\"k1\"}\n",
                "{\"schema\":\"translation_request_journal_v1\",\"schema_version\":1,\"event\":\"terminal\",\"request_token\":\"t2\",\"request_key\":\"k1\",\"outcome\":\"succeeded\"}\n"
            ),
        )
        .expect("write journal");
        let view = parse_translation_request_journal(&path);
        assert_eq!(view.status, "clean");
        assert_eq!(view.active_ambiguous_request_keys, 0);
        assert_eq!(view.historical_ambiguous_request_keys, 1);
        assert_eq!(view.unresolved_dispatches, 0);
        assert!(!view.requires_confirmation);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn corrupt_complete_line_fails_closed() {
        let path = test_path("corrupt");
        std::fs::write(&path, b"{not-json}\n").expect("write journal");
        let view = parse_translation_request_journal(&path);
        assert_eq!(view.status, "corrupt");
        assert!(view.requires_confirmation);
        let _ = std::fs::remove_file(path);
    }
}
