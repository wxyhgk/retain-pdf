// Bù đắp hoàn trả tiêu điểm (focus) sau khi đóng Radix Dialog (Giai đoạn C: cải tạo shadcn, thay đổi lớp render dialog).
//
// Việc "hoàn trả tiêu điểm về phần tử kích hoạt" mặc định của Radix phụ thuộc vào việc DialogPrimitive.Trigger ghi lại
// context.triggerRef — nhưng 9 dialog trong dự án này đều không dùng cách điển hình "Trigger và Content cùng một
// subtree": không có nơi nào render DialogPrimitive.Trigger (các nút kích hoạt đều là <button onClick={...}> thông thường,
// nằm rải rác ở HeroUpload/SettingsHubDialog panel/AppShellHeader/EventsTimeline trigger card và các component khác nhau,
// trạng thái được điều khiển bởi dialogStore.open()/APP_EVENTS/useState cục bộ), Radix không biết "ai đã
// mở tôi", nên mặc định onCloseAutoFocus (thử focus triggerRef.current) luôn là no-op — thực tế kiểm chứng: sau khi đóng,
// tiêu điểm rơi vào <body>, không quay lại nút người dùng vừa click. Nguyên nhân gốc rễ không liên quan đến việc
// "nút kích hoạt có cùng React subtree với Content hay không" (ngay cả khi cùng cây, nếu không dùng DialogPrimitive.Trigger
// thì vẫn là no-op), nên cả 9 dialog trong dự án này đều cần hook này, không phân biệt có cross-subtree hay không.
//
// Tại đây, ta bổ sung ngữ nghĩa tương đương thủ công: tại thời điểm open chuyển từ false → true, ghi lại
// document.activeElement (thường là nút kích hoạt người dùng vừa click), khi dialog đóng
// (onCloseAutoFocus của DialogPrimitive.Content) trả tiêu điểm về phần tử đó và
// preventDefault hành vi mặc định của Radix.
//
// File này trước đây nằm ở src/pages/home/state/ (trước Giai đoạn C, 4 đợt dialog đầu đều ở trang home);
// sau khi đợt cuối Giai đoạn C đưa hai modal của EventsTimeline ở trang detail vào Radix Dialog,
// hook này trở thành chia sẻ xuyên trang (home.bundle.js + detail.bundle.js đều cần đóng gói nó),
// nên được chuyển sang src/shared/react/ cùng cấp với use-app-event.js/use-store.js/DownloadToastHost.jsx
// (những file sau cũng là tiền lệ cho việc "mỗi trang tự esbuild đóng gói nhưng chia sẻ cùng một mã nguồn").

import { useEffect, useRef } from "react";

export function useDialogReturnFocus(open) {
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement;
    }
  }, [open]);

  function onCloseAutoFocus(event) {
    event.preventDefault();
    const target = previouslyFocusedRef.current;
    if (target && typeof target.focus === "function" && document.contains(target)) {
      target.focus();
    }
  }

  return { onCloseAutoFocus };
}
