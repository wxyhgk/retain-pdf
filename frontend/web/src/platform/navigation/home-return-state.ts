// 主页 ↔ 阅读器整页跳转时的回程状态（滚动 / tab / 是否可 history.back）。
// sessionStorage 按标签页隔离，适合「离开前记下，回来再恢复」。

export const HOME_RETURN_STORAGE_KEY = "retainpdf.home.return.v1";

export type HomeReturnState = {
  /** 本标签页是从主页 navigate 进阅读器的，关闭时应优先 history.back */
  // activeTab "categories" 为历史契约，对应领域 collections（LibraryTopTabs COLLECTIONS_TAB_KEY）
  allowBack: boolean;
  activeTab: "library" | "categories" | "favorites" | "ask" | string; // "categories" == collections
  libraryScrollTop: number;
  panelScrollTop: number;
  windowScrollY: number;
  ts: number;
};

const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2h

function safeParse(raw: string | null): HomeReturnState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<HomeReturnState>;
    if (!data || typeof data !== "object") return null;
    if (typeof data.ts === "number" && Date.now() - data.ts > MAX_AGE_MS) {
      return null;
    }
    return {
      allowBack: Boolean(data.allowBack),
      activeTab: `${data.activeTab || "library"}`,
      libraryScrollTop: Number(data.libraryScrollTop) || 0,
      panelScrollTop: Number(data.panelScrollTop) || 0,
      windowScrollY: Number(data.windowScrollY) || 0,
      ts: Number(data.ts) || Date.now(),
    };
  } catch {
    return null;
  }
}

function readActiveLibraryTab(): string {
  const active = document.querySelector(".library-top-tab.is-active");
  const id = `${active?.id || ""}`;
  if (id.endsWith("-categories")) return "categories"; // == collections 领域
  if (id.endsWith("-favorites")) return "favorites";
  if (id.endsWith("-ask")) return "ask";
  return "library";
}

/** 离开主页进阅读器前调用：记下滚动与 tab */
export function captureHomeReturnState(options: { allowBack?: boolean } = {}) {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return;
  }
  try {
    const library = document.getElementById("recent-jobs-scroll-body");
    const panel = document.querySelector(
      ".categories-view, .collections-view, .favorites-view, #categories-view, #favorites-view, #home-ask-view, .home-ask-scroll",
    ) as HTMLElement | null;
    const state: HomeReturnState = {
      allowBack: options.allowBack !== false,
      activeTab: readActiveLibraryTab(),
      libraryScrollTop: library?.scrollTop ?? 0,
      panelScrollTop: panel?.scrollTop ?? 0,
      windowScrollY: window.scrollY || document.documentElement.scrollTop || 0,
      ts: Date.now(),
    };
    sessionStorage.setItem(HOME_RETURN_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota */
  }
}

export function peekHomeReturnState(): HomeReturnState | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return safeParse(sessionStorage.getItem(HOME_RETURN_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** 读出并清除（恢复滚动后调用，避免下次误用） */
export function consumeHomeReturnState(): HomeReturnState | null {
  const state = peekHomeReturnState();
  clearHomeReturnState();
  return state;
}

export function clearHomeReturnState() {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(HOME_RETURN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function applyHomeReturnScroll(state: HomeReturnState) {
  if (typeof window === "undefined") return;
  const library = document.getElementById("recent-jobs-scroll-body");
  if (library && state.libraryScrollTop > 0) {
    library.scrollTop = state.libraryScrollTop;
  }
  const panel = document.querySelector(
    ".categories-view, .collections-view, .favorites-view, #categories-view, #favorites-view",
  ) as HTMLElement | null;
  if (panel && state.panelScrollTop > 0) {
    panel.scrollTop = state.panelScrollTop;
  }
  if (state.windowScrollY > 0) {
    window.scrollTo(0, state.windowScrollY);
  }
}
