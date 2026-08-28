// Hook đồng hồ bấm giờ (bản thiết kế §2 features/status/, §3.5).
//
// Độc lập với statusCardStore (trong store cố ý không đặt elapsed — xem chú thích
// đầu status-card-store.js). Tick 1s, trạng thái cuối (succeeded/failed/canceled) dừng
// ngay, tái sử dụng trực tiếp hàm thuần job/elapsed-view-model.js.

import { useEffect, useState } from "react";
import {
  buildElapsedViewModel,
  isTerminalStatus,
} from "../../composition/external.js";

export function useElapsedTicker(job, { finishedAtFallback = "" } = {}) {
  const [tick, setTick] = useState(0);

  const status = `${job?.status || ""}`.trim();
  const terminal = isTerminalStatus(status);

  useEffect(() => {
    if (terminal || !job) {
      return undefined;
    }
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [terminal, job?.job_id, status]);

  void tick; // Chỉ dùng để kích hoạt render mỗi giây, bản thân giá trị không tham gia tính toán.
  return buildElapsedViewModel(job, { finishedAtFallback });
}
