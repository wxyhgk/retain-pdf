//! 翻译请求 journal（Python 写，`translation-request-journal.v1.jsonl`）的只读解析。
//!
//! 两处要读它：API 的「手动重试要不要确认重复风险」（retainpdf-jobs），和 runner 的
//! 「重启后能不能自动续跑」（retainpdf-runner）。两边必须用同一份判据，所以放在它们
//! 共同依赖的核心包里。
//!
//! 约定：dispatch 记录先落盘（fsync）再发请求，terminal 记录在拿到响应或确定失败后补上；
//! 只有 dispatch 没有 terminal 表示「结果不明」，绝不当作成功。

use std::collections::{HashMap, HashSet};
use std::path::Path;

const JOURNAL_SCHEMA: &str = "translation_request_journal_v1";
const JOURNAL_SCHEMA_VERSION: u64 = 1;

/// journal 的读取结论。`status` 取 `clean` / `ambiguous` / `corrupt`。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranslationRequestJournalState {
    pub status: &'static str,
    pub unresolved_dispatches: u64,
    pub active_ambiguous_request_keys: u64,
    pub historical_ambiguous_request_keys: u64,
    /// 有结果不明的请求，或 journal 读不了：重发之前必须有人确认。
    pub requires_confirmation: bool,
    /// `corrupt` 时的原因。
    pub corrupt_detail: Option<&'static str>,
}

impl TranslationRequestJournalState {
    pub fn is_corrupt(&self) -> bool {
        self.status == "corrupt"
    }

    fn corrupt(detail: &'static str) -> Self {
        Self {
            status: "corrupt",
            unresolved_dispatches: 0,
            active_ambiguous_request_keys: 0,
            historical_ambiguous_request_keys: 0,
            requires_confirmation: true,
            corrupt_detail: Some(detail),
        }
    }
}

/// 读 journal 的结论。
///
/// journal 只追加：同一个文件记住读到哪个字节和那时的状态，下次只解析新追加的部分。整本 6574 页的书一份
/// journal 有 29 万行、113MB，以前任务详情和阶段操作每次请求都从头解析一遍（debug 构建一次好几秒，任务运行中
/// 前端轮询时更慢），2026-11-04 改成增量。文件变短、或者上次读到的末尾那段字节对不上（被换成了别的文件），整份重读。
pub fn parse_translation_request_journal(path: &Path) -> TranslationRequestJournalState {
    let Ok(metadata) = std::fs::metadata(path) else {
        return TranslationRequestJournalState::corrupt("translation request journal cannot be read");
    };
    let key = path.to_path_buf();
    let cached = {
        let mut cache = journal_cache().lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        cache.iter().position(|(cached_path, _)| cached_path == &key).map(|index| cache.remove(index).1)
    };
    let scan = match cached {
        Some(scan) if scan.consumed <= metadata.len() => continue_scan(path, scan),
        _ => None,
    }
    .unwrap_or_else(|| continue_scan(path, JournalScan::default()).unwrap_or_else(JournalScan::unreadable));
    let state = scan.state();
    let mut cache = journal_cache().lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    // 并发请求可能各读了一遍，留一份就够
    cache.retain(|(cached_path, _)| cached_path != &key);
    cache.push((key, scan));
    if cache.len() > JOURNAL_CACHE_ENTRIES {
        cache.remove(0);
    }
    state
}

const JOURNAL_CACHE_ENTRIES: usize = 8;
/// 记住已读部分末尾的这么多字节，下次先比一下，对不上说明文件被换了。
const JOURNAL_TAIL_CHECK_BYTES: usize = 64;

fn journal_cache() -> &'static std::sync::Mutex<Vec<(std::path::PathBuf, JournalScan)>> {
    static CACHE: std::sync::OnceLock<std::sync::Mutex<Vec<(std::path::PathBuf, JournalScan)>>> =
        std::sync::OnceLock::new();
    CACHE.get_or_init(|| std::sync::Mutex::new(Vec::new()))
}

#[derive(Default)]
struct JournalScan {
    open_dispatches: HashMap<String, String>,
    active_ambiguous_keys: HashSet<String>,
    historical_ambiguous_keys: HashSet<String>,
    /// 已经解析完的字节数（总在一行的末尾，没写完的最后一行不算）。
    consumed: u64,
    tail: Vec<u8>,
    corrupt: Option<&'static str>,
}

impl JournalScan {
    fn unreadable() -> Self {
        Self {
            corrupt: Some("translation request journal cannot be read"),
            ..Self::default()
        }
    }

    fn state(&self) -> TranslationRequestJournalState {
        if let Some(detail) = self.corrupt {
            return TranslationRequestJournalState::corrupt(detail);
        }
        // 没等到 terminal 的 dispatch 算结果不明（不改动扫描状态：后面追加的 terminal 还要能把它们配上）。
        let mut active: HashSet<&str> = self.active_ambiguous_keys.iter().map(String::as_str).collect();
        active.extend(self.open_dispatches.values().map(String::as_str));
        let mut historical: HashSet<&str> = self.historical_ambiguous_keys.iter().map(String::as_str).collect();
        historical.extend(active.iter().copied());
        let requires_confirmation = !active.is_empty();
        TranslationRequestJournalState {
            status: if requires_confirmation { "ambiguous" } else { "clean" },
            unresolved_dispatches: self.open_dispatches.len() as u64,
            active_ambiguous_request_keys: active.len() as u64,
            historical_ambiguous_request_keys: historical.len() as u64,
            requires_confirmation,
            corrupt_detail: None,
        }
    }

    fn feed_line(&mut self, raw_line: &[u8]) {
        if self.corrupt.is_some() || raw_line.iter().all(u8::is_ascii_whitespace) {
            return;
        }
        // 只取要用的几个字段，不建整棵 JSON 树
        let event: JournalLine<'_> = match serde_json::from_slice(raw_line) {
            Ok(event) => event,
            Err(_) => {
                self.corrupt = Some("translation request journal contains invalid JSON");
                return;
            }
        };
        if event.schema.as_ref().and_then(LooseField::as_str) != Some(JOURNAL_SCHEMA)
            || event.schema_version.as_ref().and_then(LooseField::as_u64) != Some(JOURNAL_SCHEMA_VERSION)
        {
            self.corrupt = Some("translation request journal contract is unsupported");
            return;
        }
        let token = event.request_token.as_ref().and_then(LooseField::as_str).unwrap_or_default();
        let request_key = event.request_key.as_ref().and_then(LooseField::as_str).unwrap_or_default();
        match event.event.as_ref().and_then(LooseField::as_str) {
            Some("dispatch") if !token.is_empty() && !request_key.is_empty() => {
                self.open_dispatches.insert(token.to_string(), request_key.to_string());
            }
            Some("terminal") if !token.is_empty() => {
                let resolved_key = self
                    .open_dispatches
                    .remove(token)
                    .unwrap_or_else(|| request_key.to_string());
                if resolved_key.is_empty() {
                    return;
                }
                if event.outcome.as_ref().and_then(LooseField::as_str) == Some("ambiguous") {
                    self.active_ambiguous_keys.insert(resolved_key.clone());
                    self.historical_ambiguous_keys.insert(resolved_key);
                } else {
                    // A later terminal result for the same deterministic request
                    // resolves the content-recovery ambiguity, while historical
                    // billing risk remains visible separately.
                    self.active_ambiguous_keys.remove(&resolved_key);
                    if self.open_dispatches.values().any(|key| key == &resolved_key) {
                        self.historical_ambiguous_keys.insert(resolved_key.clone());
                        self.open_dispatches.retain(|_, key| key != &resolved_key);
                    }
                }
            }
            _ => {}
        }
    }
}

/// 从 `scan.consumed` 接着读到文件末尾。读不了，或者已读部分的末尾对不上，返回 None（调用方整份重读）。
fn continue_scan(path: &Path, mut scan: JournalScan) -> Option<JournalScan> {
    use std::io::{Read, Seek, SeekFrom};

    let mut file = std::fs::File::open(path).ok()?;
    let check_len = scan.tail.len() as u64;
    let start = scan.consumed.checked_sub(check_len)?;
    file.seek(SeekFrom::Start(start)).ok()?;
    let mut raw = Vec::new();
    file.read_to_end(&mut raw).ok()?;
    if !raw.starts_with(&scan.tail) {
        return None;
    }
    let fresh = &raw[scan.tail.len()..];
    let complete_len = if fresh.ends_with(b"\n") {
        fresh.len()
    } else {
        fresh.iter().rposition(|byte| *byte == b'\n').map_or(0, |index| index + 1)
    };
    if complete_len > 0 {
        for raw_line in fresh[..complete_len].split(|byte| *byte == b'\n') {
            scan.feed_line(raw_line);
        }
        let read_through = &raw[..scan.tail.len() + complete_len];
        scan.tail = read_through[read_through.len().saturating_sub(JOURNAL_TAIL_CHECK_BYTES)..].to_vec();
        scan.consumed += complete_len as u64;
    }
    Some(scan)
}

#[derive(serde::Deserialize)]
struct JournalLine<'a> {
    #[serde(borrow, default)]
    schema: Option<LooseField<'a>>,
    #[serde(borrow, default)]
    schema_version: Option<LooseField<'a>>,
    #[serde(borrow, default)]
    event: Option<LooseField<'a>>,
    #[serde(borrow, default)]
    request_token: Option<LooseField<'a>>,
    #[serde(borrow, default)]
    request_key: Option<LooseField<'a>>,
    #[serde(borrow, default)]
    outcome: Option<LooseField<'a>>,
}

/// 字段类型不对时和以前读 `Value` 一样当作没有这个值（`as_str()` / `as_u64()` 得 None），不当成坏 JSON。
#[derive(serde::Deserialize)]
#[serde(untagged)]
enum LooseField<'a> {
    Str(#[serde(borrow)] std::borrow::Cow<'a, str>),
    U64(u64),
    Other(serde::de::IgnoredAny),
}

impl LooseField<'_> {
    fn as_str(&self) -> Option<&str> {
        match self {
            Self::Str(value) => Some(value),
            _ => None,
        }
    }

    fn as_u64(&self) -> Option<u64> {
        match self {
            Self::U64(value) => Some(*value),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_path(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "retain-request-journal-{name}-{}",
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
        let state = parse_translation_request_journal(&path);
        assert_eq!(state.status, "ambiguous");
        assert_eq!(state.unresolved_dispatches, 1);
        assert_eq!(state.active_ambiguous_request_keys, 1);
        assert!(state.requires_confirmation);
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
        let state = parse_translation_request_journal(&path);
        assert_eq!(state.status, "clean");
        assert_eq!(state.active_ambiguous_request_keys, 0);
        assert_eq!(state.historical_ambiguous_request_keys, 1);
        assert_eq!(state.unresolved_dispatches, 0);
        assert!(!state.requires_confirmation);
        let _ = std::fs::remove_file(path);
    }

    fn line(event: &str, token: &str, key: &str, outcome: &str) -> String {
        format!(
            "{{\"schema\":\"translation_request_journal_v1\",\"schema_version\":1,\"event\":\"{event}\",\"request_token\":\"{token}\",\"request_key\":\"{key}\",\"outcome\":\"{outcome}\"}}\n"
        )
    }

    fn append(path: &std::path::Path, text: &str) {
        use std::io::Write;
        std::fs::OpenOptions::new()
            .append(true)
            .open(path)
            .expect("open journal")
            .write_all(text.as_bytes())
            .expect("append journal");
    }

    #[test]
    fn appended_lines_are_picked_up_incrementally() {
        // journal 只追加：第二次只读新追加的部分，结论和整份重读一样（包括上一轮没写完的半行）
        let path = test_path("incremental");
        std::fs::write(&path, line("dispatch", "t1", "k1", "")).expect("write journal");
        assert_eq!(parse_translation_request_journal(&path).status, "ambiguous");
        append(&path, "{\"schema\":\"translation_request_journal_v1\",\"schema_");
        assert_eq!(parse_translation_request_journal(&path).unresolved_dispatches, 1);
        std::fs::write(
            &path,
            format!(
                "{}{}{}",
                line("dispatch", "t1", "k1", ""),
                line("terminal", "t1", "k1", "succeeded"),
                line("dispatch", "t2", "k2", "")
            ),
        )
        .expect("rewrite journal");
        let state = parse_translation_request_journal(&path);
        assert_eq!(state.unresolved_dispatches, 1);
        assert_eq!(state.active_ambiguous_request_keys, 1);
        append(&path, &line("terminal", "t2", "k2", "succeeded"));
        let state = parse_translation_request_journal(&path);
        assert_eq!(state.status, "clean");
        assert_eq!(state.unresolved_dispatches, 0);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn a_replaced_or_truncated_journal_is_read_again_from_the_start() {
        let path = test_path("replaced");
        std::fs::write(
            &path,
            format!("{}{}", line("dispatch", "t1", "k1", ""), line("terminal", "t1", "k1", "succeeded")),
        )
        .expect("write journal");
        assert_eq!(parse_translation_request_journal(&path).status, "clean");
        // 换成更长的另一份：已读部分的末尾对不上，整份重读
        std::fs::write(
            &path,
            format!(
                "{}{}{}",
                line("dispatch", "x1", "k9", ""),
                line("dispatch", "x2", "k8", ""),
                line("dispatch", "x3", "k7", "")
            ),
        )
        .expect("replace journal");
        let state = parse_translation_request_journal(&path);
        assert_eq!(state.unresolved_dispatches, 3);
        // 变短：整份重读
        std::fs::write(&path, line("dispatch", "y1", "k1", "")).expect("truncate journal");
        assert_eq!(parse_translation_request_journal(&path).unresolved_dispatches, 1);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn fields_of_the_wrong_type_count_as_missing_like_before() {
        // 以前按 Value 读，类型不对的字段 as_str() 得 None；只取几个字段以后也一样，不当成坏 JSON
        let path = test_path("loose");
        std::fs::write(
            &path,
            concat!(
                "{\"schema\":\"translation_request_journal_v1\",\"schema_version\":1,",
                "\"event\":\"dispatch\",\"request_token\":7,\"request_key\":\"k1\",\"extra\":{\"a\":[1,2]}}\n"
            ),
        )
        .expect("write journal");
        let state = parse_translation_request_journal(&path);
        assert_eq!(state.status, "clean");
        assert_eq!(state.unresolved_dispatches, 0);
        std::fs::write(
            &path,
            "{\"schema\":\"translation_request_journal_v1\",\"schema_version\":\"1\",\"event\":\"dispatch\"}\n",
        )
        .expect("rewrite journal");
        assert_eq!(
            parse_translation_request_journal(&path).corrupt_detail,
            Some("translation request journal contract is unsupported")
        );
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn corrupt_complete_line_fails_closed() {
        let path = test_path("corrupt");
        std::fs::write(&path, b"{not-json}\n").expect("write journal");
        let state = parse_translation_request_journal(&path);
        assert!(state.is_corrupt());
        assert!(state.requires_confirmation);
        let _ = std::fs::remove_file(path);
    }
}
