//! 按需下载的字体、Typst（安装包里不带，首次启动后台下载）。

use crate::app::AppState;
use crate::routes::runtime_assets;

crate::endpoints! {
    state: AppState;
    /// 字体、Typst 的下载状态和进度
    GET "/api/v1/runtime-assets" => runtime_assets::get_runtime_assets, signed;
    /// 把缺的、下失败的再下一遍（后台下，进度再看上面那个）
    POST "/api/v1/runtime-assets/download" => runtime_assets::download_runtime_assets, admin;
}
