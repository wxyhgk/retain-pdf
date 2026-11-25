//! 内部：翻译工作进程调模型。凭只对一个任务有效的短期能力令牌，处理函数自己验，挂在应用 API 密钥的认证之外。
//! 能力令牌由任务运行时在进程内直接发；以前的签发接口 `POST …/capability`（要应用 API 密钥）没有调用方，2026-10-22 删了。
//! 成功时回裸 JSON（不带信封），报错走统一的错误信封。

pub(super) mod worker {
    use crate::app::AppState;
    use crate::routes::model_requests;

    crate::endpoints! {
        state: AppState;
    owner: providers;
        /// 工作进程提交一次模型调用（凭能力令牌，返回不带信封）
        POST "/api/v1/internal/model/jobs/:job_id/requests" => model_requests::submit, closed by(worker) [large_body];
        /// 一次模型调用的状态和结果（返回不带信封）
        GET "/api/v1/internal/model/jobs/:job_id/requests/:operation_id" => model_requests::status, closed by(worker);
        /// 取消一次模型调用（返回不带信封）
        POST "/api/v1/internal/model/jobs/:job_id/requests/:operation_id/cancel" => model_requests::cancel, closed by(worker);
    }
}
