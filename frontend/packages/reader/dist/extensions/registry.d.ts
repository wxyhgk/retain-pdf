import { type ReactElement, type ReactNode } from "react";
import type { ReaderApi, ReaderContribution, ReaderExtension, ReaderMenuContext, ReaderMenuItem, ReaderShortcut } from "./types.js";
export type ReaderContributionEntry = {
    id: string;
    title: string;
    contribution: ReaderContribution;
};
export type ReaderContributions = readonly ReaderContributionEntry[];
export type ReaderContributionStore = {
    set: (id: string, title: string, contribution: ReaderContribution) => void;
    remove: (id: string) => void;
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => ReaderContributions;
};
export declare function createContributionStore(): ReaderContributionStore;
/** 右键这一下所有扩展的菜单项，按扩展顺序；哪个扩展算的时候出错就跳过它。 */
export declare function collectMenuItems(contributions: ReaderContributions, context: ReaderMenuContext): ReaderMenuItem[];
export type ReaderPageLayer = {
    id: string;
    render: NonNullable<ReaderContribution["pageLayer"]>;
};
export declare function collectPageLayers(contributions: ReaderContributions): ReaderPageLayer[];
export declare function collectShortcutGroups(contributions: ReaderContributions): {
    title: string;
    items: readonly ReaderShortcut[];
}[];
/** 包住整个阅读页：扩展、右键菜单、书页、快捷键说明都从这里拿到阅读页接口和贡献表。 */
export declare function ReaderExtensionsProvider({ api, store, children }: {
    api: ReaderApi;
    store: ReaderContributionStore;
    children: ReactNode;
}): ReactElement;
export declare function useReaderApi(): ReaderApi;
/** 阅读页自己读它建的那张表（阅读页在 Provider 外面，用不了 useReaderContributions）。 */
export declare function useReaderContributionsOf(store: ReaderContributionStore): ReaderContributions;
/** 现在的贡献表；不在阅读页里（单测单独画一个组件）是空的。 */
export declare function useReaderContributions(): ReaderContributions;
/** 扩展登记自己的贡献；contribution 换了就换掉表里那一份，扩展卸下就从表里拿掉。 */
export declare function useReaderContribution(contribution: ReaderContribution): void;
/**
 * 挂上扩展（各自包在出错边界里），放在阅读页根节点里、浮层的位置。memo：阅读页重画不带着扩展重画——扩展只跟着阅读页接口（context）
 * 和自己的状态变；不然登记一次 → 阅读页重画 → 扩展重画 → 又登记，停不下来。
 */
export declare const ReaderExtensionOutlets: import("react").MemoExoticComponent<({ extensions }: {
    extensions: readonly ReaderExtension[];
}) => ReactElement>;
//# sourceMappingURL=registry.d.ts.map