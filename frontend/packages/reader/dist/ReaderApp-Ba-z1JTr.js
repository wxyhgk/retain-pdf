var Un = (e) => {
  throw TypeError(e);
};
var Hn = (e, t, n) => t.has(e) || Un("Cannot " + n);
var lt = (e, t, n) => (Hn(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Wn = (e, t, n) => t.has(e) ? Un("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Vn = (e, t, n, r) => (Hn(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as F, jsx as g, Fragment as st } from "react/jsx-runtime";
import { useMemo as G, useState as N, useEffect as $, useCallback as O, useRef as _, useLayoutEffect as Ae, memo as Ut, createContext as vn, useContext as wn, forwardRef as $o, useImperativeHandle as Sn, useSyncExternalStore as zr, useId as Or, Suspense as jo, lazy as Bo } from "react";
import { requireAdapter as it, getReaderAdapters as Ee } from "./adapters.js";
import { resolveReaderDownloadName as Uo, resolveReaderDownloadUrls as Ho, READER_PROGRESS_COPY as _e, trimString as Ct, READER_DOWNLOAD_ACTIONS as Wo, disabledReason as Vo } from "./runtime/state.js";
import { r as Jo, b as Ko } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as rn, isFinishedJobStatus as pt } from "@retainpdf/domain/job";
import { n as Go, d as qo, f as Gt, k as Jn, b as Zo, c as Yo, j as Ht, p as Rn, g as Xo, l as Kn, i as Qo } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as ea } from "@retainpdf/api/documents";
import { isReaderTransportError as ta, createReaderTransportError as na } from "./contracts.js";
import { toast as on, Toaster as ra } from "sonner";
import { X as Pn, ChevronUp as oa, ChevronDown as Fr, History as aa, Radio as sa, FileText as $r, Columns2 as jr, Languages as Br, FileCode2 as ia, Keyboard as ca, Download as la, ListTree as da, Search as ua } from "lucide-react";
import { Button as ye, Textarea as fa, IconButton as Gn, Input as Ur } from "@retainpdf/ui";
import { pdfjs as Hr, Page as ma, Document as ha } from "react-pdf";
import { e as pa, m as ga, a as ba } from "./markdown-math-XkF5urpn.js";
const ya = (...e) => {
  var t, n;
  return ((n = (t = Ee()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, va = "", wa = Object.freeze({
  progress: "retainpdf-reader-progress"
}), Sa = (e) => {
  var t, n;
  return ((n = (t = Ee()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Qd = (...e) => {
  var n;
  return (((n = Ee()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Le = () => it("defaultReaderDataPort"), qn = () => it("defaultReaderPageConfigPort"), eu = {
  get apiPrefix() {
    return Le().apiPrefix;
  },
  fetchProtected: (...e) => Le().fetchProtected(...e),
  loadMarkdownPayload: (e) => Le().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Le().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Le().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Le().loadJobPayload(e),
  loadReaderPayload: (e, t) => Le().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Le().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Le().liveTranslation;
  }
}, Wr = {
  messageTargetOrigin: () => qn().messageTargetOrigin(),
  readerJobId: () => qn().readerJobId()
}, Ra = () => {
  var e;
  return ((e = Ee()) == null ? void 0 : e.liveTranslation) ?? null;
}, gt = () => {
  var t;
  const e = Ee();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Rt = () => {
  const e = Ee();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => it("fetchDocumentByJobId")(...n),
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
}, Pa = (...e) => {
  var t, n;
  return ((n = (t = Ee()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Ea = () => {
  var e, t;
  return ((t = (e = Ee()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Ia = (...e) => {
  var t, n;
  return ((n = (t = Ee()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Ta = (...e) => {
  var t, n;
  return ((n = (t = Ee()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Uo(...e);
}, ka = (...e) => {
  var t, n;
  return ((n = (t = Ee()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Ho(...e);
}, Aa = (...e) => it("downloadProtectedResource")(...e), Ma = (...e) => it("failDownloadToast")(...e), tu = (e, t) => it("resolveMarkdownAssetUrl")(e, t), Zn = "/api/v1";
function Na() {
  const e = () => {
    var r;
    return Jo(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = N(e);
  return $(() => {
    var i, c, l, d;
    const r = () => n(e()), o = (c = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : c.bind(globalThis.history), a = (d = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : d.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const u = (f) => function(...m) {
          const b = f.apply(this, m);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), b;
        };
        globalThis.history.pushState = u(o), globalThis.history.replaceState = u(a), s = !0;
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
function _a() {
  const e = Na(), t = G(() => Ia(Wr), [e]), n = G(() => Ea(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function La(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [c, l] = N({
    documentId: "",
    jobId: ""
  }), [d, u] = N({
    documentId: "",
    jobId: ""
  }), f = c.documentId === t ? c.jobId : "", m = d.documentId === t ? d.jobId : "", b = n || f, [p, w] = N({
    jobId: "",
    documentId: ""
  }), v = p.jobId === b ? p.documentId : "", S = t || v, P = !!t && !b, [h, y] = N(null), T = (h == null ? void 0 : h.sessionIdentity) === r && h.documentId === S ? h : null, M = P || !!T, z = O((x) => {
    const R = `${x.documentId || ""}`.trim();
    if (!R || a.current && a.current !== R) return;
    if (!a.current && s.current)
      w({
        jobId: s.current,
        documentId: R
      });
    else if (!a.current)
      return;
    const E = `${x.revision || ""}`.trim() || `${Date.now()}`;
    y({
      documentId: R,
      revision: E,
      sessionIdentity: o.current
    }), i();
  }, []);
  $(() => {
    y((x) => x && x.sessionIdentity !== r ? null : x);
  }, [r]);
  const D = O((x) => {
    switch (x.type) {
      case "resolved-document-job":
        l({ documentId: x.documentId, jobId: x.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        u({ documentId: x.documentId, jobId: x.jobId });
        break;
      case "resolved-job-document":
        w((R) => R.jobId === x.jobId && R.documentId === x.documentId ? R : { jobId: x.jobId, documentId: x.documentId });
        break;
      case "committed-source":
        y({
          documentId: x.documentId,
          revision: x.revision,
          sessionIdentity: x.sessionIdentity
        });
        break;
    }
  }, []);
  return {
    resolvedDocumentJob: c,
    setResolvedDocumentJob: l,
    missingDocumentJob: d,
    setMissingDocumentJob: u,
    documentJobId: f,
    rejectedDocumentJobId: m,
    sessionJobId: b,
    resolvedJobDocument: p,
    setResolvedJobDocument: w,
    jobDocumentId: v,
    documentId: S,
    sourceOnly: P,
    committedDocumentSource: h,
    setCommittedDocumentSource: y,
    activeCommittedDocumentSource: T,
    sourceViewOnly: M,
    refreshCommittedDocument: z,
    applyIdentityEvent: D
  };
}
function Yn(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Da(e) {
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
    const c = `${i || ""}`.trim();
    if (c) return c;
  }
  return "";
}
function Xn(e, t) {
  return Sa(rn(e, t));
}
function Ca(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function xa(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !Ca(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function an({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: wa.progress,
        stage: n,
        percent: e,
        text: t
      },
      Wr.messageTargetOrigin()
    );
  } catch {
  }
}
function xt(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), an({ percent: t, text: n, stage: r });
}
function za(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = N(null), [l, d] = N(null), [u, f] = N(""), [m, b] = N(0), p = u === n ? i : null, w = u === n ? l : null, v = Yn(p), S = pt(v), P = O(() => {
    b((D) => D + 1);
  }, []), h = O((D) => {
    c(D.jobPayload), d(D.manifestPayload), f(D.sessionIdentity);
  }, []), y = O((D) => {
    c(null), d(null), f(D);
  }, []), T = _(""), M = _(""), z = O(async () => {
    const D = o.current;
    if (!D || T.current === D) return;
    const x = Rt().loadJobPayload;
    if (typeof x != "function") return;
    const R = a.current.value;
    T.current = D;
    try {
      const E = await x(D);
      if (s.current || a.current.value !== R || o.current !== D || !E || typeof E != "object")
        return;
      const I = Yn(E);
      c(E), f(r.current), !pt(I) && M.current === D && (M.current = ""), I === "succeeded" && M.current !== D && (M.current = D, b((k) => k + 1));
    } catch {
    } finally {
      T.current === D && (T.current = "");
    }
  }, []);
  return $(() => {
    M.current = "";
  }, [n]), $(() => {
    if (!t || S || !p) return;
    const D = window.setInterval(() => {
      document.visibilityState !== "hidden" && z();
    }, 1e3);
    return () => window.clearInterval(D);
  }, [S, z, p, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: d,
    payloadSessionIdentity: u,
    setPayloadSessionIdentity: f,
    scopedJobPayload: p,
    scopedManifestPayload: w,
    jobStatus: v,
    jobTerminal: S,
    jobRefreshRevision: m,
    refreshJobArtifacts: P,
    refreshJobStatus: z,
    publishPayload: h,
    clearPayload: y
  };
}
function sn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Oa(e, t) {
  e(t), sn(t);
}
function Fa(e) {
  const [t, n] = N(e ? "source" : "compare"), r = O((a) => {
    e && a !== "source" || (n(a), sn(a));
  }, [e]), o = O((a) => {
    Oa(n, a);
  }, []);
  return $(() => (e && document.documentElement.classList.add("reader-source-only"), sn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Qn(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function $a(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Qn(n.active_job_id),
    activeVersionId: Qn(n.active_version_id)
  };
}
function ja(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Ba(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Ua(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Ha = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Wa(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Ha.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Va = 48 * 1024 * 1024;
function Ja(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Ka = 2, Se = /* @__PURE__ */ new Map();
function cn(e, t) {
  Se.delete(e), Se.set(e, t);
}
function er(e) {
  if (Se.size < Ka) return;
  const t = Se.keys().next().value;
  t && Se.delete(t);
}
async function Ga(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Vr(e, t = gt().fetchProtected, n = {}) {
  var d, u, f, m, b, p, w, v, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Se.has(r)) {
    const P = Se.get(r);
    return cn(r, P), P;
  }
  const o = new AbortController(), a = () => o.abort();
  (d = n.signal) != null && d.aborted && o.abort(), (f = (u = n.signal) == null ? void 0 : u.addEventListener) == null || f.call(u, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (b = (m = n.signal) == null ? void 0 : m.removeEventListener) == null || b.call(m, "abort", a);
  }
  if (!s.ok) {
    const P = new Error(`读取 PDF 失败 (${s.status})`);
    P.status = s.status;
    const h = await Ga(s);
    throw h && (P.reason = h), P;
  }
  const i = qa(r, s, t);
  if (i) {
    o.abort();
    const P = { ranged: i };
    return er(), Se.set(r, P), P;
  }
  (w = (p = n.signal) == null ? void 0 : p.addEventListener) == null || w.call(p, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (S = (v = n.signal) == null ? void 0 : v.removeEventListener) == null || S.call(v, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return Se.has(r) ? cn(r, l) : (er(), Se.set(r, l)), l;
}
function qa(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Va ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Za = { file: null, loading: !1, error: "" }, Ya = { file: null, loading: !0, error: "" };
function Xa(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = N(null);
  if ($(() => {
    if (t || !n) return;
    const s = Se.get(n);
    if (s) {
      cn(n, s);
      return;
    }
    const i = new AbortController();
    return Vr(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Za;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Se.get(n);
  return a ? { file: a, loading: !1, error: "" } : Ya;
}
function Qa(e) {
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
async function ln(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  xt(s, r, n, "download");
  const i = await Vr(t, gt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (xt(s, o, n, "download"), i);
}
async function es(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  xt(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    ln({
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
    ln({
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
function ts(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function ns({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = ea,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(ts(o.href, t, a)), !0);
}
const kt = {
  regions: null,
  metadata: null
};
function rs(e) {
  const {
    sessionJobId: t,
    jobId: n,
    routeDocumentId: r,
    documentJobId: o,
    rejectedDocumentJobId: a,
    sourceOnly: s,
    locationKey: i,
    sessionIdentity: c,
    committedSource: l,
    applyIdentityEvent: d,
    publishPayload: u,
    clearPayload: f,
    switchSessionMode: m,
    jobRefreshRevision: b,
    sessionEpochRef: p,
    closingRef: w,
    activeLoadAbortRef: v
  } = e, [S, P] = N(""), [h, y] = N(""), [T, M] = N(null), [z, D] = N(null), [x, R] = N(!1), [E, I] = N(""), [k, A] = N([]), [B, C] = N(!1), [J, re] = N(() => ({
    source: null,
    translated: null
  })), [q, X] = N(
    kt
  ), [pe, oe] = N({
    loading: !0,
    percent: 4,
    text: _e.boot,
    stage: "progress",
    failed: !1
  });
  return $(() => {
    const ae = new AbortController(), we = p.current.value, V = Qa({
      sessionEpochRef: p,
      closingRef: w,
      abort: ae,
      sessionEpoch: we
    });
    v.current = ae;
    const Q = Rt();
    if (w.current)
      return ae.abort(), () => {
        v.current === ae && (v.current = null);
      };
    let me = !1;
    function U(Z, fe) {
      V.markFailed(), C(!0), oe({
        loading: !1,
        percent: 100,
        text: Z,
        stage: "failed",
        failed: !0
      }), an({ percent: 100, text: fe, stage: "failed" });
    }
    function se() {
      R(!0), me || C(!0), oe({
        loading: !1,
        percent: 100,
        text: _e.ready,
        stage: "ready",
        failed: !1
      }), an({ percent: 100, text: _e.ready, stage: "ready" });
    }
    function Be() {
      return l != null && l.documentId ? Xn(
        l.documentId,
        l.revision
      ) : ya() ? va : Q.resolveResourceUrl(rn(r));
    }
    async function Me() {
      var de;
      let Z = { activeJobId: "", activeVersionId: "" };
      try {
        const ue = await ((de = Q.fetchDocument) == null ? void 0 : de.call(Q, r));
        ue && (Z = $a(ue));
      } catch {
      }
      const fe = ja({
        link: Z,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (fe.kind === "follow-active-job") {
        if (V.isInactive()) return;
        d({
          type: "resolved-document-job",
          documentId: r,
          jobId: fe.jobId
        }), fe.activeVersionId ? (l || d({
          type: "committed-source",
          documentId: r,
          revision: fe.activeVersionId,
          sessionIdentity: c
        }), m("source")) : m("compare");
        return;
      }
      if (fe.kind === "open-committed-source") {
        if (V.isInactive()) return;
        d({
          type: "committed-source",
          documentId: r,
          revision: fe.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const he = Be();
      if (V.isInactive()) return;
      P(he), y(""), I(""), f(c);
      const le = await ln({
        url: he,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: V,
        setBoot: oe
      });
      if (!V.isInactive()) {
        if (!le) {
          U("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        M(le), se();
      }
    }
    async function j() {
      var K;
      const Z = !l, fe = !!(Z && Q.loadSessionSnapshot && Q.loadReaderOptionalArtifacts), he = fe ? Q.loadReaderOptionalArtifacts(t) : null, le = await ((K = Q.loadSessionSnapshot) == null ? void 0 : K.call(Q, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: Z && !fe
      })), de = le ? {
        jobPayload: le.sourcePayload,
        manifestPayload: le.manifestPayload,
        readerMetadata: le.readerMetadata,
        regionsPayload: le.regions,
        readerErrors: le.readerErrors
      } : await Q.loadReaderPayload(t, {
        includeOptionalArtifacts: Z
      });
      if (V.isInactive()) return;
      let ue = null;
      if (n && !r)
        if (le && le.linkedDocument !== void 0)
          ue = le.linkedDocument;
        else {
          try {
            ue = await Q.fetchDocumentByJobId(Zn, t);
          } catch {
          }
          if (V.isInactive()) return;
        }
      const Re = Da(de.jobPayload) || `${(ue == null ? void 0 : ue.document_id) || ""}`.trim();
      Re && !r && d({
        type: "resolved-job-document",
        jobId: t,
        documentId: Re
      });
      const Ne = Ba({
        payloadDocumentId: Re,
        linkedActiveJobId: `${(ue == null ? void 0 : ue.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ue == null ? void 0 : ue.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Ne.kind === "restore-committed-source") {
        if (V.isInactive()) return;
        d({
          type: "committed-source",
          documentId: Ne.documentId,
          revision: Ne.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const ct = Q.resolveReaderSourcePdf(de.manifestPayload), Jt = Q.resolveReaderTranslatedPdfUrl(de.jobPayload, de.manifestPayload), Kt = typeof ct == "string" ? ct : Q.resolveReaderArtifactUrl(ct), xe = r || Re, ze = l != null && l.documentId ? Xn(
        l.documentId,
        l.revision
      ) : Kt || (xe ? Q.resolveResourceUrl(rn(xe)) : ""), Ue = l ? "" : Jt || "";
      P(ze || ""), y(Ue), I(xa(de.jobPayload, t)), u({
        jobPayload: de.jobPayload || null,
        manifestPayload: de.manifestPayload || null,
        sessionIdentity: c
      });
      const Et = () => es({
        sourceFinal: ze || "",
        translatedFinal: Ue,
        fence: V,
        setBoot: oe
      }), It = !!(ze || Ue), Ye = he && It ? Et() : null;
      Ye == null || Ye.catch(() => {
      });
      const Tt = (W) => {
        V.isInactive() || (A(l ? [] : Go(W.regionsPayload)), re(l ? { source: null, translated: null } : qo(W.readerMetadata)), X(l ? kt : W.readerErrors ?? kt), C(!0));
      };
      if (he ? (me = !0, he.then(Tt)) : Tt(de), !It) {
        U(_e.failed, _e.failed);
        return;
      }
      const L = await (Ye ?? Et());
      if (L.status !== "inactive") {
        if (L.status === "incomplete") {
          U("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        M(L.sourceBytes), D(L.translatedBytes), se();
      }
    }
    async function ce() {
      R(!1), M(null), D(null), A([]), C(!1), re({ source: null, translated: null }), X(kt), xt(oe, 8, _e.metadata, "metadata");
      try {
        if (s) {
          await Me();
          return;
        }
        if (!t) {
          U(_e.failed, _e.failed);
          return;
        }
        await j();
      } catch (Z) {
        if (V.isClosedOrStale() || (Z == null ? void 0 : Z.name) === "AbortError") return;
        V.markFailed();
        const fe = Number(Z == null ? void 0 : Z.status), he = `${(Z == null ? void 0 : Z.reason) || ""}`, le = Wa({ status: fe, reason: he, sessionJobId: t });
        if (le && (await ns({
          apiPrefix: Zn,
          documentId: le,
          expiredJobId: t
        }) || V.isClosedOrStale()))
          return;
        if (Ua({
          status: fe,
          reason: he,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          d({ type: "missing-document-job", documentId: r, jobId: t }), d({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const de = Z instanceof Error ? Z.message : _e.failed;
        U(de, de);
      }
    }
    return ce(), () => {
      ae.abort(), v.current === ae && (v.current = null);
    };
  }, [t, r, o, a, s, i, l, b, n, c, d, u, f, m]), {
    sourceUrl: S,
    translatedUrl: h,
    sourceFile: T,
    translatedFile: z,
    assetsReady: x,
    title: E,
    regions: k,
    regionsSettled: B,
    readerMetadata: J,
    readerErrors: q,
    boot: pe
  };
}
function os() {
  const e = _(!1), t = _(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = _a(), s = _({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = _(a), c = _(""), l = _(""), d = _(() => {
  }), u = O(() => d.current(), []), f = La({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: c,
    sessionJobIdRef: l,
    switchToSourceMode: u
  }), {
    sessionJobId: m,
    documentId: b,
    sourceOnly: p,
    sourceViewOnly: w
  } = f, { mode: v, setMode: S, switchSessionMode: P } = Fa(w);
  d.current = () => {
    P("source");
  }, i.current = a, c.current = b, l.current = m;
  const h = za({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: y,
    scopedManifestPayload: T,
    jobStatus: M,
    jobTerminal: z,
    jobRefreshRevision: D,
    refreshJobArtifacts: x,
    refreshJobStatus: R
  } = h, E = rs({
    sessionJobId: m,
    jobId: r,
    routeDocumentId: o,
    documentJobId: f.documentJobId,
    rejectedDocumentJobId: f.rejectedDocumentJobId,
    sourceOnly: p,
    locationKey: n,
    sessionIdentity: a,
    committedSource: f.activeCommittedDocumentSource,
    applyIdentityEvent: f.applyIdentityEvent,
    publishPayload: h.publishPayload,
    clearPayload: h.clearPayload,
    switchSessionMode: P,
    jobRefreshRevision: D,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), I = O(() => {
    var A;
    e.current = !0, (A = t.current) == null || A.abort();
  }, []), k = G(
    () => ({
      fetchProtected: Rt().fetchProtected,
      jobId: m,
      jobPayload: y,
      manifestPayload: T,
      sourceUrl: E.sourceUrl,
      translatedUrl: E.translatedUrl,
      sourceOnly: w
    }),
    [m, y, T, E.sourceUrl, E.translatedUrl, w]
  );
  return {
    jobId: m,
    jobStatus: M,
    workflow: `${(y == null ? void 0 : y.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: z,
    documentId: b,
    sessionIdentity: a,
    sourceOnly: p,
    mode: v,
    setMode: S,
    sourceUrl: E.sourceUrl,
    translatedUrl: E.translatedUrl,
    sourceFile: E.sourceFile,
    translatedFile: E.translatedFile,
    assetsReady: E.assetsReady,
    boot: E.boot,
    title: E.title,
    regions: E.regions,
    regionsSettled: E.regionsSettled,
    readerMetadata: E.readerMetadata,
    readerErrors: E.readerErrors,
    download: k,
    refreshJobArtifacts: x,
    refreshJobStatus: R,
    refreshCommittedDocument: f.refreshCommittedDocument,
    prepareClose: I
  };
}
const as = 160, ss = 8, is = 0;
function cs() {
  const e = _(null), [t, n] = N(null), [r, o] = N(is), a = O((s) => {
    e.current = s, n(s);
  }, []);
  return $(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < as || o((d) => Math.abs(d - l) < ss ? d : l);
    }, c = new ResizeObserver((l) => {
      var d, u;
      i(((u = (d = l[0]) == null ? void 0 : d.contentRect) == null ? void 0 : u.width) ?? s.clientWidth);
    });
    return c.observe(s), i(s.clientWidth), () => c.disconnect();
  }, [t]), {
    shellRef: e,
    shellEl: t,
    shellWidth: r,
    bindShell: a
  };
}
function ls(e) {
  const { mode: t, sourceOnly: n, assetsReady: r, hasSource: o, hasTranslated: a } = e, s = r && o, i = r && a && !n, c = t === "source" || t === "compare", l = !n && (t === "translated" || t === "compare");
  return {
    mountSource: s,
    mountTranslated: i,
    showSource: c,
    showTranslated: l,
    compareMode: t === "compare" && c && l && s && i,
    primaryPane: t === "translated" ? "translated" : "source"
  };
}
const qt = { source: 0, translated: 0 };
function ds(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: c
  } = e, l = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, d = _(l);
  d.current = l;
  const [u, f] = N(() => ({
    identity: l,
    pages: qt
  })), [m, b] = N(() => ({ identity: l, tick: 0 })), p = u.identity === l ? u.pages : qt, w = m.identity === l ? m.tick : 0, v = ls({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: S } = v, P = O((R, E) => {
    d.current === l && f((I) => {
      const k = I.identity === l ? I.pages : qt;
      return k[E] === R && I.identity === l ? I : {
        identity: l,
        pages: { ...k, [E]: R }
      };
    });
  }, [l]), h = _(null), y = O(() => {
    h.current && clearTimeout(h.current);
    const R = l;
    h.current = setTimeout(() => {
      h.current = null, d.current === R && b((E) => ({
        identity: R,
        tick: E.identity === R ? E.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  $(() => (h.current && (clearTimeout(h.current), h.current = null), f((R) => R.identity === l && R.pages.source === 0 && R.pages.translated === 0 ? R : { identity: l, pages: { source: 0, translated: 0 } }), b((R) => R.identity === l && R.tick === 0 ? R : { identity: l, tick: 0 }), () => {
    h.current && (clearTimeout(h.current), h.current = null);
  }), [l]);
  const T = G(
    () => Math.max(p.source, p.translated),
    [p]
  ), M = S === "translated" ? p.translated : p.source || p.translated, z = t == null ? void 0 : t.userZoom, D = t == null ? void 0 : t.shellWidth, x = `${l}-${w}-${z}-${n}-${p.source}-${p.translated}-${D}`;
  return {
    ...v,
    numPagesByPane: p,
    hudNumPages: T,
    primaryNumPages: M,
    metricsTick: w,
    onNumPages: P,
    onMetrics: y,
    rowSyncRevision: x
  };
}
const Ve = "data-reader-page", ot = "data-reader-pane", En = "data-natural-height", us = "reader-react-root", fs = "reader-react-grid", ms = "reader-react-scroll-shell", hs = "reader-react-pdf-pane", Jr = "reader-react-pdf-page", zt = "reader-react-pdf-page-placeholder", In = "reader-react-pdf-page-slot";
function Ot(e, t) {
  const n = e != null ? `[${Ve}="${e}"]` : `[${Ve}]`;
  return t ? `${n}[${ot}="${t}"]` : n;
}
function ps() {
  return `.${In}[${Ve}]`;
}
function Ft(e) {
  return Number(e.getAttribute(Ve));
}
const Kr = 0.25, $t = 1, gs = 0.05, Pt = 0.5, bs = 16, ys = 8, vs = 720;
function We() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Gr(e) {
  return Number.isFinite(e) && e < vs;
}
function et(e, t = Number.POSITIVE_INFINITY) {
  return Gr(t) && (e === "source" || e === "translated") ? $t : Pt;
}
function Wt(e) {
  return Number.isFinite(e) ? Math.min($t, Math.max(Kr, e)) : Pt;
}
function bt(e, t) {
  const n = Wt(Number(e) + t * gs);
  return Math.round(n * 100) / 100;
}
function ws(e) {
  return Math.round(Wt(e) * 100);
}
function Ss(e) {
  const n = (Number(e) || 0) - bs - ys;
  return Math.max(160, Math.floor(n));
}
function Rs(e, t = Pt) {
  const n = Wt(t);
  return Ss((Number(e) || 0) * n);
}
function Ps(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${ot}]`)
  ).map((s) => ({
    pane: s,
    cx: s.scrollLeft + s.clientWidth / 2,
    hadOverflow: s.scrollWidth > s.clientWidth + 1
  })), a = () => {
    e.scrollLeft = Math.max(0, n * t - e.clientWidth / 2), e.scrollTop = Math.max(0, r * t - e.clientHeight / 2);
    for (const { pane: s, cx: i, hadOverflow: c } of o) {
      const l = Math.max(0, s.scrollWidth - s.clientWidth);
      if (l <= 0) {
        s.scrollLeft = 0;
        continue;
      }
      c ? s.scrollLeft = Math.min(
        l,
        Math.max(0, i * t - s.clientWidth / 2)
      ) : s.scrollLeft = l / 2;
    }
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(a);
  });
}
const Es = 8;
function Is(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Es ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const qr = 200, Zr = [
  "markdown"
], Ts = Zr;
function Yr(e) {
  return Ts.includes(e);
}
const ks = "retainpdf:reader:view:v1:", tr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), As = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function Xr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function dn(e) {
  return `${e || ""}`.trim();
}
function Ms({
  documentId: e,
  jobId: t
}) {
  const n = dn(e);
  if (n) return `document:${n}`;
  const r = dn(t);
  return r ? `job:${r}` : "";
}
function Qr(e) {
  const t = dn(e);
  return t ? `${ks}${t}` : "";
}
function Ns(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function _s(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!tr.has(t) || !tr.has(n) || t === n))
    return { left: t, right: n };
}
function Ls(e) {
  return e === null ? null : Yr(e) ? e : void 0;
}
function Ds(e) {
  return As.has(e) ? e : void 0;
}
function eo(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Ns(t.anchor), r = Number(t.zoom), o = Ds(t.mode), a = _s(t.splitLayout), s = Ls(t.assistantPanel);
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
function ke(e, t = Xr()) {
  const n = Qr(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? eo(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function Vt(e, t, n = Xr()) {
  const r = Qr(e);
  if (!r || !n) return null;
  const o = ke(e, n), a = eo({
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
function Cs(e, t, n = "") {
  var f;
  const [r, o] = N(() => {
    var m;
    return ((m = ke(n)) == null ? void 0 : m.zoom) ?? et(e, We());
  }), a = _(r), s = _(n);
  a.current = r;
  const i = _(1), c = _(((f = ke(n)) == null ? void 0 : f.zoom) !== void 0);
  $(() => {
    var p;
    if (s.current === n) return;
    s.current = n;
    const m = (p = ke(n)) == null ? void 0 : p.zoom;
    c.current = m !== void 0;
    const b = m ?? et(e, We());
    i.current = 1, a.current = b, o(b);
  }, [e, n]), $(() => {
    if (c.current) return;
    const m = et(e, We()), b = a.current;
    Math.abs(m - b) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const l = O((m) => {
    const b = Wt(m), p = a.current;
    Math.abs(b - p) < 5e-4 || (i.current = b / (p || 1), c.current = !0, Vt(s.current, { zoom: b }), o(b));
  }, []), d = O((m) => {
    l(bt(a.current, m));
  }, [l]), u = O((m) => {
    l(et(m));
  }, [l]);
  return Ae(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, Ps(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: d, resetZoom: u };
}
function xs(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = _(t), a = _(n), s = _(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: O((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const Tn = 48;
function to(e, t = Tn) {
  return e.getBoundingClientRect().top + t;
}
function no(e, t) {
  if (!e.length)
    return null;
  let n = null, r = -1 / 0;
  for (const c of e) {
    const l = c.getBoundingClientRect();
    l.height < 8 || l.width < 8 || l.top <= t + 1 && l.top >= r && (n = c, r = l.top);
  }
  if (!n && (n = e.find((l) => {
    const d = l.getBoundingClientRect();
    return d.height >= 8 && d.width >= 8;
  }) ?? null, n)) {
    const l = [...e].reverse().find((d) => {
      const u = d.getBoundingClientRect();
      return u.height >= 8 && u.width >= 8;
    });
    l && l.getBoundingClientRect().bottom < t && (n = l);
  }
  if (!n)
    return null;
  const o = Ft(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Lt(e, t, n = Tn) {
  if (!e)
    return null;
  const r = Ot(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = to(e, n), i = no(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function yt(e, t, n = "auto", r, o = Tn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(Ot(a, r))), i || (i = e.querySelector(Ot(a))), !i)
    return !1;
  const c = e.getBoundingClientRect(), l = i.getBoundingClientRect();
  if (c.height <= 0 || l.height < 8 && i.offsetHeight < 8)
    return !1;
  const d = l.height > 0 ? l.height : i.offsetHeight, u = e.scrollTop + (l.top - c.top), f = Math.max(0, u + s * d - o);
  return n === "auto" ? Math.abs(e.scrollTop - f) >= 1 && (e.scrollTop = f) : e.scrollTo({ top: f, behavior: n }), !0;
}
function zs(e, t, n = "smooth", r) {
  return yt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function un(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], c = () => {
    var d;
    if (a) return;
    yt(
      e(),
      t,
      r,
      n == null ? void 0 : n.pane
    ) && !s && (s = !0, (d = n == null ? void 0 : n.onDone) == null || d.call(n));
  };
  for (const l of o)
    l <= 0 ? requestAnimationFrame(() => {
      requestAnimationFrame(c);
    }) : i.push(setTimeout(c, l));
  return () => {
    a = !0;
    for (const l of i)
      clearTimeout(l);
  };
}
function Os(e, t, n) {
  return un(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function jt(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function Pe(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Fs(e, t, n = !0, r = "", o) {
  const [a, s] = N(1);
  return $(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let c = !1, l = null, d = 0;
    const u = Ot(void 0, o), f = () => {
      if (c) return;
      const p = Array.from(i.querySelectorAll(u));
      if (!p.length)
        return;
      const w = to(i), v = no(p, w);
      v && s(v.page);
    }, m = () => {
      c || (d && cancelAnimationFrame(d), d = requestAnimationFrame(() => {
        d = 0, f();
      }));
    }, b = () => {
      if (c) return;
      if (!Array.from(i.querySelectorAll(u)).length) {
        l = setTimeout(b, 120);
        return;
      }
      f(), i.addEventListener("scroll", m, { passive: !0 });
    };
    return b(), () => {
      c = !0, l && clearTimeout(l), d && cancelAnimationFrame(d), i.removeEventListener("scroll", m);
    };
  }, [e, t, n, r, o]), a;
}
const $s = `canvas, .react-pdf__Page, .${Jr}, .${zt}`, nr = /* @__PURE__ */ new WeakMap();
function js(e) {
  const t = Number(e.getAttribute(En));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = nr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector($s), nr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Bs(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Us(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(ps()).forEach((r) => {
    const o = Ft(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = js(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Hs(e, t, n = "", r) {
  const [o, a] = N(() => /* @__PURE__ */ new Map()), s = _(o), i = _(r);
  return i.current = r, Ae(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let c = !1, l = 0, d = !1, u = !1;
    const f = () => {
      var y;
      if (c) return;
      const P = e.current;
      if (!P) return;
      const h = Us(P);
      Bs(s.current, h) || (s.current = h, a(h)), d && !u && (u = !0, (y = i.current) == null || y.call(i));
    }, m = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(f);
      });
    };
    m();
    const b = window.setTimeout(m, 100), p = window.setTimeout(() => {
      d = !0, m();
    }, 300), w = window.setTimeout(m, 700), v = e.current;
    let S = null;
    return v && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => m()), S.observe(v)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(b), window.clearTimeout(p), window.clearTimeout(w), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const Ws = [0, 48, 140, 320, 560], Vs = 700, Js = [80, 200, 400], Ks = 500, Gs = 50, qs = /* @__PURE__ */ new Set([
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
]), Zs = 180, rr = [0, 48, 140, 320, 700, 1200];
function Ys(e, t) {
  var E;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = _(
    ((E = ke(a)) == null ? void 0 : E.anchor) || { page: 1, fraction: 0 }
  ), c = _(null), l = _(!1), d = _(r), u = _(null), f = _(null), m = _(null), b = _(null), p = _(a), w = _(""), v = _(n);
  v.current = n;
  const S = O(() => {
    var I;
    (I = u.current) == null || I.call(u), u.current = null, f.current != null && (clearTimeout(f.current), f.current = null);
  }, []), P = O(() => {
    !l.current && c.current == null || (S(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [S]), h = O((I = !1) => {
    b.current != null && (clearTimeout(b.current), b.current = null);
    const k = () => {
      b.current = null, Vt(p.current, {
        anchor: Pe(i.current)
      });
    };
    I ? k() : b.current = setTimeout(k, Zs);
  }, []), y = O((I) => {
    i.current = Pe(I), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, Gs);
  }, []);
  $(() => {
    if (!o)
      return;
    let I = !1, k = null, A = null, B = null;
    const C = () => {
      if (I) return;
      const J = e.current;
      if (!J) {
        B = setTimeout(C, 50);
        return;
      }
      k = J, A = () => {
        if (l.current)
          return;
        const re = Lt(k, v.current);
        re && (i.current = re, h());
      }, k.addEventListener("scroll", A, { passive: !0 }), l.current || A();
    };
    return C(), () => {
      I = !0, B != null && clearTimeout(B), k && A && k.removeEventListener("scroll", A);
    };
  }, [o, r, n, e, h]), $(() => {
    if (!o) return;
    const I = e.current;
    if (!I) return;
    const k = (A) => {
      A.metaKey || A.ctrlKey || A.altKey || qs.has(A.key) && P();
    };
    return I.addEventListener("wheel", P, { passive: !0 }), I.addEventListener("touchmove", P, { passive: !0 }), window.addEventListener("keydown", k), () => {
      I.removeEventListener("wheel", P), I.removeEventListener("touchmove", P), window.removeEventListener("keydown", k);
    };
  }, [o, e, P]), Ae(() => {
    var k;
    if (p.current === a) return;
    h(!0), S(), m.current != null && (clearTimeout(m.current), m.current = null), p.current = a, w.current = "";
    const I = (k = ke(a)) == null ? void 0 : k.anchor;
    i.current = I ? Pe(I) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, d.current = r;
  }, [a, r, h, S]), $(() => {
    var k;
    if (!o || !s || !a || w.current === a) return;
    w.current = a;
    const I = Pe(
      ((k = ke(a)) == null ? void 0 : k.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = I, c.current = I, l.current = !0, S(), u.current = un(
      () => e.current,
      I,
      {
        behavior: "auto",
        pane: v.current,
        delaysMs: rr,
        onDone: () => y(I)
      }
    ), f.current = setTimeout(() => {
      f.current = null, y(I);
    }, Math.max(...rr) + 160), () => S();
  }, [o, s, a, e, y, S]), $(() => {
    if (d.current === r)
      return;
    if (d.current = r, !o) {
      l.current = !1, c.current = null, S();
      return;
    }
    const I = c.current ? Pe(c.current) : Pe(i.current);
    return l.current = !0, c.current = I, i.current = I, S(), u.current = un(
      () => e.current,
      I,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Ws,
        onDone: () => y(I)
      }
    ), f.current = setTimeout(() => {
      f.current = null, y(I);
    }, Vs), () => {
      S();
    };
  }, [r, o, n, e, y, S]), $(() => () => {
    S(), m.current != null && (clearTimeout(m.current), m.current = null), h(!0);
  }, [S, h]);
  const T = O(() => {
    const I = Lt(
      e.current,
      v.current
    );
    return Pe(I || i.current);
  }, [e]), M = O(() => {
    l.current = !0;
    const I = Lt(
      e.current,
      v.current
    ), k = Pe(I ?? i.current);
    return i.current = k, c.current = k, h(), k;
  }, [e, h]), z = O((I, k, A) => {
    const B = A || v.current, C = jt(I, k || 1), J = { page: C, fraction: 0 };
    i.current = J, l.current = !0, c.current = J, h(), S(), zs(e.current, C, "smooth", B), u.current = Os(
      () => e.current,
      C,
      {
        behavior: "auto",
        pane: B,
        delaysMs: Js,
        onDone: () => y(J)
      }
    ), f.current = setTimeout(() => {
      f.current = null, y(J);
    }, Ks);
  }, [e, y, S, h]), D = O(() => Pe(i.current), []), x = O(() => l.current, []), R = O(() => {
    if (!l.current || !c.current)
      return;
    const I = Pe(c.current);
    yt(
      e.current,
      I,
      "auto",
      v.current
    );
  }, [e]);
  return {
    lockFromShell: T,
    beginModeSwitch: M,
    goToPage: z,
    getAnchor: D,
    isRestoring: x,
    repinIfRestoring: R
  };
}
function Xs(e, t) {
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
function ro(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Qs = [0, 80, 200, 400, 800], ei = 120, ti = 400;
function ni(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: d = !0 } = e, u = _(a);
  u.current = a;
  const f = _(s);
  f.current = s;
  const m = _(i);
  m.current = i;
  const b = _(n);
  b.current = n, $(() => {
    var h, y;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const p = Pa(), w = Xs(p, f.current);
    if (w == null && (p != null && p.blockId) && !d) return;
    const v = ro(p, w, { jobId: c, documentId: l });
    if (t.current === v)
      return;
    if (w == null) {
      t.current = v, (h = b.current) == null || h.call(b);
      return;
    }
    t.current = v, p && ((y = m.current) == null || y.call(m, p, w));
    const S = [];
    let P = 0;
    for (const T of Qs)
      P = Math.max(P, T), S.push(
        setTimeout(() => {
          u.current(w);
        }, T)
      );
    return S.push(
      setTimeout(() => {
        var T;
        (T = b.current) == null || T.call(b);
      }, P + ei)
    ), () => {
      for (const T of S) clearTimeout(T);
    };
  }, [r, o, c, l, t, d]);
}
function ri(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function oi(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = ti,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, d = _(a);
  d.current = a;
  const u = _(l);
  u.current = l;
  const f = _(0);
  $(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || f.current === o) return;
    const m = setTimeout(() => {
      var v;
      const b = ((v = globalThis.location) == null ? void 0 : v.search) || "", p = Ko(b, o, d.current);
      if (f.current = o, p === null) return;
      const w = `${new URLSearchParams(p).get("block_id") || ""}`.trim();
      t.current = ro(
        { blockId: w },
        o,
        { jobId: i, documentId: c }
      ), (u.current || ri)(p);
    }, s);
    return () => clearTimeout(m);
  }, [
    n,
    r,
    o,
    s,
    i,
    c,
    t
  ]);
}
function ai(e) {
  const t = _(""), [n, r] = N(!1), o = O(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  ni(a, t, o), oi(e, t, n);
}
const dt = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function si(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function or(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function oo(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = or(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = or(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function ii(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = oo(r, t, n);
  if (o === "retry") return e;
  if (o === "ignore")
    return { ...e, lastSeq: t.seq, connection: "live", error: "" };
  const a = new Map(n.items.map((c) => [c.item_id, c])), s = new Map((r == null ? void 0 : r.changedAtSeqById) || []);
  for (const c of t.changed_item_ids)
    a.has(c) && s.set(c, t.seq);
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
function ci(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    sourcePaneToggle: t && r,
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
const ar = [250, 500, 1e3, 2e3, 4e3], Zt = [80, 160, 320, 640, 1e3, 1500], sr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function fn(e, t) {
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
function kn(e) {
  return ta(e) ? `${e.code || ""}`.trim() : "";
}
function At(e, t) {
  const n = kn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function li(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (oo(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = na(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = kn(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = Zt[Math.min(s, Zt.length - 1)];
    if (await fn(i, r), s >= Zt.length + 2) throw a;
  }
}
function di({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = N(dt), s = _(o), i = _("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), d = pt(l) ? l : "";
  return $(() => {
    if (!n || !c) {
      i.current = "", s.current = dt, a(dt);
      return;
    }
    const u = r === void 0 ? Ra() : r, f = i.current === c;
    if (i.current = c, !u) {
      const P = {
        ...f ? s.current : dt,
        connection: d ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = P, a(P);
      return;
    }
    const m = new AbortController();
    let b = !1;
    const p = {
      ...f ? s.current : dt,
      connection: d ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = p, a(p);
    const w = (P) => {
      m.signal.aborted || a((h) => {
        const y = P(h);
        return s.current = y, y;
      });
    }, v = async () => {
      let P = 0;
      for (; !m.signal.aborted; )
        try {
          const h = await u.fetchLayout(c, { signal: m.signal });
          b = !0, w((y) => ({
            ...y,
            layoutByPage: si(h),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (h) {
          if ((h == null ? void 0 : h.name) === "AbortError") return;
          const y = kn(h);
          if (!(y === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !y)) {
            w((M) => ({
              ...M,
              connection: d ? "terminal" : "unavailable",
              jobStatus: l,
              error: At(h, "实时译文暂不可用")
            }));
            return;
          }
          if (d) {
            w((M) => ({
              ...M,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          w((M) => ({
            ...M,
            connection: "connecting",
            jobStatus: l,
            error: At(h, "正在等待 OCR 版面数据")
          })), await fn(ar[Math.min(P, ar.length - 1)], m.signal).catch(() => {
          }), P += 1;
        }
    };
    return (async () => {
      if (await v(), !b || m.signal.aborted) return;
      let P = 0;
      for (; !m.signal.aborted; ) {
        d || w((h) => ({
          ...h,
          connection: h.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: l,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: h.error
        }));
        try {
          await u.streamEvents(c, {
            afterSeq: s.current.lastSeq,
            signal: m.signal,
            onEvent: async (h) => {
              if (h.seq <= s.current.lastSeq) return;
              let y;
              try {
                y = await li(
                  c,
                  h,
                  s.current,
                  m.signal,
                  u
                );
              } catch (T) {
                if ((T == null ? void 0 : T.name) === "AbortError" || m.signal.aborted) throw T;
                w((M) => ({
                  ...M,
                  lastSeq: Math.max(M.lastSeq, h.seq),
                  error: At(T, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              w((T) => {
                const M = ii(T, h, y);
                return d ? {
                  ...M,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...M,
                  jobStatus: l
                };
              }), P = 0;
            }
          });
        } catch (h) {
          if ((h == null ? void 0 : h.name) === "AbortError" || m.signal.aborted) return;
          w((y) => ({
            ...y,
            connection: d ? "terminal" : "reconnecting",
            jobStatus: l,
            error: At(h, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (d) {
          w((h) => ({
            ...h,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await fn(sr[Math.min(P, sr.length - 1)], m.signal).catch(() => {
        }), P += 1;
      }
    })(), () => m.abort();
  }, [n, r, c, d]), o;
}
function ui(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function fi(e, t = !0) {
  const [n, r] = N(() => /* @__PURE__ */ new Map());
  return $(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Rt().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(ui(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const mi = 4500;
function hi(e) {
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
const pi = /* @__PURE__ */ new Set(["book", "translate"]);
function ao(e) {
  return !!(e.jobId && e.sourceUrl && pi.has(e.workflow));
}
function gi(e) {
  return !!(ao(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function bi() {
  const e = os(), t = ao({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = gi({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = _({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !pt(o) && (r.current.running = !0);
  const a = di({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = cs(), d = fi(e.jobId, !e.sourceOnly), u = Ms({
    documentId: e.documentId,
    jobId: e.jobId
  }), f = `${u}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: b } = Cs(e.mode, s, u), p = ds(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: m, shellWidth: c, identityKey: f }
  ), {
    beginModeSwitch: w,
    goToPage: v,
    repinIfRestoring: S
  } = Ys(s, {
    primaryPane: p.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: u,
    restoreReady: p.primaryNumPages > 0
  });
  $(() => {
    S();
  }, [c, S]);
  const P = Hs(
    s,
    p.compareMode,
    p.rowSyncRevision,
    S
  ), h = Fs(
    s,
    p.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${p.metricsTick}`,
    p.primaryPane
  ), y = O((C, J) => {
    var q, X;
    const re = Math.max(
      Number(p.hudNumPages) || 0,
      Number(p.primaryNumPages) || 0,
      Number((q = p.numPagesByPane) == null ? void 0 : q.source) || 0,
      Number((X = p.numPagesByPane) == null ? void 0 : X.translated) || 0
    );
    v(C, re, J);
  }, [v, p.hudNumPages, p.primaryNumPages, p.numPagesByPane]), [T, M] = N(null), z = _(null), D = O((C) => {
    z.current && clearTimeout(z.current), M(C), C && (z.current = setTimeout(() => M(null), mi));
  }, []);
  $(() => () => {
    z.current && clearTimeout(z.current);
  }, []);
  const x = O((C) => {
    const J = Gt(e.regions, C);
    return J ? Jn(J, p.primaryPane).page : null;
  }, [e.regions, p.primaryPane]), R = O((C, J) => {
    const re = J || p.primaryPane, q = typeof C == "object" && C ? `${C.block_id || ""}`.trim() : "", X = typeof C == "object" && C ? `${C.image_url || ""}`.trim() : "", pe = typeof C == "object" && C ? C.page_idx != null ? Number(C.page_idx) + 1 : C.page != null ? Number(C.page) : null : typeof C == "number" ? C + 1 : null, oe = Zo(e.regions, X, pe) || Gt(e.regions, q) || (typeof C == "object" ? Yo(e.regions, C) : null);
    let ae = oe ? Jn(oe, re).page : null;
    ae == null && (ae = hi(C)), !(ae == null || ae < 1) && (D(oe), y(ae, re));
  }, [D, y, p.primaryPane, e.regions]);
  ai({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: p.hudNumPages || 0,
    currentPage: h,
    goToPage: y,
    resolveBlockPage: x,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (C) => {
      D(Gt(e.regions, C.blockId));
    }
  });
  const { setModeKeepingPage: E } = xs({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: w
  });
  $(() => {
    D(null);
  }, [f, D]);
  const I = !e.boot.loading && !e.boot.failed, k = G(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), A = G(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), B = G(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: b,
    shell: k,
    panes: p,
    sessionFiles: A,
    rowHeights: P,
    goToPage: y,
    activeRegion: T,
    jumpToAnchor: R,
    setModeKeepingPage: E,
    download: e.download,
    showHud: I,
    viewStateKey: u,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: d
  }), [e, k, p, A, P, y, T, R, E, I, m, b, u, a, n, d]);
  return G(() => ({
    ...B,
    currentPage: h
  }), [B, h]);
}
const yi = [
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
], vi = [
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
function wi(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of yi)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Si(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Ri = ".reader-notes-panel";
function Pi(e) {
  return e instanceof Element ? !!e.closest(Ri) : !1;
}
function Ei(e) {
  const {
    mode: t,
    sourceOnly: n,
    setMode: r,
    userZoom: o,
    onZoomChange: a,
    currentPage: s,
    numPages: i,
    goToPage: c,
    enabled: l = !0
  } = e;
  $(() => {
    if (!l)
      return;
    const d = (u) => {
      if (u.defaultPrevented || u.metaKey || u.ctrlKey || u.altKey || Si(u.target) || Pi(u.target))
        return;
      const f = u.key, m = wi(f);
      if (m) {
        if (m.mode) {
          if (n && m.mode !== "source")
            return;
          u.preventDefault(), r(m.mode);
          return;
        }
        if (!(m.requiresPages && i <= 0))
          switch (u.preventDefault(), m.action) {
            case "zoom-in":
              a(bt(o, 1));
              return;
            case "zoom-out":
              a(bt(o, -1));
              return;
            case "zoom-reset":
              a(et(t, We()));
              return;
            case "next-page":
              c(jt(s + 1, i));
              return;
            case "prev-page":
              c(jt(s - 1, i));
              return;
            case "first-page":
              c(1);
              return;
            case "last-page":
              c(i);
              return;
          }
      }
    };
    return window.addEventListener("keydown", d), () => window.removeEventListener("keydown", d);
  }, [
    l,
    t,
    n,
    r,
    o,
    a,
    s,
    i,
    c
  ]);
}
const Ii = "retainpdf:soft-reader-close";
function Ti() {
  return new URL("./index.html", window.location.href).href;
}
function ki() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Ii },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Ai(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Mi() {
  if (!(typeof window > "u") && !ki()) {
    if (Ai(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Ti());
  }
}
function Ni({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ g("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function _i({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ F(Ni, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Mi();
  }, children: [
    /* @__PURE__ */ g(Pn, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ g("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
let ir = !1;
function Li() {
  if (ir)
    return;
  const e = gt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Hr.GlobalWorkerOptions.workerSrc = e, ir = !0);
}
const Di = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Ci(e, t, n) {
  return e.flatMap((r) => {
    if (!Di.has(Ht(r.region))) return [];
    const o = Rn(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function cr(e, t, n) {
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
async function xi(e) {
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
const zi = "reader-text-hover-copy", Oi = "reader-text-hover-edit", Fi = "reader-text-hover-id";
function $i(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const so = "reader-text-hover-tools";
function Yt({
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
const io = 26, co = 220;
function lo(e, t = co) {
  return e.height < io * 2 || e.width < t;
}
function ji({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r
}) {
  const [o, a] = N("idle"), [s, i] = N("idle"), [c] = N(() => $i()), l = _([]), d = (e == null ? void 0 : e.itemId) || "";
  if ($(() => {
    a("idle"), i("idle");
    const w = l.current;
    return () => {
      w.forEach((v) => window.clearTimeout(v)), l.current = [];
    };
  }, [d]), !e) return null;
  const u = Xo(e.highlight.region, t), f = Ht(e.highlight.region), m = (w, v) => async (S) => {
    S.preventDefault(), S.stopPropagation();
    const P = await xi(w);
    v(P ? "copied" : "failed"), l.current.push(window.setTimeout(() => v("idle"), 1200));
  }, b = f === "formula" ? "复制 LaTeX" : "复制", p = lo(e.rect);
  return /* @__PURE__ */ g("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ g(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": f,
      style: e.rect,
      children: /* @__PURE__ */ F(
        "div",
        {
          className: so,
          "data-placement": p ? "outside" : "inside",
          children: [
            c ? /* @__PURE__ */ g(
              Yt,
              {
                className: Fi,
                state: s,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: m(e.itemId, i),
                children: s === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && n > 0 ? /* @__PURE__ */ F("span", { className: "reader-text-hover-revised", "data-reader-revised-count": n, children: [
              "改过 ",
              n,
              " 次"
            ] }) : null,
            t === "translated" && r ? /* @__PURE__ */ g(
              Yt,
              {
                className: Oi,
                state: "idle",
                label: "改这段译文",
                title: "改这段译文（E）",
                onClick: (w) => {
                  w.preventDefault(), w.stopPropagation(), r(e.itemId);
                },
                children: "改"
              }
            ) : null,
            u ? /* @__PURE__ */ g(
              Yt,
              {
                className: zi,
                state: o,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                onClick: m(u, a),
                children: o === "copied" ? "已复制" : o === "failed" ? "复制失败" : b
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Bi(e, t) {
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
function Ui(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = Rn(
      Bi(e, a),
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
const Hi = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Wi = 256, ut = /* @__PURE__ */ new Map();
function Vi(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function uo(e) {
  const t = `${e || ""}`, { text: n, slots: r } = pa(t, { bareLatex: !0 }), o = Vi(n), a = ga(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = ut.get(t);
  if (!s && (s = ba(o, r), ut.set(t, s), ut.size > Wi)) {
    const i = ut.keys().next().value;
    i !== void 0 && ut.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Xt(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function De(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Ji(e, t) {
  const n = e.typography, r = De(t) || 1, o = De(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = Xt(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = De(n == null ? void 0 : n.fit_min_font_size_pt), d = De(n == null ? void 0 : n.fit_max_font_size_pt), u = Math.max(3.5, (l || 5.5) * r), f = Math.max(
    u,
    d ? d * r : o ? o * r : c
  ), m = o ? o * r : c, b = De(n == null ? void 0 : n.leading_em), p = [
    De(n == null ? void 0 : n.padding_top_pt) || 0,
    De(n == null ? void 0 : n.padding_right_pt) || 0,
    De(n == null ? void 0 : n.padding_bottom_pt) || 0,
    De(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((w) => w * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Hi,
    fontSizePx: Math.max(u, Math.min(f, m)),
    minFontSizePx: u,
    maxFontSizePx: f,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: b ? 1 + b : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Xt(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Xt(e.kind) ? "center" : "justify",
    padding: p,
    exact: !!o
  };
}
function Ki(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (u) => {
    const f = s.get(u);
    if (f !== void 0) return f;
    const { width: m, height: b } = e(u), p = m <= t + 0.5 && b <= n + 0.5;
    return s.set(u, p), p;
  };
  let c = o, l = a, d = Math.min(r.requestedFontSizePx, l);
  if (i(d)) {
    if (!r.exact) {
      c = d;
      for (let u = 0; u < 6 && l > c; u += 1) {
        const f = (c + l) / 2;
        i(f) ? (d = f, c = f) : l = f;
      }
    }
  } else {
    l = d, d = c;
    for (let u = 0; u < 8 && l > c; u += 1) {
      const f = (c + l) / 2;
      i(f) ? (d = f, c = f) : l = f;
    }
  }
  return Math.max(o, d);
}
const Gi = 512, ft = /* @__PURE__ */ new Map();
let mn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  mn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  mn += 1;
}));
function qi(e, t, n, r) {
  return [
    mn,
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
function fo({ item: e, pageScale: t }) {
  const n = _(null), r = G(
    () => uo(e.translatedText),
    [e.translatedText]
  ), [o, a] = N(r.fallbackHtml), s = G(
    () => Ji(e, t),
    [e, t]
  );
  $(() => {
    let u = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((f) => {
      u && a(f);
    }), () => {
      u = !1;
    };
  }, [r]), Ae(() => {
    const u = n.current;
    if (!u) return;
    const [f, m, b, p] = s.padding, w = Math.max(1, e.rect.width - p - m), v = Math.max(1, e.rect.height - f - b), S = qi(o, w, v, s);
    let P = ft.get(S);
    if (P === void 0 && (P = Ki(
      (h) => (u.style.fontSize = `${h}px`, { width: u.scrollWidth, height: u.scrollHeight }),
      w,
      v,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), ft.set(S, P), ft.size > Gi)) {
      const h = ft.keys().next().value;
      h !== void 0 && ft.delete(h);
    }
    u.style.fontSize = `${P.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [i, c, l, d] = s.padding;
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
        padding: `${i}px ${c}px ${l}px ${d}px`
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
function Zi({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = G(
    () => Ui(e, t, n, r),
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
        fo,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Yi = Ut(Zi);
function Xi({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ g("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ F("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ g(
        fo,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Ht(a.highlight.region),
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
const Qi = Ut(Xi);
function ie(e) {
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
    source: ie(e == null ? void 0 : e.source_text) || ie(e == null ? void 0 : e.unit_source_text),
    translated: ie(e == null ? void 0 : e.protected_translated_text) || ie(e == null ? void 0 : e.translated_text)
  };
}
const rc = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function mo(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function oc(e) {
  const t = mo(e).sort((r, o) => ie(r.ts).localeCompare(ie(o.ts)));
  return t.length ? [
    { text: ie(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: ie(r.new_text),
      label: rc[ie(r.source)] || ie(r.source) || "修订",
      ts: ie(r.ts),
      reason: ie(r.reason)
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
  return ie(r.finished_at) || ie(n.finished_at) || "";
}
function ic(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = mo(e).sort((a, s) => ie(a.ts).localeCompare(ie(s.ts)));
  for (const a of o) {
    const s = new Date(ie(a.ts)).getTime(), i = ie(a.reader_item_id) || ie(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, ie(a.new_text));
  }
  return n;
}
const cc = {
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
function lc(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = cc[ie(n.kind)] || ie(n.kind) || "问题", o = ie(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const dc = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function uc(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !dc.has(Ht(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const fc = 300, mc = 72;
function hc(e, t) {
  if (e.width >= fc && e.height >= mc)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
function pc({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = N(null), [i, c] = N(!1), [l, d] = N([]), [u, f] = N(""), [m, b] = N(""), [p, w] = N(!1), [v, S] = N(null), [P, h] = N([]), y = r.drafts, T = r.generation, M = O(async (R, E) => {
    if (e)
      try {
        d(oc(await e.fetchRevisions(R, E)));
      } catch {
        d([]);
      }
  }, [e]);
  $(() => {
    if (s(null), d([]), S(null), h([]), b(""), !e || !t || !n) return;
    let R = !1;
    return c(!0), e.loadItem(t, n).then((E) => {
      if (R) return;
      const I = E == null ? void 0 : E.item;
      if (!I) throw new Error("找不到这一段的译文。");
      const k = `${(E == null ? void 0 : E.item_id) || n}`, { source: A, translated: B } = nc(I);
      s({ readerItemId: n, itemId: k, source: A, current: B }), f(y.get(n) ?? B);
    }).catch((E) => {
      R || S({ tone: "error", message: (E == null ? void 0 : E.message) || "读取这段译文失败。" });
    }).finally(() => {
      R || c(!1);
    }), M(t, n), () => {
      R = !0;
    };
  }, [e, t, n, M]);
  const z = O((R) => {
    f(R), n && y.set(n, R);
  }, [n, y]), D = O(async (R, E) => {
    if (!e || !a || p) return !1;
    const I = R ?? u;
    if (!I.trim()) return !1;
    w(!0), S(null), h([]);
    try {
      const k = await e.revise(t, a.itemId, {
        translated_text: I,
        source: "user",
        reason: (E ?? m).trim() || "在阅读页手动修改",
        ...T.current != null ? { expected_generation: T.current } : {}
      }), A = Number(k == null ? void 0 : k.generation);
      return Number.isFinite(A) && (T.current = A), y.delete(a.readerItemId), s({ ...a, current: I }), f(I), b(""), (k == null ? void 0 : k.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, I), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), M(t, a.readerItemId), !0;
    } catch (k) {
      const A = k;
      return (A == null ? void 0 : A.reason) === "generation_mismatch" && (T.current = null), S({ tone: "error", message: (A == null ? void 0 : A.message) || "保存失败，请稍后再试。" }), h(lc(A == null ? void 0 : A.issues)), !1;
    } finally {
      w(!1);
    }
  }, [e, a, p, u, m, t, o, M, y, T]), x = O(() => {
    n && y.delete(n);
  }, [n, y]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: u,
    setDraft: z,
    reason: m,
    setReason: b,
    saving: p,
    status: v,
    issues: P,
    save: D,
    discardDraft: x
  };
}
const ho = "reader-inline-edit";
function gc({ text: e }) {
  const [t, n] = N("");
  return $(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = uo(e);
      n(a.fallbackHtml), a.richHtml.then((s) => {
        r && n(s);
      });
    }, 250);
    return () => {
      r = !1, window.clearTimeout(o);
    };
  }, [e]), t ? /* @__PURE__ */ F("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ g("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ g("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function bc({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var x;
  const s = e.itemId, i = pc({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = N(!1), [d, u] = N(!1), f = _(null), m = hc(e.rect, t), b = G(() => uc(o), [o]), p = b.indexOf(s), { loaded: w } = i, v = i.saving || i.loading, S = n.blockedReason, P = !w || i.draft === w.current, { close: h, select: y } = n, T = O((R) => {
    const E = b[p + R];
    E && (y(E), a == null || a(E));
  }, [b, p, y, a]), M = O(() => {
    i.discardDraft(), h();
  }, [i, h]), z = O(async (R, E) => {
    await i.save(R, E) && h();
  }, [i, h]);
  $(() => {
    const R = (E) => {
      !E.altKey || E.key !== "ArrowUp" && E.key !== "ArrowDown" || (E.preventDefault(), T(E.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", R), () => window.removeEventListener("keydown", R);
  }, [T]), Ae(() => {
    const R = f.current;
    if (!R) return;
    R.style.height = "auto";
    const E = m.mode === "inline" ? m.minHeight : 0;
    R.style.height = `${Math.max(E, R.scrollHeight + 2)}px`;
  }, [i.draft, w, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const D = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ F(st, { children: [
    m.mode === "popout" ? /* @__PURE__ */ g("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ F(
      "div",
      {
        className: `${ho} is-${m.mode}`,
        style: D,
        role: "group",
        "aria-label": `改第 ${((x = n.target) == null ? void 0 : x.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (R) => R.stopPropagation(),
        children: [
          r && (w != null && w.source) ? /* @__PURE__ */ g(
            ye,
            {
              className: `reader-inline-edit-source${c ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: c ? "收起原文" : "展开原文",
              onClick: () => l((R) => !R),
              children: w.source
            }
          ) : null,
          S ? /* @__PURE__ */ g("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: S }) : null,
          i.loading ? /* @__PURE__ */ g("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          w ? /* @__PURE__ */ g(
            fa,
            {
              ref: f,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: v || !!S,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (R) => i.setDraft(R.target.value),
              onKeyDown: (R) => {
                R.key === "Enter" && (R.metaKey || R.ctrlKey) ? (R.preventDefault(), P || z()) : R.key === "Escape" && (R.preventDefault(), M());
              }
            }
          ) : null,
          w ? /* @__PURE__ */ g(gc, { text: i.draft }) : null,
          /* @__PURE__ */ F("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ g(Gn, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: p <= 0, onClick: () => T(-1), children: /* @__PURE__ */ g(oa, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ g(Gn, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: p < 0 || p >= b.length - 1, onClick: () => T(1), children: /* @__PURE__ */ g(Fr, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ g(
              Ur,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: v || !!S || !w,
                onChange: (R) => i.setReason(R.target.value),
                onKeyDown: (R) => {
                  R.key === "Enter" ? (R.preventDefault(), P || z()) : R.key === "Escape" && (R.preventDefault(), M());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ F(
              ye,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": d,
                "data-block-edit-action": "history",
                onClick: () => u((R) => !R),
                children: [
                  /* @__PURE__ */ g(aa, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ g(ye, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: M, children: "取消" }),
            /* @__PURE__ */ g(
              ye,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: v || !!S || P || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  z();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ g("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ g("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((R) => /* @__PURE__ */ g("li", { children: R }, R)) }) : null,
          d && w && i.history.length ? /* @__PURE__ */ g("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((R, E) => {
            const I = R.text === w.current, k = [ac(R.ts), R.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ F("li", { "data-block-edit-history": R.label, "data-current": I ? "true" : void 0, children: [
              /* @__PURE__ */ F("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ F("span", { children: [
                  k,
                  I ? "（现在用的）" : "",
                  R.reason ? ` · ${R.reason}` : ""
                ] }),
                I ? null : /* @__PURE__ */ g(
                  ye,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: v || !!S,
                    onClick: () => {
                      z(R.text, `回到「${k.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ g("p", { className: "reader-inline-edit-history-text", children: R.text })
            ] }, `${R.ts}:${E}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const po = vn(null), go = vn(null);
function yc({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ g(po.Provider, { value: e, children: /* @__PURE__ */ g(go.Provider, { value: t, children: n }) });
}
function je() {
  return wn(po);
}
function bo() {
  return wn(go);
}
const Fe = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), vc = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, wc = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Sc = {
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
}, lr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Rc(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => lr(o ?? a ?? "", vc)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => lr(o ?? a ?? "", wc)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Sc[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Pc(e) {
  return Fe(e.translatedBlockText) || Fe(e.translated.text) || Fe(e.source.text);
}
const Ec = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Ic(e) {
  const t = [];
  for (const n of e) {
    if (!Ec(n)) continue;
    const r = Rc(Pc(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Tc(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const kc = 24, Ac = 60;
function dr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - kc), o = Math.min(e.length, n + t.length + Ac), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Mc(e, t, n = 200) {
  const r = Fe(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = Fe(a.translatedBlockText) || Fe(a.translated.text), c = i ? dr(i, r) : null, l = c ?? dr(Fe(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function Mt(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Nc(e, t) {
  const n = Fe(t).toLowerCase();
  if (!n || !e) return Mt(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${Mt(e.slice(a, s))}<mark class="reader-find-mark">${Mt(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + Mt(e.slice(a));
}
function _c(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const yo = 1.414;
function Lc({
  pageNumber: e,
  width: t,
  devicePixelRatio: n,
  pane: r,
  active: o = !1,
  textLayer: a = !0,
  syncedMinHeight: s = 0,
  onMetrics: i,
  cachedAspect: c,
  onAspectChange: l,
  sentinelRef: d,
  regionHighlight: u = null,
  regionTargets: f = [],
  hoveredRegionId: m,
  onHoverRegion: b,
  liveTranslationLayout: p,
  liveTranslationPage: w,
  showLiveTranslation: v = r === "source"
}) {
  var Me;
  const S = je(), P = S == null ? void 0 : S.revisedBlocks, h = S == null ? void 0 : S.blockEdit, y = h == null ? void 0 : h.pendingEdits, T = S == null ? void 0 : S.editBlock, M = (S == null ? void 0 : S.findTerm) || "", z = G(
    () => M ? ({ str: j }) => Nc(j, M) : void 0,
    [M]
  ), D = _(c ?? yo), [x, R] = N(D.current);
  $(() => {
    c != null && Math.abs(c - D.current) >= 1e-3 && (D.current = c, R(c));
  }, [c]);
  const E = _(d);
  E.current = d;
  const I = _(null), k = _((j) => {
    var ce;
    I.current = j, (ce = E.current) == null || ce.call(E, j);
  }).current, A = _(null), B = _(`${t}@${n}`);
  Ae(() => {
    const j = `${t}@${n}`;
    B.current !== j && (B.current = j, o && Cc(I.current, A.current));
  }, [o, n, t]), $(() => {
    o || Qt(A.current);
  }, [o]), $(() => () => Qt(A.current), []);
  const C = Math.max(120, Math.floor(t * x)), J = Math.max(C, Math.ceil(s || 0)), re = Rn(u, t, C), q = G(
    () => Ci(f, t, C),
    [C, f, t]
  ), [X, pe] = N(null), oe = typeof b == "function", ae = oe ? m ?? null : X, we = (j) => {
    oe ? j !== (m ?? null) && (b == null || b(j)) : pe((ce) => ce === j ? ce : j);
  }, V = G(
    () => q.find((j) => j.itemId === ae) || null,
    [ae, q]
  ), Q = r === "translated" && ((Me = h == null ? void 0 : h.target) == null ? void 0 : Me.itemId) || "", me = G(
    () => Q && q.find((j) => j.itemId === Q) || null,
    [Q, q]
  ), U = (j) => {
    var de, ue, Re, Ne;
    if (j.pointerType === "touch") return;
    if (j.buttons !== 0) {
      we(null);
      return;
    }
    if ((ue = (de = j.target) == null ? void 0 : de.closest) != null && ue.call(de, `.${so}`) || (Ne = (Re = j.target) == null ? void 0 : Re.closest) != null && Ne.call(Re, `.${ho}`)) return;
    const ce = j.currentTarget.getBoundingClientRect(), Z = j.clientX - ce.left, fe = j.clientY - ce.top, he = V == null ? void 0 : V.rect;
    if (he && lo(he) && Z >= he.left - 4 && Z <= he.left + co && fe >= he.top - io && fe <= he.top) return;
    const le = cr(q, Z, fe);
    we((le == null ? void 0 : le.itemId) || null);
  }, se = (j) => {
    if (j.pointerType === "mouse") return;
    const ce = j.currentTarget.getBoundingClientRect(), Z = cr(
      q,
      j.clientX - ce.left,
      j.clientY - ce.top
    );
    we((Z == null ? void 0 : Z.itemId) || null);
  }, Be = (j) => {
    !Number.isFinite(j) || j <= 0 || Math.abs(D.current - j) < 1e-3 || (D.current = j, R(j), l == null || l(e, j));
  };
  return /* @__PURE__ */ F(
    "div",
    {
      ref: k,
      [Ve]: e,
      [ot]: r,
      [En]: C,
      className: In,
      onPointerMoveCapture: U,
      onPointerDown: se,
      onPointerLeave: (j) => {
        j.pointerType === "mouse" && we(null);
      },
      style: {
        width: t,
        height: J,
        minHeight: J
      },
      children: [
        o ? /* @__PURE__ */ g(
          ma,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: z,
            renderAnnotationLayer: !1,
            className: Jr,
            loading: /* @__PURE__ */ g(
              "div",
              {
                className: zt,
                style: { width: t, height: C }
              }
            ),
            onLoadSuccess: (j) => {
              try {
                const ce = j.getViewport({ scale: 1 });
                if (ce.width > 0) {
                  const Z = ce.height / ce.width;
                  Be(Z);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Qt(A.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ g(
          "div",
          {
            className: zt,
            style: { width: t, height: C },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ g("div", { ref: A, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        re ? /* @__PURE__ */ g(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": u == null ? void 0 : u.itemId,
            style: re,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && v ? /* @__PURE__ */ g(
          Yi,
          {
            layoutPage: p,
            pageState: w,
            width: t,
            height: C
          }
        ) : null,
        o && r === "translated" && (y != null && y.size) ? /* @__PURE__ */ g(Qi, { targets: q, edits: y, width: t, excludeId: me == null ? void 0 : me.itemId }) : null,
        o && me && h ? /* @__PURE__ */ g(
          bc,
          {
            target: me,
            page: { width: t, height: C },
            edit: h,
            showSource: !!(S != null && S.editShowsSource),
            regions: S == null ? void 0 : S.regions,
            jumpToBlock: S == null ? void 0 : S.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (P != null && P.size) ? /* @__PURE__ */ g("div", { className: "reader-revised-markers", "aria-hidden": "true", children: q.filter((j) => P.has(j.itemId)).map((j) => /* @__PURE__ */ g(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": j.itemId,
            style: { left: j.rect.left, top: j.rect.top, height: j.rect.height }
          },
          j.itemId
        )) }) : null,
        /* @__PURE__ */ g(
          ji,
          {
            target: o && (V == null ? void 0 : V.itemId) !== (me == null ? void 0 : me.itemId) ? V : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: V && (P == null ? void 0 : P.get(V.itemId)) || 0,
            onEdit: T
          }
        )
      ]
    }
  );
}
const Dc = Ut(Lc);
function Cc(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function Qt(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const xc = 2 * 1024 * 1024;
function zc(e) {
  const t = new Hr.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const en = 5, Oc = "120% 0px", Fc = 120, $c = "25% 0px";
let ur = 1;
const fr = /* @__PURE__ */ new WeakMap();
function jc(e) {
  if (!e) return 0;
  const t = fr.get(e);
  if (t) return t;
  const n = ur;
  return ur += 1, fr.set(e, n), n;
}
function Bc() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Uc = $o(
  function({
    pane: t,
    url: n = "",
    preloadedFile: r = null,
    userZoom: o = 1,
    visible: a = !0,
    emptyLabel: s = "暂无 PDF",
    scrollRoot: i = null,
    pageWidthOverride: c = null,
    rowHeights: l,
    onMetrics: d,
    onLoadSuccess: u,
    onLoadError: f,
    onNumPagesChange: m,
    activeRegion: b = null,
    regions: p = [],
    readerMetadata: w = null,
    hoveredRegionId: v = null,
    onHoverRegion: S,
    liveTranslation: P,
    showLiveTranslation: h = t === "source",
    liveTranslationPendingLabel: y = "",
    paneAction: T
  }, M) {
    Li();
    const { file: z, loading: D, error: x } = Xa(n, r), R = `${n}\0${jc(z)}`, E = _(R);
    E.current = R;
    const I = G(() => {
      const L = Ja(z);
      return L ? "ranged" in L ? { range: zc(L.ranged) } : L : null;
    }, [z, n]), [k, A] = N(0), [B, C] = N(""), [J, re] = N(null), [q, X] = N(480), pe = _(null), oe = _(0), ae = G(() => Bc(), []), we = G(() => ({
      cMapUrl: gt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: gt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: xc,
      disableAutoFetch: !0
    }), []);
    Sn(M, () => J, [J]), $(() => {
      const L = (H) => {
        oe.current = H, X(H);
      }, K = (H) => {
        const te = Is(H, oe.current);
        if (te !== "ignore") {
          if (pe.current && clearTimeout(pe.current), te === "immediate") {
            L(H);
            return;
          }
          pe.current = setTimeout(() => L(H), qr);
        }
      }, W = !!(c && c >= 80);
      K(W ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const ne = !W && i && typeof ResizeObserver < "u" ? new ResizeObserver((H) => {
        var te, ge;
        K(((ge = (te = H[0]) == null ? void 0 : te.contentRect) == null ? void 0 : ge.width) ?? i.clientWidth);
      }) : null;
      return ne && i && ne.observe(i), () => {
        ne == null || ne.disconnect(), pe.current && clearTimeout(pe.current);
      };
    }, [c, i, a]);
    const V = G(
      () => Rs(q, o),
      [q, o]
    ), [Q, me] = N(() => /* @__PURE__ */ new Map()), [U, se] = N(() => /* @__PURE__ */ new Set()), [Be, Me] = N(() => /* @__PURE__ */ new Set()), j = _(/* @__PURE__ */ new Map()), ce = _(null), Z = _(null), [fe, he] = N(() => /* @__PURE__ */ new Set()), le = _(/* @__PURE__ */ new Map()), de = O((L, K) => {
      me((W) => {
        if (W.get(L) === K) return W;
        const Y = new Map(W);
        return Y.set(L, K), Y;
      });
    }, []), ue = O((L, K) => {
      const W = j.current, Y = W.get(L), ne = [ce.current, Z.current];
      if (Y)
        for (const H of ne)
          try {
            H == null || H.unobserve(Y);
          } catch {
          }
      if (K) {
        W.set(L, K);
        for (const H of ne)
          try {
            H == null || H.observe(K);
          } catch {
          }
      } else
        W.delete(L);
    }, []), Re = _(/* @__PURE__ */ new Map()), Ne = O((L) => {
      const K = Re.current;
      let W = K.get(L);
      return W || (W = (Y) => ue(L, Y), K.set(L, W)), W;
    }, [ue]);
    $(() => {
      if (typeof IntersectionObserver > "u") return;
      const L = le.current, K = new IntersectionObserver(
        (W) => {
          const Y = [], ne = [];
          for (const H of W) {
            const te = H.target, ge = Ft(te);
            Number.isFinite(ge) && (H.isIntersecting ? Y : ne).push(ge);
          }
          if ((Y.length || ne.length) && se((H) => {
            let te = null;
            for (const ge of Y)
              H.has(ge) || (te = te || new Set(H), te.add(ge));
            for (const ge of ne)
              H.has(ge) && (te = te || new Set(H), te.delete(ge));
            return te || H;
          }), Y.length) {
            for (const H of Y) {
              const te = L.get(H);
              te && (clearTimeout(te), L.delete(H));
            }
            Me((H) => {
              let te = null;
              for (const ge of Y)
                H.has(ge) || (te = te || new Set(H), te.add(ge));
              return te || H;
            });
          }
          for (const H of ne)
            L.has(H) || L.set(H, setTimeout(() => {
              L.delete(H), Me((te) => {
                if (!te.has(H)) return te;
                const ge = new Set(te);
                return ge.delete(H), ge;
              });
            }, Fc));
        },
        { root: i, rootMargin: Oc, threshold: 0 }
      );
      ce.current = K;
      for (const W of j.current.values())
        try {
          K.observe(W);
        } catch {
        }
      return () => {
        K.disconnect(), ce.current === K && (ce.current = null);
        for (const W of L.values()) clearTimeout(W);
        L.clear();
      };
    }, [i]), $(() => {
      if (typeof IntersectionObserver > "u") return;
      const L = new IntersectionObserver(
        (K) => {
          he((W) => {
            let Y = null;
            for (const ne of K) {
              const H = Ft(ne.target);
              !Number.isFinite(H) || ne.isIntersecting === W.has(H) || (Y = Y || new Set(W), ne.isIntersecting ? Y.add(H) : Y.delete(H));
            }
            return Y || W;
          });
        },
        { root: i, rootMargin: $c, threshold: 0 }
      );
      Z.current = L;
      for (const K of j.current.values())
        try {
          L.observe(K);
        } catch {
        }
      return () => {
        L.disconnect(), Z.current === L && (Z.current = null);
      };
    }, [i]);
    const ct = !!i && typeof IntersectionObserver < "u";
    Ae(() => {
      A(0), C(""), se(/* @__PURE__ */ new Set()), Me(/* @__PURE__ */ new Set()), me(/* @__PURE__ */ new Map()), j.current.clear();
      const L = le.current;
      for (const K of L.values()) clearTimeout(K);
      L.clear(), m == null || m(0, t);
    }, [R, m, t]);
    const Jt = O(
      ({ numPages: L }) => {
        E.current === R && (A(L), C(""), m == null || m(L, t), u == null || u({ numPages: L, pane: t }));
      },
      [R, u, m, t]
    ), Kt = O(
      (L) => {
        if (E.current !== R) return;
        const K = (L == null ? void 0 : L.message) || "PDF 解析失败";
        C(K), A(0), m == null || m(0, t), f == null || f(L, t);
      },
      [R, f, m, t]
    ), xe = G(
      () => k > 0 ? Array.from({ length: k }, (L, K) => K + 1) : [],
      [k]
    );
    $(() => {
      typeof IntersectionObserver < "u" || Me(new Set(xe));
    }, [xe]);
    const ze = G(
      () => Kn(b, w, t),
      [b, w, t]
    ), Ue = G(() => {
      const L = /* @__PURE__ */ new Map();
      for (const K of p) {
        const W = Kn(K, w, t);
        if (!W) continue;
        const Y = L.get(W.box.page) || [];
        Y.push(W), L.set(W.box.page, Y);
      }
      return L;
    }, [t, w, p]), Et = G(() => {
      const L = /* @__PURE__ */ new Set();
      if (!v) return L;
      for (const [K, W] of Ue)
        W.some((Y) => Y.itemId === v) && L.add(K);
      return L;
    }, [v, Ue]), It = G(() => {
      if (k === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(xe);
      if (U.size === 0) {
        const W = Math.min(k, en * 2 + 1);
        return new Set(Array.from({ length: W }, (Y, ne) => ne + 1));
      }
      const K = /* @__PURE__ */ new Set();
      for (const W of U)
        for (let Y = -en; Y <= en; Y++) {
          const ne = W + Y;
          ne >= 1 && ne <= k && K.add(ne);
        }
      return K;
    }, [k, xe, i, a, U]), Ye = !n || !!x || !!B, Tt = n && (x || B) || s;
    return /* @__PURE__ */ F(
      "section",
      {
        ref: re,
        className: `reader-panel ${hs}${a ? "" : " is-hidden"}`,
        [ot]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (P == null ? void 0 : P.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          T ? /* @__PURE__ */ g("div", { className: "reader-react-pdf-pane-action", children: T }) : null,
          y ? /* @__PURE__ */ F("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ g("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ g("span", { children: y })
          ] }) : null,
          Ye && !D ? /* @__PURE__ */ g("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Tt }) : null,
          D ? /* @__PURE__ */ g("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          I && !x ? /* @__PURE__ */ g("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ g(
            ha,
            {
              file: I,
              loading: null,
              error: null,
              options: we,
              onLoadSuccess: Jt,
              onLoadError: Kt,
              className: "reader-react-pdf-document",
              children: xe.map((L) => {
                if (It.has(L))
                  return /* @__PURE__ */ g(
                    Dc,
                    {
                      pane: t,
                      pageNumber: L,
                      width: V,
                      devicePixelRatio: ae,
                      active: Be.has(L),
                      textLayer: !ct || fe.has(L),
                      syncedMinHeight: (l == null ? void 0 : l.get(L)) || 0,
                      onMetrics: d,
                      cachedAspect: Q.get(L),
                      onAspectChange: de,
                      sentinelRef: Ne(L),
                      regionHighlight: (ze == null ? void 0 : ze.box.page) === L ? ze : null,
                      regionTargets: Ue.get(L),
                      hoveredRegionId: v && Et.has(L) ? v : null,
                      onHoverRegion: S,
                      liveTranslationLayout: P == null ? void 0 : P.layoutByPage.get(L - 1),
                      liveTranslationPage: P == null ? void 0 : P.pagesByPage.get(L - 1),
                      showLiveTranslation: h
                    },
                    `${t}-${L}`
                  );
                const W = Q.get(L) ?? yo, Y = Math.max(120, Math.floor(V * W)), ne = Math.max(Y, Math.ceil((l == null ? void 0 : l.get(L)) || 0));
                return /* @__PURE__ */ g(
                  "div",
                  {
                    ref: Ne(L),
                    [Ve]: L,
                    [ot]: t,
                    [En]: Y,
                    className: `${In} is-placeholder`,
                    style: {
                      width: V,
                      height: ne,
                      minHeight: ne
                    },
                    children: /* @__PURE__ */ g(
                      "div",
                      {
                        className: zt,
                        style: { width: V, height: Y },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${L}`
                );
              })
            },
            R
          ) }) : null
        ]
      }
    );
  }
), mr = Ut(Uc), Hc = 2e3, Wc = 6, Vc = 500, hr = "reader-react-resizing";
function Jc(e, t) {
  const n = _(null), r = _(null);
  Ae(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const h = Kc(e), y = Lt(e, h);
      if (!y) return;
      s = { pane: h, progress: y, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let d = 0, u = null, f = e.scrollHeight, m = f, b = 0, p = l;
    const w = /* @__PURE__ */ new WeakMap(), v = typeof ResizeObserver > "u" ? null : new ResizeObserver((h) => {
      let y = !1;
      for (const T of h) {
        const M = Math.round(T.contentRect.height);
        w.has(T.target) && w.get(T.target) !== M && (y = !0), w.set(T.target, M);
      }
      y && yt(e, c, "auto", i);
    }), S = () => {
      var h;
      u && clearTimeout(u), cancelAnimationFrame(d), v == null || v.disconnect(), e.classList.remove(hr);
      for (const y of pr) e.removeEventListener(y, S);
      ((h = r.current) == null ? void 0 : h.stop) === S && (r.current = null);
    }, P = () => {
      yt(e, c, "auto", i);
      const h = e.scrollHeight;
      b = h === m ? b + 1 : 0, m = h;
      const y = performance.now() - p;
      b >= Wc && (h !== f || y > Vc) || y > Hc ? S() : d = requestAnimationFrame(P);
    };
    for (const h of pr) e.addEventListener(h, S, { passive: !0 });
    for (const h of Array.from(e.children)) v == null || v.observe(h);
    e.classList.add(hr), r.current = { ...s, stop: S }, u = setTimeout(() => {
      u = null, p = performance.now(), f = e.scrollHeight, m = f, b = 0, d = requestAnimationFrame(P);
    }, qr);
  }, [e, t]), $(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Kc(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Ve}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(ot) || null;
  }
  return null;
}
const pr = ["wheel", "touchstart", "keydown", "pointerdown"], Gc = () => () => {
}, gr = () => null;
function qc({
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
function Zc(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Yc(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Xc(e) {
  const t = je(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), d = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, u = e.bindShell ?? (t == null ? void 0 : t.bindShell), f = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Pt, b = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, p = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), w = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, v = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, P = e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", h = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", y = e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, T = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, M = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), z = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), D = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), x = e.regions ?? (t == null ? void 0 : t.regions) ?? [], R = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), E = (t == null ? void 0 : t.regionHover) ?? null, [I, k] = N(null), A = zr(
    E ? E.subscribe : Gc,
    E ? () => E.get().itemId : gr,
    E ? () => E.get().itemId : gr
  ), B = E ? A : I, C = O((X) => {
    E ? E.set(X, "pdf") : k(X);
  }, [E]), J = qc({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: d
  }), q = Number.isFinite(b) && b > 0 ? Zc(
    b,
    n || r,
    typeof document > "u" ? b * 2 : document.documentElement.clientWidth
  ) : null;
  return Jc(f, q), /* @__PURE__ */ g(
    "div",
    {
      ref: u,
      className: ms,
      "data-reader-region-count": x.length,
      "data-reader-structured-region-count": x.filter(Qo).length,
      "data-reader-metadata-ready": R ? "true" : "false",
      children: /* @__PURE__ */ F(
        "main",
        {
          className: `${fs} reader-mode-${J.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            w ? /* @__PURE__ */ g(
              mr,
              {
                pane: "source",
                url: P,
                preloadedFile: y,
                userZoom: m,
                visible: J.showSource,
                scrollRoot: f,
                pageWidthOverride: q,
                rowHeights: J.compareMode ? p : void 0,
                onMetrics: M,
                emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: z,
                activeRegion: D,
                regions: x,
                readerMetadata: R,
                hoveredRegionId: B,
                onHoverRegion: C,
                liveTranslation: d ? o : void 0,
                showLiveTranslation: d,
                liveTranslationPendingLabel: d ? Yc(o) : "",
                paneAction: d ? /* @__PURE__ */ F(st, { children: [
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
              }
            ) : null,
            v ? /* @__PURE__ */ g(
              mr,
              {
                pane: "translated",
                url: h,
                preloadedFile: T,
                userZoom: m,
                visible: J.showTranslated,
                scrollRoot: f,
                pageWidthOverride: q,
                rowHeights: J.compareMode ? p : void 0,
                onMetrics: M,
                emptyLabel: "暂无译文 PDF",
                onNumPagesChange: z,
                activeRegion: D,
                regions: x,
                readerMetadata: R,
                hoveredRegionId: B,
                onHoverRegion: C,
                liveTranslation: void 0,
                showLiveTranslation: !1
              }
            ) : null
          ]
        }
      )
    }
  );
}
const Qc = [
  { id: "source", label: "原文", Icon: $r },
  { id: "compare", label: "对照", Icon: jr },
  { id: "translated", label: "译文", Icon: Br }
];
function el(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function tl(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function nl(e) {
  const t = je(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, i = a ? el(a.state) : "";
  return /* @__PURE__ */ F("header", { className: "reader-workspace-bar", children: [
    a ? /* @__PURE__ */ F(
      "button",
      {
        type: "button",
        className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
        "aria-pressed": a.visible,
        "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
        title: a.state.error || i,
        onClick: a.onToggle,
        children: [
          /* @__PURE__ */ g(sa, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ g("span", { className: "reader-live-translation-toggle-label", children: i })
        ]
      }
    ) : null,
    /* @__PURE__ */ g("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Qc.map(({ id: c, label: l, Icon: d }) => {
      const u = n === c, f = tl({
        id: c,
        documentReady: r,
        sourceViewOnly: s,
        liveTranslationAvailable: !!a
      });
      return /* @__PURE__ */ F(
        "button",
        {
          type: "button",
          className: `reader-workspace-tab${u ? " is-active" : ""}`,
          role: "tab",
          "aria-selected": u,
          "aria-label": l,
          title: f ? `${l} 需要文档任务` : l,
          disabled: f,
          onClick: () => o(c),
          children: [
            /* @__PURE__ */ g(d, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ g("span", { className: "reader-workspace-tab-label", children: l })
          ]
        },
        c
      );
    }) })
  ] });
}
const rl = {
  markdown: { label: "Markdown", short: "MD", Icon: ia, needsJob: !0 }
}, ol = Zr.map(
  (e) => ({ id: e, ...rl[e] })
);
function vo() {
  return ol.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function al(e) {
  const t = je(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ g(st, { children: vo().map(({ id: s, label: i, Icon: c, needsJob: l }) => {
    const d = n === s, u = l && r, f = d ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: "reader-panel-toggle",
        "aria-label": f,
        "aria-pressed": d,
        title: u ? `${i} 需打开任务阅读` : i,
        disabled: u,
        onClick: () => d ? a() : o(s),
        children: /* @__PURE__ */ g(c, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 })
      },
      s
    );
  }) });
}
function sl(e) {
  const t = je(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = vo().map(({ id: c, label: l, short: d, Icon: u, needsJob: f }) => ({
    key: c,
    label: l,
    short: d,
    Icon: u,
    disabled: f && o,
    selected: n === c,
    badge: r == null ? void 0 : r[c],
    onClick: () => a(c)
  }));
  return n ? /* @__PURE__ */ F("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ g("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: d, disabled: u, selected: f, badge: m, onClick: b }) => /* @__PURE__ */ F(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": f,
        className: `reader-assistant-dock-tab${f ? " is-active" : ""}`,
        title: u ? `${l} 需打开任务阅读` : l,
        disabled: u,
        onClick: b,
        children: [
          /* @__PURE__ */ g(d, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ g("span", { className: "reader-assistant-dock-tab-label", children: l }),
          m ? /* @__PURE__ */ g("span", { className: "reader-assistant-dock-badge", children: m }) : null
        ]
      },
      c
    )) }),
    /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ g(Pn, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function il(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function cl(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function ll(e) {
  return e / 100 * window.innerHeight;
}
function dl(e) {
  return e / 100 * window.innerWidth;
}
function ul(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function mt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = ul(n);
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
      r = cl(t, o);
      break;
    }
    case "em": {
      r = il(t, o);
      break;
    }
    case "vh": {
      r = ll(o);
      break;
    }
    case "vw": {
      r = dl(o);
      break;
    }
  }
  return r;
}
function ve(e) {
  return parseFloat(e.toFixed(3));
}
function at({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function hn(e) {
  const { panels: t } = e, n = at({ group: e });
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
      const d = mt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = ve(d / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const d = mt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = ve(d / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const d = mt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = ve(d / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const d = mt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = ve(d / n * 100);
    }
    return {
      groupResizeBehavior: a.groupResizeBehavior,
      collapsedSize: s,
      collapsible: a.collapsible === !0,
      defaultSize: i,
      disabled: a.disabled,
      minSize: c,
      maxSize: l,
      panelId: r.id
    };
  });
}
function ee(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function pn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? fl : ml
  );
}
function fl(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function ml(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function wo(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function So(e, t) {
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
function hl({
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
    const { x: i, y: c } = So(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return ee(o, "No rect found"), o;
}
let Nt;
function pl() {
  return Nt === void 0 && (typeof matchMedia == "function" ? Nt = !!matchMedia("(pointer:coarse)").matches : Nt = !1), Nt;
}
function Ro(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = pn(
    n,
    Array.from(t.children).filter(wo).map((b) => ({ element: b }))
  ).map(({ element: b }) => b), s = [];
  let i = !1, c = !1, l = -1, d = -1, u = 0, f, m = [];
  {
    let b = -1;
    for (const p of a)
      p.hasAttribute("data-panel") && (b++, p.hasAttribute("data-disabled") || (u++, l === -1 && (l = b), d = b));
  }
  if (u > 1) {
    let b = -1;
    for (const p of a)
      if (p.hasAttribute("data-panel")) {
        b++;
        const w = r.find(
          (v) => v.element === p
        );
        if (w) {
          if (f) {
            const v = f.element.getBoundingClientRect(), S = p.getBoundingClientRect();
            let P;
            if (c) {
              const h = n === "horizontal" ? new DOMRect(
                v.right,
                v.top,
                0,
                v.height
              ) : new DOMRect(
                v.left,
                v.bottom,
                v.width,
                0
              ), y = n === "horizontal" ? new DOMRect(S.left, S.top, 0, S.height) : new DOMRect(S.left, S.top, S.width, 0);
              switch (m.length) {
                case 0: {
                  P = [
                    h,
                    y
                  ];
                  break;
                }
                case 1: {
                  const T = m[0], M = hl({
                    orientation: n,
                    rects: [v, S],
                    targetRect: T.element.getBoundingClientRect()
                  });
                  P = [
                    T,
                    M === v ? y : h
                  ];
                  break;
                }
                default: {
                  P = m;
                  break;
                }
              }
            } else
              m.length ? P = m : P = [
                n === "horizontal" ? new DOMRect(
                  v.right,
                  S.top,
                  S.left - v.right,
                  S.height
                ) : new DOMRect(
                  S.left,
                  v.bottom,
                  S.width,
                  S.top - v.bottom
                )
              ];
            for (const h of P) {
              let y = "width" in h ? h : h.element.getBoundingClientRect();
              const T = pl() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (y.width < T) {
                const z = T - y.width;
                y = new DOMRect(
                  y.x - z / 2,
                  y.y,
                  y.width + z,
                  y.height
                );
              }
              if (y.height < T) {
                const z = T - y.height;
                y = new DOMRect(
                  y.x,
                  y.y - z / 2,
                  y.width,
                  y.height + z
                );
              }
              const M = b <= l || b > d;
              !i && !M && s.push({
                group: e,
                groupSize: at({ group: e }),
                panels: [f, w],
                separator: "width" in h ? void 0 : h,
                rect: y
              }), i = !1;
            }
          }
          c = !1, f = w, m = [];
        }
      } else if (p.hasAttribute("data-separator")) {
        p.ariaDisabled !== null && (i = !0);
        const w = o.find(
          (v) => v.element === p
        );
        w ? m.push(w) : (f = void 0, m = []);
      } else
        c = !0;
  }
  return s;
}
var Oe;
class Po {
  constructor() {
    Wn(this, Oe, {});
  }
  addListener(t, n) {
    const r = lt(this, Oe)[t];
    return r === void 0 ? lt(this, Oe)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = lt(this, Oe)[t];
    if (r !== void 0)
      if (r.length === 1)
        r[0].call(null, n);
      else {
        let o = !1, a = null;
        const s = Array.from(r);
        for (let i = 0; i < s.length; i++) {
          const c = s[i];
          try {
            c.call(null, n);
          } catch (l) {
            a === null && (o = !0, a = l);
          }
        }
        if (o)
          throw a;
      }
  }
  removeAllListeners() {
    Vn(this, Oe, {});
  }
  removeListener(t, n) {
    const r = lt(this, Oe)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Oe = new WeakMap();
let nt = {
  cursorFlags: 0,
  state: "inactive"
};
const An = new Po();
function Je() {
  return nt;
}
function gl(e) {
  return An.addListener("change", e);
}
function bl(e) {
  const t = nt, n = { ...nt };
  n.cursorFlags = e, nt = n, An.emit("change", {
    prev: t,
    next: n
  });
}
function rt(e) {
  const t = nt;
  nt = e, An.emit("change", {
    prev: t,
    next: e
  });
}
const yl = (e) => e, tn = () => {
}, Eo = 1, Io = 2, To = 4, ko = 8, br = 3, yr = 12;
let _t;
function vr() {
  return _t === void 0 && (_t = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (_t = !0)), _t;
}
function vl({
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
        if (e && vr()) {
          const a = (e & Eo) !== 0, s = (e & Io) !== 0, i = (e & To) !== 0, c = (e & ko) !== 0;
          if (a)
            return i ? "se-resize" : c ? "ne-resize" : "e-resize";
          if (s)
            return i ? "sw-resize" : c ? "nw-resize" : "w-resize";
          if (i)
            return "s-resize";
          if (c)
            return "n-resize";
        }
        break;
      }
    }
    return vr() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const wr = /* @__PURE__ */ new WeakMap();
function Mn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = wr.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = Je();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = vl({
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
  wr.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Te = /* @__PURE__ */ new Map();
const Ao = new Po();
function wl(e) {
  Te = new Map(Te), Te.delete(e);
}
function Sr(e, t) {
  for (const [n] of Te)
    if (n.id === e)
      return n;
}
function $e(e, t) {
  for (const [n, r] of Te)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function qe() {
  return Te;
}
function Nn(e, t) {
  return Ao.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ce(e, t, n) {
  const r = Te.get(e);
  Te = new Map(Te), Te.set(e, t), Ao.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Mo(e) {
  const t = Je();
  let n = !1;
  switch (t.state) {
    case "active":
      rt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Mn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = $e(r.group.id, !0);
        Ce(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Rr(e) {
  e.defaultPrevented || Mo(e.currentTarget);
}
function Sl(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = So(n, a.rect);
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
function Rl(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Pl(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Ir(e),
    b: Ir(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  ee(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: Er(Pr(n.a)),
    b: Er(Pr(n.b))
  };
  if (o.a === o.b) {
    const a = r.childNodes, s = {
      a: n.a.at(-1),
      b: n.b.at(-1)
    };
    let i = a.length;
    for (; i--; ) {
      const c = a[i];
      if (c === s.a) return 1;
      if (c === s.b) return -1;
    }
  }
  return Math.sign(o.a - o.b);
}
const El = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Il(e) {
  const t = getComputedStyle(No(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Tl(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Il(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || El.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Pr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (ee(n, "Missing node"), Tl(n)) return n;
  }
  return null;
}
function Er(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Ir(e) {
  const t = [];
  for (; e; )
    t.push(e), e = No(e);
  return t;
}
function No(e) {
  const { parentNode: t } = e;
  return Rl(t) ? t.host : t;
}
function kl(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Al({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!wo(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Pl(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (kl(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function _n(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Ro(o), s = Sl(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Al({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Ml(e, t) {
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
function Ie(e, t) {
  return be(e, t) ? 0 : e > t ? 1 : -1;
}
function tt({
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
    minSize: c = 0
  } = t;
  if (s && !e)
    return n;
  if (Ie(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      Ie(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = ve(r), r;
}
function vt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (be(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [d, u] = r;
  ee(d != null, "Invalid first pivot index"), ee(u != null, "Invalid second pivot index");
  let f = 0;
  switch (a) {
    case "keyboard": {
      {
        const p = e < 0 ? u : d, w = n[p];
        ee(
          w,
          `Panel constraints not found for index ${p}`
        );
        const {
          collapsedSize: v = 0,
          collapsible: S,
          minSize: P = 0
        } = w;
        if (S) {
          const h = i[p];
          if (ee(
            h != null,
            `Previous layout not found for panel index ${p}`
          ), be(h, v)) {
            const y = P - h;
            Ie(y, Math.abs(e)) > 0 && (e = e < 0 ? 0 - y : y);
          }
        }
      }
      {
        const p = e < 0 ? d : u, w = n[p];
        ee(
          w,
          `No panel constraints found for index ${p}`
        );
        const {
          collapsedSize: v = 0,
          collapsible: S,
          minSize: P = 0
        } = w;
        if (S) {
          const h = i[p];
          if (ee(
            h != null,
            `Previous layout not found for panel index ${p}`
          ), be(h, P)) {
            const y = h - v;
            Ie(y, Math.abs(e)) > 0 && (e = e < 0 ? 0 - y : y);
          }
        }
      }
      break;
    }
    default: {
      const p = e < 0 ? u : d, w = n[p];
      ee(
        w,
        `Panel constraints not found for index ${p}`
      );
      const v = i[p], { collapsible: S, collapsedSize: P, minSize: h } = w;
      if (S && Ie(v, h) < 0)
        if (e > 0) {
          const y = h - P, T = y / 2, M = v + e;
          Ie(M, h) < 0 && (e = Ie(e, T) <= 0 ? 0 : y);
        } else {
          const y = h - P, T = 100 - y / 2, M = v - e;
          Ie(M, h) < 0 && (e = Ie(100 + e, T) > 0 ? 0 : -y);
        }
      break;
    }
  }
  {
    const p = e < 0 ? 1 : -1;
    let w = e < 0 ? u : d, v = 0;
    for (; ; ) {
      const P = i[w];
      ee(
        P != null,
        `Previous layout not found for panel index ${w}`
      );
      const h = tt({
        overrideDisabledPanels: s,
        panelConstraints: n[w],
        prevSize: P,
        size: 100
      }) - P;
      if (v += h, w += p, w < 0 || w >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(v));
    e = e < 0 ? 0 - S : S;
  }
  {
    let p = e < 0 ? d : u;
    for (; p >= 0 && p < n.length; ) {
      const w = Math.abs(e) - Math.abs(f), v = i[p];
      ee(
        v != null,
        `Previous layout not found for panel index ${p}`
      );
      const S = v - w, P = tt({
        overrideDisabledPanels: s,
        panelConstraints: n[p],
        prevSize: v,
        size: S
      });
      if (!be(v, P) && (f += v - P, l[p] = P, f.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? p-- : p++;
    }
  }
  if (Ml(c, l))
    return o;
  {
    const p = e < 0 ? u : d, w = i[p];
    ee(
      w != null,
      `Previous layout not found for panel index ${p}`
    );
    const v = w + f, S = tt({
      overrideDisabledPanels: s,
      panelConstraints: n[p],
      prevSize: w,
      size: v
    });
    if (l[p] = S, !be(S, v)) {
      let P = v - S, h = e < 0 ? u : d;
      for (; h >= 0 && h < n.length; ) {
        const y = l[h];
        ee(
          y != null,
          `Previous layout not found for panel index ${h}`
        );
        const T = y + P, M = tt({
          overrideDisabledPanels: s,
          panelConstraints: n[h],
          prevSize: y,
          size: T
        });
        if (be(y, M) || (P -= M - y, l[h] = M), be(P, 0))
          break;
        e > 0 ? h-- : h++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (p, w) => w + p,
    0
  );
  if (!be(m, 100, 0.1))
    return o;
  const b = Object.keys(o);
  return l.reduce((p, w, v) => (p[b[v]] = w, p), {});
}
function Ke(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Ie(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function Ge({
  layout: e,
  panelConstraints: t
}) {
  const n = Object.values(e), r = [...n], o = r.reduce(
    (i, c) => i + c,
    0
  );
  if (r.length !== t.length)
    throw Error(
      `Invalid ${t.length} panel layout: ${r.map((i) => `${i}%`).join(", ")}`
    );
  if (!be(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      ee(c != null, `No layout data found for index ${i}`);
      const l = 100 / o * c;
      r[i] = l;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const c = n[i];
    ee(c != null, `No layout data found for index ${i}`);
    const l = r[i];
    ee(l != null, `No layout data found for index ${i}`);
    const d = tt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: c,
      size: l
    });
    l != d && (a += l - d, r[i] = d);
  }
  if (!be(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      ee(c != null, `No layout data found for index ${i}`);
      const l = c + a, d = tt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== d && (a -= d - c, r[i] = d, be(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function _o({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = qe();
    for (const [
      l,
      {
        defaultLayoutDeferred: d,
        derivedPanelConstraints: u,
        layout: f,
        groupSize: m,
        separatorToPanels: b
      }
    ] of c)
      if (l.id === e)
        return {
          defaultLayoutDeferred: d,
          derivedPanelConstraints: u,
          group: l,
          groupSize: m,
          layout: f,
          separatorToPanels: b
        };
    throw Error(`Group ${e} not found`);
  }, r = () => {
    const c = n().derivedPanelConstraints.find(
      (l) => l.panelId === t
    );
    if (c !== void 0)
      return c;
    throw Error(`Panel constraints not found for Panel ${t}`);
  }, o = () => {
    const c = n().group.panels.find((l) => l.id === t);
    if (c !== void 0)
      return c;
    throw Error(`Layout not found for Panel ${t}`);
  }, a = () => {
    const c = n().layout[t];
    if (c !== void 0)
      return c;
    throw Error(`Layout not found for Panel ${t}`);
  }, s = ({
    nextSize: c,
    panels: l,
    prevLayout: d,
    derivedPanelConstraints: u
  }) => {
    const f = a(), m = l.findIndex((w) => w.id === t), b = m === 0, p = m === l.length - 1;
    if (p && c < f && (b || l.slice(0, m).every((w, v) => {
      const S = u[v];
      return (S == null ? void 0 : S.collapsible) && be(S.collapsedSize, d[S.panelId]);
    }))) {
      const w = l.slice(0, m).reduce((v, S) => v + d[S.id], 0);
      return {
        ...d,
        [t]: ve(100 - w)
      };
    }
    return vt({
      delta: p ? f - c : c - f,
      initialLayout: d,
      panelConstraints: u,
      pivotIndices: p ? [m - 1, m] : [m, m + 1],
      prevLayout: d,
      trigger: "imperative-api"
    });
  }, i = (c) => {
    const l = a();
    if (c === l)
      return;
    const {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: u,
      group: f,
      groupSize: m,
      layout: b,
      separatorToPanels: p
    } = n(), w = s({
      nextSize: c,
      panels: f.panels,
      prevLayout: b,
      derivedPanelConstraints: u
    }), v = Ge({
      layout: w,
      panelConstraints: u
    });
    Ke(b, v) || Ce(f, {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: u,
      groupSize: m,
      layout: v,
      separatorToPanels: p
    });
  };
  return {
    collapse: () => {
      const { collapsible: c, collapsedSize: l } = r(), { mutableValues: d } = o(), u = a();
      c && u !== l && (d.expandToSize = u, i(l));
    },
    expand: () => {
      const { collapsible: c, collapsedSize: l, minSize: d } = r(), { mutableValues: u } = o(), f = a();
      if (c && f === l) {
        let m = u.expandToSize ?? d;
        m === 0 && (m = 1), i(m);
      }
    },
    getSize: () => {
      const { group: c } = n(), l = a(), { element: d } = o(), u = c.orientation === "horizontal" ? d.offsetWidth : d.offsetHeight;
      return {
        asPercentage: l,
        inPixels: u
      };
    },
    isCollapsed: () => {
      const { collapsible: c, collapsedSize: l } = r(), d = a();
      return c && be(l, d);
    },
    resize: (c) => {
      const { group: l } = n(), { element: d } = o(), u = at({ group: l }), f = mt({
        groupSize: u,
        panelElement: d,
        styleProp: c
      }), m = ve(f / u * 100);
      i(m);
    }
  };
}
function Tr(e) {
  if (e.defaultPrevented)
    return;
  const t = qe();
  _n(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = _o({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function Dt(e) {
  const t = qe();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Lo({
  groupId: e
}) {
  const t = () => {
    const n = qe();
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
        separatorToPanels: c
      } = t(), l = Ge({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (Ke(i, l) || Ce(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: c
      }), l);
    }
  };
}
function He(e, t) {
  const n = Dt(e), r = $e(n.id, !0), o = n.separators.find(
    (d) => d.element === e
  );
  ee(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  ee(a, "Matching panels not found");
  const s = a.map((d) => n.panels.indexOf(d)), i = Lo({ groupId: n.id }).getLayout(), c = vt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), l = Ge({
    layout: c,
    panelConstraints: r.derivedPanelConstraints
  });
  Ke(i, l) || Ce(
    n,
    {
      defaultLayoutDeferred: r.defaultLayoutDeferred,
      derivedPanelConstraints: r.derivedPanelConstraints,
      groupSize: r.groupSize,
      layout: l,
      separatorToPanels: r.separatorToPanels
    },
    // Keyboard resizes (arrow keys, Home/End, Enter collapse/expand) originate
    // from a real DOM event on the separator, so they are user interactions
    // just like pointer drags. This function is only reached from
    // onDocumentKeyDown. See #716.
    { isUserInteraction: !0 }
  );
}
function kr(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = Dt(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && He(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && He(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && He(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && He(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), He(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = Dt(t), o = $e(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (f) => f.element === t
        );
        ee(c, "Matching separator not found");
        const l = i.get(c);
        ee(l, "Matching panels not found");
        const d = l[0], u = a.find(
          (f) => f.panelId === d.id
        );
        if (ee(u, "Panel metadata not found"), u.collapsible) {
          const f = s[d.id], m = u.collapsedSize === f ? r.mutableState.expandedPanelSizes[d.id] ?? u.minSize : u.collapsedSize;
          He(t, m - f);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = Dt(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        ee(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), He(t, -100);
        break;
      }
    }
}
function Ar(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = qe(), n = _n(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), rt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function Do({
  document: e,
  event: t,
  hitRegions: n,
  initialLayoutMap: r,
  mountedGroups: o,
  pointerDownAtPoint: a,
  prevCursorFlags: s
}) {
  let i = 0;
  n.forEach((l) => {
    const { group: d, groupSize: u } = l, { orientation: f, panels: m } = d, { disableCursor: b } = d.mutableState;
    let p = 0;
    a ? f === "horizontal" ? p = (t.clientX - a.x) / u * 100 : p = (t.clientY - a.y) / u * 100 : f === "horizontal" ? p = t.clientX < 0 ? -100 : 100 : p = t.clientY < 0 ? -100 : 100;
    const w = r.get(d), v = o.get(d);
    if (!w || !v)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: P,
      groupSize: h,
      layout: y,
      separatorToPanels: T
    } = v;
    if (P && y && T) {
      const M = vt({
        delta: p,
        initialLayout: w,
        panelConstraints: P,
        pivotIndices: l.panels.map((z) => m.indexOf(z)),
        prevLayout: y,
        trigger: "mouse-or-touch"
      });
      if (Ke(M, y)) {
        if (p !== 0 && !b)
          switch (f) {
            case "horizontal": {
              i |= p < 0 ? Eo : Io;
              break;
            }
            case "vertical": {
              i |= p < 0 ? To : ko;
              break;
            }
          }
      } else
        Ce(l.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: P,
          groupSize: h,
          layout: M,
          separatorToPanels: T
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & br : c |= i & br, t.movementY === 0 ? c |= s & yr : c |= i & yr, bl(c), Mn(e);
}
function Mr(e) {
  const t = qe(), n = Je();
  switch (n.state) {
    case "active":
      Do({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Nr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = Je(), n = qe();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        rt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = $e(a.group.id, !0);
          Ce(a.group, s, {
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
      Do({
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
      const a = _n(e, n);
      a.length === 0 ? t.state !== "inactive" && rt({
        cursorFlags: 0,
        state: "inactive"
      }) : rt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Mn(e.currentTarget);
      break;
    }
  }
}
function _r(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (Je().state) {
      case "hover":
        rt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Lr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Mo(e.currentTarget) && e.preventDefault();
}
function Dr(e) {
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
function Nl(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = at({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: ve(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function _l(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Ll({
  group: e,
  nextGroupSize: t,
  prevGroupSize: n,
  prevLayout: r
}) {
  if (n <= 0 || t <= 0 || n === t)
    return r;
  let o = 0, a = 0, s = !1;
  const i = /* @__PURE__ */ new Map(), c = [];
  for (const u of e.panels) {
    const f = r[u.id] ?? 0;
    switch (u.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const m = f / 100 * n, b = ve(
          m / t * 100
        );
        i.set(u.id, b), o += b;
        break;
      }
      case "preserve-relative-size":
      default: {
        c.push(u.id), a += f;
        break;
      }
    }
  }
  if (!s || c.length === 0)
    return r;
  const l = 100 - o, d = { ...r };
  if (i.forEach((u, f) => {
    d[f] = u;
  }), a > 0)
    for (const u of c) {
      const f = r[u] ?? 0;
      d[u] = ve(
        f / a * l
      );
    }
  else {
    const u = ve(
      l / c.length
    );
    for (const f of c)
      d[f] = u;
  }
  return d;
}
function Dl(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Xe = /* @__PURE__ */ new Map();
function Cl(e) {
  let t = !0;
  ee(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((b) => {
    for (const p of b) {
      const { borderBoxSize: w, target: v } = p;
      if (v === e.element) {
        if (t) {
          const S = at({ group: e });
          if (S === 0)
            return;
          const P = $e(e.id);
          if (!P)
            return;
          const h = hn(e), y = P.defaultLayoutDeferred ? Dr(h) : P.layout, T = Ll({
            group: e,
            nextGroupSize: S,
            prevGroupSize: P.groupSize,
            prevLayout: y
          }), M = Ge({
            layout: T,
            panelConstraints: h
          });
          if (!P.defaultLayoutDeferred && Ke(P.layout, M) && _l(
            P.derivedPanelConstraints,
            h
          ) && P.groupSize === S)
            return;
          Ce(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: h,
            groupSize: S,
            layout: M,
            separatorToPanels: P.separatorToPanels
          });
        }
      } else
        Nl(e, v, w);
    }
  });
  a.observe(e.element), e.panels.forEach((b) => {
    ee(
      !r.has(b.id),
      `Panel ids must be unique; id "${b.id}" was used more than once`
    ), r.add(b.id), b.onResize && a.observe(b.element);
  });
  const s = at({ group: e }), i = hn(e), c = e.panels.map(({ id: b }) => b).join(",");
  let l = e.mutableState.defaultLayout;
  l && (Dl(e.panels, l) || (l = void 0));
  const d = e.mutableState.layouts[c] ?? l ?? Dr(i), u = Ge({
    layout: d,
    panelConstraints: i
  }), f = e.element.ownerDocument;
  Xe.set(
    f,
    (Xe.get(f) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Ro(e).forEach((b) => {
    b.separator && m.set(b.separator, b.panels);
  }), Ce(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: u,
    separatorToPanels: m
  }), e.separators.forEach((b) => {
    ee(
      !o.has(b.id),
      `Separator ids must be unique; id "${b.id}" was used more than once`
    ), o.add(b.id), b.element.addEventListener("keydown", kr);
  }), Xe.get(f) === 1 && (f.addEventListener("contextmenu", Rr, !0), f.addEventListener("dblclick", Tr, !0), f.addEventListener("pointerdown", Ar, !0), f.addEventListener("pointerleave", Mr), f.addEventListener("pointermove", Nr), f.addEventListener("pointerout", _r), f.addEventListener("pointerup", Lr, !0)), function() {
    t = !1, Xe.set(
      f,
      Math.max(0, (Xe.get(f) ?? 0) - 1)
    ), wl(e), e.separators.forEach((b) => {
      b.element.removeEventListener("keydown", kr);
    }), Xe.get(f) || (f.removeEventListener(
      "contextmenu",
      Rr,
      !0
    ), f.removeEventListener(
      "dblclick",
      Tr,
      !0
    ), f.removeEventListener(
      "pointerdown",
      Ar,
      !0
    ), f.removeEventListener("pointerleave", Mr), f.removeEventListener("pointermove", Nr), f.removeEventListener("pointerout", _r), f.removeEventListener("pointerup", Lr, !0)), a.disconnect();
  };
}
function xl() {
  const [e, t] = N({}), n = O(() => t({}), []);
  return [e, n];
}
function Ln(e) {
  const t = Or();
  return `${e ?? t}`;
}
const Ze = typeof window < "u" ? Ae : $;
function ht(e) {
  const t = _(e);
  return Ze(() => {
    t.current = e;
  }, [e]), O(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function Dn(...e) {
  return ht((t) => {
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
function Cn(e) {
  const t = _({ ...e });
  return Ze(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Co = vn(null);
function zl(e, t) {
  const n = _({
    getLayout: () => ({}),
    setLayout: yl
  });
  Sn(t, () => n.current, []), Ze(() => {
    Object.assign(
      n.current,
      Lo({ groupId: e })
    );
  });
}
function xo({
  children: e,
  className: t,
  defaultLayout: n,
  disableCursor: r,
  disabled: o,
  elementRef: a,
  groupRef: s,
  id: i,
  onLayoutChange: c,
  onLayoutChanged: l,
  orientation: d = "horizontal",
  resizeTargetMinimumSize: u = {
    coarse: 20,
    fine: 10
  },
  style: f,
  ...m
}) {
  const b = _({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), p = ht((R) => {
    Ke(b.current.onLayoutChange, R) || (b.current.onLayoutChange = R, c == null || c(R));
  }), w = ht(
    (R, E) => {
      Ke(b.current.onLayoutChanged, R) || (b.current.onLayoutChanged = R, l == null || l(R, { isUserInteraction: E }));
    }
  ), v = Ln(i), S = _(null), [P, h] = xl(), y = _({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: u,
    separators: []
  }), T = Dn(S, a);
  zl(v, s);
  const M = ht(
    (R, E) => {
      const I = Je(), k = Sr(R), A = $e(R);
      if (A) {
        let B = !1;
        switch (I.state) {
          case "active": {
            B = I.hitRegions.some(
              (C) => C.group === k
            );
            break;
          }
        }
        return {
          flexGrow: A.layout[E] ?? 1,
          pointerEvents: B ? "none" : void 0
        };
      }
      if (n != null && n[E])
        return {
          flexGrow: n == null ? void 0 : n[E]
        };
    }
  ), z = Cn({
    defaultLayout: n,
    disableCursor: r
  }), D = G(
    () => ({
      get disableCursor() {
        return !!z.disableCursor;
      },
      getPanelStyles: M,
      id: v,
      orientation: d,
      registerPanel: (R) => {
        const E = y.current;
        return E.panels = pn(d, [
          ...E.panels,
          R
        ]), h(), () => {
          E.panels = E.panels.filter(
            (I) => I !== R
          ), h();
        };
      },
      registerSeparator: (R) => {
        const E = y.current;
        return E.separators = pn(d, [
          ...E.separators,
          R
        ]), h(), () => {
          E.separators = E.separators.filter(
            (I) => I !== R
          ), h();
        };
      },
      updatePanelProps: (R, { disabled: E }) => {
        const I = y.current.panels.find(
          (B) => B.id === R
        );
        I && (I.panelConstraints.disabled = E);
        const k = Sr(v), A = $e(v);
        k && A && Ce(k, {
          ...A,
          derivedPanelConstraints: hn(k)
        });
      },
      updateSeparatorProps: (R, {
        disabled: E,
        disableDoubleClick: I
      }) => {
        const k = y.current.separators.find(
          (A) => A.id === R
        );
        k && (k.disabled = E, k.disableDoubleClick = I);
      }
    }),
    [M, v, h, d, z]
  ), x = _(null);
  return Ze(() => {
    const R = S.current;
    if (R === null)
      return;
    const E = y.current;
    let I;
    if (z.defaultLayout !== void 0 && Object.keys(z.defaultLayout).length === E.panels.length) {
      I = {};
      for (const q of E.panels) {
        const X = z.defaultLayout[q.id];
        X !== void 0 && (I[q.id] = X);
      }
    }
    const k = {
      disabled: !!o,
      element: R,
      id: v,
      mutableState: {
        defaultLayout: I,
        disableCursor: !!z.disableCursor,
        expandedPanelSizes: y.current.lastExpandedPanelSizes,
        layouts: y.current.layouts
      },
      orientation: d,
      panels: E.panels,
      resizeTargetMinimumSize: E.resizeTargetMinimumSize,
      separators: E.separators
    };
    x.current = k;
    const A = Cl(k), { defaultLayoutDeferred: B, derivedPanelConstraints: C, layout: J } = $e(k.id, !0);
    !B && C.length > 0 && (p(J), w(J, !1));
    const re = Nn(v, (q) => {
      const { defaultLayoutDeferred: X, derivedPanelConstraints: pe, layout: oe } = q.next;
      if (X || pe.length === 0)
        return;
      const ae = k.panels.map(({ id: V }) => V).join(",");
      k.mutableState.layouts[ae] = oe, pe.forEach((V) => {
        if (V.collapsible) {
          const { layout: Q } = q.prev ?? {};
          if (Q) {
            const me = be(
              V.collapsedSize,
              oe[V.panelId]
            ), U = be(
              V.collapsedSize,
              Q[V.panelId]
            );
            me && !U && (k.mutableState.expandedPanelSizes[V.panelId] = Q[V.panelId]);
          }
        }
      });
      const we = Je().state !== "active";
      p(oe), we && w(oe, q.isUserInteraction);
    });
    return () => {
      x.current = null, A(), re();
    };
  }, [
    o,
    v,
    w,
    p,
    d,
    P,
    z
  ]), $(() => {
    const R = x.current;
    R && (R.mutableState.defaultLayout = n, R.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ g(Co.Provider, { value: D, children: /* @__PURE__ */ g(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": v,
      id: v,
      ref: T,
      style: {
        height: "100%",
        width: "100%",
        overflow: "hidden",
        ...f,
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
xo.displayName = "Group";
function xn() {
  const e = wn(Co);
  return ee(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Ol(e, t) {
  const { id: n } = xn(), r = _({
    collapse: tn,
    expand: tn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: tn
  });
  Sn(t, () => r.current, []), Ze(() => {
    Object.assign(
      r.current,
      _o({ groupId: n, panelId: e })
    );
  });
}
function gn({
  children: e,
  className: t,
  collapsedSize: n = "0%",
  collapsible: r = !1,
  defaultSize: o,
  disabled: a,
  elementRef: s,
  groupResizeBehavior: i = "preserve-relative-size",
  id: c,
  maxSize: l = "100%",
  minSize: d = "0%",
  onResize: u,
  panelRef: f,
  style: m,
  ...b
}) {
  const p = !!c, w = Ln(c), v = Cn({
    disabled: a
  }), S = _(null), P = Dn(S, s), {
    getPanelStyles: h,
    id: y,
    orientation: T,
    registerPanel: M,
    updatePanelProps: z
  } = xn(), D = u !== null, x = ht(
    (k, A, B) => {
      u == null || u(k, c, B);
    }
  );
  Ze(() => {
    const k = S.current;
    if (k !== null) {
      const A = {
        element: k,
        id: w,
        idIsStable: p,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: D ? x : void 0,
        panelConstraints: {
          groupResizeBehavior: i,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: v.disabled,
          maxSize: l,
          minSize: d
        }
      };
      return M(A);
    }
  }, [
    i,
    n,
    r,
    o,
    D,
    w,
    p,
    l,
    d,
    x,
    M,
    v
  ]), $(() => {
    z(w, { disabled: a });
  }, [a, w, z]), Ol(w, f);
  const R = () => {
    const k = h(y, w);
    if (k)
      return JSON.stringify(k);
  }, E = zr(
    (k) => Nn(y, k),
    R,
    R
  );
  let I;
  return E ? I = JSON.parse(E) : o !== void 0 ? I = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : I = { flexGrow: 1 }, /* @__PURE__ */ g(
    "div",
    {
      ...b,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": w,
      id: w,
      ref: P,
      style: {
        ...Fl,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...I
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
            ...m,
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
gn.displayName = "Panel";
const Fl = {
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
function $l({
  layout: e,
  panelConstraints: t,
  panelId: n,
  panelIndex: r
}) {
  let o, a;
  const s = e[n], i = t.find(
    (c) => c.panelId === n
  );
  if (i) {
    const c = i.maxSize, l = i.collapsible ? i.collapsedSize : i.minSize, d = [r, r + 1];
    a = Ge({
      layout: vt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: d,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = Ge({
      layout: vt({
        delta: c - s,
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
function zo({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = Ln(a), l = Cn({
    disabled: n,
    disableDoubleClick: r
  }), [d, u] = N({}), [f, m] = N("inactive"), [b, p] = N(!1), w = _(null), v = Dn(w, o), {
    disableCursor: S,
    id: P,
    orientation: h,
    registerSeparator: y,
    updateSeparatorProps: T
  } = xn(), M = h === "horizontal" ? "vertical" : "horizontal";
  Ze(() => {
    const x = w.current;
    if (x !== null) {
      const R = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: x,
        id: c
      }, E = y(R), I = gl(
        (A) => {
          m(
            A.next.state !== "inactive" && A.next.hitRegions.some(
              (B) => B.separator === R
            ) ? A.next.state : "inactive"
          );
        }
      ), k = Nn(
        P,
        (A) => {
          const { derivedPanelConstraints: B, layout: C, separatorToPanels: J } = A.next, re = J.get(R);
          if (re) {
            const q = re[0], X = re.indexOf(q);
            u(
              $l({
                layout: C,
                panelConstraints: B,
                panelId: q.id,
                panelIndex: X
              })
            );
          }
        }
      );
      return () => {
        I(), k(), E();
      };
    }
  }, [P, c, y, l]), $(() => {
    T(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, T]);
  let z;
  n && !S && (z = "not-allowed");
  let D;
  if (n)
    D = "disabled";
  else
    switch (f) {
      case "active": {
        D = "active";
        break;
      }
      default:
        b ? D = "focus" : D = f;
    }
  return /* @__PURE__ */ g(
    "div",
    {
      ...i,
      "aria-controls": d.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": M,
      "aria-valuemax": d.valueMax,
      "aria-valuemin": d.valueMin,
      "aria-valuenow": d.valueNow,
      children: e,
      className: t,
      "data-separator": D,
      "data-testid": c,
      id: c,
      onBlur: () => p(!1),
      onFocus: () => p(!0),
      ref: v,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: z,
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
zo.displayName = "Separator";
const zn = 30, On = 65, wt = 50, jl = 100 - On, Bl = 100 - zn;
function Ul(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(On, Math.max(zn, t)) : wt;
}
function Fn(e) {
  return 100 - e;
}
function Qe(e) {
  return `${e}%`;
}
const $n = "reader-document", St = "reader-assistant", Oo = "retainpdf.reader.ai-split-layout.v1", Hl = {
  [$n]: Fn(wt),
  [St]: wt
};
function jn(e) {
  const t = Ul(e == null ? void 0 : e[St]);
  return {
    [$n]: Fn(t),
    [St]: t
  };
}
function Wl() {
  try {
    const e = JSON.parse(localStorage.getItem(Oo) || "null");
    return jn(e);
  } catch {
    return Hl;
  }
}
function Vl(e) {
  try {
    localStorage.setItem(Oo, JSON.stringify(jn(e)));
  } catch {
  }
}
function nn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = jn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[St]}vw`
  );
}
function Jl() {
  const e = _(null), [t] = N(Wl);
  Ae(() => {
    const o = e.current;
    return nn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = O((o) => {
    nn(e.current, o);
  }, []), r = O((o, a) => {
    nn(e.current, o), a.isUserInteraction && Vl(o);
  }, []);
  return /* @__PURE__ */ F(
    xo,
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
          gn,
          {
            id: $n,
            defaultSize: Qe(Fn(wt)),
            minSize: Qe(jl),
            maxSize: Qe(Bl)
          }
        ),
        /* @__PURE__ */ g(
          zo,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ g("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ g(
          gn,
          {
            id: St,
            defaultSize: Qe(wt),
            minSize: Qe(zn),
            maxSize: Qe(On)
          }
        )
      ]
    }
  );
}
function Kl({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = N(!1);
  if ($(() => {
    !e && !t && o(!1);
  }, [e, t]), r || !e && !t)
    return null;
  const a = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ F("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ F("span", { className: "reader-error-notice-text", children: [
      a.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    n ? /* @__PURE__ */ g(ye, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function Gl({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ g(Kl, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ F(st, { children: [
    e ? /* @__PURE__ */ g("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ F("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ g("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ g("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ g(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ F("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ g("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ g(ye, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function ql(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Zl() {
  const [e, t] = N(!1), n = Or(), r = _(null);
  return $(() => {
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
  }, [e]), $(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || ql(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((i) => !i);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ F("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ g(ca, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ F(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ F("div", { className: "reader-react-shortcuts-head", children: [
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
          /* @__PURE__ */ g("div", { className: "reader-react-shortcuts-body", children: vi.map((o) => /* @__PURE__ */ F("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ g("h3", { children: o.title }),
            /* @__PURE__ */ g("ul", { children: o.items.map((a) => /* @__PURE__ */ F("li", { children: [
              /* @__PURE__ */ g("kbd", { children: a.keys }),
              /* @__PURE__ */ g("span", { children: a.desc })
            ] }, `${o.title}-${a.keys}`)) })
          ] }, o.title)) }),
          /* @__PURE__ */ g("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const Yl = ["source", "sideBySide", "translated"], Xl = { source: "", translated: "", sideBySide: "" };
function Ql(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = Ct(e.sourceUrl), n = Ct(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return ka({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function ed(e) {
  const [t, n] = N(() => /* @__PURE__ */ new Set()), r = G(
    () => e ? Ql(e) : Xl,
    [e]
  ), o = G(
    () => Yl.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = O(async (s) => {
    if (!e) return;
    const i = Ct(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? Ta(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Aa(
          e.fetchProtected,
          i,
          c,
          c,
          null,
          (l) => n((d) => {
            const u = new Set(d);
            return l ? u.add(s) : u.delete(s), u;
          })
        );
      } catch (c) {
        const l = c instanceof Error ? c.message : "下载失败";
        Ma(l), n((d) => {
          const u = new Set(d);
          return u.delete(s), u;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const td = {
  source: $r,
  sideBySide: jr,
  translated: Br
}, nd = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function rd(e) {
  const t = je(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = ed(n), i = _(null);
  return $(() => {
    const c = () => {
      var u;
      (u = i.current) != null && u.open && (i.current.open = !1);
    }, l = (u) => {
      i.current && !i.current.contains(u.target) && c();
    }, d = (u) => {
      u.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", l), document.addEventListener("keydown", d), () => {
      document.removeEventListener("pointerdown", l), document.removeEventListener("keydown", d);
    };
  }, []), /* @__PURE__ */ F("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ F("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ g(la, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ g("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ g(Fr, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ g("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = Wo[c], d = Ct(r[c]), u = a.has(c), f = !!d && !u, m = f ? "" : Vo(c, r), b = td[c];
      return /* @__PURE__ */ F(
        "button",
        {
          type: "button",
          id: `reader-download-${c}`,
          className: `reader-download-action${u ? " is-busy" : ""}`,
          disabled: !f,
          "aria-label": f ? `下载${l.label}` : m,
          onClick: () => {
            i.current && (i.current.open = !1), s(c);
          },
          children: [
            /* @__PURE__ */ g(b, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ F("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ F("span", { className: "reader-download-action-label", children: [
                nd[c],
                " PDF"
              ] }),
              m ? /* @__PURE__ */ g("span", { className: "reader-download-action-reason", children: m }) : null
            ] })
          ]
        },
        c
      );
    }) })
  ] });
}
const od = "retainpdf:reader:bookmarks:v1:", ad = 200;
function Bn() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Fo(e) {
  const t = `${e || ""}`.trim();
  return t ? `${od}${t}` : "";
}
function sd(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Bt(e, t = Bn()) {
  const n = Fo(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = sd(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function bn(e, t, n) {
  const r = Fo(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, ad);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function id(e, t, n = "", { storage: r = Bn(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Bt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? bn(e, a.filter((i) => i.page !== s), r) : bn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function cd(e, t, n = Bn()) {
  return bn(e, Bt(e, n).filter((r) => r.page !== t), n);
}
function ld(e, t) {
  var r, o, a, s;
  let n = null;
  for (const i of e || []) {
    if (`${(i == null ? void 0 : i.regionType) || ""}` != "heading") continue;
    const c = Number(((r = i.source) == null ? void 0 : r.page) ?? ((o = i.translated) == null ? void 0 : o.page));
    if (!Number.isFinite(c) || c > t) continue;
    const l = `${((a = i.translated) == null ? void 0 : a.text) || i.markdown || ((s = i.source) == null ? void 0 : s.text) || ""}`.replace(/\s+/g, " ").trim();
    if (!l) continue;
    const d = Number(i.readingOrder) || 0;
    (!n || c > n.page || c === n.page && d >= n.order) && (n = { page: c, order: d, text: l });
  }
  return n ? n.text.slice(0, 60) : "";
}
function dd({ filled: e }) {
  return /* @__PURE__ */ g("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ g("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function ud({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = N(() => Bt(e)), [i, c] = N(!1), l = _(null);
  if ($(() => {
    s(Bt(e)), c(!1);
  }, [e]), $(() => {
    if (!i) return;
    const f = (b) => {
      l.current && !l.current.contains(b.target) && c(!1);
    }, m = (b) => {
      b.key === "Escape" && c(!1);
    };
    return document.addEventListener("pointerdown", f), document.addEventListener("keydown", m), () => {
      document.removeEventListener("pointerdown", f), document.removeEventListener("keydown", m);
    };
  }, [i]), !e || n <= 0) return null;
  const d = Math.min(Math.max(t, 1), n), u = a.some((f) => f.page === d);
  return /* @__PURE__ */ F("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${u ? " is-marked" : ""}`,
        "aria-pressed": u,
        "aria-label": u ? `取消第 ${d} 页的书签` : `给第 ${d} 页加书签`,
        title: u ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(id(e, d, ld(r, d))),
        children: /* @__PURE__ */ g(dd, { filled: u })
      }
    ),
    /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: "reader-react-hud-btn reader-bookmark-list-btn",
        "aria-expanded": i,
        "aria-haspopup": "true",
        "aria-label": `书签列表，共 ${a.length} 个`,
        title: "书签列表",
        disabled: !a.length,
        onClick: () => c((f) => !f),
        children: a.length
      }
    ),
    i && a.length ? /* @__PURE__ */ g("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ g("ol", { className: "reader-bookmark-list", children: a.map((f) => /* @__PURE__ */ F("li", { className: f.page === d ? "is-current" : "", children: [
      /* @__PURE__ */ F(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(f.page, n)), c(!1);
          },
          children: [
            /* @__PURE__ */ F("span", { className: "reader-bookmark-page", children: [
              "第 ",
              f.page,
              " 页"
            ] }),
            f.label ? /* @__PURE__ */ g("span", { className: "reader-bookmark-label", children: f.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ g(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${f.page} 页的书签`,
          onClick: () => s(cd(e, f.page)),
          children: "×"
        }
      )
    ] }, f.page)) }) }) : null
  ] });
}
function fd(e) {
  const t = je(), n = bo(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Pt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), d = ws(a), u = a > Kr + 1e-3, f = a < $t - 1e-3, m = et(r, We()), b = m >= $t ? "100%（铺满阅读区）" : "50%（半屏，对照铺满）", [p, w] = N(!1), [v, S] = N(`${i}`);
  $(() => {
    p || S(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, p]);
  const P = () => {
    if (w(!1), !l || c <= 0)
      return;
    const h = Number(`${v}`.trim());
    l(jt(h, c));
  };
  return /* @__PURE__ */ F("div", { className: "reader-react-hud", "data-reader-hud": "true", children: [
    o ? /* @__PURE__ */ g("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ g("div", { className: "reader-react-hud-group", "aria-label": "页码", children: p ? /* @__PURE__ */ F(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (h) => {
          h.preventDefault(), P();
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
              value: v,
              autoFocus: !0,
              onChange: (h) => S(h.target.value.replace(/[^\d]/g, "")),
              onBlur: P,
              onKeyDown: (h) => {
                h.key === "Escape" && (h.preventDefault(), w(!1), S(`${i}`));
              }
            }
          ),
          /* @__PURE__ */ F("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            c || "—"
          ] })
        ]
      }
    ) : /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: "reader-react-hud-page reader-react-hud-page-btn",
        "aria-label": c > 0 ? `跳转页码，当前第 ${i} 页，共 ${c} 页` : "页码",
        title: c > 0 ? "点击输入页码跳转" : void 0,
        disabled: !l || c <= 0,
        onClick: () => {
          !l || c <= 0 || (S(`${i}`), w(!0));
        },
        children: c > 0 ? `${Math.min(i, c)} / ${c}` : "—"
      }
    ) }),
    e.bookmarkScope ? /* @__PURE__ */ g(
      ud,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: c,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    /* @__PURE__ */ F("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ g(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !u,
          onClick: () => s(bt(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ F(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `重置为${b}`,
          title: b,
          onClick: () => s(m),
          children: [
            d,
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
          disabled: !f,
          onClick: () => s(bt(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ g("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ g(Zl, {}) })
  ] });
}
function Cr(e) {
  var t, n;
  return Yr(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function md(e) {
  const [t, n] = N(() => ({
    scope: e,
    panel: Cr(ke(e))
  }));
  $(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Cr(ke(e))
    });
  }, [e]), $(() => {
    t.scope === e && Vt(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = O((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const yn = "download-toast";
function hd({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ F("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ F("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ g("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ g("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ g("div", { className: "download-toast-track", children: /* @__PURE__ */ g("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ g("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function pd(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    on.dismiss(yn);
    return;
  }
  on.custom(
    () => /* @__PURE__ */ g(hd, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: yn, duration: 1 / 0 }
  );
}
function gd() {
  const e = O((t) => {
    t && (t.setState = pd, t.hide = () => on.dismiss(yn));
  }, []);
  return /* @__PURE__ */ F(st, { children: [
    /* @__PURE__ */ g(ra, { position: "bottom-right" }),
    /* @__PURE__ */ g("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function bd(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Gr(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function yd(e, t) {
  return t === null || e !== t;
}
function vd(e) {
  const t = _(!1);
  return e && (t.current = !0), t.current;
}
function wd(e, t) {
  const n = e === t;
  return { open: n, mounted: vd(n) };
}
const xr = { itemId: null, origin: null };
function Sd() {
  let e = xr;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? xr : { itemId: n, origin: r };
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
const Rd = [];
function Pd({ open: e, onToggle: t }) {
  return /* @__PURE__ */ F("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ F(ye, { className: "reader-finder-toggle", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: [
      /* @__PURE__ */ g(da, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ g("span", { children: "目录" })
    ] }),
    /* @__PURE__ */ F(ye, { className: "reader-finder-toggle", "aria-pressed": e === "search", title: "在书里搜索（原文和译文）", onClick: () => t("search"), children: [
      /* @__PURE__ */ g(ua, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ g("span", { children: "搜索" })
    ] })
  ] });
}
function Ed({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0
}) {
  var S, P;
  const c = ((S = je()) == null ? void 0 : S.regions) ?? Rd, l = ((P = bo()) == null ? void 0 : P.currentPage) ?? 1, d = G(() => Ic(c), [c]), u = Tc(d, l), f = G(() => Mc(c, s), [c, s]), [m, b] = N(-1);
  $(() => b(-1), [s]);
  const p = _(null), w = _(null);
  $(() => {
    var h, y, T;
    e === "search" ? (h = p.current) == null || h.focus() : (T = (y = w.current) == null ? void 0 : y.querySelector('[aria-current="location"]')) == null || T.scrollIntoView({ block: "center" });
  }, [e, i]), $(() => {
    var h, y;
    e === "search" && m >= 0 && ((y = (h = w.current) == null ? void 0 : h.querySelector('[aria-current="true"]')) == null || y.scrollIntoView({ block: "nearest" }));
  }, [e, m]);
  const v = (h) => {
    const y = f[h];
    y && (b(h), r(y.itemId));
  };
  return /* @__PURE__ */ F("aside", { className: "reader-finder", "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ F("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ F("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ g(ye, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ g(ye, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ g(ye, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ g(Pn, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? d.length ? /* @__PURE__ */ g("ol", { ref: w, className: "reader-finder-list", children: d.map((h, y) => /* @__PURE__ */ g("li", { children: /* @__PURE__ */ F(
      ye,
      {
        className: "reader-finder-entry",
        "data-level": h.level,
        "aria-current": y === u ? "location" : void 0,
        onClick: () => r(h.itemId),
        children: [
          /* @__PURE__ */ g("span", { className: "reader-finder-entry-text", children: h.text }),
          /* @__PURE__ */ g("span", { className: "reader-finder-entry-page", children: h.page })
        ]
      }
    ) }, h.itemId)) }) : /* @__PURE__ */ g("p", { className: "reader-finder-empty", children: c.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ F(st, { children: [
      /* @__PURE__ */ F("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ g(
          Ur,
          {
            ref: p,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (h) => a(h.target.value),
            onKeyDown: (h) => {
              h.key === "Enter" ? (h.preventDefault(), v(_c(m, f.length, h.shiftKey))) : h.key === "Escape" && (h.preventDefault(), n()), h.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ g("p", { className: "reader-finder-count", "aria-live": "polite", children: f.length === 0 ? "没有找到" : `${m >= 0 ? `第 ${m + 1} / ` : ""}${f.length >= 200 ? "200+ 处，只列前 200 处" : `${f.length} 处`}${m < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ g("ol", { className: "reader-finder-list", children: f.map((h, y) => /* @__PURE__ */ g("li", { children: /* @__PURE__ */ F(ye, { className: "reader-finder-entry is-hit", "aria-current": y === m ? "true" : void 0, onClick: () => v(y), children: [
        /* @__PURE__ */ F("span", { className: "reader-finder-entry-text", children: [
          h.snippet.slice(0, h.at),
          /* @__PURE__ */ g("mark", { children: h.snippet.slice(h.at, h.at + h.length) }),
          h.snippet.slice(h.at + h.length)
        ] }),
        /* @__PURE__ */ g("span", { className: "reader-finder-entry-page", children: h.page })
      ] }) }, h.itemId)) })
    ] })
  ] });
}
const Id = "reader-finder-input";
function Td(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function kd(e, t = typeof window > "u" ? null : window) {
  $(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!Td(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(Id) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function Ad() {
  try {
    return Rt().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Md = "这本书正在处理（翻译或排版），处理完才能改。", Nd = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function _d({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Ad(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = ec(s), l = !t || pt(t), d = sc(n), [u, f] = N(""), [m, b] = N(null), [p, w] = N(() => /* @__PURE__ */ new Map()), [v, S] = N(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [P, h] = N(() => /* @__PURE__ */ new Map()), [y, T] = N({ phase: "idle" }), M = _({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  $(() => {
    b(null), M.drafts.clear(), M.generation.current = null, h(/* @__PURE__ */ new Map()), T({ phase: "idle" });
  }, [s]), $(() => {
    if (f(""), !i || c || !a) return;
    let A = !1;
    return a.resolveOwnerJobId(s).then((B) => {
      A || f(`${B || s}`.trim() || s);
    }).catch(() => {
      A || f(s);
    }), () => {
      A = !0;
    };
  }, [i, c, a, s]), $(() => {
    if (w(/* @__PURE__ */ new Map()), !a || !u || !d || !l) return;
    let A = !1;
    return a.fetchRevisions(u).then((B) => {
      A || w(ic(B, d));
    }).catch(() => {
    }), () => {
      A = !0;
    };
  }, [a, u, d, l]);
  const z = y.phase === "running" && y.seenActive;
  $(() => {
    if (y.phase === "running") {
      if (!l) {
        z || T({ phase: "running", seenActive: !0 });
        return;
      }
      z && T(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [y.phase, z, l, t]);
  const D = G(() => {
    const A = new Map(p);
    if (v.renderedAt === d)
      for (const [B, C] of v.edits) A.set(B, C);
    return A;
  }, [p, v, d]), x = O((A) => {
    const B = `${A || ""}`.trim();
    B && b({ itemId: B, page: tc(B) });
  }, []), R = O(() => b(null), []), E = O((A, B) => {
    S((C) => {
      const J = new Map(C.renderedAt === d ? C.edits : []);
      return J.set(A, B), { renderedAt: d, edits: J };
    }), h((C) => new Map(C).set(A, (C.get(A) || 0) + 1));
  }, [d]), I = O(async () => {
    if (!(!a || !s || y.phase === "submitting" || y.phase === "running")) {
      T({ phase: "submitting" });
      try {
        await a.rerender(s), T({ phase: "running", seenActive: !1 }), await o();
      } catch (A) {
        T({ phase: "failed", message: (A == null ? void 0 : A.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, y.phase, o]), k = c ? Nd : !l || y.phase === "running" || y.phase === "submitting" ? Md : "";
  return G(() => ({
    available: i,
    blockedReason: k,
    port: a,
    ownerJobId: u,
    target: m,
    select: x,
    close: R,
    memory: M,
    pendingEdits: D,
    savedCounts: P,
    markSaved: E,
    rerender: y,
    startRerender: I
  }), [i, k, a, u, m, x, R, M, D, P, E, y, I]);
}
function Ld(e, t) {
  $(() => {
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
function Dd({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ g("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ F("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ g("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ g(
      ye,
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
const Cd = Bo(() => import("./ReaderMarkdownPanel-ZlNBI5Le.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function xd(e) {
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
function zd(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Od() {
  const e = bi(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = md(e.viewStateKey), s = a.panel, i = a.setPanel, [c, l] = N(!1), d = _(null), u = _(null), f = s !== null, m = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, b = xd({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: m,
    liveTranslationVisible: c,
    assistantOpen: f
  }), p = ci({
    hasOverlayContent: m,
    connection: e.liveTranslation.connection,
    showSource: b.showSource,
    liveTranslationVisible: c,
    assistantOpen: f
  }), w = b.sourceViewOnly, v = b.visibleMode;
  $(() => {
    l(!1);
  }, [e.viewStateKey]), $(() => {
    e.session.jobTerminal && l(!1);
  }, [e.session.jobTerminal]), $(() => {
    if (!(t.loading || t.failed)) {
      if (d.current !== e.viewStateKey) {
        d.current = e.viewStateKey;
        const U = ke(e.viewStateKey), se = bd({
          savedMode: U == null ? void 0 : U.mode,
          sourceViewOnly: w,
          viewportWidth: We()
        });
        u.current = se.auto ? se.mode : null, se.mode && se.mode !== e.mode && e.setModeKeepingPage(se.mode);
        return;
      }
      yd(e.mode, u.current) && (u.current = null, Vt(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, w]);
  const S = s || (e.mode === "compare" ? "compare" : "reading"), P = wd(s, "markdown");
  Ei({
    mode: v,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const h = O(() => {
    i(null);
  }, []), y = O((U) => {
    const se = zd(U, e.liveTranslationAvailable);
    se !== null && l(se), e.setModeKeepingPage(U);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), T = G(() => p.sourcePaneToggle ? /* @__PURE__ */ g(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${c ? " is-active" : ""}`,
      onClick: () => l((U) => !U),
      "aria-pressed": c,
      title: c ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [p.sourcePaneToggle, c]), M = O((U) => {
    i(U);
  }, []), [z] = N(Sd), [D, x] = N(null), R = O((U) => x((se) => se === U ? null : U), []), [E, I] = N(""), [k, A] = N("");
  $(() => {
    const U = E.replace(/\s+/gu, " ").trim(), se = window.setTimeout(() => A(U), U ? 150 : 0);
    return () => window.clearTimeout(se);
  }, [E]);
  const [B, C] = N(0), J = O(() => {
    x("search"), C((U) => U + 1);
  }, []);
  kd(J);
  const re = O((U) => {
    e.jumpToAnchor({ block_id: U }), We() < 900 && x(null);
  }, [e.jumpToAnchor]), q = O((U) => e.jumpToAnchor({ block_id: U }), [e.jumpToAnchor]), X = _d({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), pe = X.select, oe = e.setModeKeepingPage, ae = O((U) => {
    v === "source" && oe("compare"), pe(U);
  }, [pe, v, oe]);
  Ld(X.available ? ae : null, z);
  const we = G(() => {
    if (!X.savedCounts.size) return e.revisedBlocks;
    const U = new Map(e.revisedBlocks);
    for (const [se, Be] of X.savedCounts) U.set(se, (U.get(se) || 0) + Be);
    return U;
  }, [e.revisedBlocks, X.savedCounts]), V = G(() => ({
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
    regionHover: z,
    jumpToBlock: q,
    revisedBlocks: we,
    editBlock: X.available ? ae : void 0,
    blockEdit: X,
    editShowsSource: v !== "compare",
    findTerm: D === "search" ? k : "",
    sourceOnly: e.sourceOnly,
    sourceViewOnly: w,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: M, close: h }
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
    z,
    q,
    we,
    X,
    ae,
    v,
    D,
    k,
    e.sourceOnly,
    w,
    e.download,
    e.goToPage,
    M,
    h
  ]), Q = G(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), me = [
    us,
    `is-workspace-${S}`,
    f ? "is-assistant-open" : "",
    D ? "is-finder-open" : "",
    b.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ g(yc, { value: V, hud: Q, children: /* @__PURE__ */ F("div", { className: me, "data-reader-engine": "react-pdf", "data-reader-workspace": S, children: [
    /* @__PURE__ */ g(Gl, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
    /* @__PURE__ */ g(Pd, { open: D, onToggle: R }),
    D ? /* @__PURE__ */ g(
      Ed,
      {
        tab: D,
        onTab: x,
        onClose: () => x(null),
        onJump: re,
        query: E,
        onQuery: I,
        term: k,
        focusSignal: B
      }
    ) : null,
    /* @__PURE__ */ F("div", { className: "reader-chrome-tray", children: [
      /* @__PURE__ */ g(al, { active: s }),
      /* @__PURE__ */ g(rd, {}),
      /* @__PURE__ */ g(_i, { onBeforeClose: o.prepareClose })
    ] }),
    /* @__PURE__ */ g(
      nl,
      {
        mode: v,
        documentReady: !!o.jobId,
        sourceViewOnly: w,
        onModeChange: y,
        liveTranslation: p.topBarPill ? {
          visible: c,
          state: e.liveTranslation,
          onToggle: () => l((U) => !U)
        } : null
      }
    ),
    /* @__PURE__ */ g(sl, { active: s }),
    f ? /* @__PURE__ */ g(Jl, {}) : null,
    /* @__PURE__ */ g(Xc, { paneComposition: b, markdownSplit: P.open, assistantSplit: f, liveTranslation: e.liveTranslation, sourcePaneAction: T }),
    e.showHud ? /* @__PURE__ */ g(
      fd,
      {
        mode: v,
        modeControls: null,
        bookmarkScope: e.viewStateKey
      }
    ) : null,
    /* @__PURE__ */ g(jo, { fallback: null, children: P.mounted ? /* @__PURE__ */ g(Cd, { open: P.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: h }) : null }),
    /* @__PURE__ */ g(Dd, { edit: X }),
    /* @__PURE__ */ g(gd, {})
  ] }) });
}
function nu() {
  return /* @__PURE__ */ g(Od, {});
}
export {
  nu as R,
  Od as a,
  eu as d,
  Qd as f,
  tu as r,
  je as u
};
//# sourceMappingURL=ReaderApp-Ba-z1JTr.js.map
