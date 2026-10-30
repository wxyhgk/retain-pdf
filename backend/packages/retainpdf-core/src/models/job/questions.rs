//! 问任务的问题，不用一路点进 `request_payload` 的内部结构。
//!
//! 任务提交时的完整请求（`request_payload`）字段多、层次深，到处直接翻会让每个用到任务的地方都
//! 依赖它的内部细节，改一个字段牵动一片。读的人在这里问；只有生成和改写请求的几个模块（建任务、
//! 重跑、重试阶段、发射、合并阅读的虚拟任务）直接动字段，名单在 rust_api 的
//! `check_architecture.py`（`KNOWN_REQUEST_PAYLOAD_WRITERS`）。

use crate::model_connection::ModelConnection;
use crate::models::{GlossaryEntryInput, JobRecord, OcrInput, RenderInput, WorkflowKind};

fn non_empty(value: &str) -> Option<&str> {
    let value = value.trim();
    (!value.is_empty()).then_some(value)
}

impl JobRecord {
    /// 提交时请求的 workflow。一般和 `workflow` 相同；预扣页数等要按请求算的地方用这个。
    pub fn requested_workflow(&self) -> &WorkflowKind {
        &self.request_payload.workflow
    }

    // --- 原文从哪来 ---

    /// 这个任务用的源任务：复用了它的 OCR 结果，或者原地重新渲染时就是它自己。没有是 `None`。
    pub fn source_job_id(&self) -> Option<&str> {
        non_empty(&self.request_payload.source.artifact_job_id)
    }

    /// 提交时用的上传编号（原样，可能是空串）。
    pub fn source_upload_id(&self) -> &str {
        &self.request_payload.source.upload_id
    }

    /// 从网址建的任务的原文地址（原样，可能是空串）。
    pub fn source_url(&self) -> &str {
        &self.request_payload.source.source_url
    }

    /// 原文是存下来的上传或者网址，可以从头再跑一遍。
    pub fn has_stored_source(&self) -> bool {
        non_empty(&self.request_payload.source.upload_id).is_some()
            || non_empty(&self.request_payload.source.source_url).is_some()
    }

    // --- OCR ---

    /// OCR 的语言（原样）。
    pub fn ocr_language(&self) -> &str {
        &self.request_payload.ocr.language
    }

    /// 请求里写的 OCR 页码范围，例如 `"1-3,7"`；空串或 `all` 表示整本（原样）。
    pub fn ocr_page_ranges(&self) -> &str {
        &self.request_payload.ocr.page_ranges
    }

    /// 整份 OCR 设置，给要按服务商规则判断的地方（例如是不是 Paddle 官方命令行）。
    pub fn ocr_options(&self) -> &OcrInput {
        &self.request_payload.ocr
    }

    // --- 翻译 ---

    /// 翻译用的模型名（原样）。
    pub fn translation_model(&self) -> &str {
        &self.request_payload.translation.model
    }

    /// 翻译引擎：`legacy`（现有流程）或 `agent`（翻译 agent）。有这个字段以前的老任务读出来是 `legacy`。
    pub fn translation_engine(&self) -> &str {
        non_empty(&self.request_payload.translation.engine).unwrap_or("legacy")
    }

    /// 翻译的本地页码窗口 `(start_page, end_page)`，`end_page` 为 -1 表示到最后。
    pub fn translation_page_window(&self) -> (i64, i64) {
        let translation = &self.request_payload.translation;
        (translation.start_page, translation.end_page)
    }

    /// 只翻这些文档页（没写是空的）。
    pub fn translation_page_list(&self) -> &[u32] {
        &self.request_payload.translation.page_ranges
    }

    /// 提交时直接带来的翻译密钥（去掉空白，没有是 `None`）。
    pub fn inline_translation_api_key(&self) -> Option<&str> {
        non_empty(&self.request_payload.translation.api_key)
    }

    /// 翻译用的凭据编号（没有是 `None`）。
    pub fn translation_credential_ref(&self) -> Option<&str> {
        non_empty(&self.request_payload.translation.credential_ref)
    }

    /// 这个任务引用的全部凭据编号：翻译、审校、OCR，去掉空的。
    pub fn credential_refs(&self) -> impl Iterator<Item = &str> {
        let translation = &self.request_payload.translation;
        [
            translation.credential_ref.as_str(),
            translation.reviewer_credential_ref.as_str(),
            self.request_payload.ocr.credential_ref.as_str(),
        ]
        .into_iter()
        .filter_map(non_empty)
    }

    /// 绑定的 Rust 模型执行器连接（没绑定是 `None`，走 Python 那一路）。
    pub fn model_connection(&self) -> Option<&ModelConnection> {
        self.request_payload.translation.execution_connection.as_ref()
    }

    /// 翻译走 Rust 模型执行器。
    pub fn uses_model_executor(&self) -> bool {
        self.model_connection().is_some()
    }

    // --- 术语表 ---

    /// 建任务时选的术语表编号（去掉空白，没选是 `None`）。
    pub fn translation_glossary_id(&self) -> Option<&str> {
        non_empty(&self.request_payload.translation.glossary_id)
    }

    /// 重跑、阶段重试时要重新解析的内联术语：用户建任务时真正内联的那些（`glossary_inline_entries`）。
    /// `glossary_entries` 是和术语表合并后的快照，不能再当内联用，否则表里改过的译法、删掉的词会被旧快照盖回来。
    ///
    /// 2026-10-22 以前的任务没存内联条目：内联条数是 0 就是没有内联；不是 0 时分不清快照里哪些是内联的，
    /// 退回旧行为，把整份快照当内联。
    pub fn glossary_inline_entries_for_rerun(&self) -> Vec<GlossaryEntryInput> {
        let translation = &self.request_payload.translation;
        if !translation.glossary_inline_entries.is_empty() || translation.glossary_inline_entry_count == 0 {
            return translation.glossary_inline_entries.clone();
        }
        translation.glossary_entries.clone()
    }

    // --- 排版 ---

    /// 整份排版设置，给要原样记下来的地方（例如快照）。
    pub fn render_options(&self) -> &RenderInput {
        &self.request_payload.render
    }

    /// 排版用的字体（去掉空白）。
    pub fn typst_font_family(&self) -> &str {
        self.request_payload.render.typst_font_family.trim()
    }

    /// 翻译完接着排版。
    pub fn renders_after_translation(&self) -> bool {
        self.request_payload.runtime.render_after_translation
    }
}

#[cfg(test)]
mod tests {
    use crate::model_connection::{Deadlines, ModelConnection, Provider, Thinking};
    use crate::models::{CreateJobInput, JobSnapshot};

    fn job() -> JobSnapshot {
        JobSnapshot::new("job-questions".to_string(), CreateJobInput::default(), vec![])
    }

    #[test]
    fn blank_source_job_means_none() {
        let mut job = job();
        assert_eq!(None, job.source_job_id());
        job.request_payload.source.artifact_job_id = "  ".to_string();
        assert_eq!(None, job.source_job_id());
        job.request_payload.source.artifact_job_id = " job-ocr ".to_string();
        assert_eq!(Some("job-ocr"), job.source_job_id());
    }

    #[test]
    fn stored_source_is_an_upload_or_a_url() {
        let mut job = job();
        assert!(!job.has_stored_source());
        job.request_payload.source.source_url = "https://example.test/a.pdf".to_string();
        assert!(job.has_stored_source());
        job.request_payload.source.source_url.clear();
        job.request_payload.source.upload_id = "upload-1".to_string();
        assert!(job.has_stored_source());
    }

    #[test]
    fn credential_refs_skip_blank_ones() {
        let mut job = job();
        assert_eq!(0, job.credential_refs().count());
        job.request_payload.translation.credential_ref = " cred-t ".to_string();
        job.request_payload.ocr.credential_ref = "cred-o".to_string();
        assert_eq!(vec!["cred-t", "cred-o"], job.credential_refs().collect::<Vec<_>>());
        assert_eq!(Some("cred-t"), job.translation_credential_ref());
        assert_eq!(None, job.inline_translation_api_key());
    }

    fn glossary_entry(source: &str, target: &str) -> crate::models::GlossaryEntryInput {
        crate::models::GlossaryEntryInput {
            source: source.to_string(),
            target: target.to_string(),
            note: String::new(),
            level: "preferred".to_string(),
            match_mode: "exact".to_string(),
            context: String::new(),
        }
    }

    #[test]
    fn rerun_glossary_uses_the_stored_inline_entries_not_the_merged_snapshot() {
        let mut job = job();
        job.request_payload.translation.glossary_entries =
            vec![glossary_entry("DNA", "脱氧核糖核酸"), glossary_entry("band gap", "带隙")];
        job.request_payload.translation.glossary_inline_entries = vec![glossary_entry("band gap", "带隙")];
        job.request_payload.translation.glossary_inline_entry_count = 1;
        assert_eq!(
            vec![glossary_entry("band gap", "带隙")],
            job.glossary_inline_entries_for_rerun()
        );
    }

    #[test]
    fn rerun_glossary_of_an_old_job_without_inline_entries_is_empty() {
        let mut job = job();
        job.request_payload.translation.glossary_id = "glossary-1".to_string();
        job.request_payload.translation.glossary_entries = vec![glossary_entry("DNA", "脱氧核糖核酸")];
        job.request_payload.translation.glossary_inline_entry_count = 0;
        assert!(job.glossary_inline_entries_for_rerun().is_empty());
        assert_eq!(Some("glossary-1"), job.translation_glossary_id());
    }

    #[test]
    fn rerun_glossary_of_an_old_job_with_inline_entries_keeps_the_old_behavior() {
        let mut job = job();
        job.request_payload.translation.glossary_entries = vec![glossary_entry("DNA", "DNA")];
        job.request_payload.translation.glossary_inline_entry_count = 1;
        assert_eq!(vec![glossary_entry("DNA", "DNA")], job.glossary_inline_entries_for_rerun());
    }

    #[test]
    fn model_connection_is_the_bound_execution_connection() {
        let mut job = job();
        assert!(job.model_connection().is_none());
        assert!(!job.uses_model_executor());
        let connection = ModelConnection {
            id: "conn".to_string(),
            revision: 1,
            provider: Provider::Deepseek,
            base_url: "https://api.example.test/v1".to_string(),
            model: "deepseek-chat".to_string(),
            credential_ref: "cred-t".to_string(),
            concurrency: 8,
            thinking: Thinking::Auto,
            stream: None,
            allow_private_endpoint: false,
            deadlines: Deadlines::default(),
        };
        job.request_payload.translation.execution_connection = Some(connection.clone());
        assert_eq!(Some(&connection), job.model_connection());
        assert!(job.uses_model_executor());
    }
}
