import { BookOpen, CheckCircle2, CheckSquare2, Clock3, FileUp, History, Layers3, Loader2, Sparkles, Tags } from 'lucide-react'

import type { LibraryBookStatus, LibraryNavKey, LibrarySortItem, LibraryStatusFilterItem } from './types'
import type { LibrarySettingsSectionView } from './components/library-settings-dialog/library-settings-types'

export const libraryStatusMeta = {
  processing: { label: 'Đang xử lý', icon: Loader2, spinning: true },
  ready: { label: 'Đã hoàn tất', icon: CheckCircle2, spinning: false },
  queued: { label: 'Đang xếp hàng', icon: Clock3, spinning: false },
} satisfies Record<LibraryBookStatus, { label: string; icon: typeof BookOpen; spinning: boolean }>

export const libraryNavDefinitions = [
  { key: 'all', label: 'Tất cả sách', icon: BookOpen },
  { key: 'processing', label: 'Đang xử lý', icon: Loader2 },
  { key: 'ready', label: 'Đã hoàn tất', icon: CheckCircle2 },
  { key: 'queued', label: 'Đang xếp hàng', icon: Clock3 },
  { key: 'authors', label: 'Tác giả', icon: Layers3 },
  { key: 'tags', label: 'Thẻ', icon: Tags },
] satisfies Array<{ key: LibraryNavKey; label: string; icon: typeof BookOpen }>

export const librarySortItems: LibrarySortItem[] = [
  { key: 'recent', label: 'Mới thêm gần đây' },
  { key: 'title', label: 'Tiêu đề' },
  { key: 'authors', label: 'Tác giả' },
  { key: 'pages', label: 'Số trang' },
]

export const libraryStatusFilterItems: LibraryStatusFilterItem[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'ready', label: 'Đã hoàn tất' },
  { key: 'processing', label: 'Đang xử lý' },
  { key: 'queued', label: 'Đang xếp hàng' },
]

export const libraryCopy = {
  topBar: {
    appName: 'Thư viện',
    searchPlaceholder: 'Tìm tên sách, tác giả hoặc tác vụ',
    settingsLabel: 'Cài đặt',
  },
  header: {
    title: 'Thư viện',
    searchAction: 'Tìm sách',
    addAction: 'Thêm PDF',
    summary: (totalBooks: number, activeCount: number) => `${totalBooks} sách · ${activeCount} đang xử lý`,
  },
  activity: {
    title: 'Hoạt động gần đây',
    liveLabel: 'Trực tiếp',
  },
  filter: {
    viewLabel: 'Xem bìa',
  },
  sidePanel: {
    title: 'Tính năng',
    openLabel: 'Mở thanh tính năng',
    closeLabel: 'Thu thanh tính năng',
    items: [
      { key: 'upload', label: 'Tải PDF lên', description: 'Thêm sách mới', icon: FileUp },
      { key: 'selection', label: 'Chọn nhiều', description: 'Quản lý hàng loạt', icon: CheckSquare2 },
      { key: 'recent', label: 'Tác vụ gần đây', description: 'Xem lịch sử xử lý', icon: History },
      { key: 'processing', label: 'Đang xử lý', description: 'Xem tác vụ hiện tại', icon: Loader2 },
      { key: 'tools', label: 'Công cụ', description: 'Dành chỗ cho tiện ích mở rộng', icon: Sparkles },
    ],
  },
  selection: {
    deleteSelected: 'Xóa mục đã chọn',
    clear: 'Bỏ chọn',
    selectedCount: (count: number) => `Đã chọn ${count} sách`,
    deleteConfirm: (count: number) => `Bạn chắc muốn xóa ${count} sách đã chọn không?`,
  },
  empty: {
    title: 'Chưa có sách',
    description: 'Bạn có thể tải PDF lên từ đây hoặc xem các tác vụ đã xử lý sau khi kết nối backend.',
  },
  cover: {
    brand: 'RetainPDF',
    pageUnit: 'trang',
  },
  detail: {
    tabs: {
      overview: 'Chi tiết',
      translation: 'Dịch',
      artifacts: 'Tệp',
      progress: 'Tiến độ',
    },
    sections: {
      overview: 'Chi tiết sách',
      translation: 'Tác vụ dịch',
      artifacts: 'Tệp đầu ra',
      progress: 'Tiến độ tác vụ',
    },
    fields: {
      pages: 'Số trang',
      status: 'Trạng thái',
      updatedAt: 'Cập nhật',
      workflow: 'Quy trình',
      language: 'Ngôn ngữ',
      ocrProvider: 'OCR',
      translationEngine: 'Dịch',
      fileSize: 'Tệp',
      createdAt: 'Tạo lúc',
    },
    actions: {
      reader: 'Đọc đối chiếu',
      downloadPdf: 'Tải PDF',
      downloadingPdf: 'Đang tải',
      downloadArtifact: 'Tải tệp',
      deleteBook: 'Xóa',
      deletingBook: 'Đang xóa',
    },
    deleteConfirm: 'Bạn chắc muốn xóa sách này không? Lịch sử tác vụ và tệp đầu ra liên quan sẽ bị xóa.',
    forceDeleteConfirm: 'Tác vụ vẫn đang chạy hoặc xếp hàng. Bạn có muốn buộc xóa không?',
    loading: 'Đang đọc chi tiết từ backend...',
    fallback: {
      description: 'Chưa có mô tả sách',
      unknown: 'Không rõ',
    },
    artifactState: {
      ready: 'Sẵn sàng',
      processing: 'Đang tạo',
      queued: 'Đang chờ',
    },
    progressState: {
      active: 'Hiện tại',
      done: 'Hoàn tất',
      selected: 'Xem',
      pending: 'Chờ',
    },
  },
  dialog: {
    close: 'Đóng',
    closeBackdrop: 'Đóng hộp thoại',
  },
  reader: {
    loading: 'Đang tải PDF, sau đó bắt đầu đọc...',
    loadingSource: 'Đang tải PDF gốc...',
    loadingTranslated: 'Đang tải PDF bản dịch...',
    ready: 'Đã sẵn sàng đọc đối chiếu',
    error: 'Không tải được chế độ đọc đối chiếu',
    sourcePdf: 'PDF gốc',
    translatedPdf: 'PDF bản dịch',
    sourceShort: 'Bản gốc',
    translatedShort: 'Bản dịch',
    sourceEmpty: 'Không có PDF gốc',
    translatedEmpty: 'Không có PDF bản dịch',
    downloadSource: 'Tải bản gốc',
    downloadTranslated: 'Tải bản dịch',
    loadedCount: (count: number) => `Đã tải ${count}/2 PDF`,
  },
  settings: {
    title: 'Cài đặt',
    sections: [
      {
        key: 'translation',
        title: 'Dịch',
        description: 'Sau này cấu hình model dịch, mức đồng thời, bảng thuật ngữ và ngôn ngữ đích mặc định tại đây.',
        items: ['Ngôn ngữ đích mặc định', 'Model dịch', 'Số tác vụ đồng thời', 'Bảng thuật ngữ'],
      },
      {
        key: 'ocr',
        title: 'OCR',
        description: 'Sau này cấu hình dịch vụ OCR, phạm vi trang và chiến lược nhận dạng tại đây.',
        items: ['Dịch vụ OCR mặc định', 'Phạm vi trang', 'Chiến lược nhận dạng', 'Thử lại khi lỗi'],
      },
      {
        key: 'files',
        title: 'Tệp',
        description: 'Sau này cấu hình thư mục tải xuống, cách đặt tên và chính sách giữ tệp đầu ra tại đây.',
        items: ['Thư mục tải xuống', 'Đặt tên tệp', 'Giữ tệp đầu ra', 'Tự động dọn dẹp'],
      },
      {
        key: 'display',
        title: 'Hiển thị',
        description: 'Sau này cấu hình mật độ giá sách, thứ tự mặc định và tùy chọn giao diện tại đây.',
        items: ['Mật độ giá sách', 'Sắp xếp mặc định', 'Hiện tiến độ', 'Ngôn ngữ giao diện'],
      },
    ] satisfies LibrarySettingsSectionView[],
  },
  devPreview: {
    title: 'Component Preview',
    topBarTitle: 'Top Bar',
    bookCardsTitle: 'Book Cards',
    statusTitle: 'Status Card',
  },
}
