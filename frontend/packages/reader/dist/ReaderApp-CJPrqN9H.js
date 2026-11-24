var Qn = (e) => {
  throw TypeError(e);
};
var er = (e, t, n) => t.has(e) || Qn("Cannot " + n);
var yt = (e, t, n) => (er(e, t, "read from private field"), n ? n.call(e) : t.get(e)), tr = (e, t, n) => t.has(e) ? Qn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), nr = (e, t, n, r) => (er(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as L, jsx as p, Fragment as at } from "react/jsx-runtime";
import { useMemo as G, useState as N, useEffect as C, useCallback as x, useRef as A, useLayoutEffect as ke, memo as Yt, createContext as Mn, useContext as An, forwardRef as Qr, useImperativeHandle as _n, useSyncExternalStore as eo, useId as to, Suspense as ca, lazy as da } from "react";
import { requireAdapter as gt, getReaderAdapters as _e } from "./adapters.js";
import { resolveReaderDownloadName as ua, resolveReaderDownloadUrls as fa, READER_PROGRESS_COPY as Fe, trimString as Ht, READER_DOWNLOAD_ACTIONS as ma, disabledReason as ha } from "./runtime/state.js";
import { r as pa, b as ga } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as mn, isFinishedJobStatus as Pt } from "@retainpdf/domain/job";
import { n as no, d as ba, f as en, k as rr, b as ya, c as va, j as Lt, p as Ln, g as wa, l as or, i as Sa } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as Ia } from "@retainpdf/api/documents";
import { isReaderTransportError as Ra, createReaderTransportError as Ea } from "./contracts.js";
import { toast as hn, Toaster as Pa } from "sonner";
import { X as bt, PenLine as Cn, Check as ro, Copy as Ta, ChevronUp as ka, ChevronDown as oo, History as Na, LoaderCircle as Ma, Pin as Aa, LogOut as _a, FileText as ao, Columns2 as so, Languages as io, Radio as La, ArrowDownToLine as Ca, CheckCircle2 as Da, Keyboard as xa, Download as za, ListOrdered as Oa, TriangleAlert as $a, ListTree as Fa, Search as Ba, GitCompareArrows as ja, LayoutGrid as Ua, Highlighter as Ha, Eraser as Wa, Undo2 as Va, Trash2 as Ka } from "lucide-react";
import { Button as ne, Textarea as Ja, IconButton as ar, Input as lo } from "@retainpdf/ui";
import { pdfjs as co, Page as qa, Document as Ga } from "react-pdf";
import { e as Za, m as Ya, a as Xa } from "./markdown-math-XkF5urpn.js";
const Qa = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, es = "", ts = Object.freeze({
  progress: "retainpdf-reader-progress"
}), ns = (e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Cf = (...e) => {
  var n;
  return (((n = _e()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Be = () => gt("defaultReaderDataPort"), sr = () => gt("defaultReaderPageConfigPort"), Df = {
  get apiPrefix() {
    return Be().apiPrefix;
  },
  fetchProtected: (...e) => Be().fetchProtected(...e),
  loadMarkdownPayload: (e) => Be().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Be().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Be().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Be().loadJobPayload(e),
  loadReaderPayload: (e, t) => Be().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Be().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Be().liveTranslation;
  }
}, uo = {
  messageTargetOrigin: () => sr().messageTargetOrigin(),
  readerJobId: () => sr().readerJobId()
}, rs = () => {
  var e;
  return ((e = _e()) == null ? void 0 : e.liveTranslation) ?? null;
}, Tt = () => {
  var t;
  const e = _e();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Xe = () => {
  const e = _e();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => gt("fetchDocumentByJobId")(...n),
    fetchProtected: t.fetchProtected,
    resolveResourceUrl: e.resolveResourceUrl ?? ((n) => n),
    resolveReaderSourcePdf: (n) => {
      var r;
      return ((r = e.resolveReaderSourcePdf) == null ? void 0 : r.call(e, n)) ?? null;
    },
    resolveReaderTranslatedPdfUrl: (n, r) => {
      var o;
      return ((o = e.resolveReaderTranslatedPdfUrl) == null ? void 0 : o.call(e, n, r)) ?? "";
    },
    resolveReaderArtifactUrl: (n) => {
      var r;
      return ((r = e.resolveReaderArtifactUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, os = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, as = () => {
  var e, t;
  return ((t = (e = _e()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, ss = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, is = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? ua(...e);
}, ls = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? fa(...e);
}, cs = (...e) => gt("downloadProtectedResource")(...e), ds = (...e) => gt("failDownloadToast")(...e), xf = (e, t) => gt("resolveMarkdownAssetUrl")(e, t), ir = "/api/v1";
function us() {
  const e = () => {
    var r;
    return pa(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = N(e);
  return C(() => {
    var i, l, c, d;
    const r = () => n(e()), o = (l = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : l.bind(globalThis.history), a = (d = (c = globalThis.history) == null ? void 0 : c.replaceState) == null ? void 0 : d.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const f = (u) => function(...m) {
          const y = u.apply(this, m);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), y;
        };
        globalThis.history.pushState = f(o), globalThis.history.replaceState = f(a), s = !0;
      } catch {
      }
    return window.addEventListener("popstate", r), window.addEventListener("hashchange", r), window.addEventListener("pushstate", r), window.addEventListener("replacestate", r), window.addEventListener("locationchange", r), () => {
      if (window.removeEventListener("popstate", r), window.removeEventListener("hashchange", r), window.removeEventListener("pushstate", r), window.removeEventListener("replacestate", r), window.removeEventListener("locationchange", r), s && o && a)
        try {
          globalThis.history.pushState = o, globalThis.history.replaceState = a;
        } catch {
        }
    };
  }, []), t;
}
function fs() {
  const e = us(), t = G(() => ss(uo), [e]), n = G(() => as(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function ms(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [l, c] = N({
    documentId: "",
    jobId: ""
  }), [d, f] = N({
    documentId: "",
    jobId: ""
  }), u = l.documentId === t ? l.jobId : "", m = d.documentId === t ? d.jobId : "", y = n || u, [h, b] = N({
    jobId: "",
    documentId: ""
  }), w = h.jobId === y ? h.documentId : "", S = t || w, v = !!t && !y, [g, I] = N(null), R = (g == null ? void 0 : g.sessionIdentity) === r && g.documentId === S ? g : null, k = v || !!R, O = x((F) => {
    const E = `${F.documentId || ""}`.trim();
    if (!E || a.current && a.current !== E) return;
    if (!a.current && s.current)
      b({
        jobId: s.current,
        documentId: E
      });
    else if (!a.current)
      return;
    const T = `${F.revision || ""}`.trim() || `${Date.now()}`;
    I({
      documentId: E,
      revision: T,
      sessionIdentity: o.current
    }), i();
  }, []);
  C(() => {
    I((F) => F && F.sessionIdentity !== r ? null : F);
  }, [r]);
  const $ = x((F) => {
    switch (F.type) {
      case "resolved-document-job":
        c({ documentId: F.documentId, jobId: F.jobId });
        break;
      case "cleared-resolved-document-job":
        c({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: F.documentId, jobId: F.jobId });
        break;
      case "resolved-job-document":
        b((E) => E.jobId === F.jobId && E.documentId === F.documentId ? E : { jobId: F.jobId, documentId: F.documentId });
        break;
      case "committed-source":
        I({
          documentId: F.documentId,
          revision: F.revision,
          sessionIdentity: F.sessionIdentity
        });
        break;
    }
  }, []);
  return {
    resolvedDocumentJob: l,
    setResolvedDocumentJob: c,
    missingDocumentJob: d,
    setMissingDocumentJob: f,
    documentJobId: u,
    rejectedDocumentJobId: m,
    sessionJobId: y,
    resolvedJobDocument: h,
    setResolvedJobDocument: b,
    jobDocumentId: w,
    documentId: S,
    sourceOnly: v,
    committedDocumentSource: g,
    setCommittedDocumentSource: I,
    activeCommittedDocumentSource: R,
    sourceViewOnly: k,
    refreshCommittedDocument: O,
    applyIdentityEvent: $
  };
}
function lr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function hs(e) {
  var r, o, a, s;
  if (!e || typeof e != "object") return "";
  const t = e, n = [
    t.document_id,
    t.documentId,
    (r = t.document) == null ? void 0 : r.document_id,
    (o = t.book_summary) == null ? void 0 : o.document_id,
    (s = (a = t.request_payload) == null ? void 0 : a.source) == null ? void 0 : s.document_id
  ];
  for (const i of n) {
    const l = `${i || ""}`.trim();
    if (l) return l;
  }
  return "";
}
function cr(e, t) {
  return ns(mn(e, t));
}
function ps(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function gs(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !ps(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function pn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: ts.progress,
        stage: n,
        percent: e,
        text: t
      },
      uo.messageTargetOrigin()
    );
  } catch {
  }
}
function Wt(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), pn({ percent: t, text: n, stage: r });
}
function bs(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, l] = N(null), [c, d] = N(null), [f, u] = N(""), [m, y] = N(0), h = f === n ? i : null, b = f === n ? c : null, w = lr(h), S = Pt(w), v = x(() => {
    y(($) => $ + 1);
  }, []), g = x(($) => {
    l($.jobPayload), d($.manifestPayload), u($.sessionIdentity);
  }, []), I = x(($) => {
    l(null), d(null), u($);
  }, []), R = A(""), k = A(""), O = x(async () => {
    const $ = o.current;
    if (!$ || R.current === $) return;
    const F = Xe().loadJobPayload;
    if (typeof F != "function") return;
    const E = a.current.value;
    R.current = $;
    try {
      const T = await F($);
      if (s.current || a.current.value !== E || o.current !== $ || !T || typeof T != "object")
        return;
      const P = lr(T);
      l(T), u(r.current), !Pt(P) && k.current === $ && (k.current = ""), P === "succeeded" && k.current !== $ && (k.current = $, y((M) => M + 1));
    } catch {
    } finally {
      R.current === $ && (R.current = "");
    }
  }, []);
  return C(() => {
    k.current = "";
  }, [n]), C(() => {
    if (!t || S || !h) return;
    const $ = window.setInterval(() => {
      document.visibilityState !== "hidden" && O();
    }, 1e3);
    return () => window.clearInterval($);
  }, [S, O, h, t]), {
    jobPayload: i,
    setJobPayload: l,
    manifestPayload: c,
    setManifestPayload: d,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: u,
    scopedJobPayload: h,
    scopedManifestPayload: b,
    jobStatus: w,
    jobTerminal: S,
    jobRefreshRevision: m,
    refreshJobArtifacts: v,
    refreshJobStatus: O,
    publishPayload: g,
    clearPayload: I
  };
}
function gn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function ys(e, t) {
  e(t), gn(t);
}
function vs(e) {
  const [t, n] = N(e ? "source" : "compare"), r = x((a) => {
    e && a !== "source" || (n(a), gn(a));
  }, [e]), o = x((a) => {
    ys(n, a);
  }, []);
  return C(() => (e && document.documentElement.classList.add("reader-source-only"), gn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function dr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function ws(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: dr(n.active_job_id),
    activeVersionId: dr(n.active_version_id)
  };
}
function Ss(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Is(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Rs(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Es = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Ps(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Es.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Ts = 48 * 1024 * 1024;
function ks(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Ns = 2, Te = /* @__PURE__ */ new Map();
function bn(e, t) {
  Te.delete(e), Te.set(e, t);
}
function ur(e) {
  if (Te.size < Ns) return;
  const t = Te.keys().next().value;
  t && Te.delete(t);
}
async function Ms(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function fo(e, t = Tt().fetchProtected, n = {}) {
  var d, f, u, m, y, h, b, w, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Te.has(r)) {
    const v = Te.get(r);
    return bn(r, v), v;
  }
  const o = new AbortController(), a = () => o.abort();
  (d = n.signal) != null && d.aborted && o.abort(), (u = (f = n.signal) == null ? void 0 : f.addEventListener) == null || u.call(f, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (y = (m = n.signal) == null ? void 0 : m.removeEventListener) == null || y.call(m, "abort", a);
  }
  if (!s.ok) {
    const v = new Error(`读取 PDF 失败 (${s.status})`);
    v.status = s.status;
    const g = await Ms(s);
    throw g && (v.reason = g), v;
  }
  const i = As(r, s, t);
  if (i) {
    o.abort();
    const v = { ranged: i };
    return ur(), Te.set(r, v), v;
  }
  (b = (h = n.signal) == null ? void 0 : h.addEventListener) == null || b.call(h, "abort", a, { once: !0 });
  let l;
  try {
    l = await s.arrayBuffer();
  } finally {
    (S = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || S.call(w, "abort", a);
  }
  const c = { data: new Uint8Array(l) };
  return Te.has(r) ? bn(r, c) : (ur(), Te.set(r, c)), c;
}
function As(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Ts ? null : {
    url: e,
    length: o,
    async fetchRange(i, l) {
      const c = await n(e, { headers: { Range: `bytes=${i}-${l - 1}` } });
      if (c.status !== 206) throw new Error(`读取 PDF 片段失败 (${c.status})`);
      return new Uint8Array(await c.arrayBuffer());
    }
  };
}
const _s = { file: null, loading: !1, error: "" }, Ls = { file: null, loading: !0, error: "" };
function Cs(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = N(null);
  if (C(() => {
    if (t || !n) return;
    const s = Te.get(n);
    if (s) {
      bn(n, s);
      return;
    }
    const i = new AbortController();
    return fo(n, void 0, { signal: i.signal }).then((l) => {
      i.signal.aborted || o({ url: n, file: l, loading: !1, error: "" });
    }).catch((l) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (l == null ? void 0 : l.message) || String(l) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return _s;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Te.get(n);
  return a ? { file: a, loading: !1, error: "" } : Ls;
}
function Ds(e) {
  const { sessionEpochRef: t, closingRef: n, abort: r, sessionEpoch: o } = e;
  let a = !1;
  const s = () => r.signal.aborted || n.current || t.current.value !== o;
  return {
    signal: r.signal,
    isClosedOrStale: s,
    isInactive: () => a || s(),
    markFailed: () => {
      a = !0;
    }
  };
}
async function yn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  Wt(s, r, n, "download");
  const i = await fo(t, Tt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Wt(s, o, n, "download"), i);
}
async function xs(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  Wt(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    yn({
      url: t,
      label: "正在下载原文 PDF…",
      percentStart: 30,
      percentEnd: 55,
      fence: r,
      setBoot: o
    }).then((d) => {
      s = d;
    })
  ), n && a.push(
    yn({
      url: n,
      label: "正在下载译文 PDF…",
      percentStart: 55,
      percentEnd: 85,
      fence: r,
      setBoot: o
    }).then((d) => {
      i = d;
    })
  ), await Promise.all(a), r.isInactive() ? { status: "inactive" } : !!t && !s || !!n && !i ? { status: "incomplete" } : { status: "downloaded", sourceBytes: s, translatedBytes: i };
}
function zs(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Os({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Ia,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(zs(o.href, t, a)), !0);
}
const zt = {
  regions: null,
  metadata: null
};
function $s(e) {
  const {
    sessionJobId: t,
    jobId: n,
    routeDocumentId: r,
    documentJobId: o,
    rejectedDocumentJobId: a,
    sourceOnly: s,
    locationKey: i,
    sessionIdentity: l,
    committedSource: c,
    applyIdentityEvent: d,
    publishPayload: f,
    clearPayload: u,
    switchSessionMode: m,
    jobRefreshRevision: y,
    sessionEpochRef: h,
    closingRef: b,
    activeLoadAbortRef: w
  } = e, [S, v] = N(""), [g, I] = N(""), [R, k] = N(null), [O, $] = N(null), [F, E] = N(!1), [T, P] = N(""), [M, _] = N([]), [j, B] = N(!1), [H, X] = N(() => ({
    source: null,
    translated: null
  })), [ae, Y] = N(
    zt
  ), [he, fe] = N({
    loading: !0,
    percent: 4,
    text: Fe.boot,
    stage: "progress",
    failed: !1
  });
  return C(() => {
    const me = new AbortController(), Le = h.current.value, J = Ds({
      sessionEpochRef: h,
      closingRef: b,
      abort: me,
      sessionEpoch: Le
    });
    w.current = me;
    const K = Xe();
    if (b.current)
      return me.abort(), () => {
        w.current === me && (w.current = null);
      };
    let we = !1;
    function ce(Q, z) {
      J.markFailed(), B(!0), fe({
        loading: !1,
        percent: 100,
        text: Q,
        stage: "failed",
        failed: !0
      }), pn({ percent: 100, text: z, stage: "failed" });
    }
    function pe() {
      E(!0), we || B(!0), fe({
        loading: !1,
        percent: 100,
        text: Fe.ready,
        stage: "ready",
        failed: !1
      }), pn({ percent: 100, text: Fe.ready, stage: "ready" });
    }
    function $e() {
      return c != null && c.documentId ? cr(
        c.documentId,
        c.revision
      ) : Qa() ? es : K.resolveResourceUrl(mn(r));
    }
    async function be() {
      var ue;
      let Q = { activeJobId: "", activeVersionId: "" };
      try {
        const le = await ((ue = K.fetchDocument) == null ? void 0 : ue.call(K, r));
        le && (Q = ws(le));
      } catch {
      }
      const z = Ss({
        link: Q,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!c
      });
      if (z.kind === "follow-active-job") {
        if (J.isInactive()) return;
        d({
          type: "resolved-document-job",
          documentId: r,
          jobId: z.jobId
        }), z.activeVersionId ? (c || d({
          type: "committed-source",
          documentId: r,
          revision: z.activeVersionId,
          sessionIdentity: l
        }), m("source")) : m("compare");
        return;
      }
      if (z.kind === "open-committed-source") {
        if (J.isInactive()) return;
        d({
          type: "committed-source",
          documentId: r,
          revision: z.revision,
          sessionIdentity: l
        }), m("source");
        return;
      }
      const ee = $e();
      if (J.isInactive()) return;
      v(ee), I(""), P(""), u(l);
      const te = await yn({
        url: ee,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: J,
        setBoot: fe
      });
      if (!J.isInactive()) {
        if (!te) {
          ce("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        k(te), pe();
      }
    }
    async function Ce() {
      var q;
      const Q = !c, z = !!(Q && K.loadSessionSnapshot && K.loadReaderOptionalArtifacts), ee = z ? K.loadReaderOptionalArtifacts(t) : null, te = await ((q = K.loadSessionSnapshot) == null ? void 0 : q.call(K, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: c,
        includeOptionalArtifacts: Q && !z
      })), ue = te ? {
        jobPayload: te.sourcePayload,
        manifestPayload: te.manifestPayload,
        readerMetadata: te.readerMetadata,
        regionsPayload: te.regions,
        readerErrors: te.readerErrors
      } : await K.loadReaderPayload(t, {
        includeOptionalArtifacts: Q
      });
      if (J.isInactive()) return;
      let le = null;
      if (n && !r)
        if (te && te.linkedDocument !== void 0)
          le = te.linkedDocument;
        else {
          try {
            le = await K.fetchDocumentByJobId(ir, t);
          } catch {
          }
          if (J.isInactive()) return;
        }
      const Ne = hs(ue.jobPayload) || `${(le == null ? void 0 : le.document_id) || ""}`.trim();
      Ne && !r && d({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ne
      });
      const Ie = Is({
        payloadDocumentId: Ne,
        linkedActiveJobId: `${(le == null ? void 0 : le.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(le == null ? void 0 : le.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!c
      });
      if (Ie.kind === "restore-committed-source") {
        if (J.isInactive()) return;
        d({
          type: "committed-source",
          documentId: Ie.documentId,
          revision: Ie.revision,
          sessionIdentity: l
        }), m("source");
        return;
      }
      const Me = K.resolveReaderSourcePdf(ue.manifestPayload), U = K.resolveReaderTranslatedPdfUrl(ue.jobPayload, ue.manifestPayload), re = typeof Me == "string" ? Me : K.resolveReaderArtifactUrl(Me), Ee = r || Ne, Pe = c != null && c.documentId ? cr(
        c.documentId,
        c.revision
      ) : re || (Ee ? K.resolveResourceUrl(mn(Ee)) : ""), Se = c ? "" : U || "";
      v(Pe || ""), I(Se), P(gs(ue.jobPayload, t)), f({
        jobPayload: ue.jobPayload || null,
        manifestPayload: ue.manifestPayload || null,
        sessionIdentity: l
      });
      const Ve = () => xs({
        sourceFinal: Pe || "",
        translatedFinal: Se,
        fence: J,
        setBoot: fe
      }), Dt = !!(Pe || Se), lt = ee && Dt ? Ve() : null;
      lt == null || lt.catch(() => {
      });
      const xt = (V) => {
        J.isInactive() || (_(c ? [] : no(V.regionsPayload)), X(c ? { source: null, translated: null } : ba(V.readerMetadata)), Y(c ? zt : V.readerErrors ?? zt), B(!0));
      };
      if (ee ? (we = !0, ee.then(xt)) : xt(ue), !Dt) {
        ce(Fe.failed, Fe.failed);
        return;
      }
      const D = await (lt ?? Ve());
      if (D.status !== "inactive") {
        if (D.status === "incomplete") {
          ce("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        k(D.sourceBytes), $(D.translatedBytes), pe();
      }
    }
    async function Re() {
      E(!1), k(null), $(null), _([]), B(!1), X({ source: null, translated: null }), Y(zt), Wt(fe, 8, Fe.metadata, "metadata");
      try {
        if (s) {
          await be();
          return;
        }
        if (!t) {
          ce(Fe.failed, Fe.failed);
          return;
        }
        await Ce();
      } catch (Q) {
        if (J.isClosedOrStale() || (Q == null ? void 0 : Q.name) === "AbortError") return;
        J.markFailed();
        const z = Number(Q == null ? void 0 : Q.status), ee = `${(Q == null ? void 0 : Q.reason) || ""}`, te = Ps({ status: z, reason: ee, sessionJobId: t });
        if (te && (await Os({
          apiPrefix: ir,
          documentId: te,
          expiredJobId: t
        }) || J.isClosedOrStale()))
          return;
        if (Rs({
          status: z,
          reason: ee,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          d({ type: "missing-document-job", documentId: r, jobId: t }), d({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const ue = Q instanceof Error ? Q.message : Fe.failed;
        ce(ue, ue);
      }
    }
    return Re(), () => {
      me.abort(), w.current === me && (w.current = null);
    };
  }, [t, r, o, a, s, i, c, y, n, l, d, f, u, m]), {
    sourceUrl: S,
    translatedUrl: g,
    sourceFile: R,
    translatedFile: O,
    assetsReady: F,
    title: T,
    regions: M,
    regionsSettled: j,
    readerMetadata: H,
    readerErrors: ae,
    boot: he
  };
}
function Fs() {
  const e = A(!1), t = A(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = fs(), s = A({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = A(a), l = A(""), c = A(""), d = A(() => {
  }), f = x(() => d.current(), []), u = ms({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: l,
    sessionJobIdRef: c,
    switchToSourceMode: f
  }), {
    sessionJobId: m,
    documentId: y,
    sourceOnly: h,
    sourceViewOnly: b
  } = u, { mode: w, setMode: S, switchSessionMode: v } = vs(b);
  d.current = () => {
    v("source");
  }, i.current = a, l.current = y, c.current = m;
  const g = bs({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: c,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: I,
    scopedManifestPayload: R,
    jobStatus: k,
    jobTerminal: O,
    jobRefreshRevision: $,
    refreshJobArtifacts: F,
    refreshJobStatus: E
  } = g, T = $s({
    sessionJobId: m,
    jobId: r,
    routeDocumentId: o,
    documentJobId: u.documentJobId,
    rejectedDocumentJobId: u.rejectedDocumentJobId,
    sourceOnly: h,
    locationKey: n,
    sessionIdentity: a,
    committedSource: u.activeCommittedDocumentSource,
    applyIdentityEvent: u.applyIdentityEvent,
    publishPayload: g.publishPayload,
    clearPayload: g.clearPayload,
    switchSessionMode: v,
    jobRefreshRevision: $,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), P = x(() => {
    var _;
    e.current = !0, (_ = t.current) == null || _.abort();
  }, []), M = G(
    () => ({
      fetchProtected: Xe().fetchProtected,
      jobId: m,
      jobPayload: I,
      manifestPayload: R,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: b
    }),
    [m, I, R, T.sourceUrl, T.translatedUrl, b]
  );
  return {
    jobId: m,
    jobStatus: k,
    workflow: `${(I == null ? void 0 : I.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: O,
    documentId: y,
    sessionIdentity: a,
    sourceOnly: h,
    mode: w,
    setMode: S,
    sourceUrl: T.sourceUrl,
    translatedUrl: T.translatedUrl,
    sourceFile: T.sourceFile,
    translatedFile: T.translatedFile,
    assetsReady: T.assetsReady,
    boot: T.boot,
    title: T.title,
    regions: T.regions,
    regionsSettled: T.regionsSettled,
    readerMetadata: T.readerMetadata,
    readerErrors: T.readerErrors,
    download: M,
    refreshJobArtifacts: F,
    refreshJobStatus: E,
    refreshCommittedDocument: u.refreshCommittedDocument,
    prepareClose: P
  };
}
const Bs = 160, js = 8, Us = 0;
function Hs() {
  const e = A(null), [t, n] = N(null), [r, o] = N(Us), a = x((s) => {
    e.current = s, n(s);
  }, []);
  return C(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (c) => {
      !Number.isFinite(c) || c < Bs || o((d) => Math.abs(d - c) < js ? d : c);
    }, l = new ResizeObserver((c) => {
      var d, f;
      i(((f = (d = c[0]) == null ? void 0 : d.contentRect) == null ? void 0 : f.width) ?? s.clientWidth);
    });
    return l.observe(s), i(s.clientWidth), () => l.disconnect();
  }, [t]), {
    shellRef: e,
    shellEl: t,
    shellWidth: r,
    bindShell: a
  };
}
function Ws(e) {
  const { mode: t, sourceOnly: n, assetsReady: r, hasSource: o, hasTranslated: a } = e, s = r && o, i = r && a && !n, l = t === "source" || t === "compare", c = !n && (t === "translated" || t === "compare");
  return {
    mountSource: s,
    mountTranslated: i,
    showSource: l,
    showTranslated: c,
    compareMode: t === "compare" && l && c && s && i,
    primaryPane: t === "translated" ? "translated" : "source"
  };
}
const tn = { source: 0, translated: 0 };
function Vs(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: l
  } = e, c = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, d = A(c);
  d.current = c;
  const [f, u] = N(() => ({
    identity: c,
    pages: tn
  })), [m, y] = N(() => ({ identity: c, tick: 0 })), h = f.identity === c ? f.pages : tn, b = m.identity === c ? m.tick : 0, w = Ws({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!l
  }), { primaryPane: S } = w, v = x((E, T) => {
    d.current === c && u((P) => {
      const M = P.identity === c ? P.pages : tn;
      return M[T] === E && P.identity === c ? P : {
        identity: c,
        pages: { ...M, [T]: E }
      };
    });
  }, [c]), g = A(null), I = x(() => {
    g.current && clearTimeout(g.current);
    const E = c;
    g.current = setTimeout(() => {
      g.current = null, d.current === E && y((T) => ({
        identity: E,
        tick: T.identity === E ? T.tick + 1 : 1
      }));
    }, 60);
  }, [c]);
  C(() => (g.current && (clearTimeout(g.current), g.current = null), u((E) => E.identity === c && E.pages.source === 0 && E.pages.translated === 0 ? E : { identity: c, pages: { source: 0, translated: 0 } }), y((E) => E.identity === c && E.tick === 0 ? E : { identity: c, tick: 0 }), () => {
    g.current && (clearTimeout(g.current), g.current = null);
  }), [c]);
  const R = G(
    () => Math.max(h.source, h.translated),
    [h]
  ), k = S === "translated" ? h.translated : h.source || h.translated, O = t == null ? void 0 : t.userZoom, $ = t == null ? void 0 : t.shellWidth, F = `${c}-${b}-${O}-${n}-${h.source}-${h.translated}-${$}`;
  return {
    ...w,
    numPagesByPane: h,
    hudNumPages: R,
    primaryNumPages: k,
    metricsTick: b,
    onNumPages: v,
    onMetrics: I,
    rowSyncRevision: F
  };
}
const Oe = "data-reader-page", Ze = "data-reader-pane", Dn = "data-natural-height", Ks = "reader-react-root", Js = "reader-react-grid", mo = "reader-react-scroll-shell", qs = "reader-react-pdf-pane", ho = "reader-react-pdf-page", Vt = "reader-react-pdf-page-placeholder", xn = "reader-react-pdf-page-slot";
function Kt(e, t) {
  const n = e != null ? `[${Oe}="${e}"]` : `[${Oe}]`;
  return t ? `${n}[${Ze}="${t}"]` : n;
}
function Gs() {
  return `.${xn}[${Oe}]`;
}
function Jt(e) {
  return Number(e.getAttribute(Oe));
}
const po = 0.25, qt = 1, Zs = 0.05, Ct = 0.5, Ys = 16, Xs = 8, Qs = 720;
function et() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function go(e) {
  return Number.isFinite(e) && e < Qs;
}
function ut(e, t = Number.POSITIVE_INFINITY) {
  return go(t) && (e === "source" || e === "translated") ? qt : Ct;
}
function Xt(e) {
  return Number.isFinite(e) ? Math.min(qt, Math.max(po, e)) : Ct;
}
function kt(e, t) {
  const n = Xt(Number(e) + t * Zs);
  return Math.round(n * 100) / 100;
}
function ei(e) {
  return Math.round(Xt(e) * 100);
}
function ti(e) {
  const n = (Number(e) || 0) - Ys - Xs;
  return Math.max(160, Math.floor(n));
}
function ni(e, t = Ct) {
  const n = Xt(t);
  return ti((Number(e) || 0) * n);
}
function ri(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${Ze}]`)
  ).map((s) => ({
    pane: s,
    cx: s.scrollLeft + s.clientWidth / 2,
    hadOverflow: s.scrollWidth > s.clientWidth + 1
  })), a = () => {
    e.scrollLeft = Math.max(0, n * t - e.clientWidth / 2), e.scrollTop = Math.max(0, r * t - e.clientHeight / 2);
    for (const { pane: s, cx: i, hadOverflow: l } of o) {
      const c = Math.max(0, s.scrollWidth - s.clientWidth);
      if (c <= 0) {
        s.scrollLeft = 0;
        continue;
      }
      l ? s.scrollLeft = Math.min(
        c,
        Math.max(0, i * t - s.clientWidth / 2)
      ) : s.scrollLeft = c / 2;
    }
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(a);
  });
}
const oi = 8;
function ai(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < oi ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const bo = 200, yo = [
  "markdown"
], si = yo;
function vo(e) {
  return si.includes(e);
}
const ii = "retainpdf:reader:view:v1:", fr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), li = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function wo() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function vn(e) {
  return `${e || ""}`.trim();
}
function ci({
  documentId: e,
  jobId: t
}) {
  const n = vn(e);
  if (n) return `document:${n}`;
  const r = vn(t);
  return r ? `job:${r}` : "";
}
function So(e) {
  const t = vn(e);
  return t ? `${ii}${t}` : "";
}
function di(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function ui(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!fr.has(t) || !fr.has(n) || t === n))
    return { left: t, right: n };
}
function fi(e) {
  return e === null ? null : vo(e) ? e : void 0;
}
function mi(e) {
  return li.has(e) ? e : void 0;
}
function Io(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = di(t.anchor), r = Number(t.zoom), o = mi(t.mode), a = ui(t.splitLayout), s = fi(t.assistantPanel);
  return {
    schema: "retainpdf_reader_view_v1",
    ...n ? { anchor: n } : {},
    ...Number.isFinite(r) ? { zoom: Math.max(0.25, Math.min(1, r)) } : {},
    ...o !== void 0 ? { mode: o } : {},
    ...a !== void 0 ? { splitLayout: a } : {},
    ...s !== void 0 ? { assistantPanel: s } : {},
    updatedAt: Number.isFinite(Number(t.updatedAt)) ? Number(t.updatedAt) : 0
  };
}
function ze(e, t = wo()) {
  const n = So(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Io(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function Qt(e, t, n = wo()) {
  const r = So(e);
  if (!r || !n) return null;
  const o = ze(e, n), a = Io({
    schema: "retainpdf_reader_view_v1",
    ...o || {},
    ...t,
    updatedAt: Date.now()
  });
  if (!a) return null;
  try {
    return n.setItem(r, JSON.stringify(a)), a;
  } catch {
    return null;
  }
}
function hi(e, t, n = "") {
  var u;
  const [r, o] = N(() => {
    var m;
    return ((m = ze(n)) == null ? void 0 : m.zoom) ?? ut(e, et());
  }), a = A(r), s = A(n);
  a.current = r;
  const i = A(1), l = A(((u = ze(n)) == null ? void 0 : u.zoom) !== void 0);
  C(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = ze(n)) == null ? void 0 : h.zoom;
    l.current = m !== void 0;
    const y = m ?? ut(e, et());
    i.current = 1, a.current = y, o(y);
  }, [e, n]), C(() => {
    if (l.current) return;
    const m = ut(e, et()), y = a.current;
    Math.abs(m - y) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const c = x((m) => {
    const y = Xt(m), h = a.current;
    Math.abs(y - h) < 5e-4 || (i.current = y / (h || 1), l.current = !0, Qt(s.current, { zoom: y }), o(y));
  }, []), d = x((m) => {
    c(kt(a.current, m));
  }, [c]), f = x((m) => {
    c(ut(m));
  }, [c]);
  return ke(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, ri(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: c, stepZoom: d, resetZoom: f };
}
function pi(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = A(t), a = A(n), s = A(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: x((l) => {
    l !== o.current && (s.current(), a.current(l));
  }, []) };
}
const zn = 48;
function Ro(e, t = zn) {
  return e.getBoundingClientRect().top + t;
}
function Eo(e, t) {
  if (!e.length)
    return null;
  let n = null, r = -1 / 0;
  for (const l of e) {
    const c = l.getBoundingClientRect();
    c.height < 8 || c.width < 8 || c.top <= t + 1 && c.top >= r && (n = l, r = c.top);
  }
  if (!n && (n = e.find((c) => {
    const d = c.getBoundingClientRect();
    return d.height >= 8 && d.width >= 8;
  }) ?? null, n)) {
    const c = [...e].reverse().find((d) => {
      const f = d.getBoundingClientRect();
      return f.height >= 8 && f.width >= 8;
    });
    c && c.getBoundingClientRect().bottom < t && (n = c);
  }
  if (!n)
    return null;
  const o = Jt(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function jt(e, t, n = zn) {
  if (!e)
    return null;
  const r = Kt(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Ro(e, n), i = Eo(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Nt(e, t, n = "auto", r, o = zn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(Kt(a, r))), i || (i = e.querySelector(Kt(a))), !i)
    return !1;
  const l = e.getBoundingClientRect(), c = i.getBoundingClientRect();
  if (l.height <= 0 || c.height < 8 && i.offsetHeight < 8)
    return !1;
  const d = c.height > 0 ? c.height : i.offsetHeight, f = e.scrollTop + (c.top - l.top), u = Math.max(0, f + s * d - o);
  return n === "auto" ? Math.abs(e.scrollTop - u) >= 1 && (e.scrollTop = u) : e.scrollTo({ top: u, behavior: n }), !0;
}
function gi(e, t, n = "smooth", r) {
  return Nt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function wn(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], l = () => {
    var d;
    if (a) return;
    Nt(
      e(),
      t,
      r,
      n == null ? void 0 : n.pane
    ) && !s && (s = !0, (d = n == null ? void 0 : n.onDone) == null || d.call(n));
  };
  for (const c of o)
    c <= 0 ? requestAnimationFrame(() => {
      requestAnimationFrame(l);
    }) : i.push(setTimeout(l, c));
  return () => {
    a = !0;
    for (const c of i)
      clearTimeout(c);
  };
}
function bi(e, t, n) {
  return wn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Gt(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function Ae(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function yi(e, t, n = !0, r = "", o) {
  const [a, s] = N(1);
  return C(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let l = !1, c = null, d = 0;
    const f = Kt(void 0, o), u = () => {
      if (l) return;
      const h = Array.from(i.querySelectorAll(f));
      if (!h.length)
        return;
      const b = Ro(i), w = Eo(h, b);
      w && s(w.page);
    }, m = () => {
      l || (d && cancelAnimationFrame(d), d = requestAnimationFrame(() => {
        d = 0, u();
      }));
    }, y = () => {
      if (l) return;
      if (!Array.from(i.querySelectorAll(f)).length) {
        c = setTimeout(y, 120);
        return;
      }
      u(), i.addEventListener("scroll", m, { passive: !0 });
    };
    return y(), () => {
      l = !0, c && clearTimeout(c), d && cancelAnimationFrame(d), i.removeEventListener("scroll", m);
    };
  }, [e, t, n, r, o]), a;
}
const vi = `canvas, .react-pdf__Page, .${ho}, .${Vt}`, mr = /* @__PURE__ */ new WeakMap();
function wi(e) {
  const t = Number(e.getAttribute(Dn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = mr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(vi), mr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Si(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Ii(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(Gs()).forEach((r) => {
    const o = Jt(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = wi(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Ri(e, t, n = "", r) {
  const [o, a] = N(() => /* @__PURE__ */ new Map()), s = A(o), i = A(r);
  return i.current = r, ke(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let l = !1, c = 0, d = !1, f = !1;
    const u = () => {
      var I;
      if (l) return;
      const v = e.current;
      if (!v) return;
      const g = Ii(v);
      Si(s.current, g) || (s.current = g, a(g)), d && !f && (f = !0, (I = i.current) == null || I.call(i));
    }, m = () => {
      cancelAnimationFrame(c), c = requestAnimationFrame(() => {
        requestAnimationFrame(u);
      });
    };
    m();
    const y = window.setTimeout(m, 100), h = window.setTimeout(() => {
      d = !0, m();
    }, 300), b = window.setTimeout(m, 700), w = e.current;
    let S = null;
    return w && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => m()), S.observe(w)), () => {
      l = !0, cancelAnimationFrame(c), window.clearTimeout(y), window.clearTimeout(h), window.clearTimeout(b), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const Ei = [0, 48, 140, 320, 560], Pi = 700, Ti = [80, 200, 400], ki = 500, Ni = 50, Mi = /* @__PURE__ */ new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
  "Spacebar",
  "j",
  "k"
]), Ai = 180, hr = [0, 48, 140, 320, 700, 1200];
function _i(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = A(
    ((T = ze(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), l = A(null), c = A(!1), d = A(r), f = A(null), u = A(null), m = A(null), y = A(null), h = A(a), b = A(""), w = A(n);
  w.current = n;
  const S = x(() => {
    var P;
    (P = f.current) == null || P.call(f), f.current = null, u.current != null && (clearTimeout(u.current), u.current = null);
  }, []), v = x(() => {
    !c.current && l.current == null || (S(), m.current != null && (clearTimeout(m.current), m.current = null), l.current = null, c.current = !1);
  }, [S]), g = x((P = !1) => {
    y.current != null && (clearTimeout(y.current), y.current = null);
    const M = () => {
      y.current = null, Qt(h.current, {
        anchor: Ae(i.current)
      });
    };
    P ? M() : y.current = setTimeout(M, Ai);
  }, []), I = x((P) => {
    i.current = Ae(P), l.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, c.current = !1;
    }, Ni);
  }, []);
  C(() => {
    if (!o)
      return;
    let P = !1, M = null, _ = null, j = null;
    const B = () => {
      if (P) return;
      const H = e.current;
      if (!H) {
        j = setTimeout(B, 50);
        return;
      }
      M = H, _ = () => {
        if (c.current)
          return;
        const X = jt(M, w.current);
        X && (i.current = X, g());
      }, M.addEventListener("scroll", _, { passive: !0 }), c.current || _();
    };
    return B(), () => {
      P = !0, j != null && clearTimeout(j), M && _ && M.removeEventListener("scroll", _);
    };
  }, [o, r, n, e, g]), C(() => {
    if (!o) return;
    const P = e.current;
    if (!P) return;
    const M = (_) => {
      _.metaKey || _.ctrlKey || _.altKey || Mi.has(_.key) && v();
    };
    return P.addEventListener("wheel", v, { passive: !0 }), P.addEventListener("touchmove", v, { passive: !0 }), window.addEventListener("keydown", M), () => {
      P.removeEventListener("wheel", v), P.removeEventListener("touchmove", v), window.removeEventListener("keydown", M);
    };
  }, [o, e, v]), ke(() => {
    var M;
    if (h.current === a) return;
    g(!0), S(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, b.current = "";
    const P = (M = ze(a)) == null ? void 0 : M.anchor;
    i.current = P ? Ae(P) : { page: 1, fraction: 0 }, l.current = null, c.current = !!a, d.current = r;
  }, [a, r, g, S]), C(() => {
    var M;
    if (!o || !s || !a || b.current === a) return;
    b.current = a;
    const P = Ae(
      ((M = ze(a)) == null ? void 0 : M.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = P, l.current = P, c.current = !0, S(), f.current = wn(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: hr,
        onDone: () => I(P)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(P);
    }, Math.max(...hr) + 160), () => S();
  }, [o, s, a, e, I, S]), C(() => {
    if (d.current === r)
      return;
    if (d.current = r, !o) {
      c.current = !1, l.current = null, S();
      return;
    }
    const P = l.current ? Ae(l.current) : Ae(i.current);
    return c.current = !0, l.current = P, i.current = P, S(), f.current = wn(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Ei,
        onDone: () => I(P)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(P);
    }, Pi), () => {
      S();
    };
  }, [r, o, n, e, I, S]), C(() => () => {
    S(), m.current != null && (clearTimeout(m.current), m.current = null), g(!0);
  }, [S, g]);
  const R = x(() => {
    const P = jt(
      e.current,
      w.current
    );
    return Ae(P || i.current);
  }, [e]), k = x(() => {
    c.current = !0;
    const P = jt(
      e.current,
      w.current
    ), M = Ae(P ?? i.current);
    return i.current = M, l.current = M, g(), M;
  }, [e, g]), O = x((P, M, _) => {
    const j = _ || w.current, B = Gt(P, M || 1), H = { page: B, fraction: 0 };
    i.current = H, c.current = !0, l.current = H, g(), S(), gi(e.current, B, "smooth", j), f.current = bi(
      () => e.current,
      B,
      {
        behavior: "auto",
        pane: j,
        delaysMs: Ti,
        onDone: () => I(H)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(H);
    }, ki);
  }, [e, I, S, g]), $ = x(() => Ae(i.current), []), F = x(() => c.current, []), E = x(() => {
    if (!c.current || !l.current)
      return;
    const P = Ae(l.current);
    Nt(
      e.current,
      P,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: R,
    beginModeSwitch: k,
    goToPage: O,
    getAnchor: $,
    isRestoring: F,
    repinIfRestoring: E
  };
}
function Li(e, t) {
  if (!e) return null;
  if (e.blockId && t) {
    const o = t(e.blockId);
    if (o != null && Number.isFinite(o) && o >= 1)
      return Math.floor(o);
  }
  if (e.pageIdx === null || e.pageIdx === void 0) return null;
  const n = Number(e.pageIdx);
  if (!Number.isFinite(n)) return null;
  const r = Math.floor(n) + 1;
  return r >= 1 ? r : null;
}
function Po(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Ci = [0, 80, 200, 400, 800], Di = 120, xi = 400;
function zi(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: l, documentId: c, regionsSettled: d = !0 } = e, f = A(a);
  f.current = a;
  const u = A(s);
  u.current = s;
  const m = A(i);
  m.current = i;
  const y = A(n);
  y.current = n, C(() => {
    var g, I;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = os(), b = Li(h, u.current);
    if (b == null && (h != null && h.blockId) && !d) return;
    const w = Po(h, b, { jobId: l, documentId: c });
    if (t.current === w)
      return;
    if (b == null) {
      t.current = w, (g = y.current) == null || g.call(y);
      return;
    }
    t.current = w, h && ((I = m.current) == null || I.call(m, h, b));
    const S = [];
    let v = 0;
    for (const R of Ci)
      v = Math.max(v, R), S.push(
        setTimeout(() => {
          f.current(b);
        }, R)
      );
    return S.push(
      setTimeout(() => {
        var R;
        (R = y.current) == null || R.call(y);
      }, v + Di)
    ), () => {
      for (const R of S) clearTimeout(R);
    };
  }, [r, o, l, c, t, d]);
}
function Oi(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function $i(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = xi,
    jobId: i,
    documentId: l,
    applyReaderSearch: c
  } = e, d = A(a);
  d.current = a;
  const f = A(c);
  f.current = c;
  const u = A(0);
  C(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || u.current === o) return;
    const m = setTimeout(() => {
      var w;
      const y = ((w = globalThis.location) == null ? void 0 : w.search) || "", h = ga(y, o, d.current);
      if (u.current = o, h === null) return;
      const b = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Po(
        { blockId: b },
        o,
        { jobId: i, documentId: l }
      ), (f.current || Oi)(h);
    }, s);
    return () => clearTimeout(m);
  }, [
    n,
    r,
    o,
    s,
    i,
    l,
    t
  ]);
}
function Fi(e) {
  const t = A(""), [n, r] = N(!1), o = x(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  zi(a, t, o), $i(e, t, n);
}
const vt = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Bi(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function pr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function To(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = pr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = pr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function ji(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = To(r, t, n);
  if (o === "retry") return e;
  if (o === "ignore")
    return { ...e, lastSeq: t.seq, connection: "live", error: "" };
  const a = new Map(n.items.map((l) => [l.item_id, l])), s = new Map((r == null ? void 0 : r.changedAtSeqById) || []);
  for (const l of t.changed_item_ids)
    a.has(l) && s.set(l, t.seq);
  const i = new Map(e.pagesByPage);
  return i.set(t.page_idx, {
    attempt: n.attempt,
    generation: n.generation,
    pageHash: n.page_hash,
    itemsById: a,
    changedAtSeqById: s,
    lastEventSeq: t.seq
  }), {
    ...e,
    pagesByPage: i,
    lastSeq: t.seq,
    connection: "live",
    error: ""
  };
}
function Ui(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    // 顶栏 pill 在的时候它就是开关（还带进度），源栏不再另放一颗「译文」：
    // 两颗管同一件事的按钮并排在屏幕上，看着像两个功能。
    sourcePaneToggle: t && r && n === "terminal",
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
function Hi(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function Wi(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function Vi(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function Ki(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const gr = [250, 500, 1e3, 2e3, 4e3], nn = [80, 160, 320, 640, 1e3, 1500], br = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Sn(e, t) {
  return new Promise((n, r) => {
    if (t.aborted) {
      r(new DOMException("Aborted", "AbortError"));
      return;
    }
    const o = () => {
      clearTimeout(a), r(new DOMException("Aborted", "AbortError"));
    }, a = setTimeout(() => {
      t.removeEventListener("abort", o), n();
    }, e);
    t.addEventListener("abort", o, { once: !0 });
  });
}
function On(e) {
  return Ra(e) ? `${e.code || ""}`.trim() : "";
}
function Ot(e, t) {
  const n = On(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Ji(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const l = await o.fetchPage(e, t.page_idx, { signal: r });
      if (To(n.pagesByPage.get(t.page_idx), t, l) !== "retry")
        return l;
      a = Ea(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (l) {
      if ((l == null ? void 0 : l.name) === "AbortError") throw l;
      a = l;
      const c = On(l);
      if (c && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(c)) throw l;
    }
    const i = nn[Math.min(s, nn.length - 1)];
    if (await Sn(i, r), s >= nn.length + 2) throw a;
  }
}
function qi({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = N(vt), s = A(o), i = A("");
  s.current = o;
  const l = `${e || ""}`.trim(), c = `${t || ""}`.trim().toLowerCase(), d = Pt(c) ? c : "";
  return C(() => {
    if (!n || !l) {
      i.current = "", s.current = vt, a(vt);
      return;
    }
    const f = r === void 0 ? rs() : r, u = i.current === l;
    if (i.current = l, !f) {
      const v = {
        ...u ? s.current : vt,
        connection: d ? "terminal" : "unavailable",
        jobStatus: c,
        error: "实时译文暂不可用"
      };
      s.current = v, a(v);
      return;
    }
    const m = new AbortController();
    let y = !1;
    const h = {
      ...u ? s.current : vt,
      connection: d ? "terminal" : "connecting",
      jobStatus: c,
      error: ""
    };
    s.current = h, a(h);
    const b = (v) => {
      m.signal.aborted || a((g) => {
        const I = v(g);
        return s.current = I, I;
      });
    }, w = async () => {
      let v = 0;
      for (; !m.signal.aborted; )
        try {
          const g = await f.fetchLayout(l, { signal: m.signal });
          y = !0, b((I) => ({
            ...I,
            layoutByPage: Bi(g),
            jobStatus: c,
            error: ""
          }));
          return;
        } catch (g) {
          if ((g == null ? void 0 : g.name) === "AbortError") return;
          const I = On(g);
          if (!(I === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !I)) {
            b((k) => ({
              ...k,
              connection: d ? "terminal" : "unavailable",
              jobStatus: c,
              error: Ot(g, "实时译文暂不可用")
            }));
            return;
          }
          if (d) {
            b((k) => ({
              ...k,
              connection: "terminal",
              jobStatus: c,
              error: ""
            }));
            return;
          }
          b((k) => ({
            ...k,
            connection: "connecting",
            jobStatus: c,
            error: Ot(g, "正在等待 OCR 版面数据")
          })), await Sn(gr[Math.min(v, gr.length - 1)], m.signal).catch(() => {
          }), v += 1;
        }
    };
    return (async () => {
      if (await w(), !y || m.signal.aborted) return;
      let v = 0;
      for (; !m.signal.aborted; ) {
        d || b((g) => ({
          ...g,
          connection: g.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: c,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: g.error
        }));
        try {
          await f.streamEvents(l, {
            afterSeq: s.current.lastSeq,
            signal: m.signal,
            onEvent: async (g) => {
              if (g.seq <= s.current.lastSeq) return;
              let I;
              try {
                I = await Ji(
                  l,
                  g,
                  s.current,
                  m.signal,
                  f
                );
              } catch (R) {
                if ((R == null ? void 0 : R.name) === "AbortError" || m.signal.aborted) throw R;
                b((k) => ({
                  ...k,
                  lastSeq: Math.max(k.lastSeq, g.seq),
                  error: Ot(R, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              b((R) => {
                const k = ji(R, g, I);
                return d ? {
                  ...k,
                  connection: "terminal",
                  jobStatus: c
                } : {
                  ...k,
                  jobStatus: c
                };
              }), v = 0;
            }
          });
        } catch (g) {
          if ((g == null ? void 0 : g.name) === "AbortError" || m.signal.aborted) return;
          b((I) => ({
            ...I,
            connection: d ? "terminal" : "reconnecting",
            jobStatus: c,
            error: Ot(g, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (d) {
          b((g) => ({
            ...g,
            connection: "terminal",
            jobStatus: c
          }));
          return;
        }
        await Sn(br[Math.min(v, br.length - 1)], m.signal).catch(() => {
        }), v += 1;
      }
    })(), () => m.abort();
  }, [n, r, l, d]), o;
}
function Gi(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), l = Number(s.count) || 0;
    i && l > 0 && o.set(i, l);
  }
  return o;
}
function Zi(e, t = !0) {
  const [n, r] = N(() => /* @__PURE__ */ new Map());
  return C(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Xe().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Gi(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const Yi = 4500;
function Xi(e) {
  if (typeof e == "number") {
    const r = Number(e);
    return !Number.isFinite(r) || r < 0 ? null : Math.floor(r) + 1;
  }
  if (!e || typeof e != "object") return null;
  const t = e.page_idx;
  if (t != null && `${t}`.trim() !== "") {
    const r = Number(t);
    return !Number.isFinite(r) || r < 0 ? null : Math.floor(r) + 1;
  }
  const n = e.page;
  if (n != null && `${n}`.trim() !== "") {
    const r = Number(n);
    return !Number.isFinite(r) || r < 1 ? null : Math.floor(r);
  }
  return null;
}
const Qi = /* @__PURE__ */ new Set(["book", "translate"]);
function ko(e) {
  return !!(e.jobId && e.sourceUrl && Qi.has(e.workflow));
}
function el(e) {
  return !!(ko(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function tl() {
  const e = Fs(), t = ko({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = el({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = A({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Pt(o) && (r.current.running = !0);
  const a = qi({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: l, bindShell: c } = Hs(), d = Zi(e.jobId, !e.sourceOnly), f = ci({
    documentId: e.documentId,
    jobId: e.jobId
  }), u = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: y } = hi(e.mode, s, f), h = Vs(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: m, shellWidth: l, identityKey: u }
  ), {
    beginModeSwitch: b,
    goToPage: w,
    repinIfRestoring: S
  } = _i(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  C(() => {
    S();
  }, [l, S]);
  const v = Ri(
    s,
    h.compareMode,
    h.rowSyncRevision,
    S
  ), g = yi(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), I = x((B, H) => {
    var ae, Y;
    const X = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((ae = h.numPagesByPane) == null ? void 0 : ae.source) || 0,
      Number((Y = h.numPagesByPane) == null ? void 0 : Y.translated) || 0
    );
    w(B, X, H);
  }, [w, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [R, k] = N(null), O = A(null), $ = x((B) => {
    O.current && clearTimeout(O.current), k(B), B && (O.current = setTimeout(() => k(null), Yi));
  }, []);
  C(() => () => {
    O.current && clearTimeout(O.current);
  }, []);
  const F = x((B) => {
    const H = en(e.regions, B);
    return H ? rr(H, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), E = x((B, H) => {
    const X = H || h.primaryPane, ae = typeof B == "object" && B ? `${B.block_id || ""}`.trim() : "", Y = typeof B == "object" && B ? `${B.image_url || ""}`.trim() : "", he = typeof B == "object" && B ? B.page_idx != null ? Number(B.page_idx) + 1 : B.page != null ? Number(B.page) : null : typeof B == "number" ? B + 1 : null, fe = ya(e.regions, Y, he) || en(e.regions, ae) || (typeof B == "object" ? va(e.regions, B) : null);
    let me = fe ? rr(fe, X).page : null;
    me == null && (me = Xi(B)), !(me == null || me < 1) && ($(fe), I(me, X));
  }, [$, I, h.primaryPane, e.regions]);
  Fi({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: g,
    goToPage: I,
    resolveBlockPage: F,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (B) => {
      $(en(e.regions, B.blockId));
    }
  });
  const { setModeKeepingPage: T } = pi({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: b
  });
  C(() => {
    $(null);
  }, [u, $]);
  const P = !e.boot.loading && !e.boot.failed, M = G(() => ({ bindShell: c, shellEl: i, shellWidth: l, shellRef: s }), [c, i, l, s]), _ = G(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), j = G(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: y,
    shell: M,
    panes: h,
    sessionFiles: _,
    rowHeights: v,
    goToPage: I,
    activeRegion: R,
    jumpToAnchor: E,
    setModeKeepingPage: T,
    download: e.download,
    showHud: P,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: d
  }), [e, M, h, _, v, I, R, E, T, P, m, y, f, a, n, d]);
  return G(() => ({
    ...j,
    currentPage: g
  }), [j, g]);
}
const nl = [
  { action: "mode-source", keys: ["1"], mode: "source" },
  { action: "mode-compare", keys: ["2"], mode: "compare" },
  { action: "mode-translated", keys: ["3"], mode: "translated" },
  { action: "zoom-in", keys: ["+", "="] },
  { action: "zoom-out", keys: ["-", "_"] },
  { action: "zoom-reset", keys: ["0"] },
  { action: "next-page", keys: ["j", "ArrowDown", "PageDown"], requiresPages: !0 },
  { action: "prev-page", keys: ["k", "ArrowUp", "PageUp"], requiresPages: !0 },
  { action: "first-page", keys: ["Home"], requiresPages: !0 },
  { action: "last-page", keys: ["End"], requiresPages: !0 }
], rl = [
  {
    title: "翻页",
    items: [
      { actions: ["next-page"], keys: "J · ↓ · PgDn", desc: "下一页" },
      { actions: ["prev-page"], keys: "K · ↑ · PgUp", desc: "上一页" },
      { actions: ["first-page", "last-page"], keys: "Home / End", desc: "首页 / 末页" },
      { actions: [], keys: "点底栏页码", desc: "输入页码跳转" }
    ]
  },
  {
    title: "缩放",
    items: [
      { actions: ["zoom-in", "zoom-out"], keys: "+ / −", desc: "放大 / 缩小" },
      { actions: ["zoom-reset"], keys: "0", desc: "重置为模式默认" },
      { actions: [], keys: "点百分比", desc: "重置为模式默认" }
    ]
  },
  {
    title: "搜索",
    items: [
      { actions: [], keys: "⌘F / Ctrl+F", desc: "在书里搜索（光标已在搜索框时再按，用浏览器自己的查找）" },
      { actions: [], keys: "Enter / Shift+Enter", desc: "下一处 / 上一处" },
      { actions: [], keys: "Esc", desc: "收起搜索" }
    ]
  },
  {
    title: "画笔",
    items: [
      { actions: [], keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
      { actions: [], keys: "Esc", desc: "退出画笔" },
      { actions: [], keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" },
      { actions: [], keys: "Shift+右键", desc: "浏览器自己的右键菜单" }
    ]
  },
  {
    title: "待处理",
    items: [
      { actions: [], keys: "N / Shift+N", desc: "跳到下一处 / 上一处要看一眼的段落（底栏「待处理」）" }
    ]
  },
  {
    title: "模式",
    items: [
      { actions: ["mode-source"], keys: "1", desc: "原文" },
      { actions: ["mode-compare"], keys: "2", desc: "对照" },
      { actions: ["mode-translated"], keys: "3", desc: "译文" }
    ]
  },
  {
    title: "改译文",
    items: [
      { actions: [], keys: "E", desc: "改鼠标停着的那一段" },
      { actions: [], keys: "Alt+↑ / Alt+↓", desc: "改上一段 / 下一段" },
      { actions: [], keys: "⌘Enter / Ctrl+Enter", desc: "保存" }
    ]
  }
];
function ol(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of nl)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function al(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const sl = ".reader-notes-panel";
function il(e) {
  return e instanceof Element ? !!e.closest(sl) : !1;
}
function ll(e) {
  const {
    mode: t,
    sourceOnly: n,
    setMode: r,
    userZoom: o,
    onZoomChange: a,
    currentPage: s,
    numPages: i,
    goToPage: l,
    enabled: c = !0
  } = e;
  C(() => {
    if (!c)
      return;
    const d = (f) => {
      if (f.defaultPrevented || f.metaKey || f.ctrlKey || f.altKey || al(f.target) || il(f.target))
        return;
      const u = f.key, m = ol(u);
      if (m) {
        if (m.mode) {
          if (n && m.mode !== "source")
            return;
          f.preventDefault(), r(m.mode);
          return;
        }
        if (!(m.requiresPages && i <= 0))
          switch (f.preventDefault(), m.action) {
            case "zoom-in":
              a(kt(o, 1));
              return;
            case "zoom-out":
              a(kt(o, -1));
              return;
            case "zoom-reset":
              a(ut(t, et()));
              return;
            case "next-page":
              l(Gt(s + 1, i));
              return;
            case "prev-page":
              l(Gt(s - 1, i));
              return;
            case "first-page":
              l(1);
              return;
            case "last-page":
              l(i);
              return;
          }
      }
    };
    return window.addEventListener("keydown", d), () => window.removeEventListener("keydown", d);
  }, [
    c,
    t,
    n,
    r,
    o,
    a,
    s,
    i,
    l
  ]);
}
const cl = "retainpdf:soft-reader-close";
function dl() {
  return new URL("./index.html", window.location.href).href;
}
function ul() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: cl },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function fl(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function ml() {
  if (!(typeof window > "u") && !ul()) {
    if (fl(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(dl());
  }
}
function hl({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function pl({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ L(hl, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), ml();
  }, children: [
    /* @__PURE__ */ p(bt, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
let yr = !1;
function gl() {
  if (yr)
    return;
  const e = Tt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (co.GlobalWorkerOptions.workerSrc = e, yr = !0);
}
function de(e) {
  return typeof e == "string" ? e : "";
}
function bl(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function yl(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function vl(e) {
  return {
    source: de(e == null ? void 0 : e.source_text) || de(e == null ? void 0 : e.unit_source_text),
    translated: de(e == null ? void 0 : e.protected_translated_text) || de(e == null ? void 0 : e.translated_text)
  };
}
const wl = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function No(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function Sl(e) {
  const t = No(e).sort((r, o) => de(r.ts).localeCompare(de(o.ts)));
  return t.length ? [
    { text: de(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: de(r.new_text),
      label: wl[de(r.source)] || de(r.source) || "修订",
      ts: de(r.ts),
      reason: de(r.reason)
    }))
  ].reverse() : [];
}
function Il(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Rl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return de(r.finished_at) || de(n.finished_at) || "";
}
function El(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = No(e).sort((a, s) => de(a.ts).localeCompare(de(s.ts)));
  for (const a of o) {
    const s = new Date(de(a.ts)).getTime(), i = de(a.reader_item_id) || de(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, de(a.new_text));
  }
  return n;
}
const Pl = {
  empty_translation: "译文是空的",
  math_delimiter_unbalanced: "公式的 $ 或括号不成对",
  unexpected_placeholder: "多出了原文里没有的占位符",
  placeholder_inventory_mismatch: "占位符（公式、引用）和原文对不上，可能删掉或改坏了",
  english_residue: "还留着没翻的英文",
  mixed_english_residue: "中英文混在一起",
  protocol_shell_output: "混进了模型输出的格式标记",
  truncated_translation: "译文像是被截断了",
  context_bleed: "混进了别的段落的内容",
  formula_commands_dropped: "公式里的命令丢了",
  glossary_term_missing: "没用术语表规定的译法"
};
function Tl(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = Pl[de(n.kind)] || de(n.kind) || "问题", o = de(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const kl = /* @__PURE__ */ new Set(["text", "formula"]);
function $n(e) {
  return kl.has(e);
}
function Nl(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || $n(Lt(n));
}
function Ml(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !$n(Lt(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const Al = 300, _l = 72;
function Ll(e, t) {
  if (e.width >= Al && e.height >= _l)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const Cl = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Dl(e, t, n) {
  return e.flatMap((r) => {
    if (!Cl.has(Lt(r.region))) return [];
    const o = Ln(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function vr(e, t, n) {
  let r = null, o = Number.POSITIVE_INFINITY;
  for (const a of e) {
    const { rect: s } = a;
    if (t < s.left || t > s.left + s.width || n < s.top || n > s.top + s.height)
      continue;
    const i = s.width * s.height;
    i < o && (r = a, o = i);
  }
  return r;
}
async function xl(e) {
  var n;
  const t = `${e || ""}`;
  if (!t.trim()) return !1;
  try {
    if ((n = navigator.clipboard) != null && n.writeText)
      return await navigator.clipboard.writeText(t), !0;
  } catch {
  }
  try {
    const r = document.createElement("textarea");
    r.value = t, r.setAttribute("readonly", ""), r.style.position = "fixed", r.style.opacity = "0", document.body.appendChild(r), r.select();
    const o = document.execCommand("copy");
    return r.remove(), o;
  } catch {
    return !1;
  }
}
const zl = "reader-text-hover-copy", Ol = "reader-text-hover-edit", $l = "reader-text-hover-id";
function Fl(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const Mo = "reader-text-hover-tools";
function rn({
  className: e,
  state: t,
  label: n,
  title: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p(
    "button",
    {
      type: "button",
      className: e,
      "data-copy-state": t,
      "aria-label": n,
      title: r,
      onPointerDown: (s) => s.stopPropagation(),
      onClick: o,
      children: a
    }
  );
}
const Bl = 26, jl = 220;
function Ul(e, t = jl) {
  return e.height < Bl * 2 || e.width < t;
}
function Hl({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? ro : e === "failed" ? bt : Ta, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Wl({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  frameRect: o,
  placement: a,
  tailTop: s = 0
}) {
  const [i, l] = N("idle"), [c, d] = N("idle"), [f] = N(() => Fl()), u = A([]), m = (e == null ? void 0 : e.itemId) || "";
  if (C(() => {
    l("idle"), d("idle");
    const g = u.current;
    return () => {
      g.forEach((I) => window.clearTimeout(I)), u.current = [];
    };
  }, [m]), !e) return null;
  const y = wa(e.highlight.region, t), h = Lt(e.highlight.region), b = (g, I) => async (R) => {
    R.preventDefault(), R.stopPropagation();
    const k = await xl(g);
    I(k ? "copied" : "failed"), u.current.push(window.setTimeout(() => I("idle"), 1200));
  }, w = h === "formula" ? "复制 LaTeX" : "复制", S = o || e.rect, v = a || (Ul(S) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": h,
      style: S,
      children: /* @__PURE__ */ L(
        "div",
        {
          className: Mo,
          "data-placement": v,
          style: v === "tail" ? { top: s } : void 0,
          children: [
            f ? /* @__PURE__ */ p(
              rn,
              {
                className: $l,
                state: c,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: b(e.itemId, d),
                children: c === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && $n(h) ? /* @__PURE__ */ p(
              rn,
              {
                className: Ol,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (g) => {
                  g.preventDefault(), g.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(Cn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            y ? /* @__PURE__ */ p(
              rn,
              {
                className: zl,
                state: i,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: i === "copied" ? "已复制" : i === "failed" ? "复制失败" : w,
                onClick: b(y, l),
                children: /* @__PURE__ */ p(Hl, { state: i })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Vl(e, t) {
  const n = e.page_idx + 1, r = {
    page: n,
    bbox: t.bbox,
    unit: "pdf_point",
    origin: "top_left",
    text: t.source_text
  }, o = {
    itemId: t.item_id,
    source: r,
    translated: r,
    markdown: t.source_text,
    regionType: t.kind,
    status: "live_translation",
    assetIds: [],
    assetUrls: []
  };
  return {
    itemId: t.item_id,
    region: o,
    box: r,
    pageSize: { page: n, width: e.width, height: e.height }
  };
}
function Kl(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = Ln(
      Vl(e, a),
      n,
      r
    );
    i && o.push({
      itemId: a.item_id,
      translatedText: s.translated_text,
      status: s.status,
      kind: a.kind,
      sourceText: a.source_text,
      typography: a.typography,
      rect: i,
      changedAtSeq: t.changedAtSeqById.get(a.item_id) || 0,
      changedNow: t.changedAtSeqById.get(a.item_id) === t.lastEventSeq
    });
  }
  return o;
}
const Jl = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', ql = 256, wt = /* @__PURE__ */ new Map();
function Gl(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Ao(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Za(t, { bareLatex: !0 }), o = Gl(n), a = Ya(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = wt.get(t);
  if (!s && (s = Xa(o, r), wt.set(t, s), wt.size > ql)) {
    const i = wt.keys().next().value;
    i !== void 0 && wt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function on(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function je(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Zl(e, t) {
  const n = e.typography, r = je(t) || 1, o = je(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = on(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, l = Math.max(5.5 * r, Math.min(s, i * r)), c = je(n == null ? void 0 : n.fit_min_font_size_pt), d = je(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (c || 5.5) * r), u = Math.max(
    f,
    d ? d * r : o ? o * r : l
  ), m = o ? o * r : l, y = je(n == null ? void 0 : n.leading_em), h = [
    je(n == null ? void 0 : n.padding_top_pt) || 0,
    je(n == null ? void 0 : n.padding_right_pt) || 0,
    je(n == null ? void 0 : n.padding_bottom_pt) || 0,
    je(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((b) => b * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Jl,
    fontSizePx: Math.max(f, Math.min(u, m)),
    minFontSizePx: f,
    maxFontSizePx: u,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: y ? 1 + y : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (on(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : on(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Yl(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (f) => {
    const u = s.get(f);
    if (u !== void 0) return u;
    const { width: m, height: y } = e(f), h = m <= t + 0.5 && y <= n + 0.5;
    return s.set(f, h), h;
  };
  let l = o, c = a, d = Math.min(r.requestedFontSizePx, c);
  if (i(d)) {
    if (!r.exact) {
      l = d;
      for (let f = 0; f < 6 && c > l; f += 1) {
        const u = (l + c) / 2;
        i(u) ? (d = u, l = u) : c = u;
      }
    }
  } else {
    c = d, d = l;
    for (let f = 0; f < 8 && c > l; f += 1) {
      const u = (l + c) / 2;
      i(u) ? (d = u, l = u) : c = u;
    }
  }
  return Math.max(o, d);
}
const Xl = 512, St = /* @__PURE__ */ new Map();
let In = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  In += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  In += 1;
}));
function Ql(e, t, n, r) {
  return [
    In,
    r.fontFamily,
    r.fontWeight,
    r.lineHeight,
    r.textAlign,
    r.minFontSizePx,
    r.maxFontSizePx,
    r.fontSizePx,
    r.exact ? 1 : 0,
    t,
    n,
    e
  ].join("");
}
function _o({ item: e, pageScale: t }) {
  const n = A(null), r = G(
    () => Ao(e.translatedText),
    [e.translatedText]
  ), [o, a] = N(r.fallbackHtml), s = G(
    () => Zl(e, t),
    [e, t]
  );
  C(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((u) => {
      f && a(u);
    }), () => {
      f = !1;
    };
  }, [r]), ke(() => {
    const f = n.current;
    if (!f) return;
    const [u, m, y, h] = s.padding, b = Math.max(1, e.rect.width - h - m), w = Math.max(1, e.rect.height - u - y), S = Ql(o, b, w, s);
    let v = St.get(S);
    if (v === void 0 && (v = Yl(
      (g) => (f.style.fontSize = `${g}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      b,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), St.set(S, v), St.size > Xl)) {
      const g = St.keys().next().value;
      g !== void 0 && St.delete(g);
    }
    f.style.fontSize = `${v.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [i, l, c, d] = s.padding;
  return /* @__PURE__ */ p(
    "div",
    {
      className: `reader-live-translation-item${e.changedNow ? " is-changed" : ""}`,
      "data-live-translation-item": e.itemId,
      "data-live-translation-kind": e.kind,
      "data-live-translation-status": e.status,
      "data-live-translation-typography": s.exact ? "typst" : "fitted",
      style: {
        ...e.rect,
        padding: `${i}px ${l}px ${c}px ${d}px`
      },
      children: /* @__PURE__ */ p(
        "div",
        {
          ref: n,
          className: "reader-live-translation-content",
          style: {
            fontFamily: s.fontFamily,
            fontSize: s.fontSizePx,
            fontWeight: s.fontWeight,
            lineHeight: s.lineHeight,
            textAlign: s.textAlign
          },
          dangerouslySetInnerHTML: { __html: o }
        }
      )
    }
  );
}
function ec({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = G(
    () => Kl(e, t, n, r),
    [r, e, t, n]
  );
  return o.length ? /* @__PURE__ */ p(
    "div",
    {
      className: "reader-live-translation-overlay",
      "data-live-translation-page": e == null ? void 0 : e.page_idx,
      "data-live-translation-generation": t == null ? void 0 : t.generation,
      "aria-hidden": "true",
      children: o.map((a) => /* @__PURE__ */ p(
        _o,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const tc = Yt(ec);
function nc({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ p("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ L("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ p(
        _o,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Lt(a.highlight.region),
            sourceText: a.highlight.box.text || "",
            rect: a.rect,
            changedAtSeq: 0,
            changedNow: !1
          },
          pageScale: s > 0 ? n / s : 1
        }
      ),
      /* @__PURE__ */ p("span", { className: "reader-edited-badge", style: { left: a.rect.left, top: a.rect.top }, children: "待排版" })
    ] }, a.itemId);
  }) }) : null;
}
const rc = Yt(nc), Lo = 24, Ke = Lo * 2 + 4, Ue = 24, oc = 4, ac = 6, tt = (e) => e.left + e.width, Ye = (e) => e.top + e.height;
function It(e, t) {
  const n = Math.min(tt(e), tt(t)) - Math.max(e.left, t.left), r = Math.min(Ye(e), Ye(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const wr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= tt(t) && r >= t.top && r <= Ye(t);
}, sc = (e) => e.height > 40 && e.height > e.width * 2.5;
function ic(e, t, n) {
  if (!t.length || e.height < Ue || e.width < n + 8) return null;
  const r = Math.max(...t.map(Ye)), o = tt(e) - 4 - n;
  for (const a of [r, Ye(e) - 2]) {
    const s = Math.max(e.top, a - Ue), i = { left: o, top: s, width: n, height: Ue };
    if (!t.some((l) => It(i, l) > 0)) return s - e.top;
  }
  return null;
}
function lc(e, t) {
  const n = [], r = (a) => {
    const s = Lo + oc, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: tt(e), top: i, width: s, height: Ke } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: Ke } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Ue - 3, width: Ke, height: Ue + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: Ye(e), width: Ke, height: Ue + 3 } }), r(!0);
  const o = ic(e, t, Ke);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: tt(e) - 4 - Ke, top: e.top + o, width: Ke, height: Ue } }), n;
}
function cc(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !sc(S)), i = s.filter((S) => wr(S, t)), l = s.filter((S) => !wr(S, t)), c = n.filter((S) => S !== t && It(S, t) < t.width * t.height * 0.5), d = lc(t, i).filter(({ box: S, overhang: v }) => {
    const g = v ? ac : 0;
    return S.left >= -g && tt(S) <= r + g && S.top >= 0 && Ye(S) <= o;
  }), f = ({ placement: S, tailTop: v }) => v === void 0 ? { placement: S } : { placement: S, tailTop: v }, u = ({ box: S }) => !l.some((v) => It(S, v) > 0), m = d.filter((S) => S.placement !== "tail"), y = m.find((S) => u(S) && !c.some((v) => It(S.box, v) > 0));
  if (y) return f(y);
  const h = m.find(u) || d.find((S) => S.placement === "tail" && u(S));
  if (h) return f(h);
  let b = null, w = Number.POSITIVE_INFINITY;
  for (const S of d) {
    const v = l.reduce((g, I) => g + It(S.box, I), 0);
    v < w && (b = S, w = v);
  }
  return b ? f(b) : { placement: "outside" };
}
function dc(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Ue - 3 : Ye(r);
  return t >= r.left - 4 && t <= r.left + Ke + 4 && n >= a && n <= a + Ue + 3;
}
const an = (e) => e.left + e.width, sn = (e) => e.top + e.height;
function uc(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const c of t) {
    if (c.width <= 0 || c.height <= 0) continue;
    const d = c.left + c.width / 2, f = c.top + c.height / 2;
    d < e.left || d > an(e) || f < e.top || f > sn(e) || (o = Math.min(o, c.left), a = Math.min(a, c.top), s = Math.max(s, an(c)), i = Math.max(i, sn(c)));
  }
  if (!Number.isFinite(o)) return e;
  const l = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return l.width = Math.min(an(e) + r, s + n) - l.left, l.height = Math.min(sn(e) + r, i + n) - l.top, l.width * l.height < e.width * e.height * 0.3 && l.height < 24 ? e : l;
}
function fc(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function mc(e, t, n, r) {
  const [o, a] = N(null);
  return ke(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? fc(s) : [], l = i.length ? uc(t.rect, i) : t.rect, c = n.filter((f) => f.itemId !== t.itemId).map((f) => f.rect), d = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...cc({ frame: l, others: c, pageWidth: r, pageHeight: d, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
const Co = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Sr = { pen: 35e-4, highlighter: 0.018 }, Ir = 0.015, Rn = "retainpdf.reader.ink.v1:";
function Rr(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Rn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function hc(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Rn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Rn + e);
    } catch {
    }
}
function pc(e, t, n, r, o, a) {
  const s = Ir * Ir;
  return e.filter((i) => Do(i, t, n) && i.points.some(([l, c]) => (l - r) ** 2 + ((c - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Do(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function gc(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function bc(e) {
  const [t, n] = N(null), [r, o] = N(Co[0].key), [a, s] = N(() => Rr(e)), i = A(a), l = A([]);
  C(() => {
    const h = Rr(e);
    i.current = h, s(h), l.current = [];
  }, [e]);
  const c = x((h) => {
    i.current = h, s(h), hc(e, h);
  }, [e]), d = x((h) => {
    const b = i.current, w = h(b);
    w !== b && (l.current = [...l.current.slice(-49), b], c(w));
  }, [c]), f = x((h) => {
    h.points.length < 1 || d((b) => [...b, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [d]), u = x((h) => {
    h.length && d((b) => b.filter((w) => !h.includes(w.id)));
  }, [d]), m = x((h) => {
    d((b) => b.some((w) => w.page === h) ? b.filter((w) => w.page !== h) : b);
  }, [d]), y = x(() => {
    const h = l.current.pop();
    h && c(h);
  }, [c]);
  return G(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: u, undo: y, clearPage: m }),
    [t, r, a, f, u, y, m]
  );
}
const yc = "reader-ink-layer";
function vc(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function Er({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: vc(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function wc({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = N(null), i = A(!1), l = o.strokes.filter((h) => Do(h, e, t)), c = !!o.tool;
  if (!c && !l.length) return null;
  const d = (h) => {
    const b = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - b.left) / Math.max(1, b.width))),
      Math.min(1, Math.max(0, (h.clientY - b.top) / Math.max(1, b.height)))
    ];
  }, f = (h, b) => o.erase(pc(o.strokes, e, t, h, b, r / Math.max(1, n))), u = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [b, w] = d(h);
    o.tool === "eraser" ? f(b, w) : s([[b, w]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [b, w] = d(h);
    o.tool === "eraser" ? f(b, w) : s((S) => S ? gc(S, b, w) : [[b, w]]);
  }, y = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Sr[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ L(
    "svg",
    {
      className: yc,
      "data-ink-active": c ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: u,
      onPointerMove: m,
      onPointerUp: y,
      onPointerCancel: y,
      children: [
        l.map((h) => /* @__PURE__ */ p(Er, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(Er, { stroke: { tool: o.tool, color: o.color, width: Sr[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function Sc({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = N(null), [i, l] = N(!1), [c, d] = N([]), [f, u] = N(""), [m, y] = N(""), [h, b] = N(!1), [w, S] = N(null), [v, g] = N([]), I = r.drafts, R = r.generation, k = x(async (E, T) => {
    if (e)
      try {
        d(Sl(await e.fetchRevisions(E, T)));
      } catch {
        d([]);
      }
  }, [e]);
  C(() => {
    if (s(null), d([]), S(null), g([]), y(""), !e || !t || !n) return;
    let E = !1;
    return l(!0), e.loadItem(t, n).then((T) => {
      if (E) return;
      const P = T == null ? void 0 : T.item;
      if (!P) throw new Error("找不到这一段的译文。");
      const M = `${(T == null ? void 0 : T.item_id) || n}`, { source: _, translated: j } = vl(P);
      s({ readerItemId: n, itemId: M, source: _, current: j }), u(I.get(n) ?? j);
    }).catch((T) => {
      E || S({ tone: "error", message: (T == null ? void 0 : T.message) || "读取这段译文失败。" });
    }).finally(() => {
      E || l(!1);
    }), k(t, n), () => {
      E = !0;
    };
  }, [e, t, n, k]);
  const O = x((E) => {
    u(E), n && I.set(n, E);
  }, [n, I]), $ = x(async (E, T) => {
    if (!e || !a || h) return !1;
    const P = E ?? f;
    if (!P.trim()) return !1;
    b(!0), S(null), g([]);
    try {
      const M = await e.revise(t, a.itemId, {
        translated_text: P,
        source: "user",
        reason: (T ?? m).trim() || "在阅读页手动修改",
        ...R.current != null ? { expected_generation: R.current } : {}
      }), _ = Number(M == null ? void 0 : M.generation);
      return Number.isFinite(_) && (R.current = _), I.delete(a.readerItemId), s({ ...a, current: P }), u(P), y(""), (M == null ? void 0 : M.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, P), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), k(t, a.readerItemId), !0;
    } catch (M) {
      const _ = M;
      return (_ == null ? void 0 : _.reason) === "generation_mismatch" && (R.current = null), S({ tone: "error", message: (_ == null ? void 0 : _.message) || "保存失败，请稍后再试。" }), g(Tl(_ == null ? void 0 : _.issues)), !1;
    } finally {
      b(!1);
    }
  }, [e, a, h, f, m, t, o, k, I, R]), F = x(() => {
    n && I.delete(n);
  }, [n, I]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: c,
    draft: f,
    setDraft: O,
    reason: m,
    setReason: y,
    saving: h,
    status: w,
    issues: v,
    save: $,
    discardDraft: F
  };
}
const xo = "reader-inline-edit";
function Ic({ text: e }) {
  const [t, n] = N("");
  return C(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = Ao(e);
      n(a.fallbackHtml), a.richHtml.then((s) => {
        r && n(s);
      });
    }, 250);
    return () => {
      r = !1, window.clearTimeout(o);
    };
  }, [e]), t ? /* @__PURE__ */ L("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ p("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ p("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function Rc({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var F;
  const s = e.itemId, i = Sc({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [l, c] = N(!1), [d, f] = N(!1), u = A(null), m = Ll(e.rect, t), y = G(() => Ml(o), [o]), h = y.indexOf(s), { loaded: b } = i, w = i.saving || i.loading, S = n.blockedReason, v = !b || i.draft === b.current, { close: g, select: I } = n, R = x((E) => {
    const T = y[h + E];
    T && (I(T), a == null || a(T));
  }, [y, h, I, a]), k = x(() => {
    i.discardDraft(), g();
  }, [i, g]), O = x(async (E, T) => {
    await i.save(E, T) && g();
  }, [i, g]);
  C(() => {
    const E = (T) => {
      !T.altKey || T.key !== "ArrowUp" && T.key !== "ArrowDown" || (T.preventDefault(), R(T.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", E), () => window.removeEventListener("keydown", E);
  }, [R]), ke(() => {
    const E = u.current;
    if (!E) return;
    E.style.height = "auto";
    const T = m.mode === "inline" ? m.minHeight : 0;
    E.style.height = `${Math.max(T, E.scrollHeight + 2)}px`;
  }, [i.draft, b, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const $ = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ L(at, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ L(
      "div",
      {
        className: `${xo} is-${m.mode}`,
        style: $,
        role: "group",
        "aria-label": `改第 ${((F = n.target) == null ? void 0 : F.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (E) => E.stopPropagation(),
        children: [
          r && (b != null && b.source) ? /* @__PURE__ */ p(
            ne,
            {
              className: `reader-inline-edit-source${l ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: l ? "收起原文" : "展开原文",
              onClick: () => c((E) => !E),
              children: b.source
            }
          ) : null,
          S ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: S }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          b ? /* @__PURE__ */ p(
            Ja,
            {
              ref: u,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: w || !!S,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (E) => i.setDraft(E.target.value),
              onKeyDown: (E) => {
                E.key === "Enter" && (E.metaKey || E.ctrlKey) ? (E.preventDefault(), v || O()) : E.key === "Escape" && (E.preventDefault(), k());
              }
            }
          ) : null,
          b ? /* @__PURE__ */ p(Ic, { text: i.draft }) : null,
          /* @__PURE__ */ L("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(ar, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => R(-1), children: /* @__PURE__ */ p(ka, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(ar, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= y.length - 1, onClick: () => R(1), children: /* @__PURE__ */ p(oo, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              lo,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!S || !b,
                onChange: (E) => i.setReason(E.target.value),
                onKeyDown: (E) => {
                  E.key === "Enter" ? (E.preventDefault(), v || O()) : E.key === "Escape" && (E.preventDefault(), k());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ L(
              ne,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": d,
                "data-block-edit-action": "history",
                onClick: () => f((E) => !E),
                children: [
                  /* @__PURE__ */ p(Na, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(ne, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: k, children: "取消" }),
            /* @__PURE__ */ p(
              ne,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: w || !!S || v || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  O();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((E) => /* @__PURE__ */ p("li", { children: E }, E)) }) : null,
          d && b && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((E, T) => {
            const P = E.text === b.current, M = [Il(E.ts), E.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ L("li", { "data-block-edit-history": E.label, "data-current": P ? "true" : void 0, children: [
              /* @__PURE__ */ L("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ L("span", { children: [
                  M,
                  P ? "（现在用的）" : "",
                  E.reason ? ` · ${E.reason}` : ""
                ] }),
                P ? null : /* @__PURE__ */ p(
                  ne,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!S,
                    onClick: () => {
                      O(E.text, `回到「${M.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: E.text })
            ] }, `${E.ts}:${T}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const zo = Mn(null), Oo = Mn(null);
function Ec({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(zo.Provider, { value: e, children: /* @__PURE__ */ p(Oo.Provider, { value: t, children: n }) });
}
function We() {
  return An(zo);
}
function $o() {
  return An(Oo);
}
const qe = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Pc = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Tc = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, kc = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  varepsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  tau: "τ",
  phi: "φ",
  varphi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Xi: "Ξ",
  Pi: "Π",
  Sigma: "Σ",
  Phi: "Φ",
  Psi: "Ψ",
  Omega: "Ω"
}, Pr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Nc(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Pr(o ?? a ?? "", Pc)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Pr(o ?? a ?? "", Tc)).replace(/\\([a-zA-Z]+)/gu, (r, o) => kc[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Mc(e) {
  return qe(e.translatedBlockText) || qe(e.translated.text) || qe(e.source.text);
}
const Ac = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function _c(e) {
  const t = [];
  for (const n of e) {
    if (!Ac(n)) continue;
    const r = Nc(Mc(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Lc(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Cc = 24, Dc = 60;
function Tr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Cc), o = Math.min(e.length, n + t.length + Dc), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function xc(e, t, n = 200) {
  const r = qe(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = qe(a.translatedBlockText) || qe(a.translated.text), l = i ? Tr(i, r) : null, c = l ?? Tr(qe(a.source.text), r);
    if (c && (o.push({ itemId: a.itemId, page: s, side: l ? "translated" : "source", ...c }), o.length >= n))
      break;
  }
  return o;
}
function $t(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function zc(e, t) {
  const n = qe(t).toLowerCase();
  if (!n || !e) return $t(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${$t(e.slice(a, s))}<mark class="reader-find-mark">${$t(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + $t(e.slice(a));
}
function Oc(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const Fo = 1.414;
function $c({
  pageNumber: e,
  width: t,
  devicePixelRatio: n,
  pane: r,
  active: o = !1,
  textLayer: a = !0,
  syncedMinHeight: s = 0,
  onMetrics: i,
  cachedAspect: l,
  onAspectChange: c,
  sentinelRef: d,
  regionHighlight: f = null,
  regionTargets: u = [],
  hoveredRegionId: m,
  onHoverRegion: y,
  liveTranslationLayout: h,
  liveTranslationPage: b,
  showLiveTranslation: w = r === "source",
  liveTranslationMissing: S = !1
}) {
  var Re, Q;
  const v = We(), g = v == null ? void 0 : v.revisedBlocks, I = v == null ? void 0 : v.blockEdit, R = I == null ? void 0 : I.pendingEdits, k = v == null ? void 0 : v.editBlock, O = (v == null ? void 0 : v.findTerm) || "", $ = G(
    () => O ? ({ str: z }) => zc(z, O) : void 0,
    [O]
  ), F = A(l ?? Fo), [E, T] = N(F.current);
  C(() => {
    l != null && Math.abs(l - F.current) >= 1e-3 && (F.current = l, T(l));
  }, [l]);
  const P = A(d);
  P.current = d;
  const M = A(null), _ = A((z) => {
    var ee;
    M.current = z, (ee = P.current) == null || ee.call(P, z);
  }).current, j = A(null), B = A(`${t}@${n}`);
  ke(() => {
    const z = `${t}@${n}`;
    B.current !== z && (B.current = z, o && Bc(M.current, j.current));
  }, [o, n, t]), C(() => {
    o || ln(j.current);
  }, [o]), C(() => () => ln(j.current), []);
  const H = Math.max(120, Math.floor(t * E)), X = Math.max(H, Math.ceil(s || 0)), ae = Ln(f, t, H), Y = G(
    () => Dl(u, t, H),
    [H, u, t]
  ), [he, fe] = N(null), me = typeof y == "function", Le = me ? m ?? null : he, J = (z) => {
    me ? z !== (m ?? null) && (y == null || y(z)) : fe((ee) => ee === z ? ee : z);
  }, K = G(
    () => Y.find((z) => z.itemId === Le) || null,
    [Le, Y]
  ), we = r === "translated" && ((Re = I == null ? void 0 : I.target) == null ? void 0 : Re.itemId) || "", ce = G(
    () => we && Y.find((z) => z.itemId === we) || null,
    [we, Y]
  ), pe = mc(M, o ? K : null, Y, t), $e = (z) => {
    var Ne, Ie, Me, U, re;
    if (z.pointerType === "touch") return;
    if ((Ne = v == null ? void 0 : v.ink) != null && Ne.tool) {
      J(null);
      return;
    }
    if (z.buttons !== 0) {
      J(null);
      return;
    }
    if ((Me = (Ie = z.target) == null ? void 0 : Ie.closest) != null && Me.call(Ie, `.${Mo}`) || (re = (U = z.target) == null ? void 0 : U.closest) != null && re.call(U, `.${xo}`)) return;
    const ee = z.currentTarget.getBoundingClientRect(), te = z.clientX - ee.left, ue = z.clientY - ee.top;
    if (dc(pe, te, ue)) return;
    const le = vr(Y, te, ue);
    J((le == null ? void 0 : le.itemId) || null);
  }, be = (z) => {
    if (z.pointerType === "mouse") return;
    const ee = z.currentTarget.getBoundingClientRect(), te = vr(
      Y,
      z.clientX - ee.left,
      z.clientY - ee.top
    );
    J((te == null ? void 0 : te.itemId) || null);
  }, Ce = (z) => {
    !Number.isFinite(z) || z <= 0 || Math.abs(F.current - z) < 1e-3 || (F.current = z, T(z), c == null || c(e, z));
  };
  return /* @__PURE__ */ L(
    "div",
    {
      ref: _,
      [Oe]: e,
      [Ze]: r,
      [Dn]: H,
      className: xn,
      onPointerMoveCapture: $e,
      onPointerDown: be,
      onPointerLeave: (z) => {
        z.pointerType === "mouse" && J(null);
      },
      style: {
        width: t,
        height: X,
        minHeight: X
      },
      children: [
        o ? /* @__PURE__ */ p(
          qa,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: $,
            renderAnnotationLayer: !1,
            className: ho,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: Vt,
                style: { width: t, height: H }
              }
            ),
            onLoadSuccess: (z) => {
              try {
                const ee = z.getViewport({ scale: 1 });
                if (ee.width > 0) {
                  const te = ee.height / ee.width;
                  Ce(te);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              ln(j.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: Vt,
            style: { width: t, height: H },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: j, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        ae ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: ae,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ p(
          tc,
          {
            layoutPage: h,
            pageState: b,
            width: t,
            height: H
          }
        ) : null,
        o && w && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (R != null && R.size) ? /* @__PURE__ */ p(rc, { targets: Y, edits: R, width: t, excludeId: ce == null ? void 0 : ce.itemId }) : null,
        o && ce && I ? /* @__PURE__ */ p(
          Rc,
          {
            target: ce,
            page: { width: t, height: H },
            edit: I,
            showSource: !!(v != null && v.editShowsSource),
            regions: v == null ? void 0 : v.regions,
            jumpToBlock: v == null ? void 0 : v.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (g != null && g.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: Y.filter((z) => g.has(z.itemId)).map((z) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": z.itemId,
            style: { left: z.rect.left, top: z.rect.top, height: z.rect.height }
          },
          z.itemId
        )) }) : null,
        o && (v != null && v.ink) ? /* @__PURE__ */ p(
          wc,
          {
            page: e,
            pane: r === "translated" ? "translated" : v.compareVersion ? "compare" : "source",
            width: t,
            height: H,
            ink: v.ink
          }
        ) : null,
        /* @__PURE__ */ p(
          Wl,
          {
            target: o && !((Q = v == null ? void 0 : v.ink) != null && Q.tool) && (K == null ? void 0 : K.itemId) !== (ce == null ? void 0 : ce.itemId) ? K : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: K && (g == null ? void 0 : g.get(K.itemId)) || 0,
            onEdit: k,
            frameRect: pe == null ? void 0 : pe.rect,
            placement: pe == null ? void 0 : pe.placement,
            tailTop: pe == null ? void 0 : pe.tailTop
          }
        )
      ]
    }
  );
}
const Fc = Yt($c);
function Bc(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function ln(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const jc = 2 * 1024 * 1024;
function Uc(e) {
  const t = new co.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const cn = 5, Hc = "120% 0px", Wc = 120, Vc = "25% 0px";
let kr = 1;
const Nr = /* @__PURE__ */ new WeakMap();
function Kc(e) {
  if (!e) return 0;
  const t = Nr.get(e);
  if (t) return t;
  const n = kr;
  return kr += 1, Nr.set(e, n), n;
}
function Jc() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const qc = Qr(
  function({
    pane: t,
    url: n = "",
    preloadedFile: r = null,
    userZoom: o = 1,
    visible: a = !0,
    emptyLabel: s = "暂无 PDF",
    scrollRoot: i = null,
    pageWidthOverride: l = null,
    rowHeights: c,
    onMetrics: d,
    onLoadSuccess: f,
    onLoadError: u,
    onNumPagesChange: m,
    activeRegion: y = null,
    regions: h = [],
    readerMetadata: b = null,
    hoveredRegionId: w = null,
    onHoverRegion: S,
    liveTranslation: v,
    showLiveTranslation: g = t === "source",
    liveTranslationPendingLabel: I = "",
    paneAction: R
  }, k) {
    gl();
    const { file: O, loading: $, error: F } = Cs(n, r), E = `${n}\0${Kc(O)}`, T = A(E);
    T.current = E;
    const P = G(() => {
      const D = ks(O);
      return D ? "ranged" in D ? { range: Uc(D.ranged) } : D : null;
    }, [O, n]), [M, _] = N(0), [j, B] = N(""), [H, X] = N(null), [ae, Y] = N(480), he = A(null), fe = A(0), me = G(() => Jc(), []), Le = G(() => ({
      cMapUrl: Tt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Tt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: jc,
      disableAutoFetch: !0
    }), []);
    _n(k, () => H, [H]), C(() => {
      const D = (W) => {
        fe.current = W, Y(W);
      }, q = (W) => {
        const se = ai(W, fe.current);
        if (se !== "ignore") {
          if (he.current && clearTimeout(he.current), se === "immediate") {
            D(W);
            return;
          }
          he.current = setTimeout(() => D(W), bo);
        }
      }, V = !!(l && l >= 80);
      q(V ? l : (i == null ? void 0 : i.clientWidth) || 0);
      const ie = !V && i && typeof ResizeObserver < "u" ? new ResizeObserver((W) => {
        var se, ge;
        q(((ge = (se = W[0]) == null ? void 0 : se.contentRect) == null ? void 0 : ge.width) ?? i.clientWidth);
      }) : null;
      return ie && i && ie.observe(i), () => {
        ie == null || ie.disconnect(), he.current && clearTimeout(he.current);
      };
    }, [l, i, a]);
    const J = G(
      () => ni(ae, o),
      [ae, o]
    ), [K, we] = N(() => /* @__PURE__ */ new Map()), [ce, pe] = N(() => /* @__PURE__ */ new Set()), [$e, be] = N(() => /* @__PURE__ */ new Set()), Ce = A(/* @__PURE__ */ new Map()), Re = A(null), Q = A(null), [z, ee] = N(() => /* @__PURE__ */ new Set()), te = A(/* @__PURE__ */ new Map()), ue = x((D, q) => {
      we((V) => {
        if (V.get(D) === q) return V;
        const Z = new Map(V);
        return Z.set(D, q), Z;
      });
    }, []), le = x((D, q) => {
      const V = Ce.current, Z = V.get(D), ie = [Re.current, Q.current];
      if (Z)
        for (const W of ie)
          try {
            W == null || W.unobserve(Z);
          } catch {
          }
      if (q) {
        V.set(D, q);
        for (const W of ie)
          try {
            W == null || W.observe(q);
          } catch {
          }
      } else
        V.delete(D);
    }, []), Ne = A(/* @__PURE__ */ new Map()), Ie = x((D) => {
      const q = Ne.current;
      let V = q.get(D);
      return V || (V = (Z) => le(D, Z), q.set(D, V)), V;
    }, [le]);
    C(() => {
      if (typeof IntersectionObserver > "u") return;
      const D = te.current, q = new IntersectionObserver(
        (V) => {
          const Z = [], ie = [];
          for (const W of V) {
            const se = W.target, ge = Jt(se);
            Number.isFinite(ge) && (W.isIntersecting ? Z : ie).push(ge);
          }
          if ((Z.length || ie.length) && pe((W) => {
            let se = null;
            for (const ge of Z)
              W.has(ge) || (se = se || new Set(W), se.add(ge));
            for (const ge of ie)
              W.has(ge) && (se = se || new Set(W), se.delete(ge));
            return se || W;
          }), Z.length) {
            for (const W of Z) {
              const se = D.get(W);
              se && (clearTimeout(se), D.delete(W));
            }
            be((W) => {
              let se = null;
              for (const ge of Z)
                W.has(ge) || (se = se || new Set(W), se.add(ge));
              return se || W;
            });
          }
          for (const W of ie)
            D.has(W) || D.set(W, setTimeout(() => {
              D.delete(W), be((se) => {
                if (!se.has(W)) return se;
                const ge = new Set(se);
                return ge.delete(W), ge;
              });
            }, Wc));
        },
        { root: i, rootMargin: Hc, threshold: 0 }
      );
      Re.current = q;
      for (const V of Ce.current.values())
        try {
          q.observe(V);
        } catch {
        }
      return () => {
        q.disconnect(), Re.current === q && (Re.current = null);
        for (const V of D.values()) clearTimeout(V);
        D.clear();
      };
    }, [i]), C(() => {
      if (typeof IntersectionObserver > "u") return;
      const D = new IntersectionObserver(
        (q) => {
          ee((V) => {
            let Z = null;
            for (const ie of q) {
              const W = Jt(ie.target);
              !Number.isFinite(W) || ie.isIntersecting === V.has(W) || (Z = Z || new Set(V), ie.isIntersecting ? Z.add(W) : Z.delete(W));
            }
            return Z || V;
          });
        },
        { root: i, rootMargin: Vc, threshold: 0 }
      );
      Q.current = D;
      for (const q of Ce.current.values())
        try {
          D.observe(q);
        } catch {
        }
      return () => {
        D.disconnect(), Q.current === D && (Q.current = null);
      };
    }, [i]);
    const Me = !!i && typeof IntersectionObserver < "u";
    ke(() => {
      _(0), B(""), pe(/* @__PURE__ */ new Set()), be(/* @__PURE__ */ new Set()), we(/* @__PURE__ */ new Map()), Ce.current.clear();
      const D = te.current;
      for (const q of D.values()) clearTimeout(q);
      D.clear(), m == null || m(0, t);
    }, [E, m, t]);
    const U = x(
      ({ numPages: D }) => {
        T.current === E && (_(D), B(""), m == null || m(D, t), f == null || f({ numPages: D, pane: t }));
      },
      [E, f, m, t]
    ), re = x(
      (D) => {
        if (T.current !== E) return;
        const q = (D == null ? void 0 : D.message) || "PDF 解析失败";
        B(q), _(0), m == null || m(0, t), u == null || u(D, t);
      },
      [E, u, m, t]
    ), Ee = G(
      () => M > 0 ? Array.from({ length: M }, (D, q) => q + 1) : [],
      [M]
    );
    C(() => {
      typeof IntersectionObserver < "u" || be(new Set(Ee));
    }, [Ee]);
    const Pe = G(
      () => or(y, b, t),
      [y, b, t]
    ), Se = G(() => {
      const D = /* @__PURE__ */ new Map();
      for (const q of h) {
        const V = or(q, b, t);
        if (!V) continue;
        const Z = D.get(V.box.page) || [];
        Z.push(V), D.set(V.box.page, Z);
      }
      return D;
    }, [t, b, h]), Ve = G(() => {
      const D = /* @__PURE__ */ new Set();
      if (!w) return D;
      for (const [q, V] of Se)
        V.some((Z) => Z.itemId === w) && D.add(q);
      return D;
    }, [w, Se]), Dt = G(() => {
      if (M === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Ee);
      if (ce.size === 0) {
        const V = Math.min(M, cn * 2 + 1);
        return new Set(Array.from({ length: V }, (Z, ie) => ie + 1));
      }
      const q = /* @__PURE__ */ new Set();
      for (const V of ce)
        for (let Z = -cn; Z <= cn; Z++) {
          const ie = V + Z;
          ie >= 1 && ie <= M && q.add(ie);
        }
      return q;
    }, [M, Ee, i, a, ce]), lt = !n || !!F || !!j, xt = n && (F || j) || s;
    return /* @__PURE__ */ L(
      "section",
      {
        ref: X,
        className: `reader-panel ${qs}${a ? "" : " is-hidden"}`,
        [Ze]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (v == null ? void 0 : v.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          R ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: R }) : null,
          I ? /* @__PURE__ */ L("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: I })
          ] }) : null,
          lt && !$ ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: xt }) : null,
          $ ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          P && !F ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            Ga,
            {
              file: P,
              loading: null,
              error: null,
              options: Le,
              onLoadSuccess: U,
              onLoadError: re,
              className: "reader-react-pdf-document",
              children: Ee.map((D) => {
                if (Dt.has(D))
                  return /* @__PURE__ */ p(
                    Fc,
                    {
                      pane: t,
                      pageNumber: D,
                      width: J,
                      devicePixelRatio: me,
                      active: $e.has(D),
                      textLayer: !Me || z.has(D),
                      syncedMinHeight: (c == null ? void 0 : c.get(D)) || 0,
                      onMetrics: d,
                      cachedAspect: K.get(D),
                      onAspectChange: ue,
                      sentinelRef: Ie(D),
                      regionHighlight: (Pe == null ? void 0 : Pe.box.page) === D ? Pe : null,
                      regionTargets: Se.get(D),
                      hoveredRegionId: w && Ve.has(D) ? w : null,
                      onHoverRegion: S,
                      liveTranslationLayout: v == null ? void 0 : v.layoutByPage.get(D - 1),
                      liveTranslationPage: v == null ? void 0 : v.pagesByPage.get(D - 1),
                      showLiveTranslation: g,
                      liveTranslationMissing: Wi(v, D - 1)
                    },
                    `${t}-${D}`
                  );
                const V = K.get(D) ?? Fo, Z = Math.max(120, Math.floor(J * V)), ie = Math.max(Z, Math.ceil((c == null ? void 0 : c.get(D)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: Ie(D),
                    [Oe]: D,
                    [Ze]: t,
                    [Dn]: Z,
                    className: `${xn} is-placeholder`,
                    style: {
                      width: J,
                      height: ie,
                      minHeight: ie
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: Vt,
                        style: { width: J, height: Z },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${D}`
                );
              })
            },
            E
          ) }) : null
        ]
      }
    );
  }
), Mr = Yt(qc), Gc = 2e3, Zc = 6, Yc = 500, Ar = "reader-react-resizing";
function Xc(e, t) {
  const n = A(null), r = A(null);
  ke(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const g = Qc(e), I = jt(e, g);
      if (!I) return;
      s = { pane: g, progress: I, started: performance.now() };
    }
    const { pane: i, progress: l, started: c } = s;
    let d = 0, f = null, u = e.scrollHeight, m = u, y = 0, h = c;
    const b = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((g) => {
      let I = !1;
      for (const R of g) {
        const k = Math.round(R.contentRect.height);
        b.has(R.target) && b.get(R.target) !== k && (I = !0), b.set(R.target, k);
      }
      I && Nt(e, l, "auto", i);
    }), S = () => {
      var g;
      f && clearTimeout(f), cancelAnimationFrame(d), w == null || w.disconnect(), e.classList.remove(Ar);
      for (const I of _r) e.removeEventListener(I, S);
      ((g = r.current) == null ? void 0 : g.stop) === S && (r.current = null);
    }, v = () => {
      Nt(e, l, "auto", i);
      const g = e.scrollHeight;
      y = g === m ? y + 1 : 0, m = g;
      const I = performance.now() - h;
      y >= Zc && (g !== u || I > Yc) || I > Gc ? S() : d = requestAnimationFrame(v);
    };
    for (const g of _r) e.addEventListener(g, S, { passive: !0 });
    for (const g of Array.from(e.children)) w == null || w.observe(g);
    e.classList.add(Ar), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, h = performance.now(), u = e.scrollHeight, m = u, y = 0, d = requestAnimationFrame(v);
    }, bo);
  }, [e, t]), C(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Qc(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Oe}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Ze) || null;
  }
  return null;
}
const _r = ["wheel", "touchstart", "keydown", "pointerdown"];
function Bo(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function ed(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function td({ compare: e, onDone: t }) {
  return /* @__PURE__ */ L("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
        ne,
        {
          className: "reader-version-compare-item",
          "data-version-id": n.versionId,
          "aria-current": o ? "true" : void 0,
          disabled: r,
          onClick: () => {
            e.choose(n.versionId), t();
          },
          children: [
            /* @__PURE__ */ p("span", { className: "reader-version-compare-name", children: n.name }),
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: Bo(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(ro, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Ma, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ L("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ L(
        ne,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(Aa, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ L(
        ne,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(_a, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function Lr({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = ed(t), a = [e === "compare" ? "对比" : "正在读", r, Bo(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ L("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function nd({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = N({ source: null, translated: null });
  return ke(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), l = (c) => {
        const d = e.querySelector(`[${Ze}="${c}"]`), f = d == null ? void 0 : d.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: l("source"), translated: l("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${Ze}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ L("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(Lr, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(Lr, { role: "reading", ...n }) }) : null
  ] });
}
const rd = () => () => {
}, Cr = () => null;
function od({
  mode: e,
  compareMode: t,
  showSource: n,
  showTranslated: r,
  markdownSplit: o,
  overlayOnSource: a = !1
}) {
  const s = o && e === "compare";
  return {
    mode: s ? "source" : e,
    compareMode: t && !o,
    showSource: s ? !0 : n,
    showTranslated: s ? !1 : r
  };
}
function ad(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function sd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function id(e) {
  const t = We(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", l = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, c = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), d = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), u = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Ct, y = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), b = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, v = (t == null ? void 0 : t.compareVersion) ?? null, g = (v == null ? void 0 : v.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", I = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", R = v ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, k = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, O = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), $ = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), F = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), E = e.regions ?? (t == null ? void 0 : t.regions) ?? [], T = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), P = (t == null ? void 0 : t.regionHover) ?? null, [M, _] = N(null), j = eo(
    P ? P.subscribe : rd,
    P ? () => P.get().itemId : Cr,
    P ? () => P.get().itemId : Cr
  ), B = P ? j : M, H = x((he) => {
    P ? P.set(he, "pdf") : _(he);
  }, [P]), X = od({
    mode: s,
    compareMode: i,
    showSource: l,
    showTranslated: c,
    markdownSplit: n,
    overlayOnSource: d
  }), Y = Number.isFinite(y) && y > 0 ? ad(
    y,
    n || r,
    typeof document > "u" ? y * 2 : document.documentElement.clientWidth
  ) : null;
  return Xc(u, Y), /* @__PURE__ */ L(
    "div",
    {
      ref: f,
      className: mo,
      "data-reader-region-count": E.length,
      "data-reader-structured-region-count": E.filter(Sa).length,
      "data-reader-metadata-ready": T ? "true" : "false",
      children: [
        /* @__PURE__ */ L(
          "main",
          {
            className: `${Js} reader-mode-${X.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              b ? /* @__PURE__ */ p(
                Mr,
                {
                  pane: "source",
                  url: g,
                  preloadedFile: R,
                  userZoom: m,
                  visible: X.showSource,
                  scrollRoot: u,
                  pageWidthOverride: Y,
                  rowHeights: X.compareMode ? h : void 0,
                  onMetrics: O,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: $,
                  activeRegion: F,
                  regions: (v == null ? void 0 : v.regions) ?? E,
                  readerMetadata: T,
                  hoveredRegionId: B,
                  onHoverRegion: H,
                  liveTranslation: d ? o : void 0,
                  showLiveTranslation: d,
                  liveTranslationPendingLabel: d ? sd(o) : "",
                  paneAction: d && X.showTranslated ? /* @__PURE__ */ L(at, { children: [
                    e.sourcePaneAction,
                    /* @__PURE__ */ p(
                      "span",
                      {
                        className: "reader-source-overlay-badge",
                        "data-source-overlay-badge": "true",
                        title: "源栏正在叠加实时译文，右栏为最终译文 PDF",
                        children: "原文+实时译文叠加"
                      }
                    )
                  ] }) : e.sourcePaneAction
                },
                v ? `compare:${v.url}` : "source"
              ) : null,
              w ? /* @__PURE__ */ p(
                Mr,
                {
                  pane: "translated",
                  url: I,
                  preloadedFile: k,
                  userZoom: m,
                  visible: X.showTranslated,
                  scrollRoot: u,
                  pageWidthOverride: Y,
                  rowHeights: X.compareMode ? h : void 0,
                  onMetrics: O,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: $,
                  activeRegion: F,
                  regions: E,
                  readerMetadata: T,
                  hoveredRegionId: B,
                  onHoverRegion: H,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        v ? /* @__PURE__ */ p(nd, { shellEl: u, left: v.left, right: v.right }) : null
      ]
    }
  );
}
const ld = [
  { id: "source", label: "原文", Icon: ao },
  { id: "compare", label: "对照", Icon: so },
  { id: "translated", label: "译文", Icon: io }
];
function cd(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function dd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function ud(e) {
  const t = We(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, l = a ? cd(a.state) : "";
  return /* @__PURE__ */ L("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ L("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: ld.map(({ id: c, label: d, Icon: f }) => {
        const u = n === c, m = dd({
          id: c,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ L(
          "button",
          {
            type: "button",
            className: `reader-workspace-tab${u ? " is-active" : ""}`,
            role: "tab",
            "aria-selected": u,
            "aria-label": d,
            title: m ? `${d} 需要文档任务` : d,
            disabled: m,
            onClick: () => o(c),
            children: [
              /* @__PURE__ */ p(f, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-workspace-tab-label", children: d })
            ]
          },
          c
        );
      }) }),
      a ? /* @__PURE__ */ L("div", { className: "reader-live-strip", children: [
        /* @__PURE__ */ L(
          "button",
          {
            type: "button",
            className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
            "aria-pressed": a.visible,
            "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
            title: a.state.error || `${l}，${a.visible ? "点一下看原文" : "点一下叠上译文"}`,
            onClick: a.onToggle,
            children: [
              /* @__PURE__ */ p(La, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: l })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ L(
          ne,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ p(Ca, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ L(
        ne,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ p(Da, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const fd = Qr(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
  return /* @__PURE__ */ L(
    "svg",
    {
      ref: s,
      xmlns: "http://www.w3.org/2000/svg",
      width: t,
      height: t,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: r,
      strokeWidth: n,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className: o,
      ...a,
      children: [
        /* @__PURE__ */ p("rect", { x: "2", y: "5", width: "20", height: "14", rx: "2.5" }),
        /* @__PURE__ */ p("path", { d: "M6 15V9l2.5 3L11 9v6" }),
        /* @__PURE__ */ p("path", { d: "M16.5 9v6M14.5 13l2 2 2-2" })
      ]
    }
  );
}), md = fd, hd = {
  markdown: { label: "Markdown", short: "MD", Icon: md, needsJob: !0 }
}, pd = yo.map(
  (e) => ({ id: e, ...hd[e] })
);
function jo() {
  return pd.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function gd(e) {
  const t = We(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(at, { children: jo().map(({ id: s, label: i, Icon: l, needsJob: c }) => {
    const d = n === s, f = c && r, u = d ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ L(
      "button",
      {
        type: "button",
        className: "reader-panel-toggle",
        "aria-label": u,
        "aria-pressed": d,
        title: f ? `${i} 需打开任务阅读` : i,
        disabled: f,
        onClick: () => d ? a() : o(s),
        children: [
          /* @__PURE__ */ p(l, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-panel-toggle-label", "aria-hidden": "true", children: i })
        ]
      },
      s
    );
  }) });
}
function bd(e) {
  const t = We(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = jo().map(({ id: l, label: c, short: d, Icon: f, needsJob: u }) => ({
    key: l,
    label: c,
    short: d,
    Icon: f,
    disabled: u && o,
    selected: n === l,
    badge: r == null ? void 0 : r[l],
    onClick: () => a(l)
  }));
  return n ? /* @__PURE__ */ L("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: l, label: c, Icon: d, disabled: f, selected: u, badge: m, onClick: y }) => /* @__PURE__ */ L(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": u,
        className: `reader-assistant-dock-tab${u ? " is-active" : ""}`,
        title: f ? `${c} 需打开任务阅读` : c,
        disabled: f,
        onClick: y,
        children: [
          /* @__PURE__ */ p(d, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-assistant-dock-tab-label", children: c }),
          m ? /* @__PURE__ */ p("span", { className: "reader-assistant-dock-badge", children: m }) : null
        ]
      },
      l
    )) }),
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ p(bt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function yd(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function vd(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function wd(e) {
  return e / 100 * window.innerHeight;
}
function Sd(e) {
  return e / 100 * window.innerWidth;
}
function Id(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function Rt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Id(n);
  switch (a) {
    case "%": {
      r = o / 100 * e;
      break;
    }
    case "px": {
      r = o;
      break;
    }
    case "rem": {
      r = vd(t, o);
      break;
    }
    case "em": {
      r = yd(t, o);
      break;
    }
    case "vh": {
      r = wd(o);
      break;
    }
    case "vw": {
      r = Sd(o);
      break;
    }
  }
  return r;
}
function ve(e) {
  return parseFloat(e.toFixed(3));
}
function pt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function En(e) {
  const { panels: t } = e, n = pt({ group: e });
  return n === 0 ? t.map((r) => ({
    groupResizeBehavior: r.panelConstraints.groupResizeBehavior,
    collapsedSize: 0,
    collapsible: r.panelConstraints.collapsible === !0,
    defaultSize: void 0,
    disabled: r.panelConstraints.disabled,
    minSize: 0,
    maxSize: 100,
    panelId: r.id
  })) : t.map((r) => {
    const { element: o, panelConstraints: a } = r;
    let s = 0;
    if (a.collapsedSize !== void 0) {
      const d = Rt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = ve(d / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const d = Rt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = ve(d / n * 100);
    }
    let l = 0;
    if (a.minSize !== void 0) {
      const d = Rt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      l = ve(d / n * 100);
    }
    let c = 100;
    if (a.maxSize !== void 0) {
      const d = Rt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      c = ve(d / n * 100);
    }
    return {
      groupResizeBehavior: a.groupResizeBehavior,
      collapsedSize: s,
      collapsible: a.collapsible === !0,
      defaultSize: i,
      disabled: a.disabled,
      minSize: l,
      maxSize: c,
      panelId: r.id
    };
  });
}
function oe(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Pn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Rd : Ed
  );
}
function Rd(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Ed(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Uo(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Ho(e, t) {
  return {
    x: e.x >= t.left && e.x <= t.right ? 0 : Math.min(
      Math.abs(e.x - t.left),
      Math.abs(e.x - t.right)
    ),
    y: e.y >= t.top && e.y <= t.bottom ? 0 : Math.min(
      Math.abs(e.y - t.top),
      Math.abs(e.y - t.bottom)
    )
  };
}
function Pd({
  orientation: e,
  rects: t,
  targetRect: n
}) {
  const r = {
    x: n.x + n.width / 2,
    y: n.y + n.height / 2
  };
  let o, a = Number.MAX_VALUE;
  for (const s of t) {
    const { x: i, y: l } = Ho(r, s), c = e === "horizontal" ? i : l;
    c < a && (a = c, o = s);
  }
  return oe(o, "No rect found"), o;
}
let Ft;
function Td() {
  return Ft === void 0 && (typeof matchMedia == "function" ? Ft = !!matchMedia("(pointer:coarse)").matches : Ft = !1), Ft;
}
function Wo(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Pn(
    n,
    Array.from(t.children).filter(Uo).map((y) => ({ element: y }))
  ).map(({ element: y }) => y), s = [];
  let i = !1, l = !1, c = -1, d = -1, f = 0, u, m = [];
  {
    let y = -1;
    for (const h of a)
      h.hasAttribute("data-panel") && (y++, h.hasAttribute("data-disabled") || (f++, c === -1 && (c = y), d = y));
  }
  if (f > 1) {
    let y = -1;
    for (const h of a)
      if (h.hasAttribute("data-panel")) {
        y++;
        const b = r.find(
          (w) => w.element === h
        );
        if (b) {
          if (u) {
            const w = u.element.getBoundingClientRect(), S = h.getBoundingClientRect();
            let v;
            if (l) {
              const g = n === "horizontal" ? new DOMRect(
                w.right,
                w.top,
                0,
                w.height
              ) : new DOMRect(
                w.left,
                w.bottom,
                w.width,
                0
              ), I = n === "horizontal" ? new DOMRect(S.left, S.top, 0, S.height) : new DOMRect(S.left, S.top, S.width, 0);
              switch (m.length) {
                case 0: {
                  v = [
                    g,
                    I
                  ];
                  break;
                }
                case 1: {
                  const R = m[0], k = Pd({
                    orientation: n,
                    rects: [w, S],
                    targetRect: R.element.getBoundingClientRect()
                  });
                  v = [
                    R,
                    k === w ? I : g
                  ];
                  break;
                }
                default: {
                  v = m;
                  break;
                }
              }
            } else
              m.length ? v = m : v = [
                n === "horizontal" ? new DOMRect(
                  w.right,
                  S.top,
                  S.left - w.right,
                  S.height
                ) : new DOMRect(
                  S.left,
                  w.bottom,
                  S.width,
                  S.top - w.bottom
                )
              ];
            for (const g of v) {
              let I = "width" in g ? g : g.element.getBoundingClientRect();
              const R = Td() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (I.width < R) {
                const O = R - I.width;
                I = new DOMRect(
                  I.x - O / 2,
                  I.y,
                  I.width + O,
                  I.height
                );
              }
              if (I.height < R) {
                const O = R - I.height;
                I = new DOMRect(
                  I.x,
                  I.y - O / 2,
                  I.width,
                  I.height + O
                );
              }
              const k = y <= c || y > d;
              !i && !k && s.push({
                group: e,
                groupSize: pt({ group: e }),
                panels: [u, b],
                separator: "width" in g ? void 0 : g,
                rect: I
              }), i = !1;
            }
          }
          l = !1, u = b, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const b = o.find(
          (w) => w.element === h
        );
        b ? m.push(b) : (u = void 0, m = []);
      } else
        l = !0;
  }
  return s;
}
var Je;
class Vo {
  constructor() {
    tr(this, Je, {});
  }
  addListener(t, n) {
    const r = yt(this, Je)[t];
    return r === void 0 ? yt(this, Je)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = yt(this, Je)[t];
    if (r !== void 0)
      if (r.length === 1)
        r[0].call(null, n);
      else {
        let o = !1, a = null;
        const s = Array.from(r);
        for (let i = 0; i < s.length; i++) {
          const l = s[i];
          try {
            l.call(null, n);
          } catch (c) {
            a === null && (o = !0, a = c);
          }
        }
        if (o)
          throw a;
      }
  }
  removeAllListeners() {
    nr(this, Je, {});
  }
  removeListener(t, n) {
    const r = yt(this, Je)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Je = new WeakMap();
let mt = {
  cursorFlags: 0,
  state: "inactive"
};
const Fn = new Vo();
function nt() {
  return mt;
}
function kd(e) {
  return Fn.addListener("change", e);
}
function Nd(e) {
  const t = mt, n = { ...mt };
  n.cursorFlags = e, mt = n, Fn.emit("change", {
    prev: t,
    next: n
  });
}
function ht(e) {
  const t = mt;
  mt = e, Fn.emit("change", {
    prev: t,
    next: e
  });
}
const Md = (e) => e, dn = () => {
}, Ko = 1, Jo = 2, qo = 4, Go = 8, Dr = 3, xr = 12;
let Bt;
function zr() {
  return Bt === void 0 && (Bt = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (Bt = !0)), Bt;
}
function Ad({
  cursorFlags: e,
  groups: t,
  state: n
}) {
  let r = 0, o = 0;
  switch (n) {
    case "active":
    case "hover":
      t.forEach((a) => {
        if (!a.mutableState.disableCursor)
          switch (a.orientation) {
            case "horizontal": {
              r++;
              break;
            }
            case "vertical": {
              o++;
              break;
            }
          }
      });
  }
  if (!(r === 0 && o === 0)) {
    switch (n) {
      case "active": {
        if (e && zr()) {
          const a = (e & Ko) !== 0, s = (e & Jo) !== 0, i = (e & qo) !== 0, l = (e & Go) !== 0;
          if (a)
            return i ? "se-resize" : l ? "ne-resize" : "e-resize";
          if (s)
            return i ? "sw-resize" : l ? "nw-resize" : "w-resize";
          if (i)
            return "s-resize";
          if (l)
            return "n-resize";
        }
        break;
      }
    }
    return zr() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Or = /* @__PURE__ */ new WeakMap();
function Bn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Or.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = nt();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Ad({
        cursorFlags: r.cursorFlags,
        groups: r.hitRegions.map((s) => s.group),
        state: r.state
      }), a = `*, *:hover {cursor: ${o} !important; }`;
      if (t === a)
        return;
      t = a, o ? n.cssRules.length === 0 ? n.insertRule(a) : n.replaceSync(a) : n.cssRules.length === 1 && n.deleteRule(0);
      break;
    }
    case "inactive": {
      t = void 0, n.cssRules.length === 1 && n.deleteRule(0);
      break;
    }
  }
  Or.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let xe = /* @__PURE__ */ new Map();
const Zo = new Vo();
function _d(e) {
  xe = new Map(xe), xe.delete(e);
}
function $r(e, t) {
  for (const [n] of xe)
    if (n.id === e)
      return n;
}
function Ge(e, t) {
  for (const [n, r] of xe)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function st() {
  return xe;
}
function jn(e, t) {
  return Zo.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function He(e, t, n) {
  const r = xe.get(e);
  xe = new Map(xe), xe.set(e, t), Zo.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Yo(e) {
  const t = nt();
  let n = !1;
  switch (t.state) {
    case "active":
      ht({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Bn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = Ge(r.group.id, !0);
        He(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Fr(e) {
  e.defaultPrevented || Yo(e.currentTarget);
}
function Ld(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Ho(n, a.rect);
    switch (e) {
      case "horizontal": {
        s.x <= o.x && (r = a, o = s);
        break;
      }
      case "vertical": {
        s.y <= o.y && (r = a, o = s);
        break;
      }
    }
  }
  return r ? {
    distance: o,
    hitRegion: r
  } : void 0;
}
function Cd(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Dd(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Ur(e),
    b: Ur(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  oe(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: jr(Br(n.a)),
    b: jr(Br(n.b))
  };
  if (o.a === o.b) {
    const a = r.childNodes, s = {
      a: n.a.at(-1),
      b: n.b.at(-1)
    };
    let i = a.length;
    for (; i--; ) {
      const l = a[i];
      if (l === s.a) return 1;
      if (l === s.b) return -1;
    }
  }
  return Math.sign(o.a - o.b);
}
const xd = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function zd(e) {
  const t = getComputedStyle(Xo(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Od(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || zd(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || xd.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Br(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (oe(n, "Missing node"), Od(n)) return n;
  }
  return null;
}
function jr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Ur(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Xo(e);
  return t;
}
function Xo(e) {
  const { parentNode: t } = e;
  return Cd(t) ? t.host : t;
}
function $d(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Fd({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Uo(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Dd(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if ($d(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function Un(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Wo(o), s = Ld(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Fd({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Bd(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function ye(e, t, n = 0) {
  return Math.abs(ve(e) - ve(t)) <= n;
}
function De(e, t) {
  return ye(e, t) ? 0 : e > t ? 1 : -1;
}
function ft({
  overrideDisabledPanels: e,
  panelConstraints: t,
  prevSize: n,
  size: r
}) {
  const {
    collapsedSize: o = 0,
    collapsible: a,
    disabled: s,
    maxSize: i = 100,
    minSize: l = 0
  } = t;
  if (s && !e)
    return n;
  if (De(r, l) < 0)
    if (a) {
      const c = (o + l) / 2;
      De(r, c) < 0 ? r = o : r = l;
    } else
      r = l;
  return r = Math.min(i, r), r = ve(r), r;
}
function Mt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (ye(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), l = Object.values(o), c = [...i], [d, f] = r;
  oe(d != null, "Invalid first pivot index"), oe(f != null, "Invalid second pivot index");
  let u = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : d, b = n[h];
        oe(
          b,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: S,
          minSize: v = 0
        } = b;
        if (S) {
          const g = i[h];
          if (oe(
            g != null,
            `Previous layout not found for panel index ${h}`
          ), ye(g, w)) {
            const I = v - g;
            De(I, Math.abs(e)) > 0 && (e = e < 0 ? 0 - I : I);
          }
        }
      }
      {
        const h = e < 0 ? d : f, b = n[h];
        oe(
          b,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: S,
          minSize: v = 0
        } = b;
        if (S) {
          const g = i[h];
          if (oe(
            g != null,
            `Previous layout not found for panel index ${h}`
          ), ye(g, v)) {
            const I = g - w;
            De(I, Math.abs(e)) > 0 && (e = e < 0 ? 0 - I : I);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : d, b = n[h];
      oe(
        b,
        `Panel constraints not found for index ${h}`
      );
      const w = i[h], { collapsible: S, collapsedSize: v, minSize: g } = b;
      if (S && De(w, g) < 0)
        if (e > 0) {
          const I = g - v, R = I / 2, k = w + e;
          De(k, g) < 0 && (e = De(e, R) <= 0 ? 0 : I);
        } else {
          const I = g - v, R = 100 - I / 2, k = w - e;
          De(k, g) < 0 && (e = De(100 + e, R) > 0 ? 0 : -I);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let b = e < 0 ? f : d, w = 0;
    for (; ; ) {
      const v = i[b];
      oe(
        v != null,
        `Previous layout not found for panel index ${b}`
      );
      const g = ft({
        overrideDisabledPanels: s,
        panelConstraints: n[b],
        prevSize: v,
        size: 100
      }) - v;
      if (w += g, b += h, b < 0 || b >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(w));
    e = e < 0 ? 0 - S : S;
  }
  {
    let h = e < 0 ? d : f;
    for (; h >= 0 && h < n.length; ) {
      const b = Math.abs(e) - Math.abs(u), w = i[h];
      oe(
        w != null,
        `Previous layout not found for panel index ${h}`
      );
      const S = w - b, v = ft({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: w,
        size: S
      });
      if (!ye(w, v) && (u += w - v, c[h] = v, u.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (Bd(l, c))
    return o;
  {
    const h = e < 0 ? f : d, b = i[h];
    oe(
      b != null,
      `Previous layout not found for panel index ${h}`
    );
    const w = b + u, S = ft({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: b,
      size: w
    });
    if (c[h] = S, !ye(S, w)) {
      let v = w - S, g = e < 0 ? f : d;
      for (; g >= 0 && g < n.length; ) {
        const I = c[g];
        oe(
          I != null,
          `Previous layout not found for panel index ${g}`
        );
        const R = I + v, k = ft({
          overrideDisabledPanels: s,
          panelConstraints: n[g],
          prevSize: I,
          size: R
        });
        if (ye(I, k) || (v -= k - I, c[g] = k), ye(v, 0))
          break;
        e > 0 ? g-- : g++;
      }
    }
  }
  const m = Object.values(c).reduce(
    (h, b) => b + h,
    0
  );
  if (!ye(m, 100, 0.1))
    return o;
  const y = Object.keys(o);
  return c.reduce((h, b, w) => (h[y[w]] = b, h), {});
}
function rt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || De(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function ot({
  layout: e,
  panelConstraints: t
}) {
  const n = Object.values(e), r = [...n], o = r.reduce(
    (i, l) => i + l,
    0
  );
  if (r.length !== t.length)
    throw Error(
      `Invalid ${t.length} panel layout: ${r.map((i) => `${i}%`).join(", ")}`
    );
  if (!ye(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const l = r[i];
      oe(l != null, `No layout data found for index ${i}`);
      const c = 100 / o * l;
      r[i] = c;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const l = n[i];
    oe(l != null, `No layout data found for index ${i}`);
    const c = r[i];
    oe(c != null, `No layout data found for index ${i}`);
    const d = ft({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: l,
      size: c
    });
    c != d && (a += c - d, r[i] = d);
  }
  if (!ye(a, 0))
    for (let i = 0; i < t.length; i++) {
      const l = r[i];
      oe(l != null, `No layout data found for index ${i}`);
      const c = l + a, d = ft({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: l,
        size: c
      });
      if (l !== d && (a -= d - l, r[i] = d, ye(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, l, c) => (i[s[c]] = l, i), {});
}
function Qo({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const l = st();
    for (const [
      c,
      {
        defaultLayoutDeferred: d,
        derivedPanelConstraints: f,
        layout: u,
        groupSize: m,
        separatorToPanels: y
      }
    ] of l)
      if (c.id === e)
        return {
          defaultLayoutDeferred: d,
          derivedPanelConstraints: f,
          group: c,
          groupSize: m,
          layout: u,
          separatorToPanels: y
        };
    throw Error(`Group ${e} not found`);
  }, r = () => {
    const l = n().derivedPanelConstraints.find(
      (c) => c.panelId === t
    );
    if (l !== void 0)
      return l;
    throw Error(`Panel constraints not found for Panel ${t}`);
  }, o = () => {
    const l = n().group.panels.find((c) => c.id === t);
    if (l !== void 0)
      return l;
    throw Error(`Layout not found for Panel ${t}`);
  }, a = () => {
    const l = n().layout[t];
    if (l !== void 0)
      return l;
    throw Error(`Layout not found for Panel ${t}`);
  }, s = ({
    nextSize: l,
    panels: c,
    prevLayout: d,
    derivedPanelConstraints: f
  }) => {
    const u = a(), m = c.findIndex((b) => b.id === t), y = m === 0, h = m === c.length - 1;
    if (h && l < u && (y || c.slice(0, m).every((b, w) => {
      const S = f[w];
      return (S == null ? void 0 : S.collapsible) && ye(S.collapsedSize, d[S.panelId]);
    }))) {
      const b = c.slice(0, m).reduce((w, S) => w + d[S.id], 0);
      return {
        ...d,
        [t]: ve(100 - b)
      };
    }
    return Mt({
      delta: h ? u - l : l - u,
      initialLayout: d,
      panelConstraints: f,
      pivotIndices: h ? [m - 1, m] : [m, m + 1],
      prevLayout: d,
      trigger: "imperative-api"
    });
  }, i = (l) => {
    const c = a();
    if (l === c)
      return;
    const {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: f,
      group: u,
      groupSize: m,
      layout: y,
      separatorToPanels: h
    } = n(), b = s({
      nextSize: l,
      panels: u.panels,
      prevLayout: y,
      derivedPanelConstraints: f
    }), w = ot({
      layout: b,
      panelConstraints: f
    });
    rt(y, w) || He(u, {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: f,
      groupSize: m,
      layout: w,
      separatorToPanels: h
    });
  };
  return {
    collapse: () => {
      const { collapsible: l, collapsedSize: c } = r(), { mutableValues: d } = o(), f = a();
      l && f !== c && (d.expandToSize = f, i(c));
    },
    expand: () => {
      const { collapsible: l, collapsedSize: c, minSize: d } = r(), { mutableValues: f } = o(), u = a();
      if (l && u === c) {
        let m = f.expandToSize ?? d;
        m === 0 && (m = 1), i(m);
      }
    },
    getSize: () => {
      const { group: l } = n(), c = a(), { element: d } = o(), f = l.orientation === "horizontal" ? d.offsetWidth : d.offsetHeight;
      return {
        asPercentage: c,
        inPixels: f
      };
    },
    isCollapsed: () => {
      const { collapsible: l, collapsedSize: c } = r(), d = a();
      return l && ye(c, d);
    },
    resize: (l) => {
      const { group: c } = n(), { element: d } = o(), f = pt({ group: c }), u = Rt({
        groupSize: f,
        panelElement: d,
        styleProp: l
      }), m = ve(u / f * 100);
      i(m);
    }
  };
}
function Hr(e) {
  if (e.defaultPrevented)
    return;
  const t = st();
  Un(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Qo({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function Ut(e) {
  const t = st();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function ea({
  groupId: e
}) {
  const t = () => {
    const n = st();
    for (const [r, o] of n)
      if (r.id === e)
        return { group: r, ...o };
    throw Error(`Could not find Group with id "${e}"`);
  };
  return {
    getLayout() {
      const { defaultLayoutDeferred: n, layout: r } = t();
      return n ? {} : r;
    },
    setLayout(n) {
      const {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        group: a,
        groupSize: s,
        layout: i,
        separatorToPanels: l
      } = t(), c = ot({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (rt(i, c) || He(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: c,
        separatorToPanels: l
      }), c);
    }
  };
}
function Qe(e, t) {
  const n = Ut(e), r = Ge(n.id, !0), o = n.separators.find(
    (d) => d.element === e
  );
  oe(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  oe(a, "Matching panels not found");
  const s = a.map((d) => n.panels.indexOf(d)), i = ea({ groupId: n.id }).getLayout(), l = Mt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), c = ot({
    layout: l,
    panelConstraints: r.derivedPanelConstraints
  });
  rt(i, c) || He(
    n,
    {
      defaultLayoutDeferred: r.defaultLayoutDeferred,
      derivedPanelConstraints: r.derivedPanelConstraints,
      groupSize: r.groupSize,
      layout: c,
      separatorToPanels: r.separatorToPanels
    },
    // Keyboard resizes (arrow keys, Home/End, Enter collapse/expand) originate
    // from a real DOM event on the separator, so they are user interactions
    // just like pointer drags. This function is only reached from
    // onDocumentKeyDown. See #716.
    { isUserInteraction: !0 }
  );
}
function Wr(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = Ut(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && Qe(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && Qe(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && Qe(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && Qe(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), Qe(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = Ut(t), o = Ge(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, l = r.separators.find(
          (u) => u.element === t
        );
        oe(l, "Matching separator not found");
        const c = i.get(l);
        oe(c, "Matching panels not found");
        const d = c[0], f = a.find(
          (u) => u.panelId === d.id
        );
        if (oe(f, "Panel metadata not found"), f.collapsible) {
          const u = s[d.id], m = f.collapsedSize === u ? r.mutableState.expandedPanelSizes[d.id] ?? f.minSize : f.collapsedSize;
          Qe(t, m - u);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = Ut(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        oe(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), Qe(t, -100);
        break;
      }
    }
}
function Vr(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = st(), n = Un(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), ht({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function ta({
  document: e,
  event: t,
  hitRegions: n,
  initialLayoutMap: r,
  mountedGroups: o,
  pointerDownAtPoint: a,
  prevCursorFlags: s
}) {
  let i = 0;
  n.forEach((c) => {
    const { group: d, groupSize: f } = c, { orientation: u, panels: m } = d, { disableCursor: y } = d.mutableState;
    let h = 0;
    a ? u === "horizontal" ? h = (t.clientX - a.x) / f * 100 : h = (t.clientY - a.y) / f * 100 : u === "horizontal" ? h = t.clientX < 0 ? -100 : 100 : h = t.clientY < 0 ? -100 : 100;
    const b = r.get(d), w = o.get(d);
    if (!b || !w)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: v,
      groupSize: g,
      layout: I,
      separatorToPanels: R
    } = w;
    if (v && I && R) {
      const k = Mt({
        delta: h,
        initialLayout: b,
        panelConstraints: v,
        pivotIndices: c.panels.map((O) => m.indexOf(O)),
        prevLayout: I,
        trigger: "mouse-or-touch"
      });
      if (rt(k, I)) {
        if (h !== 0 && !y)
          switch (u) {
            case "horizontal": {
              i |= h < 0 ? Ko : Jo;
              break;
            }
            case "vertical": {
              i |= h < 0 ? qo : Go;
              break;
            }
          }
      } else
        He(c.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: v,
          groupSize: g,
          layout: k,
          separatorToPanels: R
        });
    }
  });
  let l = 0;
  t.movementX === 0 ? l |= s & Dr : l |= i & Dr, t.movementY === 0 ? l |= s & xr : l |= i & xr, Nd(l), Bn(e);
}
function Kr(e) {
  const t = st(), n = nt();
  switch (n.state) {
    case "active":
      ta({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Jr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = nt(), n = st();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        ht({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = Ge(a.group.id, !0);
          He(a.group, s, {
            isUserInteraction: !0
          });
        });
        return;
      }
      for (const a of t.hitRegions)
        if (a.separator) {
          const { element: s } = a.separator;
          (r = s.hasPointerCapture) != null && r.call(s, e.pointerId) || ((o = s.setPointerCapture) == null || o.call(s, e.pointerId));
        }
      ta({
        document: e.currentTarget,
        event: e,
        hitRegions: t.hitRegions,
        initialLayoutMap: t.initialLayoutMap,
        mountedGroups: n,
        pointerDownAtPoint: t.pointerDownAtPoint,
        prevCursorFlags: t.cursorFlags
      });
      break;
    }
    default: {
      const a = Un(e, n);
      a.length === 0 ? t.state !== "inactive" && ht({
        cursorFlags: 0,
        state: "inactive"
      }) : ht({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Bn(e.currentTarget);
      break;
    }
  }
}
function qr(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (nt().state) {
      case "hover":
        ht({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Gr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Yo(e.currentTarget) && e.preventDefault();
}
function Zr(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = ve(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = ve((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function jd(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((l) => l.element === t);
  if (!r || !r.onResize)
    return;
  const o = pt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: ve(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function Ud(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Hd({
  group: e,
  nextGroupSize: t,
  prevGroupSize: n,
  prevLayout: r
}) {
  if (n <= 0 || t <= 0 || n === t)
    return r;
  let o = 0, a = 0, s = !1;
  const i = /* @__PURE__ */ new Map(), l = [];
  for (const f of e.panels) {
    const u = r[f.id] ?? 0;
    switch (f.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const m = u / 100 * n, y = ve(
          m / t * 100
        );
        i.set(f.id, y), o += y;
        break;
      }
      case "preserve-relative-size":
      default: {
        l.push(f.id), a += u;
        break;
      }
    }
  }
  if (!s || l.length === 0)
    return r;
  const c = 100 - o, d = { ...r };
  if (i.forEach((f, u) => {
    d[u] = f;
  }), a > 0)
    for (const f of l) {
      const u = r[f] ?? 0;
      d[f] = ve(
        u / a * c
      );
    }
  else {
    const f = ve(
      c / l.length
    );
    for (const u of l)
      d[u] = f;
  }
  return d;
}
function Wd(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const ct = /* @__PURE__ */ new Map();
function Vd(e) {
  let t = !0;
  oe(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((y) => {
    for (const h of y) {
      const { borderBoxSize: b, target: w } = h;
      if (w === e.element) {
        if (t) {
          const S = pt({ group: e });
          if (S === 0)
            return;
          const v = Ge(e.id);
          if (!v)
            return;
          const g = En(e), I = v.defaultLayoutDeferred ? Zr(g) : v.layout, R = Hd({
            group: e,
            nextGroupSize: S,
            prevGroupSize: v.groupSize,
            prevLayout: I
          }), k = ot({
            layout: R,
            panelConstraints: g
          });
          if (!v.defaultLayoutDeferred && rt(v.layout, k) && Ud(
            v.derivedPanelConstraints,
            g
          ) && v.groupSize === S)
            return;
          He(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: g,
            groupSize: S,
            layout: k,
            separatorToPanels: v.separatorToPanels
          });
        }
      } else
        jd(e, w, b);
    }
  });
  a.observe(e.element), e.panels.forEach((y) => {
    oe(
      !r.has(y.id),
      `Panel ids must be unique; id "${y.id}" was used more than once`
    ), r.add(y.id), y.onResize && a.observe(y.element);
  });
  const s = pt({ group: e }), i = En(e), l = e.panels.map(({ id: y }) => y).join(",");
  let c = e.mutableState.defaultLayout;
  c && (Wd(e.panels, c) || (c = void 0));
  const d = e.mutableState.layouts[l] ?? c ?? Zr(i), f = ot({
    layout: d,
    panelConstraints: i
  }), u = e.element.ownerDocument;
  ct.set(
    u,
    (ct.get(u) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Wo(e).forEach((y) => {
    y.separator && m.set(y.separator, y.panels);
  }), He(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((y) => {
    oe(
      !o.has(y.id),
      `Separator ids must be unique; id "${y.id}" was used more than once`
    ), o.add(y.id), y.element.addEventListener("keydown", Wr);
  }), ct.get(u) === 1 && (u.addEventListener("contextmenu", Fr, !0), u.addEventListener("dblclick", Hr, !0), u.addEventListener("pointerdown", Vr, !0), u.addEventListener("pointerleave", Kr), u.addEventListener("pointermove", Jr), u.addEventListener("pointerout", qr), u.addEventListener("pointerup", Gr, !0)), function() {
    t = !1, ct.set(
      u,
      Math.max(0, (ct.get(u) ?? 0) - 1)
    ), _d(e), e.separators.forEach((y) => {
      y.element.removeEventListener("keydown", Wr);
    }), ct.get(u) || (u.removeEventListener(
      "contextmenu",
      Fr,
      !0
    ), u.removeEventListener(
      "dblclick",
      Hr,
      !0
    ), u.removeEventListener(
      "pointerdown",
      Vr,
      !0
    ), u.removeEventListener("pointerleave", Kr), u.removeEventListener("pointermove", Jr), u.removeEventListener("pointerout", qr), u.removeEventListener("pointerup", Gr, !0)), a.disconnect();
  };
}
function Kd() {
  const [e, t] = N({}), n = x(() => t({}), []);
  return [e, n];
}
function Hn(e) {
  const t = to();
  return `${e ?? t}`;
}
const it = typeof window < "u" ? ke : C;
function Et(e) {
  const t = A(e);
  return it(() => {
    t.current = e;
  }, [e]), x(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function Wn(...e) {
  return Et((t) => {
    e.forEach((n) => {
      if (n)
        switch (typeof n) {
          case "function": {
            n(t);
            break;
          }
          case "object": {
            n.current = t;
            break;
          }
        }
    });
  });
}
function Vn(e) {
  const t = A({ ...e });
  return it(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const na = Mn(null);
function Jd(e, t) {
  const n = A({
    getLayout: () => ({}),
    setLayout: Md
  });
  _n(t, () => n.current, []), it(() => {
    Object.assign(
      n.current,
      ea({ groupId: e })
    );
  });
}
function ra({
  children: e,
  className: t,
  defaultLayout: n,
  disableCursor: r,
  disabled: o,
  elementRef: a,
  groupRef: s,
  id: i,
  onLayoutChange: l,
  onLayoutChanged: c,
  orientation: d = "horizontal",
  resizeTargetMinimumSize: f = {
    coarse: 20,
    fine: 10
  },
  style: u,
  ...m
}) {
  const y = A({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = Et((E) => {
    rt(y.current.onLayoutChange, E) || (y.current.onLayoutChange = E, l == null || l(E));
  }), b = Et(
    (E, T) => {
      rt(y.current.onLayoutChanged, E) || (y.current.onLayoutChanged = E, c == null || c(E, { isUserInteraction: T }));
    }
  ), w = Hn(i), S = A(null), [v, g] = Kd(), I = A({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), R = Wn(S, a);
  Jd(w, s);
  const k = Et(
    (E, T) => {
      const P = nt(), M = $r(E), _ = Ge(E);
      if (_) {
        let j = !1;
        switch (P.state) {
          case "active": {
            j = P.hitRegions.some(
              (B) => B.group === M
            );
            break;
          }
        }
        return {
          flexGrow: _.layout[T] ?? 1,
          pointerEvents: j ? "none" : void 0
        };
      }
      if (n != null && n[T])
        return {
          flexGrow: n == null ? void 0 : n[T]
        };
    }
  ), O = Vn({
    defaultLayout: n,
    disableCursor: r
  }), $ = G(
    () => ({
      get disableCursor() {
        return !!O.disableCursor;
      },
      getPanelStyles: k,
      id: w,
      orientation: d,
      registerPanel: (E) => {
        const T = I.current;
        return T.panels = Pn(d, [
          ...T.panels,
          E
        ]), g(), () => {
          T.panels = T.panels.filter(
            (P) => P !== E
          ), g();
        };
      },
      registerSeparator: (E) => {
        const T = I.current;
        return T.separators = Pn(d, [
          ...T.separators,
          E
        ]), g(), () => {
          T.separators = T.separators.filter(
            (P) => P !== E
          ), g();
        };
      },
      updatePanelProps: (E, { disabled: T }) => {
        const P = I.current.panels.find(
          (j) => j.id === E
        );
        P && (P.panelConstraints.disabled = T);
        const M = $r(w), _ = Ge(w);
        M && _ && He(M, {
          ..._,
          derivedPanelConstraints: En(M)
        });
      },
      updateSeparatorProps: (E, {
        disabled: T,
        disableDoubleClick: P
      }) => {
        const M = I.current.separators.find(
          (_) => _.id === E
        );
        M && (M.disabled = T, M.disableDoubleClick = P);
      }
    }),
    [k, w, g, d, O]
  ), F = A(null);
  return it(() => {
    const E = S.current;
    if (E === null)
      return;
    const T = I.current;
    let P;
    if (O.defaultLayout !== void 0 && Object.keys(O.defaultLayout).length === T.panels.length) {
      P = {};
      for (const ae of T.panels) {
        const Y = O.defaultLayout[ae.id];
        Y !== void 0 && (P[ae.id] = Y);
      }
    }
    const M = {
      disabled: !!o,
      element: E,
      id: w,
      mutableState: {
        defaultLayout: P,
        disableCursor: !!O.disableCursor,
        expandedPanelSizes: I.current.lastExpandedPanelSizes,
        layouts: I.current.layouts
      },
      orientation: d,
      panels: T.panels,
      resizeTargetMinimumSize: T.resizeTargetMinimumSize,
      separators: T.separators
    };
    F.current = M;
    const _ = Vd(M), { defaultLayoutDeferred: j, derivedPanelConstraints: B, layout: H } = Ge(M.id, !0);
    !j && B.length > 0 && (h(H), b(H, !1));
    const X = jn(w, (ae) => {
      const { defaultLayoutDeferred: Y, derivedPanelConstraints: he, layout: fe } = ae.next;
      if (Y || he.length === 0)
        return;
      const me = M.panels.map(({ id: J }) => J).join(",");
      M.mutableState.layouts[me] = fe, he.forEach((J) => {
        if (J.collapsible) {
          const { layout: K } = ae.prev ?? {};
          if (K) {
            const we = ye(
              J.collapsedSize,
              fe[J.panelId]
            ), ce = ye(
              J.collapsedSize,
              K[J.panelId]
            );
            we && !ce && (M.mutableState.expandedPanelSizes[J.panelId] = K[J.panelId]);
          }
        }
      });
      const Le = nt().state !== "active";
      h(fe), Le && b(fe, ae.isUserInteraction);
    });
    return () => {
      F.current = null, _(), X();
    };
  }, [
    o,
    w,
    b,
    h,
    d,
    v,
    O
  ]), C(() => {
    const E = F.current;
    E && (E.mutableState.defaultLayout = n, E.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(na.Provider, { value: $, children: /* @__PURE__ */ p(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": w,
      id: w,
      ref: R,
      style: {
        height: "100%",
        width: "100%",
        overflow: "hidden",
        ...u,
        display: "flex",
        flexDirection: d === "horizontal" ? "row" : "column",
        flexWrap: "nowrap",
        // Inform the browser that the library is handling touch events for this element
        // but still allow users to scroll content within panels in the non-resizing direction
        // NOTE This is not an inherited style
        // See github.com/bvaughn/react-resizable-panels/issues/662
        touchAction: d === "horizontal" ? "pan-y" : "pan-x"
      },
      children: e
    }
  ) });
}
ra.displayName = "Group";
function Kn() {
  const e = An(na);
  return oe(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function qd(e, t) {
  const { id: n } = Kn(), r = A({
    collapse: dn,
    expand: dn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: dn
  });
  _n(t, () => r.current, []), it(() => {
    Object.assign(
      r.current,
      Qo({ groupId: n, panelId: e })
    );
  });
}
function Tn({
  children: e,
  className: t,
  collapsedSize: n = "0%",
  collapsible: r = !1,
  defaultSize: o,
  disabled: a,
  elementRef: s,
  groupResizeBehavior: i = "preserve-relative-size",
  id: l,
  maxSize: c = "100%",
  minSize: d = "0%",
  onResize: f,
  panelRef: u,
  style: m,
  ...y
}) {
  const h = !!l, b = Hn(l), w = Vn({
    disabled: a
  }), S = A(null), v = Wn(S, s), {
    getPanelStyles: g,
    id: I,
    orientation: R,
    registerPanel: k,
    updatePanelProps: O
  } = Kn(), $ = f !== null, F = Et(
    (M, _, j) => {
      f == null || f(M, l, j);
    }
  );
  it(() => {
    const M = S.current;
    if (M !== null) {
      const _ = {
        element: M,
        id: b,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: $ ? F : void 0,
        panelConstraints: {
          groupResizeBehavior: i,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: w.disabled,
          maxSize: c,
          minSize: d
        }
      };
      return k(_);
    }
  }, [
    i,
    n,
    r,
    o,
    $,
    b,
    h,
    c,
    d,
    F,
    k,
    w
  ]), C(() => {
    O(b, { disabled: a });
  }, [a, b, O]), qd(b, u);
  const E = () => {
    const M = g(I, b);
    if (M)
      return JSON.stringify(M);
  }, T = eo(
    (M) => jn(I, M),
    E,
    E
  );
  let P;
  return T ? P = JSON.parse(T) : o !== void 0 ? P = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : P = { flexGrow: 1 }, /* @__PURE__ */ p(
    "div",
    {
      ...y,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": b,
      id: b,
      ref: v,
      style: {
        ...Gd,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...P
      },
      children: /* @__PURE__ */ p(
        "div",
        {
          className: t,
          style: {
            maxHeight: "100%",
            maxWidth: "100%",
            flexGrow: 1,
            overflow: "auto",
            ...m,
            // Inform the browser that the library is handling touch events for this element
            // but still allow users to scroll content within panels in the non-resizing direction
            // NOTE This is not an inherited style
            // See github.com/bvaughn/react-resizable-panels/issues/662
            touchAction: R === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
Tn.displayName = "Panel";
const Gd = {
  minHeight: 0,
  maxHeight: "100%",
  height: "auto",
  minWidth: 0,
  maxWidth: "100%",
  width: "auto",
  border: "none",
  borderWidth: 0,
  padding: 0,
  margin: 0
};
function Zd({
  layout: e,
  panelConstraints: t,
  panelId: n,
  panelIndex: r
}) {
  let o, a;
  const s = e[n], i = t.find(
    (l) => l.panelId === n
  );
  if (i) {
    const l = i.maxSize, c = i.collapsible ? i.collapsedSize : i.minSize, d = [r, r + 1];
    a = ot({
      layout: Mt({
        delta: c - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: d,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = ot({
      layout: Mt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: d,
        prevLayout: e
      }),
      panelConstraints: t
    })[n];
  }
  return {
    valueControls: n,
    valueMax: o,
    valueMin: a,
    valueNow: s
  };
}
function oa({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const l = Hn(a), c = Vn({
    disabled: n,
    disableDoubleClick: r
  }), [d, f] = N({}), [u, m] = N("inactive"), [y, h] = N(!1), b = A(null), w = Wn(b, o), {
    disableCursor: S,
    id: v,
    orientation: g,
    registerSeparator: I,
    updateSeparatorProps: R
  } = Kn(), k = g === "horizontal" ? "vertical" : "horizontal";
  it(() => {
    const F = b.current;
    if (F !== null) {
      const E = {
        disabled: c.disabled,
        disableDoubleClick: c.disableDoubleClick,
        element: F,
        id: l
      }, T = I(E), P = kd(
        (_) => {
          m(
            _.next.state !== "inactive" && _.next.hitRegions.some(
              (j) => j.separator === E
            ) ? _.next.state : "inactive"
          );
        }
      ), M = jn(
        v,
        (_) => {
          const { derivedPanelConstraints: j, layout: B, separatorToPanels: H } = _.next, X = H.get(E);
          if (X) {
            const ae = X[0], Y = X.indexOf(ae);
            f(
              Zd({
                layout: B,
                panelConstraints: j,
                panelId: ae.id,
                panelIndex: Y
              })
            );
          }
        }
      );
      return () => {
        P(), M(), T();
      };
    }
  }, [v, l, I, c]), C(() => {
    R(l, { disabled: n, disableDoubleClick: r });
  }, [n, r, l, R]);
  let O;
  n && !S && (O = "not-allowed");
  let $;
  if (n)
    $ = "disabled";
  else
    switch (u) {
      case "active": {
        $ = "active";
        break;
      }
      default:
        y ? $ = "focus" : $ = u;
    }
  return /* @__PURE__ */ p(
    "div",
    {
      ...i,
      "aria-controls": d.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": k,
      "aria-valuemax": d.valueMax,
      "aria-valuemin": d.valueMin,
      "aria-valuenow": d.valueNow,
      children: e,
      className: t,
      "data-separator": $,
      "data-testid": l,
      id: l,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: w,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: O,
        ...s,
        flexGrow: 0,
        flexShrink: 0,
        // Inform the browser that the library is handling touch events for this element
        // See github.com/bvaughn/react-resizable-panels/issues/662
        touchAction: "none"
      },
      tabIndex: n ? void 0 : 0
    }
  );
}
oa.displayName = "Separator";
const Jn = 30, qn = 65, At = 50, Yd = 100 - qn, Xd = 100 - Jn;
function Qd(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(qn, Math.max(Jn, t)) : At;
}
function Gn(e) {
  return 100 - e;
}
function dt(e) {
  return `${e}%`;
}
const Zn = "reader-document", _t = "reader-assistant", aa = "retainpdf.reader.ai-split-layout.v1", eu = {
  [Zn]: Gn(At),
  [_t]: At
};
function Yn(e) {
  const t = Qd(e == null ? void 0 : e[_t]);
  return {
    [Zn]: Gn(t),
    [_t]: t
  };
}
function tu() {
  try {
    const e = JSON.parse(localStorage.getItem(aa) || "null");
    return Yn(e);
  } catch {
    return eu;
  }
}
function nu(e) {
  try {
    localStorage.setItem(aa, JSON.stringify(Yn(e)));
  } catch {
  }
}
function un(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Yn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[_t]}vw`
  );
}
function ru() {
  const e = A(null), [t] = N(tu);
  ke(() => {
    const o = e.current;
    return un(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = x((o) => {
    un(e.current, o);
  }, []), r = x((o, a) => {
    un(e.current, o), a.isUserInteraction && nu(o);
  }, []);
  return /* @__PURE__ */ L(
    ra,
    {
      id: "reader-ai-split",
      className: "reader-ai-split-resizer",
      elementRef: e,
      orientation: "horizontal",
      defaultLayout: t,
      onLayoutChange: n,
      onLayoutChanged: r,
      resizeTargetMinimumSize: { fine: 12, coarse: 28 },
      children: [
        /* @__PURE__ */ p(
          Tn,
          {
            id: Zn,
            defaultSize: dt(Gn(At)),
            minSize: dt(Yd),
            maxSize: dt(Xd)
          }
        ),
        /* @__PURE__ */ p(
          oa,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          Tn,
          {
            id: _t,
            defaultSize: dt(At),
            minSize: dt(Jn),
            maxSize: dt(qn)
          }
        )
      ]
    }
  );
}
function ou({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = N(!1);
  if (C(() => {
    !e && !t && o(!1);
  }, [e, t]), r || !e && !t)
    return null;
  const a = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ L("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ L("span", { className: "reader-error-notice-text", children: [
      a.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    n ? /* @__PURE__ */ p(ne, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: "reader-error-notice-dismiss",
        "aria-label": "关闭提示",
        onClick: () => o(!0),
        children: "×"
      }
    )
  ] });
}
function au({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(ou, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ L(at, { children: [
    e ? /* @__PURE__ */ p("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ L("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ p(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ L("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ p("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ p(ne, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function su(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function iu() {
  const [e, t] = N(!1), n = to(), r = A(null);
  return C(() => {
    if (!e) return;
    const o = (s) => {
      const i = r.current;
      i && s.target instanceof Node && !i.contains(s.target) && t(!1);
    }, a = (s) => {
      s.key === "Escape" && (s.preventDefault(), t(!1));
    };
    return document.addEventListener("mousedown", o), window.addEventListener("keydown", a), () => {
      document.removeEventListener("mousedown", o), window.removeEventListener("keydown", a);
    };
  }, [e]), C(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || su(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((i) => !i);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ L("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ p(xa, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ L(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ L("div", { className: "reader-react-shortcuts-head", children: [
            /* @__PURE__ */ p("strong", { children: "快捷键" }),
            /* @__PURE__ */ p(
              "button",
              {
                type: "button",
                className: "reader-react-shortcuts-close reader-floating-close",
                "aria-label": "关闭",
                onClick: () => t(!1),
                children: "×"
              }
            )
          ] }),
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: rl.map((o) => /* @__PURE__ */ L("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: o.title }),
            /* @__PURE__ */ p("ul", { children: o.items.map((a) => /* @__PURE__ */ L("li", { children: [
              /* @__PURE__ */ p("kbd", { children: a.keys }),
              /* @__PURE__ */ p("span", { children: a.desc })
            ] }, `${o.title}-${a.keys}`)) })
          ] }, o.title)) }),
          /* @__PURE__ */ p("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const lu = ["source", "sideBySide", "translated"], cu = { source: "", translated: "", sideBySide: "" };
function du(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = Ht(e.sourceUrl), n = Ht(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return ls({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function uu(e) {
  const [t, n] = N(() => /* @__PURE__ */ new Set()), r = G(
    () => e ? du(e) : cu,
    [e]
  ), o = G(
    () => lu.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = x(async (s) => {
    if (!e) return;
    const i = Ht(r[s]);
    if (!(!i || t.has(s)))
      try {
        const l = e.jobId ? is(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await cs(
          e.fetchProtected,
          i,
          l,
          l,
          null,
          (c) => n((d) => {
            const f = new Set(d);
            return c ? f.add(s) : f.delete(s), f;
          })
        );
      } catch (l) {
        const c = l instanceof Error ? l.message : "下载失败";
        ds(c), n((d) => {
          const f = new Set(d);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const fu = {
  source: ao,
  sideBySide: so,
  translated: io
}, mu = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function hu(e) {
  const t = We(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = uu(n), i = A(null);
  return C(() => {
    const l = () => {
      var f;
      (f = i.current) != null && f.open && (i.current.open = !1);
    }, c = (f) => {
      i.current && !i.current.contains(f.target) && l();
    }, d = (f) => {
      f.key === "Escape" && l();
    };
    return document.addEventListener("pointerdown", c), document.addEventListener("keydown", d), () => {
      document.removeEventListener("pointerdown", c), document.removeEventListener("keydown", d);
    };
  }, []), /* @__PURE__ */ L("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ L("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(za, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(oo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((l) => {
      const c = ma[l], d = Ht(r[l]), f = a.has(l), u = !!d && !f, m = u ? "" : ha(l, r), y = fu[l];
      return /* @__PURE__ */ L(
        "button",
        {
          type: "button",
          id: `reader-download-${l}`,
          className: `reader-download-action${f ? " is-busy" : ""}`,
          disabled: !u,
          "aria-label": u ? `下载${c.label}` : m,
          onClick: () => {
            i.current && (i.current.open = !1), s(l);
          },
          children: [
            /* @__PURE__ */ p(y, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ L("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ L("span", { className: "reader-download-action-label", children: [
                mu[l],
                " PDF"
              ] }),
              m ? /* @__PURE__ */ p("span", { className: "reader-download-action-reason", children: m }) : null
            ] })
          ]
        },
        l
      );
    }) })
  ] });
}
const pu = "retainpdf:reader:bookmarks:v1:", gu = 200;
function Xn() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function sa(e) {
  const t = `${e || ""}`.trim();
  return t ? `${pu}${t}` : "";
}
function bu(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Zt(e, t = Xn()) {
  const n = sa(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = bu(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function kn(e, t, n) {
  const r = sa(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, gu);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function yu(e, t, n = "", { storage: r = Xn(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Zt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? kn(e, a.filter((i) => i.page !== s), r) : kn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function vu(e, t, n = Xn()) {
  return kn(e, Zt(e, n).filter((r) => r.page !== t), n);
}
function wu(e, t) {
  var r, o, a, s;
  let n = null;
  for (const i of e || []) {
    if (`${(i == null ? void 0 : i.regionType) || ""}` != "heading") continue;
    const l = Number(((r = i.source) == null ? void 0 : r.page) ?? ((o = i.translated) == null ? void 0 : o.page));
    if (!Number.isFinite(l) || l > t) continue;
    const c = `${((a = i.translated) == null ? void 0 : a.text) || i.markdown || ((s = i.source) == null ? void 0 : s.text) || ""}`.replace(/\s+/g, " ").trim();
    if (!c) continue;
    const d = Number(i.readingOrder) || 0;
    (!n || l > n.page || l === n.page && d >= n.order) && (n = { page: l, order: d, text: c });
  }
  return n ? n.text.slice(0, 60) : "";
}
function Su({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function Iu({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = N(() => Zt(e)), [i, l] = N(!1), c = A(null);
  if (C(() => {
    s(Zt(e)), l(!1);
  }, [e]), C(() => {
    if (!i) return;
    const u = (y) => {
      c.current && !c.current.contains(y.target) && l(!1);
    }, m = (y) => {
      y.key === "Escape" && l(!1);
    };
    return document.addEventListener("pointerdown", u), document.addEventListener("keydown", m), () => {
      document.removeEventListener("pointerdown", u), document.removeEventListener("keydown", m);
    };
  }, [i]), !e || n <= 0) return null;
  const d = Math.min(Math.max(t, 1), n), f = a.some((u) => u.page === d);
  return /* @__PURE__ */ L("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: c, children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${f ? " is-marked" : ""}`,
        "aria-pressed": f,
        "aria-label": f ? `取消第 ${d} 页的书签` : `给第 ${d} 页加书签`,
        title: f ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(yu(e, d, wu(r, d))),
        children: /* @__PURE__ */ p(Su, { filled: f })
      }
    ),
    a.length ? /* @__PURE__ */ L(
      "button",
      {
        type: "button",
        className: "reader-react-hud-btn reader-bookmark-list-btn",
        "aria-expanded": i,
        "aria-haspopup": "true",
        "aria-label": `书签列表，共 ${a.length} 个`,
        title: "书签列表",
        onClick: () => l((u) => !u),
        children: [
          /* @__PURE__ */ p(Oa, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { className: "reader-bookmark-count", children: a.length })
        ]
      }
    ) : null,
    i && a.length ? /* @__PURE__ */ p("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ p("ol", { className: "reader-bookmark-list", children: a.map((u) => /* @__PURE__ */ L("li", { className: u.page === d ? "is-current" : "", children: [
      /* @__PURE__ */ L(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(u.page, n)), l(!1);
          },
          children: [
            /* @__PURE__ */ L("span", { className: "reader-bookmark-page", children: [
              "第 ",
              u.page,
              " 页"
            ] }),
            u.label ? /* @__PURE__ */ p("span", { className: "reader-bookmark-label", children: u.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ p(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${u.page} 页的书签`,
          onClick: () => s(vu(e, u.page)),
          children: "×"
        }
      )
    ] }, u.page)) }) }) : null
  ] });
}
function Ru(e) {
  const [t, n] = N([]);
  return C(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = Xe().loadIssues;
    } catch {
      o = void 0;
    }
    if (!r || !o) return;
    let a = !1;
    return o(r).then((s) => {
      a || n(Array.isArray(s) ? s : []);
    }).catch(() => {
    }), () => {
      a = !0;
    };
  }, [e]), t;
}
function Eu(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Pu = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, Tu = ["failed", "content", "layout"];
function ku(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Nu({ jobId: e, currentPage: t }) {
  var f;
  const n = Ru(e), r = (f = We()) == null ? void 0 : f.jumpToBlock, [o, a] = N(!1), [s, i] = N(-1), l = A(null);
  C(() => i(-1), [n]);
  const c = (u) => {
    const m = n[u];
    !m || !r || (i(u), r(m.readerItemId));
  }, d = A({ issues: n, last: s, currentPage: t, goTo: c });
  return d.current = { issues: n, last: s, currentPage: t, goTo: c }, C(() => {
    const u = (m) => {
      if (m.key.toLowerCase() !== "n" || m.metaKey || m.ctrlKey || m.altKey || ku(m.target)) return;
      const { issues: y, last: h, currentPage: b, goTo: w } = d.current, S = Eu(y, h, b, m.shiftKey);
      S < 0 || (m.preventDefault(), w(S));
    };
    return document.addEventListener("keydown", u), () => document.removeEventListener("keydown", u);
  }, []), C(() => {
    if (!o) return;
    const u = (m) => {
      var y;
      (y = l.current) != null && y.contains(m.target) || a(!1);
    };
    return document.addEventListener("pointerdown", u, !0), () => document.removeEventListener("pointerdown", u, !0);
  }, [o]), n.length ? /* @__PURE__ */ L("div", { className: "reader-react-hud-group reader-issues", ref: l, "aria-label": "待处理", children: [
    /* @__PURE__ */ L(
      ne,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((u) => !u),
        children: [
          /* @__PURE__ */ p($a, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ L("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      Tu.map((u) => {
        const m = n.map((y, h) => ({ issue: y, index: h })).filter(({ issue: y }) => y.kind === u);
        return m.length ? /* @__PURE__ */ L("section", { className: "reader-issues-group", "data-issue-kind": u, children: [
          /* @__PURE__ */ L("h4", { children: [
            Pu[u],
            /* @__PURE__ */ p("span", { children: m.length })
          ] }),
          /* @__PURE__ */ p("ol", { children: m.map(({ issue: y, index: h }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
            ne,
            {
              className: "reader-issues-item",
              "aria-current": h === s ? "true" : void 0,
              onClick: () => {
                c(h), a(!1);
              },
              children: [
                /* @__PURE__ */ p("span", { className: "reader-issues-title", children: y.title }),
                /* @__PURE__ */ L("span", { className: "reader-issues-page", children: [
                  "第 ",
                  y.page,
                  " 页"
                ] }),
                y.detail ? /* @__PURE__ */ p("span", { className: "reader-issues-detail", children: y.detail }) : null
              ]
            }
          ) }, `${y.kind}:${y.readerItemId}`)) })
        ] }, u) : null;
      })
    ] }) : null
  ] }) : null;
}
const Mu = 48, Au = 96, _u = 700;
function Lu(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= Mu, downSoFar: r };
}
function Cu(e) {
  const [t, n] = N(!1), r = A(0);
  return C(() => {
    const o = /* @__PURE__ */ new WeakMap();
    let a = 0;
    const s = () => {
      a = Date.now();
    }, i = /* @__PURE__ */ new WeakMap(), l = () => {
      const u = e.current;
      return !!(u && (u.querySelector(":focus-visible") || u.querySelector("[aria-expanded='true']")));
    }, c = (u) => {
      const m = u.target;
      if (!(m instanceof Element) || (i.has(m) || i.set(m, !!m.querySelector(`[${Oe}]`)), !i.get(m))) return;
      const y = m.scrollTop, h = o.get(m);
      if (o.set(m, y), h === void 0 || Date.now() - a > _u) return;
      const b = Lu(!1, r.current, y - h);
      r.current = b.downSoFar, y - h < -4 ? n(!1) : b.hidden && !l() && n(!0);
    }, d = (u) => {
      u.clientY >= window.innerHeight - Au && (r.current = 0, n(!1));
    }, f = () => {
      l() && n(!1);
    };
    document.addEventListener("scroll", c, { capture: !0, passive: !0 }), window.addEventListener("pointermove", d, { passive: !0 }), document.addEventListener("focusin", f);
    for (const u of ["wheel", "touchmove", "keydown"]) window.addEventListener(u, s, { passive: !0, capture: !0 });
    return () => {
      for (const u of ["wheel", "touchmove", "keydown"]) window.removeEventListener(u, s, { capture: !0 });
      document.removeEventListener("scroll", c, { capture: !0 }), window.removeEventListener("pointermove", d), document.removeEventListener("focusin", f);
    };
  }, [e]), t;
}
function Du(e) {
  const t = We(), n = $o(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Ct, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, l = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, c = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), d = ei(a), f = a > po + 1e-3, u = a < qt - 1e-3, m = ut(r, et()), y = m >= qt ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = A(null), b = Cu(h), [w, S] = N(!1), [v, g] = N(`${i}`);
  C(() => {
    w || g(`${Math.min(Math.max(i, 1), Math.max(l, 1))}`);
  }, [i, l, w]);
  const I = () => {
    if (S(!1), !c || l <= 0)
      return;
    const R = Number(`${v}`.trim());
    c(Gt(R, l));
  };
  return /* @__PURE__ */ L("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": b ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: w ? /* @__PURE__ */ L(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (R) => {
          R.preventDefault(), I();
        },
        children: [
          /* @__PURE__ */ p(
            "input",
            {
              className: "reader-react-hud-page-input",
              type: "text",
              inputMode: "numeric",
              pattern: "[0-9]*",
              "aria-label": "跳转到页码",
              value: v,
              autoFocus: !0,
              onChange: (R) => g(R.target.value.replace(/[^\d]/g, "")),
              onBlur: I,
              onKeyDown: (R) => {
                R.key === "Escape" && (R.preventDefault(), S(!1), g(`${i}`));
              }
            }
          ),
          /* @__PURE__ */ L("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            l || "—"
          ] })
        ]
      }
    ) : /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: "reader-react-hud-page reader-react-hud-page-btn",
        "aria-label": l > 0 ? `跳转页码，当前第 ${i} 页，共 ${l} 页` : "页码",
        title: l > 0 ? "点击输入页码跳转" : void 0,
        disabled: !c || l <= 0,
        onClick: () => {
          !c || l <= 0 || (g(`${i}`), S(!0));
        },
        children: l > 0 ? `${Math.min(i, l)} / ${l}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ p(
      Iu,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: l,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: c
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(Nu, { jobId: e.issuesJobId, currentPage: i }) : null,
    /* @__PURE__ */ L("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ p(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !f,
          onClick: () => s(kt(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ L(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `${d}%，点击${y}`,
          title: y,
          onClick: () => s(m),
          children: [
            d,
            "%"
          ]
        }
      ),
      /* @__PURE__ */ p(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "放大",
          disabled: !u,
          onClick: () => s(kt(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(iu, {}) })
  ] });
}
function Yr(e) {
  var t, n;
  return vo(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function xu(e) {
  const [t, n] = N(() => ({
    scope: e,
    panel: Yr(ze(e))
  }));
  C(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Yr(ze(e))
    });
  }, [e]), C(() => {
    t.scope === e && Qt(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = x((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const Nn = "download-toast";
function zu({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ L("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ L("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ p("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ p("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ p("div", { className: "download-toast-track", children: /* @__PURE__ */ p("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ p("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function Ou(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    hn.dismiss(Nn);
    return;
  }
  hn.custom(
    () => /* @__PURE__ */ p(zu, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Nn, duration: 1 / 0 }
  );
}
function $u() {
  const e = x((t) => {
    t && (t.setState = Ou, t.hide = () => hn.dismiss(Nn));
  }, []);
  return /* @__PURE__ */ L(at, { children: [
    /* @__PURE__ */ p(Pa, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function Fu(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : go(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Bu(e, t) {
  return t === null || e !== t;
}
function ju(e) {
  const t = A(!1);
  return e && (t.current = !0), t.current;
}
function Uu(e, t) {
  const n = e === t;
  return { open: n, mounted: ju(n) };
}
const Xr = { itemId: null, origin: null };
function Hu() {
  let e = Xr;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Xr : { itemId: n, origin: r };
        for (const o of t) o();
      }
    },
    subscribe(n) {
      return t.add(n), () => {
        t.delete(n);
      };
    }
  };
}
const Wu = [];
function Vu({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ L("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ p(ne, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ p(Fa, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function Ku({ open: e, onToggle: t }) {
  return /* @__PURE__ */ p(
    ne,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ p(Ba, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function Ju({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0
}) {
  var g, I;
  const l = ((g = We()) == null ? void 0 : g.regions) ?? Wu, c = ((I = $o()) == null ? void 0 : I.currentPage) ?? 1, d = G(() => _c(l), [l]), f = Lc(d, c), u = G(() => xc(l, s), [l, s]), [m, y] = N(-1);
  C(() => y(-1), [s]);
  const h = A(null), b = A(null), w = A(n);
  w.current = n, C(() => {
    const R = (O) => {
      var F, E;
      const $ = O.target;
      !$ || (F = b.current) != null && F.contains($) || (E = $.closest) != null && E.call($, ".reader-finder-toggles, [data-finder-toggle]") || w.current();
    }, k = (O) => {
      O.key === "Escape" && w.current();
    };
    return document.addEventListener("pointerdown", R, !0), document.addEventListener("keydown", k), () => {
      document.removeEventListener("pointerdown", R, !0), document.removeEventListener("keydown", k);
    };
  }, []);
  const S = A(null);
  C(() => {
    var R, k, O;
    e === "search" ? (R = h.current) == null || R.focus() : (O = (k = S.current) == null ? void 0 : k.querySelector('[aria-current="location"]')) == null || O.scrollIntoView({ block: "center" });
  }, [e, i]), C(() => {
    var R, k;
    e === "search" && m >= 0 && ((k = (R = S.current) == null ? void 0 : R.querySelector('[aria-current="true"]')) == null || k.scrollIntoView({ block: "nearest" }));
  }, [e, m]);
  const v = (R) => {
    const k = u[R];
    k && (y(R), r(k.itemId));
  };
  return /* @__PURE__ */ L("aside", { ref: b, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ L("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ p(ne, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(ne, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(ne, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(bt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: S, className: "reader-finder-list", children: d.map((R, k) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
      ne,
      {
        className: "reader-finder-entry",
        "data-level": R.level,
        "aria-current": k === f ? "location" : void 0,
        onClick: () => r(R.itemId),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: R.text }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: R.page })
        ]
      }
    ) }, R.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: l.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ L(at, { children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          lo,
          {
            ref: h,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (R) => a(R.target.value),
            onKeyDown: (R) => {
              R.key === "Enter" ? (R.preventDefault(), v(Oc(m, u.length, R.shiftKey))) : R.key === "Escape" && (R.preventDefault(), n()), R.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: u.length === 0 ? "没有找到" : `${m >= 0 ? `第 ${m + 1} / ` : ""}${u.length >= 200 ? "200+ 处，只列前 200 处" : `${u.length} 处`}${m < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: u.map((R, k) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(ne, { className: "reader-finder-entry is-hit", "aria-current": k === m ? "true" : void 0, onClick: () => v(k), children: [
        /* @__PURE__ */ L("span", { className: "reader-finder-entry-text", children: [
          R.snippet.slice(0, R.at),
          /* @__PURE__ */ p("mark", { children: R.snippet.slice(R.at, R.at + R.length) }),
          R.snippet.slice(R.at + R.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: R.page })
      ] }) }, R.itemId)) })
    ] })
  ] });
}
function qu({ active: e, compare: t, ink: n }) {
  const [r, o] = N(!1), [a, s] = N(!1), i = A(null);
  C(() => {
    if (!r && !a) return;
    const c = () => {
      o(!1), s(!1);
    }, d = (u) => {
      var m;
      (m = i.current) != null && m.contains(u.target) || c();
    }, f = (u) => {
      u.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", d, !0), document.addEventListener("keydown", f), () => {
      document.removeEventListener("pointerdown", d, !0), document.removeEventListener("keydown", f);
    };
  }, [r, a]);
  const l = !!(t.compared || t.loading);
  return /* @__PURE__ */ L("div", { className: "reader-toolball", ref: i, "data-open": r ? "true" : void 0, children: [
    a ? /* @__PURE__ */ p(td, { compare: t, onDone: () => {
      s(!1), o(!1);
    } }) : null,
    r ? /* @__PURE__ */ L("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: [
      n ? /* @__PURE__ */ p(
        ne,
        {
          className: "reader-toolball-item",
          "aria-label": "画笔",
          title: "画笔（P；书页上右键也能选笔和颜色）",
          "aria-pressed": !!n.tool,
          "data-toolball-item": "ink",
          onClick: () => {
            n.setTool(n.tool ? null : "pen"), o(!1);
          },
          children: /* @__PURE__ */ p(Cn, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ p(gd, { active: e }),
      t.available ? /* @__PURE__ */ p(
        ne,
        {
          className: "reader-toolball-item",
          "aria-label": "对比版本",
          title: "对比版本：左边换成这本书的另一份译文",
          "aria-pressed": l || a,
          "data-toolball-item": "compare",
          onClick: () => s((c) => !c),
          children: /* @__PURE__ */ p(ja, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null
    ] }) : null,
    /* @__PURE__ */ p(
      ne,
      {
        className: "reader-toolball-ball",
        "aria-label": r ? "收起工具" : "工具：画笔、Markdown、对比版本",
        title: r ? "收起" : "工具",
        "aria-expanded": r,
        "data-active": e || l ? "true" : void 0,
        onClick: () => {
          o((c) => !c), s(!1);
        },
        children: r ? /* @__PURE__ */ p(bt, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p(Ua, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const Gu = [
  { tool: "pen", label: "画笔", Icon: Cn },
  { tool: "highlighter", label: "荧光笔", Icon: Ha },
  { tool: "eraser", label: "橡皮", Icon: Wa }
];
function ia(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function la({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ L(at, { children: [
    Gu.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
      ne,
      {
        className: "reader-ink-tool",
        "aria-label": a,
        title: a,
        "aria-pressed": e.tool === o,
        "data-ink-tool": o,
        onClick: () => {
          e.setTool(e.tool === o ? null : o), r();
        },
        children: /* @__PURE__ */ p(s, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      },
      o
    )),
    /* @__PURE__ */ p("span", { className: "reader-ink-sep", "aria-hidden": !0 }),
    Co.map((o) => /* @__PURE__ */ p(
      ne,
      {
        className: "reader-ink-color",
        "aria-label": `${o.label}色`,
        title: `${o.label}色`,
        "aria-pressed": e.color === o.key,
        "data-ink-color": o.key,
        style: { color: `var(--${o.key})` },
        onClick: () => {
          e.setColor(o.key), (!e.tool || e.tool === "eraser") && e.setTool("pen"), r();
        },
        children: /* @__PURE__ */ p("span", { "aria-hidden": !0 })
      },
      o.key
    )),
    /* @__PURE__ */ p("span", { className: "reader-ink-sep", "aria-hidden": !0 }),
    /* @__PURE__ */ p(ne, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(Va, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      ne,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(Ka, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ p(
      ne,
      {
        className: "reader-ink-tool",
        "aria-label": "退出画笔",
        title: "退出画笔（Esc）",
        "data-ink-exit": "true",
        onClick: () => {
          e.setTool(null), r();
        },
        children: /* @__PURE__ */ p(bt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function Zu({ ink: e, menu: t, onClose: n }) {
  const r = A(null);
  if (C(() => {
    if (!t) return;
    const i = (c) => {
      var d;
      (d = r.current) != null && d.contains(c.target) || n();
    }, l = (c) => {
      c.key === "Escape" && n();
    };
    return document.addEventListener("pointerdown", i, !0), document.addEventListener("keydown", l), () => {
      document.removeEventListener("pointerdown", i, !0), document.removeEventListener("keydown", l);
    };
  }, [t, n]), !t) return null;
  const o = 380, a = Math.max(8, Math.min(t.x, (globalThis.innerWidth || o) - o - 8)), s = Math.max(68, Math.min(t.y, (globalThis.innerHeight || 600) - 60));
  return /* @__PURE__ */ p("div", { ref: r, className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", style: { left: a, top: s }, "data-ink-menu": "true", children: /* @__PURE__ */ p(la, { ink: e, page: t.page, onPick: n }) });
}
function Yu({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(la, { ink: e }) }) : null;
}
function Xu(e) {
  var r;
  if (e.shiftKey || ia(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${mo}`))) return null;
  const n = Number((r = t.closest(`[${Oe}]`)) == null ? void 0 : r.getAttribute(Oe)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Qu(e) {
  const t = A(e);
  t.current = e, C(() => {
    const n = (r) => {
      if (ia(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
function fn() {
  try {
    return Xe().translationVersions ?? null;
  } catch {
    return null;
  }
}
function ef(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function tf(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function nf(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function rf({ documentId: e, jobId: t }) {
  const [n, r] = N([]), [o, a] = N(null), [s, i] = N(null), [l, c] = N(""), [d, f] = N(""), u = A(0);
  C(() => {
    r([]), i(null), f("");
    const b = fn();
    if (!b || !e) return;
    let w = !1;
    return b.list(e).then((S) => {
      w || (r(S.versions), a(S.currentVersionId));
    }).catch(() => {
    }), () => {
      w = !0;
    };
  }, [e, t]);
  const m = x((b) => {
    const w = fn(), S = n.find((g) => g.versionId === b);
    if (!w || !S || !e) return;
    const v = ++u.current;
    c(b), f(""), (async () => {
      const g = Xe(), I = await w.resolveJob(e, b);
      if (!I) throw new Error("这一份还没有能读的译文。");
      const R = await g.loadReaderPayload(I, { includeOptionalArtifacts: !0 }), k = g.resolveReaderTranslatedPdfUrl(R.jobPayload, R.manifestPayload);
      if (!k) throw new Error("这一份没有译文 PDF。");
      return { versionId: b, name: S.name, jobId: I, url: k, regions: ef(no(R.regionsPayload)) };
    })().then((g) => {
      v === u.current && i(g);
    }).catch((g) => {
      v === u.current && f((g == null ? void 0 : g.message) || "这一份打不开。");
    }).finally(() => {
      v === u.current && c("");
    });
  }, [e, n]), y = x(() => {
    u.current += 1, i(null), c(""), f("");
  }, []), h = x(async () => {
    var S, v;
    const b = fn();
    if (!b || !s || !e) return;
    try {
      await b.select(e, s.versionId);
    } catch (g) {
      f((g == null ? void 0 : g.message) || "换不过去，请稍后再试。");
      return;
    }
    const w = (S = globalThis.location) == null ? void 0 : S.href;
    w && ((v = globalThis.history) == null || v.replaceState(globalThis.history.state, "", nf(w, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: tf(n, t, o),
    compared: s,
    loading: l,
    error: d,
    choose: m,
    clear: y,
    adopt: h
  };
}
const of = "reader-finder-input";
function af(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function sf(e, t = typeof window > "u" ? null : window) {
  C(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!af(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(of) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function lf() {
  try {
    return Xe().translationEdit ?? null;
  } catch {
    return null;
  }
}
const cf = "这本书正在处理（翻译或排版），处理完才能改。", df = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function uf({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = lf(), s = `${e || ""}`.trim(), i = !!(a && s && r), l = bl(s), c = !t || Pt(t), d = Rl(n), [f, u] = N(""), [m, y] = N(null), [h, b] = N(() => /* @__PURE__ */ new Map()), [w, S] = N(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [v, g] = N(() => /* @__PURE__ */ new Map()), [I, R] = N({ phase: "idle" }), k = A({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  C(() => {
    y(null), k.drafts.clear(), k.generation.current = null, g(/* @__PURE__ */ new Map()), R({ phase: "idle" });
  }, [s]), C(() => {
    if (u(""), !i || l || !a) return;
    let _ = !1;
    return a.resolveOwnerJobId(s).then((j) => {
      _ || u(`${j || s}`.trim() || s);
    }).catch(() => {
      _ || u(s);
    }), () => {
      _ = !0;
    };
  }, [i, l, a, s]), C(() => {
    if (b(/* @__PURE__ */ new Map()), !a || !f || !d || !c) return;
    let _ = !1;
    return a.fetchRevisions(f).then((j) => {
      _ || b(El(j, d));
    }).catch(() => {
    }), () => {
      _ = !0;
    };
  }, [a, f, d, c]);
  const O = I.phase === "running" && I.seenActive;
  C(() => {
    if (I.phase === "running") {
      if (!c) {
        O || R({ phase: "running", seenActive: !0 });
        return;
      }
      O && R(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [I.phase, O, c, t]);
  const $ = G(() => {
    const _ = new Map(h);
    if (w.renderedAt === d)
      for (const [j, B] of w.edits) _.set(j, B);
    return _;
  }, [h, w, d]), F = x((_) => {
    const j = `${_ || ""}`.trim();
    j && y({ itemId: j, page: yl(j) });
  }, []), E = x(() => y(null), []), T = x((_, j) => {
    S((B) => {
      const H = new Map(B.renderedAt === d ? B.edits : []);
      return H.set(_, j), { renderedAt: d, edits: H };
    }), g((B) => new Map(B).set(_, (B.get(_) || 0) + 1));
  }, [d]), P = x(async () => {
    if (!(!a || !s || I.phase === "submitting" || I.phase === "running")) {
      R({ phase: "submitting" });
      try {
        await a.rerender(s), R({ phase: "running", seenActive: !1 }), await o();
      } catch (_) {
        R({ phase: "failed", message: (_ == null ? void 0 : _.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, I.phase, o]), M = l ? df : !c || I.phase === "running" || I.phase === "submitting" ? cf : "";
  return G(() => ({
    available: i,
    blockedReason: M,
    port: a,
    ownerJobId: f,
    target: m,
    select: F,
    close: E,
    memory: k,
    pendingEdits: $,
    savedCounts: v,
    markSaved: T,
    rerender: I,
    startRerender: P
  }), [i, M, a, f, m, F, E, k, $, v, T, I, P]);
}
function ff(e, t) {
  C(() => {
    if (!e) return;
    const n = (r) => {
      var s;
      if (r.key !== "e" && r.key !== "E" || r.metaKey || r.ctrlKey || r.altKey || r.repeat) return;
      const o = r.target;
      if ((s = o == null ? void 0 : o.closest) != null && s.call(o, "input, textarea, select, [contenteditable='true']")) return;
      const a = t.get().itemId;
      a && (r.preventDefault(), e(a));
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, [e, t]);
}
function mf({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ L("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ p("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ p(
      ne,
      {
        className: "reader-pending-edits-act",
        size: "sm",
        variant: "primary",
        "data-block-edit-action": "rerender",
        onClick: () => {
          e.startRerender();
        },
        children: "重新排版"
      }
    ) : null
  ] });
}
const hf = da(() => import("./ReaderMarkdownPanel-D4fYJMbt.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function pf(e) {
  const t = e.sourceOnly || !e.translatedUrl, n = !!(e.overlayContentAvailable && e.liveTranslationVisible && !e.assistantOpen), o = e.assistantOpen && e.mode === "compare" ? "source" : e.mode, a = !t && (o === "translated" || o === "compare");
  return {
    kind: n ? "live-overlay" : o === "compare" ? "final-compare" : o === "translated" ? "translated-only" : "source-only",
    visibleMode: o,
    compareMode: o === "compare" && a,
    showSource: n || o !== "translated" || !a,
    showTranslated: a,
    overlayOnSource: n,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: t
  };
}
function gf(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function bf() {
  var Me;
  const e = tl(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = xu(e.viewStateKey), s = a.panel, i = a.setPanel, [l, c] = N(!1), d = A(null), f = A(null), u = s !== null, m = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, y = pf({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: m,
    liveTranslationVisible: l,
    assistantOpen: u
  }), h = Ui({
    hasOverlayContent: m,
    connection: e.liveTranslation.connection,
    showSource: y.showSource,
    liveTranslationVisible: l,
    assistantOpen: u
  }), b = y.sourceViewOnly, w = y.visibleMode;
  C(() => {
    c(!1);
  }, [e.viewStateKey]), C(() => {
    e.session.jobTerminal && c(!1);
  }, [e.session.jobTerminal]);
  const S = A(null);
  C(() => {
    S.current !== e.viewStateKey && Vi({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: b,
      jobTerminal: e.session.jobTerminal
    }) && (S.current = e.viewStateKey, c(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, b]), C(() => {
    if (!(t.loading || t.failed)) {
      if (d.current !== e.viewStateKey) {
        d.current = e.viewStateKey;
        const U = ze(e.viewStateKey), re = Fu({
          savedMode: U == null ? void 0 : U.mode,
          sourceViewOnly: b,
          viewportWidth: et()
        });
        f.current = re.auto ? re.mode : null, re.mode && re.mode !== e.mode && e.setModeKeepingPage(re.mode);
        return;
      }
      Bu(e.mode, f.current) && (f.current = null, Qt(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, b]);
  const v = s || (e.mode === "compare" ? "compare" : "reading"), g = Uu(s, "markdown");
  ll({
    mode: w,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const I = x(() => {
    i(null);
  }, []), R = Hi(e.liveTranslation), k = x(() => {
    R && e.goToPage(R, "source");
  }, [e.goToPage, R]), [O, $] = N(null);
  C(() => {
    w === "compare" && e.session.jobTerminal && $(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, w]);
  const F = O !== e.viewStateKey && Ki({
    state: e.liveTranslation,
    sourceViewOnly: b,
    visibleMode: w
  }), E = x((U) => {
    const re = gf(U, e.liveTranslationAvailable);
    re !== null && c(re), e.setModeKeepingPage(U);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), T = G(() => h.sourcePaneToggle ? /* @__PURE__ */ p(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${l ? " is-active" : ""}`,
      onClick: () => c((U) => !U),
      "aria-pressed": l,
      title: l ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [h.sourcePaneToggle, l]), P = x((U) => {
    i(U);
  }, []), [M] = N(Hu), [_, j] = N(null), B = x((U) => j((re) => re === U ? null : U), []), [H, X] = N(""), [ae, Y] = N("");
  C(() => {
    const U = H.replace(/\s+/gu, " ").trim(), re = window.setTimeout(() => Y(U), U ? 150 : 0);
    return () => window.clearTimeout(re);
  }, [H]);
  const [he, fe] = N(0), me = x(() => {
    j("search"), fe((U) => U + 1);
  }, []);
  sf(me);
  const Le = x((U) => {
    e.jumpToAnchor({ block_id: U }), (_ === "outline" || et() < 900) && j(null);
  }, [e.jumpToAnchor, _]), J = x((U) => e.jumpToAnchor({ block_id: U }), [e.jumpToAnchor]), K = uf({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), we = K.select, ce = e.setModeKeepingPage, pe = o.regions, $e = x((U) => {
    Nl(pe, U) && (w === "source" && ce("compare"), we(U));
  }, [pe, we, w, ce]);
  ff(K.available ? $e : null, M);
  const be = bc(e.viewStateKey);
  Qu(be);
  const [Ce, Re] = N(null), Q = x(() => Re(null), []), z = rf({ documentId: o.documentId, jobId: o.jobId }), ee = ((Me = z.compared) == null ? void 0 : Me.url) || "";
  C(() => {
    ee && w !== "compare" && E("compare");
  }, [ee]), C(() => {
    w !== "compare" && z.clear();
  }, [w]);
  const te = G(
    () => {
      const { compared: U, versions: re, readingVersionId: Ee } = z;
      if (!U) return null;
      const Pe = re.find((Ve) => Ve.versionId === U.versionId), Se = re.find((Ve) => Ve.versionId === Ee);
      return {
        url: U.url,
        regions: U.regions,
        left: { name: U.name, createdAt: (Pe == null ? void 0 : Pe.createdAt) || "" },
        right: { name: (Se == null ? void 0 : Se.name) || "当前译文", createdAt: (Se == null ? void 0 : Se.createdAt) || "" }
      };
    },
    [z.compared, z.versions, z.readingVersionId]
  ), ue = G(() => {
    if (!K.savedCounts.size) return e.revisedBlocks;
    const U = new Map(e.revisedBlocks);
    for (const [re, Ee] of K.savedCounts) U.set(re, (U.get(re) || 0) + Ee);
    return U;
  }, [e.revisedBlocks, K.savedCounts]), le = G(() => ({
    bindShell: e.shell.bindShell,
    shellEl: e.shell.shellEl,
    shellWidth: e.shell.shellWidth,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    rowHeights: e.rowHeights,
    mountSource: e.panes.mountSource,
    mountTranslated: e.panes.mountTranslated,
    onMetrics: e.panes.onMetrics,
    onNumPagesChange: e.panes.onNumPages,
    sourceUrl: e.sessionFiles.sourceUrl,
    translatedUrl: e.sessionFiles.translatedUrl,
    sourceFile: e.sessionFiles.sourceFile,
    translatedFile: e.sessionFiles.translatedFile,
    regions: o.regions,
    readerMetadata: o.readerMetadata,
    activeRegion: e.activeRegion,
    regionHover: M,
    jumpToBlock: J,
    revisedBlocks: ue,
    editBlock: K.available ? $e : void 0,
    blockEdit: K,
    editShowsSource: w !== "compare",
    findTerm: _ === "search" ? ae : "",
    compareVersion: te,
    ink: be,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: b,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: P, close: I }
  }), [
    e.shell,
    e.userZoom,
    e.onZoomChange,
    e.rowHeights,
    e.panes,
    e.sessionFiles,
    o.regions,
    o.readerMetadata,
    e.activeRegion,
    M,
    J,
    ue,
    K,
    $e,
    w,
    _,
    ae,
    te,
    be,
    e.sourceOnly,
    b,
    e.download,
    e.goToPage,
    P,
    I
  ]), Ne = G(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), Ie = [
    Ks,
    `is-workspace-${v}`,
    u ? "is-assistant-open" : "",
    _ ? "is-finder-open" : "",
    y.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(Ec, { value: le, hud: Ne, children: /* @__PURE__ */ L(
    "div",
    {
      className: Ie,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": v,
      "data-ink-mode": be.tool || void 0,
      onContextMenu: (U) => {
        const re = Xu(U);
        re && (U.preventDefault(), Re(re));
      },
      children: [
        /* @__PURE__ */ p(au, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
        /* @__PURE__ */ p(Vu, { open: _, onToggle: B }),
        _ ? /* @__PURE__ */ p(
          Ju,
          {
            tab: _,
            onTab: j,
            onClose: () => j(null),
            onJump: Le,
            query: H,
            onQuery: X,
            term: ae,
            focusSignal: he
          }
        ) : null,
        /* @__PURE__ */ L("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(hu, {}),
          /* @__PURE__ */ p(pl, { onBeforeClose: o.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          ud,
          {
            mode: w,
            documentReady: !!o.jobId,
            sourceViewOnly: b,
            onModeChange: E,
            liveTranslation: h.topBarPill ? {
              visible: l,
              state: e.liveTranslation,
              onToggle: () => c((U) => !U),
              latestPage: l ? R : null,
              currentPage: e.currentPage,
              onJumpToLatest: k
            } : null,
            completion: F ? {
              onOpenCompare: () => {
                $(e.viewStateKey), E("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ p(bd, { active: s }),
        u ? /* @__PURE__ */ p(ru, {}) : null,
        /* @__PURE__ */ p(id, { paneComposition: y, markdownSplit: g.open, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: T }),
        e.showHud ? /* @__PURE__ */ p(
          Du,
          {
            mode: w,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : o.jobId,
            searchSlot: /* @__PURE__ */ p(Ku, { open: _, onToggle: B })
          }
        ) : null,
        /* @__PURE__ */ p(ca, { fallback: null, children: g.mounted ? /* @__PURE__ */ p(hf, { open: g.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: I }) : null }),
        /* @__PURE__ */ p(qu, { active: s, compare: z, ink: be }),
        /* @__PURE__ */ p(Zu, { ink: be, menu: Ce, onClose: Q }),
        /* @__PURE__ */ p(Yu, { ink: be }),
        /* @__PURE__ */ p(mf, { edit: K }),
        /* @__PURE__ */ p($u, {})
      ]
    }
  ) });
}
function zf() {
  return /* @__PURE__ */ p(bf, {});
}
export {
  zf as R,
  bf as a,
  Df as d,
  Cf as f,
  xf as r,
  We as u
};
//# sourceMappingURL=ReaderApp-CJPrqN9H.js.map
