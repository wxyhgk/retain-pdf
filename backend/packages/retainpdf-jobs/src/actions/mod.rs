//! 操作：能做哪些操作、取消、整个重跑、重试某一阶段、续跑计划、OCR 结果不确定时的处理。

pub(crate) mod cancel;
mod cancel_submission;
pub(crate) mod ocr_ambiguity;
mod rerun;
mod rerun_glossary;
pub(crate) mod resume_plan;
pub(crate) mod stage_plan;
mod stage_retry;
mod stage_retry_overrides;
mod stage_retry_refine;
mod stage_retry_request;
mod stage_retry_view;
mod streamed_ocr_artifacts;
pub(crate) mod translation_request_recovery;

