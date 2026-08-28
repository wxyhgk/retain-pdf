// Cửa vào ra ngoài của miền library — trang/composition chỉ import từ đây, đừng đào sâu
// đường dẫn con (trừ kiểm thử).
//
// Cấu trúc thư mục:
//   shell/      vỏ chung (BookCard, BookListRow)
//   actions/    nhà máy thao tác thẻ (read / translate)
//   display/    trợ giúp trình bày (bìa, huy hiệu)
//   page/       dàn trang thư viện (lưới, thanh công cụ, viewPort)
//   categories/ tab bộ sưu tập
//   favorites/  tab yêu thích (trích dẫn/ghi chú)
//   detail/     chi tiết sách (vỏ shell + vùng chứa Dialog)
//   domain/     controller miền

export { BookCard, BookCardActionButton, cardSignatureOf } from "./shell/BookCard.jsx";
export { BookListRow } from "./shell/BookListRow.jsx";
export {
  RecentJobCard,
  getCardRenderCountForTests,
  resetCardRenderCountsForTests,
} from "./shell/RecentJobCard.jsx";

export {
  buildDefaultBookCardActions,
  buildShelfBookCardActions,
  buildReadBookCardAction,
  buildTranslateBookCardAction,
  bookCardActionsSignature,
  BOOK_CARD_ACTION_READ,
  BOOK_CARD_ACTION_TRANSLATE,
} from "./actions/index.js";

export { RecentJobsLibrary, useLibrarySearchBinding } from "./page/RecentJobsLibrary.jsx";
export { createRecentJobsReactViewPort } from "./page/recent-jobs-react-port.js";
export { createLibraryViewStore } from "./page/library-view-store.js";
export { LibraryTopTabs } from "./page/LibraryTopTabs.jsx";

export { CategoriesView } from "./categories/CategoriesView.jsx";
export { FavoritesView } from "./favorites/FavoritesView.jsx";

export { BookDetailDialog } from "./detail/BookDetailDialog.jsx";
export { BookDetailShell } from "./detail/shell/BookDetailShell.jsx";
export {
  BookDetailRightTabs,
  BookDetailOverviewTab,
  BookDetailTranslateTab,
  BookDetailMoreTab,
  BOOK_DETAIL_TABS,
} from "./detail/tabs/index.js";
export { createBookDetailDialogStore } from "./detail/book-detail-dialog-store.js";

export { createLibraryController } from "./domain/controller.js";

export type {
  AutoLoadCheckOptions,
  BookCardAction,
  BookCardActionHandlers,
  DeleteCardTarget,
  DeleteDocumentsResult,
  JobSubmissionView,
  LibraryBackgroundStage,
  LibraryBookSummary,
  LibraryCardBadge,
  LibraryCardItem,
  LibraryController,
  LibraryControllerDeps,
  LibraryEventPort,
  LibraryJobItem,
  LibraryProgress,
  LibraryRuntimeStatus,
  LibraryViewActions,
  LibraryViewMode,
  LibraryViewState,
  LibraryViewStore,
  RecentJobItem,
  RecentJobsReactViewPort,
  RecentJobsReactViewPortOptions,
  RecentJobsViewPortHandlers,
  ReloadRecentJobsOptions,
  TranslateDocumentPayload,
  UpdateDocumentPayload,
} from "./types.js";
