//! 多设备同步：同步文件夹的设置、手动同步一次、测试。

use crate::app::AppState;
use crate::routes::sync;

crate::endpoints! {
    state: AppState;
    owner: platform;
    /// 同步设置和上次同步的结果
    GET "/api/v1/sync" => sync::get_sync_route, admin by(web, cli);
    /// 保存同步设置
    PUT "/api/v1/sync" => sync::update_sync_route, admin by(web, cli);
    /// 马上同步一次
    POST "/api/v1/sync/run" => sync::run_sync_route, admin by(web, cli);
    /// 测试同步文件夹能不能用
    POST "/api/v1/sync/test" => sync::test_sync_route, admin by(web, cli);
}
