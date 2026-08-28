import { API_PREFIX } from "../../config/api-constants.js";
import { APP_EVENTS } from "../../contracts/app-contract.js";
import { RECENT_JOBS_IDS } from "../../components/dialogs/recent-jobs-dialog-dom-contract.js";
import { fetchDocumentList, patchDocument } from "../../api/documents.js";
import { searchLibrary } from "../../api/search.js";
import type { MockDocumentPatch } from "../../mock/documents.js";

/** Anchor payload used to open the reader from a search hit / document row. */
export interface LibrarySearchAnchor {
  job_id?: string;
  document_id?: string;
  page_idx?: number;
  block_id?: string;
  [key: string]: unknown;
}

export type LibrarySearchQuerySubscriber = (value: string) => void;

export interface LibrarySearchPorts {
  searchLibrary: (q: string) => Promise<{ hits?: LibrarySearchAnchor[] } | null | undefined>;
  fetchDocumentList: () => Promise<{ documents?: unknown[] } | null | undefined>;
  patchDocument: (documentId: string, payload: MockDocumentPatch) => Promise<unknown>;
  openReader: (anchor: LibrarySearchAnchor) => void;
  subscribeQuery: (subscriber: LibrarySearchQuerySubscriber) => () => void;
}

export interface LibrarySearchAppHandle {
  unmount: () => void;
}

// Quy ước React island (thí điểm):
// - Host là một custom element light-DOM thông thường, chịu trách nhiệm kết nối với trang hiện có (lắng nghe ô tìm kiếm, phát sự kiện contract);
// - Ứng dụng React được tải lười qua dynamic import: chỉ tải khi có truy vấn không rỗng đầu tiên, môi trường test node không parse JSX;
// - Dữ liệu được inject qua ports, không import trực tiếp lớp api trong component.
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
          // Môi trường test node không thể parse JSX, ở đây hạ cấp im lặng; sản phẩm build trình duyệt đã inline module này
          console.error("Tải library-search island thất bại", error);
          return null;
        });
    }
    return this.appPromise;
  }
}

// Trong môi trường node --test, một số test component import trực tiếp HomeApp.jsx mà không dựng toàn bộ jsdom
// window(customElements chưa định nghĩa). Guard này không ảnh hưởng hành vi trình duyệt thực tế — customElements
// luôn tồn tại trong trình duyệt/jsdom.
if (typeof customElements !== "undefined" && !customElements.get("library-search-island")) {
  customElements.define("library-search-island", LibrarySearchIsland);
}
