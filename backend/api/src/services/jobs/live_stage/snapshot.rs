use crate::models::api::JobEventRecord;
use crate::models::domain::{job_stage_rank, JobStatusKind};

use super::LiveStageSnapshot;

pub(super) fn select_live_stage_snapshot(
    items: &[JobEventRecord],
    status: &JobStatusKind,
) -> Option<LiveStageSnapshot> {
    let selected = select_main_stage_event(items, status)?;
    let page_progress = latest_render_page_progress(items);
    let fallback_progress = latest_progress(items);
    let selected_stage = selected
        .stage
        .as_deref()
        .map(str::to_string)
        .unwrap_or_default();
    let progress_stage = fallback_progress
        .and_then(|item| item.stage.as_deref().map(str::to_string))
        .unwrap_or_default();
    let should_keep_progress_stage = progress_current(selected).is_none()
        && selected_stage.trim() == "failed"
        && !progress_stage.trim().is_empty();
    let progress_event = display_progress_event(selected, page_progress);
    Some(LiveStageSnapshot {
        display_stage: if should_keep_progress_stage {
            fallback_progress.and_then(|item| item.display_stage.clone())
        } else {
            selected.display_stage.clone()
        },
        stage: if should_keep_progress_stage {
            fallback_progress.and_then(|item| item.stage.clone())
        } else {
            selected.stage.clone()
        },
        substage: if should_keep_progress_stage {
            fallback_progress.and_then(|item| item.substage.clone())
        } else {
            selected.substage.clone()
        },
        lane: if should_keep_progress_stage {
            fallback_progress.and_then(|item| item.lane.clone())
        } else {
            selected.lane.clone()
        },
        stage_detail: if should_keep_progress_stage {
            fallback_progress.and_then(|item| item.stage_detail.clone())
        } else {
            selected.stage_detail.clone()
        },
        progress_current: progress_event
            .and_then(progress_current)
            .or_else(|| fallback_progress.and_then(progress_current)),
        progress_total: progress_event
            .and_then(progress_total)
            .or_else(|| fallback_progress.and_then(progress_total)),
        progress_unit: progress_event
            .and_then(progress_unit)
            .or_else(|| fallback_progress.and_then(progress_unit)),
        background_stages: latest_background_stages(items),
    })
}

fn select_main_stage_event<'a>(
    items: &'a [JobEventRecord],
    status: &JobStatusKind,
) -> Option<&'a JobEventRecord> {
    let candidates: Vec<&JobEventRecord> = items
        .iter()
        .filter(|item| item_is_selectable_main_stage(item))
        .collect();
    if matches!(status, JobStatusKind::Running | JobStatusKind::Queued) {
        let non_terminal: Vec<&JobEventRecord> = candidates
            .iter()
            .copied()
            .filter(|item| !item_is_terminal_done_stage(item))
            .collect();
        if !non_terminal.is_empty() {
            return latest_by_time(non_terminal.into_iter());
        }
    }
    candidates.into_iter().max_by(|left, right| {
        job_stage_rank(left.stage.as_deref())
            .cmp(&job_stage_rank(right.stage.as_deref()))
            .then_with(|| left.ts.cmp(&right.ts))
            .then_with(|| left.seq.cmp(&right.seq))
    })
}

fn item_is_selectable_main_stage(item: &JobEventRecord) -> bool {
    if item.lane.as_deref().map(str::trim).unwrap_or("") != "main" {
        return false;
    }
    let raw_event_type = item
        .raw_event_type
        .as_deref()
        .or(item.event_type.as_deref())
        .map(str::trim)
        .unwrap_or("");
    let stage = item.stage.as_deref().map(str::trim).unwrap_or("");
    raw_event_type != "artifact_published" && !stage.is_empty()
}

fn item_is_terminal_done_stage(item: &JobEventRecord) -> bool {
    let display_stage = item.display_stage.as_deref().map(str::trim).unwrap_or("");
    let stage = item.stage.as_deref().map(str::trim).unwrap_or("");
    let raw_event_type = item
        .raw_event_type
        .as_deref()
        .or(item.event_type.as_deref())
        .map(str::trim)
        .unwrap_or("");
    display_stage == "done"
        || matches!(
            stage,
            "finished" | "done" | "succeeded" | "failed" | "canceled"
        )
        || raw_event_type == "job_terminal"
}

fn latest_background_stages(items: &[JobEventRecord]) -> Vec<LiveStageSnapshot> {
    let mut selected: Vec<&JobEventRecord> = Vec::new();
    for item in items.iter().filter(|item| {
        item.lane.as_deref().map(str::trim).unwrap_or("") == "background"
            && item.display_stage.as_deref().map(str::trim).is_some()
            && item.substage.as_deref().map(str::trim).is_some()
    }) {
        let key = background_key(item);
        if let Some(existing_index) = selected
            .iter()
            .position(|existing| background_key(existing) == key)
        {
            let existing = selected[existing_index];
            if event_is_newer(item, existing) {
                selected[existing_index] = item;
            }
        } else {
            selected.push(item);
        }
    }
    selected
        .into_iter()
        .map(snapshot_from_background_event)
        .collect()
}

fn background_key(item: &JobEventRecord) -> String {
    format!(
        "{}\u{1f}{}\u{1f}{}",
        item.display_stage.as_deref().map(str::trim).unwrap_or(""),
        item.stage.as_deref().map(str::trim).unwrap_or(""),
        item.substage.as_deref().map(str::trim).unwrap_or("")
    )
}

fn event_is_newer(left: &JobEventRecord, right: &JobEventRecord) -> bool {
    left.ts
        .cmp(&right.ts)
        .then_with(|| left.seq.cmp(&right.seq))
        .is_gt()
}

fn snapshot_from_background_event(item: &JobEventRecord) -> LiveStageSnapshot {
    LiveStageSnapshot {
        display_stage: item.display_stage.clone(),
        stage: item.stage.clone(),
        substage: item.substage.clone(),
        lane: item.lane.clone(),
        stage_detail: item.stage_detail.clone(),
        progress_current: progress_current(item),
        progress_total: progress_total(item),
        progress_unit: progress_unit(item),
        background_stages: Vec::new(),
    }
}

fn latest_render_page_progress(items: &[JobEventRecord]) -> Option<&JobEventRecord> {
    latest_by_time(items.iter().filter(|item| {
        item.lane.as_deref().map(str::trim).unwrap_or("") == "main"
            && progress_unit(item).as_deref().map(str::trim) == Some("page")
            && (item.display_stage.as_deref().map(str::trim) == Some("render")
                || item.stage.as_deref().map(str::trim) == Some("rendering"))
            && (progress_current(item).is_some() || progress_total(item).is_some())
    }))
}

fn latest_progress(items: &[JobEventRecord]) -> Option<&JobEventRecord> {
    latest_by_time(items.iter().filter(|item| {
        item.lane.as_deref().map(str::trim).unwrap_or("") == "main"
            && (progress_current(item).is_some() || progress_total(item).is_some())
    }))
}

fn latest_by_time<'a>(
    items: impl Iterator<Item = &'a JobEventRecord>,
) -> Option<&'a JobEventRecord> {
    items.max_by(|left, right| {
        left.ts
            .cmp(&right.ts)
            .then_with(|| left.seq.cmp(&right.seq))
    })
}

fn display_progress_event<'a>(
    selected: &'a JobEventRecord,
    page_progress: Option<&'a JobEventRecord>,
) -> Option<&'a JobEventRecord> {
    if progress_unit(selected).as_deref().map(str::trim) == Some("page") {
        return Some(selected);
    }
    let selected_stage = selected.stage.as_deref().map(str::trim).unwrap_or("");
    let selected_display_stage = selected
        .display_stage
        .as_deref()
        .map(str::trim)
        .unwrap_or("");
    if selected_display_stage == "render" || selected_stage == "rendering" {
        return page_progress.or(Some(selected));
    }
    Some(selected)
}

fn progress_current(item: &JobEventRecord) -> Option<i64> {
    item.progress
        .as_ref()
        .and_then(|progress| progress.current)
        .or(item.progress_current)
}

fn progress_total(item: &JobEventRecord) -> Option<i64> {
    item.progress
        .as_ref()
        .and_then(|progress| progress.total)
        .or(item.progress_total)
}

fn progress_unit(item: &JobEventRecord) -> Option<String> {
    item.progress
        .as_ref()
        .and_then(|progress| progress.unit.clone())
        .or_else(|| item.progress_unit.clone())
}
