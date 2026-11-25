//! 操作：能对它做什么、去做。

use crate::app::AppState;
use crate::routes::jobs::actions;

crate::endpoints! {
    state: AppState;
    owner: jobs;
    /// 现在能做哪些操作（每个阶段能不能重试、重试的请求怎么写）
    GET "/api/v1/jobs/:job_id/actions" => actions::get_stage_actions, signed by(web);
    /// 续跑会从哪里开始
    GET "/api/v1/jobs/:job_id/actions/resume" => actions::get_resume_plan, signed by(web);
    /// 从断点续跑
    POST "/api/v1/jobs/:job_id/actions/resume" => actions::resume_job, signed by(web) [idempotent];
    // 旧名 `POST …/actions/rerun`（和续跑同一个处理函数）2026-11-25 删了：前端早改调 resume，10-18 起 0 次调用。
    /// 取消任务
    POST "/api/v1/jobs/:job_id/actions/cancel" => actions::cancel_job, signed by(web);
    /// 重试某一个阶段（OCR、翻译、渲染、精修）
    POST "/api/v1/jobs/:job_id/actions/retry-stage" => actions::retry_stage, signed by(web) [idempotent];
    /// OCR 拿不准时由用户选
    POST "/api/v1/jobs/:job_id/actions/resolve-ocr-ambiguity" => actions::resolve_ocr_ambiguity, signed by(web) [idempotent];
}
