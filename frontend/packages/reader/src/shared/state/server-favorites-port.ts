// 共享真值（原 frontend/web/src/js/reader/server-favorites-port.ts），已抽离为可注入依赖
// 不直接 import frontend/web 的 config/api，仅通过参数注入，默认提供空实现保证纯函数可测试
import type {
  CreateServerFavoritesPortOptions,
  FavoriteItem,
  SelectionQuote,
  ServerFavorite,
  ServerFavoriteRaw,
} from "../types/types.js";

// 服务端收藏 → 阅读器视图记录:snake_case 转 camelCase,
// page_idx 与 jumpToReaderAnchor 的 pageIdx 同为 0 基。
// 缺 favorite_id 或 quote_text 的脏数据直接丢弃(返回 null)。
export function normalizeServerFavorite(raw: ServerFavoriteRaw = {} as ServerFavoriteRaw): ServerFavorite | null {
  const favoriteId = `${(raw as any)?.favorite_id || ""}`.trim();
  const quoteText = `${(raw as any)?.quote_text || ""}`.trim();
  if (!favoriteId || !quoteText) {
    return null;
  }
  const pageIdx = Number((raw as any).page_idx);
  return {
    favoriteId,
    documentId: `${(raw as any).document_id || ""}`.trim(),
    jobId: `${(raw as any).job_id || ""}`.trim(),
    pageIdx: Number.isFinite(pageIdx) && pageIdx >= 0 ? pageIdx : 0,
    blockId: `${(raw as any).block_id || ""}`.trim(),
    kind: `${(raw as any).kind || ""}`.trim() || "sentence",
    quoteText,
    translatedQuoteText: `${(raw as any).translated_quote_text || ""}`.trim(),
    note: `${(raw as any).note || ""}`.trim(),
    createdAt: `${(raw as any).created_at || ""}`.trim(),
  };
}

// 本地记录同步成功后带 serverFavoriteId;云端区不重复展示这些收藏。
export function dedupeServerFavorites(
  serverFavorites: ServerFavorite[] = [],
  localItems: FavoriteItem[] = [],
): ServerFavorite[] {
  const syncedIds = new Set(
    (Array.isArray(localItems) ? localItems : [])
      .map((item) => `${(item as any)?.serverFavoriteId || ""}`.trim())
      .filter(Boolean),
  );
  return (Array.isArray(serverFavorites) ? serverFavorites : [])
    .filter((favorite) => favorite?.favoriteId && !syncedIds.has(favorite.favoriteId));
}

// 把阅读器收藏同步到后端 favorites。
// document_id 经后端 GET /documents?job_id= 直查(含历史 run),前端不再扫列表反查。
// 所有服务端调用尽力而为:失败仅记录日志,阅读器本地功能不受影响。
export function createReaderServerFavoritesPort({
  jobId = "",
  apiPrefix = "",
  documentByJobId = async (_apiPrefix: string, _jobId: string) => null as any,
  submitFavorite = async (_apiPrefix: string, _payload: Record<string, unknown>) => null as any,
  loadFavorites = async (_apiPrefix: string, _opts?: { documentId?: string }) => ({ favorites: [] } as any),
  removeFavorite = async (_apiPrefix: string, _favoriteId: string) => null as any,
}: CreateServerFavoritesPortOptions = {}) {
  let documentIdPromise: Promise<string> | null = null;

  function resolveDocumentId() {
    if (!documentIdPromise) {
      documentIdPromise = (async () => {
        try {
          const document = await documentByJobId(apiPrefix, jobId);
          return `${(document as any)?.document_id || ""}`.trim();
        } catch (_err) {
          return "";
        }
      })();
    }
    return documentIdPromise;
  }

  async function syncFavorite(quote: SelectionQuote = {}) {
    const blockId = `${(quote as any).blockId || ""}`.trim();
    const quoteText = `${(quote as any).quoteText || ""}`.trim();
    if (!blockId || !quoteText) {
      return null;
    }
    try {
      // 写路径只给 job_id,后端解析所属文档(历史 run 也能收藏)
      const favorite = await submitFavorite(apiPrefix, {
        job_id: jobId,
        page_idx: Number((quote as any).pageIdx) || 0,
        block_id: blockId,
        quote_text: quoteText,
        translated_quote_text: `${(quote as any).translatedQuoteText || ""}`,
        kind: "sentence",
      });
      console.info("收藏已同步到服务端", (favorite as any)?.favorite_id || "");
      return favorite;
    } catch (error) {
      console.error("同步收藏到服务端失败", error);
      return null;
    }
  }

  // 拉取当前文档的服务端收藏并归一化;离线/解析不到文档时静默返回空。
  // mock 模式不短路:api 层自带 mock 分支,基线与 e2e 依赖 mock 全流程可用。
  async function loadServerFavorites(): Promise<ServerFavorite[]> {
    const documentId = await resolveDocumentId();
    if (!documentId) {
      return [];
    }
    try {
      const { favorites = [] } = await loadFavorites(apiPrefix, { documentId });
      return (Array.isArray(favorites) ? favorites : [])
        .map(normalizeServerFavorite)
        .filter(Boolean) as ServerFavorite[];
    } catch (error) {
      console.warn("读取服务端收藏失败", error);
      return [];
    }
  }

  // 删除服务端收藏,成功返回 true;失败仅记录日志返回 false(不阻塞本地流程)。
  async function removeServerFavorite(favoriteId: string) {
    const normalized = `${favoriteId || ""}`.trim();
    if (!normalized) {
      return false;
    }
    try {
      await removeFavorite(apiPrefix, normalized);
      return true;
    } catch (error) {
      console.error("删除服务端收藏失败", error);
      return false;
    }
  }

  // 规范没有收藏 PATCH:改笔记 = 同锚点重建 + 删旧。先建后删,失败不丢数据。
  // 写路径只给 job_id,后端解析所属文档。
  async function recreateFavoriteNote(annotation: Partial<ServerFavorite> = {}, note = "") {
    if (!annotation?.favoriteId) {
      return null;
    }
    try {
      const created = await submitFavorite(apiPrefix, {
        job_id: `${(annotation as any).jobId || jobId || ""}`.trim() || undefined,
        page_idx: Number((annotation as any).pageIdx) || 0,
        block_id: `${(annotation as any).blockId || ""}`.trim(),
        quote_text: `${(annotation as any).quoteText || ""}`,
        translated_quote_text: `${(annotation as any).translatedQuoteText || ""}`,
        kind: `${(annotation as any).kind || "sentence"}`,
        note: `${note || ""}`,
      });
      await removeServerFavorite(annotation.favoriteId);
      return normalizeServerFavorite(created as any);
    } catch (error) {
      console.error("更新批注笔记失败", error);
      return null;
    }
  }

  return Object.freeze({
    loadServerFavorites,
    recreateFavoriteNote,
    removeServerFavorite,
    resolveDocumentId,
    syncFavorite,
  });
}
