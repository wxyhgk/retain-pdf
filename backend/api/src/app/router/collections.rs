//! 合集：把几本书放在一起（文件夹），以及合集的 Agent 工作区。

use crate::app::AppState;
use crate::routes::collections;

crate::endpoints! {
    state: AppState;
    /// 新建合集
    POST "/api/v1/collections" => collections::create_collection_route, signed;
    /// 合集列表
    GET "/api/v1/collections" => collections::list_collections_route, signed;
    /// 改合集（名字、排序）
    PATCH "/api/v1/collections/:collection_id" => collections::patch_collection_route, signed;
    /// 删除合集
    DELETE "/api/v1/collections/:collection_id" => collections::delete_collection_route, signed;
    /// 往合集里加书
    POST "/api/v1/collections/:collection_id/documents" => collections::add_collection_documents_route, signed;
    /// 从合集里拿掉一本书
    DELETE "/api/v1/collections/:collection_id/documents/:document_id" => collections::remove_collection_document_route, signed;
}
