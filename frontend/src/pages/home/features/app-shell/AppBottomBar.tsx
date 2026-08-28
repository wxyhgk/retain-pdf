// Thanh nổi 3 trong 1 dưới cùng(Yêu cầu người dùng:Thêm bên trái、Đang tìm kiếm、Cài đặt bên phải,Tổng hợp)。
// Hợp nhất cũ AppBottomActions(Thêm góc dưới bên phải/Đặt viên nang)+ LibrarySearchDock
// (Thanh tìm kiếm dưới cùng ở giữa)——Trước đây, có hai hòn đảo nổi của riêng họ.,Bây giờ sụp đổ vào một thanh kính ở giữa。
//
// Hợp đồng id Tất cả đã được bảo lưu:library-add-pdf-btn / app-settings-btn / library-search-input
// (khảo sát + library-search-island Nhấn tất cả các nút này id Tìm phần tử)。
//
// Nghiêm trọng:hidden dùng CSS display:none(Không gỡ cài đặt),Hộp tìm kiếm luôn là DOM Bên trong——
// library-search-island Tại địa điểm: connectedCallback Bên trong getElementById Nắm lấy cái này input Tài liệu tham khảo đã lưu,
// Sau khi gỡ cài đặt và lắp lại(chẳng hạn như chế độ hàng loạt vào và ra)Trích dẫn hết hạn、Im lặng khi tìm kiếm không thành công(Lựa chọn hàng loạt được chôn ở vòng trước
// Nguy hiểm tiềm ẩn)。Ẩn thay vì gỡ cài đặt tại đây,Trích dẫn luôn hợp lệ。
// showSearch=false dùng cho"Loại"tab:nên tab Ngữ nghĩa của tìm kiếm thấp hơn là khác nhau,Không kết xuất input(khảo sát
// Phân loại Xác nhận tab Tiếp theo #library-search-input Không thể, ),Chỉ để lại để thêm/Thiết lập。

import { useHomeServices } from "../../home-services-context.js";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useLibrarySearchBinding } from "../library/page/RecentJobsLibrary.jsx";
import { TRANSLATION_WORKFLOW_DIALOG } from "../../composition/external.js";

export function AppBottomBar({ showSearch = true, hidden = false }) {
  const services = useHomeServices();
  const dialog = useStoreSnapshot(services.stores.dialog);
  const open = Boolean(dialog.open);
  // hooks Không thể gọi có điều kiện——Luôn đăng ký,Chỉ trong showSearch Khi kết xuất input(Loại tab Tiếp theo
  // Cứ lấy đi. query Không hiển thị,Không có tác dụng phụ)。
  const { query, onSearchChange } = useLibrarySearchBinding();

  return (
    <div className={`library-bottom-bar${hidden ? " is-hidden" : ""}`} aria-label="Thanh thao tác nhanh">
      <button
        id="library-add-pdf-btn"
        type="button"
        className={`library-bottom-icon-btn primary${open ? " is-active" : ""}`}
        aria-label="Thêm PDF"
        title="Thêm PDF"
        aria-controls="translation-workflow-dialog"
        aria-expanded={open ? "true" : "false"}
        data-workflow-open={open
          ? TRANSLATION_WORKFLOW_DIALOG.datasetValues.open
          : TRANSLATION_WORKFLOW_DIALOG.datasetValues.closed}
        data-workflow-mode={dialog.mode}
        onClick={() => services.workflowDialog.requestOpenUpload()}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
        {/* Móc trang trí: mặc định không kiểu, không render (các chủ đề không cảm nhận), giao diện có thể dán hình ảnh trong CSS */}
        <span className="library-bottom-icon-btn-ornament" aria-hidden="true" />
      </button>

      {showSearch ? (
        <div className="library-bottom-search" role="search">
          <input
            id="library-search-input"
            type="search"
            autoComplete="off"
            placeholder="Tìm kiếm sách, nhiệm vụ hoặc ngày"
            aria-label="Tìm kiếm sách"
            value={query}
            onChange={onSearchChange}
          />
        </div>
      ) : null}

      <button
        id="app-settings-btn"
        type="button"
        className="library-bottom-icon-btn"
        aria-label="Cài đặt"
        title="Cài đặt"
        aria-controls="app-settings-dialog"
        onClick={() => services.settingsHub.dialogStore.open({ tab: "api" })}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" stroke="currentColor" strokeWidth="1.65" />
          <path d="M19.1 13.2c.06-.39.09-.79.09-1.2s-.03-.81-.09-1.2l2.02-1.55-1.9-3.29-2.38.96a8.01 8.01 0 0 0-2.08-1.2L14.4 3.2h-3.8l-.36 2.52c-.75.28-1.45.69-2.08 1.2l-2.38-.96-1.9 3.29L5.9 10.8c-.06.39-.09.79-.09 1.2s.03.81.09 1.2l-2.02 1.55 1.9 3.29 2.38-.96c.63.51 1.33.92 2.08 1.2l.36 2.52h3.8l.36-2.52c.75-.28 1.45-.69 2.08-1.2l2.38.96 1.9-3.29-2.02-1.55Z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
        </svg>
        {/* Móc trang trí: giống nút thêm, giao diện có thể dán hình ảnh */}
        <span className="library-bottom-icon-btn-ornament" aria-hidden="true" />
      </button>
    </div>
  );
}
