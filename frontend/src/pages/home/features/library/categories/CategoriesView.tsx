// Nội dung tab "Bộ sưu tập": Lưới thẻ thư mục + Danh sách sách sau khi nhấp vào một thư mục.
//
// Liên kết dữ liệu của lưới thư viện hoàn toàn nguyên vẹn (Kế hoạch thiết kế "Quyết định thiết kế 2") — đi qua
// collection_id -> documents (chứa active_job_id) -> lọc job_ids sang library/books
// theo đường dẫn bắc cầu này (services.collections.controller.fetchFolderBooks), nhận được
// hình dạng dữ liệu hoàn toàn giống với thẻ trang chủ của thư viện, tái sử dụng trực tiếp BookCard, không cần
// tạo thêm một bộ render "Thẻ chi tiết thư mục" riêng, cũng không có bộ xóa thứ hai để xác nhận trạng thái nổi bọt.

import { useCallback, useEffect, useState } from "react";
import { useHomeServices } from "../../../home-services-context.js";
import { useStoreSnapshot } from "../../../../../shared/react/use-store.js";
import { EmptyState } from "../../../../../shared/icons/EmptyState.jsx";
import { BookCard, buildDefaultBookCardActions } from "../shell/BookCard.jsx";
import { useRecentJobCover } from "../display/useRecentJobCover.js";

// Xem trước ngăn xếp bìa cho thẻ thư mục (tham khảo FolderCard.tsx trong PDF_MD_lib: tối đa 4 bìa
// xếp chồng kiểu bài xì phé, sách xuất hiện trước có z cao hơn, xếp ra ngoài). Giữ ảnh bìa
// tương tự hook useRecentJobCover của BookCard (cùng cơ chế cache objectURL, không phát sinh
// request trùng vì ở đây render nhiều hơn một instance).
const MAX_STACK = 4;

function FolderCoverStackLayer({ item, index, total }) {
  const coverUrl = useRecentJobCover(item);
  const z = 10 + (total - 1 - index);
  const rot = (index - (total - 1) / 2) * -5;
  const offsetX = (index - (total - 1) / 2) * 5;
  return (
    <div
      className="category-card-stack-item"
      style={{
        top: `${6 + index * 7}px`,
        bottom: `${10 + (total - 1 - index) * 6}px`,
        zIndex: z,
        transform: `translateX(${offsetX}px) rotate(${rot}deg)`,
      }}
    >
      {coverUrl ? (
        <img src={coverUrl} alt="" />
      ) : (
        <span className="category-card-stack-fallback" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M9 12.5h6M9 15.5h6M9 9.5h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </span>
      )}
    </div>
  );
}

function FolderCoverStack({ items }) {
  const stack = (Array.isArray(items) ? items : []).slice(0, MAX_STACK);
  return (
    <div className="category-card-stack">
      {stack.length === 0 ? (
        <div className="category-card-stack-empty">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4.5l1.5 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <span>Bộ sưu tập trống</span>
        </div>
      ) : (
        stack.map((item, index) => (
          <FolderCoverStackLayer key={item.job_id} item={item} index={index} total={stack.length} />
        ))
      )}
    </div>
  );
}

export function CategoriesView() {
  const services = useHomeServices();
  const { controller, dialogStore, reloadSignal } = services.collections;
  const { actions } = services.library;
  // CollectionManageDialog đặt ở tầng cao nhất của HomeApp.jsx, và component này là node anh em
  // (không phải quan hệ cha con), sau khi Lưu/Xóa không thể trực tiếp gọi callback qua prop — kết nối
  // thông qua signal version chia sẻ: Nếu dialog lưu thành công thì bump version một lần, đăng ký
  // tại đây để tải lại danh sách khi version thay đổi.
  const { version } = useStoreSnapshot(reloadSignal);

  const [collections, setCollections] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  // Xem trước ngăn xếp bìa cho thẻ thư mục: collection_id -> một vài cuốn sách đầu tiên trong thư mục này (dạng BookCard).
  const [previews, setPreviews] = useState({});

  const [openFolder, setOpenFolder] = useState(null);
  const [folderItems, setFolderItems] = useState([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState("");

  const reload = useCallback((options: { soft?: boolean } = {}) => {
    // soft: version bump / giữ danh sách cũ ở lần fetch thứ hai, tránh hiển thị loading toàn bảng làm nhấp nháy UI
    const soft = Boolean(options.soft);
    if (!soft) {
      setListLoading(true);
    }
    setListError("");
    return controller
      .listCollections()
      .then(({ collections: items = [] } = {}) => {
        setCollections(items);
        // Thư mục đang xem nếu bị xóa (nhấp xóa trong dialog quản lý), quay lại lưới thư mục.
        setOpenFolder((current) => {
          if (!current) {
            return current;
          }
          const stillExists = items.some((item) => item.collection_id === current.collection_id);
          return stillExists ? items.find((item) => item.collection_id === current.collection_id) : null;
        });
      })
      .catch((err) => setListError(err?.message || "Đọc bộ sưu tập thất bại, vui lòng thử lại."))
      .finally(() => {
        if (!soft) {
          setListLoading(false);
        }
      });
  }, [controller]);

  useEffect(() => {
    // Màn hình đầu tiên load cứng; popup quản lý bump version xong sẽ reload mềm
    reload({ soft: version > 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, version]);

  const collectionIdsKey = collections.map((item) => item.collection_id).join(",");
  useEffect(() => {
    if (!collectionIdsKey) {
      return undefined;
    }
    let cancelled = false;
    // Xem trước ngăn xếp bìa cho mỗi thẻ thư mục được lấy riêng biệt, không block — thư mục tải chậm
    // không giữ chân các thẻ khác hiển thị trước.
    collections.forEach((collection) => {
      controller
        .fetchFolderBooks(collection.collection_id)
        .then((items) => {
          if (cancelled) {
            return;
          }
          setPreviews((prev) => ({ ...prev, [collection.collection_id]: items }));
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          setPreviews((prev) => ({ ...prev, [collection.collection_id]: [] }));
        });
    });
    return () => {
      cancelled = true;
    };
    // collectionIdsKey chỉ thay đổi khi chính danh sách collection thay đổi (thêm/xóa).
    // version đóng vai trò làm mới: khi dialog quản lý lưu thành công, bump version một lần,
    // đảm bảo thumbnail preview luôn được cập nhật.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, collectionIdsKey, version]);

  const openFolderId = openFolder?.collection_id || "";
  useEffect(() => {
    if (!openFolderId) {
      setFolderItems([]);
      setFolderError("");
      return undefined;
    }
    let cancelled = false;
    setFolderLoading(true);
    setFolderError("");
    controller
      .fetchFolderBooks(openFolderId)
      .then((items) => {
        if (cancelled) {
          return;
        }
        setFolderItems(items);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setFolderError(err?.message || "Đọc nội dung bộ sưu tập thất bại, vui lòng thử lại.");
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setFolderLoading(false);
      });
    // Dùng collection_id (giá trị nguyên thủy) thay vì tham chiếu đối tượng openFolder làm dependency —
    // reload() mỗi lần tạo đối tượng mới cho cùng một thư mục (như setOpenFolder gọi items.find(...) bên trong),
    // nếu dựa vào tham chiếu đối tượng thì "chưa thực sự chuyển thư mục" cũng sẽ trigger lại request;
    // quan trọng hơn, bản gốc thiếu hoàn toàn guard cancelled, khi chuyển nhanh giữa hai thư mục
    // request sau có thể resolve trước request đầu, dẫn đến tiêu đề hiển thị thư mục B nhưng danh sách lại là dữ liệu cũ của A.
    return () => {
      cancelled = true;
    };
  }, [controller, openFolderId]);

  if (openFolder) {
    return (
      <section id="categories-folder-view" className="library-view categories-view" aria-label={`Bộ sưu tập:${openFolder.name}`}>
        <div className="categories-folder-head">
          <button
            id="categories-back-btn"
            type="button"
            className="categories-back-btn"
            onClick={() => setOpenFolder(null)}
          >
            ← Quay lại bộ sưu tập
          </button>
          <h2>{openFolder.name}</h2>
        </div>
        {folderLoading ? (
          <div className="events-empty">Đang tải…</div>
        ) : folderError ? (
          <div className="events-empty">{folderError}</div>
        ) : folderItems.length === 0 ? (
          <EmptyState
            instrument="balance"
            title="Bộ sưu tập này chưa có sách"
            hint="Nhấn «Quản lý» trên thẻ bộ sưu tập, chọn PDF từ thư viện để thêm vào."
          />
        ) : (
          <div className="recent-jobs-list library-grid">
            {folderItems.map((item) => (
              <BookCard
                key={item.job_id}
                item={item}
                actions={buildDefaultBookCardActions(item, {
                  onReader: actions.openJobReader,
                  onReadSource: actions.openSourceReader,
                })}
                onSelect={actions.selectJob}
                onOpenDetail={actions.openBookDetail}
              />
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section id="categories-view" className="library-view categories-view" aria-label="Bộ sưu tập">
      <div className="categories-head">
        <button
          id="categories-create-btn"
          type="button"
          className="app-button"
          onClick={() => dialogStore.open(null)}
        >
          Tạo bộ sưu tập mới
        </button>
      </div>
      {listLoading ? (
        <div className="events-empty">Đang tải bộ sưu tập…</div>
      ) : listError ? (
        <div className="events-empty">{listError}</div>
      ) : collections.length === 0 ? (
        <EmptyState
          id="categories-empty"
          instrument="telescope"
          title="Chưa có bộ sưu tập"
          hint="Nhóm PDF theo chủ đề thành giá sách, sau này dễ tìm hơn."
        >
          <button
            type="button"
            className="app-button empty-state-action"
            onClick={() => dialogStore.open(null)}
          >
Tạo bộ sưu tập mới
          </button>
        </EmptyState>
      ) : (
        <div id="categories-grid" className="categories-grid">
          {collections.map((collection) => (
            <div key={collection.collection_id} className="category-card">
              <button
                type="button"
                className="category-card-open"
                onClick={() => setOpenFolder(collection)}
              >
                <FolderCoverStack items={previews[collection.collection_id]} />
                <span className="category-card-name" title={collection.name}>{collection.name}</span>
                <span className="category-card-count">{collection.document_count} cuốn</span>
              </button>
              <button
                type="button"
                className="category-card-manage"
                aria-label={`Quản lý bộ sưu tập ${collection.name}`}
                title="Quản lý"
                onClick={(event) => {
                  event.stopPropagation();
                  dialogStore.open(collection);
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" stroke="currentColor" strokeWidth="1.65" fill="none" />
                  <path d="M19.1 13.2c.06-.39.09-.79.09-1.2s-.03-.81-.09-1.2l2.02-1.55-1.9-3.29-2.38.96a8.01 8.01 0 0 0-2.08-1.2L14.4 3.2h-3.8l-.36 2.52c-.75.28-1.45.69-2.08 1.2l-2.38-.96-1.9 3.29L5.9 10.8c-.06.39-.09.79-.09 1.2s.03.81.09 1.2l-2.02 1.55 1.9 3.29 2.38-.96c.63.51 1.33.92 2.08 1.2l.36 2.52h3.8l.36-2.52c.75-.28 1.45-.69 2.08-1.2l2.38.96 1.9-3.29-2.02-1.55Z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" fill="none" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
