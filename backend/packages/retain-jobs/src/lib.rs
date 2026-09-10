//! retain-jobs：作业运行时层（job_runner）。
//!
//! 链式 re-export retain-core / retain-data 的模块，使搬入文件中的
//! `crate::models`、`crate::db`、`crate::ocr_provider` 等路径原样解析，无需改写。

pub use retain_core::{config, job_failure, models, storage_paths};
pub use retain_data::{db, job_events, ocr_provider, worker_command};

pub mod job_runner;
