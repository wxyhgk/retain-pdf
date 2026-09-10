// 主页 ↔ 阅读器整页跳转时的回程状态（自包含版，从 frontend/web/src/shared/navigation/home-return-state.ts 复制）

export const HOME_RETURN_STORAGE_KEY = "retainpdf.home.return.v1";

export type HomeReturnState = {
  allowBack: boolean;
  activeTab: "library" | "categories" | "favorites" | "ask" | string;
  libraryScrollTop: number;
  panelScrollTop: number;
  windowScrollY: number;
  ts: number;
};

const MAX_AGE_MS = 2 * 60 * 60 * 1000;

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
  if (id.endsWith("-categories")) return "categories";
  if (id.endsWith("-favorites")) return "favorites";
  if (id.endsWith("-ask")) return "ask";
  return "library";
}

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
