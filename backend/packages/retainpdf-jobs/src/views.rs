//! 任务接口的返回类型（任务详情、列表、事件、阶段操作、阅读器、实时翻译、译文修订……）和拼它们的函数。
//! 2026-10-18 从核心包挪过来；产物和操作链接在 retainpdf-files（`ArtifactLinksView`、`JobActionsView`）。

#[path = "views/common.rs"]
mod common;
#[path = "views/editorial.rs"]
mod editorial;
#[path = "views/job.rs"]
mod job;
#[path = "views/live_translation.rs"]
mod live_translation;
#[cfg(test)]
#[path = "views/test_support.rs"]
mod test_support;
#[cfg(test)]
#[path = "views/tests.rs"]
mod tests;
#[path = "views/translation.rs"]
mod translation;

pub use common::*;
pub use editorial::*;
pub use job::*;
pub use live_translation::*;
pub use translation::*;

pub use retainpdf_core::models::api::to_absolute_url;
