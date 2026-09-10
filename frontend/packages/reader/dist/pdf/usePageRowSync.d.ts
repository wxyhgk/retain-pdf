import type { RefObject } from "react";
export type PageRowHeights = ReadonlyMap<number, number>;
/**
 * @returns pageNumber → max(naturalHeight left, naturalHeight right)
 * 仅当左右都有该页时才有条目（与旧 length < 2 skip 一致）
 *
 * @param onSettle optional; called once per revision cycle after a successful
 * delayed measure (≈300ms), not on every ResizeObserver tick.
 */
export declare function usePageRowSync(shellRef: RefObject<HTMLElement | null>, enabled: boolean, revision?: string | number, onSettle?: () => void): PageRowHeights;
//# sourceMappingURL=usePageRowSync.d.ts.map