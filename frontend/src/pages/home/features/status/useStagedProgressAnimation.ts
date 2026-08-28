// Hook hoạt ảnh tiến độ staged (bản thiết kế §2 features/status/, rủi ro §8.1 —
// điểm dễ phát sinh lỗi thứ tự nhất trong toàn dự án).
//
// Sao chép createStatusCardProgressAnimation từ
// components/status/job-status-card-progress-animation.js (tệp đó thuộc danh sách
// "đã loại bỏ, thay bằng họ StatusCard.jsx", cấm import từ js/components;
// buildProgressOptions/shouldAnimateRenderPageProgress là VM thuần của job-status/,
// import nguyên trạng).
//
// Quy tắc bất biến (rủi ro §8.1): displayedProgressByStage và timer phải là
// useRef, không phải useState — hoạt ảnh nhảy từng trang mỗi 120ms sẽ khiến toàn
// component render lại ở mỗi tick nếu dùng useState; closure cũng giữ giá trị state
// cũ (cập nhật hàm của setState tránh được giá trị cũ nhưng không tránh render lại
// mỗi tick). ref là cách duy nhất vừa lưu qua các tick vừa không kích hoạt render.
// Chỉ renderOptions cần kích hoạt render (được xuất qua useState riêng cho
// ProgressBlock.jsx render).

import { useEffect, useRef, useState } from "react";
import {
  buildProgressOptions,
  shouldAnimateRenderPageProgress,
} from "../../composition/external.js";

const TICK_DELAY_MS = 120;

export function useStagedProgressAnimation({ selected, selectedIsCurrent, snapshot, selectedProgress, jobId }) {
  const displayedProgressByStageRef = useRef({});
  const timerRef = useRef(null);
  const [renderOptions, setRenderOptions] = useState(null);

  function clear() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function rememberProgress(stageKey, current, total) {
    displayedProgressByStageRef.current[stageKey] = {
      current: Number.isFinite(current) ? current : null,
      total: Number.isFinite(total) ? total : null,
    };
  }

  // Đặt lại khi đổi job (ngữ nghĩa kèm rủi ro §8.1): displayedProgressByStage là
  // "bộ nhớ tiến độ đã hiển thị qua các giai đoạn"; sau khi đổi job phải xóa bộ
  // nhớ của job cũ, nếu không giai đoạn cùng tên của job mới sẽ dùng tiến độ cũ
  // làm điểm bắt đầu hoạt ảnh.
  useEffect(() => {
    clear();
    displayedProgressByStageRef.current = {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    const previous = displayedProgressByStageRef.current[selected];
    const {
      previousCurrent,
      shouldAnimate,
      targetCurrent,
      targetTotal,
    } = shouldAnimateRenderPageProgress({ selected, selectedIsCurrent, snapshot, selectedProgress, previous });

    if (!shouldAnimate) {
      clear();
      rememberProgress(selected, targetCurrent, targetTotal);
      setRenderOptions(buildProgressOptions({ selected, selectedIsCurrent, snapshot, selectedProgress }));
      return undefined;
    }

    clear();
    let displayedCurrent = previousCurrent;
    const tick = () => {
      displayedCurrent = Math.min(targetCurrent, displayedCurrent + 1);
      rememberProgress(selected, displayedCurrent, targetTotal);
      setRenderOptions(buildProgressOptions({
        selected, selectedIsCurrent, snapshot, selectedProgress, displayedCurrent,
      }));
      if (displayedCurrent < targetCurrent) {
        timerRef.current = setTimeout(tick, TICK_DELAY_MS);
      }
    };
    tick();
    return clear;
    // selected/selectedIsCurrent/snapshot/selectedProgress đều là giá trị suy ra
    // từ props; mỗi khi snapshot nguồn thay đổi, các tham chiếu này tự thay đổi,
    // danh sách dependency sẽ chạy lại quyết định hoạt ảnh — tương đương thứ tự
    // cũ khi render({selected,...}) được gọi một lần cho mỗi callback snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedIsCurrent, snapshot, selectedProgress]);

  useEffect(() => clear, []);

  return renderOptions;
}
