//! `/jobs` 的路由，按 8 类分文件，和 routes/jobs/ 一一对应（分类见 routes/jobs/mod.rs）。
//!
//! 每个文件是一张接口登记表（`crate::endpoints!`，见 `app/endpoints.rs`）。路径都写全：路径参数分类的测试直接读这些字符串。
//! 旧地址 2026-10-18 全删了。以后再改地址：新地址下面紧跟旧地址（行尾写 `old "<新地址>"`，指向同一个处理函数），
//! 访问统计（`data/*/diagnostics/route-usage.json`，`ops/development/route_usage_report.py` 出报表）确认没人用以后再删。

use axum::Router;

use crate::app::endpoints::Endpoint;
use crate::app::AppState;

mod actions;
mod data;
mod files;
mod lifecycle;
mod progress;
mod reader;
mod reports;
mod translations;

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .merge(lifecycle::routes())
        .merge(actions::routes())
        .merge(progress::routes())
        .merge(files::routes())
        .merge(reports::routes())
        .merge(reader::routes())
        .merge(translations::routes())
        .merge(data::routes())
}

/// `/jobs` 下全部接口的登记表。
pub(super) fn endpoints() -> Vec<&'static [Endpoint]> {
    vec![
        lifecycle::ENDPOINTS,
        actions::ENDPOINTS,
        progress::ENDPOINTS,
        files::ENDPOINTS,
        reports::ENDPOINTS,
        reader::ENDPOINTS,
        translations::ENDPOINTS,
        data::ENDPOINTS,
    ]
}
