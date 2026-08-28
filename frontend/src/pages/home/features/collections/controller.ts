import {
  addDocumentsToCollection,
  createCollection,
  deleteCollection,
  listCollections,
  patchCollection,
  removeDocumentFromCollection,
  fetchDocumentList,
  fetchLibraryBookList,
  shapeDocumentsWithBooks,
} from "../../composition/external.js";

// Loại(Bộ sưu tập)Bề mặt lắp ráp duy nhất của miền。Đây là một React Các lĩnh vực mới được tạo ra trong kỷ nguyên,Không Thế Giới Cũ
// controller.js Có thể tái sử dụng,Vì vậy, đừng thiết lập tập hợp các tên miền khác mountXFeature()/viewPort nhà——
// Trực tiếp là một lớp được gắn với nhau apiPrefix Một tập hợp các chức năng mỏng,composition.js Tạo một lượt trải nghiệm một lần,
// CategoriesView.jsx/CollectionManageDialog.jsx Sau khi được chấp thuận của. services.collections.controller
// tiêu phí。

export function createCollectionsController({ apiPrefix }) {
  return {
    listCollections: () => listCollections(apiPrefix),
    createCollection: (payload) => createCollection(apiPrefix, payload),
    patchCollection: (collectionId, payload) => patchCollection(apiPrefix, collectionId, payload),
    deleteCollection: (collectionId) => deleteCollection(apiPrefix, collectionId),
    addDocuments: (collectionId, documentIds) => addDocumentsToCollection(apiPrefix, collectionId, documentIds),
    removeDocument: (collectionId, documentId) => removeDocumentFromCollection(apiPrefix, collectionId, documentId),

    // Quản lý danh sách kiểm tra cửa sổ bật lên:Tất cả tài liệu(document Hình dạng,hàm title),Đủ Không cần thiết
    // job Trường hình ảnh của thẻ。
    listAllDocuments: async () => {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { limit: 500 });
      return documents;
    },

    // Thành viên hiện tại của một thư mục document_id tập hợp(Quản lý cửa sổ bật lên để sử dụng khi mở phân loại hiện có
    // Kiểm tra trạng thái ban đầu)。
    async listCollectionDocumentIds(collectionId) {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { collectionId, limit: 500 });
      return documents.map((doc: { document_id?: string }) => doc.document_id);
    },

    // Mở rộng thư mục/Nguồn dữ liệu xem trước ảnh bìa:collection_id → Tất cả tài liệu trong bộ sưu tập này → Mỗi bài viết
    // Tạo một thẻ item(và Nhà Thư viện document-library-source.js Cùng một bộ
    // shapeDocumentCardItem)。
    //
    // Lưới chính của thư viện và logic (document-library-source.js) hoàn toàn giống nhau:
    // sắp xếp documents → cards (shapeDocumentsWithBooks): lớp phủ tài liệu đã dịch từ library/books đang hoạt động,
    // tài liệu chưa dịch tạo thành thẻ bộ sưu tập, quay lại trang tất cả. Đây là một bản sao tạm thời để đảm bảo
    // giữ lại các tài liệu đã dịch → hiển thị bộ sưu tập đầy đủ thay vì "Bộ sưu tập trống" (và document_count không nhất thiết
    // là bug), loại bỏ sự phân kỳ sau khi thống nhất sắp xếp.
    async fetchFolderBooks(collectionId) {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { collectionId, limit: 500 });
      return shapeDocumentsWithBooks(documents, { fetchLibraryBookList, apiPrefix });
    },
  };
}
