//! 书文件夹、章节文件的名字。书名、标题是用户和 OCR 给的，要拼进磁盘路径，只留字母和数字。

/// 只留字母、数字（含中文等），别的都换成 `-` 并合并；最多 `max_chars` 个字符。结果里没有 `/`、`\`、`.`，
/// 拼进路径不会跳出目录，也不会是 `.`、`..` 或隐藏文件。
pub(super) fn slugify(text: &str, max_chars: usize) -> String {
    let mut out = String::new();
    let mut count = 0;
    let mut pending_dash = false;
    for ch in text.chars() {
        if count >= max_chars {
            break;
        }
        if ch.is_alphanumeric() {
            if pending_dash && !out.is_empty() {
                out.push('-');
                count += 1;
                if count >= max_chars {
                    break;
                }
            }
            pending_dash = false;
            out.push(ch);
            count += 1;
        } else {
            pending_dash = true;
        }
    }
    out.trim_end_matches('-').to_string()
}

/// 书编号的前 8 位（只留十六进制字符）：书名改了，文件夹名跟着改，但结尾这段不变，凭它找到旧文件夹。
pub(super) fn short_id(document_id: &str) -> String {
    let short: String =
        document_id.chars().filter(|ch| ch.is_ascii_hexdigit()).take(8).collect::<String>().to_ascii_lowercase();
    if short.is_empty() { "unknown".to_string() } else { short }
}

/// `<书名>-<书编号前 8 位>`。
pub(super) fn folder_name(title: &str, document_id: &str) -> String {
    let slug = slugify(title, 48);
    let slug = if slug.is_empty() { "book".to_string() } else { slug };
    format!("{slug}-{}", short_id(document_id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_never_escape_the_books_directory() {
        for title in ["../../etc", "a/b\\c", "..", ".", ".hidden", "  ", "", "/abs", "x\0y", "C:\\win"] {
            let name = folder_name(title, "0123456789abcdef");
            assert!(!name.contains('/') && !name.contains('\\') && !name.contains('\0'), "{title:?} → {name}");
            assert!(!name.starts_with('.'), "{title:?} → {name}");
            assert!(name.ends_with("-01234567"), "{title:?} → {name}");
        }
        assert_eq!(folder_name("../../etc", "0123456789abcdef"), "etc-01234567");
        assert_eq!(folder_name("..", "0123456789abcdef"), "book-01234567");
    }

    #[test]
    fn titles_keep_letters_of_any_script() {
        assert_eq!(slugify("热力学 第二定律: The 2nd Law!", 48), "热力学-第二定律-The-2nd-Law");
        assert_eq!(slugify("abcdef", 3), "abc");
        assert_eq!(slugify("ab cd", 3), "ab");
        assert_eq!(short_id("ZZ-xyz"), "unknown");
    }
}
