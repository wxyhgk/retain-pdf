//! 数据：通用查询。登记表在契约 job-data.v1 里，新的读需求加一条登记，不加接口。

use crate::app::AppState;
use crate::routes::jobs::data;

crate::endpoints! {
    state: AppState;
    owner: jobs;
    /// 有哪些数据表（按契约 job-data.v1 登记）
    GET "/api/v1/jobs/:job_id/data" => data::job_data_catalog_route, signed by(none);
    /// 按名字查一张表（字段、筛选、分组、分页）
    GET "/api/v1/jobs/:job_id/data/:dataset" => data::job_data_route, signed by(web);
}
