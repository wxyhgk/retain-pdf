//! 进度：跑到哪了。

use crate::app::AppState;
use crate::routes::jobs::progress;

crate::endpoints! {
    state: AppState;
    /// 事件列表（分页、按游标续读）
    GET "/api/v1/jobs/:job_id/progress/events" => progress::get_job_events, signed;
    /// 实时推送（SSE）：边翻边看的新译文
    GET "/api/v1/jobs/:job_id/progress/stream" => progress::get_live_translation_events, signed;
    /// 边翻边看：页面文字块的版面
    GET "/api/v1/jobs/:job_id/progress/layout" => progress::get_live_translation_layout, signed;
    /// 边翻边看：一页已经出来的译文
    GET "/api/v1/jobs/:job_id/progress/pages/:page" => progress::get_live_translation_page, signed;
    /// 翻译 agent 的编辑部事件（editorial.v1），按条数续读；legacy 任务是空列表
    GET "/api/v1/jobs/:job_id/progress/editorial" => progress::get_editorial_events, signed;
}
