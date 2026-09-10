//! retain-data：数据与外部提供方层（db / job_events / worker_command / ocr_provider）。
//!
//! 链式 re-export retain-core 的基础模块，使搬入文件中的 `crate::models`、
//! `crate::config`、`crate::storage_paths` 等路径原样解析，无需改写。

pub use retain_core::{config, job_failure, models, storage_paths};

pub mod credentials;
pub use retain_db::db;
pub mod job_events;
pub mod ocr_provider;
pub mod worker_command;
