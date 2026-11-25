//! 文件：产出了哪些文件、取一个。按"给谁用"分三组：output 成品 / pages 译文页预览 /
//! internal 中间产物（只给管理员）。旧地址（`/pdf`、`/artifacts/:key`……）2026-10-18 删了，
//! 新旧对照见 docs/api/07-产物下载/01-下载总览.md。

use crate::app::AppState;
use crate::routes::jobs::files;

crate::endpoints! {
    state: AppState;
    owner: jobs;
    /// 文件清单：按 output、pages、internal 三组列出这个任务的文件
    GET "/api/v1/jobs/:job_id/files" => files::list_job_files, signed by(web);
    /// 取一个成品：translated.pdf、side-by-side.pdf、translated.docx、ocr.md、ocr.zip、ocr/images/…、all.zip
    GET "/api/v1/jobs/:job_id/files/output/*name" => files::job_output_file, signed by(web);
    /// 译文某一页的预览图（pages/3.jpg）
    GET "/api/v1/jobs/:job_id/files/pages/:page" => files::job_page_file, signed by(agent);
    /// 取一个中间产物（规范化文档、翻译清单、请求日志……），多用户下只给管理员
    GET "/api/v1/jobs/:job_id/files/internal/*name" => files::job_internal_file, admin by(ops);
}
