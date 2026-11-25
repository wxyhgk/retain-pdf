//! 报告：跑完结果怎么样。

use crate::app::AppState;
use crate::routes::jobs::reports;

crate::endpoints! {
    state: AppState;
    owner: jobs;
    /// 质量体检卡
    GET "/api/v1/jobs/:job_id/reports/quality" => reports::quality_summary_route, signed by(web);
    /// 翻译诊断
    GET "/api/v1/jobs/:job_id/reports/translation" => reports::get_translation_diagnostics, signed by(web);
    // 翻译质检 `translation-qa`、排版缩放 `layout-fit`、精修报告 `refine` 2026-11-25 删了：以前给 RetainPDF 自己的 AI 读，
    // 11-03 随它删了以后没有调用方。报告文件照旧落盘。
    /// 失败原因
    GET "/api/v1/jobs/:job_id/reports/failure" => reports::get_job_diagnostics, signed by(web);
    /// 这个任务自己的模型用量
    GET "/api/v1/jobs/:job_id/reports/usage" => reports::job_usage_route, signed by(web);
}
