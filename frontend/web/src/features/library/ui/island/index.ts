import { API_PREFIX } from "@/platform/config/api-constants.js";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";
import { RECENT_JOBS_IDS } from "../recent-jobs-dom-contract.js";
import { fetchDocumentList, patchDocument } from "@/platform/api/index.js";
import { searchLibrary } from "@/platform/api/index.js";

/** Anchor payload used to open the reader from a search hit / document row. */
export interface LibrarySearchAnchor {
  job_id?: string;
  document_id?: string;
  page_idx?: number;
  block_id?: string;
  [key: string]: unknown;
}

/** 书卡可改的字段。原先直接复用 mock 层的 MockDocumentPatch——那是 mock 夹具
 *  的形状，不该出现在功能的公开端口上。改为结构类型，与 canonical
 *  patchDocument 的 Record<string, unknown> 兼容。 */
export interface LibraryDocumentPatch {
  title?: string;
  reading_status?: string;
  tags?: string[];
  [key: string]: unknown;
}

export type LibrarySearchQuerySubscriber = (value: string) => void;

export interface LibrarySearchPorts {
  searchLibrary: (q: string) => Promise<{ hits?: LibrarySearchAnchor[] } | null | undefined>;
  fetchDocumentList: () => Promise<{ documents?: unknown[] } | null | undefined>;
  patchDocument: (documentId: string, payload: LibraryDocumentPatch) => Promise<unknown>;
  openReader: (anchor: LibrarySearchAnchor) => void;
  subscribeQuery: (subscriber: LibrarySearchQuerySubscriber) => () => void;
}

export interface LibrarySearchAppHandle {
  unmount: () => void;
}

// React 岛约定(试点):
// - 宿主是普通 light-DOM 自定义元素,负责与既有页面的耦合(监听搜索框、派发契约事件);
// - React 应用经动态 import 惰性加载:首个非空查询才拉起,node 测试环境不解析 JSX;
// - 数据经 ports 注入,组件内不直接 import api 层。
class LibrarySearchIsland extends HTMLElement {
  querySubscribers: Set<LibrarySearchQuerySubscriber>;
  appPromise: Promise<LibrarySearchAppHandle | null> | null;
  searchInput: HTMLElement | null;
  handleInput: ((event: Event) => void) | null;

  connectedCallback() {
    if (this.dataset.mounted === "1") {
      return;
    }
    this.dataset.mounted = "1";
    this.querySubscribers = new Set();
    this.appPromise = null;
    this.searchInput = this.ownerDocument.getElementById(RECENT_JOBS_IDS.searchInput);
    this.handleInput = (event) => {
      const target = event?.target as HTMLInputElement | null;
      const value = `${target?.value || ""}`;
      if (value.trim()) {
        this.ensureApp();
      }
      this.querySubscribers.forEach((subscriber) => subscriber(value));
    };
    this.searchInput?.addEventListener("input", this.handleInput);
  }

  disconnectedCallback() {
    if (this.handleInput) {
      this.searchInput?.removeEventListener("input", this.handleInput);
    }
    this.querySubscribers?.clear();
  }

  buildPorts(): LibrarySearchPorts {
    const island = this;
    return {
      searchLibrary: (q) => searchLibrary(API_PREFIX, q),
      fetchDocumentList: () => fetchDocumentList(API_PREFIX),
      patchDocument: (documentId, payload) => patchDocument(API_PREFIX, documentId, payload),
      openReader: (anchor) => {
        const jobId = `${anchor?.job_id || ""}`.trim();
        if (!jobId) {
          return;
        }
        island.dispatchEvent(new CustomEvent(APP_EVENTS.openReaderRequested, {
          bubbles: true,
          detail: {
            jobId,
            documentId: `${anchor?.document_id || ""}`.trim(),
            pageIdx: anchor?.page_idx,
            blockId: `${anchor?.block_id || ""}`.trim(),
          },
        }));
      },
      subscribeQuery: (subscriber) => {
        island.querySubscribers.add(subscriber);
        const input = island.searchInput as HTMLInputElement | null;
        subscriber(`${input?.value || ""}`);
        return () => island.querySubscribers.delete(subscriber);
      },
    };
  }

  ensureApp() {
    if (!this.appPromise) {
      this.appPromise = import("./library-search-app.jsx")
        .then((module) => module.mountLibrarySearchApp(this, this.buildPorts()))
        .catch((error) => {
          this.appPromise = null;
          // node 测试环境无法解析 JSX,这里静默降级;浏览器构建产物已内联该模块
          console.error("library-search island 加载失败", error);
          return null;
        });
    }
    return this.appPromise;
  }
}

// node --test 环境下部分组件测试直接 import HomeApp.jsx 而不搭建完整 jsdom
// window(customElements 未定义)。守卫不影响真实浏览器行为——customElements
// 在浏览器/jsdom 里恒存在。
if (typeof customElements !== "undefined" && !customElements.get("library-search-island")) {
  customElements.define("library-search-island", LibrarySearchIsland);
}
