const p = Object.freeze({
  source: {
    fallbackSuffix: "source",
    label: "原始 PDF",
    operation: "下载原始 PDF"
  },
  sideBySide: {
    fallbackSuffix: "side-by-side",
    label: "对照 PDF",
    operation: "下载对照 PDF"
  },
  translated: {
    fallbackSuffix: "translated",
    label: "译文 PDF",
    operation: "下载译文 PDF"
  }
});
function g(e) {
  return typeof e == "string" ? e.trim() : "";
}
function D({ jobId: e = "", jobPayload: t = null, manifestPayload: o = null } = {}) {
  return {
    currentJobId: e,
    currentJobManifest: o || null,
    currentJobManifestJobId: e,
    currentJobSnapshot: t || null
  };
}
function F(e, t) {
  return e === "sideBySide" && (!t.source || !t.translated) ? "对照 PDF 需要原始 PDF 和译文 PDF 都可用" : !t.source && (e === "source" || e === "sideBySide") ? "原始 PDF 尚未生成或清单不可用" : !t.translated && (e === "translated" || e === "sideBySide") ? "译文 PDF 尚未生成或清单不可用" : "下载地址暂不可用";
}
function I({
  resolveSourcePdfDownloadName: e = (y, i) => i || "",
  resolveTranslatedPdfDownloadName: t = (y, i) => i || "",
  createRuntimePort: o = null,
  resolveSourcePdf: n = (y) => ""
} = {}) {
  function y({ jobId: l = "", jobPayload: s = null, manifestPayload: m = null } = {}) {
    let f = "", u = "";
    if (o) {
      const P = o({
        getCurrentJobId: (c) => (c == null ? void 0 : c.currentJobId) || "",
        getCurrentJobSnapshot: (c) => (c == null ? void 0 : c.currentJobSnapshot) || null,
        getCachedManifestFor: (c, R) => (c == null ? void 0 : c.currentJobManifest) || null
      }).currentArtifactUrls(D({ jobId: l, jobPayload: s, manifestPayload: m }));
      f = P.translatedPdf || "", u = P.sideBySidePdf || "";
    }
    const r = n(m) || "", d = typeof r == "string" ? r : r && typeof r == "object" && (r.resource_url || r.resource_path || r.resourceUrl || r.resourcePath) || "", a = typeof r == "string" ? r : d || r;
    return {
      source: typeof a == "string" ? a : a || "",
      sideBySide: (typeof a == "string" ? a : d || r) && f ? u : "",
      translated: f
    };
  }
  function i(l, { jobId: s, jobPayload: m, manifestPayload: f }) {
    var r;
    const u = `${s || "result"}-${((r = p[l]) == null ? void 0 : r.fallbackSuffix) || "download"}.pdf`, _ = D({ jobId: s, jobPayload: m, manifestPayload: f });
    return l === "source" ? e(_, u) || u : l === "translated" && t(_, u) || u;
  }
  return Object.freeze({
    resolveReaderDownloadUrls: y,
    resolveReaderDownloadName: i,
    readerDownloadNameState: D,
    disabledReason: F,
    trimString: g,
    READER_DOWNLOAD_ACTIONS: p
  });
}
const v = I(), $ = v.resolveReaderDownloadUrls, k = v.resolveReaderDownloadName;
function x(e = {}) {
  const t = `${(e == null ? void 0 : e.favorite_id) || ""}`.trim(), o = `${(e == null ? void 0 : e.quote_text) || ""}`.trim();
  if (!t || !o)
    return null;
  const n = Number(e.page_idx);
  return {
    favoriteId: t,
    documentId: `${e.document_id || ""}`.trim(),
    jobId: `${e.job_id || ""}`.trim(),
    pageIdx: Number.isFinite(n) && n >= 0 ? n : 0,
    blockId: `${e.block_id || ""}`.trim(),
    kind: `${e.kind || ""}`.trim() || "sentence",
    quoteText: o,
    translatedQuoteText: `${e.translated_quote_text || ""}`.trim(),
    note: `${e.note || ""}`.trim(),
    createdAt: `${e.created_at || ""}`.trim()
  };
}
function h(e = [], t = []) {
  const o = new Set(
    (Array.isArray(t) ? t : []).map((n) => `${(n == null ? void 0 : n.serverFavoriteId) || ""}`.trim()).filter(Boolean)
  );
  return (Array.isArray(e) ? e : []).filter((n) => (n == null ? void 0 : n.favoriteId) && !o.has(n.favoriteId));
}
function N({
  jobId: e = "",
  apiPrefix: t = "",
  documentByJobId: o = async (l, s) => null,
  submitFavorite: n = async (l, s) => null,
  loadFavorites: y = async (l, s) => ({ favorites: [] }),
  removeFavorite: i = async (l, s) => null
} = {}) {
  let l = null;
  function s() {
    return l || (l = (async () => {
      try {
        const r = await o(t, e);
        return `${(r == null ? void 0 : r.document_id) || ""}`.trim();
      } catch {
        return "";
      }
    })()), l;
  }
  async function m(r = {}) {
    const d = `${r.blockId || ""}`.trim(), a = `${r.quoteText || ""}`.trim();
    if (!d || !a)
      return null;
    try {
      const b = await n(t, {
        job_id: e,
        page_idx: Number(r.pageIdx) || 0,
        block_id: d,
        quote_text: a,
        translated_quote_text: `${r.translatedQuoteText || ""}`,
        kind: "sentence"
      });
      return console.info("收藏已同步到服务端", (b == null ? void 0 : b.favorite_id) || ""), b;
    } catch (b) {
      return console.error("同步收藏到服务端失败", b), null;
    }
  }
  async function f() {
    const r = await s();
    if (!r)
      return [];
    try {
      const { favorites: d = [] } = await y(t, { documentId: r });
      return (Array.isArray(d) ? d : []).map(x).filter(Boolean);
    } catch (d) {
      return console.warn("读取服务端收藏失败", d), [];
    }
  }
  async function u(r) {
    const d = `${r || ""}`.trim();
    if (!d)
      return !1;
    try {
      return await i(t, d), !0;
    } catch (a) {
      return console.error("删除服务端收藏失败", a), !1;
    }
  }
  async function _(r = {}, d = "") {
    if (!(r != null && r.favoriteId))
      return null;
    try {
      const a = await n(t, {
        job_id: `${r.jobId || e || ""}`.trim() || void 0,
        page_idx: Number(r.pageIdx) || 0,
        block_id: `${r.blockId || ""}`.trim(),
        quote_text: `${r.quoteText || ""}`,
        translated_quote_text: `${r.translatedQuoteText || ""}`,
        kind: `${r.kind || "sentence"}`,
        note: `${d || ""}`
      });
      return await u(r.favoriteId), x(a);
    } catch (a) {
      return console.error("更新批注笔记失败", a), null;
    }
  }
  return Object.freeze({
    loadServerFavorites: f,
    recreateFavoriteNote: _,
    removeServerFavorite: u,
    resolveDocumentId: s,
    syncFavorite: m
  });
}
const S = Object.freeze({
  boot: "正在准备对照阅读…",
  metadata: "正在读取任务信息…",
  both: "正在加载原始 PDF 和译文 PDF…",
  sourceOnly: "原始 PDF 已加载，正在加载译文 PDF…",
  translatedOnly: "译文 PDF 已加载，正在加载原始 PDF…",
  ready: "对照阅读已就绪",
  failed: "对照阅读加载失败"
});
function O() {
  return {
    reader: {
      totalPages: 0,
      currentPage: 0,
      primaryViewerKey: ""
    },
    progress: {
      metadataReady: !1,
      sourceDone: !1,
      translatedDone: !1
    },
    bootProgressBar: {
      value: 0,
      target: 0,
      rafId: 0
    }
  };
}
function A(e) {
  e != null && e.progress && (e.progress.metadataReady = !1, e.progress.sourceDone = !1, e.progress.translatedDone = !1);
}
function B(e, t = S) {
  if (!(e != null && e.metadataReady))
    return { percent: 8, text: t.boot, stage: "boot" };
  const o = Number(e.sourceDone) + Number(e.translatedDone), n = 24 + o * 30;
  return o === 0 ? { percent: n, text: t.both, stage: "pdfs" } : o === 1 ? {
    percent: n,
    text: e.sourceDone ? t.sourceOnly : t.translatedOnly,
    stage: "pdfs"
  } : { percent: 92, text: t.ready, stage: "readying" };
}
export {
  p as READER_DOWNLOAD_ACTIONS,
  S as READER_PROGRESS_COPY,
  B as computeReaderProgressSnapshot,
  I as createReaderDownloadResolver,
  O as createReaderPageState,
  N as createReaderServerFavoritesPort,
  h as dedupeServerFavorites,
  F as disabledReason,
  x as normalizeServerFavorite,
  D as readerDownloadNameState,
  A as resetReaderProgressState,
  k as resolveReaderDownloadName,
  $ as resolveReaderDownloadUrls,
  g as trimString
};
//# sourceMappingURL=state.js.map
