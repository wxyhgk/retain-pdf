var or = (e) => {
  throw TypeError(e);
};
var ar = (e, t, n) => t.has(e) || or("Cannot " + n);
var It = (e, t, n) => (ar(e, t, "read from private field"), n ? n.call(e) : t.get(e)), sr = (e, t, n) => t.has(e) ? or("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), ir = (e, t, n, r) => (ar(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as L, jsx as m, Fragment as ct } from "react/jsx-runtime";
import { useMemo as J, useState as k, useEffect as D, useCallback as x, useRef as N, useLayoutEffect as Re, memo as en, createContext as Ln, useContext as Dn, forwardRef as co, useImperativeHandle as Cn, useSyncExternalStore as uo, useId as fo, Suspense as Pa, lazy as Ea } from "react";
import { requireAdapter as wt, getReaderAdapters as _e } from "./adapters.js";
import { resolveReaderDownloadName as ka, resolveReaderDownloadUrls as Ma, READER_PROGRESS_COPY as je, trimString as Vt, READER_DOWNLOAD_ACTIONS as Na, disabledReason as Aa } from "./runtime/state.js";
import { r as _a, b as La } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as gn, isFinishedJobStatus as At } from "@retainpdf/domain/job";
import { n as mo, d as Da, f as rn, k as lr, b as Ca, c as xa, j as zt, p as xn, g as Oa, l as cr, i as za } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as $a } from "@retainpdf/api/documents";
import { isReaderTransportError as Fa, createReaderTransportError as Ba } from "./contracts.js";
import { toast as bn, Toaster as ja } from "sonner";
import { X as St, PenLine as On, Check as ho, Copy as Ua, ChevronUp as Ha, ChevronDown as po, History as Wa, LoaderCircle as Ka, Pin as Va, LogOut as Ja, FileText as go, Columns2 as bo, Languages as yo, Radio as qa, ArrowDownToLine as Ga, CheckCircle2 as Za, Keyboard as Ya, Download as Xa, ListOrdered as Qa, TriangleAlert as es, ChevronRight as ts, ListTree as ns, Search as rs, GitCompareArrows as os, LayoutGrid as as, Highlighter as ss, Eraser as is, Undo2 as ls, Trash2 as cs } from "lucide-react";
import { Button as X, Textarea as us, IconButton as ur, Input as vo } from "@retainpdf/ui";
import { pdfjs as wo, Page as ds, Document as fs } from "react-pdf";
import { e as ms, m as hs, a as ps } from "./markdown-math-XkF5urpn.js";
const gs = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, bs = "", ys = Object.freeze({
  progress: "retainpdf-reader-progress"
}), vs = (e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Dm = (...e) => {
  var n;
  return (((n = _e()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Ue = () => wt("defaultReaderDataPort"), dr = () => wt("defaultReaderPageConfigPort"), Cm = {
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
}, So = {
  messageTargetOrigin: () => dr().messageTargetOrigin(),
  readerJobId: () => dr().readerJobId()
}, ws = () => {
  var e;
  return ((e = _e()) == null ? void 0 : e.liveTranslation) ?? null;
}, _t = () => {
  var t;
  const e = _e();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, nt = () => {
  const e = _e();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => wt("fetchDocumentByJobId")(...n),
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
}, Ss = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Is = () => {
  var e, t;
  return ((t = (e = _e()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Rs = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Ts = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? ka(...e);
}, Ps = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Ma(...e);
}, Es = (...e) => wt("downloadProtectedResource")(...e), ks = (...e) => wt("failDownloadToast")(...e), xm = (e, t) => wt("resolveMarkdownAssetUrl")(e, t), fr = "/api/v1";
function Ms() {
  const e = () => {
    var r;
    return _a(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = k(e);
  return D(() => {
    var i, l, c, u;
    const r = () => n(e()), o = (l = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : l.bind(globalThis.history), a = (u = (c = globalThis.history) == null ? void 0 : c.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const f = (d) => function(...h) {
          const g = d.apply(this, h);
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
function Ns() {
  const e = Ms(), t = J(() => Rs(So), [e]), n = J(() => Is(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function As(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [l, c] = k({
    documentId: "",
    jobId: ""
  }), [u, f] = k({
    documentId: "",
    jobId: ""
  }), d = l.documentId === t ? l.jobId : "", h = u.documentId === t ? u.jobId : "", g = n || d, [p, y] = k({
    jobId: "",
    documentId: ""
  }), w = p.jobId === g ? p.documentId : "", S = t || w, v = !!t && !g, [b, I] = k(null), E = (b == null ? void 0 : b.sessionIdentity) === r && b.documentId === S ? b : null, _ = v || !!E, $ = x((B) => {
    const T = `${B.documentId || ""}`.trim();
    if (!T || a.current && a.current !== T) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: T
      });
    else if (!a.current)
      return;
    const R = `${B.revision || ""}`.trim() || `${Date.now()}`;
    I({
      documentId: T,
      revision: R,
      sessionIdentity: o.current
    }), i();
  }, []);
  D(() => {
    I((B) => B && B.sessionIdentity !== r ? null : B);
  }, [r]);
  const F = x((B) => {
    switch (B.type) {
      case "resolved-document-job":
        c({ documentId: B.documentId, jobId: B.jobId });
        break;
      case "cleared-resolved-document-job":
        c({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: B.documentId, jobId: B.jobId });
        break;
      case "resolved-job-document":
        y((T) => T.jobId === B.jobId && T.documentId === B.documentId ? T : { jobId: B.jobId, documentId: B.documentId });
        break;
      case "committed-source":
        I({
          documentId: B.documentId,
          revision: B.revision,
          sessionIdentity: B.sessionIdentity
        });
        break;
    }
  }, []);
  return {
    resolvedDocumentJob: l,
    setResolvedDocumentJob: c,
    missingDocumentJob: u,
    setMissingDocumentJob: f,
    documentJobId: d,
    rejectedDocumentJobId: h,
    sessionJobId: g,
    resolvedJobDocument: p,
    setResolvedJobDocument: y,
    jobDocumentId: w,
    documentId: S,
    sourceOnly: v,
    committedDocumentSource: b,
    setCommittedDocumentSource: I,
    activeCommittedDocumentSource: E,
    sourceViewOnly: _,
    refreshCommittedDocument: $,
    applyIdentityEvent: F
  };
}
function mr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function _s(e) {
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
function hr(e, t) {
  return vs(gn(e, t));
}
function Ls(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Ds(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !Ls(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function yn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: ys.progress,
        stage: n,
        percent: e,
        text: t
      },
      So.messageTargetOrigin()
    );
  } catch {
  }
}
function Jt(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), yn({ percent: t, text: n, stage: r });
}
function Cs(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, l] = k(null), [c, u] = k(null), [f, d] = k(""), [h, g] = k(0), p = f === n ? i : null, y = f === n ? c : null, w = mr(p), S = At(w), v = x(() => {
    g((F) => F + 1);
  }, []), b = x((F) => {
    l(F.jobPayload), u(F.manifestPayload), d(F.sessionIdentity);
  }, []), I = x((F) => {
    l(null), u(null), d(F);
  }, []), E = N(""), _ = N(""), $ = x(async () => {
    const F = o.current;
    if (!F || E.current === F) return;
    const B = nt().loadJobPayload;
    if (typeof B != "function") return;
    const T = a.current.value;
    E.current = F;
    try {
      const R = await B(F);
      if (s.current || a.current.value !== T || o.current !== F || !R || typeof R != "object")
        return;
      const P = mr(R);
      l(R), d(r.current), !At(P) && _.current === F && (_.current = ""), P === "succeeded" && _.current !== F && (_.current = F, g((M) => M + 1));
    } catch {
    } finally {
      E.current === F && (E.current = "");
    }
  }, []);
  return D(() => {
    _.current = "";
  }, [n]), D(() => {
    if (!t || S || !p) return;
    const F = window.setInterval(() => {
      document.visibilityState !== "hidden" && $();
    }, 1e3);
    return () => window.clearInterval(F);
  }, [S, $, p, t]), {
    jobPayload: i,
    setJobPayload: l,
    manifestPayload: c,
    setManifestPayload: u,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: d,
    scopedJobPayload: p,
    scopedManifestPayload: y,
    jobStatus: w,
    jobTerminal: S,
    jobRefreshRevision: h,
    refreshJobArtifacts: v,
    refreshJobStatus: $,
    publishPayload: b,
    clearPayload: I
  };
}
function vn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function xs(e, t) {
  e(t), vn(t);
}
function Os(e) {
  const [t, n] = k(e ? "source" : "compare"), r = x((a) => {
    e && a !== "source" || (n(a), vn(a));
  }, [e]), o = x((a) => {
    xs(n, a);
  }, []);
  return D(() => (e && document.documentElement.classList.add("reader-source-only"), vn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function pr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function zs(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: pr(n.active_job_id),
    activeVersionId: pr(n.active_version_id)
  };
}
function $s(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Fs(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Bs(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const js = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Us(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = js.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Hs = 48 * 1024 * 1024;
function Ws(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Ks = 2, Ee = /* @__PURE__ */ new Map();
function wn(e, t) {
  Ee.delete(e), Ee.set(e, t);
}
function gr(e) {
  if (Ee.size < Ks) return;
  const t = Ee.keys().next().value;
  t && Ee.delete(t);
}
async function Vs(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Io(e, t = _t().fetchProtected, n = {}) {
  var u, f, d, h, g, p, y, w, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Ee.has(r)) {
    const v = Ee.get(r);
    return wn(r, v), v;
  }
  const o = new AbortController(), a = () => o.abort();
  (u = n.signal) != null && u.aborted && o.abort(), (d = (f = n.signal) == null ? void 0 : f.addEventListener) == null || d.call(f, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (g = (h = n.signal) == null ? void 0 : h.removeEventListener) == null || g.call(h, "abort", a);
  }
  if (!s.ok) {
    const v = new Error(`读取 PDF 失败 (${s.status})`);
    v.status = s.status;
    const b = await Vs(s);
    throw b && (v.reason = b), v;
  }
  const i = Js(r, s, t);
  if (i) {
    o.abort();
    const v = { ranged: i };
    return gr(), Ee.set(r, v), v;
  }
  (y = (p = n.signal) == null ? void 0 : p.addEventListener) == null || y.call(p, "abort", a, { once: !0 });
  let l;
  try {
    l = await s.arrayBuffer();
  } finally {
    (S = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || S.call(w, "abort", a);
  }
  const c = { data: new Uint8Array(l) };
  return Ee.has(r) ? wn(r, c) : (gr(), Ee.set(r, c)), c;
}
function Js(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Hs ? null : {
    url: e,
    length: o,
    async fetchRange(i, l) {
      const c = await n(e, { headers: { Range: `bytes=${i}-${l - 1}` } });
      if (c.status !== 206) throw new Error(`读取 PDF 片段失败 (${c.status})`);
      return new Uint8Array(await c.arrayBuffer());
    }
  };
}
const qs = { file: null, loading: !1, error: "" }, Gs = { file: null, loading: !0, error: "" };
function Zs(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = k(null);
  if (D(() => {
    if (t || !n) return;
    const s = Ee.get(n);
    if (s) {
      wn(n, s);
      return;
    }
    const i = new AbortController();
    return Io(n, void 0, { signal: i.signal }).then((l) => {
      i.signal.aborted || o({ url: n, file: l, loading: !1, error: "" });
    }).catch((l) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (l == null ? void 0 : l.message) || String(l) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return qs;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Ee.get(n);
  return a ? { file: a, loading: !1, error: "" } : Gs;
}
function Ys(e) {
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
async function Sn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  Jt(s, r, n, "download");
  const i = await Io(t, _t().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Jt(s, o, n, "download"), i);
}
async function Xs(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  Jt(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    Sn({
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
    Sn({
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
function Qs(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function ei({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = $a,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Qs(o.href, t, a)), !0);
}
const Ft = {
  regions: null,
  metadata: null
};
function ti(e) {
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
    clearPayload: d,
    switchSessionMode: h,
    jobRefreshRevision: g,
    sessionEpochRef: p,
    closingRef: y,
    activeLoadAbortRef: w
  } = e, [S, v] = k(""), [b, I] = k(""), [E, _] = k(null), [$, F] = k(null), [B, T] = k(!1), [R, P] = k(""), [M, A] = k([]), [j, O] = k(!1), [H, ae] = k(() => ({
    source: null,
    translated: null
  })), [ee, te] = k(
    Ft
  ), [pe, ie] = k({
    loading: !0,
    percent: 4,
    text: je.boot,
    stage: "progress",
    failed: !1
  });
  return D(() => {
    const me = new AbortController(), Le = p.current.value, Q = Ys({
      sessionEpochRef: p,
      closingRef: y,
      abort: me,
      sessionEpoch: Le
    });
    w.current = me;
    const Y = nt();
    if (y.current)
      return me.abort(), () => {
        w.current === me && (w.current = null);
      };
    let Se = !1;
    function de(G, z) {
      Q.markFailed(), O(!0), ie({
        loading: !1,
        percent: 100,
        text: G,
        stage: "failed",
        failed: !0
      }), yn({ percent: 100, text: z, stage: "failed" });
    }
    function he() {
      T(!0), Se || O(!0), ie({
        loading: !1,
        percent: 100,
        text: je.ready,
        stage: "ready",
        failed: !1
      }), yn({ percent: 100, text: je.ready, stage: "ready" });
    }
    function $e() {
      return c != null && c.documentId ? hr(
        c.documentId,
        c.revision
      ) : gs() ? bs : Y.resolveResourceUrl(gn(r));
    }
    async function qe() {
      var ue;
      let G = { activeJobId: "", activeVersionId: "" };
      try {
        const oe = await ((ue = Y.fetchDocument) == null ? void 0 : ue.call(Y, r));
        oe && (G = zs(oe));
      } catch {
      }
      const z = $s({
        link: G,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!c
      });
      if (z.kind === "follow-active-job") {
        if (Q.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: z.jobId
        }), z.activeVersionId ? (c || u({
          type: "committed-source",
          documentId: r,
          revision: z.activeVersionId,
          sessionIdentity: l
        }), h("source")) : h("compare");
        return;
      }
      if (z.kind === "open-committed-source") {
        if (Q.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: z.revision,
          sessionIdentity: l
        }), h("source");
        return;
      }
      const ne = $e();
      if (Q.isInactive()) return;
      v(ne), I(""), P(""), d(l);
      const re = await Sn({
        url: ne,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: Q,
        setBoot: ie
      });
      if (!Q.isInactive()) {
        if (!re) {
          de("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        _(re), he();
      }
    }
    async function De() {
      var C;
      const G = !c, z = !!(G && Y.loadSessionSnapshot && Y.loadReaderOptionalArtifacts), ne = z ? Y.loadReaderOptionalArtifacts(t) : null, re = await ((C = Y.loadSessionSnapshot) == null ? void 0 : C.call(Y, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: c,
        includeOptionalArtifacts: G && !z
      })), ue = re ? {
        jobPayload: re.sourcePayload,
        manifestPayload: re.manifestPayload,
        readerMetadata: re.readerMetadata,
        regionsPayload: re.regions,
        readerErrors: re.readerErrors
      } : await Y.loadReaderPayload(t, {
        includeOptionalArtifacts: G
      });
      if (Q.isInactive()) return;
      let oe = null;
      if (n && !r)
        if (re && re.linkedDocument !== void 0)
          oe = re.linkedDocument;
        else {
          try {
            oe = await Y.fetchDocumentByJobId(fr, t);
          } catch {
          }
          if (Q.isInactive()) return;
        }
      const Te = _s(ue.jobPayload) || `${(oe == null ? void 0 : oe.document_id) || ""}`.trim();
      Te && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Te
      });
      const Ie = Fs({
        payloadDocumentId: Te,
        linkedActiveJobId: `${(oe == null ? void 0 : oe.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(oe == null ? void 0 : oe.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!c
      });
      if (Ie.kind === "restore-committed-source") {
        if (Q.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Ie.documentId,
          revision: Ie.revision,
          sessionIdentity: l
        }), h("source");
        return;
      }
      const Ne = Y.resolveReaderSourcePdf(ue.manifestPayload), be = Y.resolveReaderTranslatedPdfUrl(ue.jobPayload, ue.manifestPayload), Fe = typeof Ne == "string" ? Ne : Y.resolveReaderArtifactUrl(Ne), rt = r || Te, Pe = c != null && c.documentId ? hr(
        c.documentId,
        c.revision
      ) : Fe || (rt ? Y.resolveResourceUrl(gn(rt)) : ""), Ce = c ? "" : be || "";
      v(Pe || ""), I(Ce), P(Ds(ue.jobPayload, t)), f({
        jobPayload: ue.jobPayload || null,
        manifestPayload: ue.manifestPayload || null,
        sessionIdentity: l
      });
      const Ge = () => Xs({
        sourceFinal: Pe || "",
        translatedFinal: Ce,
        fence: Q,
        setBoot: ie
      }), ft = !!(Pe || Ce), Be = ne && ft ? Ge() : null;
      Be == null || Be.catch(() => {
      });
      const U = (W) => {
        Q.isInactive() || (A(c ? [] : mo(W.regionsPayload)), ae(c ? { source: null, translated: null } : Da(W.readerMetadata)), te(c ? Ft : W.readerErrors ?? Ft), O(!0));
      };
      if (ne ? (Se = !0, ne.then(U)) : U(ue), !ft) {
        de(je.failed, je.failed);
        return;
      }
      const Z = await (Be ?? Ge());
      if (Z.status !== "inactive") {
        if (Z.status === "incomplete") {
          de("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        _(Z.sourceBytes), F(Z.translatedBytes), he();
      }
    }
    async function Me() {
      T(!1), _(null), F(null), A([]), O(!1), ae({ source: null, translated: null }), te(Ft), Jt(ie, 8, je.metadata, "metadata");
      try {
        if (s) {
          await qe();
          return;
        }
        if (!t) {
          de(je.failed, je.failed);
          return;
        }
        await De();
      } catch (G) {
        if (Q.isClosedOrStale() || (G == null ? void 0 : G.name) === "AbortError") return;
        Q.markFailed();
        const z = Number(G == null ? void 0 : G.status), ne = `${(G == null ? void 0 : G.reason) || ""}`, re = Us({ status: z, reason: ne, sessionJobId: t });
        if (re && (await ei({
          apiPrefix: fr,
          documentId: re,
          expiredJobId: t
        }) || Q.isClosedOrStale()))
          return;
        if (Bs({
          status: z,
          reason: ne,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), h("source");
          return;
        }
        const ue = G instanceof Error ? G.message : je.failed;
        de(ue, ue);
      }
    }
    return Me(), () => {
      me.abort(), w.current === me && (w.current = null);
    };
  }, [t, r, o, a, s, i, c, g, n, l, u, f, d, h]), {
    sourceUrl: S,
    translatedUrl: b,
    sourceFile: E,
    translatedFile: $,
    assetsReady: B,
    title: R,
    regions: M,
    regionsSettled: j,
    readerMetadata: H,
    readerErrors: ee,
    boot: pe
  };
}
function ni() {
  const e = N(!1), t = N(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Ns(), s = N({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = N(a), l = N(""), c = N(""), u = N(() => {
  }), f = x(() => u.current(), []), d = As({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: l,
    sessionJobIdRef: c,
    switchToSourceMode: f
  }), {
    sessionJobId: h,
    documentId: g,
    sourceOnly: p,
    sourceViewOnly: y
  } = d, { mode: w, setMode: S, switchSessionMode: v } = Os(y);
  u.current = () => {
    v("source");
  }, i.current = a, l.current = g, c.current = h;
  const b = Cs({
    sessionJobId: h,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: c,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: I,
    scopedManifestPayload: E,
    jobStatus: _,
    jobTerminal: $,
    jobRefreshRevision: F,
    refreshJobArtifacts: B,
    refreshJobStatus: T
  } = b, R = ti({
    sessionJobId: h,
    jobId: r,
    routeDocumentId: o,
    documentJobId: d.documentJobId,
    rejectedDocumentJobId: d.rejectedDocumentJobId,
    sourceOnly: p,
    locationKey: n,
    sessionIdentity: a,
    committedSource: d.activeCommittedDocumentSource,
    applyIdentityEvent: d.applyIdentityEvent,
    publishPayload: b.publishPayload,
    clearPayload: b.clearPayload,
    switchSessionMode: v,
    jobRefreshRevision: F,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), P = x(() => {
    var A;
    e.current = !0, (A = t.current) == null || A.abort();
  }, []), M = J(
    () => ({
      fetchProtected: nt().fetchProtected,
      jobId: h,
      jobPayload: I,
      manifestPayload: E,
      sourceUrl: R.sourceUrl,
      translatedUrl: R.translatedUrl,
      sourceOnly: y
    }),
    [h, I, E, R.sourceUrl, R.translatedUrl, y]
  );
  return {
    jobId: h,
    jobStatus: _,
    workflow: `${(I == null ? void 0 : I.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: $,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: p,
    mode: w,
    setMode: S,
    sourceUrl: R.sourceUrl,
    translatedUrl: R.translatedUrl,
    sourceFile: R.sourceFile,
    translatedFile: R.translatedFile,
    assetsReady: R.assetsReady,
    boot: R.boot,
    title: R.title,
    regions: R.regions,
    regionsSettled: R.regionsSettled,
    readerMetadata: R.readerMetadata,
    readerErrors: R.readerErrors,
    download: M,
    refreshJobArtifacts: B,
    refreshJobStatus: T,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: P
  };
}
const ri = 160, oi = 8, ai = 0;
function si() {
  const e = N(null), [t, n] = k(null), [r, o] = k(ai), a = x((s) => {
    e.current = s, n(s);
  }, []);
  return D(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (c) => {
      !Number.isFinite(c) || c < ri || o((u) => Math.abs(u - c) < oi ? u : c);
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
function ii(e) {
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
const on = { source: 0, translated: 0 };
function li(e, t) {
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
  const [f, d] = k(() => ({
    identity: c,
    pages: on
  })), [h, g] = k(() => ({ identity: c, tick: 0 })), p = f.identity === c ? f.pages : on, y = h.identity === c ? h.tick : 0, w = ii({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!l
  }), { primaryPane: S } = w, v = x((T, R) => {
    u.current === c && d((P) => {
      const M = P.identity === c ? P.pages : on;
      return M[R] === T && P.identity === c ? P : {
        identity: c,
        pages: { ...M, [R]: T }
      };
    });
  }, [c]), b = N(null), I = x(() => {
    b.current && clearTimeout(b.current);
    const T = c;
    b.current = setTimeout(() => {
      b.current = null, u.current === T && g((R) => ({
        identity: T,
        tick: R.identity === T ? R.tick + 1 : 1
      }));
    }, 60);
  }, [c]);
  D(() => (b.current && (clearTimeout(b.current), b.current = null), d((T) => T.identity === c && T.pages.source === 0 && T.pages.translated === 0 ? T : { identity: c, pages: { source: 0, translated: 0 } }), g((T) => T.identity === c && T.tick === 0 ? T : { identity: c, tick: 0 }), () => {
    b.current && (clearTimeout(b.current), b.current = null);
  }), [c]);
  const E = J(
    () => Math.max(p.source, p.translated),
    [p]
  ), _ = S === "translated" ? p.translated : p.source || p.translated, $ = t == null ? void 0 : t.userZoom, F = t == null ? void 0 : t.shellWidth, B = `${c}-${y}-${$}-${n}-${p.source}-${p.translated}-${F}`;
  return {
    ...w,
    numPagesByPane: p,
    hudNumPages: E,
    primaryNumPages: _,
    metricsTick: y,
    onNumPages: v,
    onMetrics: I,
    rowSyncRevision: B
  };
}
const ke = "data-reader-page", we = "data-reader-pane", zn = "data-natural-height", ci = "reader-react-root", Ro = "reader-react-grid", To = "reader-react-scroll-shell", tn = "reader-react-pdf-pane", Po = "reader-react-pdf-page", qt = "reader-react-pdf-page-placeholder", $n = "reader-react-pdf-page-slot";
function Gt(e, t) {
  const n = e != null ? `[${ke}="${e}"]` : `[${ke}]`;
  return t ? `${n}[${we}="${t}"]` : n;
}
function Fn() {
  return `.${$n}[${ke}]`;
}
function Zt(e) {
  return Number(e.getAttribute(ke));
}
const Eo = 0.25, Yt = 1, ui = 0.05, $t = 0.5, di = 16, fi = 8, ko = di + fi, mi = 720;
function Qe() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Mo(e) {
  return Number.isFinite(e) && e < mi;
}
function pt(e, t = Number.POSITIVE_INFINITY) {
  return Mo(t) && (e === "source" || e === "translated") ? Yt : $t;
}
function Ke(e) {
  return Number.isFinite(e) ? Math.min(Yt, Math.max(Eo, e)) : $t;
}
function Lt(e, t) {
  const n = Ke(Number(e) + t * ui);
  return Math.round(n * 100) / 100;
}
function hi(e) {
  return Math.round(Ke(e) * 100);
}
function No(e) {
  const n = (Number(e) || 0) - ko;
  return Math.max(160, Math.floor(n));
}
function pi(e, t = $t) {
  const n = Ke(t);
  return No((Number(e) || 0) * n);
}
function gi(e, t) {
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
const bi = 8;
function yi(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < bi ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const Ao = 200, _o = [
  "markdown"
], vi = _o;
function Lo(e) {
  return vi.includes(e);
}
const wi = "retainpdf:reader:view:v1:", br = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), Si = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function Do() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function In(e) {
  return `${e || ""}`.trim();
}
function Ii({
  documentId: e,
  jobId: t
}) {
  const n = In(e);
  if (n) return `document:${n}`;
  const r = In(t);
  return r ? `job:${r}` : "";
}
function Co(e) {
  const t = In(e);
  return t ? `${wi}${t}` : "";
}
function Ri(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function Ti(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!br.has(t) || !br.has(n) || t === n))
    return { left: t, right: n };
}
function Pi(e) {
  return e === null ? null : Lo(e) ? e : void 0;
}
function Ei(e) {
  return Si.has(e) ? e : void 0;
}
function xo(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Ri(t.anchor), r = Number(t.zoom), o = Ei(t.mode), a = Ti(t.splitLayout), s = Pi(t.assistantPanel);
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
function ze(e, t = Do()) {
  const n = Co(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? xo(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function nn(e, t, n = Do()) {
  const r = Co(e);
  if (!r || !n) return null;
  const o = ze(e, n), a = xo({
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
function ki(e, t, n = "") {
  var d;
  const [r, o] = k(() => {
    var h;
    return ((h = ze(n)) == null ? void 0 : h.zoom) ?? pt(e, Qe());
  }), a = N(r), s = N(n);
  a.current = r;
  const i = N(1), l = N(((d = ze(n)) == null ? void 0 : d.zoom) !== void 0);
  D(() => {
    var p;
    if (s.current === n) return;
    s.current = n;
    const h = (p = ze(n)) == null ? void 0 : p.zoom;
    l.current = h !== void 0;
    const g = h ?? pt(e, Qe());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), D(() => {
    if (l.current) return;
    const h = pt(e, Qe()), g = a.current;
    Math.abs(h - g) < 5e-4 || (i.current = 1, a.current = h, o(h));
  }, [e]);
  const c = x((h, g) => {
    const p = Ke(h), y = a.current;
    Math.abs(p - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : p / (y || 1), a.current = p, l.current = !0, nn(s.current, { zoom: p }), o(p));
  }, []), u = x((h) => {
    c(Lt(a.current, h));
  }, [c]), f = x((h) => {
    c(pt(h));
  }, [c]);
  return Re(() => {
    const h = i.current;
    Math.abs(h - 1) < 1e-3 || (i.current = 1, gi(t == null ? void 0 : t.current, h));
  }, [r, t]), { userZoom: r, onZoomChange: c, stepZoom: u, resetZoom: f };
}
const Mi = 160, Ni = 3e-3, yr = 50, Ai = 16, _i = 800;
function Li(e, t = 0) {
  const n = t === 1 ? Ai : t === 2 ? _i : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-yr, Math.min(yr, r));
  return Math.exp(-o * Ni);
}
function Di(e, t, n = 0) {
  return Ke(e * Li(t, n));
}
function Ci(e) {
  return Math.round(Ke(e) * 100) / 100;
}
function xi(e, t, n) {
  const r = Ke(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ke(t) / r;
  const a = (o + ko) / r;
  return No(a * Ke(t)) / o;
}
function Oi(e) {
  return Array.from(e.querySelectorAll(Fn()));
}
function zi(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function $i(e, t, n) {
  let r = null;
  for (const s of Oi(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const l = zi(i, t, n);
    if ((!r || l < r.distance) && (r = { el: s, rect: i, distance: l }), l === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(ke) || "",
    pane: o.getAttribute(we) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function Fi(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function Oo(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${Fn()}[${ke}="${t.page}"][${we}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Fi(n, e).scrollLeft += a);
}
function Bi(e, t, n, r) {
  const o = e.querySelector(`.${Ro}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function Rt(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const ji = 600, Ui = 1e3;
function Hi(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || Oo(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || c();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const l = r.setTimeout(() => c(), Ui);
  function c() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(l);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return c;
}
function Wi(e, t, n) {
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
      const f = Ci(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        Rt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, Rt(d.grid));
      }, ji), s.current = d, o.current(f, { keepScroll: !1 });
    }, c = (u) => {
      var h, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let f = a.current;
      if (!f) {
        (h = i.current) == null || h.call(i), i.current = null;
        const p = s.current;
        p && (p.fallback && clearTimeout(p.fallback), s.current = null, Rt(p.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: $i(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = Di(f.target, u.deltaY, u.deltaMode);
      const d = xi(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = Bi(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(l, Mi);
    };
    return e.addEventListener("wheel", c, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", c);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), Rt((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Re(() => {
    var c;
    const l = s.current;
    l && (s.current = null, l.fallback && clearTimeout(l.fallback), Rt(l.grid), !(!e || !l.anchor) && (Oo(e, l.anchor), (c = i.current) == null || c.call(i), i.current = Hi(e, l.anchor)));
  }, [t, e]);
}
function Ki(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = N(t), a = N(n), s = N(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: x((l) => {
    l !== o.current && (s.current(), a.current(l));
  }, []) };
}
const Bn = 48;
function zo(e, t = Bn) {
  return e.getBoundingClientRect().top + t;
}
function $o(e, t) {
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
  const o = Zt(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Wt(e, t, n = Bn) {
  if (!e)
    return null;
  const r = Gt(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = zo(e, n), i = $o(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Dt(e, t, n = "auto", r, o = Bn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(Gt(a, r))), i || (i = e.querySelector(Gt(a))), !i)
    return !1;
  const l = e.getBoundingClientRect(), c = i.getBoundingClientRect();
  if (l.height <= 0 || c.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = c.height > 0 ? c.height : i.offsetHeight, f = e.scrollTop + (c.top - l.top), d = Math.max(0, f + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - d) >= 1 && (e.scrollTop = d) : e.scrollTo({ top: d, behavior: n }), !0;
}
function Vi(e, t, n = "smooth", r) {
  return Dt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function Rn(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], l = () => {
    var u;
    if (a) return;
    Dt(
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
function Ji(e, t, n) {
  return Rn(
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
function qi(e, t, n = !0, r = "", o) {
  const [a, s] = k(1);
  return D(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let l = !1, c = null, u = 0;
    const f = Gt(void 0, o), d = () => {
      if (l) return;
      const p = Array.from(i.querySelectorAll(f));
      if (!p.length)
        return;
      const y = zo(i), w = $o(p, y);
      w && s(w.page);
    }, h = () => {
      l || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, d();
      }));
    }, g = () => {
      if (l) return;
      if (!Array.from(i.querySelectorAll(f)).length) {
        c = setTimeout(g, 120);
        return;
      }
      d(), i.addEventListener("scroll", h, { passive: !0 });
    };
    return g(), () => {
      l = !0, c && clearTimeout(c), u && cancelAnimationFrame(u), i.removeEventListener("scroll", h);
    };
  }, [e, t, n, r, o]), a;
}
const Gi = `canvas, .react-pdf__Page, .${Po}, .${qt}`, vr = /* @__PURE__ */ new WeakMap();
function Zi(e) {
  const t = Number(e.getAttribute(zn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = vr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Gi), vr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Yi(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Xi(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(Fn()).forEach((r) => {
    const o = Zt(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Zi(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Qi(e, t, n = "", r) {
  const [o, a] = k(() => /* @__PURE__ */ new Map()), s = N(o), i = N(r);
  return i.current = r, Re(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let l = !1, c = 0, u = !1, f = !1;
    const d = () => {
      var I;
      if (l) return;
      const v = e.current;
      if (!v) return;
      const b = Xi(v);
      Yi(s.current, b) || (s.current = b, a(b)), u && !f && (f = !0, (I = i.current) == null || I.call(i));
    }, h = () => {
      cancelAnimationFrame(c), c = requestAnimationFrame(() => {
        requestAnimationFrame(d);
      });
    };
    h();
    const g = window.setTimeout(h, 100), p = window.setTimeout(() => {
      u = !0, h();
    }, 300), y = window.setTimeout(h, 700), w = e.current;
    let S = null;
    return w && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => h()), S.observe(w)), () => {
      l = !0, cancelAnimationFrame(c), window.clearTimeout(g), window.clearTimeout(p), window.clearTimeout(y), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const el = [0, 48, 140, 320, 560], tl = 700, nl = [80, 200, 400], rl = 500, ol = 50, al = /* @__PURE__ */ new Set([
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
]), sl = 180, wr = [0, 48, 140, 320, 700, 1200];
function il(e, t) {
  var R;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = N(
    ((R = ze(a)) == null ? void 0 : R.anchor) || { page: 1, fraction: 0 }
  ), l = N(null), c = N(!1), u = N(r), f = N(null), d = N(null), h = N(null), g = N(null), p = N(a), y = N(""), w = N(n);
  w.current = n;
  const S = x(() => {
    var P;
    (P = f.current) == null || P.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), v = x(() => {
    !c.current && l.current == null || (S(), h.current != null && (clearTimeout(h.current), h.current = null), l.current = null, c.current = !1);
  }, [S]), b = x((P = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const M = () => {
      g.current = null, nn(p.current, {
        anchor: Ae(i.current)
      });
    };
    P ? M() : g.current = setTimeout(M, sl);
  }, []), I = x((P) => {
    i.current = Ae(P), l.current = null, h.current != null && clearTimeout(h.current), h.current = setTimeout(() => {
      h.current = null, c.current = !1;
    }, ol);
  }, []);
  D(() => {
    if (!o)
      return;
    let P = !1, M = null, A = null, j = null;
    const O = () => {
      if (P) return;
      const H = e.current;
      if (!H) {
        j = setTimeout(O, 50);
        return;
      }
      M = H, A = () => {
        if (c.current)
          return;
        const ae = Wt(M, w.current);
        ae && (i.current = ae, b());
      }, M.addEventListener("scroll", A, { passive: !0 }), c.current || A();
    };
    return O(), () => {
      P = !0, j != null && clearTimeout(j), M && A && M.removeEventListener("scroll", A);
    };
  }, [o, r, n, e, b]), D(() => {
    if (!o) return;
    const P = e.current;
    if (!P) return;
    const M = (A) => {
      A.metaKey || A.ctrlKey || A.altKey || al.has(A.key) && v();
    };
    return P.addEventListener("wheel", v, { passive: !0 }), P.addEventListener("touchmove", v, { passive: !0 }), window.addEventListener("keydown", M), () => {
      P.removeEventListener("wheel", v), P.removeEventListener("touchmove", v), window.removeEventListener("keydown", M);
    };
  }, [o, e, v]), Re(() => {
    var M;
    if (p.current === a) return;
    b(!0), S(), h.current != null && (clearTimeout(h.current), h.current = null), p.current = a, y.current = "";
    const P = (M = ze(a)) == null ? void 0 : M.anchor;
    i.current = P ? Ae(P) : { page: 1, fraction: 0 }, l.current = null, c.current = !!a, u.current = r;
  }, [a, r, b, S]), D(() => {
    var M;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const P = Ae(
      ((M = ze(a)) == null ? void 0 : M.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = P, l.current = P, c.current = !0, S(), f.current = Rn(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: wr,
        onDone: () => I(P)
      }
    ), d.current = setTimeout(() => {
      d.current = null, I(P);
    }, Math.max(...wr) + 160), () => S();
  }, [o, s, a, e, I, S]), D(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      c.current = !1, l.current = null, S();
      return;
    }
    const P = l.current ? Ae(l.current) : Ae(i.current);
    return c.current = !0, l.current = P, i.current = P, S(), f.current = Rn(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: el,
        onDone: () => I(P)
      }
    ), d.current = setTimeout(() => {
      d.current = null, I(P);
    }, tl), () => {
      S();
    };
  }, [r, o, n, e, I, S]), D(() => () => {
    S(), h.current != null && (clearTimeout(h.current), h.current = null), b(!0);
  }, [S, b]);
  const E = x(() => {
    const P = Wt(
      e.current,
      w.current
    );
    return Ae(P || i.current);
  }, [e]), _ = x(() => {
    c.current = !0;
    const P = Wt(
      e.current,
      w.current
    ), M = Ae(P ?? i.current);
    return i.current = M, l.current = M, b(), M;
  }, [e, b]), $ = x((P, M, A) => {
    const j = A || w.current, O = Xt(P, M || 1), H = { page: O, fraction: 0 };
    i.current = H, c.current = !0, l.current = H, b(), S(), Vi(e.current, O, "smooth", j), f.current = Ji(
      () => e.current,
      O,
      {
        behavior: "auto",
        pane: j,
        delaysMs: nl,
        onDone: () => I(H)
      }
    ), d.current = setTimeout(() => {
      d.current = null, I(H);
    }, rl);
  }, [e, I, S, b]), F = x(() => Ae(i.current), []), B = x(() => c.current, []), T = x(() => {
    if (!c.current || !l.current)
      return;
    const P = Ae(l.current);
    Dt(
      e.current,
      P,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: E,
    beginModeSwitch: _,
    goToPage: $,
    getAnchor: F,
    isRestoring: B,
    repinIfRestoring: T
  };
}
function ll(e, t) {
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
function Fo(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const cl = [0, 80, 200, 400, 800], ul = 120, dl = 400;
function fl(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: l, documentId: c, regionsSettled: u = !0 } = e, f = N(a);
  f.current = a;
  const d = N(s);
  d.current = s;
  const h = N(i);
  h.current = i;
  const g = N(n);
  g.current = n, D(() => {
    var b, I;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const p = Ss(), y = ll(p, d.current);
    if (y == null && (p != null && p.blockId) && !u) return;
    const w = Fo(p, y, { jobId: l, documentId: c });
    if (t.current === w)
      return;
    if (y == null) {
      t.current = w, (b = g.current) == null || b.call(g);
      return;
    }
    t.current = w, p && ((I = h.current) == null || I.call(h, p, y));
    const S = [];
    let v = 0;
    for (const E of cl)
      v = Math.max(v, E), S.push(
        setTimeout(() => {
          f.current(y);
        }, E)
      );
    return S.push(
      setTimeout(() => {
        var E;
        (E = g.current) == null || E.call(g);
      }, v + ul)
    ), () => {
      for (const E of S) clearTimeout(E);
    };
  }, [r, o, l, c, t, u]);
}
function ml(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function hl(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = dl,
    jobId: i,
    documentId: l,
    applyReaderSearch: c
  } = e, u = N(a);
  u.current = a;
  const f = N(c);
  f.current = c;
  const d = N(0);
  D(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const h = setTimeout(() => {
      var w;
      const g = ((w = globalThis.location) == null ? void 0 : w.search) || "", p = La(g, o, u.current);
      if (d.current = o, p === null) return;
      const y = `${new URLSearchParams(p).get("block_id") || ""}`.trim();
      t.current = Fo(
        { blockId: y },
        o,
        { jobId: i, documentId: l }
      ), (f.current || ml)(p);
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
function pl(e) {
  const t = N(""), [n, r] = k(!1), o = x(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  fl(a, t, o), hl(e, t, n);
}
const Tt = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function gl(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Sr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function Bo(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Sr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Sr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function bl(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = Bo(r, t, n);
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
function yl(e) {
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
function vl(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function wl(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function Sl(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function Il(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const Ir = [250, 500, 1e3, 2e3, 4e3], an = [80, 160, 320, 640, 1e3, 1500], Rr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Tn(e, t) {
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
function jn(e) {
  return Fa(e) ? `${e.code || ""}`.trim() : "";
}
function Bt(e, t) {
  const n = jn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Rl(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const l = await o.fetchPage(e, t.page_idx, { signal: r });
      if (Bo(n.pagesByPage.get(t.page_idx), t, l) !== "retry")
        return l;
      a = Ba(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (l) {
      if ((l == null ? void 0 : l.name) === "AbortError") throw l;
      a = l;
      const c = jn(l);
      if (c && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(c)) throw l;
    }
    const i = an[Math.min(s, an.length - 1)];
    if (await Tn(i, r), s >= an.length + 2) throw a;
  }
}
function Tl({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = k(Tt), s = N(o), i = N("");
  s.current = o;
  const l = `${e || ""}`.trim(), c = `${t || ""}`.trim().toLowerCase(), u = At(c) ? c : "";
  return D(() => {
    if (!n || !l) {
      i.current = "", s.current = Tt, a(Tt);
      return;
    }
    const f = r === void 0 ? ws() : r, d = i.current === l;
    if (i.current = l, !f) {
      const v = {
        ...d ? s.current : Tt,
        connection: u ? "terminal" : "unavailable",
        jobStatus: c,
        error: "实时译文暂不可用"
      };
      s.current = v, a(v);
      return;
    }
    const h = new AbortController();
    let g = !1;
    const p = {
      ...d ? s.current : Tt,
      connection: u ? "terminal" : "connecting",
      jobStatus: c,
      error: ""
    };
    s.current = p, a(p);
    const y = (v) => {
      h.signal.aborted || a((b) => {
        const I = v(b);
        return s.current = I, I;
      });
    }, w = async () => {
      let v = 0;
      for (; !h.signal.aborted; )
        try {
          const b = await f.fetchLayout(l, { signal: h.signal });
          g = !0, y((I) => ({
            ...I,
            layoutByPage: gl(b),
            jobStatus: c,
            error: ""
          }));
          return;
        } catch (b) {
          if ((b == null ? void 0 : b.name) === "AbortError") return;
          const I = jn(b);
          if (!(I === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !I)) {
            y((_) => ({
              ..._,
              connection: u ? "terminal" : "unavailable",
              jobStatus: c,
              error: Bt(b, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            y((_) => ({
              ..._,
              connection: "terminal",
              jobStatus: c,
              error: ""
            }));
            return;
          }
          y((_) => ({
            ..._,
            connection: "connecting",
            jobStatus: c,
            error: Bt(b, "正在等待 OCR 版面数据")
          })), await Tn(Ir[Math.min(v, Ir.length - 1)], h.signal).catch(() => {
          }), v += 1;
        }
    };
    return (async () => {
      if (await w(), !g || h.signal.aborted) return;
      let v = 0;
      for (; !h.signal.aborted; ) {
        u || y((b) => ({
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
            signal: h.signal,
            onEvent: async (b) => {
              if (b.seq <= s.current.lastSeq) return;
              let I;
              try {
                I = await Rl(
                  l,
                  b,
                  s.current,
                  h.signal,
                  f
                );
              } catch (E) {
                if ((E == null ? void 0 : E.name) === "AbortError" || h.signal.aborted) throw E;
                y((_) => ({
                  ..._,
                  lastSeq: Math.max(_.lastSeq, b.seq),
                  error: Bt(E, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((E) => {
                const _ = bl(E, b, I);
                return u ? {
                  ..._,
                  connection: "terminal",
                  jobStatus: c
                } : {
                  ..._,
                  jobStatus: c
                };
              }), v = 0;
            }
          });
        } catch (b) {
          if ((b == null ? void 0 : b.name) === "AbortError" || h.signal.aborted) return;
          y((I) => ({
            ...I,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: c,
            error: Bt(b, "实时译文连接已中断，正在重连")
          }));
        }
        if (h.signal.aborted) return;
        if (u) {
          y((b) => ({
            ...b,
            connection: "terminal",
            jobStatus: c
          }));
          return;
        }
        await Tn(Rr[Math.min(v, Rr.length - 1)], h.signal).catch(() => {
        }), v += 1;
      }
    })(), () => h.abort();
  }, [n, r, l, u]), o;
}
function Pl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), l = Number(s.count) || 0;
    i && l > 0 && o.set(i, l);
  }
  return o;
}
function El(e, t = !0) {
  const [n, r] = k(() => /* @__PURE__ */ new Map());
  return D(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = nt().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Pl(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const kl = 4500;
function Ml(e) {
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
const Nl = /* @__PURE__ */ new Set(["book", "translate"]);
function jo(e) {
  return !!(e.jobId && e.sourceUrl && Nl.has(e.workflow));
}
function Al(e) {
  return !!(jo(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function _l() {
  const e = ni(), t = jo({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Al({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = N({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !At(o) && (r.current.running = !0);
  const a = Tl({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: l, bindShell: c } = si(), u = El(e.jobId, !e.sourceOnly), f = Ii({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: h, onZoomChange: g } = ki(e.mode, s, f);
  Wi(i, h, g);
  const p = li(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: h, shellWidth: l, identityKey: d }
  ), {
    beginModeSwitch: y,
    goToPage: w,
    repinIfRestoring: S
  } = il(s, {
    primaryPane: p.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: p.primaryNumPages > 0
  });
  D(() => {
    S();
  }, [l, S]);
  const v = Qi(
    s,
    p.compareMode,
    p.rowSyncRevision,
    S
  ), b = qi(
    s,
    p.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${h}-${p.metricsTick}`,
    p.primaryPane
  ), I = x((O, H) => {
    var ee, te;
    const ae = Math.max(
      Number(p.hudNumPages) || 0,
      Number(p.primaryNumPages) || 0,
      Number((ee = p.numPagesByPane) == null ? void 0 : ee.source) || 0,
      Number((te = p.numPagesByPane) == null ? void 0 : te.translated) || 0
    );
    w(O, ae, H);
  }, [w, p.hudNumPages, p.primaryNumPages, p.numPagesByPane]), [E, _] = k(null), $ = N(null), F = x((O) => {
    $.current && clearTimeout($.current), _(O), O && ($.current = setTimeout(() => _(null), kl));
  }, []);
  D(() => () => {
    $.current && clearTimeout($.current);
  }, []);
  const B = x((O) => {
    const H = rn(e.regions, O);
    return H ? lr(H, p.primaryPane).page : null;
  }, [e.regions, p.primaryPane]), T = x((O, H) => {
    const ae = H || p.primaryPane, ee = typeof O == "object" && O ? `${O.block_id || ""}`.trim() : "", te = typeof O == "object" && O ? `${O.image_url || ""}`.trim() : "", pe = typeof O == "object" && O ? O.page_idx != null ? Number(O.page_idx) + 1 : O.page != null ? Number(O.page) : null : typeof O == "number" ? O + 1 : null, ie = Ca(e.regions, te, pe) || rn(e.regions, ee) || (typeof O == "object" ? xa(e.regions, O) : null);
    let me = ie ? lr(ie, ae).page : null;
    me == null && (me = Ml(O)), !(me == null || me < 1) && (F(ie), I(me, ae));
  }, [F, I, p.primaryPane, e.regions]);
  pl({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: p.hudNumPages || 0,
    currentPage: b,
    goToPage: I,
    resolveBlockPage: B,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (O) => {
      F(rn(e.regions, O.blockId));
    }
  });
  const { setModeKeepingPage: R } = Ki({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  D(() => {
    F(null);
  }, [d, F]);
  const P = !e.boot.loading && !e.boot.failed, M = J(() => ({ bindShell: c, shellEl: i, shellWidth: l, shellRef: s }), [c, i, l, s]), A = J(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), j = J(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: h,
    onZoomChange: g,
    shell: M,
    panes: p,
    sessionFiles: A,
    rowHeights: v,
    goToPage: I,
    activeRegion: E,
    jumpToAnchor: T,
    setModeKeepingPage: R,
    download: e.download,
    showHud: P,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, M, p, A, v, I, E, T, R, P, h, g, f, a, n, u]);
  return J(() => ({
    ...j,
    currentPage: b
  }), [j, b]);
}
const Ll = [
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
], Dl = [
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
function Cl(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Ll)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function xl(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Ol = ".reader-notes-panel";
function zl(e) {
  return e instanceof Element ? !!e.closest(Ol) : !1;
}
function $l(e) {
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
    const f = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || xl(d.target) || zl(d.target))
        return;
      const h = d.key, g = Cl(h);
      if (g) {
        if (g.mode) {
          if (n && g.mode !== "source")
            return;
          d.preventDefault(), r(g.mode);
          return;
        }
        if (g.action === "doc-dark") {
          if (!c || d.repeat) return;
          d.preventDefault(), c();
          return;
        }
        if (!(g.requiresPages && i <= 0))
          switch (d.preventDefault(), g.action) {
            case "zoom-in":
              a(Lt(o, 1));
              return;
            case "zoom-out":
              a(Lt(o, -1));
              return;
            case "zoom-reset":
              a(pt(t, Qe()));
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
const Fl = "retainpdf:soft-reader-close";
function Bl() {
  return new URL("./index.html", window.location.href).href;
}
function jl() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Fl },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Ul(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Hl() {
  if (!(typeof window > "u") && !jl()) {
    if (Ul(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Bl());
  }
}
function Wl({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ m("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Kl({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ L(Wl, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Hl();
  }, children: [
    /* @__PURE__ */ m(St, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ m("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const Vl = 3e3, Jl = 8;
async function ql(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function Gl(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function Zl(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = Vl;
  const r = [], o = (s, i, l) => {
    const c = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = Gl(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const h = l ? `${l}.${u}` : `${u}`, g = { id: h, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), c.push(g), i < Jl && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, h));
    }
    return c;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await ql(e, i);
  })), a;
}
function Yl(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function Xl(e, t) {
  let n = null;
  for (const r of Yl(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
function Tr(e) {
  if (!e) return [];
  const t = e.split(".");
  return t.slice(0, -1).map((n, r) => t.slice(0, r + 1).join("."));
}
let Pr = !1;
function Ql() {
  if (Pr)
    return;
  const e = _t().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (wo.GlobalWorkerOptions.workerSrc = e, Pr = !0);
}
function fe(e) {
  return typeof e == "string" ? e : "";
}
function ec(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function tc(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function nc(e) {
  return {
    source: fe(e == null ? void 0 : e.source_text) || fe(e == null ? void 0 : e.unit_source_text),
    translated: fe(e == null ? void 0 : e.protected_translated_text) || fe(e == null ? void 0 : e.translated_text)
  };
}
const rc = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function Uo(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function oc(e) {
  const t = Uo(e).sort((r, o) => fe(r.ts).localeCompare(fe(o.ts)));
  return t.length ? [
    { text: fe(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: fe(r.new_text),
      label: rc[fe(r.source)] || fe(r.source) || "修订",
      ts: fe(r.ts),
      reason: fe(r.reason)
    }))
  ].reverse() : [];
}
function ac(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function sc(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return fe(r.finished_at) || fe(n.finished_at) || "";
}
function ic(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = Uo(e).sort((a, s) => fe(a.ts).localeCompare(fe(s.ts)));
  for (const a of o) {
    const s = new Date(fe(a.ts)).getTime(), i = fe(a.reader_item_id) || fe(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, fe(a.new_text));
  }
  return n;
}
const lc = {
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
function cc(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = lc[fe(n.kind)] || fe(n.kind) || "问题", o = fe(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const uc = /* @__PURE__ */ new Set(["text", "formula"]);
function Un(e) {
  return uc.has(e);
}
function dc(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || Un(zt(n));
}
function fc(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !Un(zt(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const mc = 300, hc = 72;
function pc(e, t) {
  if (e.width >= mc && e.height >= hc)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const gc = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function bc(e, t, n) {
  return e.flatMap((r) => {
    if (!gc.has(zt(r.region))) return [];
    const o = xn(r, t, n);
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
async function yc(e) {
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
const vc = "reader-text-hover-copy", wc = "reader-text-hover-edit", Sc = "reader-text-hover-id";
function Ic(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const Ho = "reader-text-hover-tools";
function sn({
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
const Rc = 26, Tc = 220;
function Pc(e, t = Tc) {
  return e.height < Rc * 2 || e.width < t;
}
function Ec({ state: e }) {
  return /* @__PURE__ */ m(e === "copied" ? ho : e === "failed" ? St : Ua, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function kc({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  frameRect: o,
  placement: a,
  tailTop: s = 0
}) {
  const [i, l] = k("idle"), [c, u] = k("idle"), [f] = k(() => Ic()), d = N([]), h = (e == null ? void 0 : e.itemId) || "";
  if (D(() => {
    l("idle"), u("idle");
    const b = d.current;
    return () => {
      b.forEach((I) => window.clearTimeout(I)), d.current = [];
    };
  }, [h]), !e) return null;
  const g = Oa(e.highlight.region, t), p = zt(e.highlight.region), y = (b, I) => async (E) => {
    E.preventDefault(), E.stopPropagation();
    const _ = await yc(b);
    I(_ ? "copied" : "failed"), d.current.push(window.setTimeout(() => I("idle"), 1200));
  }, w = p === "formula" ? "复制 LaTeX" : "复制", S = o || e.rect, v = a || (Pc(S) ? "outside" : "inside");
  return /* @__PURE__ */ m("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ m(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": p,
      style: S,
      children: /* @__PURE__ */ L(
        "div",
        {
          className: Ho,
          "data-placement": v,
          style: v === "tail" ? { top: s } : void 0,
          children: [
            f ? /* @__PURE__ */ m(
              sn,
              {
                className: Sc,
                state: c,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: y(e.itemId, u),
                children: c === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && Un(p) ? /* @__PURE__ */ m(
              sn,
              {
                className: wc,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (b) => {
                  b.preventDefault(), b.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ m(On, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            g ? /* @__PURE__ */ m(
              sn,
              {
                className: vc,
                state: i,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: i === "copied" ? "已复制" : i === "failed" ? "复制失败" : w,
                onClick: y(g, l),
                children: /* @__PURE__ */ m(Ec, { state: i })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Mc(e, t) {
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
function Nc(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = xn(
      Mc(e, a),
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
const Ac = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', _c = 256, Pt = /* @__PURE__ */ new Map();
function Lc(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Wo(e) {
  const t = `${e || ""}`, { text: n, slots: r } = ms(t, { bareLatex: !0 }), o = Lc(n), a = hs(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Pt.get(t);
  if (!s && (s = ps(o, r), Pt.set(t, s), Pt.size > _c)) {
    const i = Pt.keys().next().value;
    i !== void 0 && Pt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function ln(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function He(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Dc(e, t) {
  const n = e.typography, r = He(t) || 1, o = He(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = ln(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, l = Math.max(5.5 * r, Math.min(s, i * r)), c = He(n == null ? void 0 : n.fit_min_font_size_pt), u = He(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (c || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : l
  ), h = o ? o * r : l, g = He(n == null ? void 0 : n.leading_em), p = [
    He(n == null ? void 0 : n.padding_top_pt) || 0,
    He(n == null ? void 0 : n.padding_right_pt) || 0,
    He(n == null ? void 0 : n.padding_bottom_pt) || 0,
    He(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Ac,
    fontSizePx: Math.max(f, Math.min(d, h)),
    minFontSizePx: f,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (ln(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : ln(e.kind) ? "center" : "justify",
    padding: p,
    exact: !!o
  };
}
function Cc(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (f) => {
    const d = s.get(f);
    if (d !== void 0) return d;
    const { width: h, height: g } = e(f), p = h <= t + 0.5 && g <= n + 0.5;
    return s.set(f, p), p;
  };
  let l = o, c = a, u = Math.min(r.requestedFontSizePx, c);
  if (i(u)) {
    if (!r.exact) {
      l = u;
      for (let f = 0; f < 6 && c > l; f += 1) {
        const d = (l + c) / 2;
        i(d) ? (u = d, l = d) : c = d;
      }
    }
  } else {
    c = u, u = l;
    for (let f = 0; f < 8 && c > l; f += 1) {
      const d = (l + c) / 2;
      i(d) ? (u = d, l = d) : c = d;
    }
  }
  return Math.max(o, u);
}
const xc = 512, Et = /* @__PURE__ */ new Map();
let Pn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Pn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Pn += 1;
}));
function Oc(e, t, n, r) {
  return [
    Pn,
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
function Ko({ item: e, pageScale: t }) {
  const n = N(null), r = J(
    () => Wo(e.translatedText),
    [e.translatedText]
  ), [o, a] = k(r.fallbackHtml), s = J(
    () => Dc(e, t),
    [e, t]
  );
  D(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), Re(() => {
    const f = n.current;
    if (!f) return;
    const [d, h, g, p] = s.padding, y = Math.max(1, e.rect.width - p - h), w = Math.max(1, e.rect.height - d - g), S = Oc(o, y, w, s);
    let v = Et.get(S);
    if (v === void 0 && (v = Cc(
      (b) => (f.style.fontSize = `${b}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Et.set(S, v), Et.size > xc)) {
      const b = Et.keys().next().value;
      b !== void 0 && Et.delete(b);
    }
    f.style.fontSize = `${v.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [i, l, c, u] = s.padding;
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
        padding: `${i}px ${l}px ${c}px ${u}px`
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
function zc({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = J(
    () => Nc(e, t, n, r),
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
        Ko,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const $c = en(zc);
function Fc({
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
        Ko,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: zt(a.highlight.region),
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
const Bc = en(Fc), Vo = 24, Ze = Vo * 2 + 4, We = 24, jc = 4, Uc = 6, at = (e) => e.left + e.width, tt = (e) => e.top + e.height;
function kt(e, t) {
  const n = Math.min(at(e), at(t)) - Math.max(e.left, t.left), r = Math.min(tt(e), tt(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const kr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= at(t) && r >= t.top && r <= tt(t);
}, Hc = (e) => e.height > 40 && e.height > e.width * 2.5;
function Wc(e, t, n) {
  if (!t.length || e.height < We || e.width < n + 8) return null;
  const r = Math.max(...t.map(tt)), o = at(e) - 4 - n;
  for (const a of [r, tt(e) - 2]) {
    const s = Math.max(e.top, a - We), i = { left: o, top: s, width: n, height: We };
    if (!t.some((l) => kt(i, l) > 0)) return s - e.top;
  }
  return null;
}
function Kc(e, t) {
  const n = [], r = (a) => {
    const s = Vo + jc, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: at(e), top: i, width: s, height: Ze } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: Ze } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - We - 3, width: Ze, height: We + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: tt(e), width: Ze, height: We + 3 } }), r(!0);
  const o = Wc(e, t, Ze);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: at(e) - 4 - Ze, top: e.top + o, width: Ze, height: We } }), n;
}
function Vc(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !Hc(S)), i = s.filter((S) => kr(S, t)), l = s.filter((S) => !kr(S, t)), c = n.filter((S) => S !== t && kt(S, t) < t.width * t.height * 0.5), u = Kc(t, i).filter(({ box: S, overhang: v }) => {
    const b = v ? Uc : 0;
    return S.left >= -b && at(S) <= r + b && S.top >= 0 && tt(S) <= o;
  }), f = ({ placement: S, tailTop: v }) => v === void 0 ? { placement: S } : { placement: S, tailTop: v }, d = ({ box: S }) => !l.some((v) => kt(S, v) > 0), h = u.filter((S) => S.placement !== "tail"), g = h.find((S) => d(S) && !c.some((v) => kt(S.box, v) > 0));
  if (g) return f(g);
  const p = h.find(d) || u.find((S) => S.placement === "tail" && d(S));
  if (p) return f(p);
  let y = null, w = Number.POSITIVE_INFINITY;
  for (const S of u) {
    const v = l.reduce((b, I) => b + kt(S.box, I), 0);
    v < w && (y = S, w = v);
  }
  return y ? f(y) : { placement: "outside" };
}
function Jc(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - We - 3 : tt(r);
  return t >= r.left - 4 && t <= r.left + Ze + 4 && n >= a && n <= a + We + 3;
}
const cn = (e) => e.left + e.width, un = (e) => e.top + e.height;
function qc(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const c of t) {
    if (c.width <= 0 || c.height <= 0) continue;
    const u = c.left + c.width / 2, f = c.top + c.height / 2;
    u < e.left || u > cn(e) || f < e.top || f > un(e) || (o = Math.min(o, c.left), a = Math.min(a, c.top), s = Math.max(s, cn(c)), i = Math.max(i, un(c)));
  }
  if (!Number.isFinite(o)) return e;
  const l = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return l.width = Math.min(cn(e) + r, s + n) - l.left, l.height = Math.min(un(e) + r, i + n) - l.top, l.width * l.height < e.width * e.height * 0.3 && l.height < 24 ? e : l;
}
function Gc(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function Zc(e, t, n, r) {
  const [o, a] = k(null);
  return Re(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? Gc(s) : [], l = i.length ? qc(t.rect, i) : t.rect, c = n.filter((f) => f.itemId !== t.itemId).map((f) => f.rect), u = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Vc({ frame: l, others: c, pageWidth: r, pageHeight: u, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
const Jo = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Mr = { pen: 35e-4, highlighter: 0.018 }, Nr = 0.015, En = "retainpdf.reader.ink.v1:";
function Ar(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(En + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function Yc(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(En + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(En + e);
    } catch {
    }
}
function Xc(e, t, n, r, o, a) {
  const s = Nr * Nr;
  return e.filter((i) => qo(i, t, n) && i.points.some(([l, c]) => (l - r) ** 2 + ((c - o) * a) ** 2 <= s)).map((i) => i.id);
}
function qo(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function Qc(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function eu(e) {
  const [t, n] = k(null), [r, o] = k(Jo[0].key), [a, s] = k(() => Ar(e)), i = N(a), l = N([]);
  D(() => {
    const p = Ar(e);
    i.current = p, s(p), l.current = [];
  }, [e]);
  const c = x((p) => {
    i.current = p, s(p), Yc(e, p);
  }, [e]), u = x((p) => {
    const y = i.current, w = p(y);
    w !== y && (l.current = [...l.current.slice(-49), y], c(w));
  }, [c]), f = x((p) => {
    p.points.length < 1 || u((y) => [...y, { ...p, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = x((p) => {
    p.length && u((y) => y.filter((w) => !p.includes(w.id)));
  }, [u]), h = x((p) => {
    u((y) => y.some((w) => w.page === p) ? y.filter((w) => w.page !== p) : y);
  }, [u]), g = x(() => {
    const p = l.current.pop();
    p && c(p);
  }, [c]);
  return J(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: h }),
    [t, r, a, f, d, g, h]
  );
}
const tu = "reader-ink-layer";
function nu(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function _r({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ m(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: nu(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function ru({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = k(null), i = N(!1), l = o.strokes.filter((p) => qo(p, e, t)), c = !!o.tool;
  if (!c && !l.length) return null;
  const u = (p) => {
    const y = p.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (p.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (p.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (p, y) => o.erase(Xc(o.strokes, e, t, p, y, r / Math.max(1, n))), d = (p) => {
    if (!o.tool || p.button !== 0) return;
    p.preventDefault(), p.stopPropagation(), p.currentTarget.setPointerCapture(p.pointerId), i.current = !0;
    const [y, w] = u(p);
    o.tool === "eraser" ? f(y, w) : s([[y, w]]);
  }, h = (p) => {
    if (!i.current || !o.tool) return;
    p.stopPropagation();
    const [y, w] = u(p);
    o.tool === "eraser" ? f(y, w) : s((S) => S ? Qc(S, y, w) : [[y, w]]);
  }, g = (p) => {
    i.current && (i.current = !1, p.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Mr[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ L(
    "svg",
    {
      className: tu,
      "data-ink-active": c ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: h,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        l.map((p) => /* @__PURE__ */ m(_r, { stroke: p, width: n, height: r }, p.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ m(_r, { stroke: { tool: o.tool, color: o.color, width: Mr[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function ou({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = k(null), [i, l] = k(!1), [c, u] = k([]), [f, d] = k(""), [h, g] = k(""), [p, y] = k(!1), [w, S] = k(null), [v, b] = k([]), I = r.drafts, E = r.generation, _ = x(async (T, R) => {
    if (e)
      try {
        u(oc(await e.fetchRevisions(T, R)));
      } catch {
        u([]);
      }
  }, [e]);
  D(() => {
    if (s(null), u([]), S(null), b([]), g(""), !e || !t || !n) return;
    let T = !1;
    return l(!0), e.loadItem(t, n).then((R) => {
      if (T) return;
      const P = R == null ? void 0 : R.item;
      if (!P) throw new Error("找不到这一段的译文。");
      const M = `${(R == null ? void 0 : R.item_id) || n}`, { source: A, translated: j } = nc(P);
      s({ readerItemId: n, itemId: M, source: A, current: j }), d(I.get(n) ?? j);
    }).catch((R) => {
      T || S({ tone: "error", message: (R == null ? void 0 : R.message) || "读取这段译文失败。" });
    }).finally(() => {
      T || l(!1);
    }), _(t, n), () => {
      T = !0;
    };
  }, [e, t, n, _]);
  const $ = x((T) => {
    d(T), n && I.set(n, T);
  }, [n, I]), F = x(async (T, R) => {
    if (!e || !a || p) return !1;
    const P = T ?? f;
    if (!P.trim()) return !1;
    y(!0), S(null), b([]);
    try {
      const M = await e.revise(t, a.itemId, {
        translated_text: P,
        source: "user",
        reason: (R ?? h).trim() || "在阅读页手动修改",
        ...E.current != null ? { expected_generation: E.current } : {}
      }), A = Number(M == null ? void 0 : M.generation);
      return Number.isFinite(A) && (E.current = A), I.delete(a.readerItemId), s({ ...a, current: P }), d(P), g(""), (M == null ? void 0 : M.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, P), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), _(t, a.readerItemId), !0;
    } catch (M) {
      const A = M;
      return (A == null ? void 0 : A.reason) === "generation_mismatch" && (E.current = null), S({ tone: "error", message: (A == null ? void 0 : A.message) || "保存失败，请稍后再试。" }), b(cc(A == null ? void 0 : A.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, p, f, h, t, o, _, I, E]), B = x(() => {
    n && I.delete(n);
  }, [n, I]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: c,
    draft: f,
    setDraft: $,
    reason: h,
    setReason: g,
    saving: p,
    status: w,
    issues: v,
    save: F,
    discardDraft: B
  };
}
const Go = "reader-inline-edit";
function au({ text: e }) {
  const [t, n] = k("");
  return D(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = Wo(e);
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
function su({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var B;
  const s = e.itemId, i = ou({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [l, c] = k(!1), [u, f] = k(!1), d = N(null), h = pc(e.rect, t), g = J(() => fc(o), [o]), p = g.indexOf(s), { loaded: y } = i, w = i.saving || i.loading, S = n.blockedReason, v = !y || i.draft === y.current, { close: b, select: I } = n, E = x((T) => {
    const R = g[p + T];
    R && (I(R), a == null || a(R));
  }, [g, p, I, a]), _ = x(() => {
    i.discardDraft(), b();
  }, [i, b]), $ = x(async (T, R) => {
    await i.save(T, R) && b();
  }, [i, b]);
  D(() => {
    const T = (R) => {
      !R.altKey || R.key !== "ArrowUp" && R.key !== "ArrowDown" || (R.preventDefault(), E(R.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", T), () => window.removeEventListener("keydown", T);
  }, [E]), Re(() => {
    const T = d.current;
    if (!T) return;
    T.style.height = "auto";
    const R = h.mode === "inline" ? h.minHeight : 0;
    T.style.height = `${Math.max(R, T.scrollHeight + 2)}px`;
  }, [i.draft, y, h.mode, h.mode === "inline" ? h.minHeight : 0]);
  const F = h.mode === "inline" ? { left: h.left, top: h.top, width: h.width } : { left: h.left, width: h.width, top: h.top, bottom: h.bottom };
  return /* @__PURE__ */ L(ct, { children: [
    h.mode === "popout" ? /* @__PURE__ */ m("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ L(
      "div",
      {
        className: `${Go} is-${h.mode}`,
        style: F,
        role: "group",
        "aria-label": `改第 ${((B = n.target) == null ? void 0 : B.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": h.mode,
        onPointerDown: (T) => T.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ m(
            X,
            {
              className: `reader-inline-edit-source${l ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: l ? "收起原文" : "展开原文",
              onClick: () => c((T) => !T),
              children: y.source
            }
          ) : null,
          S ? /* @__PURE__ */ m("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: S }) : null,
          i.loading ? /* @__PURE__ */ m("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ m(
            us,
            {
              ref: d,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: w || !!S,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (T) => i.setDraft(T.target.value),
              onKeyDown: (T) => {
                T.key === "Enter" && (T.metaKey || T.ctrlKey) ? (T.preventDefault(), v || $()) : T.key === "Escape" && (T.preventDefault(), _());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ m(au, { text: i.draft }) : null,
          /* @__PURE__ */ L("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ m(ur, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: p <= 0, onClick: () => E(-1), children: /* @__PURE__ */ m(Ha, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ m(ur, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: p < 0 || p >= g.length - 1, onClick: () => E(1), children: /* @__PURE__ */ m(po, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ m(
              vo,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!S || !y,
                onChange: (T) => i.setReason(T.target.value),
                onKeyDown: (T) => {
                  T.key === "Enter" ? (T.preventDefault(), v || $()) : T.key === "Escape" && (T.preventDefault(), _());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ L(
              X,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => f((T) => !T),
                children: [
                  /* @__PURE__ */ m(Wa, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ m(X, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: _, children: "取消" }),
            /* @__PURE__ */ m(
              X,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: w || !!S || v || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  $();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ m("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ m("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((T) => /* @__PURE__ */ m("li", { children: T }, T)) }) : null,
          u && y && i.history.length ? /* @__PURE__ */ m("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((T, R) => {
            const P = T.text === y.current, M = [ac(T.ts), T.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ L("li", { "data-block-edit-history": T.label, "data-current": P ? "true" : void 0, children: [
              /* @__PURE__ */ L("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ L("span", { children: [
                  M,
                  P ? "（现在用的）" : "",
                  T.reason ? ` · ${T.reason}` : ""
                ] }),
                P ? null : /* @__PURE__ */ m(
                  X,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!S,
                    onClick: () => {
                      $(T.text, `回到「${M.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ m("p", { className: "reader-inline-edit-history-text", children: T.text })
            ] }, `${T.ts}:${R}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const Zo = Ln(null), Yo = Ln(null);
function iu({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ m(Zo.Provider, { value: e, children: /* @__PURE__ */ m(Yo.Provider, { value: t, children: n }) });
}
function Je() {
  return Dn(Zo);
}
function Xo() {
  return Dn(Yo);
}
const Xe = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), lu = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, cu = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, uu = {
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
}, Lr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function du(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Lr(o ?? a ?? "", lu)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Lr(o ?? a ?? "", cu)).replace(/\\([a-zA-Z]+)/gu, (r, o) => uu[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function fu(e) {
  return Xe(e.translatedBlockText) || Xe(e.translated.text) || Xe(e.source.text);
}
const mu = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function hu(e) {
  const t = [];
  for (const n of e) {
    if (!mu(n)) continue;
    const r = du(fu(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function pu(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const gu = 24, bu = 60;
function Dr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - gu), o = Math.min(e.length, n + t.length + bu), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function yu(e, t, n = 200) {
  const r = Xe(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = Xe(a.translatedBlockText) || Xe(a.translated.text), l = i ? Dr(i, r) : null, c = l ?? Dr(Xe(a.source.text), r);
    if (c && (o.push({ itemId: a.itemId, page: s, side: l ? "translated" : "source", ...c }), o.length >= n))
      break;
  }
  return o;
}
function jt(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function vu(e, t) {
  const n = Xe(t).toLowerCase();
  if (!n || !e) return jt(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${jt(e.slice(a, s))}<mark class="reader-find-mark">${jt(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + jt(e.slice(a));
}
function wu(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const Qo = 1.414;
function Su({
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
  regionTargets: d = [],
  hoveredRegionId: h,
  onHoverRegion: g,
  liveTranslationLayout: p,
  liveTranslationPage: y,
  showLiveTranslation: w = r === "source",
  liveTranslationMissing: S = !1
}) {
  var Me, G;
  const v = Je(), b = v == null ? void 0 : v.revisedBlocks, I = v == null ? void 0 : v.blockEdit, E = I == null ? void 0 : I.pendingEdits, _ = v == null ? void 0 : v.editBlock, $ = (v == null ? void 0 : v.findTerm) || "", F = J(
    () => $ ? ({ str: z }) => vu(z, $) : void 0,
    [$]
  ), B = N(l ?? Qo), [T, R] = k(B.current);
  D(() => {
    l != null && Math.abs(l - B.current) >= 1e-3 && (B.current = l, R(l));
  }, [l]);
  const P = N(u);
  P.current = u;
  const M = N(null), A = N((z) => {
    var ne;
    M.current = z, (ne = P.current) == null || ne.call(P, z);
  }).current, j = N(null), O = N(`${t}@${n}`);
  Re(() => {
    const z = `${t}@${n}`;
    O.current !== z && (O.current = z, o && Ru(M.current, j.current));
  }, [o, n, t]), D(() => {
    o || dn(j.current);
  }, [o]), D(() => () => dn(j.current), []);
  const H = Math.max(120, Math.floor(t * T)), ae = Math.max(H, Math.ceil(s || 0)), ee = xn(f, t, H), te = J(
    () => bc(d, t, H),
    [H, d, t]
  ), [pe, ie] = k(null), me = typeof g == "function", Le = me ? h ?? null : pe, Q = (z) => {
    me ? z !== (h ?? null) && (g == null || g(z)) : ie((ne) => ne === z ? ne : z);
  }, Y = J(
    () => te.find((z) => z.itemId === Le) || null,
    [Le, te]
  ), Se = r === "translated" && ((Me = I == null ? void 0 : I.target) == null ? void 0 : Me.itemId) || "", de = J(
    () => Se && te.find((z) => z.itemId === Se) || null,
    [Se, te]
  ), he = Zc(M, o ? Y : null, te, t), $e = (z) => {
    var Te, Ie, Ne, be, Fe;
    if (z.pointerType === "touch") return;
    if ((Te = v == null ? void 0 : v.ink) != null && Te.tool) {
      Q(null);
      return;
    }
    if (z.buttons !== 0) {
      Q(null);
      return;
    }
    if ((Ne = (Ie = z.target) == null ? void 0 : Ie.closest) != null && Ne.call(Ie, `.${Ho}`) || (Fe = (be = z.target) == null ? void 0 : be.closest) != null && Fe.call(be, `.${Go}`)) return;
    const ne = z.currentTarget.getBoundingClientRect(), re = z.clientX - ne.left, ue = z.clientY - ne.top;
    if (Jc(he, re, ue)) return;
    const oe = Er(te, re, ue);
    Q((oe == null ? void 0 : oe.itemId) || null);
  }, qe = (z) => {
    if (z.pointerType === "mouse") return;
    const ne = z.currentTarget.getBoundingClientRect(), re = Er(
      te,
      z.clientX - ne.left,
      z.clientY - ne.top
    );
    Q((re == null ? void 0 : re.itemId) || null);
  }, De = (z) => {
    !Number.isFinite(z) || z <= 0 || Math.abs(B.current - z) < 1e-3 || (B.current = z, R(z), c == null || c(e, z));
  };
  return /* @__PURE__ */ L(
    "div",
    {
      ref: A,
      [ke]: e,
      [we]: r,
      [zn]: H,
      className: $n,
      onPointerMoveCapture: $e,
      onPointerDown: qe,
      onPointerLeave: (z) => {
        z.pointerType === "mouse" && Q(null);
      },
      style: {
        width: t,
        height: ae,
        minHeight: ae
      },
      children: [
        o ? /* @__PURE__ */ m(
          ds,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: F,
            renderAnnotationLayer: !1,
            className: Po,
            loading: /* @__PURE__ */ m(
              "div",
              {
                className: qt,
                style: { width: t, height: H }
              }
            ),
            onLoadSuccess: (z) => {
              try {
                const ne = z.getViewport({ scale: 1 });
                if (ne.width > 0) {
                  const re = ne.height / ne.width;
                  De(re);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              dn(j.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ m(
          "div",
          {
            className: qt,
            style: { width: t, height: H },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ m("div", { ref: j, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        ee ? /* @__PURE__ */ m(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: ee,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ m(
          $c,
          {
            layoutPage: p,
            pageState: y,
            width: t,
            height: H
          }
        ) : null,
        o && w && S ? /* @__PURE__ */ m("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (E != null && E.size) ? /* @__PURE__ */ m(Bc, { targets: te, edits: E, width: t, excludeId: de == null ? void 0 : de.itemId }) : null,
        o && de && I ? /* @__PURE__ */ m(
          su,
          {
            target: de,
            page: { width: t, height: H },
            edit: I,
            showSource: !!(v != null && v.editShowsSource),
            regions: v == null ? void 0 : v.regions,
            jumpToBlock: v == null ? void 0 : v.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (b != null && b.size) ? /* @__PURE__ */ m("div", { className: "reader-revised-markers", "aria-hidden": "true", children: te.filter((z) => b.has(z.itemId)).map((z) => /* @__PURE__ */ m(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": z.itemId,
            style: { left: z.rect.left, top: z.rect.top, height: z.rect.height }
          },
          z.itemId
        )) }) : null,
        o && (v != null && v.ink) ? /* @__PURE__ */ m(
          ru,
          {
            page: e,
            pane: r === "translated" ? "translated" : v.compareVersion ? "compare" : "source",
            width: t,
            height: H,
            ink: v.ink
          }
        ) : null,
        /* @__PURE__ */ m(
          kc,
          {
            target: o && !((G = v == null ? void 0 : v.ink) != null && G.tool) && (Y == null ? void 0 : Y.itemId) !== (de == null ? void 0 : de.itemId) ? Y : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: Y && (b == null ? void 0 : b.get(Y.itemId)) || 0,
            onEdit: _,
            frameRect: he == null ? void 0 : he.rect,
            placement: he == null ? void 0 : he.placement,
            tailTop: he == null ? void 0 : he.tailTop
          }
        )
      ]
    }
  );
}
const Iu = en(Su);
function Ru(e, t) {
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
const Tu = 2 * 1024 * 1024;
function Pu(e) {
  const t = new wo.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const fn = 5, Eu = "120% 0px", ku = 120, Mu = "25% 0px";
let Cr = 1;
const xr = /* @__PURE__ */ new WeakMap();
function Nu(e) {
  if (!e) return 0;
  const t = xr.get(e);
  if (t) return t;
  const n = Cr;
  return Cr += 1, xr.set(e, n), n;
}
function Au() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const _u = co(
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
    onOutline: d,
    onLoadError: h,
    onNumPagesChange: g,
    activeRegion: p = null,
    regions: y = [],
    readerMetadata: w = null,
    hoveredRegionId: S = null,
    onHoverRegion: v,
    liveTranslation: b,
    showLiveTranslation: I = t === "source",
    liveTranslationPendingLabel: E = "",
    paneAction: _
  }, $) {
    Ql();
    const { file: F, loading: B, error: T } = Zs(n, r), R = `${n}\0${Nu(F)}`, P = N(R);
    P.current = R;
    const M = J(() => {
      const C = Ws(F);
      return C ? "ranged" in C ? { range: Pu(C.ranged) } : C : null;
    }, [F, n]), [A, j] = k(0), [O, H] = k(""), [ae, ee] = k(null), [te, pe] = k(480), ie = N(null), me = N(0), Le = J(() => Au(), []), Q = J(() => ({
      cMapUrl: _t().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: _t().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: Tu,
      disableAutoFetch: !0
    }), []);
    Cn($, () => ae, [ae]), D(() => {
      const C = (V) => {
        me.current = V, pe(V);
      }, W = (V) => {
        const le = yi(V, me.current);
        if (le !== "ignore") {
          if (ie.current && clearTimeout(ie.current), le === "immediate") {
            C(V);
            return;
          }
          ie.current = setTimeout(() => C(V), Ao);
        }
      }, K = !!(l && l >= 80);
      W(K ? l : (i == null ? void 0 : i.clientWidth) || 0);
      const ce = !K && i && typeof ResizeObserver < "u" ? new ResizeObserver((V) => {
        var le, ge;
        W(((ge = (le = V[0]) == null ? void 0 : le.contentRect) == null ? void 0 : ge.width) ?? i.clientWidth);
      }) : null;
      return ce && i && ce.observe(i), () => {
        ce == null || ce.disconnect(), ie.current && clearTimeout(ie.current);
      };
    }, [l, i, a]);
    const Y = J(
      () => pi(te, o),
      [te, o]
    ), [Se, de] = k(() => /* @__PURE__ */ new Map()), [he, $e] = k(() => /* @__PURE__ */ new Set()), [qe, De] = k(() => /* @__PURE__ */ new Set()), Me = N(/* @__PURE__ */ new Map()), G = N(null), z = N(null), [ne, re] = k(() => /* @__PURE__ */ new Set()), ue = N(/* @__PURE__ */ new Map()), oe = x((C, W) => {
      de((K) => {
        if (K.get(C) === W) return K;
        const q = new Map(K);
        return q.set(C, W), q;
      });
    }, []), Te = x((C, W) => {
      const K = Me.current, q = K.get(C), ce = [G.current, z.current];
      if (q)
        for (const V of ce)
          try {
            V == null || V.unobserve(q);
          } catch {
          }
      if (W) {
        K.set(C, W);
        for (const V of ce)
          try {
            V == null || V.observe(W);
          } catch {
          }
      } else
        K.delete(C);
    }, []), Ie = N(/* @__PURE__ */ new Map()), Ne = x((C) => {
      const W = Ie.current;
      let K = W.get(C);
      return K || (K = (q) => Te(C, q), W.set(C, K)), K;
    }, [Te]);
    D(() => {
      if (typeof IntersectionObserver > "u") return;
      const C = ue.current, W = new IntersectionObserver(
        (K) => {
          const q = [], ce = [];
          for (const V of K) {
            const le = V.target, ge = Zt(le);
            Number.isFinite(ge) && (V.isIntersecting ? q : ce).push(ge);
          }
          if ((q.length || ce.length) && $e((V) => {
            let le = null;
            for (const ge of q)
              V.has(ge) || (le = le || new Set(V), le.add(ge));
            for (const ge of ce)
              V.has(ge) && (le = le || new Set(V), le.delete(ge));
            return le || V;
          }), q.length) {
            for (const V of q) {
              const le = C.get(V);
              le && (clearTimeout(le), C.delete(V));
            }
            De((V) => {
              let le = null;
              for (const ge of q)
                V.has(ge) || (le = le || new Set(V), le.add(ge));
              return le || V;
            });
          }
          for (const V of ce)
            C.has(V) || C.set(V, setTimeout(() => {
              C.delete(V), De((le) => {
                if (!le.has(V)) return le;
                const ge = new Set(le);
                return ge.delete(V), ge;
              });
            }, ku));
        },
        { root: i, rootMargin: Eu, threshold: 0 }
      );
      G.current = W;
      for (const K of Me.current.values())
        try {
          W.observe(K);
        } catch {
        }
      return () => {
        W.disconnect(), G.current === W && (G.current = null);
        for (const K of C.values()) clearTimeout(K);
        C.clear();
      };
    }, [i]), D(() => {
      if (typeof IntersectionObserver > "u") return;
      const C = new IntersectionObserver(
        (W) => {
          re((K) => {
            let q = null;
            for (const ce of W) {
              const V = Zt(ce.target);
              !Number.isFinite(V) || ce.isIntersecting === K.has(V) || (q = q || new Set(K), ce.isIntersecting ? q.add(V) : q.delete(V));
            }
            return q || K;
          });
        },
        { root: i, rootMargin: Mu, threshold: 0 }
      );
      z.current = C;
      for (const W of Me.current.values())
        try {
          C.observe(W);
        } catch {
        }
      return () => {
        C.disconnect(), z.current === C && (z.current = null);
      };
    }, [i]);
    const be = !!i && typeof IntersectionObserver < "u";
    Re(() => {
      j(0), H(""), $e(/* @__PURE__ */ new Set()), De(/* @__PURE__ */ new Set()), de(/* @__PURE__ */ new Map()), Me.current.clear();
      const C = ue.current;
      for (const W of C.values()) clearTimeout(W);
      C.clear(), g == null || g(0, t);
    }, [R, g, t]);
    const Fe = x(
      (C) => {
        if (P.current !== R) return;
        const W = C.numPages;
        j(W), H(""), g == null || g(W, t), f == null || f({ numPages: W, pane: t }), d && typeof C.getOutline == "function" && Zl(C).then((K) => {
          P.current === R && d(K, t);
        }, () => {
        });
      },
      [R, f, d, g, t]
    ), rt = x(
      (C) => {
        if (P.current !== R) return;
        const W = (C == null ? void 0 : C.message) || "PDF 解析失败";
        H(W), j(0), g == null || g(0, t), h == null || h(C, t);
      },
      [R, h, g, t]
    ), Pe = J(
      () => A > 0 ? Array.from({ length: A }, (C, W) => W + 1) : [],
      [A]
    );
    D(() => {
      typeof IntersectionObserver < "u" || De(new Set(Pe));
    }, [Pe]);
    const Ce = J(
      () => cr(p, w, t),
      [p, w, t]
    ), Ge = J(() => {
      const C = /* @__PURE__ */ new Map();
      for (const W of y) {
        const K = cr(W, w, t);
        if (!K) continue;
        const q = C.get(K.box.page) || [];
        q.push(K), C.set(K.box.page, q);
      }
      return C;
    }, [t, w, y]), ft = J(() => {
      const C = /* @__PURE__ */ new Set();
      if (!S) return C;
      for (const [W, K] of Ge)
        K.some((q) => q.itemId === S) && C.add(W);
      return C;
    }, [S, Ge]), Be = J(() => {
      if (A === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Pe);
      if (he.size === 0) {
        const K = Math.min(A, fn * 2 + 1);
        return new Set(Array.from({ length: K }, (q, ce) => ce + 1));
      }
      const W = /* @__PURE__ */ new Set();
      for (const K of he)
        for (let q = -fn; q <= fn; q++) {
          const ce = K + q;
          ce >= 1 && ce <= A && W.add(ce);
        }
      return W;
    }, [A, Pe, i, a, he]), U = !n || !!T || !!O, Z = n && (T || O) || s;
    return /* @__PURE__ */ L(
      "section",
      {
        ref: ee,
        className: `reader-panel ${tn}${a ? "" : " is-hidden"}`,
        [we]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (b == null ? void 0 : b.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          _ ? /* @__PURE__ */ m("div", { className: "reader-react-pdf-pane-action", children: _ }) : null,
          E ? /* @__PURE__ */ L("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ m("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ m("span", { children: E })
          ] }) : null,
          U && !B ? /* @__PURE__ */ m("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Z }) : null,
          B ? /* @__PURE__ */ m("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          M && !T ? /* @__PURE__ */ m("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ m(
            fs,
            {
              file: M,
              loading: null,
              error: null,
              options: Q,
              onLoadSuccess: Fe,
              onLoadError: rt,
              className: "reader-react-pdf-document",
              children: Pe.map((C) => {
                if (Be.has(C))
                  return /* @__PURE__ */ m(
                    Iu,
                    {
                      pane: t,
                      pageNumber: C,
                      width: Y,
                      devicePixelRatio: Le,
                      active: qe.has(C),
                      textLayer: !be || ne.has(C),
                      syncedMinHeight: (c == null ? void 0 : c.get(C)) || 0,
                      onMetrics: u,
                      cachedAspect: Se.get(C),
                      onAspectChange: oe,
                      sentinelRef: Ne(C),
                      regionHighlight: (Ce == null ? void 0 : Ce.box.page) === C ? Ce : null,
                      regionTargets: Ge.get(C),
                      hoveredRegionId: S && ft.has(C) ? S : null,
                      onHoverRegion: v,
                      liveTranslationLayout: b == null ? void 0 : b.layoutByPage.get(C - 1),
                      liveTranslationPage: b == null ? void 0 : b.pagesByPage.get(C - 1),
                      showLiveTranslation: I,
                      liveTranslationMissing: wl(b, C - 1)
                    },
                    `${t}-${C}`
                  );
                const K = Se.get(C) ?? Qo, q = Math.max(120, Math.floor(Y * K)), ce = Math.max(q, Math.ceil((c == null ? void 0 : c.get(C)) || 0));
                return /* @__PURE__ */ m(
                  "div",
                  {
                    ref: Ne(C),
                    [ke]: C,
                    [we]: t,
                    [zn]: q,
                    className: `${$n} is-placeholder`,
                    style: {
                      width: Y,
                      height: ce,
                      minHeight: ce
                    },
                    children: /* @__PURE__ */ m(
                      "div",
                      {
                        className: qt,
                        style: { width: Y, height: q },
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
), Or = en(_u), Lu = 2e3, Du = 6, Cu = 500, zr = "reader-react-resizing";
function xu(e, t) {
  const n = N(null), r = N(null);
  Re(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const b = Ou(e), I = Wt(e, b);
      if (!I) return;
      s = { pane: b, progress: I, started: performance.now() };
    }
    const { pane: i, progress: l, started: c } = s;
    let u = 0, f = null, d = e.scrollHeight, h = d, g = 0, p = c;
    const y = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((b) => {
      let I = !1;
      for (const E of b) {
        const _ = Math.round(E.contentRect.height);
        y.has(E.target) && y.get(E.target) !== _ && (I = !0), y.set(E.target, _);
      }
      I && Dt(e, l, "auto", i);
    }), S = () => {
      var b;
      f && clearTimeout(f), cancelAnimationFrame(u), w == null || w.disconnect(), e.classList.remove(zr);
      for (const I of $r) e.removeEventListener(I, S);
      ((b = r.current) == null ? void 0 : b.stop) === S && (r.current = null);
    }, v = () => {
      Dt(e, l, "auto", i);
      const b = e.scrollHeight;
      g = b === h ? g + 1 : 0, h = b;
      const I = performance.now() - p;
      g >= Du && (b !== d || I > Cu) || I > Lu ? S() : u = requestAnimationFrame(v);
    };
    for (const b of $r) e.addEventListener(b, S, { passive: !0 });
    for (const b of Array.from(e.children)) w == null || w.observe(b);
    e.classList.add(zr), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, p = performance.now(), d = e.scrollHeight, h = d, g = 0, u = requestAnimationFrame(v);
    }, Ao);
  }, [e, t]), D(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Ou(e) {
  for (const t of Array.from(e.querySelectorAll(`[${ke}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(we) || null;
  }
  return null;
}
const $r = ["wheel", "touchstart", "keydown", "pointerdown"];
function zu(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function $u(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(tn)) && ((n = e.hasAttribute) != null && n.call(e, we)));
}
function Fu(e, t) {
  D(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!$u(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${tn}[${we}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const l = zu(a, i);
        if (l === null || Math.abs(i.scrollLeft - l) < 1) continue;
        const c = i.scrollLeft;
        i.scrollLeft = l, Math.abs(i.scrollLeft - c) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Bu(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), l = t - i, c = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: l * c };
}
function ju(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const Fr = 12;
function Hn(e) {
  return Array.from(e.querySelectorAll(`.${tn}[${we}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function Uu(e) {
  const t = e.getBoundingClientRect();
  return Hn(e).map((n) => {
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
function Hu(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Wu(e, t) {
  return e ? Hn(e).find((n) => n.getAttribute(we) === t) ?? null : null;
}
function Ku({ shellEl: e }) {
  const [t, n] = k([]), r = N(0), o = x(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = Uu(e);
      n((i) => Hu(i, s) ? i : s);
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
        for (const f of Hn(e))
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
  return a.length ? /* @__PURE__ */ m("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ m(Vu, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Vu({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - Fr * 2), r = Bu(e, n), o = N(null);
  if (!r) return null;
  const a = (d) => {
    const h = Wu(t, e.pane);
    h && (h.scrollLeft = d);
  }, s = (d) => {
    var h, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (h = d.currentTarget).setPointerCapture) == null || g.call(h, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const h = o.current;
    !h || h.pointerId !== d.pointerId || a(h.startScroll + ju(e, n, r.size, d.clientX - h.startX));
  }, l = (d) => {
    var h, g, p;
    ((h = o.current) == null ? void 0 : h.pointerId) === d.pointerId && (o.current = null, (p = (g = d.currentTarget).releasePointerCapture) == null || p.call(g, d.pointerId));
  }, c = (d) => {
    if (d.button !== 0 || d.target !== d.currentTarget) return;
    d.preventDefault();
    const h = d.currentTarget.getBoundingClientRect(), g = d.clientX - h.left, p = e.width * 0.8;
    a(e.scrollLeft + (g < r.offset ? -p : p));
  }, u = e.pane === "translated" ? "译文栏左右滚动" : "原文栏左右滚动", f = Math.max(0, e.scrollWidth - e.width);
  return /* @__PURE__ */ m(
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
      style: { left: e.left + Fr, width: n },
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
function ea(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Ju(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function qu({ compare: e, onDone: t }) {
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
            /* @__PURE__ */ m("span", { className: "reader-version-compare-time", children: ea(n.createdAt) }),
            r ? /* @__PURE__ */ m("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ m(ho, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ m(Ka, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
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
            /* @__PURE__ */ m(Va, { size: 13, "aria-hidden": !0 }),
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
            /* @__PURE__ */ m(Ja, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function Br({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Ju(t), a = [e === "compare" ? "对比" : "正在读", r, ea(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ L("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ m("em", { children: "RetainPDF" }),
    /* @__PURE__ */ m("strong", { children: o }),
    /* @__PURE__ */ m("span", { children: a })
  ] });
}
function Gu({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = k({ source: null, translated: null });
  return Re(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), l = (c) => {
        const u = e.querySelector(`[${we}="${c}"]`), f = u == null ? void 0 : u.getBoundingClientRect();
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
    r.source ? /* @__PURE__ */ m("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ m(Br, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ m("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ m(Br, { role: "reading", ...n }) }) : null
  ] });
}
const Zu = () => () => {
}, jr = () => null;
function Yu({
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
function Xu(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Qu(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function ed(e) {
  const t = Je(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", l = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, c = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, h = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? $t, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, p = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, v = (t == null ? void 0 : t.compareVersion) ?? null, b = (v == null ? void 0 : v.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", I = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", E = v ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, _ = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, $ = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), F = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), B = t == null ? void 0 : t.onPdfOutline, T = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), R = e.regions ?? (t == null ? void 0 : t.regions) ?? [], P = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), M = (t == null ? void 0 : t.regionHover) ?? null, [A, j] = k(null), O = uo(
    M ? M.subscribe : Zu,
    M ? () => M.get().itemId : jr,
    M ? () => M.get().itemId : jr
  ), H = M ? O : A, ae = x((ie) => {
    M ? M.set(ie, "pdf") : j(ie);
  }, [M]), ee = Yu({
    mode: s,
    compareMode: i,
    showSource: l,
    showTranslated: c,
    markdownSplit: n,
    overlayOnSource: u
  }), pe = Number.isFinite(g) && g > 0 ? Xu(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return xu(d, pe), Fu(d, ee.compareMode), /* @__PURE__ */ L(
    "div",
    {
      ref: f,
      className: To,
      "data-reader-region-count": R.length,
      "data-reader-structured-region-count": R.filter(za).length,
      "data-reader-metadata-ready": P ? "true" : "false",
      children: [
        /* @__PURE__ */ L(
          "main",
          {
            className: `${Ro} reader-mode-${ee.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ m(
                Or,
                {
                  pane: "source",
                  url: b,
                  preloadedFile: E,
                  userZoom: h,
                  visible: ee.showSource,
                  scrollRoot: d,
                  pageWidthOverride: pe,
                  rowHeights: ee.compareMode ? p : void 0,
                  onMetrics: $,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: F,
                  onOutline: v ? void 0 : B,
                  activeRegion: T,
                  regions: (v == null ? void 0 : v.regions) ?? R,
                  readerMetadata: P,
                  hoveredRegionId: H,
                  onHoverRegion: ae,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? Qu(o) : "",
                  paneAction: u && ee.showTranslated ? /* @__PURE__ */ L(ct, { children: [
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
                v ? `compare:${v.url}` : "source"
              ) : null,
              w ? /* @__PURE__ */ m(
                Or,
                {
                  pane: "translated",
                  url: I,
                  preloadedFile: _,
                  userZoom: h,
                  visible: ee.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: pe,
                  rowHeights: ee.compareMode ? p : void 0,
                  onMetrics: $,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: F,
                  onOutline: B,
                  activeRegion: T,
                  regions: R,
                  readerMetadata: P,
                  hoveredRegionId: H,
                  onHoverRegion: ae,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ m(Ku, { shellEl: d }),
        v ? /* @__PURE__ */ m(Gu, { shellEl: d, left: v.left, right: v.right }) : null
      ]
    }
  );
}
const td = [
  { id: "source", label: "原文", Icon: go },
  { id: "compare", label: "对照", Icon: bo },
  { id: "translated", label: "译文", Icon: yo }
];
function nd(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function rd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function od(e) {
  const t = Je(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, l = a ? nd(a.state) : "";
  return /* @__PURE__ */ L("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ m("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ m("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ L("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ m("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: td.map(({ id: c, label: u, Icon: f }) => {
        const d = n === c, h = rd({
          id: c,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ L(
          "button",
          {
            type: "button",
            className: `reader-workspace-tab${d ? " is-active" : ""}`,
            role: "tab",
            "aria-selected": d,
            "aria-label": u,
            title: h ? `${u} 需要文档任务` : u,
            disabled: h,
            onClick: () => o(c),
            children: [
              /* @__PURE__ */ m(f, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ m("span", { className: "reader-workspace-tab-label", children: u })
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
              /* @__PURE__ */ m(qa, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
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
              /* @__PURE__ */ m(Ga, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
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
            /* @__PURE__ */ m(Za, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ m("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const ad = co(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
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
}), sd = ad, id = {
  markdown: { label: "Markdown", short: "MD", Icon: sd, needsJob: !0 }
}, ld = _o.map(
  (e) => ({ id: e, ...id[e] })
);
function ta() {
  return ld.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function cd(e) {
  const t = Je(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ m(ct, { children: ta().map(({ id: s, label: i, Icon: l, needsJob: c }) => {
    const u = n === s, f = c && r, d = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ L(
      "button",
      {
        type: "button",
        className: "reader-panel-toggle",
        "aria-label": d,
        "aria-pressed": u,
        title: f ? `${i} 需打开任务阅读` : i,
        disabled: f,
        onClick: () => u ? a() : o(s),
        children: [
          /* @__PURE__ */ m(l, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
          /* @__PURE__ */ m("span", { className: "reader-panel-toggle-label", "aria-hidden": "true", children: i })
        ]
      },
      s
    );
  }) });
}
function ud(e) {
  const t = Je(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = ta().map(({ id: l, label: c, short: u, Icon: f, needsJob: d }) => ({
    key: l,
    label: c,
    short: u,
    Icon: f,
    disabled: d && o,
    selected: n === l,
    badge: r == null ? void 0 : r[l],
    onClick: () => a(l)
  }));
  return n ? /* @__PURE__ */ L("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ m("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: l, label: c, Icon: u, disabled: f, selected: d, badge: h, onClick: g }) => /* @__PURE__ */ L(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": d,
        className: `reader-assistant-dock-tab${d ? " is-active" : ""}`,
        title: f ? `${c} 需打开任务阅读` : c,
        disabled: f,
        onClick: g,
        children: [
          /* @__PURE__ */ m(u, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ m("span", { className: "reader-assistant-dock-tab-label", children: c }),
          h ? /* @__PURE__ */ m("span", { className: "reader-assistant-dock-badge", children: h }) : null
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
        children: /* @__PURE__ */ m(St, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function dd(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function fd(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function md(e) {
  return e / 100 * window.innerHeight;
}
function hd(e) {
  return e / 100 * window.innerWidth;
}
function pd(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function Mt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = pd(n);
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
      r = fd(t, o);
      break;
    }
    case "em": {
      r = dd(t, o);
      break;
    }
    case "vh": {
      r = md(o);
      break;
    }
    case "vw": {
      r = hd(o);
      break;
    }
  }
  return r;
}
function ve(e) {
  return parseFloat(e.toFixed(3));
}
function vt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function kn(e) {
  const { panels: t } = e, n = vt({ group: e });
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
      const u = Mt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = ve(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = Mt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = ve(u / n * 100);
    }
    let l = 0;
    if (a.minSize !== void 0) {
      const u = Mt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      l = ve(u / n * 100);
    }
    let c = 100;
    if (a.maxSize !== void 0) {
      const u = Mt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      c = ve(u / n * 100);
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
function se(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Mn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? gd : bd
  );
}
function gd(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function bd(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function na(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function ra(e, t) {
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
function yd({
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
    const { x: i, y: l } = ra(r, s), c = e === "horizontal" ? i : l;
    c < a && (a = c, o = s);
  }
  return se(o, "No rect found"), o;
}
let Ut;
function vd() {
  return Ut === void 0 && (typeof matchMedia == "function" ? Ut = !!matchMedia("(pointer:coarse)").matches : Ut = !1), Ut;
}
function oa(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Mn(
    n,
    Array.from(t.children).filter(na).map((g) => ({ element: g }))
  ).map(({ element: g }) => g), s = [];
  let i = !1, l = !1, c = -1, u = -1, f = 0, d, h = [];
  {
    let g = -1;
    for (const p of a)
      p.hasAttribute("data-panel") && (g++, p.hasAttribute("data-disabled") || (f++, c === -1 && (c = g), u = g));
  }
  if (f > 1) {
    let g = -1;
    for (const p of a)
      if (p.hasAttribute("data-panel")) {
        g++;
        const y = r.find(
          (w) => w.element === p
        );
        if (y) {
          if (d) {
            const w = d.element.getBoundingClientRect(), S = p.getBoundingClientRect();
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
              switch (h.length) {
                case 0: {
                  v = [
                    b,
                    I
                  ];
                  break;
                }
                case 1: {
                  const E = h[0], _ = yd({
                    orientation: n,
                    rects: [w, S],
                    targetRect: E.element.getBoundingClientRect()
                  });
                  v = [
                    E,
                    _ === w ? I : b
                  ];
                  break;
                }
                default: {
                  v = h;
                  break;
                }
              }
            } else
              h.length ? v = h : v = [
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
              const E = vd() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (I.width < E) {
                const $ = E - I.width;
                I = new DOMRect(
                  I.x - $ / 2,
                  I.y,
                  I.width + $,
                  I.height
                );
              }
              if (I.height < E) {
                const $ = E - I.height;
                I = new DOMRect(
                  I.x,
                  I.y - $ / 2,
                  I.width,
                  I.height + $
                );
              }
              const _ = g <= c || g > u;
              !i && !_ && s.push({
                group: e,
                groupSize: vt({ group: e }),
                panels: [d, y],
                separator: "width" in b ? void 0 : b,
                rect: I
              }), i = !1;
            }
          }
          l = !1, d = y, h = [];
        }
      } else if (p.hasAttribute("data-separator")) {
        p.ariaDisabled !== null && (i = !0);
        const y = o.find(
          (w) => w.element === p
        );
        y ? h.push(y) : (d = void 0, h = []);
      } else
        l = !0;
  }
  return s;
}
var Ye;
class aa {
  constructor() {
    sr(this, Ye, {});
  }
  addListener(t, n) {
    const r = It(this, Ye)[t];
    return r === void 0 ? It(this, Ye)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = It(this, Ye)[t];
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
    ir(this, Ye, {});
  }
  removeListener(t, n) {
    const r = It(this, Ye)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Ye = new WeakMap();
let bt = {
  cursorFlags: 0,
  state: "inactive"
};
const Wn = new aa();
function st() {
  return bt;
}
function wd(e) {
  return Wn.addListener("change", e);
}
function Sd(e) {
  const t = bt, n = { ...bt };
  n.cursorFlags = e, bt = n, Wn.emit("change", {
    prev: t,
    next: n
  });
}
function yt(e) {
  const t = bt;
  bt = e, Wn.emit("change", {
    prev: t,
    next: e
  });
}
const Id = (e) => e, mn = () => {
}, sa = 1, ia = 2, la = 4, ca = 8, Ur = 3, Hr = 12;
let Ht;
function Wr() {
  return Ht === void 0 && (Ht = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (Ht = !0)), Ht;
}
function Rd({
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
        if (e && Wr()) {
          const a = (e & sa) !== 0, s = (e & ia) !== 0, i = (e & la) !== 0, l = (e & ca) !== 0;
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
    return Wr() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Kr = /* @__PURE__ */ new WeakMap();
function Kn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Kr.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = st();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Rd({
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
  Kr.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Oe = /* @__PURE__ */ new Map();
const ua = new aa();
function Td(e) {
  Oe = new Map(Oe), Oe.delete(e);
}
function Vr(e, t) {
  for (const [n] of Oe)
    if (n.id === e)
      return n;
}
function et(e, t) {
  for (const [n, r] of Oe)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function ut() {
  return Oe;
}
function Vn(e, t) {
  return ua.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ve(e, t, n) {
  const r = Oe.get(e);
  Oe = new Map(Oe), Oe.set(e, t), ua.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function da(e) {
  const t = st();
  let n = !1;
  switch (t.state) {
    case "active":
      yt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Kn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = et(r.group.id, !0);
        Ve(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Jr(e) {
  e.defaultPrevented || da(e.currentTarget);
}
function Pd(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = ra(n, a.rect);
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
function Ed(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function kd(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Zr(e),
    b: Zr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  se(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: Gr(qr(n.a)),
    b: Gr(qr(n.b))
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
const Md = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Nd(e) {
  const t = getComputedStyle(fa(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Ad(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Nd(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Md.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function qr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (se(n, "Missing node"), Ad(n)) return n;
  }
  return null;
}
function Gr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Zr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = fa(e);
  return t;
}
function fa(e) {
  const { parentNode: t } = e;
  return Ed(t) ? t.host : t;
}
function _d(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Ld({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!na(n) || n.contains(e) || e.contains(n))
    return !0;
  if (kd(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (_d(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function Jn(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = oa(o), s = Pd(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Ld({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Dd(e, t) {
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
function xe(e, t) {
  return ye(e, t) ? 0 : e > t ? 1 : -1;
}
function gt({
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
  if (xe(r, l) < 0)
    if (a) {
      const c = (o + l) / 2;
      xe(r, c) < 0 ? r = o : r = l;
    } else
      r = l;
  return r = Math.min(i, r), r = ve(r), r;
}
function Ct({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (ye(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), l = Object.values(o), c = [...i], [u, f] = r;
  se(u != null, "Invalid first pivot index"), se(f != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const p = e < 0 ? f : u, y = n[p];
        se(
          y,
          `Panel constraints not found for index ${p}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: S,
          minSize: v = 0
        } = y;
        if (S) {
          const b = i[p];
          if (se(
            b != null,
            `Previous layout not found for panel index ${p}`
          ), ye(b, w)) {
            const I = v - b;
            xe(I, Math.abs(e)) > 0 && (e = e < 0 ? 0 - I : I);
          }
        }
      }
      {
        const p = e < 0 ? u : f, y = n[p];
        se(
          y,
          `No panel constraints found for index ${p}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: S,
          minSize: v = 0
        } = y;
        if (S) {
          const b = i[p];
          if (se(
            b != null,
            `Previous layout not found for panel index ${p}`
          ), ye(b, v)) {
            const I = b - w;
            xe(I, Math.abs(e)) > 0 && (e = e < 0 ? 0 - I : I);
          }
        }
      }
      break;
    }
    default: {
      const p = e < 0 ? f : u, y = n[p];
      se(
        y,
        `Panel constraints not found for index ${p}`
      );
      const w = i[p], { collapsible: S, collapsedSize: v, minSize: b } = y;
      if (S && xe(w, b) < 0)
        if (e > 0) {
          const I = b - v, E = I / 2, _ = w + e;
          xe(_, b) < 0 && (e = xe(e, E) <= 0 ? 0 : I);
        } else {
          const I = b - v, E = 100 - I / 2, _ = w - e;
          xe(_, b) < 0 && (e = xe(100 + e, E) > 0 ? 0 : -I);
        }
      break;
    }
  }
  {
    const p = e < 0 ? 1 : -1;
    let y = e < 0 ? f : u, w = 0;
    for (; ; ) {
      const v = i[y];
      se(
        v != null,
        `Previous layout not found for panel index ${y}`
      );
      const b = gt({
        overrideDisabledPanels: s,
        panelConstraints: n[y],
        prevSize: v,
        size: 100
      }) - v;
      if (w += b, y += p, y < 0 || y >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(w));
    e = e < 0 ? 0 - S : S;
  }
  {
    let p = e < 0 ? u : f;
    for (; p >= 0 && p < n.length; ) {
      const y = Math.abs(e) - Math.abs(d), w = i[p];
      se(
        w != null,
        `Previous layout not found for panel index ${p}`
      );
      const S = w - y, v = gt({
        overrideDisabledPanels: s,
        panelConstraints: n[p],
        prevSize: w,
        size: S
      });
      if (!ye(w, v) && (d += w - v, c[p] = v, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? p-- : p++;
    }
  }
  if (Dd(l, c))
    return o;
  {
    const p = e < 0 ? f : u, y = i[p];
    se(
      y != null,
      `Previous layout not found for panel index ${p}`
    );
    const w = y + d, S = gt({
      overrideDisabledPanels: s,
      panelConstraints: n[p],
      prevSize: y,
      size: w
    });
    if (c[p] = S, !ye(S, w)) {
      let v = w - S, b = e < 0 ? f : u;
      for (; b >= 0 && b < n.length; ) {
        const I = c[b];
        se(
          I != null,
          `Previous layout not found for panel index ${b}`
        );
        const E = I + v, _ = gt({
          overrideDisabledPanels: s,
          panelConstraints: n[b],
          prevSize: I,
          size: E
        });
        if (ye(I, _) || (v -= _ - I, c[b] = _), ye(v, 0))
          break;
        e > 0 ? b-- : b++;
      }
    }
  }
  const h = Object.values(c).reduce(
    (p, y) => y + p,
    0
  );
  if (!ye(h, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return c.reduce((p, y, w) => (p[g[w]] = y, p), {});
}
function it(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || xe(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function lt({
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
      se(l != null, `No layout data found for index ${i}`);
      const c = 100 / o * l;
      r[i] = c;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const l = n[i];
    se(l != null, `No layout data found for index ${i}`);
    const c = r[i];
    se(c != null, `No layout data found for index ${i}`);
    const u = gt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: l,
      size: c
    });
    c != u && (a += c - u, r[i] = u);
  }
  if (!ye(a, 0))
    for (let i = 0; i < t.length; i++) {
      const l = r[i];
      se(l != null, `No layout data found for index ${i}`);
      const c = l + a, u = gt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: l,
        size: c
      });
      if (l !== u && (a -= u - l, r[i] = u, ye(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, l, c) => (i[s[c]] = l, i), {});
}
function ma({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const l = ut();
    for (const [
      c,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: f,
        layout: d,
        groupSize: h,
        separatorToPanels: g
      }
    ] of l)
      if (c.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: f,
          group: c,
          groupSize: h,
          layout: d,
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
    prevLayout: u,
    derivedPanelConstraints: f
  }) => {
    const d = a(), h = c.findIndex((y) => y.id === t), g = h === 0, p = h === c.length - 1;
    if (p && l < d && (g || c.slice(0, h).every((y, w) => {
      const S = f[w];
      return (S == null ? void 0 : S.collapsible) && ye(S.collapsedSize, u[S.panelId]);
    }))) {
      const y = c.slice(0, h).reduce((w, S) => w + u[S.id], 0);
      return {
        ...u,
        [t]: ve(100 - y)
      };
    }
    return Ct({
      delta: p ? d - l : l - d,
      initialLayout: u,
      panelConstraints: f,
      pivotIndices: p ? [h - 1, h] : [h, h + 1],
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
      group: d,
      groupSize: h,
      layout: g,
      separatorToPanels: p
    } = n(), y = s({
      nextSize: l,
      panels: d.panels,
      prevLayout: g,
      derivedPanelConstraints: f
    }), w = lt({
      layout: y,
      panelConstraints: f
    });
    it(g, w) || Ve(d, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: f,
      groupSize: h,
      layout: w,
      separatorToPanels: p
    });
  };
  return {
    collapse: () => {
      const { collapsible: l, collapsedSize: c } = r(), { mutableValues: u } = o(), f = a();
      l && f !== c && (u.expandToSize = f, i(c));
    },
    expand: () => {
      const { collapsible: l, collapsedSize: c, minSize: u } = r(), { mutableValues: f } = o(), d = a();
      if (l && d === c) {
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
      return l && ye(c, u);
    },
    resize: (l) => {
      const { group: c } = n(), { element: u } = o(), f = vt({ group: c }), d = Mt({
        groupSize: f,
        panelElement: u,
        styleProp: l
      }), h = ve(d / f * 100);
      i(h);
    }
  };
}
function Yr(e) {
  if (e.defaultPrevented)
    return;
  const t = ut();
  Jn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = ma({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function Kt(e) {
  const t = ut();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function ha({
  groupId: e
}) {
  const t = () => {
    const n = ut();
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
      } = t(), c = lt({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (it(i, c) || Ve(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: c,
        separatorToPanels: l
      }), c);
    }
  };
}
function ot(e, t) {
  const n = Kt(e), r = et(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  se(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  se(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = ha({ groupId: n.id }).getLayout(), l = Ct({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), c = lt({
    layout: l,
    panelConstraints: r.derivedPanelConstraints
  });
  it(i, c) || Ve(
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
function Xr(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = Kt(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && ot(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && ot(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && ot(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && ot(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), ot(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = Kt(t), o = et(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, l = r.separators.find(
          (d) => d.element === t
        );
        se(l, "Matching separator not found");
        const c = i.get(l);
        se(c, "Matching panels not found");
        const u = c[0], f = a.find(
          (d) => d.panelId === u.id
        );
        if (se(f, "Panel metadata not found"), f.collapsible) {
          const d = s[u.id], h = f.collapsedSize === d ? r.mutableState.expandedPanelSizes[u.id] ?? f.minSize : f.collapsedSize;
          ot(t, h - d);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = Kt(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        se(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), ot(t, -100);
        break;
      }
    }
}
function Qr(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = ut(), n = Jn(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), yt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function pa({
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
    const { group: u, groupSize: f } = c, { orientation: d, panels: h } = u, { disableCursor: g } = u.mutableState;
    let p = 0;
    a ? d === "horizontal" ? p = (t.clientX - a.x) / f * 100 : p = (t.clientY - a.y) / f * 100 : d === "horizontal" ? p = t.clientX < 0 ? -100 : 100 : p = t.clientY < 0 ? -100 : 100;
    const y = r.get(u), w = o.get(u);
    if (!y || !w)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: v,
      groupSize: b,
      layout: I,
      separatorToPanels: E
    } = w;
    if (v && I && E) {
      const _ = Ct({
        delta: p,
        initialLayout: y,
        panelConstraints: v,
        pivotIndices: c.panels.map(($) => h.indexOf($)),
        prevLayout: I,
        trigger: "mouse-or-touch"
      });
      if (it(_, I)) {
        if (p !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= p < 0 ? sa : ia;
              break;
            }
            case "vertical": {
              i |= p < 0 ? la : ca;
              break;
            }
          }
      } else
        Ve(c.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: v,
          groupSize: b,
          layout: _,
          separatorToPanels: E
        });
    }
  });
  let l = 0;
  t.movementX === 0 ? l |= s & Ur : l |= i & Ur, t.movementY === 0 ? l |= s & Hr : l |= i & Hr, Sd(l), Kn(e);
}
function eo(e) {
  const t = ut(), n = st();
  switch (n.state) {
    case "active":
      pa({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function to(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = st(), n = ut();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        yt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = et(a.group.id, !0);
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
      pa({
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
      const a = Jn(e, n);
      a.length === 0 ? t.state !== "inactive" && yt({
        cursorFlags: 0,
        state: "inactive"
      }) : yt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Kn(e.currentTarget);
      break;
    }
  }
}
function no(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (st().state) {
      case "hover":
        yt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function ro(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || da(e.currentTarget) && e.preventDefault();
}
function oo(e) {
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
function Cd(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((l) => l.element === t);
  if (!r || !r.onResize)
    return;
  const o = vt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: ve(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function xd(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Od({
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
    const d = r[f.id] ?? 0;
    switch (f.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const h = d / 100 * n, g = ve(
          h / t * 100
        );
        i.set(f.id, g), o += g;
        break;
      }
      case "preserve-relative-size":
      default: {
        l.push(f.id), a += d;
        break;
      }
    }
  }
  if (!s || l.length === 0)
    return r;
  const c = 100 - o, u = { ...r };
  if (i.forEach((f, d) => {
    u[d] = f;
  }), a > 0)
    for (const f of l) {
      const d = r[f] ?? 0;
      u[f] = ve(
        d / a * c
      );
    }
  else {
    const f = ve(
      c / l.length
    );
    for (const d of l)
      u[d] = f;
  }
  return u;
}
function zd(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const mt = /* @__PURE__ */ new Map();
function $d(e) {
  let t = !0;
  se(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const p of g) {
      const { borderBoxSize: y, target: w } = p;
      if (w === e.element) {
        if (t) {
          const S = vt({ group: e });
          if (S === 0)
            return;
          const v = et(e.id);
          if (!v)
            return;
          const b = kn(e), I = v.defaultLayoutDeferred ? oo(b) : v.layout, E = Od({
            group: e,
            nextGroupSize: S,
            prevGroupSize: v.groupSize,
            prevLayout: I
          }), _ = lt({
            layout: E,
            panelConstraints: b
          });
          if (!v.defaultLayoutDeferred && it(v.layout, _) && xd(
            v.derivedPanelConstraints,
            b
          ) && v.groupSize === S)
            return;
          Ve(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: b,
            groupSize: S,
            layout: _,
            separatorToPanels: v.separatorToPanels
          });
        }
      } else
        Cd(e, w, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    se(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = vt({ group: e }), i = kn(e), l = e.panels.map(({ id: g }) => g).join(",");
  let c = e.mutableState.defaultLayout;
  c && (zd(e.panels, c) || (c = void 0));
  const u = e.mutableState.layouts[l] ?? c ?? oo(i), f = lt({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  mt.set(
    d,
    (mt.get(d) ?? 0) + 1
  );
  const h = /* @__PURE__ */ new Map();
  return oa(e).forEach((g) => {
    g.separator && h.set(g.separator, g.panels);
  }), Ve(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: h
  }), e.separators.forEach((g) => {
    se(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", Xr);
  }), mt.get(d) === 1 && (d.addEventListener("contextmenu", Jr, !0), d.addEventListener("dblclick", Yr, !0), d.addEventListener("pointerdown", Qr, !0), d.addEventListener("pointerleave", eo), d.addEventListener("pointermove", to), d.addEventListener("pointerout", no), d.addEventListener("pointerup", ro, !0)), function() {
    t = !1, mt.set(
      d,
      Math.max(0, (mt.get(d) ?? 0) - 1)
    ), Td(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Xr);
    }), mt.get(d) || (d.removeEventListener(
      "contextmenu",
      Jr,
      !0
    ), d.removeEventListener(
      "dblclick",
      Yr,
      !0
    ), d.removeEventListener(
      "pointerdown",
      Qr,
      !0
    ), d.removeEventListener("pointerleave", eo), d.removeEventListener("pointermove", to), d.removeEventListener("pointerout", no), d.removeEventListener("pointerup", ro, !0)), a.disconnect();
  };
}
function Fd() {
  const [e, t] = k({}), n = x(() => t({}), []);
  return [e, n];
}
function qn(e) {
  const t = fo();
  return `${e ?? t}`;
}
const dt = typeof window < "u" ? Re : D;
function Nt(e) {
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
function Gn(...e) {
  return Nt((t) => {
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
function Zn(e) {
  const t = N({ ...e });
  return dt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const ga = Ln(null);
function Bd(e, t) {
  const n = N({
    getLayout: () => ({}),
    setLayout: Id
  });
  Cn(t, () => n.current, []), dt(() => {
    Object.assign(
      n.current,
      ha({ groupId: e })
    );
  });
}
function ba({
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
  style: d,
  ...h
}) {
  const g = N({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), p = Nt((T) => {
    it(g.current.onLayoutChange, T) || (g.current.onLayoutChange = T, l == null || l(T));
  }), y = Nt(
    (T, R) => {
      it(g.current.onLayoutChanged, T) || (g.current.onLayoutChanged = T, c == null || c(T, { isUserInteraction: R }));
    }
  ), w = qn(i), S = N(null), [v, b] = Fd(), I = N({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), E = Gn(S, a);
  Bd(w, s);
  const _ = Nt(
    (T, R) => {
      const P = st(), M = Vr(T), A = et(T);
      if (A) {
        let j = !1;
        switch (P.state) {
          case "active": {
            j = P.hitRegions.some(
              (O) => O.group === M
            );
            break;
          }
        }
        return {
          flexGrow: A.layout[R] ?? 1,
          pointerEvents: j ? "none" : void 0
        };
      }
      if (n != null && n[R])
        return {
          flexGrow: n == null ? void 0 : n[R]
        };
    }
  ), $ = Zn({
    defaultLayout: n,
    disableCursor: r
  }), F = J(
    () => ({
      get disableCursor() {
        return !!$.disableCursor;
      },
      getPanelStyles: _,
      id: w,
      orientation: u,
      registerPanel: (T) => {
        const R = I.current;
        return R.panels = Mn(u, [
          ...R.panels,
          T
        ]), b(), () => {
          R.panels = R.panels.filter(
            (P) => P !== T
          ), b();
        };
      },
      registerSeparator: (T) => {
        const R = I.current;
        return R.separators = Mn(u, [
          ...R.separators,
          T
        ]), b(), () => {
          R.separators = R.separators.filter(
            (P) => P !== T
          ), b();
        };
      },
      updatePanelProps: (T, { disabled: R }) => {
        const P = I.current.panels.find(
          (j) => j.id === T
        );
        P && (P.panelConstraints.disabled = R);
        const M = Vr(w), A = et(w);
        M && A && Ve(M, {
          ...A,
          derivedPanelConstraints: kn(M)
        });
      },
      updateSeparatorProps: (T, {
        disabled: R,
        disableDoubleClick: P
      }) => {
        const M = I.current.separators.find(
          (A) => A.id === T
        );
        M && (M.disabled = R, M.disableDoubleClick = P);
      }
    }),
    [_, w, b, u, $]
  ), B = N(null);
  return dt(() => {
    const T = S.current;
    if (T === null)
      return;
    const R = I.current;
    let P;
    if ($.defaultLayout !== void 0 && Object.keys($.defaultLayout).length === R.panels.length) {
      P = {};
      for (const ee of R.panels) {
        const te = $.defaultLayout[ee.id];
        te !== void 0 && (P[ee.id] = te);
      }
    }
    const M = {
      disabled: !!o,
      element: T,
      id: w,
      mutableState: {
        defaultLayout: P,
        disableCursor: !!$.disableCursor,
        expandedPanelSizes: I.current.lastExpandedPanelSizes,
        layouts: I.current.layouts
      },
      orientation: u,
      panels: R.panels,
      resizeTargetMinimumSize: R.resizeTargetMinimumSize,
      separators: R.separators
    };
    B.current = M;
    const A = $d(M), { defaultLayoutDeferred: j, derivedPanelConstraints: O, layout: H } = et(M.id, !0);
    !j && O.length > 0 && (p(H), y(H, !1));
    const ae = Vn(w, (ee) => {
      const { defaultLayoutDeferred: te, derivedPanelConstraints: pe, layout: ie } = ee.next;
      if (te || pe.length === 0)
        return;
      const me = M.panels.map(({ id: Q }) => Q).join(",");
      M.mutableState.layouts[me] = ie, pe.forEach((Q) => {
        if (Q.collapsible) {
          const { layout: Y } = ee.prev ?? {};
          if (Y) {
            const Se = ye(
              Q.collapsedSize,
              ie[Q.panelId]
            ), de = ye(
              Q.collapsedSize,
              Y[Q.panelId]
            );
            Se && !de && (M.mutableState.expandedPanelSizes[Q.panelId] = Y[Q.panelId]);
          }
        }
      });
      const Le = st().state !== "active";
      p(ie), Le && y(ie, ee.isUserInteraction);
    });
    return () => {
      B.current = null, A(), ae();
    };
  }, [
    o,
    w,
    y,
    p,
    u,
    v,
    $
  ]), D(() => {
    const T = B.current;
    T && (T.mutableState.defaultLayout = n, T.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ m(ga.Provider, { value: F, children: /* @__PURE__ */ m(
    "div",
    {
      ...h,
      className: t,
      "data-group": !0,
      "data-testid": w,
      id: w,
      ref: E,
      style: {
        height: "100%",
        width: "100%",
        overflow: "hidden",
        ...d,
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
ba.displayName = "Group";
function Yn() {
  const e = Dn(ga);
  return se(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function jd(e, t) {
  const { id: n } = Yn(), r = N({
    collapse: mn,
    expand: mn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: mn
  });
  Cn(t, () => r.current, []), dt(() => {
    Object.assign(
      r.current,
      ma({ groupId: n, panelId: e })
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
  minSize: u = "0%",
  onResize: f,
  panelRef: d,
  style: h,
  ...g
}) {
  const p = !!l, y = qn(l), w = Zn({
    disabled: a
  }), S = N(null), v = Gn(S, s), {
    getPanelStyles: b,
    id: I,
    orientation: E,
    registerPanel: _,
    updatePanelProps: $
  } = Yn(), F = f !== null, B = Nt(
    (M, A, j) => {
      f == null || f(M, l, j);
    }
  );
  dt(() => {
    const M = S.current;
    if (M !== null) {
      const A = {
        element: M,
        id: y,
        idIsStable: p,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: F ? B : void 0,
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
      return _(A);
    }
  }, [
    i,
    n,
    r,
    o,
    F,
    y,
    p,
    c,
    u,
    B,
    _,
    w
  ]), D(() => {
    $(y, { disabled: a });
  }, [a, y, $]), jd(y, d);
  const T = () => {
    const M = b(I, y);
    if (M)
      return JSON.stringify(M);
  }, R = uo(
    (M) => Vn(I, M),
    T,
    T
  );
  let P;
  return R ? P = JSON.parse(R) : o !== void 0 ? P = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : P = { flexGrow: 1 }, /* @__PURE__ */ m(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": y,
      id: y,
      ref: v,
      style: {
        ...Ud,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...P
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
            ...h,
            // Inform the browser that the library is handling touch events for this element
            // but still allow users to scroll content within panels in the non-resizing direction
            // NOTE This is not an inherited style
            // See github.com/bvaughn/react-resizable-panels/issues/662
            touchAction: E === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
Nn.displayName = "Panel";
const Ud = {
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
function Hd({
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
    a = lt({
      layout: Ct({
        delta: c - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = lt({
      layout: Ct({
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
function ya({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const l = qn(a), c = Zn({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = k({}), [d, h] = k("inactive"), [g, p] = k(!1), y = N(null), w = Gn(y, o), {
    disableCursor: S,
    id: v,
    orientation: b,
    registerSeparator: I,
    updateSeparatorProps: E
  } = Yn(), _ = b === "horizontal" ? "vertical" : "horizontal";
  dt(() => {
    const B = y.current;
    if (B !== null) {
      const T = {
        disabled: c.disabled,
        disableDoubleClick: c.disableDoubleClick,
        element: B,
        id: l
      }, R = I(T), P = wd(
        (A) => {
          h(
            A.next.state !== "inactive" && A.next.hitRegions.some(
              (j) => j.separator === T
            ) ? A.next.state : "inactive"
          );
        }
      ), M = Vn(
        v,
        (A) => {
          const { derivedPanelConstraints: j, layout: O, separatorToPanels: H } = A.next, ae = H.get(T);
          if (ae) {
            const ee = ae[0], te = ae.indexOf(ee);
            f(
              Hd({
                layout: O,
                panelConstraints: j,
                panelId: ee.id,
                panelIndex: te
              })
            );
          }
        }
      );
      return () => {
        P(), M(), R();
      };
    }
  }, [v, l, I, c]), D(() => {
    E(l, { disabled: n, disableDoubleClick: r });
  }, [n, r, l, E]);
  let $;
  n && !S && ($ = "not-allowed");
  let F;
  if (n)
    F = "disabled";
  else
    switch (d) {
      case "active": {
        F = "active";
        break;
      }
      default:
        g ? F = "focus" : F = d;
    }
  return /* @__PURE__ */ m(
    "div",
    {
      ...i,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": _,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": F,
      "data-testid": l,
      id: l,
      onBlur: () => p(!1),
      onFocus: () => p(!0),
      ref: w,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: $,
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
ya.displayName = "Separator";
const Xn = 30, Qn = 65, xt = 50, Wd = 100 - Qn, Kd = 100 - Xn;
function Vd(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Qn, Math.max(Xn, t)) : xt;
}
function er(e) {
  return 100 - e;
}
function ht(e) {
  return `${e}%`;
}
const tr = "reader-document", Ot = "reader-assistant", va = "retainpdf.reader.ai-split-layout.v1", Jd = {
  [tr]: er(xt),
  [Ot]: xt
};
function nr(e) {
  const t = Vd(e == null ? void 0 : e[Ot]);
  return {
    [tr]: er(t),
    [Ot]: t
  };
}
function qd() {
  try {
    const e = JSON.parse(localStorage.getItem(va) || "null");
    return nr(e);
  } catch {
    return Jd;
  }
}
function Gd(e) {
  try {
    localStorage.setItem(va, JSON.stringify(nr(e)));
  } catch {
  }
}
function hn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = nr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Ot]}vw`
  );
}
function Zd() {
  const e = N(null), [t] = k(qd);
  Re(() => {
    const o = e.current;
    return hn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = x((o) => {
    hn(e.current, o);
  }, []), r = x((o, a) => {
    hn(e.current, o), a.isUserInteraction && Gd(o);
  }, []);
  return /* @__PURE__ */ L(
    ba,
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
          Nn,
          {
            id: tr,
            defaultSize: ht(er(xt)),
            minSize: ht(Wd),
            maxSize: ht(Kd)
          }
        ),
        /* @__PURE__ */ m(
          ya,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ m("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ m(
          Nn,
          {
            id: Ot,
            defaultSize: ht(xt),
            minSize: ht(Xn),
            maxSize: ht(Qn)
          }
        )
      ]
    }
  );
}
function Yd({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = k(!1);
  if (D(() => {
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
function Xd({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ m(Yd, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ L(ct, { children: [
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
function Qd(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function ef() {
  const [e, t] = k(!1), n = fo(), r = N(null);
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
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || Qd(a.target)) return;
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
        children: /* @__PURE__ */ m(Ya, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
          /* @__PURE__ */ m("div", { className: "reader-react-shortcuts-body", children: Dl.map((o) => /* @__PURE__ */ L("section", { className: "reader-react-shortcuts-group", children: [
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
const tf = ["source", "sideBySide", "translated"], nf = { source: "", translated: "", sideBySide: "" };
function rf(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = Vt(e.sourceUrl), n = Vt(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return Ps({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function of(e) {
  const [t, n] = k(() => /* @__PURE__ */ new Set()), r = J(
    () => e ? rf(e) : nf,
    [e]
  ), o = J(
    () => tf.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = x(async (s) => {
    if (!e) return;
    const i = Vt(r[s]);
    if (!(!i || t.has(s)))
      try {
        const l = e.jobId ? Ts(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Es(
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
        ks(c), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const af = {
  source: go,
  sideBySide: bo,
  translated: yo
}, sf = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function lf(e) {
  const t = Je(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = of(n), i = N(null);
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
  }, []), /* @__PURE__ */ L("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ L("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ m(Xa, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ m("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ m(po, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ m("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((l) => {
      const c = Na[l], u = Vt(r[l]), f = a.has(l), d = !!u && !f, h = d ? "" : Aa(l, r), g = af[l];
      return /* @__PURE__ */ L(
        "button",
        {
          type: "button",
          id: `reader-download-${l}`,
          className: `reader-download-action${f ? " is-busy" : ""}`,
          disabled: !d,
          "aria-label": d ? `下载${c.label}` : h,
          onClick: () => {
            i.current && (i.current.open = !1), s(l);
          },
          children: [
            /* @__PURE__ */ m(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ L("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ L("span", { className: "reader-download-action-label", children: [
                sf[l],
                " PDF"
              ] }),
              h ? /* @__PURE__ */ m("span", { className: "reader-download-action-reason", children: h }) : null
            ] })
          ]
        },
        l
      );
    }) })
  ] });
}
const cf = "retainpdf:reader:bookmarks:v1:", uf = 200;
function rr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function wa(e) {
  const t = `${e || ""}`.trim();
  return t ? `${cf}${t}` : "";
}
function df(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Qt(e, t = rr()) {
  const n = wa(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = df(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function An(e, t, n) {
  const r = wa(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, uf);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function ff(e, t, n = "", { storage: r = rr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Qt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? An(e, a.filter((i) => i.page !== s), r) : An(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function mf(e, t, n = rr()) {
  return An(e, Qt(e, n).filter((r) => r.page !== t), n);
}
function hf(e, t) {
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
function pf({ filled: e }) {
  return /* @__PURE__ */ m("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ m("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function gf({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = k(() => Qt(e)), [i, l] = k(!1), c = N(null);
  if (D(() => {
    s(Qt(e)), l(!1);
  }, [e]), D(() => {
    if (!i) return;
    const d = (g) => {
      c.current && !c.current.contains(g.target) && l(!1);
    }, h = (g) => {
      g.key === "Escape" && l(!1);
    };
    return document.addEventListener("pointerdown", d), document.addEventListener("keydown", h), () => {
      document.removeEventListener("pointerdown", d), document.removeEventListener("keydown", h);
    };
  }, [i]), !e || n <= 0) return null;
  const u = Math.min(Math.max(t, 1), n), f = a.some((d) => d.page === u);
  return /* @__PURE__ */ L("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: c, children: [
    /* @__PURE__ */ m(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${f ? " is-marked" : ""}`,
        "aria-pressed": f,
        "aria-label": f ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: f ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(ff(e, u, hf(r, u))),
        children: /* @__PURE__ */ m(pf, { filled: f })
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
        onClick: () => l((d) => !d),
        children: [
          /* @__PURE__ */ m(Qa, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ m("span", { className: "reader-bookmark-count", children: a.length })
        ]
      }
    ) : null,
    i && a.length ? /* @__PURE__ */ m("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ m("ol", { className: "reader-bookmark-list", children: a.map((d) => /* @__PURE__ */ L("li", { className: d.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ L(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(d.page, n)), l(!1);
          },
          children: [
            /* @__PURE__ */ L("span", { className: "reader-bookmark-page", children: [
              "第 ",
              d.page,
              " 页"
            ] }),
            d.label ? /* @__PURE__ */ m("span", { className: "reader-bookmark-label", children: d.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ m(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${d.page} 页的书签`,
          onClick: () => s(mf(e, d.page)),
          children: "×"
        }
      )
    ] }, d.page)) }) }) : null
  ] });
}
function bf(e) {
  const [t, n] = k([]);
  return D(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = nt().loadIssues;
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
function yf(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const vf = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, wf = ["failed", "content", "layout"];
function Sf(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function If({ jobId: e, currentPage: t }) {
  var f;
  const n = bf(e), r = (f = Je()) == null ? void 0 : f.jumpToBlock, [o, a] = k(!1), [s, i] = k(-1), l = N(null);
  D(() => i(-1), [n]);
  const c = (d) => {
    const h = n[d];
    !h || !r || (i(d), r(h.readerItemId));
  }, u = N({ issues: n, last: s, currentPage: t, goTo: c });
  return u.current = { issues: n, last: s, currentPage: t, goTo: c }, D(() => {
    const d = (h) => {
      if (h.key.toLowerCase() !== "n" || h.metaKey || h.ctrlKey || h.altKey || Sf(h.target)) return;
      const { issues: g, last: p, currentPage: y, goTo: w } = u.current, S = yf(g, p, y, h.shiftKey);
      S < 0 || (h.preventDefault(), w(S));
    };
    return document.addEventListener("keydown", d), () => document.removeEventListener("keydown", d);
  }, []), D(() => {
    if (!o) return;
    const d = (h) => {
      var g;
      (g = l.current) != null && g.contains(h.target) || a(!1);
    };
    return document.addEventListener("pointerdown", d, !0), () => document.removeEventListener("pointerdown", d, !0);
  }, [o]), n.length ? /* @__PURE__ */ L("div", { className: "reader-react-hud-group reader-issues", ref: l, "aria-label": "待处理", children: [
    /* @__PURE__ */ L(
      X,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((d) => !d),
        children: [
          /* @__PURE__ */ m(es, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ m("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ L("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ m("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      wf.map((d) => {
        const h = n.map((g, p) => ({ issue: g, index: p })).filter(({ issue: g }) => g.kind === d);
        return h.length ? /* @__PURE__ */ L("section", { className: "reader-issues-group", "data-issue-kind": d, children: [
          /* @__PURE__ */ L("h4", { children: [
            vf[d],
            /* @__PURE__ */ m("span", { children: h.length })
          ] }),
          /* @__PURE__ */ m("ol", { children: h.map(({ issue: g, index: p }) => /* @__PURE__ */ m("li", { children: /* @__PURE__ */ L(
            X,
            {
              className: "reader-issues-item",
              "aria-current": p === s ? "true" : void 0,
              onClick: () => {
                c(p), a(!1);
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
        ] }, d) : null;
      })
    ] }) : null
  ] }) : null;
}
const Rf = 48, Tf = 96, Pf = 700;
function Ef(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= Rf, downSoFar: r };
}
function kf(e) {
  const [t, n] = k(!1), r = N(0);
  return D(() => {
    const o = /* @__PURE__ */ new WeakMap();
    let a = 0;
    const s = () => {
      a = Date.now();
    }, i = /* @__PURE__ */ new WeakMap(), l = () => {
      const d = e.current;
      return !!(d && (d.querySelector(":focus-visible") || d.querySelector("[aria-expanded='true']")));
    }, c = (d) => {
      const h = d.target;
      if (!(h instanceof Element) || (i.has(h) || i.set(h, !!h.querySelector(`[${ke}]`)), !i.get(h))) return;
      const g = h.scrollTop, p = o.get(h);
      if (o.set(h, g), p === void 0 || Date.now() - a > Pf) return;
      const y = Ef(!1, r.current, g - p);
      r.current = y.downSoFar, g - p < -4 ? n(!1) : y.hidden && !l() && n(!0);
    }, u = (d) => {
      d.clientY >= window.innerHeight - Tf && (r.current = 0, n(!1));
    }, f = () => {
      l() && n(!1);
    };
    document.addEventListener("scroll", c, { capture: !0, passive: !0 }), window.addEventListener("pointermove", u, { passive: !0 }), document.addEventListener("focusin", f);
    for (const d of ["wheel", "touchmove", "keydown"]) window.addEventListener(d, s, { passive: !0, capture: !0 });
    return () => {
      for (const d of ["wheel", "touchmove", "keydown"]) window.removeEventListener(d, s, { capture: !0 });
      document.removeEventListener("scroll", c, { capture: !0 }), window.removeEventListener("pointermove", u), document.removeEventListener("focusin", f);
    };
  }, [e]), t;
}
function Mf(e) {
  const t = Je(), n = Xo(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? $t, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, l = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, c = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = hi(a), f = a > Eo + 1e-3, d = a < Yt - 1e-3, h = pt(r, Qe()), g = h >= Yt ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", p = N(null), y = kf(p), [w, S] = k(!1), [v, b] = k(`${i}`);
  D(() => {
    w || b(`${Math.min(Math.max(i, 1), Math.max(l, 1))}`);
  }, [i, l, w]);
  const I = () => {
    if (S(!1), !c || l <= 0)
      return;
    const E = Number(`${v}`.trim());
    c(Xt(E, l));
  };
  return /* @__PURE__ */ L("div", { ref: p, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": y ? "true" : void 0, children: [
    o ? /* @__PURE__ */ m("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ m("div", { className: "reader-react-hud-group", "aria-label": "页码", children: w ? /* @__PURE__ */ L(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (E) => {
          E.preventDefault(), I();
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
              value: v,
              autoFocus: !0,
              onChange: (E) => b(E.target.value.replace(/[^\d]/g, "")),
              onBlur: I,
              onKeyDown: (E) => {
                E.key === "Escape" && (E.preventDefault(), S(!1), b(`${i}`));
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
          !c || l <= 0 || (b(`${i}`), S(!0));
        },
        children: l > 0 ? `${Math.min(i, l)} / ${l}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ m("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ m(
      gf,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: l,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: c
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ m(If, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ m("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ m(
      X,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ m(Nf, {})
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
          onClick: () => s(Lt(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ L(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `${u}%，点击${g}`,
          title: g,
          onClick: () => s(h),
          children: [
            u,
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
          disabled: !d,
          onClick: () => s(Lt(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ m("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ m(ef, {}) })
  ] });
}
function Nf() {
  return /* @__PURE__ */ L("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ m("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ m("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function ao(e) {
  var t, n;
  return Lo(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Af(e) {
  const [t, n] = k(() => ({
    scope: e,
    panel: ao(ze(e))
  }));
  D(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: ao(ze(e))
    });
  }, [e]), D(() => {
    t.scope === e && nn(t.scope, {
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
const _n = "download-toast";
function _f({
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
function Lf(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    bn.dismiss(_n);
    return;
  }
  bn.custom(
    () => /* @__PURE__ */ m(_f, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: _n, duration: 1 / 0 }
  );
}
function Df() {
  const e = x((t) => {
    t && (t.setState = Lf, t.hide = () => bn.dismiss(_n));
  }, []);
  return /* @__PURE__ */ L(ct, { children: [
    /* @__PURE__ */ m(ja, { position: "bottom-right" }),
    /* @__PURE__ */ m("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function Cf(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Mo(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function xf(e, t) {
  return t === null || e !== t;
}
function Of(e) {
  const t = N(!1);
  return e && (t.current = !0), t.current;
}
function zf(e, t) {
  const n = e === t;
  return { open: n, mounted: Of(n) };
}
const so = { itemId: null, origin: null };
function $f() {
  let e = so;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? so : { itemId: n, origin: r };
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
function Ff({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = J(() => Xl(e, t), [e, t]), [o, a] = k(() => /* @__PURE__ */ new Set([...Tr(r), ...r ? [r] : []]));
  D(() => {
    a(/* @__PURE__ */ new Set([...Tr(r), ...r ? [r] : []]));
  }, [e]);
  const s = N(null);
  D(() => {
    var c, u;
    (u = (c = s.current) == null ? void 0 : c.querySelector('[aria-current="location"]')) == null || u.scrollIntoView({ block: "center" });
  }, [e]);
  const i = (c) => a((u) => {
    const f = new Set(u);
    return f.has(c) ? f.delete(c) : f.add(c), f;
  }), l = (c) => c.map((u) => {
    const f = o.has(u.id), d = u.children.length > 0;
    return /* @__PURE__ */ L("li", { className: "reader-bookmark", "data-level": u.level, children: [
      /* @__PURE__ */ L("div", { className: "reader-bookmark-row", children: [
        d ? /* @__PURE__ */ m(
          X,
          {
            className: `reader-bookmark-toggle${f ? " is-open" : ""}`,
            "aria-label": f ? `收起「${u.title}」` : `展开「${u.title}」`,
            "aria-expanded": f,
            onClick: () => i(u.id),
            children: /* @__PURE__ */ m(ts, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        ) : /* @__PURE__ */ m("span", { className: "reader-bookmark-spacer", "aria-hidden": "true" }),
        /* @__PURE__ */ L(
          X,
          {
            className: "reader-finder-entry reader-bookmark-entry",
            "data-level": u.level,
            "aria-current": u.id === r ? "location" : void 0,
            disabled: u.page === null,
            title: u.page === null ? "这条书签没有指到页" : `${u.title} · 第 ${u.page} 页`,
            onClick: () => u.page !== null && n(u.page),
            children: [
              /* @__PURE__ */ m("span", { className: "reader-finder-entry-text", children: u.title }),
              u.page !== null ? /* @__PURE__ */ m("span", { className: "reader-finder-entry-page", children: u.page }) : null
            ]
          }
        )
      ] }),
      d && f ? /* @__PURE__ */ m("ol", { className: "reader-bookmark-children", children: l(u.children) }) : null
    ] }, u.id);
  });
  return /* @__PURE__ */ m("ol", { ref: s, className: "reader-finder-list reader-bookmark-tree", "aria-label": "书签", children: l(e) });
}
const Bf = [], jf = [];
function Uf({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ L("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ m(X, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ m(ns, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function Hf({ open: e, onToggle: t }) {
  return /* @__PURE__ */ m(
    X,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ m(rs, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function Wf({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  bookmarks: l = jf,
  onJumpPage: c
}) {
  var B, T;
  const u = ((B = Je()) == null ? void 0 : B.regions) ?? Bf, f = ((T = Xo()) == null ? void 0 : T.currentPage) ?? 1, d = J(() => hu(u), [u]), h = l.length > 0 && !!c, [g, p] = k("bookmarks"), y = h && (g === "bookmarks" || !d.length), w = pu(d, f), S = J(() => yu(u, s), [u, s]), [v, b] = k(-1);
  D(() => b(-1), [s]);
  const I = N(null), E = N(null), _ = N(n);
  _.current = n, D(() => {
    const R = (M) => {
      var j, O;
      const A = M.target;
      !A || (j = E.current) != null && j.contains(A) || (O = A.closest) != null && O.call(A, ".reader-finder-toggles, [data-finder-toggle]") || _.current();
    }, P = (M) => {
      M.key === "Escape" && _.current();
    };
    return document.addEventListener("pointerdown", R, !0), document.addEventListener("keydown", P), () => {
      document.removeEventListener("pointerdown", R, !0), document.removeEventListener("keydown", P);
    };
  }, []);
  const $ = N(null);
  D(() => {
    var R, P, M;
    e === "search" ? (R = I.current) == null || R.focus() : (M = (P = $.current) == null ? void 0 : P.querySelector('[aria-current="location"]')) == null || M.scrollIntoView({ block: "center" });
  }, [e, i]), D(() => {
    var R, P;
    e === "search" && v >= 0 && ((P = (R = $.current) == null ? void 0 : R.querySelector('[aria-current="true"]')) == null || P.scrollIntoView({ block: "nearest" }));
  }, [e, v]);
  const F = (R) => {
    const P = S[R];
    P && (b(R), r(P.itemId));
  };
  return /* @__PURE__ */ L("aside", { ref: E, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ L("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ m(X, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ m(X, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ m(X, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ m(St, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" && h && d.length ? /* @__PURE__ */ L("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ m(X, { className: "reader-finder-switch-option", role: "radio", "aria-checked": y, onClick: () => p("bookmarks"), children: "按书签" }),
      /* @__PURE__ */ m(X, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !y, onClick: () => p("headings"), children: "按标题" })
    ] }) : null,
    e === "outline" && y && c ? /* @__PURE__ */ m(Ff, { nodes: l, currentPage: f, onJumpPage: c }) : e === "outline" ? d.length ? /* @__PURE__ */ m("ol", { ref: $, className: "reader-finder-list", children: d.map((R, P) => /* @__PURE__ */ m("li", { children: /* @__PURE__ */ L(
      X,
      {
        className: "reader-finder-entry",
        "data-level": R.level,
        "aria-current": P === w ? "location" : void 0,
        onClick: () => r(R.itemId),
        children: [
          /* @__PURE__ */ m("span", { className: "reader-finder-entry-text", children: R.text }),
          /* @__PURE__ */ m("span", { className: "reader-finder-entry-page", children: R.page })
        ]
      }
    ) }, R.itemId)) }) : /* @__PURE__ */ m("p", { className: "reader-finder-empty", children: u.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ L(ct, { children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ m(
          vo,
          {
            ref: I,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (R) => a(R.target.value),
            onKeyDown: (R) => {
              R.key === "Enter" ? (R.preventDefault(), F(wu(v, S.length, R.shiftKey))) : R.key === "Escape" && (R.preventDefault(), n()), R.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ m("p", { className: "reader-finder-count", "aria-live": "polite", children: S.length === 0 ? "没有找到" : `${v >= 0 ? `第 ${v + 1} / ` : ""}${S.length >= 200 ? "200+ 处，只列前 200 处" : `${S.length} 处`}${v < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ m("ol", { className: "reader-finder-list", children: S.map((R, P) => /* @__PURE__ */ m("li", { children: /* @__PURE__ */ L(X, { className: "reader-finder-entry is-hit", "aria-current": P === v ? "true" : void 0, onClick: () => F(P), children: [
        /* @__PURE__ */ L("span", { className: "reader-finder-entry-text", children: [
          R.snippet.slice(0, R.at),
          /* @__PURE__ */ m("mark", { children: R.snippet.slice(R.at, R.at + R.length) }),
          R.snippet.slice(R.at + R.length)
        ] }),
        /* @__PURE__ */ m("span", { className: "reader-finder-entry-page", children: R.page })
      ] }) }, R.itemId)) })
    ] })
  ] });
}
function Kf({ active: e, compare: t, ink: n }) {
  const [r, o] = k(!1), [a, s] = k(!1), i = N(null);
  D(() => {
    if (!r && !a) return;
    const c = () => {
      o(!1), s(!1);
    }, u = (d) => {
      var h;
      (h = i.current) != null && h.contains(d.target) || c();
    }, f = (d) => {
      d.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", u, !0), document.addEventListener("keydown", f), () => {
      document.removeEventListener("pointerdown", u, !0), document.removeEventListener("keydown", f);
    };
  }, [r, a]);
  const l = !!(t.compared || t.loading);
  return /* @__PURE__ */ L("div", { className: "reader-toolball", ref: i, "data-open": r ? "true" : void 0, children: [
    a ? /* @__PURE__ */ m(qu, { compare: t, onDone: () => {
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
          children: /* @__PURE__ */ m(On, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ m(cd, { active: e }),
      t.available ? /* @__PURE__ */ m(
        X,
        {
          className: "reader-toolball-item",
          "aria-label": "对比版本",
          title: "对比版本：左边换成这本书的另一份译文",
          "aria-pressed": l || a,
          "data-toolball-item": "compare",
          onClick: () => s((c) => !c),
          children: /* @__PURE__ */ m(os, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
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
        children: r ? /* @__PURE__ */ m(St, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ m(as, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const Vf = [
  { tool: "pen", label: "画笔", Icon: On },
  { tool: "highlighter", label: "荧光笔", Icon: ss },
  { tool: "eraser", label: "橡皮", Icon: is }
];
function Sa(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Ia({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ L(ct, { children: [
    Vf.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ m(
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
    Jo.map((o) => /* @__PURE__ */ m(
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
    /* @__PURE__ */ m(X, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ m(ls, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ m(
      X,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ m(cs, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
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
        children: /* @__PURE__ */ m(St, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function Jf({ ink: e, menu: t, onClose: n }) {
  const r = N(null);
  if (D(() => {
    if (!t) return;
    const i = (c) => {
      var u;
      (u = r.current) != null && u.contains(c.target) || n();
    }, l = (c) => {
      c.key === "Escape" && n();
    };
    return document.addEventListener("pointerdown", i, !0), document.addEventListener("keydown", l), () => {
      document.removeEventListener("pointerdown", i, !0), document.removeEventListener("keydown", l);
    };
  }, [t, n]), !t) return null;
  const o = 380, a = Math.max(8, Math.min(t.x, (globalThis.innerWidth || o) - o - 8)), s = Math.max(68, Math.min(t.y, (globalThis.innerHeight || 600) - 60));
  return /* @__PURE__ */ m("div", { ref: r, className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", style: { left: a, top: s }, "data-ink-menu": "true", children: /* @__PURE__ */ m(Ia, { ink: e, page: t.page, onPick: n }) });
}
function qf({ ink: e }) {
  return e.tool ? /* @__PURE__ */ m("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ m(Ia, { ink: e }) }) : null;
}
function Gf(e) {
  var r;
  if (e.shiftKey || Sa(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${To}`))) return null;
  const n = Number((r = t.closest(`[${ke}]`)) == null ? void 0 : r.getAttribute(ke)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Zf(e) {
  const t = N(e);
  t.current = e, D(() => {
    const n = (r) => {
      if (Sa(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
function pn() {
  try {
    return nt().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Yf(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Xf(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function Qf(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function em({ documentId: e, jobId: t }) {
  const [n, r] = k([]), [o, a] = k(null), [s, i] = k(null), [l, c] = k(""), [u, f] = k(""), d = N(0);
  D(() => {
    r([]), i(null), f("");
    const y = pn();
    if (!y || !e) return;
    let w = !1;
    return y.list(e).then((S) => {
      w || (r(S.versions), a(S.currentVersionId));
    }).catch(() => {
    }), () => {
      w = !0;
    };
  }, [e, t]);
  const h = x((y) => {
    const w = pn(), S = n.find((b) => b.versionId === y);
    if (!w || !S || !e) return;
    const v = ++d.current;
    c(y), f(""), (async () => {
      const b = nt(), I = await w.resolveJob(e, y);
      if (!I) throw new Error("这一份还没有能读的译文。");
      const E = await b.loadReaderPayload(I, { includeOptionalArtifacts: !0 }), _ = b.resolveReaderTranslatedPdfUrl(E.jobPayload, E.manifestPayload);
      if (!_) throw new Error("这一份没有译文 PDF。");
      return { versionId: y, name: S.name, jobId: I, url: _, regions: Yf(mo(E.regionsPayload)) };
    })().then((b) => {
      v === d.current && i(b);
    }).catch((b) => {
      v === d.current && f((b == null ? void 0 : b.message) || "这一份打不开。");
    }).finally(() => {
      v === d.current && c("");
    });
  }, [e, n]), g = x(() => {
    d.current += 1, i(null), c(""), f("");
  }, []), p = x(async () => {
    var S, v;
    const y = pn();
    if (!y || !s || !e) return;
    try {
      await y.select(e, s.versionId);
    } catch (b) {
      f((b == null ? void 0 : b.message) || "换不过去，请稍后再试。");
      return;
    }
    const w = (S = globalThis.location) == null ? void 0 : S.href;
    w && ((v = globalThis.history) == null || v.replaceState(globalThis.history.state, "", Qf(w, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: Xf(n, t, o),
    compared: s,
    loading: l,
    error: u,
    choose: h,
    clear: g,
    adopt: p
  };
}
const tm = "reader-finder-input";
function nm(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function rm(e, t = typeof window > "u" ? null : window) {
  D(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!nm(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(tm) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function om() {
  try {
    return nt().translationEdit ?? null;
  } catch {
    return null;
  }
}
const am = "这本书正在处理（翻译或排版），处理完才能改。", sm = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function im({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = om(), s = `${e || ""}`.trim(), i = !!(a && s && r), l = ec(s), c = !t || At(t), u = sc(n), [f, d] = k(""), [h, g] = k(null), [p, y] = k(() => /* @__PURE__ */ new Map()), [w, S] = k(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [v, b] = k(() => /* @__PURE__ */ new Map()), [I, E] = k({ phase: "idle" }), _ = N({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  D(() => {
    g(null), _.drafts.clear(), _.generation.current = null, b(/* @__PURE__ */ new Map()), E({ phase: "idle" });
  }, [s]), D(() => {
    if (d(""), !i || l || !a) return;
    let A = !1;
    return a.resolveOwnerJobId(s).then((j) => {
      A || d(`${j || s}`.trim() || s);
    }).catch(() => {
      A || d(s);
    }), () => {
      A = !0;
    };
  }, [i, l, a, s]), D(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !u || !c) return;
    let A = !1;
    return a.fetchRevisions(f).then((j) => {
      A || y(ic(j, u));
    }).catch(() => {
    }), () => {
      A = !0;
    };
  }, [a, f, u, c]);
  const $ = I.phase === "running" && I.seenActive;
  D(() => {
    if (I.phase === "running") {
      if (!c) {
        $ || E({ phase: "running", seenActive: !0 });
        return;
      }
      $ && E(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [I.phase, $, c, t]);
  const F = J(() => {
    const A = new Map(p);
    if (w.renderedAt === u)
      for (const [j, O] of w.edits) A.set(j, O);
    return A;
  }, [p, w, u]), B = x((A) => {
    const j = `${A || ""}`.trim();
    j && g({ itemId: j, page: tc(j) });
  }, []), T = x(() => g(null), []), R = x((A, j) => {
    S((O) => {
      const H = new Map(O.renderedAt === u ? O.edits : []);
      return H.set(A, j), { renderedAt: u, edits: H };
    }), b((O) => new Map(O).set(A, (O.get(A) || 0) + 1));
  }, [u]), P = x(async () => {
    if (!(!a || !s || I.phase === "submitting" || I.phase === "running")) {
      E({ phase: "submitting" });
      try {
        await a.rerender(s), E({ phase: "running", seenActive: !1 }), await o();
      } catch (A) {
        E({ phase: "failed", message: (A == null ? void 0 : A.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, I.phase, o]), M = l ? sm : !c || I.phase === "running" || I.phase === "submitting" ? am : "";
  return J(() => ({
    available: i,
    blockedReason: M,
    port: a,
    ownerJobId: f,
    target: h,
    select: B,
    close: T,
    memory: _,
    pendingEdits: F,
    savedCounts: v,
    markSaved: R,
    rerender: I,
    startRerender: P
  }), [i, M, a, f, h, B, T, _, F, v, R, I, P]);
}
function lm(e, t) {
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
function cm({ edit: e }) {
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
const Ra = "retainpdf:reader:doc-theme:v1", io = "data-reader-doc";
function Ta() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function um(e = Ta()) {
  try {
    return (e == null ? void 0 : e.getItem(Ra)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function dm(e, t = Ta()) {
  try {
    t == null || t.setItem(Ra, e);
  } catch {
  }
}
function lo(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(io, "dark") : t.removeAttribute(io));
}
function fm() {
  const [e, t] = k(() => um());
  D(() => {
    lo(e);
  }, [e]), D(() => () => lo("light"), []);
  const n = x(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return dm(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
const mm = Ea(() => import("./ReaderMarkdownPanel-Bmcih3gI.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), hm = [];
function pm(e) {
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
function gm(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function bm() {
  var Be;
  const e = _l(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Af(e.viewStateKey), s = a.panel, i = a.setPanel, [l, c] = k(!1), u = N(null), f = N(null), d = s !== null, h = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, g = pm({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: h,
    liveTranslationVisible: l,
    assistantOpen: d
  }), p = yl({
    hasOverlayContent: h,
    connection: e.liveTranslation.connection,
    showSource: g.showSource,
    liveTranslationVisible: l,
    assistantOpen: d
  }), y = g.sourceViewOnly, w = g.visibleMode;
  D(() => {
    c(!1);
  }, [e.viewStateKey]), D(() => {
    e.session.jobTerminal && c(!1);
  }, [e.session.jobTerminal]);
  const S = N(null);
  D(() => {
    S.current !== e.viewStateKey && Sl({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: y,
      jobTerminal: e.session.jobTerminal
    }) && (S.current = e.viewStateKey, c(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, y]), D(() => {
    if (!(t.loading || t.failed)) {
      if (u.current !== e.viewStateKey) {
        u.current = e.viewStateKey;
        const U = ze(e.viewStateKey), Z = Cf({
          savedMode: U == null ? void 0 : U.mode,
          sourceViewOnly: y,
          viewportWidth: Qe()
        });
        f.current = Z.auto ? Z.mode : null, Z.mode && Z.mode !== e.mode && e.setModeKeepingPage(Z.mode);
        return;
      }
      xf(e.mode, f.current) && (f.current = null, nn(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, y]);
  const v = s || (e.mode === "compare" ? "compare" : "reading"), b = zf(s, "markdown"), { docDark: I, toggleDocDark: E } = fm();
  $l({
    toggleDocDark: E,
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
  const _ = x(() => {
    i(null);
  }, []), $ = vl(e.liveTranslation), F = x(() => {
    $ && e.goToPage($, "source");
  }, [e.goToPage, $]), [B, T] = k(null);
  D(() => {
    w === "compare" && e.session.jobTerminal && T(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, w]);
  const R = B !== e.viewStateKey && Il({
    state: e.liveTranslation,
    sourceViewOnly: y,
    visibleMode: w
  }), P = x((U) => {
    const Z = gm(U, e.liveTranslationAvailable);
    Z !== null && c(Z), e.setModeKeepingPage(U);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), M = J(() => p.sourcePaneToggle ? /* @__PURE__ */ m(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${l ? " is-active" : ""}`,
      onClick: () => c((U) => !U),
      "aria-pressed": l,
      title: l ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [p.sourcePaneToggle, l]), A = x((U) => {
    i(U);
  }, []), [j] = k($f), [O, H] = k(null), ae = x((U) => H((Z) => Z === U ? null : U), []), [ee, te] = k(""), [pe, ie] = k("");
  D(() => {
    const U = ee.replace(/\s+/gu, " ").trim(), Z = window.setTimeout(() => ie(U), U ? 150 : 0);
    return () => window.clearTimeout(Z);
  }, [ee]);
  const [me, Le] = k(0), Q = x(() => {
    H("search"), Le((U) => U + 1);
  }, []);
  rm(Q);
  const Y = x((U) => {
    e.jumpToAnchor({ block_id: U }), (O === "outline" || Qe() < 900) && H(null);
  }, [e.jumpToAnchor, O]), Se = x((U) => e.jumpToAnchor({ block_id: U }), [e.jumpToAnchor]), [de, he] = k({}), $e = N({ source: r.sourceUrl, translated: r.translatedUrl });
  $e.current = { source: r.sourceUrl, translated: r.translatedUrl };
  const qe = x((U, Z) => {
    he((C) => ({ ...C, [Z]: { url: $e.current[Z], nodes: U } }));
  }, []), De = J(() => {
    const U = de.source;
    if (U && U.url === r.sourceUrl && U.nodes.length) return U.nodes;
    const Z = de.translated;
    return Z && Z.url === r.translatedUrl && Z.nodes.length ? Z.nodes : hm;
  }, [de, r.sourceUrl, r.translatedUrl]), Me = x((U) => {
    e.goToPage(U), (O === "outline" || Qe() < 900) && H(null);
  }, [e.goToPage, O]), G = im({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), z = G.select, ne = e.setModeKeepingPage, re = o.regions, ue = x((U) => {
    dc(re, U) && (w === "source" && ne("compare"), z(U));
  }, [re, z, w, ne]);
  lm(G.available ? ue : null, j);
  const oe = eu(e.viewStateKey);
  Zf(oe);
  const [Te, Ie] = k(null), Ne = x(() => Ie(null), []), be = em({ documentId: o.documentId, jobId: o.jobId }), Fe = ((Be = be.compared) == null ? void 0 : Be.url) || "";
  D(() => {
    Fe && w !== "compare" && P("compare");
  }, [Fe]), D(() => {
    w !== "compare" && be.clear();
  }, [w]);
  const rt = J(
    () => {
      const { compared: U, versions: Z, readingVersionId: C } = be;
      if (!U) return null;
      const W = Z.find((q) => q.versionId === U.versionId), K = Z.find((q) => q.versionId === C);
      return {
        url: U.url,
        regions: U.regions,
        left: { name: U.name, createdAt: (W == null ? void 0 : W.createdAt) || "" },
        right: { name: (K == null ? void 0 : K.name) || "当前译文", createdAt: (K == null ? void 0 : K.createdAt) || "" }
      };
    },
    [be.compared, be.versions, be.readingVersionId]
  ), Pe = J(() => {
    if (!G.savedCounts.size) return e.revisedBlocks;
    const U = new Map(e.revisedBlocks);
    for (const [Z, C] of G.savedCounts) U.set(Z, (U.get(Z) || 0) + C);
    return U;
  }, [e.revisedBlocks, G.savedCounts]), Ce = J(() => ({
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
    jumpToBlock: Se,
    revisedBlocks: Pe,
    onPdfOutline: qe,
    editBlock: G.available ? ue : void 0,
    blockEdit: G,
    editShowsSource: w !== "compare",
    findTerm: O === "search" ? pe : "",
    compareVersion: rt,
    ink: oe,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: y,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: A, close: _ },
    docDark: I,
    toggleDocDark: E
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
    Se,
    Pe,
    qe,
    G,
    ue,
    w,
    O,
    pe,
    rt,
    oe,
    e.sourceOnly,
    y,
    e.download,
    e.goToPage,
    A,
    _,
    I,
    E
  ]), Ge = J(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), ft = [
    ci,
    `is-workspace-${v}`,
    d ? "is-assistant-open" : "",
    O ? "is-finder-open" : "",
    g.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ m(iu, { value: Ce, hud: Ge, children: /* @__PURE__ */ L(
    "div",
    {
      className: ft,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": v,
      "data-ink-mode": oe.tool || void 0,
      onContextMenu: (U) => {
        const Z = Gf(U);
        Z && (U.preventDefault(), Ie(Z));
      },
      children: [
        /* @__PURE__ */ m(Xd, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
        /* @__PURE__ */ m(Uf, { open: O, onToggle: ae }),
        O ? /* @__PURE__ */ m(
          Wf,
          {
            tab: O,
            onTab: H,
            onClose: () => H(null),
            onJump: Y,
            bookmarks: De,
            onJumpPage: Me,
            query: ee,
            onQuery: te,
            term: pe,
            focusSignal: me
          }
        ) : null,
        /* @__PURE__ */ L("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ m(lf, {}),
          /* @__PURE__ */ m(Kl, { onBeforeClose: o.prepareClose })
        ] }),
        /* @__PURE__ */ m(
          od,
          {
            mode: w,
            documentReady: !!o.jobId,
            sourceViewOnly: y,
            onModeChange: P,
            liveTranslation: p.topBarPill ? {
              visible: l,
              state: e.liveTranslation,
              onToggle: () => c((U) => !U),
              latestPage: l ? $ : null,
              currentPage: e.currentPage,
              onJumpToLatest: F
            } : null,
            completion: R ? {
              onOpenCompare: () => {
                T(e.viewStateKey), P("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ m(ud, { active: s }),
        d ? /* @__PURE__ */ m(Zd, {}) : null,
        /* @__PURE__ */ m(ed, { paneComposition: g, markdownSplit: b.open, assistantSplit: d, liveTranslation: e.liveTranslation, sourcePaneAction: M }),
        e.showHud ? /* @__PURE__ */ m(
          Mf,
          {
            mode: w,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : o.jobId,
            searchSlot: /* @__PURE__ */ m(Hf, { open: O, onToggle: ae })
          }
        ) : null,
        /* @__PURE__ */ m(Pa, { fallback: null, children: b.mounted ? /* @__PURE__ */ m(mm, { open: b.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: _ }) : null }),
        /* @__PURE__ */ m(Kf, { active: s, compare: be, ink: oe }),
        /* @__PURE__ */ m(Jf, { ink: oe, menu: Te, onClose: Ne }),
        /* @__PURE__ */ m(qf, { ink: oe }),
        /* @__PURE__ */ m(cm, { edit: G }),
        /* @__PURE__ */ m(Df, {})
      ]
    }
  ) });
}
function Om() {
  return /* @__PURE__ */ m(bm, {});
}
export {
  Om as R,
  bm as a,
  Cm as d,
  Dm as f,
  xm as r,
  Je as u
};
//# sourceMappingURL=ReaderApp-kAeWfXv8.js.map
