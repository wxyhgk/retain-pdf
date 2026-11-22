//! 字体：排版能用的字体。

use crate::app::AppState;
use crate::routes::fonts;

crate::endpoints! {
    state: AppState;
    owner: platform;
    /// 能用的字体
    GET "/api/v1/fonts" => fonts::list_fonts, signed by(web);
    /// 上传字体（不限请求体大小）
    POST "/api/v1/fonts/upload" => fonts::upload_font, admin by(none) [unlimited_body];
}
