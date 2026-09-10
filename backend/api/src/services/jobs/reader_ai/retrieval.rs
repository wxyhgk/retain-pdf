use std::collections::HashSet;

use crate::models::api::ReaderAiContextView;

use super::chunking::MarkdownChunk;

#[derive(Debug, Clone)]
pub(super) struct RetrievedChunk {
    pub chunk: MarkdownChunk,
    pub score: f64,
}

pub(super) fn retrieve_chunks(
    chunks: &[MarkdownChunk],
    query: &str,
    context: Option<&ReaderAiContextView>,
    limit: usize,
) -> Vec<RetrievedChunk> {
    if is_summary_query(query) {
        return representative_summary_chunks(chunks, limit.max(10));
    }
    let query_terms = tokenize(query);
    let preferred_page = context.and_then(|ctx| {
        ctx.selection
            .as_ref()
            .map(|selection| selection.page)
            .or(ctx.page)
    });
    let mut ranked = chunks
        .iter()
        .cloned()
        .map(|chunk| {
            let score = score_chunk(&chunk, &query_terms, preferred_page);
            RetrievedChunk { chunk, score }
        })
        .filter(|item| item.score > 0.0)
        .collect::<Vec<_>>();
    ranked.sort_by(|a, b| b.score.total_cmp(&a.score));
    ranked.truncate(limit);
    if ranked.is_empty() {
        chunks
            .iter()
            .take(limit)
            .cloned()
            .map(|chunk| RetrievedChunk { chunk, score: 0.0 })
            .collect()
    } else {
        ranked
    }
}

fn representative_summary_chunks(chunks: &[MarkdownChunk], limit: usize) -> Vec<RetrievedChunk> {
    let mut selected = Vec::new();
    for section in [
        "abstract",
        "摘要",
        "introduction",
        "引言",
        "method",
        "方法",
        "result",
        "结果",
        "discussion",
        "讨论",
        "conclusion",
        "summary",
        "结论",
        "总结",
    ] {
        if selected.len() >= limit {
            break;
        }
        if let Some(index) = chunks
            .iter()
            .position(|chunk| chunk.title.to_lowercase().contains(section))
        {
            push_unique(&mut selected, index);
        }
    }
    for index in uniform_indices(chunks.len(), limit) {
        if selected.len() >= limit {
            break;
        }
        push_unique(&mut selected, index);
    }
    selected
        .into_iter()
        .filter_map(|index| chunks.get(index).cloned())
        .enumerate()
        .map(|(rank, chunk)| RetrievedChunk {
            chunk,
            score: 100.0 - rank as f64,
        })
        .collect()
}

fn push_unique(selected: &mut Vec<usize>, index: usize) {
    if !selected.contains(&index) {
        selected.push(index);
    }
}

fn uniform_indices(len: usize, limit: usize) -> Vec<usize> {
    if len == 0 || limit == 0 {
        return Vec::new();
    }
    if len <= limit {
        return (0..len).collect();
    }
    (0..limit)
        .map(|slot| slot * (len.saturating_sub(1)) / (limit.saturating_sub(1)))
        .collect()
}

fn is_summary_query(query: &str) -> bool {
    let normalized = query.to_lowercase();
    [
        "总结",
        "概括",
        "全文",
        "整篇",
        "这篇文章",
        "讲了什么",
        "核心贡献",
        "主要贡献",
        "主要内容",
        "summary",
        "summarize",
        "overview",
        "main contribution",
        "core contribution",
        "what is this paper about",
        "what does this paper",
    ]
    .iter()
    .any(|marker| normalized.contains(marker))
}

fn score_chunk(
    chunk: &MarkdownChunk,
    query_terms: &HashSet<String>,
    preferred_page: Option<i64>,
) -> f64 {
    let mut score = 0.0;
    let text_terms = tokenize(&chunk.text);
    let title_terms = tokenize(&chunk.title);
    for term in query_terms {
        if text_terms.contains(term) {
            score += 1.0;
        }
        if title_terms.contains(term) {
            score += 2.0;
        }
    }
    if preferred_page.is_some() && preferred_page == chunk.page {
        score += 3.0;
    }
    score
}

fn tokenize(text: &str) -> HashSet<String> {
    let mut tokens = HashSet::new();
    let mut current = String::new();
    for ch in text.chars() {
        if ch.is_alphanumeric() {
            current.extend(ch.to_lowercase());
        } else {
            push_token(&mut tokens, &mut current);
            if is_cjk(ch) {
                tokens.insert(ch.to_string());
            }
        }
    }
    push_token(&mut tokens, &mut current);
    tokens
}

fn push_token(tokens: &mut HashSet<String>, current: &mut String) {
    if current.chars().count() >= 2 {
        tokens.insert(std::mem::take(current));
    } else {
        current.clear();
    }
}

fn is_cjk(ch: char) -> bool {
    matches!(
        ch as u32,
        0x4E00..=0x9FFF | 0x3400..=0x4DBF | 0x20000..=0x2A6DF
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn title_match_ranks_first() {
        let chunks = vec![
            MarkdownChunk {
                title: "Methods".to_string(),
                page: None,
                text: "calculation details".to_string(),
            },
            MarkdownChunk {
                title: "Introduction".to_string(),
                page: None,
                text: "background".to_string(),
            },
        ];
        let ranked = retrieve_chunks(&chunks, "methods", None, 3);
        assert_eq!(ranked[0].chunk.title, "Methods");
    }

    #[test]
    fn summary_query_samples_across_document() {
        let chunks = (0..20)
            .map(|index| MarkdownChunk {
                title: format!("Section {index}"),
                page: Some(index + 1),
                text: format!("content {index}"),
            })
            .collect::<Vec<_>>();
        let ranked = retrieve_chunks(&chunks, "总结全文", None, 8);
        let pages = ranked
            .iter()
            .filter_map(|item| item.chunk.page)
            .collect::<Vec<_>>();

        assert!(pages.contains(&1));
        assert!(pages.iter().any(|page| *page > 10));
    }

    #[test]
    fn summary_query_prefers_named_sections() {
        let chunks = vec![
            MarkdownChunk {
                title: "Preface".to_string(),
                page: Some(1),
                text: "preface".to_string(),
            },
            MarkdownChunk {
                title: "Introduction".to_string(),
                page: Some(2),
                text: "intro".to_string(),
            },
            MarkdownChunk {
                title: "Conclusion".to_string(),
                page: Some(9),
                text: "done".to_string(),
            },
        ];
        let ranked = retrieve_chunks(&chunks, "这篇文章讲了什么", None, 8);

        assert_eq!(ranked[0].chunk.title, "Introduction");
        assert!(ranked.iter().any(|item| item.chunk.title == "Conclusion"));
    }
}
