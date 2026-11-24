type HorizontalScroll = {
    scrollLeft: number;
    scrollWidth: number;
    clientWidth: number;
};
/** 按源栏滚到的比例，目标栏该滚到哪。源栏不能横滚时返回 null（不动目标栏）。 */
export declare function syncedScrollLeft(source: HorizontalScroll, target: HorizontalScroll): number | null;
export declare function usePaneHorizontalSync(shellEl: HTMLElement | null, enabled: boolean): void;
export {};
//# sourceMappingURL=use-pane-horizontal-sync.d.ts.map