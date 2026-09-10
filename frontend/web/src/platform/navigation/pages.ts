// 三页导航统一契约（壳 A5）：home / detail / reader。
//
// - home:   index.html?tab=library|collections|favorites|ask
//          （UI 历史键 "categories" == 领域 collections，双向兼容）
// - detail: detail.html?job_id=<jobId>
// - reader: reader.html?job_id=<jobId>&page_idx=<n>&block_id=<id>
//          （page/blockId 为同义别名，解析兼容、构造双写；运行时以 page_idx/block_id 为准）
//
// 跳转统一走 navigateTo()；APP_EVENTS.openReaderRequested 事件保留兼容，
// 新代码优先用 buildReaderUrl() + navigateToReader()/navigateTo()。

export type HomeTab = "library" | "collections" | "favorites" | "ask";
/** UI 层历史键：categories == collections（见 LibraryTopTabs COLLECTIONS_TAB_KEY）。 */
export type HomeTabKey = HomeTab | "categories";

export const HOME_TABS: readonly HomeTab[] = ["library", "collections", "favorites", "ask"];

function normalizeTabKey(raw: unknown): HomeTabKey | "" {
  const tab = `${raw || ""}`.trim().toLowerCase();
  if (tab === "library" || tab === "collections" || tab === "categories" || tab === "favorites" || tab === "ask") {
    return tab as HomeTabKey;
  }
  return "";
}

/** 解析 home ?tab=；collections/categories 互为别名，统一返回 UI 键（categories）。 */
export function parseHomeTab(search?: string): HomeTabKey | "" {
  const query = search ?? (typeof globalThis.location !== "undefined" ? globalThis.location.search : "");
  try {
    return normalizeTabKey(new URLSearchParams(query).get("tab"));
  } catch {
    return "";
  }
}

/** UI 键 → 对外契约 tab（categories → collections）。 */
export function toContractTab(tab: HomeTabKey | string): HomeTab {
  const key = `${tab || ""}`.trim().toLowerCase();
  if (key === "categories" || key === "collections") return "collections";
  if (key === "favorites") return "favorites";
  if (key === "ask") return "ask";
  return "library";
}

/** 对外契约 tab → UI 键（collections → categories，保持 HomeApp 现状）。 */
export function toUiTabKey(tab: HomeTab | HomeTabKey | string): HomeTabKey {
  const key = `${tab || ""}`.trim().toLowerCase();
  if (key === "collections" || key === "categories") return "categories";
  if (key === "favorites") return "favorites";
  if (key === "ask") return "ask";
  return "library";
}

export function buildHomeUrl(tab: HomeTab | HomeTabKey | string = "library"): string {
  const contract = toContractTab(`${tab || "library"}`);
  return `./index.html?tab=${encodeURIComponent(contract)}`;
}

export function parseDetailJobId(search?: string): string {
  const query = search ?? (typeof globalThis.location !== "undefined" ? globalThis.location.search : "");
  try {
    return `${new URLSearchParams(query).get("job_id") || ""}`.trim();
  } catch {
    return "";
  }
}

export function buildDetailUrl(jobId: string): string {
  const id = `${jobId || ""}`.trim();
  if (!id) return "";
  return `./detail.html?job_id=${encodeURIComponent(id)}`;
}

export type ReaderParams = {
  jobId: string;
  documentId: string;
  page: number | null;
  blockId: string;
};

/** 解析 reader 入参：新契约 page/blockId，兼容历史 page_idx/block_id。 */
export function parseReaderParams(search?: string): ReaderParams {
  const query = search ?? (typeof globalThis.location !== "undefined" ? globalThis.location.search : "");
  const empty: ReaderParams = { jobId: "", documentId: "", page: null, blockId: "" };
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(query);
  } catch {
    return empty;
  }
  const jobId = `${params.get("job_id") || ""}`.trim();
  const documentId = `${params.get("document_id") || ""}`.trim();
  const rawPage = `${params.get("page") ?? params.get("page_idx") ?? ""}`.trim();
  const pageNum = rawPage === "" ? NaN : Number(rawPage);
  const rawBlock = `${params.get("blockId") ?? params.get("block_id") ?? ""}`.trim();
  return {
    jobId,
    documentId,
    page: Number.isFinite(pageNum) ? Math.max(0, Math.floor(pageNum)) : null,
    blockId: rawBlock,
  };
}

export function buildReaderUrl(
  jobId: string,
  anchor: { page?: number | null; pageIdx?: number | null; blockId?: string } | null = null,
  extra: { documentId?: string } = {},
): string {
  const id = `${jobId || ""}`.trim();
  const documentId = `${extra.documentId || ""}`.trim();
  if (!id && !documentId) return "";
  const params = new URLSearchParams();
  if (id) params.set("job_id", id);
  else params.set("document_id", documentId);
  const rawPage = anchor?.page ?? anchor?.pageIdx ?? null;
  const pageNum = rawPage === null || rawPage === undefined ? NaN : Number(rawPage);
  const blockId = `${anchor?.blockId || ""}`.trim();
  if (Number.isFinite(pageNum)) {
    // 双写：page（对外契约）+ page_idx（阅读器运行时真值，见 frontend/packages/reader page-config）。
    const pageStr = `${Math.max(0, Math.floor(pageNum))}`;
    params.set("page", pageStr);
    params.set("page_idx", pageStr);
  }
  if (blockId) {
    // 双写：blockId（对外契约）+ block_id（运行时真值）。
    params.set("blockId", blockId);
    params.set("block_id", blockId);
  }
  return `./reader.html?${params.toString()}`;
}

/** 全站唯一跳转出口：assign（默认）/ replace（深链、避免返回死循环）。 */
export function navigateTo(url: string, options: { replace?: boolean } = {}): void {
  const target = `${url || ""}`.trim();
  if (!target || typeof window === "undefined") return;
  if (options.replace) window.location.replace(target);
  else window.location.assign(target);
}
