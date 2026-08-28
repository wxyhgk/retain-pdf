// mới xây/Hộp thoại Quản lý bộ sưu tập(shadcn Đã bổ sung sau khi cải tạo tại 10 các cuộc đối thoại,và phần còn lại 9 một và cùng một bộ
// Đường:DialogPrimitive.Root/Portal/Overlay/Content + desktop-dialog/
// desktop-shell + useDialogReturnFocus)。
//
// Tham chiếu chéo từ PDF_MD_lib của FolderManageModal (nhập tên + kiểm tra trùng thư viện),
// checkbox đơn giản hóa thành một cột (không phân loại thủ công - không kéo thả sắp xếp/thứ tự,
// xem kế hoạch nghiên cứu "Những điều không nên làm").
//
// dialogStore.payload = CollectionRecord đang chỉnh sửa, hoặc null (chế độ tạo mới).
// open() được gọi từ CategoriesView.jsx. Hộp thoại này và CategoriesView là
// nút anh em ngang hàng trong HomeApp.jsx (không phải quan hệ cha-con),
// sau khi xóa/lưu thành công gọi lại prop để quay lại - dựa vào
// services.collections.reloadSignal (store chỉ có trường version tối giản) để kết nối,
// bump version tại đây một lần, CategoriesView đăng ký thay đổi và tải lại danh sách.

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button as ButtonBase } from "../../../../components/Button.jsx";

// Button.size được suy ra là bắt buộc trong các tệp nguồn không được chú thích;unstyled Không được sử dụng khi đường dẫn được chạy size。
const Button = ButtonBase as any;
import { useHomeServices } from "../../home-services-context.js";
import { useDialogState } from "../../state/use-dialog-state.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";

export function CollectionManageDialog() {
  const services = useHomeServices();
  const { controller, dialogStore, reloadSignal } = services.collections;
  const dialogState = useDialogState(dialogStore);
  const open = Boolean(dialogState.open);
  const editing = dialogState.payload;
  const isCreate = !editing;
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  const [name, setName] = useState("");
  const [allDocuments, setAllDocuments] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [originalIds, setOriginalIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setConfirmingDelete(false);
      return undefined;
    }
    let cancelled = false;
    setError("");
    setName(editing?.name || "");
    // Khi dữ liệu thư mục đã có sẵn soft Kéo mạnh（Cắt mục tiêu chỉnh sửa），Bảng chưa hoàn thành loading Blaze
    setLoading((prev) => (allDocuments.length === 0 ? true : prev));
    const documentsPromise = controller.listAllDocuments();
    const memberIdsPromise = editing
      ? controller.listCollectionDocumentIds(editing.collection_id)
      : Promise.resolve([]);
    Promise.all([documentsPromise, memberIdsPromise])
      .then(([documents, memberIds]) => {
        if (cancelled) {
          return;
        }
        setAllDocuments(documents);
        setSelectedIds(memberIds);
        setOriginalIds(memberIds);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setError(err?.message || "Tải danh sách sách thất bại, vui lòng thử lại sau.");
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setLoading(false);
      });
    // Nhanh chóng mở lại một bộ sưu tập khác sau khi đóng(Ví dụ: trước tiên hãy chỉnh sửa"hóa học"Chỉnh sửa lại"Học máy"),
    // Hai lần fetch Ai đi trước resolve Chưa xác định——Nếu không có người giám hộ này,,Yêu cầu đã được đóng sau
    // Nếu bạn đến muộn,sẽ đặt nội dung đã được hiển thị"Học máy"Ghi Đè Trở Lại Biểu Mẫu"hóa học"Dữ liệu thư mục cho。
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.collection_id]);

  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      dialogStore.close();
    }
  }

  function toggleDocument(documentId) {
    setSelectedIds((prev) => (prev.includes(documentId)
      ? prev.filter((id) => id !== documentId)
      : [...prev, documentId]));
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Vui lòng nhập tên bộ sưu tập.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      let collectionId = editing?.collection_id || "";
      if (isCreate) {
        const created = await controller.createCollection({ name: trimmed }) as {
          collection_id?: string;
        };
        collectionId = created.collection_id || "";
      } else if (trimmed !== editing.name) {
        await controller.patchCollection(collectionId, { name: trimmed });
      }
      const toAdd = selectedIds.filter((id) => !originalIds.includes(id));
      const toRemove = originalIds.filter((id) => !selectedIds.includes(id));
      if (toAdd.length) {
        await controller.addDocuments(collectionId, toAdd);
      }
      for (const documentId of toRemove) {
        await controller.removeDocument(collectionId, documentId);
      }
      reloadSignal.actions.bump();
      dialogStore.close();
    } catch (err) {
      setError(err?.message || (isCreate ? "Tạo bộ sưu tập mới thất bại, vui lòng thử lại sau." : "Lưu thất bại, vui lòng thử lại sau."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await controller.deleteCollection(editing.collection_id);
      reloadSignal.actions.bump();
      dialogStore.close();
    } catch (err) {
      setError(err?.message || "Xóa bộ sưu tập thất bại, vui lòng thử lại sau.");
      setSaving(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="desktop-dialog-overlay" />
        <DialogPrimitive.Content
          id="collection-manage-dialog"
          className="desktop-dialog collection-manage-dialog"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className="desktop-shell">
            <div className="desktop-head">
              <DialogPrimitive.Title asChild>
                <h2>{isCreate ? "Tạo bộ sưu tập mới" : "Quản lý bộ sưu tập"}</h2>
              </DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <button id="collection-manage-close-btn" type="button" className="dialog-close-btn" aria-label="Đóng">×</button>
              </DialogPrimitive.Close>
            </div>
            <div className="desktop-body collection-manage-body">
              <label className="collection-name-field">
                <span>Tên</span>
                <input
                  id="collection-name-input"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ví dụ: Hóa học"
                  autoFocus
                />
              </label>
              <div className="collection-doc-picker">
                <p className="muted">Chọn sách từ thư viện để thêm vào bộ sưu tập này</p>
                {loading ? (
                  <div className="collection-doc-list-empty">Đang tải danh sách sách…</div>
                ) : allDocuments.length === 0 ? (
                  <div className="collection-doc-list-empty">Thư viện chưa có sách</div>
                ) : (
                  <ul className="collection-doc-list">
                    {allDocuments.map((doc) => (
                      <li key={doc.document_id}>
                        <label className="collection-doc-item">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(doc.document_id)}
                            onChange={() => toggleDocument(doc.document_id)}
                          />
                          <span className="collection-doc-title" title={doc.title}>{doc.title || doc.source_filename}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {error ? <p className="collection-manage-error">{error}</p> : null}
            </div>
            <div className="collection-manage-actions">
              {!isCreate ? (
                <Button
                  id="collection-delete-btn"
                  className={`app-button secondary danger${confirmingDelete ? " is-confirming" : ""}`}
                  disabled={saving}
                  onClick={handleDelete}
                >
                  {confirmingDelete ? "Xác nhận xóa?" : "Xóa bộ sưu tập"}
                </Button>
              ) : <span />}
              <Button
                id="collection-save-btn"
                className="app-button"
                disabled={saving || loading}
                onClick={handleSave}
              >
                {saving ? "Đang lưu…" : "Lưu"}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
