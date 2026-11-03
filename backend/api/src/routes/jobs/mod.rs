//! `/jobs` 的处理函数，按 8 类分文件，和 app/router/jobs/ 一一对应
//! （分类见 docs/ops/planning/api-reorg/20261015-任务与文件接口整理.md）：
//!
//! | 文件 | 前缀 | 回答什么 |
//! |---|---|---|
//! | `lifecycle` | `/jobs`、`/jobs/:id` | 有哪些任务、建一个、看一个 |
//! | `actions` | `/jobs/:id/actions/…` | 能对它做什么、去做 |
//! | `progress` | `/jobs/:id/progress/…` | 跑到哪了 |
//! | `files` | `/jobs/:id/files/…` | 产出了哪些文件、取一个 |
//! | `reports` | `/jobs/:id/reports/…` | 跑完结果怎么样 |
//! | `reader` | `/jobs/:id/reader/…` | 阅读页要的东西 |
//! | `translations` | `/jobs/:id/translations/…` | 逐条看、人工改、重翻一条 |
//! | `data` | `/jobs/:id/data/…` | 通用查询 |
//!
//! 旧地址 2026-10-18 全删了；以后再改地址，旧地址在 app/router/jobs/ 各类的登记表里紧跟新地址，行尾写 `old "<新地址>"`。

pub mod actions;
pub mod data;
pub mod files;
pub mod lifecycle;
pub mod progress;
pub mod reader;
pub mod reports;
pub mod translations;

#[cfg(test)]
mod tests {
    use crate::models::request::CreateJobInput;
    use serde_json::json;

    #[test]
    fn create_job_json_requires_grouped_payload_shape() {
        let input = CreateJobInput::from_api_value(json!({
            "source": { "upload_id": "grouped-upload" },
            "translation": {
                "model": "deepseek-flash",
                "base_url": "https://api.deepseek.com/v1",
                "api_key": "sk-test"
            },
            "ocr": { "mineru_token": "mineru-token" }
        }))
        .expect("parse payload");

        assert_eq!(input.source.upload_id, "grouped-upload");
    }
}
