//! 译文：逐条看、人工改、重翻一条。

use crate::app::AppState;
use crate::routes::jobs::translations;

crate::endpoints! {
    state: AppState;
    owner: jobs;
    /// 译文条目列表
    GET "/api/v1/jobs/:job_id/translations" => translations::list_translation_items, signed by(web);
    /// 一条译文
    GET "/api/v1/jobs/:job_id/translations/:item_id" => translations::get_translation_item, signed by(web);
    /// 人工修改一条译文
    PATCH "/api/v1/jobs/:job_id/translations/:item_id" => translations::revise_translation_item_route, signed by(web);
    /// 一条译文的修改历史
    GET "/api/v1/jobs/:job_id/translations/:item_id/revisions" => translations::get_translation_item_revisions, signed by(web);
    /// 重翻一条
    POST "/api/v1/jobs/:job_id/translations/:item_id/replay" => translations::replay_translation_item_route, signed by(web);
}
