//! 把一本书的区块写成 Markdown：按顶层标题分文件、每块带锚点、生成目录。纯函数，不碰磁盘。

use super::names::slugify;

/// 一个文件最多这么大（字节）。各家 AI 读文件的单次上限大多在这附近，超了它们会截断。
pub(super) const MAX_FILE_BYTES: usize = 200 * 1024;
/// 顶层标题处只有当前文件已经有这么大才换文件：论文几十个小节不至于拆成几十个小文件。
pub(super) const MIN_FILE_BYTES: usize = 16 * 1024;
/// 页眉、页脚、页码：对读书没用，只会让 grep 命中一堆噪声。取值随 OCR 服务商。
const SKIPPED_SUB_TYPES: &[&str] =
    &["page_number", "header", "footer", "page_header", "page_footer", "header_image", "footer_image"];

/// 导出的一块。
#[derive(Debug, Clone, PartialEq)]
pub(super) struct ExportBlock {
    /// 文档页号（整本书的，从 1 起），给人看。
    pub page: u32,
    /// 真正有这一块的任务里的 `item_id`（页号是那个任务自己的本地页号）。
    pub anchor: String,
    /// 真正有这一块的任务。
    pub job_id: String,
    pub sub_type: Option<String>,
    pub heading_level: Option<i64>,
    pub source: String,
    /// 没翻译的块是 `None`。
    pub translated: Option<String>,
    /// 引用的图片，相对 `text/` 目录（或绝对路径）。
    pub images: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct RenderedFile {
    /// `text/` 下的文件名。
    pub name: String,
    pub content: String,
    pub first_page: u32,
    pub last_page: u32,
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct RenderedBook {
    pub files: Vec<RenderedFile>,
    /// `toc.md` 的内容。
    pub toc: String,
}

fn is_skipped(block: &ExportBlock) -> bool {
    block.sub_type.as_deref().is_some_and(|sub_type| SKIPPED_SUB_TYPES.contains(&sub_type))
        || (block.source.trim().is_empty()
            && block.translated.as_deref().map_or(true, |text| text.trim().is_empty())
            && block.images.is_empty())
}

fn is_heading(block: &ExportBlock) -> bool {
    block.heading_level.is_some()
}

/// 按哪一级标题分文件：出现至少两次的最高一级（书名通常只出现一次，按它分等于不分）。
fn split_level(blocks: &[&ExportBlock]) -> Option<i64> {
    let mut levels: Vec<i64> = blocks.iter().filter_map(|block| block.heading_level).collect();
    levels.sort_unstable();
    let mut fallback = None;
    for level in levels.iter().copied() {
        fallback.get_or_insert(level);
        if levels.iter().filter(|other| **other == level).count() >= 2 {
            return Some(level);
        }
    }
    fallback
}

fn one_line(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn translated_text(block: &ExportBlock) -> Option<&str> {
    block.translated.as_deref().map(str::trim).filter(|text| !text.is_empty())
}

fn heading_title(block: &ExportBlock) -> String {
    let source = one_line(&block.source);
    match translated_text(block).map(one_line) {
        Some(translated) if translated != source && !source.is_empty() => format!("{source}｜{translated}"),
        Some(translated) if source.is_empty() => translated,
        _ => source,
    }
}

/// 一块的 Markdown，以换行结尾。
fn block_markdown(block: &ExportBlock) -> String {
    let mut out = format!("<!-- {} job={} page={} -->\n", block.anchor, block.job_id, block.page);
    if let Some(level) = block.heading_level {
        let hashes = "#".repeat((level + 1).clamp(2, 6) as usize);
        out.push_str(&format!("{hashes} {}\n", heading_title(block)));
    } else {
        let source = block.source.trim();
        if !source.is_empty() {
            out.push_str(source);
            out.push('\n');
        }
        if let Some(translated) = translated_text(block).filter(|text| *text != source) {
            if !source.is_empty() {
                out.push('\n');
            }
            for line in translated.lines() {
                out.push_str(if line.trim().is_empty() { ">" } else { "> " });
                out.push_str(line.trim_end());
                out.push('\n');
            }
        }
    }
    for image in &block.images {
        out.push_str(&format!("![]({image})\n"));
    }
    out.push('\n');
    out
}

struct Chunk<'a> {
    blocks: Vec<(&'a ExportBlock, String)>,
    bytes: usize,
}

/// 把一本书写成若干个文件和目录。`blocks` 按阅读顺序给。
pub(super) fn render_book(title: &str, blocks: &[ExportBlock]) -> RenderedBook {
    let kept: Vec<&ExportBlock> = blocks.iter().filter(|block| !is_skipped(block)).collect();
    let level = split_level(&kept);
    let mut chunks: Vec<Chunk> = Vec::new();
    for block in kept {
        let markdown = block_markdown(block);
        let starts_chapter = level.is_some() && block.heading_level == level;
        let start_new = match chunks.last() {
            None => true,
            Some(current) => {
                (starts_chapter && current.bytes >= MIN_FILE_BYTES)
                    || (current.bytes + markdown.len() > MAX_FILE_BYTES && !current.blocks.is_empty())
            }
        };
        if start_new {
            chunks.push(Chunk { blocks: Vec::new(), bytes: 0 });
        }
        let current = chunks.last_mut().expect("just pushed");
        current.bytes += markdown.len();
        current.blocks.push((block, markdown));
    }

    let width = chunks.len().to_string().len().max(2);
    let mut files = Vec::new();
    let mut toc_lines = Vec::new();
    let min_level = level.unwrap_or(1).min(
        chunks.iter().flat_map(|chunk| chunk.blocks.iter()).filter_map(|(block, _)| block.heading_level).min().unwrap_or(1),
    );
    for (index, chunk) in chunks.iter().enumerate() {
        let first_page = chunk.blocks.first().map_or(0, |(block, _)| block.page);
        let last_page = chunk.blocks.iter().map(|(block, _)| block.page).max().unwrap_or(first_page);
        let label = chunk
            .blocks
            .iter()
            .find(|(block, _)| is_heading(block))
            .map(|(block, _)| {
                let source = one_line(&block.source);
                if source.is_empty() { one_line(translated_text(block).unwrap_or("")) } else { source }
            })
            .map(|text| slugify(&text, 40))
            .filter(|slug| !slug.is_empty())
            .unwrap_or_else(|| format!("p{first_page}"));
        let name = format!("{:0width$}-{label}.md", index + 1);
        let header = if first_page == last_page {
            format!("# {} · 第 {first_page} 页\n\n", one_line(title))
        } else {
            format!("# {} · 第 {first_page}–{last_page} 页\n\n", one_line(title))
        };
        let mut content = header;
        for (block, markdown) in &chunk.blocks {
            if is_heading(block) {
                // 锚点那一行之后就是标题行。
                let line = content.lines().count() + 2;
                let indent = "  ".repeat((block.heading_level.unwrap_or(min_level) - min_level).max(0) as usize);
                toc_lines.push(format!("{indent}- {} — 第 {} 页 — `text/{name}:{line}`", heading_title(block), block.page));
            }
            content.push_str(markdown);
        }
        files.push(RenderedFile { name, content, first_page, last_page });
    }

    let mut toc = format!("# {} · 目录\n\n", one_line(title));
    if toc_lines.is_empty() {
        toc.push_str("（这本书没有识别出标题。）\n");
    } else {
        toc.push_str(&toc_lines.join("\n"));
        toc.push('\n');
    }
    if !files.is_empty() {
        toc.push_str("\n## 文件\n\n");
        for file in &files {
            toc.push_str(&format!("- `text/{}` — 第 {}–{} 页\n", file.name, file.first_page, file.last_page));
        }
    }
    RenderedBook { files, toc }
}

#[cfg(test)]
#[path = "render_tests.rs"]
mod tests;
