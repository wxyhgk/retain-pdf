use super::*;

fn block(page: u32, anchor: &str, source: &str, translated: Option<&str>) -> ExportBlock {
    ExportBlock {
        page,
        anchor: anchor.to_string(),
        job_id: "job-a".to_string(),
        sub_type: Some("body".to_string()),
        heading_level: None,
        source: source.to_string(),
        translated: translated.map(str::to_string),
        images: Vec::new(),
    }
}

fn heading(page: u32, anchor: &str, level: i64, source: &str, translated: &str) -> ExportBlock {
    ExportBlock { heading_level: Some(level), sub_type: Some("heading".to_string()), ..block(page, anchor, source, Some(translated)) }
}

#[test]
fn blocks_carry_anchor_source_and_translation() {
    let book = render_book("Book", &[block(3, "p003-b0001", "Hello world.", Some("你好，世界。"))]);
    assert_eq!(book.files.len(), 1);
    let content = &book.files[0].content;
    assert!(content.contains("<!-- p003-b0001 job=job-a page=3 -->\nHello world.\n\n> 你好，世界。\n"), "{content}");
    assert_eq!((book.files[0].first_page, book.files[0].last_page), (3, 3));
}

#[test]
fn untranslated_blocks_have_only_the_source() {
    let book = render_book("Book", &[block(1, "p001-b0001", "Only source.", None)]);
    let content = &book.files[0].content;
    assert!(content.contains("Only source.\n\n"), "{content}");
    assert!(!content.contains("\n>"), "{content}");
}

#[test]
fn page_furniture_is_not_exported() {
    let mut number = block(1, "p001-b0009", "12", None);
    number.sub_type = Some("page_number".to_string());
    let mut header = block(1, "p001-b0010", "Running head", None);
    header.sub_type = Some("header".to_string());
    let empty = block(1, "p001-b0011", "  ", Some(""));
    let book = render_book("Book", &[number, header, empty, block(1, "p001-b0001", "Body.", None)]);
    let content = &book.files[0].content;
    assert!(!content.contains("p001-b0009") && !content.contains("p001-b0010") && !content.contains("p001-b0011"), "{content}");
    assert!(content.contains("Body."));
}

#[test]
fn chapters_split_at_top_level_headings_once_a_file_is_big_enough() {
    let filler = "x".repeat(MIN_FILE_BYTES);
    let blocks = [
        heading(1, "p001-b0001", 1, "Chapter One", "第一章"),
        block(1, "p001-b0002", &filler, None),
        heading(2, "p002-b0001", 2, "Section", "小节"),
        heading(5, "p005-b0001", 1, "Chapter Two", "第二章"),
        block(5, "p005-b0002", "short", None),
        heading(6, "p006-b0001", 1, "Chapter Three", "第三章"),
    ];
    let book = render_book("Book", &blocks);
    let names: Vec<&str> = book.files.iter().map(|file| file.name.as_str()).collect();
    // 第二章很短，第三章不另开文件。
    assert_eq!(names, ["01-Chapter-One.md", "02-Chapter-Two.md"]);
    assert_eq!((book.files[1].first_page, book.files[1].last_page), (5, 6));
    assert!(book.files[1].content.contains("## Chapter Three｜第三章"));
}

#[test]
fn toc_points_at_the_heading_line() {
    let blocks = [
        heading(1, "p001-b0001", 1, "Intro", "引言"),
        block(1, "p001-b0002", "Text.", None),
        heading(2, "p002-b0001", 2, "Detail", "细节"),
    ];
    let book = render_book("Book", &blocks);
    let file = &book.files[0];
    for line in book.toc.lines().filter(|line| line.contains("`text/")) {
        if line.contains("— 第") && line.starts_with(|c: char| c == '-' || c == ' ') && line.contains(".md:") {
            let target: usize = line.rsplit(':').next().unwrap().trim_end_matches('`').parse().unwrap();
            let heading_line = file.content.lines().nth(target - 1).unwrap();
            assert!(heading_line.starts_with('#'), "{line} → {heading_line:?}");
        }
    }
    assert!(book.toc.contains("- Intro｜引言 — 第 1 页 — `text/01-Intro.md:4`"), "{}", book.toc);
    assert!(book.toc.contains("  - Detail｜细节 — 第 2 页"), "{}", book.toc);
}

#[test]
fn no_file_exceeds_the_size_limit_unless_one_block_alone_does() {
    let paragraph = "y".repeat(MAX_FILE_BYTES / 5);
    let blocks: Vec<ExportBlock> =
        (1..=20).map(|page| block(page, &format!("p{page:03}-b0001"), &paragraph, None)).collect();
    let book = render_book("Book", &blocks);
    assert!(book.files.len() >= 4, "{}", book.files.len());
    for file in &book.files {
        assert!(file.content.len() <= MAX_FILE_BYTES + 200, "{} is {} bytes", file.name, file.content.len());
    }
    // 没有标题：按页号起名。
    assert_eq!(book.files[0].name, "01-p1.md");
    let pages: Vec<u32> = book.files.iter().flat_map(|file| [file.first_page, file.last_page]).collect();
    assert!(pages.windows(2).all(|pair| pair[0] <= pair[1]), "{pages:?}");
}

#[test]
fn file_names_from_hostile_headings_stay_inside_text() {
    let book = render_book("Book", &[heading(1, "p001-b0001", 1, "../../etc/passwd", "x")]);
    assert_eq!(book.files[0].name, "01-etc-passwd.md");
}
