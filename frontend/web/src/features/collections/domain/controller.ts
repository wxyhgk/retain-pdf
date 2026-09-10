import {
  addDocumentsToCollection,
  createCollection,
  deleteCollection,
  fetchDocumentList,
  fetchJobPayload,
  fetchLibraryBookList,
  listCollections,
  patchCollection,
  removeDocumentFromCollection,
} from "@/platform/api/index.js";
import { shapeDocumentsWithBooks } from "@/features/library/index.js";

/** 合集记录。领域真值在本功能内，装配层从 @/features/collections 引用。 */
export type CollectionRecord = {
  collection_id?: string;
  name?: string;
  document_count?: number;
  parent_id?: string | null;
  sort_order?: number;
};

// 合集域的唯一装配面（领域名统一为 collections，历史别名 categories）。
// 这是一个纯 React 时代新建的域,没有旧世界 controller.js 可复用,所以不套其余域那套 mountXFeature()/viewPort 壳子——
// 直接是一层绑好 apiPrefix 的薄函数集合,create-home-composition.ts 建一次实例,
// CollectionsView.jsx（兼容名 CategoriesView）/CollectionManageDialog.jsx 经 services.collections.controller 消费。
// 三名一物映射：features/collections（领域） == LibraryTopTabs key "categories"（UI 契约） == CollectionsView/CategoriesView（视图）

export function createCollectionsController({ apiPrefix }) {
  return {
    listCollections: () => listCollections(apiPrefix),
    createCollection: (payload) => createCollection(apiPrefix, payload),
    patchCollection: (collectionId, payload) => patchCollection(apiPrefix, collectionId, payload),
    deleteCollection: (collectionId) => deleteCollection(apiPrefix, collectionId),
    addDocuments: (collectionId, documentIds) => addDocumentsToCollection(apiPrefix, collectionId, documentIds),
    removeDocument: (collectionId, documentId) => removeDocumentFromCollection(apiPrefix, collectionId, documentId),

    // 管理弹窗的勾选清单:全部文档(document 形状,含 title),够用不需要
    // job 卡片的视觉字段。
    listAllDocuments: async () => {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { limit: 500 });
      return documents;
    },

    // 某个合集当前的成员 document_id 集合(管理弹窗打开已有合集时用来
    // 勾选初始状态)。
    async listCollectionDocumentIds(collectionId) {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { collectionId, limit: 500 });
      return documents.map((doc: { document_id?: string }) => doc.document_id);
    },

    // 文件夹展开/封面预览的数据源:collection_id → 该合集全部文档 → 每篇都
    // 造一张卡片 item(和图书馆主页 document-library-source.js 同一套
    // shapeDocumentCardItem)。
    //
    // 走和图书馆主网格(document-library-source.js)完全同一套 documents →
    // cards 编排(shapeDocumentsWithBooks):已翻译文档叠加 library/books 活态,
    // 馆藏(未翻译)文档造馆藏卡,全部返回。曾经这里是一份发散的旧拷贝、只保
    // 留已翻译文档 → 满是馆藏的合集显示"空合集"(和 document_count 对不上的
    // bug),收口到统一编排后不会再发散。
    async fetchFolderBooks(collectionId) {
      const { documents = [] } = await fetchDocumentList(apiPrefix, { collectionId, limit: 500 });
      return shapeDocumentsWithBooks(documents, {
        fetchLibraryBookList,
        fetchJobPayload,
        apiPrefix,
      });
    },
  };
}
