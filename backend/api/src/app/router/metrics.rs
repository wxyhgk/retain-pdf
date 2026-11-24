//! 运维指标（Prometheus）。

use crate::app::AppState;
use crate::routes::metrics;

crate::endpoints! {
    state: AppState;
    owner: platform;
    /// Prometheus 文本格式的指标：按接口的请求数、状态码分类、耗时直方图，排队中、运行中的任务数等
    GET "/metrics" => metrics::metrics, admin by(ops);
}
