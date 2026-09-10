// 缩放百分比 = 相对「整个阅读区（shell）宽度」的占比，三种模式同一套数字：
//
//   50%  → 页宽 ≈ 半个浏览器阅读区（对照时刚好铺满左/右一侧）
//   100% → 页宽 ≈ 整个阅读区宽度（单栏全宽；对照时每侧横向溢出但页一样大）
//
// 绝不能按「当前栏宽 × 百分比」再算一次，否则对照 50% 会变成整屏 25%。

export const READER_ZOOM_MIN = 0.25;
export const READER_ZOOM_MAX = 1;
export const READER_ZOOM_STEP = 0.05;
/** 默认 50%：半屏宽，对照两侧刚好铺满 */
export const READER_ZOOM_DEFAULT = 0.5;
/** @deprecated */
export const READER_ZOOM_SINGLE_DEFAULT = 0.5;
export const READER_ZOOM_COMPARE_DEFAULT = 0.5;

/** 栏内左右 padding 合计 */
export const READER_PANE_PAD_X = 16;
export const READER_PANE_FIT_GUTTER = 8;

export type ReaderZoomMode = "source" | "translated" | "compare";

export function defaultZoomForMode(_mode?: ReaderZoomMode | string): number {
  return READER_ZOOM_DEFAULT;
}

/** 内部 zoom 即「占 shell 全宽的比例」0.25–1 */
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

/** UI 显示百分比 = zoom × 100（最大 100） */
export function zoomToDisplayPercent(zoom: number): number {
  return Math.round(clampReaderZoom(zoom) * 100);
}

/** UI 百分比 → zoom */
export function displayPercentToZoom(percent: number): number {
  if (!Number.isFinite(percent)) {
    return READER_ZOOM_DEFAULT;
  }
  return clampReaderZoom(percent / 100);
}

/** 对照半栏宽（仅布局用，不参与 zoom 百分比语义） */
export function comparePaneWidth(shellWidth: number): number {
  const w = Number(shellWidth) || 0;
  return Math.max(160, Math.floor((w - 1) / 2));
}

/**
 * 目标容器可用内容宽（扣 padding）。
 * 这里的 containerWidth 应是「期望页宽对应的壳宽度」= shellWidth × zoom。
 */
export function fitContentWidth(containerWidth: number): number {
  const raw = Number(containerWidth) || 0;
  const available = raw - READER_PANE_PAD_X - READER_PANE_FIT_GUTTER;
  return Math.max(160, Math.floor(available));
}

/**
 * 由 shell 全宽 + 全宽占比 zoom 得到绘制页宽。
 * 原文/译文/对照共用：同一 zoom → 同一页像素宽。
 */
export function pageWidthFromShell(shellWidth: number, userZoom = READER_ZOOM_DEFAULT): number {
  const zoom = clampReaderZoom(userZoom);
  // 先按占比得到目标宽，再扣 padding，保证 50% 正好是半屏内容宽
  return fitContentWidth((Number(shellWidth) || 0) * zoom);
}

/**
 * @deprecated 易误解为「按栏宽缩放」。请用 pageWidthFromShell(shellWidth, zoom)。
 * 保留签名以免旧调用崩：把 first arg 当作 shell 半宽时行为与旧半栏 unit 不同。
 */
export function pageWidthForPane(shellOrPaneWidth: number, userZoom = READER_ZOOM_DEFAULT): number {
  // 兼容：若误传半栏宽，×2 还原成 shell 近似值再算
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
