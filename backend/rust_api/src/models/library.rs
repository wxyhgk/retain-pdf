use serde::{Deserialize, Serialize};

fn default_documents_limit() -> u32 {
    50
}

/// Tài liệu:Thư viện Công dân hạng nhất,document_id = sha256(Byte Tệp)。
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DocumentRecord {
    pub document_id: String,
    pub title: String,
    pub authors_json: String,
    pub year: Option<i64>,
    pub doi: String,
    pub source_filename: String,
    pub page_count: u32,
    pub bytes: u64,
    pub active_job_id: Option<String>,
    pub reading_status: String,
    pub added_at: String,
    pub last_opened_at: Option<String>,
    pub updated_at: String,
    pub tags: Vec<String>,
    /// nguồn PDF TẢI VỀ URL（Danh sách/Chi tiết từ API Lớp đệm，Không lưu kho）
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub source_pdf_url: String,
    /// Ảnh bìa URL（Danh sách/Chi tiết từ API Lớp đệm，Không lưu kho）
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub cover_url: String,
    /// Hiện các ảnh mẫu URL（Danh sách/Chi tiết từ API Lớp đệm，Không lưu kho）
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub thumbnail_url: String,
}

/// Yêu thích:Neo = (document_id, job_id, page_idx, block_id[, khu vực tuyển cử]) + Ảnh chụp nhanh trích dẫn。
/// job_id Đánh dấu phiên bản của không gian khối nơi neo được đặt;Tham chiếu job Không cho phép xóa riêng lẻ。
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FavoriteRecord {
    pub favorite_id: String,
    pub document_id: String,
    pub job_id: String,
    pub page_idx: i64,
    pub block_id: String,
    pub char_start: Option<i64>,
    pub char_end: Option<i64>,
    pub kind: String,
    pub quote_text: String,
    pub translated_quote_text: String,
    pub note: String,
    /// Tệp đính kèm hình ảnh(assets.asset_id,Địa chỉ nội dung);Chuỗi trống = Thu thập văn bản thuần túy
    #[serde(default)]
    pub asset_id: String,
    /// Ảnh chụp màn hình cắt hình chữ nhật(Hệ tọa độ front-end,Thu thập dữ liệu toàn bộ quyền truy cập)
    #[serde(default)]
    pub rect_json: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Tài sản nhị phân địa chỉ nội dung(Ảnh chụp màn hình yêu thích, v.v.);Bản thể học tài liệu trong data/assets/<2>/<hash>。
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssetRecord {
    pub asset_id: String,
    pub mime: String,
    pub bytes: u64,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub created_at: String,
}

/// AI Phiên hỏi đáp。document_id Trống = Hỏi & Đáp Toàn Bộ Thư Viện。
/// head_id: Thông báo Lá cho Nhánh Hiển thị Hiện tại id(Trống = dùng max(seq) suy đoán)。
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversationRecord {
    pub conversation_id: String,
    pub title: String,
    pub document_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub message_count: i64,
    /// Hoa lá nhìn thấy được hiện tại;Chuỗi trống có nghĩa là không được đặt rõ ràng。
    #[serde(default)]
    pub head_id: String,
}

/// Tin nhắn hội thoại。citations_json Là ảnh chụp nhanh neo mềm:job Sau khi xóa, bước nhảy không hợp lệ nhưng nội dung không bị mất。
/// parent_id: bên cây;Trống = Cột。cùng parent Nhiều người là anh em chi nhánh(thử lại/HIệu chỉnh)。
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MessageRecord {
    pub message_id: String,
    pub conversation_id: String,
    pub seq: i64,
    pub role: String,
    pub content: String,
    pub citations_json: String,
    pub tool_trace_json: String,
    pub model: String,
    pub created_at: String,
    /// Tin nhắn của phụ huynh id;Chuỗi trống = Nút Gốc。
    #[serde(default)]
    pub parent_id: String,
}

/// Thư mục danh mục(Bộ sưu tập)。v1 Chỉ hiển thị với cấu trúc phẳng,parent_id Dành riêng cho các danh mục con lồng nhau trong tương lai
/// (Lên kế hoạch khi bạn xây dựng bảng,Hiện tại liên tục None,Đây không phải là khoản nợ kỹ thuật sẽ bị phá hủy lần này)。
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CollectionRecord {
    pub collection_id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    /// Số lượng tài liệu hiện tại trong thư mục này;Chỉ có giao diện danh sách sẽ được điền vào,Một truy vấn duy nhất luôn luôn là 0。
    #[serde(default)]
    pub document_count: i64,
}

/// blocks_fts Một hàng(Chỉ số dẫn xuất,Sẵn sàng để được xây dựng lại từ sản phẩm nhiệm vụ)。
#[derive(Debug, Clone)]
pub struct FtsBlockRow {
    pub page_idx: i64,
    pub block_id: String,
    pub source_text: String,
    pub translated_text: String,
}

/// Số lần truy xuất toàn văn bản:Với neo đầy đủ,Trình đọc bỏ qua giao diện người dùng tại chỗ。
#[derive(Debug, Serialize, Clone)]
pub struct BlockSearchHit {
    pub document_id: String,
    pub job_id: String,
    pub page_idx: i64,
    pub block_id: String,
    pub source_snippet: String,
    pub translated_snippet: String,
}

/// GET /api/v1/documents Thông số truy vấn。
#[derive(Debug, Deserialize)]
pub struct ListDocumentsQuery {
    #[serde(default = "default_documents_limit")]
    pub limit: u32,
    #[serde(default)]
    pub offset: u32,
    pub reading_status: Option<String>,
    pub tag: Option<String>,
    pub collection_id: Option<String>,
    /// Bởi Bất kỳ job_id(Có lịch sử run)Đi thẳng đến giấy tờ thuộc về,Không cần quét danh sách để kiểm tra lại ở mặt trước
    pub job_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DocumentListView {
    pub documents: Vec<DocumentRecord>,
}

/// PATCH /api/v1/documents/:id
#[derive(Debug, Deserialize)]
pub struct PatchDocumentInput {
    pub title: Option<String>,
    pub reading_status: Option<String>,
    pub tags: Option<Vec<String>>,
}

/// POST /api/v1/favorites
#[derive(Debug, Deserialize)]
pub struct CreateFavoriteInput {
    /// Có thể mặc định:cho job_id Khi phụ trợ tự động phân tích tài liệu thuộc về(Sử học run Bạn cũng có thể thu thập)
    #[serde(default)]
    pub document_id: String,
    /// Chặn không gian nơi neo được đặt;Tài liệu mặc định hiện tại active_job_id
    pub job_id: Option<String>,
    pub page_idx: i64,
    pub block_id: String,
    pub char_start: Option<i64>,
    pub char_end: Option<i64>,
    #[serde(default)]
    pub kind: Option<String>,
    pub quote_text: String,
    #[serde(default)]
    pub translated_quote_text: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
    /// Tệp đính kèm hình ảnh:trước POST /api/v1/assets cầm asset_id Cúp máy lần nữa(kind Khuyến nghị figure)
    #[serde(default)]
    pub asset_id: Option<String>,
    /// Ảnh chụp màn hình cắt hình chữ nhật(Hệ tọa độ front-end nguyên trạng)
    #[serde(default)]
    pub rect_json: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListFavoritesQuery {
    pub document_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FavoriteListView {
    pub favorites: Vec<FavoriteRecord>,
}

#[derive(Debug, Deserialize)]
pub struct PatchFavoriteInput {
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FavoriteMutationResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted: Option<bool>,
}

fn default_search_limit() -> u32 {
    20
}

/// GET /api/v1/search
#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    #[serde(default = "default_search_limit")]
    pub limit: u32,
    /// Tài liệu đặt hàng đủ điều kiện（Đầu đọc / AI Toàn bộ phần hỏi đáp）；Trống = Toàn bộ thư viện
    #[serde(default)]
    pub document_id: String,
}

#[derive(Debug, Serialize)]
pub struct SearchResultView {
    pub query: String,
    pub hits: Vec<BlockSearchHit>,
}

// --- conversations ---

#[derive(Debug, Deserialize)]
pub struct CreateConversationInput {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub document_id: String,
}

fn default_conversations_limit() -> u32 {
    50
}

#[derive(Debug, Deserialize)]
pub struct ListConversationsQuery {
    #[serde(default = "default_conversations_limit")]
    pub limit: u32,
    #[serde(default)]
    pub offset: u32,
    /// Lọc theo tài liệu;Trống = Tất cả。
    #[serde(default)]
    pub document_id: String,
}

#[derive(Debug, Serialize)]
pub struct ConversationListView {
    pub conversations: Vec<ConversationRecord>,
}

#[derive(Debug, Serialize)]
pub struct ConversationDetailView {
    #[serde(flatten)]
    pub conversation: ConversationRecord,
    pub messages: Vec<MessageRecord>,
}

#[derive(Debug, Deserialize)]
pub struct AppendMessageInput {
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub citations_json: String,
    #[serde(default)]
    pub tool_trace_json: String,
    #[serde(default)]
    pub model: String,
    /// Tin nhắn của phụ huynh id;tỉnh lược/Trống = Giữ nguyên trạng thái hiện tại head(Tiếp tục tuyến tính)。
    #[serde(default)]
    pub parent_id: String,
    /// Tính ổn định của khách hàng id(VÀ assistant-ui store id xếp hợp lý);Null sau đó tạo phía máy chủ。
    #[serde(default)]
    pub message_id: String,
    /// Bạn có muốn thêm head Chỉ vào bài viết này;ngầm thừa nhận true。
    #[serde(default = "default_true")]
    pub set_head: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize)]
pub struct PatchConversationInput {
    /// Bật/Tắt Nút Lá Nhánh Có Thể Nhìn Thấy。
    #[serde(default)]
    pub head_id: String,
    #[serde(default)]
    pub title: String,
}

#[derive(Debug, Serialize)]
pub struct ConversationMutationResult {
    pub deleted: bool,
}

// --- collections ---

#[derive(Debug, Deserialize)]
pub struct CreateCollectionInput {
    pub name: String,
    #[serde(default)]
    pub parent_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CollectionListView {
    pub collections: Vec<CollectionRecord>,
}

#[derive(Debug, Deserialize)]
pub struct PatchCollectionInput {
    pub name: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct AddCollectionDocumentsInput {
    pub document_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct CollectionMutationResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub removed: Option<bool>,
}
