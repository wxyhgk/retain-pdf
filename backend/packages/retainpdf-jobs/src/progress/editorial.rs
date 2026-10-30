//! 翻译 agent 的编辑部事件（editorial.v1）：调度写在翻译目录的 `agent/run/events.jsonl`，这里按条数续读。
//!
//! 文件只追加，一行一条；正在写的最后一行可能还没写完（没有换行），不算进来，下次再读。
//! 游标就是读过的条数（空行、坏行也算一条，游标不会因为它们错位）。legacy 引擎的任务、
//! 还没开始翻的任务没有这个文件，返回空列表。

use std::fs;

use retainpdf_api_base::error::AppError;
use retainpdf_api_base::job_loading::load_supported_job;

use crate::files::{stored_path, StoredFile};
use crate::query::JobQueries;
use crate::views::{EditorialEventListView, EditorialEventsQuery};

const DEFAULT_LIMIT: u32 = 500;
const MAX_LIMIT: u32 = 2000;

impl JobQueries<'_> {
    pub fn editorial_events(
        &self,
        job_id: &str,
        query: &EditorialEventsQuery,
    ) -> Result<EditorialEventListView, AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        let text = match stored_path(&job, self.data_root, StoredFile::AgentEditorialEvents) {
            Some(path) => fs::read_to_string(&path)
                .map_err(|err| AppError::internal(format!("read editorial events: {err}")))?,
            None => String::new(),
        };
        let limit = query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
        Ok(read_after(&text, query.after, limit))
    }
}

fn read_after(text: &str, after: u64, limit: u32) -> EditorialEventListView {
    // 只认以换行结尾的完整行
    let complete = match text.rfind('\n') {
        Some(end) => &text[..=end],
        None => "",
    };
    let lines: Vec<&str> = complete.lines().collect();
    let total = lines.len() as u64;
    if after >= total {
        return EditorialEventListView { events: Vec::new(), next_after: total, has_more: false };
    }
    let start = after as usize;
    let end = (start + limit as usize).min(lines.len());
    let events = lines[start..end]
        .iter()
        .filter_map(|line| serde_json::from_str::<serde_json::Value>(line.trim()).ok())
        .filter(|value| value.is_object())
        .collect();
    EditorialEventListView { events, next_after: end as u64, has_more: end < lines.len() }
}

#[cfg(test)]
mod tests {
    use super::read_after;

    const FILE: &str = "{\"v\":\"editorial.v1\",\"ts\":1,\"type\":\"run_started\"}\n\
not json\n\
{\"v\":\"editorial.v1\",\"ts\":2,\"type\":\"page_started\",\"page\":1}\n\
{\"v\":\"editorial.v1\",\"ts\":3,\"type\":\"page_do";

    #[test]
    fn reads_complete_lines_after_the_cursor_and_skips_bad_ones() {
        let view = read_after(FILE, 0, 500);
        assert_eq!(view.events.len(), 2, "the bad line is skipped, the unfinished last line is not read yet");
        assert_eq!(view.next_after, 3);
        assert!(!view.has_more);
        assert_eq!(view.events[1]["type"], "page_started");

        let next = read_after(FILE, 1, 500);
        assert_eq!(next.events.len(), 1, "the bad line still counts towards the cursor");
        assert_eq!(next.events[0]["ts"], 2);
    }

    #[test]
    fn a_limit_pages_through_and_a_cursor_past_the_end_reports_the_real_count() {
        let first = read_after(FILE, 0, 1);
        assert_eq!((first.events.len(), first.next_after, first.has_more), (1, 1, true));
        let past = read_after(FILE, 9, 500);
        assert_eq!((past.events.len(), past.next_after, past.has_more), (0, 3, false));
        let empty = read_after("", 0, 500);
        assert_eq!((empty.events.len(), empty.next_after), (0, 0));
    }
}
