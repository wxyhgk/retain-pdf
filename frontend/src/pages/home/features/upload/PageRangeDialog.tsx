// Hộp thoại dịch chuyên nghiệp (phiên bản React của <page-range-dialog>, đối chiếu với components/dialogs/page-range-dialog.js).
//
// Lớp render Dialog (đợt kết thúc giai đoạn C, cải tiến shadcn): chuyển từ <dialog> gốc + showModal/close
// sang nguyên mẫu Dialog của radix-ui (DialogPrimitive.Root/Portal/Overlay/Content),
// tiếp tục sử dụng hệ thống giao diện desktop-dialog/desktop-shell hiện có, không áp dụng giao diện mặc định.
// Trạng thái mở/đóng vẫn là trường pageRangeDialogOpen của store uploadView (nguyên tắc bất di bất dịch: không thay đổi store, chỉ thay đổi lớp render),
// onOpenChange(false) thống nhất gọi uploadViewActions.patch để ghi lại.
//
// Sửa lỗi thực tế đã ghi trong bản thiết kế và commit d238471 (lỗi đã biết tồn đọng): nhấp vào nền
// trước đây kích hoạt uploadFeature.applyPageRanges() (tương đương với "xác nhận áp dụng"), trong khi Escape
// lại đi theo một đường khác chỉ xóa cờ pageRangeDialogOpen mà không áp dụng —— cùng một hộp thoại nhưng hai cách đóng có ngữ nghĩa không nhất quán,
// và không tuân thủ quy ước của 8 hộp thoại khác "nền/Esc/nút đóng đều là đóng thuần túy".
// Ở đây thống nhất thành ngữ nghĩa đóng thuần túy: ba cách đóng (nhấp nền đi qua phát hiện onPointerDownOutside/outside-click của Radix,
// Esc, nút đóng DialogPrimitive.Close) đều chỉ patch pageRangeDialogOpen:false, không kích hoạt bất kỳ tác dụng phụ áp dụng nào.
//
// Đã xác nhận không gây mất chức năng: đọc upload/controller.js#applyPageRanges cho thấy toàn bộ triển khai của nó
// chỉ là viewPort.closePageRangeDialog() —— hộp thoại này từ lâu đã không còn trường riêng biệt
// "chỉ áp dụng sau khi xác nhận" (phạm vi trang được đọc/ghi trực tiếp trong ô nhập của khu vực tải lên, lựa chọn bảng thuật ngữ cũng
// ghi trực tiếp vào store qua <select onChange>, cả hai đều có hiệu lực ngay lập tức, không cần hộp thoại này phê duyệt).
// Điều này có nghĩa là apply và "đóng thuần túy" trong triển khai hiện tại vốn đã là một, thống nhất ngữ nghĩa không làm mất đi bất kỳ
// đường dẫn thao tác nào mà người dùng có thể thực hiện: nút "Hoàn tất" (#page-range-apply-btn) bên trong hộp thoại vẫn còn,
// hiệu ứng giống hệt với nhấp nền/Esc.
//
// Dropdown bảng thuật ngữ được điều khiển bởi glossaries/selectedGlossaryId của workflow store
// (phản ánh ngữ nghĩa tùy chọn của setDeveloperGlossaryOptions trong workflow/view.js, bao gồm tùy chọn dự phòng
// "Đã xóa hoặc không khả dụng").
//
// Nút kích hoạt (HeroUpload.jsx của #page-range-btn) và hộp thoại này nằm trên các cây con khác nhau, cơ chế trả lại tiêu điểm triggerRef mặc định của Radix không hoạt động,
// tái sử dụng use-dialog-return-focus.js (tương tự như 8 hộp thoại khác).

import { Dialog as DialogPrimitive } from "radix-ui";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";

export function PageRangeDialog() {
  const services = useHomeServices();
  const upload = useStoreSnapshot(services.stores.uploadView);
  const workflow = useStoreSnapshot(services.stores.workflowView);

  const open = Boolean(upload.pageRangeDialogOpen);
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  // Esc / click nền / nút đóng đều đi qua callback này để ghi lại store, chỉ đóng thuần, không kích hoạt side-effect của app.
  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      services.uploadViewActions.patch({ pageRangeDialogOpen: false });
    }
  }

  const selectedId = `${workflow.selectedGlossaryId || ""}`.trim();
  const hasSelected = !selectedId
    || workflow.glossaries.some((glossary) => glossary.glossaryId === selectedId);

  return (
    <page-range-dialog data-hydrated="1">
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="desktop-dialog-overlay" />
          <DialogPrimitive.Content
            id="page-range-dialog"
            className="desktop-dialog page-range-dialog professional-translate-dialog"
            onCloseAutoFocus={onCloseAutoFocus}
          >
            <div className="desktop-shell">
              <div className="desktop-head">
                <DialogPrimitive.Title asChild>
                  <h2 id="page-range-title">Dịch chuyên nghiệp</h2>
                </DialogPrimitive.Title>
                <DialogPrimitive.Close asChild>
                   <button id="page-range-close-btn" type="button" className="dialog-close-btn" aria-label="Đóng">×</button>
                </DialogPrimitive.Close>
              </div>
              <div className="desktop-body">
                 <p id="page-range-limit-text" className="muted">Chọn bảng thuật ngữ cho lần dịch này. Phạm vi trang có thể điền trực tiếp trong khu vực tải lên.</p>
                <label className="professional-glossary-field">
                   <span>Bảng thuật ngữ</span>
                  <select
                    id="job-glossary-id"
                    value={selectedId}
                    onChange={(event) => services.workflowViewActions.setSelectedGlossaryId(event.target.value)}
                  >
                     <option value="">Không sử dụng bảng thuật ngữ</option>
                    {workflow.glossaries.map((glossary) => (
                      <option key={glossary.glossaryId} value={glossary.glossaryId}>
                        {glossary.name}
                        {Number.isFinite(glossary.entryCount) ? ` (${glossary.entryCount})` : ""}
                      </option>
                    ))}
                    {!hasSelected ? (
                      <option value={selectedId}>                         {`Đã xóa hoặc không khả dụng: ${selectedId}`}</option>
                    ) : null}
                  </select>
                </label>
                <div className="actions">
                  <button
                    id="page-range-clear-btn"
                    type="button"
                    className="app-button secondary"
                    onClick={() => services.features.uploadFeature?.clearPageRanges()}
                   >
                     Bỏ chọn
                  </button>
                  <button
                    id="page-range-apply-btn"
                    type="button"
                    className="app-button"
                    onClick={() => services.features.uploadFeature?.applyPageRanges()}
                   >
                     Hoàn tất
                  </button>
                </div>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </page-range-dialog>
  );
}
