// Hook tải ảnh bìa thẻ (bản thiết kế §2 features/library/, giảm thiểu rủi ro §8.3).
//
// Tái sử dụng: loadFirstRecentJobImage của facade image-loader.js (cache objectURL cấp module,
// không bao giờ revoke —— React unmount **không được** revoke, mất hiệu lực chỉ qua
// invalidateRecentJobImages, ở đây hoàn toàn không đụng vào vòng đời cache);
// recentJobRawImageUrls của facade card-presenter.js lấy danh sách URL ứng viên.
//
// imageCacheVersionOf sao chép từ recent-job-card.js:12-29 (facade không export hàm thuần
// này, sao chép trực tiếp theo khẩu độ bản thiết kế thay vì thêm bề mặt export mới). Token chống race condition: tăng token khi chuyển job hoặc URL ứng viên
// thay đổi, khi async resolve xong kiểm tra token vẫn là mới nhất mới ghi state, tránh việc
// thẻ tái sử dụng nhanh thì ảnh của request cũ ghi đè request mới.

import { useEffect, useRef, useState } from "react";
import type { LibraryCardItem } from "../types.js";
import {
  loadFirstRecentJobImage,
  recentJobRawImageUrls,
} from "../../../composition/external.js";

// Phiên bản cache chỉ đổi khi "ảnh bìa thực sự có thể đã đổi". Ảnh bìa do backend /jobs/{id}/cover render
// (đang chạy = trang đầu PDF gốc, sau khi hoàn thành mới có thể đổi thành ảnh bìa thành phẩm), trong quá trình chạy nội dung
// ảnh bìa không đổi. Bản triển khai cũ đưa updated_at + progress.current/percent là các trường "mỗi nhịp polling đều
// đổi" vào phiên bản cache → mỗi giây đều dính cache miss → fetch lại blob ảnh bìa,
// tạo objectURL mới, <img> src vừa đổi là chớp một cái (còn rò rỉ một objectURL mỗi nhịp). Đây
// chính là hiện tượng "thẻ thư viện chớp nháy khi đang chạy" mà người dùng nhìn thấy.
//
// Sửa: Trạng thái chưa kết thúc chỉ tính phiên bản theo status (cố định trong thời gian queued/running, kéo ảnh bìa một lần là đủ, không
// kéo lại mỗi nhịp nữa); đến trạng thái kết thúc (succeeded/failed/canceled) mới đưa updated_at vào —— lúc này
// ảnh bìa có thể vừa tạo ra/cập nhật, cần bust một lần; updated_at cũng phân biệt được các run khác nhau (chạy lại sẽ có
// timestamp hoàn thành mới, ảnh bìa tự làm mới theo), không mất khả năng "đổi ảnh bìa mới sau khi chạy lại" vốn có.
const TERMINAL_COVER_STATUSES = new Set(["succeeded", "failed", "canceled", "cancelled"]);

function imageCacheVersionOf(item: LibraryCardItem = {}) {
  const status = `${item.status || ""}`.trim();
  if (TERMINAL_COVER_STATUSES.has(status)) {
    return `${status}|${item.updated_at ?? ""}`;
  }
  return status;
}

export function useRecentJobCover(item?: LibraryCardItem | null) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const tokenRef = useRef(0);
  const safeItem = item || {};

  const rawUrls = recentJobRawImageUrls(safeItem);
  const cacheVersion = imageCacheVersionOf(safeItem);
  const rawUrlsKey = rawUrls.join("|");

  useEffect(() => {
    const token = (tokenRef.current += 1);
    if (rawUrls.length === 0) {
      setCoverUrl(null);
      return undefined;
    }
    let cancelled = false;
    loadFirstRecentJobImage(rawUrls, { cacheVersion })
      .then((url) => {
        if (cancelled || tokenRef.current !== token) {
          return;
        }
        setCoverUrl(url || null);
      })
      .catch(() => {
        if (cancelled || tokenRef.current !== token) {
          return;
        }
        setCoverUrl(null);
      });
    return () => {
      cancelled = true;
    };
    // rawUrlsKey/cacheVersion là dạng primitive của rawUrls/cacheVersion, dùng làm
    // dependency của effect (mỗi lần render mảng/đối tượng tạo tham chiếu mới, không thể vào trực tiếp danh sách phụ thuộc).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawUrlsKey, cacheVersion]);

  return coverUrl;
}
