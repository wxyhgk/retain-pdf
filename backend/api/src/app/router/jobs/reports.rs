//! 报告：跑完结果怎么样。

use crate::app::AppState;
use crate::routes::jobs::reports;

crate::endpoints! {
    state: AppState;
    /// 质量体检卡
    GET "/api/v1/jobs/:job_id/reports/quality" => reports::quality_summary_route, signed;
    /// 翻译质检（AI 助手、命令行在用）
    GET "/api/v1/jobs/:job_id/reports/translation-qa" => reports::get_translation_qa, signed;
    /// 翻译诊断
    GET "/api/v1/jobs/:job_id/reports/translation" => reports::get_translation_diagnostics, signed;
    /// 排版缩放情况
    GET "/api/v1/jobs/:job_id/reports/layout-fit" => reports::get_fit_report, signed;
    /// 精修报告
    GET "/api/v1/jobs/:job_id/reports/refine" => reports::get_refine_report, signed;
    /// 失败原因
    GET "/api/v1/jobs/:job_id/reports/failure" => reports::get_job_diagnostics, signed;
}
