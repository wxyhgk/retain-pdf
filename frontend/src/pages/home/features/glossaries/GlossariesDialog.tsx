// GlossariesDialog(React bản <glossary-manager-dialog>,so sánh
// components/dialogs/glossary-manager-dialog-template.js đuổi id ảnh phản chiếu +
// features/glossaries/controller.js(kept Kiểm soát viên)Mở và đóng/chọn đọc/Lưu biên đạo múa)。
//
// Dialog Lớp kết xuất(Giai  C,shadcn sửa đổi):Từ người bản xứ <dialog>+showModal/close đổi thành
// radix-ui của Dialog Nguyên thủy(DialogPrimitive.Root/Portal/Overlay/Content),Vô ý
// src/components/ui/dialog.jsx Lớp da mặc định đó(className Tiếp tục với hiện có
// desktop-dialog/desktop-shell/glossary-manager-* bộ này bespoke CSS)。open Được kiểm soát
// vào glossariesDialogStore(useGlossariesController của open),onOpenChange Tại địa điểm:
// next===false Gọi thống nhất khi dialogStore.close()——Escape、Chạm vào bảng nối đa năng、Nhấp để đóng
// Nút ba đường dẫn tất cả đi một cuộc gọi lại này,Không còn chữ viết tay nữa handleBackdropClick/keydown nghe lén。
//
// không forceMount Content/Overlay(cùng CredentialsDialog.jsx Kết luận bình luận tiêu đề):Radix
// modal Content Hoạ tiết nội thất hideOthers(content) của effect Phụ thuộc vào sự thật mount/unmount
// Vòng đời,forceMount sẽ làm cho nó vĩnh viễn khi hộp thoại không bao giờ được mở,Tạo tiện nghi phù hợp cho người khuyết tật mới
// thiếu sót。Bảng chú giải thuật ngữ/Các trường trong trình biên tập được kiểm soát bởi glossariesStore(Trạng thái không cục bộ của thành phần này),
// Khi hộp thoại đóng Content Gỡ cài đặt mà không làm mất dữ liệu——controller.js của open() Khi mở lại
// sẽ reloadGlossaries() lấp lại,Ngữ nghĩa không thay đổi。
//
// Mở lối vào:SettingsHubDialog"Bảng chú giải thuật ngữ"tab của #glossary-btn điều dụng
// services.glossaries.dialogStore.open()(kế hoạch xây dựng §0.4);Nội bộ của thành phần này open Trạng thái
// dời effect(thấy useGlossariesController.js)Hãy vá lại lỗ hổng lần này controller.js của
// open(),bù đắp"Mở để làm mới danh sách"Ngữ nghĩa cũ của。

import { Dialog as DialogPrimitive } from "radix-ui";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";
import { GLOSSARY_DOM_IDS } from "./glossaries-dom-ids.js";
import { useGlossariesController } from "./useGlossariesController.js";
import { GlossaryList } from "./GlossaryList.jsx";
import { GlossaryEditor } from "./GlossaryEditor.jsx";
import { GlossaryImportPanel } from "./GlossaryImportPanel.jsx";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size được suy ra là bắt buộc trong các tệp nguồn không được chú thích;unstyled Không được sử dụng khi đường dẫn được chạy size。
const Button = ButtonBase as any;

export function GlossariesDialog() {
  const { open, view, store: glossariesStore, dialogStore, handlers } = useGlossariesController();
  // view.store Tại địa điểm: HomeServices Lên vẫn là AppStore Chung mặc định；Thời Gian Chạy actions đầy đủ hết
  const store = glossariesStore as unknown as {
    actions: {
      setName: (name: string) => unknown;
      updateEntryField: (payload: { index: number; field: string; value: unknown }) => unknown;
      removeEntryRow: (index: number) => unknown;
      setCsvText: (value: string) => unknown;
    };
  };
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      dialogStore.close();
    }
  }

  const status = view.status || { message: "", tone: "" };
  const statusContent = `${status.message || ""}`.trim();
  const statusClasses = [
    "upload-status",
    statusContent ? "" : "hidden",
    status.tone === "valid" ? "is-valid" : "",
    status.tone === "error" ? "is-error" : "",
  ].filter(Boolean).join(" ");

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="desktop-dialog-overlay" />
        <DialogPrimitive.Content
          id={GLOSSARY_DOM_IDS.dialog}
          className="desktop-dialog glossary-manager-dialog"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className="desktop-shell glossary-manager-shell">
            <div className="desktop-head">
              <div className="credential-dialog-head">
                <DialogPrimitive.Title asChild>
                  <h2>Bảng thuật ngữ</h2>
                </DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close asChild>
                <Button
                  id={GLOSSARY_DOM_IDS.closeButton}
                  className="dialog-close-btn"
                  aria-label="Đóng"
                >
                  ×
                </Button>
              </DialogPrimitive.Close>
            </div>
            <div className="desktop-body glossary-manager-body">
              <GlossaryList
                items={view.items}
                selectedId={view.selectedId}
                onSelect={(glossaryId) => handlers?.selectGlossary?.(glossaryId)}
                onCreateNew={() => handlers?.createNew?.()}
              />

              <section className="glossary-editor-panel">
                <label className="glossary-name-field">
                  <span>Tên</span>
                  <input
                    id={GLOSSARY_DOM_IDS.nameInput}
                    type="text"
                    autoComplete="off"
                    placeholder="Ví dụ: thuật ngữ hóa học lượng tử"
                    value={view.draft.name}
                    onChange={(event) => store.actions.setName(event.target.value)}
                  />
                </label>
                <div className="glossary-toolbar">
                  <Button id={GLOSSARY_DOM_IDS.addRowButton} className="app-button secondary" onClick={() => handlers?.addRow?.()}>Thêm</Button>
                  <Button id={GLOSSARY_DOM_IDS.importButton} className="app-button secondary" onClick={() => handlers?.showImport?.()}>CSV</Button>
                  <Button id={GLOSSARY_DOM_IDS.exportButton} className="app-button secondary" onClick={() => handlers?.exportCurrent?.()}>Xuất</Button>
                  <Button id={GLOSSARY_DOM_IDS.deleteButton} className="app-button secondary danger" onClick={() => handlers?.deleteCurrent?.()}>Xóa</Button>
                </div>
                <div className="glossary-editor-scroll">
                  <GlossaryEditor
                    entries={view.draft.entries}
                    onFieldChange={(index, field, value) => store.actions.updateEntryField({ index, field, value })}
                    onRemoveRow={(index) => store.actions.removeEntryRow(index)}
                  />
                  <GlossaryImportPanel
                    visible={view.importVisible}
                    csvText={view.csvText}
                    onCsvTextChange={(value) => store.actions.setCsvText(value)}
                    onApply={() => handlers?.applyImport?.()}
                    onCancel={() => handlers?.hideImport?.()}
                  />
                </div>
                <div className="glossary-footer">
                  <span id={GLOSSARY_DOM_IDS.status} className={statusClasses}>{statusContent}</span>
                  <Button id={GLOSSARY_DOM_IDS.saveButton} className="app-button" onClick={() => handlers?.save?.()}>Lưu</Button>
                </div>
              </section>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
