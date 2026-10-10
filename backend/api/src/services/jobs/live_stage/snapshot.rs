use crate::models::api::JobEventRecord;
use crate::models::domain::{job_stage_rank, JobStatusKind};

use super::LiveStageSnapshot;

pub(in crate::services::jobs) fn select_live_stage_snapshot(
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

/// Sufficient statistics for the existing selector. This is closed under
/// merging: compact(compact(history) + delta) yields the same stage as history
/// + delta, including late timestamps, retries, and background lanes.
pub(in crate::services::jobs) fn compact_stage_basis(
    items: &[JobEventRecord],
) -> Vec<JobEventRecord> {
    let mut basis = Vec::new();
    let main = items
        .iter()
        .filter(|item| item_is_selectable_main_stage(item));
    if let Some(item) = main.clone().max_by(|left, right| {
        job_stage_rank(left.stage.as_deref())
            .cmp(&job_stage_rank(right.stage.as_deref()))
            .then_with(|| left.ts.cmp(&right.ts))
            .then_with(|| left.seq.cmp(&right.seq))
    }) {
        basis.push(item.clone());
    }
    if let Some(item) = latest_by_time(main.filter(|item| !item_is_terminal_done_stage(item))) {
        basis.push(item.clone());
    }
    if let Some(item) = latest_render_page_progress(items) {
        basis.push(item.clone());
    }
    if let Some(item) = latest_progress(items) {
        basis.push(item.clone());
    }
    let mut backgrounds =
        std::collections::BTreeMap::<String, (&JobEventRecord, &JobEventRecord)>::new();
    for item in items.iter().filter(|item| {
        item.lane.as_deref() == Some("background")
            && item.display_stage.is_some()
            && item.substage.is_some()
    }) {
        let key = background_key(item);
        let (first, last) = backgrounds.entry(key).or_insert((item, item));
        if event_is_newer(first, item) {
            *first = item;
        }
        if event_is_newer(item, last) {
            *last = item;
        }
    }
    basis.extend(
        backgrounds
            .into_values()
            .flat_map(|(first, last)| [first.clone(), last.clone()]),
    );
    basis.sort_by(|a, b| a.ts.cmp(&b.ts).then_with(|| a.seq.cmp(&b.seq)));
    basis.dedup_by(|a, b| a.seq == b.seq);
    basis
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
    // 渲染之前的精修 / 编辑部（substage=refining）有自己的进度（第几批），这时还没开始排版：
    // 不能拿上一次渲染留下的页数进度（往往是「34/34 页」）来顶，那样精修期间进度一直是满的、不动。
    if selected.substage.as_deref().map(str::trim) == Some("refining") {
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

#[cfg(test)]
mod compact_tests {
    use super::*;
    use crate::models::domain::JobStatusKind;

    #[test]
    fn bounded_basis_matches_full_history_with_late_events_and_background_stages() {
        let mut history = Vec::new();
        for seq in 1..=512 {
            let stage = ["ocr", "translating", "rendering", "finished", "failed"][seq as usize % 5];
            let mut event: JobEventRecord = serde_json::from_value(serde_json::json!({
                "job_id":"compact", "seq":seq, "ts":format!("{:08}", (seq * 37) % 211),
                "created_at":"", "level":"info", "event":"stage_progress", "message":"",
                "stage":stage, "progress_current":seq, "progress_total":1000, "progress_unit":"page"
            }))
            .unwrap();
            crate::services::jobs::live_stage::canonicalize_job_event(&mut event, "db");
            if seq % 3 == 0 {
                event.lane = Some("background".into());
                event.substage = Some(format!("background-{}", seq % 7));
            }
            history.push(event);
        }
        let mut sorted = history.clone();
        sorted.sort_by(|a, b| a.ts.cmp(&b.ts).then_with(|| a.seq.cmp(&b.seq)));
        for chunk_size in [1, 7, 31, 512] {
            let mut basis = Vec::new();
            for chunk in history.chunks(chunk_size) {
                basis.extend_from_slice(chunk);
                basis = compact_stage_basis(&basis);
            }
            assert!(
                basis.len() <= 74,
                "bounded by stage categories, not event count"
            );
            for status in [
                JobStatusKind::Running,
                JobStatusKind::Succeeded,
                JobStatusKind::Failed,
            ] {
                assert_eq!(
                    serde_json::to_value(select_live_stage_snapshot(&basis, &status)).unwrap(),
                    serde_json::to_value(select_live_stage_snapshot(&sorted, &status)).unwrap(),
                    "chunk size {chunk_size}, status {status:?}"
                );
            }
        }
    }

    fn render_event(seq: i64, ts: &str, substage: Option<&str>, current: i64, total: i64, unit: &str, detail: &str) -> JobEventRecord {
        let mut event: JobEventRecord = serde_json::from_value(serde_json::json!({
            "job_id": "refine", "seq": seq, "ts": ts, "created_at": ts, "level": "info",
            "event": "stage_progress", "message": detail, "stage": "rendering", "substage": substage,
            "stage_detail": detail, "progress_current": current, "progress_total": total, "progress_unit": unit,
        }))
        .unwrap();
        crate::services::jobs::live_stage::canonicalize_job_event(&mut event, "pipeline");
        event
    }

    #[test]
    fn refining_shows_its_own_progress_not_the_last_render_page_count() {
        // 上一次渲染：34/34 页。这次原地精修：挑错第 3/14 批，还没开始排版。
        let history = vec![
            render_event(1, "2026-10-09T15:15:26Z", None, 34, 34, "page", "排版 34/34 页"),
            render_event(2, "2026-10-10T00:24:58Z", Some("refining"), 3, 14, "step", "精修：挑错已完成 3/14 批"),
        ];
        let snapshot = select_live_stage_snapshot(&history, &JobStatusKind::Running).expect("snapshot");
        assert_eq!(snapshot.substage.as_deref(), Some("refining"));
        assert_eq!((snapshot.progress_current, snapshot.progress_total), (Some(3), Some(14)));
        assert_eq!(snapshot.progress_unit.as_deref(), Some("step"));
        assert_eq!(snapshot.stage_detail.as_deref(), Some("精修：挑错已完成 3/14 批"));
        let compacted = compact_stage_basis(&history);
        assert_eq!(
            serde_json::to_value(select_live_stage_snapshot(&compacted, &JobStatusKind::Running)).unwrap(),
            serde_json::to_value(Some(snapshot)).unwrap(),
            "压缩后的历史给出同样的进度"
        );

        // 精修完开始排版：回到页数进度。
        let mut rendering = history;
        rendering.push(render_event(3, "2026-10-10T00:35:32Z", None, 5, 34, "page", "排版 5/34 页"));
        let snapshot = select_live_stage_snapshot(&rendering, &JobStatusKind::Running).expect("snapshot");
        assert_eq!((snapshot.progress_current, snapshot.progress_total), (Some(5), Some(34)));
    }
}
