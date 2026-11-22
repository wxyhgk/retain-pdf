//! 备份，以及模型用量（和备份一样是「设置」页的数据；一个任务的用量在 jobs 的 reports 里）。

use crate::app::AppState;
use crate::routes::{backups, token_usage};

crate::endpoints! {
    state: AppState;
    owner: platform;
    /// 全部模型用量
    GET "/api/v1/usage" => token_usage::all_usage_route, signed by(web) owner(jobs);
    /// 一本书的模型用量
    GET "/api/v1/documents/:document_id/usage" => token_usage::document_usage_route, signed by(web) owner(jobs);
    /// 按接口地址和模型批量查单价
    POST "/api/v1/usage/prices" => token_usage::price_lookup_route, signed by(none) owner(jobs);
    /// 按书库每页平均估一本还没翻译的书
    GET "/api/v1/usage/estimate" => token_usage::library_usage_estimate_route, signed by(web) owner(jobs);
    /// 这本书换个模型重新翻译大概多少钱
    GET "/api/v1/documents/:document_id/usage/estimate" => token_usage::document_usage_estimate_route, signed by(web) owner(jobs);
    /// 备份列表
    GET "/api/v1/backups" => backups::list_backups_route, admin by(web, cli);
    /// 马上备份一次
    POST "/api/v1/backups" => backups::create_backup_route, admin by(web, cli);
    /// 删除一个备份
    DELETE "/api/v1/backups/:backup_id" => backups::delete_backup_route, admin by(web, cli);
    /// 从备份恢复
    POST "/api/v1/backups/:backup_id/restore" => backups::restore_backup_route, admin by(web, cli);
}
