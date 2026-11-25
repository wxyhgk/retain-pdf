var fr = (e) => {
  throw TypeError(e);
};
var mr = (e, t, n) => t.has(e) || fr("Cannot " + n);
var Nt = (e, t, n) => (mr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), hr = (e, t, n) => t.has(e) ? fr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), pr = (e, t, n, r) => (mr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as L, jsx as m, Fragment as pt } from "react/jsx-runtime";
import { useMemo as q, useState as E, useEffect as C, useCallback as z, useRef as M, useLayoutEffect as Ie, memo as ln, createContext as jn, useContext as Hn, forwardRef as yo, useImperativeHandle as Un, useSyncExternalStore as vo, useId as wo, Suspense as Ca, lazy as xa } from "react";
import { requireAdapter as Mt, getReaderAdapters as Le } from "./adapters.js";
import { resolveReaderDownloadName as za, resolveReaderDownloadUrls as Oa, READER_PROGRESS_COPY as je, trimString as Qt, READER_DOWNLOAD_ACTIONS as $a, disabledReason as Fa } from "./runtime/state.js";
import { r as Ba, b as ja } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Pn, isFinishedJobStatus as Ot } from "@retainpdf/domain/job";
import { n as So, d as Ha, f as mn, k as gr, b as Ua, c as Wa, j as Je, p as cn, g as Ka, l as kn, i as Va } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as Ja } from "@retainpdf/api/documents";
import { isReaderTransportError as qa, createReaderTransportError as Ga } from "./contracts.js";
import { toast as Tn, Toaster as Za } from "sonner";
import { X as gt, PenLine as Wn, ZoomIn as Ya, Check as Io, Copy as Xa, ChevronUp as Qa, ChevronDown as Ro, History as es, LoaderCircle as ts, Pin as ns, LogOut as rs, FileText as Po, Columns2 as ko, Languages as To, Radio as os, ArrowDownToLine as as, CheckCircle2 as ss, Keyboard as is, Download as ls, ListOrdered as cs, TriangleAlert as ds, ChevronRight as Eo, ListTree as us, Search as fs, GitCompareArrows as ms, LayoutGrid as hs, Highlighter as ps, Eraser as gs, Undo2 as bs, Trash2 as ys, ChevronLeft as vs, Minus as ws, Plus as Ss } from "lucide-react";
import { Button as X, Textarea as Is, IconButton as dt, Input as Mo } from "@retainpdf/ui";
import { pdfjs as No, Page as Rs, Document as Ps } from "react-pdf";
import { e as ks, m as Ts, a as Es } from "./markdown-math-XkF5urpn.js";
const Ms = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Ns = "", As = Object.freeze({
  progress: "retainpdf-reader-progress"
}), _s = (e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Qm = (...e) => {
  var n;
  return (((n = Le()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, He = () => Mt("defaultReaderDataPort"), br = () => Mt("defaultReaderPageConfigPort"), eh = {
  get apiPrefix() {
    return He().apiPrefix;
  },
  fetchProtected: (...e) => He().fetchProtected(...e),
  loadMarkdownPayload: (e) => He().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => He().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => He().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => He().loadJobPayload(e),
  loadReaderPayload: (e, t) => He().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => He().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return He().liveTranslation;
  }
}, Ao = {
  messageTargetOrigin: () => br().messageTargetOrigin(),
  readerJobId: () => br().readerJobId()
}, Ls = () => {
  var e;
  return ((e = Le()) == null ? void 0 : e.liveTranslation) ?? null;
}, $t = () => {
  var t;
  const e = Le();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, ot = () => {
  const e = Le();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => Mt("fetchDocumentByJobId")(...n),
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
}, Ds = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Cs = () => {
  var e, t;
  return ((t = (e = Le()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, xs = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, zs = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? za(...e);
}, Os = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Oa(...e);
}, $s = (...e) => Mt("downloadProtectedResource")(...e), Fs = (...e) => Mt("failDownloadToast")(...e), th = (e, t) => Mt("resolveMarkdownAssetUrl")(e, t), yr = "/api/v1";
function Bs() {
  const e = () => {
    var r;
    return Ba(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = E(e);
  return C(() => {
    var i, l, c, d;
    const r = () => n(e()), o = (l = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : l.bind(globalThis.history), a = (d = (c = globalThis.history) == null ? void 0 : c.replaceState) == null ? void 0 : d.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const f = (u) => function(...p) {
          const g = u.apply(this, p);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), g;
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
function js() {
  const e = Bs(), t = q(() => xs(Ao), [e]), n = q(() => Cs(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Hs(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [l, c] = E({
    documentId: "",
    jobId: ""
  }), [d, f] = E({
    documentId: "",
    jobId: ""
  }), u = l.documentId === t ? l.jobId : "", p = d.documentId === t ? d.jobId : "", g = n || u, [h, y] = E({
    jobId: "",
    documentId: ""
  }), w = h.jobId === g ? h.documentId : "", S = t || w, b = !!t && !g, [v, I] = E(null), T = (v == null ? void 0 : v.sessionIdentity) === r && v.documentId === S ? v : null, D = b || !!T, F = z((N) => {
    const R = `${N.documentId || ""}`.trim();
    if (!R || a.current && a.current !== R) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: R
      });
    else if (!a.current)
      return;
    const P = `${N.revision || ""}`.trim() || `${Date.now()}`;
    I({
      documentId: R,
      revision: P,
      sessionIdentity: o.current
    }), i();
  }, []);
  C(() => {
    I((N) => N && N.sessionIdentity !== r ? null : N);
  }, [r]);
  const j = z((N) => {
    switch (N.type) {
      case "resolved-document-job":
        c({ documentId: N.documentId, jobId: N.jobId });
        break;
      case "cleared-resolved-document-job":
        c({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: N.documentId, jobId: N.jobId });
        break;
      case "resolved-job-document":
        y((R) => R.jobId === N.jobId && R.documentId === N.documentId ? R : { jobId: N.jobId, documentId: N.documentId });
        break;
      case "committed-source":
        I({
          documentId: N.documentId,
          revision: N.revision,
          sessionIdentity: N.sessionIdentity
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
    rejectedDocumentJobId: p,
    sessionJobId: g,
    resolvedJobDocument: h,
    setResolvedJobDocument: y,
    jobDocumentId: w,
    documentId: S,
    sourceOnly: b,
    committedDocumentSource: v,
    setCommittedDocumentSource: I,
    activeCommittedDocumentSource: T,
    sourceViewOnly: D,
    refreshCommittedDocument: F,
    applyIdentityEvent: j
  };
}
function vr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Us(e) {
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
function wr(e, t) {
  return _s(Pn(e, t));
}
function Ws(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Ks(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !Ws(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function En({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: As.progress,
        stage: n,
        percent: e,
        text: t
      },
      Ao.messageTargetOrigin()
    );
  } catch {
  }
}
function en(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), En({ percent: t, text: n, stage: r });
}
function Vs(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, l] = E(null), [c, d] = E(null), [f, u] = E(""), [p, g] = E(0), h = f === n ? i : null, y = f === n ? c : null, w = vr(h), S = Ot(w), b = z(() => {
    g((j) => j + 1);
  }, []), v = z((j) => {
    l(j.jobPayload), d(j.manifestPayload), u(j.sessionIdentity);
  }, []), I = z((j) => {
    l(null), d(null), u(j);
  }, []), T = M(""), D = M(""), F = z(async () => {
    const j = o.current;
    if (!j || T.current === j) return;
    const N = ot().loadJobPayload;
    if (typeof N != "function") return;
    const R = a.current.value;
    T.current = j;
    try {
      const P = await N(j);
      if (s.current || a.current.value !== R || o.current !== j || !P || typeof P != "object")
        return;
      const k = vr(P);
      l(P), u(r.current), !Ot(k) && D.current === j && (D.current = ""), k === "succeeded" && D.current !== j && (D.current = j, g((A) => A + 1));
    } catch {
    } finally {
      T.current === j && (T.current = "");
    }
  }, []);
  return C(() => {
    D.current = "";
  }, [n]), C(() => {
    if (!t || S || !h) return;
    const j = window.setInterval(() => {
      document.visibilityState !== "hidden" && F();
    }, 1e3);
    return () => window.clearInterval(j);
  }, [S, F, h, t]), {
    jobPayload: i,
    setJobPayload: l,
    manifestPayload: c,
    setManifestPayload: d,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: u,
    scopedJobPayload: h,
    scopedManifestPayload: y,
    jobStatus: w,
    jobTerminal: S,
    jobRefreshRevision: p,
    refreshJobArtifacts: b,
    refreshJobStatus: F,
    publishPayload: v,
    clearPayload: I
  };
}
function Mn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Js(e, t) {
  e(t), Mn(t);
}
function qs(e) {
  const [t, n] = E(e ? "source" : "compare"), r = z((a) => {
    e && a !== "source" || (n(a), Mn(a));
  }, [e]), o = z((a) => {
    Js(n, a);
  }, []);
  return C(() => (e && document.documentElement.classList.add("reader-source-only"), Mn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Sr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Gs(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Sr(n.active_job_id),
    activeVersionId: Sr(n.active_version_id)
  };
}
function Zs(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Ys(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Xs(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Qs = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function ei(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Qs.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const ti = 48 * 1024 * 1024;
function ni(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const ri = 2, Te = /* @__PURE__ */ new Map();
function Nn(e, t) {
  Te.delete(e), Te.set(e, t);
}
function Ir(e) {
  if (Te.size < ri) return;
  const t = Te.keys().next().value;
  t && Te.delete(t);
}
async function oi(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function _o(e, t = $t().fetchProtected, n = {}) {
  var d, f, u, p, g, h, y, w, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Te.has(r)) {
    const b = Te.get(r);
    return Nn(r, b), b;
  }
  const o = new AbortController(), a = () => o.abort();
  (d = n.signal) != null && d.aborted && o.abort(), (u = (f = n.signal) == null ? void 0 : f.addEventListener) == null || u.call(f, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (g = (p = n.signal) == null ? void 0 : p.removeEventListener) == null || g.call(p, "abort", a);
  }
  if (!s.ok) {
    const b = new Error(`读取 PDF 失败 (${s.status})`);
    b.status = s.status;
    const v = await oi(s);
    throw v && (b.reason = v), b;
  }
  const i = ai(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return Ir(), Te.set(r, b), b;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let l;
  try {
    l = await s.arrayBuffer();
  } finally {
    (S = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || S.call(w, "abort", a);
  }
  const c = { data: new Uint8Array(l) };
  return Te.has(r) ? Nn(r, c) : (Ir(), Te.set(r, c)), c;
}
function ai(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < ti ? null : {
    url: e,
    length: o,
    async fetchRange(i, l) {
      const c = await n(e, { headers: { Range: `bytes=${i}-${l - 1}` } });
      if (c.status !== 206) throw new Error(`读取 PDF 片段失败 (${c.status})`);
      return new Uint8Array(await c.arrayBuffer());
    }
  };
}
const si = { file: null, loading: !1, error: "" }, ii = { file: null, loading: !0, error: "" };
function li(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = E(null);
  if (C(() => {
    if (t || !n) return;
    const s = Te.get(n);
    if (s) {
      Nn(n, s);
      return;
    }
    const i = new AbortController();
    return _o(n, void 0, { signal: i.signal }).then((l) => {
      i.signal.aborted || o({ url: n, file: l, loading: !1, error: "" });
    }).catch((l) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (l == null ? void 0 : l.message) || String(l) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return si;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Te.get(n);
  return a ? { file: a, loading: !1, error: "" } : ii;
}
function ci(e) {
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
async function An(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  en(s, r, n, "download");
  const i = await _o(t, $t().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (en(s, o, n, "download"), i);
}
async function di(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  en(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    An({
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
    An({
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
function ui(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function fi({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Ja,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(ui(o.href, t, a)), !0);
}
const Kt = {
  regions: null,
  metadata: null
};
function mi(e) {
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
    switchSessionMode: p,
    jobRefreshRevision: g,
    sessionEpochRef: h,
    closingRef: y,
    activeLoadAbortRef: w
  } = e, [S, b] = E(""), [v, I] = E(""), [T, D] = E(null), [F, j] = E(null), [N, R] = E(!1), [P, k] = E(""), [A, _] = E([]), [H, $] = E(!1), [W, re] = E(() => ({
    source: null,
    translated: null
  })), [oe, Z] = E(
    Kt
  ), [pe, ce] = E({
    loading: !0,
    percent: 4,
    text: je.boot,
    stage: "progress",
    failed: !1
  });
  return C(() => {
    const ae = new AbortController(), Me = h.current.value, ee = ci({
      sessionEpochRef: h,
      closingRef: y,
      abort: ae,
      sessionEpoch: Me
    });
    w.current = ae;
    const Q = ot();
    if (y.current)
      return ae.abort(), () => {
        w.current === ae && (w.current = null);
      };
    let ge = !1;
    function ue(ne, B) {
      ee.markFailed(), $(!0), ce({
        loading: !1,
        percent: 100,
        text: ne,
        stage: "failed",
        failed: !0
      }), En({ percent: 100, text: B, stage: "failed" });
    }
    function he() {
      R(!0), ge || $(!0), ce({
        loading: !1,
        percent: 100,
        text: je.ready,
        stage: "ready",
        failed: !1
      }), En({ percent: 100, text: je.ready, stage: "ready" });
    }
    function Ne() {
      return c != null && c.documentId ? wr(
        c.documentId,
        c.revision
      ) : Ms() ? Ns : Q.resolveResourceUrl(Pn(r));
    }
    async function Oe() {
      var de;
      let ne = { activeJobId: "", activeVersionId: "" };
      try {
        const le = await ((de = Q.fetchDocument) == null ? void 0 : de.call(Q, r));
        le && (ne = Gs(le));
      } catch {
      }
      const B = Zs({
        link: ne,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!c
      });
      if (B.kind === "follow-active-job") {
        if (ee.isInactive()) return;
        d({
          type: "resolved-document-job",
          documentId: r,
          jobId: B.jobId
        }), B.activeVersionId ? (c || d({
          type: "committed-source",
          documentId: r,
          revision: B.activeVersionId,
          sessionIdentity: l
        }), p("source")) : p("compare");
        return;
      }
      if (B.kind === "open-committed-source") {
        if (ee.isInactive()) return;
        d({
          type: "committed-source",
          documentId: r,
          revision: B.revision,
          sessionIdentity: l
        }), p("source");
        return;
      }
      const Y = Ne();
      if (ee.isInactive()) return;
      b(Y), I(""), k(""), u(l);
      const te = await An({
        url: Y,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: ee,
        setBoot: ce
      });
      if (!ee.isInactive()) {
        if (!te) {
          ue("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        D(te), he();
      }
    }
    async function at() {
      var it;
      const ne = !c, B = !!(ne && Q.loadSessionSnapshot && Q.loadReaderOptionalArtifacts), Y = B ? Q.loadReaderOptionalArtifacts(t) : null, te = await ((it = Q.loadSessionSnapshot) == null ? void 0 : it.call(Q, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: c,
        includeOptionalArtifacts: ne && !B
      })), de = te ? {
        jobPayload: te.sourcePayload,
        manifestPayload: te.manifestPayload,
        readerMetadata: te.readerMetadata,
        regionsPayload: te.regions,
        readerErrors: te.readerErrors
      } : await Q.loadReaderPayload(t, {
        includeOptionalArtifacts: ne
      });
      if (ee.isInactive()) return;
      let le = null;
      if (n && !r)
        if (te && te.linkedDocument !== void 0)
          le = te.linkedDocument;
        else {
          try {
            le = await Q.fetchDocumentByJobId(yr, t);
          } catch {
          }
          if (ee.isInactive()) return;
        }
      const Ae = Us(de.jobPayload) || `${(le == null ? void 0 : le.document_id) || ""}`.trim();
      Ae && !r && d({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ae
      });
      const Re = Ys({
        payloadDocumentId: Ae,
        linkedActiveJobId: `${(le == null ? void 0 : le.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(le == null ? void 0 : le.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!c
      });
      if (Re.kind === "restore-committed-source") {
        if (ee.isInactive()) return;
        d({
          type: "committed-source",
          documentId: Re.documentId,
          revision: Re.revision,
          sessionIdentity: l
        }), p("source");
        return;
      }
      const De = Q.resolveReaderSourcePdf(de.manifestPayload), me = Q.resolveReaderTranslatedPdfUrl(de.jobPayload, de.manifestPayload), $e = typeof De == "string" ? De : Q.resolveReaderArtifactUrl(De), st = r || Ae, Ge = c != null && c.documentId ? wr(
        c.documentId,
        c.revision
      ) : $e || (st ? Q.resolveResourceUrl(Pn(st)) : ""), Pe = c ? "" : me || "";
      b(Ge || ""), I(Pe), k(Ks(de.jobPayload, t)), f({
        jobPayload: de.jobPayload || null,
        manifestPayload: de.manifestPayload || null,
        sessionIdentity: l
      });
      const ye = () => di({
        sourceFinal: Ge || "",
        translatedFinal: Pe,
        fence: ee,
        setBoot: ce
      }), Ze = !!(Ge || Pe), Fe = Y && Ze ? ye() : null;
      Fe == null || Fe.catch(() => {
      });
      const vt = (O) => {
        ee.isInactive() || (_(c ? [] : So(O.regionsPayload)), re(c ? { source: null, translated: null } : Ha(O.readerMetadata)), Z(c ? Kt : O.readerErrors ?? Kt), $(!0));
      };
      if (Y ? (ge = !0, Y.then(vt)) : vt(de), !Ze) {
        ue(je.failed, je.failed);
        return;
      }
      const Se = await (Fe ?? ye());
      if (Se.status !== "inactive") {
        if (Se.status === "incomplete") {
          ue("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        D(Se.sourceBytes), j(Se.translatedBytes), he();
      }
    }
    async function ke() {
      R(!1), D(null), j(null), _([]), $(!1), re({ source: null, translated: null }), Z(Kt), en(ce, 8, je.metadata, "metadata");
      try {
        if (s) {
          await Oe();
          return;
        }
        if (!t) {
          ue(je.failed, je.failed);
          return;
        }
        await at();
      } catch (ne) {
        if (ee.isClosedOrStale() || (ne == null ? void 0 : ne.name) === "AbortError") return;
        ee.markFailed();
        const B = Number(ne == null ? void 0 : ne.status), Y = `${(ne == null ? void 0 : ne.reason) || ""}`, te = ei({ status: B, reason: Y, sessionJobId: t });
        if (te && (await fi({
          apiPrefix: yr,
          documentId: te,
          expiredJobId: t
        }) || ee.isClosedOrStale()))
          return;
        if (Xs({
          status: B,
          reason: Y,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          d({ type: "missing-document-job", documentId: r, jobId: t }), d({ type: "cleared-resolved-document-job" }), p("source");
          return;
        }
        const de = ne instanceof Error ? ne.message : je.failed;
        ue(de, de);
      }
    }
    return ke(), () => {
      ae.abort(), w.current === ae && (w.current = null);
    };
  }, [t, r, o, a, s, i, c, g, n, l, d, f, u, p]), {
    sourceUrl: S,
    translatedUrl: v,
    sourceFile: T,
    translatedFile: F,
    assetsReady: N,
    title: P,
    regions: A,
    regionsSettled: H,
    readerMetadata: W,
    readerErrors: oe,
    boot: pe
  };
}
function hi() {
  const e = M(!1), t = M(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = js(), s = M({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = M(a), l = M(""), c = M(""), d = M(() => {
  }), f = z(() => d.current(), []), u = Hs({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: l,
    sessionJobIdRef: c,
    switchToSourceMode: f
  }), {
    sessionJobId: p,
    documentId: g,
    sourceOnly: h,
    sourceViewOnly: y
  } = u, { mode: w, setMode: S, switchSessionMode: b } = qs(y);
  d.current = () => {
    b("source");
  }, i.current = a, l.current = g, c.current = p;
  const v = Vs({
    sessionJobId: p,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: c,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: I,
    scopedManifestPayload: T,
    jobStatus: D,
    jobTerminal: F,
    jobRefreshRevision: j,
    refreshJobArtifacts: N,
    refreshJobStatus: R
  } = v, P = mi({
    sessionJobId: p,
    jobId: r,
    routeDocumentId: o,
    documentJobId: u.documentJobId,
    rejectedDocumentJobId: u.rejectedDocumentJobId,
    sourceOnly: h,
    locationKey: n,
    sessionIdentity: a,
    committedSource: u.activeCommittedDocumentSource,
    applyIdentityEvent: u.applyIdentityEvent,
    publishPayload: v.publishPayload,
    clearPayload: v.clearPayload,
    switchSessionMode: b,
    jobRefreshRevision: j,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), k = z(() => {
    var _;
    e.current = !0, (_ = t.current) == null || _.abort();
  }, []), A = q(
    () => ({
      fetchProtected: ot().fetchProtected,
      jobId: p,
      jobPayload: I,
      manifestPayload: T,
      sourceUrl: P.sourceUrl,
      translatedUrl: P.translatedUrl,
      sourceOnly: y
    }),
    [p, I, T, P.sourceUrl, P.translatedUrl, y]
  );
  return {
    jobId: p,
    jobStatus: D,
    workflow: `${(I == null ? void 0 : I.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: F,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: w,
    setMode: S,
    sourceUrl: P.sourceUrl,
    translatedUrl: P.translatedUrl,
    sourceFile: P.sourceFile,
    translatedFile: P.translatedFile,
    assetsReady: P.assetsReady,
    boot: P.boot,
    title: P.title,
    regions: P.regions,
    regionsSettled: P.regionsSettled,
    readerMetadata: P.readerMetadata,
    readerErrors: P.readerErrors,
    download: A,
    refreshJobArtifacts: N,
    refreshJobStatus: R,
    refreshCommittedDocument: u.refreshCommittedDocument,
    prepareClose: k
  };
}
const pi = 160, gi = 8, bi = 0;
function yi() {
  const e = M(null), [t, n] = E(null), [r, o] = E(bi), a = z((s) => {
    e.current = s, n(s);
  }, []);
  return C(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (c) => {
      !Number.isFinite(c) || c < pi || o((d) => Math.abs(d - c) < gi ? d : c);
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
function vi(e) {
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
const hn = { source: 0, translated: 0 };
function wi(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: l
  } = e, c = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, d = M(c);
  d.current = c;
  const [f, u] = E(() => ({
    identity: c,
    pages: hn
  })), [p, g] = E(() => ({ identity: c, tick: 0 })), h = f.identity === c ? f.pages : hn, y = p.identity === c ? p.tick : 0, w = vi({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!l
  }), { primaryPane: S } = w, b = z((R, P) => {
    d.current === c && u((k) => {
      const A = k.identity === c ? k.pages : hn;
      return A[P] === R && k.identity === c ? k : {
        identity: c,
        pages: { ...A, [P]: R }
      };
    });
  }, [c]), v = M(null), I = z(() => {
    v.current && clearTimeout(v.current);
    const R = c;
    v.current = setTimeout(() => {
      v.current = null, d.current === R && g((P) => ({
        identity: R,
        tick: P.identity === R ? P.tick + 1 : 1
      }));
    }, 60);
  }, [c]);
  C(() => (v.current && (clearTimeout(v.current), v.current = null), u((R) => R.identity === c && R.pages.source === 0 && R.pages.translated === 0 ? R : { identity: c, pages: { source: 0, translated: 0 } }), g((R) => R.identity === c && R.tick === 0 ? R : { identity: c, tick: 0 }), () => {
    v.current && (clearTimeout(v.current), v.current = null);
  }), [c]);
  const T = q(
    () => Math.max(h.source, h.translated),
    [h]
  ), D = S === "translated" ? h.translated : h.source || h.translated, F = t == null ? void 0 : t.userZoom, j = t == null ? void 0 : t.shellWidth, N = `${c}-${y}-${F}-${n}-${h.source}-${h.translated}-${j}`;
  return {
    ...w,
    numPagesByPane: h,
    hudNumPages: T,
    primaryNumPages: D,
    metricsTick: y,
    onNumPages: b,
    onMetrics: I,
    rowSyncRevision: N
  };
}
const Ee = "data-reader-page", we = "data-reader-pane", Kn = "data-natural-height", Si = "reader-react-root", Lo = "reader-react-grid", Do = "reader-react-scroll-shell", dn = "reader-react-pdf-pane", Co = "reader-react-pdf-page", tn = "reader-react-pdf-page-placeholder", Vn = "reader-react-pdf-page-slot";
function nn(e, t) {
  const n = e != null ? `[${Ee}="${e}"]` : `[${Ee}]`;
  return t ? `${n}[${we}="${t}"]` : n;
}
function Jn() {
  return `.${Vn}[${Ee}]`;
}
function rn(e) {
  return Number(e.getAttribute(Ee));
}
const xo = 0.25, on = 1, Ii = 0.05, Wt = 0.5, Ri = 16, Pi = 8, zo = Ri + Pi, ki = 720;
function tt() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Oo(e) {
  return Number.isFinite(e) && e < ki;
}
function Rt(e, t = Number.POSITIVE_INFINITY) {
  return Oo(t) && (e === "source" || e === "translated") ? on : Wt;
}
function Ke(e) {
  return Number.isFinite(e) ? Math.min(on, Math.max(xo, e)) : Wt;
}
function Ft(e, t) {
  const n = Ke(Number(e) + t * Ii);
  return Math.round(n * 100) / 100;
}
function Ti(e) {
  return Math.round(Ke(e) * 100);
}
function $o(e) {
  const n = (Number(e) || 0) - zo;
  return Math.max(160, Math.floor(n));
}
function Ei(e, t = Wt) {
  const n = Ke(t);
  return $o((Number(e) || 0) * n);
}
function Mi(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${we}]`)
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
const Ni = 8;
function Ai(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Ni ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const Fo = 200, Bo = [
  "markdown"
], _i = Bo;
function jo(e) {
  return _i.includes(e);
}
const Li = "retainpdf:reader:view:v1:", Rr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), Di = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function Ho() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function _n(e) {
  return `${e || ""}`.trim();
}
function Ci({
  documentId: e,
  jobId: t
}) {
  const n = _n(e);
  if (n) return `document:${n}`;
  const r = _n(t);
  return r ? `job:${r}` : "";
}
function Uo(e) {
  const t = _n(e);
  return t ? `${Li}${t}` : "";
}
function xi(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function zi(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Rr.has(t) || !Rr.has(n) || t === n))
    return { left: t, right: n };
}
function Oi(e) {
  return e === null ? null : jo(e) ? e : void 0;
}
function $i(e) {
  return Di.has(e) ? e : void 0;
}
function Wo(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = xi(t.anchor), r = Number(t.zoom), o = $i(t.mode), a = zi(t.splitLayout), s = Oi(t.assistantPanel);
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
function ze(e, t = Ho()) {
  const n = Uo(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Wo(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function un(e, t, n = Ho()) {
  const r = Uo(e);
  if (!r || !n) return null;
  const o = ze(e, n), a = Wo({
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
function Fi(e, t, n = "") {
  var u;
  const [r, o] = E(() => {
    var p;
    return ((p = ze(n)) == null ? void 0 : p.zoom) ?? Rt(e, tt());
  }), a = M(r), s = M(n);
  a.current = r;
  const i = M(1), l = M(((u = ze(n)) == null ? void 0 : u.zoom) !== void 0);
  C(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const p = (h = ze(n)) == null ? void 0 : h.zoom;
    l.current = p !== void 0;
    const g = p ?? Rt(e, tt());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), C(() => {
    if (l.current) return;
    const p = Rt(e, tt()), g = a.current;
    Math.abs(p - g) < 5e-4 || (i.current = 1, a.current = p, o(p));
  }, [e]);
  const c = z((p, g) => {
    const h = Ke(p), y = a.current;
    Math.abs(h - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (y || 1), a.current = h, l.current = !0, un(s.current, { zoom: h }), o(h));
  }, []), d = z((p) => {
    c(Ft(a.current, p));
  }, [c]), f = z((p) => {
    c(Rt(p));
  }, [c]);
  return Ie(() => {
    const p = i.current;
    Math.abs(p - 1) < 1e-3 || (i.current = 1, Mi(t == null ? void 0 : t.current, p));
  }, [r, t]), { userZoom: r, onZoomChange: c, stepZoom: d, resetZoom: f };
}
const Bi = 160, ji = 3e-3, Pr = 50, Hi = 16, Ui = 800;
function Wi(e, t = 0) {
  const n = t === 1 ? Hi : t === 2 ? Ui : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Pr, Math.min(Pr, r));
  return Math.exp(-o * ji);
}
function Ki(e, t, n = 0) {
  return Ke(e * Wi(t, n));
}
function Vi(e) {
  return Math.round(Ke(e) * 100) / 100;
}
function Ji(e, t, n) {
  const r = Ke(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ke(t) / r;
  const a = (o + zo) / r;
  return $o(a * Ke(t)) / o;
}
function qi(e) {
  return Array.from(e.querySelectorAll(Jn()));
}
function Gi(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function Zi(e, t, n) {
  let r = null;
  for (const s of qi(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const l = Gi(i, t, n);
    if ((!r || l < r.distance) && (r = { el: s, rect: i, distance: l }), l === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Ee) || "",
    pane: o.getAttribute(we) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function Yi(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function Ko(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${Jn()}[${Ee}="${t.page}"][${we}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Yi(n, e).scrollLeft += a);
}
function Xi(e, t, n, r) {
  const o = e.querySelector(`.${Lo}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function At(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const Qi = 600, el = 1e3;
function tl(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || Ko(e, t);
  });
  a.observe(n);
  const s = (d) => {
    d.type === "wheel" && d.ctrlKey || c();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const d of i) r.addEventListener(d, s, { capture: !0, passive: !0 });
  const l = r.setTimeout(() => c(), el);
  function c() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(l);
      for (const d of i) r == null || r.removeEventListener(d, s, { capture: !0 });
    }
  }
  return c;
}
function nl(e, t, n) {
  const r = M(t);
  r.current = t;
  const o = M(n);
  o.current = n;
  const a = M(null), s = M(null), i = M(null);
  C(() => {
    if (!e) return;
    const l = () => {
      const d = a.current;
      if (a.current = null, !d) return;
      const f = Vi(d.target);
      if (Math.abs(f - r.current) < 5e-3) {
        At(d.grid);
        return;
      }
      const u = { anchor: d.anchor, grid: d.grid, fallback: null };
      u.fallback = setTimeout(() => {
        s.current === u && (s.current = null, At(u.grid));
      }, Qi), s.current = u, o.current(f, { keepScroll: !1 });
    }, c = (d) => {
      var p, g;
      if (!d.ctrlKey) return;
      d.preventDefault();
      let f = a.current;
      if (!f) {
        (p = i.current) == null || p.call(i), i.current = null;
        const h = s.current;
        h && (h.fallback && clearTimeout(h.fallback), s.current = null, At(h.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: Zi(e, d.clientX, d.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = Ki(f.target, d.deltaY, d.deltaMode);
      const u = Ji(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = Xi(e, u, d.clientX, d.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(l, Bi);
    };
    return e.addEventListener("wheel", c, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", c);
      const d = a.current;
      a.current = null, d != null && d.timer && clearTimeout(d.timer), At((d == null ? void 0 : d.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Ie(() => {
    var c;
    const l = s.current;
    l && (s.current = null, l.fallback && clearTimeout(l.fallback), At(l.grid), !(!e || !l.anchor) && (Ko(e, l.anchor), (c = i.current) == null || c.call(i), i.current = tl(e, l.anchor)));
  }, [t, e]);
}
function rl(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = M(t), a = M(n), s = M(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: z((l) => {
    l !== o.current && (s.current(), a.current(l));
  }, []) };
}
const qn = 48;
function Vo(e, t = qn) {
  return e.getBoundingClientRect().top + t;
}
function Jo(e, t) {
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
  const o = rn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Yt(e, t, n = qn) {
  if (!e)
    return null;
  const r = nn(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Vo(e, n), i = Jo(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Bt(e, t, n = "auto", r, o = qn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(nn(a, r))), i || (i = e.querySelector(nn(a))), !i)
    return !1;
  const l = e.getBoundingClientRect(), c = i.getBoundingClientRect();
  if (l.height <= 0 || c.height < 8 && i.offsetHeight < 8)
    return !1;
  const d = c.height > 0 ? c.height : i.offsetHeight, f = e.scrollTop + (c.top - l.top), u = Math.max(0, f + s * d - o);
  return n === "auto" ? Math.abs(e.scrollTop - u) >= 1 && (e.scrollTop = u) : e.scrollTo({ top: u, behavior: n }), !0;
}
function ol(e, t, n = "smooth", r) {
  return Bt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function Ln(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], l = () => {
    var d;
    if (a) return;
    Bt(
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
function al(e, t, n) {
  return Ln(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function an(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function _e(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function sl(e, t, n = !0, r = "", o) {
  const [a, s] = E(1);
  return C(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let l = !1, c = null, d = 0;
    const f = nn(void 0, o), u = () => {
      if (l) return;
      const h = Array.from(i.querySelectorAll(f));
      if (!h.length)
        return;
      const y = Vo(i), w = Jo(h, y);
      w && s(w.page);
    }, p = () => {
      l || (d && cancelAnimationFrame(d), d = requestAnimationFrame(() => {
        d = 0, u();
      }));
    }, g = () => {
      if (l) return;
      if (!Array.from(i.querySelectorAll(f)).length) {
        c = setTimeout(g, 120);
        return;
      }
      u(), i.addEventListener("scroll", p, { passive: !0 });
    };
    return g(), () => {
      l = !0, c && clearTimeout(c), d && cancelAnimationFrame(d), i.removeEventListener("scroll", p);
    };
  }, [e, t, n, r, o]), a;
}
const il = `canvas, .react-pdf__Page, .${Co}, .${tn}`, kr = /* @__PURE__ */ new WeakMap();
function ll(e) {
  const t = Number(e.getAttribute(Kn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = kr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(il), kr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function cl(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function dl(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(Jn()).forEach((r) => {
    const o = rn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = ll(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function ul(e, t, n = "", r) {
  const [o, a] = E(() => /* @__PURE__ */ new Map()), s = M(o), i = M(r);
  return i.current = r, Ie(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let l = !1, c = 0, d = !1, f = !1;
    const u = () => {
      var I;
      if (l) return;
      const b = e.current;
      if (!b) return;
      const v = dl(b);
      cl(s.current, v) || (s.current = v, a(v)), d && !f && (f = !0, (I = i.current) == null || I.call(i));
    }, p = () => {
      cancelAnimationFrame(c), c = requestAnimationFrame(() => {
        requestAnimationFrame(u);
      });
    };
    p();
    const g = window.setTimeout(p, 100), h = window.setTimeout(() => {
      d = !0, p();
    }, 300), y = window.setTimeout(p, 700), w = e.current;
    let S = null;
    return w && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => p()), S.observe(w)), () => {
      l = !0, cancelAnimationFrame(c), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(y), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const fl = [0, 48, 140, 320, 560], ml = 700, hl = [80, 200, 400], pl = 500, gl = 50, bl = /* @__PURE__ */ new Set([
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
]), yl = 180, Tr = [0, 48, 140, 320, 700, 1200];
function vl(e, t) {
  var P;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = M(
    ((P = ze(a)) == null ? void 0 : P.anchor) || { page: 1, fraction: 0 }
  ), l = M(null), c = M(!1), d = M(r), f = M(null), u = M(null), p = M(null), g = M(null), h = M(a), y = M(""), w = M(n);
  w.current = n;
  const S = z(() => {
    var k;
    (k = f.current) == null || k.call(f), f.current = null, u.current != null && (clearTimeout(u.current), u.current = null);
  }, []), b = z(() => {
    !c.current && l.current == null || (S(), p.current != null && (clearTimeout(p.current), p.current = null), l.current = null, c.current = !1);
  }, [S]), v = z((k = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const A = () => {
      g.current = null, un(h.current, {
        anchor: _e(i.current)
      });
    };
    k ? A() : g.current = setTimeout(A, yl);
  }, []), I = z((k) => {
    i.current = _e(k), l.current = null, p.current != null && clearTimeout(p.current), p.current = setTimeout(() => {
      p.current = null, c.current = !1;
    }, gl);
  }, []);
  C(() => {
    if (!o)
      return;
    let k = !1, A = null, _ = null, H = null;
    const $ = () => {
      if (k) return;
      const W = e.current;
      if (!W) {
        H = setTimeout($, 50);
        return;
      }
      A = W, _ = () => {
        if (c.current)
          return;
        const re = Yt(A, w.current);
        re && (i.current = re, v());
      }, A.addEventListener("scroll", _, { passive: !0 }), c.current || _();
    };
    return $(), () => {
      k = !0, H != null && clearTimeout(H), A && _ && A.removeEventListener("scroll", _);
    };
  }, [o, r, n, e, v]), C(() => {
    if (!o) return;
    const k = e.current;
    if (!k) return;
    const A = (_) => {
      _.metaKey || _.ctrlKey || _.altKey || bl.has(_.key) && b();
    };
    return k.addEventListener("wheel", b, { passive: !0 }), k.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", A), () => {
      k.removeEventListener("wheel", b), k.removeEventListener("touchmove", b), window.removeEventListener("keydown", A);
    };
  }, [o, e, b]), Ie(() => {
    var A;
    if (h.current === a) return;
    v(!0), S(), p.current != null && (clearTimeout(p.current), p.current = null), h.current = a, y.current = "";
    const k = (A = ze(a)) == null ? void 0 : A.anchor;
    i.current = k ? _e(k) : { page: 1, fraction: 0 }, l.current = null, c.current = !!a, d.current = r;
  }, [a, r, v, S]), C(() => {
    var A;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const k = _e(
      ((A = ze(a)) == null ? void 0 : A.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = k, l.current = k, c.current = !0, S(), f.current = Ln(
      () => e.current,
      k,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: Tr,
        onDone: () => I(k)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(k);
    }, Math.max(...Tr) + 160), () => S();
  }, [o, s, a, e, I, S]), C(() => {
    if (d.current === r)
      return;
    if (d.current = r, !o) {
      c.current = !1, l.current = null, S();
      return;
    }
    const k = l.current ? _e(l.current) : _e(i.current);
    return c.current = !0, l.current = k, i.current = k, S(), f.current = Ln(
      () => e.current,
      k,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: fl,
        onDone: () => I(k)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(k);
    }, ml), () => {
      S();
    };
  }, [r, o, n, e, I, S]), C(() => () => {
    S(), p.current != null && (clearTimeout(p.current), p.current = null), v(!0);
  }, [S, v]);
  const T = z(() => {
    const k = Yt(
      e.current,
      w.current
    );
    return _e(k || i.current);
  }, [e]), D = z(() => {
    c.current = !0;
    const k = Yt(
      e.current,
      w.current
    ), A = _e(k ?? i.current);
    return i.current = A, l.current = A, v(), A;
  }, [e, v]), F = z((k, A, _) => {
    const H = _ || w.current, $ = an(k, A || 1), W = { page: $, fraction: 0 };
    i.current = W, c.current = !0, l.current = W, v(), S(), ol(e.current, $, "smooth", H), f.current = al(
      () => e.current,
      $,
      {
        behavior: "auto",
        pane: H,
        delaysMs: hl,
        onDone: () => I(W)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(W);
    }, pl);
  }, [e, I, S, v]), j = z(() => _e(i.current), []), N = z(() => c.current, []), R = z(() => {
    if (!c.current || !l.current)
      return;
    const k = _e(l.current);
    Bt(
      e.current,
      k,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: T,
    beginModeSwitch: D,
    goToPage: F,
    getAnchor: j,
    isRestoring: N,
    repinIfRestoring: R
  };
}
function wl(e, t) {
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
function qo(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Sl = [0, 80, 200, 400, 800], Il = 120, Rl = 400;
function Pl(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: l, documentId: c, regionsSettled: d = !0 } = e, f = M(a);
  f.current = a;
  const u = M(s);
  u.current = s;
  const p = M(i);
  p.current = i;
  const g = M(n);
  g.current = n, C(() => {
    var v, I;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = Ds(), y = wl(h, u.current);
    if (y == null && (h != null && h.blockId) && !d) return;
    const w = qo(h, y, { jobId: l, documentId: c });
    if (t.current === w)
      return;
    if (y == null) {
      t.current = w, (v = g.current) == null || v.call(g);
      return;
    }
    t.current = w, h && ((I = p.current) == null || I.call(p, h, y));
    const S = [];
    let b = 0;
    for (const T of Sl)
      b = Math.max(b, T), S.push(
        setTimeout(() => {
          f.current(y);
        }, T)
      );
    return S.push(
      setTimeout(() => {
        var T;
        (T = g.current) == null || T.call(g);
      }, b + Il)
    ), () => {
      for (const T of S) clearTimeout(T);
    };
  }, [r, o, l, c, t, d]);
}
function kl(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Tl(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Rl,
    jobId: i,
    documentId: l,
    applyReaderSearch: c
  } = e, d = M(a);
  d.current = a;
  const f = M(c);
  f.current = c;
  const u = M(0);
  C(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || u.current === o) return;
    const p = setTimeout(() => {
      var w;
      const g = ((w = globalThis.location) == null ? void 0 : w.search) || "", h = ja(g, o, d.current);
      if (u.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = qo(
        { blockId: y },
        o,
        { jobId: i, documentId: l }
      ), (f.current || kl)(h);
    }, s);
    return () => clearTimeout(p);
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
function El(e) {
  const t = M(""), [n, r] = E(!1), o = z(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Pl(a, t, o), Tl(e, t, n);
}
const _t = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Ml(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Er(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function Go(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Er(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Er(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Nl(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = Go(r, t, n);
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
function Al(e) {
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
function _l(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function Ll(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function Dl(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function Cl(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const Mr = [250, 500, 1e3, 2e3, 4e3], pn = [80, 160, 320, 640, 1e3, 1500], Nr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Dn(e, t) {
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
function Gn(e) {
  return qa(e) ? `${e.code || ""}`.trim() : "";
}
function Vt(e, t) {
  const n = Gn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function xl(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const l = await o.fetchPage(e, t.page_idx, { signal: r });
      if (Go(n.pagesByPage.get(t.page_idx), t, l) !== "retry")
        return l;
      a = Ga(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (l) {
      if ((l == null ? void 0 : l.name) === "AbortError") throw l;
      a = l;
      const c = Gn(l);
      if (c && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(c)) throw l;
    }
    const i = pn[Math.min(s, pn.length - 1)];
    if (await Dn(i, r), s >= pn.length + 2) throw a;
  }
}
function zl({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = E(_t), s = M(o), i = M("");
  s.current = o;
  const l = `${e || ""}`.trim(), c = `${t || ""}`.trim().toLowerCase(), d = Ot(c) ? c : "";
  return C(() => {
    if (!n || !l) {
      i.current = "", s.current = _t, a(_t);
      return;
    }
    const f = r === void 0 ? Ls() : r, u = i.current === l;
    if (i.current = l, !f) {
      const b = {
        ...u ? s.current : _t,
        connection: d ? "terminal" : "unavailable",
        jobStatus: c,
        error: "实时译文暂不可用"
      };
      s.current = b, a(b);
      return;
    }
    const p = new AbortController();
    let g = !1;
    const h = {
      ...u ? s.current : _t,
      connection: d ? "terminal" : "connecting",
      jobStatus: c,
      error: ""
    };
    s.current = h, a(h);
    const y = (b) => {
      p.signal.aborted || a((v) => {
        const I = b(v);
        return s.current = I, I;
      });
    }, w = async () => {
      let b = 0;
      for (; !p.signal.aborted; )
        try {
          const v = await f.fetchLayout(l, { signal: p.signal });
          g = !0, y((I) => ({
            ...I,
            layoutByPage: Ml(v),
            jobStatus: c,
            error: ""
          }));
          return;
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError") return;
          const I = Gn(v);
          if (!(I === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !I)) {
            y((D) => ({
              ...D,
              connection: d ? "terminal" : "unavailable",
              jobStatus: c,
              error: Vt(v, "实时译文暂不可用")
            }));
            return;
          }
          if (d) {
            y((D) => ({
              ...D,
              connection: "terminal",
              jobStatus: c,
              error: ""
            }));
            return;
          }
          y((D) => ({
            ...D,
            connection: "connecting",
            jobStatus: c,
            error: Vt(v, "正在等待 OCR 版面数据")
          })), await Dn(Mr[Math.min(b, Mr.length - 1)], p.signal).catch(() => {
          }), b += 1;
        }
    };
    return (async () => {
      if (await w(), !g || p.signal.aborted) return;
      let b = 0;
      for (; !p.signal.aborted; ) {
        d || y((v) => ({
          ...v,
          connection: v.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: c,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: v.error
        }));
        try {
          await f.streamEvents(l, {
            afterSeq: s.current.lastSeq,
            signal: p.signal,
            onEvent: async (v) => {
              if (v.seq <= s.current.lastSeq) return;
              let I;
              try {
                I = await xl(
                  l,
                  v,
                  s.current,
                  p.signal,
                  f
                );
              } catch (T) {
                if ((T == null ? void 0 : T.name) === "AbortError" || p.signal.aborted) throw T;
                y((D) => ({
                  ...D,
                  lastSeq: Math.max(D.lastSeq, v.seq),
                  error: Vt(T, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((T) => {
                const D = Nl(T, v, I);
                return d ? {
                  ...D,
                  connection: "terminal",
                  jobStatus: c
                } : {
                  ...D,
                  jobStatus: c
                };
              }), b = 0;
            }
          });
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError" || p.signal.aborted) return;
          y((I) => ({
            ...I,
            connection: d ? "terminal" : "reconnecting",
            jobStatus: c,
            error: Vt(v, "实时译文连接已中断，正在重连")
          }));
        }
        if (p.signal.aborted) return;
        if (d) {
          y((v) => ({
            ...v,
            connection: "terminal",
            jobStatus: c
          }));
          return;
        }
        await Dn(Nr[Math.min(b, Nr.length - 1)], p.signal).catch(() => {
        }), b += 1;
      }
    })(), () => p.abort();
  }, [n, r, l, d]), o;
}
function Ol(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), l = Number(s.count) || 0;
    i && l > 0 && o.set(i, l);
  }
  return o;
}
function $l(e, t = !0) {
  const [n, r] = E(() => /* @__PURE__ */ new Map());
  return C(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = ot().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Ol(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const Fl = 4500;
function Bl(e) {
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
const jl = /* @__PURE__ */ new Set(["book", "translate"]);
function Zo(e) {
  return !!(e.jobId && e.sourceUrl && jl.has(e.workflow));
}
function Hl(e) {
  return !!(Zo(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Ul() {
  const e = hi(), t = Zo({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Hl({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = M({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Ot(o) && (r.current.running = !0);
  const a = zl({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: l, bindShell: c } = yi(), d = $l(e.jobId, !e.sourceOnly), f = Ci({
    documentId: e.documentId,
    jobId: e.jobId
  }), u = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: p, onZoomChange: g } = Fi(e.mode, s, f);
  nl(i, p, g);
  const h = wi(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: p, shellWidth: l, identityKey: u }
  ), {
    beginModeSwitch: y,
    goToPage: w,
    repinIfRestoring: S
  } = vl(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  C(() => {
    S();
  }, [l, S]);
  const b = ul(
    s,
    h.compareMode,
    h.rowSyncRevision,
    S
  ), v = sl(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${p}-${h.metricsTick}`,
    h.primaryPane
  ), I = z(($, W) => {
    var oe, Z;
    const re = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((oe = h.numPagesByPane) == null ? void 0 : oe.source) || 0,
      Number((Z = h.numPagesByPane) == null ? void 0 : Z.translated) || 0
    );
    w($, re, W);
  }, [w, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [T, D] = E(null), F = M(null), j = z(($) => {
    F.current && clearTimeout(F.current), D($), $ && (F.current = setTimeout(() => D(null), Fl));
  }, []);
  C(() => () => {
    F.current && clearTimeout(F.current);
  }, []);
  const N = z(($) => {
    const W = mn(e.regions, $);
    return W ? gr(W, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), R = z(($, W) => {
    const re = W || h.primaryPane, oe = typeof $ == "object" && $ ? `${$.block_id || ""}`.trim() : "", Z = typeof $ == "object" && $ ? `${$.image_url || ""}`.trim() : "", pe = typeof $ == "object" && $ ? $.page_idx != null ? Number($.page_idx) + 1 : $.page != null ? Number($.page) : null : typeof $ == "number" ? $ + 1 : null, ce = Ua(e.regions, Z, pe) || mn(e.regions, oe) || (typeof $ == "object" ? Wa(e.regions, $) : null);
    let ae = ce ? gr(ce, re).page : null;
    ae == null && (ae = Bl($)), !(ae == null || ae < 1) && (j(ce), I(ae, re));
  }, [j, I, h.primaryPane, e.regions]);
  El({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: v,
    goToPage: I,
    resolveBlockPage: N,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: ($) => {
      j(mn(e.regions, $.blockId));
    }
  });
  const { setModeKeepingPage: P } = rl({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  C(() => {
    j(null);
  }, [u, j]);
  const k = !e.boot.loading && !e.boot.failed, A = q(() => ({ bindShell: c, shellEl: i, shellWidth: l, shellRef: s }), [c, i, l, s]), _ = q(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), H = q(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: p,
    onZoomChange: g,
    shell: A,
    panes: h,
    sessionFiles: _,
    rowHeights: b,
    goToPage: I,
    activeRegion: T,
    jumpToAnchor: R,
    setModeKeepingPage: P,
    download: e.download,
    showHud: k,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: d
  }), [e, A, h, _, b, I, T, R, P, k, p, g, f, a, n, d]);
  return q(() => ({
    ...H,
    currentPage: v
  }), [H, v]);
}
const Wl = [
  { action: "mode-source", keys: ["1"], mode: "source" },
  { action: "mode-compare", keys: ["2"], mode: "compare" },
  { action: "mode-translated", keys: ["3"], mode: "translated" },
  { action: "zoom-in", keys: ["+", "="] },
  { action: "zoom-out", keys: ["-", "_"] },
  { action: "zoom-reset", keys: ["0"] },
  { action: "next-page", keys: ["j", "ArrowDown", "PageDown"], requiresPages: !0 },
  { action: "prev-page", keys: ["k", "ArrowUp", "PageUp"], requiresPages: !0 },
  { action: "first-page", keys: ["Home"], requiresPages: !0 },
  { action: "last-page", keys: ["End"], requiresPages: !0 },
  { action: "doc-dark", keys: ["d"] }
], Kl = [
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
      { actions: [], keys: "Ctrl + 滚轮 · 触控板捏合", desc: "以鼠标所在处为中心放大 / 缩小" },
      { actions: [], keys: "点百分比", desc: "重置为模式默认" }
    ]
  },
  {
    title: "显示",
    items: [
      { actions: ["doc-dark"], keys: "D", desc: "深色文档（书页黑底白字），再按一次换回来" }
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
function Vl(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Wl)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Jl(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const ql = ".reader-notes-panel";
function Gl(e) {
  return e instanceof Element ? !!e.closest(ql) : !1;
}
function Zl(e) {
  const {
    mode: t,
    sourceOnly: n,
    setMode: r,
    userZoom: o,
    onZoomChange: a,
    currentPage: s,
    numPages: i,
    goToPage: l,
    toggleDocDark: c,
    enabled: d = !0
  } = e;
  C(() => {
    if (!d)
      return;
    const f = (u) => {
      if (u.defaultPrevented || u.metaKey || u.ctrlKey || u.altKey || Jl(u.target) || Gl(u.target))
        return;
      const p = u.key, g = Vl(p);
      if (g) {
        if (g.mode) {
          if (n && g.mode !== "source")
            return;
          u.preventDefault(), r(g.mode);
          return;
        }
        if (g.action === "doc-dark") {
          if (!c || u.repeat) return;
          u.preventDefault(), c();
          return;
        }
        if (!(g.requiresPages && i <= 0))
          switch (u.preventDefault(), g.action) {
            case "zoom-in":
              a(Ft(o, 1));
              return;
            case "zoom-out":
              a(Ft(o, -1));
              return;
            case "zoom-reset":
              a(Rt(t, tt()));
              return;
            case "next-page":
              l(an(s + 1, i));
              return;
            case "prev-page":
              l(an(s - 1, i));
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
    return window.addEventListener("keydown", f), () => window.removeEventListener("keydown", f);
  }, [
    d,
    t,
    n,
    r,
    o,
    a,
    s,
    i,
    l,
    c
  ]);
}
const Yl = "retainpdf:soft-reader-close";
function Xl() {
  return new URL("./index.html", window.location.href).href;
}
function Ql() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Yl },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function ec(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function tc() {
  if (!(typeof window > "u") && !Ql()) {
    if (ec(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Xl());
  }
}
function nc({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ m("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function rc({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ L(nc, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), tc();
  }, children: [
    /* @__PURE__ */ m(gt, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ m("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const oc = 3e3, ac = 8;
async function sc(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function ic(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function lc(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = oc;
  const r = [], o = (s, i, l) => {
    const c = [];
    for (let d = 0; d < s.length && n > 0; d += 1) {
      const f = s[d], u = ic(f == null ? void 0 : f.title);
      if (!u) continue;
      n -= 1;
      const p = l ? `${l}.${d}` : `${d}`, g = { id: p, title: u, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), c.push(g), i < ac && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, p));
    }
    return c;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await sc(e, i);
  })), a;
}
function cc(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function dc(e, t) {
  let n = null;
  for (const r of cc(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
function Ar(e) {
  if (!e) return [];
  const t = e.split(".");
  return t.slice(0, -1).map((n, r) => t.slice(0, r + 1).join("."));
}
let _r = !1;
function uc() {
  if (_r)
    return;
  const e = $t().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (No.GlobalWorkerOptions.workerSrc = e, _r = !0);
}
function fe(e) {
  return typeof e == "string" ? e : "";
}
function fc(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function mc(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function hc(e) {
  return {
    source: fe(e == null ? void 0 : e.source_text) || fe(e == null ? void 0 : e.unit_source_text),
    translated: fe(e == null ? void 0 : e.protected_translated_text) || fe(e == null ? void 0 : e.translated_text)
  };
}
const pc = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function Yo(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function gc(e) {
  const t = Yo(e).sort((r, o) => fe(r.ts).localeCompare(fe(o.ts)));
  return t.length ? [
    { text: fe(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: fe(r.new_text),
      label: pc[fe(r.source)] || fe(r.source) || "修订",
      ts: fe(r.ts),
      reason: fe(r.reason)
    }))
  ].reverse() : [];
}
function bc(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function yc(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return fe(r.finished_at) || fe(n.finished_at) || "";
}
function vc(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = Yo(e).sort((a, s) => fe(a.ts).localeCompare(fe(s.ts)));
  for (const a of o) {
    const s = new Date(fe(a.ts)).getTime(), i = fe(a.reader_item_id) || fe(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, fe(a.new_text));
  }
  return n;
}
const wc = {
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
function Sc(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = wc[fe(n.kind)] || fe(n.kind) || "问题", o = fe(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const Ic = /* @__PURE__ */ new Set(["text", "formula"]);
function Zn(e) {
  return Ic.has(e);
}
function Rc(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || Zn(Je(n));
}
function Pc(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !Zn(Je(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const kc = 300, Tc = 72;
function Ec(e, t) {
  if (e.width >= kc && e.height >= Tc)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const Mc = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function Nc(e, t, n) {
  return e.flatMap((r) => {
    if (!Mc.has(Je(r.region))) return [];
    const o = cn(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function Lr(e, t, n) {
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
async function Ac(e) {
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
const _c = "reader-text-hover-copy", Lc = "reader-text-hover-edit", Dc = "reader-text-hover-zoom", Cc = "reader-text-hover-id";
function xc(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const Xo = "reader-text-hover-tools";
function Jt({
  className: e,
  state: t,
  label: n,
  title: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ m(
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
const zc = 26, Oc = 220;
function $c(e, t = Oc) {
  return e.height < zc * 2 || e.width < t;
}
function Fc({ state: e }) {
  return /* @__PURE__ */ m(e === "copied" ? Io : e === "failed" ? gt : Xa, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Bc({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [l, c] = E("idle"), [d, f] = E("idle"), [u] = E(() => xc()), p = M([]), g = (e == null ? void 0 : e.itemId) || "";
  if (C(() => {
    c("idle"), f("idle");
    const I = p.current;
    return () => {
      I.forEach((T) => window.clearTimeout(T)), p.current = [];
    };
  }, [g]), !e) return null;
  const h = Ka(e.highlight.region, t), y = Je(e.highlight.region), w = (I, T) => async (D) => {
    D.preventDefault(), D.stopPropagation();
    const F = await Ac(I);
    T(F ? "copied" : "failed"), p.current.push(window.setTimeout(() => T("idle"), 1200));
  }, S = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, v = s || ($c(b) ? "outside" : "inside");
  return /* @__PURE__ */ m("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ m(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": y,
      style: b,
      children: /* @__PURE__ */ L(
        "div",
        {
          className: Xo,
          "data-placement": v,
          style: v === "tail" ? { top: i } : void 0,
          children: [
            u ? /* @__PURE__ */ m(
              Jt,
              {
                className: Cc,
                state: d,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: w(e.itemId, f),
                children: d === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && Zn(y) ? /* @__PURE__ */ m(
              Jt,
              {
                className: Lc,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (I) => {
                  I.preventDefault(), I.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ m(Wn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ m(
              Jt,
              {
                className: _c,
                state: l,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: l === "copied" ? "已复制" : l === "failed" ? "复制失败" : S,
                onClick: w(h, c),
                children: /* @__PURE__ */ m(Fc, { state: l })
              }
            ) : null,
            o ? /* @__PURE__ */ m(
              Jt,
              {
                className: Dc,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (I) => {
                  I.preventDefault(), I.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ m(Ya, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function jc(e, t) {
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
function Hc(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = cn(
      jc(e, a),
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
const Uc = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Wc = 256, Lt = /* @__PURE__ */ new Map();
function Kc(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Qo(e) {
  const t = `${e || ""}`, { text: n, slots: r } = ks(t, { bareLatex: !0 }), o = Kc(n), a = Ts(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Lt.get(t);
  if (!s && (s = Es(o, r), Lt.set(t, s), Lt.size > Wc)) {
    const i = Lt.keys().next().value;
    i !== void 0 && Lt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function gn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ue(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Vc(e, t) {
  const n = e.typography, r = Ue(t) || 1, o = Ue(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = gn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, l = Math.max(5.5 * r, Math.min(s, i * r)), c = Ue(n == null ? void 0 : n.fit_min_font_size_pt), d = Ue(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (c || 5.5) * r), u = Math.max(
    f,
    d ? d * r : o ? o * r : l
  ), p = o ? o * r : l, g = Ue(n == null ? void 0 : n.leading_em), h = [
    Ue(n == null ? void 0 : n.padding_top_pt) || 0,
    Ue(n == null ? void 0 : n.padding_right_pt) || 0,
    Ue(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ue(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Uc,
    fontSizePx: Math.max(f, Math.min(u, p)),
    minFontSizePx: f,
    maxFontSizePx: u,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (gn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : gn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Jc(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (f) => {
    const u = s.get(f);
    if (u !== void 0) return u;
    const { width: p, height: g } = e(f), h = p <= t + 0.5 && g <= n + 0.5;
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
const qc = 512, Dt = /* @__PURE__ */ new Map();
let Cn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Cn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Cn += 1;
}));
function Gc(e, t, n, r) {
  return [
    Cn,
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
function ea({ item: e, pageScale: t }) {
  const n = M(null), r = q(
    () => Qo(e.translatedText),
    [e.translatedText]
  ), [o, a] = E(r.fallbackHtml), s = q(
    () => Vc(e, t),
    [e, t]
  );
  C(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((u) => {
      f && a(u);
    }), () => {
      f = !1;
    };
  }, [r]), Ie(() => {
    const f = n.current;
    if (!f) return;
    const [u, p, g, h] = s.padding, y = Math.max(1, e.rect.width - h - p), w = Math.max(1, e.rect.height - u - g), S = Gc(o, y, w, s);
    let b = Dt.get(S);
    if (b === void 0 && (b = Jc(
      (v) => (f.style.fontSize = `${v}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Dt.set(S, b), Dt.size > qc)) {
      const v = Dt.keys().next().value;
      v !== void 0 && Dt.delete(v);
    }
    f.style.fontSize = `${b.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [i, l, c, d] = s.padding;
  return /* @__PURE__ */ m(
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
      children: /* @__PURE__ */ m(
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
function Zc({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = q(
    () => Hc(e, t, n, r),
    [r, e, t, n]
  );
  return o.length ? /* @__PURE__ */ m(
    "div",
    {
      className: "reader-live-translation-overlay",
      "data-live-translation-page": e == null ? void 0 : e.page_idx,
      "data-live-translation-generation": t == null ? void 0 : t.generation,
      "aria-hidden": "true",
      children: o.map((a) => /* @__PURE__ */ m(
        ea,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Yc = ln(Zc);
function Xc({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ m("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ L("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ m(
        ea,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Je(a.highlight.region),
            sourceText: a.highlight.box.text || "",
            rect: a.rect,
            changedAtSeq: 0,
            changedNow: !1
          },
          pageScale: s > 0 ? n / s : 1
        }
      ),
      /* @__PURE__ */ m("span", { className: "reader-edited-badge", style: { left: a.rect.left, top: a.rect.top }, children: "待排版" })
    ] }, a.itemId);
  }) }) : null;
}
const Qc = ln(Xc), ta = 24, Xe = ta * 2 + 4, We = 24, ed = 4, td = 6, ut = (e) => e.left + e.width, rt = (e) => e.top + e.height;
function Ct(e, t) {
  const n = Math.min(ut(e), ut(t)) - Math.max(e.left, t.left), r = Math.min(rt(e), rt(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Dr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= ut(t) && r >= t.top && r <= rt(t);
}, nd = (e) => e.height > 40 && e.height > e.width * 2.5;
function rd(e, t, n) {
  if (!t.length || e.height < We || e.width < n + 8) return null;
  const r = Math.max(...t.map(rt)), o = ut(e) - 4 - n;
  for (const a of [r, rt(e) - 2]) {
    const s = Math.max(e.top, a - We), i = { left: o, top: s, width: n, height: We };
    if (!t.some((l) => Ct(i, l) > 0)) return s - e.top;
  }
  return null;
}
function od(e, t) {
  const n = [], r = (a) => {
    const s = ta + ed, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: ut(e), top: i, width: s, height: Xe } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: Xe } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - We - 3, width: Xe, height: We + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: rt(e), width: Xe, height: We + 3 } }), r(!0);
  const o = rd(e, t, Xe);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: ut(e) - 4 - Xe, top: e.top + o, width: Xe, height: We } }), n;
}
function ad(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !nd(S)), i = s.filter((S) => Dr(S, t)), l = s.filter((S) => !Dr(S, t)), c = n.filter((S) => S !== t && Ct(S, t) < t.width * t.height * 0.5), d = od(t, i).filter(({ box: S, overhang: b }) => {
    const v = b ? td : 0;
    return S.left >= -v && ut(S) <= r + v && S.top >= 0 && rt(S) <= o;
  }), f = ({ placement: S, tailTop: b }) => b === void 0 ? { placement: S } : { placement: S, tailTop: b }, u = ({ box: S }) => !l.some((b) => Ct(S, b) > 0), p = d.filter((S) => S.placement !== "tail"), g = p.find((S) => u(S) && !c.some((b) => Ct(S.box, b) > 0));
  if (g) return f(g);
  const h = p.find(u) || d.find((S) => S.placement === "tail" && u(S));
  if (h) return f(h);
  let y = null, w = Number.POSITIVE_INFINITY;
  for (const S of d) {
    const b = l.reduce((v, I) => v + Ct(S.box, I), 0);
    b < w && (y = S, w = b);
  }
  return y ? f(y) : { placement: "outside" };
}
function sd(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - We - 3 : rt(r);
  return t >= r.left - 4 && t <= r.left + Xe + 4 && n >= a && n <= a + We + 3;
}
const bn = (e) => e.left + e.width, yn = (e) => e.top + e.height;
function id(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const c of t) {
    if (c.width <= 0 || c.height <= 0) continue;
    const d = c.left + c.width / 2, f = c.top + c.height / 2;
    d < e.left || d > bn(e) || f < e.top || f > yn(e) || (o = Math.min(o, c.left), a = Math.min(a, c.top), s = Math.max(s, bn(c)), i = Math.max(i, yn(c)));
  }
  if (!Number.isFinite(o)) return e;
  const l = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return l.width = Math.min(bn(e) + r, s + n) - l.left, l.height = Math.min(yn(e) + r, i + n) - l.top, l.width * l.height < e.width * e.height * 0.3 && l.height < 24 ? e : l;
}
function ld(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function cd(e, t, n, r) {
  const [o, a] = E(null);
  return Ie(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? ld(s) : [], l = Je(t.highlight.region) === "figure", c = i.length && !l ? id(t.rect, i) : t.rect, d = n.filter((u) => u.itemId !== t.itemId).map((u) => u.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: c, ...ad({ frame: c, others: d, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
const na = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Cr = { pen: 35e-4, highlighter: 0.018 }, xr = 0.015, xn = "retainpdf.reader.ink.v1:";
function zr(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(xn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function dd(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(xn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(xn + e);
    } catch {
    }
}
function ud(e, t, n, r, o, a) {
  const s = xr * xr;
  return e.filter((i) => ra(i, t, n) && i.points.some(([l, c]) => (l - r) ** 2 + ((c - o) * a) ** 2 <= s)).map((i) => i.id);
}
function ra(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function fd(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function md(e) {
  const [t, n] = E(null), [r, o] = E(na[0].key), [a, s] = E(() => zr(e)), i = M(a), l = M([]);
  C(() => {
    const h = zr(e);
    i.current = h, s(h), l.current = [];
  }, [e]);
  const c = z((h) => {
    i.current = h, s(h), dd(e, h);
  }, [e]), d = z((h) => {
    const y = i.current, w = h(y);
    w !== y && (l.current = [...l.current.slice(-49), y], c(w));
  }, [c]), f = z((h) => {
    h.points.length < 1 || d((y) => [...y, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [d]), u = z((h) => {
    h.length && d((y) => y.filter((w) => !h.includes(w.id)));
  }, [d]), p = z((h) => {
    d((y) => y.some((w) => w.page === h) ? y.filter((w) => w.page !== h) : y);
  }, [d]), g = z(() => {
    const h = l.current.pop();
    h && c(h);
  }, [c]);
  return q(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: u, undo: g, clearPage: p }),
    [t, r, a, f, u, g, p]
  );
}
const hd = "reader-ink-layer";
function pd(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function Or({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ m(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: pd(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function gd({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = E(null), i = M(!1), l = o.strokes.filter((h) => ra(h, e, t)), c = !!o.tool;
  if (!c && !l.length) return null;
  const d = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (h, y) => o.erase(ud(o.strokes, e, t, h, y, r / Math.max(1, n))), u = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, w] = d(h);
    o.tool === "eraser" ? f(y, w) : s([[y, w]]);
  }, p = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, w] = d(h);
    o.tool === "eraser" ? f(y, w) : s((S) => S ? fd(S, y, w) : [[y, w]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Cr[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ L(
    "svg",
    {
      className: hd,
      "data-ink-active": c ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: u,
      onPointerMove: p,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        l.map((h) => /* @__PURE__ */ m(Or, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ m(Or, { stroke: { tool: o.tool, color: o.color, width: Cr[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function bd({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = E(null), [i, l] = E(!1), [c, d] = E([]), [f, u] = E(""), [p, g] = E(""), [h, y] = E(!1), [w, S] = E(null), [b, v] = E([]), I = r.drafts, T = r.generation, D = z(async (R, P) => {
    if (e)
      try {
        d(gc(await e.fetchRevisions(R, P)));
      } catch {
        d([]);
      }
  }, [e]);
  C(() => {
    if (s(null), d([]), S(null), v([]), g(""), !e || !t || !n) return;
    let R = !1;
    return l(!0), e.loadItem(t, n).then((P) => {
      if (R) return;
      const k = P == null ? void 0 : P.item;
      if (!k) throw new Error("找不到这一段的译文。");
      const A = `${(P == null ? void 0 : P.item_id) || n}`, { source: _, translated: H } = hc(k);
      s({ readerItemId: n, itemId: A, source: _, current: H }), u(I.get(n) ?? H);
    }).catch((P) => {
      R || S({ tone: "error", message: (P == null ? void 0 : P.message) || "读取这段译文失败。" });
    }).finally(() => {
      R || l(!1);
    }), D(t, n), () => {
      R = !0;
    };
  }, [e, t, n, D]);
  const F = z((R) => {
    u(R), n && I.set(n, R);
  }, [n, I]), j = z(async (R, P) => {
    if (!e || !a || h) return !1;
    const k = R ?? f;
    if (!k.trim()) return !1;
    y(!0), S(null), v([]);
    try {
      const A = await e.revise(t, a.itemId, {
        translated_text: k,
        source: "user",
        reason: (P ?? p).trim() || "在阅读页手动修改",
        ...T.current != null ? { expected_generation: T.current } : {}
      }), _ = Number(A == null ? void 0 : A.generation);
      return Number.isFinite(_) && (T.current = _), I.delete(a.readerItemId), s({ ...a, current: k }), u(k), g(""), (A == null ? void 0 : A.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, k), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), D(t, a.readerItemId), !0;
    } catch (A) {
      const _ = A;
      return (_ == null ? void 0 : _.reason) === "generation_mismatch" && (T.current = null), S({ tone: "error", message: (_ == null ? void 0 : _.message) || "保存失败，请稍后再试。" }), v(Sc(_ == null ? void 0 : _.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, f, p, t, o, D, I, T]), N = z(() => {
    n && I.delete(n);
  }, [n, I]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: c,
    draft: f,
    setDraft: F,
    reason: p,
    setReason: g,
    saving: h,
    status: w,
    issues: b,
    save: j,
    discardDraft: N
  };
}
const oa = "reader-inline-edit";
function yd({ text: e }) {
  const [t, n] = E("");
  return C(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = Qo(e);
      n(a.fallbackHtml), a.richHtml.then((s) => {
        r && n(s);
      });
    }, 250);
    return () => {
      r = !1, window.clearTimeout(o);
    };
  }, [e]), t ? /* @__PURE__ */ L("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ m("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ m("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function vd({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var N;
  const s = e.itemId, i = bd({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [l, c] = E(!1), [d, f] = E(!1), u = M(null), p = Ec(e.rect, t), g = q(() => Pc(o), [o]), h = g.indexOf(s), { loaded: y } = i, w = i.saving || i.loading, S = n.blockedReason, b = !y || i.draft === y.current, { close: v, select: I } = n, T = z((R) => {
    const P = g[h + R];
    P && (I(P), a == null || a(P));
  }, [g, h, I, a]), D = z(() => {
    i.discardDraft(), v();
  }, [i, v]), F = z(async (R, P) => {
    await i.save(R, P) && v();
  }, [i, v]);
  C(() => {
    const R = (P) => {
      !P.altKey || P.key !== "ArrowUp" && P.key !== "ArrowDown" || (P.preventDefault(), T(P.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", R), () => window.removeEventListener("keydown", R);
  }, [T]), Ie(() => {
    const R = u.current;
    if (!R) return;
    R.style.height = "auto";
    const P = p.mode === "inline" ? p.minHeight : 0;
    R.style.height = `${Math.max(P, R.scrollHeight + 2)}px`;
  }, [i.draft, y, p.mode, p.mode === "inline" ? p.minHeight : 0]);
  const j = p.mode === "inline" ? { left: p.left, top: p.top, width: p.width } : { left: p.left, width: p.width, top: p.top, bottom: p.bottom };
  return /* @__PURE__ */ L(pt, { children: [
    p.mode === "popout" ? /* @__PURE__ */ m("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ L(
      "div",
      {
        className: `${oa} is-${p.mode}`,
        style: j,
        role: "group",
        "aria-label": `改第 ${((N = n.target) == null ? void 0 : N.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": p.mode,
        onPointerDown: (R) => R.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ m(
            X,
            {
              className: `reader-inline-edit-source${l ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: l ? "收起原文" : "展开原文",
              onClick: () => c((R) => !R),
              children: y.source
            }
          ) : null,
          S ? /* @__PURE__ */ m("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: S }) : null,
          i.loading ? /* @__PURE__ */ m("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ m(
            Is,
            {
              ref: u,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: w || !!S,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (R) => i.setDraft(R.target.value),
              onKeyDown: (R) => {
                R.key === "Enter" && (R.metaKey || R.ctrlKey) ? (R.preventDefault(), b || F()) : R.key === "Escape" && (R.preventDefault(), D());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ m(yd, { text: i.draft }) : null,
          /* @__PURE__ */ L("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ m(dt, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => T(-1), children: /* @__PURE__ */ m(Qa, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ m(dt, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => T(1), children: /* @__PURE__ */ m(Ro, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ m(
              Mo,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!S || !y,
                onChange: (R) => i.setReason(R.target.value),
                onKeyDown: (R) => {
                  R.key === "Enter" ? (R.preventDefault(), b || F()) : R.key === "Escape" && (R.preventDefault(), D());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ L(
              X,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": d,
                "data-block-edit-action": "history",
                onClick: () => f((R) => !R),
                children: [
                  /* @__PURE__ */ m(es, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ m(X, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: D, children: "取消" }),
            /* @__PURE__ */ m(
              X,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: w || !!S || b || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  F();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ m("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ m("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((R) => /* @__PURE__ */ m("li", { children: R }, R)) }) : null,
          d && y && i.history.length ? /* @__PURE__ */ m("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((R, P) => {
            const k = R.text === y.current, A = [bc(R.ts), R.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ L("li", { "data-block-edit-history": R.label, "data-current": k ? "true" : void 0, children: [
              /* @__PURE__ */ L("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ L("span", { children: [
                  A,
                  k ? "（现在用的）" : "",
                  R.reason ? ` · ${R.reason}` : ""
                ] }),
                k ? null : /* @__PURE__ */ m(
                  X,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!S,
                    onClick: () => {
                      F(R.text, `回到「${A.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ m("p", { className: "reader-inline-edit-history-text", children: R.text })
            ] }, `${R.ts}:${P}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const aa = jn(null), sa = jn(null);
function wd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ m(aa.Provider, { value: e, children: /* @__PURE__ */ m(sa.Provider, { value: t, children: n }) });
}
function qe() {
  return Hn(aa);
}
function ia() {
  return Hn(sa);
}
const et = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Sd = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Id = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Rd = {
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
}, $r = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Pd(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => $r(o ?? a ?? "", Sd)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => $r(o ?? a ?? "", Id)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Rd[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function kd(e) {
  return et(e.translatedBlockText) || et(e.translated.text) || et(e.source.text);
}
const Td = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Ed(e) {
  const t = [];
  for (const n of e) {
    if (!Td(n)) continue;
    const r = Pd(kd(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Md(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Nd = 24, Ad = 60;
function Fr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Nd), o = Math.min(e.length, n + t.length + Ad), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function _d(e, t, n = 200) {
  const r = et(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = et(a.translatedBlockText) || et(a.translated.text), l = i ? Fr(i, r) : null, c = l ?? Fr(et(a.source.text), r);
    if (c && (o.push({ itemId: a.itemId, page: s, side: l ? "translated" : "source", ...c }), o.length >= n))
      break;
  }
  return o;
}
function qt(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Ld(e, t) {
  const n = et(t).toLowerCase();
  if (!n || !e) return qt(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${qt(e.slice(a, s))}<mark class="reader-find-mark">${qt(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + qt(e.slice(a));
}
function Dd(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const la = 1.414;
function Cd({
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
  hoveredRegionId: p,
  onHoverRegion: g,
  liveTranslationLayout: h,
  liveTranslationPage: y,
  showLiveTranslation: w = r === "source",
  liveTranslationMissing: S = !1
}) {
  var ke, ne;
  const b = qe(), v = b == null ? void 0 : b.revisedBlocks, I = b == null ? void 0 : b.blockEdit, T = I == null ? void 0 : I.pendingEdits, D = b == null ? void 0 : b.editBlock, F = (b == null ? void 0 : b.findTerm) || "", j = q(
    () => F ? ({ str: B }) => Ld(B, F) : void 0,
    [F]
  ), N = M(l ?? la), [R, P] = E(N.current);
  C(() => {
    l != null && Math.abs(l - N.current) >= 1e-3 && (N.current = l, P(l));
  }, [l]);
  const k = M(d);
  k.current = d;
  const A = M(null), _ = M((B) => {
    var Y;
    A.current = B, (Y = k.current) == null || Y.call(k, B);
  }).current, H = M(null), $ = M(`${t}@${n}`);
  Ie(() => {
    const B = `${t}@${n}`;
    $.current !== B && ($.current = B, o && zd(A.current, H.current));
  }, [o, n, t]), C(() => {
    o || vn(H.current);
  }, [o]), C(() => () => vn(H.current), []);
  const W = Math.max(120, Math.floor(t * R)), re = Math.max(W, Math.ceil(s || 0)), oe = cn(f, t, W), Z = q(
    () => Nc(u, t, W),
    [W, u, t]
  ), [pe, ce] = E(null), ae = typeof g == "function", Me = ae ? p ?? null : pe, ee = (B) => {
    ae ? B !== (p ?? null) && (g == null || g(B)) : ce((Y) => Y === B ? Y : B);
  }, Q = q(
    () => Z.find((B) => B.itemId === Me) || null,
    [Me, Z]
  ), ge = r === "translated" && ((ke = I == null ? void 0 : I.target) == null ? void 0 : ke.itemId) || "", ue = q(
    () => ge && Z.find((B) => B.itemId === ge) || null,
    [ge, Z]
  ), he = cd(A, o ? Q : null, Z, t), Ne = (B) => {
    var Ae, Re, De, me, $e;
    if (B.pointerType === "touch") return;
    if ((Ae = b == null ? void 0 : b.ink) != null && Ae.tool) {
      ee(null);
      return;
    }
    if (B.buttons !== 0) {
      ee(null);
      return;
    }
    if ((De = (Re = B.target) == null ? void 0 : Re.closest) != null && De.call(Re, `.${Xo}`) || ($e = (me = B.target) == null ? void 0 : me.closest) != null && $e.call(me, `.${oa}`)) return;
    const Y = B.currentTarget.getBoundingClientRect(), te = B.clientX - Y.left, de = B.clientY - Y.top;
    if (sd(he, te, de)) return;
    const le = Lr(Z, te, de);
    ee((le == null ? void 0 : le.itemId) || null);
  }, Oe = (B) => {
    if (B.pointerType === "mouse") return;
    const Y = B.currentTarget.getBoundingClientRect(), te = Lr(
      Z,
      B.clientX - Y.left,
      B.clientY - Y.top
    );
    ee((te == null ? void 0 : te.itemId) || null);
  }, at = (B) => {
    !Number.isFinite(B) || B <= 0 || Math.abs(N.current - B) < 1e-3 || (N.current = B, P(B), c == null || c(e, B));
  };
  return /* @__PURE__ */ L(
    "div",
    {
      ref: _,
      [Ee]: e,
      [we]: r,
      [Kn]: W,
      className: Vn,
      onPointerMoveCapture: Ne,
      onPointerDown: Oe,
      onDoubleClick: (B) => {
        var te;
        const Y = b == null ? void 0 : b.zoomBlock;
        !Y || (te = b == null ? void 0 : b.ink) != null && te.tool || !Q || Je(Q.highlight.region) === "figure" && (B.preventDefault(), Y(Q.itemId));
      },
      onPointerLeave: (B) => {
        B.pointerType === "mouse" && ee(null);
      },
      style: {
        width: t,
        height: re,
        minHeight: re
      },
      children: [
        o ? /* @__PURE__ */ m(
          Rs,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: j,
            renderAnnotationLayer: !1,
            className: Co,
            loading: /* @__PURE__ */ m(
              "div",
              {
                className: tn,
                style: { width: t, height: W }
              }
            ),
            onLoadSuccess: (B) => {
              try {
                const Y = B.getViewport({ scale: 1 });
                if (Y.width > 0) {
                  const te = Y.height / Y.width;
                  at(te);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              vn(H.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ m(
          "div",
          {
            className: tn,
            style: { width: t, height: W },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ m("div", { ref: H, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        oe ? /* @__PURE__ */ m(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: oe,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ m(
          Yc,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: W
          }
        ) : null,
        o && w && S ? /* @__PURE__ */ m("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (T != null && T.size) ? /* @__PURE__ */ m(Qc, { targets: Z, edits: T, width: t, excludeId: ue == null ? void 0 : ue.itemId }) : null,
        o && ue && I ? /* @__PURE__ */ m(
          vd,
          {
            target: ue,
            page: { width: t, height: W },
            edit: I,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (v != null && v.size) ? /* @__PURE__ */ m("div", { className: "reader-revised-markers", "aria-hidden": "true", children: Z.filter((B) => v.has(B.itemId)).map((B) => /* @__PURE__ */ m(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": B.itemId,
            style: { left: B.rect.left, top: B.rect.top, height: B.rect.height }
          },
          B.itemId
        )) }) : null,
        o && (b != null && b.ink) ? /* @__PURE__ */ m(
          gd,
          {
            page: e,
            pane: r === "translated" ? "translated" : b.compareVersion ? "compare" : "source",
            width: t,
            height: W,
            ink: b.ink
          }
        ) : null,
        /* @__PURE__ */ m(
          Bc,
          {
            target: o && !((ne = b == null ? void 0 : b.ink) != null && ne.tool) && (Q == null ? void 0 : Q.itemId) !== (ue == null ? void 0 : ue.itemId) ? Q : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: Q && (v == null ? void 0 : v.get(Q.itemId)) || 0,
            onEdit: D,
            onZoom: b == null ? void 0 : b.zoomBlock,
            frameRect: he == null ? void 0 : he.rect,
            placement: he == null ? void 0 : he.placement,
            tailTop: he == null ? void 0 : he.tailTop
          }
        )
      ]
    }
  );
}
const xd = ln(Cd);
function zd(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function vn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const Od = 2 * 1024 * 1024;
function $d(e) {
  const t = new No.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const wn = 5, Fd = "120% 0px", Bd = 120, jd = "25% 0px";
let Br = 1;
const jr = /* @__PURE__ */ new WeakMap();
function Hd(e) {
  if (!e) return 0;
  const t = jr.get(e);
  if (t) return t;
  const n = Br;
  return Br += 1, jr.set(e, n), n;
}
function Ud() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Wd = yo(
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
    onOutline: u,
    onDocument: p,
    onLoadError: g,
    onNumPagesChange: h,
    activeRegion: y = null,
    regions: w = [],
    readerMetadata: S = null,
    hoveredRegionId: b = null,
    onHoverRegion: v,
    liveTranslation: I,
    showLiveTranslation: T = t === "source",
    liveTranslationPendingLabel: D = "",
    paneAction: F
  }, j) {
    uc();
    const { file: N, loading: R, error: P } = li(n, r), k = `${n}\0${Hd(N)}`, A = M(k);
    A.current = k;
    const _ = q(() => {
      const O = ni(N);
      return O ? "ranged" in O ? { range: $d(O.ranged) } : O : null;
    }, [N, n]), [H, $] = E(0), [W, re] = E(""), [oe, Z] = E(null), [pe, ce] = E(480), ae = M(null), Me = M(0), ee = q(() => Ud(), []), Q = q(() => ({
      cMapUrl: $t().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: $t().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: Od,
      disableAutoFetch: !0
    }), []);
    Un(j, () => oe, [oe]), C(() => {
      const O = (K) => {
        Me.current = K, ce(K);
      }, V = (K) => {
        const x = Ai(K, Me.current);
        if (x !== "ignore") {
          if (ae.current && clearTimeout(ae.current), x === "immediate") {
            O(K);
            return;
          }
          ae.current = setTimeout(() => O(K), Fo);
        }
      }, J = !!(l && l >= 80);
      V(J ? l : (i == null ? void 0 : i.clientWidth) || 0);
      const se = !J && i && typeof ResizeObserver < "u" ? new ResizeObserver((K) => {
        var x, U;
        V(((U = (x = K[0]) == null ? void 0 : x.contentRect) == null ? void 0 : U.width) ?? i.clientWidth);
      }) : null;
      return se && i && se.observe(i), () => {
        se == null || se.disconnect(), ae.current && clearTimeout(ae.current);
      };
    }, [l, i, a]);
    const ge = q(
      () => Ei(pe, o),
      [pe, o]
    ), [ue, he] = E(() => /* @__PURE__ */ new Map()), [Ne, Oe] = E(() => /* @__PURE__ */ new Set()), [at, ke] = E(() => /* @__PURE__ */ new Set()), ne = M(/* @__PURE__ */ new Map()), B = M(null), Y = M(null), [te, de] = E(() => /* @__PURE__ */ new Set()), le = M(/* @__PURE__ */ new Map()), Ae = z((O, V) => {
      he((J) => {
        if (J.get(O) === V) return J;
        const G = new Map(J);
        return G.set(O, V), G;
      });
    }, []), Re = z((O, V) => {
      const J = ne.current, G = J.get(O), se = [B.current, Y.current];
      if (G)
        for (const K of se)
          try {
            K == null || K.unobserve(G);
          } catch {
          }
      if (V) {
        J.set(O, V);
        for (const K of se)
          try {
            K == null || K.observe(V);
          } catch {
          }
      } else
        J.delete(O);
    }, []), De = M(/* @__PURE__ */ new Map()), me = z((O) => {
      const V = De.current;
      let J = V.get(O);
      return J || (J = (G) => Re(O, G), V.set(O, J)), J;
    }, [Re]);
    C(() => {
      if (typeof IntersectionObserver > "u") return;
      const O = le.current, V = new IntersectionObserver(
        (J) => {
          const G = [], se = [];
          for (const K of J) {
            const x = K.target, U = rn(x);
            Number.isFinite(U) && (K.isIntersecting ? G : se).push(U);
          }
          if ((G.length || se.length) && Oe((K) => {
            let x = null;
            for (const U of G)
              K.has(U) || (x = x || new Set(K), x.add(U));
            for (const U of se)
              K.has(U) && (x = x || new Set(K), x.delete(U));
            return x || K;
          }), G.length) {
            for (const K of G) {
              const x = O.get(K);
              x && (clearTimeout(x), O.delete(K));
            }
            ke((K) => {
              let x = null;
              for (const U of G)
                K.has(U) || (x = x || new Set(K), x.add(U));
              return x || K;
            });
          }
          for (const K of se)
            O.has(K) || O.set(K, setTimeout(() => {
              O.delete(K), ke((x) => {
                if (!x.has(K)) return x;
                const U = new Set(x);
                return U.delete(K), U;
              });
            }, Bd));
        },
        { root: i, rootMargin: Fd, threshold: 0 }
      );
      B.current = V;
      for (const J of ne.current.values())
        try {
          V.observe(J);
        } catch {
        }
      return () => {
        V.disconnect(), B.current === V && (B.current = null);
        for (const J of O.values()) clearTimeout(J);
        O.clear();
      };
    }, [i]), C(() => {
      if (typeof IntersectionObserver > "u") return;
      const O = new IntersectionObserver(
        (V) => {
          de((J) => {
            let G = null;
            for (const se of V) {
              const K = rn(se.target);
              !Number.isFinite(K) || se.isIntersecting === J.has(K) || (G = G || new Set(J), se.isIntersecting ? G.add(K) : G.delete(K));
            }
            return G || J;
          });
        },
        { root: i, rootMargin: jd, threshold: 0 }
      );
      Y.current = O;
      for (const V of ne.current.values())
        try {
          O.observe(V);
        } catch {
        }
      return () => {
        O.disconnect(), Y.current === O && (Y.current = null);
      };
    }, [i]);
    const $e = !!i && typeof IntersectionObserver < "u";
    Ie(() => {
      $(0), re(""), Oe(/* @__PURE__ */ new Set()), ke(/* @__PURE__ */ new Set()), he(/* @__PURE__ */ new Map()), ne.current.clear();
      const O = le.current;
      for (const V of O.values()) clearTimeout(V);
      O.clear(), h == null || h(0, t);
    }, [k, h, t]);
    const st = z(
      (O) => {
        if (A.current !== k) return;
        const V = O.numPages;
        $(V), re(""), h == null || h(V, t), f == null || f({ numPages: V, pane: t }), p && typeof O.getPage == "function" && p(O, t), u && typeof O.getOutline == "function" && lc(O).then((J) => {
          A.current === k && u(J, t);
        }, () => {
        });
      },
      [k, f, u, p, h, t]
    ), Ge = z(
      (O) => {
        if (A.current !== k) return;
        const V = (O == null ? void 0 : O.message) || "PDF 解析失败";
        re(V), $(0), h == null || h(0, t), g == null || g(O, t);
      },
      [k, g, h, t]
    ), Pe = q(
      () => H > 0 ? Array.from({ length: H }, (O, V) => V + 1) : [],
      [H]
    );
    C(() => {
      typeof IntersectionObserver < "u" || ke(new Set(Pe));
    }, [Pe]);
    const ye = q(
      () => kn(y, S, t),
      [y, S, t]
    ), Ze = q(() => {
      const O = /* @__PURE__ */ new Map();
      for (const V of w) {
        const J = kn(V, S, t);
        if (!J) continue;
        const G = O.get(J.box.page) || [];
        G.push(J), O.set(J.box.page, G);
      }
      return O;
    }, [t, S, w]), Fe = q(() => {
      const O = /* @__PURE__ */ new Set();
      if (!b) return O;
      for (const [V, J] of Ze)
        J.some((G) => G.itemId === b) && O.add(V);
      return O;
    }, [b, Ze]), vt = q(() => {
      if (H === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Pe);
      if (Ne.size === 0) {
        const J = Math.min(H, wn * 2 + 1);
        return new Set(Array.from({ length: J }, (G, se) => se + 1));
      }
      const V = /* @__PURE__ */ new Set();
      for (const J of Ne)
        for (let G = -wn; G <= wn; G++) {
          const se = J + G;
          se >= 1 && se <= H && V.add(se);
        }
      return V;
    }, [H, Pe, i, a, Ne]), Se = !n || !!P || !!W, it = n && (P || W) || s;
    return /* @__PURE__ */ L(
      "section",
      {
        ref: Z,
        className: `reader-panel ${dn}${a ? "" : " is-hidden"}`,
        [we]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (I == null ? void 0 : I.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          F ? /* @__PURE__ */ m("div", { className: "reader-react-pdf-pane-action", children: F }) : null,
          D ? /* @__PURE__ */ L("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ m("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ m("span", { children: D })
          ] }) : null,
          Se && !R ? /* @__PURE__ */ m("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: it }) : null,
          R ? /* @__PURE__ */ m("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          _ && !P ? /* @__PURE__ */ m("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ m(
            Ps,
            {
              file: _,
              loading: null,
              error: null,
              options: Q,
              onLoadSuccess: st,
              onLoadError: Ge,
              className: "reader-react-pdf-document",
              children: Pe.map((O) => {
                if (vt.has(O))
                  return /* @__PURE__ */ m(
                    xd,
                    {
                      pane: t,
                      pageNumber: O,
                      width: ge,
                      devicePixelRatio: ee,
                      active: at.has(O),
                      textLayer: !$e || te.has(O),
                      syncedMinHeight: (c == null ? void 0 : c.get(O)) || 0,
                      onMetrics: d,
                      cachedAspect: ue.get(O),
                      onAspectChange: Ae,
                      sentinelRef: me(O),
                      regionHighlight: (ye == null ? void 0 : ye.box.page) === O ? ye : null,
                      regionTargets: Ze.get(O),
                      hoveredRegionId: b && Fe.has(O) ? b : null,
                      onHoverRegion: v,
                      liveTranslationLayout: I == null ? void 0 : I.layoutByPage.get(O - 1),
                      liveTranslationPage: I == null ? void 0 : I.pagesByPage.get(O - 1),
                      showLiveTranslation: T,
                      liveTranslationMissing: Ll(I, O - 1)
                    },
                    `${t}-${O}`
                  );
                const J = ue.get(O) ?? la, G = Math.max(120, Math.floor(ge * J)), se = Math.max(G, Math.ceil((c == null ? void 0 : c.get(O)) || 0));
                return /* @__PURE__ */ m(
                  "div",
                  {
                    ref: me(O),
                    [Ee]: O,
                    [we]: t,
                    [Kn]: G,
                    className: `${Vn} is-placeholder`,
                    style: {
                      width: ge,
                      height: se,
                      minHeight: se
                    },
                    children: /* @__PURE__ */ m(
                      "div",
                      {
                        className: tn,
                        style: { width: ge, height: G },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${O}`
                );
              })
            },
            k
          ) }) : null
        ]
      }
    );
  }
), Hr = ln(Wd), Kd = 2e3, Vd = 6, Jd = 500, Ur = "reader-react-resizing";
function qd(e, t) {
  const n = M(null), r = M(null);
  Ie(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const v = Gd(e), I = Yt(e, v);
      if (!I) return;
      s = { pane: v, progress: I, started: performance.now() };
    }
    const { pane: i, progress: l, started: c } = s;
    let d = 0, f = null, u = e.scrollHeight, p = u, g = 0, h = c;
    const y = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((v) => {
      let I = !1;
      for (const T of v) {
        const D = Math.round(T.contentRect.height);
        y.has(T.target) && y.get(T.target) !== D && (I = !0), y.set(T.target, D);
      }
      I && Bt(e, l, "auto", i);
    }), S = () => {
      var v;
      f && clearTimeout(f), cancelAnimationFrame(d), w == null || w.disconnect(), e.classList.remove(Ur);
      for (const I of Wr) e.removeEventListener(I, S);
      ((v = r.current) == null ? void 0 : v.stop) === S && (r.current = null);
    }, b = () => {
      Bt(e, l, "auto", i);
      const v = e.scrollHeight;
      g = v === p ? g + 1 : 0, p = v;
      const I = performance.now() - h;
      g >= Vd && (v !== u || I > Jd) || I > Kd ? S() : d = requestAnimationFrame(b);
    };
    for (const v of Wr) e.addEventListener(v, S, { passive: !0 });
    for (const v of Array.from(e.children)) w == null || w.observe(v);
    e.classList.add(Ur), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, h = performance.now(), u = e.scrollHeight, p = u, g = 0, d = requestAnimationFrame(b);
    }, Fo);
  }, [e, t]), C(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Gd(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Ee}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(we) || null;
  }
  return null;
}
const Wr = ["wheel", "touchstart", "keydown", "pointerdown"];
function Zd(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function Yd(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(dn)) && ((n = e.hasAttribute) != null && n.call(e, we)));
}
function Xd(e, t) {
  C(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!Yd(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${dn}[${we}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const l = Zd(a, i);
        if (l === null || Math.abs(i.scrollLeft - l) < 1) continue;
        const c = i.scrollLeft;
        i.scrollLeft = l, Math.abs(i.scrollLeft - c) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Qd(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), l = t - i, c = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: l * c };
}
function eu(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const Kr = 12;
function Yn(e) {
  return Array.from(e.querySelectorAll(`.${dn}[${we}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function tu(e) {
  const t = e.getBoundingClientRect();
  return Yn(e).map((n) => {
    const r = n.getBoundingClientRect();
    return {
      pane: n.getAttribute(we) || "",
      left: r.left - t.left,
      width: n.clientWidth,
      scrollWidth: n.scrollWidth,
      scrollLeft: n.scrollLeft
    };
  });
}
function nu(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function ru(e, t) {
  return e ? Yn(e).find((n) => n.getAttribute(we) === t) ?? null : null;
}
function ou({ shellEl: e }) {
  const [t, n] = E([]), r = M(0), o = z(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = tu(e);
      n((i) => nu(i, s) ? i : s);
    }));
  }, [e]);
  C(() => {
    if (!e) return;
    o();
    const s = e.ownerDocument.defaultView;
    e.addEventListener("scroll", o, { capture: !0, passive: !0 });
    const i = s && typeof s.ResizeObserver < "u" ? new s.ResizeObserver(o) : null, l = () => {
      if (i) {
        i.disconnect(), i.observe(e);
        for (const f of Yn(e))
          i.observe(f), f.firstElementChild && i.observe(f.firstElementChild);
      }
    };
    l();
    const c = s && typeof s.MutationObserver < "u" ? new s.MutationObserver(() => {
      l(), o();
    }) : null, d = e.firstElementChild;
    return c && d && c.observe(d, { childList: !0, attributes: !0, attributeFilter: ["class"], subtree: !1 }), () => {
      e.removeEventListener("scroll", o, { capture: !0 }), i == null || i.disconnect(), c == null || c.disconnect(), r.current && cancelAnimationFrame(r.current), r.current = 0;
    };
  }, [e, o]);
  const a = t.filter((s) => s.scrollWidth - s.width > 1);
  return a.length ? /* @__PURE__ */ m("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ m(au, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function au({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - Kr * 2), r = Qd(e, n), o = M(null);
  if (!r) return null;
  const a = (u) => {
    const p = ru(t, e.pane);
    p && (p.scrollLeft = u);
  }, s = (u) => {
    var p, g;
    u.button === 0 && (u.preventDefault(), u.stopPropagation(), (g = (p = u.currentTarget).setPointerCapture) == null || g.call(p, u.pointerId), o.current = { startX: u.clientX, startScroll: e.scrollLeft, pointerId: u.pointerId });
  }, i = (u) => {
    const p = o.current;
    !p || p.pointerId !== u.pointerId || a(p.startScroll + eu(e, n, r.size, u.clientX - p.startX));
  }, l = (u) => {
    var p, g, h;
    ((p = o.current) == null ? void 0 : p.pointerId) === u.pointerId && (o.current = null, (h = (g = u.currentTarget).releasePointerCapture) == null || h.call(g, u.pointerId));
  }, c = (u) => {
    if (u.button !== 0 || u.target !== u.currentTarget) return;
    u.preventDefault();
    const p = u.currentTarget.getBoundingClientRect(), g = u.clientX - p.left, h = e.width * 0.8;
    a(e.scrollLeft + (g < r.offset ? -h : h));
  }, d = e.pane === "translated" ? "译文栏左右滚动" : "原文栏左右滚动", f = Math.max(0, e.scrollWidth - e.width);
  return /* @__PURE__ */ m(
    "div",
    {
      className: "reader-pane-scrollbar",
      "data-reader-pane-scrollbar": e.pane,
      role: "scrollbar",
      "aria-label": d,
      "aria-orientation": "horizontal",
      "aria-valuemin": 0,
      "aria-valuemax": Math.round(f),
      "aria-valuenow": Math.round(e.scrollLeft),
      style: { left: e.left + Kr, width: n },
      onPointerDown: c,
      children: /* @__PURE__ */ m(
        "div",
        {
          className: "reader-pane-scrollbar-thumb",
          style: { width: r.size, transform: `translateX(${r.offset}px)` },
          onPointerDown: s,
          onPointerMove: i,
          onPointerUp: l,
          onPointerCancel: l
        }
      )
    }
  );
}
function ca(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function su(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function iu({ compare: e, onDone: t }) {
  return /* @__PURE__ */ L("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ m("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ m("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ m("li", { children: /* @__PURE__ */ L(
        X,
        {
          className: "reader-version-compare-item",
          "data-version-id": n.versionId,
          "aria-current": o ? "true" : void 0,
          disabled: r,
          onClick: () => {
            e.choose(n.versionId), t();
          },
          children: [
            /* @__PURE__ */ m("span", { className: "reader-version-compare-name", children: n.name }),
            /* @__PURE__ */ m("span", { className: "reader-version-compare-time", children: ca(n.createdAt) }),
            r ? /* @__PURE__ */ m("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ m(Io, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ m(ts, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ m("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ L("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ L(
        X,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ m(ns, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ L(
        X,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ m(rs, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function Vr({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = su(t), a = [e === "compare" ? "对比" : "正在读", r, ca(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ L("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ m("em", { children: "RetainPDF" }),
    /* @__PURE__ */ m("strong", { children: o }),
    /* @__PURE__ */ m("span", { children: a })
  ] });
}
function lu({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = E({ source: null, translated: null });
  return Ie(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), l = (c) => {
        const d = e.querySelector(`[${we}="${c}"]`), f = d == null ? void 0 : d.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: l("source"), translated: l("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${we}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ L("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ m("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ m(Vr, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ m("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ m(Vr, { role: "reading", ...n }) }) : null
  ] });
}
const cu = () => () => {
}, Jr = () => null;
function du({
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
function uu(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function fu(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function mu(e) {
  const t = qe(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", l = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, c = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), d = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), u = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, p = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Wt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, v = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", I = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", T = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, D = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, F = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), j = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), N = t == null ? void 0 : t.onPdfOutline, R = t == null ? void 0 : t.onPdfDocument, P = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), k = e.regions ?? (t == null ? void 0 : t.regions) ?? [], A = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), _ = (t == null ? void 0 : t.regionHover) ?? null, [H, $] = E(null), W = vo(
    _ ? _.subscribe : cu,
    _ ? () => _.get().itemId : Jr,
    _ ? () => _.get().itemId : Jr
  ), re = _ ? W : H, oe = z((ae) => {
    _ ? _.set(ae, "pdf") : $(ae);
  }, [_]), Z = du({
    mode: s,
    compareMode: i,
    showSource: l,
    showTranslated: c,
    markdownSplit: n,
    overlayOnSource: d
  }), ce = Number.isFinite(g) && g > 0 ? uu(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return qd(u, ce), Xd(u, Z.compareMode), /* @__PURE__ */ L(
    "div",
    {
      ref: f,
      className: Do,
      "data-reader-region-count": k.length,
      "data-reader-structured-region-count": k.filter(Va).length,
      "data-reader-metadata-ready": A ? "true" : "false",
      children: [
        /* @__PURE__ */ L(
          "main",
          {
            className: `${Lo} reader-mode-${Z.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ m(
                Hr,
                {
                  pane: "source",
                  url: v,
                  preloadedFile: T,
                  userZoom: p,
                  visible: Z.showSource,
                  scrollRoot: u,
                  pageWidthOverride: ce,
                  rowHeights: Z.compareMode ? h : void 0,
                  onMetrics: F,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: j,
                  onOutline: b ? void 0 : N,
                  onDocument: b ? void 0 : R,
                  activeRegion: P,
                  regions: (b == null ? void 0 : b.regions) ?? k,
                  readerMetadata: A,
                  hoveredRegionId: re,
                  onHoverRegion: oe,
                  liveTranslation: d ? o : void 0,
                  showLiveTranslation: d,
                  liveTranslationPendingLabel: d ? fu(o) : "",
                  paneAction: d && Z.showTranslated ? /* @__PURE__ */ L(pt, { children: [
                    e.sourcePaneAction,
                    /* @__PURE__ */ m(
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
                b ? `compare:${b.url}` : "source"
              ) : null,
              w ? /* @__PURE__ */ m(
                Hr,
                {
                  pane: "translated",
                  url: I,
                  preloadedFile: D,
                  userZoom: p,
                  visible: Z.showTranslated,
                  scrollRoot: u,
                  pageWidthOverride: ce,
                  rowHeights: Z.compareMode ? h : void 0,
                  onMetrics: F,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: j,
                  onOutline: N,
                  onDocument: R,
                  activeRegion: P,
                  regions: k,
                  readerMetadata: A,
                  hoveredRegionId: re,
                  onHoverRegion: oe,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ m(ou, { shellEl: u }),
        b ? /* @__PURE__ */ m(lu, { shellEl: u, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const hu = [
  { id: "source", label: "原文", Icon: Po },
  { id: "compare", label: "对照", Icon: ko },
  { id: "translated", label: "译文", Icon: To }
];
function pu(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function gu(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function bu(e) {
  const t = qe(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, l = a ? pu(a.state) : "";
  return /* @__PURE__ */ L("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ m("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ m("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ L("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ m("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: hu.map(({ id: c, label: d, Icon: f }) => {
        const u = n === c, p = gu({
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
            title: p ? `${d} 需要文档任务` : d,
            disabled: p,
            onClick: () => o(c),
            children: [
              /* @__PURE__ */ m(f, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ m("span", { className: "reader-workspace-tab-label", children: d })
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
              /* @__PURE__ */ m(os, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ m("span", { className: "reader-live-translation-toggle-label", children: l })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ L(
          X,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ m(as, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ m("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ m("div", { className: "reader-live-strip", children: /* @__PURE__ */ L(
        X,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ m(ss, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ m("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const yu = yo(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
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
        /* @__PURE__ */ m("rect", { x: "2", y: "5", width: "20", height: "14", rx: "2.5" }),
        /* @__PURE__ */ m("path", { d: "M6 15V9l2.5 3L11 9v6" }),
        /* @__PURE__ */ m("path", { d: "M16.5 9v6M14.5 13l2 2 2-2" })
      ]
    }
  );
}), vu = yu, wu = {
  markdown: { label: "Markdown", short: "MD", Icon: vu, needsJob: !0 }
}, Su = Bo.map(
  (e) => ({ id: e, ...wu[e] })
);
function da() {
  return Su.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function Iu(e) {
  const t = qe(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ m(pt, { children: da().map(({ id: s, label: i, Icon: l, needsJob: c }) => {
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
          /* @__PURE__ */ m(l, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
          /* @__PURE__ */ m("span", { className: "reader-panel-toggle-label", "aria-hidden": "true", children: i })
        ]
      },
      s
    );
  }) });
}
function Ru(e) {
  const t = qe(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = da().map(({ id: l, label: c, short: d, Icon: f, needsJob: u }) => ({
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
    /* @__PURE__ */ m("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: l, label: c, Icon: d, disabled: f, selected: u, badge: p, onClick: g }) => /* @__PURE__ */ L(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": u,
        className: `reader-assistant-dock-tab${u ? " is-active" : ""}`,
        title: f ? `${c} 需打开任务阅读` : c,
        disabled: f,
        onClick: g,
        children: [
          /* @__PURE__ */ m(d, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ m("span", { className: "reader-assistant-dock-tab-label", children: c }),
          p ? /* @__PURE__ */ m("span", { className: "reader-assistant-dock-badge", children: p }) : null
        ]
      },
      l
    )) }),
    /* @__PURE__ */ m(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ m(gt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function Pu(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function ku(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Tu(e) {
  return e / 100 * window.innerHeight;
}
function Eu(e) {
  return e / 100 * window.innerWidth;
}
function Mu(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function xt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Mu(n);
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
      r = ku(t, o);
      break;
    }
    case "em": {
      r = Pu(t, o);
      break;
    }
    case "vh": {
      r = Tu(o);
      break;
    }
    case "vw": {
      r = Eu(o);
      break;
    }
  }
  return r;
}
function ve(e) {
  return parseFloat(e.toFixed(3));
}
function Et({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function zn(e) {
  const { panels: t } = e, n = Et({ group: e });
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
      const d = xt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = ve(d / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const d = xt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = ve(d / n * 100);
    }
    let l = 0;
    if (a.minSize !== void 0) {
      const d = xt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      l = ve(d / n * 100);
    }
    let c = 100;
    if (a.maxSize !== void 0) {
      const d = xt({
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
function ie(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function On(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Nu : Au
  );
}
function Nu(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Au(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function ua(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function fa(e, t) {
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
function _u({
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
    const { x: i, y: l } = fa(r, s), c = e === "horizontal" ? i : l;
    c < a && (a = c, o = s);
  }
  return ie(o, "No rect found"), o;
}
let Gt;
function Lu() {
  return Gt === void 0 && (typeof matchMedia == "function" ? Gt = !!matchMedia("(pointer:coarse)").matches : Gt = !1), Gt;
}
function ma(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = On(
    n,
    Array.from(t.children).filter(ua).map((g) => ({ element: g }))
  ).map(({ element: g }) => g), s = [];
  let i = !1, l = !1, c = -1, d = -1, f = 0, u, p = [];
  {
    let g = -1;
    for (const h of a)
      h.hasAttribute("data-panel") && (g++, h.hasAttribute("data-disabled") || (f++, c === -1 && (c = g), d = g));
  }
  if (f > 1) {
    let g = -1;
    for (const h of a)
      if (h.hasAttribute("data-panel")) {
        g++;
        const y = r.find(
          (w) => w.element === h
        );
        if (y) {
          if (u) {
            const w = u.element.getBoundingClientRect(), S = h.getBoundingClientRect();
            let b;
            if (l) {
              const v = n === "horizontal" ? new DOMRect(
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
              switch (p.length) {
                case 0: {
                  b = [
                    v,
                    I
                  ];
                  break;
                }
                case 1: {
                  const T = p[0], D = _u({
                    orientation: n,
                    rects: [w, S],
                    targetRect: T.element.getBoundingClientRect()
                  });
                  b = [
                    T,
                    D === w ? I : v
                  ];
                  break;
                }
                default: {
                  b = p;
                  break;
                }
              }
            } else
              p.length ? b = p : b = [
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
            for (const v of b) {
              let I = "width" in v ? v : v.element.getBoundingClientRect();
              const T = Lu() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (I.width < T) {
                const F = T - I.width;
                I = new DOMRect(
                  I.x - F / 2,
                  I.y,
                  I.width + F,
                  I.height
                );
              }
              if (I.height < T) {
                const F = T - I.height;
                I = new DOMRect(
                  I.x,
                  I.y - F / 2,
                  I.width,
                  I.height + F
                );
              }
              const D = g <= c || g > d;
              !i && !D && s.push({
                group: e,
                groupSize: Et({ group: e }),
                panels: [u, y],
                separator: "width" in v ? void 0 : v,
                rect: I
              }), i = !1;
            }
          }
          l = !1, u = y, p = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const y = o.find(
          (w) => w.element === h
        );
        y ? p.push(y) : (u = void 0, p = []);
      } else
        l = !0;
  }
  return s;
}
var Qe;
class ha {
  constructor() {
    hr(this, Qe, {});
  }
  addListener(t, n) {
    const r = Nt(this, Qe)[t];
    return r === void 0 ? Nt(this, Qe)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = Nt(this, Qe)[t];
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
    pr(this, Qe, {});
  }
  removeListener(t, n) {
    const r = Nt(this, Qe)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Qe = new WeakMap();
let kt = {
  cursorFlags: 0,
  state: "inactive"
};
const Xn = new ha();
function ft() {
  return kt;
}
function Du(e) {
  return Xn.addListener("change", e);
}
function Cu(e) {
  const t = kt, n = { ...kt };
  n.cursorFlags = e, kt = n, Xn.emit("change", {
    prev: t,
    next: n
  });
}
function Tt(e) {
  const t = kt;
  kt = e, Xn.emit("change", {
    prev: t,
    next: e
  });
}
const xu = (e) => e, Sn = () => {
}, pa = 1, ga = 2, ba = 4, ya = 8, qr = 3, Gr = 12;
let Zt;
function Zr() {
  return Zt === void 0 && (Zt = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (Zt = !0)), Zt;
}
function zu({
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
        if (e && Zr()) {
          const a = (e & pa) !== 0, s = (e & ga) !== 0, i = (e & ba) !== 0, l = (e & ya) !== 0;
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
    return Zr() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Yr = /* @__PURE__ */ new WeakMap();
function Qn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Yr.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = ft();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = zu({
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
  Yr.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let xe = /* @__PURE__ */ new Map();
const va = new ha();
function Ou(e) {
  xe = new Map(xe), xe.delete(e);
}
function Xr(e, t) {
  for (const [n] of xe)
    if (n.id === e)
      return n;
}
function nt(e, t) {
  for (const [n, r] of xe)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function bt() {
  return xe;
}
function er(e, t) {
  return va.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ve(e, t, n) {
  const r = xe.get(e);
  xe = new Map(xe), xe.set(e, t), va.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function wa(e) {
  const t = ft();
  let n = !1;
  switch (t.state) {
    case "active":
      Tt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Qn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = nt(r.group.id, !0);
        Ve(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Qr(e) {
  e.defaultPrevented || wa(e.currentTarget);
}
function $u(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = fa(n, a.rect);
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
function Fu(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Bu(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: no(e),
    b: no(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  ie(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: to(eo(n.a)),
    b: to(eo(n.b))
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
const ju = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Hu(e) {
  const t = getComputedStyle(Sa(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Uu(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Hu(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || ju.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function eo(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (ie(n, "Missing node"), Uu(n)) return n;
  }
  return null;
}
function to(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function no(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Sa(e);
  return t;
}
function Sa(e) {
  const { parentNode: t } = e;
  return Fu(t) ? t.host : t;
}
function Wu(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Ku({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!ua(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Bu(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Wu(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function tr(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = ma(o), s = $u(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Ku({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Vu(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function be(e, t, n = 0) {
  return Math.abs(ve(e) - ve(t)) <= n;
}
function Ce(e, t) {
  return be(e, t) ? 0 : e > t ? 1 : -1;
}
function Pt({
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
  if (Ce(r, l) < 0)
    if (a) {
      const c = (o + l) / 2;
      Ce(r, c) < 0 ? r = o : r = l;
    } else
      r = l;
  return r = Math.min(i, r), r = ve(r), r;
}
function jt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (be(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), l = Object.values(o), c = [...i], [d, f] = r;
  ie(d != null, "Invalid first pivot index"), ie(f != null, "Invalid second pivot index");
  let u = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : d, y = n[h];
        ie(
          y,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: S,
          minSize: b = 0
        } = y;
        if (S) {
          const v = i[h];
          if (ie(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), be(v, w)) {
            const I = b - v;
            Ce(I, Math.abs(e)) > 0 && (e = e < 0 ? 0 - I : I);
          }
        }
      }
      {
        const h = e < 0 ? d : f, y = n[h];
        ie(
          y,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: S,
          minSize: b = 0
        } = y;
        if (S) {
          const v = i[h];
          if (ie(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), be(v, b)) {
            const I = v - w;
            Ce(I, Math.abs(e)) > 0 && (e = e < 0 ? 0 - I : I);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : d, y = n[h];
      ie(
        y,
        `Panel constraints not found for index ${h}`
      );
      const w = i[h], { collapsible: S, collapsedSize: b, minSize: v } = y;
      if (S && Ce(w, v) < 0)
        if (e > 0) {
          const I = v - b, T = I / 2, D = w + e;
          Ce(D, v) < 0 && (e = Ce(e, T) <= 0 ? 0 : I);
        } else {
          const I = v - b, T = 100 - I / 2, D = w - e;
          Ce(D, v) < 0 && (e = Ce(100 + e, T) > 0 ? 0 : -I);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let y = e < 0 ? f : d, w = 0;
    for (; ; ) {
      const b = i[y];
      ie(
        b != null,
        `Previous layout not found for panel index ${y}`
      );
      const v = Pt({
        overrideDisabledPanels: s,
        panelConstraints: n[y],
        prevSize: b,
        size: 100
      }) - b;
      if (w += v, y += h, y < 0 || y >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(w));
    e = e < 0 ? 0 - S : S;
  }
  {
    let h = e < 0 ? d : f;
    for (; h >= 0 && h < n.length; ) {
      const y = Math.abs(e) - Math.abs(u), w = i[h];
      ie(
        w != null,
        `Previous layout not found for panel index ${h}`
      );
      const S = w - y, b = Pt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: w,
        size: S
      });
      if (!be(w, b) && (u += w - b, c[h] = b, u.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (Vu(l, c))
    return o;
  {
    const h = e < 0 ? f : d, y = i[h];
    ie(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const w = y + u, S = Pt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: w
    });
    if (c[h] = S, !be(S, w)) {
      let b = w - S, v = e < 0 ? f : d;
      for (; v >= 0 && v < n.length; ) {
        const I = c[v];
        ie(
          I != null,
          `Previous layout not found for panel index ${v}`
        );
        const T = I + b, D = Pt({
          overrideDisabledPanels: s,
          panelConstraints: n[v],
          prevSize: I,
          size: T
        });
        if (be(I, D) || (b -= D - I, c[v] = D), be(b, 0))
          break;
        e > 0 ? v-- : v++;
      }
    }
  }
  const p = Object.values(c).reduce(
    (h, y) => y + h,
    0
  );
  if (!be(p, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return c.reduce((h, y, w) => (h[g[w]] = y, h), {});
}
function mt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Ce(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function ht({
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
  if (!be(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const l = r[i];
      ie(l != null, `No layout data found for index ${i}`);
      const c = 100 / o * l;
      r[i] = c;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const l = n[i];
    ie(l != null, `No layout data found for index ${i}`);
    const c = r[i];
    ie(c != null, `No layout data found for index ${i}`);
    const d = Pt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: l,
      size: c
    });
    c != d && (a += c - d, r[i] = d);
  }
  if (!be(a, 0))
    for (let i = 0; i < t.length; i++) {
      const l = r[i];
      ie(l != null, `No layout data found for index ${i}`);
      const c = l + a, d = Pt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: l,
        size: c
      });
      if (l !== d && (a -= d - l, r[i] = d, be(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, l, c) => (i[s[c]] = l, i), {});
}
function Ia({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const l = bt();
    for (const [
      c,
      {
        defaultLayoutDeferred: d,
        derivedPanelConstraints: f,
        layout: u,
        groupSize: p,
        separatorToPanels: g
      }
    ] of l)
      if (c.id === e)
        return {
          defaultLayoutDeferred: d,
          derivedPanelConstraints: f,
          group: c,
          groupSize: p,
          layout: u,
          separatorToPanels: g
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
    const u = a(), p = c.findIndex((y) => y.id === t), g = p === 0, h = p === c.length - 1;
    if (h && l < u && (g || c.slice(0, p).every((y, w) => {
      const S = f[w];
      return (S == null ? void 0 : S.collapsible) && be(S.collapsedSize, d[S.panelId]);
    }))) {
      const y = c.slice(0, p).reduce((w, S) => w + d[S.id], 0);
      return {
        ...d,
        [t]: ve(100 - y)
      };
    }
    return jt({
      delta: h ? u - l : l - u,
      initialLayout: d,
      panelConstraints: f,
      pivotIndices: h ? [p - 1, p] : [p, p + 1],
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
      groupSize: p,
      layout: g,
      separatorToPanels: h
    } = n(), y = s({
      nextSize: l,
      panels: u.panels,
      prevLayout: g,
      derivedPanelConstraints: f
    }), w = ht({
      layout: y,
      panelConstraints: f
    });
    mt(g, w) || Ve(u, {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: f,
      groupSize: p,
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
        let p = f.expandToSize ?? d;
        p === 0 && (p = 1), i(p);
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
      return l && be(c, d);
    },
    resize: (l) => {
      const { group: c } = n(), { element: d } = o(), f = Et({ group: c }), u = xt({
        groupSize: f,
        panelElement: d,
        styleProp: l
      }), p = ve(u / f * 100);
      i(p);
    }
  };
}
function ro(e) {
  if (e.defaultPrevented)
    return;
  const t = bt();
  tr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Ia({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function Xt(e) {
  const t = bt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Ra({
  groupId: e
}) {
  const t = () => {
    const n = bt();
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
      } = t(), c = ht({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (mt(i, c) || Ve(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: c,
        separatorToPanels: l
      }), c);
    }
  };
}
function ct(e, t) {
  const n = Xt(e), r = nt(n.id, !0), o = n.separators.find(
    (d) => d.element === e
  );
  ie(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  ie(a, "Matching panels not found");
  const s = a.map((d) => n.panels.indexOf(d)), i = Ra({ groupId: n.id }).getLayout(), l = jt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), c = ht({
    layout: l,
    panelConstraints: r.derivedPanelConstraints
  });
  mt(i, c) || Ve(
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
function oo(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = Xt(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && ct(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && ct(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && ct(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && ct(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), ct(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = Xt(t), o = nt(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, l = r.separators.find(
          (u) => u.element === t
        );
        ie(l, "Matching separator not found");
        const c = i.get(l);
        ie(c, "Matching panels not found");
        const d = c[0], f = a.find(
          (u) => u.panelId === d.id
        );
        if (ie(f, "Panel metadata not found"), f.collapsible) {
          const u = s[d.id], p = f.collapsedSize === u ? r.mutableState.expandedPanelSizes[d.id] ?? f.minSize : f.collapsedSize;
          ct(t, p - u);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = Xt(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        ie(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), ct(t, -100);
        break;
      }
    }
}
function ao(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = bt(), n = tr(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), Tt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function Pa({
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
    const { group: d, groupSize: f } = c, { orientation: u, panels: p } = d, { disableCursor: g } = d.mutableState;
    let h = 0;
    a ? u === "horizontal" ? h = (t.clientX - a.x) / f * 100 : h = (t.clientY - a.y) / f * 100 : u === "horizontal" ? h = t.clientX < 0 ? -100 : 100 : h = t.clientY < 0 ? -100 : 100;
    const y = r.get(d), w = o.get(d);
    if (!y || !w)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: b,
      groupSize: v,
      layout: I,
      separatorToPanels: T
    } = w;
    if (b && I && T) {
      const D = jt({
        delta: h,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: c.panels.map((F) => p.indexOf(F)),
        prevLayout: I,
        trigger: "mouse-or-touch"
      });
      if (mt(D, I)) {
        if (h !== 0 && !g)
          switch (u) {
            case "horizontal": {
              i |= h < 0 ? pa : ga;
              break;
            }
            case "vertical": {
              i |= h < 0 ? ba : ya;
              break;
            }
          }
      } else
        Ve(c.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: b,
          groupSize: v,
          layout: D,
          separatorToPanels: T
        });
    }
  });
  let l = 0;
  t.movementX === 0 ? l |= s & qr : l |= i & qr, t.movementY === 0 ? l |= s & Gr : l |= i & Gr, Cu(l), Qn(e);
}
function so(e) {
  const t = bt(), n = ft();
  switch (n.state) {
    case "active":
      Pa({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function io(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = ft(), n = bt();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        Tt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = nt(a.group.id, !0);
          Ve(a.group, s, {
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
      Pa({
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
      const a = tr(e, n);
      a.length === 0 ? t.state !== "inactive" && Tt({
        cursorFlags: 0,
        state: "inactive"
      }) : Tt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Qn(e.currentTarget);
      break;
    }
  }
}
function lo(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (ft().state) {
      case "hover":
        Tt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function co(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || wa(e.currentTarget) && e.preventDefault();
}
function uo(e) {
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
function Ju(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((l) => l.element === t);
  if (!r || !r.onResize)
    return;
  const o = Et({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: ve(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function qu(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Gu({
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
        const p = u / 100 * n, g = ve(
          p / t * 100
        );
        i.set(f.id, g), o += g;
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
function Zu(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const St = /* @__PURE__ */ new Map();
function Yu(e) {
  let t = !0;
  ie(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: y, target: w } = h;
      if (w === e.element) {
        if (t) {
          const S = Et({ group: e });
          if (S === 0)
            return;
          const b = nt(e.id);
          if (!b)
            return;
          const v = zn(e), I = b.defaultLayoutDeferred ? uo(v) : b.layout, T = Gu({
            group: e,
            nextGroupSize: S,
            prevGroupSize: b.groupSize,
            prevLayout: I
          }), D = ht({
            layout: T,
            panelConstraints: v
          });
          if (!b.defaultLayoutDeferred && mt(b.layout, D) && qu(
            b.derivedPanelConstraints,
            v
          ) && b.groupSize === S)
            return;
          Ve(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: v,
            groupSize: S,
            layout: D,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        Ju(e, w, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    ie(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = Et({ group: e }), i = zn(e), l = e.panels.map(({ id: g }) => g).join(",");
  let c = e.mutableState.defaultLayout;
  c && (Zu(e.panels, c) || (c = void 0));
  const d = e.mutableState.layouts[l] ?? c ?? uo(i), f = ht({
    layout: d,
    panelConstraints: i
  }), u = e.element.ownerDocument;
  St.set(
    u,
    (St.get(u) ?? 0) + 1
  );
  const p = /* @__PURE__ */ new Map();
  return ma(e).forEach((g) => {
    g.separator && p.set(g.separator, g.panels);
  }), Ve(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: p
  }), e.separators.forEach((g) => {
    ie(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", oo);
  }), St.get(u) === 1 && (u.addEventListener("contextmenu", Qr, !0), u.addEventListener("dblclick", ro, !0), u.addEventListener("pointerdown", ao, !0), u.addEventListener("pointerleave", so), u.addEventListener("pointermove", io), u.addEventListener("pointerout", lo), u.addEventListener("pointerup", co, !0)), function() {
    t = !1, St.set(
      u,
      Math.max(0, (St.get(u) ?? 0) - 1)
    ), Ou(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", oo);
    }), St.get(u) || (u.removeEventListener(
      "contextmenu",
      Qr,
      !0
    ), u.removeEventListener(
      "dblclick",
      ro,
      !0
    ), u.removeEventListener(
      "pointerdown",
      ao,
      !0
    ), u.removeEventListener("pointerleave", so), u.removeEventListener("pointermove", io), u.removeEventListener("pointerout", lo), u.removeEventListener("pointerup", co, !0)), a.disconnect();
  };
}
function Xu() {
  const [e, t] = E({}), n = z(() => t({}), []);
  return [e, n];
}
function nr(e) {
  const t = wo();
  return `${e ?? t}`;
}
const yt = typeof window < "u" ? Ie : C;
function zt(e) {
  const t = M(e);
  return yt(() => {
    t.current = e;
  }, [e]), z(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function rr(...e) {
  return zt((t) => {
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
function or(e) {
  const t = M({ ...e });
  return yt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const ka = jn(null);
function Qu(e, t) {
  const n = M({
    getLayout: () => ({}),
    setLayout: xu
  });
  Un(t, () => n.current, []), yt(() => {
    Object.assign(
      n.current,
      Ra({ groupId: e })
    );
  });
}
function Ta({
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
  ...p
}) {
  const g = M({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = zt((R) => {
    mt(g.current.onLayoutChange, R) || (g.current.onLayoutChange = R, l == null || l(R));
  }), y = zt(
    (R, P) => {
      mt(g.current.onLayoutChanged, R) || (g.current.onLayoutChanged = R, c == null || c(R, { isUserInteraction: P }));
    }
  ), w = nr(i), S = M(null), [b, v] = Xu(), I = M({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), T = rr(S, a);
  Qu(w, s);
  const D = zt(
    (R, P) => {
      const k = ft(), A = Xr(R), _ = nt(R);
      if (_) {
        let H = !1;
        switch (k.state) {
          case "active": {
            H = k.hitRegions.some(
              ($) => $.group === A
            );
            break;
          }
        }
        return {
          flexGrow: _.layout[P] ?? 1,
          pointerEvents: H ? "none" : void 0
        };
      }
      if (n != null && n[P])
        return {
          flexGrow: n == null ? void 0 : n[P]
        };
    }
  ), F = or({
    defaultLayout: n,
    disableCursor: r
  }), j = q(
    () => ({
      get disableCursor() {
        return !!F.disableCursor;
      },
      getPanelStyles: D,
      id: w,
      orientation: d,
      registerPanel: (R) => {
        const P = I.current;
        return P.panels = On(d, [
          ...P.panels,
          R
        ]), v(), () => {
          P.panels = P.panels.filter(
            (k) => k !== R
          ), v();
        };
      },
      registerSeparator: (R) => {
        const P = I.current;
        return P.separators = On(d, [
          ...P.separators,
          R
        ]), v(), () => {
          P.separators = P.separators.filter(
            (k) => k !== R
          ), v();
        };
      },
      updatePanelProps: (R, { disabled: P }) => {
        const k = I.current.panels.find(
          (H) => H.id === R
        );
        k && (k.panelConstraints.disabled = P);
        const A = Xr(w), _ = nt(w);
        A && _ && Ve(A, {
          ..._,
          derivedPanelConstraints: zn(A)
        });
      },
      updateSeparatorProps: (R, {
        disabled: P,
        disableDoubleClick: k
      }) => {
        const A = I.current.separators.find(
          (_) => _.id === R
        );
        A && (A.disabled = P, A.disableDoubleClick = k);
      }
    }),
    [D, w, v, d, F]
  ), N = M(null);
  return yt(() => {
    const R = S.current;
    if (R === null)
      return;
    const P = I.current;
    let k;
    if (F.defaultLayout !== void 0 && Object.keys(F.defaultLayout).length === P.panels.length) {
      k = {};
      for (const oe of P.panels) {
        const Z = F.defaultLayout[oe.id];
        Z !== void 0 && (k[oe.id] = Z);
      }
    }
    const A = {
      disabled: !!o,
      element: R,
      id: w,
      mutableState: {
        defaultLayout: k,
        disableCursor: !!F.disableCursor,
        expandedPanelSizes: I.current.lastExpandedPanelSizes,
        layouts: I.current.layouts
      },
      orientation: d,
      panels: P.panels,
      resizeTargetMinimumSize: P.resizeTargetMinimumSize,
      separators: P.separators
    };
    N.current = A;
    const _ = Yu(A), { defaultLayoutDeferred: H, derivedPanelConstraints: $, layout: W } = nt(A.id, !0);
    !H && $.length > 0 && (h(W), y(W, !1));
    const re = er(w, (oe) => {
      const { defaultLayoutDeferred: Z, derivedPanelConstraints: pe, layout: ce } = oe.next;
      if (Z || pe.length === 0)
        return;
      const ae = A.panels.map(({ id: ee }) => ee).join(",");
      A.mutableState.layouts[ae] = ce, pe.forEach((ee) => {
        if (ee.collapsible) {
          const { layout: Q } = oe.prev ?? {};
          if (Q) {
            const ge = be(
              ee.collapsedSize,
              ce[ee.panelId]
            ), ue = be(
              ee.collapsedSize,
              Q[ee.panelId]
            );
            ge && !ue && (A.mutableState.expandedPanelSizes[ee.panelId] = Q[ee.panelId]);
          }
        }
      });
      const Me = ft().state !== "active";
      h(ce), Me && y(ce, oe.isUserInteraction);
    });
    return () => {
      N.current = null, _(), re();
    };
  }, [
    o,
    w,
    y,
    h,
    d,
    b,
    F
  ]), C(() => {
    const R = N.current;
    R && (R.mutableState.defaultLayout = n, R.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ m(ka.Provider, { value: j, children: /* @__PURE__ */ m(
    "div",
    {
      ...p,
      className: t,
      "data-group": !0,
      "data-testid": w,
      id: w,
      ref: T,
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
Ta.displayName = "Group";
function ar() {
  const e = Hn(ka);
  return ie(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function ef(e, t) {
  const { id: n } = ar(), r = M({
    collapse: Sn,
    expand: Sn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Sn
  });
  Un(t, () => r.current, []), yt(() => {
    Object.assign(
      r.current,
      Ia({ groupId: n, panelId: e })
    );
  });
}
function $n({
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
  style: p,
  ...g
}) {
  const h = !!l, y = nr(l), w = or({
    disabled: a
  }), S = M(null), b = rr(S, s), {
    getPanelStyles: v,
    id: I,
    orientation: T,
    registerPanel: D,
    updatePanelProps: F
  } = ar(), j = f !== null, N = zt(
    (A, _, H) => {
      f == null || f(A, l, H);
    }
  );
  yt(() => {
    const A = S.current;
    if (A !== null) {
      const _ = {
        element: A,
        id: y,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: j ? N : void 0,
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
      return D(_);
    }
  }, [
    i,
    n,
    r,
    o,
    j,
    y,
    h,
    c,
    d,
    N,
    D,
    w
  ]), C(() => {
    F(y, { disabled: a });
  }, [a, y, F]), ef(y, u);
  const R = () => {
    const A = v(I, y);
    if (A)
      return JSON.stringify(A);
  }, P = vo(
    (A) => er(I, A),
    R,
    R
  );
  let k;
  return P ? k = JSON.parse(P) : o !== void 0 ? k = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : k = { flexGrow: 1 }, /* @__PURE__ */ m(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": y,
      id: y,
      ref: b,
      style: {
        ...tf,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...k
      },
      children: /* @__PURE__ */ m(
        "div",
        {
          className: t,
          style: {
            maxHeight: "100%",
            maxWidth: "100%",
            flexGrow: 1,
            overflow: "auto",
            ...p,
            // Inform the browser that the library is handling touch events for this element
            // but still allow users to scroll content within panels in the non-resizing direction
            // NOTE This is not an inherited style
            // See github.com/bvaughn/react-resizable-panels/issues/662
            touchAction: T === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
$n.displayName = "Panel";
const tf = {
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
function nf({
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
    a = ht({
      layout: jt({
        delta: c - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: d,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = ht({
      layout: jt({
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
function Ea({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const l = nr(a), c = or({
    disabled: n,
    disableDoubleClick: r
  }), [d, f] = E({}), [u, p] = E("inactive"), [g, h] = E(!1), y = M(null), w = rr(y, o), {
    disableCursor: S,
    id: b,
    orientation: v,
    registerSeparator: I,
    updateSeparatorProps: T
  } = ar(), D = v === "horizontal" ? "vertical" : "horizontal";
  yt(() => {
    const N = y.current;
    if (N !== null) {
      const R = {
        disabled: c.disabled,
        disableDoubleClick: c.disableDoubleClick,
        element: N,
        id: l
      }, P = I(R), k = Du(
        (_) => {
          p(
            _.next.state !== "inactive" && _.next.hitRegions.some(
              (H) => H.separator === R
            ) ? _.next.state : "inactive"
          );
        }
      ), A = er(
        b,
        (_) => {
          const { derivedPanelConstraints: H, layout: $, separatorToPanels: W } = _.next, re = W.get(R);
          if (re) {
            const oe = re[0], Z = re.indexOf(oe);
            f(
              nf({
                layout: $,
                panelConstraints: H,
                panelId: oe.id,
                panelIndex: Z
              })
            );
          }
        }
      );
      return () => {
        k(), A(), P();
      };
    }
  }, [b, l, I, c]), C(() => {
    T(l, { disabled: n, disableDoubleClick: r });
  }, [n, r, l, T]);
  let F;
  n && !S && (F = "not-allowed");
  let j;
  if (n)
    j = "disabled";
  else
    switch (u) {
      case "active": {
        j = "active";
        break;
      }
      default:
        g ? j = "focus" : j = u;
    }
  return /* @__PURE__ */ m(
    "div",
    {
      ...i,
      "aria-controls": d.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": D,
      "aria-valuemax": d.valueMax,
      "aria-valuemin": d.valueMin,
      "aria-valuenow": d.valueNow,
      children: e,
      className: t,
      "data-separator": j,
      "data-testid": l,
      id: l,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: w,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: F,
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
Ea.displayName = "Separator";
const sr = 30, ir = 65, Ht = 50, rf = 100 - ir, of = 100 - sr;
function af(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(ir, Math.max(sr, t)) : Ht;
}
function lr(e) {
  return 100 - e;
}
function It(e) {
  return `${e}%`;
}
const cr = "reader-document", Ut = "reader-assistant", Ma = "retainpdf.reader.ai-split-layout.v1", sf = {
  [cr]: lr(Ht),
  [Ut]: Ht
};
function dr(e) {
  const t = af(e == null ? void 0 : e[Ut]);
  return {
    [cr]: lr(t),
    [Ut]: t
  };
}
function lf() {
  try {
    const e = JSON.parse(localStorage.getItem(Ma) || "null");
    return dr(e);
  } catch {
    return sf;
  }
}
function cf(e) {
  try {
    localStorage.setItem(Ma, JSON.stringify(dr(e)));
  } catch {
  }
}
function In(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = dr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Ut]}vw`
  );
}
function df() {
  const e = M(null), [t] = E(lf);
  Ie(() => {
    const o = e.current;
    return In(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = z((o) => {
    In(e.current, o);
  }, []), r = z((o, a) => {
    In(e.current, o), a.isUserInteraction && cf(o);
  }, []);
  return /* @__PURE__ */ L(
    Ta,
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
        /* @__PURE__ */ m(
          $n,
          {
            id: cr,
            defaultSize: It(lr(Ht)),
            minSize: It(rf),
            maxSize: It(of)
          }
        ),
        /* @__PURE__ */ m(
          Ea,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ m("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ m(
          $n,
          {
            id: Ut,
            defaultSize: It(Ht),
            minSize: It(sr),
            maxSize: It(ir)
          }
        )
      ]
    }
  );
}
function uf({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = E(!1);
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
    n ? /* @__PURE__ */ m(X, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
    /* @__PURE__ */ m(
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
function ff({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ m(uf, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ L(pt, { children: [
    e ? /* @__PURE__ */ m("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ L("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ m("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ m("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ m(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ L("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ m("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ m(X, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function mf(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function hf() {
  const [e, t] = E(!1), n = wo(), r = M(null);
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
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || mf(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((i) => !i);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ L("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ m(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ m(is, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
            /* @__PURE__ */ m("strong", { children: "快捷键" }),
            /* @__PURE__ */ m(
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
          /* @__PURE__ */ m("div", { className: "reader-react-shortcuts-body", children: Kl.map((o) => /* @__PURE__ */ L("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ m("h3", { children: o.title }),
            /* @__PURE__ */ m("ul", { children: o.items.map((a) => /* @__PURE__ */ L("li", { children: [
              /* @__PURE__ */ m("kbd", { children: a.keys }),
              /* @__PURE__ */ m("span", { children: a.desc })
            ] }, `${o.title}-${a.keys}`)) })
          ] }, o.title)) }),
          /* @__PURE__ */ m("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const pf = ["source", "sideBySide", "translated"], gf = { source: "", translated: "", sideBySide: "" };
function bf(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = Qt(e.sourceUrl), n = Qt(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return Os({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function yf(e) {
  const [t, n] = E(() => /* @__PURE__ */ new Set()), r = q(
    () => e ? bf(e) : gf,
    [e]
  ), o = q(
    () => pf.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = z(async (s) => {
    if (!e) return;
    const i = Qt(r[s]);
    if (!(!i || t.has(s)))
      try {
        const l = e.jobId ? zs(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await $s(
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
        Fs(c), n((d) => {
          const f = new Set(d);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const vf = {
  source: Po,
  sideBySide: ko,
  translated: To
}, wf = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Sf(e) {
  const t = qe(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = yf(n), i = M(null);
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
      /* @__PURE__ */ m(ls, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ m("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ m(Ro, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ m("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((l) => {
      const c = $a[l], d = Qt(r[l]), f = a.has(l), u = !!d && !f, p = u ? "" : Fa(l, r), g = vf[l];
      return /* @__PURE__ */ L(
        "button",
        {
          type: "button",
          id: `reader-download-${l}`,
          className: `reader-download-action${f ? " is-busy" : ""}`,
          disabled: !u,
          "aria-label": u ? `下载${c.label}` : p,
          onClick: () => {
            i.current && (i.current.open = !1), s(l);
          },
          children: [
            /* @__PURE__ */ m(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ L("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ L("span", { className: "reader-download-action-label", children: [
                wf[l],
                " PDF"
              ] }),
              p ? /* @__PURE__ */ m("span", { className: "reader-download-action-reason", children: p }) : null
            ] })
          ]
        },
        l
      );
    }) })
  ] });
}
const If = "retainpdf:reader:bookmarks:v1:", Rf = 200;
function ur() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Na(e) {
  const t = `${e || ""}`.trim();
  return t ? `${If}${t}` : "";
}
function Pf(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function sn(e, t = ur()) {
  const n = Na(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Pf(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Fn(e, t, n) {
  const r = Na(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Rf);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function kf(e, t, n = "", { storage: r = ur(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = sn(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Fn(e, a.filter((i) => i.page !== s), r) : Fn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Tf(e, t, n = ur()) {
  return Fn(e, sn(e, n).filter((r) => r.page !== t), n);
}
function Ef(e, t) {
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
function Mf({ filled: e }) {
  return /* @__PURE__ */ m("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ m("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function Nf({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = E(() => sn(e)), [i, l] = E(!1), c = M(null);
  if (C(() => {
    s(sn(e)), l(!1);
  }, [e]), C(() => {
    if (!i) return;
    const u = (g) => {
      c.current && !c.current.contains(g.target) && l(!1);
    }, p = (g) => {
      g.key === "Escape" && l(!1);
    };
    return document.addEventListener("pointerdown", u), document.addEventListener("keydown", p), () => {
      document.removeEventListener("pointerdown", u), document.removeEventListener("keydown", p);
    };
  }, [i]), !e || n <= 0) return null;
  const d = Math.min(Math.max(t, 1), n), f = a.some((u) => u.page === d);
  return /* @__PURE__ */ L("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: c, children: [
    /* @__PURE__ */ m(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${f ? " is-marked" : ""}`,
        "aria-pressed": f,
        "aria-label": f ? `取消第 ${d} 页的书签` : `给第 ${d} 页加书签`,
        title: f ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(kf(e, d, Ef(r, d))),
        children: /* @__PURE__ */ m(Mf, { filled: f })
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
          /* @__PURE__ */ m(cs, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ m("span", { className: "reader-bookmark-count", children: a.length })
        ]
      }
    ) : null,
    i && a.length ? /* @__PURE__ */ m("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ m("ol", { className: "reader-bookmark-list", children: a.map((u) => /* @__PURE__ */ L("li", { className: u.page === d ? "is-current" : "", children: [
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
            u.label ? /* @__PURE__ */ m("span", { className: "reader-bookmark-label", children: u.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ m(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${u.page} 页的书签`,
          onClick: () => s(Tf(e, u.page)),
          children: "×"
        }
      )
    ] }, u.page)) }) }) : null
  ] });
}
function Af(e) {
  const [t, n] = E([]);
  return C(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = ot().loadIssues;
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
function _f(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Lf = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, Df = ["failed", "content", "layout"];
function Cf(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function xf({ jobId: e, currentPage: t }) {
  var f;
  const n = Af(e), r = (f = qe()) == null ? void 0 : f.jumpToBlock, [o, a] = E(!1), [s, i] = E(-1), l = M(null);
  C(() => i(-1), [n]);
  const c = (u) => {
    const p = n[u];
    !p || !r || (i(u), r(p.readerItemId));
  }, d = M({ issues: n, last: s, currentPage: t, goTo: c });
  return d.current = { issues: n, last: s, currentPage: t, goTo: c }, C(() => {
    const u = (p) => {
      if (p.key.toLowerCase() !== "n" || p.metaKey || p.ctrlKey || p.altKey || Cf(p.target)) return;
      const { issues: g, last: h, currentPage: y, goTo: w } = d.current, S = _f(g, h, y, p.shiftKey);
      S < 0 || (p.preventDefault(), w(S));
    };
    return document.addEventListener("keydown", u), () => document.removeEventListener("keydown", u);
  }, []), C(() => {
    if (!o) return;
    const u = (p) => {
      var g;
      (g = l.current) != null && g.contains(p.target) || a(!1);
    };
    return document.addEventListener("pointerdown", u, !0), () => document.removeEventListener("pointerdown", u, !0);
  }, [o]), n.length ? /* @__PURE__ */ L("div", { className: "reader-react-hud-group reader-issues", ref: l, "aria-label": "待处理", children: [
    /* @__PURE__ */ L(
      X,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((u) => !u),
        children: [
          /* @__PURE__ */ m(ds, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ m("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ L("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ m("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      Df.map((u) => {
        const p = n.map((g, h) => ({ issue: g, index: h })).filter(({ issue: g }) => g.kind === u);
        return p.length ? /* @__PURE__ */ L("section", { className: "reader-issues-group", "data-issue-kind": u, children: [
          /* @__PURE__ */ L("h4", { children: [
            Lf[u],
            /* @__PURE__ */ m("span", { children: p.length })
          ] }),
          /* @__PURE__ */ m("ol", { children: p.map(({ issue: g, index: h }) => /* @__PURE__ */ m("li", { children: /* @__PURE__ */ L(
            X,
            {
              className: "reader-issues-item",
              "aria-current": h === s ? "true" : void 0,
              onClick: () => {
                c(h), a(!1);
              },
              children: [
                /* @__PURE__ */ m("span", { className: "reader-issues-title", children: g.title }),
                /* @__PURE__ */ L("span", { className: "reader-issues-page", children: [
                  "第 ",
                  g.page,
                  " 页"
                ] }),
                g.detail ? /* @__PURE__ */ m("span", { className: "reader-issues-detail", children: g.detail }) : null
              ]
            }
          ) }, `${g.kind}:${g.readerItemId}`)) })
        ] }, u) : null;
      })
    ] }) : null
  ] }) : null;
}
const zf = 48, Of = 96, $f = 700;
function Ff(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= zf, downSoFar: r };
}
function Bf(e) {
  const [t, n] = E(!1), r = M(0);
  return C(() => {
    const o = /* @__PURE__ */ new WeakMap();
    let a = 0;
    const s = () => {
      a = Date.now();
    }, i = /* @__PURE__ */ new WeakMap(), l = () => {
      const u = e.current;
      return !!(u && (u.querySelector(":focus-visible") || u.querySelector("[aria-expanded='true']")));
    }, c = (u) => {
      const p = u.target;
      if (!(p instanceof Element) || (i.has(p) || i.set(p, !!p.querySelector(`[${Ee}]`)), !i.get(p))) return;
      const g = p.scrollTop, h = o.get(p);
      if (o.set(p, g), h === void 0 || Date.now() - a > $f) return;
      const y = Ff(!1, r.current, g - h);
      r.current = y.downSoFar, g - h < -4 ? n(!1) : y.hidden && !l() && n(!0);
    }, d = (u) => {
      u.clientY >= window.innerHeight - Of && (r.current = 0, n(!1));
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
function jf(e) {
  const t = qe(), n = ia(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Wt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, l = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, c = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), d = Ti(a), f = a > xo + 1e-3, u = a < on - 1e-3, p = Rt(r, tt()), g = p >= on ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = M(null), y = Bf(h), [w, S] = E(!1), [b, v] = E(`${i}`);
  C(() => {
    w || v(`${Math.min(Math.max(i, 1), Math.max(l, 1))}`);
  }, [i, l, w]);
  const I = () => {
    if (S(!1), !c || l <= 0)
      return;
    const T = Number(`${b}`.trim());
    c(an(T, l));
  };
  return /* @__PURE__ */ L("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": y ? "true" : void 0, children: [
    o ? /* @__PURE__ */ m("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ m("div", { className: "reader-react-hud-group", "aria-label": "页码", children: w ? /* @__PURE__ */ L(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (T) => {
          T.preventDefault(), I();
        },
        children: [
          /* @__PURE__ */ m(
            "input",
            {
              className: "reader-react-hud-page-input",
              type: "text",
              inputMode: "numeric",
              pattern: "[0-9]*",
              "aria-label": "跳转到页码",
              value: b,
              autoFocus: !0,
              onChange: (T) => v(T.target.value.replace(/[^\d]/g, "")),
              onBlur: I,
              onKeyDown: (T) => {
                T.key === "Escape" && (T.preventDefault(), S(!1), v(`${i}`));
              }
            }
          ),
          /* @__PURE__ */ L("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            l || "—"
          ] })
        ]
      }
    ) : /* @__PURE__ */ m(
      "button",
      {
        type: "button",
        className: "reader-react-hud-page reader-react-hud-page-btn",
        "aria-label": l > 0 ? `跳转页码，当前第 ${i} 页，共 ${l} 页` : "页码",
        title: l > 0 ? "点击输入页码跳转" : void 0,
        disabled: !c || l <= 0,
        onClick: () => {
          !c || l <= 0 || (v(`${i}`), S(!0));
        },
        children: l > 0 ? `${Math.min(i, l)} / ${l}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ m("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ m(
      Nf,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: l,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: c
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ m(xf, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ m("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ m(
      X,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ m(Hf, {})
      }
    ) }) : null,
    /* @__PURE__ */ L("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ m(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !f,
          onClick: () => s(Ft(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ L(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `${d}%，点击${g}`,
          title: g,
          onClick: () => s(p),
          children: [
            d,
            "%"
          ]
        }
      ),
      /* @__PURE__ */ m(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "放大",
          disabled: !u,
          onClick: () => s(Ft(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ m("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ m(hf, {}) })
  ] });
}
function Hf() {
  return /* @__PURE__ */ L("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ m("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ m("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function fo(e) {
  var t, n;
  return jo(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Uf(e) {
  const [t, n] = E(() => ({
    scope: e,
    panel: fo(ze(e))
  }));
  C(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: fo(ze(e))
    });
  }, [e]), C(() => {
    t.scope === e && un(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = z((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const Bn = "download-toast";
function Wf({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ L("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ L("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ m("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ m("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ m("div", { className: "download-toast-track", children: /* @__PURE__ */ m("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ m("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function Kf(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Tn.dismiss(Bn);
    return;
  }
  Tn.custom(
    () => /* @__PURE__ */ m(Wf, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Bn, duration: 1 / 0 }
  );
}
function Vf() {
  const e = z((t) => {
    t && (t.setState = Kf, t.hide = () => Tn.dismiss(Bn));
  }, []);
  return /* @__PURE__ */ L(pt, { children: [
    /* @__PURE__ */ m(Za, { position: "bottom-right" }),
    /* @__PURE__ */ m("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function Jf(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Oo(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function qf(e, t) {
  return t === null || e !== t;
}
function Gf(e) {
  const t = M(!1);
  return e && (t.current = !0), t.current;
}
function Zf(e, t) {
  const n = e === t;
  return { open: n, mounted: Gf(n) };
}
const mo = { itemId: null, origin: null };
function Yf() {
  let e = mo;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? mo : { itemId: n, origin: r };
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
function Xf({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = q(() => dc(e, t), [e, t]), [o, a] = E(() => /* @__PURE__ */ new Set([...Ar(r), ...r ? [r] : []]));
  C(() => {
    a(/* @__PURE__ */ new Set([...Ar(r), ...r ? [r] : []]));
  }, [e]);
  const s = M(null);
  C(() => {
    var c, d;
    (d = (c = s.current) == null ? void 0 : c.querySelector('[aria-current="location"]')) == null || d.scrollIntoView({ block: "center" });
  }, [e]);
  const i = (c) => a((d) => {
    const f = new Set(d);
    return f.has(c) ? f.delete(c) : f.add(c), f;
  }), l = (c) => c.map((d) => {
    const f = o.has(d.id), u = d.children.length > 0;
    return /* @__PURE__ */ L("li", { className: "reader-bookmark", "data-level": d.level, children: [
      /* @__PURE__ */ L("div", { className: "reader-bookmark-row", children: [
        u ? /* @__PURE__ */ m(
          X,
          {
            className: `reader-bookmark-toggle${f ? " is-open" : ""}`,
            "aria-label": f ? `收起「${d.title}」` : `展开「${d.title}」`,
            "aria-expanded": f,
            onClick: () => i(d.id),
            children: /* @__PURE__ */ m(Eo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        ) : /* @__PURE__ */ m("span", { className: "reader-bookmark-spacer", "aria-hidden": "true" }),
        /* @__PURE__ */ L(
          X,
          {
            className: "reader-finder-entry reader-bookmark-entry",
            "data-level": d.level,
            "aria-current": d.id === r ? "location" : void 0,
            disabled: d.page === null,
            title: d.page === null ? "这条书签没有指到页" : `${d.title} · 第 ${d.page} 页`,
            onClick: () => d.page !== null && n(d.page),
            children: [
              /* @__PURE__ */ m("span", { className: "reader-finder-entry-text", children: d.title }),
              d.page !== null ? /* @__PURE__ */ m("span", { className: "reader-finder-entry-page", children: d.page }) : null
            ]
          }
        )
      ] }),
      u && f ? /* @__PURE__ */ m("ol", { className: "reader-bookmark-children", children: l(d.children) }) : null
    ] }, d.id);
  });
  return /* @__PURE__ */ m("ol", { ref: s, className: "reader-finder-list reader-bookmark-tree", "aria-label": "书签", children: l(e) });
}
const Qf = [], em = [];
function tm({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ L("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ m(X, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ m(us, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function nm({ open: e, onToggle: t }) {
  return /* @__PURE__ */ m(
    X,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ m(fs, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function rm({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  bookmarks: l = em,
  onJumpPage: c
}) {
  var N, R;
  const d = ((N = qe()) == null ? void 0 : N.regions) ?? Qf, f = ((R = ia()) == null ? void 0 : R.currentPage) ?? 1, u = q(() => Ed(d), [d]), p = l.length > 0 && !!c, [g, h] = E("bookmarks"), y = p && (g === "bookmarks" || !u.length), w = Md(u, f), S = q(() => _d(d, s), [d, s]), [b, v] = E(-1);
  C(() => v(-1), [s]);
  const I = M(null), T = M(null), D = M(n);
  D.current = n, C(() => {
    const P = (A) => {
      var H, $;
      const _ = A.target;
      !_ || (H = T.current) != null && H.contains(_) || ($ = _.closest) != null && $.call(_, ".reader-finder-toggles, [data-finder-toggle]") || D.current();
    }, k = (A) => {
      A.key === "Escape" && D.current();
    };
    return document.addEventListener("pointerdown", P, !0), document.addEventListener("keydown", k), () => {
      document.removeEventListener("pointerdown", P, !0), document.removeEventListener("keydown", k);
    };
  }, []);
  const F = M(null);
  C(() => {
    var P, k, A;
    e === "search" ? (P = I.current) == null || P.focus() : (A = (k = F.current) == null ? void 0 : k.querySelector('[aria-current="location"]')) == null || A.scrollIntoView({ block: "center" });
  }, [e, i]), C(() => {
    var P, k;
    e === "search" && b >= 0 && ((k = (P = F.current) == null ? void 0 : P.querySelector('[aria-current="true"]')) == null || k.scrollIntoView({ block: "nearest" }));
  }, [e, b]);
  const j = (P) => {
    const k = S[P];
    k && (v(P), r(k.itemId));
  };
  return /* @__PURE__ */ L("aside", { ref: T, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ L("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ m(X, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ m(X, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ m(X, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ m(gt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" && p && u.length ? /* @__PURE__ */ L("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ m(X, { className: "reader-finder-switch-option", role: "radio", "aria-checked": y, onClick: () => h("bookmarks"), children: "按书签" }),
      /* @__PURE__ */ m(X, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !y, onClick: () => h("headings"), children: "按标题" })
    ] }) : null,
    e === "outline" && y && c ? /* @__PURE__ */ m(Xf, { nodes: l, currentPage: f, onJumpPage: c }) : e === "outline" ? u.length ? /* @__PURE__ */ m("ol", { ref: F, className: "reader-finder-list", children: u.map((P, k) => /* @__PURE__ */ m("li", { children: /* @__PURE__ */ L(
      X,
      {
        className: "reader-finder-entry",
        "data-level": P.level,
        "aria-current": k === w ? "location" : void 0,
        onClick: () => r(P.itemId),
        children: [
          /* @__PURE__ */ m("span", { className: "reader-finder-entry-text", children: P.text }),
          /* @__PURE__ */ m("span", { className: "reader-finder-entry-page", children: P.page })
        ]
      }
    ) }, P.itemId)) }) : /* @__PURE__ */ m("p", { className: "reader-finder-empty", children: d.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ L(pt, { children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ m(
          Mo,
          {
            ref: I,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (P) => a(P.target.value),
            onKeyDown: (P) => {
              P.key === "Enter" ? (P.preventDefault(), j(Dd(b, S.length, P.shiftKey))) : P.key === "Escape" && (P.preventDefault(), n()), P.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ m("p", { className: "reader-finder-count", "aria-live": "polite", children: S.length === 0 ? "没有找到" : `${b >= 0 ? `第 ${b + 1} / ` : ""}${S.length >= 200 ? "200+ 处，只列前 200 处" : `${S.length} 处`}${b < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ m("ol", { className: "reader-finder-list", children: S.map((P, k) => /* @__PURE__ */ m("li", { children: /* @__PURE__ */ L(X, { className: "reader-finder-entry is-hit", "aria-current": k === b ? "true" : void 0, onClick: () => j(k), children: [
        /* @__PURE__ */ L("span", { className: "reader-finder-entry-text", children: [
          P.snippet.slice(0, P.at),
          /* @__PURE__ */ m("mark", { children: P.snippet.slice(P.at, P.at + P.length) }),
          P.snippet.slice(P.at + P.length)
        ] }),
        /* @__PURE__ */ m("span", { className: "reader-finder-entry-page", children: P.page })
      ] }) }, P.itemId)) })
    ] })
  ] });
}
function om({ active: e, compare: t, ink: n }) {
  const [r, o] = E(!1), [a, s] = E(!1), i = M(null);
  C(() => {
    if (!r && !a) return;
    const c = () => {
      o(!1), s(!1);
    }, d = (u) => {
      var p;
      (p = i.current) != null && p.contains(u.target) || c();
    }, f = (u) => {
      u.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", d, !0), document.addEventListener("keydown", f), () => {
      document.removeEventListener("pointerdown", d, !0), document.removeEventListener("keydown", f);
    };
  }, [r, a]);
  const l = !!(t.compared || t.loading);
  return /* @__PURE__ */ L("div", { className: "reader-toolball", ref: i, "data-open": r ? "true" : void 0, children: [
    a ? /* @__PURE__ */ m(iu, { compare: t, onDone: () => {
      s(!1), o(!1);
    } }) : null,
    r ? /* @__PURE__ */ L("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: [
      n ? /* @__PURE__ */ m(
        X,
        {
          className: "reader-toolball-item",
          "aria-label": "画笔",
          title: "画笔（P；书页上右键也能选笔和颜色）",
          "aria-pressed": !!n.tool,
          "data-toolball-item": "ink",
          onClick: () => {
            n.setTool(n.tool ? null : "pen"), o(!1);
          },
          children: /* @__PURE__ */ m(Wn, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ m(Iu, { active: e }),
      t.available ? /* @__PURE__ */ m(
        X,
        {
          className: "reader-toolball-item",
          "aria-label": "对比版本",
          title: "对比版本：左边换成这本书的另一份译文",
          "aria-pressed": l || a,
          "data-toolball-item": "compare",
          onClick: () => s((c) => !c),
          children: /* @__PURE__ */ m(ms, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null
    ] }) : null,
    /* @__PURE__ */ m(
      X,
      {
        className: "reader-toolball-ball",
        "aria-label": r ? "收起工具" : "工具：画笔、Markdown、对比版本",
        title: r ? "收起" : "工具",
        "aria-expanded": r,
        "data-active": e || l ? "true" : void 0,
        onClick: () => {
          o((c) => !c), s(!1);
        },
        children: r ? /* @__PURE__ */ m(gt, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ m(hs, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const am = [
  { tool: "pen", label: "画笔", Icon: Wn },
  { tool: "highlighter", label: "荧光笔", Icon: ps },
  { tool: "eraser", label: "橡皮", Icon: gs }
];
function Aa(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function _a({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ L(pt, { children: [
    am.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ m(
      X,
      {
        className: "reader-ink-tool",
        "aria-label": a,
        title: a,
        "aria-pressed": e.tool === o,
        "data-ink-tool": o,
        onClick: () => {
          e.setTool(e.tool === o ? null : o), r();
        },
        children: /* @__PURE__ */ m(s, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      },
      o
    )),
    /* @__PURE__ */ m("span", { className: "reader-ink-sep", "aria-hidden": !0 }),
    na.map((o) => /* @__PURE__ */ m(
      X,
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
        children: /* @__PURE__ */ m("span", { "aria-hidden": !0 })
      },
      o.key
    )),
    /* @__PURE__ */ m("span", { className: "reader-ink-sep", "aria-hidden": !0 }),
    /* @__PURE__ */ m(X, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ m(bs, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ m(
      X,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ m(ys, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ m(
      X,
      {
        className: "reader-ink-tool",
        "aria-label": "退出画笔",
        title: "退出画笔（Esc）",
        "data-ink-exit": "true",
        onClick: () => {
          e.setTool(null), r();
        },
        children: /* @__PURE__ */ m(gt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function sm({ ink: e, menu: t, onClose: n }) {
  const r = M(null);
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
  return /* @__PURE__ */ m("div", { ref: r, className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", style: { left: a, top: s }, "data-ink-menu": "true", children: /* @__PURE__ */ m(_a, { ink: e, page: t.page, onPick: n }) });
}
function im({ ink: e }) {
  return e.tool ? /* @__PURE__ */ m("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ m(_a, { ink: e }) }) : null;
}
function lm(e) {
  var r;
  if (e.shiftKey || Aa(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Do}`))) return null;
  const n = Number((r = t.closest(`[${Ee}]`)) == null ? void 0 : r.getAttribute(Ee)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function cm(e) {
  const t = M(e);
  t.current = e, C(() => {
    const n = (r) => {
      if (Aa(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
function Rn() {
  try {
    return ot().translationVersions ?? null;
  } catch {
    return null;
  }
}
function dm(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function um(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function fm(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function mm({ documentId: e, jobId: t }) {
  const [n, r] = E([]), [o, a] = E(null), [s, i] = E(null), [l, c] = E(""), [d, f] = E(""), u = M(0);
  C(() => {
    r([]), i(null), f("");
    const y = Rn();
    if (!y || !e) return;
    let w = !1;
    return y.list(e).then((S) => {
      w || (r(S.versions), a(S.currentVersionId));
    }).catch(() => {
    }), () => {
      w = !0;
    };
  }, [e, t]);
  const p = z((y) => {
    const w = Rn(), S = n.find((v) => v.versionId === y);
    if (!w || !S || !e) return;
    const b = ++u.current;
    c(y), f(""), (async () => {
      const v = ot(), I = await w.resolveJob(e, y);
      if (!I) throw new Error("这一份还没有能读的译文。");
      const T = await v.loadReaderPayload(I, { includeOptionalArtifacts: !0 }), D = v.resolveReaderTranslatedPdfUrl(T.jobPayload, T.manifestPayload);
      if (!D) throw new Error("这一份没有译文 PDF。");
      return { versionId: y, name: S.name, jobId: I, url: D, regions: dm(So(T.regionsPayload)) };
    })().then((v) => {
      b === u.current && i(v);
    }).catch((v) => {
      b === u.current && f((v == null ? void 0 : v.message) || "这一份打不开。");
    }).finally(() => {
      b === u.current && c("");
    });
  }, [e, n]), g = z(() => {
    u.current += 1, i(null), c(""), f("");
  }, []), h = z(async () => {
    var S, b;
    const y = Rn();
    if (!y || !s || !e) return;
    try {
      await y.select(e, s.versionId);
    } catch (v) {
      f((v == null ? void 0 : v.message) || "换不过去，请稍后再试。");
      return;
    }
    const w = (S = globalThis.location) == null ? void 0 : S.href;
    w && ((b = globalThis.history) == null || b.replaceState(globalThis.history.state, "", fm(w, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: um(n, t, o),
    compared: s,
    loading: l,
    error: d,
    choose: p,
    clear: g,
    adopt: h
  };
}
const hm = "reader-finder-input";
function pm(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function gm(e, t = typeof window > "u" ? null : window) {
  C(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!pm(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(hm) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function bm() {
  try {
    return ot().translationEdit ?? null;
  } catch {
    return null;
  }
}
const ym = "这本书正在处理（翻译或排版），处理完才能改。", vm = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function wm({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = bm(), s = `${e || ""}`.trim(), i = !!(a && s && r), l = fc(s), c = !t || Ot(t), d = yc(n), [f, u] = E(""), [p, g] = E(null), [h, y] = E(() => /* @__PURE__ */ new Map()), [w, S] = E(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, v] = E(() => /* @__PURE__ */ new Map()), [I, T] = E({ phase: "idle" }), D = M({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  C(() => {
    g(null), D.drafts.clear(), D.generation.current = null, v(/* @__PURE__ */ new Map()), T({ phase: "idle" });
  }, [s]), C(() => {
    if (u(""), !i || l || !a) return;
    let _ = !1;
    return a.resolveOwnerJobId(s).then((H) => {
      _ || u(`${H || s}`.trim() || s);
    }).catch(() => {
      _ || u(s);
    }), () => {
      _ = !0;
    };
  }, [i, l, a, s]), C(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !d || !c) return;
    let _ = !1;
    return a.fetchRevisions(f).then((H) => {
      _ || y(vc(H, d));
    }).catch(() => {
    }), () => {
      _ = !0;
    };
  }, [a, f, d, c]);
  const F = I.phase === "running" && I.seenActive;
  C(() => {
    if (I.phase === "running") {
      if (!c) {
        F || T({ phase: "running", seenActive: !0 });
        return;
      }
      F && T(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [I.phase, F, c, t]);
  const j = q(() => {
    const _ = new Map(h);
    if (w.renderedAt === d)
      for (const [H, $] of w.edits) _.set(H, $);
    return _;
  }, [h, w, d]), N = z((_) => {
    const H = `${_ || ""}`.trim();
    H && g({ itemId: H, page: mc(H) });
  }, []), R = z(() => g(null), []), P = z((_, H) => {
    S(($) => {
      const W = new Map($.renderedAt === d ? $.edits : []);
      return W.set(_, H), { renderedAt: d, edits: W };
    }), v(($) => new Map($).set(_, ($.get(_) || 0) + 1));
  }, [d]), k = z(async () => {
    if (!(!a || !s || I.phase === "submitting" || I.phase === "running")) {
      T({ phase: "submitting" });
      try {
        await a.rerender(s), T({ phase: "running", seenActive: !1 }), await o();
      } catch (_) {
        T({ phase: "failed", message: (_ == null ? void 0 : _.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, I.phase, o]), A = l ? vm : !c || I.phase === "running" || I.phase === "submitting" ? ym : "";
  return q(() => ({
    available: i,
    blockedReason: A,
    port: a,
    ownerJobId: f,
    target: p,
    select: N,
    close: R,
    memory: D,
    pendingEdits: j,
    savedCounts: b,
    markSaved: P,
    rerender: I,
    startRerender: k
  }), [i, A, a, f, p, N, R, D, j, b, P, I, k]);
}
function Sm(e, t) {
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
function Im({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ m("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ L("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ m("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ m(
      X,
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
const La = "retainpdf:reader:doc-theme:v1", ho = "data-reader-doc";
function Da() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Rm(e = Da()) {
  try {
    return (e == null ? void 0 : e.getItem(La)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function Pm(e, t = Da()) {
  try {
    t == null || t.setItem(La, e);
  } catch {
  }
}
function po(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(ho, "dark") : t.removeAttribute(ho));
}
function km() {
  const [e, t] = E(() => Rm());
  C(() => {
    po(e);
  }, [e]), C(() => () => po("light"), []);
  const n = z(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return Pm(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
const go = 6e3;
function Tm(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function Em(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > go && (s *= go / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function Mm({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = M(null), [i, l] = E({ status: "loading", cssHeight: 0 }), c = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return C(() => {
    let d = !1, f = null;
    return l((u) => ({ status: "loading", cssHeight: u.cssHeight })), (async () => {
      try {
        const u = await e.getPage(t);
        if (d) return;
        const p = u.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = Em(n, p, r, g), y = s.current, w = y == null ? void 0 : y.getContext("2d");
        if (!y || !w) return;
        y.width = h.canvasWidth, y.height = h.canvasHeight, l({ status: "loading", cssHeight: h.cssHeight });
        const S = u.getViewport({ scale: h.scale, offsetX: h.offsetX, offsetY: h.offsetY }), b = u.render({ canvasContext: w, viewport: S });
        f = b, await b.promise, d || l({ status: "ready", cssHeight: h.cssHeight });
      } catch (u) {
        !d && (u == null ? void 0 : u.name) !== "RenderingCancelledException" && l((p) => ({ status: "error", cssHeight: p.cssHeight }));
      }
    })(), () => {
      d = !0, f == null || f.cancel();
    };
  }, [e, c]), /* @__PURE__ */ L(
    "div",
    {
      className: `reader-region-canvas${o ? ` ${o}` : ""}`,
      "data-status": i.status,
      style: { width: r, height: i.cssHeight || void 0 },
      children: [
        /* @__PURE__ */ m("canvas", { ref: s, role: "img", "aria-label": a ?? `第 ${t} 页的一块`, style: { width: r, height: i.cssHeight || void 0 } }),
        i.status === "error" ? /* @__PURE__ */ m("p", { className: "reader-region-canvas-error", children: "这一块没画出来。" }) : null
      ]
    }
  );
}
const bo = { figure: "图", table: "表", formula: "公式", text: "文字" }, Ye = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function Nm(e, t, n) {
  const r = kn(e, t, n), o = r ? cn(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = Tm({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function Am(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function _m(e, t) {
  const n = (o) => {
    const a = Je(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function Lm({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var j;
  const i = t.find((N) => N.itemId === e) ?? null, l = q(() => i ? _m(t, i) : [], [t, i]), c = i ? l.indexOf(i) : -1, [d, f] = E(Ye.indexOf(1)), u = Ye[d], p = M(null), [g, h] = E(0);
  Ie(() => {
    const N = p.current;
    if (!N) return;
    const R = () => h(N.clientWidth);
    R();
    const P = typeof ResizeObserver == "function" ? new ResizeObserver(R) : null;
    return P == null || P.observe(N), () => P == null ? void 0 : P.disconnect();
  }, []);
  const y = z((N) => {
    const R = l[c + N];
    R && a(R.itemId);
  }, [l, c, a]);
  C(() => {
    const N = (R) => {
      if (R.key === "Escape")
        R.preventDefault(), s();
      else if (R.key === "ArrowLeft")
        R.preventDefault(), y(-1);
      else if (R.key === "ArrowRight")
        R.preventDefault(), y(1);
      else if (R.key === "+" || R.key === "=")
        R.preventDefault(), f((P) => Math.min(Ye.length - 1, P + 1));
      else if (R.key === "-" || R.key === "_")
        R.preventDefault(), f((P) => Math.max(0, P - 1));
      else if (R.key === "0")
        R.preventDefault(), f(Ye.indexOf(1));
      else
        return;
      R.stopPropagation();
    };
    return window.addEventListener("keydown", N, !0), () => window.removeEventListener("keydown", N, !0);
  }, [s, y]), C(() => {
    const N = p.current;
    if (!N) return;
    const R = (P) => {
      !P.ctrlKey && !P.metaKey || (P.preventDefault(), f((k) => Math.max(0, Math.min(Ye.length - 1, k + (P.deltaY < 0 ? 1 : -1)))));
    };
    return N.addEventListener("wheel", R, { passive: !1 }), () => N.removeEventListener("wheel", R);
  }, []);
  const w = M(null);
  if (!i) return null;
  const S = Je(i), b = o.map((N) => ({ pane: N, pdf: r[N] ?? null, where: Nm(i, n, N) })).filter((N) => !!(N.pdf && N.where)), v = 16, I = typeof window > "u" ? 800 : window.innerHeight, T = Math.min(880, I * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), D = b.length ? Am(Math.max(120, (g - v * (b.length - 1) - 32) / b.length), T, b.map((N) => N.where.aspect)) : 0, F = ((j = b[0]) == null ? void 0 : j.where.page) ?? i.source.page;
  return /* @__PURE__ */ L("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${bo[S] ?? "这一块"}`, children: [
    /* @__PURE__ */ m("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ L("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ L("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ L("span", { className: "reader-zoom-title", children: [
          bo[S] ?? "这一块",
          " · 第 ",
          F,
          " 页"
        ] }),
        /* @__PURE__ */ m("span", { className: "reader-zoom-count", children: c >= 0 ? `${c + 1} / ${l.length}` : "" }),
        /* @__PURE__ */ L("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ m(dt, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: c <= 0, onClick: () => y(-1), children: /* @__PURE__ */ m(vs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ m(dt, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: c < 0 || c >= l.length - 1, onClick: () => y(1), children: /* @__PURE__ */ m(Eo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ m(dt, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: d === 0, onClick: () => f((N) => Math.max(0, N - 1)), children: /* @__PURE__ */ m(ws, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ L(X, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(Ye.indexOf(1)), children: [
            Math.round(u * 100),
            "%"
          ] }),
          /* @__PURE__ */ m(dt, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: d === Ye.length - 1, onClick: () => f((N) => Math.min(Ye.length - 1, N + 1)), children: /* @__PURE__ */ m(Ss, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ m(dt, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ m(gt, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ m(
        "div",
        {
          ref: p,
          className: "reader-zoom-body",
          onPointerDown: (N) => {
            const R = p.current;
            !R || N.button !== 0 || (w.current = { x: N.clientX, y: N.clientY, left: R.scrollLeft, top: R.scrollTop }, R.setPointerCapture(N.pointerId));
          },
          onPointerMove: (N) => {
            const R = p.current, P = w.current;
            !R || !P || (R.scrollLeft = P.left - (N.clientX - P.x), R.scrollTop = P.top - (N.clientY - P.y));
          },
          onPointerUp: () => {
            w.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ m("div", { className: "reader-zoom-columns", style: { gap: v }, children: b.map(({ pane: N, pdf: R, where: P }) => /* @__PURE__ */ L("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ m("figcaption", { children: N === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ m(
              Mm,
              {
                className: "reader-zoom-canvas",
                pdf: R,
                page: P.page,
                region: P.fraction,
                cssWidth: D * u,
                label: `${N === "source" ? "原文" : "译文"}第 ${P.page} 页`
              }
            )
          ] }, N)) }) : /* @__PURE__ */ m("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const Dm = xa(() => import("./ReaderMarkdownPanel-CbjIy0zY.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Cm = [];
function xm(e) {
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
function zm(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Om() {
  var K;
  const e = Ul(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Uf(e.viewStateKey), s = a.panel, i = a.setPanel, [l, c] = E(!1), d = M(null), f = M(null), u = s !== null, p = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, g = xm({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: p,
    liveTranslationVisible: l,
    assistantOpen: u
  }), h = Al({
    hasOverlayContent: p,
    connection: e.liveTranslation.connection,
    showSource: g.showSource,
    liveTranslationVisible: l,
    assistantOpen: u
  }), y = g.sourceViewOnly, w = g.visibleMode;
  C(() => {
    c(!1);
  }, [e.viewStateKey]), C(() => {
    e.session.jobTerminal && c(!1);
  }, [e.session.jobTerminal]);
  const S = M(null);
  C(() => {
    S.current !== e.viewStateKey && Dl({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: y,
      jobTerminal: e.session.jobTerminal
    }) && (S.current = e.viewStateKey, c(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, y]), C(() => {
    if (!(t.loading || t.failed)) {
      if (d.current !== e.viewStateKey) {
        d.current = e.viewStateKey;
        const x = ze(e.viewStateKey), U = Jf({
          savedMode: x == null ? void 0 : x.mode,
          sourceViewOnly: y,
          viewportWidth: tt()
        });
        f.current = U.auto ? U.mode : null, U.mode && U.mode !== e.mode && e.setModeKeepingPage(U.mode);
        return;
      }
      qf(e.mode, f.current) && (f.current = null, un(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, y]);
  const b = s || (e.mode === "compare" ? "compare" : "reading"), v = Zf(s, "markdown"), { docDark: I, toggleDocDark: T } = km();
  Zl({
    toggleDocDark: T,
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
  const D = z(() => {
    i(null);
  }, []), F = _l(e.liveTranslation), j = z(() => {
    F && e.goToPage(F, "source");
  }, [e.goToPage, F]), [N, R] = E(null);
  C(() => {
    w === "compare" && e.session.jobTerminal && R(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, w]);
  const P = N !== e.viewStateKey && Cl({
    state: e.liveTranslation,
    sourceViewOnly: y,
    visibleMode: w
  }), k = z((x) => {
    const U = zm(x, e.liveTranslationAvailable);
    U !== null && c(U), e.setModeKeepingPage(x);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), A = q(() => h.sourcePaneToggle ? /* @__PURE__ */ m(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${l ? " is-active" : ""}`,
      onClick: () => c((x) => !x),
      "aria-pressed": l,
      title: l ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [h.sourcePaneToggle, l]), _ = z((x) => {
    i(x);
  }, []), [H] = E(Yf), [$, W] = E(null), re = z((x) => W((U) => U === x ? null : x), []), [oe, Z] = E(""), [pe, ce] = E("");
  C(() => {
    const x = oe.replace(/\s+/gu, " ").trim(), U = window.setTimeout(() => ce(x), x ? 150 : 0);
    return () => window.clearTimeout(U);
  }, [oe]);
  const [ae, Me] = E(0), ee = z(() => {
    W("search"), Me((x) => x + 1);
  }, []);
  gm(ee);
  const Q = z((x) => {
    e.jumpToAnchor({ block_id: x }), ($ === "outline" || tt() < 900) && W(null);
  }, [e.jumpToAnchor, $]), ge = z((x) => e.jumpToAnchor({ block_id: x }), [e.jumpToAnchor]), [ue, he] = E({}), Ne = M({ source: r.sourceUrl, translated: r.translatedUrl });
  Ne.current = { source: r.sourceUrl, translated: r.translatedUrl };
  const Oe = z((x, U) => {
    he((Be) => ({ ...Be, [U]: { url: Ne.current[U], nodes: x } }));
  }, []), at = q(() => {
    const x = ue.source;
    if (x && x.url === r.sourceUrl && x.nodes.length) return x.nodes;
    const U = ue.translated;
    return U && U.url === r.translatedUrl && U.nodes.length ? U.nodes : Cm;
  }, [ue, r.sourceUrl, r.translatedUrl]), ke = M({}), [ne, B] = E(0), Y = z((x, U) => {
    ke.current[U] = { url: Ne.current[U], pdf: x }, B((Be) => Be + 1);
  }, []), [te, de] = E(null), le = z((x) => de(x), []), Ae = z(() => de(null), []);
  C(() => de(null), [e.viewStateKey]);
  const Re = q(() => {
    const x = (U, Be) => {
      const lt = ke.current[U];
      return lt && lt.url === Be ? lt.pdf : null;
    };
    return { source: x("source", r.sourceUrl), translated: x("translated", r.translatedUrl) };
  }, [ne, r.sourceUrl, r.translatedUrl]), De = z((x) => {
    e.goToPage(x), ($ === "outline" || tt() < 900) && W(null);
  }, [e.goToPage, $]), me = wm({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), $e = me.select, st = e.setModeKeepingPage, Ge = o.regions, Pe = z((x) => {
    Rc(Ge, x) && (w === "source" && st("compare"), $e(x));
  }, [Ge, $e, w, st]);
  Sm(me.available ? Pe : null, H);
  const ye = md(e.viewStateKey);
  cm(ye);
  const [Ze, Fe] = E(null), vt = z(() => Fe(null), []), Se = mm({ documentId: o.documentId, jobId: o.jobId }), it = ((K = Se.compared) == null ? void 0 : K.url) || "";
  C(() => {
    it && w !== "compare" && k("compare");
  }, [it]), C(() => {
    w !== "compare" && Se.clear();
  }, [w]);
  const O = q(
    () => {
      const { compared: x, versions: U, readingVersionId: Be } = Se;
      if (!x) return null;
      const lt = U.find((fn) => fn.versionId === x.versionId), wt = U.find((fn) => fn.versionId === Be);
      return {
        url: x.url,
        regions: x.regions,
        left: { name: x.name, createdAt: (lt == null ? void 0 : lt.createdAt) || "" },
        right: { name: (wt == null ? void 0 : wt.name) || "当前译文", createdAt: (wt == null ? void 0 : wt.createdAt) || "" }
      };
    },
    [Se.compared, Se.versions, Se.readingVersionId]
  ), V = q(() => {
    if (!me.savedCounts.size) return e.revisedBlocks;
    const x = new Map(e.revisedBlocks);
    for (const [U, Be] of me.savedCounts) x.set(U, (x.get(U) || 0) + Be);
    return x;
  }, [e.revisedBlocks, me.savedCounts]), J = q(() => ({
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
    regionHover: H,
    jumpToBlock: ge,
    revisedBlocks: V,
    onPdfOutline: Oe,
    onPdfDocument: Y,
    zoomBlock: le,
    editBlock: me.available ? Pe : void 0,
    blockEdit: me,
    editShowsSource: w !== "compare",
    findTerm: $ === "search" ? pe : "",
    compareVersion: O,
    ink: ye,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: y,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: _, close: D },
    docDark: I,
    toggleDocDark: T
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
    H,
    ge,
    V,
    Oe,
    Y,
    le,
    me,
    Pe,
    w,
    $,
    pe,
    O,
    ye,
    e.sourceOnly,
    y,
    e.download,
    e.goToPage,
    _,
    D,
    I,
    T
  ]), G = q(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), se = [
    Si,
    `is-workspace-${b}`,
    u ? "is-assistant-open" : "",
    $ ? "is-finder-open" : "",
    g.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ m(wd, { value: J, hud: G, children: /* @__PURE__ */ L(
    "div",
    {
      className: se,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": b,
      "data-ink-mode": ye.tool || void 0,
      onContextMenu: (x) => {
        const U = lm(x);
        U && (x.preventDefault(), Fe(U));
      },
      children: [
        /* @__PURE__ */ m(ff, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
        /* @__PURE__ */ m(tm, { open: $, onToggle: re }),
        $ ? /* @__PURE__ */ m(
          rm,
          {
            tab: $,
            onTab: W,
            onClose: () => W(null),
            onJump: Q,
            bookmarks: at,
            onJumpPage: De,
            query: oe,
            onQuery: Z,
            term: pe,
            focusSignal: ae
          }
        ) : null,
        /* @__PURE__ */ L("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ m(Sf, {}),
          /* @__PURE__ */ m(rc, { onBeforeClose: o.prepareClose })
        ] }),
        /* @__PURE__ */ m(
          bu,
          {
            mode: w,
            documentReady: !!o.jobId,
            sourceViewOnly: y,
            onModeChange: k,
            liveTranslation: h.topBarPill ? {
              visible: l,
              state: e.liveTranslation,
              onToggle: () => c((x) => !x),
              latestPage: l ? F : null,
              currentPage: e.currentPage,
              onJumpToLatest: j
            } : null,
            completion: P ? {
              onOpenCompare: () => {
                R(e.viewStateKey), k("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ m(Ru, { active: s }),
        u ? /* @__PURE__ */ m(df, {}) : null,
        /* @__PURE__ */ m(mu, { paneComposition: g, markdownSplit: v.open, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: A }),
        e.showHud ? /* @__PURE__ */ m(
          jf,
          {
            mode: w,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : o.jobId,
            searchSlot: /* @__PURE__ */ m(nm, { open: $, onToggle: re })
          }
        ) : null,
        /* @__PURE__ */ m(Ca, { fallback: null, children: v.mounted ? /* @__PURE__ */ m(Dm, { open: v.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: D }) : null }),
        te ? /* @__PURE__ */ m(
          Lm,
          {
            itemId: te,
            regions: o.regions,
            metadata: o.readerMetadata,
            documents: Re,
            panes: w === "compare" ? ["source", "translated"] : w === "translated" ? ["translated"] : ["source"],
            onNavigate: de,
            onClose: Ae
          }
        ) : null,
        /* @__PURE__ */ m(om, { active: s, compare: Se, ink: ye }),
        /* @__PURE__ */ m(sm, { ink: ye, menu: Ze, onClose: vt }),
        /* @__PURE__ */ m(im, { ink: ye }),
        /* @__PURE__ */ m(Im, { edit: me }),
        /* @__PURE__ */ m(Vf, {})
      ]
    }
  ) });
}
function nh() {
  return /* @__PURE__ */ m(Om, {});
}
export {
  nh as R,
  Om as a,
  eh as d,
  Qm as f,
  th as r,
  qe as u
};
//# sourceMappingURL=ReaderApp-nhpnFsmP.js.map
