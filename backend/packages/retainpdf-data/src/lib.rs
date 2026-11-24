//! retainpdf-data：数据与外部提供方层（db / job_events / worker_command / ocr_provider）。
//!
//! 链式 re-export retainpdf-core 的基础模块，使搬入文件中的 `crate::models`、
//! `crate::config`、`crate::storage_paths` 等路径原样解析，无需改写。

pub use retainpdf_core::{config, job_failure, models, storage_paths};

pub mod credentials;
pub use retainpdf_db::db;
pub mod job_events;
pub mod library_signal;
pub mod ocr_provider;
pub mod runtime_assets;
pub mod sync;
pub mod translation_revisions;
pub mod worker_command;
