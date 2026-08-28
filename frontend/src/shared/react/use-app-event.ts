// Hook thích ứng cho APP_EVENTS(document CustomEvent) → React.
//
// Phạm vi kế hoạch tổng thể: giữ nguyên 16 sự kiện retainpdf:*, không tranh thủ cải tạo cách thức giao tiếp;
// các component React tiêu thụ sự kiện sẽ thống nhất đi qua hook này, không viết boilerplate addEventListener thủ công.
//
// handler chạy qua ref: bên gọi có thể truyền hàm arrow inline (mỗi lần render là một tham chiếu mới),
// bản thân việc subscription chỉ được tạo lại khi eventName/target thay đổi, không bị tháo/gắn liên tục do tham chiếu handler bị trôi
// (rủi ro thực tế là mất sự kiện trong cửa sổ tháo gắn khi trang web điều khiển bằng polling).

import { useEffect, useRef } from "react";

export function useAppEvent(eventName, handler, { target = null } = {}) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!eventName) {
      return undefined;
    }
    const eventTarget = target || globalThis.document;
    if (!eventTarget?.addEventListener) {
      return undefined;
    }
    const listener = (event) => handlerRef.current?.(event);
    eventTarget.addEventListener(eventName, listener);
    return () => eventTarget.removeEventListener(eventName, listener);
  }, [eventName, target]);
}
