// 贡献表本身：扩展登记、阅读页读。顺序是扩展第一次登记的顺序（内置扩展表里的先后），之后改内容不挪位置。
import {
  Component,
  createContext,
  memo,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ErrorInfo,
  type ReactElement,
  type ReactNode,
} from "react";

import type { ReaderTextMark } from "../shared/content/reader-text-marks.js";
import type { ReaderApi, ReaderComparedDocument, ReaderContribution, ReaderExtension, ReaderMenuContext, ReaderMenuItem, ReaderShortcut } from "./types.js";

export type ReaderContributionEntry = { id: string; title: string; contribution: ReaderContribution };
export type ReaderContributions = readonly ReaderContributionEntry[];

export type ReaderContributionStore = {
  set: (id: string, title: string, contribution: ReaderContribution) => void;
  remove: (id: string) => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ReaderContributions;
};

const EMPTY: ReaderContributions = [];

export function createContributionStore(): ReaderContributionStore {
  const entries = new Map<string, { title: string; contribution: ReaderContribution }>();
  const listeners = new Set<() => void>();
  let snapshot: ReaderContributions = EMPTY;
  const publish = () => {
    snapshot = [...entries].map(([id, entry]) => ({ id, ...entry }));
    for (const listener of listeners) listener();
  };
  return {
    set: (id, title, contribution) => {
      entries.set(id, { title, contribution });
      publish();
    },
    remove: (id) => {
      if (entries.delete(id)) publish();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
  };
}

/** 右键这一下所有扩展的菜单项，按扩展顺序；哪个扩展算的时候出错就跳过它。 */
export function collectMenuItems(contributions: ReaderContributions, context: ReaderMenuContext): ReaderMenuItem[] {
  const items: ReaderMenuItem[] = [];
  for (const { id, contribution } of contributions) {
    if (!contribution.menuItems) continue;
    try {
      for (const item of contribution.menuItems(context)) items.push({ ...item, key: `${id}:${item.key}` });
    } catch (error) {
      console.error(`[reader] 扩展 ${id} 的右键菜单出错`, error);
    }
  }
  return items;
}

export type ReaderPageLayer = { id: string; render: NonNullable<ReaderContribution["pageLayer"]> };

export function collectPageLayers(contributions: ReaderContributions): ReaderPageLayer[] {
  return contributions.flatMap(({ id, contribution }) => (contribution.pageLayer ? [{ id, render: contribution.pageLayer }] : []));
}

export type ReaderMenuSection = { id: string; render: NonNullable<ReaderContribution["menuSection"]> };

export function collectMenuSections(contributions: ReaderContributions): ReaderMenuSection[] {
  return contributions.flatMap(({ id, contribution }) => (contribution.menuSection ? [{ id, render: contribution.menuSection }] : []));
}

/** 有没有扩展正占着书页上的指针。 */
export function pointerTakenBy(contributions: ReaderContributions): string | null {
  return contributions.find(({ contribution }) => contribution.takesPointer)?.id ?? null;
}

/** 几个扩展的文字层标记合成一个函数（没人给是 null，书页就不用自定义文字层）。 */
export function collectTextMarks(contributions: ReaderContributions): ((text: string) => ReaderTextMark[]) | null {
  const sources = contributions.flatMap(({ id, contribution }) => (contribution.textMarks ? [{ id, marks: contribution.textMarks }] : []));
  if (!sources.length) return null;
  return (text) => sources.flatMap(({ id, marks }) => {
    try {
      return [...marks(text)];
    } catch (error) {
      console.error(`[reader] 扩展 ${id} 的文字层标记出错`, error);
      return [];
    }
  });
}

/** 书页右边要让出的宽度：几个扩展里最大的（没人要是 0）。 */
export function collectReserveRight(contributions: ReaderContributions): number {
  return contributions.reduce((most, { contribution }) => Math.max(most, contribution.reserveRight || 0), 0);
}

/** 对照时左栏换成的那一份：第一个给了的扩展。 */
export function pickComparedDocument(contributions: ReaderContributions): ReaderComparedDocument | null {
  for (const { contribution } of contributions) if (contribution.comparedDocument) return contribution.comparedDocument;
  return null;
}

export function collectShortcutGroups(contributions: ReaderContributions): { title: string; items: readonly ReaderShortcut[] }[] {
  return contributions.flatMap(({ title, contribution }) => (contribution.shortcuts?.length ? [{ title, items: contribution.shortcuts }] : []));
}

type ExtensionsValue = { api: ReaderApi; store: ReaderContributionStore };
const ExtensionsContext = createContext<ExtensionsValue | null>(null);
const ExtensionIdContext = createContext<{ id: string; title: string } | null>(null);

/** 包住整个阅读页：扩展、右键菜单、书页、快捷键说明都从这里拿到阅读页接口和贡献表。 */
export function ReaderExtensionsProvider({ api, store, children }: { api: ReaderApi; store: ReaderContributionStore; children: ReactNode }): ReactElement {
  const value = useMemo(() => ({ api, store }), [api, store]);
  return <ExtensionsContext.Provider value={value}>{children}</ExtensionsContext.Provider>;
}

export function useReaderApi(): ReaderApi {
  const value = useContext(ExtensionsContext);
  if (!value) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return value.api;
}

const noopSubscribe = () => () => {};
const emptySnapshot = () => EMPTY;

/** 阅读页自己读它建的那张表（阅读页在 Provider 外面，用不了 useReaderContributions）。 */
export function useReaderContributionsOf(store: ReaderContributionStore): ReaderContributions {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/** 现在的贡献表；不在阅读页里（单测单独画一个组件）是空的。 */
export function useReaderContributions(): ReaderContributions {
  const store = useContext(ExtensionsContext)?.store;
  return useSyncExternalStore(store?.subscribe ?? noopSubscribe, store?.getSnapshot ?? emptySnapshot, store?.getSnapshot ?? emptySnapshot);
}

/** 扩展登记自己的贡献；contribution 换了就换掉表里那一份，扩展卸下就从表里拿掉。 */
export function useReaderContribution(contribution: ReaderContribution): void {
  const store = useContext(ExtensionsContext)?.store;
  const self = useContext(ExtensionIdContext);
  if (!self) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id, title } = self;
  useEffect(() => {
    store?.set(id, title, contribution);
  }, [store, id, title, contribution]);
  // 单独一个只在卸下时跑的：放在上面那个的清理里，每次改内容都会先拿掉再放回，顺序就乱了。
  useEffect(() => () => store?.remove(id), [store, id]);
}

/** 一个扩展出错只丢掉它自己，阅读页照常。 */
class ExtensionBoundary extends Component<{ id: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(`[reader] 扩展 ${this.props.id} 出错，已停用`, error, info.componentStack);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * 挂上扩展（各自包在出错边界里），放在阅读页根节点里、浮层的位置。memo：阅读页重画不带着扩展重画——扩展只跟着阅读页接口（context）
 * 和自己的状态变；不然登记一次 → 阅读页重画 → 扩展重画 → 又登记，停不下来。
 */
export const ReaderExtensionOutlets = memo(function ReaderExtensionOutlets({ extensions }: { extensions: readonly ReaderExtension[] }): ReactElement {
  return (
    <>
      {extensions.map(({ id, title, Component: Extension }) => (
        <ExtensionBoundary key={id} id={id}>
          <ExtensionSlot id={id} title={title}>
            <Extension />
          </ExtensionSlot>
        </ExtensionBoundary>
      ))}
    </>
  );
});

function ExtensionSlot({ id, title, children }: { id: string; title: string; children: ReactNode }): ReactElement {
  const self = useMemo(() => ({ id, title }), [id, title]);
  return <ExtensionIdContext.Provider value={self}>{children}</ExtensionIdContext.Provider>;
}
