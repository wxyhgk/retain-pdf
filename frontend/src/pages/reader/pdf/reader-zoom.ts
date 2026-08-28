// Phần trăm zoom = tỷ lệ so với "chiều rộng toàn bộ khu vực đọc (shell)", ba chế độ dùng chung một bộ số:
//
//   50%  -> page width ≈ nửa vùng đọc của trình duyệt (khi đối chiếu vừa phủ kín bên trái/phải)
//   100% -> page width ≈ toàn bộ vùng đọc (một cột toàn chiều rộng; khi đối chiếu mỗi bên tràn ngang nhưng page vẫn cùng kích thước)
//
// Tuyệt đối không tính lại theo "chiều rộng cột hiện tại x phần trăm", nếu không đối chiếu 50% sẽ thành 25% toàn màn.

export const READER_ZOOM_MIN = 0.25;
export const READER_ZOOM_MAX = 1;
export const READER_ZOOM_STEP = 0.05;
/** Mặc định 50%: nửa màn hình, vừa phủ kín hai bên khi đối chiếu. */
export const READER_ZOOM_DEFAULT = 0.5;
/** @deprecated */
export const READER_ZOOM_SINGLE_DEFAULT = 0.5;
export const READER_ZOOM_COMPARE_DEFAULT = 0.5;

/** Tổng padding trái/phải trong cột. */
export const READER_PANE_PAD_X = 16;
export const READER_PANE_FIT_GUTTER = 8;

export type ReaderZoomMode = "source" | "translated" | "compare";

export function defaultZoomForMode(_mode?: ReaderZoomMode | string): number {
  return READER_ZOOM_DEFAULT;
}

/** Zoom nội bộ là "tỷ lệ so với toàn bộ chiều rộng shell" 0.25-1. */
export function clampReaderZoom(value: number): number {
  if (!Number.isFinite(value)) {
    return READER_ZOOM_DEFAULT;
  }
  return Math.min(READER_ZOOM_MAX, Math.max(READER_ZOOM_MIN, value));
}

export function stepReaderZoom(current: number, direction: 1 | -1): number {
  const next = clampReaderZoom(Number(current) + direction * READER_ZOOM_STEP);
  return Math.round(next * 100) / 100;
}

/** Phần trăm hiển thị UI = zoom x 100 (tối đa 100). */
export function zoomToDisplayPercent(zoom: number): number {
  return Math.round(clampReaderZoom(zoom) * 100);
}

/** Phần trăm UI -> zoom. */
export function displayPercentToZoom(percent: number): number {
  if (!Number.isFinite(percent)) {
    return READER_ZOOM_DEFAULT;
  }
  return clampReaderZoom(percent / 100);
}

/** Chiều rộng nửa cột đối chiếu (chỉ dùng cho layout, không tham gia ngữ nghĩa phần trăm zoom). */
export function comparePaneWidth(shellWidth: number): number {
  const w = Number(shellWidth) || 0;
  return Math.max(160, Math.floor((w - 1) / 2));
}

/**
 * Chiều rộng nội dung khả dụng của container đích (trừ padding).
 * containerWidth ở đây nên là "chiều rộng shell tương ứng với page width mong muốn" = shellWidth x zoom.
 */
export function fitContentWidth(containerWidth: number): number {
  const raw = Number(containerWidth) || 0;
  const available = raw - READER_PANE_PAD_X - READER_PANE_FIT_GUTTER;
  return Math.max(160, Math.floor(available));
}

/**
 * Lấy chiều rộng render page từ toàn bộ chiều rộng shell + zoom theo tỷ lệ toàn chiều rộng.
 * Gốc/bản dịch/đối chiếu dùng chung: cùng zoom -> cùng chiều rộng pixel của page.
 */
export function pageWidthFromShell(shellWidth: number, userZoom = READER_ZOOM_DEFAULT): number {
  const zoom = clampReaderZoom(userZoom);
  // Lấy width đích theo tỷ lệ trước, rồi trừ padding để đảm bảo 50% đúng là nửa chiều rộng nội dung màn.
  return fitContentWidth((Number(shellWidth) || 0) * zoom);
}

/**
 * @deprecated Dễ bị hiểu nhầm là "scale theo chiều rộng cột". Hãy dùng pageWidthFromShell(shellWidth, zoom).
 * Giữ signature để call cũ không vỡ: nếu arg đầu là nửa chiều rộng shell thì behavior khác unit nửa cột cũ.
 */
export function pageWidthForPane(shellOrPaneWidth: number, userZoom = READER_ZOOM_DEFAULT): number {
  // Tương thích: nếu lỡ truyền nửa chiều rộng cột, x2 để xấp xỉ lại shell rồi tính.
  return pageWidthFromShell(shellOrPaneWidth, userZoom);
}

export function preserveScrollCenter(
  shell: HTMLElement | null | undefined,
  zoomRatio: number,
): void {
  if (!shell || !Number.isFinite(zoomRatio) || zoomRatio <= 0 || Math.abs(zoomRatio - 1) < 0.001) {
    return;
  }

  const cx = shell.scrollLeft + shell.clientWidth / 2;
  const cy = shell.scrollTop + shell.clientHeight / 2;
  const paneCenters = Array.from(
    shell.querySelectorAll<HTMLElement>("[data-reader-pane]"),
  ).map((pane) => ({
    pane,
    cx: pane.scrollLeft + pane.clientWidth / 2,
    hadOverflow: pane.scrollWidth > pane.clientWidth + 1,
  }));

  const apply = () => {
    shell.scrollLeft = Math.max(0, cx * zoomRatio - shell.clientWidth / 2);
    shell.scrollTop = Math.max(0, cy * zoomRatio - shell.clientHeight / 2);

    for (const { pane, cx: pcx, hadOverflow } of paneCenters) {
      const maxL = Math.max(0, pane.scrollWidth - pane.clientWidth);
      if (maxL <= 0) {
        pane.scrollLeft = 0;
        continue;
      }
      if (!hadOverflow) {
        pane.scrollLeft = maxL / 2;
      } else {
        pane.scrollLeft = Math.min(
          maxL,
          Math.max(0, pcx * zoomRatio - pane.clientWidth / 2),
        );
      }
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(apply);
  });
}
