var tr = (e) => {
  throw TypeError(e);
};
var nr = (e, t, n) => t.has(e) || tr("Cannot " + n);
var wt = (e, t, n) => (nr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), rr = (e, t, n) => t.has(e) ? tr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), or = (e, t, n, r) => (nr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as _, jsx as p, Fragment as lt } from "react/jsx-runtime";
import { useMemo as J, useState as N, useEffect as D, useCallback as x, useRef as M, useLayoutEffect as Ee, memo as en, createContext as _n, useContext as Ln, forwardRef as oo, useImperativeHandle as Dn, useSyncExternalStore as ao, useId as so, Suspense as wa, lazy as Sa } from "react";
import { requireAdapter as yt, getReaderAdapters as Le } from "./adapters.js";
import { resolveReaderDownloadName as Ea, resolveReaderDownloadUrls as Ia, READER_PROGRESS_COPY as je, trimString as Kt, READER_DOWNLOAD_ACTIONS as Ra, disabledReason as Ta } from "./runtime/state.js";
import { r as Pa, b as ka } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as pn, isFinishedJobStatus as Nt } from "@retainpdf/domain/job";
import { n as io, d as Na, f as nn, k as ar, b as Ma, c as Aa, j as xt, p as Cn, g as _a, l as sr, i as La } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as Da } from "@retainpdf/api/documents";
import { isReaderTransportError as Ca, createReaderTransportError as xa } from "./contracts.js";
import { toast as gn, Toaster as Oa } from "sonner";
import { X as vt, PenLine as xn, Check as lo, Copy as za, ChevronUp as $a, ChevronDown as co, History as Fa, LoaderCircle as Ba, Pin as ja, LogOut as Ha, FileText as uo, Columns2 as fo, Languages as mo, Radio as Ua, ArrowDownToLine as Wa, CheckCircle2 as Ka, Keyboard as Va, Download as Ja, ListOrdered as qa, TriangleAlert as Ga, ListTree as Za, Search as Ya, GitCompareArrows as Xa, LayoutGrid as Qa, Highlighter as es, Eraser as ts, Undo2 as ns, Trash2 as rs } from "lucide-react";
import { Button as ee, Textarea as os, IconButton as ir, Input as ho } from "@retainpdf/ui";
import { pdfjs as po, Page as as, Document as ss } from "react-pdf";
import { e as is, m as ls, a as cs } from "./markdown-math-XkF5urpn.js";
const ds = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, us = "", fs = Object.freeze({
  progress: "retainpdf-reader-progress"
}), ms = (e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, lm = (...e) => {
  var n;
  return (((n = Le()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, He = () => yt("defaultReaderDataPort"), lr = () => yt("defaultReaderPageConfigPort"), cm = {
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
}, go = {
  messageTargetOrigin: () => lr().messageTargetOrigin(),
  readerJobId: () => lr().readerJobId()
}, hs = () => {
  var e;
  return ((e = Le()) == null ? void 0 : e.liveTranslation) ?? null;
}, Mt = () => {
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
}, ps = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, gs = () => {
  var e, t;
  return ((t = (e = Le()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, bs = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, ys = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Ea(...e);
}, vs = (...e) => {
  var t, n;
  return ((n = (t = Le()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Ia(...e);
}, ws = (...e) => yt("downloadProtectedResource")(...e), Ss = (...e) => yt("failDownloadToast")(...e), dm = (e, t) => yt("resolveMarkdownAssetUrl")(e, t), cr = "/api/v1";
function Es() {
  const e = () => {
    var r;
    return Pa(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = N(e);
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
function Is() {
  const e = Es(), t = J(() => bs(go), [e]), n = J(() => gs(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Rs(e) {
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
  }), u = l.documentId === t ? l.jobId : "", m = d.documentId === t ? d.jobId : "", g = n || u, [h, y] = N({
    jobId: "",
    documentId: ""
  }), w = h.jobId === g ? h.documentId : "", S = t || w, v = !!t && !g, [b, E] = N(null), I = (b == null ? void 0 : b.sessionIdentity) === r && b.documentId === S ? b : null, k = v || !!I, O = x((F) => {
    const R = `${F.documentId || ""}`.trim();
    if (!R || a.current && a.current !== R) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: R
      });
    else if (!a.current)
      return;
    const P = `${F.revision || ""}`.trim() || `${Date.now()}`;
    E({
      documentId: R,
      revision: P,
      sessionIdentity: o.current
    }), i();
  }, []);
  D(() => {
    E((F) => F && F.sessionIdentity !== r ? null : F);
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
        y((R) => R.jobId === F.jobId && R.documentId === F.documentId ? R : { jobId: F.jobId, documentId: F.documentId });
        break;
      case "committed-source":
        E({
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
    setCommittedDocumentSource: E,
    activeCommittedDocumentSource: I,
    sourceViewOnly: k,
    refreshCommittedDocument: O,
    applyIdentityEvent: $
  };
}
function dr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Ts(e) {
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
function ur(e, t) {
  return ms(pn(e, t));
}
function Ps(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function ks(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !Ps(a, t))
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
        type: fs.progress,
        stage: n,
        percent: e,
        text: t
      },
      go.messageTargetOrigin()
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
function Ns(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, l] = N(null), [c, d] = N(null), [f, u] = N(""), [m, g] = N(0), h = f === n ? i : null, y = f === n ? c : null, w = dr(h), S = Nt(w), v = x(() => {
    g(($) => $ + 1);
  }, []), b = x(($) => {
    l($.jobPayload), d($.manifestPayload), u($.sessionIdentity);
  }, []), E = x(($) => {
    l(null), d(null), u($);
  }, []), I = M(""), k = M(""), O = x(async () => {
    const $ = o.current;
    if (!$ || I.current === $) return;
    const F = tt().loadJobPayload;
    if (typeof F != "function") return;
    const R = a.current.value;
    I.current = $;
    try {
      const P = await F($);
      if (s.current || a.current.value !== R || o.current !== $ || !P || typeof P != "object")
        return;
      const T = dr(P);
      l(P), u(r.current), !Nt(T) && k.current === $ && (k.current = ""), T === "succeeded" && k.current !== $ && (k.current = $, g((A) => A + 1));
    } catch {
    } finally {
      I.current === $ && (I.current = "");
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
    clearPayload: E
  };
}
function yn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Ms(e, t) {
  e(t), yn(t);
}
function As(e) {
  const [t, n] = N(e ? "source" : "compare"), r = x((a) => {
    e && a !== "source" || (n(a), yn(a));
  }, [e]), o = x((a) => {
    Ms(n, a);
  }, []);
  return D(() => (e && document.documentElement.classList.add("reader-source-only"), yn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function fr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function _s(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: fr(n.active_job_id),
    activeVersionId: fr(n.active_version_id)
  };
}
function Ls(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Ds(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Cs(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const xs = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Os(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = xs.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const zs = 48 * 1024 * 1024;
function $s(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Fs = 2, Te = /* @__PURE__ */ new Map();
function vn(e, t) {
  Te.delete(e), Te.set(e, t);
}
function mr(e) {
  if (Te.size < Fs) return;
  const t = Te.keys().next().value;
  t && Te.delete(t);
}
async function Bs(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function bo(e, t = Mt().fetchProtected, n = {}) {
  var d, f, u, m, g, h, y, w, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Te.has(r)) {
    const v = Te.get(r);
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
    const b = await Bs(s);
    throw b && (v.reason = b), v;
  }
  const i = js(r, s, t);
  if (i) {
    o.abort();
    const v = { ranged: i };
    return mr(), Te.set(r, v), v;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let l;
  try {
    l = await s.arrayBuffer();
  } finally {
    (S = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || S.call(w, "abort", a);
  }
  const c = { data: new Uint8Array(l) };
  return Te.has(r) ? vn(r, c) : (mr(), Te.set(r, c)), c;
}
function js(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < zs ? null : {
    url: e,
    length: o,
    async fetchRange(i, l) {
      const c = await n(e, { headers: { Range: `bytes=${i}-${l - 1}` } });
      if (c.status !== 206) throw new Error(`读取 PDF 片段失败 (${c.status})`);
      return new Uint8Array(await c.arrayBuffer());
    }
  };
}
const Hs = { file: null, loading: !1, error: "" }, Us = { file: null, loading: !0, error: "" };
function Ws(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = N(null);
  if (D(() => {
    if (t || !n) return;
    const s = Te.get(n);
    if (s) {
      vn(n, s);
      return;
    }
    const i = new AbortController();
    return bo(n, void 0, { signal: i.signal }).then((l) => {
      i.signal.aborted || o({ url: n, file: l, loading: !1, error: "" });
    }).catch((l) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (l == null ? void 0 : l.message) || String(l) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Hs;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Te.get(n);
  return a ? { file: a, loading: !1, error: "" } : Us;
}
function Ks(e) {
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
  const i = await bo(t, Mt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Vt(s, o, n, "download"), i);
}
async function Vs(e) {
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
function Js(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function qs({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Da,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Js(o.href, t, a)), !0);
}
const $t = {
  regions: null,
  metadata: null
};
function Gs(e) {
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
  } = e, [S, v] = N(""), [b, E] = N(""), [I, k] = N(null), [O, $] = N(null), [F, R] = N(!1), [P, T] = N(""), [A, L] = N([]), [j, z] = N(!1), [U, Q] = N(() => ({
    source: null,
    translated: null
  })), [se, X] = N(
    $t
  ), [fe, me] = N({
    loading: !0,
    percent: 4,
    text: je.boot,
    stage: "progress",
    failed: !1
  });
  return D(() => {
    const he = new AbortController(), De = h.current.value, q = Ks({
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
      R(!0), we || z(!0), me({
        loading: !1,
        percent: 100,
        text: je.ready,
        stage: "ready",
        failed: !1
      }), bn({ percent: 100, text: je.ready, stage: "ready" });
    }
    function qe() {
      return c != null && c.documentId ? ur(
        c.documentId,
        c.revision
      ) : ds() ? us : Y.resolveResourceUrl(pn(r));
    }
    async function ke() {
      var ue;
      let ne = { activeJobId: "", activeVersionId: "" };
      try {
        const ce = await ((ue = Y.fetchDocument) == null ? void 0 : ue.call(Y, r));
        ce && (ne = _s(ce));
      } catch {
      }
      const B = Ls({
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
      v(oe), E(""), T(""), u(l);
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
    async function Ie() {
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
            ce = await Y.fetchDocumentByJobId(cr, t);
          } catch {
          }
          if (q.isInactive()) return;
        }
      const Re = Ts(ue.jobPayload) || `${(ce == null ? void 0 : ce.document_id) || ""}`.trim();
      Re && !r && d({
        type: "resolved-job-document",
        jobId: t,
        documentId: Re
      });
      const Se = Ds({
        payloadDocumentId: Re,
        linkedActiveJobId: `${(ce == null ? void 0 : ce.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ce == null ? void 0 : ce.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!c
      });
      if (Se.kind === "restore-committed-source") {
        if (q.isInactive()) return;
        d({
          type: "committed-source",
          documentId: Se.documentId,
          revision: Se.revision,
          sessionIdentity: l
        }), m("source");
        return;
      }
      const Ce = Y.resolveReaderSourcePdf(ue.manifestPayload), xe = Y.resolveReaderTranslatedPdfUrl(ue.jobPayload, ue.manifestPayload), Be = typeof Ce == "string" ? Ce : Y.resolveReaderArtifactUrl(Ce), H = r || Re, re = c != null && c.documentId ? ur(
        c.documentId,
        c.revision
      ) : Be || (H ? Y.resolveResourceUrl(pn(H)) : ""), Ne = c ? "" : xe || "";
      v(re || ""), E(Ne), T(ks(ue.jobPayload, t)), f({
        jobPayload: ue.jobPayload || null,
        manifestPayload: ue.manifestPayload || null,
        sessionIdentity: l
      });
      const Ge = () => Vs({
        sourceFinal: re || "",
        translatedFinal: Ne,
        fence: q,
        setBoot: me
      }), Me = !!(re || Ne), Oe = oe && Me ? Ge() : null;
      Oe == null || Oe.catch(() => {
      });
      const zt = (K) => {
        q.isInactive() || (L(c ? [] : io(K.regionsPayload)), Q(c ? { source: null, translated: null } : Na(K.readerMetadata)), X(c ? $t : K.readerErrors ?? $t), z(!0));
      };
      if (oe ? (we = !0, oe.then(zt)) : zt(ue), !Me) {
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
      R(!1), k(null), $(null), L([]), z(!1), Q({ source: null, translated: null }), X($t), Vt(me, 8, je.metadata, "metadata");
      try {
        if (s) {
          await ke();
          return;
        }
        if (!t) {
          te(je.failed, je.failed);
          return;
        }
        await Ie();
      } catch (ne) {
        if (q.isClosedOrStale() || (ne == null ? void 0 : ne.name) === "AbortError") return;
        q.markFailed();
        const B = Number(ne == null ? void 0 : ne.status), oe = `${(ne == null ? void 0 : ne.reason) || ""}`, G = Os({ status: B, reason: oe, sessionJobId: t });
        if (G && (await qs({
          apiPrefix: cr,
          documentId: G,
          expiredJobId: t
        }) || q.isClosedOrStale()))
          return;
        if (Cs({
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
    sourceFile: I,
    translatedFile: O,
    assetsReady: F,
    title: P,
    regions: A,
    regionsSettled: j,
    readerMetadata: U,
    readerErrors: se,
    boot: fe
  };
}
function Zs() {
  const e = M(!1), t = M(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Is(), s = M({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = M(a), l = M(""), c = M(""), d = M(() => {
  }), f = x(() => d.current(), []), u = Rs({
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
  } = u, { mode: w, setMode: S, switchSessionMode: v } = As(y);
  d.current = () => {
    v("source");
  }, i.current = a, l.current = g, c.current = m;
  const b = Ns({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: c,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: E,
    scopedManifestPayload: I,
    jobStatus: k,
    jobTerminal: O,
    jobRefreshRevision: $,
    refreshJobArtifacts: F,
    refreshJobStatus: R
  } = b, P = Gs({
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
  }), T = x(() => {
    var L;
    e.current = !0, (L = t.current) == null || L.abort();
  }, []), A = J(
    () => ({
      fetchProtected: tt().fetchProtected,
      jobId: m,
      jobPayload: E,
      manifestPayload: I,
      sourceUrl: P.sourceUrl,
      translatedUrl: P.translatedUrl,
      sourceOnly: y
    }),
    [m, E, I, P.sourceUrl, P.translatedUrl, y]
  );
  return {
    jobId: m,
    jobStatus: k,
    workflow: `${(E == null ? void 0 : E.workflow) || ""}`.trim().toLowerCase(),
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
    refreshJobStatus: R,
    refreshCommittedDocument: u.refreshCommittedDocument,
    prepareClose: T
  };
}
const Ys = 160, Xs = 8, Qs = 0;
function ei() {
  const e = M(null), [t, n] = N(null), [r, o] = N(Qs), a = x((s) => {
    e.current = s, n(s);
  }, []);
  return D(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (c) => {
      !Number.isFinite(c) || c < Ys || o((d) => Math.abs(d - c) < Xs ? d : c);
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
function ti(e) {
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
function ni(e, t) {
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
  const [f, u] = N(() => ({
    identity: c,
    pages: rn
  })), [m, g] = N(() => ({ identity: c, tick: 0 })), h = f.identity === c ? f.pages : rn, y = m.identity === c ? m.tick : 0, w = ti({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!l
  }), { primaryPane: S } = w, v = x((R, P) => {
    d.current === c && u((T) => {
      const A = T.identity === c ? T.pages : rn;
      return A[P] === R && T.identity === c ? T : {
        identity: c,
        pages: { ...A, [P]: R }
      };
    });
  }, [c]), b = M(null), E = x(() => {
    b.current && clearTimeout(b.current);
    const R = c;
    b.current = setTimeout(() => {
      b.current = null, d.current === R && g((P) => ({
        identity: R,
        tick: P.identity === R ? P.tick + 1 : 1
      }));
    }, 60);
  }, [c]);
  D(() => (b.current && (clearTimeout(b.current), b.current = null), u((R) => R.identity === c && R.pages.source === 0 && R.pages.translated === 0 ? R : { identity: c, pages: { source: 0, translated: 0 } }), g((R) => R.identity === c && R.tick === 0 ? R : { identity: c, tick: 0 }), () => {
    b.current && (clearTimeout(b.current), b.current = null);
  }), [c]);
  const I = J(
    () => Math.max(h.source, h.translated),
    [h]
  ), k = S === "translated" ? h.translated : h.source || h.translated, O = t == null ? void 0 : t.userZoom, $ = t == null ? void 0 : t.shellWidth, F = `${c}-${y}-${O}-${n}-${h.source}-${h.translated}-${$}`;
  return {
    ...w,
    numPagesByPane: h,
    hudNumPages: I,
    primaryNumPages: k,
    metricsTick: y,
    onNumPages: v,
    onMetrics: E,
    rowSyncRevision: F
  };
}
const Pe = "data-reader-page", _e = "data-reader-pane", On = "data-natural-height", ri = "reader-react-root", yo = "reader-react-grid", vo = "reader-react-scroll-shell", oi = "reader-react-pdf-pane", wo = "reader-react-pdf-page", Jt = "reader-react-pdf-page-placeholder", zn = "reader-react-pdf-page-slot";
function qt(e, t) {
  const n = e != null ? `[${Pe}="${e}"]` : `[${Pe}]`;
  return t ? `${n}[${_e}="${t}"]` : n;
}
function Gt() {
  return `.${zn}[${Pe}]`;
}
function Zt(e) {
  return Number(e.getAttribute(Pe));
}
const So = 0.25, Yt = 1, ai = 0.05, Ot = 0.5, si = 16, ii = 8, Eo = si + ii, li = 720;
function rt() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Io(e) {
  return Number.isFinite(e) && e < li;
}
function mt(e, t = Number.POSITIVE_INFINITY) {
  return Io(t) && (e === "source" || e === "translated") ? Yt : Ot;
}
function Ke(e) {
  return Number.isFinite(e) ? Math.min(Yt, Math.max(So, e)) : Ot;
}
function At(e, t) {
  const n = Ke(Number(e) + t * ai);
  return Math.round(n * 100) / 100;
}
function ci(e) {
  return Math.round(Ke(e) * 100);
}
function Ro(e) {
  const n = (Number(e) || 0) - Eo;
  return Math.max(160, Math.floor(n));
}
function di(e, t = Ot) {
  const n = Ke(t);
  return Ro((Number(e) || 0) * n);
}
function ui(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${_e}]`)
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
const fi = 8;
function mi(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < fi ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const To = 200, Po = [
  "markdown"
], hi = Po;
function ko(e) {
  return hi.includes(e);
}
const pi = "retainpdf:reader:view:v1:", hr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), gi = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function No() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Sn(e) {
  return `${e || ""}`.trim();
}
function bi({
  documentId: e,
  jobId: t
}) {
  const n = Sn(e);
  if (n) return `document:${n}`;
  const r = Sn(t);
  return r ? `job:${r}` : "";
}
function Mo(e) {
  const t = Sn(e);
  return t ? `${pi}${t}` : "";
}
function yi(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function vi(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!hr.has(t) || !hr.has(n) || t === n))
    return { left: t, right: n };
}
function wi(e) {
  return e === null ? null : ko(e) ? e : void 0;
}
function Si(e) {
  return gi.has(e) ? e : void 0;
}
function Ao(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = yi(t.anchor), r = Number(t.zoom), o = Si(t.mode), a = vi(t.splitLayout), s = wi(t.assistantPanel);
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
function Fe(e, t = No()) {
  const n = Mo(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Ao(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function tn(e, t, n = No()) {
  const r = Mo(e);
  if (!r || !n) return null;
  const o = Fe(e, n), a = Ao({
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
function Ei(e, t, n = "") {
  var u;
  const [r, o] = N(() => {
    var m;
    return ((m = Fe(n)) == null ? void 0 : m.zoom) ?? mt(e, rt());
  }), a = M(r), s = M(n);
  a.current = r;
  const i = M(1), l = M(((u = Fe(n)) == null ? void 0 : u.zoom) !== void 0);
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
  return Ee(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, ui(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: c, stepZoom: d, resetZoom: f };
}
const Ii = 160, Ri = 3e-3, pr = 50, Ti = 16, Pi = 800;
function ki(e, t = 0) {
  const n = t === 1 ? Ti : t === 2 ? Pi : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-pr, Math.min(pr, r));
  return Math.exp(-o * Ri);
}
function Ni(e, t, n = 0) {
  return Ke(e * ki(t, n));
}
function Mi(e) {
  return Math.round(Ke(e) * 100) / 100;
}
function Ai(e, t, n) {
  const r = Ke(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ke(t) / r;
  const a = (o + Eo) / r;
  return Ro(a * Ke(t)) / o;
}
function _i(e) {
  return Array.from(e.querySelectorAll(Gt()));
}
function Li(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function Di(e, t, n) {
  let r = null;
  for (const s of _i(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const l = Li(i, t, n);
    if ((!r || l < r.distance) && (r = { el: s, rect: i, distance: l }), l === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Pe) || "",
    pane: o.getAttribute(_e) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function Ci(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function _o(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${Gt()}[${Pe}="${t.page}"][${_e}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  if (Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5) {
    const s = Ci(n, e);
    if (s.scrollLeft += a, s !== e)
      for (const i of Array.from(e.querySelectorAll(`[${_e}]`)))
        i === s || i.contains(n) || i.scrollWidth <= i.clientWidth + 1 || i.querySelector(Gt()) && (i.scrollLeft += a);
  }
}
function xi(e, t, n, r) {
  const o = e.querySelector(`.${yo}`);
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
const Oi = 600, zi = 1e3;
function $i(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || _o(e, t);
  });
  a.observe(n);
  const s = (d) => {
    d.type === "wheel" && d.ctrlKey || c();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const d of i) r.addEventListener(d, s, { capture: !0, passive: !0 });
  const l = r.setTimeout(() => c(), zi);
  function c() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(l);
      for (const d of i) r == null || r.removeEventListener(d, s, { capture: !0 });
    }
  }
  return c;
}
function Fi(e, t, n) {
  const r = M(t);
  r.current = t;
  const o = M(n);
  o.current = n;
  const a = M(null), s = M(null), i = M(null);
  D(() => {
    if (!e) return;
    const l = () => {
      const d = a.current;
      if (a.current = null, !d) return;
      const f = Mi(d.target);
      if (Math.abs(f - r.current) < 5e-3) {
        St(d.grid);
        return;
      }
      const u = { anchor: d.anchor, grid: d.grid, fallback: null };
      u.fallback = setTimeout(() => {
        s.current === u && (s.current = null, St(u.grid));
      }, Oi), s.current = u, o.current(f, { keepScroll: !1 });
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
          anchor: Di(e, d.clientX, d.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = Ni(f.target, d.deltaY, d.deltaMode);
      const u = Ai(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = xi(e, u, d.clientX, d.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(l, Ii);
    };
    return e.addEventListener("wheel", c, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", c);
      const d = a.current;
      a.current = null, d != null && d.timer && clearTimeout(d.timer), St((d == null ? void 0 : d.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Ee(() => {
    var c;
    const l = s.current;
    l && (s.current = null, l.fallback && clearTimeout(l.fallback), St(l.grid), !(!e || !l.anchor) && (_o(e, l.anchor), (c = i.current) == null || c.call(i), i.current = $i(e, l.anchor)));
  }, [t, e]);
}
function Bi(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = M(t), a = M(n), s = M(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: x((l) => {
    l !== o.current && (s.current(), a.current(l));
  }, []) };
}
const $n = 48;
function Lo(e, t = $n) {
  return e.getBoundingClientRect().top + t;
}
function Do(e, t) {
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
function Ut(e, t, n = $n) {
  if (!e)
    return null;
  const r = qt(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Lo(e, n), i = Do(o, s);
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
function ji(e, t, n = "smooth", r) {
  return _t(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function En(e, t, n) {
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
function Hi(e, t, n) {
  return En(
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
function Ae(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Ui(e, t, n = !0, r = "", o) {
  const [a, s] = N(1);
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
      const y = Lo(i), w = Do(h, y);
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
const Wi = `canvas, .react-pdf__Page, .${wo}, .${Jt}`, gr = /* @__PURE__ */ new WeakMap();
function Ki(e) {
  const t = Number(e.getAttribute(On));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = gr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Wi), gr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Vi(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Ji(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(Gt()).forEach((r) => {
    const o = Zt(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Ki(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function qi(e, t, n = "", r) {
  const [o, a] = N(() => /* @__PURE__ */ new Map()), s = M(o), i = M(r);
  return i.current = r, Ee(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let l = !1, c = 0, d = !1, f = !1;
    const u = () => {
      var E;
      if (l) return;
      const v = e.current;
      if (!v) return;
      const b = Ji(v);
      Vi(s.current, b) || (s.current = b, a(b)), d && !f && (f = !0, (E = i.current) == null || E.call(i));
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
const Gi = [0, 48, 140, 320, 560], Zi = 700, Yi = [80, 200, 400], Xi = 500, Qi = 50, el = /* @__PURE__ */ new Set([
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
]), tl = 180, br = [0, 48, 140, 320, 700, 1200];
function nl(e, t) {
  var P;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = M(
    ((P = Fe(a)) == null ? void 0 : P.anchor) || { page: 1, fraction: 0 }
  ), l = M(null), c = M(!1), d = M(r), f = M(null), u = M(null), m = M(null), g = M(null), h = M(a), y = M(""), w = M(n);
  w.current = n;
  const S = x(() => {
    var T;
    (T = f.current) == null || T.call(f), f.current = null, u.current != null && (clearTimeout(u.current), u.current = null);
  }, []), v = x(() => {
    !c.current && l.current == null || (S(), m.current != null && (clearTimeout(m.current), m.current = null), l.current = null, c.current = !1);
  }, [S]), b = x((T = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const A = () => {
      g.current = null, tn(h.current, {
        anchor: Ae(i.current)
      });
    };
    T ? A() : g.current = setTimeout(A, tl);
  }, []), E = x((T) => {
    i.current = Ae(T), l.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, c.current = !1;
    }, Qi);
  }, []);
  D(() => {
    if (!o)
      return;
    let T = !1, A = null, L = null, j = null;
    const z = () => {
      if (T) return;
      const U = e.current;
      if (!U) {
        j = setTimeout(z, 50);
        return;
      }
      A = U, L = () => {
        if (c.current)
          return;
        const Q = Ut(A, w.current);
        Q && (i.current = Q, b());
      }, A.addEventListener("scroll", L, { passive: !0 }), c.current || L();
    };
    return z(), () => {
      T = !0, j != null && clearTimeout(j), A && L && A.removeEventListener("scroll", L);
    };
  }, [o, r, n, e, b]), D(() => {
    if (!o) return;
    const T = e.current;
    if (!T) return;
    const A = (L) => {
      L.metaKey || L.ctrlKey || L.altKey || el.has(L.key) && v();
    };
    return T.addEventListener("wheel", v, { passive: !0 }), T.addEventListener("touchmove", v, { passive: !0 }), window.addEventListener("keydown", A), () => {
      T.removeEventListener("wheel", v), T.removeEventListener("touchmove", v), window.removeEventListener("keydown", A);
    };
  }, [o, e, v]), Ee(() => {
    var A;
    if (h.current === a) return;
    b(!0), S(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, y.current = "";
    const T = (A = Fe(a)) == null ? void 0 : A.anchor;
    i.current = T ? Ae(T) : { page: 1, fraction: 0 }, l.current = null, c.current = !!a, d.current = r;
  }, [a, r, b, S]), D(() => {
    var A;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const T = Ae(
      ((A = Fe(a)) == null ? void 0 : A.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = T, l.current = T, c.current = !0, S(), f.current = En(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: br,
        onDone: () => E(T)
      }
    ), u.current = setTimeout(() => {
      u.current = null, E(T);
    }, Math.max(...br) + 160), () => S();
  }, [o, s, a, e, E, S]), D(() => {
    if (d.current === r)
      return;
    if (d.current = r, !o) {
      c.current = !1, l.current = null, S();
      return;
    }
    const T = l.current ? Ae(l.current) : Ae(i.current);
    return c.current = !0, l.current = T, i.current = T, S(), f.current = En(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Gi,
        onDone: () => E(T)
      }
    ), u.current = setTimeout(() => {
      u.current = null, E(T);
    }, Zi), () => {
      S();
    };
  }, [r, o, n, e, E, S]), D(() => () => {
    S(), m.current != null && (clearTimeout(m.current), m.current = null), b(!0);
  }, [S, b]);
  const I = x(() => {
    const T = Ut(
      e.current,
      w.current
    );
    return Ae(T || i.current);
  }, [e]), k = x(() => {
    c.current = !0;
    const T = Ut(
      e.current,
      w.current
    ), A = Ae(T ?? i.current);
    return i.current = A, l.current = A, b(), A;
  }, [e, b]), O = x((T, A, L) => {
    const j = L || w.current, z = Xt(T, A || 1), U = { page: z, fraction: 0 };
    i.current = U, c.current = !0, l.current = U, b(), S(), ji(e.current, z, "smooth", j), f.current = Hi(
      () => e.current,
      z,
      {
        behavior: "auto",
        pane: j,
        delaysMs: Yi,
        onDone: () => E(U)
      }
    ), u.current = setTimeout(() => {
      u.current = null, E(U);
    }, Xi);
  }, [e, E, S, b]), $ = x(() => Ae(i.current), []), F = x(() => c.current, []), R = x(() => {
    if (!c.current || !l.current)
      return;
    const T = Ae(l.current);
    _t(
      e.current,
      T,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: I,
    beginModeSwitch: k,
    goToPage: O,
    getAnchor: $,
    isRestoring: F,
    repinIfRestoring: R
  };
}
function rl(e, t) {
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
function Co(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const ol = [0, 80, 200, 400, 800], al = 120, sl = 400;
function il(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: l, documentId: c, regionsSettled: d = !0 } = e, f = M(a);
  f.current = a;
  const u = M(s);
  u.current = s;
  const m = M(i);
  m.current = i;
  const g = M(n);
  g.current = n, D(() => {
    var b, E;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = ps(), y = rl(h, u.current);
    if (y == null && (h != null && h.blockId) && !d) return;
    const w = Co(h, y, { jobId: l, documentId: c });
    if (t.current === w)
      return;
    if (y == null) {
      t.current = w, (b = g.current) == null || b.call(g);
      return;
    }
    t.current = w, h && ((E = m.current) == null || E.call(m, h, y));
    const S = [];
    let v = 0;
    for (const I of ol)
      v = Math.max(v, I), S.push(
        setTimeout(() => {
          f.current(y);
        }, I)
      );
    return S.push(
      setTimeout(() => {
        var I;
        (I = g.current) == null || I.call(g);
      }, v + al)
    ), () => {
      for (const I of S) clearTimeout(I);
    };
  }, [r, o, l, c, t, d]);
}
function ll(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function cl(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = sl,
    jobId: i,
    documentId: l,
    applyReaderSearch: c
  } = e, d = M(a);
  d.current = a;
  const f = M(c);
  f.current = c;
  const u = M(0);
  D(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || u.current === o) return;
    const m = setTimeout(() => {
      var w;
      const g = ((w = globalThis.location) == null ? void 0 : w.search) || "", h = ka(g, o, d.current);
      if (u.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Co(
        { blockId: y },
        o,
        { jobId: i, documentId: l }
      ), (f.current || ll)(h);
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
function dl(e) {
  const t = M(""), [n, r] = N(!1), o = x(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  il(a, t, o), cl(e, t, n);
}
const Et = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function ul(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function yr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function xo(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = yr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = yr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function fl(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = xo(r, t, n);
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
function ml(e) {
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
function hl(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function pl(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function gl(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function bl(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const vr = [250, 500, 1e3, 2e3, 4e3], on = [80, 160, 320, 640, 1e3, 1500], wr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function In(e, t) {
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
  return Ca(e) ? `${e.code || ""}`.trim() : "";
}
function Ft(e, t) {
  const n = Fn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function yl(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const l = await o.fetchPage(e, t.page_idx, { signal: r });
      if (xo(n.pagesByPage.get(t.page_idx), t, l) !== "retry")
        return l;
      a = xa(
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
    if (await In(i, r), s >= on.length + 2) throw a;
  }
}
function vl({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = N(Et), s = M(o), i = M("");
  s.current = o;
  const l = `${e || ""}`.trim(), c = `${t || ""}`.trim().toLowerCase(), d = Nt(c) ? c : "";
  return D(() => {
    if (!n || !l) {
      i.current = "", s.current = Et, a(Et);
      return;
    }
    const f = r === void 0 ? hs() : r, u = i.current === l;
    if (i.current = l, !f) {
      const v = {
        ...u ? s.current : Et,
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
      ...u ? s.current : Et,
      connection: d ? "terminal" : "connecting",
      jobStatus: c,
      error: ""
    };
    s.current = h, a(h);
    const y = (v) => {
      m.signal.aborted || a((b) => {
        const E = v(b);
        return s.current = E, E;
      });
    }, w = async () => {
      let v = 0;
      for (; !m.signal.aborted; )
        try {
          const b = await f.fetchLayout(l, { signal: m.signal });
          g = !0, y((E) => ({
            ...E,
            layoutByPage: ul(b),
            jobStatus: c,
            error: ""
          }));
          return;
        } catch (b) {
          if ((b == null ? void 0 : b.name) === "AbortError") return;
          const E = Fn(b);
          if (!(E === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !E)) {
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
          })), await In(vr[Math.min(v, vr.length - 1)], m.signal).catch(() => {
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
              let E;
              try {
                E = await yl(
                  l,
                  b,
                  s.current,
                  m.signal,
                  f
                );
              } catch (I) {
                if ((I == null ? void 0 : I.name) === "AbortError" || m.signal.aborted) throw I;
                y((k) => ({
                  ...k,
                  lastSeq: Math.max(k.lastSeq, b.seq),
                  error: Ft(I, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((I) => {
                const k = fl(I, b, E);
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
          y((E) => ({
            ...E,
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
        await In(wr[Math.min(v, wr.length - 1)], m.signal).catch(() => {
        }), v += 1;
      }
    })(), () => m.abort();
  }, [n, r, l, d]), o;
}
function wl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), l = Number(s.count) || 0;
    i && l > 0 && o.set(i, l);
  }
  return o;
}
function Sl(e, t = !0) {
  const [n, r] = N(() => /* @__PURE__ */ new Map());
  return D(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = tt().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(wl(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const El = 4500;
function Il(e) {
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
const Rl = /* @__PURE__ */ new Set(["book", "translate"]);
function Oo(e) {
  return !!(e.jobId && e.sourceUrl && Rl.has(e.workflow));
}
function Tl(e) {
  return !!(Oo(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Pl() {
  const e = Zs(), t = Oo({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Tl({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = M({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Nt(o) && (r.current.running = !0);
  const a = vl({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: l, bindShell: c } = ei(), d = Sl(e.jobId, !e.sourceOnly), f = bi({
    documentId: e.documentId,
    jobId: e.jobId
  }), u = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = Ei(e.mode, s, f);
  Fi(i, m, g);
  const h = ni(
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
  } = nl(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  D(() => {
    S();
  }, [l, S]);
  const v = qi(
    s,
    h.compareMode,
    h.rowSyncRevision,
    S
  ), b = Ui(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), E = x((z, U) => {
    var se, X;
    const Q = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((se = h.numPagesByPane) == null ? void 0 : se.source) || 0,
      Number((X = h.numPagesByPane) == null ? void 0 : X.translated) || 0
    );
    w(z, Q, U);
  }, [w, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [I, k] = N(null), O = M(null), $ = x((z) => {
    O.current && clearTimeout(O.current), k(z), z && (O.current = setTimeout(() => k(null), El));
  }, []);
  D(() => () => {
    O.current && clearTimeout(O.current);
  }, []);
  const F = x((z) => {
    const U = nn(e.regions, z);
    return U ? ar(U, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), R = x((z, U) => {
    const Q = U || h.primaryPane, se = typeof z == "object" && z ? `${z.block_id || ""}`.trim() : "", X = typeof z == "object" && z ? `${z.image_url || ""}`.trim() : "", fe = typeof z == "object" && z ? z.page_idx != null ? Number(z.page_idx) + 1 : z.page != null ? Number(z.page) : null : typeof z == "number" ? z + 1 : null, me = Ma(e.regions, X, fe) || nn(e.regions, se) || (typeof z == "object" ? Aa(e.regions, z) : null);
    let he = me ? ar(me, Q).page : null;
    he == null && (he = Il(z)), !(he == null || he < 1) && ($(me), E(he, Q));
  }, [$, E, h.primaryPane, e.regions]);
  dl({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: b,
    goToPage: E,
    resolveBlockPage: F,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (z) => {
      $(nn(e.regions, z.blockId));
    }
  });
  const { setModeKeepingPage: P } = Bi({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  D(() => {
    $(null);
  }, [u, $]);
  const T = !e.boot.loading && !e.boot.failed, A = J(() => ({ bindShell: c, shellEl: i, shellWidth: l, shellRef: s }), [c, i, l, s]), L = J(() => ({
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
    goToPage: E,
    activeRegion: I,
    jumpToAnchor: R,
    setModeKeepingPage: P,
    download: e.download,
    showHud: T,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: d
  }), [e, A, h, L, v, E, I, R, P, T, m, g, f, a, n, d]);
  return J(() => ({
    ...j,
    currentPage: b
  }), [j, b]);
}
const kl = [
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
], Nl = [
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
function Ml(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of kl)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Al(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const _l = ".reader-notes-panel";
function Ll(e) {
  return e instanceof Element ? !!e.closest(_l) : !1;
}
function Dl(e) {
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
      if (u.defaultPrevented || u.metaKey || u.ctrlKey || u.altKey || Al(u.target) || Ll(u.target))
        return;
      const m = u.key, g = Ml(m);
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
const Cl = "retainpdf:soft-reader-close";
function xl() {
  return new URL("./index.html", window.location.href).href;
}
function Ol() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Cl },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function zl(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function $l() {
  if (!(typeof window > "u") && !Ol()) {
    if (zl(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(xl());
  }
}
function Fl({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Bl({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ _(Fl, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), $l();
  }, children: [
    /* @__PURE__ */ p(vt, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
let Sr = !1;
function jl() {
  if (Sr)
    return;
  const e = Mt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (po.GlobalWorkerOptions.workerSrc = e, Sr = !0);
}
function de(e) {
  return typeof e == "string" ? e : "";
}
function Hl(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function Ul(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function Wl(e) {
  return {
    source: de(e == null ? void 0 : e.source_text) || de(e == null ? void 0 : e.unit_source_text),
    translated: de(e == null ? void 0 : e.protected_translated_text) || de(e == null ? void 0 : e.translated_text)
  };
}
const Kl = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function zo(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function Vl(e) {
  const t = zo(e).sort((r, o) => de(r.ts).localeCompare(de(o.ts)));
  return t.length ? [
    { text: de(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: de(r.new_text),
      label: Kl[de(r.source)] || de(r.source) || "修订",
      ts: de(r.ts),
      reason: de(r.reason)
    }))
  ].reverse() : [];
}
function Jl(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function ql(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return de(r.finished_at) || de(n.finished_at) || "";
}
function Gl(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = zo(e).sort((a, s) => de(a.ts).localeCompare(de(s.ts)));
  for (const a of o) {
    const s = new Date(de(a.ts)).getTime(), i = de(a.reader_item_id) || de(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, de(a.new_text));
  }
  return n;
}
const Zl = {
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
function Yl(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = Zl[de(n.kind)] || de(n.kind) || "问题", o = de(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const Xl = /* @__PURE__ */ new Set(["text", "formula"]);
function Bn(e) {
  return Xl.has(e);
}
function Ql(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || Bn(xt(n));
}
function ec(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !Bn(xt(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const tc = 300, nc = 72;
function rc(e, t) {
  if (e.width >= tc && e.height >= nc)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const oc = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function ac(e, t, n) {
  return e.flatMap((r) => {
    if (!oc.has(xt(r.region))) return [];
    const o = Cn(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function Er(e, t, n) {
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
async function sc(e) {
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
const ic = "reader-text-hover-copy", lc = "reader-text-hover-edit", cc = "reader-text-hover-id";
function dc(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const $o = "reader-text-hover-tools";
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
const uc = 26, fc = 220;
function mc(e, t = fc) {
  return e.height < uc * 2 || e.width < t;
}
function hc({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? lo : e === "failed" ? vt : za, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function pc({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  frameRect: o,
  placement: a,
  tailTop: s = 0
}) {
  const [i, l] = N("idle"), [c, d] = N("idle"), [f] = N(() => dc()), u = M([]), m = (e == null ? void 0 : e.itemId) || "";
  if (D(() => {
    l("idle"), d("idle");
    const b = u.current;
    return () => {
      b.forEach((E) => window.clearTimeout(E)), u.current = [];
    };
  }, [m]), !e) return null;
  const g = _a(e.highlight.region, t), h = xt(e.highlight.region), y = (b, E) => async (I) => {
    I.preventDefault(), I.stopPropagation();
    const k = await sc(b);
    E(k ? "copied" : "failed"), u.current.push(window.setTimeout(() => E("idle"), 1200));
  }, w = h === "formula" ? "复制 LaTeX" : "复制", S = o || e.rect, v = a || (mc(S) ? "outside" : "inside");
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
          className: $o,
          "data-placement": v,
          style: v === "tail" ? { top: s } : void 0,
          children: [
            f ? /* @__PURE__ */ p(
              an,
              {
                className: cc,
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
                className: lc,
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
                className: ic,
                state: i,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: i === "copied" ? "已复制" : i === "failed" ? "复制失败" : w,
                onClick: y(g, l),
                children: /* @__PURE__ */ p(hc, { state: i })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function gc(e, t) {
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
function bc(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = Cn(
      gc(e, a),
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
const yc = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', vc = 256, It = /* @__PURE__ */ new Map();
function wc(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Fo(e) {
  const t = `${e || ""}`, { text: n, slots: r } = is(t, { bareLatex: !0 }), o = wc(n), a = ls(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = It.get(t);
  if (!s && (s = cs(o, r), It.set(t, s), It.size > vc)) {
    const i = It.keys().next().value;
    i !== void 0 && It.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function sn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ue(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Sc(e, t) {
  const n = e.typography, r = Ue(t) || 1, o = Ue(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = sn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, l = Math.max(5.5 * r, Math.min(s, i * r)), c = Ue(n == null ? void 0 : n.fit_min_font_size_pt), d = Ue(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (c || 5.5) * r), u = Math.max(
    f,
    d ? d * r : o ? o * r : l
  ), m = o ? o * r : l, g = Ue(n == null ? void 0 : n.leading_em), h = [
    Ue(n == null ? void 0 : n.padding_top_pt) || 0,
    Ue(n == null ? void 0 : n.padding_right_pt) || 0,
    Ue(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ue(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || yc,
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
function Ec(e, t, n, r) {
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
const Ic = 512, Rt = /* @__PURE__ */ new Map();
let Rn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Rn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Rn += 1;
}));
function Rc(e, t, n, r) {
  return [
    Rn,
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
function Bo({ item: e, pageScale: t }) {
  const n = M(null), r = J(
    () => Fo(e.translatedText),
    [e.translatedText]
  ), [o, a] = N(r.fallbackHtml), s = J(
    () => Sc(e, t),
    [e, t]
  );
  D(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((u) => {
      f && a(u);
    }), () => {
      f = !1;
    };
  }, [r]), Ee(() => {
    const f = n.current;
    if (!f) return;
    const [u, m, g, h] = s.padding, y = Math.max(1, e.rect.width - h - m), w = Math.max(1, e.rect.height - u - g), S = Rc(o, y, w, s);
    let v = Rt.get(S);
    if (v === void 0 && (v = Ec(
      (b) => (f.style.fontSize = `${b}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Rt.set(S, v), Rt.size > Ic)) {
      const b = Rt.keys().next().value;
      b !== void 0 && Rt.delete(b);
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
function Tc({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = J(
    () => bc(e, t, n, r),
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
        Bo,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Pc = en(Tc);
function kc({
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
        Bo,
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
const Nc = en(kc), jo = 24, Ze = jo * 2 + 4, We = 24, Mc = 4, Ac = 6, ot = (e) => e.left + e.width, et = (e) => e.top + e.height;
function Tt(e, t) {
  const n = Math.min(ot(e), ot(t)) - Math.max(e.left, t.left), r = Math.min(et(e), et(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Ir = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= ot(t) && r >= t.top && r <= et(t);
}, _c = (e) => e.height > 40 && e.height > e.width * 2.5;
function Lc(e, t, n) {
  if (!t.length || e.height < We || e.width < n + 8) return null;
  const r = Math.max(...t.map(et)), o = ot(e) - 4 - n;
  for (const a of [r, et(e) - 2]) {
    const s = Math.max(e.top, a - We), i = { left: o, top: s, width: n, height: We };
    if (!t.some((l) => Tt(i, l) > 0)) return s - e.top;
  }
  return null;
}
function Dc(e, t) {
  const n = [], r = (a) => {
    const s = jo + Mc, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: ot(e), top: i, width: s, height: Ze } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: Ze } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - We - 3, width: Ze, height: We + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: et(e), width: Ze, height: We + 3 } }), r(!0);
  const o = Lc(e, t, Ze);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: ot(e) - 4 - Ze, top: e.top + o, width: Ze, height: We } }), n;
}
function Cc(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !_c(S)), i = s.filter((S) => Ir(S, t)), l = s.filter((S) => !Ir(S, t)), c = n.filter((S) => S !== t && Tt(S, t) < t.width * t.height * 0.5), d = Dc(t, i).filter(({ box: S, overhang: v }) => {
    const b = v ? Ac : 0;
    return S.left >= -b && ot(S) <= r + b && S.top >= 0 && et(S) <= o;
  }), f = ({ placement: S, tailTop: v }) => v === void 0 ? { placement: S } : { placement: S, tailTop: v }, u = ({ box: S }) => !l.some((v) => Tt(S, v) > 0), m = d.filter((S) => S.placement !== "tail"), g = m.find((S) => u(S) && !c.some((v) => Tt(S.box, v) > 0));
  if (g) return f(g);
  const h = m.find(u) || d.find((S) => S.placement === "tail" && u(S));
  if (h) return f(h);
  let y = null, w = Number.POSITIVE_INFINITY;
  for (const S of d) {
    const v = l.reduce((b, E) => b + Tt(S.box, E), 0);
    v < w && (y = S, w = v);
  }
  return y ? f(y) : { placement: "outside" };
}
function xc(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - We - 3 : et(r);
  return t >= r.left - 4 && t <= r.left + Ze + 4 && n >= a && n <= a + We + 3;
}
const ln = (e) => e.left + e.width, cn = (e) => e.top + e.height;
function Oc(e, t, n = 3, r = 6) {
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
function zc(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function $c(e, t, n, r) {
  const [o, a] = N(null);
  return Ee(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? zc(s) : [], l = i.length ? Oc(t.rect, i) : t.rect, c = n.filter((f) => f.itemId !== t.itemId).map((f) => f.rect), d = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Cc({ frame: l, others: c, pageWidth: r, pageHeight: d, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
const Ho = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Rr = { pen: 35e-4, highlighter: 0.018 }, Tr = 0.015, Tn = "retainpdf.reader.ink.v1:";
function Pr(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Tn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function Fc(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Tn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Tn + e);
    } catch {
    }
}
function Bc(e, t, n, r, o, a) {
  const s = Tr * Tr;
  return e.filter((i) => Uo(i, t, n) && i.points.some(([l, c]) => (l - r) ** 2 + ((c - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Uo(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function jc(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function Hc(e) {
  const [t, n] = N(null), [r, o] = N(Ho[0].key), [a, s] = N(() => Pr(e)), i = M(a), l = M([]);
  D(() => {
    const h = Pr(e);
    i.current = h, s(h), l.current = [];
  }, [e]);
  const c = x((h) => {
    i.current = h, s(h), Fc(e, h);
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
const Uc = "reader-ink-layer";
function Wc(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function kr({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: Wc(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function Kc({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = N(null), i = M(!1), l = o.strokes.filter((h) => Uo(h, e, t)), c = !!o.tool;
  if (!c && !l.length) return null;
  const d = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (h, y) => o.erase(Bc(o.strokes, e, t, h, y, r / Math.max(1, n))), u = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, w] = d(h);
    o.tool === "eraser" ? f(y, w) : s([[y, w]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, w] = d(h);
    o.tool === "eraser" ? f(y, w) : s((S) => S ? jc(S, y, w) : [[y, w]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Rr[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ _(
    "svg",
    {
      className: Uc,
      "data-ink-active": c ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: u,
      onPointerMove: m,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        l.map((h) => /* @__PURE__ */ p(kr, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(kr, { stroke: { tool: o.tool, color: o.color, width: Rr[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function Vc({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = N(null), [i, l] = N(!1), [c, d] = N([]), [f, u] = N(""), [m, g] = N(""), [h, y] = N(!1), [w, S] = N(null), [v, b] = N([]), E = r.drafts, I = r.generation, k = x(async (R, P) => {
    if (e)
      try {
        d(Vl(await e.fetchRevisions(R, P)));
      } catch {
        d([]);
      }
  }, [e]);
  D(() => {
    if (s(null), d([]), S(null), b([]), g(""), !e || !t || !n) return;
    let R = !1;
    return l(!0), e.loadItem(t, n).then((P) => {
      if (R) return;
      const T = P == null ? void 0 : P.item;
      if (!T) throw new Error("找不到这一段的译文。");
      const A = `${(P == null ? void 0 : P.item_id) || n}`, { source: L, translated: j } = Wl(T);
      s({ readerItemId: n, itemId: A, source: L, current: j }), u(E.get(n) ?? j);
    }).catch((P) => {
      R || S({ tone: "error", message: (P == null ? void 0 : P.message) || "读取这段译文失败。" });
    }).finally(() => {
      R || l(!1);
    }), k(t, n), () => {
      R = !0;
    };
  }, [e, t, n, k]);
  const O = x((R) => {
    u(R), n && E.set(n, R);
  }, [n, E]), $ = x(async (R, P) => {
    if (!e || !a || h) return !1;
    const T = R ?? f;
    if (!T.trim()) return !1;
    y(!0), S(null), b([]);
    try {
      const A = await e.revise(t, a.itemId, {
        translated_text: T,
        source: "user",
        reason: (P ?? m).trim() || "在阅读页手动修改",
        ...I.current != null ? { expected_generation: I.current } : {}
      }), L = Number(A == null ? void 0 : A.generation);
      return Number.isFinite(L) && (I.current = L), E.delete(a.readerItemId), s({ ...a, current: T }), u(T), g(""), (A == null ? void 0 : A.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, T), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), k(t, a.readerItemId), !0;
    } catch (A) {
      const L = A;
      return (L == null ? void 0 : L.reason) === "generation_mismatch" && (I.current = null), S({ tone: "error", message: (L == null ? void 0 : L.message) || "保存失败，请稍后再试。" }), b(Yl(L == null ? void 0 : L.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, f, m, t, o, k, E, I]), F = x(() => {
    n && E.delete(n);
  }, [n, E]);
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
const Wo = "reader-inline-edit";
function Jc({ text: e }) {
  const [t, n] = N("");
  return D(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = Fo(e);
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
function qc({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var F;
  const s = e.itemId, i = Vc({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [l, c] = N(!1), [d, f] = N(!1), u = M(null), m = rc(e.rect, t), g = J(() => ec(o), [o]), h = g.indexOf(s), { loaded: y } = i, w = i.saving || i.loading, S = n.blockedReason, v = !y || i.draft === y.current, { close: b, select: E } = n, I = x((R) => {
    const P = g[h + R];
    P && (E(P), a == null || a(P));
  }, [g, h, E, a]), k = x(() => {
    i.discardDraft(), b();
  }, [i, b]), O = x(async (R, P) => {
    await i.save(R, P) && b();
  }, [i, b]);
  D(() => {
    const R = (P) => {
      !P.altKey || P.key !== "ArrowUp" && P.key !== "ArrowDown" || (P.preventDefault(), I(P.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", R), () => window.removeEventListener("keydown", R);
  }, [I]), Ee(() => {
    const R = u.current;
    if (!R) return;
    R.style.height = "auto";
    const P = m.mode === "inline" ? m.minHeight : 0;
    R.style.height = `${Math.max(P, R.scrollHeight + 2)}px`;
  }, [i.draft, y, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const $ = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ _(lt, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ _(
      "div",
      {
        className: `${Wo} is-${m.mode}`,
        style: $,
        role: "group",
        "aria-label": `改第 ${((F = n.target) == null ? void 0 : F.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (R) => R.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            ee,
            {
              className: `reader-inline-edit-source${l ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: l ? "收起原文" : "展开原文",
              onClick: () => c((R) => !R),
              children: y.source
            }
          ) : null,
          S ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: S }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ p(
            os,
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
                R.key === "Enter" && (R.metaKey || R.ctrlKey) ? (R.preventDefault(), v || O()) : R.key === "Escape" && (R.preventDefault(), k());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(Jc, { text: i.draft }) : null,
          /* @__PURE__ */ _("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(ir, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => I(-1), children: /* @__PURE__ */ p($a, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(ir, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => I(1), children: /* @__PURE__ */ p(co, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              ho,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!S || !y,
                onChange: (R) => i.setReason(R.target.value),
                onKeyDown: (R) => {
                  R.key === "Enter" ? (R.preventDefault(), v || O()) : R.key === "Escape" && (R.preventDefault(), k());
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
                onClick: () => f((R) => !R),
                children: [
                  /* @__PURE__ */ p(Fa, { size: 13, "aria-hidden": !0 }),
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
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((R) => /* @__PURE__ */ p("li", { children: R }, R)) }) : null,
          d && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((R, P) => {
            const T = R.text === y.current, A = [Jl(R.ts), R.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ _("li", { "data-block-edit-history": R.label, "data-current": T ? "true" : void 0, children: [
              /* @__PURE__ */ _("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ _("span", { children: [
                  A,
                  T ? "（现在用的）" : "",
                  R.reason ? ` · ${R.reason}` : ""
                ] }),
                T ? null : /* @__PURE__ */ p(
                  ee,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!S,
                    onClick: () => {
                      O(R.text, `回到「${A.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: R.text })
            ] }, `${R.ts}:${P}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const Ko = _n(null), Vo = _n(null);
function Gc({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(Ko.Provider, { value: e, children: /* @__PURE__ */ p(Vo.Provider, { value: t, children: n }) });
}
function Je() {
  return Ln(Ko);
}
function Jo() {
  return Ln(Vo);
}
const Xe = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Zc = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Yc = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Xc = {
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
function Qc(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Nr(o ?? a ?? "", Zc)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Nr(o ?? a ?? "", Yc)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Xc[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function ed(e) {
  return Xe(e.translatedBlockText) || Xe(e.translated.text) || Xe(e.source.text);
}
const td = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function nd(e) {
  const t = [];
  for (const n of e) {
    if (!td(n)) continue;
    const r = Qc(ed(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function rd(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const od = 24, ad = 60;
function Mr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - od), o = Math.min(e.length, n + t.length + ad), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function sd(e, t, n = 200) {
  const r = Xe(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = Xe(a.translatedBlockText) || Xe(a.translated.text), l = i ? Mr(i, r) : null, c = l ?? Mr(Xe(a.source.text), r);
    if (c && (o.push({ itemId: a.itemId, page: s, side: l ? "translated" : "source", ...c }), o.length >= n))
      break;
  }
  return o;
}
function Bt(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function id(e, t) {
  const n = Xe(t).toLowerCase();
  if (!n || !e) return Bt(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${Bt(e.slice(a, s))}<mark class="reader-find-mark">${Bt(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + Bt(e.slice(a));
}
function ld(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const qo = 1.414;
function cd({
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
  const v = Je(), b = v == null ? void 0 : v.revisedBlocks, E = v == null ? void 0 : v.blockEdit, I = E == null ? void 0 : E.pendingEdits, k = v == null ? void 0 : v.editBlock, O = (v == null ? void 0 : v.findTerm) || "", $ = J(
    () => O ? ({ str: B }) => id(B, O) : void 0,
    [O]
  ), F = M(l ?? qo), [R, P] = N(F.current);
  D(() => {
    l != null && Math.abs(l - F.current) >= 1e-3 && (F.current = l, P(l));
  }, [l]);
  const T = M(d);
  T.current = d;
  const A = M(null), L = M((B) => {
    var oe;
    A.current = B, (oe = T.current) == null || oe.call(T, B);
  }).current, j = M(null), z = M(`${t}@${n}`);
  Ee(() => {
    const B = `${t}@${n}`;
    z.current !== B && (z.current = B, o && ud(A.current, j.current));
  }, [o, n, t]), D(() => {
    o || dn(j.current);
  }, [o]), D(() => () => dn(j.current), []);
  const U = Math.max(120, Math.floor(t * R)), Q = Math.max(U, Math.ceil(s || 0)), se = Cn(f, t, U), X = J(
    () => ac(u, t, U),
    [U, u, t]
  ), [fe, me] = N(null), he = typeof g == "function", De = he ? m ?? null : fe, q = (B) => {
    he ? B !== (m ?? null) && (g == null || g(B)) : me((oe) => oe === B ? oe : B);
  }, Y = J(
    () => X.find((B) => B.itemId === De) || null,
    [De, X]
  ), we = r === "translated" && ((ge = E == null ? void 0 : E.target) == null ? void 0 : ge.itemId) || "", te = J(
    () => we && X.find((B) => B.itemId === we) || null,
    [we, X]
  ), pe = $c(A, o ? Y : null, X, t), qe = (B) => {
    var Re, Se, Ce, xe, Be;
    if (B.pointerType === "touch") return;
    if ((Re = v == null ? void 0 : v.ink) != null && Re.tool) {
      q(null);
      return;
    }
    if (B.buttons !== 0) {
      q(null);
      return;
    }
    if ((Ce = (Se = B.target) == null ? void 0 : Se.closest) != null && Ce.call(Se, `.${$o}`) || (Be = (xe = B.target) == null ? void 0 : xe.closest) != null && Be.call(xe, `.${Wo}`)) return;
    const oe = B.currentTarget.getBoundingClientRect(), G = B.clientX - oe.left, ue = B.clientY - oe.top;
    if (xc(pe, G, ue)) return;
    const ce = Er(X, G, ue);
    q((ce == null ? void 0 : ce.itemId) || null);
  }, ke = (B) => {
    if (B.pointerType === "mouse") return;
    const oe = B.currentTarget.getBoundingClientRect(), G = Er(
      X,
      B.clientX - oe.left,
      B.clientY - oe.top
    );
    q((G == null ? void 0 : G.itemId) || null);
  }, Ie = (B) => {
    !Number.isFinite(B) || B <= 0 || Math.abs(F.current - B) < 1e-3 || (F.current = B, P(B), c == null || c(e, B));
  };
  return /* @__PURE__ */ _(
    "div",
    {
      ref: L,
      [Pe]: e,
      [_e]: r,
      [On]: U,
      className: zn,
      onPointerMoveCapture: qe,
      onPointerDown: ke,
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
          as,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: $,
            renderAnnotationLayer: !1,
            className: wo,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: Jt,
                style: { width: t, height: U }
              }
            ),
            onLoadSuccess: (B) => {
              try {
                const oe = B.getViewport({ scale: 1 });
                if (oe.width > 0) {
                  const G = oe.height / oe.width;
                  Ie(G);
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
            style: { width: t, height: U },
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
          Pc,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: U
          }
        ) : null,
        o && w && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (I != null && I.size) ? /* @__PURE__ */ p(Nc, { targets: X, edits: I, width: t, excludeId: te == null ? void 0 : te.itemId }) : null,
        o && te && E ? /* @__PURE__ */ p(
          qc,
          {
            target: te,
            page: { width: t, height: U },
            edit: E,
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
          Kc,
          {
            page: e,
            pane: r === "translated" ? "translated" : v.compareVersion ? "compare" : "source",
            width: t,
            height: U,
            ink: v.ink
          }
        ) : null,
        /* @__PURE__ */ p(
          pc,
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
const dd = en(cd);
function ud(e, t) {
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
const fd = 2 * 1024 * 1024;
function md(e) {
  const t = new po.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const un = 5, hd = "120% 0px", pd = 120, gd = "25% 0px";
let Ar = 1;
const _r = /* @__PURE__ */ new WeakMap();
function bd(e) {
  if (!e) return 0;
  const t = _r.get(e);
  if (t) return t;
  const n = Ar;
  return Ar += 1, _r.set(e, n), n;
}
function yd() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const vd = oo(
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
    liveTranslationPendingLabel: E = "",
    paneAction: I
  }, k) {
    jl();
    const { file: O, loading: $, error: F } = Ws(n, r), R = `${n}\0${bd(O)}`, P = M(R);
    P.current = R;
    const T = J(() => {
      const C = $s(O);
      return C ? "ranged" in C ? { range: md(C.ranged) } : C : null;
    }, [O, n]), [A, L] = N(0), [j, z] = N(""), [U, Q] = N(null), [se, X] = N(480), fe = M(null), me = M(0), he = J(() => yd(), []), De = J(() => ({
      cMapUrl: Mt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Mt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: fd,
      disableAutoFetch: !0
    }), []);
    Dn(k, () => U, [U]), D(() => {
      const C = (W) => {
        me.current = W, X(W);
      }, V = (W) => {
        const ie = mi(W, me.current);
        if (ie !== "ignore") {
          if (fe.current && clearTimeout(fe.current), ie === "immediate") {
            C(W);
            return;
          }
          fe.current = setTimeout(() => C(W), To);
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
      () => di(se, o),
      [se, o]
    ), [Y, we] = N(() => /* @__PURE__ */ new Map()), [te, pe] = N(() => /* @__PURE__ */ new Set()), [qe, ke] = N(() => /* @__PURE__ */ new Set()), Ie = M(/* @__PURE__ */ new Map()), ge = M(null), ne = M(null), [B, oe] = N(() => /* @__PURE__ */ new Set()), G = M(/* @__PURE__ */ new Map()), ue = x((C, V) => {
      we((K) => {
        if (K.get(C) === V) return K;
        const Z = new Map(K);
        return Z.set(C, V), Z;
      });
    }, []), ce = x((C, V) => {
      const K = Ie.current, Z = K.get(C), le = [ge.current, ne.current];
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
    }, []), Re = M(/* @__PURE__ */ new Map()), Se = x((C) => {
      const V = Re.current;
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
            ke((W) => {
              let ie = null;
              for (const be of Z)
                W.has(be) || (ie = ie || new Set(W), ie.add(be));
              return ie || W;
            });
          }
          for (const W of le)
            C.has(W) || C.set(W, setTimeout(() => {
              C.delete(W), ke((ie) => {
                if (!ie.has(W)) return ie;
                const be = new Set(ie);
                return be.delete(W), be;
              });
            }, pd));
        },
        { root: i, rootMargin: hd, threshold: 0 }
      );
      ge.current = V;
      for (const K of Ie.current.values())
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
        { root: i, rootMargin: gd, threshold: 0 }
      );
      ne.current = C;
      for (const V of Ie.current.values())
        try {
          C.observe(V);
        } catch {
        }
      return () => {
        C.disconnect(), ne.current === C && (ne.current = null);
      };
    }, [i]);
    const Ce = !!i && typeof IntersectionObserver < "u";
    Ee(() => {
      L(0), z(""), pe(/* @__PURE__ */ new Set()), ke(/* @__PURE__ */ new Set()), we(/* @__PURE__ */ new Map()), Ie.current.clear();
      const C = G.current;
      for (const V of C.values()) clearTimeout(V);
      C.clear(), m == null || m(0, t);
    }, [R, m, t]);
    const xe = x(
      ({ numPages: C }) => {
        P.current === R && (L(C), z(""), m == null || m(C, t), f == null || f({ numPages: C, pane: t }));
      },
      [R, f, m, t]
    ), Be = x(
      (C) => {
        if (P.current !== R) return;
        const V = (C == null ? void 0 : C.message) || "PDF 解析失败";
        z(V), L(0), m == null || m(0, t), u == null || u(C, t);
      },
      [R, u, m, t]
    ), H = J(
      () => A > 0 ? Array.from({ length: A }, (C, V) => V + 1) : [],
      [A]
    );
    D(() => {
      typeof IntersectionObserver < "u" || ke(new Set(H));
    }, [H]);
    const re = J(
      () => sr(g, y, t),
      [g, y, t]
    ), Ne = J(() => {
      const C = /* @__PURE__ */ new Map();
      for (const V of h) {
        const K = sr(V, y, t);
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
    }, [w, Ne]), Me = J(() => {
      if (A === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(H);
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
    }, [A, H, i, a, te]), Oe = !n || !!F || !!j, zt = n && (F || j) || s;
    return /* @__PURE__ */ _(
      "section",
      {
        ref: Q,
        className: `reader-panel ${oi}${a ? "" : " is-hidden"}`,
        [_e]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (v == null ? void 0 : v.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          I ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: I }) : null,
          E ? /* @__PURE__ */ _("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: E })
          ] }) : null,
          Oe && !$ ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: zt }) : null,
          $ ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          T && !F ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            ss,
            {
              file: T,
              loading: null,
              error: null,
              options: De,
              onLoadSuccess: xe,
              onLoadError: Be,
              className: "reader-react-pdf-document",
              children: H.map((C) => {
                if (Me.has(C))
                  return /* @__PURE__ */ p(
                    dd,
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
                      sentinelRef: Se(C),
                      regionHighlight: (re == null ? void 0 : re.box.page) === C ? re : null,
                      regionTargets: Ne.get(C),
                      hoveredRegionId: w && Ge.has(C) ? w : null,
                      onHoverRegion: S,
                      liveTranslationLayout: v == null ? void 0 : v.layoutByPage.get(C - 1),
                      liveTranslationPage: v == null ? void 0 : v.pagesByPage.get(C - 1),
                      showLiveTranslation: b,
                      liveTranslationMissing: pl(v, C - 1)
                    },
                    `${t}-${C}`
                  );
                const K = Y.get(C) ?? qo, Z = Math.max(120, Math.floor(q * K)), le = Math.max(Z, Math.ceil((c == null ? void 0 : c.get(C)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: Se(C),
                    [Pe]: C,
                    [_e]: t,
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
            R
          ) }) : null
        ]
      }
    );
  }
), Lr = en(vd), wd = 2e3, Sd = 6, Ed = 500, Dr = "reader-react-resizing";
function Id(e, t) {
  const n = M(null), r = M(null);
  Ee(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const b = Rd(e), E = Ut(e, b);
      if (!E) return;
      s = { pane: b, progress: E, started: performance.now() };
    }
    const { pane: i, progress: l, started: c } = s;
    let d = 0, f = null, u = e.scrollHeight, m = u, g = 0, h = c;
    const y = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((b) => {
      let E = !1;
      for (const I of b) {
        const k = Math.round(I.contentRect.height);
        y.has(I.target) && y.get(I.target) !== k && (E = !0), y.set(I.target, k);
      }
      E && _t(e, l, "auto", i);
    }), S = () => {
      var b;
      f && clearTimeout(f), cancelAnimationFrame(d), w == null || w.disconnect(), e.classList.remove(Dr);
      for (const E of Cr) e.removeEventListener(E, S);
      ((b = r.current) == null ? void 0 : b.stop) === S && (r.current = null);
    }, v = () => {
      _t(e, l, "auto", i);
      const b = e.scrollHeight;
      g = b === m ? g + 1 : 0, m = b;
      const E = performance.now() - h;
      g >= Sd && (b !== u || E > Ed) || E > wd ? S() : d = requestAnimationFrame(v);
    };
    for (const b of Cr) e.addEventListener(b, S, { passive: !0 });
    for (const b of Array.from(e.children)) w == null || w.observe(b);
    e.classList.add(Dr), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, h = performance.now(), u = e.scrollHeight, m = u, g = 0, d = requestAnimationFrame(v);
    }, To);
  }, [e, t]), D(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Rd(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Pe}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(_e) || null;
  }
  return null;
}
const Cr = ["wheel", "touchstart", "keydown", "pointerdown"];
function Go(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Td(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Pd({ compare: e, onDone: t }) {
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: Go(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(lo, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Ba, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
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
            /* @__PURE__ */ p(ja, { size: 13, "aria-hidden": !0 }),
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
            /* @__PURE__ */ p(Ha, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function xr({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Td(t), a = [e === "compare" ? "对比" : "正在读", r, Go(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ _("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function kd({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = N({ source: null, translated: null });
  return Ee(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), l = (c) => {
        const d = e.querySelector(`[${_e}="${c}"]`), f = d == null ? void 0 : d.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: l("source"), translated: l("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${_e}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ _("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(xr, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(xr, { role: "reading", ...n }) }) : null
  ] });
}
const Nd = () => () => {
}, Or = () => null;
function Md({
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
function Ad(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function _d(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Ld(e) {
  const t = Je(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", l = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, c = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), d = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), u = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Ot, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, v = (t == null ? void 0 : t.compareVersion) ?? null, b = (v == null ? void 0 : v.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", E = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", I = v ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, k = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, O = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), $ = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), F = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), R = e.regions ?? (t == null ? void 0 : t.regions) ?? [], P = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), T = (t == null ? void 0 : t.regionHover) ?? null, [A, L] = N(null), j = ao(
    T ? T.subscribe : Nd,
    T ? () => T.get().itemId : Or,
    T ? () => T.get().itemId : Or
  ), z = T ? j : A, U = x((fe) => {
    T ? T.set(fe, "pdf") : L(fe);
  }, [T]), Q = Md({
    mode: s,
    compareMode: i,
    showSource: l,
    showTranslated: c,
    markdownSplit: n,
    overlayOnSource: d
  }), X = Number.isFinite(g) && g > 0 ? Ad(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return Id(u, X), /* @__PURE__ */ _(
    "div",
    {
      ref: f,
      className: vo,
      "data-reader-region-count": R.length,
      "data-reader-structured-region-count": R.filter(La).length,
      "data-reader-metadata-ready": P ? "true" : "false",
      children: [
        /* @__PURE__ */ _(
          "main",
          {
            className: `${yo} reader-mode-${Q.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                Lr,
                {
                  pane: "source",
                  url: b,
                  preloadedFile: I,
                  userZoom: m,
                  visible: Q.showSource,
                  scrollRoot: u,
                  pageWidthOverride: X,
                  rowHeights: Q.compareMode ? h : void 0,
                  onMetrics: O,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: $,
                  activeRegion: F,
                  regions: (v == null ? void 0 : v.regions) ?? R,
                  readerMetadata: P,
                  hoveredRegionId: z,
                  onHoverRegion: U,
                  liveTranslation: d ? o : void 0,
                  showLiveTranslation: d,
                  liveTranslationPendingLabel: d ? _d(o) : "",
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
                Lr,
                {
                  pane: "translated",
                  url: E,
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
                  regions: R,
                  readerMetadata: P,
                  hoveredRegionId: z,
                  onHoverRegion: U,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        v ? /* @__PURE__ */ p(kd, { shellEl: u, left: v.left, right: v.right }) : null
      ]
    }
  );
}
const Dd = [
  { id: "source", label: "原文", Icon: uo },
  { id: "compare", label: "对照", Icon: fo },
  { id: "translated", label: "译文", Icon: mo }
];
function Cd(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function xd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Od(e) {
  const t = Je(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, l = a ? Cd(a.state) : "";
  return /* @__PURE__ */ _("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ _("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Dd.map(({ id: c, label: d, Icon: f }) => {
        const u = n === c, m = xd({
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
              /* @__PURE__ */ p(Ua, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
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
              /* @__PURE__ */ p(Wa, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
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
            /* @__PURE__ */ p(Ka, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const zd = oo(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
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
}), $d = zd, Fd = {
  markdown: { label: "Markdown", short: "MD", Icon: $d, needsJob: !0 }
}, Bd = Po.map(
  (e) => ({ id: e, ...Fd[e] })
);
function Zo() {
  return Bd.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function jd(e) {
  const t = Je(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(lt, { children: Zo().map(({ id: s, label: i, Icon: l, needsJob: c }) => {
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
function Hd(e) {
  const t = Je(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = Zo().map(({ id: l, label: c, short: d, Icon: f, needsJob: u }) => ({
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
function Ud(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Wd(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Kd(e) {
  return e / 100 * window.innerHeight;
}
function Vd(e) {
  return e / 100 * window.innerWidth;
}
function Jd(e) {
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
  const [o, a] = Jd(n);
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
      r = Wd(t, o);
      break;
    }
    case "em": {
      r = Ud(t, o);
      break;
    }
    case "vh": {
      r = Kd(o);
      break;
    }
    case "vw": {
      r = Vd(o);
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
    e === "horizontal" ? qd : Gd
  );
}
function qd(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Gd(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Yo(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Xo(e, t) {
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
function Zd({
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
    const { x: i, y: l } = Xo(r, s), c = e === "horizontal" ? i : l;
    c < a && (a = c, o = s);
  }
  return ae(o, "No rect found"), o;
}
let jt;
function Yd() {
  return jt === void 0 && (typeof matchMedia == "function" ? jt = !!matchMedia("(pointer:coarse)").matches : jt = !1), jt;
}
function Qo(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = kn(
    n,
    Array.from(t.children).filter(Yo).map((g) => ({ element: g }))
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
              ), E = n === "horizontal" ? new DOMRect(S.left, S.top, 0, S.height) : new DOMRect(S.left, S.top, S.width, 0);
              switch (m.length) {
                case 0: {
                  v = [
                    b,
                    E
                  ];
                  break;
                }
                case 1: {
                  const I = m[0], k = Zd({
                    orientation: n,
                    rects: [w, S],
                    targetRect: I.element.getBoundingClientRect()
                  });
                  v = [
                    I,
                    k === w ? E : b
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
              let E = "width" in b ? b : b.element.getBoundingClientRect();
              const I = Yd() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (E.width < I) {
                const O = I - E.width;
                E = new DOMRect(
                  E.x - O / 2,
                  E.y,
                  E.width + O,
                  E.height
                );
              }
              if (E.height < I) {
                const O = I - E.height;
                E = new DOMRect(
                  E.x,
                  E.y - O / 2,
                  E.width,
                  E.height + O
                );
              }
              const k = g <= c || g > d;
              !i && !k && s.push({
                group: e,
                groupSize: bt({ group: e }),
                panels: [u, y],
                separator: "width" in b ? void 0 : b,
                rect: E
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
class ea {
  constructor() {
    rr(this, Ye, {});
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
    or(this, Ye, {});
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
const jn = new ea();
function at() {
  return pt;
}
function Xd(e) {
  return jn.addListener("change", e);
}
function Qd(e) {
  const t = pt, n = { ...pt };
  n.cursorFlags = e, pt = n, jn.emit("change", {
    prev: t,
    next: n
  });
}
function gt(e) {
  const t = pt;
  pt = e, jn.emit("change", {
    prev: t,
    next: e
  });
}
const eu = (e) => e, fn = () => {
}, ta = 1, na = 2, ra = 4, oa = 8, zr = 3, $r = 12;
let Ht;
function Fr() {
  return Ht === void 0 && (Ht = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (Ht = !0)), Ht;
}
function tu({
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
        if (e && Fr()) {
          const a = (e & ta) !== 0, s = (e & na) !== 0, i = (e & ra) !== 0, l = (e & oa) !== 0;
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
    return Fr() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Br = /* @__PURE__ */ new WeakMap();
function Hn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Br.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = at();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = tu({
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
  Br.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let $e = /* @__PURE__ */ new Map();
const aa = new ea();
function nu(e) {
  $e = new Map($e), $e.delete(e);
}
function jr(e, t) {
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
function Un(e, t) {
  return aa.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ve(e, t, n) {
  const r = $e.get(e);
  $e = new Map($e), $e.set(e, t), aa.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function sa(e) {
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
function Hr(e) {
  e.defaultPrevented || sa(e.currentTarget);
}
function ru(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Xo(n, a.rect);
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
function ou(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function au(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Kr(e),
    b: Kr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  ae(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: Wr(Ur(n.a)),
    b: Wr(Ur(n.b))
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
const su = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function iu(e) {
  const t = getComputedStyle(ia(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function lu(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || iu(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || su.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Ur(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (ae(n, "Missing node"), lu(n)) return n;
  }
  return null;
}
function Wr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Kr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = ia(e);
  return t;
}
function ia(e) {
  const { parentNode: t } = e;
  return ou(t) ? t.host : t;
}
function cu(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function du({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Yo(n) || n.contains(e) || e.contains(n))
    return !0;
  if (au(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (cu(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function Wn(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Qo(o), s = ru(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && du({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function uu(e, t) {
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
            const E = v - b;
            ze(E, Math.abs(e)) > 0 && (e = e < 0 ? 0 - E : E);
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
            const E = b - w;
            ze(E, Math.abs(e)) > 0 && (e = e < 0 ? 0 - E : E);
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
          const E = b - v, I = E / 2, k = w + e;
          ze(k, b) < 0 && (e = ze(e, I) <= 0 ? 0 : E);
        } else {
          const E = b - v, I = 100 - E / 2, k = w - e;
          ze(k, b) < 0 && (e = ze(100 + e, I) > 0 ? 0 : -E);
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
  if (uu(l, c))
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
        const E = c[b];
        ae(
          E != null,
          `Previous layout not found for panel index ${b}`
        );
        const I = E + v, k = ht({
          overrideDisabledPanels: s,
          panelConstraints: n[b],
          prevSize: E,
          size: I
        });
        if (ye(E, k) || (v -= k - E, c[b] = k), ye(v, 0))
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
function la({
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
function Vr(e) {
  if (e.defaultPrevented)
    return;
  const t = ct();
  Wn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = la({
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
function ca({
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
  const s = a.map((d) => n.panels.indexOf(d)), i = ca({ groupId: n.id }).getLayout(), l = Lt({
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
function Jr(e) {
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
function qr(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = ct(), n = Wn(e, t), r = /* @__PURE__ */ new Map();
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
function da({
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
      layout: E,
      separatorToPanels: I
    } = w;
    if (v && E && I) {
      const k = Lt({
        delta: h,
        initialLayout: y,
        panelConstraints: v,
        pivotIndices: c.panels.map((O) => m.indexOf(O)),
        prevLayout: E,
        trigger: "mouse-or-touch"
      });
      if (st(k, E)) {
        if (h !== 0 && !g)
          switch (u) {
            case "horizontal": {
              i |= h < 0 ? ta : na;
              break;
            }
            case "vertical": {
              i |= h < 0 ? ra : oa;
              break;
            }
          }
      } else
        Ve(c.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: v,
          groupSize: b,
          layout: k,
          separatorToPanels: I
        });
    }
  });
  let l = 0;
  t.movementX === 0 ? l |= s & zr : l |= i & zr, t.movementY === 0 ? l |= s & $r : l |= i & $r, Qd(l), Hn(e);
}
function Gr(e) {
  const t = ct(), n = at();
  switch (n.state) {
    case "active":
      da({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Zr(e) {
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
      da({
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
      const a = Wn(e, n);
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
function Yr(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (at().state) {
      case "hover":
        gt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Xr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || sa(e.currentTarget) && e.preventDefault();
}
function Qr(e) {
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
function fu(e, t, n) {
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
function mu(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function hu({
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
function pu(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const ut = /* @__PURE__ */ new Map();
function gu(e) {
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
          const b = Pn(e), E = v.defaultLayoutDeferred ? Qr(b) : v.layout, I = hu({
            group: e,
            nextGroupSize: S,
            prevGroupSize: v.groupSize,
            prevLayout: E
          }), k = it({
            layout: I,
            panelConstraints: b
          });
          if (!v.defaultLayoutDeferred && st(v.layout, k) && mu(
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
        fu(e, w, y);
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
  c && (pu(e.panels, c) || (c = void 0));
  const d = e.mutableState.layouts[l] ?? c ?? Qr(i), f = it({
    layout: d,
    panelConstraints: i
  }), u = e.element.ownerDocument;
  ut.set(
    u,
    (ut.get(u) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Qo(e).forEach((g) => {
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
    ), o.add(g.id), g.element.addEventListener("keydown", Jr);
  }), ut.get(u) === 1 && (u.addEventListener("contextmenu", Hr, !0), u.addEventListener("dblclick", Vr, !0), u.addEventListener("pointerdown", qr, !0), u.addEventListener("pointerleave", Gr), u.addEventListener("pointermove", Zr), u.addEventListener("pointerout", Yr), u.addEventListener("pointerup", Xr, !0)), function() {
    t = !1, ut.set(
      u,
      Math.max(0, (ut.get(u) ?? 0) - 1)
    ), nu(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Jr);
    }), ut.get(u) || (u.removeEventListener(
      "contextmenu",
      Hr,
      !0
    ), u.removeEventListener(
      "dblclick",
      Vr,
      !0
    ), u.removeEventListener(
      "pointerdown",
      qr,
      !0
    ), u.removeEventListener("pointerleave", Gr), u.removeEventListener("pointermove", Zr), u.removeEventListener("pointerout", Yr), u.removeEventListener("pointerup", Xr, !0)), a.disconnect();
  };
}
function bu() {
  const [e, t] = N({}), n = x(() => t({}), []);
  return [e, n];
}
function Kn(e) {
  const t = so();
  return `${e ?? t}`;
}
const dt = typeof window < "u" ? Ee : D;
function kt(e) {
  const t = M(e);
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
function Vn(...e) {
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
function Jn(e) {
  const t = M({ ...e });
  return dt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const ua = _n(null);
function yu(e, t) {
  const n = M({
    getLayout: () => ({}),
    setLayout: eu
  });
  Dn(t, () => n.current, []), dt(() => {
    Object.assign(
      n.current,
      ca({ groupId: e })
    );
  });
}
function fa({
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
  const g = M({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = kt((R) => {
    st(g.current.onLayoutChange, R) || (g.current.onLayoutChange = R, l == null || l(R));
  }), y = kt(
    (R, P) => {
      st(g.current.onLayoutChanged, R) || (g.current.onLayoutChanged = R, c == null || c(R, { isUserInteraction: P }));
    }
  ), w = Kn(i), S = M(null), [v, b] = bu(), E = M({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), I = Vn(S, a);
  yu(w, s);
  const k = kt(
    (R, P) => {
      const T = at(), A = jr(R), L = Qe(R);
      if (L) {
        let j = !1;
        switch (T.state) {
          case "active": {
            j = T.hitRegions.some(
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
  ), O = Jn({
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
      registerPanel: (R) => {
        const P = E.current;
        return P.panels = kn(d, [
          ...P.panels,
          R
        ]), b(), () => {
          P.panels = P.panels.filter(
            (T) => T !== R
          ), b();
        };
      },
      registerSeparator: (R) => {
        const P = E.current;
        return P.separators = kn(d, [
          ...P.separators,
          R
        ]), b(), () => {
          P.separators = P.separators.filter(
            (T) => T !== R
          ), b();
        };
      },
      updatePanelProps: (R, { disabled: P }) => {
        const T = E.current.panels.find(
          (j) => j.id === R
        );
        T && (T.panelConstraints.disabled = P);
        const A = jr(w), L = Qe(w);
        A && L && Ve(A, {
          ...L,
          derivedPanelConstraints: Pn(A)
        });
      },
      updateSeparatorProps: (R, {
        disabled: P,
        disableDoubleClick: T
      }) => {
        const A = E.current.separators.find(
          (L) => L.id === R
        );
        A && (A.disabled = P, A.disableDoubleClick = T);
      }
    }),
    [k, w, b, d, O]
  ), F = M(null);
  return dt(() => {
    const R = S.current;
    if (R === null)
      return;
    const P = E.current;
    let T;
    if (O.defaultLayout !== void 0 && Object.keys(O.defaultLayout).length === P.panels.length) {
      T = {};
      for (const se of P.panels) {
        const X = O.defaultLayout[se.id];
        X !== void 0 && (T[se.id] = X);
      }
    }
    const A = {
      disabled: !!o,
      element: R,
      id: w,
      mutableState: {
        defaultLayout: T,
        disableCursor: !!O.disableCursor,
        expandedPanelSizes: E.current.lastExpandedPanelSizes,
        layouts: E.current.layouts
      },
      orientation: d,
      panels: P.panels,
      resizeTargetMinimumSize: P.resizeTargetMinimumSize,
      separators: P.separators
    };
    F.current = A;
    const L = gu(A), { defaultLayoutDeferred: j, derivedPanelConstraints: z, layout: U } = Qe(A.id, !0);
    !j && z.length > 0 && (h(U), y(U, !1));
    const Q = Un(w, (se) => {
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
    const R = F.current;
    R && (R.mutableState.defaultLayout = n, R.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(ua.Provider, { value: $, children: /* @__PURE__ */ p(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": w,
      id: w,
      ref: I,
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
fa.displayName = "Group";
function qn() {
  const e = Ln(ua);
  return ae(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function vu(e, t) {
  const { id: n } = qn(), r = M({
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
      la({ groupId: n, panelId: e })
    );
  });
}
function Nn({
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
  const h = !!l, y = Kn(l), w = Jn({
    disabled: a
  }), S = M(null), v = Vn(S, s), {
    getPanelStyles: b,
    id: E,
    orientation: I,
    registerPanel: k,
    updatePanelProps: O
  } = qn(), $ = f !== null, F = kt(
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
  }, [a, y, O]), vu(y, u);
  const R = () => {
    const A = b(E, y);
    if (A)
      return JSON.stringify(A);
  }, P = ao(
    (A) => Un(E, A),
    R,
    R
  );
  let T;
  return P ? T = JSON.parse(P) : o !== void 0 ? T = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : T = { flexGrow: 1 }, /* @__PURE__ */ p(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": y,
      id: y,
      ref: v,
      style: {
        ...wu,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...T
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
            touchAction: I === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
Nn.displayName = "Panel";
const wu = {
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
function Su({
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
function ma({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const l = Kn(a), c = Jn({
    disabled: n,
    disableDoubleClick: r
  }), [d, f] = N({}), [u, m] = N("inactive"), [g, h] = N(!1), y = M(null), w = Vn(y, o), {
    disableCursor: S,
    id: v,
    orientation: b,
    registerSeparator: E,
    updateSeparatorProps: I
  } = qn(), k = b === "horizontal" ? "vertical" : "horizontal";
  dt(() => {
    const F = y.current;
    if (F !== null) {
      const R = {
        disabled: c.disabled,
        disableDoubleClick: c.disableDoubleClick,
        element: F,
        id: l
      }, P = E(R), T = Xd(
        (L) => {
          m(
            L.next.state !== "inactive" && L.next.hitRegions.some(
              (j) => j.separator === R
            ) ? L.next.state : "inactive"
          );
        }
      ), A = Un(
        v,
        (L) => {
          const { derivedPanelConstraints: j, layout: z, separatorToPanels: U } = L.next, Q = U.get(R);
          if (Q) {
            const se = Q[0], X = Q.indexOf(se);
            f(
              Su({
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
        T(), A(), P();
      };
    }
  }, [v, l, E, c]), D(() => {
    I(l, { disabled: n, disableDoubleClick: r });
  }, [n, r, l, I]);
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
ma.displayName = "Separator";
const Gn = 30, Zn = 65, Dt = 50, Eu = 100 - Zn, Iu = 100 - Gn;
function Ru(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Zn, Math.max(Gn, t)) : Dt;
}
function Yn(e) {
  return 100 - e;
}
function ft(e) {
  return `${e}%`;
}
const Xn = "reader-document", Ct = "reader-assistant", ha = "retainpdf.reader.ai-split-layout.v1", Tu = {
  [Xn]: Yn(Dt),
  [Ct]: Dt
};
function Qn(e) {
  const t = Ru(e == null ? void 0 : e[Ct]);
  return {
    [Xn]: Yn(t),
    [Ct]: t
  };
}
function Pu() {
  try {
    const e = JSON.parse(localStorage.getItem(ha) || "null");
    return Qn(e);
  } catch {
    return Tu;
  }
}
function ku(e) {
  try {
    localStorage.setItem(ha, JSON.stringify(Qn(e)));
  } catch {
  }
}
function mn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Qn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Ct]}vw`
  );
}
function Nu() {
  const e = M(null), [t] = N(Pu);
  Ee(() => {
    const o = e.current;
    return mn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = x((o) => {
    mn(e.current, o);
  }, []), r = x((o, a) => {
    mn(e.current, o), a.isUserInteraction && ku(o);
  }, []);
  return /* @__PURE__ */ _(
    fa,
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
          Nn,
          {
            id: Xn,
            defaultSize: ft(Yn(Dt)),
            minSize: ft(Eu),
            maxSize: ft(Iu)
          }
        ),
        /* @__PURE__ */ p(
          ma,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          Nn,
          {
            id: Ct,
            defaultSize: ft(Dt),
            minSize: ft(Gn),
            maxSize: ft(Zn)
          }
        )
      ]
    }
  );
}
function Mu({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = N(!1);
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
function Au({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Mu, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ _(lt, { children: [
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
function _u(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Lu() {
  const [e, t] = N(!1), n = so(), r = M(null);
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
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || _u(a.target)) return;
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
        children: /* @__PURE__ */ p(Va, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: Nl.map((o) => /* @__PURE__ */ _("section", { className: "reader-react-shortcuts-group", children: [
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
const Du = ["source", "sideBySide", "translated"], Cu = { source: "", translated: "", sideBySide: "" };
function xu(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = Kt(e.sourceUrl), n = Kt(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return vs({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Ou(e) {
  const [t, n] = N(() => /* @__PURE__ */ new Set()), r = J(
    () => e ? xu(e) : Cu,
    [e]
  ), o = J(
    () => Du.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = x(async (s) => {
    if (!e) return;
    const i = Kt(r[s]);
    if (!(!i || t.has(s)))
      try {
        const l = e.jobId ? ys(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await ws(
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
        Ss(c), n((d) => {
          const f = new Set(d);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const zu = {
  source: uo,
  sideBySide: fo,
  translated: mo
}, $u = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Fu(e) {
  const t = Je(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Ou(n), i = M(null);
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
      /* @__PURE__ */ p(Ja, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(co, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((l) => {
      const c = Ra[l], d = Kt(r[l]), f = a.has(l), u = !!d && !f, m = u ? "" : Ta(l, r), g = zu[l];
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
                $u[l],
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
const Bu = "retainpdf:reader:bookmarks:v1:", ju = 200;
function er() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function pa(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Bu}${t}` : "";
}
function Hu(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Qt(e, t = er()) {
  const n = pa(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Hu(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Mn(e, t, n) {
  const r = pa(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, ju);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Uu(e, t, n = "", { storage: r = er(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Qt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Mn(e, a.filter((i) => i.page !== s), r) : Mn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Wu(e, t, n = er()) {
  return Mn(e, Qt(e, n).filter((r) => r.page !== t), n);
}
function Ku(e, t) {
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
function Vu({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function Ju({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = N(() => Qt(e)), [i, l] = N(!1), c = M(null);
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
        onClick: () => s(Uu(e, d, Ku(r, d))),
        children: /* @__PURE__ */ p(Vu, { filled: f })
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
          /* @__PURE__ */ p(qa, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
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
          onClick: () => s(Wu(e, u.page)),
          children: "×"
        }
      )
    ] }, u.page)) }) }) : null
  ] });
}
function qu(e) {
  const [t, n] = N([]);
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
function Gu(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Zu = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, Yu = ["failed", "content", "layout"];
function Xu(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Qu({ jobId: e, currentPage: t }) {
  var f;
  const n = qu(e), r = (f = Je()) == null ? void 0 : f.jumpToBlock, [o, a] = N(!1), [s, i] = N(-1), l = M(null);
  D(() => i(-1), [n]);
  const c = (u) => {
    const m = n[u];
    !m || !r || (i(u), r(m.readerItemId));
  }, d = M({ issues: n, last: s, currentPage: t, goTo: c });
  return d.current = { issues: n, last: s, currentPage: t, goTo: c }, D(() => {
    const u = (m) => {
      if (m.key.toLowerCase() !== "n" || m.metaKey || m.ctrlKey || m.altKey || Xu(m.target)) return;
      const { issues: g, last: h, currentPage: y, goTo: w } = d.current, S = Gu(g, h, y, m.shiftKey);
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
          /* @__PURE__ */ p(Ga, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ _("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      Yu.map((u) => {
        const m = n.map((g, h) => ({ issue: g, index: h })).filter(({ issue: g }) => g.kind === u);
        return m.length ? /* @__PURE__ */ _("section", { className: "reader-issues-group", "data-issue-kind": u, children: [
          /* @__PURE__ */ _("h4", { children: [
            Zu[u],
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
const ef = 48, tf = 96, nf = 700;
function rf(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= ef, downSoFar: r };
}
function of(e) {
  const [t, n] = N(!1), r = M(0);
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
      if (!(m instanceof Element) || (i.has(m) || i.set(m, !!m.querySelector(`[${Pe}]`)), !i.get(m))) return;
      const g = m.scrollTop, h = o.get(m);
      if (o.set(m, g), h === void 0 || Date.now() - a > nf) return;
      const y = rf(!1, r.current, g - h);
      r.current = y.downSoFar, g - h < -4 ? n(!1) : y.hidden && !l() && n(!0);
    }, d = (u) => {
      u.clientY >= window.innerHeight - tf && (r.current = 0, n(!1));
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
function af(e) {
  const t = Je(), n = Jo(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Ot, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, l = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, c = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), d = ci(a), f = a > So + 1e-3, u = a < Yt - 1e-3, m = mt(r, rt()), g = m >= Yt ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = M(null), y = of(h), [w, S] = N(!1), [v, b] = N(`${i}`);
  D(() => {
    w || b(`${Math.min(Math.max(i, 1), Math.max(l, 1))}`);
  }, [i, l, w]);
  const E = () => {
    if (S(!1), !c || l <= 0)
      return;
    const I = Number(`${v}`.trim());
    c(Xt(I, l));
  };
  return /* @__PURE__ */ _("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": y ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: w ? /* @__PURE__ */ _(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (I) => {
          I.preventDefault(), E();
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
              onChange: (I) => b(I.target.value.replace(/[^\d]/g, "")),
              onBlur: E,
              onKeyDown: (I) => {
                I.key === "Escape" && (I.preventDefault(), S(!1), b(`${i}`));
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
      Ju,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: l,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: c
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(Qu, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
      ee,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ p(sf, {})
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
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Lu, {}) })
  ] });
}
function sf() {
  return /* @__PURE__ */ _("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ p("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ p("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function eo(e) {
  var t, n;
  return ko(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function lf(e) {
  const [t, n] = N(() => ({
    scope: e,
    panel: eo(Fe(e))
  }));
  D(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: eo(Fe(e))
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
function cf({
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
function df(e = {}) {
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
    () => /* @__PURE__ */ p(cf, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: An, duration: 1 / 0 }
  );
}
function uf() {
  const e = x((t) => {
    t && (t.setState = df, t.hide = () => gn.dismiss(An));
  }, []);
  return /* @__PURE__ */ _(lt, { children: [
    /* @__PURE__ */ p(Oa, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function ff(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Io(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function mf(e, t) {
  return t === null || e !== t;
}
function hf(e) {
  const t = M(!1);
  return e && (t.current = !0), t.current;
}
function pf(e, t) {
  const n = e === t;
  return { open: n, mounted: hf(n) };
}
const to = { itemId: null, origin: null };
function gf() {
  let e = to;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? to : { itemId: n, origin: r };
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
const bf = [];
function yf({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ _("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ p(ee, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ p(Za, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function vf({ open: e, onToggle: t }) {
  return /* @__PURE__ */ p(
    ee,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ p(Ya, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function wf({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0
}) {
  var b, E;
  const l = ((b = Je()) == null ? void 0 : b.regions) ?? bf, c = ((E = Jo()) == null ? void 0 : E.currentPage) ?? 1, d = J(() => nd(l), [l]), f = rd(d, c), u = J(() => sd(l, s), [l, s]), [m, g] = N(-1);
  D(() => g(-1), [s]);
  const h = M(null), y = M(null), w = M(n);
  w.current = n, D(() => {
    const I = (O) => {
      var F, R;
      const $ = O.target;
      !$ || (F = y.current) != null && F.contains($) || (R = $.closest) != null && R.call($, ".reader-finder-toggles, [data-finder-toggle]") || w.current();
    }, k = (O) => {
      O.key === "Escape" && w.current();
    };
    return document.addEventListener("pointerdown", I, !0), document.addEventListener("keydown", k), () => {
      document.removeEventListener("pointerdown", I, !0), document.removeEventListener("keydown", k);
    };
  }, []);
  const S = M(null);
  D(() => {
    var I, k, O;
    e === "search" ? (I = h.current) == null || I.focus() : (O = (k = S.current) == null ? void 0 : k.querySelector('[aria-current="location"]')) == null || O.scrollIntoView({ block: "center" });
  }, [e, i]), D(() => {
    var I, k;
    e === "search" && m >= 0 && ((k = (I = S.current) == null ? void 0 : I.querySelector('[aria-current="true"]')) == null || k.scrollIntoView({ block: "nearest" }));
  }, [e, m]);
  const v = (I) => {
    const k = u[I];
    k && (g(I), r(k.itemId));
  };
  return /* @__PURE__ */ _("aside", { ref: y, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ _("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ _("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ p(ee, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(ee, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(ee, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(vt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: S, className: "reader-finder-list", children: d.map((I, k) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ _(
      ee,
      {
        className: "reader-finder-entry",
        "data-level": I.level,
        "aria-current": k === f ? "location" : void 0,
        onClick: () => r(I.itemId),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: I.text }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: I.page })
        ]
      }
    ) }, I.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: l.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ _(lt, { children: [
      /* @__PURE__ */ _("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          ho,
          {
            ref: h,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (I) => a(I.target.value),
            onKeyDown: (I) => {
              I.key === "Enter" ? (I.preventDefault(), v(ld(m, u.length, I.shiftKey))) : I.key === "Escape" && (I.preventDefault(), n()), I.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: u.length === 0 ? "没有找到" : `${m >= 0 ? `第 ${m + 1} / ` : ""}${u.length >= 200 ? "200+ 处，只列前 200 处" : `${u.length} 处`}${m < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: u.map((I, k) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ _(ee, { className: "reader-finder-entry is-hit", "aria-current": k === m ? "true" : void 0, onClick: () => v(k), children: [
        /* @__PURE__ */ _("span", { className: "reader-finder-entry-text", children: [
          I.snippet.slice(0, I.at),
          /* @__PURE__ */ p("mark", { children: I.snippet.slice(I.at, I.at + I.length) }),
          I.snippet.slice(I.at + I.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: I.page })
      ] }) }, I.itemId)) })
    ] })
  ] });
}
function Sf({ active: e, compare: t, ink: n }) {
  const [r, o] = N(!1), [a, s] = N(!1), i = M(null);
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
    a ? /* @__PURE__ */ p(Pd, { compare: t, onDone: () => {
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
      /* @__PURE__ */ p(jd, { active: e }),
      t.available ? /* @__PURE__ */ p(
        ee,
        {
          className: "reader-toolball-item",
          "aria-label": "对比版本",
          title: "对比版本：左边换成这本书的另一份译文",
          "aria-pressed": l || a,
          "data-toolball-item": "compare",
          onClick: () => s((c) => !c),
          children: /* @__PURE__ */ p(Xa, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
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
        children: r ? /* @__PURE__ */ p(vt, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p(Qa, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const Ef = [
  { tool: "pen", label: "画笔", Icon: xn },
  { tool: "highlighter", label: "荧光笔", Icon: es },
  { tool: "eraser", label: "橡皮", Icon: ts }
];
function ga(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function ba({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ _(lt, { children: [
    Ef.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
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
    Ho.map((o) => /* @__PURE__ */ p(
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
    /* @__PURE__ */ p(ee, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(ns, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      ee,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(rs, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
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
function If({ ink: e, menu: t, onClose: n }) {
  const r = M(null);
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
  return /* @__PURE__ */ p("div", { ref: r, className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", style: { left: a, top: s }, "data-ink-menu": "true", children: /* @__PURE__ */ p(ba, { ink: e, page: t.page, onPick: n }) });
}
function Rf({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(ba, { ink: e }) }) : null;
}
function Tf(e) {
  var r;
  if (e.shiftKey || ga(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${vo}`))) return null;
  const n = Number((r = t.closest(`[${Pe}]`)) == null ? void 0 : r.getAttribute(Pe)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Pf(e) {
  const t = M(e);
  t.current = e, D(() => {
    const n = (r) => {
      if (ga(r.target)) return;
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
function kf(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Nf(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function Mf(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Af({ documentId: e, jobId: t }) {
  const [n, r] = N([]), [o, a] = N(null), [s, i] = N(null), [l, c] = N(""), [d, f] = N(""), u = M(0);
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
      const b = tt(), E = await w.resolveJob(e, y);
      if (!E) throw new Error("这一份还没有能读的译文。");
      const I = await b.loadReaderPayload(E, { includeOptionalArtifacts: !0 }), k = b.resolveReaderTranslatedPdfUrl(I.jobPayload, I.manifestPayload);
      if (!k) throw new Error("这一份没有译文 PDF。");
      return { versionId: y, name: S.name, jobId: E, url: k, regions: kf(io(I.regionsPayload)) };
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
    w && ((v = globalThis.history) == null || v.replaceState(globalThis.history.state, "", Mf(w, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: Nf(n, t, o),
    compared: s,
    loading: l,
    error: d,
    choose: m,
    clear: g,
    adopt: h
  };
}
const _f = "reader-finder-input";
function Lf(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Df(e, t = typeof window > "u" ? null : window) {
  D(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!Lf(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(_f) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function Cf() {
  try {
    return tt().translationEdit ?? null;
  } catch {
    return null;
  }
}
const xf = "这本书正在处理（翻译或排版），处理完才能改。", Of = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function zf({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Cf(), s = `${e || ""}`.trim(), i = !!(a && s && r), l = Hl(s), c = !t || Nt(t), d = ql(n), [f, u] = N(""), [m, g] = N(null), [h, y] = N(() => /* @__PURE__ */ new Map()), [w, S] = N(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [v, b] = N(() => /* @__PURE__ */ new Map()), [E, I] = N({ phase: "idle" }), k = M({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  D(() => {
    g(null), k.drafts.clear(), k.generation.current = null, b(/* @__PURE__ */ new Map()), I({ phase: "idle" });
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
      L || y(Gl(j, d));
    }).catch(() => {
    }), () => {
      L = !0;
    };
  }, [a, f, d, c]);
  const O = E.phase === "running" && E.seenActive;
  D(() => {
    if (E.phase === "running") {
      if (!c) {
        O || I({ phase: "running", seenActive: !0 });
        return;
      }
      O && I(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [E.phase, O, c, t]);
  const $ = J(() => {
    const L = new Map(h);
    if (w.renderedAt === d)
      for (const [j, z] of w.edits) L.set(j, z);
    return L;
  }, [h, w, d]), F = x((L) => {
    const j = `${L || ""}`.trim();
    j && g({ itemId: j, page: Ul(j) });
  }, []), R = x(() => g(null), []), P = x((L, j) => {
    S((z) => {
      const U = new Map(z.renderedAt === d ? z.edits : []);
      return U.set(L, j), { renderedAt: d, edits: U };
    }), b((z) => new Map(z).set(L, (z.get(L) || 0) + 1));
  }, [d]), T = x(async () => {
    if (!(!a || !s || E.phase === "submitting" || E.phase === "running")) {
      I({ phase: "submitting" });
      try {
        await a.rerender(s), I({ phase: "running", seenActive: !1 }), await o();
      } catch (L) {
        I({ phase: "failed", message: (L == null ? void 0 : L.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, E.phase, o]), A = l ? Of : !c || E.phase === "running" || E.phase === "submitting" ? xf : "";
  return J(() => ({
    available: i,
    blockedReason: A,
    port: a,
    ownerJobId: f,
    target: m,
    select: F,
    close: R,
    memory: k,
    pendingEdits: $,
    savedCounts: v,
    markSaved: P,
    rerender: E,
    startRerender: T
  }), [i, A, a, f, m, F, R, k, $, v, P, E, T]);
}
function $f(e, t) {
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
function Ff({ edit: e }) {
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
const ya = "retainpdf:reader:doc-theme:v1", no = "data-reader-doc";
function va() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Bf(e = va()) {
  try {
    return (e == null ? void 0 : e.getItem(ya)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function jf(e, t = va()) {
  try {
    t == null || t.setItem(ya, e);
  } catch {
  }
}
function ro(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(no, "dark") : t.removeAttribute(no));
}
function Hf() {
  const [e, t] = N(() => Bf());
  D(() => {
    ro(e);
  }, [e]), D(() => () => ro("light"), []);
  const n = x(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return jf(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
const Uf = Sa(() => import("./ReaderMarkdownPanel-Dp_ME56g.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function Wf(e) {
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
function Kf(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Vf() {
  var Be;
  const e = Pl(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = lf(e.viewStateKey), s = a.panel, i = a.setPanel, [l, c] = N(!1), d = M(null), f = M(null), u = s !== null, m = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, g = Wf({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: m,
    liveTranslationVisible: l,
    assistantOpen: u
  }), h = ml({
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
  const S = M(null);
  D(() => {
    S.current !== e.viewStateKey && gl({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: y,
      jobTerminal: e.session.jobTerminal
    }) && (S.current = e.viewStateKey, c(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, y]), D(() => {
    if (!(t.loading || t.failed)) {
      if (d.current !== e.viewStateKey) {
        d.current = e.viewStateKey;
        const H = Fe(e.viewStateKey), re = ff({
          savedMode: H == null ? void 0 : H.mode,
          sourceViewOnly: y,
          viewportWidth: rt()
        });
        f.current = re.auto ? re.mode : null, re.mode && re.mode !== e.mode && e.setModeKeepingPage(re.mode);
        return;
      }
      mf(e.mode, f.current) && (f.current = null, tn(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, y]);
  const v = s || (e.mode === "compare" ? "compare" : "reading"), b = pf(s, "markdown"), { docDark: E, toggleDocDark: I } = Hf();
  Dl({
    toggleDocDark: I,
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
  }, []), O = hl(e.liveTranslation), $ = x(() => {
    O && e.goToPage(O, "source");
  }, [e.goToPage, O]), [F, R] = N(null);
  D(() => {
    w === "compare" && e.session.jobTerminal && R(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, w]);
  const P = F !== e.viewStateKey && bl({
    state: e.liveTranslation,
    sourceViewOnly: y,
    visibleMode: w
  }), T = x((H) => {
    const re = Kf(H, e.liveTranslationAvailable);
    re !== null && c(re), e.setModeKeepingPage(H);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), A = J(() => h.sourcePaneToggle ? /* @__PURE__ */ p(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${l ? " is-active" : ""}`,
      onClick: () => c((H) => !H),
      "aria-pressed": l,
      title: l ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [h.sourcePaneToggle, l]), L = x((H) => {
    i(H);
  }, []), [j] = N(gf), [z, U] = N(null), Q = x((H) => U((re) => re === H ? null : H), []), [se, X] = N(""), [fe, me] = N("");
  D(() => {
    const H = se.replace(/\s+/gu, " ").trim(), re = window.setTimeout(() => me(H), H ? 150 : 0);
    return () => window.clearTimeout(re);
  }, [se]);
  const [he, De] = N(0), q = x(() => {
    U("search"), De((H) => H + 1);
  }, []);
  Df(q);
  const Y = x((H) => {
    e.jumpToAnchor({ block_id: H }), (z === "outline" || rt() < 900) && U(null);
  }, [e.jumpToAnchor, z]), we = x((H) => e.jumpToAnchor({ block_id: H }), [e.jumpToAnchor]), te = zf({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), pe = te.select, qe = e.setModeKeepingPage, ke = o.regions, Ie = x((H) => {
    Ql(ke, H) && (w === "source" && qe("compare"), pe(H));
  }, [ke, pe, w, qe]);
  $f(te.available ? Ie : null, j);
  const ge = Hc(e.viewStateKey);
  Pf(ge);
  const [ne, B] = N(null), oe = x(() => B(null), []), G = Af({ documentId: o.documentId, jobId: o.jobId }), ue = ((Be = G.compared) == null ? void 0 : Be.url) || "";
  D(() => {
    ue && w !== "compare" && T("compare");
  }, [ue]), D(() => {
    w !== "compare" && G.clear();
  }, [w]);
  const ce = J(
    () => {
      const { compared: H, versions: re, readingVersionId: Ne } = G;
      if (!H) return null;
      const Ge = re.find((Oe) => Oe.versionId === H.versionId), Me = re.find((Oe) => Oe.versionId === Ne);
      return {
        url: H.url,
        regions: H.regions,
        left: { name: H.name, createdAt: (Ge == null ? void 0 : Ge.createdAt) || "" },
        right: { name: (Me == null ? void 0 : Me.name) || "当前译文", createdAt: (Me == null ? void 0 : Me.createdAt) || "" }
      };
    },
    [G.compared, G.versions, G.readingVersionId]
  ), Re = J(() => {
    if (!te.savedCounts.size) return e.revisedBlocks;
    const H = new Map(e.revisedBlocks);
    for (const [re, Ne] of te.savedCounts) H.set(re, (H.get(re) || 0) + Ne);
    return H;
  }, [e.revisedBlocks, te.savedCounts]), Se = J(() => ({
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
    revisedBlocks: Re,
    editBlock: te.available ? Ie : void 0,
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
    docDark: E,
    toggleDocDark: I
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
    Re,
    te,
    Ie,
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
    E,
    I
  ]), Ce = J(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), xe = [
    ri,
    `is-workspace-${v}`,
    u ? "is-assistant-open" : "",
    z ? "is-finder-open" : "",
    g.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(Gc, { value: Se, hud: Ce, children: /* @__PURE__ */ _(
    "div",
    {
      className: xe,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": v,
      "data-ink-mode": ge.tool || void 0,
      onContextMenu: (H) => {
        const re = Tf(H);
        re && (H.preventDefault(), B(re));
      },
      children: [
        /* @__PURE__ */ p(Au, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
        /* @__PURE__ */ p(yf, { open: z, onToggle: Q }),
        z ? /* @__PURE__ */ p(
          wf,
          {
            tab: z,
            onTab: U,
            onClose: () => U(null),
            onJump: Y,
            query: se,
            onQuery: X,
            term: fe,
            focusSignal: he
          }
        ) : null,
        /* @__PURE__ */ _("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(Fu, {}),
          /* @__PURE__ */ p(Bl, { onBeforeClose: o.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          Od,
          {
            mode: w,
            documentReady: !!o.jobId,
            sourceViewOnly: y,
            onModeChange: T,
            liveTranslation: h.topBarPill ? {
              visible: l,
              state: e.liveTranslation,
              onToggle: () => c((H) => !H),
              latestPage: l ? O : null,
              currentPage: e.currentPage,
              onJumpToLatest: $
            } : null,
            completion: P ? {
              onOpenCompare: () => {
                R(e.viewStateKey), T("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ p(Hd, { active: s }),
        u ? /* @__PURE__ */ p(Nu, {}) : null,
        /* @__PURE__ */ p(Ld, { paneComposition: g, markdownSplit: b.open, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: A }),
        e.showHud ? /* @__PURE__ */ p(
          af,
          {
            mode: w,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : o.jobId,
            searchSlot: /* @__PURE__ */ p(vf, { open: z, onToggle: Q })
          }
        ) : null,
        /* @__PURE__ */ p(wa, { fallback: null, children: b.mounted ? /* @__PURE__ */ p(Uf, { open: b.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: k }) : null }),
        /* @__PURE__ */ p(Sf, { active: s, compare: G, ink: ge }),
        /* @__PURE__ */ p(If, { ink: ge, menu: ne, onClose: oe }),
        /* @__PURE__ */ p(Rf, { ink: ge }),
        /* @__PURE__ */ p(Ff, { edit: te }),
        /* @__PURE__ */ p(uf, {})
      ]
    }
  ) });
}
function um() {
  return /* @__PURE__ */ p(Vf, {});
}
export {
  um as R,
  Vf as a,
  cm as d,
  lm as f,
  dm as r,
  Je as u
};
//# sourceMappingURL=ReaderApp-D1cWb41B.js.map
