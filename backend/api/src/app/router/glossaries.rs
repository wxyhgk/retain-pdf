//! 术语表。

use crate::app::AppState;
use crate::routes::glossaries;

crate::endpoints! {
    state: AppState;
    owner: glossaries;
    /// 解析一段 CSV（不保存），预览导入结果
    POST "/api/v1/glossaries/parse-csv" => glossaries::parse_glossary_csv_route, signed by(web);
    /// 新建术语表
    POST "/api/v1/glossaries" => glossaries::create_glossary_route, signed by(web);
    /// 术语表列表（不分页；`?enabled=true` 只列启用的）
    GET "/api/v1/glossaries" => glossaries::list_glossaries_route, signed by(web);
    /// 一张术语表
    GET "/api/v1/glossaries/:glossary_id" => glossaries::get_glossary_route, signed by(web);
    /// 整份保存术语表（没给的描述、语言、启用保留原值；可带 `expected_updated_at`）
    PUT "/api/v1/glossaries/:glossary_id" => glossaries::update_glossary_route, signed by(web);
    /// 删除术语表
    DELETE "/api/v1/glossaries/:glossary_id" => glossaries::delete_glossary_route, signed by(web);
    /// 导出成 CSV
    GET "/api/v1/glossaries/:glossary_id/export.csv" => glossaries::export_glossary_csv_route, signed by(web);
}
