//! 字体：排版能用的字体。

use crate::app::AppState;
use crate::routes::fonts;

crate::endpoints! {
    state: AppState;
    owner: platform;
    /// 能用的字体
    GET "/api/v1/fonts" => fonts::list_fonts, signed by(web);
    // 上传字体 `POST /api/v1/fonts/upload` 2026-11-25 删了：没有调用方（10-18 起 0 次）。
}
