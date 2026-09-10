//! Background retention/cleanup for unbounded-growth DB state and orphaned
//! upload files.
//!
//! Two independent sweeps, both age + reference based and both disabled by
//! setting their retention env var to `0`:
//!
//! - `events` rows for jobs that have reached a terminal state
//!   (`succeeded` / `failed` / `canceled`) are deleted once older than
//!   `RUST_API_EVENTS_RETENTION_DAYS` (default 30). Jobs that are still
//!   `queued` or `running` are never touched by this, regardless of age.
//! - `uploads` rows (and their `uploads_dir/<upload_id>/` directory on disk)
//!   are deleted once older than `RUST_API_ORPHAN_UPLOAD_RETENTION_HOURS`
//!   (default 48) *and* no row in `jobs` references that `upload_id`.
//!
//! This module only knows about `Db` plus plain paths, not `AppState` — it
//! is wired up from `app::state` (one-shot sweep at startup) and
//! `app::server` (recurring sweep while the server is running).

use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use tracing::{info, warn};

use crate::db::Db;

pub use retain_core::config::CleanupConfig;

/// How often the recurring sweep runs once the server is up. Deliberately
/// coarse: this is maintenance, not something latency-sensitive.
/// Env `RUST_API_CLEANUP_INTERVAL_SECS` (default 21600) via
/// `retain_core::config::env_vars::env_u64` — the interval is env-tunable
/// without rebuilding (see `retain_core::config::CleanupConfig`).
fn cleanup_interval_from_config() -> Duration {
    // Single source: retain_core::config::env_vars::env_u64 (env `RUST_API_CLEANUP_INTERVAL_SECS`, default 21600)
    // Also keep AppConfig facet in sync via CleanupConfig.
    let direct = Duration::from_secs(retain_core::config::env_vars::env_u64(
        "RUST_API_CLEANUP_INTERVAL_SECS",
        21600,
    ));
    let via_config = CleanupConfig::from_env().interval;
    debug_assert_eq!(direct, via_config);
    direct
}

#[derive(Clone, Copy, Debug)]
pub struct RetentionSettings {
    pub events_retention_days: u64,
    pub orphan_upload_retention_hours: u64,
}

impl RetentionSettings {
    pub fn from_env() -> Self {
        Self {
            events_retention_days: env_u64_allow_zero("RUST_API_EVENTS_RETENTION_DAYS", 30),
            orphan_upload_retention_hours: env_u64_allow_zero(
                "RUST_API_ORPHAN_UPLOAD_RETENTION_HOURS",
                48,
            ),
        }
    }
}

/// Same shape as `config::env_vars::env_u64`, except `0` is a legitimate,
/// meaningful value here ("disable this cleanup") rather than "unset", so it
/// must not be filtered out in favor of the fallback.
fn env_u64_allow_zero(name: &str, fallback: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .unwrap_or(fallback)
}

pub fn log_startup_settings(settings: &RetentionSettings) {
    log_startup_settings_with_interval(settings, cleanup_interval_from_config());
}

pub fn log_startup_settings_with_interval(settings: &RetentionSettings, interval: Duration) {
    info!(
        "retention cleanup: events_retention_days={} ({}), orphan_upload_retention_hours={} ({}), sweep_interval_secs={}",
        settings.events_retention_days,
        if settings.events_retention_days == 0 {
            "disabled"
        } else {
            "enabled"
        },
        settings.orphan_upload_retention_hours,
        if settings.orphan_upload_retention_hours == 0 {
            "disabled"
        } else {
            "enabled"
        },
        interval.as_secs(),
    );
}

/// Runs one cleanup sweep (events, then orphaned uploads). Safe to call
/// repeatedly - each call re-evaluates retention windows against the
/// current time, and the underlying deletes are idempotent.
pub fn run_cleanup_once(settings: &RetentionSettings, db: &Db) -> Result<()> {
    if settings.events_retention_days > 0 {
        let deleted = db.cleanup_expired_events(settings.events_retention_days)?;
        if deleted > 0 {
            info!(
                "retention cleanup: deleted {deleted} event row(s) older than {} day(s) for finished jobs",
                settings.events_retention_days
            );
        }
    }

    if settings.orphan_upload_retention_hours > 0 {
        let orphans = db.cleanup_orphaned_uploads(settings.orphan_upload_retention_hours)?;
        if !orphans.is_empty() {
            let mut removed_dirs = 0usize;
            for upload in &orphans {
                if remove_upload_dir(&upload.stored_path) {
                    removed_dirs += 1;
                }
            }
            info!(
                "retention cleanup: deleted {} orphaned upload record(s) older than {} hour(s), removed {removed_dirs} on-disk upload directory(ies)",
                orphans.len(),
                settings.orphan_upload_retention_hours
            );
        }
    }

    Ok(())
}

/// `stored_path` is `uploads_dir/<upload_id>/<filename>` (see
/// `services/uploads/staging.rs`), so its parent is
/// exactly the per-upload directory to remove.
fn remove_upload_dir(stored_path: &str) -> bool {
    let Some(dir) = Path::new(stored_path).parent() else {
        return false;
    };
    match std::fs::remove_dir_all(dir) {
        Ok(()) => true,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Err(error) => {
            warn!(
                "retention cleanup: failed to remove orphaned upload dir {}: {error}",
                dir.display()
            );
            false
        }
    }
}

/// Spawns the recurring cleanup sweep on the current Tokio runtime. Intended
/// to be called once, right after the server starts listening; the returned
/// handle runs for the lifetime of the process (best-effort maintenance, not
/// joined on shutdown).
pub fn spawn_periodic_cleanup(
    settings: RetentionSettings,
    db: Arc<Db>,
) -> tokio::task::JoinHandle<()> {
    spawn_periodic_cleanup_with_interval(settings, db, cleanup_interval_from_config())
}

/// Same as `spawn_periodic_cleanup` but with an explicit interval (e.g. from `AppConfig::cleanup`).
/// This is the AppConfig-wired entry point; the zero-arg version above remains as
/// a convenience that reads `RUST_API_CLEANUP_INTERVAL_SECS` directly.
pub fn spawn_periodic_cleanup_with_interval(
    settings: RetentionSettings,
    db: Arc<Db>,
    interval_duration: Duration,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(interval_duration);
        // The first tick fires immediately; skip it since a startup sweep
        // already ran in `app::state::build_state`.
        interval.tick().await;
        loop {
            interval.tick().await;
            if let Err(error) = run_cleanup_once(&settings, &db) {
                warn!("retention cleanup sweep failed: {error:#}");
            }
        }
    })
}
