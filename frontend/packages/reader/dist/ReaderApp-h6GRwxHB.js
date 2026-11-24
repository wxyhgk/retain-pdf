var nr = (e) => {
  throw TypeError(e);
};
var rr = (e, t, n) => t.has(e) || nr("Cannot " + n);
var wt = (e, t, n) => (rr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), or = (e, t, n) => t.has(e) ? nr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), ar = (e, t, n, r) => (rr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as _, jsx as p, Fragment as lt } from "react/jsx-runtime";
import { useMemo as J, useState as M, useEffect as D, useCallback as x, useRef as N, useLayoutEffect as Re, memo as en, createContext as _n, useContext as Ln, forwardRef as so, useImperativeHandle as Dn, useSyncExternalStore as io, useId as lo, Suspense as Ra, lazy as Ta } from "react";
import { requireAdapter as yt, getReaderAdapters as Le } from "./adapters.js";
import { resolveReaderDownloadName as Ea, resolveReaderDownloadUrls as Pa, READER_PROGRESS_COPY as je, trimString as Kt, READER_DOWNLOAD_ACTIONS as ka, disabledReason as Ma } from "./runtime/state.js";
import { r as Na, b as Aa } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as pn, isFinishedJobStatus as Mt } from "@retainpdf/domain/job";
import { n as co, d as _a, f as nn, k as sr, b as La, c as Da, j as xt, p as Cn, g as Ca, l as ir, i as xa } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as Oa } from "@retainpdf/api/documents";
import { isReaderTransportError as za, createReaderTransportError as $a } from "./contracts.js";
import { toast as gn, Toaster as Fa } from "sonner";
import { X as vt, PenLine as xn, Check as uo, Copy as Ba, ChevronUp as ja, ChevronDown as fo, History as Ua, LoaderCircle as Ha, Pin as Wa, LogOut as Ka, FileText as mo, Columns2 as ho, Languages as po, Radio as Va, ArrowDownToLine as Ja, CheckCircle2 as qa, Keyboard as Ga, Download as Za, ListOrdered as Ya, TriangleAlert as Xa, ListTree as Qa, Search as es, GitCompareArrows as ts, LayoutGrid as ns, Highlighter as rs, Eraser as os, Undo2 as as, Trash2 as ss } from "lucide-react";
import { Button as ee, Textarea as is, IconButton as lr, Input as go } from "@retainpdf/ui";
import { pdfjs as bo, Page as ls, Document as cs } from "react-pdf";
import { e as ds, m as us, a as fs } from "./markdown-math-XkF5urpn.js";
const ms = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, hs = "", ps = Object.freeze({
  progress: "retainpdf-reader-progress"
}), gs = (e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, bm = (...e) => {
  var n;
  return (((n = Le()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Ue = () => yt("defaultReaderDataPort"), cr = () => yt("defaultReaderPageConfigPort"), ym = {
  get apiPrefix() {
    return Ue().apiPrefix;
  },
  fetchProtected: (...e) => Ue().fetchProtected(...e),
  loadMarkdownPayload: (e) => Ue().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Ue().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Ue().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Ue().loadJobPayload(e),
  loadReaderPayload: (e, t) => Ue().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Ue().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Ue().liveTranslation;
  }
}, yo = {
  messageTargetOrigin: () => cr().messageTargetOrigin(),
  readerJobId: () => cr().readerJobId()
}, bs = () => {
  var e;
  return ((e = Le()) == null ? void 0 : e.liveTranslation) ?? null;
}, Nt = () => {
  var t;
  const e = Le();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, tt = () => {
  const e = Le();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => yt("fetchDocumentByJobId")(...n),
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
}, ys = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, vs = () => {
  var e, t;
  return ((t = (e = Le()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, ws = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Ss = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Ea(...e);
}, Is = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Pa(...e);
}, Rs = (...e) => yt("downloadProtectedResource")(...e), Ts = (...e) => yt("failDownloadToast")(...e), vm = (e, t) => yt("resolveMarkdownAssetUrl")(e, t), dr = "/api/v1";
function Es() {
  const e = () => {
    var r;
    return Na(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = M(e);
  return D(() => {
    var i, l, c, d;
    const r = () => n(e()), o = (l = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : l.bind(globalThis.history), a = (d = (c = globalThis.history) == null ? void 0 : c.replaceState) == null ? void 0 : d.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const f = (u) => function(...m) {
          const g = u.apply(this, m);
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
function Ps() {
  const e = Es(), t = J(() => ws(yo), [e]), n = J(() => vs(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function ks(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [l, c] = M({
    documentId: "",
    jobId: ""
  }), [d, f] = M({
    documentId: "",
    jobId: ""
  }), u = l.documentId === t ? l.jobId : "", m = d.documentId === t ? d.jobId : "", g = n || u, [h, y] = M({
    jobId: "",
    documentId: ""
  }), w = h.jobId === g ? h.documentId : "", S = t || w, v = !!t && !g, [b, I] = M(null), R = (b == null ? void 0 : b.sessionIdentity) === r && b.documentId === S ? b : null, k = v || !!R, O = x((F) => {
    const T = `${F.documentId || ""}`.trim();
    if (!T || a.current && a.current !== T) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: T
      });
    else if (!a.current)
      return;
    const P = `${F.revision || ""}`.trim() || `${Date.now()}`;
    I({
      documentId: T,
      revision: P,
      sessionIdentity: o.current
    }), i();
  }, []);
  D(() => {
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
        y((T) => T.jobId === F.jobId && T.documentId === F.documentId ? T : { jobId: F.jobId, documentId: F.documentId });
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
    sessionJobId: g,
    resolvedJobDocument: h,
    setResolvedJobDocument: y,
    jobDocumentId: w,
    documentId: S,
    sourceOnly: v,
    committedDocumentSource: b,
    setCommittedDocumentSource: I,
    activeCommittedDocumentSource: R,
    sourceViewOnly: k,
    refreshCommittedDocument: O,
    applyIdentityEvent: $
  };
}
function ur(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Ms(e) {
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
function fr(e, t) {
  return gs(pn(e, t));
}
function Ns(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function As(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !Ns(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function bn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: ps.progress,
        stage: n,
        percent: e,
        text: t
      },
      yo.messageTargetOrigin()
    );
  } catch {
  }
}
function Vt(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), bn({ percent: t, text: n, stage: r });
}
function _s(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, l] = M(null), [c, d] = M(null), [f, u] = M(""), [m, g] = M(0), h = f === n ? i : null, y = f === n ? c : null, w = ur(h), S = Mt(w), v = x(() => {
    g(($) => $ + 1);
  }, []), b = x(($) => {
    l($.jobPayload), d($.manifestPayload), u($.sessionIdentity);
  }, []), I = x(($) => {
    l(null), d(null), u($);
  }, []), R = N(""), k = N(""), O = x(async () => {
    const $ = o.current;
    if (!$ || R.current === $) return;
    const F = tt().loadJobPayload;
    if (typeof F != "function") return;
    const T = a.current.value;
    R.current = $;
    try {
      const P = await F($);
      if (s.current || a.current.value !== T || o.current !== $ || !P || typeof P != "object")
        return;
      const E = ur(P);
      l(P), u(r.current), !Mt(E) && k.current === $ && (k.current = ""), E === "succeeded" && k.current !== $ && (k.current = $, g((A) => A + 1));
    } catch {
    } finally {
      R.current === $ && (R.current = "");
    }
  }, []);
  return D(() => {
    k.current = "";
  }, [n]), D(() => {
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
    scopedManifestPayload: y,
    jobStatus: w,
    jobTerminal: S,
    jobRefreshRevision: m,
    refreshJobArtifacts: v,
    refreshJobStatus: O,
    publishPayload: b,
    clearPayload: I
  };
}
function yn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Ls(e, t) {
  e(t), yn(t);
}
function Ds(e) {
  const [t, n] = M(e ? "source" : "compare"), r = x((a) => {
    e && a !== "source" || (n(a), yn(a));
  }, [e]), o = x((a) => {
    Ls(n, a);
  }, []);
  return D(() => (e && document.documentElement.classList.add("reader-source-only"), yn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function mr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Cs(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: mr(n.active_job_id),
    activeVersionId: mr(n.active_version_id)
  };
}
function xs(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Os(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function zs(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const $s = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Fs(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = $s.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Bs = 48 * 1024 * 1024;
function js(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Us = 2, Pe = /* @__PURE__ */ new Map();
function vn(e, t) {
  Pe.delete(e), Pe.set(e, t);
}
function hr(e) {
  if (Pe.size < Us) return;
  const t = Pe.keys().next().value;
  t && Pe.delete(t);
}
async function Hs(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function vo(e, t = Nt().fetchProtected, n = {}) {
  var d, f, u, m, g, h, y, w, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Pe.has(r)) {
    const v = Pe.get(r);
    return vn(r, v), v;
  }
  const o = new AbortController(), a = () => o.abort();
  (d = n.signal) != null && d.aborted && o.abort(), (u = (f = n.signal) == null ? void 0 : f.addEventListener) == null || u.call(f, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (g = (m = n.signal) == null ? void 0 : m.removeEventListener) == null || g.call(m, "abort", a);
  }
  if (!s.ok) {
    const v = new Error(`读取 PDF 失败 (${s.status})`);
    v.status = s.status;
    const b = await Hs(s);
    throw b && (v.reason = b), v;
  }
  const i = Ws(r, s, t);
  if (i) {
    o.abort();
    const v = { ranged: i };
    return hr(), Pe.set(r, v), v;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let l;
  try {
    l = await s.arrayBuffer();
  } finally {
    (S = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || S.call(w, "abort", a);
  }
  const c = { data: new Uint8Array(l) };
  return Pe.has(r) ? vn(r, c) : (hr(), Pe.set(r, c)), c;
}
function Ws(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Bs ? null : {
    url: e,
    length: o,
    async fetchRange(i, l) {
      const c = await n(e, { headers: { Range: `bytes=${i}-${l - 1}` } });
      if (c.status !== 206) throw new Error(`读取 PDF 片段失败 (${c.status})`);
      return new Uint8Array(await c.arrayBuffer());
    }
  };
}
const Ks = { file: null, loading: !1, error: "" }, Vs = { file: null, loading: !0, error: "" };
function Js(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = M(null);
  if (D(() => {
    if (t || !n) return;
    const s = Pe.get(n);
    if (s) {
      vn(n, s);
      return;
    }
    const i = new AbortController();
    return vo(n, void 0, { signal: i.signal }).then((l) => {
      i.signal.aborted || o({ url: n, file: l, loading: !1, error: "" });
    }).catch((l) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (l == null ? void 0 : l.message) || String(l) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Ks;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Pe.get(n);
  return a ? { file: a, loading: !1, error: "" } : Vs;
}
function qs(e) {
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
async function wn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  Vt(s, r, n, "download");
  const i = await vo(t, Nt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Vt(s, o, n, "download"), i);
}
async function Gs(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  Vt(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    wn({
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
    wn({
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
function Zs(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Ys({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Oa,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Zs(o.href, t, a)), !0);
}
const $t = {
  regions: null,
  metadata: null
};
function Xs(e) {
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
    jobRefreshRevision: g,
    sessionEpochRef: h,
    closingRef: y,
    activeLoadAbortRef: w
  } = e, [S, v] = M(""), [b, I] = M(""), [R, k] = M(null), [O, $] = M(null), [F, T] = M(!1), [P, E] = M(""), [A, L] = M([]), [j, z] = M(!1), [H, Q] = M(() => ({
    source: null,
    translated: null
  })), [se, X] = M(
    $t
  ), [fe, me] = M({
    loading: !0,
    percent: 4,
    text: je.boot,
    stage: "progress",
    failed: !1
  });
  return D(() => {
    const he = new AbortController(), De = h.current.value, q = qs({
      sessionEpochRef: h,
      closingRef: y,
      abort: he,
      sessionEpoch: De
    });
    w.current = he;
    const Y = tt();
    if (y.current)
      return he.abort(), () => {
        w.current === he && (w.current = null);
      };
    let we = !1;
    function te(ne, B) {
      q.markFailed(), z(!0), me({
        loading: !1,
        percent: 100,
        text: ne,
        stage: "failed",
        failed: !0
      }), bn({ percent: 100, text: B, stage: "failed" });
    }
    function pe() {
      T(!0), we || z(!0), me({
        loading: !1,
        percent: 100,
        text: je.ready,
        stage: "ready",
        failed: !1
      }), bn({ percent: 100, text: je.ready, stage: "ready" });
    }
    function qe() {
      return c != null && c.documentId ? fr(
        c.documentId,
        c.revision
      ) : ms() ? hs : Y.resolveResourceUrl(pn(r));
    }
    async function Me() {
      var ue;
      let ne = { activeJobId: "", activeVersionId: "" };
      try {
        const ce = await ((ue = Y.fetchDocument) == null ? void 0 : ue.call(Y, r));
        ce && (ne = Cs(ce));
      } catch {
      }
      const B = xs({
        link: ne,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!c
      });
      if (B.kind === "follow-active-job") {
        if (q.isInactive()) return;
        d({
          type: "resolved-document-job",
          documentId: r,
          jobId: B.jobId
        }), B.activeVersionId ? (c || d({
          type: "committed-source",
          documentId: r,
          revision: B.activeVersionId,
          sessionIdentity: l
        }), m("source")) : m("compare");
        return;
      }
      if (B.kind === "open-committed-source") {
        if (q.isInactive()) return;
        d({
          type: "committed-source",
          documentId: r,
          revision: B.revision,
          sessionIdentity: l
        }), m("source");
        return;
      }
      const oe = qe();
      if (q.isInactive()) return;
      v(oe), I(""), E(""), u(l);
      const G = await wn({
        url: oe,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: q,
        setBoot: me
      });
      if (!q.isInactive()) {
        if (!G) {
          te("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        k(G), pe();
      }
    }
    async function Te() {
      var V;
      const ne = !c, B = !!(ne && Y.loadSessionSnapshot && Y.loadReaderOptionalArtifacts), oe = B ? Y.loadReaderOptionalArtifacts(t) : null, G = await ((V = Y.loadSessionSnapshot) == null ? void 0 : V.call(Y, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: c,
        includeOptionalArtifacts: ne && !B
      })), ue = G ? {
        jobPayload: G.sourcePayload,
        manifestPayload: G.manifestPayload,
        readerMetadata: G.readerMetadata,
        regionsPayload: G.regions,
        readerErrors: G.readerErrors
      } : await Y.loadReaderPayload(t, {
        includeOptionalArtifacts: ne
      });
      if (q.isInactive()) return;
      let ce = null;
      if (n && !r)
        if (G && G.linkedDocument !== void 0)
          ce = G.linkedDocument;
        else {
          try {
            ce = await Y.fetchDocumentByJobId(dr, t);
          } catch {
          }
          if (q.isInactive()) return;
        }
      const Ee = Ms(ue.jobPayload) || `${(ce == null ? void 0 : ce.document_id) || ""}`.trim();
      Ee && !r && d({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ee
      });
      const Ie = Os({
        payloadDocumentId: Ee,
        linkedActiveJobId: `${(ce == null ? void 0 : ce.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ce == null ? void 0 : ce.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!c
      });
      if (Ie.kind === "restore-committed-source") {
        if (q.isInactive()) return;
        d({
          type: "committed-source",
          documentId: Ie.documentId,
          revision: Ie.revision,
          sessionIdentity: l
        }), m("source");
        return;
      }
      const Ce = Y.resolveReaderSourcePdf(ue.manifestPayload), xe = Y.resolveReaderTranslatedPdfUrl(ue.jobPayload, ue.manifestPayload), Be = typeof Ce == "string" ? Ce : Y.resolveReaderArtifactUrl(Ce), U = r || Ee, re = c != null && c.documentId ? fr(
        c.documentId,
        c.revision
      ) : Be || (U ? Y.resolveResourceUrl(pn(U)) : ""), Ne = c ? "" : xe || "";
      v(re || ""), I(Ne), E(As(ue.jobPayload, t)), f({
        jobPayload: ue.jobPayload || null,
        manifestPayload: ue.manifestPayload || null,
        sessionIdentity: l
      });
      const Ge = () => Gs({
        sourceFinal: re || "",
        translatedFinal: Ne,
        fence: q,
        setBoot: me
      }), Ae = !!(re || Ne), Oe = oe && Ae ? Ge() : null;
      Oe == null || Oe.catch(() => {
      });
      const zt = (K) => {
        q.isInactive() || (L(c ? [] : co(K.regionsPayload)), Q(c ? { source: null, translated: null } : _a(K.readerMetadata)), X(c ? $t : K.readerErrors ?? $t), z(!0));
      };
      if (oe ? (we = !0, oe.then(zt)) : zt(ue), !Ae) {
        te(je.failed, je.failed);
        return;
      }
      const C = await (Oe ?? Ge());
      if (C.status !== "inactive") {
        if (C.status === "incomplete") {
          te("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        k(C.sourceBytes), $(C.translatedBytes), pe();
      }
    }
    async function ge() {
      T(!1), k(null), $(null), L([]), z(!1), Q({ source: null, translated: null }), X($t), Vt(me, 8, je.metadata, "metadata");
      try {
        if (s) {
          await Me();
          return;
        }
        if (!t) {
          te(je.failed, je.failed);
          return;
        }
        await Te();
      } catch (ne) {
        if (q.isClosedOrStale() || (ne == null ? void 0 : ne.name) === "AbortError") return;
        q.markFailed();
        const B = Number(ne == null ? void 0 : ne.status), oe = `${(ne == null ? void 0 : ne.reason) || ""}`, G = Fs({ status: B, reason: oe, sessionJobId: t });
        if (G && (await Ys({
          apiPrefix: dr,
          documentId: G,
          expiredJobId: t
        }) || q.isClosedOrStale()))
          return;
        if (zs({
          status: B,
          reason: oe,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          d({ type: "missing-document-job", documentId: r, jobId: t }), d({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const ue = ne instanceof Error ? ne.message : je.failed;
        te(ue, ue);
      }
    }
    return ge(), () => {
      he.abort(), w.current === he && (w.current = null);
    };
  }, [t, r, o, a, s, i, c, g, n, l, d, f, u, m]), {
    sourceUrl: S,
    translatedUrl: b,
    sourceFile: R,
    translatedFile: O,
    assetsReady: F,
    title: P,
    regions: A,
    regionsSettled: j,
    readerMetadata: H,
    readerErrors: se,
    boot: fe
  };
}
function Qs() {
  const e = N(!1), t = N(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Ps(), s = N({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = N(a), l = N(""), c = N(""), d = N(() => {
  }), f = x(() => d.current(), []), u = ks({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: l,
    sessionJobIdRef: c,
    switchToSourceMode: f
  }), {
    sessionJobId: m,
    documentId: g,
    sourceOnly: h,
    sourceViewOnly: y
  } = u, { mode: w, setMode: S, switchSessionMode: v } = Ds(y);
  d.current = () => {
    v("source");
  }, i.current = a, l.current = g, c.current = m;
  const b = _s({
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
    refreshJobStatus: T
  } = b, P = Xs({
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
    publishPayload: b.publishPayload,
    clearPayload: b.clearPayload,
    switchSessionMode: v,
    jobRefreshRevision: $,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), E = x(() => {
    var L;
    e.current = !0, (L = t.current) == null || L.abort();
  }, []), A = J(
    () => ({
      fetchProtected: tt().fetchProtected,
      jobId: m,
      jobPayload: I,
      manifestPayload: R,
      sourceUrl: P.sourceUrl,
      translatedUrl: P.translatedUrl,
      sourceOnly: y
    }),
    [m, I, R, P.sourceUrl, P.translatedUrl, y]
  );
  return {
    jobId: m,
    jobStatus: k,
    workflow: `${(I == null ? void 0 : I.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: O,
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
    refreshJobArtifacts: F,
    refreshJobStatus: T,
    refreshCommittedDocument: u.refreshCommittedDocument,
    prepareClose: E
  };
}
const ei = 160, ti = 8, ni = 0;
function ri() {
  const e = N(null), [t, n] = M(null), [r, o] = M(ni), a = x((s) => {
    e.current = s, n(s);
  }, []);
  return D(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (c) => {
      !Number.isFinite(c) || c < ei || o((d) => Math.abs(d - c) < ti ? d : c);
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
function oi(e) {
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
const rn = { source: 0, translated: 0 };
function ai(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: l
  } = e, c = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, d = N(c);
  d.current = c;
  const [f, u] = M(() => ({
    identity: c,
    pages: rn
  })), [m, g] = M(() => ({ identity: c, tick: 0 })), h = f.identity === c ? f.pages : rn, y = m.identity === c ? m.tick : 0, w = oi({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!l
  }), { primaryPane: S } = w, v = x((T, P) => {
    d.current === c && u((E) => {
      const A = E.identity === c ? E.pages : rn;
      return A[P] === T && E.identity === c ? E : {
        identity: c,
        pages: { ...A, [P]: T }
      };
    });
  }, [c]), b = N(null), I = x(() => {
    b.current && clearTimeout(b.current);
    const T = c;
    b.current = setTimeout(() => {
      b.current = null, d.current === T && g((P) => ({
        identity: T,
        tick: P.identity === T ? P.tick + 1 : 1
      }));
    }, 60);
  }, [c]);
  D(() => (b.current && (clearTimeout(b.current), b.current = null), u((T) => T.identity === c && T.pages.source === 0 && T.pages.translated === 0 ? T : { identity: c, pages: { source: 0, translated: 0 } }), g((T) => T.identity === c && T.tick === 0 ? T : { identity: c, tick: 0 }), () => {
    b.current && (clearTimeout(b.current), b.current = null);
  }), [c]);
  const R = J(
    () => Math.max(h.source, h.translated),
    [h]
  ), k = S === "translated" ? h.translated : h.source || h.translated, O = t == null ? void 0 : t.userZoom, $ = t == null ? void 0 : t.shellWidth, F = `${c}-${y}-${O}-${n}-${h.source}-${h.translated}-${$}`;
  return {
    ...w,
    numPagesByPane: h,
    hudNumPages: R,
    primaryNumPages: k,
    metricsTick: y,
    onNumPages: v,
    onMetrics: I,
    rowSyncRevision: F
  };
}
const ke = "data-reader-page", Se = "data-reader-pane", On = "data-natural-height", si = "reader-react-root", wo = "reader-react-grid", So = "reader-react-scroll-shell", Io = "reader-react-pdf-pane", Ro = "reader-react-pdf-page", Jt = "reader-react-pdf-page-placeholder", zn = "reader-react-pdf-page-slot";
function qt(e, t) {
  const n = e != null ? `[${ke}="${e}"]` : `[${ke}]`;
  return t ? `${n}[${Se}="${t}"]` : n;
}
function Gt() {
  return `.${zn}[${ke}]`;
}
function Zt(e) {
  return Number(e.getAttribute(ke));
}
const To = 0.25, Yt = 1, ii = 0.05, Ot = 0.5, li = 16, ci = 8, Eo = li + ci, di = 720;
function rt() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Po(e) {
  return Number.isFinite(e) && e < di;
}
function mt(e, t = Number.POSITIVE_INFINITY) {
  return Po(t) && (e === "source" || e === "translated") ? Yt : Ot;
}
function Ke(e) {
  return Number.isFinite(e) ? Math.min(Yt, Math.max(To, e)) : Ot;
}
function At(e, t) {
  const n = Ke(Number(e) + t * ii);
  return Math.round(n * 100) / 100;
}
function ui(e) {
  return Math.round(Ke(e) * 100);
}
function ko(e) {
  const n = (Number(e) || 0) - Eo;
  return Math.max(160, Math.floor(n));
}
function fi(e, t = Ot) {
  const n = Ke(t);
  return ko((Number(e) || 0) * n);
}
function mi(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${Se}]`)
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
const hi = 8;
function pi(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < hi ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const Mo = 200, No = [
  "markdown"
], gi = No;
function Ao(e) {
  return gi.includes(e);
}
const bi = "retainpdf:reader:view:v1:", pr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), yi = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function _o() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Sn(e) {
  return `${e || ""}`.trim();
}
function vi({
  documentId: e,
  jobId: t
}) {
  const n = Sn(e);
  if (n) return `document:${n}`;
  const r = Sn(t);
  return r ? `job:${r}` : "";
}
function Lo(e) {
  const t = Sn(e);
  return t ? `${bi}${t}` : "";
}
function wi(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function Si(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!pr.has(t) || !pr.has(n) || t === n))
    return { left: t, right: n };
}
function Ii(e) {
  return e === null ? null : Ao(e) ? e : void 0;
}
function Ri(e) {
  return yi.has(e) ? e : void 0;
}
function Do(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = wi(t.anchor), r = Number(t.zoom), o = Ri(t.mode), a = Si(t.splitLayout), s = Ii(t.assistantPanel);
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
function Fe(e, t = _o()) {
  const n = Lo(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Do(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function tn(e, t, n = _o()) {
  const r = Lo(e);
  if (!r || !n) return null;
  const o = Fe(e, n), a = Do({
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
function Ti(e, t, n = "") {
  var u;
  const [r, o] = M(() => {
    var m;
    return ((m = Fe(n)) == null ? void 0 : m.zoom) ?? mt(e, rt());
  }), a = N(r), s = N(n);
  a.current = r;
  const i = N(1), l = N(((u = Fe(n)) == null ? void 0 : u.zoom) !== void 0);
  D(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = Fe(n)) == null ? void 0 : h.zoom;
    l.current = m !== void 0;
    const g = m ?? mt(e, rt());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), D(() => {
    if (l.current) return;
    const m = mt(e, rt()), g = a.current;
    Math.abs(m - g) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const c = x((m, g) => {
    const h = Ke(m), y = a.current;
    Math.abs(h - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (y || 1), a.current = h, l.current = !0, tn(s.current, { zoom: h }), o(h));
  }, []), d = x((m) => {
    c(At(a.current, m));
  }, [c]), f = x((m) => {
    c(mt(m));
  }, [c]);
  return Re(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, mi(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: c, stepZoom: d, resetZoom: f };
}
const Ei = 160, Pi = 3e-3, gr = 50, ki = 16, Mi = 800;
function Ni(e, t = 0) {
  const n = t === 1 ? ki : t === 2 ? Mi : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-gr, Math.min(gr, r));
  return Math.exp(-o * Pi);
}
function Ai(e, t, n = 0) {
  return Ke(e * Ni(t, n));
}
function _i(e) {
  return Math.round(Ke(e) * 100) / 100;
}
function Li(e, t, n) {
  const r = Ke(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ke(t) / r;
  const a = (o + Eo) / r;
  return ko(a * Ke(t)) / o;
}
function Di(e) {
  return Array.from(e.querySelectorAll(Gt()));
}
function Ci(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function xi(e, t, n) {
  let r = null;
  for (const s of Di(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const l = Ci(i, t, n);
    if ((!r || l < r.distance) && (r = { el: s, rect: i, distance: l }), l === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(ke) || "",
    pane: o.getAttribute(Se) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function Oi(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function Co(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${Gt()}[${ke}="${t.page}"][${Se}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  if (Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5) {
    const s = Oi(n, e);
    if (s.scrollLeft += a, s !== e)
      for (const i of Array.from(e.querySelectorAll(`[${Se}]`)))
        i === s || i.contains(n) || i.scrollWidth <= i.clientWidth + 1 || i.querySelector(Gt()) && (i.scrollLeft += a);
  }
}
function zi(e, t, n, r) {
  const o = e.querySelector(`.${wo}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function St(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const $i = 600, Fi = 1e3;
function Bi(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || Co(e, t);
  });
  a.observe(n);
  const s = (d) => {
    d.type === "wheel" && d.ctrlKey || c();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const d of i) r.addEventListener(d, s, { capture: !0, passive: !0 });
  const l = r.setTimeout(() => c(), Fi);
  function c() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(l);
      for (const d of i) r == null || r.removeEventListener(d, s, { capture: !0 });
    }
  }
  return c;
}
function ji(e, t, n) {
  const r = N(t);
  r.current = t;
  const o = N(n);
  o.current = n;
  const a = N(null), s = N(null), i = N(null);
  D(() => {
    if (!e) return;
    const l = () => {
      const d = a.current;
      if (a.current = null, !d) return;
      const f = _i(d.target);
      if (Math.abs(f - r.current) < 5e-3) {
        St(d.grid);
        return;
      }
      const u = { anchor: d.anchor, grid: d.grid, fallback: null };
      u.fallback = setTimeout(() => {
        s.current === u && (s.current = null, St(u.grid));
      }, $i), s.current = u, o.current(f, { keepScroll: !1 });
    }, c = (d) => {
      var m, g;
      if (!d.ctrlKey) return;
      d.preventDefault();
      let f = a.current;
      if (!f) {
        (m = i.current) == null || m.call(i), i.current = null;
        const h = s.current;
        h && (h.fallback && clearTimeout(h.fallback), s.current = null, St(h.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: xi(e, d.clientX, d.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = Ai(f.target, d.deltaY, d.deltaMode);
      const u = Li(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = zi(e, u, d.clientX, d.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(l, Ei);
    };
    return e.addEventListener("wheel", c, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", c);
      const d = a.current;
      a.current = null, d != null && d.timer && clearTimeout(d.timer), St((d == null ? void 0 : d.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Re(() => {
    var c;
    const l = s.current;
    l && (s.current = null, l.fallback && clearTimeout(l.fallback), St(l.grid), !(!e || !l.anchor) && (Co(e, l.anchor), (c = i.current) == null || c.call(i), i.current = Bi(e, l.anchor)));
  }, [t, e]);
}
function Ui(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = N(t), a = N(n), s = N(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: x((l) => {
    l !== o.current && (s.current(), a.current(l));
  }, []) };
}
const $n = 48;
function xo(e, t = $n) {
  return e.getBoundingClientRect().top + t;
}
function Oo(e, t) {
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
  const o = Zt(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Ht(e, t, n = $n) {
  if (!e)
    return null;
  const r = qt(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = xo(e, n), i = Oo(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function _t(e, t, n = "auto", r, o = $n) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(qt(a, r))), i || (i = e.querySelector(qt(a))), !i)
    return !1;
  const l = e.getBoundingClientRect(), c = i.getBoundingClientRect();
  if (l.height <= 0 || c.height < 8 && i.offsetHeight < 8)
    return !1;
  const d = c.height > 0 ? c.height : i.offsetHeight, f = e.scrollTop + (c.top - l.top), u = Math.max(0, f + s * d - o);
  return n === "auto" ? Math.abs(e.scrollTop - u) >= 1 && (e.scrollTop = u) : e.scrollTo({ top: u, behavior: n }), !0;
}
function Hi(e, t, n = "smooth", r) {
  return _t(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function In(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], l = () => {
    var d;
    if (a) return;
    _t(
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
function Wi(e, t, n) {
  return In(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Xt(e, t) {
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
function Ki(e, t, n = !0, r = "", o) {
  const [a, s] = M(1);
  return D(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let l = !1, c = null, d = 0;
    const f = qt(void 0, o), u = () => {
      if (l) return;
      const h = Array.from(i.querySelectorAll(f));
      if (!h.length)
        return;
      const y = xo(i), w = Oo(h, y);
      w && s(w.page);
    }, m = () => {
      l || (d && cancelAnimationFrame(d), d = requestAnimationFrame(() => {
        d = 0, u();
      }));
    }, g = () => {
      if (l) return;
      if (!Array.from(i.querySelectorAll(f)).length) {
        c = setTimeout(g, 120);
        return;
      }
      u(), i.addEventListener("scroll", m, { passive: !0 });
    };
    return g(), () => {
      l = !0, c && clearTimeout(c), d && cancelAnimationFrame(d), i.removeEventListener("scroll", m);
    };
  }, [e, t, n, r, o]), a;
}
const Vi = `canvas, .react-pdf__Page, .${Ro}, .${Jt}`, br = /* @__PURE__ */ new WeakMap();
function Ji(e) {
  const t = Number(e.getAttribute(On));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = br.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Vi), br.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function qi(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Gi(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(Gt()).forEach((r) => {
    const o = Zt(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Ji(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Zi(e, t, n = "", r) {
  const [o, a] = M(() => /* @__PURE__ */ new Map()), s = N(o), i = N(r);
  return i.current = r, Re(() => {
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
      const b = Gi(v);
      qi(s.current, b) || (s.current = b, a(b)), d && !f && (f = !0, (I = i.current) == null || I.call(i));
    }, m = () => {
      cancelAnimationFrame(c), c = requestAnimationFrame(() => {
        requestAnimationFrame(u);
      });
    };
    m();
    const g = window.setTimeout(m, 100), h = window.setTimeout(() => {
      d = !0, m();
    }, 300), y = window.setTimeout(m, 700), w = e.current;
    let S = null;
    return w && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => m()), S.observe(w)), () => {
      l = !0, cancelAnimationFrame(c), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(y), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const Yi = [0, 48, 140, 320, 560], Xi = 700, Qi = [80, 200, 400], el = 500, tl = 50, nl = /* @__PURE__ */ new Set([
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
]), rl = 180, yr = [0, 48, 140, 320, 700, 1200];
function ol(e, t) {
  var P;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = N(
    ((P = Fe(a)) == null ? void 0 : P.anchor) || { page: 1, fraction: 0 }
  ), l = N(null), c = N(!1), d = N(r), f = N(null), u = N(null), m = N(null), g = N(null), h = N(a), y = N(""), w = N(n);
  w.current = n;
  const S = x(() => {
    var E;
    (E = f.current) == null || E.call(f), f.current = null, u.current != null && (clearTimeout(u.current), u.current = null);
  }, []), v = x(() => {
    !c.current && l.current == null || (S(), m.current != null && (clearTimeout(m.current), m.current = null), l.current = null, c.current = !1);
  }, [S]), b = x((E = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const A = () => {
      g.current = null, tn(h.current, {
        anchor: _e(i.current)
      });
    };
    E ? A() : g.current = setTimeout(A, rl);
  }, []), I = x((E) => {
    i.current = _e(E), l.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, c.current = !1;
    }, tl);
  }, []);
  D(() => {
    if (!o)
      return;
    let E = !1, A = null, L = null, j = null;
    const z = () => {
      if (E) return;
      const H = e.current;
      if (!H) {
        j = setTimeout(z, 50);
        return;
      }
      A = H, L = () => {
        if (c.current)
          return;
        const Q = Ht(A, w.current);
        Q && (i.current = Q, b());
      }, A.addEventListener("scroll", L, { passive: !0 }), c.current || L();
    };
    return z(), () => {
      E = !0, j != null && clearTimeout(j), A && L && A.removeEventListener("scroll", L);
    };
  }, [o, r, n, e, b]), D(() => {
    if (!o) return;
    const E = e.current;
    if (!E) return;
    const A = (L) => {
      L.metaKey || L.ctrlKey || L.altKey || nl.has(L.key) && v();
    };
    return E.addEventListener("wheel", v, { passive: !0 }), E.addEventListener("touchmove", v, { passive: !0 }), window.addEventListener("keydown", A), () => {
      E.removeEventListener("wheel", v), E.removeEventListener("touchmove", v), window.removeEventListener("keydown", A);
    };
  }, [o, e, v]), Re(() => {
    var A;
    if (h.current === a) return;
    b(!0), S(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, y.current = "";
    const E = (A = Fe(a)) == null ? void 0 : A.anchor;
    i.current = E ? _e(E) : { page: 1, fraction: 0 }, l.current = null, c.current = !!a, d.current = r;
  }, [a, r, b, S]), D(() => {
    var A;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const E = _e(
      ((A = Fe(a)) == null ? void 0 : A.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = E, l.current = E, c.current = !0, S(), f.current = In(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: yr,
        onDone: () => I(E)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(E);
    }, Math.max(...yr) + 160), () => S();
  }, [o, s, a, e, I, S]), D(() => {
    if (d.current === r)
      return;
    if (d.current = r, !o) {
      c.current = !1, l.current = null, S();
      return;
    }
    const E = l.current ? _e(l.current) : _e(i.current);
    return c.current = !0, l.current = E, i.current = E, S(), f.current = In(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Yi,
        onDone: () => I(E)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(E);
    }, Xi), () => {
      S();
    };
  }, [r, o, n, e, I, S]), D(() => () => {
    S(), m.current != null && (clearTimeout(m.current), m.current = null), b(!0);
  }, [S, b]);
  const R = x(() => {
    const E = Ht(
      e.current,
      w.current
    );
    return _e(E || i.current);
  }, [e]), k = x(() => {
    c.current = !0;
    const E = Ht(
      e.current,
      w.current
    ), A = _e(E ?? i.current);
    return i.current = A, l.current = A, b(), A;
  }, [e, b]), O = x((E, A, L) => {
    const j = L || w.current, z = Xt(E, A || 1), H = { page: z, fraction: 0 };
    i.current = H, c.current = !0, l.current = H, b(), S(), Hi(e.current, z, "smooth", j), f.current = Wi(
      () => e.current,
      z,
      {
        behavior: "auto",
        pane: j,
        delaysMs: Qi,
        onDone: () => I(H)
      }
    ), u.current = setTimeout(() => {
      u.current = null, I(H);
    }, el);
  }, [e, I, S, b]), $ = x(() => _e(i.current), []), F = x(() => c.current, []), T = x(() => {
    if (!c.current || !l.current)
      return;
    const E = _e(l.current);
    _t(
      e.current,
      E,
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
    repinIfRestoring: T
  };
}
function al(e, t) {
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
function zo(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const sl = [0, 80, 200, 400, 800], il = 120, ll = 400;
function cl(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: l, documentId: c, regionsSettled: d = !0 } = e, f = N(a);
  f.current = a;
  const u = N(s);
  u.current = s;
  const m = N(i);
  m.current = i;
  const g = N(n);
  g.current = n, D(() => {
    var b, I;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = ys(), y = al(h, u.current);
    if (y == null && (h != null && h.blockId) && !d) return;
    const w = zo(h, y, { jobId: l, documentId: c });
    if (t.current === w)
      return;
    if (y == null) {
      t.current = w, (b = g.current) == null || b.call(g);
      return;
    }
    t.current = w, h && ((I = m.current) == null || I.call(m, h, y));
    const S = [];
    let v = 0;
    for (const R of sl)
      v = Math.max(v, R), S.push(
        setTimeout(() => {
          f.current(y);
        }, R)
      );
    return S.push(
      setTimeout(() => {
        var R;
        (R = g.current) == null || R.call(g);
      }, v + il)
    ), () => {
      for (const R of S) clearTimeout(R);
    };
  }, [r, o, l, c, t, d]);
}
function dl(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function ul(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = ll,
    jobId: i,
    documentId: l,
    applyReaderSearch: c
  } = e, d = N(a);
  d.current = a;
  const f = N(c);
  f.current = c;
  const u = N(0);
  D(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || u.current === o) return;
    const m = setTimeout(() => {
      var w;
      const g = ((w = globalThis.location) == null ? void 0 : w.search) || "", h = Aa(g, o, d.current);
      if (u.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = zo(
        { blockId: y },
        o,
        { jobId: i, documentId: l }
      ), (f.current || dl)(h);
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
function fl(e) {
  const t = N(""), [n, r] = M(!1), o = x(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  cl(a, t, o), ul(e, t, n);
}
const It = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function ml(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function vr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function $o(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = vr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = vr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function hl(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = $o(r, t, n);
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
function pl(e) {
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
function gl(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function bl(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function yl(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function vl(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const wr = [250, 500, 1e3, 2e3, 4e3], on = [80, 160, 320, 640, 1e3, 1500], Sr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Rn(e, t) {
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
function Fn(e) {
  return za(e) ? `${e.code || ""}`.trim() : "";
}
function Ft(e, t) {
  const n = Fn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function wl(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const l = await o.fetchPage(e, t.page_idx, { signal: r });
      if ($o(n.pagesByPage.get(t.page_idx), t, l) !== "retry")
        return l;
      a = $a(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (l) {
      if ((l == null ? void 0 : l.name) === "AbortError") throw l;
      a = l;
      const c = Fn(l);
      if (c && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(c)) throw l;
    }
    const i = on[Math.min(s, on.length - 1)];
    if (await Rn(i, r), s >= on.length + 2) throw a;
  }
}
function Sl({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = M(It), s = N(o), i = N("");
  s.current = o;
  const l = `${e || ""}`.trim(), c = `${t || ""}`.trim().toLowerCase(), d = Mt(c) ? c : "";
  return D(() => {
    if (!n || !l) {
      i.current = "", s.current = It, a(It);
      return;
    }
    const f = r === void 0 ? bs() : r, u = i.current === l;
    if (i.current = l, !f) {
      const v = {
        ...u ? s.current : It,
        connection: d ? "terminal" : "unavailable",
        jobStatus: c,
        error: "实时译文暂不可用"
      };
      s.current = v, a(v);
      return;
    }
    const m = new AbortController();
    let g = !1;
    const h = {
      ...u ? s.current : It,
      connection: d ? "terminal" : "connecting",
      jobStatus: c,
      error: ""
    };
    s.current = h, a(h);
    const y = (v) => {
      m.signal.aborted || a((b) => {
        const I = v(b);
        return s.current = I, I;
      });
    }, w = async () => {
      let v = 0;
      for (; !m.signal.aborted; )
        try {
          const b = await f.fetchLayout(l, { signal: m.signal });
          g = !0, y((I) => ({
            ...I,
            layoutByPage: ml(b),
            jobStatus: c,
            error: ""
          }));
          return;
        } catch (b) {
          if ((b == null ? void 0 : b.name) === "AbortError") return;
          const I = Fn(b);
          if (!(I === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !I)) {
            y((k) => ({
              ...k,
              connection: d ? "terminal" : "unavailable",
              jobStatus: c,
              error: Ft(b, "实时译文暂不可用")
            }));
            return;
          }
          if (d) {
            y((k) => ({
              ...k,
              connection: "terminal",
              jobStatus: c,
              error: ""
            }));
            return;
          }
          y((k) => ({
            ...k,
            connection: "connecting",
            jobStatus: c,
            error: Ft(b, "正在等待 OCR 版面数据")
          })), await Rn(wr[Math.min(v, wr.length - 1)], m.signal).catch(() => {
          }), v += 1;
        }
    };
    return (async () => {
      if (await w(), !g || m.signal.aborted) return;
      let v = 0;
      for (; !m.signal.aborted; ) {
        d || y((b) => ({
          ...b,
          connection: b.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: c,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: b.error
        }));
        try {
          await f.streamEvents(l, {
            afterSeq: s.current.lastSeq,
            signal: m.signal,
            onEvent: async (b) => {
              if (b.seq <= s.current.lastSeq) return;
              let I;
              try {
                I = await wl(
                  l,
                  b,
                  s.current,
                  m.signal,
                  f
                );
              } catch (R) {
                if ((R == null ? void 0 : R.name) === "AbortError" || m.signal.aborted) throw R;
                y((k) => ({
                  ...k,
                  lastSeq: Math.max(k.lastSeq, b.seq),
                  error: Ft(R, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((R) => {
                const k = hl(R, b, I);
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
        } catch (b) {
          if ((b == null ? void 0 : b.name) === "AbortError" || m.signal.aborted) return;
          y((I) => ({
            ...I,
            connection: d ? "terminal" : "reconnecting",
            jobStatus: c,
            error: Ft(b, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (d) {
          y((b) => ({
            ...b,
            connection: "terminal",
            jobStatus: c
          }));
          return;
        }
        await Rn(Sr[Math.min(v, Sr.length - 1)], m.signal).catch(() => {
        }), v += 1;
      }
    })(), () => m.abort();
  }, [n, r, l, d]), o;
}
function Il(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), l = Number(s.count) || 0;
    i && l > 0 && o.set(i, l);
  }
  return o;
}
function Rl(e, t = !0) {
  const [n, r] = M(() => /* @__PURE__ */ new Map());
  return D(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = tt().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Il(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const Tl = 4500;
function El(e) {
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
const Pl = /* @__PURE__ */ new Set(["book", "translate"]);
function Fo(e) {
  return !!(e.jobId && e.sourceUrl && Pl.has(e.workflow));
}
function kl(e) {
  return !!(Fo(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Ml() {
  const e = Qs(), t = Fo({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = kl({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = N({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Mt(o) && (r.current.running = !0);
  const a = Sl({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: l, bindShell: c } = ri(), d = Rl(e.jobId, !e.sourceOnly), f = vi({
    documentId: e.documentId,
    jobId: e.jobId
  }), u = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = Ti(e.mode, s, f);
  ji(i, m, g);
  const h = ai(
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
    beginModeSwitch: y,
    goToPage: w,
    repinIfRestoring: S
  } = ol(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  D(() => {
    S();
  }, [l, S]);
  const v = Zi(
    s,
    h.compareMode,
    h.rowSyncRevision,
    S
  ), b = Ki(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), I = x((z, H) => {
    var se, X;
    const Q = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((se = h.numPagesByPane) == null ? void 0 : se.source) || 0,
      Number((X = h.numPagesByPane) == null ? void 0 : X.translated) || 0
    );
    w(z, Q, H);
  }, [w, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [R, k] = M(null), O = N(null), $ = x((z) => {
    O.current && clearTimeout(O.current), k(z), z && (O.current = setTimeout(() => k(null), Tl));
  }, []);
  D(() => () => {
    O.current && clearTimeout(O.current);
  }, []);
  const F = x((z) => {
    const H = nn(e.regions, z);
    return H ? sr(H, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), T = x((z, H) => {
    const Q = H || h.primaryPane, se = typeof z == "object" && z ? `${z.block_id || ""}`.trim() : "", X = typeof z == "object" && z ? `${z.image_url || ""}`.trim() : "", fe = typeof z == "object" && z ? z.page_idx != null ? Number(z.page_idx) + 1 : z.page != null ? Number(z.page) : null : typeof z == "number" ? z + 1 : null, me = La(e.regions, X, fe) || nn(e.regions, se) || (typeof z == "object" ? Da(e.regions, z) : null);
    let he = me ? sr(me, Q).page : null;
    he == null && (he = El(z)), !(he == null || he < 1) && ($(me), I(he, Q));
  }, [$, I, h.primaryPane, e.regions]);
  fl({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: b,
    goToPage: I,
    resolveBlockPage: F,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (z) => {
      $(nn(e.regions, z.blockId));
    }
  });
  const { setModeKeepingPage: P } = Ui({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  D(() => {
    $(null);
  }, [u, $]);
  const E = !e.boot.loading && !e.boot.failed, A = J(() => ({ bindShell: c, shellEl: i, shellWidth: l, shellRef: s }), [c, i, l, s]), L = J(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), j = J(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: g,
    shell: A,
    panes: h,
    sessionFiles: L,
    rowHeights: v,
    goToPage: I,
    activeRegion: R,
    jumpToAnchor: T,
    setModeKeepingPage: P,
    download: e.download,
    showHud: E,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: d
  }), [e, A, h, L, v, I, R, T, P, E, m, g, f, a, n, d]);
  return J(() => ({
    ...j,
    currentPage: b
  }), [j, b]);
}
const Nl = [
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
], Al = [
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
function _l(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Nl)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Ll(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Dl = ".reader-notes-panel";
function Cl(e) {
  return e instanceof Element ? !!e.closest(Dl) : !1;
}
function xl(e) {
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
  D(() => {
    if (!d)
      return;
    const f = (u) => {
      if (u.defaultPrevented || u.metaKey || u.ctrlKey || u.altKey || Ll(u.target) || Cl(u.target))
        return;
      const m = u.key, g = _l(m);
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
              a(At(o, 1));
              return;
            case "zoom-out":
              a(At(o, -1));
              return;
            case "zoom-reset":
              a(mt(t, rt()));
              return;
            case "next-page":
              l(Xt(s + 1, i));
              return;
            case "prev-page":
              l(Xt(s - 1, i));
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
const Ol = "retainpdf:soft-reader-close";
function zl() {
  return new URL("./index.html", window.location.href).href;
}
function $l() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Ol },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Fl(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Bl() {
  if (!(typeof window > "u") && !$l()) {
    if (Fl(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(zl());
  }
}
function jl({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Ul({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ _(jl, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Bl();
  }, children: [
    /* @__PURE__ */ p(vt, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
let Ir = !1;
function Hl() {
  if (Ir)
    return;
  const e = Nt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (bo.GlobalWorkerOptions.workerSrc = e, Ir = !0);
}
function de(e) {
  return typeof e == "string" ? e : "";
}
function Wl(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function Kl(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function Vl(e) {
  return {
    source: de(e == null ? void 0 : e.source_text) || de(e == null ? void 0 : e.unit_source_text),
    translated: de(e == null ? void 0 : e.protected_translated_text) || de(e == null ? void 0 : e.translated_text)
  };
}
const Jl = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function Bo(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function ql(e) {
  const t = Bo(e).sort((r, o) => de(r.ts).localeCompare(de(o.ts)));
  return t.length ? [
    { text: de(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: de(r.new_text),
      label: Jl[de(r.source)] || de(r.source) || "修订",
      ts: de(r.ts),
      reason: de(r.reason)
    }))
  ].reverse() : [];
}
function Gl(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Zl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return de(r.finished_at) || de(n.finished_at) || "";
}
function Yl(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = Bo(e).sort((a, s) => de(a.ts).localeCompare(de(s.ts)));
  for (const a of o) {
    const s = new Date(de(a.ts)).getTime(), i = de(a.reader_item_id) || de(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, de(a.new_text));
  }
  return n;
}
const Xl = {
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
function Ql(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = Xl[de(n.kind)] || de(n.kind) || "问题", o = de(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const ec = /* @__PURE__ */ new Set(["text", "formula"]);
function Bn(e) {
  return ec.has(e);
}
function tc(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || Bn(xt(n));
}
function nc(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !Bn(xt(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const rc = 300, oc = 72;
function ac(e, t) {
  if (e.width >= rc && e.height >= oc)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const sc = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function ic(e, t, n) {
  return e.flatMap((r) => {
    if (!sc.has(xt(r.region))) return [];
    const o = Cn(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function Rr(e, t, n) {
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
async function lc(e) {
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
const cc = "reader-text-hover-copy", dc = "reader-text-hover-edit", uc = "reader-text-hover-id";
function fc(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const jo = "reader-text-hover-tools";
function an({
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
const mc = 26, hc = 220;
function pc(e, t = hc) {
  return e.height < mc * 2 || e.width < t;
}
function gc({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? uo : e === "failed" ? vt : Ba, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function bc({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  frameRect: o,
  placement: a,
  tailTop: s = 0
}) {
  const [i, l] = M("idle"), [c, d] = M("idle"), [f] = M(() => fc()), u = N([]), m = (e == null ? void 0 : e.itemId) || "";
  if (D(() => {
    l("idle"), d("idle");
    const b = u.current;
    return () => {
      b.forEach((I) => window.clearTimeout(I)), u.current = [];
    };
  }, [m]), !e) return null;
  const g = Ca(e.highlight.region, t), h = xt(e.highlight.region), y = (b, I) => async (R) => {
    R.preventDefault(), R.stopPropagation();
    const k = await lc(b);
    I(k ? "copied" : "failed"), u.current.push(window.setTimeout(() => I("idle"), 1200));
  }, w = h === "formula" ? "复制 LaTeX" : "复制", S = o || e.rect, v = a || (pc(S) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": h,
      style: S,
      children: /* @__PURE__ */ _(
        "div",
        {
          className: jo,
          "data-placement": v,
          style: v === "tail" ? { top: s } : void 0,
          children: [
            f ? /* @__PURE__ */ p(
              an,
              {
                className: uc,
                state: c,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: y(e.itemId, d),
                children: c === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && Bn(h) ? /* @__PURE__ */ p(
              an,
              {
                className: dc,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (b) => {
                  b.preventDefault(), b.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(xn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            g ? /* @__PURE__ */ p(
              an,
              {
                className: cc,
                state: i,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: i === "copied" ? "已复制" : i === "failed" ? "复制失败" : w,
                onClick: y(g, l),
                children: /* @__PURE__ */ p(gc, { state: i })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function yc(e, t) {
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
function vc(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = Cn(
      yc(e, a),
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
const wc = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Sc = 256, Rt = /* @__PURE__ */ new Map();
function Ic(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Uo(e) {
  const t = `${e || ""}`, { text: n, slots: r } = ds(t, { bareLatex: !0 }), o = Ic(n), a = us(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Rt.get(t);
  if (!s && (s = fs(o, r), Rt.set(t, s), Rt.size > Sc)) {
    const i = Rt.keys().next().value;
    i !== void 0 && Rt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function sn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function He(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Rc(e, t) {
  const n = e.typography, r = He(t) || 1, o = He(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = sn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, l = Math.max(5.5 * r, Math.min(s, i * r)), c = He(n == null ? void 0 : n.fit_min_font_size_pt), d = He(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (c || 5.5) * r), u = Math.max(
    f,
    d ? d * r : o ? o * r : l
  ), m = o ? o * r : l, g = He(n == null ? void 0 : n.leading_em), h = [
    He(n == null ? void 0 : n.padding_top_pt) || 0,
    He(n == null ? void 0 : n.padding_right_pt) || 0,
    He(n == null ? void 0 : n.padding_bottom_pt) || 0,
    He(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || wc,
    fontSizePx: Math.max(f, Math.min(u, m)),
    minFontSizePx: f,
    maxFontSizePx: u,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (sn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : sn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Tc(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (f) => {
    const u = s.get(f);
    if (u !== void 0) return u;
    const { width: m, height: g } = e(f), h = m <= t + 0.5 && g <= n + 0.5;
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
const Ec = 512, Tt = /* @__PURE__ */ new Map();
let Tn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Tn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Tn += 1;
}));
function Pc(e, t, n, r) {
  return [
    Tn,
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
function Ho({ item: e, pageScale: t }) {
  const n = N(null), r = J(
    () => Uo(e.translatedText),
    [e.translatedText]
  ), [o, a] = M(r.fallbackHtml), s = J(
    () => Rc(e, t),
    [e, t]
  );
  D(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((u) => {
      f && a(u);
    }), () => {
      f = !1;
    };
  }, [r]), Re(() => {
    const f = n.current;
    if (!f) return;
    const [u, m, g, h] = s.padding, y = Math.max(1, e.rect.width - h - m), w = Math.max(1, e.rect.height - u - g), S = Pc(o, y, w, s);
    let v = Tt.get(S);
    if (v === void 0 && (v = Tc(
      (b) => (f.style.fontSize = `${b}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Tt.set(S, v), Tt.size > Ec)) {
      const b = Tt.keys().next().value;
      b !== void 0 && Tt.delete(b);
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
function kc({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = J(
    () => vc(e, t, n, r),
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
        Ho,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Mc = en(kc);
function Nc({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ p("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ _("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ p(
        Ho,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: xt(a.highlight.region),
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
const Ac = en(Nc), Wo = 24, Ze = Wo * 2 + 4, We = 24, _c = 4, Lc = 6, ot = (e) => e.left + e.width, et = (e) => e.top + e.height;
function Et(e, t) {
  const n = Math.min(ot(e), ot(t)) - Math.max(e.left, t.left), r = Math.min(et(e), et(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Tr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= ot(t) && r >= t.top && r <= et(t);
}, Dc = (e) => e.height > 40 && e.height > e.width * 2.5;
function Cc(e, t, n) {
  if (!t.length || e.height < We || e.width < n + 8) return null;
  const r = Math.max(...t.map(et)), o = ot(e) - 4 - n;
  for (const a of [r, et(e) - 2]) {
    const s = Math.max(e.top, a - We), i = { left: o, top: s, width: n, height: We };
    if (!t.some((l) => Et(i, l) > 0)) return s - e.top;
  }
  return null;
}
function xc(e, t) {
  const n = [], r = (a) => {
    const s = Wo + _c, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: ot(e), top: i, width: s, height: Ze } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: Ze } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - We - 3, width: Ze, height: We + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: et(e), width: Ze, height: We + 3 } }), r(!0);
  const o = Cc(e, t, Ze);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: ot(e) - 4 - Ze, top: e.top + o, width: Ze, height: We } }), n;
}
function Oc(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !Dc(S)), i = s.filter((S) => Tr(S, t)), l = s.filter((S) => !Tr(S, t)), c = n.filter((S) => S !== t && Et(S, t) < t.width * t.height * 0.5), d = xc(t, i).filter(({ box: S, overhang: v }) => {
    const b = v ? Lc : 0;
    return S.left >= -b && ot(S) <= r + b && S.top >= 0 && et(S) <= o;
  }), f = ({ placement: S, tailTop: v }) => v === void 0 ? { placement: S } : { placement: S, tailTop: v }, u = ({ box: S }) => !l.some((v) => Et(S, v) > 0), m = d.filter((S) => S.placement !== "tail"), g = m.find((S) => u(S) && !c.some((v) => Et(S.box, v) > 0));
  if (g) return f(g);
  const h = m.find(u) || d.find((S) => S.placement === "tail" && u(S));
  if (h) return f(h);
  let y = null, w = Number.POSITIVE_INFINITY;
  for (const S of d) {
    const v = l.reduce((b, I) => b + Et(S.box, I), 0);
    v < w && (y = S, w = v);
  }
  return y ? f(y) : { placement: "outside" };
}
function zc(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - We - 3 : et(r);
  return t >= r.left - 4 && t <= r.left + Ze + 4 && n >= a && n <= a + We + 3;
}
const ln = (e) => e.left + e.width, cn = (e) => e.top + e.height;
function $c(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const c of t) {
    if (c.width <= 0 || c.height <= 0) continue;
    const d = c.left + c.width / 2, f = c.top + c.height / 2;
    d < e.left || d > ln(e) || f < e.top || f > cn(e) || (o = Math.min(o, c.left), a = Math.min(a, c.top), s = Math.max(s, ln(c)), i = Math.max(i, cn(c)));
  }
  if (!Number.isFinite(o)) return e;
  const l = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return l.width = Math.min(ln(e) + r, s + n) - l.left, l.height = Math.min(cn(e) + r, i + n) - l.top, l.width * l.height < e.width * e.height * 0.3 && l.height < 24 ? e : l;
}
function Fc(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function Bc(e, t, n, r) {
  const [o, a] = M(null);
  return Re(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? Fc(s) : [], l = i.length ? $c(t.rect, i) : t.rect, c = n.filter((f) => f.itemId !== t.itemId).map((f) => f.rect), d = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Oc({ frame: l, others: c, pageWidth: r, pageHeight: d, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
const Ko = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Er = { pen: 35e-4, highlighter: 0.018 }, Pr = 0.015, En = "retainpdf.reader.ink.v1:";
function kr(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(En + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function jc(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(En + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(En + e);
    } catch {
    }
}
function Uc(e, t, n, r, o, a) {
  const s = Pr * Pr;
  return e.filter((i) => Vo(i, t, n) && i.points.some(([l, c]) => (l - r) ** 2 + ((c - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Vo(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function Hc(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function Wc(e) {
  const [t, n] = M(null), [r, o] = M(Ko[0].key), [a, s] = M(() => kr(e)), i = N(a), l = N([]);
  D(() => {
    const h = kr(e);
    i.current = h, s(h), l.current = [];
  }, [e]);
  const c = x((h) => {
    i.current = h, s(h), jc(e, h);
  }, [e]), d = x((h) => {
    const y = i.current, w = h(y);
    w !== y && (l.current = [...l.current.slice(-49), y], c(w));
  }, [c]), f = x((h) => {
    h.points.length < 1 || d((y) => [...y, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [d]), u = x((h) => {
    h.length && d((y) => y.filter((w) => !h.includes(w.id)));
  }, [d]), m = x((h) => {
    d((y) => y.some((w) => w.page === h) ? y.filter((w) => w.page !== h) : y);
  }, [d]), g = x(() => {
    const h = l.current.pop();
    h && c(h);
  }, [c]);
  return J(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: u, undo: g, clearPage: m }),
    [t, r, a, f, u, g, m]
  );
}
const Kc = "reader-ink-layer";
function Vc(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function Mr({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: Vc(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function Jc({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = M(null), i = N(!1), l = o.strokes.filter((h) => Vo(h, e, t)), c = !!o.tool;
  if (!c && !l.length) return null;
  const d = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (h, y) => o.erase(Uc(o.strokes, e, t, h, y, r / Math.max(1, n))), u = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, w] = d(h);
    o.tool === "eraser" ? f(y, w) : s([[y, w]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, w] = d(h);
    o.tool === "eraser" ? f(y, w) : s((S) => S ? Hc(S, y, w) : [[y, w]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Er[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ _(
    "svg",
    {
      className: Kc,
      "data-ink-active": c ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: u,
      onPointerMove: m,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        l.map((h) => /* @__PURE__ */ p(Mr, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(Mr, { stroke: { tool: o.tool, color: o.color, width: Er[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function qc({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = M(null), [i, l] = M(!1), [c, d] = M([]), [f, u] = M(""), [m, g] = M(""), [h, y] = M(!1), [w, S] = M(null), [v, b] = M([]), I = r.drafts, R = r.generation, k = x(async (T, P) => {
    if (e)
      try {
        d(ql(await e.fetchRevisions(T, P)));
      } catch {
        d([]);
      }
  }, [e]);
  D(() => {
    if (s(null), d([]), S(null), b([]), g(""), !e || !t || !n) return;
    let T = !1;
    return l(!0), e.loadItem(t, n).then((P) => {
      if (T) return;
      const E = P == null ? void 0 : P.item;
      if (!E) throw new Error("找不到这一段的译文。");
      const A = `${(P == null ? void 0 : P.item_id) || n}`, { source: L, translated: j } = Vl(E);
      s({ readerItemId: n, itemId: A, source: L, current: j }), u(I.get(n) ?? j);
    }).catch((P) => {
      T || S({ tone: "error", message: (P == null ? void 0 : P.message) || "读取这段译文失败。" });
    }).finally(() => {
      T || l(!1);
    }), k(t, n), () => {
      T = !0;
    };
  }, [e, t, n, k]);
  const O = x((T) => {
    u(T), n && I.set(n, T);
  }, [n, I]), $ = x(async (T, P) => {
    if (!e || !a || h) return !1;
    const E = T ?? f;
    if (!E.trim()) return !1;
    y(!0), S(null), b([]);
    try {
      const A = await e.revise(t, a.itemId, {
        translated_text: E,
        source: "user",
        reason: (P ?? m).trim() || "在阅读页手动修改",
        ...R.current != null ? { expected_generation: R.current } : {}
      }), L = Number(A == null ? void 0 : A.generation);
      return Number.isFinite(L) && (R.current = L), I.delete(a.readerItemId), s({ ...a, current: E }), u(E), g(""), (A == null ? void 0 : A.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, E), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), k(t, a.readerItemId), !0;
    } catch (A) {
      const L = A;
      return (L == null ? void 0 : L.reason) === "generation_mismatch" && (R.current = null), S({ tone: "error", message: (L == null ? void 0 : L.message) || "保存失败，请稍后再试。" }), b(Ql(L == null ? void 0 : L.issues)), !1;
    } finally {
      y(!1);
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
    setReason: g,
    saving: h,
    status: w,
    issues: v,
    save: $,
    discardDraft: F
  };
}
const Jo = "reader-inline-edit";
function Gc({ text: e }) {
  const [t, n] = M("");
  return D(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = Uo(e);
      n(a.fallbackHtml), a.richHtml.then((s) => {
        r && n(s);
      });
    }, 250);
    return () => {
      r = !1, window.clearTimeout(o);
    };
  }, [e]), t ? /* @__PURE__ */ _("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ p("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ p("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function Zc({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var F;
  const s = e.itemId, i = qc({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [l, c] = M(!1), [d, f] = M(!1), u = N(null), m = ac(e.rect, t), g = J(() => nc(o), [o]), h = g.indexOf(s), { loaded: y } = i, w = i.saving || i.loading, S = n.blockedReason, v = !y || i.draft === y.current, { close: b, select: I } = n, R = x((T) => {
    const P = g[h + T];
    P && (I(P), a == null || a(P));
  }, [g, h, I, a]), k = x(() => {
    i.discardDraft(), b();
  }, [i, b]), O = x(async (T, P) => {
    await i.save(T, P) && b();
  }, [i, b]);
  D(() => {
    const T = (P) => {
      !P.altKey || P.key !== "ArrowUp" && P.key !== "ArrowDown" || (P.preventDefault(), R(P.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", T), () => window.removeEventListener("keydown", T);
  }, [R]), Re(() => {
    const T = u.current;
    if (!T) return;
    T.style.height = "auto";
    const P = m.mode === "inline" ? m.minHeight : 0;
    T.style.height = `${Math.max(P, T.scrollHeight + 2)}px`;
  }, [i.draft, y, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const $ = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ _(lt, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ _(
      "div",
      {
        className: `${Jo} is-${m.mode}`,
        style: $,
        role: "group",
        "aria-label": `改第 ${((F = n.target) == null ? void 0 : F.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (T) => T.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            ee,
            {
              className: `reader-inline-edit-source${l ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: l ? "收起原文" : "展开原文",
              onClick: () => c((T) => !T),
              children: y.source
            }
          ) : null,
          S ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: S }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ p(
            is,
            {
              ref: u,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: w || !!S,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (T) => i.setDraft(T.target.value),
              onKeyDown: (T) => {
                T.key === "Enter" && (T.metaKey || T.ctrlKey) ? (T.preventDefault(), v || O()) : T.key === "Escape" && (T.preventDefault(), k());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(Gc, { text: i.draft }) : null,
          /* @__PURE__ */ _("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(lr, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => R(-1), children: /* @__PURE__ */ p(ja, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(lr, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => R(1), children: /* @__PURE__ */ p(fo, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              go,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!S || !y,
                onChange: (T) => i.setReason(T.target.value),
                onKeyDown: (T) => {
                  T.key === "Enter" ? (T.preventDefault(), v || O()) : T.key === "Escape" && (T.preventDefault(), k());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ _(
              ee,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": d,
                "data-block-edit-action": "history",
                onClick: () => f((T) => !T),
                children: [
                  /* @__PURE__ */ p(Ua, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(ee, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: k, children: "取消" }),
            /* @__PURE__ */ p(
              ee,
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
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((T) => /* @__PURE__ */ p("li", { children: T }, T)) }) : null,
          d && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((T, P) => {
            const E = T.text === y.current, A = [Gl(T.ts), T.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ _("li", { "data-block-edit-history": T.label, "data-current": E ? "true" : void 0, children: [
              /* @__PURE__ */ _("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ _("span", { children: [
                  A,
                  E ? "（现在用的）" : "",
                  T.reason ? ` · ${T.reason}` : ""
                ] }),
                E ? null : /* @__PURE__ */ p(
                  ee,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!S,
                    onClick: () => {
                      O(T.text, `回到「${A.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: T.text })
            ] }, `${T.ts}:${P}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const qo = _n(null), Go = _n(null);
function Yc({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(qo.Provider, { value: e, children: /* @__PURE__ */ p(Go.Provider, { value: t, children: n }) });
}
function Je() {
  return Ln(qo);
}
function Zo() {
  return Ln(Go);
}
const Xe = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Xc = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Qc = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, ed = {
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
}, Nr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function td(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Nr(o ?? a ?? "", Xc)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Nr(o ?? a ?? "", Qc)).replace(/\\([a-zA-Z]+)/gu, (r, o) => ed[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function nd(e) {
  return Xe(e.translatedBlockText) || Xe(e.translated.text) || Xe(e.source.text);
}
const rd = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function od(e) {
  const t = [];
  for (const n of e) {
    if (!rd(n)) continue;
    const r = td(nd(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function ad(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const sd = 24, id = 60;
function Ar(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - sd), o = Math.min(e.length, n + t.length + id), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function ld(e, t, n = 200) {
  const r = Xe(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = Xe(a.translatedBlockText) || Xe(a.translated.text), l = i ? Ar(i, r) : null, c = l ?? Ar(Xe(a.source.text), r);
    if (c && (o.push({ itemId: a.itemId, page: s, side: l ? "translated" : "source", ...c }), o.length >= n))
      break;
  }
  return o;
}
function Bt(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function cd(e, t) {
  const n = Xe(t).toLowerCase();
  if (!n || !e) return Bt(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${Bt(e.slice(a, s))}<mark class="reader-find-mark">${Bt(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + Bt(e.slice(a));
}
function dd(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const Yo = 1.414;
function ud({
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
  onHoverRegion: g,
  liveTranslationLayout: h,
  liveTranslationPage: y,
  showLiveTranslation: w = r === "source",
  liveTranslationMissing: S = !1
}) {
  var ge, ne;
  const v = Je(), b = v == null ? void 0 : v.revisedBlocks, I = v == null ? void 0 : v.blockEdit, R = I == null ? void 0 : I.pendingEdits, k = v == null ? void 0 : v.editBlock, O = (v == null ? void 0 : v.findTerm) || "", $ = J(
    () => O ? ({ str: B }) => cd(B, O) : void 0,
    [O]
  ), F = N(l ?? Yo), [T, P] = M(F.current);
  D(() => {
    l != null && Math.abs(l - F.current) >= 1e-3 && (F.current = l, P(l));
  }, [l]);
  const E = N(d);
  E.current = d;
  const A = N(null), L = N((B) => {
    var oe;
    A.current = B, (oe = E.current) == null || oe.call(E, B);
  }).current, j = N(null), z = N(`${t}@${n}`);
  Re(() => {
    const B = `${t}@${n}`;
    z.current !== B && (z.current = B, o && md(A.current, j.current));
  }, [o, n, t]), D(() => {
    o || dn(j.current);
  }, [o]), D(() => () => dn(j.current), []);
  const H = Math.max(120, Math.floor(t * T)), Q = Math.max(H, Math.ceil(s || 0)), se = Cn(f, t, H), X = J(
    () => ic(u, t, H),
    [H, u, t]
  ), [fe, me] = M(null), he = typeof g == "function", De = he ? m ?? null : fe, q = (B) => {
    he ? B !== (m ?? null) && (g == null || g(B)) : me((oe) => oe === B ? oe : B);
  }, Y = J(
    () => X.find((B) => B.itemId === De) || null,
    [De, X]
  ), we = r === "translated" && ((ge = I == null ? void 0 : I.target) == null ? void 0 : ge.itemId) || "", te = J(
    () => we && X.find((B) => B.itemId === we) || null,
    [we, X]
  ), pe = Bc(A, o ? Y : null, X, t), qe = (B) => {
    var Ee, Ie, Ce, xe, Be;
    if (B.pointerType === "touch") return;
    if ((Ee = v == null ? void 0 : v.ink) != null && Ee.tool) {
      q(null);
      return;
    }
    if (B.buttons !== 0) {
      q(null);
      return;
    }
    if ((Ce = (Ie = B.target) == null ? void 0 : Ie.closest) != null && Ce.call(Ie, `.${jo}`) || (Be = (xe = B.target) == null ? void 0 : xe.closest) != null && Be.call(xe, `.${Jo}`)) return;
    const oe = B.currentTarget.getBoundingClientRect(), G = B.clientX - oe.left, ue = B.clientY - oe.top;
    if (zc(pe, G, ue)) return;
    const ce = Rr(X, G, ue);
    q((ce == null ? void 0 : ce.itemId) || null);
  }, Me = (B) => {
    if (B.pointerType === "mouse") return;
    const oe = B.currentTarget.getBoundingClientRect(), G = Rr(
      X,
      B.clientX - oe.left,
      B.clientY - oe.top
    );
    q((G == null ? void 0 : G.itemId) || null);
  }, Te = (B) => {
    !Number.isFinite(B) || B <= 0 || Math.abs(F.current - B) < 1e-3 || (F.current = B, P(B), c == null || c(e, B));
  };
  return /* @__PURE__ */ _(
    "div",
    {
      ref: L,
      [ke]: e,
      [Se]: r,
      [On]: H,
      className: zn,
      onPointerMoveCapture: qe,
      onPointerDown: Me,
      onPointerLeave: (B) => {
        B.pointerType === "mouse" && q(null);
      },
      style: {
        width: t,
        height: Q,
        minHeight: Q
      },
      children: [
        o ? /* @__PURE__ */ p(
          ls,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: $,
            renderAnnotationLayer: !1,
            className: Ro,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: Jt,
                style: { width: t, height: H }
              }
            ),
            onLoadSuccess: (B) => {
              try {
                const oe = B.getViewport({ scale: 1 });
                if (oe.width > 0) {
                  const G = oe.height / oe.width;
                  Te(G);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              dn(j.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: Jt,
            style: { width: t, height: H },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: j, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        se ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: se,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ p(
          Mc,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: H
          }
        ) : null,
        o && w && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (R != null && R.size) ? /* @__PURE__ */ p(Ac, { targets: X, edits: R, width: t, excludeId: te == null ? void 0 : te.itemId }) : null,
        o && te && I ? /* @__PURE__ */ p(
          Zc,
          {
            target: te,
            page: { width: t, height: H },
            edit: I,
            showSource: !!(v != null && v.editShowsSource),
            regions: v == null ? void 0 : v.regions,
            jumpToBlock: v == null ? void 0 : v.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (b != null && b.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: X.filter((B) => b.has(B.itemId)).map((B) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": B.itemId,
            style: { left: B.rect.left, top: B.rect.top, height: B.rect.height }
          },
          B.itemId
        )) }) : null,
        o && (v != null && v.ink) ? /* @__PURE__ */ p(
          Jc,
          {
            page: e,
            pane: r === "translated" ? "translated" : v.compareVersion ? "compare" : "source",
            width: t,
            height: H,
            ink: v.ink
          }
        ) : null,
        /* @__PURE__ */ p(
          bc,
          {
            target: o && !((ne = v == null ? void 0 : v.ink) != null && ne.tool) && (Y == null ? void 0 : Y.itemId) !== (te == null ? void 0 : te.itemId) ? Y : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: Y && (b == null ? void 0 : b.get(Y.itemId)) || 0,
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
const fd = en(ud);
function md(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function dn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const hd = 2 * 1024 * 1024;
function pd(e) {
  const t = new bo.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const un = 5, gd = "120% 0px", bd = 120, yd = "25% 0px";
let _r = 1;
const Lr = /* @__PURE__ */ new WeakMap();
function vd(e) {
  if (!e) return 0;
  const t = Lr.get(e);
  if (t) return t;
  const n = _r;
  return _r += 1, Lr.set(e, n), n;
}
function wd() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Sd = so(
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
    activeRegion: g = null,
    regions: h = [],
    readerMetadata: y = null,
    hoveredRegionId: w = null,
    onHoverRegion: S,
    liveTranslation: v,
    showLiveTranslation: b = t === "source",
    liveTranslationPendingLabel: I = "",
    paneAction: R
  }, k) {
    Hl();
    const { file: O, loading: $, error: F } = Js(n, r), T = `${n}\0${vd(O)}`, P = N(T);
    P.current = T;
    const E = J(() => {
      const C = js(O);
      return C ? "ranged" in C ? { range: pd(C.ranged) } : C : null;
    }, [O, n]), [A, L] = M(0), [j, z] = M(""), [H, Q] = M(null), [se, X] = M(480), fe = N(null), me = N(0), he = J(() => wd(), []), De = J(() => ({
      cMapUrl: Nt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Nt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: hd,
      disableAutoFetch: !0
    }), []);
    Dn(k, () => H, [H]), D(() => {
      const C = (W) => {
        me.current = W, X(W);
      }, V = (W) => {
        const ie = pi(W, me.current);
        if (ie !== "ignore") {
          if (fe.current && clearTimeout(fe.current), ie === "immediate") {
            C(W);
            return;
          }
          fe.current = setTimeout(() => C(W), Mo);
        }
      }, K = !!(l && l >= 80);
      V(K ? l : (i == null ? void 0 : i.clientWidth) || 0);
      const le = !K && i && typeof ResizeObserver < "u" ? new ResizeObserver((W) => {
        var ie, be;
        V(((be = (ie = W[0]) == null ? void 0 : ie.contentRect) == null ? void 0 : be.width) ?? i.clientWidth);
      }) : null;
      return le && i && le.observe(i), () => {
        le == null || le.disconnect(), fe.current && clearTimeout(fe.current);
      };
    }, [l, i, a]);
    const q = J(
      () => fi(se, o),
      [se, o]
    ), [Y, we] = M(() => /* @__PURE__ */ new Map()), [te, pe] = M(() => /* @__PURE__ */ new Set()), [qe, Me] = M(() => /* @__PURE__ */ new Set()), Te = N(/* @__PURE__ */ new Map()), ge = N(null), ne = N(null), [B, oe] = M(() => /* @__PURE__ */ new Set()), G = N(/* @__PURE__ */ new Map()), ue = x((C, V) => {
      we((K) => {
        if (K.get(C) === V) return K;
        const Z = new Map(K);
        return Z.set(C, V), Z;
      });
    }, []), ce = x((C, V) => {
      const K = Te.current, Z = K.get(C), le = [ge.current, ne.current];
      if (Z)
        for (const W of le)
          try {
            W == null || W.unobserve(Z);
          } catch {
          }
      if (V) {
        K.set(C, V);
        for (const W of le)
          try {
            W == null || W.observe(V);
          } catch {
          }
      } else
        K.delete(C);
    }, []), Ee = N(/* @__PURE__ */ new Map()), Ie = x((C) => {
      const V = Ee.current;
      let K = V.get(C);
      return K || (K = (Z) => ce(C, Z), V.set(C, K)), K;
    }, [ce]);
    D(() => {
      if (typeof IntersectionObserver > "u") return;
      const C = G.current, V = new IntersectionObserver(
        (K) => {
          const Z = [], le = [];
          for (const W of K) {
            const ie = W.target, be = Zt(ie);
            Number.isFinite(be) && (W.isIntersecting ? Z : le).push(be);
          }
          if ((Z.length || le.length) && pe((W) => {
            let ie = null;
            for (const be of Z)
              W.has(be) || (ie = ie || new Set(W), ie.add(be));
            for (const be of le)
              W.has(be) && (ie = ie || new Set(W), ie.delete(be));
            return ie || W;
          }), Z.length) {
            for (const W of Z) {
              const ie = C.get(W);
              ie && (clearTimeout(ie), C.delete(W));
            }
            Me((W) => {
              let ie = null;
              for (const be of Z)
                W.has(be) || (ie = ie || new Set(W), ie.add(be));
              return ie || W;
            });
          }
          for (const W of le)
            C.has(W) || C.set(W, setTimeout(() => {
              C.delete(W), Me((ie) => {
                if (!ie.has(W)) return ie;
                const be = new Set(ie);
                return be.delete(W), be;
              });
            }, bd));
        },
        { root: i, rootMargin: gd, threshold: 0 }
      );
      ge.current = V;
      for (const K of Te.current.values())
        try {
          V.observe(K);
        } catch {
        }
      return () => {
        V.disconnect(), ge.current === V && (ge.current = null);
        for (const K of C.values()) clearTimeout(K);
        C.clear();
      };
    }, [i]), D(() => {
      if (typeof IntersectionObserver > "u") return;
      const C = new IntersectionObserver(
        (V) => {
          oe((K) => {
            let Z = null;
            for (const le of V) {
              const W = Zt(le.target);
              !Number.isFinite(W) || le.isIntersecting === K.has(W) || (Z = Z || new Set(K), le.isIntersecting ? Z.add(W) : Z.delete(W));
            }
            return Z || K;
          });
        },
        { root: i, rootMargin: yd, threshold: 0 }
      );
      ne.current = C;
      for (const V of Te.current.values())
        try {
          C.observe(V);
        } catch {
        }
      return () => {
        C.disconnect(), ne.current === C && (ne.current = null);
      };
    }, [i]);
    const Ce = !!i && typeof IntersectionObserver < "u";
    Re(() => {
      L(0), z(""), pe(/* @__PURE__ */ new Set()), Me(/* @__PURE__ */ new Set()), we(/* @__PURE__ */ new Map()), Te.current.clear();
      const C = G.current;
      for (const V of C.values()) clearTimeout(V);
      C.clear(), m == null || m(0, t);
    }, [T, m, t]);
    const xe = x(
      ({ numPages: C }) => {
        P.current === T && (L(C), z(""), m == null || m(C, t), f == null || f({ numPages: C, pane: t }));
      },
      [T, f, m, t]
    ), Be = x(
      (C) => {
        if (P.current !== T) return;
        const V = (C == null ? void 0 : C.message) || "PDF 解析失败";
        z(V), L(0), m == null || m(0, t), u == null || u(C, t);
      },
      [T, u, m, t]
    ), U = J(
      () => A > 0 ? Array.from({ length: A }, (C, V) => V + 1) : [],
      [A]
    );
    D(() => {
      typeof IntersectionObserver < "u" || Me(new Set(U));
    }, [U]);
    const re = J(
      () => ir(g, y, t),
      [g, y, t]
    ), Ne = J(() => {
      const C = /* @__PURE__ */ new Map();
      for (const V of h) {
        const K = ir(V, y, t);
        if (!K) continue;
        const Z = C.get(K.box.page) || [];
        Z.push(K), C.set(K.box.page, Z);
      }
      return C;
    }, [t, y, h]), Ge = J(() => {
      const C = /* @__PURE__ */ new Set();
      if (!w) return C;
      for (const [V, K] of Ne)
        K.some((Z) => Z.itemId === w) && C.add(V);
      return C;
    }, [w, Ne]), Ae = J(() => {
      if (A === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(U);
      if (te.size === 0) {
        const K = Math.min(A, un * 2 + 1);
        return new Set(Array.from({ length: K }, (Z, le) => le + 1));
      }
      const V = /* @__PURE__ */ new Set();
      for (const K of te)
        for (let Z = -un; Z <= un; Z++) {
          const le = K + Z;
          le >= 1 && le <= A && V.add(le);
        }
      return V;
    }, [A, U, i, a, te]), Oe = !n || !!F || !!j, zt = n && (F || j) || s;
    return /* @__PURE__ */ _(
      "section",
      {
        ref: Q,
        className: `reader-panel ${Io}${a ? "" : " is-hidden"}`,
        [Se]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (v == null ? void 0 : v.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          R ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: R }) : null,
          I ? /* @__PURE__ */ _("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: I })
          ] }) : null,
          Oe && !$ ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: zt }) : null,
          $ ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          E && !F ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            cs,
            {
              file: E,
              loading: null,
              error: null,
              options: De,
              onLoadSuccess: xe,
              onLoadError: Be,
              className: "reader-react-pdf-document",
              children: U.map((C) => {
                if (Ae.has(C))
                  return /* @__PURE__ */ p(
                    fd,
                    {
                      pane: t,
                      pageNumber: C,
                      width: q,
                      devicePixelRatio: he,
                      active: qe.has(C),
                      textLayer: !Ce || B.has(C),
                      syncedMinHeight: (c == null ? void 0 : c.get(C)) || 0,
                      onMetrics: d,
                      cachedAspect: Y.get(C),
                      onAspectChange: ue,
                      sentinelRef: Ie(C),
                      regionHighlight: (re == null ? void 0 : re.box.page) === C ? re : null,
                      regionTargets: Ne.get(C),
                      hoveredRegionId: w && Ge.has(C) ? w : null,
                      onHoverRegion: S,
                      liveTranslationLayout: v == null ? void 0 : v.layoutByPage.get(C - 1),
                      liveTranslationPage: v == null ? void 0 : v.pagesByPage.get(C - 1),
                      showLiveTranslation: b,
                      liveTranslationMissing: bl(v, C - 1)
                    },
                    `${t}-${C}`
                  );
                const K = Y.get(C) ?? Yo, Z = Math.max(120, Math.floor(q * K)), le = Math.max(Z, Math.ceil((c == null ? void 0 : c.get(C)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: Ie(C),
                    [ke]: C,
                    [Se]: t,
                    [On]: Z,
                    className: `${zn} is-placeholder`,
                    style: {
                      width: q,
                      height: le,
                      minHeight: le
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: Jt,
                        style: { width: q, height: Z },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${C}`
                );
              })
            },
            T
          ) }) : null
        ]
      }
    );
  }
), Dr = en(Sd), Id = 2e3, Rd = 6, Td = 500, Cr = "reader-react-resizing";
function Ed(e, t) {
  const n = N(null), r = N(null);
  Re(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const b = Pd(e), I = Ht(e, b);
      if (!I) return;
      s = { pane: b, progress: I, started: performance.now() };
    }
    const { pane: i, progress: l, started: c } = s;
    let d = 0, f = null, u = e.scrollHeight, m = u, g = 0, h = c;
    const y = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((b) => {
      let I = !1;
      for (const R of b) {
        const k = Math.round(R.contentRect.height);
        y.has(R.target) && y.get(R.target) !== k && (I = !0), y.set(R.target, k);
      }
      I && _t(e, l, "auto", i);
    }), S = () => {
      var b;
      f && clearTimeout(f), cancelAnimationFrame(d), w == null || w.disconnect(), e.classList.remove(Cr);
      for (const I of xr) e.removeEventListener(I, S);
      ((b = r.current) == null ? void 0 : b.stop) === S && (r.current = null);
    }, v = () => {
      _t(e, l, "auto", i);
      const b = e.scrollHeight;
      g = b === m ? g + 1 : 0, m = b;
      const I = performance.now() - h;
      g >= Rd && (b !== u || I > Td) || I > Id ? S() : d = requestAnimationFrame(v);
    };
    for (const b of xr) e.addEventListener(b, S, { passive: !0 });
    for (const b of Array.from(e.children)) w == null || w.observe(b);
    e.classList.add(Cr), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, h = performance.now(), u = e.scrollHeight, m = u, g = 0, d = requestAnimationFrame(v);
    }, Mo);
  }, [e, t]), D(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Pd(e) {
  for (const t of Array.from(e.querySelectorAll(`[${ke}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Se) || null;
  }
  return null;
}
const xr = ["wheel", "touchstart", "keydown", "pointerdown"];
function kd(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), l = t - i, c = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: l * c };
}
function Md(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const Or = 12;
function jn(e) {
  return Array.from(e.querySelectorAll(`.${Io}[${Se}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function Nd(e) {
  const t = e.getBoundingClientRect();
  return jn(e).map((n) => {
    const r = n.getBoundingClientRect();
    return {
      pane: n.getAttribute(Se) || "",
      left: r.left - t.left,
      width: n.clientWidth,
      scrollWidth: n.scrollWidth,
      scrollLeft: n.scrollLeft
    };
  });
}
function Ad(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function _d(e, t) {
  return e ? jn(e).find((n) => n.getAttribute(Se) === t) ?? null : null;
}
function Ld({ shellEl: e }) {
  const [t, n] = M([]), r = N(0), o = x(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = Nd(e);
      n((i) => Ad(i, s) ? i : s);
    }));
  }, [e]);
  D(() => {
    if (!e) return;
    o();
    const s = e.ownerDocument.defaultView;
    e.addEventListener("scroll", o, { capture: !0, passive: !0 });
    const i = s && typeof s.ResizeObserver < "u" ? new s.ResizeObserver(o) : null, l = () => {
      if (i) {
        i.disconnect(), i.observe(e);
        for (const f of jn(e))
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(Dd, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Dd({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - Or * 2), r = kd(e, n), o = N(null);
  if (!r) return null;
  const a = (u) => {
    const m = _d(t, e.pane);
    m && (m.scrollLeft = u);
  }, s = (u) => {
    var m, g;
    u.button === 0 && (u.preventDefault(), u.stopPropagation(), (g = (m = u.currentTarget).setPointerCapture) == null || g.call(m, u.pointerId), o.current = { startX: u.clientX, startScroll: e.scrollLeft, pointerId: u.pointerId });
  }, i = (u) => {
    const m = o.current;
    !m || m.pointerId !== u.pointerId || a(m.startScroll + Md(e, n, r.size, u.clientX - m.startX));
  }, l = (u) => {
    var m, g, h;
    ((m = o.current) == null ? void 0 : m.pointerId) === u.pointerId && (o.current = null, (h = (g = u.currentTarget).releasePointerCapture) == null || h.call(g, u.pointerId));
  }, c = (u) => {
    if (u.button !== 0 || u.target !== u.currentTarget) return;
    u.preventDefault();
    const m = u.currentTarget.getBoundingClientRect(), g = u.clientX - m.left, h = e.width * 0.8;
    a(e.scrollLeft + (g < r.offset ? -h : h));
  }, d = e.pane === "translated" ? "译文栏左右滚动" : "原文栏左右滚动", f = Math.max(0, e.scrollWidth - e.width);
  return /* @__PURE__ */ p(
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
      style: { left: e.left + Or, width: n },
      onPointerDown: c,
      children: /* @__PURE__ */ p(
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
function Xo(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Cd(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function xd({ compare: e, onDone: t }) {
  return /* @__PURE__ */ _("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ _(
        ee,
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: Xo(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(uo, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Ha, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ _("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ _(
        ee,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(Wa, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ _(
        ee,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(Ka, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function zr({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Cd(t), a = [e === "compare" ? "对比" : "正在读", r, Xo(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ _("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function Od({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = M({ source: null, translated: null });
  return Re(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), l = (c) => {
        const d = e.querySelector(`[${Se}="${c}"]`), f = d == null ? void 0 : d.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: l("source"), translated: l("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${Se}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ _("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(zr, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(zr, { role: "reading", ...n }) }) : null
  ] });
}
const zd = () => () => {
}, $r = () => null;
function $d({
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
function Fd(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Bd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function jd(e) {
  const t = Je(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", l = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, c = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), d = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), u = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Ot, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, v = (t == null ? void 0 : t.compareVersion) ?? null, b = (v == null ? void 0 : v.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", I = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", R = v ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, k = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, O = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), $ = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), F = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), T = e.regions ?? (t == null ? void 0 : t.regions) ?? [], P = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), E = (t == null ? void 0 : t.regionHover) ?? null, [A, L] = M(null), j = io(
    E ? E.subscribe : zd,
    E ? () => E.get().itemId : $r,
    E ? () => E.get().itemId : $r
  ), z = E ? j : A, H = x((fe) => {
    E ? E.set(fe, "pdf") : L(fe);
  }, [E]), Q = $d({
    mode: s,
    compareMode: i,
    showSource: l,
    showTranslated: c,
    markdownSplit: n,
    overlayOnSource: d
  }), X = Number.isFinite(g) && g > 0 ? Fd(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return Ed(u, X), /* @__PURE__ */ _(
    "div",
    {
      ref: f,
      className: So,
      "data-reader-region-count": T.length,
      "data-reader-structured-region-count": T.filter(xa).length,
      "data-reader-metadata-ready": P ? "true" : "false",
      children: [
        /* @__PURE__ */ _(
          "main",
          {
            className: `${wo} reader-mode-${Q.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                Dr,
                {
                  pane: "source",
                  url: b,
                  preloadedFile: R,
                  userZoom: m,
                  visible: Q.showSource,
                  scrollRoot: u,
                  pageWidthOverride: X,
                  rowHeights: Q.compareMode ? h : void 0,
                  onMetrics: O,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: $,
                  activeRegion: F,
                  regions: (v == null ? void 0 : v.regions) ?? T,
                  readerMetadata: P,
                  hoveredRegionId: z,
                  onHoverRegion: H,
                  liveTranslation: d ? o : void 0,
                  showLiveTranslation: d,
                  liveTranslationPendingLabel: d ? Bd(o) : "",
                  paneAction: d && Q.showTranslated ? /* @__PURE__ */ _(lt, { children: [
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
                Dr,
                {
                  pane: "translated",
                  url: I,
                  preloadedFile: k,
                  userZoom: m,
                  visible: Q.showTranslated,
                  scrollRoot: u,
                  pageWidthOverride: X,
                  rowHeights: Q.compareMode ? h : void 0,
                  onMetrics: O,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: $,
                  activeRegion: F,
                  regions: T,
                  readerMetadata: P,
                  hoveredRegionId: z,
                  onHoverRegion: H,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(Ld, { shellEl: u }),
        v ? /* @__PURE__ */ p(Od, { shellEl: u, left: v.left, right: v.right }) : null
      ]
    }
  );
}
const Ud = [
  { id: "source", label: "原文", Icon: mo },
  { id: "compare", label: "对照", Icon: ho },
  { id: "translated", label: "译文", Icon: po }
];
function Hd(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Wd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Kd(e) {
  const t = Je(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, l = a ? Hd(a.state) : "";
  return /* @__PURE__ */ _("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ _("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Ud.map(({ id: c, label: d, Icon: f }) => {
        const u = n === c, m = Wd({
          id: c,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ _(
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
      a ? /* @__PURE__ */ _("div", { className: "reader-live-strip", children: [
        /* @__PURE__ */ _(
          "button",
          {
            type: "button",
            className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
            "aria-pressed": a.visible,
            "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
            title: a.state.error || `${l}，${a.visible ? "点一下看原文" : "点一下叠上译文"}`,
            onClick: a.onToggle,
            children: [
              /* @__PURE__ */ p(Va, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: l })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ _(
          ee,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ p(Ja, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ _(
        ee,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ p(qa, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const Vd = so(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
  return /* @__PURE__ */ _(
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
}), Jd = Vd, qd = {
  markdown: { label: "Markdown", short: "MD", Icon: Jd, needsJob: !0 }
}, Gd = No.map(
  (e) => ({ id: e, ...qd[e] })
);
function Qo() {
  return Gd.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function Zd(e) {
  const t = Je(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(lt, { children: Qo().map(({ id: s, label: i, Icon: l, needsJob: c }) => {
    const d = n === s, f = c && r, u = d ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ _(
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
function Yd(e) {
  const t = Je(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = Qo().map(({ id: l, label: c, short: d, Icon: f, needsJob: u }) => ({
    key: l,
    label: c,
    short: d,
    Icon: f,
    disabled: u && o,
    selected: n === l,
    badge: r == null ? void 0 : r[l],
    onClick: () => a(l)
  }));
  return n ? /* @__PURE__ */ _("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: l, label: c, Icon: d, disabled: f, selected: u, badge: m, onClick: g }) => /* @__PURE__ */ _(
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
        children: /* @__PURE__ */ p(vt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function Xd(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Qd(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function eu(e) {
  return e / 100 * window.innerHeight;
}
function tu(e) {
  return e / 100 * window.innerWidth;
}
function nu(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function Pt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = nu(n);
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
      r = Qd(t, o);
      break;
    }
    case "em": {
      r = Xd(t, o);
      break;
    }
    case "vh": {
      r = eu(o);
      break;
    }
    case "vw": {
      r = tu(o);
      break;
    }
  }
  return r;
}
function ve(e) {
  return parseFloat(e.toFixed(3));
}
function bt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function Pn(e) {
  const { panels: t } = e, n = bt({ group: e });
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
      const d = Pt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = ve(d / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const d = Pt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = ve(d / n * 100);
    }
    let l = 0;
    if (a.minSize !== void 0) {
      const d = Pt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      l = ve(d / n * 100);
    }
    let c = 100;
    if (a.maxSize !== void 0) {
      const d = Pt({
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
function ae(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function kn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? ru : ou
  );
}
function ru(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function ou(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function ea(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function ta(e, t) {
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
function au({
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
    const { x: i, y: l } = ta(r, s), c = e === "horizontal" ? i : l;
    c < a && (a = c, o = s);
  }
  return ae(o, "No rect found"), o;
}
let jt;
function su() {
  return jt === void 0 && (typeof matchMedia == "function" ? jt = !!matchMedia("(pointer:coarse)").matches : jt = !1), jt;
}
function na(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = kn(
    n,
    Array.from(t.children).filter(ea).map((g) => ({ element: g }))
  ).map(({ element: g }) => g), s = [];
  let i = !1, l = !1, c = -1, d = -1, f = 0, u, m = [];
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
            let v;
            if (l) {
              const b = n === "horizontal" ? new DOMRect(
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
                    b,
                    I
                  ];
                  break;
                }
                case 1: {
                  const R = m[0], k = au({
                    orientation: n,
                    rects: [w, S],
                    targetRect: R.element.getBoundingClientRect()
                  });
                  v = [
                    R,
                    k === w ? I : b
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
            for (const b of v) {
              let I = "width" in b ? b : b.element.getBoundingClientRect();
              const R = su() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
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
              const k = g <= c || g > d;
              !i && !k && s.push({
                group: e,
                groupSize: bt({ group: e }),
                panels: [u, y],
                separator: "width" in b ? void 0 : b,
                rect: I
              }), i = !1;
            }
          }
          l = !1, u = y, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const y = o.find(
          (w) => w.element === h
        );
        y ? m.push(y) : (u = void 0, m = []);
      } else
        l = !0;
  }
  return s;
}
var Ye;
class ra {
  constructor() {
    or(this, Ye, {});
  }
  addListener(t, n) {
    const r = wt(this, Ye)[t];
    return r === void 0 ? wt(this, Ye)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = wt(this, Ye)[t];
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
    ar(this, Ye, {});
  }
  removeListener(t, n) {
    const r = wt(this, Ye)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Ye = new WeakMap();
let pt = {
  cursorFlags: 0,
  state: "inactive"
};
const Un = new ra();
function at() {
  return pt;
}
function iu(e) {
  return Un.addListener("change", e);
}
function lu(e) {
  const t = pt, n = { ...pt };
  n.cursorFlags = e, pt = n, Un.emit("change", {
    prev: t,
    next: n
  });
}
function gt(e) {
  const t = pt;
  pt = e, Un.emit("change", {
    prev: t,
    next: e
  });
}
const cu = (e) => e, fn = () => {
}, oa = 1, aa = 2, sa = 4, ia = 8, Fr = 3, Br = 12;
let Ut;
function jr() {
  return Ut === void 0 && (Ut = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (Ut = !0)), Ut;
}
function du({
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
        if (e && jr()) {
          const a = (e & oa) !== 0, s = (e & aa) !== 0, i = (e & sa) !== 0, l = (e & ia) !== 0;
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
    return jr() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Ur = /* @__PURE__ */ new WeakMap();
function Hn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Ur.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = at();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = du({
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
  Ur.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let $e = /* @__PURE__ */ new Map();
const la = new ra();
function uu(e) {
  $e = new Map($e), $e.delete(e);
}
function Hr(e, t) {
  for (const [n] of $e)
    if (n.id === e)
      return n;
}
function Qe(e, t) {
  for (const [n, r] of $e)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function ct() {
  return $e;
}
function Wn(e, t) {
  return la.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ve(e, t, n) {
  const r = $e.get(e);
  $e = new Map($e), $e.set(e, t), la.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function ca(e) {
  const t = at();
  let n = !1;
  switch (t.state) {
    case "active":
      gt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Hn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = Qe(r.group.id, !0);
        Ve(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Wr(e) {
  e.defaultPrevented || ca(e.currentTarget);
}
function fu(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = ta(n, a.rect);
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
function mu(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function hu(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Jr(e),
    b: Jr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  ae(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: Vr(Kr(n.a)),
    b: Vr(Kr(n.b))
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
const pu = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function gu(e) {
  const t = getComputedStyle(da(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function bu(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || gu(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || pu.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Kr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (ae(n, "Missing node"), bu(n)) return n;
  }
  return null;
}
function Vr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Jr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = da(e);
  return t;
}
function da(e) {
  const { parentNode: t } = e;
  return mu(t) ? t.host : t;
}
function yu(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function vu({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!ea(n) || n.contains(e) || e.contains(n))
    return !0;
  if (hu(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (yu(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function Kn(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = na(o), s = fu(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && vu({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function wu(e, t) {
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
function ze(e, t) {
  return ye(e, t) ? 0 : e > t ? 1 : -1;
}
function ht({
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
  if (ze(r, l) < 0)
    if (a) {
      const c = (o + l) / 2;
      ze(r, c) < 0 ? r = o : r = l;
    } else
      r = l;
  return r = Math.min(i, r), r = ve(r), r;
}
function Lt({
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
  ae(d != null, "Invalid first pivot index"), ae(f != null, "Invalid second pivot index");
  let u = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : d, y = n[h];
        ae(
          y,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: S,
          minSize: v = 0
        } = y;
        if (S) {
          const b = i[h];
          if (ae(
            b != null,
            `Previous layout not found for panel index ${h}`
          ), ye(b, w)) {
            const I = v - b;
            ze(I, Math.abs(e)) > 0 && (e = e < 0 ? 0 - I : I);
          }
        }
      }
      {
        const h = e < 0 ? d : f, y = n[h];
        ae(
          y,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: S,
          minSize: v = 0
        } = y;
        if (S) {
          const b = i[h];
          if (ae(
            b != null,
            `Previous layout not found for panel index ${h}`
          ), ye(b, v)) {
            const I = b - w;
            ze(I, Math.abs(e)) > 0 && (e = e < 0 ? 0 - I : I);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : d, y = n[h];
      ae(
        y,
        `Panel constraints not found for index ${h}`
      );
      const w = i[h], { collapsible: S, collapsedSize: v, minSize: b } = y;
      if (S && ze(w, b) < 0)
        if (e > 0) {
          const I = b - v, R = I / 2, k = w + e;
          ze(k, b) < 0 && (e = ze(e, R) <= 0 ? 0 : I);
        } else {
          const I = b - v, R = 100 - I / 2, k = w - e;
          ze(k, b) < 0 && (e = ze(100 + e, R) > 0 ? 0 : -I);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let y = e < 0 ? f : d, w = 0;
    for (; ; ) {
      const v = i[y];
      ae(
        v != null,
        `Previous layout not found for panel index ${y}`
      );
      const b = ht({
        overrideDisabledPanels: s,
        panelConstraints: n[y],
        prevSize: v,
        size: 100
      }) - v;
      if (w += b, y += h, y < 0 || y >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(w));
    e = e < 0 ? 0 - S : S;
  }
  {
    let h = e < 0 ? d : f;
    for (; h >= 0 && h < n.length; ) {
      const y = Math.abs(e) - Math.abs(u), w = i[h];
      ae(
        w != null,
        `Previous layout not found for panel index ${h}`
      );
      const S = w - y, v = ht({
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
  if (wu(l, c))
    return o;
  {
    const h = e < 0 ? f : d, y = i[h];
    ae(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const w = y + u, S = ht({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: w
    });
    if (c[h] = S, !ye(S, w)) {
      let v = w - S, b = e < 0 ? f : d;
      for (; b >= 0 && b < n.length; ) {
        const I = c[b];
        ae(
          I != null,
          `Previous layout not found for panel index ${b}`
        );
        const R = I + v, k = ht({
          overrideDisabledPanels: s,
          panelConstraints: n[b],
          prevSize: I,
          size: R
        });
        if (ye(I, k) || (v -= k - I, c[b] = k), ye(v, 0))
          break;
        e > 0 ? b-- : b++;
      }
    }
  }
  const m = Object.values(c).reduce(
    (h, y) => y + h,
    0
  );
  if (!ye(m, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return c.reduce((h, y, w) => (h[g[w]] = y, h), {});
}
function st(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || ze(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function it({
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
      ae(l != null, `No layout data found for index ${i}`);
      const c = 100 / o * l;
      r[i] = c;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const l = n[i];
    ae(l != null, `No layout data found for index ${i}`);
    const c = r[i];
    ae(c != null, `No layout data found for index ${i}`);
    const d = ht({
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
      ae(l != null, `No layout data found for index ${i}`);
      const c = l + a, d = ht({
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
function ua({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const l = ct();
    for (const [
      c,
      {
        defaultLayoutDeferred: d,
        derivedPanelConstraints: f,
        layout: u,
        groupSize: m,
        separatorToPanels: g
      }
    ] of l)
      if (c.id === e)
        return {
          defaultLayoutDeferred: d,
          derivedPanelConstraints: f,
          group: c,
          groupSize: m,
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
    const u = a(), m = c.findIndex((y) => y.id === t), g = m === 0, h = m === c.length - 1;
    if (h && l < u && (g || c.slice(0, m).every((y, w) => {
      const S = f[w];
      return (S == null ? void 0 : S.collapsible) && ye(S.collapsedSize, d[S.panelId]);
    }))) {
      const y = c.slice(0, m).reduce((w, S) => w + d[S.id], 0);
      return {
        ...d,
        [t]: ve(100 - y)
      };
    }
    return Lt({
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
      layout: g,
      separatorToPanels: h
    } = n(), y = s({
      nextSize: l,
      panels: u.panels,
      prevLayout: g,
      derivedPanelConstraints: f
    }), w = it({
      layout: y,
      panelConstraints: f
    });
    st(g, w) || Ve(u, {
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
      const { group: c } = n(), { element: d } = o(), f = bt({ group: c }), u = Pt({
        groupSize: f,
        panelElement: d,
        styleProp: l
      }), m = ve(u / f * 100);
      i(m);
    }
  };
}
function qr(e) {
  if (e.defaultPrevented)
    return;
  const t = ct();
  Kn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = ua({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function Wt(e) {
  const t = ct();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function fa({
  groupId: e
}) {
  const t = () => {
    const n = ct();
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
      } = t(), c = it({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (st(i, c) || Ve(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: c,
        separatorToPanels: l
      }), c);
    }
  };
}
function nt(e, t) {
  const n = Wt(e), r = Qe(n.id, !0), o = n.separators.find(
    (d) => d.element === e
  );
  ae(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  ae(a, "Matching panels not found");
  const s = a.map((d) => n.panels.indexOf(d)), i = fa({ groupId: n.id }).getLayout(), l = Lt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), c = it({
    layout: l,
    panelConstraints: r.derivedPanelConstraints
  });
  st(i, c) || Ve(
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
function Gr(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = Wt(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && nt(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && nt(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && nt(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && nt(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), nt(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = Wt(t), o = Qe(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, l = r.separators.find(
          (u) => u.element === t
        );
        ae(l, "Matching separator not found");
        const c = i.get(l);
        ae(c, "Matching panels not found");
        const d = c[0], f = a.find(
          (u) => u.panelId === d.id
        );
        if (ae(f, "Panel metadata not found"), f.collapsible) {
          const u = s[d.id], m = f.collapsedSize === u ? r.mutableState.expandedPanelSizes[d.id] ?? f.minSize : f.collapsedSize;
          nt(t, m - u);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = Wt(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        ae(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), nt(t, -100);
        break;
      }
    }
}
function Zr(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = ct(), n = Kn(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), gt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function ma({
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
    const { group: d, groupSize: f } = c, { orientation: u, panels: m } = d, { disableCursor: g } = d.mutableState;
    let h = 0;
    a ? u === "horizontal" ? h = (t.clientX - a.x) / f * 100 : h = (t.clientY - a.y) / f * 100 : u === "horizontal" ? h = t.clientX < 0 ? -100 : 100 : h = t.clientY < 0 ? -100 : 100;
    const y = r.get(d), w = o.get(d);
    if (!y || !w)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: v,
      groupSize: b,
      layout: I,
      separatorToPanels: R
    } = w;
    if (v && I && R) {
      const k = Lt({
        delta: h,
        initialLayout: y,
        panelConstraints: v,
        pivotIndices: c.panels.map((O) => m.indexOf(O)),
        prevLayout: I,
        trigger: "mouse-or-touch"
      });
      if (st(k, I)) {
        if (h !== 0 && !g)
          switch (u) {
            case "horizontal": {
              i |= h < 0 ? oa : aa;
              break;
            }
            case "vertical": {
              i |= h < 0 ? sa : ia;
              break;
            }
          }
      } else
        Ve(c.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: v,
          groupSize: b,
          layout: k,
          separatorToPanels: R
        });
    }
  });
  let l = 0;
  t.movementX === 0 ? l |= s & Fr : l |= i & Fr, t.movementY === 0 ? l |= s & Br : l |= i & Br, lu(l), Hn(e);
}
function Yr(e) {
  const t = ct(), n = at();
  switch (n.state) {
    case "active":
      ma({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Xr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = at(), n = ct();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        gt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = Qe(a.group.id, !0);
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
      ma({
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
      const a = Kn(e, n);
      a.length === 0 ? t.state !== "inactive" && gt({
        cursorFlags: 0,
        state: "inactive"
      }) : gt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Hn(e.currentTarget);
      break;
    }
  }
}
function Qr(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (at().state) {
      case "hover":
        gt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function eo(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || ca(e.currentTarget) && e.preventDefault();
}
function to(e) {
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
function Su(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((l) => l.element === t);
  if (!r || !r.onResize)
    return;
  const o = bt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: ve(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function Iu(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Ru({
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
        const m = u / 100 * n, g = ve(
          m / t * 100
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
function Tu(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const ut = /* @__PURE__ */ new Map();
function Eu(e) {
  let t = !0;
  ae(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: y, target: w } = h;
      if (w === e.element) {
        if (t) {
          const S = bt({ group: e });
          if (S === 0)
            return;
          const v = Qe(e.id);
          if (!v)
            return;
          const b = Pn(e), I = v.defaultLayoutDeferred ? to(b) : v.layout, R = Ru({
            group: e,
            nextGroupSize: S,
            prevGroupSize: v.groupSize,
            prevLayout: I
          }), k = it({
            layout: R,
            panelConstraints: b
          });
          if (!v.defaultLayoutDeferred && st(v.layout, k) && Iu(
            v.derivedPanelConstraints,
            b
          ) && v.groupSize === S)
            return;
          Ve(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: b,
            groupSize: S,
            layout: k,
            separatorToPanels: v.separatorToPanels
          });
        }
      } else
        Su(e, w, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    ae(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = bt({ group: e }), i = Pn(e), l = e.panels.map(({ id: g }) => g).join(",");
  let c = e.mutableState.defaultLayout;
  c && (Tu(e.panels, c) || (c = void 0));
  const d = e.mutableState.layouts[l] ?? c ?? to(i), f = it({
    layout: d,
    panelConstraints: i
  }), u = e.element.ownerDocument;
  ut.set(
    u,
    (ut.get(u) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return na(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
  }), Ve(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    ae(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", Gr);
  }), ut.get(u) === 1 && (u.addEventListener("contextmenu", Wr, !0), u.addEventListener("dblclick", qr, !0), u.addEventListener("pointerdown", Zr, !0), u.addEventListener("pointerleave", Yr), u.addEventListener("pointermove", Xr), u.addEventListener("pointerout", Qr), u.addEventListener("pointerup", eo, !0)), function() {
    t = !1, ut.set(
      u,
      Math.max(0, (ut.get(u) ?? 0) - 1)
    ), uu(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Gr);
    }), ut.get(u) || (u.removeEventListener(
      "contextmenu",
      Wr,
      !0
    ), u.removeEventListener(
      "dblclick",
      qr,
      !0
    ), u.removeEventListener(
      "pointerdown",
      Zr,
      !0
    ), u.removeEventListener("pointerleave", Yr), u.removeEventListener("pointermove", Xr), u.removeEventListener("pointerout", Qr), u.removeEventListener("pointerup", eo, !0)), a.disconnect();
  };
}
function Pu() {
  const [e, t] = M({}), n = x(() => t({}), []);
  return [e, n];
}
function Vn(e) {
  const t = lo();
  return `${e ?? t}`;
}
const dt = typeof window < "u" ? Re : D;
function kt(e) {
  const t = N(e);
  return dt(() => {
    t.current = e;
  }, [e]), x(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function Jn(...e) {
  return kt((t) => {
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
function qn(e) {
  const t = N({ ...e });
  return dt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const ha = _n(null);
function ku(e, t) {
  const n = N({
    getLayout: () => ({}),
    setLayout: cu
  });
  Dn(t, () => n.current, []), dt(() => {
    Object.assign(
      n.current,
      fa({ groupId: e })
    );
  });
}
function pa({
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
  const g = N({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = kt((T) => {
    st(g.current.onLayoutChange, T) || (g.current.onLayoutChange = T, l == null || l(T));
  }), y = kt(
    (T, P) => {
      st(g.current.onLayoutChanged, T) || (g.current.onLayoutChanged = T, c == null || c(T, { isUserInteraction: P }));
    }
  ), w = Vn(i), S = N(null), [v, b] = Pu(), I = N({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), R = Jn(S, a);
  ku(w, s);
  const k = kt(
    (T, P) => {
      const E = at(), A = Hr(T), L = Qe(T);
      if (L) {
        let j = !1;
        switch (E.state) {
          case "active": {
            j = E.hitRegions.some(
              (z) => z.group === A
            );
            break;
          }
        }
        return {
          flexGrow: L.layout[P] ?? 1,
          pointerEvents: j ? "none" : void 0
        };
      }
      if (n != null && n[P])
        return {
          flexGrow: n == null ? void 0 : n[P]
        };
    }
  ), O = qn({
    defaultLayout: n,
    disableCursor: r
  }), $ = J(
    () => ({
      get disableCursor() {
        return !!O.disableCursor;
      },
      getPanelStyles: k,
      id: w,
      orientation: d,
      registerPanel: (T) => {
        const P = I.current;
        return P.panels = kn(d, [
          ...P.panels,
          T
        ]), b(), () => {
          P.panels = P.panels.filter(
            (E) => E !== T
          ), b();
        };
      },
      registerSeparator: (T) => {
        const P = I.current;
        return P.separators = kn(d, [
          ...P.separators,
          T
        ]), b(), () => {
          P.separators = P.separators.filter(
            (E) => E !== T
          ), b();
        };
      },
      updatePanelProps: (T, { disabled: P }) => {
        const E = I.current.panels.find(
          (j) => j.id === T
        );
        E && (E.panelConstraints.disabled = P);
        const A = Hr(w), L = Qe(w);
        A && L && Ve(A, {
          ...L,
          derivedPanelConstraints: Pn(A)
        });
      },
      updateSeparatorProps: (T, {
        disabled: P,
        disableDoubleClick: E
      }) => {
        const A = I.current.separators.find(
          (L) => L.id === T
        );
        A && (A.disabled = P, A.disableDoubleClick = E);
      }
    }),
    [k, w, b, d, O]
  ), F = N(null);
  return dt(() => {
    const T = S.current;
    if (T === null)
      return;
    const P = I.current;
    let E;
    if (O.defaultLayout !== void 0 && Object.keys(O.defaultLayout).length === P.panels.length) {
      E = {};
      for (const se of P.panels) {
        const X = O.defaultLayout[se.id];
        X !== void 0 && (E[se.id] = X);
      }
    }
    const A = {
      disabled: !!o,
      element: T,
      id: w,
      mutableState: {
        defaultLayout: E,
        disableCursor: !!O.disableCursor,
        expandedPanelSizes: I.current.lastExpandedPanelSizes,
        layouts: I.current.layouts
      },
      orientation: d,
      panels: P.panels,
      resizeTargetMinimumSize: P.resizeTargetMinimumSize,
      separators: P.separators
    };
    F.current = A;
    const L = Eu(A), { defaultLayoutDeferred: j, derivedPanelConstraints: z, layout: H } = Qe(A.id, !0);
    !j && z.length > 0 && (h(H), y(H, !1));
    const Q = Wn(w, (se) => {
      const { defaultLayoutDeferred: X, derivedPanelConstraints: fe, layout: me } = se.next;
      if (X || fe.length === 0)
        return;
      const he = A.panels.map(({ id: q }) => q).join(",");
      A.mutableState.layouts[he] = me, fe.forEach((q) => {
        if (q.collapsible) {
          const { layout: Y } = se.prev ?? {};
          if (Y) {
            const we = ye(
              q.collapsedSize,
              me[q.panelId]
            ), te = ye(
              q.collapsedSize,
              Y[q.panelId]
            );
            we && !te && (A.mutableState.expandedPanelSizes[q.panelId] = Y[q.panelId]);
          }
        }
      });
      const De = at().state !== "active";
      h(me), De && y(me, se.isUserInteraction);
    });
    return () => {
      F.current = null, L(), Q();
    };
  }, [
    o,
    w,
    y,
    h,
    d,
    v,
    O
  ]), D(() => {
    const T = F.current;
    T && (T.mutableState.defaultLayout = n, T.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(ha.Provider, { value: $, children: /* @__PURE__ */ p(
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
pa.displayName = "Group";
function Gn() {
  const e = Ln(ha);
  return ae(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Mu(e, t) {
  const { id: n } = Gn(), r = N({
    collapse: fn,
    expand: fn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: fn
  });
  Dn(t, () => r.current, []), dt(() => {
    Object.assign(
      r.current,
      ua({ groupId: n, panelId: e })
    );
  });
}
function Mn({
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
  ...g
}) {
  const h = !!l, y = Vn(l), w = qn({
    disabled: a
  }), S = N(null), v = Jn(S, s), {
    getPanelStyles: b,
    id: I,
    orientation: R,
    registerPanel: k,
    updatePanelProps: O
  } = Gn(), $ = f !== null, F = kt(
    (A, L, j) => {
      f == null || f(A, l, j);
    }
  );
  dt(() => {
    const A = S.current;
    if (A !== null) {
      const L = {
        element: A,
        id: y,
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
      return k(L);
    }
  }, [
    i,
    n,
    r,
    o,
    $,
    y,
    h,
    c,
    d,
    F,
    k,
    w
  ]), D(() => {
    O(y, { disabled: a });
  }, [a, y, O]), Mu(y, u);
  const T = () => {
    const A = b(I, y);
    if (A)
      return JSON.stringify(A);
  }, P = io(
    (A) => Wn(I, A),
    T,
    T
  );
  let E;
  return P ? E = JSON.parse(P) : o !== void 0 ? E = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : E = { flexGrow: 1 }, /* @__PURE__ */ p(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": y,
      id: y,
      ref: v,
      style: {
        ...Nu,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...E
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
Mn.displayName = "Panel";
const Nu = {
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
function Au({
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
    a = it({
      layout: Lt({
        delta: c - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: d,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = it({
      layout: Lt({
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
function ga({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const l = Vn(a), c = qn({
    disabled: n,
    disableDoubleClick: r
  }), [d, f] = M({}), [u, m] = M("inactive"), [g, h] = M(!1), y = N(null), w = Jn(y, o), {
    disableCursor: S,
    id: v,
    orientation: b,
    registerSeparator: I,
    updateSeparatorProps: R
  } = Gn(), k = b === "horizontal" ? "vertical" : "horizontal";
  dt(() => {
    const F = y.current;
    if (F !== null) {
      const T = {
        disabled: c.disabled,
        disableDoubleClick: c.disableDoubleClick,
        element: F,
        id: l
      }, P = I(T), E = iu(
        (L) => {
          m(
            L.next.state !== "inactive" && L.next.hitRegions.some(
              (j) => j.separator === T
            ) ? L.next.state : "inactive"
          );
        }
      ), A = Wn(
        v,
        (L) => {
          const { derivedPanelConstraints: j, layout: z, separatorToPanels: H } = L.next, Q = H.get(T);
          if (Q) {
            const se = Q[0], X = Q.indexOf(se);
            f(
              Au({
                layout: z,
                panelConstraints: j,
                panelId: se.id,
                panelIndex: X
              })
            );
          }
        }
      );
      return () => {
        E(), A(), P();
      };
    }
  }, [v, l, I, c]), D(() => {
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
        g ? $ = "focus" : $ = u;
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
ga.displayName = "Separator";
const Zn = 30, Yn = 65, Dt = 50, _u = 100 - Yn, Lu = 100 - Zn;
function Du(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Yn, Math.max(Zn, t)) : Dt;
}
function Xn(e) {
  return 100 - e;
}
function ft(e) {
  return `${e}%`;
}
const Qn = "reader-document", Ct = "reader-assistant", ba = "retainpdf.reader.ai-split-layout.v1", Cu = {
  [Qn]: Xn(Dt),
  [Ct]: Dt
};
function er(e) {
  const t = Du(e == null ? void 0 : e[Ct]);
  return {
    [Qn]: Xn(t),
    [Ct]: t
  };
}
function xu() {
  try {
    const e = JSON.parse(localStorage.getItem(ba) || "null");
    return er(e);
  } catch {
    return Cu;
  }
}
function Ou(e) {
  try {
    localStorage.setItem(ba, JSON.stringify(er(e)));
  } catch {
  }
}
function mn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = er(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Ct]}vw`
  );
}
function zu() {
  const e = N(null), [t] = M(xu);
  Re(() => {
    const o = e.current;
    return mn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = x((o) => {
    mn(e.current, o);
  }, []), r = x((o, a) => {
    mn(e.current, o), a.isUserInteraction && Ou(o);
  }, []);
  return /* @__PURE__ */ _(
    pa,
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
          Mn,
          {
            id: Qn,
            defaultSize: ft(Xn(Dt)),
            minSize: ft(_u),
            maxSize: ft(Lu)
          }
        ),
        /* @__PURE__ */ p(
          ga,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          Mn,
          {
            id: Ct,
            defaultSize: ft(Dt),
            minSize: ft(Zn),
            maxSize: ft(Yn)
          }
        )
      ]
    }
  );
}
function $u({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = M(!1);
  if (D(() => {
    !e && !t && o(!1);
  }, [e, t]), r || !e && !t)
    return null;
  const a = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ _("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ _("span", { className: "reader-error-notice-text", children: [
      a.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    n ? /* @__PURE__ */ p(ee, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function Fu({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p($u, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ _(lt, { children: [
    e ? /* @__PURE__ */ p("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ _("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ p(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ _("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ p("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ p(ee, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Bu(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function ju() {
  const [e, t] = M(!1), n = lo(), r = N(null);
  return D(() => {
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
  }, [e]), D(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || Bu(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((i) => !i);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ _("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
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
        children: /* @__PURE__ */ p(Ga, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ _(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ _("div", { className: "reader-react-shortcuts-head", children: [
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: Al.map((o) => /* @__PURE__ */ _("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: o.title }),
            /* @__PURE__ */ p("ul", { children: o.items.map((a) => /* @__PURE__ */ _("li", { children: [
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
const Uu = ["source", "sideBySide", "translated"], Hu = { source: "", translated: "", sideBySide: "" };
function Wu(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = Kt(e.sourceUrl), n = Kt(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return Is({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Ku(e) {
  const [t, n] = M(() => /* @__PURE__ */ new Set()), r = J(
    () => e ? Wu(e) : Hu,
    [e]
  ), o = J(
    () => Uu.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = x(async (s) => {
    if (!e) return;
    const i = Kt(r[s]);
    if (!(!i || t.has(s)))
      try {
        const l = e.jobId ? Ss(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Rs(
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
        Ts(c), n((d) => {
          const f = new Set(d);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Vu = {
  source: mo,
  sideBySide: ho,
  translated: po
}, Ju = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function qu(e) {
  const t = Je(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Ku(n), i = N(null);
  return D(() => {
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
  }, []), /* @__PURE__ */ _("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ _("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(Za, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(fo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((l) => {
      const c = ka[l], d = Kt(r[l]), f = a.has(l), u = !!d && !f, m = u ? "" : Ma(l, r), g = Vu[l];
      return /* @__PURE__ */ _(
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
            /* @__PURE__ */ p(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ _("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ _("span", { className: "reader-download-action-label", children: [
                Ju[l],
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
const Gu = "retainpdf:reader:bookmarks:v1:", Zu = 200;
function tr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function ya(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Gu}${t}` : "";
}
function Yu(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Qt(e, t = tr()) {
  const n = ya(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Yu(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Nn(e, t, n) {
  const r = ya(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Zu);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Xu(e, t, n = "", { storage: r = tr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Qt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Nn(e, a.filter((i) => i.page !== s), r) : Nn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Qu(e, t, n = tr()) {
  return Nn(e, Qt(e, n).filter((r) => r.page !== t), n);
}
function ef(e, t) {
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
function tf({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function nf({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = M(() => Qt(e)), [i, l] = M(!1), c = N(null);
  if (D(() => {
    s(Qt(e)), l(!1);
  }, [e]), D(() => {
    if (!i) return;
    const u = (g) => {
      c.current && !c.current.contains(g.target) && l(!1);
    }, m = (g) => {
      g.key === "Escape" && l(!1);
    };
    return document.addEventListener("pointerdown", u), document.addEventListener("keydown", m), () => {
      document.removeEventListener("pointerdown", u), document.removeEventListener("keydown", m);
    };
  }, [i]), !e || n <= 0) return null;
  const d = Math.min(Math.max(t, 1), n), f = a.some((u) => u.page === d);
  return /* @__PURE__ */ _("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: c, children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${f ? " is-marked" : ""}`,
        "aria-pressed": f,
        "aria-label": f ? `取消第 ${d} 页的书签` : `给第 ${d} 页加书签`,
        title: f ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(Xu(e, d, ef(r, d))),
        children: /* @__PURE__ */ p(tf, { filled: f })
      }
    ),
    a.length ? /* @__PURE__ */ _(
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
          /* @__PURE__ */ p(Ya, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { className: "reader-bookmark-count", children: a.length })
        ]
      }
    ) : null,
    i && a.length ? /* @__PURE__ */ p("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ p("ol", { className: "reader-bookmark-list", children: a.map((u) => /* @__PURE__ */ _("li", { className: u.page === d ? "is-current" : "", children: [
      /* @__PURE__ */ _(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(u.page, n)), l(!1);
          },
          children: [
            /* @__PURE__ */ _("span", { className: "reader-bookmark-page", children: [
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
          onClick: () => s(Qu(e, u.page)),
          children: "×"
        }
      )
    ] }, u.page)) }) }) : null
  ] });
}
function rf(e) {
  const [t, n] = M([]);
  return D(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = tt().loadIssues;
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
function of(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const af = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, sf = ["failed", "content", "layout"];
function lf(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function cf({ jobId: e, currentPage: t }) {
  var f;
  const n = rf(e), r = (f = Je()) == null ? void 0 : f.jumpToBlock, [o, a] = M(!1), [s, i] = M(-1), l = N(null);
  D(() => i(-1), [n]);
  const c = (u) => {
    const m = n[u];
    !m || !r || (i(u), r(m.readerItemId));
  }, d = N({ issues: n, last: s, currentPage: t, goTo: c });
  return d.current = { issues: n, last: s, currentPage: t, goTo: c }, D(() => {
    const u = (m) => {
      if (m.key.toLowerCase() !== "n" || m.metaKey || m.ctrlKey || m.altKey || lf(m.target)) return;
      const { issues: g, last: h, currentPage: y, goTo: w } = d.current, S = of(g, h, y, m.shiftKey);
      S < 0 || (m.preventDefault(), w(S));
    };
    return document.addEventListener("keydown", u), () => document.removeEventListener("keydown", u);
  }, []), D(() => {
    if (!o) return;
    const u = (m) => {
      var g;
      (g = l.current) != null && g.contains(m.target) || a(!1);
    };
    return document.addEventListener("pointerdown", u, !0), () => document.removeEventListener("pointerdown", u, !0);
  }, [o]), n.length ? /* @__PURE__ */ _("div", { className: "reader-react-hud-group reader-issues", ref: l, "aria-label": "待处理", children: [
    /* @__PURE__ */ _(
      ee,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((u) => !u),
        children: [
          /* @__PURE__ */ p(Xa, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ _("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      sf.map((u) => {
        const m = n.map((g, h) => ({ issue: g, index: h })).filter(({ issue: g }) => g.kind === u);
        return m.length ? /* @__PURE__ */ _("section", { className: "reader-issues-group", "data-issue-kind": u, children: [
          /* @__PURE__ */ _("h4", { children: [
            af[u],
            /* @__PURE__ */ p("span", { children: m.length })
          ] }),
          /* @__PURE__ */ p("ol", { children: m.map(({ issue: g, index: h }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ _(
            ee,
            {
              className: "reader-issues-item",
              "aria-current": h === s ? "true" : void 0,
              onClick: () => {
                c(h), a(!1);
              },
              children: [
                /* @__PURE__ */ p("span", { className: "reader-issues-title", children: g.title }),
                /* @__PURE__ */ _("span", { className: "reader-issues-page", children: [
                  "第 ",
                  g.page,
                  " 页"
                ] }),
                g.detail ? /* @__PURE__ */ p("span", { className: "reader-issues-detail", children: g.detail }) : null
              ]
            }
          ) }, `${g.kind}:${g.readerItemId}`)) })
        ] }, u) : null;
      })
    ] }) : null
  ] }) : null;
}
const df = 48, uf = 96, ff = 700;
function mf(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= df, downSoFar: r };
}
function hf(e) {
  const [t, n] = M(!1), r = N(0);
  return D(() => {
    const o = /* @__PURE__ */ new WeakMap();
    let a = 0;
    const s = () => {
      a = Date.now();
    }, i = /* @__PURE__ */ new WeakMap(), l = () => {
      const u = e.current;
      return !!(u && (u.querySelector(":focus-visible") || u.querySelector("[aria-expanded='true']")));
    }, c = (u) => {
      const m = u.target;
      if (!(m instanceof Element) || (i.has(m) || i.set(m, !!m.querySelector(`[${ke}]`)), !i.get(m))) return;
      const g = m.scrollTop, h = o.get(m);
      if (o.set(m, g), h === void 0 || Date.now() - a > ff) return;
      const y = mf(!1, r.current, g - h);
      r.current = y.downSoFar, g - h < -4 ? n(!1) : y.hidden && !l() && n(!0);
    }, d = (u) => {
      u.clientY >= window.innerHeight - uf && (r.current = 0, n(!1));
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
function pf(e) {
  const t = Je(), n = Zo(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Ot, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, l = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, c = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), d = ui(a), f = a > To + 1e-3, u = a < Yt - 1e-3, m = mt(r, rt()), g = m >= Yt ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = N(null), y = hf(h), [w, S] = M(!1), [v, b] = M(`${i}`);
  D(() => {
    w || b(`${Math.min(Math.max(i, 1), Math.max(l, 1))}`);
  }, [i, l, w]);
  const I = () => {
    if (S(!1), !c || l <= 0)
      return;
    const R = Number(`${v}`.trim());
    c(Xt(R, l));
  };
  return /* @__PURE__ */ _("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": y ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: w ? /* @__PURE__ */ _(
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
              onChange: (R) => b(R.target.value.replace(/[^\d]/g, "")),
              onBlur: I,
              onKeyDown: (R) => {
                R.key === "Escape" && (R.preventDefault(), S(!1), b(`${i}`));
              }
            }
          ),
          /* @__PURE__ */ _("span", { className: "reader-react-hud-page-suffix", children: [
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
          !c || l <= 0 || (b(`${i}`), S(!0));
        },
        children: l > 0 ? `${Math.min(i, l)} / ${l}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ p(
      nf,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: l,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: c
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(cf, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
      ee,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ p(gf, {})
      }
    ) }) : null,
    /* @__PURE__ */ _("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ p(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !f,
          onClick: () => s(At(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ _(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `${d}%，点击${g}`,
          title: g,
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
          onClick: () => s(At(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(ju, {}) })
  ] });
}
function gf() {
  return /* @__PURE__ */ _("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ p("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ p("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function no(e) {
  var t, n;
  return Ao(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function bf(e) {
  const [t, n] = M(() => ({
    scope: e,
    panel: no(Fe(e))
  }));
  D(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: no(Fe(e))
    });
  }, [e]), D(() => {
    t.scope === e && tn(t.scope, {
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
const An = "download-toast";
function yf({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ _("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ _("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ p("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ p("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ p("div", { className: "download-toast-track", children: /* @__PURE__ */ p("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ p("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function vf(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    gn.dismiss(An);
    return;
  }
  gn.custom(
    () => /* @__PURE__ */ p(yf, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: An, duration: 1 / 0 }
  );
}
function wf() {
  const e = x((t) => {
    t && (t.setState = vf, t.hide = () => gn.dismiss(An));
  }, []);
  return /* @__PURE__ */ _(lt, { children: [
    /* @__PURE__ */ p(Fa, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function Sf(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Po(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function If(e, t) {
  return t === null || e !== t;
}
function Rf(e) {
  const t = N(!1);
  return e && (t.current = !0), t.current;
}
function Tf(e, t) {
  const n = e === t;
  return { open: n, mounted: Rf(n) };
}
const ro = { itemId: null, origin: null };
function Ef() {
  let e = ro;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? ro : { itemId: n, origin: r };
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
const Pf = [];
function kf({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ _("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ p(ee, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ p(Qa, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function Mf({ open: e, onToggle: t }) {
  return /* @__PURE__ */ p(
    ee,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ p(es, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function Nf({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0
}) {
  var b, I;
  const l = ((b = Je()) == null ? void 0 : b.regions) ?? Pf, c = ((I = Zo()) == null ? void 0 : I.currentPage) ?? 1, d = J(() => od(l), [l]), f = ad(d, c), u = J(() => ld(l, s), [l, s]), [m, g] = M(-1);
  D(() => g(-1), [s]);
  const h = N(null), y = N(null), w = N(n);
  w.current = n, D(() => {
    const R = (O) => {
      var F, T;
      const $ = O.target;
      !$ || (F = y.current) != null && F.contains($) || (T = $.closest) != null && T.call($, ".reader-finder-toggles, [data-finder-toggle]") || w.current();
    }, k = (O) => {
      O.key === "Escape" && w.current();
    };
    return document.addEventListener("pointerdown", R, !0), document.addEventListener("keydown", k), () => {
      document.removeEventListener("pointerdown", R, !0), document.removeEventListener("keydown", k);
    };
  }, []);
  const S = N(null);
  D(() => {
    var R, k, O;
    e === "search" ? (R = h.current) == null || R.focus() : (O = (k = S.current) == null ? void 0 : k.querySelector('[aria-current="location"]')) == null || O.scrollIntoView({ block: "center" });
  }, [e, i]), D(() => {
    var R, k;
    e === "search" && m >= 0 && ((k = (R = S.current) == null ? void 0 : R.querySelector('[aria-current="true"]')) == null || k.scrollIntoView({ block: "nearest" }));
  }, [e, m]);
  const v = (R) => {
    const k = u[R];
    k && (g(R), r(k.itemId));
  };
  return /* @__PURE__ */ _("aside", { ref: y, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ _("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ _("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ p(ee, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(ee, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(ee, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(vt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: S, className: "reader-finder-list", children: d.map((R, k) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ _(
      ee,
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
    ) }, R.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: l.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ _(lt, { children: [
      /* @__PURE__ */ _("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          go,
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
              R.key === "Enter" ? (R.preventDefault(), v(dd(m, u.length, R.shiftKey))) : R.key === "Escape" && (R.preventDefault(), n()), R.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: u.length === 0 ? "没有找到" : `${m >= 0 ? `第 ${m + 1} / ` : ""}${u.length >= 200 ? "200+ 处，只列前 200 处" : `${u.length} 处`}${m < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: u.map((R, k) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ _(ee, { className: "reader-finder-entry is-hit", "aria-current": k === m ? "true" : void 0, onClick: () => v(k), children: [
        /* @__PURE__ */ _("span", { className: "reader-finder-entry-text", children: [
          R.snippet.slice(0, R.at),
          /* @__PURE__ */ p("mark", { children: R.snippet.slice(R.at, R.at + R.length) }),
          R.snippet.slice(R.at + R.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: R.page })
      ] }) }, R.itemId)) })
    ] })
  ] });
}
function Af({ active: e, compare: t, ink: n }) {
  const [r, o] = M(!1), [a, s] = M(!1), i = N(null);
  D(() => {
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
  return /* @__PURE__ */ _("div", { className: "reader-toolball", ref: i, "data-open": r ? "true" : void 0, children: [
    a ? /* @__PURE__ */ p(xd, { compare: t, onDone: () => {
      s(!1), o(!1);
    } }) : null,
    r ? /* @__PURE__ */ _("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: [
      n ? /* @__PURE__ */ p(
        ee,
        {
          className: "reader-toolball-item",
          "aria-label": "画笔",
          title: "画笔（P；书页上右键也能选笔和颜色）",
          "aria-pressed": !!n.tool,
          "data-toolball-item": "ink",
          onClick: () => {
            n.setTool(n.tool ? null : "pen"), o(!1);
          },
          children: /* @__PURE__ */ p(xn, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ p(Zd, { active: e }),
      t.available ? /* @__PURE__ */ p(
        ee,
        {
          className: "reader-toolball-item",
          "aria-label": "对比版本",
          title: "对比版本：左边换成这本书的另一份译文",
          "aria-pressed": l || a,
          "data-toolball-item": "compare",
          onClick: () => s((c) => !c),
          children: /* @__PURE__ */ p(ts, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null
    ] }) : null,
    /* @__PURE__ */ p(
      ee,
      {
        className: "reader-toolball-ball",
        "aria-label": r ? "收起工具" : "工具：画笔、Markdown、对比版本",
        title: r ? "收起" : "工具",
        "aria-expanded": r,
        "data-active": e || l ? "true" : void 0,
        onClick: () => {
          o((c) => !c), s(!1);
        },
        children: r ? /* @__PURE__ */ p(vt, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p(ns, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const _f = [
  { tool: "pen", label: "画笔", Icon: xn },
  { tool: "highlighter", label: "荧光笔", Icon: rs },
  { tool: "eraser", label: "橡皮", Icon: os }
];
function va(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function wa({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ _(lt, { children: [
    _f.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
      ee,
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
    Ko.map((o) => /* @__PURE__ */ p(
      ee,
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
    /* @__PURE__ */ p(ee, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(as, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      ee,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(ss, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ p(
      ee,
      {
        className: "reader-ink-tool",
        "aria-label": "退出画笔",
        title: "退出画笔（Esc）",
        "data-ink-exit": "true",
        onClick: () => {
          e.setTool(null), r();
        },
        children: /* @__PURE__ */ p(vt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function Lf({ ink: e, menu: t, onClose: n }) {
  const r = N(null);
  if (D(() => {
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
  return /* @__PURE__ */ p("div", { ref: r, className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", style: { left: a, top: s }, "data-ink-menu": "true", children: /* @__PURE__ */ p(wa, { ink: e, page: t.page, onPick: n }) });
}
function Df({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(wa, { ink: e }) }) : null;
}
function Cf(e) {
  var r;
  if (e.shiftKey || va(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${So}`))) return null;
  const n = Number((r = t.closest(`[${ke}]`)) == null ? void 0 : r.getAttribute(ke)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function xf(e) {
  const t = N(e);
  t.current = e, D(() => {
    const n = (r) => {
      if (va(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
function hn() {
  try {
    return tt().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Of(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function zf(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function $f(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Ff({ documentId: e, jobId: t }) {
  const [n, r] = M([]), [o, a] = M(null), [s, i] = M(null), [l, c] = M(""), [d, f] = M(""), u = N(0);
  D(() => {
    r([]), i(null), f("");
    const y = hn();
    if (!y || !e) return;
    let w = !1;
    return y.list(e).then((S) => {
      w || (r(S.versions), a(S.currentVersionId));
    }).catch(() => {
    }), () => {
      w = !0;
    };
  }, [e, t]);
  const m = x((y) => {
    const w = hn(), S = n.find((b) => b.versionId === y);
    if (!w || !S || !e) return;
    const v = ++u.current;
    c(y), f(""), (async () => {
      const b = tt(), I = await w.resolveJob(e, y);
      if (!I) throw new Error("这一份还没有能读的译文。");
      const R = await b.loadReaderPayload(I, { includeOptionalArtifacts: !0 }), k = b.resolveReaderTranslatedPdfUrl(R.jobPayload, R.manifestPayload);
      if (!k) throw new Error("这一份没有译文 PDF。");
      return { versionId: y, name: S.name, jobId: I, url: k, regions: Of(co(R.regionsPayload)) };
    })().then((b) => {
      v === u.current && i(b);
    }).catch((b) => {
      v === u.current && f((b == null ? void 0 : b.message) || "这一份打不开。");
    }).finally(() => {
      v === u.current && c("");
    });
  }, [e, n]), g = x(() => {
    u.current += 1, i(null), c(""), f("");
  }, []), h = x(async () => {
    var S, v;
    const y = hn();
    if (!y || !s || !e) return;
    try {
      await y.select(e, s.versionId);
    } catch (b) {
      f((b == null ? void 0 : b.message) || "换不过去，请稍后再试。");
      return;
    }
    const w = (S = globalThis.location) == null ? void 0 : S.href;
    w && ((v = globalThis.history) == null || v.replaceState(globalThis.history.state, "", $f(w, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: zf(n, t, o),
    compared: s,
    loading: l,
    error: d,
    choose: m,
    clear: g,
    adopt: h
  };
}
const Bf = "reader-finder-input";
function jf(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Uf(e, t = typeof window > "u" ? null : window) {
  D(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!jf(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(Bf) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function Hf() {
  try {
    return tt().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Wf = "这本书正在处理（翻译或排版），处理完才能改。", Kf = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function Vf({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Hf(), s = `${e || ""}`.trim(), i = !!(a && s && r), l = Wl(s), c = !t || Mt(t), d = Zl(n), [f, u] = M(""), [m, g] = M(null), [h, y] = M(() => /* @__PURE__ */ new Map()), [w, S] = M(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [v, b] = M(() => /* @__PURE__ */ new Map()), [I, R] = M({ phase: "idle" }), k = N({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  D(() => {
    g(null), k.drafts.clear(), k.generation.current = null, b(/* @__PURE__ */ new Map()), R({ phase: "idle" });
  }, [s]), D(() => {
    if (u(""), !i || l || !a) return;
    let L = !1;
    return a.resolveOwnerJobId(s).then((j) => {
      L || u(`${j || s}`.trim() || s);
    }).catch(() => {
      L || u(s);
    }), () => {
      L = !0;
    };
  }, [i, l, a, s]), D(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !d || !c) return;
    let L = !1;
    return a.fetchRevisions(f).then((j) => {
      L || y(Yl(j, d));
    }).catch(() => {
    }), () => {
      L = !0;
    };
  }, [a, f, d, c]);
  const O = I.phase === "running" && I.seenActive;
  D(() => {
    if (I.phase === "running") {
      if (!c) {
        O || R({ phase: "running", seenActive: !0 });
        return;
      }
      O && R(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [I.phase, O, c, t]);
  const $ = J(() => {
    const L = new Map(h);
    if (w.renderedAt === d)
      for (const [j, z] of w.edits) L.set(j, z);
    return L;
  }, [h, w, d]), F = x((L) => {
    const j = `${L || ""}`.trim();
    j && g({ itemId: j, page: Kl(j) });
  }, []), T = x(() => g(null), []), P = x((L, j) => {
    S((z) => {
      const H = new Map(z.renderedAt === d ? z.edits : []);
      return H.set(L, j), { renderedAt: d, edits: H };
    }), b((z) => new Map(z).set(L, (z.get(L) || 0) + 1));
  }, [d]), E = x(async () => {
    if (!(!a || !s || I.phase === "submitting" || I.phase === "running")) {
      R({ phase: "submitting" });
      try {
        await a.rerender(s), R({ phase: "running", seenActive: !1 }), await o();
      } catch (L) {
        R({ phase: "failed", message: (L == null ? void 0 : L.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, I.phase, o]), A = l ? Kf : !c || I.phase === "running" || I.phase === "submitting" ? Wf : "";
  return J(() => ({
    available: i,
    blockedReason: A,
    port: a,
    ownerJobId: f,
    target: m,
    select: F,
    close: T,
    memory: k,
    pendingEdits: $,
    savedCounts: v,
    markSaved: P,
    rerender: I,
    startRerender: E
  }), [i, A, a, f, m, F, T, k, $, v, P, I, E]);
}
function Jf(e, t) {
  D(() => {
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
function qf({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ _("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ p("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ p(
      ee,
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
const Sa = "retainpdf:reader:doc-theme:v1", oo = "data-reader-doc";
function Ia() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Gf(e = Ia()) {
  try {
    return (e == null ? void 0 : e.getItem(Sa)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function Zf(e, t = Ia()) {
  try {
    t == null || t.setItem(Sa, e);
  } catch {
  }
}
function ao(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(oo, "dark") : t.removeAttribute(oo));
}
function Yf() {
  const [e, t] = M(() => Gf());
  D(() => {
    ao(e);
  }, [e]), D(() => () => ao("light"), []);
  const n = x(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return Zf(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
const Xf = Ta(() => import("./ReaderMarkdownPanel-Zu5_7rA8.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function Qf(e) {
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
function em(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function tm() {
  var Be;
  const e = Ml(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = bf(e.viewStateKey), s = a.panel, i = a.setPanel, [l, c] = M(!1), d = N(null), f = N(null), u = s !== null, m = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, g = Qf({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: m,
    liveTranslationVisible: l,
    assistantOpen: u
  }), h = pl({
    hasOverlayContent: m,
    connection: e.liveTranslation.connection,
    showSource: g.showSource,
    liveTranslationVisible: l,
    assistantOpen: u
  }), y = g.sourceViewOnly, w = g.visibleMode;
  D(() => {
    c(!1);
  }, [e.viewStateKey]), D(() => {
    e.session.jobTerminal && c(!1);
  }, [e.session.jobTerminal]);
  const S = N(null);
  D(() => {
    S.current !== e.viewStateKey && yl({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: y,
      jobTerminal: e.session.jobTerminal
    }) && (S.current = e.viewStateKey, c(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, y]), D(() => {
    if (!(t.loading || t.failed)) {
      if (d.current !== e.viewStateKey) {
        d.current = e.viewStateKey;
        const U = Fe(e.viewStateKey), re = Sf({
          savedMode: U == null ? void 0 : U.mode,
          sourceViewOnly: y,
          viewportWidth: rt()
        });
        f.current = re.auto ? re.mode : null, re.mode && re.mode !== e.mode && e.setModeKeepingPage(re.mode);
        return;
      }
      If(e.mode, f.current) && (f.current = null, tn(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, y]);
  const v = s || (e.mode === "compare" ? "compare" : "reading"), b = Tf(s, "markdown"), { docDark: I, toggleDocDark: R } = Yf();
  xl({
    toggleDocDark: R,
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
  const k = x(() => {
    i(null);
  }, []), O = gl(e.liveTranslation), $ = x(() => {
    O && e.goToPage(O, "source");
  }, [e.goToPage, O]), [F, T] = M(null);
  D(() => {
    w === "compare" && e.session.jobTerminal && T(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, w]);
  const P = F !== e.viewStateKey && vl({
    state: e.liveTranslation,
    sourceViewOnly: y,
    visibleMode: w
  }), E = x((U) => {
    const re = em(U, e.liveTranslationAvailable);
    re !== null && c(re), e.setModeKeepingPage(U);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), A = J(() => h.sourcePaneToggle ? /* @__PURE__ */ p(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${l ? " is-active" : ""}`,
      onClick: () => c((U) => !U),
      "aria-pressed": l,
      title: l ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [h.sourcePaneToggle, l]), L = x((U) => {
    i(U);
  }, []), [j] = M(Ef), [z, H] = M(null), Q = x((U) => H((re) => re === U ? null : U), []), [se, X] = M(""), [fe, me] = M("");
  D(() => {
    const U = se.replace(/\s+/gu, " ").trim(), re = window.setTimeout(() => me(U), U ? 150 : 0);
    return () => window.clearTimeout(re);
  }, [se]);
  const [he, De] = M(0), q = x(() => {
    H("search"), De((U) => U + 1);
  }, []);
  Uf(q);
  const Y = x((U) => {
    e.jumpToAnchor({ block_id: U }), (z === "outline" || rt() < 900) && H(null);
  }, [e.jumpToAnchor, z]), we = x((U) => e.jumpToAnchor({ block_id: U }), [e.jumpToAnchor]), te = Vf({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), pe = te.select, qe = e.setModeKeepingPage, Me = o.regions, Te = x((U) => {
    tc(Me, U) && (w === "source" && qe("compare"), pe(U));
  }, [Me, pe, w, qe]);
  Jf(te.available ? Te : null, j);
  const ge = Wc(e.viewStateKey);
  xf(ge);
  const [ne, B] = M(null), oe = x(() => B(null), []), G = Ff({ documentId: o.documentId, jobId: o.jobId }), ue = ((Be = G.compared) == null ? void 0 : Be.url) || "";
  D(() => {
    ue && w !== "compare" && E("compare");
  }, [ue]), D(() => {
    w !== "compare" && G.clear();
  }, [w]);
  const ce = J(
    () => {
      const { compared: U, versions: re, readingVersionId: Ne } = G;
      if (!U) return null;
      const Ge = re.find((Oe) => Oe.versionId === U.versionId), Ae = re.find((Oe) => Oe.versionId === Ne);
      return {
        url: U.url,
        regions: U.regions,
        left: { name: U.name, createdAt: (Ge == null ? void 0 : Ge.createdAt) || "" },
        right: { name: (Ae == null ? void 0 : Ae.name) || "当前译文", createdAt: (Ae == null ? void 0 : Ae.createdAt) || "" }
      };
    },
    [G.compared, G.versions, G.readingVersionId]
  ), Ee = J(() => {
    if (!te.savedCounts.size) return e.revisedBlocks;
    const U = new Map(e.revisedBlocks);
    for (const [re, Ne] of te.savedCounts) U.set(re, (U.get(re) || 0) + Ne);
    return U;
  }, [e.revisedBlocks, te.savedCounts]), Ie = J(() => ({
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
    regionHover: j,
    jumpToBlock: we,
    revisedBlocks: Ee,
    editBlock: te.available ? Te : void 0,
    blockEdit: te,
    editShowsSource: w !== "compare",
    findTerm: z === "search" ? fe : "",
    compareVersion: ce,
    ink: ge,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: y,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: L, close: k },
    docDark: I,
    toggleDocDark: R
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
    j,
    we,
    Ee,
    te,
    Te,
    w,
    z,
    fe,
    ce,
    ge,
    e.sourceOnly,
    y,
    e.download,
    e.goToPage,
    L,
    k,
    I,
    R
  ]), Ce = J(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), xe = [
    si,
    `is-workspace-${v}`,
    u ? "is-assistant-open" : "",
    z ? "is-finder-open" : "",
    g.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(Yc, { value: Ie, hud: Ce, children: /* @__PURE__ */ _(
    "div",
    {
      className: xe,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": v,
      "data-ink-mode": ge.tool || void 0,
      onContextMenu: (U) => {
        const re = Cf(U);
        re && (U.preventDefault(), B(re));
      },
      children: [
        /* @__PURE__ */ p(Fu, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
        /* @__PURE__ */ p(kf, { open: z, onToggle: Q }),
        z ? /* @__PURE__ */ p(
          Nf,
          {
            tab: z,
            onTab: H,
            onClose: () => H(null),
            onJump: Y,
            query: se,
            onQuery: X,
            term: fe,
            focusSignal: he
          }
        ) : null,
        /* @__PURE__ */ _("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(qu, {}),
          /* @__PURE__ */ p(Ul, { onBeforeClose: o.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          Kd,
          {
            mode: w,
            documentReady: !!o.jobId,
            sourceViewOnly: y,
            onModeChange: E,
            liveTranslation: h.topBarPill ? {
              visible: l,
              state: e.liveTranslation,
              onToggle: () => c((U) => !U),
              latestPage: l ? O : null,
              currentPage: e.currentPage,
              onJumpToLatest: $
            } : null,
            completion: P ? {
              onOpenCompare: () => {
                T(e.viewStateKey), E("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ p(Yd, { active: s }),
        u ? /* @__PURE__ */ p(zu, {}) : null,
        /* @__PURE__ */ p(jd, { paneComposition: g, markdownSplit: b.open, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: A }),
        e.showHud ? /* @__PURE__ */ p(
          pf,
          {
            mode: w,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : o.jobId,
            searchSlot: /* @__PURE__ */ p(Mf, { open: z, onToggle: Q })
          }
        ) : null,
        /* @__PURE__ */ p(Ra, { fallback: null, children: b.mounted ? /* @__PURE__ */ p(Xf, { open: b.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: k }) : null }),
        /* @__PURE__ */ p(Af, { active: s, compare: G, ink: ge }),
        /* @__PURE__ */ p(Lf, { ink: ge, menu: ne, onClose: oe }),
        /* @__PURE__ */ p(Df, { ink: ge }),
        /* @__PURE__ */ p(qf, { edit: te }),
        /* @__PURE__ */ p(wf, {})
      ]
    }
  ) });
}
function wm() {
  return /* @__PURE__ */ p(tm, {});
}
export {
  wm as R,
  tm as a,
  ym as d,
  bm as f,
  vm as r,
  Je as u
};
//# sourceMappingURL=ReaderApp-h6GRwxHB.js.map
