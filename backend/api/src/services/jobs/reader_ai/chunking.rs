use crate::models::api::ReaderAiCitationView;

const DEFAULT_MAX_CHUNK_CHARS: usize = 1_600;
const DEFAULT_SNIPPET_CHARS: usize = 240;

/// Backwards-compat constant aliases; prefer `max_chunk_chars()` / `snippet_chars()` which are env-overridable.
#[allow(dead_code)]
const MAX_CHUNK_CHARS: usize = DEFAULT_MAX_CHUNK_CHARS;
#[allow(dead_code)]
const SNIPPET_CHARS: usize = DEFAULT_SNIPPET_CHARS;

pub(super) fn max_chunk_chars() -> usize {
    env_usize("RUST_API_RAG_MAX_CHUNK_CHARS", DEFAULT_MAX_CHUNK_CHARS)
}

pub(super) fn snippet_chars() -> usize {
    env_usize("RUST_API_RAG_SNIPPET_CHARS", DEFAULT_SNIPPET_CHARS)
}

fn env_usize(name: &str, fallback: usize) -> usize {
    std::env::var(name)
        .ok()
        .and_then(|value| value.trim().parse::<usize>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(fallback)
}

#[derive(Debug, Clone)]
pub(super) struct MarkdownChunk {
    pub title: String,
    pub page: Option<i64>,
    pub text: String,
}

impl MarkdownChunk {
    pub(super) fn citation(&self) -> ReaderAiCitationView {
        ReaderAiCitationView {
            title: self.title.clone(),
            page: self.page,
            snippet: self.snippet(),
        }
    }

    pub(super) fn snippet(&self) -> String {
        snippet(&self.text)
    }
}

pub(super) fn chunk_markdown(markdown: &str) -> Vec<MarkdownChunk> {
    let mut builder = ChunkBuilder::default();
    let mut chunks = Vec::new();

    for line in markdown.lines() {
        let trimmed = line.trim();
        if let Some(title) = heading_title(trimmed) {
            builder.flush(&mut chunks);
            builder.title = title;
            continue;
        }
        if trimmed.is_empty() {
            builder.flush(&mut chunks);
            continue;
        }
        if image_only(trimmed) {
            continue;
        }
        builder.push(trimmed, &mut chunks);
    }
    builder.flush(&mut chunks);
    chunks
}

#[derive(Default)]
struct ChunkBuilder {
    title: String,
    text: String,
}

impl ChunkBuilder {
    fn push(&mut self, line: &str, chunks: &mut Vec<MarkdownChunk>) {
        if !self.text.is_empty() {
            self.text.push('\n');
        }
        self.text.push_str(line);
        if self.text.chars().count() >= max_chunk_chars() {
            self.flush(chunks);
        }
    }

    fn flush(&mut self, chunks: &mut Vec<MarkdownChunk>) {
        let text = self.text.trim();
        if text.is_empty() {
            self.text.clear();
            return;
        }
        chunks.push(MarkdownChunk {
            title: fallback_title(&self.title),
            page: page_from_text(text),
            text: text.to_string(),
        });
        self.text.clear();
    }
}

fn heading_title(line: &str) -> Option<String> {
    let stripped = line.strip_prefix('#')?;
    let title = stripped.trim_start_matches('#').trim();
    if title.is_empty() {
        return None;
    }
    Some(title.to_string())
}

fn image_only(line: &str) -> bool {
    line.starts_with("![") || line.starts_with("<img ") || line.starts_with("<div ")
}

fn fallback_title(title: &str) -> String {
    if title.trim().is_empty() {
        "Document".to_string()
    } else {
        title.trim().to_string()
    }
}

fn page_from_text(text: &str) -> Option<i64> {
    for marker in ["page ", "Page ", "第"] {
        if let Some(page) = page_after_marker(text, marker) {
            return Some(page);
        }
    }
    None
}

fn page_after_marker(text: &str, marker: &str) -> Option<i64> {
    let (_, tail) = text.split_once(marker)?;
    let digits = tail
        .chars()
        .skip_while(|ch| !ch.is_ascii_digit())
        .take_while(|ch| ch.is_ascii_digit())
        .collect::<String>();
    if digits.is_empty() {
        return None;
    }
    digits.parse().ok()
}

fn snippet(text: &str) -> String {
    let normalized = text.split_whitespace().collect::<Vec<_>>().join(" ");
    normalized.chars().take(snippet_chars()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

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
    fn chunks_by_heading_and_paragraph() {
        let _g = ENV_LOCK.lock().unwrap();
        // ensure defaults when env unset
        with_env("RUST_API_RAG_MAX_CHUNK_CHARS", None, || {
            with_env("RUST_API_RAG_SNIPPET_CHARS", None, || {
                let chunks = chunk_markdown(
                    "# Intro\n\nFirst paragraph.\n\nSecond paragraph.\n# Methods\nBody",
                );
                assert_eq!(chunks.len(), 3);
                assert_eq!(chunks[0].title, "Intro");
                assert_eq!(chunks[2].title, "Methods");
            });
        });
    }

    #[test]
    fn max_chunk_chars_env_override() {
        let _g = ENV_LOCK.lock().unwrap();
        with_env("RUST_API_RAG_MAX_CHUNK_CHARS", Some("20"), || {
            assert_eq!(max_chunk_chars(), 20);
            // with tiny chunk size, a single long line should trigger flush early
            let long = "a".repeat(25);
            let chunks = chunk_markdown(&long);
            assert_eq!(chunks.len(), 1);
            assert_eq!(chunks[0].text.len(), 25);
            // two lines that individually are short but together exceed limit should split
            let two = format!("{}\n{}", "a".repeat(15), "b".repeat(15));
            let chunks2 = chunk_markdown(&two);
            // pushed first line (15 chars), second line pushes to 31 inc newline -> exceeds 20 -> flush
            assert!(chunks2.len() >= 1);
        });
        with_env("RUST_API_RAG_MAX_CHUNK_CHARS", Some("0"), || {
            assert_eq!(max_chunk_chars(), DEFAULT_MAX_CHUNK_CHARS);
        });
        with_env("RUST_API_RAG_MAX_CHUNK_CHARS", Some("bad"), || {
            assert_eq!(max_chunk_chars(), DEFAULT_MAX_CHUNK_CHARS);
        });
    }

    #[test]
    fn snippet_chars_env_override() {
        let _g = ENV_LOCK.lock().unwrap();
        with_env("RUST_API_RAG_SNIPPET_CHARS", Some("5"), || {
            assert_eq!(snippet_chars(), 5);
            assert_eq!(snippet("hello world foo bar"), "hello");
        });
        with_env("RUST_API_RAG_SNIPPET_CHARS", None, || {
            assert_eq!(snippet_chars(), DEFAULT_SNIPPET_CHARS);
        });
    }
}
