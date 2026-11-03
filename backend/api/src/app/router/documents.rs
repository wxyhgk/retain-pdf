//! 书（文档）：一本 PDF 是一本书，同一本书的多个任务挂在它下面；书本身的文件；全文检索。

use crate::app::AppState;
use crate::routes::library_data;

crate::endpoints! {
    state: AppState;
    /// 书列表
    GET "/api/v1/documents" => library_data::list_documents_route, signed;
    /// 一本书
    GET "/api/v1/documents/:document_id" => library_data::get_document_route, signed;
    /// 改书的信息（书名、阅读状态）
    PATCH "/api/v1/documents/:document_id" => library_data::patch_document_route, signed;
    /// 删除一本书和它的任务
    DELETE "/api/v1/documents/:document_id" => library_data::delete_document_route, signed;
    /// 哪些页已经有译文
    GET "/api/v1/documents/:document_id/translation-coverage" => library_data::get_document_translation_coverage_route, signed;
    /// 阅读这本书该打开哪个任务（含合并阅读）
    GET "/api/v1/documents/:document_id/reading" => library_data::get_document_reading_route, signed;
    /// 书本身的文件清单：原文、封面、缩略图、原文页预览
    GET "/api/v1/documents/:document_id/files" => library_data::list_document_files_route, signed;
    /// 取书的一个文件：source.pdf、cover.jpg、thumbnail.jpg
    GET "/api/v1/documents/:document_id/files/:name" => library_data::document_file_route, signed;
    /// 原文某一页的预览图
    GET "/api/v1/documents/:document_id/files/pages/:page" => library_data::document_page_file_route, signed;
    /// 翻译这本书（建翻译任务，能复用已有的 OCR）
    POST "/api/v1/documents/:document_id/translate" => library_data::translate_document_route, signed;
    /// 给这本书做 OCR
    POST "/api/v1/documents/:document_id/ocr" => library_data::ocr_document_route, signed;
    /// 书的元信息建议（书名、作者……）
    GET "/api/v1/documents/:document_id/metadata-suggestions" => library_data::list_document_metadata_suggestions_route, signed;
    /// 生成一条元信息建议
    POST "/api/v1/documents/:document_id/metadata-suggestions" => library_data::create_document_metadata_suggestion_route, signed;
    /// 采用一条元信息建议
    POST "/api/v1/documents/:document_id/metadata-suggestions/:suggestion_id/apply" => library_data::apply_document_metadata_suggestion_route, signed;
    /// 这本书的任务历史
    GET "/api/v1/documents/:document_id/jobs" => library_data::list_document_jobs_route, signed;
    /// 全文检索
    GET "/api/v1/search" => library_data::search_blocks_route, signed;
}
