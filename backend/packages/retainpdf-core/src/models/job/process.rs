use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ProcessResult {
    pub success: bool,
    pub return_code: i32,
    pub duration_seconds: f64,
    pub command: Vec<String>,
    pub cwd: String,
    pub stdout: String,
    pub stderr: String,
}

/// 进库的程序输出（`result_json` 的 stdout、stderr）只留末尾这么多字节（2026-11-20）：完整的在任务目录的
/// `logs/*.stdout.log`、`*.stderr.log`。以前整份进库，11-03 一个任务的 stdout 就有 171MB。读它的只有失败诊断（看末尾）。
pub const STORED_OUTPUT_TAIL_BYTES: usize = 64 * 1024;

/// 超过 [`STORED_OUTPUT_TAIL_BYTES`] 的只留末尾，开头写明省略了多少；连说明一起也不超过上限，截过的再截不变。
pub fn stored_output_tail(text: &str) -> String {
    if text.len() <= STORED_OUTPUT_TAIL_BYTES {
        return text.to_string();
    }
    // 说明那一行留 256 字节（实际一百字节上下）
    let mut start = text.len() - (STORED_OUTPUT_TAIL_BYTES - 256);
    while !text.is_char_boundary(start) {
        start += 1;
    }
    format!("…（前面 {start} 字节省略，完整输出在任务目录的 logs/ 下）\n{}", &text[start..])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_tail_of_long_output_is_kept() {
        assert_eq!(stored_output_tail("short"), "short");
        let long = format!("{}末尾", "中".repeat(STORED_OUTPUT_TAIL_BYTES));
        let kept = stored_output_tail(&long);
        assert!(kept.ends_with("末尾") && kept.starts_with("…（前面"));
        assert!(kept.len() <= STORED_OUTPUT_TAIL_BYTES);
        assert_eq!(stored_output_tail(&kept), kept, "截过的再截不变");
    }
}
