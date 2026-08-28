// home trang React Choreography Root。
//
// Kiểm soát kết cấu partials/main-content.html + dialogs.html Chặn theo phản chiếu khối;Chỉ để ở trên cùng
// Thương hiệu  + Thư viện/Cột danh mục(AppTopBar.jsx,Xóa nền thẻ trắng);tăng thêm/Tìm kiếm/Thiết lập Ba
// Chèn thanh nổi ở giữa đáy(AppBottomBar.jsx,Thay thế cách ly trước đó AppBottomActions +
// LibrarySearchDock Hai hòn đảo nổi)。
// Khối còn lại(library-view Lưới、status Cái、credentials/glossaries/status-detail chờ)
// được kết nối lần lượt;ReaderDialog Chỉ chuyển đến reader.html(Không có UI)。
// Nhãn thành phần tùy chỉnh của trình giữ chỗ(<recent-jobs-dialog> chờ)Không đăng ký định nghĩa trong Thế giới mới,Indolent Không có tác dụng phụ。

import { useState } from "react";
import { HomeServicesProvider } from "./home-services-context.js";
import type { HomeServices } from "./composition/types.js";
import { AppTopBar } from "./features/app-shell/AppTopBar.jsx";
import { AppBottomBar } from "./features/app-shell/AppBottomBar.jsx";
import { MockModeBanner } from "./features/app-shell/MockModeBanner.jsx";
import { TranslationWorkflowDialog } from "./features/workflow/TranslationWorkflowDialog.jsx";
import { PageRangeDialog } from "./features/upload/PageRangeDialog.jsx";
import {
  RecentJobsLibrary,
  CategoriesView,
  FavoritesView,
  BookDetailDialog,
} from "./features/library/index.js";
import { HomeAskView } from "./features/home-ask/HomeAskView.js";
import { CredentialsDialog } from "./features/credentials/CredentialsDialog.jsx";
import { GlossariesDialog } from "./features/glossaries/GlossariesDialog.jsx";
import { SettingsHubDialog } from "./features/settings/SettingsHubDialog.jsx";
import { StatusDetailDialog } from "./features/status-detail/StatusDetailDialog.jsx";
import { ReaderDialog } from "./features/reader/ReaderDialog.jsx";
import { SoftReaderHost } from "./features/reader/SoftReaderHost.jsx";
import { CollectionManageDialog } from "./features/collections/CollectionManageDialog.jsx";
import { DownloadToastHost } from "../../shared/react/DownloadToastHost.jsx";
import {
  readInitialLibraryTabFromReturn,
  useHomeReturnRestore,
} from "./features/library/page/useHomeReturnRestore.js";
// library-search-island: Điểm đăng ký duy nhất cho các custom elements.
// Thế giới cũ dùng src/js/components/index.js để đăng ký side-effect import;
// Sau khi xóa file này trong cutover, chuỗi đăng ký bị đứt sẽ khiến các thẻ
// JSX bên trong <library-search-island> hiển thị thành thẻ trống (hợp đồng dữ liệu vẫn đúng,
// nhưng chức năng tìm kiếm im lặng thất bại - chỉ có thể phát hiện khi render trên trình duyệt thực, jsdom không báo lỗi).
// Tái đăng ký đầy đủ tại đây.
import "../../js/islands/library-search/index.js";

function HomeShell() {
  // Khi trả về từ người đọc, hãy cố gắng khôi phục lại tab；Nếu không, thư viện mặc định。
  const [activeLibraryTab, setActiveLibraryTab] = useState(readInitialLibraryTabFromReturn);
  const isLibraryTab = activeLibraryTab === "library";
  const isCategoriesTab = activeLibraryTab === "categories";
  const isFavoritesTab = activeLibraryTab === "favorites";
  const isAskTab = activeLibraryTab === "ask";
  // #31 Thanh công cụ lựa chọn hàng loạt và thanh dưới cùng được cố định ở giữa dưới cùng,Được sử dụng ở thanh dưới cùng trong chế độ hàng loạt CSS
  // Ẩn(Không gỡ cài đặt——Tìm kiếm input Việc gỡ cài đặt sẽ gây ra library-search-island vô hiệu hóa tham chiếu cho)nhường ngôi
  // Cung cấp thanh công cụ hàng loạt,Cả hai đều không thể nhìn thấy cùng một lúc。
  const [batchModeActive, setBatchModeActive] = useState(false);

  // Bộ sưu tập/Yêu thích/AI tab：Cố gắng khôi phục bằng cách gắn chế độ xem panel lăn（Thư viện của RecentJobsLibrary Khôi phục sau danh sách）
  useHomeReturnRestore(isCategoriesTab || isFavoritesTab || isAskTab);

  return (
    <>
      <main id="app-shell" className="page app-shell" data-home-spa="">
        <AppTopBar activeTab={activeLibraryTab} onTabChange={setActiveLibraryTab} />
        <MockModeBanner />
        {/* Sân khấu giấy: các lớp chất liệu/tỷ lệ (không phải ghép hình biểu tượng truyền thống); chưa làm bộ lọc thanh bên */}
        <div className="home-paper-stage">
          {isLibraryTab ? (
            <>
              <RecentJobsLibrary {...({ onBatchModeChange: setBatchModeActive } as any)} />
              <AppBottomBar showSearch hidden={batchModeActive} />
              <library-search-island></library-search-island>
            </>
          ) : isCategoriesTab ? (
            <>
              <CategoriesView />
              <AppBottomBar showSearch={false} />
            </>
          ) : isFavoritesTab ? (
            <>
              <FavoritesView />
              <AppBottomBar showSearch={false} />
            </>
          ) : isAskTab ? (
            // AI Cuộc trò chuyện không bị treo ở dưới cùng「Tải lên / Thiết lập」Thanh nổi，Tránh chèn ép khu vực đầu vào
            <HomeAskView />
          ) : null}
        </div>
        <button id="open-query-btn" type="button" className="secondary hidden" aria-hidden="true">Nhiệm vụ gần đây</button>
        {/* Giữ chỗ 3b: hộp thoại nhiệm vụ gần đây */}
        <recent-jobs-dialog></recent-jobs-dialog>
        <SettingsHubDialog />
        <TranslationWorkflowDialog />
      </main>
      {/* Khối dialogs.html: hộp thoại dịch chuyên ngành của vùng upload + vùng credentials đã React hóa, các giữ chỗ còn lại (3b) */}
      <CredentialsDialog />
      <GlossariesDialog />
      <developer-auth-dialog></developer-auth-dialog>
      <developer-settings-dialog></developer-settings-dialog>
      <PageRangeDialog />
      <StatusDetailDialog />
      <ReaderDialog />
      {/* Mở trình đọc mềm: lớp toàn màn hình, trang chủ không gỡ bỏ (đóng × không làm mới) */}
      <SoftReaderHost />
      <CollectionManageDialog />
      <BookDetailDialog />
      <DownloadToastHost />
    </>
  );
}

export function HomeApp({ services }: { services: HomeServices }) {
  return (
    <HomeServicesProvider value={services}>
      <HomeShell />
    </HomeServicesProvider>
  );
}
