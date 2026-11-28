var bi = Object.defineProperty;
var Zr = (e) => {
  throw TypeError(e);
};
var vi = (e, t, n) => t in e ? bi(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Qr = (e, t, n) => vi(e, typeof t != "symbol" ? t + "" : t, n), eo = (e, t, n) => t.has(e) || Zr("Cannot " + n);
var Dt = (e, t, n) => (eo(e, t, "read from private field"), n ? n.call(e) : t.get(e)), to = (e, t, n) => t.has(e) ? Zr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), no = (e, t, n, r) => (eo(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as C, jsx as g, Fragment as Re } from "react/jsx-runtime";
import { useMemo as U, useState as x, useEffect as D, useCallback as L, useRef as N, useLayoutEffect as Le, memo as nn, createContext as rn, useContext as ft, Fragment as xn, forwardRef as wi, useImperativeHandle as yr, useSyncExternalStore as An, Component as Si, Suspense as Na, lazy as La, useId as Ca } from "react";
import { requireAdapter as Ct, getReaderAdapters as Oe } from "./adapters.js";
import { resolveReaderDownloadName as ki, resolveReaderDownloadUrls as Ti, READER_PROGRESS_COPY as Ve, trimString as vn, READER_DOWNLOAD_ACTIONS as Ii, disabledReason as Ei } from "./runtime/state.js";
import { r as Ri, b as Pi } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as qn, isFinishedJobStatus as Yt } from "@retainpdf/domain/job";
import { n as $a, d as Mi, f as Cn, k as ro, b as xi, c as Ai, j as Ce, p as lt, g as _i, l as mt, i as Ni } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as Li } from "@retainpdf/api/documents";
import { isReaderTransportError as Ci, createReaderTransportError as $i } from "./contracts.js";
import { toast as Jn, Toaster as Di } from "sonner";
import { ChevronLeft as Da, PenLine as wn, ZoomIn as Oi, Check as br, X as bt, Copy as Oa, ChevronUp as zi, ChevronDown as Sn, History as Fi, LoaderCircle as Bi, Pin as za, LogOut as ji, FileText as Fa, Columns2 as Ba, Languages as ja, Radio as Hi, ArrowDownToLine as Ui, CheckCircle2 as Wi, ImagePlus as Ki, MessageCircle as Ha, Scan as Vi, GitCompareArrows as qi, CodeXml as Ji, Highlighter as Gi, Eraser as Xi, Undo2 as Yi, Trash2 as Zi, BookText as Qi, ChevronRight as Ua, Minus as Wa, Plus as Ka, ArrowLeft as ec, CircleHelp as tc, Download as nc, Bookmark as rc, Star as Va, Contrast as oc, Search as qa, PinOff as ac } from "lucide-react";
import { Button as G, Textarea as sc, IconButton as dt, Input as vr } from "@retainpdf/ui";
import { e as ic, m as cc, a as lc, c as uc } from "./markdown-math-B8jhIfTG.js";
import { pdfjs as kn, Page as dc, Document as fc } from "react-pdf";
import { createPortal as mc } from "react-dom";
const hc = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, pc = "", gc = Object.freeze({
  progress: "retainpdf-reader-progress"
}), wr = (e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, zb = (...e) => {
  var n;
  return (((n = Oe()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Fb = () => {
  var e, t;
  return ((t = (e = Oe()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, qe = () => Ct("defaultReaderDataPort"), oo = () => Ct("defaultReaderPageConfigPort"), ao = {
  get apiPrefix() {
    return qe().apiPrefix;
  },
  fetchProtected: (...e) => qe().fetchProtected(...e),
  loadMarkdownPayload: (e) => qe().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => qe().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => qe().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => qe().loadJobPayload(e),
  loadReaderPayload: (e, t) => qe().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => qe().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return qe().liveTranslation;
  }
}, Ja = {
  messageTargetOrigin: () => oo().messageTargetOrigin(),
  readerJobId: () => oo().readerJobId()
}, yc = () => {
  var e;
  return ((e = Oe()) == null ? void 0 : e.liveTranslation) ?? null;
}, _t = () => {
  var t;
  const e = Oe();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Ze = () => {
  const e = Oe();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => Ct("fetchDocumentByJobId")(...n),
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
}, bc = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, vc = () => {
  var e, t;
  return ((t = (e = Oe()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, wc = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Sc = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? ki(...e);
}, kc = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Ti(...e);
}, Tc = (...e) => Ct("downloadProtectedResource")(...e), Ic = (...e) => Ct("failDownloadToast")(...e), Bb = (e, t) => Ct("resolveMarkdownAssetUrl")(e, t), so = "/api/v1";
function Ec() {
  const e = () => {
    var r;
    return Ri(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = x(e);
  return D(() => {
    var i, l, c, u;
    const r = () => n(e()), o = (l = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : l.bind(globalThis.history), a = (u = (c = globalThis.history) == null ? void 0 : c.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const f = (m) => function(...h) {
          const p = m.apply(this, h);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), p;
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
function Rc() {
  const e = Ec(), t = U(() => wc(Ja), [e]), n = U(() => vc(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Pc(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [l, c] = x({
    documentId: "",
    jobId: ""
  }), [u, f] = x({
    documentId: "",
    jobId: ""
  }), m = l.documentId === t ? l.jobId : "", h = u.documentId === t ? u.jobId : "", p = n || m, [d, b] = x({
    jobId: "",
    documentId: ""
  }), w = d.jobId === p ? d.documentId : "", v = t || w, y = !!t && !p, [k, S] = x(null), R = (k == null ? void 0 : k.sessionIdentity) === r && k.documentId === v ? k : null, E = y || !!R, P = L((_) => {
    const T = `${_.documentId || ""}`.trim();
    if (!T || a.current && a.current !== T) return;
    if (!a.current && s.current)
      b({
        jobId: s.current,
        documentId: T
      });
    else if (!a.current)
      return;
    const I = `${_.revision || ""}`.trim() || `${Date.now()}`;
    S({
      documentId: T,
      revision: I,
      sessionIdentity: o.current
    }), i();
  }, []);
  D(() => {
    S((_) => _ && _.sessionIdentity !== r ? null : _);
  }, [r]);
  const O = L((_) => {
    switch (_.type) {
      case "resolved-document-job":
        c({ documentId: _.documentId, jobId: _.jobId });
        break;
      case "cleared-resolved-document-job":
        c({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: _.documentId, jobId: _.jobId });
        break;
      case "resolved-job-document":
        b((T) => T.jobId === _.jobId && T.documentId === _.documentId ? T : { jobId: _.jobId, documentId: _.documentId });
        break;
      case "committed-source":
        S({
          documentId: _.documentId,
          revision: _.revision,
          sessionIdentity: _.sessionIdentity
        });
        break;
    }
  }, []);
  return {
    resolvedDocumentJob: l,
    setResolvedDocumentJob: c,
    missingDocumentJob: u,
    setMissingDocumentJob: f,
    documentJobId: m,
    rejectedDocumentJobId: h,
    sessionJobId: p,
    resolvedJobDocument: d,
    setResolvedJobDocument: b,
    jobDocumentId: w,
    documentId: v,
    sourceOnly: y,
    committedDocumentSource: k,
    setCommittedDocumentSource: S,
    activeCommittedDocumentSource: R,
    sourceViewOnly: E,
    refreshCommittedDocument: P,
    applyIdentityEvent: O
  };
}
function io(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Mc(e) {
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
function co(e, t) {
  return wr(qn(e, t));
}
function xc(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Ac(e, t) {
  const n = e == null ? void 0 : e.book_summary, r = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    n == null ? void 0 : n.title,
    e == null ? void 0 : e.source_file_name,
    n == null ? void 0 : n.source_file_name
  ];
  for (const o of r) {
    const a = `${o || ""}`.trim();
    if (a && !xc(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function Gn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: gc.progress,
        stage: n,
        percent: e,
        text: t
      },
      Ja.messageTargetOrigin()
    );
  } catch {
  }
}
function Tn(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Gn({ percent: t, text: n, stage: r });
}
function _c(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, l] = x(null), [c, u] = x(null), [f, m] = x(""), [h, p] = x(0), d = f === n ? i : null, b = f === n ? c : null, w = io(d), v = Yt(w), y = L(() => {
    p((O) => O + 1);
  }, []), k = L((O) => {
    l(O.jobPayload), u(O.manifestPayload), m(O.sessionIdentity);
  }, []), S = L((O) => {
    l(null), u(null), m(O);
  }, []), R = N(""), E = N(""), P = L(async () => {
    const O = o.current;
    if (!O || R.current === O) return;
    const _ = Ze().loadJobPayload;
    if (typeof _ != "function") return;
    const T = a.current.value;
    R.current = O;
    try {
      const I = await _(O);
      if (s.current || a.current.value !== T || o.current !== O || !I || typeof I != "object")
        return;
      const M = io(I);
      l(I), m(r.current), !Yt(M) && E.current === O && (E.current = ""), M === "succeeded" && E.current !== O && (E.current = O, p(($) => $ + 1));
    } catch {
    } finally {
      R.current === O && (R.current = "");
    }
  }, []);
  return D(() => {
    E.current = "";
  }, [n]), D(() => {
    if (!t || v || !d) return;
    const O = window.setInterval(() => {
      document.visibilityState !== "hidden" && P();
    }, 1e3);
    return () => window.clearInterval(O);
  }, [v, P, d, t]), {
    jobPayload: i,
    setJobPayload: l,
    manifestPayload: c,
    setManifestPayload: u,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: m,
    scopedJobPayload: d,
    scopedManifestPayload: b,
    jobStatus: w,
    jobTerminal: v,
    jobRefreshRevision: h,
    refreshJobArtifacts: y,
    refreshJobStatus: P,
    publishPayload: k,
    clearPayload: S
  };
}
function Xn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Nc(e, t) {
  e(t), Xn(t);
}
function Lc(e) {
  const [t, n] = x(e ? "source" : "compare"), r = L((a) => {
    e && a !== "source" || (n(a), Xn(a));
  }, [e]), o = L((a) => {
    Nc(n, a);
  }, []);
  return D(() => (e && document.documentElement.classList.add("reader-source-only"), Xn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function lo(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Cc(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: lo(n.active_job_id),
    activeVersionId: lo(n.active_version_id)
  };
}
function $c(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Dc(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Oc(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const zc = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Fc(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = zc.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Bc = 48 * 1024 * 1024;
function jc(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Hc = 2, De = /* @__PURE__ */ new Map();
function Yn(e, t) {
  De.delete(e), De.set(e, t);
}
function uo(e) {
  if (De.size < Hc) return;
  const t = De.keys().next().value;
  t && De.delete(t);
}
async function Uc(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Sr(e, t = _t().fetchProtected, n = {}) {
  var u, f, m, h, p, d, b, w, v;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (De.has(r)) {
    const y = De.get(r);
    return Yn(r, y), y;
  }
  const o = new AbortController(), a = () => o.abort();
  (u = n.signal) != null && u.aborted && o.abort(), (m = (f = n.signal) == null ? void 0 : f.addEventListener) == null || m.call(f, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (p = (h = n.signal) == null ? void 0 : h.removeEventListener) == null || p.call(h, "abort", a);
  }
  if (!s.ok) {
    const y = new Error(`读取 PDF 失败 (${s.status})`);
    y.status = s.status;
    const k = await Uc(s);
    throw k && (y.reason = k), y;
  }
  const i = Wc(r, s, t);
  if (i) {
    o.abort();
    const y = { ranged: i };
    return uo(), De.set(r, y), y;
  }
  (b = (d = n.signal) == null ? void 0 : d.addEventListener) == null || b.call(d, "abort", a, { once: !0 });
  let l;
  try {
    l = await s.arrayBuffer();
  } finally {
    (v = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || v.call(w, "abort", a);
  }
  const c = { data: new Uint8Array(l) };
  return De.has(r) ? Yn(r, c) : (uo(), De.set(r, c)), c;
}
function Wc(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Bc ? null : {
    url: e,
    length: o,
    async fetchRange(i, l) {
      const c = await n(e, { headers: { Range: `bytes=${i}-${l - 1}` } });
      if (c.status !== 206) throw new Error(`读取 PDF 片段失败 (${c.status})`);
      return new Uint8Array(await c.arrayBuffer());
    }
  };
}
const Kc = { file: null, loading: !1, error: "" }, Vc = { file: null, loading: !0, error: "" };
function qc(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = x(null);
  if (D(() => {
    if (t || !n) return;
    const s = De.get(n);
    if (s) {
      Yn(n, s);
      return;
    }
    const i = new AbortController();
    return Sr(n, void 0, { signal: i.signal }).then((l) => {
      i.signal.aborted || o({ url: n, file: l, loading: !1, error: "" });
    }).catch((l) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (l == null ? void 0 : l.message) || String(l) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Kc;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = De.get(n);
  return a ? { file: a, loading: !1, error: "" } : Vc;
}
function Jc(e) {
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
async function Zn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  Tn(s, r, n, "download");
  const i = await Sr(t, _t().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Tn(s, o, n, "download"), i);
}
async function Gc(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  Tn(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    Zn({
      url: t,
      label: "正在下载原文 PDF…",
      percentStart: 30,
      percentEnd: 55,
      fence: r,
      setBoot: o
    }).then((u) => {
      s = u;
    })
  ), n && a.push(
    Zn({
      url: n,
      label: "正在下载译文 PDF…",
      percentStart: 55,
      percentEnd: 85,
      fence: r,
      setBoot: o
    }).then((u) => {
      i = u;
    })
  ), await Promise.all(a), r.isInactive() ? { status: "inactive" } : !!t && !s || !!n && !i ? { status: "incomplete" } : { status: "downloaded", sourceBytes: s, translatedBytes: i };
}
function Xc(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Yc({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Li,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Xc(o.href, t, a)), !0);
}
const cn = {
  regions: null,
  metadata: null
};
function Zc(e) {
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
    applyIdentityEvent: u,
    publishPayload: f,
    clearPayload: m,
    switchSessionMode: h,
    jobRefreshRevision: p,
    sessionEpochRef: d,
    closingRef: b,
    activeLoadAbortRef: w
  } = e, [v, y] = x(""), [k, S] = x(""), [R, E] = x(null), [P, O] = x(null), [_, T] = x(!1), [I, M] = x(""), [$, z] = x([]), [K, H] = x(!1), [J, oe] = x(() => ({
    source: null,
    translated: null
  })), [q, se] = x(
    cn
  ), [Ee, re] = x({
    loading: !0,
    percent: 4,
    text: Ve.boot,
    stage: "progress",
    failed: !1
  });
  return D(() => {
    const ue = new AbortController(), xe = d.current.value, ie = Jc({
      sessionEpochRef: d,
      closingRef: b,
      abort: ue,
      sessionEpoch: xe
    });
    w.current = ue;
    const le = Ze();
    if (b.current)
      return ue.abort(), () => {
        w.current === ue && (w.current = null);
      };
    let B = !1;
    function W(ee, Z) {
      ie.markFailed(), H(!0), re({
        loading: !1,
        percent: 100,
        text: ee,
        stage: "failed",
        failed: !0
      }), Gn({ percent: 100, text: Z, stage: "failed" });
    }
    function Y() {
      T(!0), B || H(!0), re({
        loading: !1,
        percent: 100,
        text: Ve.ready,
        stage: "ready",
        failed: !1
      }), Gn({ percent: 100, text: Ve.ready, stage: "ready" });
    }
    function de() {
      return c != null && c.documentId ? co(
        c.documentId,
        c.revision
      ) : hc() ? pc : le.resolveResourceUrl(qn(r));
    }
    async function ne() {
      var j;
      let ee = { activeJobId: "", activeVersionId: "" };
      try {
        const V = await ((j = le.fetchDocument) == null ? void 0 : j.call(le, r));
        V && (ee = Cc(V));
      } catch {
      }
      const Z = $c({
        link: ee,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!c
      });
      if (Z.kind === "follow-active-job") {
        if (ie.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: Z.jobId
        }), Z.activeVersionId ? (c || u({
          type: "committed-source",
          documentId: r,
          revision: Z.activeVersionId,
          sessionIdentity: l
        }), h("source")) : h("compare");
        return;
      }
      if (Z.kind === "open-committed-source") {
        if (ie.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: Z.revision,
          sessionIdentity: l
        }), h("source");
        return;
      }
      const fe = de();
      if (ie.isInactive()) return;
      y(fe), S(""), M(""), m(l);
      const A = await Zn({
        url: fe,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: ie,
        setBoot: re
      });
      if (!ie.isInactive()) {
        if (!A) {
          W("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        E(A), Y();
      }
    }
    async function ae() {
      var be;
      const ee = !c, Z = !!(ee && le.loadSessionSnapshot && le.loadReaderOptionalArtifacts), fe = Z ? le.loadReaderOptionalArtifacts(t) : null, A = await ((be = le.loadSessionSnapshot) == null ? void 0 : be.call(le, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: c,
        includeOptionalArtifacts: ee && !Z
      })), j = A ? {
        jobPayload: A.sourcePayload,
        manifestPayload: A.manifestPayload,
        readerMetadata: A.readerMetadata,
        regionsPayload: A.regions,
        readerErrors: A.readerErrors
      } : await le.loadReaderPayload(t, {
        includeOptionalArtifacts: ee
      });
      if (ie.isInactive()) return;
      let V = null;
      if (n && !r)
        if (A && A.linkedDocument !== void 0)
          V = A.linkedDocument;
        else {
          try {
            V = await le.fetchDocumentByJobId(so, t);
          } catch {
          }
          if (ie.isInactive()) return;
        }
      const me = Mc(j.jobPayload) || `${(V == null ? void 0 : V.document_id) || ""}`.trim();
      me && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: me
      });
      const ye = Dc({
        payloadDocumentId: me,
        linkedActiveJobId: `${(V == null ? void 0 : V.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(V == null ? void 0 : V.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!c
      });
      if (ye.kind === "restore-committed-source") {
        if (ie.isInactive()) return;
        u({
          type: "committed-source",
          documentId: ye.documentId,
          revision: ye.revision,
          sessionIdentity: l
        }), h("source");
        return;
      }
      const Te = le.resolveReaderSourcePdf(j.manifestPayload), _e = le.resolveReaderTranslatedPdfUrl(j.jobPayload, j.manifestPayload), ze = typeof Te == "string" ? Te : le.resolveReaderArtifactUrl(Te), je = r || me, Qe = c != null && c.documentId ? co(
        c.documentId,
        c.revision
      ) : ze || (je ? le.resolveResourceUrl(qn(je)) : ""), $e = c ? "" : _e || "";
      y(Qe || ""), S($e), M(Ac(j.jobPayload, t)), f({
        jobPayload: j.jobPayload || null,
        manifestPayload: j.manifestPayload || null,
        sessionIdentity: l
      });
      const Ke = () => Gc({
        sourceFinal: Qe || "",
        translatedFinal: $e,
        fence: ie,
        setBoot: re
      }), et = !!(Qe || $e), tt = fe && et ? Ke() : null;
      tt == null || tt.catch(() => {
      });
      const St = (F) => {
        ie.isInactive() || (z(c ? [] : $a(F.regionsPayload)), oe(c ? { source: null, translated: null } : Mi(F.readerMetadata)), se(c ? cn : F.readerErrors ?? cn), H(!0));
      };
      if (fe ? (B = !0, fe.then(St)) : St(j), !et) {
        W(Ve.failed, Ve.failed);
        return;
      }
      const nt = await (tt ?? Ke());
      if (nt.status !== "inactive") {
        if (nt.status === "incomplete") {
          W("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        E(nt.sourceBytes), O(nt.translatedBytes), Y();
      }
    }
    async function ke() {
      T(!1), E(null), O(null), z([]), H(!1), oe({ source: null, translated: null }), se(cn), Tn(re, 8, Ve.metadata, "metadata");
      try {
        if (s) {
          await ne();
          return;
        }
        if (!t) {
          W(Ve.failed, Ve.failed);
          return;
        }
        await ae();
      } catch (ee) {
        if (ie.isClosedOrStale() || (ee == null ? void 0 : ee.name) === "AbortError") return;
        ie.markFailed();
        const Z = Number(ee == null ? void 0 : ee.status), fe = `${(ee == null ? void 0 : ee.reason) || ""}`, A = Fc({ status: Z, reason: fe, sessionJobId: t });
        if (A && (await Yc({
          apiPrefix: so,
          documentId: A,
          expiredJobId: t
        }) || ie.isClosedOrStale()))
          return;
        if (Oc({
          status: Z,
          reason: fe,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), h("source");
          return;
        }
        const j = ee instanceof Error ? ee.message : Ve.failed;
        W(j, j);
      }
    }
    return ke(), () => {
      ue.abort(), w.current === ue && (w.current = null);
    };
  }, [t, r, o, a, s, i, c, p, n, l, u, f, m, h]), {
    sourceUrl: v,
    translatedUrl: k,
    sourceFile: R,
    translatedFile: P,
    assetsReady: _,
    title: I,
    regions: $,
    regionsSettled: K,
    readerMetadata: J,
    readerErrors: q,
    boot: Ee
  };
}
function Qc() {
  const e = N(!1), t = N(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Rc(), s = N({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = N(a), l = N(""), c = N(""), u = N(() => {
  }), f = L(() => u.current(), []), m = Pc({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: l,
    sessionJobIdRef: c,
    switchToSourceMode: f
  }), {
    sessionJobId: h,
    documentId: p,
    sourceOnly: d,
    sourceViewOnly: b
  } = m, { mode: w, setMode: v, switchSessionMode: y } = Lc(b);
  u.current = () => {
    y("source");
  }, i.current = a, l.current = p, c.current = h;
  const k = _c({
    sessionJobId: h,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: c,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: S,
    scopedManifestPayload: R,
    jobStatus: E,
    jobTerminal: P,
    jobRefreshRevision: O,
    refreshJobArtifacts: _,
    refreshJobStatus: T
  } = k, I = Zc({
    sessionJobId: h,
    jobId: r,
    routeDocumentId: o,
    documentJobId: m.documentJobId,
    rejectedDocumentJobId: m.rejectedDocumentJobId,
    sourceOnly: d,
    locationKey: n,
    sessionIdentity: a,
    committedSource: m.activeCommittedDocumentSource,
    applyIdentityEvent: m.applyIdentityEvent,
    publishPayload: k.publishPayload,
    clearPayload: k.clearPayload,
    switchSessionMode: y,
    jobRefreshRevision: O,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), M = L(() => {
    var z;
    e.current = !0, (z = t.current) == null || z.abort();
  }, []), $ = U(
    () => ({
      fetchProtected: Ze().fetchProtected,
      jobId: h,
      jobPayload: S,
      manifestPayload: R,
      sourceUrl: I.sourceUrl,
      translatedUrl: I.translatedUrl,
      sourceOnly: b
    }),
    [h, S, R, I.sourceUrl, I.translatedUrl, b]
  );
  return {
    jobId: h,
    jobStatus: E,
    workflow: `${(S == null ? void 0 : S.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: P,
    documentId: p,
    sessionIdentity: a,
    sourceOnly: d,
    mode: w,
    setMode: v,
    sourceUrl: I.sourceUrl,
    translatedUrl: I.translatedUrl,
    sourceFile: I.sourceFile,
    translatedFile: I.translatedFile,
    assetsReady: I.assetsReady,
    boot: I.boot,
    title: I.title,
    regions: I.regions,
    regionsSettled: I.regionsSettled,
    readerMetadata: I.readerMetadata,
    readerErrors: I.readerErrors,
    download: $,
    refreshJobArtifacts: _,
    refreshJobStatus: T,
    refreshCommittedDocument: m.refreshCommittedDocument,
    prepareClose: M
  };
}
const el = 160, tl = 8, nl = 0;
function rl() {
  const e = N(null), [t, n] = x(null), [r, o] = x(nl), a = L((s) => {
    e.current = s, n(s);
  }, []);
  return D(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (c) => {
      !Number.isFinite(c) || c < el || o((u) => Math.abs(u - c) < tl ? u : c);
    }, l = new ResizeObserver((c) => {
      var u, f;
      i(((f = (u = c[0]) == null ? void 0 : u.contentRect) == null ? void 0 : f.width) ?? s.clientWidth);
    });
    return l.observe(s), i(s.clientWidth), () => l.disconnect();
  }, [t]), {
    shellRef: e,
    shellEl: t,
    shellWidth: r,
    bindShell: a
  };
}
function ol(e) {
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
const $n = { source: 0, translated: 0 };
function al(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: l
  } = e, c = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, u = N(c);
  u.current = c;
  const [f, m] = x(() => ({
    identity: c,
    pages: $n
  })), [h, p] = x(() => ({ identity: c, tick: 0 })), d = f.identity === c ? f.pages : $n, b = h.identity === c ? h.tick : 0, w = ol({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!l
  }), { primaryPane: v } = w, y = L((T, I) => {
    u.current === c && m((M) => {
      const $ = M.identity === c ? M.pages : $n;
      return $[I] === T && M.identity === c ? M : {
        identity: c,
        pages: { ...$, [I]: T }
      };
    });
  }, [c]), k = N(null), S = L(() => {
    k.current && clearTimeout(k.current);
    const T = c;
    k.current = setTimeout(() => {
      k.current = null, u.current === T && p((I) => ({
        identity: T,
        tick: I.identity === T ? I.tick + 1 : 1
      }));
    }, 60);
  }, [c]);
  D(() => (k.current && (clearTimeout(k.current), k.current = null), m((T) => T.identity === c && T.pages.source === 0 && T.pages.translated === 0 ? T : { identity: c, pages: { source: 0, translated: 0 } }), p((T) => T.identity === c && T.tick === 0 ? T : { identity: c, tick: 0 }), () => {
    k.current && (clearTimeout(k.current), k.current = null);
  }), [c]);
  const R = U(
    () => Math.max(d.source, d.translated),
    [d]
  ), E = v === "translated" ? d.translated : d.source || d.translated, P = t == null ? void 0 : t.userZoom, O = t == null ? void 0 : t.shellWidth, _ = `${c}-${b}-${P}-${n}-${d.source}-${d.translated}-${O}`;
  return {
    ...w,
    numPagesByPane: d,
    hudNumPages: R,
    primaryNumPages: E,
    metricsTick: b,
    onNumPages: y,
    onMetrics: S,
    rowSyncRevision: _
  };
}
const Ie = "data-reader-page", Se = "data-reader-pane", kr = "data-natural-height", Ga = "reader-react-root", Xa = "reader-react-grid", Ya = "reader-react-scroll-shell", on = "reader-react-pdf-pane", Za = "reader-react-pdf-page", In = "reader-react-pdf-page-placeholder", Tr = "reader-react-pdf-page-slot";
function En(e, t) {
  const n = e != null ? `[${Ie}="${e}"]` : `[${Ie}]`;
  return t ? `${n}[${Se}="${t}"]` : n;
}
function Ir() {
  return `.${Tr}[${Ie}]`;
}
function Rn(e) {
  return Number(e.getAttribute(Ie));
}
const Qa = 0.25, Pn = 1, sl = 0.05, an = 0.5, il = 16, cl = 8, es = il + cl, ll = 720;
function Pt() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function ts(e) {
  return Number.isFinite(e) && e < ll;
}
function Et(e, t = Number.POSITIVE_INFINITY) {
  return ts(t) && (e === "source" || e === "translated") ? Pn : an;
}
function Xe(e) {
  return Number.isFinite(e) ? Math.min(Pn, Math.max(Qa, e)) : an;
}
function Zt(e, t) {
  const n = Xe(Number(e) + t * sl);
  return Math.round(n * 100) / 100;
}
function ul(e) {
  return Math.round(Xe(e) * 100);
}
function ns(e) {
  const n = (Number(e) || 0) - es;
  return Math.max(160, Math.floor(n));
}
function dl(e, t = an) {
  const n = Xe(t);
  return ns((Number(e) || 0) * n);
}
function fl(e, t) {
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
const ml = 8;
function hl(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < ml ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const rs = 200, pl = [
  "markdown"
], gl = pl;
function os(e) {
  return gl.includes(e);
}
const yl = "retainpdf:reader:view:v1:", fo = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), bl = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function as() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Qn(e) {
  return `${e || ""}`.trim();
}
function vl({
  documentId: e,
  jobId: t
}) {
  const n = Qn(e);
  if (n) return `document:${n}`;
  const r = Qn(t);
  return r ? `job:${r}` : "";
}
function ss(e) {
  const t = Qn(e);
  return t ? `${yl}${t}` : "";
}
function wl(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function Sl(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!fo.has(t) || !fo.has(n) || t === n))
    return { left: t, right: n };
}
function kl(e) {
  return e === null ? null : os(e) ? e : void 0;
}
function Tl(e) {
  return bl.has(e) ? e : void 0;
}
function is(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = wl(t.anchor), r = Number(t.zoom), o = Tl(t.mode), a = Sl(t.splitLayout), s = kl(t.assistantPanel);
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
function We(e, t = as()) {
  const n = ss(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? is(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function _n(e, t, n = as()) {
  const r = ss(e);
  if (!r || !n) return null;
  const o = We(e, n), a = is({
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
function Il(e, t, n = "") {
  var m;
  const [r, o] = x(() => {
    var h;
    return ((h = We(n)) == null ? void 0 : h.zoom) ?? Et(e, Pt());
  }), a = N(r), s = N(n);
  a.current = r;
  const i = N(1), l = N(((m = We(n)) == null ? void 0 : m.zoom) !== void 0);
  D(() => {
    var d;
    if (s.current === n) return;
    s.current = n;
    const h = (d = We(n)) == null ? void 0 : d.zoom;
    l.current = h !== void 0;
    const p = h ?? Et(e, Pt());
    i.current = 1, a.current = p, o(p);
  }, [e, n]), D(() => {
    if (l.current) return;
    const h = Et(e, Pt()), p = a.current;
    Math.abs(h - p) < 5e-4 || (i.current = 1, a.current = h, o(h));
  }, [e]);
  const c = L((h, p) => {
    const d = Xe(h), b = a.current;
    Math.abs(d - b) < 5e-4 || (i.current = (p == null ? void 0 : p.keepScroll) === !1 ? 1 : d / (b || 1), a.current = d, l.current = !0, _n(s.current, { zoom: d }), o(d));
  }, []), u = L((h) => {
    c(Zt(a.current, h));
  }, [c]), f = L((h) => {
    c(Et(h));
  }, [c]);
  return Le(() => {
    const h = i.current;
    Math.abs(h - 1) < 1e-3 || (i.current = 1, fl(t == null ? void 0 : t.current, h));
  }, [r, t]), { userZoom: r, onZoomChange: c, stepZoom: u, resetZoom: f };
}
const El = 160, Rl = 3e-3, mo = 50, Pl = 16, Ml = 800;
function xl(e, t = 0) {
  const n = t === 1 ? Pl : t === 2 ? Ml : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-mo, Math.min(mo, r));
  return Math.exp(-o * Rl);
}
function Al(e, t, n = 0) {
  return Xe(e * xl(t, n));
}
function _l(e) {
  return Math.round(Xe(e) * 100) / 100;
}
function Nl(e, t, n) {
  const r = Xe(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Xe(t) / r;
  const a = (o + es) / r;
  return ns(a * Xe(t)) / o;
}
function Ll(e) {
  return Array.from(e.querySelectorAll(Ir()));
}
function Cl(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function $l(e, t, n) {
  let r = null;
  for (const s of Ll(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const l = Cl(i, t, n);
    if ((!r || l < r.distance) && (r = { el: s, rect: i, distance: l }), l === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Ie) || "",
    pane: o.getAttribute(Se) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function Dl(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function cs(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${Ir()}[${Ie}="${t.page}"][${Se}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Dl(n, e).scrollLeft += a);
}
function Ol(e, t, n, r) {
  const o = e.querySelector(`.${Xa}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function Ot(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const zl = 600, Fl = 1e3;
function Bl(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || cs(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || c();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const l = r.setTimeout(() => c(), Fl);
  function c() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(l);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return c;
}
function jl(e, t, n) {
  const r = N(t);
  r.current = t;
  const o = N(n);
  o.current = n;
  const a = N(null), s = N(null), i = N(null);
  D(() => {
    if (!e) return;
    const l = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const f = _l(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        Ot(u.grid);
        return;
      }
      const m = { anchor: u.anchor, grid: u.grid, fallback: null };
      m.fallback = setTimeout(() => {
        s.current === m && (s.current = null, Ot(m.grid));
      }, zl), s.current = m, o.current(f, { keepScroll: !1 });
    }, c = (u) => {
      var h, p;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let f = a.current;
      if (!f) {
        (h = i.current) == null || h.call(i), i.current = null;
        const d = s.current;
        d && (d.fallback && clearTimeout(d.fallback), s.current = null, Ot(d.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: $l(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = Al(f.target, u.deltaY, u.deltaMode);
      const m = Nl(f.start, f.target, ((p = f.anchor) == null ? void 0 : p.pageWidth) ?? 0);
      f.grid = Ol(e, m, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(l, El);
    };
    return e.addEventListener("wheel", c, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", c);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), Ot((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Le(() => {
    var c;
    const l = s.current;
    l && (s.current = null, l.fallback && clearTimeout(l.fallback), Ot(l.grid), !(!e || !l.anchor) && (cs(e, l.anchor), (c = i.current) == null || c.call(i), i.current = Bl(e, l.anchor)));
  }, [t, e]);
}
function Hl(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = N(t), a = N(n), s = N(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: L((l) => {
    l !== o.current && (s.current(), a.current(l));
  }, []) };
}
const Er = 56;
function ls(e, t = Er) {
  return e.getBoundingClientRect().top + t;
}
function us(e, t) {
  if (!e.length)
    return null;
  let n = null, r = -1 / 0;
  for (const l of e) {
    const c = l.getBoundingClientRect();
    c.height < 8 || c.width < 8 || c.top <= t + 1 && c.top >= r && (n = l, r = c.top);
  }
  if (!n && (n = e.find((c) => {
    const u = c.getBoundingClientRect();
    return u.height >= 8 && u.width >= 8;
  }) ?? null, n)) {
    const c = [...e].reverse().find((u) => {
      const f = u.getBoundingClientRect();
      return f.height >= 8 && f.width >= 8;
    });
    c && c.getBoundingClientRect().bottom < t && (n = c);
  }
  if (!n)
    return null;
  const o = Rn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Jt(e, t, n = Er) {
  if (!e)
    return null;
  const r = En(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = ls(e, n), i = us(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Nt(e, t, n = "auto", r, o = Er) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(En(a, r))), i || (i = e.querySelector(En(a))), !i)
    return !1;
  const l = e.getBoundingClientRect(), c = i.getBoundingClientRect();
  if (l.height <= 0 || c.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = c.height > 0 ? c.height : i.offsetHeight, f = e.scrollTop + (c.top - l.top), m = Math.max(0, f + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - m) >= 1 && (e.scrollTop = m) : e.scrollTo({ top: m, behavior: n }), !0;
}
function Ul(e, t, n = "smooth", r) {
  return Nt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function er(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], l = () => {
    var u;
    if (a) return;
    Nt(
      e(),
      t,
      r,
      n == null ? void 0 : n.pane
    ) && !s && (s = !0, (u = n == null ? void 0 : n.onDone) == null || u.call(n));
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
function Wl(e, t, n) {
  return er(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Mn(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function Fe(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Kl(e, t, n = !0, r = "", o) {
  const [a, s] = x(1);
  return D(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let l = !1, c = null, u = 0;
    const f = En(void 0, o), m = () => {
      if (l) return;
      const d = Array.from(i.querySelectorAll(f));
      if (!d.length)
        return;
      const b = ls(i), w = us(d, b);
      w && s(w.page);
    }, h = () => {
      l || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, m();
      }));
    }, p = () => {
      if (l) return;
      if (!Array.from(i.querySelectorAll(f)).length) {
        c = setTimeout(p, 120);
        return;
      }
      m(), i.addEventListener("scroll", h, { passive: !0 });
    };
    return p(), () => {
      l = !0, c && clearTimeout(c), u && cancelAnimationFrame(u), i.removeEventListener("scroll", h);
    };
  }, [e, t, n, r, o]), a;
}
const Vl = `canvas, .react-pdf__Page, .${Za}, .${In}`, ho = /* @__PURE__ */ new WeakMap();
function ql(e) {
  const t = Number(e.getAttribute(kr));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = ho.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Vl), ho.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Jl(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Gl(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(Ir()).forEach((r) => {
    const o = Rn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = ql(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Xl(e, t, n = "", r) {
  const [o, a] = x(() => /* @__PURE__ */ new Map()), s = N(o), i = N(r);
  return i.current = r, Le(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let l = !1, c = 0, u = !1, f = !1;
    const m = () => {
      var S;
      if (l) return;
      const y = e.current;
      if (!y) return;
      const k = Gl(y);
      Jl(s.current, k) || (s.current = k, a(k)), u && !f && (f = !0, (S = i.current) == null || S.call(i));
    }, h = () => {
      cancelAnimationFrame(c), c = requestAnimationFrame(() => {
        requestAnimationFrame(m);
      });
    };
    h();
    const p = window.setTimeout(h, 100), d = window.setTimeout(() => {
      u = !0, h();
    }, 300), b = window.setTimeout(h, 700), w = e.current;
    let v = null;
    return w && typeof ResizeObserver < "u" && (v = new ResizeObserver(() => h()), v.observe(w)), () => {
      l = !0, cancelAnimationFrame(c), window.clearTimeout(p), window.clearTimeout(d), window.clearTimeout(b), v == null || v.disconnect();
    };
  }, [e, t, n]), o;
}
const Yl = [0, 48, 140, 320, 560], Zl = 700, Ql = [80, 200, 400], eu = 500, tu = 50, nu = /* @__PURE__ */ new Set([
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
]), ru = 180, po = [0, 48, 140, 320, 700, 1200];
function ou(e, t) {
  var I;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = N(
    ((I = We(a)) == null ? void 0 : I.anchor) || { page: 1, fraction: 0 }
  ), l = N(null), c = N(!1), u = N(r), f = N(null), m = N(null), h = N(null), p = N(null), d = N(a), b = N(""), w = N(n);
  w.current = n;
  const v = L(() => {
    var M;
    (M = f.current) == null || M.call(f), f.current = null, m.current != null && (clearTimeout(m.current), m.current = null);
  }, []), y = L(() => {
    !c.current && l.current == null || (v(), h.current != null && (clearTimeout(h.current), h.current = null), l.current = null, c.current = !1);
  }, [v]), k = L((M = !1) => {
    p.current != null && (clearTimeout(p.current), p.current = null);
    const $ = () => {
      p.current = null, _n(d.current, {
        anchor: Fe(i.current)
      });
    };
    M ? $() : p.current = setTimeout($, ru);
  }, []), S = L((M) => {
    i.current = Fe(M), l.current = null, h.current != null && clearTimeout(h.current), h.current = setTimeout(() => {
      h.current = null, c.current = !1;
    }, tu);
  }, []);
  D(() => {
    if (!o)
      return;
    let M = !1, $ = null, z = null, K = null;
    const H = () => {
      if (M) return;
      const J = e.current;
      if (!J) {
        K = setTimeout(H, 50);
        return;
      }
      $ = J, z = () => {
        if (c.current)
          return;
        const oe = Jt($, w.current);
        oe && (i.current = oe, k());
      }, $.addEventListener("scroll", z, { passive: !0 }), c.current || z();
    };
    return H(), () => {
      M = !0, K != null && clearTimeout(K), $ && z && $.removeEventListener("scroll", z);
    };
  }, [o, r, n, e, k]), D(() => {
    if (!o) return;
    const M = e.current;
    if (!M) return;
    const $ = (z) => {
      z.metaKey || z.ctrlKey || z.altKey || nu.has(z.key) && y();
    };
    return M.addEventListener("wheel", y, { passive: !0 }), M.addEventListener("touchmove", y, { passive: !0 }), window.addEventListener("keydown", $), () => {
      M.removeEventListener("wheel", y), M.removeEventListener("touchmove", y), window.removeEventListener("keydown", $);
    };
  }, [o, e, y]), Le(() => {
    var $;
    if (d.current === a) return;
    k(!0), v(), h.current != null && (clearTimeout(h.current), h.current = null), d.current = a, b.current = "";
    const M = ($ = We(a)) == null ? void 0 : $.anchor;
    i.current = M ? Fe(M) : { page: 1, fraction: 0 }, l.current = null, c.current = !!a, u.current = r;
  }, [a, r, k, v]), D(() => {
    var $;
    if (!o || !s || !a || b.current === a) return;
    b.current = a;
    const M = Fe(
      (($ = We(a)) == null ? void 0 : $.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = M, l.current = M, c.current = !0, v(), f.current = er(
      () => e.current,
      M,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: po,
        onDone: () => S(M)
      }
    ), m.current = setTimeout(() => {
      m.current = null, S(M);
    }, Math.max(...po) + 160), () => v();
  }, [o, s, a, e, S, v]), D(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      c.current = !1, l.current = null, v();
      return;
    }
    const M = l.current ? Fe(l.current) : Fe(i.current);
    return c.current = !0, l.current = M, i.current = M, v(), f.current = er(
      () => e.current,
      M,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Yl,
        onDone: () => S(M)
      }
    ), m.current = setTimeout(() => {
      m.current = null, S(M);
    }, Zl), () => {
      v();
    };
  }, [r, o, n, e, S, v]), D(() => () => {
    v(), h.current != null && (clearTimeout(h.current), h.current = null), k(!0);
  }, [v, k]);
  const R = L(() => {
    const M = Jt(
      e.current,
      w.current
    );
    return Fe(M || i.current);
  }, [e]), E = L(() => {
    c.current = !0;
    const M = Jt(
      e.current,
      w.current
    ), $ = Fe(M ?? i.current);
    return i.current = $, l.current = $, k(), $;
  }, [e, k]), P = L((M, $, z) => {
    const K = z || w.current, H = Mn(M, $ || 1), J = { page: H, fraction: 0 };
    i.current = J, c.current = !0, l.current = J, k(), v(), Ul(e.current, H, "smooth", K), f.current = Wl(
      () => e.current,
      H,
      {
        behavior: "auto",
        pane: K,
        delaysMs: Ql,
        onDone: () => S(J)
      }
    ), m.current = setTimeout(() => {
      m.current = null, S(J);
    }, eu);
  }, [e, S, v, k]), O = L(() => Fe(i.current), []), _ = L(() => c.current, []), T = L(() => {
    if (!c.current || !l.current)
      return;
    const M = Fe(l.current);
    Nt(
      e.current,
      M,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: R,
    beginModeSwitch: E,
    goToPage: P,
    getAnchor: O,
    isRestoring: _,
    repinIfRestoring: T
  };
}
function au(e, t) {
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
function ds(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const su = [0, 80, 200, 400, 800], iu = 120, cu = 400;
function lu(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: l, documentId: c, regionsSettled: u = !0 } = e, f = N(a);
  f.current = a;
  const m = N(s);
  m.current = s;
  const h = N(i);
  h.current = i;
  const p = N(n);
  p.current = n, D(() => {
    var k, S;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const d = bc(), b = au(d, m.current);
    if (b == null && (d != null && d.blockId) && !u) return;
    const w = ds(d, b, { jobId: l, documentId: c });
    if (t.current === w)
      return;
    if (b == null) {
      t.current = w, (k = p.current) == null || k.call(p);
      return;
    }
    t.current = w, d && ((S = h.current) == null || S.call(h, d, b));
    const v = [];
    let y = 0;
    for (const R of su)
      y = Math.max(y, R), v.push(
        setTimeout(() => {
          f.current(b);
        }, R)
      );
    return v.push(
      setTimeout(() => {
        var R;
        (R = p.current) == null || R.call(p);
      }, y + iu)
    ), () => {
      for (const R of v) clearTimeout(R);
    };
  }, [r, o, l, c, t, u]);
}
function uu(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function du(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = cu,
    jobId: i,
    documentId: l,
    applyReaderSearch: c
  } = e, u = N(a);
  u.current = a;
  const f = N(c);
  f.current = c;
  const m = N(0);
  D(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || m.current === o) return;
    const h = setTimeout(() => {
      var w;
      const p = ((w = globalThis.location) == null ? void 0 : w.search) || "", d = Pi(p, o, u.current);
      if (m.current = o, d === null) return;
      const b = `${new URLSearchParams(d).get("block_id") || ""}`.trim();
      t.current = ds(
        { blockId: b },
        o,
        { jobId: i, documentId: l }
      ), (f.current || uu)(d);
    }, s);
    return () => clearTimeout(h);
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
function fu(e) {
  const t = N(""), [n, r] = x(!1), o = L(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  lu(a, t, o), du(e, t, n);
}
const zt = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function mu(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function go(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function fs(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = go(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = go(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function hu(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = fs(r, t, n);
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
function pu(e) {
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
function gu(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function yu(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function bu(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function vu(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const yo = [250, 500, 1e3, 2e3, 4e3], Dn = [80, 160, 320, 640, 1e3, 1500], bo = [250, 500, 1e3, 2e3, 4e3, 5e3];
function tr(e, t) {
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
function Rr(e) {
  return Ci(e) ? `${e.code || ""}`.trim() : "";
}
function ln(e, t) {
  const n = Rr(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function wu(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const l = await o.fetchPage(e, t.page_idx, { signal: r });
      if (fs(n.pagesByPage.get(t.page_idx), t, l) !== "retry")
        return l;
      a = $i(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (l) {
      if ((l == null ? void 0 : l.name) === "AbortError") throw l;
      a = l;
      const c = Rr(l);
      if (c && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(c)) throw l;
    }
    const i = Dn[Math.min(s, Dn.length - 1)];
    if (await tr(i, r), s >= Dn.length + 2) throw a;
  }
}
function Su({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = x(zt), s = N(o), i = N("");
  s.current = o;
  const l = `${e || ""}`.trim(), c = `${t || ""}`.trim().toLowerCase(), u = Yt(c) ? c : "";
  return D(() => {
    if (!n || !l) {
      i.current = "", s.current = zt, a(zt);
      return;
    }
    const f = r === void 0 ? yc() : r, m = i.current === l;
    if (i.current = l, !f) {
      const y = {
        ...m ? s.current : zt,
        connection: u ? "terminal" : "unavailable",
        jobStatus: c,
        error: "实时译文暂不可用"
      };
      s.current = y, a(y);
      return;
    }
    const h = new AbortController();
    let p = !1;
    const d = {
      ...m ? s.current : zt,
      connection: u ? "terminal" : "connecting",
      jobStatus: c,
      error: ""
    };
    s.current = d, a(d);
    const b = (y) => {
      h.signal.aborted || a((k) => {
        const S = y(k);
        return s.current = S, S;
      });
    }, w = async () => {
      let y = 0;
      for (; !h.signal.aborted; )
        try {
          const k = await f.fetchLayout(l, { signal: h.signal });
          p = !0, b((S) => ({
            ...S,
            layoutByPage: mu(k),
            jobStatus: c,
            error: ""
          }));
          return;
        } catch (k) {
          if ((k == null ? void 0 : k.name) === "AbortError") return;
          const S = Rr(k);
          if (!(S === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !S)) {
            b((E) => ({
              ...E,
              connection: u ? "terminal" : "unavailable",
              jobStatus: c,
              error: ln(k, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            b((E) => ({
              ...E,
              connection: "terminal",
              jobStatus: c,
              error: ""
            }));
            return;
          }
          b((E) => ({
            ...E,
            connection: "connecting",
            jobStatus: c,
            error: ln(k, "正在等待 OCR 版面数据")
          })), await tr(yo[Math.min(y, yo.length - 1)], h.signal).catch(() => {
          }), y += 1;
        }
    };
    return (async () => {
      if (await w(), !p || h.signal.aborted) return;
      let y = 0;
      for (; !h.signal.aborted; ) {
        u || b((k) => ({
          ...k,
          connection: k.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: c,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: k.error
        }));
        try {
          await f.streamEvents(l, {
            afterSeq: s.current.lastSeq,
            signal: h.signal,
            onEvent: async (k) => {
              if (k.seq <= s.current.lastSeq) return;
              let S;
              try {
                S = await wu(
                  l,
                  k,
                  s.current,
                  h.signal,
                  f
                );
              } catch (R) {
                if ((R == null ? void 0 : R.name) === "AbortError" || h.signal.aborted) throw R;
                b((E) => ({
                  ...E,
                  lastSeq: Math.max(E.lastSeq, k.seq),
                  error: ln(R, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              b((R) => {
                const E = hu(R, k, S);
                return u ? {
                  ...E,
                  connection: "terminal",
                  jobStatus: c
                } : {
                  ...E,
                  jobStatus: c
                };
              }), y = 0;
            }
          });
        } catch (k) {
          if ((k == null ? void 0 : k.name) === "AbortError" || h.signal.aborted) return;
          b((S) => ({
            ...S,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: c,
            error: ln(k, "实时译文连接已中断，正在重连")
          }));
        }
        if (h.signal.aborted) return;
        if (u) {
          b((k) => ({
            ...k,
            connection: "terminal",
            jobStatus: c
          }));
          return;
        }
        await tr(bo[Math.min(y, bo.length - 1)], h.signal).catch(() => {
        }), y += 1;
      }
    })(), () => h.abort();
  }, [n, r, l, u]), o;
}
function ku(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), l = Number(s.count) || 0;
    i && l > 0 && o.set(i, l);
  }
  return o;
}
function Tu(e, t = !0) {
  const [n, r] = x(() => /* @__PURE__ */ new Map());
  return D(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Ze().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(ku(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const Iu = 4500;
function Eu(e) {
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
const Ru = /* @__PURE__ */ new Set(["book", "translate"]);
function ms(e) {
  return !!(e.jobId && e.sourceUrl && Ru.has(e.workflow));
}
function Pu(e) {
  return !!(ms(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Mu() {
  const e = Qc(), t = ms({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Pu({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = N({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Yt(o) && (r.current.running = !0);
  const a = Su({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: l, bindShell: c } = rl(), u = Tu(e.jobId, !e.sourceOnly), f = vl({
    documentId: e.documentId,
    jobId: e.jobId
  }), m = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: h, onZoomChange: p } = Il(e.mode, s, f);
  jl(i, h, p);
  const d = al(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: h, shellWidth: l, identityKey: m }
  ), {
    beginModeSwitch: b,
    goToPage: w,
    repinIfRestoring: v
  } = ou(s, {
    primaryPane: d.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: d.primaryNumPages > 0
  });
  D(() => {
    v();
  }, [l, v]);
  const y = Xl(
    s,
    d.compareMode,
    d.rowSyncRevision,
    v
  ), k = Kl(
    s,
    d.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${h}-${d.metricsTick}`,
    d.primaryPane
  ), S = L((H, J) => {
    var q, se;
    const oe = Math.max(
      Number(d.hudNumPages) || 0,
      Number(d.primaryNumPages) || 0,
      Number((q = d.numPagesByPane) == null ? void 0 : q.source) || 0,
      Number((se = d.numPagesByPane) == null ? void 0 : se.translated) || 0
    );
    w(H, oe, J);
  }, [w, d.hudNumPages, d.primaryNumPages, d.numPagesByPane]), [R, E] = x(null), P = N(null), O = L((H) => {
    P.current && clearTimeout(P.current), E(H), H && (P.current = setTimeout(() => E(null), Iu));
  }, []);
  D(() => () => {
    P.current && clearTimeout(P.current);
  }, []);
  const _ = L((H) => {
    const J = Cn(e.regions, H);
    return J ? ro(J, d.primaryPane).page : null;
  }, [e.regions, d.primaryPane]), T = L((H, J) => {
    const oe = J || d.primaryPane, q = typeof H == "object" && H ? `${H.block_id || ""}`.trim() : "", se = typeof H == "object" && H ? `${H.image_url || ""}`.trim() : "", Ee = typeof H == "object" && H ? H.page_idx != null ? Number(H.page_idx) + 1 : H.page != null ? Number(H.page) : null : typeof H == "number" ? H + 1 : null, re = xi(e.regions, se, Ee) || Cn(e.regions, q) || (typeof H == "object" ? Ai(e.regions, H) : null);
    let ue = re ? ro(re, oe).page : null;
    ue == null && (ue = Eu(H)), !(ue == null || ue < 1) && (O(re), S(ue, oe));
  }, [O, S, d.primaryPane, e.regions]);
  fu({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: d.hudNumPages || 0,
    currentPage: k,
    goToPage: S,
    resolveBlockPage: _,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (H) => {
      O(Cn(e.regions, H.blockId));
    }
  });
  const { setModeKeepingPage: I } = Hl({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: b
  });
  D(() => {
    O(null);
  }, [m, O]);
  const M = !e.boot.loading && !e.boot.failed, $ = U(() => ({ bindShell: c, shellEl: i, shellWidth: l, shellRef: s }), [c, i, l, s]), z = U(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), K = U(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: h,
    onZoomChange: p,
    shell: $,
    panes: d,
    sessionFiles: z,
    rowHeights: y,
    goToPage: S,
    activeRegion: R,
    jumpToAnchor: T,
    setModeKeepingPage: I,
    download: e.download,
    showHud: M,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, $, d, z, y, S, R, T, I, M, h, p, f, a, n, u]);
  return U(() => ({
    ...K,
    currentPage: k
  }), [K, k]);
}
const xu = [
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
], Au = [
  {
    title: "翻页",
    items: [
      { actions: ["next-page"], keys: "J · ↓ · PgDn", desc: "下一页" },
      { actions: ["prev-page"], keys: "K · ↑ · PgUp", desc: "上一页" },
      { actions: ["first-page", "last-page"], keys: "Home / End", desc: "首页 / 末页" },
      { actions: [], keys: "点底下的页码", desc: "输入页码跳转" }
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
    // 画笔、提问这些扩展自己的快捷键由扩展登记（快捷键说明里排在这几组后面）。
    title: "右键",
    items: [
      { actions: [], keys: "Shift+右键", desc: "浏览器自己的右键菜单" }
    ]
  },
  {
    title: "待处理",
    items: [
      { actions: [], keys: "N / Shift+N", desc: "跳到下一处 / 上一处要看一眼的段落（左栏「待改」）" }
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
function _u(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of xu)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Nu(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Lu = ".reader-notes-panel";
function Cu(e) {
  return e instanceof Element ? !!e.closest(Lu) : !1;
}
function $u(e) {
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
    enabled: u = !0
  } = e;
  D(() => {
    if (!u)
      return;
    const f = (m) => {
      if (m.defaultPrevented || m.metaKey || m.ctrlKey || m.altKey || Nu(m.target) || Cu(m.target))
        return;
      const h = m.key, p = _u(h);
      if (p) {
        if (p.mode) {
          if (n && p.mode !== "source")
            return;
          m.preventDefault(), r(p.mode);
          return;
        }
        if (p.action === "doc-dark") {
          if (!c || m.repeat) return;
          m.preventDefault(), c();
          return;
        }
        if (!(p.requiresPages && i <= 0))
          switch (m.preventDefault(), p.action) {
            case "zoom-in":
              a(Zt(o, 1));
              return;
            case "zoom-out":
              a(Zt(o, -1));
              return;
            case "zoom-reset":
              a(Et(t, Pt()));
              return;
            case "next-page":
              l(Mn(s + 1, i));
              return;
            case "prev-page":
              l(Mn(s - 1, i));
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
    u,
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
const Me = { size: 16, strokeWidth: 1.75 }, vo = { size: 12, strokeWidth: 1.75 }, Du = "retainpdf:soft-reader-close";
function Ou() {
  return new URL("./index.html", window.location.href).href;
}
function zu() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Du },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Fu(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Bu() {
  if (!(typeof window > "u") && !zu()) {
    if (Fu(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Ou());
  }
}
function ju({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ g("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Hu({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ C(ju, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Bu();
  }, children: [
    /* @__PURE__ */ g(Da, { className: "reader-close-home-icon", ...Me, "aria-hidden": !0 }),
    /* @__PURE__ */ g("span", { className: "reader-close-home-label", children: "返回" })
  ] });
}
const Uu = 3e3, Wu = 8;
async function Ku(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function Vu(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function qu(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = Uu;
  const r = [], o = (s, i, l) => {
    const c = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], m = Vu(f == null ? void 0 : f.title);
      if (!m) continue;
      n -= 1;
      const h = l ? `${l}.${u}` : `${u}`, p = { id: h, title: m, page: null, level: i, children: [] };
      r.push({ node: p, dest: f.dest }), c.push(p), i < Wu && Array.isArray(f.items) && f.items.length && (p.children = o(f.items, i + 1, h));
    }
    return c;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await Ku(e, i);
  })), a;
}
function hs(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function Ju(e, t) {
  let n = null;
  for (const r of hs(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
let wo = !1;
function ps() {
  if (wo)
    return;
  const e = _t().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (kn.GlobalWorkerOptions.workerSrc = e, wo = !0);
}
const st = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Gu = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Xu = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Yu = {
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
}, So = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Zu(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => So(o ?? a ?? "", Gu)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => So(o ?? a ?? "", Xu)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Yu[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Qu(e) {
  return st(e.translatedBlockText) || st(e.translated.text) || st(e.source.text);
}
const ed = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function td(e) {
  const t = [];
  for (const n of e) {
    if (!ed(n)) continue;
    const r = Zu(Qu(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
const nd = 24, rd = 60;
function ko(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - nd), o = Math.min(e.length, n + t.length + rd), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function od(e, t, n = 200) {
  const r = st(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = st(a.translatedBlockText) || st(a.translated.text), l = i ? ko(i, r) : null, c = l ?? ko(st(a.source.text), r);
    if (c && (o.push({ itemId: a.itemId, page: s, side: l ? "translated" : "source", ...c }), o.length >= n))
      break;
  }
  return o;
}
function un(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Wt(e, t) {
  const n = st(t).toLowerCase();
  if (!n || !e) return un(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${un(e.slice(a, s))}<mark class="reader-find-mark">${un(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + un(e.slice(a));
}
function ad(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const sd = /^data-[a-z0-9-]+$/;
function To(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function id(e, t, n = "") {
  if (!t.length) return Wt(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += Wt(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([l]) => sd.test(l)).map(([l, c]) => ` ${l}="${To(c)}"`).join("");
    o += `<mark class="${To(s.className)}"${i}>${Wt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + Wt(e.slice(a), n);
}
function we(e) {
  return typeof e == "string" ? e : "";
}
function cd(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function ld(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function ud(e) {
  return {
    source: we(e == null ? void 0 : e.source_text) || we(e == null ? void 0 : e.unit_source_text),
    translated: we(e == null ? void 0 : e.protected_translated_text) || we(e == null ? void 0 : e.translated_text)
  };
}
const dd = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function gs(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function fd(e) {
  const t = gs(e).sort((r, o) => we(r.ts).localeCompare(we(o.ts)));
  return t.length ? [
    { text: we(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: we(r.new_text),
      label: dd[we(r.source)] || we(r.source) || "修订",
      ts: we(r.ts),
      reason: we(r.reason)
    }))
  ].reverse() : [];
}
function md(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function hd(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return we(r.finished_at) || we(n.finished_at) || "";
}
function pd(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = gs(e).sort((a, s) => we(a.ts).localeCompare(we(s.ts)));
  for (const a of o) {
    const s = new Date(we(a.ts)).getTime(), i = we(a.reader_item_id) || we(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, we(a.new_text));
  }
  return n;
}
const gd = {
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
function yd(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = gd[we(n.kind)] || we(n.kind) || "问题", o = we(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const bd = /* @__PURE__ */ new Set(["text", "formula"]);
function Pr(e) {
  return bd.has(e);
}
function ys(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || Pr(Ce(n));
}
function vd(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !Pr(Ce(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const wd = 300, Sd = 72;
function kd(e, t) {
  if (e.width >= wd && e.height >= Sd)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const Td = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function Id(e, t, n) {
  return e.flatMap((r) => {
    if (!Td.has(Ce(r.region))) return [];
    const o = lt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function Io(e, t, n) {
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
async function Ed(e) {
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
const Rd = "reader-text-hover-copy", Pd = "reader-text-hover-edit", Md = "reader-text-hover-zoom", xd = "reader-text-hover-id";
function Ad(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const bs = "reader-text-hover-tools";
function dn({
  className: e,
  state: t,
  label: n,
  title: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ g(
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
const _d = 26, Nd = 220;
function Ld(e, t = Nd) {
  return e.height < _d * 2 || e.width < t;
}
function Cd({ state: e }) {
  return /* @__PURE__ */ g(e === "copied" ? br : e === "failed" ? bt : Oa, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function $d({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [l, c] = x("idle"), [u, f] = x("idle"), [m] = x(() => Ad()), h = N([]), p = (e == null ? void 0 : e.itemId) || "";
  if (D(() => {
    c("idle"), f("idle");
    const S = h.current;
    return () => {
      S.forEach((R) => window.clearTimeout(R)), h.current = [];
    };
  }, [p]), !e) return null;
  const d = _i(e.highlight.region, t), b = Ce(e.highlight.region), w = (S, R) => async (E) => {
    E.preventDefault(), E.stopPropagation();
    const P = await Ed(S);
    R(P ? "copied" : "failed"), h.current.push(window.setTimeout(() => R("idle"), 1200));
  }, v = b === "formula" ? "复制 LaTeX" : "复制", y = a || e.rect, k = s || (Ld(y) ? "outside" : "inside");
  return /* @__PURE__ */ g("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ g(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": b,
      style: y,
      children: /* @__PURE__ */ C(
        "div",
        {
          className: bs,
          "data-placement": k,
          style: k === "tail" ? { top: i } : void 0,
          children: [
            m ? /* @__PURE__ */ g(
              dn,
              {
                className: xd,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: w(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && Pr(b) ? /* @__PURE__ */ g(
              dn,
              {
                className: Pd,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (S) => {
                  S.preventDefault(), S.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ g(wn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            d ? /* @__PURE__ */ g(
              dn,
              {
                className: Rd,
                state: l,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: l === "copied" ? "已复制" : l === "failed" ? "复制失败" : v,
                onClick: w(d, c),
                children: /* @__PURE__ */ g(Cd, { state: l })
              }
            ) : null,
            o ? /* @__PURE__ */ g(
              dn,
              {
                className: Md,
                state: "idle",
                label: "放大看这一块",
                title: b === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (S) => {
                  S.preventDefault(), S.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ g(Oi, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Dd(e, t) {
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
function Od(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = lt(
      Dd(e, a),
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
const zd = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Fd = 256, Ft = /* @__PURE__ */ new Map();
function Bd(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function vs(e) {
  const t = `${e || ""}`, { text: n, slots: r } = ic(t, { bareLatex: !0 }), o = Bd(n), a = cc(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Ft.get(t);
  if (!s && (s = lc(o, r), Ft.set(t, s), Ft.size > Fd)) {
    const i = Ft.keys().next().value;
    i !== void 0 && Ft.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function On(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Je(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function jd(e, t) {
  const n = e.typography, r = Je(t) || 1, o = Je(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = On(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, l = Math.max(5.5 * r, Math.min(s, i * r)), c = Je(n == null ? void 0 : n.fit_min_font_size_pt), u = Je(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (c || 5.5) * r), m = Math.max(
    f,
    u ? u * r : o ? o * r : l
  ), h = o ? o * r : l, p = Je(n == null ? void 0 : n.leading_em), d = [
    Je(n == null ? void 0 : n.padding_top_pt) || 0,
    Je(n == null ? void 0 : n.padding_right_pt) || 0,
    Je(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Je(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((b) => b * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || zd,
    fontSizePx: Math.max(f, Math.min(m, h)),
    minFontSizePx: f,
    maxFontSizePx: m,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: p ? 1 + p : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (On(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : On(e.kind) ? "center" : "justify",
    padding: d,
    exact: !!o
  };
}
function Hd(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (f) => {
    const m = s.get(f);
    if (m !== void 0) return m;
    const { width: h, height: p } = e(f), d = h <= t + 0.5 && p <= n + 0.5;
    return s.set(f, d), d;
  };
  let l = o, c = a, u = Math.min(r.requestedFontSizePx, c);
  if (i(u)) {
    if (!r.exact) {
      l = u;
      for (let f = 0; f < 6 && c > l; f += 1) {
        const m = (l + c) / 2;
        i(m) ? (u = m, l = m) : c = m;
      }
    }
  } else {
    c = u, u = l;
    for (let f = 0; f < 8 && c > l; f += 1) {
      const m = (l + c) / 2;
      i(m) ? (u = m, l = m) : c = m;
    }
  }
  return Math.max(o, u);
}
const Ud = 512, Bt = /* @__PURE__ */ new Map();
let nr = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  nr += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  nr += 1;
}));
function Wd(e, t, n, r) {
  return [
    nr,
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
function Mr({ item: e, pageScale: t }) {
  const n = N(null), r = U(
    () => vs(e.translatedText),
    [e.translatedText]
  ), [o, a] = x(r.fallbackHtml), s = U(
    () => jd(e, t),
    [e, t]
  );
  D(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((m) => {
      f && a(m);
    }), () => {
      f = !1;
    };
  }, [r]), Le(() => {
    const f = n.current;
    if (!f) return;
    const [m, h, p, d] = s.padding, b = Math.max(1, e.rect.width - d - h), w = Math.max(1, e.rect.height - m - p), v = Wd(o, b, w, s);
    let y = Bt.get(v);
    if (y === void 0 && (y = Hd(
      (k) => (f.style.fontSize = `${k}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      b,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Bt.set(v, y), Bt.size > Ud)) {
      const k = Bt.keys().next().value;
      k !== void 0 && Bt.delete(k);
    }
    f.style.fontSize = `${y.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [i, l, c, u] = s.padding;
  return /* @__PURE__ */ g(
    "div",
    {
      className: `reader-live-translation-item${e.changedNow ? " is-changed" : ""}`,
      "data-live-translation-item": e.itemId,
      "data-live-translation-kind": e.kind,
      "data-live-translation-status": e.status,
      "data-live-translation-typography": s.exact ? "typst" : "fitted",
      style: {
        ...e.rect,
        padding: `${i}px ${l}px ${c}px ${u}px`
      },
      children: /* @__PURE__ */ g(
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
function Kd({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = U(
    () => Od(e, t, n, r),
    [r, e, t, n]
  );
  return o.length ? /* @__PURE__ */ g(
    "div",
    {
      className: "reader-live-translation-overlay",
      "data-live-translation-page": e == null ? void 0 : e.page_idx,
      "data-live-translation-generation": t == null ? void 0 : t.generation,
      "aria-hidden": "true",
      children: o.map((a) => /* @__PURE__ */ g(
        Mr,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Vd = nn(Kd);
function qd({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ g("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ C("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ g(
        Mr,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Ce(a.highlight.region),
            sourceText: a.highlight.box.text || "",
            rect: a.rect,
            changedAtSeq: 0,
            changedNow: !1
          },
          pageScale: s > 0 ? n / s : 1
        }
      ),
      /* @__PURE__ */ g("span", { className: "reader-edited-badge", style: { left: a.rect.left, top: a.rect.top }, children: "待排版" })
    ] }, a.itemId);
  }) }) : null;
}
const Jd = nn(qd), ws = 24, ot = ws * 2 + 4, Ge = 24, Gd = 4, Xd = 6, ht = (e) => e.left + e.width, ct = (e) => e.top + e.height;
function Kt(e, t) {
  const n = Math.min(ht(e), ht(t)) - Math.max(e.left, t.left), r = Math.min(ct(e), ct(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Eo = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= ht(t) && r >= t.top && r <= ct(t);
}, Yd = (e) => e.height > 40 && e.height > e.width * 2.5;
function Zd(e, t, n) {
  if (!t.length || e.height < Ge || e.width < n + 8) return null;
  const r = Math.max(...t.map(ct)), o = ht(e) - 4 - n;
  for (const a of [r, ct(e) - 2]) {
    const s = Math.max(e.top, a - Ge), i = { left: o, top: s, width: n, height: Ge };
    if (!t.some((l) => Kt(i, l) > 0)) return s - e.top;
  }
  return null;
}
function Qd(e, t) {
  const n = [], r = (a) => {
    const s = ws + Gd, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: ht(e), top: i, width: s, height: ot } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: ot } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Ge - 3, width: ot, height: Ge + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: ct(e), width: ot, height: Ge + 3 } }), r(!0);
  const o = Zd(e, t, ot);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: ht(e) - 4 - ot, top: e.top + o, width: ot, height: Ge } }), n;
}
function ef(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((v) => v.width > 0 && v.height > 0 && !Yd(v)), i = s.filter((v) => Eo(v, t)), l = s.filter((v) => !Eo(v, t)), c = n.filter((v) => v !== t && Kt(v, t) < t.width * t.height * 0.5), u = Qd(t, i).filter(({ box: v, overhang: y }) => {
    const k = y ? Xd : 0;
    return v.left >= -k && ht(v) <= r + k && v.top >= 0 && ct(v) <= o;
  }), f = ({ placement: v, tailTop: y }) => y === void 0 ? { placement: v } : { placement: v, tailTop: y }, m = ({ box: v }) => !l.some((y) => Kt(v, y) > 0), h = u.filter((v) => v.placement !== "tail"), p = h.find((v) => m(v) && !c.some((y) => Kt(v.box, y) > 0));
  if (p) return f(p);
  const d = h.find(m) || u.find((v) => v.placement === "tail" && m(v));
  if (d) return f(d);
  let b = null, w = Number.POSITIVE_INFINITY;
  for (const v of u) {
    const y = l.reduce((k, S) => k + Kt(v.box, S), 0);
    y < w && (b = v, w = y);
  }
  return b ? f(b) : { placement: "outside" };
}
function tf(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Ge - 3 : ct(r);
  return t >= r.left - 4 && t <= r.left + ot + 4 && n >= a && n <= a + Ge + 3;
}
const zn = (e) => e.left + e.width, Fn = (e) => e.top + e.height;
function nf(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const c of t) {
    if (c.width <= 0 || c.height <= 0) continue;
    const u = c.left + c.width / 2, f = c.top + c.height / 2;
    u < e.left || u > zn(e) || f < e.top || f > Fn(e) || (o = Math.min(o, c.left), a = Math.min(a, c.top), s = Math.max(s, zn(c)), i = Math.max(i, Fn(c)));
  }
  if (!Number.isFinite(o)) return e;
  const l = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return l.width = Math.min(zn(e) + r, s + n) - l.left, l.height = Math.min(Fn(e) + r, i + n) - l.top, l.width * l.height < e.width * e.height * 0.3 && l.height < 24 ? e : l;
}
function rf(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function of(e, t, n, r) {
  const [o, a] = x(null);
  return Le(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? rf(s) : [], l = Ce(t.highlight.region) === "figure", c = i.length && !l ? nf(t.rect, i) : t.rect, u = n.filter((m) => m.itemId !== t.itemId).map((m) => m.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: c, ...ef({ frame: c, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
function af({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = x(null), [i, l] = x(!1), [c, u] = x([]), [f, m] = x(""), [h, p] = x(""), [d, b] = x(!1), [w, v] = x(null), [y, k] = x([]), S = r.drafts, R = r.generation, E = L(async (T, I) => {
    if (e)
      try {
        u(fd(await e.fetchRevisions(T, I)));
      } catch {
        u([]);
      }
  }, [e]);
  D(() => {
    if (s(null), u([]), v(null), k([]), p(""), !e || !t || !n) return;
    let T = !1;
    return l(!0), e.loadItem(t, n).then((I) => {
      if (T) return;
      const M = I == null ? void 0 : I.item;
      if (!M) throw new Error("找不到这一段的译文。");
      const $ = `${(I == null ? void 0 : I.item_id) || n}`, { source: z, translated: K } = ud(M);
      s({ readerItemId: n, itemId: $, source: z, current: K }), m(S.get(n) ?? K);
    }).catch((I) => {
      T || v({ tone: "error", message: (I == null ? void 0 : I.message) || "读取这段译文失败。" });
    }).finally(() => {
      T || l(!1);
    }), E(t, n), () => {
      T = !0;
    };
  }, [e, t, n, E]);
  const P = L((T) => {
    m(T), n && S.set(n, T);
  }, [n, S]), O = L(async (T, I) => {
    if (!e || !a || d) return !1;
    const M = T ?? f;
    if (!M.trim()) return !1;
    b(!0), v(null), k([]);
    try {
      const $ = await e.revise(t, a.itemId, {
        translated_text: M,
        source: "user",
        reason: (I ?? h).trim() || "在阅读页手动修改",
        ...R.current != null ? { expected_generation: R.current } : {}
      }), z = Number($ == null ? void 0 : $.generation);
      return Number.isFinite(z) && (R.current = z), S.delete(a.readerItemId), s({ ...a, current: M }), m(M), p(""), ($ == null ? void 0 : $.changed) === !1 ? v({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, M), v({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), E(t, a.readerItemId), !0;
    } catch ($) {
      const z = $;
      return (z == null ? void 0 : z.reason) === "generation_mismatch" && (R.current = null), v({ tone: "error", message: (z == null ? void 0 : z.message) || "保存失败，请稍后再试。" }), k(yd(z == null ? void 0 : z.issues)), !1;
    } finally {
      b(!1);
    }
  }, [e, a, d, f, h, t, o, E, S, R]), _ = L(() => {
    n && S.delete(n);
  }, [n, S]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: c,
    draft: f,
    setDraft: P,
    reason: h,
    setReason: p,
    saving: d,
    status: w,
    issues: y,
    save: O,
    discardDraft: _
  };
}
const Ss = "reader-inline-edit";
function sf({ text: e }) {
  const [t, n] = x("");
  return D(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = vs(e);
      n(a.fallbackHtml), a.richHtml.then((s) => {
        r && n(s);
      });
    }, 250);
    return () => {
      r = !1, window.clearTimeout(o);
    };
  }, [e]), t ? /* @__PURE__ */ C("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ g("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ g("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function cf({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var _;
  const s = e.itemId, i = af({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [l, c] = x(!1), [u, f] = x(!1), m = N(null), h = kd(e.rect, t), p = U(() => vd(o), [o]), d = p.indexOf(s), { loaded: b } = i, w = i.saving || i.loading, v = n.blockedReason, y = !b || i.draft === b.current, { close: k, select: S } = n, R = L((T) => {
    const I = p[d + T];
    I && (S(I), a == null || a(I));
  }, [p, d, S, a]), E = L(() => {
    i.discardDraft(), k();
  }, [i, k]), P = L(async (T, I) => {
    await i.save(T, I) && k();
  }, [i, k]);
  D(() => {
    const T = (I) => {
      !I.altKey || I.key !== "ArrowUp" && I.key !== "ArrowDown" || (I.preventDefault(), R(I.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", T), () => window.removeEventListener("keydown", T);
  }, [R]), Le(() => {
    const T = m.current;
    if (!T) return;
    T.style.height = "auto";
    const I = h.mode === "inline" ? h.minHeight : 0;
    T.style.height = `${Math.max(I, T.scrollHeight + 2)}px`;
  }, [i.draft, b, h.mode, h.mode === "inline" ? h.minHeight : 0]);
  const O = h.mode === "inline" ? { left: h.left, top: h.top, width: h.width } : { left: h.left, width: h.width, top: h.top, bottom: h.bottom };
  return /* @__PURE__ */ C(Re, { children: [
    h.mode === "popout" ? /* @__PURE__ */ g("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ C(
      "div",
      {
        className: `${Ss} is-${h.mode}`,
        style: O,
        role: "group",
        "aria-label": `改第 ${((_ = n.target) == null ? void 0 : _.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": h.mode,
        onPointerDown: (T) => T.stopPropagation(),
        children: [
          r && (b != null && b.source) ? /* @__PURE__ */ g(
            G,
            {
              className: `reader-inline-edit-source${l ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: l ? "收起原文" : "展开原文",
              onClick: () => c((T) => !T),
              children: b.source
            }
          ) : null,
          v ? /* @__PURE__ */ g("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: v }) : null,
          i.loading ? /* @__PURE__ */ g("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          b ? /* @__PURE__ */ g(
            sc,
            {
              ref: m,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: w || !!v,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (T) => i.setDraft(T.target.value),
              onKeyDown: (T) => {
                T.key === "Enter" && (T.metaKey || T.ctrlKey) ? (T.preventDefault(), y || P()) : T.key === "Escape" && (T.preventDefault(), E());
              }
            }
          ) : null,
          b ? /* @__PURE__ */ g(sf, { text: i.draft }) : null,
          /* @__PURE__ */ C("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ g(dt, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: d <= 0, onClick: () => R(-1), children: /* @__PURE__ */ g(zi, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ g(dt, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: d < 0 || d >= p.length - 1, onClick: () => R(1), children: /* @__PURE__ */ g(Sn, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ g(
              vr,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!v || !b,
                onChange: (T) => i.setReason(T.target.value),
                onKeyDown: (T) => {
                  T.key === "Enter" ? (T.preventDefault(), y || P()) : T.key === "Escape" && (T.preventDefault(), E());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ C(
              G,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => f((T) => !T),
                children: [
                  /* @__PURE__ */ g(Fi, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ g(G, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: E, children: "取消" }),
            /* @__PURE__ */ g(
              G,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: w || !!v || y || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  P();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ g("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ g("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((T) => /* @__PURE__ */ g("li", { children: T }, T)) }) : null,
          u && b && i.history.length ? /* @__PURE__ */ g("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((T, I) => {
            const M = T.text === b.current, $ = [md(T.ts), T.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ C("li", { "data-block-edit-history": T.label, "data-current": M ? "true" : void 0, children: [
              /* @__PURE__ */ C("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ C("span", { children: [
                  $,
                  M ? "（现在用的）" : "",
                  T.reason ? ` · ${T.reason}` : ""
                ] }),
                M ? null : /* @__PURE__ */ g(
                  G,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!v,
                    onClick: () => {
                      P(T.text, `回到「${$.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ g("p", { className: "reader-inline-edit-history-text", children: T.text })
            ] }, `${T.ts}:${I}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const ks = rn(null), Ts = rn(null);
function lf({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ g(ks.Provider, { value: e, children: /* @__PURE__ */ g(Ts.Provider, { value: t, children: n }) });
}
function Be() {
  return ft(ks);
}
function xr() {
  return ft(Ts);
}
const Is = 1.414;
function uf({
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
  sentinelRef: u,
  regionHighlight: f = null,
  regionTargets: m = [],
  hoveredRegionId: h,
  onHoverRegion: p,
  liveTranslationLayout: d,
  liveTranslationPage: b,
  showLiveTranslation: w = r === "source",
  liveTranslationMissing: v = !1
}) {
  var Z, fe;
  const y = Be(), k = y == null ? void 0 : y.revisedBlocks, S = y == null ? void 0 : y.blockEdit, R = S == null ? void 0 : S.pendingEdits, E = y == null ? void 0 : y.editBlock, P = (y == null ? void 0 : y.findTerm) || "", O = r === "translated" ? "translated" : y != null && y.compareVersion ? "compare" : "source", _ = y == null ? void 0 : y.textMarks, T = U(
    () => _ ? ({ str: A }) => id(A, _(A), P) : P ? ({ str: A }) => Wt(A, P) : void 0,
    [P, _]
  ), I = N(l ?? Is), [M, $] = x(I.current);
  D(() => {
    l != null && Math.abs(l - I.current) >= 1e-3 && (I.current = l, $(l));
  }, [l]);
  const z = N(u);
  z.current = u;
  const K = N(null), H = N((A) => {
    var j;
    K.current = A, (j = z.current) == null || j.call(z, A);
  }).current, J = N(null), oe = N(`${t}@${n}`);
  Le(() => {
    const A = `${t}@${n}`;
    oe.current !== A && (oe.current = A, o && ff(K.current, J.current));
  }, [o, n, t]), D(() => {
    o || Bn(J.current);
  }, [o]), D(() => () => Bn(J.current), []);
  const q = Math.max(120, Math.floor(t * M)), se = Math.max(q, Math.ceil(s || 0)), Ee = lt(f, t, q), re = U(
    () => Id(m, t, q),
    [q, m, t]
  ), [ue, xe] = x(null), ie = typeof p == "function", le = ie ? h ?? null : ue, B = (A) => {
    ie ? A !== (h ?? null) && (p == null || p(A)) : xe((j) => j === A ? j : A);
  }, W = U(
    () => re.find((A) => A.itemId === le) || null,
    [le, re]
  ), Y = r === "translated" && ((Z = S == null ? void 0 : S.target) == null ? void 0 : Z.itemId) || "", de = U(
    () => Y && re.find((A) => A.itemId === Y) || null,
    [Y, re]
  ), ne = of(K, o ? W : null, re, t), ae = (A) => {
    var Te, _e, ze, je;
    if (A.pointerType === "touch") return;
    if (y != null && y.pointerTaken) {
      B(null);
      return;
    }
    if (A.buttons !== 0) {
      B(null);
      return;
    }
    if ((_e = (Te = A.target) == null ? void 0 : Te.closest) != null && _e.call(Te, `.${bs}`) || (je = (ze = A.target) == null ? void 0 : ze.closest) != null && je.call(ze, `.${Ss}`)) return;
    const j = A.currentTarget.getBoundingClientRect(), V = A.clientX - j.left, me = A.clientY - j.top;
    if (tf(ne, V, me)) return;
    const ye = Io(re, V, me);
    B((ye == null ? void 0 : ye.itemId) || null);
  }, ke = (A) => {
    if (A.pointerType === "mouse") return;
    const j = A.currentTarget.getBoundingClientRect(), V = Io(
      re,
      A.clientX - j.left,
      A.clientY - j.top
    );
    B((V == null ? void 0 : V.itemId) || null);
  }, ee = (A) => {
    !Number.isFinite(A) || A <= 0 || Math.abs(I.current - A) < 1e-3 || (I.current = A, $(A), c == null || c(e, A));
  };
  return /* @__PURE__ */ C(
    "div",
    {
      ref: H,
      [Ie]: e,
      [Se]: r,
      [kr]: q,
      className: Tr,
      onPointerMoveCapture: ae,
      onPointerDown: ke,
      onDoubleClick: (A) => {
        const j = y == null ? void 0 : y.zoomBlock;
        !j || y != null && y.pointerTaken || !W || Ce(W.highlight.region) === "figure" && (A.preventDefault(), j(W.itemId));
      },
      onPointerLeave: (A) => {
        A.pointerType === "mouse" && B(null);
      },
      style: {
        width: t,
        height: se,
        minHeight: se
      },
      children: [
        o ? /* @__PURE__ */ g(
          dc,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: T,
            renderAnnotationLayer: !1,
            className: Za,
            loading: /* @__PURE__ */ g(
              "div",
              {
                className: In,
                style: { width: t, height: q }
              }
            ),
            onLoadSuccess: (A) => {
              try {
                const j = A.getViewport({ scale: 1 });
                if (j.width > 0) {
                  const V = j.height / j.width;
                  ee(V);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Bn(J.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ g(
          "div",
          {
            className: In,
            style: { width: t, height: q },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ g("div", { ref: J, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        Ee ? /* @__PURE__ */ g(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: Ee,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ g(
          Vd,
          {
            layoutPage: d,
            pageState: b,
            width: t,
            height: q
          }
        ) : null,
        o && w && v ? /* @__PURE__ */ g("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (R != null && R.size) ? /* @__PURE__ */ g(Jd, { targets: re, edits: R, width: t, excludeId: de == null ? void 0 : de.itemId }) : null,
        o && de && S ? /* @__PURE__ */ g(
          cf,
          {
            target: de,
            page: { width: t, height: q },
            edit: S,
            showSource: !!(y != null && y.editShowsSource),
            regions: y == null ? void 0 : y.regions,
            jumpToBlock: y == null ? void 0 : y.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (k != null && k.size) ? /* @__PURE__ */ g("div", { className: "reader-revised-markers", "aria-hidden": "true", children: re.filter((A) => k.has(A.itemId)).map((A) => /* @__PURE__ */ g(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": A.itemId,
            style: { left: A.rect.left, top: A.rect.top, height: A.rect.height }
          },
          A.itemId
        )) }) : null,
        (fe = y == null ? void 0 : y.pageLayers) == null ? void 0 : fe.map((A) => /* @__PURE__ */ g(xn, { children: A.render({ page: e, width: t, height: q, pane: O, active: o }) }, A.id)),
        /* @__PURE__ */ g(
          $d,
          {
            target: o && !(y != null && y.pointerTaken) && (W == null ? void 0 : W.itemId) !== (de == null ? void 0 : de.itemId) ? W : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: W && (k == null ? void 0 : k.get(W.itemId)) || 0,
            onEdit: E,
            onZoom: y == null ? void 0 : y.zoomBlock,
            frameRect: ne == null ? void 0 : ne.rect,
            placement: ne == null ? void 0 : ne.placement,
            tailTop: ne == null ? void 0 : ne.tailTop
          }
        )
      ]
    }
  );
}
const df = nn(uf);
function ff(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function Bn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const Es = 2 * 1024 * 1024;
function Rs(e) {
  const t = new kn.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const jn = 5, mf = "120% 0px", hf = 120, pf = "25% 0px";
let Ro = 1;
const Po = /* @__PURE__ */ new WeakMap();
function gf(e) {
  if (!e) return 0;
  const t = Po.get(e);
  if (t) return t;
  const n = Ro;
  return Ro += 1, Po.set(e, n), n;
}
function yf() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const bf = wi(
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
    onMetrics: u,
    onLoadSuccess: f,
    onOutline: m,
    onDocument: h,
    onLoadError: p,
    onNumPagesChange: d,
    activeRegion: b = null,
    regions: w = [],
    readerMetadata: v = null,
    hoveredRegionId: y = null,
    onHoverRegion: k,
    liveTranslation: S,
    showLiveTranslation: R = t === "source",
    liveTranslationPendingLabel: E = "",
    paneAction: P
  }, O) {
    ps();
    const { file: _, loading: T, error: I } = qc(n, r), M = `${n}\0${gf(_)}`, $ = N(M);
    $.current = M;
    const z = U(() => {
      const F = jc(_);
      return F ? "ranged" in F ? { range: Rs(F.ranged) } : F : null;
    }, [_, n]), [K, H] = x(0), [J, oe] = x(""), [q, se] = x(null), [Ee, re] = x(480), ue = N(null), xe = N(0), ie = U(() => yf(), []), le = U(() => ({
      cMapUrl: _t().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: _t().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: Es,
      disableAutoFetch: !0
    }), []);
    yr(O, () => q, [q]), D(() => {
      const F = (X) => {
        xe.current = X, re(X);
      }, Q = (X) => {
        const pe = hl(X, xe.current);
        if (pe !== "ignore") {
          if (ue.current && clearTimeout(ue.current), pe === "immediate") {
            F(X);
            return;
          }
          ue.current = setTimeout(() => F(X), rs);
        }
      }, te = !!(l && l >= 80);
      Q(te ? l : (i == null ? void 0 : i.clientWidth) || 0);
      const ge = !te && i && typeof ResizeObserver < "u" ? new ResizeObserver((X) => {
        var pe, Pe;
        Q(((Pe = (pe = X[0]) == null ? void 0 : pe.contentRect) == null ? void 0 : Pe.width) ?? i.clientWidth);
      }) : null;
      return ge && i && ge.observe(i), () => {
        ge == null || ge.disconnect(), ue.current && clearTimeout(ue.current);
      };
    }, [l, i, a]);
    const B = U(
      () => dl(Ee, o),
      [Ee, o]
    ), [W, Y] = x(() => /* @__PURE__ */ new Map()), [de, ne] = x(() => /* @__PURE__ */ new Set()), [ae, ke] = x(() => /* @__PURE__ */ new Set()), ee = N(/* @__PURE__ */ new Map()), Z = N(null), fe = N(null), [A, j] = x(() => /* @__PURE__ */ new Set()), V = N(/* @__PURE__ */ new Map()), me = L((F, Q) => {
      Y((te) => {
        if (te.get(F) === Q) return te;
        const ce = new Map(te);
        return ce.set(F, Q), ce;
      });
    }, []), ye = L((F, Q) => {
      const te = ee.current, ce = te.get(F), ge = [Z.current, fe.current];
      if (ce)
        for (const X of ge)
          try {
            X == null || X.unobserve(ce);
          } catch {
          }
      if (Q) {
        te.set(F, Q);
        for (const X of ge)
          try {
            X == null || X.observe(Q);
          } catch {
          }
      } else
        te.delete(F);
    }, []), Te = N(/* @__PURE__ */ new Map()), _e = L((F) => {
      const Q = Te.current;
      let te = Q.get(F);
      return te || (te = (ce) => ye(F, ce), Q.set(F, te)), te;
    }, [ye]);
    D(() => {
      if (typeof IntersectionObserver > "u") return;
      const F = V.current, Q = new IntersectionObserver(
        (te) => {
          const ce = [], ge = [];
          for (const X of te) {
            const pe = X.target, Pe = Rn(pe);
            Number.isFinite(Pe) && (X.isIntersecting ? ce : ge).push(Pe);
          }
          if ((ce.length || ge.length) && ne((X) => {
            let pe = null;
            for (const Pe of ce)
              X.has(Pe) || (pe = pe || new Set(X), pe.add(Pe));
            for (const Pe of ge)
              X.has(Pe) && (pe = pe || new Set(X), pe.delete(Pe));
            return pe || X;
          }), ce.length) {
            for (const X of ce) {
              const pe = F.get(X);
              pe && (clearTimeout(pe), F.delete(X));
            }
            ke((X) => {
              let pe = null;
              for (const Pe of ce)
                X.has(Pe) || (pe = pe || new Set(X), pe.add(Pe));
              return pe || X;
            });
          }
          for (const X of ge)
            F.has(X) || F.set(X, setTimeout(() => {
              F.delete(X), ke((pe) => {
                if (!pe.has(X)) return pe;
                const Pe = new Set(pe);
                return Pe.delete(X), Pe;
              });
            }, hf));
        },
        { root: i, rootMargin: mf, threshold: 0 }
      );
      Z.current = Q;
      for (const te of ee.current.values())
        try {
          Q.observe(te);
        } catch {
        }
      return () => {
        Q.disconnect(), Z.current === Q && (Z.current = null);
        for (const te of F.values()) clearTimeout(te);
        F.clear();
      };
    }, [i]), D(() => {
      if (typeof IntersectionObserver > "u") return;
      const F = new IntersectionObserver(
        (Q) => {
          j((te) => {
            let ce = null;
            for (const ge of Q) {
              const X = Rn(ge.target);
              !Number.isFinite(X) || ge.isIntersecting === te.has(X) || (ce = ce || new Set(te), ge.isIntersecting ? ce.add(X) : ce.delete(X));
            }
            return ce || te;
          });
        },
        { root: i, rootMargin: pf, threshold: 0 }
      );
      fe.current = F;
      for (const Q of ee.current.values())
        try {
          F.observe(Q);
        } catch {
        }
      return () => {
        F.disconnect(), fe.current === F && (fe.current = null);
      };
    }, [i]);
    const ze = !!i && typeof IntersectionObserver < "u";
    Le(() => {
      H(0), oe(""), ne(/* @__PURE__ */ new Set()), ke(/* @__PURE__ */ new Set()), Y(/* @__PURE__ */ new Map()), ee.current.clear();
      const F = V.current;
      for (const Q of F.values()) clearTimeout(Q);
      F.clear(), d == null || d(0, t);
    }, [M, d, t]);
    const je = L(
      (F) => {
        if ($.current !== M) return;
        const Q = F.numPages;
        H(Q), oe(""), d == null || d(Q, t), f == null || f({ numPages: Q, pane: t }), h && typeof F.getPage == "function" && h(F, t), m && typeof F.getOutline == "function" && qu(F).then((te) => {
          $.current === M && m(te, t);
        }, () => {
        });
      },
      [M, f, m, h, d, t]
    ), Qe = L(
      (F) => {
        if ($.current !== M) return;
        const Q = (F == null ? void 0 : F.message) || "PDF 解析失败";
        oe(Q), H(0), d == null || d(0, t), p == null || p(F, t);
      },
      [M, p, d, t]
    ), $e = U(
      () => K > 0 ? Array.from({ length: K }, (F, Q) => Q + 1) : [],
      [K]
    );
    D(() => {
      typeof IntersectionObserver < "u" || ke(new Set($e));
    }, [$e]);
    const Ke = U(
      () => mt(b, v, t),
      [b, v, t]
    ), et = U(() => {
      const F = /* @__PURE__ */ new Map();
      for (const Q of w) {
        const te = mt(Q, v, t);
        if (!te) continue;
        const ce = F.get(te.box.page) || [];
        ce.push(te), F.set(te.box.page, ce);
      }
      return F;
    }, [t, v, w]), tt = U(() => {
      const F = /* @__PURE__ */ new Set();
      if (!y) return F;
      for (const [Q, te] of et)
        te.some((ce) => ce.itemId === y) && F.add(Q);
      return F;
    }, [y, et]), St = U(() => {
      if (K === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set($e);
      if (de.size === 0) {
        const te = Math.min(K, jn * 2 + 1);
        return new Set(Array.from({ length: te }, (ce, ge) => ge + 1));
      }
      const Q = /* @__PURE__ */ new Set();
      for (const te of de)
        for (let ce = -jn; ce <= jn; ce++) {
          const ge = te + ce;
          ge >= 1 && ge <= K && Q.add(ge);
        }
      return Q;
    }, [K, $e, i, a, de]), nt = !n || !!I || !!J, be = n && (I || J) || s;
    return /* @__PURE__ */ C(
      "section",
      {
        ref: se,
        className: `reader-panel ${on}${a ? "" : " is-hidden"}`,
        [Se]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (S == null ? void 0 : S.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          P ? /* @__PURE__ */ g("div", { className: "reader-react-pdf-pane-action", children: P }) : null,
          E ? /* @__PURE__ */ C("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ g("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ g("span", { children: E })
          ] }) : null,
          nt && !T ? /* @__PURE__ */ g("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: be }) : null,
          T ? /* @__PURE__ */ g("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          z && !I ? /* @__PURE__ */ g("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ g(
            fc,
            {
              file: z,
              loading: null,
              error: null,
              options: le,
              onLoadSuccess: je,
              onLoadError: Qe,
              className: "reader-react-pdf-document",
              children: $e.map((F) => {
                if (St.has(F))
                  return /* @__PURE__ */ g(
                    df,
                    {
                      pane: t,
                      pageNumber: F,
                      width: B,
                      devicePixelRatio: ie,
                      active: ae.has(F),
                      textLayer: !ze || A.has(F),
                      syncedMinHeight: (c == null ? void 0 : c.get(F)) || 0,
                      onMetrics: u,
                      cachedAspect: W.get(F),
                      onAspectChange: me,
                      sentinelRef: _e(F),
                      regionHighlight: (Ke == null ? void 0 : Ke.box.page) === F ? Ke : null,
                      regionTargets: et.get(F),
                      hoveredRegionId: y && tt.has(F) ? y : null,
                      onHoverRegion: k,
                      liveTranslationLayout: S == null ? void 0 : S.layoutByPage.get(F - 1),
                      liveTranslationPage: S == null ? void 0 : S.pagesByPage.get(F - 1),
                      showLiveTranslation: R,
                      liveTranslationMissing: yu(S, F - 1)
                    },
                    `${t}-${F}`
                  );
                const te = W.get(F) ?? Is, ce = Math.max(120, Math.floor(B * te)), ge = Math.max(ce, Math.ceil((c == null ? void 0 : c.get(F)) || 0));
                return /* @__PURE__ */ g(
                  "div",
                  {
                    ref: _e(F),
                    [Ie]: F,
                    [Se]: t,
                    [kr]: ce,
                    className: `${Tr} is-placeholder`,
                    style: {
                      width: B,
                      height: ge,
                      minHeight: ge
                    },
                    children: /* @__PURE__ */ g(
                      "div",
                      {
                        className: In,
                        style: { width: B, height: ce },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${F}`
                );
              })
            },
            M
          ) }) : null
        ]
      }
    );
  }
), Mo = nn(bf), vf = 2e3, wf = 6, Sf = 500, xo = "reader-react-resizing";
function kf(e, t) {
  const n = N(null), r = N(null);
  Le(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const k = Tf(e), S = Jt(e, k);
      if (!S) return;
      s = { pane: k, progress: S, started: performance.now() };
    }
    const { pane: i, progress: l, started: c } = s;
    let u = 0, f = null, m = e.scrollHeight, h = m, p = 0, d = c;
    const b = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((k) => {
      let S = !1;
      for (const R of k) {
        const E = Math.round(R.contentRect.height);
        b.has(R.target) && b.get(R.target) !== E && (S = !0), b.set(R.target, E);
      }
      S && Nt(e, l, "auto", i);
    }), v = () => {
      var k;
      f && clearTimeout(f), cancelAnimationFrame(u), w == null || w.disconnect(), e.classList.remove(xo);
      for (const S of Ao) e.removeEventListener(S, v);
      ((k = r.current) == null ? void 0 : k.stop) === v && (r.current = null);
    }, y = () => {
      Nt(e, l, "auto", i);
      const k = e.scrollHeight;
      p = k === h ? p + 1 : 0, h = k;
      const S = performance.now() - d;
      p >= wf && (k !== m || S > Sf) || S > vf ? v() : u = requestAnimationFrame(y);
    };
    for (const k of Ao) e.addEventListener(k, v, { passive: !0 });
    for (const k of Array.from(e.children)) w == null || w.observe(k);
    e.classList.add(xo), r.current = { ...s, stop: v }, f = setTimeout(() => {
      f = null, d = performance.now(), m = e.scrollHeight, h = m, p = 0, u = requestAnimationFrame(y);
    }, rs);
  }, [e, t]), D(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Tf(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Ie}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Se) || null;
  }
  return null;
}
const Ao = ["wheel", "touchstart", "keydown", "pointerdown"];
function If(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function Ef(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(on)) && ((n = e.hasAttribute) != null && n.call(e, Se)));
}
function Rf(e, t) {
  D(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!Ef(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${on}[${Se}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const l = If(a, i);
        if (l === null || Math.abs(i.scrollLeft - l) < 1) continue;
        const c = i.scrollLeft;
        i.scrollLeft = l, Math.abs(i.scrollLeft - c) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Pf(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), l = t - i, c = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: l * c };
}
function Mf(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const _o = 12;
function Ar(e) {
  return Array.from(e.querySelectorAll(`.${on}[${Se}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function xf(e) {
  const t = e.getBoundingClientRect();
  return Ar(e).map((n) => {
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
function Af(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function _f(e, t) {
  return e ? Ar(e).find((n) => n.getAttribute(Se) === t) ?? null : null;
}
function Nf({ shellEl: e }) {
  const [t, n] = x([]), r = N(0), o = L(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = xf(e);
      n((i) => Af(i, s) ? i : s);
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
        for (const f of Ar(e))
          i.observe(f), f.firstElementChild && i.observe(f.firstElementChild);
      }
    };
    l();
    const c = s && typeof s.MutationObserver < "u" ? new s.MutationObserver(() => {
      l(), o();
    }) : null, u = e.firstElementChild;
    return c && u && c.observe(u, { childList: !0, attributes: !0, attributeFilter: ["class"], subtree: !1 }), () => {
      e.removeEventListener("scroll", o, { capture: !0 }), i == null || i.disconnect(), c == null || c.disconnect(), r.current && cancelAnimationFrame(r.current), r.current = 0;
    };
  }, [e, o]);
  const a = t.filter((s) => s.scrollWidth - s.width > 1);
  return a.length ? /* @__PURE__ */ g("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ g(Lf, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Lf({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - _o * 2), r = Pf(e, n), o = N(null);
  if (!r) return null;
  const a = (m) => {
    const h = _f(t, e.pane);
    h && (h.scrollLeft = m);
  }, s = (m) => {
    var h, p;
    m.button === 0 && (m.preventDefault(), m.stopPropagation(), (p = (h = m.currentTarget).setPointerCapture) == null || p.call(h, m.pointerId), o.current = { startX: m.clientX, startScroll: e.scrollLeft, pointerId: m.pointerId });
  }, i = (m) => {
    const h = o.current;
    !h || h.pointerId !== m.pointerId || a(h.startScroll + Mf(e, n, r.size, m.clientX - h.startX));
  }, l = (m) => {
    var h, p, d;
    ((h = o.current) == null ? void 0 : h.pointerId) === m.pointerId && (o.current = null, (d = (p = m.currentTarget).releasePointerCapture) == null || d.call(p, m.pointerId));
  }, c = (m) => {
    if (m.button !== 0 || m.target !== m.currentTarget) return;
    m.preventDefault();
    const h = m.currentTarget.getBoundingClientRect(), p = m.clientX - h.left, d = e.width * 0.8;
    a(e.scrollLeft + (p < r.offset ? -d : d));
  }, u = e.pane === "translated" ? "译文栏左右滚动" : "原文栏左右滚动", f = Math.max(0, e.scrollWidth - e.width);
  return /* @__PURE__ */ g(
    "div",
    {
      className: "reader-pane-scrollbar",
      "data-reader-pane-scrollbar": e.pane,
      role: "scrollbar",
      "aria-label": u,
      "aria-orientation": "horizontal",
      "aria-valuemin": 0,
      "aria-valuemax": Math.round(f),
      "aria-valuenow": Math.round(e.scrollLeft),
      style: { left: e.left + _o, width: n },
      onPointerDown: c,
      children: /* @__PURE__ */ g(
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
function Ps(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Cf(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function $f({ compare: e, onDone: t }) {
  return /* @__PURE__ */ C("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ g("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ g("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ g("li", { children: /* @__PURE__ */ C(
        G,
        {
          className: "reader-version-compare-item",
          "data-version-id": n.versionId,
          "aria-current": o ? "true" : void 0,
          disabled: r,
          onClick: () => {
            e.choose(n.versionId), t();
          },
          children: [
            /* @__PURE__ */ g("span", { className: "reader-version-compare-name", children: n.name }),
            /* @__PURE__ */ g("span", { className: "reader-version-compare-time", children: Ps(n.createdAt) }),
            r ? /* @__PURE__ */ g("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ g(br, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ g(Bi, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ g("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ C("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ C(
        G,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ g(za, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ C(
        G,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ g(ji, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function No({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Cf(t), a = [e === "compare" ? "对比" : "正在读", r, Ps(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ C("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ g("em", { children: "RetainPDF" }),
    /* @__PURE__ */ g("strong", { children: o }),
    /* @__PURE__ */ g("span", { children: a })
  ] });
}
function Df({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = x({ source: null, translated: null });
  return Le(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), l = (c) => {
        const u = e.querySelector(`[${Se}="${c}"]`), f = u == null ? void 0 : u.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: l("source"), translated: l("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${Se}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ C("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ g("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ g(No, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ g("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ g(No, { role: "reading", ...n }) }) : null
  ] });
}
const Of = () => () => {
}, Lo = () => null;
function zf({
  mode: e,
  compareMode: t,
  showSource: n,
  showTranslated: r,
  markdownSplit: o,
  overlayOnSource: a = !1
}) {
  return { mode: e, compareMode: t, showSource: n, showTranslated: r };
}
function Ff(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Bf(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function jf(e) {
  const t = Be(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", l = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, c = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), m = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, h = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? an, p = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, d = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), b = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, v = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, y = (t == null ? void 0 : t.compareVersion) ?? null, k = (y == null ? void 0 : y.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", S = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", R = y ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, E = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, P = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), O = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), _ = t == null ? void 0 : t.onPdfOutline, T = t == null ? void 0 : t.onPdfDocument, I = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), M = e.regions ?? (t == null ? void 0 : t.regions) ?? [], $ = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), z = (t == null ? void 0 : t.regionHover) ?? null, [K, H] = x(null), J = An(
    z ? z.subscribe : Of,
    z ? () => z.get().itemId : Lo,
    z ? () => z.get().itemId : Lo
  ), oe = z ? J : K, q = L((ue) => {
    z ? z.set(ue, "pdf") : H(ue);
  }, [z]), se = zf({
    mode: s,
    compareMode: i,
    showSource: l,
    showTranslated: c,
    markdownSplit: n,
    overlayOnSource: u
  }), re = Number.isFinite(p) && p > 0 ? Ff(
    p,
    // 对照时两栏分书页区，按书页区算（50% = 一栏）；单栏才按两倍算（50% = 铺满剩下的那一栏）。
    (n || r) && !se.compareMode,
    typeof document > "u" ? p * 2 : document.documentElement.clientWidth
  ) : null;
  return kf(m, re), Rf(m, se.compareMode), /* @__PURE__ */ C(
    "div",
    {
      ref: f,
      className: Ya,
      "data-reader-region-count": M.length,
      "data-reader-structured-region-count": M.filter(Ni).length,
      "data-reader-metadata-ready": $ ? "true" : "false",
      children: [
        /* @__PURE__ */ C(
          "main",
          {
            className: `${Xa} reader-mode-${se.mode}`,
            "data-reader-mode": se.compareMode ? s : n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              b ? /* @__PURE__ */ g(
                Mo,
                {
                  pane: "source",
                  url: k,
                  preloadedFile: R,
                  userZoom: h,
                  visible: se.showSource,
                  scrollRoot: m,
                  pageWidthOverride: re,
                  rowHeights: se.compareMode ? d : void 0,
                  onMetrics: P,
                  emptyLabel: v ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: O,
                  onOutline: y ? void 0 : _,
                  onDocument: y ? void 0 : T,
                  activeRegion: I,
                  regions: (y == null ? void 0 : y.regions) ?? M,
                  readerMetadata: $,
                  hoveredRegionId: oe,
                  onHoverRegion: q,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? Bf(o) : "",
                  paneAction: u && se.showTranslated ? /* @__PURE__ */ C(Re, { children: [
                    e.sourcePaneAction,
                    /* @__PURE__ */ g(
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
                y ? `compare:${y.url}` : "source"
              ) : null,
              w ? /* @__PURE__ */ g(
                Mo,
                {
                  pane: "translated",
                  url: S,
                  preloadedFile: E,
                  userZoom: h,
                  visible: se.showTranslated,
                  scrollRoot: m,
                  pageWidthOverride: re,
                  rowHeights: se.compareMode ? d : void 0,
                  onMetrics: P,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: O,
                  onOutline: _,
                  onDocument: T,
                  activeRegion: I,
                  regions: M,
                  readerMetadata: $,
                  hoveredRegionId: oe,
                  onHoverRegion: q,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ g(Nf, { shellEl: m }),
        y ? /* @__PURE__ */ g(Df, { shellEl: m, left: y.left, right: y.right }) : null
      ]
    }
  );
}
const Hf = 72, fn = 1500, Uf = 2e3, Wf = 1200;
function Kf(e, t) {
  return e - t < Hf;
}
function Vf(e) {
  try {
    return e.matches(":focus-visible");
  } catch {
    return !1;
  }
}
function qf(e, t) {
  const [n, r] = x(!0), o = N(null), a = N(!1), s = N(!1), i = L(() => {
    o.current !== null && (window.clearTimeout(o.current), o.current = null);
  }, []), l = L((u) => {
    i(), o.current = window.setTimeout(() => {
      o.current = null, s.current || r(!1);
    }, u);
  }, [i]);
  D(() => {
    var k;
    const u = (k = e.current) == null ? void 0 : k.parentElement;
    if (!u) return;
    let f = u.getBoundingClientRect().top;
    const m = () => {
      f = u.getBoundingClientRect().top;
    }, h = (S) => {
      S.pointerType !== "touch" && (Kf(S.clientY, f) ? a.current || (a.current = !0, i(), r(!0)) : a.current && (a.current = !1, l(fn)));
    }, p = () => {
      a.current && (a.current = !1, l(fn));
    }, d = (S) => {
      s.current = S.target instanceof Element && Vf(S.target), s.current && (i(), r(!0));
    }, b = (S) => {
      var P;
      const R = S.relatedTarget;
      if (R instanceof Node && ((P = e.current) != null && P.contains(R))) return;
      const E = s.current;
      s.current = !1, E && !a.current && l(fn);
    }, w = () => {
      a.current || (r(!0), l(fn));
    }, v = () => {
      s.current = !1;
    }, y = e.current;
    return l(Uf), y == null || y.addEventListener("focusin", d), y == null || y.addEventListener("focusout", b), y == null || y.addEventListener("pointerdown", v), u.addEventListener("scroll", w, { capture: !0, passive: !0 }), u.addEventListener("pointerenter", m), u.addEventListener("pointermove", h, { passive: !0 }), u.addEventListener("pointerleave", p), window.addEventListener("resize", m), () => {
      i(), y == null || y.removeEventListener("focusin", d), y == null || y.removeEventListener("focusout", b), y == null || y.removeEventListener("pointerdown", v), u.removeEventListener("scroll", w, { capture: !0 }), u.removeEventListener("pointerenter", m), u.removeEventListener("pointermove", h), u.removeEventListener("pointerleave", p), window.removeEventListener("resize", m);
    };
  }, [e, i, l]);
  const c = N(t);
  return D(() => {
    c.current !== t && (c.current = t, !a.current && (r(!0), l(Wf)));
  }, [t, l]), n;
}
const Jf = [
  { id: "source", label: "原文", Icon: Fa },
  { id: "compare", label: "对照", Icon: Ba },
  { id: "translated", label: "译文", Icon: ja }
];
function Gf(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Xf(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Yf(e) {
  const t = Be(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, l = a ? Gf(a.state) : "", c = N(null), u = qf(c, n);
  return (
    // 浮在书页区顶上（2026-11-28 用户：「顶部的 bar 不要保留了，用悬浮的方式……更有沉浸感」）：
    // 这一层本身透明、不接点击，只有左上的胶囊和正中的页签接；左右两段同宽，页签在书页区正中。
    // 读的时候藏着，鼠标到书页区顶上才出来（use-topbar-reveal.ts；不藏的几种在 chrome.css）。
    /* @__PURE__ */ C("header", { className: "reader-workspace-bar", ref: c, "data-revealed": u ? "true" : "false", children: [
      /* @__PURE__ */ g("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
      /* @__PURE__ */ g("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
      e.start ? /* @__PURE__ */ g("div", { className: "reader-workspace-start", children: e.start }) : null,
      /* @__PURE__ */ C("div", { className: "reader-workspace-center", children: [
        /* @__PURE__ */ g("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Jf.map(({ id: f, label: m, Icon: h }) => {
          const p = n === f, d = Xf({
            id: f,
            documentReady: r,
            sourceViewOnly: i,
            liveTranslationAvailable: !!a
          });
          return /* @__PURE__ */ C(xn, { children: [
            /* @__PURE__ */ g(
              "button",
              {
                type: "button",
                className: `reader-workspace-tab${p ? " is-active" : ""}`,
                role: "tab",
                "aria-selected": p,
                "aria-label": m,
                title: d ? `${m} 需要文档任务` : m,
                disabled: d,
                onClick: () => o(f),
                children: /* @__PURE__ */ g(h, { ...Me, "aria-hidden": !0 })
              }
            ),
            f === "compare" ? e.compareExtra : null
          ] }, f);
        }) }),
        a ? /* @__PURE__ */ C("div", { className: "reader-live-strip", children: [
          /* @__PURE__ */ C(
            "button",
            {
              type: "button",
              className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
              "aria-pressed": a.visible,
              "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
              title: a.state.error || `${l}，${a.visible ? "点一下看原文" : "点一下叠上译文"}`,
              onClick: a.onToggle,
              children: [
                /* @__PURE__ */ g(Hi, { ...Me, "aria-hidden": !0 }),
                /* @__PURE__ */ g("span", { className: "reader-live-translation-toggle-label", children: l })
              ]
            }
          ),
          a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ C(
            G,
            {
              className: "reader-live-translation-toggle reader-live-jump",
              "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
              title: `跳到最新译好的第 ${a.latestPage} 页`,
              onClick: a.onJumpToLatest,
              children: [
                /* @__PURE__ */ g(Ui, { ...Me, "aria-hidden": !0 }),
                /* @__PURE__ */ g("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
              ]
            }
          ) : null
        ] }) : s ? /* @__PURE__ */ g("div", { className: "reader-live-strip", children: /* @__PURE__ */ C(
          G,
          {
            className: "reader-live-translation-toggle is-done",
            title: "翻译完成，左右对照看最终译文",
            onClick: s.onOpenCompare,
            children: [
              /* @__PURE__ */ g(Wi, { ...Me, "aria-hidden": !0 }),
              /* @__PURE__ */ g("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
            ]
          }
        ) }) : null
      ] }),
      /* @__PURE__ */ g("span", { className: "reader-workspace-end", "aria-hidden": "true" })
    ] })
  );
}
const Ms = [];
function Zf() {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Set();
  let n = Ms;
  const r = () => {
    n = [...e].map(([o, a]) => ({ id: o, ...a }));
    for (const o of t) o();
  };
  return {
    set: (o, a, s) => {
      e.set(o, { title: a, contribution: s }), r();
    },
    remove: (o) => {
      e.delete(o) && r();
    },
    subscribe: (o) => (t.add(o), () => t.delete(o)),
    getSnapshot: () => n
  };
}
function Co(e, t) {
  const n = [];
  for (const { id: r, contribution: o } of e)
    if (o.menuItems)
      try {
        for (const a of o.menuItems(t)) n.push({ ...a, key: `${r}:${a.key}` });
      } catch (a) {
        console.error(`[reader] 扩展 ${r} 的右键菜单出错`, a);
      }
  return n;
}
function Qf(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function em(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.menuSection ? [{ id: t, render: n.menuSection }] : []);
}
function tm(e) {
  var t;
  return ((t = e.find(({ contribution: n }) => n.takesPointer)) == null ? void 0 : t.id) ?? null;
}
function nm(e) {
  const t = e.flatMap(({ id: n, contribution: r }) => r.textMarks ? [{ id: n, marks: r.textMarks }] : []);
  return t.length ? (n) => t.flatMap(({ id: r, marks: o }) => {
    try {
      return [...o(n)];
    } catch (a) {
      return console.error(`[reader] 扩展 ${r} 的文字层标记出错`, a), [];
    }
  }) : null;
}
function rm(e) {
  return e.reduce((t, { contribution: n }) => Math.max(t, n.reserveRight || 0), 0);
}
function om(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function am(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const Nn = rn(null), xs = rn(null);
function sm({ api: e, store: t, children: n }) {
  const r = U(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ g(Nn.Provider, { value: r, children: n });
}
function $t() {
  const e = ft(Nn);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const im = () => () => {
}, $o = () => Ms;
function cm(e) {
  return An(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function As() {
  var t;
  const e = (t = ft(Nn)) == null ? void 0 : t.store;
  return An((e == null ? void 0 : e.subscribe) ?? im, (e == null ? void 0 : e.getSnapshot) ?? $o, (e == null ? void 0 : e.getSnapshot) ?? $o);
}
function sn(e) {
  var a;
  const t = (a = ft(Nn)) == null ? void 0 : a.store, n = ft(xs);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  D(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), D(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class lm extends Si {
  constructor() {
    super(...arguments);
    Qr(this, "state", { failed: !1 });
  }
  static getDerivedStateFromError() {
    return { failed: !0 };
  }
  componentDidCatch(n, r) {
    console.error(`[reader] 扩展 ${this.props.id} 出错，已停用`, n, r.componentStack);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
const um = nn(function({ extensions: t }) {
  return /* @__PURE__ */ g(Re, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ g(lm, { id: n, children: /* @__PURE__ */ g(dm, { id: n, title: r, children: /* @__PURE__ */ g(o, {}) }) }, n)) });
});
function dm({ id: e, title: t, children: n }) {
  const r = U(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ g(xs.Provider, { value: r, children: n });
}
function fm({
  marks: e,
  page: t,
  height: n,
  onOpen: r
}) {
  const o = e.filter((a) => a.anchor.page === t);
  return o.length ? /* @__PURE__ */ g("div", { className: "reader-ask-marks", "aria-label": "这一页问过的地方", children: o.map((a) => {
    var i;
    const s = a.title || a.anchor.selection || a.anchor.sourceText || `第 ${t} 页`;
    return /* @__PURE__ */ g(
      G,
      {
        className: "reader-ask-mark",
        style: { top: Math.round((((i = a.anchor.point) == null ? void 0 : i.y) ?? 0) * n) },
        "aria-label": `打开在这里的提问：${s.slice(0, 40)}`,
        title: `在这里问过：${s.slice(0, 80)}`,
        onPointerDown: (l) => l.stopPropagation(),
        onClick: () => r(a),
        children: "?"
      },
      a.key
    );
  }) }) : null;
}
const Do = 6e3;
function _s(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function Ns(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > Do && (s *= Do / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function _r({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = N(null), [i, l] = x({ status: "loading", cssHeight: 0 }), c = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return D(() => {
    let u = !1, f = null;
    return l((m) => ({ status: "loading", cssHeight: m.cssHeight })), (async () => {
      try {
        const m = await e.getPage(t);
        if (u) return;
        const h = m.getViewport({ scale: 1 }), p = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), d = Ns(n, h, r, p), b = s.current, w = b == null ? void 0 : b.getContext("2d");
        if (!b || !w) return;
        b.width = d.canvasWidth, b.height = d.canvasHeight, l({ status: "loading", cssHeight: d.cssHeight });
        const v = m.getViewport({ scale: d.scale, offsetX: d.offsetX, offsetY: d.offsetY }), y = m.render({ canvasContext: w, viewport: v });
        f = y, await y.promise, u || l({ status: "ready", cssHeight: d.cssHeight });
      } catch (m) {
        !u && (m == null ? void 0 : m.name) !== "RenderingCancelledException" && l((h) => ({ status: "error", cssHeight: h.cssHeight }));
      }
    })(), () => {
      u = !0, f == null || f.cancel();
    };
  }, [e, c]), /* @__PURE__ */ C(
    "div",
    {
      className: `reader-region-canvas${o ? ` ${o}` : ""}`,
      "data-status": i.status,
      style: { width: r, height: i.cssHeight || void 0 },
      children: [
        /* @__PURE__ */ g("canvas", { ref: s, role: "img", "aria-label": a ?? `第 ${t} 页的一块`, style: { width: r, height: i.cssHeight || void 0 } }),
        i.status === "error" ? /* @__PURE__ */ g("p", { className: "reader-region-canvas-error", children: "这一块没画出来。" }) : null
      ]
    }
  );
}
const mm = 1600, Ln = { left: 0, top: 0, width: 1, height: 1 };
function Ls(e) {
  return new Promise((t, n) => {
    e.toBlob((r) => r ? t(r) : n(new Error("截图没出来")), "image/png");
  });
}
function hm(e, t, n) {
  if (e.width <= 0 || e.height <= 0) return null;
  const r = (c) => Math.min(1, Math.max(0, (c - e.left) / e.width)), o = (c) => Math.min(1, Math.max(0, (c - e.top) / e.height)), a = Math.min(r(t.x), r(n.x)), s = Math.max(r(t.x), r(n.x)), i = Math.min(o(t.y), o(n.y)), l = Math.max(o(t.y), o(n.y));
  return s - a < 0.02 || l - i < 0.02 ? null : { left: a, top: i, width: s - a, height: l - i };
}
async function pm(e, t, n = Ln, r = mm) {
  const o = await e.getPage(t), a = Ns(n, o.getViewport({ scale: 1 }), r, 1), s = document.createElement("canvas");
  s.width = a.canvasWidth, s.height = a.canvasHeight;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.fillStyle = "#fff", i.fillRect(0, 0, s.width, s.height), await o.render({ canvasContext: i, viewport: o.getViewport({ scale: a.scale, offsetX: a.offsetX, offsetY: a.offsetY }) }).promise, Ls(s);
}
async function gm(e, t = Ln) {
  const n = Math.round(t.left * e.width), r = Math.round(t.top * e.height), o = Math.max(1, Math.round(t.width * e.width)), a = Math.max(1, Math.round(t.height * e.height)), s = document.createElement("canvas");
  s.width = o, s.height = a;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.drawImage(e, n, r, o, a, 0, 0, o, a), Ls(s);
}
function ym(e, t) {
  return t.left === 0 && t.top === 0 && t.width === 1 && t.height === 1 ? `第${e}页.png` : `第${e}页-截图.png`;
}
const bm = /[\u{1D400}-\u{1D7FF}ﬀ-ﬆ]/gu, Oo = /[⺀-鿿가-힯豈-﫿＀-￯　-〿]/u;
function vm(e) {
  let t = `${e || ""}`.replace(/\r\n?/g, `
`).replace(/­/g, "");
  return t.trim() ? (t = t.replace(bm, (r) => r.normalize("NFKC")), t = t.normalize("NFC"), t.includes("̸") && (t = t.replace(/(\S)?̸[ \t]*(\S)/gu, (r, o, a) => `${o ? `${o} ` : ""}${a}̸`).normalize("NFC")), t.split(/\n[ \t]*\n+/).map((r) => wm(r.split(`
`))).filter(Boolean).join(`
`).trim()) : "";
}
function wm(e) {
  let t = "";
  for (const n of e) {
    const r = n.replace(/[ \t ]+/g, " ").trim();
    if (!r) continue;
    if (!t) {
      t = r;
      continue;
    }
    if (new RegExp("\\p{L}-$", "u").test(t) && new RegExp("^\\p{Ll}", "u").test(r)) {
      t = t.slice(0, -1) + r;
      continue;
    }
    if (new RegExp("\\p{L}-$", "u").test(t) && /^[\p{Lu}\p{N}]/u.test(r)) {
      t += r;
      continue;
    }
    const o = t.slice(-1), a = r.charAt(0);
    t += Oo.test(o) || Oo.test(a) ? r : ` ${r}`;
  }
  return t;
}
const Sm = /[\u{1D400}-\u{1D7FF}Ͱ-Ͽ℀-⅏←-⋿⨀-⫿⟀-⟯⦀-⧿⁰-₟̀-ͯ√±×÷]/u;
function zo(e) {
  return Sm.test(e);
}
function km(e) {
  const t = `${e || ""}`;
  return t.trim() ? [...t.trim()].length > 6 ? !1 : !new RegExp("\\p{Ll}{3,}", "u").test(t) : !0;
}
function Tm(e, t) {
  const n = e[t];
  if (!n) return null;
  const r = (i) => {
    const l = e[i];
    return !!l && l.line === n.line && (zo(l.text) || km(l.text));
  };
  if (!r(t)) return null;
  let o = t, a = t;
  for (; r(o - 1); ) o -= 1;
  for (; r(a + 1); ) a += 1;
  let s = !1;
  for (let i = o; i <= a; i += 1) zo(e[i].text) && (s = !0);
  if (!s) return null;
  for (; o < a && !e[o].text.trim(); ) o += 1;
  for (; a > o && !e[a].text.trim(); ) a -= 1;
  return [o, a];
}
function Im(e) {
  const t = e.filter((a) => a.right - a.left > 0.5 && a.bottom - a.top > 0.5);
  if (!t.length) return [];
  const n = [...t].sort((a, s) => (a.top + a.bottom) / 2 - (s.top + s.bottom) / 2), r = [];
  for (const a of n) {
    const s = r.at(-1), i = s ? Fo(s) : null;
    i && Em(i, a) >= 0.5 * Math.min(i.bottom - i.top, a.bottom - a.top) ? s.push(a) : r.push([a]);
  }
  const o = [];
  for (const a of r) {
    const s = Fo(a), i = s.bottom - s.top, l = [...a].sort((u, f) => u.left - f.left);
    let c = null;
    for (const u of l)
      c && u.left - c.right <= i * 2 ? c.right = Math.max(c.right, u.right) : (c && o.push(c), c = { left: u.left, top: s.top, right: u.right, bottom: s.bottom });
    c && o.push(c);
  }
  return o;
}
function Fo(e) {
  const t = Math.max(...e.map((r) => r.bottom - r.top)), n = e.filter((r) => r.bottom - r.top >= t * 0.75);
  return { top: Math.min(...n.map((r) => r.top)), bottom: Math.max(...n.map((r) => r.bottom)) };
}
function Em(e, t) {
  return Math.min(e.bottom, t.bottom) - Math.max(e.top, t.top);
}
const rr = ".textLayer, .reader-layout-page, .reader-html-page", mn = ".reader-layout-page", Bo = "svg.reader-layout-math";
function or(e) {
  return e ? e.nodeType === 1 ? e : e.parentElement : null;
}
function Rm(e) {
  var t, n;
  return ((t = or(e.startContainer)) == null ? void 0 : t.closest(rr)) ?? ((n = or(e.endContainer)) == null ? void 0 : n.closest(rr)) ?? null;
}
const Pm = /[\p{Script=Latin}\p{N})\].,;:!?%]$/u, Mm = /^[\p{Script=Latin}\p{N}(\[$]/u;
function xm(e, t) {
  var s, i, l;
  let n = "", r = null, o = null, a = Number.NaN;
  for (const c of t.querySelectorAll(`text, ${Bo}`)) {
    if (!e.intersectsNode(c)) continue;
    let u, f = Number(c.getAttribute("x")), m, h;
    if (c.matches(Bo))
      u = `$${c.getAttribute("data-tex") || ""}$`, h = c.getAttribute("data-baseline"), m = f + Number(c.getAttribute("width") || 0);
    else {
      const d = c.textContent || "", b = c.firstChild;
      let w = 0, v = d.length;
      b && b === e.startContainer && (w = e.startOffset), b && b === e.endContainer && (v = e.endOffset), u = d.slice(w, v), h = c.getAttribute("y");
      let y = 0;
      try {
        y = ((s = c.getComputedTextLength) == null ? void 0 : s.call(c)) || 0;
      } catch {
        y = 0;
      }
      m = f + y, w > 0 && (f = Number.NaN);
    }
    if (!u) continue;
    const p = ((i = c.closest("[data-html-block]")) == null ? void 0 : i.getAttribute("data-html-block")) ?? null;
    if (o !== null && p !== o) n += `

`;
    else if (r !== null && h !== r) n += `
`;
    else if (n && Number.isFinite(a) && Number.isFinite(f)) {
      const d = Number((l = c.closest("[font-size]")) == null ? void 0 : l.getAttribute("font-size")) || 10;
      f - a > d * 0.2 && Pm.test(n) && Mm.test(u) && (n += " ");
    }
    n += u, r = h, o = p, a = m;
  }
  return n;
}
function Am(e) {
  if (!e.rangeCount) return "";
  const t = e.getRangeAt(0), n = or(t.commonAncestorContainer), r = (n == null ? void 0 : n.closest(mn)) ?? (n != null && n.querySelector(mn) ? n : null);
  if (r) {
    const o = r.matches(mn) ? [r] : [...r.querySelectorAll(mn)].filter((a) => t.intersectsNode(a));
    if (o.length) return o.map((a) => xm(t, a)).filter(Boolean).join(`

`);
  }
  return `${e}`;
}
function Cs(e) {
  return vm(Am(e));
}
const _m = 4e3;
function Nm(e, t, n) {
  if (e.length) {
    const o = Ju(e, n), a = o ? hs(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function jo(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Ie}]`)) ?? null;
  return r ? { text: Cs(e).slice(0, _m), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function Lm(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const l = mt(i, t, n);
    if (!l || l.box.page !== r) continue;
    const c = lt(l, 1, 1);
    if (!c) continue;
    const u = o.y < c.top ? c.top - o.y : o.y > c.top + c.height ? o.y - c.top - c.height : 0, f = o.x < c.left ? c.left - o.x : o.x > c.left + c.width ? o.x - c.left - c.width : 0, m = u + f * 0.25;
    (m < s || m === 0 && a === null) && (a = i, s = m);
  }
  return a;
}
function Cm({
  pageElement: e,
  clientX: t,
  clientY: n,
  itemId: r,
  selection: o,
  regions: a,
  bookmarks: s,
  metadata: i = null
}) {
  if (!e) return null;
  const l = Number(e.getAttribute(Ie)) || 0;
  if (l < 1) return null;
  const c = e.getAttribute(Se) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, h = (r ? a.find((p) => p.itemId === r) ?? null : null) ?? (f ? Lm(a, i, c, l, f) : null);
  return {
    pane: c,
    page: l,
    itemId: (h == null ? void 0 : h.itemId) ?? null,
    selection: o,
    sourceText: `${(h == null ? void 0 : h.source.text) || (h == null ? void 0 : h.markdown) || ""}`.trim(),
    translatedText: `${(h == null ? void 0 : h.translatedBlockText) || (h == null ? void 0 : h.translated.text) || ""}`.trim(),
    section: Nm(s, a, (h == null ? void 0 : h.source.page) ?? l),
    point: f
  };
}
function $m(e, t, n = document) {
  for (const r of n.elementsFromPoint(e, t)) {
    const o = r.closest(`[${Ie}]`);
    if (!o) continue;
    const a = Number(o.getAttribute(Ie)) || 0, i = (o.closest(`[${Se}]`) ?? o).getAttribute(Se) === "translated" ? "translated" : "source", l = o.querySelector("canvas");
    if (a && l) return { page: a, pane: i, canvas: l, slot: o };
  }
  return null;
}
function Dm({ onDone: e, onCancel: t }) {
  const [n, r] = x(null), o = N(null), a = N(null);
  D(() => {
    const l = (c) => {
      c.key === "Escape" && (c.preventDefault(), c.stopImmediatePropagation(), t());
    };
    return window.addEventListener("keydown", l, !0), () => window.removeEventListener("keydown", l, !0);
  }, [t]);
  const s = (l, c) => {
    const u = a.current;
    u && (u.style.pointerEvents = "none");
    try {
      return $m(l, c);
    } finally {
      u && (u.style.pointerEvents = "");
    }
  }, i = n ? { left: Math.min(n.from.x, n.to.x), top: Math.min(n.from.y, n.to.y), width: Math.abs(n.to.x - n.from.x), height: Math.abs(n.to.y - n.from.y) } : null;
  return /* @__PURE__ */ C(
    "div",
    {
      ref: a,
      className: "reader-ask-crop",
      role: "presentation",
      onContextMenu: (l) => {
        l.preventDefault(), t();
      },
      onPointerDown: (l) => {
        var u, f;
        if (l.button !== 0) return;
        const c = s(l.clientX, l.clientY);
        c && (o.current = c, (f = (u = l.currentTarget).setPointerCapture) == null || f.call(u, l.pointerId), r({ from: { x: l.clientX, y: l.clientY }, to: { x: l.clientX, y: l.clientY } }));
      },
      onPointerMove: (l) => {
        n && r({ from: n.from, to: { x: l.clientX, y: l.clientY } });
      },
      onPointerUp: (l) => {
        const c = o.current, u = n == null ? void 0 : n.from;
        if (o.current = null, r(null), !c || !u) return;
        const f = hm(c.canvas.getBoundingClientRect(), u, { x: l.clientX, y: l.clientY });
        f && e({ page: c.page, pane: c.pane, region: f, canvas: c.canvas, point: { x: u.x, y: u.y, target: c.slot } });
      },
      children: [
        /* @__PURE__ */ g("p", { className: "reader-ask-crop-hint", children: "在书页上拖出一块，松开就带进提问 · Esc 取消" }),
        i ? /* @__PURE__ */ g("div", { className: "reader-ask-crop-box", style: i }) : null
      ]
    }
  );
}
const Ho = 5e4, Om = 2e4;
function Hn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function jb(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function zm(e, t = null) {
  var n;
  return {
    pane: e.pane === "source" ? "source" : "translated",
    page: e.page,
    itemId: ((n = e.item_ids) == null ? void 0 : n[0]) ?? null,
    selection: e.selected_text || "",
    sourceText: e.source_text || "",
    translatedText: e.translated_text || "",
    section: e.section || "",
    point: t
  };
}
function Fm(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function Bm(e) {
  var r;
  const t = e == null ? void 0 : e.data, n = ((r = t == null ? void 0 : t.retainpdf) == null ? void 0 : r.selection) ?? (t && typeof t.page == "number" ? t : null);
  return n && n.page ? n : null;
}
function Hb(e, t) {
  var r;
  const n = Bm(e);
  return !n || n.document_id && t && n.document_id !== t ? null : ((r = n.item_ids) == null ? void 0 : r[0]) || null;
}
function Ub(e) {
  var o, a;
  const t = e.selection.trim();
  return t && !t.endsWith("…") ? t : ((a = (o = [...e.text.matchAll(/```[ \t]*(译文|translation|zh|zh-CN)[ \t]*\n([\s\S]*?)\n```/gi)].at(-1)) == null ? void 0 : o[2]) == null ? void 0 : a.trim()) || null;
}
function jm(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? Hm(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function Hm(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function Um(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = jm(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: Fm(o.selection, n),
        ...s ? { marks: { rewrote: s } } : {}
      };
    }
    return o.role === "side_summary" ? {
      id: o.message_id,
      role: "assistant",
      text: `**深挖的结论**

${o.text}`,
      marks: { sideSummary: { sideId: o.side_conversation_id }, ...a }
    } : {
      id: o.message_id,
      role: "assistant",
      text: o.text,
      thought: o.thought,
      usage: o.usage ?? null,
      ...a.compactedBefore ? { marks: a } : {}
    };
  });
}
function Wm(e, t, n, r) {
  var c, u, f;
  const o = ((f = (u = (c = e.context) == null ? void 0 : c.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : f.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, l = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: Hn(e.question.text, Ho), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: Hn(e.answer.text, Ho),
      thought: e.answer.thought ? Hn(e.answer.thought, Om) : null,
      usage: l,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function Km(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function Vm(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function qm(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function Jm(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const Gm = 50, Un = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function Xm() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function Uo(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function Ym({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = x(!1), [i, l] = x(Un), [c, u] = x(!1), [f, m] = x(""), [h, p] = x("idle"), [d, b] = x(null), [w, v] = x([]), y = L((B) => {
    b(B), v([]);
  }, []), k = L((B) => v((W) => [...W, B].slice(-2)), []), [S, R] = x(() => /* @__PURE__ */ new Map()), E = N(/* @__PURE__ */ new Set()), P = N(/* @__PURE__ */ new Map()), O = (B) => {
    if (!B) return null;
    const W = P.current.get(B);
    return W || (_.current.records.some((Y) => Y.message_id === B) ? B : null);
  }, _ = N(i);
  _.current = i;
  const T = N(t);
  T.current = t;
  const I = N(0), M = L(async (B, W, Y, de = []) => {
    if (!r) return;
    const ne = await r.messages(B.conversation_id, { limit: Gm, ...Y ? { beforeSeq: Y } : {} }), ae = [...ne.messages, ...de];
    I.current += 1, l({
      conversation: B,
      main: W ?? B,
      records: ae,
      compactions: ne.compactions || [],
      hasMore: ne.has_more,
      key: `${B.conversation_id}:${I.current}`,
      initial: Um(ae, ne.compactions || [], T.current.documentId)
    });
  }, [r]), $ = L(async () => {
    s(!0);
    const B = _.current.conversation;
    if (!(!r || (B == null ? void 0 : B.kind) === "main" && B.status !== "archived")) {
      u(!0), m("");
      try {
        const W = await r.main(T.current.documentId || void 0);
        await M(W, W);
      } catch (W) {
        m(W instanceof Error ? W.message : String(W));
      } finally {
        u(!1);
      }
    }
  }, [r, M]), z = L((B) => {
    y(B), $();
  }, [$]), K = N(t.documentId);
  D(() => {
    K.current !== t.documentId && (K.current = t.documentId, _.current = Un, l(Un), y(null), R(/* @__PURE__ */ new Map()), P.current.clear(), a && $());
  }, [t.documentId, a, $]);
  const H = L(async () => {
    const B = _.current, W = B.records[0];
    if (!(!B.conversation || !W || !B.hasMore)) {
      u(!0);
      try {
        await M(B.conversation, B.main, W.seq, B.records);
      } finally {
        u(!1);
      }
    }
  }, [M]), J = L(async (B) => {
    const Y = _.current.conversation;
    if (!r || !Y) return;
    for (const Z of B.memoryIds) E.current.add(Z);
    let de = B.memoryIds;
    if (!de.length && o && B.startedAt) {
      const Z = Vm(
        await o.list({ source_conversation_id: Y.conversation_id, created_after: Km(B.startedAt) }).catch(() => []),
        E.current
      );
      for (const A of Z) E.current.add(A.id);
      de = Z.map((A) => A.id);
      const fe = B.answerId;
      Z.length && fe && R((A) => new Map(A).set(fe, Z));
    }
    const ne = Wm({ ...B, memoryIds: de }, T.current.documentId, Xm(), O(B.editedFrom));
    let ae;
    try {
      ae = await r.append(Y.conversation_id, ne);
    } catch (Z) {
      if (Y.kind !== "side" || !/ask_conversation_not_open/.test(Uo(Z))) throw Z;
      await r.reopen(Y.conversation_id), ae = await r.append(Y.conversation_id, ne);
    }
    const [ke, ee] = ae.messages;
    B.questionId && ke && P.current.set(B.questionId, ke.message_id), B.answerId && ee && P.current.set(B.answerId, ee.message_id), l((Z) => {
      var fe;
      return ((fe = Z.conversation) == null ? void 0 : fe.conversation_id) === Y.conversation_id ? { ...Z, conversation: ae.conversation, records: [...Z.records, ...ae.messages] } : Z;
    }), n == null || n(ae.messages), ae.compaction_due && Y.kind === "main" && r.compact(Y.conversation_id).catch(() => {
    });
  }, [r, o, n]), oe = L(async (B) => {
    const W = _.current.conversation, Y = O(B);
    if (!r || !W || !Y) return null;
    try {
      await r.supersede(W.conversation_id, Y);
    } catch (ae) {
      if (!/ask_message_superseded/.test(Uo(ae))) throw ae;
    }
    const de = _.current.records.find((ae) => ae.message_id === Y), ne = _.current.records.findIndex((ae) => ae.message_id === Y);
    return l((ae) => ({ ...ae, records: ae.records.map((ke, ee) => ee >= ne && ne >= 0 && !ke.superseded_at ? { ...ke, superseded_at: "now" } : ke) })), (de == null ? void 0 : de.selection) ?? null;
  }, [r]), q = L((B) => {
    J(B).catch((W) => m(`这一轮没存上：${W instanceof Error ? W.message : String(W)}`));
  }, [J]), se = L(async (B) => {
    var de;
    const W = _.current, Y = W.main;
    if (!(!r || !Y || ((de = W.conversation) == null ? void 0 : de.kind) !== "main")) {
      m("");
      try {
        const ne = qm(W.records, B), ae = await r.fork({
          parent_id: Y.conversation_id,
          ...ne ? { forked_from_message_id: ne } : {},
          title: Jm(B.text),
          ...T.current.documentId ? { document_id: T.current.documentId } : {}
        });
        await M(ae, Y);
      } catch (ne) {
        m(`开不了副对话：${ne instanceof Error ? ne.message : String(ne)}`);
      }
    }
  }, [r, M]), Ee = L(async (B) => {
    const W = _.current.main;
    if (r)
      try {
        await M(await r.get(B), W);
      } catch (Y) {
        m(`打不开副对话：${Y instanceof Error ? Y.message : String(Y)}`);
      }
  }, [r, M]), re = L(async () => {
    const B = _.current.main;
    B && await M(B, B).catch(() => {
    });
  }, [M]), ue = L(async () => {
    const B = _.current.conversation;
    if (!(!r || (B == null ? void 0 : B.kind) !== "side")) {
      p("busy");
      try {
        await r.close(B.conversation_id), p("idle"), await re();
      } catch {
        p("failed");
      }
    }
  }, [r, re]), xe = L(async () => r != null && r.archived ? r.archived(T.current.documentId) : [], [r]), ie = L(async (B) => {
    m(""), y(null);
    try {
      await M(B, _.current.main);
    } catch (W) {
      m(`打不开这个对话：${W instanceof Error ? W.message : String(W)}`);
    }
  }, [M, y]), le = L(async () => {
    const B = _.current.main;
    if (!r || !B) return;
    await r.archive(B.conversation_id);
    const W = await r.main(T.current.documentId || void 0);
    await M(W, W);
  }, [r, M]);
  return {
    visible: a,
    view: i,
    loading: c,
    error: f,
    pending: d,
    setPending: y,
    extras: w,
    addExtra: k,
    closingSide: h,
    notices: S,
    persistent: !!r,
    openMain: $,
    ask: z,
    close: L(() => s(!1), []),
    loadEarlier: H,
    onTurn: q,
    rewrite: oe,
    fork: se,
    openSide: Ee,
    backToMain: re,
    closeSide: ue,
    archiveMain: le,
    listArchived: xe,
    viewArchived: ie,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function Wo(e, t, n) {
  var l;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((l = r == null ? void 0 : r.item_ids) == null ? void 0 : l[0]) ?? null, i = zm({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function Zm({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = x([]), s = N(0), i = N(r);
  i.current = r;
  const l = () => (s.current += 1, s.current);
  D(() => {
    var h, p;
    if (a([]), !e || !t) return;
    let f = !1;
    const m = (d) => {
      !f && d.length && a((b) => [...b, ...d]);
    };
    return (h = e.threads) == null || h.list(t).then(
      (d) => m(d.map((b) => ({ key: l(), anchor: b.anchor, threadId: b.threadId, title: b.title }))),
      () => {
      }
    ), (p = e.conversations) == null || p.bookMessages(t).then(
      (d) => m(d.map((b) => Wo(b, l(), i.current)).filter((b) => !!b)),
      () => {
      }
    ), () => {
      f = !0;
    };
  }, [e, t, n]);
  const c = L((f) => {
    const m = f.filter((h) => !h.document_id || h.document_id === t).map((h) => Wo(h, l(), i.current)).filter((h) => !!h);
    m.length && a((h) => [...h.filter((p) => !m.some((d) => d.messageId === p.messageId)), ...m]);
  }, [t]), u = L((f) => a((m) => m.filter((h) => h.key !== f)), []);
  return { marks: o, addRecords: c, removeMark: u };
}
const Qm = La(() => import("./ReaderAskPanel-C0RvrXz7.js"));
function eh({
  port: e,
  documentId: t,
  jobId: n,
  versionId: r,
  regions: o,
  metadata: a,
  bookmarks: s,
  hoveredItemId: i,
  resetKey: l,
  goToPage: c,
  pageCount: u,
  editBlock: f,
  jumpToBlock: m,
  pdfDocuments: h,
  currentPage: p,
  visibleMode: d,
  activePanel: b = null,
  panelHost: w = null
}) {
  const v = U(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), y = L((A, j, V) => {
    const me = A ? o.find((_e) => _e.itemId === A) : null, ye = me ? mt(me, a, j) : null, Te = ye && ye.box.page === V ? lt(ye, 1, 1) : null;
    return Te ? { x: Te.left, y: Te.top } : null;
  }, [o, a]), k = Zm({ port: e, documentId: t, resetKey: l, pointOf: y }), S = Ym({ port: e, book: v, onAppended: k.addRecords }), [R, E] = x(null), P = L(
    (A, j, V, me) => Cm({
      pageElement: (A == null ? void 0 : A.closest(`[${Ie}]`)) ?? null,
      clientX: j,
      clientY: V,
      itemId: i(),
      selection: me,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), O = L(() => {
    var j;
    const A = jo(((j = globalThis.getSelection) == null ? void 0 : j.call(globalThis)) ?? null);
    return !A.text || !A.element || !A.rect ? null : P(A.element, A.rect.left + A.rect.width / 2, A.rect.top + A.rect.height / 2, A.text);
  }, [P]), _ = L((A) => {
    E(null), S.ask(A);
  }, [S.ask]);
  D(() => {
    if (!e) return;
    const A = (j) => {
      var ye;
      if (j.key !== "?" || j.metaKey || j.ctrlKey || j.altKey || j.defaultPrevented) return;
      const V = j.target;
      if ((ye = V == null ? void 0 : V.closest) != null && ye.call(V, "input, textarea, select, [contenteditable='true']")) return;
      const me = O();
      me && (j.preventDefault(), j.stopImmediatePropagation(), _(me));
    };
    return window.addEventListener("keydown", A, !0), () => window.removeEventListener("keydown", A, !0);
  }, [e, O, _]);
  const T = N(h);
  T.current = h;
  const I = L(async ({ page: A, pane: j, region: V, canvas: me }) => {
    const ye = T.current[j];
    let Te;
    if (ye)
      Te = await pm(ye, A, V);
    else {
      const _e = me ?? document.querySelector(`[${Se}="${j}"] [${Ie}="${A}"] canvas`);
      if (!_e) throw new Error(`第 ${A} 页还没画出来，翻到那一页再试`);
      Te = await gm(_e, V);
    }
    return new File([Te], ym(A, V), { type: "image/png" });
  }, []), [M, $] = x(null), z = N(S.pending);
  z.current = S.pending;
  const K = U(() => [{
    key: "page",
    label: "带上这一页",
    title: "带上这一页的截图（问的那一页，没有就是现在读的这页）：公式、图表、表格让 AI 直接看图",
    icon: /* @__PURE__ */ g(Ki, { size: 14, "aria-hidden": !0 }),
    run: () => {
      const A = z.current, j = (A == null ? void 0 : A.pane) || (d === "translated" ? "translated" : "source");
      return I({ page: (A == null ? void 0 : A.page) || p() || 1, pane: j, region: Ln });
    }
  }], [I, p, d]), [H, J] = x(!1), [oe, q] = x(""), se = L(async (A) => {
    J(!1), q("");
    try {
      const j = await I(A), V = P(A.point.target, A.point.x, A.point.y, "");
      $((me) => ({ id: ((me == null ? void 0 : me.id) || 0) + 1, files: [j] })), V ? _({ ...V, itemId: null, sourceText: "", translatedText: "" }) : S.openMain();
    } catch (j) {
      q(j instanceof Error ? j.message : String(j));
    }
  }, [I, P, _]), Ee = L(() => J(!1), []), re = L(() => {
    q(""), J((A) => !A);
  }, []), ue = L(async (A) => {
    if (A.threadId && (e != null && e.threads) && t) {
      try {
        const j = await e.threads.get(t, A.threadId);
        E({ anchor: j.anchor || A.anchor, messages: j.messages || [], mark: A });
      } catch {
        E({ anchor: A.anchor, messages: [], mark: A });
      }
      return;
    }
    E(null), S.openMain();
  }, [e, t, S.openMain]), xe = L((A) => {
    var me;
    if (!e) return [];
    const j = jo(((me = globalThis.getSelection) == null ? void 0 : me.call(globalThis)) ?? null), V = P(A.target, A.clientX, A.clientY, j.element ? j.text : "");
    return V ? [{
      key: "ask",
      label: V.selection ? "问这段" : "在这里提问",
      hint: V.selection ? "?" : void 0,
      // 选着字时也出现在选字浮条上（「复制 · 收藏 · 提问」，ReaderSelectionLayer）。
      inSelectionBar: V.selection ? "提问" : void 0,
      onSelect: () => _(V)
    }, {
      key: "crop",
      label: "截一块问",
      onSelect: () => {
        q(""), J(!0);
      }
    }] : [];
  }, [e, P, _]), ie = R ? {
    anchor: R.anchor,
    messages: R.messages,
    onClose: () => E(null),
    onDelete: e != null && e.threads && R.mark.threadId ? () => {
      e.threads.remove(t, R.mark.threadId).catch(() => {
      }), k.removeMark(R.mark.key), E(null);
    } : void 0
  } : null, le = U(() => f ? (A, j) => {
    f(A, j ?? void 0), requestAnimationFrame(() => m(A, "translated"));
  } : null, [f, m]), B = L((A) => ys(o, A), [o]), [W, Y] = x(0), de = L(({ mode: A, width: j }) => {
    Y(A === "dock" ? Math.round(j) : 0);
  }, []), ne = !S.persistent || !!S.view.conversation || !!S.error, ae = e && (S.visible && ne || R) ? /* @__PURE__ */ g(Na, { fallback: null, children: /* @__PURE__ */ g(
    Qm,
    {
      port: e,
      jobId: n,
      book: v,
      ask: S,
      legacy: ie,
      onShowSelection: ({ page: A, pane: j }) => c(A, j),
      onJumpToPage: (A) => c(A),
      pageCount: u,
      onLayout: de,
      dockTaken: b !== null,
      dockHost: w,
      onEditBlock: le,
      canEditBlock: B,
      attachTools: K,
      attachRequest: M
    }
  ) }) : null, ke = H || oe ? /* @__PURE__ */ C(Re, { children: [
    H ? /* @__PURE__ */ g(Dm, { onDone: (A) => void se(A), onCancel: Ee }) : null,
    oe ? /* @__PURE__ */ C("p", { className: "reader-ask-crop-error", role: "alert", onClick: () => q(""), children: [
      "截图没成：",
      oe
    ] }) : null
  ] }) : null, ee = S.visible && ne || !!R, Z = S.close, fe = L(() => {
    if (ee) {
      E(null), Z();
      return;
    }
    S.openMain();
  }, [ee, Z, S.openMain]);
  return { marks: k.marks, onMark: ue, menuItems: xe, panel: ae, overlay: ke, cropping: H, toggleCrop: re, open: S.openMain, toggle: fe, showing: ee, reserveRight: ee ? W : 0, enabled: !!e };
}
const th = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function nh() {
  const e = $t(), t = U(() => {
    try {
      return Ze().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = eh({
    port: t,
    documentId: e.documentId,
    jobId: e.jobId,
    versionId: e.versionId,
    regions: e.regions,
    metadata: e.metadata,
    bookmarks: e.bookmarks,
    hoveredItemId: e.hoveredItemId,
    resetKey: e.resetKey,
    goToPage: e.goToPage,
    pageCount: e.pageCount,
    editBlock: e.editBlock,
    jumpToBlock: e.jumpToBlock,
    pdfDocuments: e.pdfDocuments,
    currentPage: e.currentPage,
    visibleMode: e.visibleMode,
    activePanel: e.activePanel,
    panelHost: e.panelHost
  }), { marks: r, onMark: o, menuItems: a, panel: s, overlay: i, cropping: l, toggleCrop: c, enabled: u, toggle: f, showing: m, reserveRight: h } = n, p = U(() => u ? {
    toolbarItems: [{
      key: "ask",
      label: "提问",
      title: "提问：问整本书、翻这本书以前的对话（问某一段：书页上右键，或选字按 ?）",
      Icon: Ha,
      pressed: m,
      onClick: f
    }, {
      // 底栏右边：框出书页上的一块，截图带进提问（和右键「截一块问」一样）。
      key: "crop",
      label: "截图",
      title: "截图：在书页上框出一块，带进提问（Esc 取消）",
      Icon: Vi,
      place: "bottom",
      pressed: l,
      onClick: c
    }],
    menuItems: a,
    pageLayer: r.length ? ({ page: d, height: b }) => /* @__PURE__ */ g(fm, { marks: r, page: d, height: b, onOpen: o }) : void 0,
    shortcuts: th,
    reserveRight: h,
    // 「截一块问」时占着书页上的指针：不出悬停框、不选字。
    takesPointer: l
  } : {}, [u, a, r, o, f, m, h, l, c]);
  return sn(p), /* @__PURE__ */ C(Re, { children: [
    s,
    i
  ] });
}
const rh = { id: "ask", title: "提问", Component: nh };
function ar() {
  try {
    return Ze().translationVersions ?? null;
  } catch {
    return null;
  }
}
function oh(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function ah(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function sh(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function ih({ documentId: e, jobId: t }) {
  const [n, r] = x([]), [o, a] = x(null);
  D(() => {
    r([]);
    const i = ar();
    if (!i || !e) return;
    let l = !1;
    return i.list(e).then((c) => {
      l || (r(c.versions), a(c.currentVersionId));
    }).catch(() => {
    }), () => {
      l = !0;
    };
  }, [e, t]);
  const s = ah(n, t, o);
  return U(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function ch({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = x(null), [s, i] = x(""), [l, c] = x(""), u = N(0);
  D(() => {
    u.current += 1, a(null), i(""), c("");
  }, [e, t]);
  const f = L((p) => {
    const d = ar(), b = n.find((v) => v.versionId === p);
    if (!d || !b || !e) return;
    const w = ++u.current;
    i(p), c(""), (async () => {
      const v = Ze(), y = await d.resolveJob(e, p);
      if (!y) throw new Error("这一份还没有能读的译文。");
      const k = await v.loadReaderPayload(y, { includeOptionalArtifacts: !0 }), S = v.resolveReaderTranslatedPdfUrl(k.jobPayload, k.manifestPayload);
      if (!S) throw new Error("这一份没有译文 PDF。");
      return { versionId: p, name: b.name, jobId: y, url: S, regions: oh($a(k.regionsPayload)) };
    })().then((v) => {
      w === u.current && a(v);
    }).catch((v) => {
      w === u.current && c((v == null ? void 0 : v.message) || "这一份打不开。");
    }).finally(() => {
      w === u.current && i("");
    });
  }, [e, n]), m = L(() => {
    u.current += 1, a(null), i(""), c("");
  }, []), h = L(async () => {
    var b, w;
    const p = ar();
    if (!p || !o || !e) return;
    try {
      await p.select(e, o.versionId);
    } catch (v) {
      c((v == null ? void 0 : v.message) || "换不过去，请稍后再试。");
      return;
    }
    const d = (b = globalThis.location) == null ? void 0 : b.href;
    d && ((w = globalThis.history) == null || w.replaceState(globalThis.history.state, "", sh(d, o.jobId))), a(null);
  }, [o, e]);
  return U(() => ({
    available: n.length >= 2,
    versions: n,
    readingVersionId: r,
    compared: o,
    loading: s,
    error: l,
    choose: f,
    clear: m,
    adopt: h
  }), [n, r, o, s, l, f, m, h]);
}
function lh(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: qi,
    place: "compare",
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ g($f, { compare: e, onDone: t })
  } : null;
}
function uh(e) {
  const { compared: t, versions: n, readingVersionId: r } = e;
  if (!t) return null;
  const o = n.find((s) => s.versionId === t.versionId), a = n.find((s) => s.versionId === r);
  return {
    url: t.url,
    regions: t.regions,
    left: { name: t.name, createdAt: (o == null ? void 0 : o.createdAt) || "" },
    right: { name: (a == null ? void 0 : a.name) || "当前译文", createdAt: (a == null ? void 0 : a.createdAt) || "" }
  };
}
function dh() {
  var i;
  const e = $t(), t = ch({
    documentId: e.documentId,
    jobId: e.jobId,
    versions: e.translationVersions,
    readingVersionId: e.versionId || ""
  }), { visibleMode: n, setWorkspace: r } = e, o = ((i = t.compared) == null ? void 0 : i.url) || "";
  D(() => {
    o && n !== "compare" && r("compare");
  }, [o]);
  const a = t.clear;
  D(() => {
    n !== "compare" && a();
  }, [n, a]);
  const s = U(() => {
    const l = lh(t);
    return { toolbarItems: l ? [l] : [], comparedDocument: uh(t) };
  }, [t]);
  return sn(s), null;
}
const fh = { id: "compare", title: "对比版本", Component: dh }, ve = (e) => {
  const t = Number(e);
  return Number.isFinite(t) ? t : 0;
}, Nr = (e) => {
  const t = Array.isArray(e) ? e : [];
  return [ve(t[0]), ve(t[1]), ve(t[2])];
};
function jt([e, t, n]) {
  const r = Math.max(e, t, n) > 1 ? 1 : 255, o = (a) => Math.round(Math.min(255, Math.max(0, a * r)));
  return `rgb(${o(e)}, ${o(t)}, ${o(n)})`;
}
function $s(e) {
  const t = e && typeof e == "object" ? e : null;
  if (!t) return null;
  const n = Math.floor(ve(t.index));
  if (n < 0 || !(ve(t.width) > 0) || !(ve(t.height) > 0)) return null;
  const r = (Array.isArray(t.covers) ? t.covers : []).flatMap((i) => {
    const l = i, c = Array.isArray(l.rect) ? l.rect.map(ve) : [];
    return c.length === 4 && c[2] > c[0] && c[3] > c[1] ? [{ block: `${l.block || ""}`, rect: c, fill: Nr(l.fill) }] : [];
  }), o = Ko(t.blocks), a = Wn(t.erase), s = (Array.isArray(t.tables) ? t.tables : []).flatMap((i) => {
    const l = i, c = `${l.id || ""}`;
    return c ? [{ id: c, cover: Wn([l.cover])[0] ?? null, rules: Wn(l.rules), blocks: Ko(l.blocks) }] : [];
  });
  return { index: n, width: ve(t.width), height: ve(t.height), covers: r, blocks: o, erase: a, tables: s };
}
function Wn(e) {
  return (Array.isArray(e) ? e : []).flatMap((t) => {
    const n = t && typeof t == "object" ? t : null, r = Array.isArray(n == null ? void 0 : n.rect) ? n.rect.map(ve) : [];
    return r.length === 4 && r[2] > r[0] && r[3] > r[1] ? [{ rect: r, fill: Nr(n.fill) }] : [];
  });
}
function Ko(e) {
  return (Array.isArray(e) ? e : []).flatMap((t) => {
    const n = t, r = ve(n.fontSize);
    if (!(r > 0)) return [];
    const o = (Array.isArray(n.lines) ? n.lines : []).map((a) => {
      const s = a, i = (Array.isArray(s.items) ? s.items : []).flatMap((l) => {
        const c = l;
        return typeof c.tex == "string" ? [{
          x: ve(c.x),
          tex: c.tex,
          display: !!c.display,
          w: ve(c.w),
          h: ve(c.h),
          d: ve(c.d),
          ...typeof c.svg == "string" && c.svg ? { svg: c.svg } : {}
        }] : typeof c.t == "string" && c.t ? [{
          x: ve(c.x),
          t: c.t,
          ...c.mode === "dflt" ? { mode: "dflt" } : {},
          ...typeof c.font == "string" && c.font ? { font: c.font } : {}
        }] : [];
      });
      return { text: `${s.text || ""}`, x: ve(s.x), baseline: ve(s.baseline), width: ve(s.width), justified: !!s.justified, items: i };
    });
    return [{ id: `${n.id || ""}`, fontSize: r, weight: n.weight === "bold" ? "bold" : "regular", color: Nr(n.color), lines: o }];
  });
}
function mh(e, t = []) {
  const n = e && typeof e == "object" ? e : null;
  if (!n || !`${n.schema || ""}`.startsWith("rpr_layout_")) return null;
  const r = /* @__PURE__ */ new Map();
  for (const o of Array.isArray(n.pages) ? n.pages : []) {
    const a = $s(o);
    a && r.set(a.index + 1, a);
  }
  return { schema: `${n.schema}`, pages: r, fonts: t };
}
async function hh(e, t = fetch) {
  var s;
  const n = new URL(e, (s = globalThis.location) == null ? void 0 : s.href), r = await (await t(n.href)).json(), o = (r.fonts || []).flatMap((i) => i.family && i.url ? [{ family: i.family, weight: ve(i.weight) || 400, url: new URL(i.url, n).href }] : []), a = await (await t(new URL(r.layout || "layout.json", n).href)).json();
  return mh(a, o);
}
const ph = /* @__PURE__ */ new Set(["no_translated_pdf", "not_engine_route", "unsupported_render", "merged_reading", "not_kept", "backfill_queued", "job_active"]), gh = /* @__PURE__ */ new Set(["backfill_queued", "job_active"]);
function yh(e) {
  const t = `${e || ""}`.trim();
  return ph.has(t) ? t : "not_kept";
}
const Vo = (e) => {
  const t = e && typeof e == "object" ? e : null;
  return (t && t.data && typeof t.data == "object" ? t.data : null) ?? t;
}, bh = (e) => `RPR ${e}`;
async function qo(e, { apiPrefix: t = "/api/v1", fetcher: n }) {
  const r = `${t.replace(/\/$/, "")}/jobs/${encodeURIComponent(e)}/reader/layout`, o = await n(r);
  if (!o.ok) throw new Error(`版面清单 HTTP ${o.status}`);
  const a = Vo(await o.json()) ?? {}, s = a.generate && typeof a.generate == "object" ? a.generate : null, i = s && s.url ? { method: `${s.method || "POST"}`, url: `${s.url}`, body: s.body ?? null } : null;
  if (!a.available) return { available: !1, reason: yh(a.reason), generate: i, source: null };
  const l = /* @__PURE__ */ new Map();
  for (const w of Array.isArray(a.pages) ? a.pages : []) {
    const v = w, y = Math.floor(ve(v.index));
    y >= 0 && l.set(y + 1, `${v.url || `${r}/pages/${y}`}`);
  }
  const c = (Array.isArray(a.fonts) ? a.fonts : []).flatMap((w) => {
    const v = w;
    return v.family && v.url ? [{ key: `${v.key || ""}` || void 0, family: bh(`${v.family}`), weight: ve(v.weight) || 400, url: `${v.url}` }] : [];
  }), u = new Set((Array.isArray(a.features) ? a.features : []).map((w) => `${w}`)), f = !u.has("erase") && a.background && typeof a.background == "object" ? a.background : null, m = Array.isArray(f == null ? void 0 : f.pages) ? f.pages.map((w) => Math.floor(ve(w))) : [], h = f != null && f.url ? {
    url: `${f.url}`,
    pageFor(w) {
      const v = m.indexOf(w - 1);
      return v >= 0 ? v + 1 : null;
    }
  } : null, p = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map(), b = {
    schema: `${a.schema || "rpr_layout_v1"}`,
    features: u,
    pages: new Set(l.keys()),
    fonts: c,
    background: h,
    loadPage(w) {
      const v = l.get(w);
      if (!v) return Promise.resolve(null);
      let y = p.get(w);
      return y || (y = n(v).then(async (k) => k.ok ? $s(Vo(await k.json())) : null).catch(() => null), p.set(w, y)), y;
    },
    loadMath(w) {
      let v = d.get(w);
      return v || (v = n(`${r}/${w.replace(/^\/+/, "")}`).then(async (y) => y.ok ? y.text() : null).catch(() => null), d.set(w, v)), v;
    },
    async loadFont(w) {
      const v = await n(w.url);
      if (!v.ok) throw new Error(`字体 HTTP ${v.status}`);
      return v.arrayBuffer();
    }
  };
  return { available: !0, reason: null, generate: i, source: b };
}
function vh(e, t = fetch) {
  return {
    schema: e.schema,
    features: /* @__PURE__ */ new Set(),
    pages: new Set(e.pages.keys()),
    fonts: e.fonts,
    background: null,
    loadPage: (n) => Promise.resolve(e.pages.get(n) ?? null),
    loadMath: () => Promise.resolve(null),
    async loadFont(n) {
      const r = await t(n.url);
      if (!r.ok) throw new Error(`字体 HTTP ${r.status}`);
      return r.arrayBuffer();
    }
  };
}
function wh(e) {
  return [...[...new Set(e.map((n) => n.family))].map((n) => `"${n.replace(/"/g, "")}"`), "serif"].join(", ");
}
const Jo = /* @__PURE__ */ new Set();
async function Sh(e, t) {
  const n = `${e.family}|${e.weight}|${e.url}`;
  if (Jo.has(n)) return !0;
  for (let r = 0; r < 2; r += 1)
    try {
      const o = new FontFace(e.family, await t(e), { weight: `${e.weight}` });
      return document.fonts.add(await o.load()), Jo.add(n), !0;
    } catch (o) {
      r === 1 && console.warn("[render-layout] 字体没装上：", e.family, e.url, o);
    }
  return !1;
}
async function kh(e, t) {
  var o;
  if (typeof FontFace > "u" || typeof document > "u" || !document.fonts) return !1;
  const n = (o = e[0]) == null ? void 0 : o.family, r = await Promise.all(e.map(async (a) => ({ font: a, ok: await Sh(a, t) })));
  return !!n && r.every(({ font: a, ok: s }) => s || a.family !== n);
}
function Th() {
  var e;
  try {
    return new URLSearchParams(((e = globalThis.location) == null ? void 0 : e.search) || "").get("render_layout") || "";
  } catch {
    return "";
  }
}
const Ih = 5e3, Eh = 360;
function Rh() {
  try {
    const e = ao.fetchProtected;
    return {
      apiPrefix: ao.apiPrefix,
      fetchProtected: ((t, n) => e(typeof t == "string" ? wr(t) : t, n))
    };
  } catch {
    return null;
  }
}
function Ph(e, t) {
  const [n, r] = x({ status: "idle" }), [o, a] = x(0), [s, i] = x(e);
  D(() => i(e), [e]);
  const l = N(""), c = N(Th()).current, u = N(Rh()).current;
  D(() => {
    if (!c && (!t || !s || !u)) return;
    let h = !0;
    return r((p) => p.status === "generating" ? p : { status: "loading" }), (async () => {
      let p = null;
      if (c) {
        const w = await hh(c);
        p = w ? vh(w) : null;
      } else {
        const w = await qo(s, { apiPrefix: u.apiPrefix || "/api/v1", fetcher: u.fetchProtected });
        if (!w.source) {
          if (h) {
            const v = gh.has(w.reason || "");
            r((y) => y.status === "generating" || v ? { status: "generating" } : { status: "unavailable", reason: w.reason || "not_kept", generate: w.generate });
          }
          return;
        }
        p = w.source;
      }
      if (!p) {
        h && r({ status: "unavailable", reason: "failed", generate: null });
        return;
      }
      const d = p, b = await kh(d.fonts, (w) => d.loadFont(w));
      if (h) {
        if (!b) {
          console.warn("[render-layout] 版面的字体没有或没装全，HTML 页退回按 OCR 的框塞字"), r({ status: "unavailable", reason: "no_fonts", generate: null });
          return;
        }
        r({ status: "ready", source: d, fontFamily: wh(d.fonts) });
      }
    })().catch((p) => {
      console.warn("[render-layout] 版面没读到：", p), h && r({ status: "unavailable", reason: "failed", generate: null });
    }), () => {
      h = !1;
    };
  }, [c, t, s, u, o]);
  const f = n.status === "unavailable" ? n.generate : null, m = L(() => {
    !f || !u || (r({ status: "generating" }), u.fetchProtected(f.url, {
      method: f.method || "POST",
      headers: { "Content-Type": "application/json" },
      body: f.body == null ? void 0 : JSON.stringify(f.body)
    }).then(async (h) => {
      var p;
      if (!h.ok) throw new Error(`补排 HTTP ${h.status}`);
      try {
        const d = await h.json(), b = `${((p = d == null ? void 0 : d.data) == null ? void 0 : p.job_id) ?? (d == null ? void 0 : d.job_id) ?? ""}`.trim();
        l.current = b && b !== e ? b : "";
      } catch {
        l.current = "";
      }
    }).catch((h) => {
      console.warn("[render-layout] 补排没发出去：", h), r({ status: "unavailable", reason: "failed", generate: f });
    }));
  }, [f, u]);
  return D(() => {
    if (n.status !== "generating" || !u) return;
    let h = 0;
    const p = setInterval(() => {
      if (h += 1, h > Eh) {
        clearInterval(p), r({ status: "unavailable", reason: "failed", generate: null });
        return;
      }
      const d = [e, l.current].filter(Boolean);
      for (const b of d)
        qo(b, { apiPrefix: u.apiPrefix || "/api/v1", fetcher: u.fetchProtected }).then((w) => {
          w.available && (clearInterval(p), i(b), r({ status: "loading" }), a((v) => v + 1));
        }).catch(() => {
        });
    }, Ih);
    return () => clearInterval(p);
  }, [n.status, e, u]), { ...n, generateNow: m };
}
const Mh = '"Times New Roman", "Tinos", "Liberation Serif", "Source Han Serif SC", "Noto Serif CJK SC", serif', hn = 1.5;
function xh(e, t) {
  const n = Ce(e);
  if (n === "formula") {
    const o = `${e.markdown || e.source.text || ""}`.trim();
    return o ? { kind: "display_formula", content: o } : null;
  }
  if (n !== "text") return null;
  const r = t === "translated" ? `${e.translatedBlockText || e.markdown || e.translated.text || ""}`.trim() : `${e.source.text || ""}`.trim();
  return r ? { kind: e.regionType || "text", content: r } : null;
}
function Ah(e) {
  var n;
  const t = /* @__PURE__ */ new Map();
  for (const r of e) {
    const o = Number((n = r.source) == null ? void 0 : n.page);
    if (!Number.isFinite(o)) continue;
    const a = t.get(o);
    a ? a.push(r) : t.set(o, [r]);
  }
  return t;
}
function _h({ page: e, width: t, height: n, regions: r, metadata: o, text: a, arrivedAt: s }) {
  const { items: i, scale: l } = U(() => {
    var m;
    const c = [];
    let u = 0;
    const f = [...r].sort((h, p) => (h.readingOrder ?? 0) - (p.readingOrder ?? 0));
    for (const h of f) {
      const p = xh(h, a);
      if (!p) continue;
      const d = mt(h, o, "source");
      if (!d || d.box.page !== e) continue;
      const b = lt(d, t, n);
      !b || b.width < 2 || b.height < 2 || (!u && ((m = d.pageSize) != null && m.width) && (u = t / d.pageSize.width), c.push({
        order: c.length,
        item: {
          itemId: h.itemId,
          translatedText: p.content,
          status: "html",
          kind: p.kind,
          sourceText: h.source.text || "",
          typography: a === "source" && p.kind !== "display_formula" ? { font_family: Mh } : void 0,
          rect: {
            left: b.left - hn,
            top: b.top - hn,
            width: b.width + hn * 2,
            height: b.height + hn * 2
          },
          changedAtSeq: s,
          changedNow: Date.now() - s < 1500
        }
      }));
    }
    return { items: c, scale: u || 1 };
  }, [r, o, a, e, t, n, s]);
  return i.length ? /* @__PURE__ */ g("div", { className: "reader-html-page", "data-html-page": e, "data-html-text": a, children: i.map(({ item: c, order: u }) => /* @__PURE__ */ g(
    "div",
    {
      className: "reader-html-block",
      "data-html-block": c.itemId,
      "data-html-kind": c.kind,
      style: { "--reader-html-order": u },
      children: /* @__PURE__ */ g(Mr, { item: c, pageScale: l })
    },
    `${c.itemId}:${c.changedAtSeq}`
  )) }) : null;
}
function Ds(e) {
  var r;
  if (!e) return null;
  const t = /<svg([^>]*)>([\s\S]*)<\/svg>/i.exec(e);
  if (!t) return null;
  const n = (r = /viewBox="([^"]+)"/i.exec(t[1])) == null ? void 0 : r[1];
  return n ? { viewBox: n, inner: t[2] } : null;
}
const Ht = /* @__PURE__ */ new Map(), Nh = 512;
function Go(e) {
  let t = Ht.get(e);
  if (!t && (t = uc(e, !1).then(Ds), Ht.set(e, t), Ht.size > Nh)) {
    const n = Ht.keys().next().value;
    n !== void 0 && Ht.delete(n);
  }
  return t;
}
function Lh(e) {
  var n;
  let t = e.querySelector('g[data-mml-node="math"]');
  for (; t && t.children.length === 1 && ((n = t.firstElementChild) != null && n.hasAttribute("data-mml-node")); ) t = t.firstElementChild;
  return t ? [...t.children] : [];
}
const Xo = "rgb(40, 110, 215)", Ch = 70, $h = 1400, Dh = 520, Oh = () => {
  var e;
  try {
    return ((e = globalThis.matchMedia) == null ? void 0 : e.call(globalThis, "(prefers-reduced-motion: reduce)").matches) ?? !1;
  } catch {
    return !1;
  }
};
function zh(e) {
  if (Oh() || typeof e.animate != "function") return;
  const t = Lh(e), n = Math.min(220, 1200 / Math.max(1, t.length));
  t.forEach((r, o) => {
    var a;
    (a = r.animate) == null || a.call(
      r,
      [{ opacity: 0, transform: "translate(0px, -600px)" }, { opacity: 1, transform: "translate(0px, 0px)" }],
      { duration: 460, delay: o * n, easing: "cubic-bezier(.2, .75, .25, 1)", fill: "backwards" }
    );
  }), e.animate(
    [{ color: Xo }, { color: Xo, offset: 0.75 }, { color: "currentColor" }],
    { duration: t.length * n + 900, easing: "ease-out" }
  );
}
function Fh(e, t, n) {
  return !t || !n ? Go(e) : n(t).then((r) => Ds(r) ?? Go(e));
}
function Bh({ page: e, width: t, height: n, fontFamily: r, arrivedAt: o, charRise: a = !1, loadMath: s, fontByKey: i }) {
  const l = U(() => {
    const p = /* @__PURE__ */ new Map(), d = [...e.blocks, ...e.tables.flatMap((b) => b.blocks)];
    for (const b of d) for (const w of b.lines) for (const v of w.items) "tex" in v && p.set(v.tex, v.svg);
    return [...p];
  }, [e]), [c, u] = x(() => /* @__PURE__ */ new Map());
  D(() => {
    let p = !0;
    return Promise.all(l.map(async ([d, b]) => [d, await Fh(d, b, s)])).then((d) => {
      p && u(new Map(d));
    }), () => {
      p = !1;
    };
  }, [l, s]);
  const f = Date.now() - o < 1500, m = N(null);
  D(() => {
    const p = m.current;
    if (!a || !p || typeof IntersectionObserver > "u") return;
    const d = [...p.querySelectorAll(".reader-layout-block")];
    for (const v of d) v.removeAttribute("data-risen");
    const b = /* @__PURE__ */ new Set(), w = new IntersectionObserver((v) => {
      for (const y of v) {
        if (!y.isIntersecting) continue;
        const k = y.target;
        k.setAttribute("data-risen", "run"), w.unobserve(k);
        const S = k.querySelectorAll(".reader-layout-line").length, R = setTimeout(() => {
          b.delete(R), k.setAttribute("data-risen", "done");
        }, Math.min(S * Ch, $h) + Dh + 100);
        b.add(R);
      }
    }, { threshold: 0.2 });
    for (const v of d) w.observe(v);
    return () => {
      w.disconnect();
      for (const v of b) clearTimeout(v);
    };
  }, [a, e]);
  const h = (p) => {
    var d;
    `${((d = globalThis.getSelection) == null ? void 0 : d.call(globalThis)) || ""}`.trim() || zh(p.currentTarget);
  };
  return /* @__PURE__ */ C(
    "svg",
    {
      ref: m,
      className: `reader-layout-page${a ? " is-char-rise" : ""}`,
      "data-html-page": e.index + 1,
      viewBox: `0 0 ${e.width} ${e.height}`,
      width: t,
      height: n,
      preserveAspectRatio: "none",
      style: { fontFamily: r },
      children: [
        e.erase.map((p, d) => /* @__PURE__ */ g("rect", { x: p.rect[0], y: p.rect[1], width: p.rect[2] - p.rect[0], height: p.rect[3] - p.rect[1], fill: jt(p.fill) }, `erase:${d}`)),
        e.covers.map((p, d) => /* @__PURE__ */ g(
          "rect",
          {
            x: p.rect[0],
            y: p.rect[1],
            width: p.rect[2] - p.rect[0],
            height: p.rect[3] - p.rect[1],
            fill: jt(p.fill)
          },
          `${p.block}:${d}`
        )),
        e.tables.flatMap((p) => [
          ...(p.cover ? [p.cover] : []).map((d) => /* @__PURE__ */ g("rect", { x: d.rect[0], y: d.rect[1], width: d.rect[2] - d.rect[0], height: d.rect[3] - d.rect[1], fill: jt(d.fill) }, `${p.id}:cover`)),
          ...p.rules.map((d, b) => /* @__PURE__ */ g("rect", { x: d.rect[0], y: d.rect[1], width: d.rect[2] - d.rect[0], height: d.rect[3] - d.rect[1], fill: jt(d.fill) }, `${p.id}:rule:${b}`))
        ]),
        [...e.blocks, ...e.tables.flatMap((p) => p.blocks)].map((p, d) => {
          const b = jt(p.color);
          return /* @__PURE__ */ g(
            "g",
            {
              className: `reader-layout-block${f ? " is-arriving" : ""}`,
              "data-html-block": p.id,
              fill: b,
              fontSize: p.fontSize,
              fontWeight: p.weight === "bold" ? 700 : 400,
              style: { "--reader-html-order": d, color: b },
              children: p.lines.map((w, v) => /* @__PURE__ */ g("g", { className: "reader-layout-line", style: { "--l": v }, children: w.items.map((y, k) => {
                const S = `${v}:${k}`;
                if ("tex" in y) {
                  const R = c.get(y.tex), E = p.fontSize;
                  return R ? /* @__PURE__ */ g(
                    "svg",
                    {
                      className: "reader-layout-math",
                      x: y.x,
                      y: w.baseline - y.h * E,
                      width: Math.max(0.01, y.w * E),
                      height: Math.max(0.01, (y.h + y.d) * E),
                      viewBox: R.viewBox,
                      preserveAspectRatio: "none",
                      "data-tex": y.tex,
                      "data-baseline": w.baseline,
                      onClick: h,
                      dangerouslySetInnerHTML: { __html: R.inner }
                    },
                    S
                  ) : null;
                }
                return /* @__PURE__ */ g(
                  "text",
                  {
                    x: y.x,
                    y: w.baseline,
                    lang: y.mode === "dflt" ? "en" : "zh-Hans",
                    fontFamily: y.font && (i != null && i.get(y.font)) ? `"${i.get(y.font)}", ${r}` : void 0,
                    children: y.t
                  },
                  S
                );
              }) }, v))
            },
            `${p.id}:${o}:${a ? "rise" : ""}`
          );
        })
      ]
    }
  );
}
function jh({ source: e, page: t, width: n, height: r, fontFamily: o, arrivedAt: a, charRise: s, backgroundPdf: i }) {
  var p;
  const [l, c] = x(null), u = e.pages.has(t);
  D(() => {
    if (!u) return;
    let d = !0;
    return e.loadPage(t).then((b) => {
      d && c(b);
    }), () => {
      d = !1;
    };
  }, [e, t, u]);
  const f = U(() => new Map(e.fonts.flatMap((d) => d.key ? [[d.key, d.family]] : [])), [e]), m = U(() => (d) => e.loadMath(d), [e]);
  if (!u || !l) return null;
  const h = ((p = e.background) == null ? void 0 : p.pageFor(t)) ?? null;
  return /* @__PURE__ */ C(Re, { children: [
    i && h ? /* @__PURE__ */ g(_r, { pdf: i, page: h, region: Ln, cssWidth: n, className: "reader-layout-background", label: "底图" }) : null,
    /* @__PURE__ */ g(
      Bh,
      {
        page: l,
        width: n,
        height: r,
        fontFamily: o,
        arrivedAt: a,
        charRise: s,
        loadMath: m,
        fontByKey: f
      }
    )
  ] });
}
async function Hh(e, t) {
  ps();
  const n = await Sr(wr(e), void 0, { signal: t });
  if (!n || t != null && t.aborted) return null;
  const r = _t(), o = {
    cMapUrl: r.resolvePdfjsVendorUrl("cmaps/"),
    cMapPacked: !0,
    standardFontDataUrl: r.resolvePdfjsVendorUrl("standard_fonts/"),
    rangeChunkSize: Es,
    disableAutoFetch: !0
  };
  return await ("ranged" in n ? kn.getDocument({ ...o, range: Rs(n.ranged) }) : kn.getDocument({ ...o, data: n.data })).promise;
}
const Uh = [
  { value: null, label: "关", hint: "看原来的 PDF" },
  { value: "translated", label: "画译文", hint: "原文页上按 OCR 的框用 HTML 画译文" },
  { value: "source", label: "画原文", hint: "原文页上按 OCR 的框用 HTML 重画原文" }
], Yo = {
  no_translated_pdf: "还没有译文 PDF（或正在重新渲染）",
  not_engine_route: "这次的译文是 Typst 排的，没有版面",
  unsupported_render: "这本书的排版设置引擎排不了（双栏对照、字体不是思源宋体）",
  merged_reading: "合并阅读的书没有版面",
  not_kept: "版面没留下来（以前排的书）",
  no_fonts: "版面还没有字体（以前排的书）",
  failed: "版面没要到"
};
function Wh() {
  var S;
  const e = $t(), [t, n] = x(null), [r, o] = x(0), [a, s] = x(!1), i = U(() => Ah(e.regions), [e.regions]), l = Ph(e.jobId, t === "translated"), c = l.status === "ready" ? l : null, { generateNow: u } = l, f = l.status === "unavailable" ? l : null, m = l.status === "generating", h = ((S = c == null ? void 0 : c.source.background) == null ? void 0 : S.url) || "", [p, d] = x(null);
  D(() => {
    if (d(null), !h) return;
    const R = new AbortController();
    return Hh(h, R.signal).then((E) => {
      !R.signal.aborted && E && d(E);
    }).catch((E) => {
      R.signal.aborted || console.warn("[html-page] 底图没读到，用原文页做底：", E);
    }), () => R.abort();
  }, [h]);
  const b = !e.sourceOnly, { metadata: w, visibleMode: v, setWorkspace: y } = e, k = U(() => {
    const R = (E) => {
      n(E), o(Date.now()), E && v === "translated" && y("source");
    };
    return {
      toolbarItems: [{
        key: "html-page",
        label: "HTML 页",
        title: t ? `HTML 页：${t === "translated" ? c ? "画译文（照排版引擎的版面）" : "画译文（按识别的框）" : "画原文"}（点开换）` : "HTML 页：把书页用 HTML 画出来",
        Icon: Ji,
        pressed: !!t,
        popup: (E) => /* @__PURE__ */ C("div", { className: "reader-html-page-menu reader-floating-surface", role: "menu", "aria-label": "HTML 页", children: [
          Uh.filter((P) => P.value !== "translated" || b).map((P) => /* @__PURE__ */ g(
            G,
            {
              className: "reader-html-page-choice",
              role: "menuitemradio",
              "aria-checked": t === P.value,
              title: P.hint,
              onClick: () => {
                R(P.value), E();
              },
              children: P.label
            },
            P.label
          )),
          t === "translated" && f ? /* @__PURE__ */ C(Re, { children: [
            /* @__PURE__ */ g("span", { className: "reader-html-page-menu-sep", "aria-hidden": !0 }),
            /* @__PURE__ */ C("p", { className: "reader-html-page-menu-note", children: [
              "现在按识别的框画：",
              Yo[f.reason] || Yo.not_kept,
              "。"
            ] }),
            f.generate ? /* @__PURE__ */ g(
              G,
              {
                className: "reader-html-page-choice",
                title: "照排版引擎重新排一次版面（不重新翻译、不花钱），排好自动换上，和译文 PDF 一样",
                onClick: () => {
                  u(), E();
                },
                children: "生成 HTML 排版"
              }
            ) : null
          ] }) : null,
          t === "translated" && m ? /* @__PURE__ */ C(Re, { children: [
            /* @__PURE__ */ g("span", { className: "reader-html-page-menu-sep", "aria-hidden": !0 }),
            /* @__PURE__ */ g("p", { className: "reader-html-page-menu-note", children: "正在排版（不花钱），先按识别的框画，排好自动换上…" })
          ] }) : null,
          c ? /* @__PURE__ */ C(Re, { children: [
            /* @__PURE__ */ g("span", { className: "reader-html-page-menu-sep", "aria-hidden": !0 }),
            /* @__PURE__ */ g(
              G,
              {
                className: "reader-html-page-choice",
                role: "menuitemcheckbox",
                "aria-checked": a,
                title: "一段话滚进来时，一行接一行浮上来",
                onClick: () => {
                  s((P) => !P), t || R("translated"), E();
                },
                children: "逐行浮现"
              }
            ),
            /* @__PURE__ */ g("p", { className: "reader-html-page-menu-note", children: "点公式会分步展开" })
          ] }) : null
        ] })
      }],
      pageLayer: t ? ({ page: E, width: P, height: O, pane: _, active: T }) => !T || _ !== "source" ? null : t === "translated" && c ? /* @__PURE__ */ g(
        jh,
        {
          source: c.source,
          page: E,
          width: P,
          height: O,
          fontFamily: c.fontFamily,
          arrivedAt: r,
          charRise: a,
          backgroundPdf: p
        }
      ) : /* @__PURE__ */ g(
        _h,
        {
          page: E,
          width: P,
          height: O,
          regions: i.get(E) ?? [],
          metadata: w,
          text: t,
          arrivedAt: r
        }
      ) : void 0
    };
  }, [t, r, i, w, b, v, y, c, a, f, m, u, p]);
  return sn(k), null;
}
const Kh = { id: "html-page", title: "HTML 页", Component: Wh }, Os = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Zo = { pen: 35e-4, highlighter: 0.018 }, Qo = 0.015, sr = "retainpdf.reader.ink.v1:";
function ea(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(sr + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function Vh(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(sr + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(sr + e);
    } catch {
    }
}
function qh(e, t, n, r, o, a) {
  const s = Qo * Qo;
  return e.filter((i) => zs(i, t, n) && i.points.some(([l, c]) => (l - r) ** 2 + ((c - o) * a) ** 2 <= s)).map((i) => i.id);
}
function zs(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function Jh(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function Gh(e) {
  const [t, n] = x(null), [r, o] = x(Os[0].key), [a, s] = x(() => ea(e)), i = N(a), l = N([]);
  D(() => {
    const d = ea(e);
    i.current = d, s(d), l.current = [];
  }, [e]);
  const c = L((d) => {
    i.current = d, s(d), Vh(e, d);
  }, [e]), u = L((d) => {
    const b = i.current, w = d(b);
    w !== b && (l.current = [...l.current.slice(-49), b], c(w));
  }, [c]), f = L((d) => {
    d.points.length < 1 || u((b) => [...b, { ...d, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), m = L((d) => {
    d.length && u((b) => b.filter((w) => !d.includes(w.id)));
  }, [u]), h = L((d) => {
    u((b) => b.some((w) => w.page === d) ? b.filter((w) => w.page !== d) : b);
  }, [u]), p = L(() => {
    const d = l.current.pop();
    d && c(d);
  }, [c]);
  return U(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: m, undo: p, clearPage: h }),
    [t, r, a, f, m, p, h]
  );
}
const Xh = [
  { tool: "pen", label: "画笔", Icon: wn },
  { tool: "highlighter", label: "荧光笔", Icon: Gi },
  { tool: "eraser", label: "橡皮", Icon: Xi }
];
function Yh(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Zh({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ C(Re, { children: [
    Xh.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ g(
      G,
      {
        className: "reader-ink-tool",
        "aria-label": a,
        title: a,
        "aria-pressed": e.tool === o,
        "data-ink-tool": o,
        onClick: () => {
          e.setTool(e.tool === o ? null : o), r();
        },
        children: /* @__PURE__ */ g(s, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      },
      o
    )),
    /* @__PURE__ */ g("span", { className: "reader-ink-sep", "aria-hidden": !0 }),
    Os.map((o) => /* @__PURE__ */ g(
      G,
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
        children: /* @__PURE__ */ g("span", { "aria-hidden": !0 })
      },
      o.key
    )),
    /* @__PURE__ */ g("span", { className: "reader-ink-sep", "aria-hidden": !0 }),
    /* @__PURE__ */ g(G, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ g(Yi, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ g(
      G,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ g(Zi, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ g(
      G,
      {
        className: "reader-ink-tool",
        "aria-label": "退出画笔",
        title: "退出画笔（Esc）",
        "data-ink-exit": "true",
        onClick: () => {
          e.setTool(null), r();
        },
        children: /* @__PURE__ */ g(bt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function ta({ ink: e, page: t, onPick: n }) {
  return /* @__PURE__ */ g("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ g(Zh, { ink: e, page: t, onPick: n }) });
}
function Qh(e) {
  const t = N(e);
  t.current = e, D(() => {
    const n = (r) => {
      if (Yh(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
const ep = "reader-ink-layer";
function tp(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function na({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ g(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: tp(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function np({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = x(null), i = N(!1), l = o.strokes.filter((d) => zs(d, e, t)), c = !!o.tool;
  if (!c && !l.length) return null;
  const u = (d) => {
    const b = d.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (d.clientX - b.left) / Math.max(1, b.width))),
      Math.min(1, Math.max(0, (d.clientY - b.top) / Math.max(1, b.height)))
    ];
  }, f = (d, b) => o.erase(qh(o.strokes, e, t, d, b, r / Math.max(1, n))), m = (d) => {
    if (!o.tool || d.button !== 0) return;
    d.preventDefault(), d.stopPropagation(), d.currentTarget.setPointerCapture(d.pointerId), i.current = !0;
    const [b, w] = u(d);
    o.tool === "eraser" ? f(b, w) : s([[b, w]]);
  }, h = (d) => {
    if (!i.current || !o.tool) return;
    d.stopPropagation();
    const [b, w] = u(d);
    o.tool === "eraser" ? f(b, w) : s((v) => v ? Jh(v, b, w) : [[b, w]]);
  }, p = (d) => {
    i.current && (i.current = !1, d.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Zo[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ C(
    "svg",
    {
      className: ep,
      "data-ink-active": c ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: m,
      onPointerMove: h,
      onPointerUp: p,
      onPointerCancel: p,
      children: [
        l.map((d) => /* @__PURE__ */ g(na, { stroke: d, width: n, height: r }, d.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ g(na, { stroke: { tool: o.tool, color: o.color, width: Zo[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
const rp = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" }
];
function op(e) {
  return {
    toolbarItems: [{
      key: "ink",
      label: "画笔",
      title: "画笔（P；书页上右键也能选笔和颜色）",
      Icon: wn,
      // 钢笔图标，右下角一个当前笔色的小点（2026-11-28：两条栏只用图标，单一个圆点认不出是画笔）。
      mark: /* @__PURE__ */ C("span", { className: "reader-ink-mark", "aria-hidden": !0, children: [
        /* @__PURE__ */ g(wn, { ...Me }),
        /* @__PURE__ */ g("span", { className: "reader-ink-dot", style: { background: `var(--${e.color})` } })
      ] }),
      place: "bottom",
      pressed: !!e.tool,
      onClick: () => e.setTool(e.tool ? null : "pen"),
      dropdown: (t) => /* @__PURE__ */ g(ta, { ink: e, onPick: t })
    }],
    menuSection: ({ page: t, close: n }) => /* @__PURE__ */ g(ta, { ink: e, page: t, onPick: n }),
    // 离视口远的页只是占位，笔迹先不画（和以前一样只画 active 的页）。
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ g(np, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: rp
  };
}
function ap() {
  const e = $t(), t = Gh(e.resetKey);
  Qh(t);
  const n = U(() => op(t), [t]);
  return sn(n), null;
}
const sp = { id: "ink", title: "画笔", Component: ap };
function ip(e) {
  const t = N(!1);
  return e && (t.current = !0), t.current;
}
const cp = La(() => import("./ReaderMarkdownPanel-D8lPYWXO.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Fs = { id: "markdown", label: "Markdown", short: "MD", Icon: Qi, needsJob: !0 };
function lp() {
  const e = $t(), t = e.activePanel === Fs.id;
  if (!ip(t)) return null;
  const r = /* @__PURE__ */ g(Na, { fallback: null, children: /* @__PURE__ */ g(cp, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) });
  return e.panelHost ? mc(r, e.panelHost) : r;
}
const up = {
  id: "markdown",
  title: "Markdown",
  Component: lp,
  panels: [Fs]
}, Bs = "reader-xref", ir = "data-xref", Vt = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, dp = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Vt})`), fp = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function cr(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function mp(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function hp(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function pp(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const l = Ce(i);
    return l === "figure" || l === "table" || l === "formula";
  }, a = (i) => {
    const l = [];
    for (let c = t + i; o(e[c]) && l.length < 40; c += i) l.push(e[c]);
    return i < 0 ? l.reverse() : l;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function gp(e, t, n) {
  return (e.find((o) => Ce(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function yp(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Ce(r), s = hp(r);
    if (a === "formula") {
      for (const p of s.matchAll(fp)) {
        const d = cr(p[1]);
        d && n({ key: `equation:${d}`, kind: "equation", label: d, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = dp.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const c = mp(i[1]), u = cr(i[2]), f = pp(e, o, c), m = [...f.map((p) => p.itemId), r.itemId], h = new Map(e.map((p, d) => [p.itemId, d]));
    m.sort((p, d) => (h.get(p) ?? 0) - (h.get(d) ?? 0)), n({ key: `${c}:${u}`, kind: c, label: u, itemId: gp(f, r, c), itemIds: m, captionId: r.itemId });
  }), t;
}
const bp = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Vt})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Vt})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Vt})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Vt})\s*[）)]`, "g"), kind: () => "equation" }
];
function vp(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of bp) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", l = cr(s[s.length - 1]), c = `${a(i)}:${l}`;
      if (!t.has(c)) continue;
      const u = s.index ?? 0;
      n.push({ start: u, end: u + s[0].length, key: c });
    }
  }
  n.sort((o, a) => o.start - a.start);
  const r = [];
  for (const o of n)
    (!r.length || o.start >= r[r.length - 1].end) && r.push(o);
  return r;
}
function wp(e, t) {
  return vp(e, t).map((n) => ({ start: n.start, end: n.end, className: Bs, attrs: { [ir]: n.key } }));
}
const Sp = { figure: "图", table: "表", equation: "式" };
function ra(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${Sp[e.kind]} ${e.label}`;
}
const oa = { figure: "图", table: "表", formula: "公式", text: "文字" }, rt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function kp(e, t, n) {
  const r = mt(e, t, n), o = r ? lt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = _s({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function Tp(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, l = null;
  for (const u of e) {
    const f = mt(u, t, n), m = f ? lt(f, 1, 1) : null;
    !f || !m || (r || (r = f.box.page, l = f.pageSize), f.box.page === r && (o = Math.min(o, m.left), a = Math.min(a, m.top), s = Math.max(s, m.left + m.width), i = Math.max(i, m.top + m.height)));
  }
  if (!r || !l) return null;
  const c = _s({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: c, aspect: c.height * l.height / Math.max(1e-6, c.width * l.width) };
}
function Ip(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function Ep(e, t) {
  const n = (o) => {
    const a = Ce(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function Rp({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var O;
  const i = t.find((_) => _.itemId === e) ?? null, l = U(() => i ? Ep(t, i) : [], [t, i]), c = i ? l.indexOf(i) : -1, [u, f] = x(rt.indexOf(1)), m = rt[u], h = N(null), [p, d] = x(0);
  Le(() => {
    const _ = h.current;
    if (!_) return;
    const T = () => d(_.clientWidth);
    T();
    const I = typeof ResizeObserver == "function" ? new ResizeObserver(T) : null;
    return I == null || I.observe(_), () => I == null ? void 0 : I.disconnect();
  }, []);
  const b = L((_) => {
    const T = l[c + _];
    T && a(T.itemId);
  }, [l, c, a]);
  D(() => {
    const _ = (T) => {
      if (T.key === "Escape")
        T.preventDefault(), s();
      else if (T.key === "ArrowLeft")
        T.preventDefault(), b(-1);
      else if (T.key === "ArrowRight")
        T.preventDefault(), b(1);
      else if (T.key === "+" || T.key === "=")
        T.preventDefault(), f((I) => Math.min(rt.length - 1, I + 1));
      else if (T.key === "-" || T.key === "_")
        T.preventDefault(), f((I) => Math.max(0, I - 1));
      else if (T.key === "0")
        T.preventDefault(), f(rt.indexOf(1));
      else
        return;
      T.stopPropagation();
    };
    return window.addEventListener("keydown", _, !0), () => window.removeEventListener("keydown", _, !0);
  }, [s, b]), D(() => {
    const _ = h.current;
    if (!_) return;
    const T = (I) => {
      !I.ctrlKey && !I.metaKey || (I.preventDefault(), f((M) => Math.max(0, Math.min(rt.length - 1, M + (I.deltaY < 0 ? 1 : -1)))));
    };
    return _.addEventListener("wheel", T, { passive: !1 }), () => _.removeEventListener("wheel", T);
  }, []);
  const w = N(null);
  if (!i) return null;
  const v = Ce(i), y = o.map((_) => ({ pane: _, pdf: r[_] ?? null, where: kp(i, n, _) })).filter((_) => !!(_.pdf && _.where)), k = 16, S = typeof window > "u" ? 800 : window.innerHeight, R = Math.min(880, S * 0.9) - 56 - 32 - (y.length > 1 ? 26 : 0), E = y.length ? Ip(Math.max(120, (p - k * (y.length - 1) - 32) / y.length), R, y.map((_) => _.where.aspect)) : 0, P = ((O = y[0]) == null ? void 0 : O.where.page) ?? i.source.page;
  return /* @__PURE__ */ C("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${oa[v] ?? "这一块"}`, children: [
    /* @__PURE__ */ g("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ C("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ C("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ C("span", { className: "reader-zoom-title", children: [
          oa[v] ?? "这一块",
          " · 第 ",
          P,
          " 页"
        ] }),
        /* @__PURE__ */ g("span", { className: "reader-zoom-count", children: c >= 0 ? `${c + 1} / ${l.length}` : "" }),
        /* @__PURE__ */ C("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ g(dt, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: c <= 0, onClick: () => b(-1), children: /* @__PURE__ */ g(Da, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ g(dt, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: c < 0 || c >= l.length - 1, onClick: () => b(1), children: /* @__PURE__ */ g(Ua, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ g(dt, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((_) => Math.max(0, _ - 1)), children: /* @__PURE__ */ g(Wa, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ C(G, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(rt.indexOf(1)), children: [
            Math.round(m * 100),
            "%"
          ] }),
          /* @__PURE__ */ g(dt, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === rt.length - 1, onClick: () => f((_) => Math.min(rt.length - 1, _ + 1)), children: /* @__PURE__ */ g(Ka, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ g(dt, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ g(bt, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ g(
        "div",
        {
          ref: h,
          className: "reader-zoom-body",
          onPointerDown: (_) => {
            const T = h.current;
            !T || _.button !== 0 || (w.current = { x: _.clientX, y: _.clientY, left: T.scrollLeft, top: T.scrollTop }, T.setPointerCapture(_.pointerId));
          },
          onPointerMove: (_) => {
            const T = h.current, I = w.current;
            !T || !I || (T.scrollLeft = I.left - (_.clientX - I.x), T.scrollTop = I.top - (_.clientY - I.y));
          },
          onPointerUp: () => {
            w.current = null;
          },
          children: y.length && p ? /* @__PURE__ */ g("div", { className: "reader-zoom-columns", style: { gap: k }, children: y.map(({ pane: _, pdf: T, where: I }) => /* @__PURE__ */ C("figure", { className: "reader-zoom-column", children: [
            y.length > 1 ? /* @__PURE__ */ g("figcaption", { children: _ === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ g(
              _r,
              {
                className: "reader-zoom-canvas",
                pdf: T,
                page: I.page,
                region: I.fraction,
                cssWidth: E * m,
                label: `${_ === "source" ? "原文" : "译文"}第 ${I.page} 页`
              }
            )
          ] }, _)) }) : /* @__PURE__ */ g("p", { className: "reader-zoom-empty", children: p ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const Pp = 380, Mp = 320, kt = 8;
function xp(e, t, n) {
  const r = Math.max(kt, Math.min(e.left, n.width - t.width - kt)), o = e.bottom + kt, a = o + t.height <= n.height - kt ? o : Math.max(kt, e.top - kt - t.height);
  return { left: r, top: a };
}
function Ap({
  preview: e,
  regions: t,
  metadata: n,
  documents: r
}) {
  const o = e.target.itemIds.map((m) => t.find((h) => h.itemId === m)).filter((m) => !!m);
  if (!o.length) return null;
  const a = e.pane === "source" ? ["source", "translated"] : ["translated", "source"];
  let s = null;
  for (const m of a) {
    const h = r[m], p = h ? Tp(o, n, m) : null;
    if (h && p) {
      s = { pdf: h, where: p };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(Pp, Mp / Math.max(0.05, s.where.aspect))), l = Math.round(i * s.where.aspect) + 30, c = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = xp(e.anchor, { width: Math.max(i, 160) + 16, height: l + 16 }, c);
  return /* @__PURE__ */ C("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ C("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ g("span", { children: ra(e.target) }),
      /* @__PURE__ */ C("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ g(_r, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: ra(e.target) })
  ] });
}
const _p = 250;
function Np(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Lp(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function Cp(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function $p({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = x(null), [s, i] = x({ back: [], forward: [] }), l = N(s);
  l.current = s;
  const c = N(null), u = N({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = L(() => {
    const { shellEl: h, primaryPane: p } = u.current;
    return Jt(h, p);
  }, []);
  D(() => {
    if (!e) return;
    const h = (y) => {
      var k, S;
      return (S = (k = y.target) == null ? void 0 : k.closest) == null ? void 0 : S.call(k, `.${Bs}`);
    }, p = () => {
      c.current != null && window.clearTimeout(c.current), c.current = null;
    }, d = (y) => {
      var E;
      const k = h(y);
      if (!k) return;
      const S = u.current.index.get(k.getAttribute(ir) || "");
      if (!S) return;
      const R = ((E = k.closest("[data-reader-pane]")) == null ? void 0 : E.getAttribute("data-reader-pane")) || u.current.primaryPane;
      p(), c.current = window.setTimeout(() => {
        const P = k.getBoundingClientRect();
        a({ target: S, pane: R, anchor: { left: P.left, top: P.top, right: P.right, bottom: P.bottom } });
      }, _p);
    }, b = (y) => {
      const k = h(y);
      !k || k.contains(y.relatedTarget) || (p(), a(null));
    }, w = (y) => {
      var P, O;
      const k = h(y);
      if (!k || y.button !== 0 || y.metaKey || y.ctrlKey || y.shiftKey || `${((P = window.getSelection) == null ? void 0 : P.call(window)) || ""}`.trim()) return;
      const S = u.current.index.get(k.getAttribute(ir) || "");
      if (!S) return;
      y.preventDefault(), y.stopPropagation(), p(), a(null);
      const R = ((O = k.closest("[data-reader-pane]")) == null ? void 0 : O.getAttribute("data-reader-pane")) || u.current.primaryPane, E = f();
      E && i((_) => Np(_, E)), u.current.follow(S, R);
    }, v = () => {
      p(), a(null);
    };
    return e.addEventListener("pointerover", d), e.addEventListener("pointerout", b), e.addEventListener("click", w, !0), e.addEventListener("scroll", v, { passive: !0 }), () => {
      p(), e.removeEventListener("pointerover", d), e.removeEventListener("pointerout", b), e.removeEventListener("click", w, !0), e.removeEventListener("scroll", v);
    };
  }, [e, f]);
  const m = L((h) => {
    const p = f();
    if (!p) return !1;
    const d = Lp(l.current, p, h);
    if (!d) return !1;
    const { shellEl: b, primaryPane: w } = u.current;
    return Nt(b, d.to, "auto", w) ? (i(d.history), !0) : !1;
  }, [f]);
  return D(() => {
    const h = (p) => {
      if (!p.altKey || p.metaKey || p.ctrlKey || p.shiftKey || p.defaultPrevented || p.key !== "ArrowLeft" && p.key !== "ArrowRight" || Cp(p.target)) return;
      m(p.key === "ArrowLeft" ? "back" : "forward") && p.preventDefault();
    };
    return window.addEventListener("keydown", h), () => window.removeEventListener("keydown", h);
  }, [m]), {
    preview: o,
    closePreview: L(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: L(() => m("back"), [m])
  };
}
const Dp = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function Op() {
  const e = $t(), t = U(() => yp(e.regions), [e.regions]), { jumpToBlock: n } = e, r = L((s, i) => n(s.itemId, i), [n]), o = $p({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = U(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => wp(s, t) : void 0,
    shortcuts: Dp
  }), [t]);
  return sn(a), /* @__PURE__ */ C(Re, { children: [
    o.preview ? /* @__PURE__ */ g(Ap, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ C(G, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ g(ec, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const zp = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: Op }, Lr = [sp, up, fh, zp, rh, Kh];
function Cr(e = Lr) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function Fp(e) {
  const t = Be(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ g(Re, { children: (e.tabs ?? Cr()).map(({ id: s, label: i, Icon: l, needsJob: c }) => {
    const u = n === s, f = c && r, m = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: "reader-panel-toggle",
        "aria-label": m,
        "aria-pressed": u,
        title: f ? `${i} 需打开任务阅读` : i,
        disabled: f,
        onClick: () => u ? a() : o(s),
        children: /* @__PURE__ */ g(l, { className: "reader-close-home-icon", ...Me, "aria-hidden": !0 })
      },
      s
    );
  }) });
}
function Bp(e) {
  const t = Be(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = Cr().map(({ id: l, label: c, short: u, Icon: f, needsJob: m }) => ({
    key: l,
    label: c,
    short: u,
    Icon: f,
    disabled: m && o,
    selected: n === l,
    badge: r == null ? void 0 : r[l],
    onClick: () => a(l)
  }));
  return n ? /* @__PURE__ */ C("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ g("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: l, label: c, Icon: u, disabled: f, selected: m, badge: h, onClick: p }) => /* @__PURE__ */ C(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": m,
        className: `reader-assistant-dock-tab${m ? " is-active" : ""}`,
        title: f ? `${c} 需打开任务阅读` : c,
        disabled: f,
        onClick: p,
        children: [
          /* @__PURE__ */ g(u, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ g("span", { className: "reader-assistant-dock-tab-label", children: c }),
          h ? /* @__PURE__ */ g("span", { className: "reader-assistant-dock-badge", children: h }) : null
        ]
      },
      l
    )) }),
    /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ g(bt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function jp(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Hp(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Up(e) {
  return e / 100 * window.innerHeight;
}
function Wp(e) {
  return e / 100 * window.innerWidth;
}
function Kp(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function qt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Kp(n);
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
      r = Hp(t, o);
      break;
    }
    case "em": {
      r = jp(t, o);
      break;
    }
    case "vh": {
      r = Up(o);
      break;
    }
    case "vw": {
      r = Wp(o);
      break;
    }
  }
  return r;
}
function Ne(e) {
  return parseFloat(e.toFixed(3));
}
function Lt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function lr(e) {
  const { panels: t } = e, n = Lt({ group: e });
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
      const u = qt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = Ne(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = qt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Ne(u / n * 100);
    }
    let l = 0;
    if (a.minSize !== void 0) {
      const u = qt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      l = Ne(u / n * 100);
    }
    let c = 100;
    if (a.maxSize !== void 0) {
      const u = qt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      c = Ne(u / n * 100);
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
function he(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function ur(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Vp : qp
  );
}
function Vp(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function qp(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function js(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Hs(e, t) {
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
function Jp({
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
    const { x: i, y: l } = Hs(r, s), c = e === "horizontal" ? i : l;
    c < a && (a = c, o = s);
  }
  return he(o, "No rect found"), o;
}
let pn;
function Gp() {
  return pn === void 0 && (typeof matchMedia == "function" ? pn = !!matchMedia("(pointer:coarse)").matches : pn = !1), pn;
}
function Us(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = ur(
    n,
    Array.from(t.children).filter(js).map((p) => ({ element: p }))
  ).map(({ element: p }) => p), s = [];
  let i = !1, l = !1, c = -1, u = -1, f = 0, m, h = [];
  {
    let p = -1;
    for (const d of a)
      d.hasAttribute("data-panel") && (p++, d.hasAttribute("data-disabled") || (f++, c === -1 && (c = p), u = p));
  }
  if (f > 1) {
    let p = -1;
    for (const d of a)
      if (d.hasAttribute("data-panel")) {
        p++;
        const b = r.find(
          (w) => w.element === d
        );
        if (b) {
          if (m) {
            const w = m.element.getBoundingClientRect(), v = d.getBoundingClientRect();
            let y;
            if (l) {
              const k = n === "horizontal" ? new DOMRect(
                w.right,
                w.top,
                0,
                w.height
              ) : new DOMRect(
                w.left,
                w.bottom,
                w.width,
                0
              ), S = n === "horizontal" ? new DOMRect(v.left, v.top, 0, v.height) : new DOMRect(v.left, v.top, v.width, 0);
              switch (h.length) {
                case 0: {
                  y = [
                    k,
                    S
                  ];
                  break;
                }
                case 1: {
                  const R = h[0], E = Jp({
                    orientation: n,
                    rects: [w, v],
                    targetRect: R.element.getBoundingClientRect()
                  });
                  y = [
                    R,
                    E === w ? S : k
                  ];
                  break;
                }
                default: {
                  y = h;
                  break;
                }
              }
            } else
              h.length ? y = h : y = [
                n === "horizontal" ? new DOMRect(
                  w.right,
                  v.top,
                  v.left - w.right,
                  v.height
                ) : new DOMRect(
                  v.left,
                  w.bottom,
                  v.width,
                  v.top - w.bottom
                )
              ];
            for (const k of y) {
              let S = "width" in k ? k : k.element.getBoundingClientRect();
              const R = Gp() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (S.width < R) {
                const P = R - S.width;
                S = new DOMRect(
                  S.x - P / 2,
                  S.y,
                  S.width + P,
                  S.height
                );
              }
              if (S.height < R) {
                const P = R - S.height;
                S = new DOMRect(
                  S.x,
                  S.y - P / 2,
                  S.width,
                  S.height + P
                );
              }
              const E = p <= c || p > u;
              !i && !E && s.push({
                group: e,
                groupSize: Lt({ group: e }),
                panels: [m, b],
                separator: "width" in k ? void 0 : k,
                rect: S
              }), i = !1;
            }
          }
          l = !1, m = b, h = [];
        }
      } else if (d.hasAttribute("data-separator")) {
        d.ariaDisabled !== null && (i = !0);
        const b = o.find(
          (w) => w.element === d
        );
        b ? h.push(b) : (m = void 0, h = []);
      } else
        l = !0;
  }
  return s;
}
var at;
class Ws {
  constructor() {
    to(this, at, {});
  }
  addListener(t, n) {
    const r = Dt(this, at)[t];
    return r === void 0 ? Dt(this, at)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = Dt(this, at)[t];
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
    no(this, at, {});
  }
  removeListener(t, n) {
    const r = Dt(this, at)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
at = new WeakMap();
let Mt = {
  cursorFlags: 0,
  state: "inactive"
};
const $r = new Ws();
function pt() {
  return Mt;
}
function Xp(e) {
  return $r.addListener("change", e);
}
function Yp(e) {
  const t = Mt, n = { ...Mt };
  n.cursorFlags = e, Mt = n, $r.emit("change", {
    prev: t,
    next: n
  });
}
function xt(e) {
  const t = Mt;
  Mt = e, $r.emit("change", {
    prev: t,
    next: e
  });
}
const Zp = (e) => e, Kn = () => {
}, Ks = 1, Vs = 2, qs = 4, Js = 8, aa = 3, sa = 12;
let gn;
function ia() {
  return gn === void 0 && (gn = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (gn = !0)), gn;
}
function Qp({
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
        if (e && ia()) {
          const a = (e & Ks) !== 0, s = (e & Vs) !== 0, i = (e & qs) !== 0, l = (e & Js) !== 0;
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
    return ia() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const ca = /* @__PURE__ */ new WeakMap();
function Dr(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = ca.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = pt();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Qp({
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
  ca.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Ue = /* @__PURE__ */ new Map();
const Gs = new Ws();
function eg(e) {
  Ue = new Map(Ue), Ue.delete(e);
}
function la(e, t) {
  for (const [n] of Ue)
    if (n.id === e)
      return n;
}
function it(e, t) {
  for (const [n, r] of Ue)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function vt() {
  return Ue;
}
function Or(e, t) {
  return Gs.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ye(e, t, n) {
  const r = Ue.get(e);
  Ue = new Map(Ue), Ue.set(e, t), Gs.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Xs(e) {
  const t = pt();
  let n = !1;
  switch (t.state) {
    case "active":
      xt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Dr(e), n = !0, t.hitRegions.forEach((r) => {
        const o = it(r.group.id, !0);
        Ye(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function ua(e) {
  e.defaultPrevented || Xs(e.currentTarget);
}
function tg(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Hs(n, a.rect);
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
function ng(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function rg(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: ma(e),
    b: ma(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  he(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: fa(da(n.a)),
    b: fa(da(n.b))
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
const og = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function ag(e) {
  const t = getComputedStyle(Ys(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function sg(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || ag(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || og.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function da(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (he(n, "Missing node"), sg(n)) return n;
  }
  return null;
}
function fa(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function ma(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Ys(e);
  return t;
}
function Ys(e) {
  const { parentNode: t } = e;
  return ng(t) ? t.host : t;
}
function ig(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function cg({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!js(n) || n.contains(e) || e.contains(n))
    return !0;
  if (rg(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (ig(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function zr(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Us(o), s = tg(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && cg({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function lg(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function Ae(e, t, n = 0) {
  return Math.abs(Ne(e) - Ne(t)) <= n;
}
function He(e, t) {
  return Ae(e, t) ? 0 : e > t ? 1 : -1;
}
function Rt({
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
  if (He(r, l) < 0)
    if (a) {
      const c = (o + l) / 2;
      He(r, c) < 0 ? r = o : r = l;
    } else
      r = l;
  return r = Math.min(i, r), r = Ne(r), r;
}
function Qt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (Ae(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), l = Object.values(o), c = [...i], [u, f] = r;
  he(u != null, "Invalid first pivot index"), he(f != null, "Invalid second pivot index");
  let m = 0;
  switch (a) {
    case "keyboard": {
      {
        const d = e < 0 ? f : u, b = n[d];
        he(
          b,
          `Panel constraints not found for index ${d}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: v,
          minSize: y = 0
        } = b;
        if (v) {
          const k = i[d];
          if (he(
            k != null,
            `Previous layout not found for panel index ${d}`
          ), Ae(k, w)) {
            const S = y - k;
            He(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      {
        const d = e < 0 ? u : f, b = n[d];
        he(
          b,
          `No panel constraints found for index ${d}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: v,
          minSize: y = 0
        } = b;
        if (v) {
          const k = i[d];
          if (he(
            k != null,
            `Previous layout not found for panel index ${d}`
          ), Ae(k, y)) {
            const S = k - w;
            He(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      break;
    }
    default: {
      const d = e < 0 ? f : u, b = n[d];
      he(
        b,
        `Panel constraints not found for index ${d}`
      );
      const w = i[d], { collapsible: v, collapsedSize: y, minSize: k } = b;
      if (v && He(w, k) < 0)
        if (e > 0) {
          const S = k - y, R = S / 2, E = w + e;
          He(E, k) < 0 && (e = He(e, R) <= 0 ? 0 : S);
        } else {
          const S = k - y, R = 100 - S / 2, E = w - e;
          He(E, k) < 0 && (e = He(100 + e, R) > 0 ? 0 : -S);
        }
      break;
    }
  }
  {
    const d = e < 0 ? 1 : -1;
    let b = e < 0 ? f : u, w = 0;
    for (; ; ) {
      const y = i[b];
      he(
        y != null,
        `Previous layout not found for panel index ${b}`
      );
      const k = Rt({
        overrideDisabledPanels: s,
        panelConstraints: n[b],
        prevSize: y,
        size: 100
      }) - y;
      if (w += k, b += d, b < 0 || b >= n.length)
        break;
    }
    const v = Math.min(Math.abs(e), Math.abs(w));
    e = e < 0 ? 0 - v : v;
  }
  {
    let d = e < 0 ? u : f;
    for (; d >= 0 && d < n.length; ) {
      const b = Math.abs(e) - Math.abs(m), w = i[d];
      he(
        w != null,
        `Previous layout not found for panel index ${d}`
      );
      const v = w - b, y = Rt({
        overrideDisabledPanels: s,
        panelConstraints: n[d],
        prevSize: w,
        size: v
      });
      if (!Ae(w, y) && (m += w - y, c[d] = y, m.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? d-- : d++;
    }
  }
  if (lg(l, c))
    return o;
  {
    const d = e < 0 ? f : u, b = i[d];
    he(
      b != null,
      `Previous layout not found for panel index ${d}`
    );
    const w = b + m, v = Rt({
      overrideDisabledPanels: s,
      panelConstraints: n[d],
      prevSize: b,
      size: w
    });
    if (c[d] = v, !Ae(v, w)) {
      let y = w - v, k = e < 0 ? f : u;
      for (; k >= 0 && k < n.length; ) {
        const S = c[k];
        he(
          S != null,
          `Previous layout not found for panel index ${k}`
        );
        const R = S + y, E = Rt({
          overrideDisabledPanels: s,
          panelConstraints: n[k],
          prevSize: S,
          size: R
        });
        if (Ae(S, E) || (y -= E - S, c[k] = E), Ae(y, 0))
          break;
        e > 0 ? k-- : k++;
      }
    }
  }
  const h = Object.values(c).reduce(
    (d, b) => b + d,
    0
  );
  if (!Ae(h, 100, 0.1))
    return o;
  const p = Object.keys(o);
  return c.reduce((d, b, w) => (d[p[w]] = b, d), {});
}
function gt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || He(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function yt({
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
  if (!Ae(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const l = r[i];
      he(l != null, `No layout data found for index ${i}`);
      const c = 100 / o * l;
      r[i] = c;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const l = n[i];
    he(l != null, `No layout data found for index ${i}`);
    const c = r[i];
    he(c != null, `No layout data found for index ${i}`);
    const u = Rt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: l,
      size: c
    });
    c != u && (a += c - u, r[i] = u);
  }
  if (!Ae(a, 0))
    for (let i = 0; i < t.length; i++) {
      const l = r[i];
      he(l != null, `No layout data found for index ${i}`);
      const c = l + a, u = Rt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: l,
        size: c
      });
      if (l !== u && (a -= u - l, r[i] = u, Ae(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, l, c) => (i[s[c]] = l, i), {});
}
function Zs({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const l = vt();
    for (const [
      c,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: f,
        layout: m,
        groupSize: h,
        separatorToPanels: p
      }
    ] of l)
      if (c.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: f,
          group: c,
          groupSize: h,
          layout: m,
          separatorToPanels: p
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
    prevLayout: u,
    derivedPanelConstraints: f
  }) => {
    const m = a(), h = c.findIndex((b) => b.id === t), p = h === 0, d = h === c.length - 1;
    if (d && l < m && (p || c.slice(0, h).every((b, w) => {
      const v = f[w];
      return (v == null ? void 0 : v.collapsible) && Ae(v.collapsedSize, u[v.panelId]);
    }))) {
      const b = c.slice(0, h).reduce((w, v) => w + u[v.id], 0);
      return {
        ...u,
        [t]: Ne(100 - b)
      };
    }
    return Qt({
      delta: d ? m - l : l - m,
      initialLayout: u,
      panelConstraints: f,
      pivotIndices: d ? [h - 1, h] : [h, h + 1],
      prevLayout: u,
      trigger: "imperative-api"
    });
  }, i = (l) => {
    const c = a();
    if (l === c)
      return;
    const {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: f,
      group: m,
      groupSize: h,
      layout: p,
      separatorToPanels: d
    } = n(), b = s({
      nextSize: l,
      panels: m.panels,
      prevLayout: p,
      derivedPanelConstraints: f
    }), w = yt({
      layout: b,
      panelConstraints: f
    });
    gt(p, w) || Ye(m, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: f,
      groupSize: h,
      layout: w,
      separatorToPanels: d
    });
  };
  return {
    collapse: () => {
      const { collapsible: l, collapsedSize: c } = r(), { mutableValues: u } = o(), f = a();
      l && f !== c && (u.expandToSize = f, i(c));
    },
    expand: () => {
      const { collapsible: l, collapsedSize: c, minSize: u } = r(), { mutableValues: f } = o(), m = a();
      if (l && m === c) {
        let h = f.expandToSize ?? u;
        h === 0 && (h = 1), i(h);
      }
    },
    getSize: () => {
      const { group: l } = n(), c = a(), { element: u } = o(), f = l.orientation === "horizontal" ? u.offsetWidth : u.offsetHeight;
      return {
        asPercentage: c,
        inPixels: f
      };
    },
    isCollapsed: () => {
      const { collapsible: l, collapsedSize: c } = r(), u = a();
      return l && Ae(c, u);
    },
    resize: (l) => {
      const { group: c } = n(), { element: u } = o(), f = Lt({ group: c }), m = qt({
        groupSize: f,
        panelElement: u,
        styleProp: l
      }), h = Ne(m / f * 100);
      i(h);
    }
  };
}
function ha(e) {
  if (e.defaultPrevented)
    return;
  const t = vt();
  zr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Zs({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function yn(e) {
  const t = vt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Qs({
  groupId: e
}) {
  const t = () => {
    const n = vt();
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
      } = t(), c = yt({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (gt(i, c) || Ye(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: c,
        separatorToPanels: l
      }), c);
    }
  };
}
function ut(e, t) {
  const n = yn(e), r = it(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  he(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  he(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = Qs({ groupId: n.id }).getLayout(), l = Qt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), c = yt({
    layout: l,
    panelConstraints: r.derivedPanelConstraints
  });
  gt(i, c) || Ye(
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
function pa(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = yn(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && ut(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && ut(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && ut(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && ut(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), ut(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = yn(t), o = it(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, l = r.separators.find(
          (m) => m.element === t
        );
        he(l, "Matching separator not found");
        const c = i.get(l);
        he(c, "Matching panels not found");
        const u = c[0], f = a.find(
          (m) => m.panelId === u.id
        );
        if (he(f, "Panel metadata not found"), f.collapsible) {
          const m = s[u.id], h = f.collapsedSize === m ? r.mutableState.expandedPanelSizes[u.id] ?? f.minSize : f.collapsedSize;
          ut(t, h - m);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = yn(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        he(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), ut(t, -100);
        break;
      }
    }
}
function ga(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = vt(), n = zr(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), xt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function ei({
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
    const { group: u, groupSize: f } = c, { orientation: m, panels: h } = u, { disableCursor: p } = u.mutableState;
    let d = 0;
    a ? m === "horizontal" ? d = (t.clientX - a.x) / f * 100 : d = (t.clientY - a.y) / f * 100 : m === "horizontal" ? d = t.clientX < 0 ? -100 : 100 : d = t.clientY < 0 ? -100 : 100;
    const b = r.get(u), w = o.get(u);
    if (!b || !w)
      return;
    const {
      defaultLayoutDeferred: v,
      derivedPanelConstraints: y,
      groupSize: k,
      layout: S,
      separatorToPanels: R
    } = w;
    if (y && S && R) {
      const E = Qt({
        delta: d,
        initialLayout: b,
        panelConstraints: y,
        pivotIndices: c.panels.map((P) => h.indexOf(P)),
        prevLayout: S,
        trigger: "mouse-or-touch"
      });
      if (gt(E, S)) {
        if (d !== 0 && !p)
          switch (m) {
            case "horizontal": {
              i |= d < 0 ? Ks : Vs;
              break;
            }
            case "vertical": {
              i |= d < 0 ? qs : Js;
              break;
            }
          }
      } else
        Ye(c.group, {
          defaultLayoutDeferred: v,
          derivedPanelConstraints: y,
          groupSize: k,
          layout: E,
          separatorToPanels: R
        });
    }
  });
  let l = 0;
  t.movementX === 0 ? l |= s & aa : l |= i & aa, t.movementY === 0 ? l |= s & sa : l |= i & sa, Yp(l), Dr(e);
}
function ya(e) {
  const t = vt(), n = pt();
  switch (n.state) {
    case "active":
      ei({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function ba(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = pt(), n = vt();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        xt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = it(a.group.id, !0);
          Ye(a.group, s, {
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
      ei({
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
      const a = zr(e, n);
      a.length === 0 ? t.state !== "inactive" && xt({
        cursorFlags: 0,
        state: "inactive"
      }) : xt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Dr(e.currentTarget);
      break;
    }
  }
}
function va(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (pt().state) {
      case "hover":
        xt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function wa(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Xs(e.currentTarget) && e.preventDefault();
}
function Sa(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = Ne(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = Ne((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function ug(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((l) => l.element === t);
  if (!r || !r.onResize)
    return;
  const o = Lt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: Ne(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function dg(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function fg({
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
    const m = r[f.id] ?? 0;
    switch (f.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const h = m / 100 * n, p = Ne(
          h / t * 100
        );
        i.set(f.id, p), o += p;
        break;
      }
      case "preserve-relative-size":
      default: {
        l.push(f.id), a += m;
        break;
      }
    }
  }
  if (!s || l.length === 0)
    return r;
  const c = 100 - o, u = { ...r };
  if (i.forEach((f, m) => {
    u[m] = f;
  }), a > 0)
    for (const f of l) {
      const m = r[f] ?? 0;
      u[f] = Ne(
        m / a * c
      );
    }
  else {
    const f = Ne(
      c / l.length
    );
    for (const m of l)
      u[m] = f;
  }
  return u;
}
function mg(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Tt = /* @__PURE__ */ new Map();
function hg(e) {
  let t = !0;
  he(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((p) => {
    for (const d of p) {
      const { borderBoxSize: b, target: w } = d;
      if (w === e.element) {
        if (t) {
          const v = Lt({ group: e });
          if (v === 0)
            return;
          const y = it(e.id);
          if (!y)
            return;
          const k = lr(e), S = y.defaultLayoutDeferred ? Sa(k) : y.layout, R = fg({
            group: e,
            nextGroupSize: v,
            prevGroupSize: y.groupSize,
            prevLayout: S
          }), E = yt({
            layout: R,
            panelConstraints: k
          });
          if (!y.defaultLayoutDeferred && gt(y.layout, E) && dg(
            y.derivedPanelConstraints,
            k
          ) && y.groupSize === v)
            return;
          Ye(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: k,
            groupSize: v,
            layout: E,
            separatorToPanels: y.separatorToPanels
          });
        }
      } else
        ug(e, w, b);
    }
  });
  a.observe(e.element), e.panels.forEach((p) => {
    he(
      !r.has(p.id),
      `Panel ids must be unique; id "${p.id}" was used more than once`
    ), r.add(p.id), p.onResize && a.observe(p.element);
  });
  const s = Lt({ group: e }), i = lr(e), l = e.panels.map(({ id: p }) => p).join(",");
  let c = e.mutableState.defaultLayout;
  c && (mg(e.panels, c) || (c = void 0));
  const u = e.mutableState.layouts[l] ?? c ?? Sa(i), f = yt({
    layout: u,
    panelConstraints: i
  }), m = e.element.ownerDocument;
  Tt.set(
    m,
    (Tt.get(m) ?? 0) + 1
  );
  const h = /* @__PURE__ */ new Map();
  return Us(e).forEach((p) => {
    p.separator && h.set(p.separator, p.panels);
  }), Ye(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: h
  }), e.separators.forEach((p) => {
    he(
      !o.has(p.id),
      `Separator ids must be unique; id "${p.id}" was used more than once`
    ), o.add(p.id), p.element.addEventListener("keydown", pa);
  }), Tt.get(m) === 1 && (m.addEventListener("contextmenu", ua, !0), m.addEventListener("dblclick", ha, !0), m.addEventListener("pointerdown", ga, !0), m.addEventListener("pointerleave", ya), m.addEventListener("pointermove", ba), m.addEventListener("pointerout", va), m.addEventListener("pointerup", wa, !0)), function() {
    t = !1, Tt.set(
      m,
      Math.max(0, (Tt.get(m) ?? 0) - 1)
    ), eg(e), e.separators.forEach((p) => {
      p.element.removeEventListener("keydown", pa);
    }), Tt.get(m) || (m.removeEventListener(
      "contextmenu",
      ua,
      !0
    ), m.removeEventListener(
      "dblclick",
      ha,
      !0
    ), m.removeEventListener(
      "pointerdown",
      ga,
      !0
    ), m.removeEventListener("pointerleave", ya), m.removeEventListener("pointermove", ba), m.removeEventListener("pointerout", va), m.removeEventListener("pointerup", wa, !0)), a.disconnect();
  };
}
function pg() {
  const [e, t] = x({}), n = L(() => t({}), []);
  return [e, n];
}
function Fr(e) {
  const t = Ca();
  return `${e ?? t}`;
}
const wt = typeof window < "u" ? Le : D;
function Gt(e) {
  const t = N(e);
  return wt(() => {
    t.current = e;
  }, [e]), L(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function Br(...e) {
  return Gt((t) => {
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
function jr(e) {
  const t = N({ ...e });
  return wt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const ti = rn(null);
function gg(e, t) {
  const n = N({
    getLayout: () => ({}),
    setLayout: Zp
  });
  yr(t, () => n.current, []), wt(() => {
    Object.assign(
      n.current,
      Qs({ groupId: e })
    );
  });
}
function ni({
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
  orientation: u = "horizontal",
  resizeTargetMinimumSize: f = {
    coarse: 20,
    fine: 10
  },
  style: m,
  ...h
}) {
  const p = N({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), d = Gt((T) => {
    gt(p.current.onLayoutChange, T) || (p.current.onLayoutChange = T, l == null || l(T));
  }), b = Gt(
    (T, I) => {
      gt(p.current.onLayoutChanged, T) || (p.current.onLayoutChanged = T, c == null || c(T, { isUserInteraction: I }));
    }
  ), w = Fr(i), v = N(null), [y, k] = pg(), S = N({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), R = Br(v, a);
  gg(w, s);
  const E = Gt(
    (T, I) => {
      const M = pt(), $ = la(T), z = it(T);
      if (z) {
        let K = !1;
        switch (M.state) {
          case "active": {
            K = M.hitRegions.some(
              (H) => H.group === $
            );
            break;
          }
        }
        return {
          flexGrow: z.layout[I] ?? 1,
          pointerEvents: K ? "none" : void 0
        };
      }
      if (n != null && n[I])
        return {
          flexGrow: n == null ? void 0 : n[I]
        };
    }
  ), P = jr({
    defaultLayout: n,
    disableCursor: r
  }), O = U(
    () => ({
      get disableCursor() {
        return !!P.disableCursor;
      },
      getPanelStyles: E,
      id: w,
      orientation: u,
      registerPanel: (T) => {
        const I = S.current;
        return I.panels = ur(u, [
          ...I.panels,
          T
        ]), k(), () => {
          I.panels = I.panels.filter(
            (M) => M !== T
          ), k();
        };
      },
      registerSeparator: (T) => {
        const I = S.current;
        return I.separators = ur(u, [
          ...I.separators,
          T
        ]), k(), () => {
          I.separators = I.separators.filter(
            (M) => M !== T
          ), k();
        };
      },
      updatePanelProps: (T, { disabled: I }) => {
        const M = S.current.panels.find(
          (K) => K.id === T
        );
        M && (M.panelConstraints.disabled = I);
        const $ = la(w), z = it(w);
        $ && z && Ye($, {
          ...z,
          derivedPanelConstraints: lr($)
        });
      },
      updateSeparatorProps: (T, {
        disabled: I,
        disableDoubleClick: M
      }) => {
        const $ = S.current.separators.find(
          (z) => z.id === T
        );
        $ && ($.disabled = I, $.disableDoubleClick = M);
      }
    }),
    [E, w, k, u, P]
  ), _ = N(null);
  return wt(() => {
    const T = v.current;
    if (T === null)
      return;
    const I = S.current;
    let M;
    if (P.defaultLayout !== void 0 && Object.keys(P.defaultLayout).length === I.panels.length) {
      M = {};
      for (const q of I.panels) {
        const se = P.defaultLayout[q.id];
        se !== void 0 && (M[q.id] = se);
      }
    }
    const $ = {
      disabled: !!o,
      element: T,
      id: w,
      mutableState: {
        defaultLayout: M,
        disableCursor: !!P.disableCursor,
        expandedPanelSizes: S.current.lastExpandedPanelSizes,
        layouts: S.current.layouts
      },
      orientation: u,
      panels: I.panels,
      resizeTargetMinimumSize: I.resizeTargetMinimumSize,
      separators: I.separators
    };
    _.current = $;
    const z = hg($), { defaultLayoutDeferred: K, derivedPanelConstraints: H, layout: J } = it($.id, !0);
    !K && H.length > 0 && (d(J), b(J, !1));
    const oe = Or(w, (q) => {
      const { defaultLayoutDeferred: se, derivedPanelConstraints: Ee, layout: re } = q.next;
      if (se || Ee.length === 0)
        return;
      const ue = $.panels.map(({ id: ie }) => ie).join(",");
      $.mutableState.layouts[ue] = re, Ee.forEach((ie) => {
        if (ie.collapsible) {
          const { layout: le } = q.prev ?? {};
          if (le) {
            const B = Ae(
              ie.collapsedSize,
              re[ie.panelId]
            ), W = Ae(
              ie.collapsedSize,
              le[ie.panelId]
            );
            B && !W && ($.mutableState.expandedPanelSizes[ie.panelId] = le[ie.panelId]);
          }
        }
      });
      const xe = pt().state !== "active";
      d(re), xe && b(re, q.isUserInteraction);
    });
    return () => {
      _.current = null, z(), oe();
    };
  }, [
    o,
    w,
    b,
    d,
    u,
    y,
    P
  ]), D(() => {
    const T = _.current;
    T && (T.mutableState.defaultLayout = n, T.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ g(ti.Provider, { value: O, children: /* @__PURE__ */ g(
    "div",
    {
      ...h,
      className: t,
      "data-group": !0,
      "data-testid": w,
      id: w,
      ref: R,
      style: {
        height: "100%",
        width: "100%",
        overflow: "hidden",
        ...m,
        display: "flex",
        flexDirection: u === "horizontal" ? "row" : "column",
        flexWrap: "nowrap",
        // Inform the browser that the library is handling touch events for this element
        // but still allow users to scroll content within panels in the non-resizing direction
        // NOTE This is not an inherited style
        // See github.com/bvaughn/react-resizable-panels/issues/662
        touchAction: u === "horizontal" ? "pan-y" : "pan-x"
      },
      children: e
    }
  ) });
}
ni.displayName = "Group";
function Hr() {
  const e = ft(ti);
  return he(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function yg(e, t) {
  const { id: n } = Hr(), r = N({
    collapse: Kn,
    expand: Kn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Kn
  });
  yr(t, () => r.current, []), wt(() => {
    Object.assign(
      r.current,
      Zs({ groupId: n, panelId: e })
    );
  });
}
function dr({
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
  minSize: u = "0%",
  onResize: f,
  panelRef: m,
  style: h,
  ...p
}) {
  const d = !!l, b = Fr(l), w = jr({
    disabled: a
  }), v = N(null), y = Br(v, s), {
    getPanelStyles: k,
    id: S,
    orientation: R,
    registerPanel: E,
    updatePanelProps: P
  } = Hr(), O = f !== null, _ = Gt(
    ($, z, K) => {
      f == null || f($, l, K);
    }
  );
  wt(() => {
    const $ = v.current;
    if ($ !== null) {
      const z = {
        element: $,
        id: b,
        idIsStable: d,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: O ? _ : void 0,
        panelConstraints: {
          groupResizeBehavior: i,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: w.disabled,
          maxSize: c,
          minSize: u
        }
      };
      return E(z);
    }
  }, [
    i,
    n,
    r,
    o,
    O,
    b,
    d,
    c,
    u,
    _,
    E,
    w
  ]), D(() => {
    P(b, { disabled: a });
  }, [a, b, P]), yg(b, m);
  const T = () => {
    const $ = k(S, b);
    if ($)
      return JSON.stringify($);
  }, I = An(
    ($) => Or(S, $),
    T,
    T
  );
  let M;
  return I ? M = JSON.parse(I) : o !== void 0 ? M = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : M = { flexGrow: 1 }, /* @__PURE__ */ g(
    "div",
    {
      ...p,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": b,
      id: b,
      ref: y,
      style: {
        ...bg,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...M
      },
      children: /* @__PURE__ */ g(
        "div",
        {
          className: t,
          style: {
            maxHeight: "100%",
            maxWidth: "100%",
            flexGrow: 1,
            overflow: "auto",
            ...h,
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
dr.displayName = "Panel";
const bg = {
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
function vg({
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
    const l = i.maxSize, c = i.collapsible ? i.collapsedSize : i.minSize, u = [r, r + 1];
    a = yt({
      layout: Qt({
        delta: c - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = yt({
      layout: Qt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
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
function ri({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const l = Fr(a), c = jr({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = x({}), [m, h] = x("inactive"), [p, d] = x(!1), b = N(null), w = Br(b, o), {
    disableCursor: v,
    id: y,
    orientation: k,
    registerSeparator: S,
    updateSeparatorProps: R
  } = Hr(), E = k === "horizontal" ? "vertical" : "horizontal";
  wt(() => {
    const _ = b.current;
    if (_ !== null) {
      const T = {
        disabled: c.disabled,
        disableDoubleClick: c.disableDoubleClick,
        element: _,
        id: l
      }, I = S(T), M = Xp(
        (z) => {
          h(
            z.next.state !== "inactive" && z.next.hitRegions.some(
              (K) => K.separator === T
            ) ? z.next.state : "inactive"
          );
        }
      ), $ = Or(
        y,
        (z) => {
          const { derivedPanelConstraints: K, layout: H, separatorToPanels: J } = z.next, oe = J.get(T);
          if (oe) {
            const q = oe[0], se = oe.indexOf(q);
            f(
              vg({
                layout: H,
                panelConstraints: K,
                panelId: q.id,
                panelIndex: se
              })
            );
          }
        }
      );
      return () => {
        M(), $(), I();
      };
    }
  }, [y, l, S, c]), D(() => {
    R(l, { disabled: n, disableDoubleClick: r });
  }, [n, r, l, R]);
  let P;
  n && !v && (P = "not-allowed");
  let O;
  if (n)
    O = "disabled";
  else
    switch (m) {
      case "active": {
        O = "active";
        break;
      }
      default:
        p ? O = "focus" : O = m;
    }
  return /* @__PURE__ */ g(
    "div",
    {
      ...i,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": E,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": O,
      "data-testid": l,
      id: l,
      onBlur: () => d(!1),
      onFocus: () => d(!0),
      ref: w,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: P,
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
ri.displayName = "Separator";
const Ur = 30, Wr = 65, en = 50, wg = 100 - Wr, Sg = 100 - Ur;
function kg(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Wr, Math.max(Ur, t)) : en;
}
function Kr(e) {
  return 100 - e;
}
function It(e) {
  return `${e}%`;
}
const Vr = "reader-document", tn = "reader-assistant", oi = "retainpdf.reader.ai-split-layout.v1", Tg = {
  [Vr]: Kr(en),
  [tn]: en
};
function qr(e) {
  const t = kg(e == null ? void 0 : e[tn]);
  return {
    [Vr]: Kr(t),
    [tn]: t
  };
}
function Ig() {
  try {
    const e = JSON.parse(localStorage.getItem(oi) || "null");
    return qr(e);
  } catch {
    return Tg;
  }
}
function Eg(e) {
  try {
    localStorage.setItem(oi, JSON.stringify(qr(e)));
  } catch {
  }
}
function Vn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = qr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[tn]}vw`
  );
}
function Rg() {
  const e = N(null), [t] = x(Ig);
  Le(() => {
    const o = e.current;
    return Vn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = L((o) => {
    Vn(e.current, o);
  }, []), r = L((o, a) => {
    Vn(e.current, o), a.isUserInteraction && Eg(o);
  }, []);
  return /* @__PURE__ */ C(
    ni,
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
        /* @__PURE__ */ g(
          dr,
          {
            id: Vr,
            defaultSize: It(Kr(en)),
            minSize: It(wg),
            maxSize: It(Sg)
          }
        ),
        /* @__PURE__ */ g(
          ri,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ g("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ g(
          dr,
          {
            id: tn,
            defaultSize: It(en),
            minSize: It(Ur),
            maxSize: It(Wr)
          }
        )
      ]
    }
  );
}
function Pg({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = x(!1);
  if (D(() => {
    !e && !t && o(!1);
  }, [e, t]), r || !e && !t)
    return null;
  const a = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ C("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ C("span", { className: "reader-error-notice-text", children: [
      a.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    n ? /* @__PURE__ */ g(G, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
    /* @__PURE__ */ g(
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
function Mg({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ g(Pg, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ C(Re, { children: [
    e ? /* @__PURE__ */ g("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ C("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ g("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ g("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ g(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ C("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ g("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ g(G, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function xg(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Ag() {
  const [e, t] = x(!1), n = Ca(), r = N(null), o = As(), a = U(() => [...Au, ...am(o)], [o]);
  return D(() => {
    if (!e) return;
    const s = (l) => {
      const c = r.current;
      c && l.target instanceof Node && !c.contains(l.target) && t(!1);
    }, i = (l) => {
      l.key === "Escape" && (l.preventDefault(), t(!1));
    };
    return document.addEventListener("mousedown", s), window.addEventListener("keydown", i), () => {
      document.removeEventListener("mousedown", s), window.removeEventListener("keydown", i);
    };
  }, [e]), D(() => {
    const s = (i) => {
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || xg(i.target)) return;
      const l = i.key;
      if (l === "?" || l === "h" || l === "H" || l === "/") {
        if (l === "/" && !i.shiftKey)
          return;
        i.preventDefault(), t((c) => !c);
      }
    };
    return window.addEventListener("keydown", s), () => window.removeEventListener("keydown", s);
  }, []), /* @__PURE__ */ C("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((s) => !s),
        children: /* @__PURE__ */ g(tc, { ...Me, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ C(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ C("div", { className: "reader-react-shortcuts-head", children: [
            /* @__PURE__ */ g("strong", { children: "快捷键" }),
            /* @__PURE__ */ g(
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
          /* @__PURE__ */ g("div", { className: "reader-react-shortcuts-body", children: a.map((s) => /* @__PURE__ */ C("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ g("h3", { children: s.title }),
            /* @__PURE__ */ g("ul", { children: s.items.map((i) => /* @__PURE__ */ C("li", { children: [
              /* @__PURE__ */ g("kbd", { children: i.keys }),
              /* @__PURE__ */ g("span", { children: i.desc })
            ] }, `${s.title}-${i.keys}`)) })
          ] }, s.title)) }),
          /* @__PURE__ */ g("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const _g = ["source", "sideBySide", "translated"], Ng = { source: "", translated: "", sideBySide: "" };
function Lg(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = vn(e.sourceUrl), n = vn(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return kc({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Cg(e) {
  const [t, n] = x(() => /* @__PURE__ */ new Set()), r = U(
    () => e ? Lg(e) : Ng,
    [e]
  ), o = U(
    () => _g.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = L(async (s) => {
    if (!e) return;
    const i = vn(r[s]);
    if (!(!i || t.has(s)))
      try {
        const l = e.jobId ? Sc(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Tc(
          e.fetchProtected,
          i,
          l,
          l,
          null,
          (c) => n((u) => {
            const f = new Set(u);
            return c ? f.add(s) : f.delete(s), f;
          })
        );
      } catch (l) {
        const c = l instanceof Error ? l.message : "下载失败";
        Ic(c), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const $g = {
  source: Fa,
  sideBySide: Ba,
  translated: ja
}, Dg = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Og(e) {
  const t = Be(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Cg(n), i = N(null);
  return D(() => {
    const l = () => {
      var f;
      (f = i.current) != null && f.open && (i.current.open = !1);
    }, c = (f) => {
      i.current && !i.current.contains(f.target) && l();
    }, u = (f) => {
      f.key === "Escape" && l();
    };
    return document.addEventListener("pointerdown", c), document.addEventListener("keydown", u), () => {
      document.removeEventListener("pointerdown", c), document.removeEventListener("keydown", u);
    };
  }, []), /* @__PURE__ */ C("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ C("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ g(nc, { ...Me, "aria-hidden": !0 }),
      /* @__PURE__ */ g("span", { className: "reader-download-trigger-label", children: "下载" })
    ] }),
    /* @__PURE__ */ g("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((l) => {
      const c = Ii[l], u = vn(r[l]), f = a.has(l), m = !!u && !f, h = m ? "" : Ei(l, r), p = $g[l];
      return /* @__PURE__ */ C(
        "button",
        {
          type: "button",
          id: `reader-download-${l}`,
          className: `reader-download-action${f ? " is-busy" : ""}`,
          disabled: !m,
          "aria-label": m ? `下载${c.label}` : h,
          onClick: () => {
            i.current && (i.current.open = !1), s(l);
          },
          children: [
            /* @__PURE__ */ g(p, { ...Me, "aria-hidden": !0 }),
            /* @__PURE__ */ C("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ C("span", { className: "reader-download-action-label", children: [
                Dg[l],
                " PDF"
              ] }),
              h ? /* @__PURE__ */ g("span", { className: "reader-download-action-reason", children: h }) : null
            ] })
          ]
        },
        l
      );
    }) })
  ] });
}
const zg = "retainpdf:reader:bookmarks:v1:", Fg = 200;
function Jr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function ai(e) {
  const t = `${e || ""}`.trim();
  return t ? `${zg}${t}` : "";
}
function Bg(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Xt(e, t = Jr()) {
  const n = ai(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Bg(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
const fr = /* @__PURE__ */ new Set();
function jg(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return fr.add(n), () => {
    fr.delete(n);
  };
}
function mr(e, t, n) {
  const r = ai(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Fg);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...fr]) a(e);
  return o;
}
function Hg(e, t, n = "", { storage: r = Jr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Xt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? mr(e, a.filter((i) => i.page !== s), r) : mr(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Ug(e, t, n = Jr()) {
  return mr(e, Xt(e, n).filter((r) => r.page !== t), n);
}
function Wg(e, t) {
  var r, o, a, s;
  let n = null;
  for (const i of e || []) {
    if (`${(i == null ? void 0 : i.regionType) || ""}` != "heading") continue;
    const l = Number(((r = i.source) == null ? void 0 : r.page) ?? ((o = i.translated) == null ? void 0 : o.page));
    if (!Number.isFinite(l) || l > t) continue;
    const c = `${((a = i.translated) == null ? void 0 : a.text) || i.markdown || ((s = i.source) == null ? void 0 : s.text) || ""}`.replace(/\s+/g, " ").trim();
    if (!c) continue;
    const u = Number(i.readingOrder) || 0;
    (!n || l > n.page || l === n.page && u >= n.order) && (n = { page: l, order: u, text: c });
  }
  return n ? n.text.slice(0, 60) : "";
}
function si(e, t) {
  const [n, r] = x(() => Xt(e));
  D(() => (r(Xt(e)), jg(e, () => r(Xt(e)))), [e]);
  const o = L((s) => {
    r(Hg(e, s, Wg(t, s)));
  }, [e, t]), a = L((s) => r(Ug(e, s)), [e]);
  return { bookmarks: n, toggle: o, remove: a };
}
const Kg = "retainpdf:reader:favorites:v1:", Vg = 500, Gr = 2e3;
function Xr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function ii(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Kg}${t}` : "";
}
function qg(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page)), r = `${t.text || ""}`.trim().slice(0, Gr), o = `${t.id || ""}`.trim();
  return !o || !r || !Number.isFinite(n) || n < 1 ? null : { id: o, text: r, page: n, pane: t.pane === "translated" ? "translated" : "source", createdAt: `${t.createdAt || ""}` };
}
function At(e, t = Xr()) {
  const n = ii(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Set(), a = [];
    for (const s of Array.isArray(r) ? r : []) {
      const i = qg(s);
      i && !o.has(i.id) && (o.add(i.id), a.push(i));
    }
    return a;
  } catch {
    return [];
  }
}
const hr = /* @__PURE__ */ new Set();
function Jg(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return hr.add(n), () => {
    hr.delete(n);
  };
}
function ci(e, t, n) {
  const r = ii(e), o = t.slice(0, Vg);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...hr]) a(e);
  return o;
}
function Yr(e, t, n) {
  const r = `${t || ""}`.trim().slice(0, Gr);
  return e.find((o) => o.page === n && o.text === r) ?? null;
}
function li(e, t, { storage: n = Xr(), now: r = () => (/* @__PURE__ */ new Date()).toISOString(), makeId: o = Xg } = {}) {
  const a = At(e, n), s = `${t.text || ""}`.trim().slice(0, Gr), i = Math.floor(Number(t.page));
  return !s || !Number.isFinite(i) || i < 1 || Yr(a, s, i) ? a : ci(e, [{ id: o(), text: s, page: i, pane: t.pane === "translated" ? "translated" : "source", createdAt: r() }, ...a], n);
}
function Gg(e, t, n = Xr()) {
  return ci(e, At(e, n).filter((r) => r.id !== t), n);
}
function Xg() {
  var e;
  try {
    if ((e = globalThis.crypto) != null && e.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function ui(e) {
  const [t, n] = x(() => At(e));
  D(() => (n(At(e)), Jg(e, () => n(At(e)))), [e]);
  const r = L(
    (a) => n(li(e, a)),
    [e]
  ), o = L((a) => n(Gg(e, a)), [e]);
  return { favorites: t, add: r, remove: o };
}
function Yg({ filled: e }) {
  return /* @__PURE__ */ g(rc, { ...Me, fill: e ? "currentColor" : "none", "aria-hidden": !0 });
}
function Zg({ scope: e, currentPage: t, numPages: n, regions: r }) {
  const { bookmarks: o, toggle: a } = si(e, r);
  if (!e || n <= 0) return null;
  const s = Math.min(Math.max(t, 1), n), i = o.some((l) => l.page === s);
  return /* @__PURE__ */ C("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", children: [
    /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-mark${i ? " is-marked" : ""}`,
        "aria-pressed": i,
        "aria-label": i ? `取消第 ${s} 页的书签` : `给第 ${s} 页加书签`,
        title: i ? "取消这一页的书签（书签都在左栏「书签」里）" : "给这一页加书签（书签都在左栏「书签」里）",
        onClick: () => a(s),
        children: /* @__PURE__ */ g(Yg, { filled: i })
      }
    ),
    /* @__PURE__ */ g(Qg, { scope: e })
  ] });
}
function Qg({ scope: e }) {
  var l;
  const [t, n] = x(!1), r = N(null), { favorites: o, remove: a } = ui(e), s = (l = Be()) == null ? void 0 : l.goToPage;
  D(() => {
    if (!t) return;
    const c = (f) => {
      var m;
      (m = r.current) != null && m.contains(f.target) || n(!1);
    }, u = (f) => {
      f.key === "Escape" && n(!1);
    };
    return document.addEventListener("pointerdown", c, !0), document.addEventListener("keydown", u), () => {
      document.removeEventListener("pointerdown", c, !0), document.removeEventListener("keydown", u);
    };
  }, [t]);
  const i = o.length;
  return /* @__PURE__ */ C("span", { className: "reader-favorites", ref: r, children: [
    /* @__PURE__ */ g(
      G,
      {
        className: "reader-react-hud-btn reader-favorites-toggle",
        "aria-expanded": t,
        "aria-haspopup": "dialog",
        "aria-label": i ? `收藏（${i} 段）` : "收藏",
        title: i ? `收藏的段落（${i} 段）` : "收藏：书页上选一段字，点浮条上的「收藏」",
        onClick: () => n((c) => !c),
        children: /* @__PURE__ */ g(Va, { ...Me, fill: i ? "currentColor" : "none", "aria-hidden": !0 })
      }
    ),
    t ? /* @__PURE__ */ C("div", { className: "reader-favorites-card reader-floating-surface", role: "dialog", "aria-label": "收藏", children: [
      /* @__PURE__ */ C("strong", { children: [
        "收藏",
        i ? /* @__PURE__ */ g("span", { className: "reader-favorites-count", children: i }) : null
      ] }),
      i ? /* @__PURE__ */ g("ul", { className: "reader-favorites-list", children: o.map((c) => /* @__PURE__ */ C("li", { children: [
        /* @__PURE__ */ C(
          G,
          {
            className: "reader-favorites-jump",
            title: `翻到第 ${c.page} 页`,
            onClick: () => {
              s == null || s(c.page, c.pane), n(!1);
            },
            children: [
              /* @__PURE__ */ g("span", { className: "reader-favorites-text", children: c.text }),
              /* @__PURE__ */ C("span", { className: "reader-favorites-page", children: [
                "p.",
                c.page,
                c.pane === "translated" ? " · 译文" : ""
              ] })
            ]
          }
        ),
        /* @__PURE__ */ g(
          G,
          {
            className: "reader-favorites-remove",
            "aria-label": `删掉第 ${c.page} 页这段收藏`,
            title: "删掉",
            onClick: () => a(c.id),
            children: /* @__PURE__ */ g(bt, { size: 13, "aria-hidden": !0 })
          }
        )
      ] }, c.id)) }) : /* @__PURE__ */ g("p", { children: "还没有收藏。在书页上选一段字，点浮条上的「收藏」（或右键「收藏这段」），就收在这里，随时翻回来。" })
    ] }) : null
  ] });
}
function ey(e) {
  const t = Be(), n = xr(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? an, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, l = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, c = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = ul(a), f = a > Qa + 1e-3, m = a < Pn - 1e-3, h = Et(r, Pt()), p = h >= Pn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", [d, b] = x(!1), [w, v] = x(`${i}`);
  D(() => {
    d || v(`${Math.min(Math.max(i, 1), Math.max(l, 1))}`);
  }, [i, l, d]);
  const y = () => {
    if (b(!1), !c || l <= 0)
      return;
    const k = Number(`${w}`.trim());
    c(Mn(k, l));
  };
  return /* @__PURE__ */ C("footer", { className: "reader-bottombar", "data-reader-hud": "true", children: [
    /* @__PURE__ */ C("div", { className: "reader-bottombar-start", children: [
      e.startSlot,
      e.bookmarkScope ? /* @__PURE__ */ g(
        Zg,
        {
          scope: e.bookmarkScope,
          currentPage: i,
          numPages: l,
          regions: t == null ? void 0 : t.regions
        }
      ) : null,
      e.leftSlot
    ] }),
    /* @__PURE__ */ C("div", { className: "reader-bottombar-center", children: [
      o ? /* @__PURE__ */ g("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
      /* @__PURE__ */ g("div", { className: "reader-react-hud-group", "aria-label": "页码", children: d ? /* @__PURE__ */ C(
        "form",
        {
          className: "reader-react-hud-page-form",
          onSubmit: (k) => {
            k.preventDefault(), y();
          },
          children: [
            /* @__PURE__ */ g(
              "input",
              {
                className: "reader-react-hud-page-input",
                type: "text",
                inputMode: "numeric",
                pattern: "[0-9]*",
                "aria-label": "跳转到页码",
                value: w,
                autoFocus: !0,
                onChange: (k) => v(k.target.value.replace(/[^\d]/g, "")),
                onBlur: y,
                onKeyDown: (k) => {
                  k.key === "Escape" && (k.preventDefault(), b(!1), v(`${i}`));
                }
              }
            ),
            /* @__PURE__ */ C("span", { className: "reader-react-hud-page-suffix", children: [
              "/ ",
              l || "—"
            ] })
          ]
        }
      ) : /* @__PURE__ */ g(
        "button",
        {
          type: "button",
          className: "reader-react-hud-page reader-react-hud-page-btn",
          "aria-label": l > 0 ? `跳转页码，当前第 ${i} 页，共 ${l} 页` : "页码",
          title: l > 0 ? "点击输入页码跳转" : void 0,
          disabled: !c || l <= 0,
          onClick: () => {
            !c || l <= 0 || (v(`${i}`), b(!0));
          },
          children: l > 0 ? `${Math.min(i, l)} / ${l}` : "—"
        }
      ) }),
      e.searchSlot ? /* @__PURE__ */ g("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
      t != null && t.toggleDocDark ? /* @__PURE__ */ g("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ g(
        G,
        {
          className: "reader-react-hud-btn reader-react-hud-doc-dark",
          "aria-pressed": t.docDark ? "true" : "false",
          "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
          title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
          onClick: t.toggleDocDark,
          children: /* @__PURE__ */ g(oc, { ...Me, "aria-hidden": !0 })
        }
      ) }) : null,
      /* @__PURE__ */ C("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
        /* @__PURE__ */ g(
          "button",
          {
            type: "button",
            className: "reader-react-hud-btn",
            "aria-label": "缩小",
            disabled: !f,
            onClick: () => s(Zt(a, -1)),
            children: /* @__PURE__ */ g(Wa, { ...Me, "aria-hidden": !0 })
          }
        ),
        /* @__PURE__ */ C(
          "button",
          {
            type: "button",
            className: "reader-react-hud-btn reader-react-hud-zoom-label",
            "aria-label": `${u}%，点击${p}`,
            title: p,
            onClick: () => s(h),
            children: [
              u,
              "%"
            ]
          }
        ),
        /* @__PURE__ */ g(
          "button",
          {
            type: "button",
            className: "reader-react-hud-btn",
            "aria-label": "放大",
            disabled: !m,
            onClick: () => s(Zt(a, 1)),
            children: /* @__PURE__ */ g(Ka, { ...Me, "aria-hidden": !0 })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ C("div", { className: "reader-bottombar-end", children: [
      e.toolsSlot,
      /* @__PURE__ */ g("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ g(Ag, {}) })
    ] })
  ] });
}
function ka(e) {
  var t, n;
  return os(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function ty(e) {
  const [t, n] = x(() => ({
    scope: e,
    panel: ka(We(e))
  }));
  D(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: ka(We(e))
    });
  }, [e]), D(() => {
    t.scope === e && _n(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = L((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const pr = "download-toast";
function ny({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ C("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ C("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ g("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ g("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ g("div", { className: "download-toast-track", children: /* @__PURE__ */ g("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ g("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function ry(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Jn.dismiss(pr);
    return;
  }
  Jn.custom(
    () => /* @__PURE__ */ g(ny, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: pr, duration: 1 / 0 }
  );
}
function oy() {
  const e = L((t) => {
    t && (t.setState = ry, t.hide = () => Jn.dismiss(pr));
  }, []);
  return /* @__PURE__ */ C(Re, { children: [
    /* @__PURE__ */ g(Di, { position: "bottom-right" }),
    /* @__PURE__ */ g("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const Ta = { itemId: null, origin: null };
function ay() {
  let e = Ta;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Ta : { itemId: n, origin: r };
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
const Ia = ["ask"];
function sy(e) {
  const t = (n) => {
    const r = Ia.indexOf(n.id);
    return r < 0 ? Ia.length : r;
  };
  return [...e].sort((n, r) => t(n) - t(r));
}
function gr({
  place: e,
  active: t = null,
  extensions: n = Lr
}) {
  const r = e === "side" ? sy(n) : n, [o, a] = x(null), s = As(), i = (m) => {
    var h;
    return (((h = s.find((p) => p.id === m)) == null ? void 0 : h.contribution.toolbarItems) ?? []).filter((p) => (p.place ?? "side") === e);
  }, l = () => a(null), c = (() => {
    if (!o) return null;
    for (const { id: m } of r)
      for (const h of i(m)) {
        if (`${m}:${h.key}:popup` === o && h.popup) return h.popup(l);
        if (`${m}:${h.key}:dropdown` === o && h.dropdown) return h.dropdown(l);
      }
    return null;
  })(), u = N(null);
  D(() => {
    if (!o) return;
    const m = (p) => {
      var d;
      (d = u.current) != null && d.contains(p.target) || l();
    }, h = (p) => {
      p.key === "Escape" && l();
    };
    return document.addEventListener("pointerdown", m, !0), document.addEventListener("keydown", h), () => {
      document.removeEventListener("pointerdown", m, !0), document.removeEventListener("keydown", h);
    };
  }, [o]);
  const f = r.map((m) => {
    const h = i(m.id), p = e === "side" ? Cr([m]) : [];
    return !h.length && !p.length ? null : /* @__PURE__ */ C(xn, { children: [
      h.map((d) => {
        const b = `${m.id}:${d.key}`, w = d.Icon;
        return /* @__PURE__ */ C("span", { className: "reader-bar-tool-group", "data-has-dropdown": d.dropdown ? "true" : void 0, children: [
          /* @__PURE__ */ g(
            G,
            {
              className: e === "compare" ? "reader-bar-tool reader-bar-tool-compare" : "reader-bar-tool",
              "aria-label": d.label,
              title: d.title || d.label,
              "aria-pressed": !!d.pressed || o === `${b}:popup`,
              "aria-expanded": d.popup ? o === `${b}:popup` : void 0,
              "data-bar-tool": d.key,
              onClick: () => {
                var v;
                if (d.popup) {
                  a((y) => y === `${b}:popup` ? null : `${b}:popup`);
                  return;
                }
                (v = d.onClick) == null || v.call(d), l();
              },
              children: e === "compare" ? /* @__PURE__ */ g(Sn, { ...vo, "aria-hidden": !0 }) : d.mark ?? /* @__PURE__ */ g(w, { ...Me, "aria-hidden": !0 })
            }
          ),
          d.dropdown ? /* @__PURE__ */ g(
            G,
            {
              className: "reader-bar-tool-caret",
              "aria-label": `${d.label}：选项`,
              title: `${d.label}的选项`,
              "aria-expanded": o === `${b}:dropdown`,
              "data-bar-tool-caret": d.key,
              onClick: () => a((v) => v === `${b}:dropdown` ? null : `${b}:dropdown`),
              children: /* @__PURE__ */ g(Sn, { ...vo, "aria-hidden": !0 })
            }
          ) : null
        ] }, b);
      }),
      p.length ? /* @__PURE__ */ g(Fp, { active: t, tabs: p }) : null
    ] }, m.id);
  }).filter(Boolean);
  return f.length ? /* @__PURE__ */ C("div", { className: `reader-bar-tools is-${e}`, ref: u, role: "group", "aria-label": e === "side" ? "面板" : e === "compare" ? "对比版本" : "书页工具", children: [
    f,
    c ? /* @__PURE__ */ g("div", { className: "reader-bar-tools-popup", children: c }) : null
  ] }) : null;
}
const Ea = { search: "搜索", bookmarks: "书签", issues: "待改" }, iy = [];
function cy({
  open: e,
  onToggle: t,
  issueCount: n = 0,
  children: r
}) {
  const o = `在全文搜索，书签${n ? `、待改 ${n} 处` : ""}（⌘F）`;
  return /* @__PURE__ */ C("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ C(G, { className: "reader-finder-toggle", "aria-label": "左栏：搜索、书签、待改", "aria-pressed": !!e, title: o, onClick: t, children: [
      /* @__PURE__ */ g(qa, { ...Me, "aria-hidden": !0 }),
      n ? /* @__PURE__ */ g("span", { className: "reader-finder-toggle-count", "aria-label": `待改 ${n} 处`, children: n }) : null
    ] }),
    r
  ] });
}
function ly({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  pinned: l = !1,
  bookmarkPane: c,
  issuesPane: u,
  issueCount: f = 0
}) {
  var E;
  const m = ((E = Be()) == null ? void 0 : E.regions) ?? iy, h = U(() => od(m, s), [m, s]), [p, d] = x(-1);
  D(() => d(-1), [s]);
  const b = N(null), w = N(null), v = N(n);
  v.current = n, D(() => {
    if (l) return;
    const P = (_) => {
      var I, M;
      const T = _.target;
      !T || (I = w.current) != null && I.contains(T) || (M = T.closest) != null && M.call(T, ".reader-finder-toggles, [data-finder-toggle]") || v.current();
    }, O = (_) => {
      _.key === "Escape" && v.current();
    };
    return document.addEventListener("pointerdown", P, !0), document.addEventListener("keydown", O), () => {
      document.removeEventListener("pointerdown", P, !0), document.removeEventListener("keydown", O);
    };
  }, [l]);
  const y = N(null);
  D(() => {
    var P;
    e === "search" && ((P = b.current) == null || P.focus());
  }, [e, i]), D(() => {
    var P, O, _;
    e === "search" && p >= 0 && ((_ = (O = (P = y.current) == null ? void 0 : P.querySelector('[aria-current="true"]')) == null ? void 0 : O.scrollIntoView) == null || _.call(O, { block: "nearest" }));
  }, [e, p]);
  const k = (P) => {
    const O = h[P];
    O && (d(P), r(O.itemId));
  }, S = ["search", ...c ? ["bookmarks"] : [], ...u ? ["issues"] : []], R = S.includes(e) ? e : "search";
  return /* @__PURE__ */ C("aside", { ref: w, className: "reader-finder", "data-finder-tab": R, "data-pinned": l ? "true" : void 0, "aria-label": `左栏：${Ea[R]}`, children: [
    /* @__PURE__ */ C("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ g("div", { className: "reader-finder-tabs", role: "tablist", children: S.map((P) => /* @__PURE__ */ C(G, { className: "reader-finder-tab", role: "tab", "aria-selected": R === P, onClick: () => t(P), children: [
        Ea[P],
        P === "issues" && f ? /* @__PURE__ */ g("span", { className: "reader-finder-tab-count", children: f }) : null
      ] }, P)) }),
      /* @__PURE__ */ g(G, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ g(bt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    R === "bookmarks" ? c : R === "issues" ? u : null,
    R !== "search" ? null : /* @__PURE__ */ C(Re, { children: [
      /* @__PURE__ */ C("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ g(
          vr,
          {
            ref: b,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "搜原文或译文（⌘F）",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (P) => a(P.target.value),
            onKeyDown: (P) => {
              P.key === "Enter" ? (P.preventDefault(), k(ad(p, h.length, P.shiftKey))) : P.key === "Escape" && (P.preventDefault(), l ? P.currentTarget.blur() : n()), P.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ g("p", { className: "reader-finder-count", "aria-live": "polite", children: h.length === 0 ? "没有找到" : `${p >= 0 ? `第 ${p + 1} / ` : ""}${h.length >= 200 ? "200+ 处，只列前 200 处" : `${h.length} 处`}${p < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ g("ol", { ref: y, className: "reader-finder-list", children: h.map((P, O) => /* @__PURE__ */ g("li", { children: /* @__PURE__ */ C(G, { className: "reader-finder-entry is-hit", "aria-current": O === p ? "true" : void 0, onClick: () => k(O), children: [
        /* @__PURE__ */ C("span", { className: "reader-finder-entry-text", children: [
          P.snippet.slice(0, P.at),
          /* @__PURE__ */ g("mark", { children: P.snippet.slice(P.at, P.at + P.length) }),
          P.snippet.slice(P.at + P.length)
        ] }),
        /* @__PURE__ */ g("span", { className: "reader-finder-entry-page", children: P.page })
      ] }) }, P.itemId)) })
    ] })
  ] });
}
function di(e, t = []) {
  for (const n of e)
    t.push(n), di(n.children, t);
  return t;
}
const uy = 24, Ut = 28, Ra = 15;
function fi(e) {
  return e.reduce((t, n) => t + 1 + n.children.length, 0);
}
function dy(e, t) {
  if (e.length)
    return (e.length === 1 && e[0].children.length ? e[0].children : e).map((o) => ({
      id: o.id,
      title: o.title,
      page: o.page,
      depth: 1,
      children: di(o.children).map((a) => ({ id: a.id, title: a.title, page: a.page, depth: a.level - o.level + 1 }))
    }));
  const n = [];
  for (const r of t) {
    const o = { id: r.itemId, title: r.text, page: r.page, itemId: r.itemId }, a = n[n.length - 1];
    r.level > 1 && a ? a.children.push({ ...o, depth: 2 }) : n.push({ ...o, depth: 1, children: [] });
  }
  return n;
}
function fy(e, t) {
  let n = null, r = null, o = !1;
  for (const a of e) {
    const s = (i, l) => {
      if (i.page === null || i.page > t) return;
      const c = !l && o && (r == null ? void 0 : r.id) === a.id;
      (!r || i.page > (r.page ?? 0) || i.page === r.page && c) && (r = i, o = l, n = a.id);
    };
    s(a, !0);
    for (const i of a.children) s(i, !1);
  }
  return { chapterId: n, nodeId: (r == null ? void 0 : r.id) ?? null };
}
function my(e, t) {
  const n = fi(e) > uy, r = Math.max(1, Math.ceil(e.length / Ut)), o = [];
  if (e.forEach((i, l) => {
    const c = i.id === t.chapterId;
    if (!(l % r !== 0 && !c) && (o.push({ id: i.id, kind: "h1", state: i.id === t.nodeId ? "current" : c ? "chapter" : "" }), !(n && !c)))
      for (const u of i.children)
        u.depth > 2 && !c || o.push({ id: u.id, kind: "h2", state: u.id === t.nodeId ? "current" : "" });
  }), o.length <= Ut) return o;
  const a = Math.max(0, o.findIndex((i) => i.state === "current")), s = Math.min(Math.max(0, a - Math.floor(Ut / 2)), o.length - Ut);
  return o.slice(s, s + Ut);
}
function hy(e, t) {
  const n = t.trim().toLowerCase();
  if (!n) return [...e];
  const r = [];
  for (const o of e) {
    const a = o.title.toLowerCase().includes(n), s = o.children.filter((i) => i.title.toLowerCase().includes(n));
    a ? r.push(o) : s.length && r.push({ ...o, children: s });
  }
  return r;
}
const py = [];
function Pa({ bookmarks: e, onJumpPage: t, onJumpBlock: n, pinned: r = !1, docked: o = !1, onPinChange: a }) {
  var _, T;
  const s = ((_ = Be()) == null ? void 0 : _.regions) ?? py, i = ((T = xr()) == null ? void 0 : T.currentPage) ?? 1, l = U(() => dy(e, td(s)), [e, s]), c = U(() => fy(l, i), [l, i]), u = U(() => my(l, c), [l, c]), f = fi(l), [m, h] = x(""), p = U(() => hy(l, m), [l, m]), [d, b] = x(() => /* @__PURE__ */ new Set()), w = N(null), v = N(!1), y = () => {
    c.chapterId && !d.has(c.chapterId) && b((I) => new Set(I).add(c.chapterId)), v.current = !0;
  };
  if (D(() => {
    (r || o) && y();
  }, [r, o]), Le(() => {
    var I, M, $;
    v.current && (v.current = !1, ($ = (M = (I = w.current) == null ? void 0 : I.querySelector('[aria-current="location"]')) == null ? void 0 : M.scrollIntoView) == null || $.call(M, { block: "center" }));
  }), !l.length) return null;
  const k = (I) => b((M) => {
    const $ = new Set(M);
    return $.has(I) ? $.delete(I) : $.add(I), $;
  }), S = (I, M) => {
    b(($) => $.has(M) ? $ : new Set($).add(M)), I.itemId ? n(I.itemId) : I.page !== null && t(I.page);
  }, R = !!m.trim(), E = (I, M) => /* @__PURE__ */ C(
    G,
    {
      className: "reader-toc-entry",
      "data-depth": Math.min(I.depth, 3),
      "aria-current": I.id === c.nodeId ? "location" : void 0,
      disabled: !I.itemId && I.page === null,
      title: I.page === null ? "这条书签没有指到页" : `${I.title}（第 ${I.page} 页）`,
      onClick: () => S(I, M),
      children: [
        /* @__PURE__ */ g("span", { className: "reader-toc-title", children: I.title }),
        I.page !== null ? /* @__PURE__ */ C("span", { className: "reader-toc-page", children: [
          "p.",
          I.page
        ] }) : null
      ]
    }
  ), P = r ? "取消固定" : "固定在左边", O = /* @__PURE__ */ C(Re, { children: [
    /* @__PURE__ */ C("div", { className: "reader-toc-head", children: [
      /* @__PURE__ */ g("span", { className: "reader-toc-head-title", children: "目录" }),
      /* @__PURE__ */ g(G, { className: "reader-toc-pin", "aria-label": P, title: P, "aria-pressed": r, onClick: () => a == null ? void 0 : a(!r), children: r ? /* @__PURE__ */ g(ac, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) : /* @__PURE__ */ g(za, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) })
    ] }),
    f > Ra ? /* @__PURE__ */ C("div", { className: "reader-toc-filter", children: [
      /* @__PURE__ */ g(qa, { size: 13, "aria-hidden": !0 }),
      /* @__PURE__ */ g(
        vr,
        {
          size: "sm",
          className: "reader-toc-filter-input",
          value: m,
          placeholder: "过滤章节标题或节号…",
          "aria-label": "过滤目录",
          onChange: (I) => h(I.target.value),
          onKeyDown: (I) => {
            I.stopPropagation(), I.key === "Escape" && (m ? h("") : (I.currentTarget.blur(), r && !o && (a == null || a(!1))));
          }
        }
      ),
      m ? /* @__PURE__ */ g(G, { className: "reader-toc-filter-clear", "aria-label": "清掉", onClick: () => h(""), children: /* @__PURE__ */ g(bt, { size: 12, "aria-hidden": !0 }) }) : null
    ] }) : null,
    /* @__PURE__ */ g("div", { className: "reader-toc-list", ref: w, children: p.length ? p.map((I) => {
      const M = R || d.has(I.id);
      return /* @__PURE__ */ C("div", { className: "reader-toc-chapter", children: [
        /* @__PURE__ */ C("div", { className: "reader-toc-chapter-row", children: [
          I.children.length ? /* @__PURE__ */ g(
            G,
            {
              className: "reader-toc-caret",
              "aria-expanded": M,
              "aria-label": `${M ? "收起" : "展开"}「${I.title}」`,
              onClick: () => k(I.id),
              children: M ? /* @__PURE__ */ g(Sn, { size: 12, "aria-hidden": !0 }) : /* @__PURE__ */ g(Ua, { size: 12, "aria-hidden": !0 })
            }
          ) : /* @__PURE__ */ g("span", { className: "reader-toc-caret-space" }),
          E(I, I.id)
        ] }),
        M ? I.children.map(($) => /* @__PURE__ */ g("div", { children: E($, I.id) }, $.id)) : null
      ] }, I.id);
    }) : /* @__PURE__ */ g("p", { className: "reader-toc-empty", children: "没有匹配的章节" }) })
  ] });
  return o ? /* @__PURE__ */ g("nav", { className: "reader-toc-dock", "aria-label": "目录", children: O }) : /* @__PURE__ */ C(
    "nav",
    {
      className: "reader-toc-minimap",
      "aria-label": "目录",
      "data-pinned": r ? "true" : void 0,
      onPointerEnter: r ? void 0 : y,
      onKeyDown: (I) => {
        r && I.key === "Escape" && (a == null || a(!1));
      },
      onFocus: (I) => {
        !r && !I.currentTarget.contains(I.relatedTarget) && y();
      },
      children: [
        /* @__PURE__ */ g("div", { className: "reader-toc-bars", tabIndex: 0, "aria-label": `目录，${f} 条（移上去或按 Tab 展开）`, children: u.map((I) => /* @__PURE__ */ g("span", { className: "reader-toc-bar", "data-kind": I.kind, "data-state": I.state || void 0, "aria-hidden": !0 }, I.id)) }),
        /* @__PURE__ */ g("div", { className: "reader-toc-card", "data-compact": f <= Ra ? "true" : void 0, children: O })
      ]
    }
  );
}
function gy({ active: e }) {
  return /* @__PURE__ */ C("div", { className: "reader-side-rail", role: "toolbar", "aria-orientation": "vertical", "aria-label": "面板和下载", children: [
    /* @__PURE__ */ g(gr, { place: "side", active: e }),
    /* @__PURE__ */ g("span", { className: "reader-side-rail-sep", "aria-hidden": !0 }),
    /* @__PURE__ */ g(Og, {})
  ] });
}
const yy = ".textLayer", Ma = 8, by = 34, vy = 56;
function wy(e) {
  return e ? e.nodeType === 1 ? e : e.parentElement : null;
}
function bn(e = ((t) => (t = globalThis.getSelection) == null ? void 0 : t.call(globalThis))() ?? null) {
  if (!e || e.isCollapsed || !e.rangeCount) return null;
  const n = e.getRangeAt(0), r = Rm(n);
  if (!r) return null;
  const o = Cs(e);
  if (!o) return null;
  const a = r.closest(`[${Ie}]`);
  return {
    text: o,
    page: Math.max(1, Number(a == null ? void 0 : a.getAttribute(Ie)) || 1),
    pane: (a == null ? void 0 : a.getAttribute(Se)) === "translated" ? "translated" : "source",
    layer: r
  };
}
async function mi(e) {
  var t, n;
  try {
    if ((n = (t = globalThis.navigator) == null ? void 0 : t.clipboard) != null && n.writeText)
      return await globalThis.navigator.clipboard.writeText(e), !0;
  } catch {
  }
  try {
    return document.execCommand("copy");
  } catch {
    return !1;
  }
}
const hi = typeof navigator < "u" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
function Sy(e) {
  const t = bn();
  if (!t) return [];
  const n = [{ key: "copy", label: "复制", hint: hi ? "⌘C" : "Ctrl+C", onSelect: () => {
    mi(t.text);
  } }];
  if (e) {
    const r = Yr(At(e), t.text, t.page);
    n.push({
      key: "favorite",
      label: r ? "已收藏（在左下角「收藏」里）" : "收藏这段",
      onSelect: () => {
        li(e, t);
      }
    });
  }
  return n;
}
function ky(e) {
  return [...e.querySelectorAll("span")].filter((t) => !t.classList.contains("markedContent") && !t.querySelector("span"));
}
function Ty(e) {
  let t = 0, n = null;
  return e.map((r) => {
    const o = r.getBoundingClientRect(), a = o.top + o.height / 2;
    return n && Math.abs(a - n.center) > Math.max(o.height, n.height) / 2 && (t += 1), n = { center: a, height: o.height || (n == null ? void 0 : n.height) || 0 }, { text: r.textContent || "", line: t };
  });
}
function Iy(e) {
  const t = [], n = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
  for (let r = n.nextNode(); r; r = n.nextNode()) t.push(r);
  return t;
}
function xa(e, t) {
  const n = wy(e), r = n == null ? void 0 : n.closest(yy), o = n == null ? void 0 : n.closest("span");
  if (!r || !o) return null;
  const a = ky(r), s = a.indexOf(o);
  if (s < 0) return null;
  const i = Math.max(0, s - 60), l = a.slice(i, Math.min(a.length, s + 61)), c = Tm(Ty(l), s - i);
  if (!c) return null;
  const u = Iy(l[t === "start" ? c[0] : c[1]]);
  return u.length ? t === "start" ? { node: u[0], offset: 0 } : { node: u[u.length - 1], offset: u[u.length - 1].length } : null;
}
function Ey(e) {
  if (!e || e.isCollapsed || !e.rangeCount) return !1;
  const t = e.getRangeAt(0), n = xa(t.startContainer, "start"), r = xa(t.endContainer, "end");
  if (!n && !r) return !1;
  const o = t.cloneRange();
  return n && t.comparePoint(n.node, n.offset) <= 0 && o.setStart(n.node, n.offset), r && t.comparePoint(r.node, r.offset) >= 0 && o.setEnd(r.node, r.offset), o.compareBoundaryPoints(Range.START_TO_START, t) === 0 && o.compareBoundaryPoints(Range.END_TO_END, t) === 0 ? !1 : (e.removeAllRanges(), e.addRange(o), !0);
}
function Ry(e) {
  var i;
  if (!e || e.isCollapsed || !e.rangeCount) return [];
  const t = e.getRangeAt(0), n = t.commonAncestorContainer, r = n.nodeType === 3 ? [n] : (() => {
    const l = [], c = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
    for (let u = c.nextNode(); u; u = c.nextNode()) t.intersectsNode(u) && l.push(u);
    return l;
  })(), o = [], a = /* @__PURE__ */ new Map();
  for (const l of r) {
    const c = (i = l.parentElement) == null ? void 0 : i.closest(rr);
    if (!c) continue;
    const u = c.closest(`.${on}`) ?? c;
    let f = a.get(u);
    f || (f = u.getBoundingClientRect(), a.set(u, f));
    const m = document.createRange();
    if (m.selectNodeContents(l), l === t.startContainer && m.setStart(l, t.startOffset), l === t.endContainer && m.setEnd(l, t.endOffset), !!m.toString().trim())
      for (const h of m.getClientRects()) {
        const p = Math.max(h.left, f.left), d = Math.min(h.right, f.right);
        d - p > 0.5 && o.push({ left: p, top: h.top, right: d, bottom: h.bottom });
      }
  }
  const s = n.nodeType === 1 ? n : n.parentElement;
  for (const l of (s == null ? void 0 : s.querySelectorAll(".reader-layout-page svg.reader-layout-math")) ?? []) {
    if (!t.intersectsNode(l)) continue;
    const c = l.getBoundingClientRect();
    c.width > 0.5 && o.push({ left: c.left, top: c.top, right: c.right, bottom: c.bottom });
  }
  return Im(o);
}
function Py({ scope: e, menuItemsAt: t }) {
  const n = N(null), r = N(!1), o = N(!1), a = N(0), s = N(t);
  s.current = t;
  const [i, l] = x(null), c = N(null), u = L(() => {
    var R;
    a.current = 0;
    const m = n.current;
    if (!m) return;
    const h = ((R = globalThis.getSelection) == null ? void 0 : R.call(globalThis)) ?? null, p = Ry(h), d = m.getBoundingClientRect();
    for (; m.children.length > p.length; ) m.lastElementChild.remove();
    if (p.forEach((E, P) => {
      const O = m.children[P] ?? m.appendChild(document.createElement("div"));
      O.className = "reader-selection-band", O.style.left = `${E.left - d.left}px`, O.style.top = `${E.top - d.top}px`, O.style.width = `${E.right - E.left}px`, O.style.height = `${E.bottom - E.top}px`;
    }), !r.current) return;
    const b = bn(h);
    if (!b || !p.length) {
      r.current = !1, l(null);
      return;
    }
    const w = p[0], v = p[p.length - 1], y = (Math.min(...p.map((E) => E.left)) + Math.max(...p.map((E) => E.right))) / 2 - d.left, k = w.top - d.top - Ma - by, S = k >= vy ? k : v.bottom - d.top + Ma;
    l((E) => {
      var T;
      const P = E && E.text === b.text ? E.actions : s.current({
        target: b.layer,
        clientX: (w.left + w.right) / 2,
        clientY: (w.top + w.bottom) / 2,
        page: b.page
      }).filter((I) => I.inSelectionBar), O = ((T = c.current) == null ? void 0 : T.offsetWidth) || 220, _ = Math.min(Math.max(y, O / 2 + 8), d.width - O / 2 - 8);
      return E && E.text === b.text && Math.abs(E.left - _) < 0.5 && Math.abs(E.top - S) < 0.5 ? E : { left: _, top: S, text: b.text, page: b.page, pane: b.pane, actions: P };
    });
  }, []), f = L(() => {
    a.current || (a.current = requestAnimationFrame(u));
  }, [u]);
  return D(() => {
    const m = n.current, h = m == null ? void 0 : m.parentElement, p = m == null ? void 0 : m.closest(`.${Ga}`);
    if (!m || !h) return;
    const d = () => {
      p && delete p.dataset.selectPane;
    }, b = (k) => {
      var E, P, O;
      const S = k.target;
      if (S && ((E = c.current) != null && E.contains(S))) return;
      r.current = !1, l(null);
      const R = (O = (P = S == null ? void 0 : S.closest) == null ? void 0 : P.call(S, `[${Ie}][${Se}]`)) == null ? void 0 : O.getAttribute(Se);
      o.current = !!R && k.button === 0, p && R && k.button === 0 && (p.dataset.selectPane = R);
    }, w = (k) => {
      var E;
      d();
      const S = o.current;
      if (o.current = !1, k.button !== 0 || !S) return;
      const R = ((E = globalThis.getSelection) == null ? void 0 : E.call(globalThis)) ?? null;
      bn(R) && (Ey(R), r.current = !0, f());
    }, v = (k) => {
      const S = bn();
      !S || !k.clipboardData || (k.clipboardData.setData("text/plain", S.text), k.preventDefault());
    }, y = (k) => {
      k.key === "Escape" && r.current && (r.current = !1, l(null));
    };
    return h.addEventListener("pointerdown", b, !0), window.addEventListener("pointerup", w), window.addEventListener("pointercancel", d), document.addEventListener("selectionchange", f), document.addEventListener("copy", v), document.addEventListener("keydown", y), h.addEventListener("scroll", f, { capture: !0, passive: !0 }), window.addEventListener("resize", f), () => {
      d(), a.current && cancelAnimationFrame(a.current), h.removeEventListener("pointerdown", b, !0), window.removeEventListener("pointerup", w), window.removeEventListener("pointercancel", d), document.removeEventListener("selectionchange", f), document.removeEventListener("copy", v), document.removeEventListener("keydown", y), h.removeEventListener("scroll", f, { capture: !0 }), window.removeEventListener("resize", f);
    };
  }, [f]), /* @__PURE__ */ C(Re, { children: [
    /* @__PURE__ */ g("div", { className: "reader-selection-paint", ref: n, "aria-hidden": "true" }),
    i ? /* @__PURE__ */ g(
      My,
      {
        ref: c,
        bar: i,
        scope: e,
        onDone: () => {
          r.current = !1, l(null);
        }
      }
    ) : null
  ] });
}
function My({ bar: e, scope: t, onDone: n, ref: r }) {
  const { favorites: o, add: a } = ui(t), s = !!t && !!Yr(o, e.text, e.page), [i, l] = x(!1);
  return D(() => {
    if (!i) return;
    const c = setTimeout(() => l(!1), 1200);
    return () => clearTimeout(c);
  }, [i]), /* @__PURE__ */ C(
    "div",
    {
      ref: r,
      className: "reader-selection-bar",
      role: "toolbar",
      "aria-label": "选中的字",
      style: { left: e.left, top: e.top },
      onPointerDown: (c) => c.preventDefault(),
      children: [
        /* @__PURE__ */ C(
          G,
          {
            className: "reader-selection-action",
            title: hi ? "复制（⌘C）" : "复制（Ctrl+C）",
            onClick: () => {
              mi(e.text).then((c) => l(c));
            },
            children: [
              i ? /* @__PURE__ */ g(br, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) : /* @__PURE__ */ g(Oa, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }),
              /* @__PURE__ */ g("span", { children: i ? "已复制" : "复制" })
            ]
          }
        ),
        t ? /* @__PURE__ */ C(
          G,
          {
            className: "reader-selection-action",
            "aria-pressed": s,
            title: s ? "已收藏，在左下角「收藏」（星）里" : "收藏这段，在左下角「收藏」（星）里翻回来",
            onClick: () => {
              s || a({ text: e.text, page: e.page, pane: e.pane });
            },
            children: [
              /* @__PURE__ */ g(Va, { size: 14, strokeWidth: 1.75, fill: s ? "currentColor" : "none", "aria-hidden": !0 }),
              /* @__PURE__ */ g("span", { children: s ? "已收藏" : "收藏" })
            ]
          }
        ) : null,
        e.actions.map((c) => /* @__PURE__ */ C(
          G,
          {
            className: "reader-selection-action",
            title: c.hint ? `${c.label}（${c.hint}）` : c.label,
            onClick: () => {
              n(), c.onSelect();
            },
            children: [
              /* @__PURE__ */ g(Ha, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }),
              /* @__PURE__ */ g("span", { children: c.inSelectionBar })
            ]
          },
          c.key
        ))
      ]
    }
  );
}
function xy(e) {
  const [t, n] = x([]);
  return D(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = Ze().loadIssues;
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
function Ay(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const _y = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, Ny = ["failed", "content", "layout"];
function Ly(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Cy(e, t, n) {
  const r = xy(e), [o, a] = x(-1);
  D(() => a(-1), [r]);
  const s = L((l) => {
    const c = r[l];
    !c || !n || (a(l), n(c.readerItemId));
  }, [r, n]), i = N({ issues: r, last: o, currentPage: t, goTo: s });
  return i.current = { issues: r, last: o, currentPage: t, goTo: s }, D(() => {
    const l = (c) => {
      if (c.key.toLowerCase() !== "n" || c.metaKey || c.ctrlKey || c.altKey || Ly(c.target)) return;
      const { issues: u, last: f, currentPage: m, goTo: h } = i.current, p = Ay(u, f, m, c.shiftKey);
      p < 0 || (c.preventDefault(), h(p));
    };
    return document.addEventListener("keydown", l), () => document.removeEventListener("keydown", l);
  }, []), { issues: r, last: o, goTo: s };
}
function $y(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Dy(e) {
  var r;
  if (e.shiftKey || $y(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Ya}`))) return null;
  const n = Number((r = t.closest(`[${Ie}]`)) == null ? void 0 : r.getAttribute(Ie)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Oy({
  menu: e,
  onClose: t,
  actions: n,
  sections: r
}) {
  const o = N(null);
  if (D(() => {
    if (!e) return;
    const l = (u) => {
      var f;
      (f = o.current) != null && f.contains(u.target) || t();
    }, c = (u) => {
      u.key === "Escape" && t();
    };
    return document.addEventListener("pointerdown", l, !0), document.addEventListener("keydown", c), () => {
      document.removeEventListener("pointerdown", l, !0), document.removeEventListener("keydown", c);
    };
  }, [e, t]), !e) return null;
  const a = 380, s = Math.max(8, Math.min(e.x, (globalThis.innerWidth || a) - a - 8)), i = Math.max(68, Math.min(e.y, (globalThis.innerHeight || 600) - 60 - (n.length ? 40 : 0)));
  return /* @__PURE__ */ C("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    n.length ? /* @__PURE__ */ g("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: n.map((l) => /* @__PURE__ */ C(
      G,
      {
        className: "reader-ink-menu-action",
        role: "menuitem",
        title: l.hint,
        onClick: () => {
          l.onSelect(), t();
        },
        children: [
          l.label,
          l.hint ? /* @__PURE__ */ g("kbd", { children: l.hint }) : null
        ]
      },
      l.key
    )) }) : null,
    r.map((l) => /* @__PURE__ */ g(xn, { children: l.render({ page: e.page, close: t }) }, l.id))
  ] });
}
function zy({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ g("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ C("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ g("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ g(
      G,
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
const pi = "retainpdf:reader:doc-theme:v1", Aa = "data-reader-doc";
function gi() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Fy(e = gi()) {
  try {
    return (e == null ? void 0 : e.getItem(pi)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function By(e, t = gi()) {
  try {
    t == null || t.setItem(pi, e);
  } catch {
  }
}
function _a(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Aa, "dark") : t.removeAttribute(Aa));
}
function jy() {
  const [e, t] = x(() => Fy());
  D(() => {
    _a(e);
  }, [e]), D(() => () => _a("light"), []);
  const n = L(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return By(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function Hy({ scope: e, regions: t, currentPage: n, numPages: r, onJumpPage: o }) {
  const { bookmarks: a, remove: s } = si(e, t);
  return a.length ? /* @__PURE__ */ g("ol", { className: "reader-finder-list reader-bookmark-list", children: a.map((i) => /* @__PURE__ */ C("li", { className: i.page === n ? "is-current" : "", children: [
    /* @__PURE__ */ C(
      G,
      {
        className: "reader-finder-entry reader-bookmark-jump",
        "aria-current": i.page === n ? "location" : void 0,
        onClick: () => o(r > 0 ? Math.min(i.page, r) : i.page),
        children: [
          /* @__PURE__ */ g("span", { className: "reader-finder-entry-text", children: i.label || `第 ${i.page} 页` }),
          /* @__PURE__ */ g("span", { className: "reader-finder-entry-page", children: i.page })
        ]
      }
    ),
    /* @__PURE__ */ g(G, { className: "reader-bookmark-remove", "aria-label": `删除第 ${i.page} 页的书签`, title: "删除这个书签", onClick: () => s(i.page), children: "×" })
  ] }, i.page)) }) : /* @__PURE__ */ g("p", { className: "reader-finder-empty", children: "还没有书签。左下角的书签按钮给眼下这一页加一个。" });
}
function Uy({ nav: e }) {
  const { issues: t, last: n, goTo: r } = e;
  return /* @__PURE__ */ C("div", { className: "reader-issues", children: [
    /* @__PURE__ */ g("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
    Ny.map((o) => {
      const a = t.map((s, i) => ({ issue: s, index: i })).filter(({ issue: s }) => s.kind === o);
      return a.length ? /* @__PURE__ */ C("section", { className: "reader-issues-group", "data-issue-kind": o, children: [
        /* @__PURE__ */ C("h4", { children: [
          _y[o],
          /* @__PURE__ */ g("span", { children: a.length })
        ] }),
        /* @__PURE__ */ g("ol", { children: a.map(({ issue: s, index: i }) => /* @__PURE__ */ g("li", { children: /* @__PURE__ */ C(G, { className: "reader-issues-item", "aria-current": i === n ? "true" : void 0, onClick: () => r(i), children: [
          /* @__PURE__ */ g("span", { className: "reader-issues-title", children: s.title }),
          /* @__PURE__ */ C("span", { className: "reader-issues-page", children: [
            "第 ",
            s.page,
            " 页"
          ] }),
          s.detail ? /* @__PURE__ */ g("span", { className: "reader-issues-detail", children: s.detail }) : null
        ] }) }, `${s.kind}:${s.readerItemId}`)) })
      ] }, o) : null;
    })
  ] });
}
function Wy({ state: e, bookmarkScope: t, issues: n }) {
  const { finder: r, setFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: l, jumpFromFinder: c, jumpToPageFromFinder: u, pinned: f } = e, m = Be(), h = xr(), p = (h == null ? void 0 : h.currentPage) ?? 1, d = n.issues.length;
  return /* @__PURE__ */ g(Re, { children: r ? /* @__PURE__ */ g(
    ly,
    {
      tab: r,
      onTab: o,
      onClose: () => o(null),
      onJump: c,
      query: a,
      onQuery: s,
      term: i,
      focusSignal: l,
      pinned: f,
      bookmarkPane: t ? /* @__PURE__ */ g(
        Hy,
        {
          scope: t,
          regions: m == null ? void 0 : m.regions,
          currentPage: p,
          numPages: (h == null ? void 0 : h.numPages) ?? 0,
          onJumpPage: u
        }
      ) : void 0,
      issuesPane: d ? /* @__PURE__ */ g(Uy, { nav: n }) : void 0,
      issueCount: d
    }
  ) : null });
}
function Ky({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ g(Re, { children: n ? /* @__PURE__ */ g(
    Rp,
    {
      itemId: n,
      regions: e.regions,
      metadata: e.readerMetadata,
      documents: t,
      panes: a === "compare" ? ["source", "translated"] : a === "translated" ? ["translated"] : ["source"],
      onNavigate: r,
      onClose: o
    }
  ) : null });
}
function Vy(e) {
  const t = e.sourceOnly || !e.translatedUrl, n = !!(e.overlayContentAvailable && e.liveTranslationVisible && !e.assistantOpen), o = e.compareFits === !1 && e.mode === "compare" ? "source" : e.mode, a = !t && (o === "translated" || o === "compare");
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
const qy = 720;
function Jy(e, t) {
  return !t || !Number.isFinite(e) || e <= 0 ? !0 : e >= qy;
}
function Gy(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Xy(e, t, n = !0) {
  const { sessionFiles: r } = e, [o, a] = x(!1), s = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, i = Vy({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: s,
    liveTranslationVisible: o,
    assistantOpen: t,
    compareFits: n
  }), l = pu({
    hasOverlayContent: s,
    connection: e.liveTranslation.connection,
    showSource: i.showSource,
    liveTranslationVisible: o,
    assistantOpen: t
  }), c = i.sourceViewOnly, u = i.visibleMode;
  D(() => {
    a(!1);
  }, [e.viewStateKey]), D(() => {
    e.session.jobTerminal && a(!1);
  }, [e.session.jobTerminal]);
  const f = N(null);
  return D(() => {
    f.current !== e.viewStateKey && bu({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: c,
      jobTerminal: e.session.jobTerminal
    }) && (f.current = e.viewStateKey, a(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, c]), { liveTranslationVisible: o, setLiveTranslationVisible: a, paneComposition: i, liveToggles: l, sourceViewOnly: c, visiblePdfMode: u };
}
function Yy(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = gu(e.liveTranslation), i = L(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [l, c] = x(null);
  D(() => {
    a === "compare" && e.session.jobTerminal && c(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = l !== e.viewStateKey && vu({
    state: e.liveTranslation,
    sourceViewOnly: o,
    visibleMode: a
  }), f = U(() => r.sourcePaneToggle ? /* @__PURE__ */ g(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${t ? " is-active" : ""}`,
      onClick: () => n((m) => !m),
      "aria-pressed": t,
      title: t ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [r.sourcePaneToggle, t]);
  return { latestLivePage: s, jumpToLatestLivePage: i, offerCompletion: u, setCompletionDismissedKey: c, sourcePaneAction: f };
}
function Zy() {
  const [e] = x(Zf), t = cm(e), n = rm(t);
  return { contributionStore: e, contributions: t, reserveRight: n };
}
function Qy(e, t, n) {
  const r = N(e);
  D(() => {
    const o = e > 0 && r.current <= 0;
    r.current = e, o && t && n();
  }, [e]);
}
function eb(e, t, {
  translationVersions: n,
  bookmarks: r,
  regionHover: o,
  assistantPanel: a,
  closeAssistant: s,
  visiblePdfMode: i,
  changeWorkspace: l,
  jumpToBlockIn: c,
  zoomDocuments: u,
  editBlock: f,
  panelHost: m = null
}) {
  const { session: h, panes: p } = e, d = N(e.currentPage);
  d.current = e.currentPage;
  const b = L(() => d.current, []), w = U(() => ({
    documentId: h.documentId || "",
    jobId: h.jobId,
    versionId: n.readingVersionId || null,
    translationVersions: n.versions,
    regions: h.regions,
    metadata: h.readerMetadata,
    bookmarks: r,
    pageCount: p.hudNumPages || 0,
    resetKey: e.viewStateKey,
    hoveredItemId: () => o.get().itemId,
    goToPage: e.goToPage,
    sourceOnly: e.sourceOnly,
    activePanel: a,
    closePanel: s,
    panelHost: m,
    visibleMode: i,
    setWorkspace: l,
    jumpToBlock: c,
    shellEl: e.shell.shellEl,
    primaryPane: e.panes.primaryPane,
    pdfDocuments: u,
    editBlock: f,
    currentPage: b
  }), [
    h.documentId,
    h.jobId,
    n,
    h.regions,
    h.readerMetadata,
    r,
    p.hudNumPages,
    e.viewStateKey,
    o,
    e.goToPage,
    e.sourceOnly,
    a,
    s,
    i,
    l,
    c,
    e.shell.shellEl,
    e.panes.primaryPane,
    u,
    f,
    m
  ]), { contributionStore: v, contributions: y, reserveRight: k } = t, S = U(() => Qf(y), [y]), R = U(() => om(y), [y]), E = U(() => nm(y), [y]), P = U(() => em(y), [y]), O = tm(y);
  return { readerApi: w, contributionStore: v, contributions: y, pageLayers: S, compareVersion: R, textMarks: E, menuSections: P, pointerTakenId: O, reserveRight: k };
}
function tb() {
  try {
    return Ze().translationEdit ?? null;
  } catch {
    return null;
  }
}
const nb = "这本书正在处理（翻译或排版），处理完才能改。", rb = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function ob({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = tb(), s = `${e || ""}`.trim(), i = !!(a && s && r), l = cd(s), c = !t || Yt(t), u = hd(n), [f, m] = x(""), [h, p] = x(null), [d, b] = x(() => /* @__PURE__ */ new Map()), [w, v] = x(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [y, k] = x(() => /* @__PURE__ */ new Map()), [S, R] = x({ phase: "idle" }), E = N({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  D(() => {
    p(null), E.drafts.clear(), E.generation.current = null, k(/* @__PURE__ */ new Map()), R({ phase: "idle" });
  }, [s]), D(() => {
    if (m(""), !i || l || !a) return;
    let z = !1;
    return a.resolveOwnerJobId(s).then((K) => {
      z || m(`${K || s}`.trim() || s);
    }).catch(() => {
      z || m(s);
    }), () => {
      z = !0;
    };
  }, [i, l, a, s]), D(() => {
    if (b(/* @__PURE__ */ new Map()), !a || !f || !u || !c) return;
    let z = !1;
    return a.fetchRevisions(f).then((K) => {
      z || b(pd(K, u));
    }).catch(() => {
    }), () => {
      z = !0;
    };
  }, [a, f, u, c]);
  const P = S.phase === "running" && S.seenActive;
  D(() => {
    if (S.phase === "running") {
      if (!c) {
        P || R({ phase: "running", seenActive: !0 });
        return;
      }
      P && R(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [S.phase, P, c, t]);
  const O = U(() => {
    const z = new Map(d);
    if (w.renderedAt === u)
      for (const [K, H] of w.edits) z.set(K, H);
    return z;
  }, [d, w, u]), _ = L((z) => {
    const K = `${z || ""}`.trim();
    K && p({ itemId: K, page: ld(K) });
  }, []), T = L(() => p(null), []), I = L((z, K) => {
    v((H) => {
      const J = new Map(H.renderedAt === u ? H.edits : []);
      return J.set(z, K), { renderedAt: u, edits: J };
    }), k((H) => new Map(H).set(z, (H.get(z) || 0) + 1));
  }, [u]), M = L(async () => {
    if (!(!a || !s || S.phase === "submitting" || S.phase === "running")) {
      R({ phase: "submitting" });
      try {
        await a.rerender(s), R({ phase: "running", seenActive: !1 }), await o();
      } catch (z) {
        R({ phase: "failed", message: (z == null ? void 0 : z.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, S.phase, o]), $ = l ? rb : !c || S.phase === "running" || S.phase === "submitting" ? nb : "";
  return U(() => ({
    available: i,
    blockedReason: $,
    port: a,
    ownerJobId: f,
    target: h,
    select: _,
    close: T,
    memory: E,
    pendingEdits: O,
    savedCounts: y,
    markSaved: I,
    rerender: S,
    startRerender: M
  }), [i, $, a, f, h, _, T, E, O, y, I, S, M]);
}
function ab(e, t) {
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
function sb(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = ob({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, l = r.regions, c = a.memory.drafts, u = L((m, h) => {
    ys(l, m) && (t === "source" && i("compare"), h != null && h.trim() && c.set(m, h), s(m));
  }, [l, s, t, i, c]);
  ab(a.available ? u : null, n);
  const f = U(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const m = new Map(e.revisedBlocks);
    for (const [h, p] of a.savedCounts) m.set(h, (m.get(h) || 0) + p);
    return m;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: u, revisedBlocks: f };
}
const ib = "reader-finder-input";
function cb(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function lb(e, t = typeof window > "u" ? null : window) {
  D(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!cb(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(ib) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
const yi = "retainpdf.reader.sidebar.v1", ub = ["search", "bookmarks", "issues"], db = 900;
function fb() {
  var e;
  try {
    const t = JSON.parse(((e = globalThis.localStorage) == null ? void 0 : e.getItem(yi)) || "{}");
    return { tab: ub.includes(t == null ? void 0 : t.tab) ? t.tab : "search" };
  } catch {
    return { tab: "search" };
  }
}
function mb(e) {
  var t;
  try {
    (t = globalThis.localStorage) == null || t.setItem(yi, JSON.stringify(e));
  } catch {
  }
}
function hb() {
  const e = `(min-width: ${db}px)`, [t, n] = x(() => typeof window > "u" || !window.matchMedia ? !0 : window.matchMedia(e).matches);
  return D(() => {
    var a;
    if (typeof window > "u" || !window.matchMedia) return;
    const r = window.matchMedia(e), o = () => n(r.matches);
    return o(), (a = r.addEventListener) == null || a.call(r, "change", o), () => {
      var s;
      return (s = r.removeEventListener) == null ? void 0 : s.call(r, "change", o);
    };
  }, [e]), t;
}
function pb(e) {
  const [t] = x(fb), [n, r] = x(null), [o, a] = x(t.tab), i = hb(), l = L((S) => {
    r(S), S && a(S);
  }, []);
  D(() => {
    mb({ tab: n || o });
  }, [n, o]);
  const c = L(() => r((S) => S ? null : o), [o]), u = L((S) => {
    r((R) => R === S ? null : S), a(S);
  }, []), [f, m] = x(""), [h, p] = x("");
  D(() => {
    const S = f.replace(/\s+/gu, " ").trim(), R = window.setTimeout(() => p(S), S ? 150 : 0);
    return () => window.clearTimeout(R);
  }, [f]);
  const [d, b] = x(0), w = L(() => {
    l("search"), b((S) => S + 1);
  }, [l]);
  lb(w);
  const v = L(() => {
    i || r(null);
  }, [i]), y = L((S) => {
    e.jumpToAnchor({ block_id: S }), v();
  }, [e.jumpToAnchor, v]), k = L((S) => {
    e.goToPage(S), v();
  }, [e.goToPage, v]);
  return {
    finder: n,
    setFinder: l,
    toggleFinder: u,
    toggleSidebar: c,
    pinned: i,
    findQuery: f,
    setFindQuery: m,
    findTerm: h,
    findFocus: d,
    jumpFromFinder: y,
    jumpToPageFromFinder: k
  };
}
function gb(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : ts(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function yb(e, t) {
  return t === null || e !== t;
}
function bb(e, t) {
  const { boot: n } = e, r = N(null), o = N(null);
  D(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = We(e.viewStateKey), s = gb({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: Pt()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      yb(e.mode, o.current) && (o.current = null, _n(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const vb = [];
function wb(e) {
  const { sessionFiles: t } = e, [n, r] = x({}), o = N({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = L((b, w) => {
    r((v) => ({ ...v, [w]: { url: o.current[w], nodes: b } }));
  }, []), s = U(() => {
    const b = n.source;
    if (b && b.url === t.sourceUrl && b.nodes.length) return b.nodes;
    const w = n.translated;
    return w && w.url === t.translatedUrl && w.nodes.length ? w.nodes : vb;
  }, [n, t.sourceUrl, t.translatedUrl]), i = N({}), [l, c] = x(0), u = L((b, w) => {
    i.current[w] = { url: o.current[w], pdf: b }, c((v) => v + 1);
  }, []), [f, m] = x(null), h = L((b) => m(b), []), p = L(() => m(null), []);
  D(() => m(null), [e.viewStateKey]);
  const d = U(() => {
    const b = (w, v) => {
      const y = i.current[w];
      return y && y.url === v ? y.pdf : null;
    };
    return { source: b("source", t.sourceUrl), translated: b("translated", t.translatedUrl) };
  }, [l, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: f, setZoomItem: m, zoomBlock: h, closeZoom: p, zoomDocuments: d };
}
function Sb() {
  const e = Mu(), { boot: t, panes: n, session: r } = e, o = ty(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, l = Zy(), { reserveRight: c } = l, u = i || c > 0, f = pb(e), { finder: m, findTerm: h } = f, p = !!m && f.pinned, [d, b] = x(!1), w = d && f.pinned, v = L(() => {
    s(null);
  }, []);
  Qy(c, a, v);
  const { liveTranslationVisible: y, setLiveTranslationVisible: k, paneComposition: S, liveToggles: R, sourceViewOnly: E, visiblePdfMode: P } = Xy(
    e,
    i,
    Jy(e.shell.shellWidth, u || p || w)
  );
  bb(e, E);
  const O = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: _, toggleDocDark: T } = jy();
  $u({
    toggleDocDark: T,
    mode: P,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const { latestLivePage: I, jumpToLatestLivePage: M, offerCompletion: $, setCompletionDismissedKey: z, sourcePaneAction: K } = Yy(e, {
    liveTranslationVisible: y,
    setLiveTranslationVisible: k,
    liveToggles: R,
    sourceViewOnly: E,
    visiblePdfMode: P
  }), H = L((be) => {
    const F = Gy(be, e.liveTranslationAvailable);
    F !== null && k(F), e.setModeKeepingPage(be);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), J = L((be) => {
    s(be);
  }, []), [oe] = x(ay), q = L((be) => e.jumpToAnchor({ block_id: be }), [e.jumpToAnchor]), se = Cy(e.sourceOnly ? "" : r.jobId, e.currentPage, q), [Ee, re] = x(null), ue = L((be, F) => e.jumpToAnchor({ block_id: be }, F), [e.jumpToAnchor]), { bookmarks: xe, onPdfOutline: ie, onPdfDocument: le, zoomItem: B, setZoomItem: W, zoomBlock: Y, closeZoom: de, zoomDocuments: ne } = wb(e), { blockEdit: ae, editBlock: ke, revisedBlocks: ee } = sb(e, P, oe), [Z, fe] = x(null), A = L(() => fe(null), []), j = ih({ documentId: r.documentId, jobId: r.jobId }), {
    readerApi: V,
    contributionStore: me,
    contributions: ye,
    pageLayers: Te,
    compareVersion: _e,
    textMarks: ze,
    menuSections: je,
    pointerTakenId: Qe
  } = eb(e, l, {
    translationVersions: j,
    bookmarks: xe,
    regionHover: oe,
    assistantPanel: a,
    closeAssistant: v,
    visiblePdfMode: P,
    changeWorkspace: H,
    jumpToBlockIn: ue,
    zoomDocuments: ne,
    editBlock: ae.available && !ae.blockedReason ? ke : null,
    panelHost: Ee
  }), $e = !!Qe, [Ke, et] = x([]), tt = U(() => ({
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
    regions: r.regions,
    readerMetadata: r.readerMetadata,
    activeRegion: e.activeRegion,
    regionHover: oe,
    jumpToBlock: q,
    revisedBlocks: ee,
    onPdfOutline: ie,
    onPdfDocument: le,
    zoomBlock: Y,
    textMarks: ze,
    pageLayers: Te,
    editBlock: ae.available ? ke : void 0,
    blockEdit: ae,
    editShowsSource: P !== "compare",
    findTerm: m === "search" ? h : "",
    compareVersion: _e,
    pointerTaken: $e,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: E,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: J, close: v },
    docDark: _,
    toggleDocDark: T
  }), [
    e.shell,
    e.userZoom,
    e.onZoomChange,
    e.rowHeights,
    e.panes,
    e.sessionFiles,
    r.regions,
    r.readerMetadata,
    e.activeRegion,
    oe,
    q,
    ee,
    ie,
    le,
    Y,
    ze,
    Te,
    ae,
    ke,
    P,
    m,
    h,
    _e,
    $e,
    e.sourceOnly,
    E,
    e.download,
    e.goToPage,
    J,
    v,
    _,
    T
  ]), St = U(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), nt = [
    Ga,
    `is-workspace-${O}`,
    i ? "is-assistant-open" : "",
    m ? "is-finder-open" : "",
    p ? "is-sidebar-pinned" : "",
    w ? "is-toc-docked" : "",
    S.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ g(sm, { api: V, store: me, children: /* @__PURE__ */ g(lf, { value: tt, hud: St, children: /* @__PURE__ */ C(
    "div",
    {
      className: nt,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": O,
      "data-pointer-taken": Qe || void 0,
      onContextMenu: (be) => {
        const F = Dy(be);
        if (!F) return;
        const Q = [
          ...Sy(e.viewStateKey),
          ...Co(ye, { target: be.target, clientX: be.clientX, clientY: be.clientY, page: F.page })
        ];
        !Q.length && !je.length || (be.preventDefault(), et(Q), fe(F));
      },
      children: [
        /* @__PURE__ */ C("div", { className: "reader-workspace", children: [
          w ? /* @__PURE__ */ g(Pa, { bookmarks: xe, onJumpPage: e.goToPage, onJumpBlock: q, pinned: !0, docked: !0, onPinChange: b }) : null,
          /* @__PURE__ */ g(Wy, { state: f, bookmarkScope: e.viewStateKey, issues: se }),
          /* @__PURE__ */ C("div", { className: "reader-stage", children: [
            /* @__PURE__ */ g(
              Yf,
              {
                mode: P,
                documentReady: !!r.jobId,
                sourceViewOnly: E,
                onModeChange: H,
                compareExtra: /* @__PURE__ */ g(gr, { place: "compare" }),
                liveTranslation: R.topBarPill ? {
                  visible: y,
                  state: e.liveTranslation,
                  onToggle: () => k((be) => !be),
                  latestPage: y ? I : null,
                  currentPage: e.currentPage,
                  onJumpToLatest: M
                } : null,
                completion: $ ? {
                  onOpenCompare: () => {
                    z(e.viewStateKey), H("compare");
                  }
                } : null,
                start: /* @__PURE__ */ g(Hu, { onBeforeClose: r.prepareClose })
              }
            ),
            w ? null : /* @__PURE__ */ g(Pa, { bookmarks: xe, onJumpPage: e.goToPage, onJumpBlock: q, pinned: d, onPinChange: b }),
            /* @__PURE__ */ g(gy, { active: a }),
            /* @__PURE__ */ g(Py, { scope: e.viewStateKey, menuItemsAt: (be) => Co(ye, be) }),
            /* @__PURE__ */ g(jf, { paneComposition: S, markdownSplit: i, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: K }),
            /* @__PURE__ */ g(Mg, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts }),
            /* @__PURE__ */ g(
              ey,
              {
                mode: P,
                modeControls: null,
                bookmarkScope: e.viewStateKey,
                startSlot: /* @__PURE__ */ g(cy, { open: m, onToggle: f.toggleSidebar, issueCount: se.issues.length }),
                leftSlot: /* @__PURE__ */ g(zy, { edit: ae }),
                toolsSlot: /* @__PURE__ */ g(gr, { place: "bottom" })
              }
            )
          ] }),
          /* @__PURE__ */ C(
            "aside",
            {
              className: "reader-dock",
              hidden: !u,
              "data-dock": i ? "panel" : c ? "extension" : void 0,
              style: !i && c ? { "--reader-dock-width": `${c}px` } : void 0,
              "aria-label": "阅读辅助面板",
              children: [
                /* @__PURE__ */ g(Bp, { active: a }),
                /* @__PURE__ */ g("div", { className: "reader-dock-body", ref: re })
              ]
            }
          )
        ] }),
        i ? /* @__PURE__ */ g(Rg, {}) : null,
        /* @__PURE__ */ g(
          Ky,
          {
            session: r,
            zoomDocuments: ne,
            zoomItem: B,
            setZoomItem: W,
            closeZoom: de,
            visiblePdfMode: P
          }
        ),
        /* @__PURE__ */ g(Oy, { menu: Z, onClose: A, actions: Ke, sections: je }),
        /* @__PURE__ */ g(um, { extensions: Lr }),
        /* @__PURE__ */ g(oy, {})
      ]
    }
  ) }) });
}
function Wb() {
  return /* @__PURE__ */ g(Sb, {});
}
export {
  Wb as R,
  Sb as a,
  jb as b,
  Hb as c,
  zm as d,
  Bm as e,
  ao as f,
  Bb as g,
  zb as h,
  Fb as r,
  Ub as s,
  Be as u
};
//# sourceMappingURL=ReaderApp-DclIDe0w.js.map
