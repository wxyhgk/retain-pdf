// types-split/common.ts — 基础只读原语，无内部依赖。
import type { Store } from "@/platform/store/store.js";
/**
 * 通用 app-framework store。
 * 用 Store 默认参（未建模 snapshot/actions），避免把消费方推成 never/unknown。
 */
export type AppStore = Store;

/** 隐藏 Store 写入能力：仅暴露读侧（配合 useStoreSnapshot）。 */
export type ReadOnlyStore<T = unknown> = Pick<Store<T, any>, "getSnapshot" | "subscribe">;

/** 便利别名：只读文本/视图等简单快照 */
export type ReadOnlySelector<T> = ReadOnlyStore<T>;

/** 事件处理函数表（viewPort.bindEvents 写入 handlersRef） */
export type HandlersBag = {
  [key: string]: ((...args: unknown[]) => unknown) | undefined | null;
};

export type AsyncFn = (...args: unknown[]) => Promise<unknown>;
