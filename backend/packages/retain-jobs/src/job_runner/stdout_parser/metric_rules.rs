use once_cell::sync::Lazy;
use regex::Regex;

use crate::models::domain::JobSnapshot;

use super::job_artifacts_mut;

static PAGES_PROCESSED_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^pages processed:\s*(\d+)$").unwrap());
static TRANSLATED_ITEMS_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^translated items:\s*(\d+)$").unwrap());
static TRANSLATE_TIME_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^translation time:\s*([0-9.]+)s$").unwrap());
static SAVE_TIME_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^(?:render\+save time|save time):\s*([0-9.]+)s$").unwrap());
static TOTAL_TIME_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^total time:\s*([0-9.]+)s$").unwrap());

pub(super) fn apply_metric_line(job: &mut JobSnapshot, line: &str) {
    if let Some(caps) = PAGES_PROCESSED_RE.captures(line) {
        job_artifacts_mut(job).pages_processed = caps[1].parse::<i64>().ok();
    }
    if let Some(caps) = TRANSLATED_ITEMS_RE.captures(line) {
        job_artifacts_mut(job).translated_items = caps[1].parse::<i64>().ok();
    }
    if let Some(caps) = TRANSLATE_TIME_RE.captures(line) {
        job_artifacts_mut(job).translate_render_time_seconds = caps[1].parse::<f64>().ok();
    }
    if let Some(caps) = SAVE_TIME_RE.captures(line) {
        job_artifacts_mut(job).save_time_seconds = caps[1].parse::<f64>().ok();
    }
    if let Some(caps) = TOTAL_TIME_RE.captures(line) {
        job_artifacts_mut(job).total_time_seconds = caps[1].parse::<f64>().ok();
    }
}
