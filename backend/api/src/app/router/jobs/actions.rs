//! 操作：能对它做什么、去做。

use crate::app::AppState;
use crate::routes::jobs::actions;

crate::endpoints! {
    state: AppState;
    /// 现在能做哪些操作（每个阶段能不能重试、重试的请求怎么写）
    GET "/api/v1/jobs/:job_id/actions" => actions::get_stage_actions, signed;
    /// 续跑会从哪里开始
    GET "/api/v1/jobs/:job_id/actions/resume" => actions::get_resume_plan, signed;
    /// 从断点续跑
    POST "/api/v1/jobs/:job_id/actions/resume" => actions::resume_job, signed;
    // 2026-11-02 以前旧名另有一份一模一样的处理函数 rerun_job，删了，直接用续跑的。
    /// 旧名，和续跑是同一个处理函数
    POST "/api/v1/jobs/:job_id/actions/rerun" => actions::resume_job, signed old "/api/v1/jobs/:job_id/actions/resume";
    /// 取消任务
    POST "/api/v1/jobs/:job_id/actions/cancel" => actions::cancel_job, signed;
    /// 重试某一个阶段（OCR、翻译、渲染、精修）
    POST "/api/v1/jobs/:job_id/actions/retry-stage" => actions::retry_stage, signed;
    /// OCR 拿不准时由用户选
    POST "/api/v1/jobs/:job_id/actions/resolve-ocr-ambiguity" => actions::resolve_ocr_ambiguity, signed;
}
