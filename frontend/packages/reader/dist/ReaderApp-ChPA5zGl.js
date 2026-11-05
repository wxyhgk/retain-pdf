var xn = (e) => {
  throw TypeError(e);
};
var On = (e, t, n) => t.has(e) || xn("Cannot " + n);
var at = (e, t, n) => (On(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Fn = (e, t, n) => t.has(e) ? xn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), $n = (e, t, n, r) => (On(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
import { jsx as b, jsxs as O, Fragment as Lt } from "react/jsx-runtime";
import { useMemo as X, useState as _, useEffect as j, useCallback as $, useRef as k, useLayoutEffect as _e, useSyncExternalStore as Ct, memo as un, createContext as dn, useContext as fn, forwardRef as Ro, useImperativeHandle as mn, useId as kr, Suspense as Io, lazy as To } from "react";
import { getReaderAdapters as fe, requireAdapter as Qe } from "./adapters.js";
import { resolveReaderDownloadName as Eo, resolveReaderDownloadUrls as ko, READER_PROGRESS_COPY as Ie, trimString as It, READER_DOWNLOAD_ACTIONS as Mo, disabledReason as Ao } from "./runtime/state.js";
import { r as No, b as _o } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Gt, isFinishedJobStatus as hn } from "@retainpdf/domain/job";
import { c as Lo, n as Co, f as jt, j as jn, a as Do, b as zo, h as Mr, p as pn, d as xo, k as Bn, i as Oo } from "./reader-regions-CP3ZMHPc.js";
import { fetchDocumentReading as Fo } from "@retainpdf/api/documents";
import { isReaderTransportError as $o, createReaderTransportError as jo } from "./contracts.js";
import { toast as Kt, Toaster as Bo } from "sonner";
import { NotebookPen as Uo, X as gn, Radio as Ho, FileText as Ar, Columns2 as Nr, Languages as _r, FileCode2 as Wo, Sparkles as Vo, Keyboard as Jo, Download as qo, ChevronDown as Go, ListTree as Ko, Search as Zo } from "lucide-react";
import { Button as Ce, Input as Yo } from "@retainpdf/ui";
import { pdfjs as Xo, Page as Qo, Document as ea } from "react-pdf";
import { extractMarkdownMath as ta, materializeMarkdownMathFallbackHtml as na, materializeMarkdownMathHtml as ra } from "./runtime/content.js";
const oa = (...e) => {
  var t, n;
  return ((n = (t = fe()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, aa = "", sa = Object.freeze({
========
import { jsx as y, jsxs as O, Fragment as Ct } from "react/jsx-runtime";
import { useMemo as Q, useState as _, useEffect as j, useCallback as $, useRef as M, useLayoutEffect as Ce, useSyncExternalStore as gt, memo as un, createContext as dn, useContext as fn, forwardRef as Po, useImperativeHandle as mn, useId as kr, Suspense as Ro, lazy as Io } from "react";
import { getReaderAdapters as ue, requireAdapter as et } from "./adapters.js";
import { resolveReaderDownloadName as To, resolveReaderDownloadUrls as Eo, READER_PROGRESS_COPY as Ie, trimString as Tt, READER_DOWNLOAD_ACTIONS as ko, disabledReason as Mo } from "./runtime/state.js";
import { r as Ao, b as No } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Gt, isFinishedJobStatus as hn } from "@retainpdf/domain/job";
import { c as _o, n as Lo, f as jt, j as jn, a as Co, b as Do, h as Mr, p as pn, d as zo, k as Bn, i as xo } from "./reader-regions-CP3ZMHPc.js";
import { fetchDocumentReading as Oo } from "@retainpdf/api/documents";
import { isReaderTransportError as Fo, createReaderTransportError as $o } from "./contracts.js";
import { toast as Kt, Toaster as jo } from "sonner";
import { NotebookPen as Bo, X as gn, Radio as Uo, FileText as Ar, Columns2 as Nr, Languages as _r, FileCode2 as Ho, Sparkles as Wo, Keyboard as Vo, Download as Jo, ChevronDown as qo, ListTree as Go, Search as Ko } from "lucide-react";
import { Button as ze, Input as Zo } from "@retainpdf/ui";
import { pdfjs as Yo, Page as Xo, Document as Qo } from "react-pdf";
import { extractMarkdownMath as ea, materializeMarkdownMathFallbackHtml as ta, materializeMarkdownMathHtml as na } from "./runtime/content.js";
const ra = (...e) => {
  var t, n;
  return ((n = (t = ue()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, oa = "", aa = Object.freeze({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  progress: "retainpdf-reader-progress"
}), ia = (e) => {
  var t, n;
  return ((n = (t = ue()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Pu = (...e) => {
  var n;
  return (((n = ue()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Te = () => et("defaultReaderDataPort"), Un = () => et("defaultReaderPageConfigPort"), Ru = {
  get apiPrefix() {
    return Te().apiPrefix;
  },
  fetchProtected: (...e) => Te().fetchProtected(...e),
  loadMarkdownPayload: (e) => Te().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Te().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Te().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Te().loadJobPayload(e),
  loadReaderPayload: (e, t) => Te().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Te().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Te().liveTranslation;
  }
}, Lr = {
  messageTargetOrigin: () => Un().messageTargetOrigin(),
  readerJobId: () => Un().readerJobId()
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
}, ca = () => {
  var e;
  return ((e = fe()) == null ? void 0 : e.liveTranslation) ?? null;
}, la = () => {
  var e;
  return ((e = fe()) == null ? void 0 : e.notesQuote) ?? null;
}, ua = () => {
  var e;
  return ((e = fe()) == null ? void 0 : e.notesPanel) ?? null;
}, da = () => {
  var e;
  return ((e = fe()) == null ? void 0 : e.readingPosition) ?? null;
}, fa = () => {
  var e;
  return ((e = fe()) == null ? void 0 : e.hostAi) ?? null;
}, ma = () => {
  var e;
  return ((e = fe()) == null ? void 0 : e.hostNavigation) ?? null;
========
}, ia = () => {
  var e;
  return ((e = ue()) == null ? void 0 : e.liveTranslation) ?? null;
}, ca = () => {
  var e;
  return ((e = ue()) == null ? void 0 : e.notesQuote) ?? null;
}, la = () => {
  var e;
  return ((e = ue()) == null ? void 0 : e.notesPanel) ?? null;
}, ua = () => {
  var e;
  return ((e = ue()) == null ? void 0 : e.readingPosition) ?? null;
}, da = () => {
  var e;
  return ((e = ue()) == null ? void 0 : e.hostAi) ?? null;
}, fa = () => {
  var e;
  return ((e = ue()) == null ? void 0 : e.hostNavigation) ?? null;
}, ma = () => {
  var e;
  return ((e = ue()) == null ? void 0 : e.quotedBlocks) ?? null;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
}, dt = () => {
  var t;
  const e = ue();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Dt = () => {
  const e = ue();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => et("fetchDocumentByJobId")(...n),
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
}, ha = (...e) => {
  var t, n;
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  return ((n = (t = fe()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, pa = () => {
  var e, t;
  return ((t = (e = fe()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, ga = (...e) => {
  var t, n;
  return ((n = (t = fe()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, ba = (...e) => {
  var t, n;
  return ((n = (t = fe()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Eo(...e);
}, ya = (...e) => {
  var t, n;
  return ((n = (t = fe()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? ko(...e);
}, va = (...e) => Qe("downloadProtectedResource")(...e), Sa = (...e) => Qe("failDownloadToast")(...e), vu = (e, t) => Qe("resolveMarkdownAssetUrl")(e, t), Hn = "/api/v1";
========
  return ((n = (t = ue()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, pa = () => {
  var e, t;
  return ((t = (e = ue()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, ga = (...e) => {
  var t, n;
  return ((n = (t = ue()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, ba = (...e) => {
  var t, n;
  return ((n = (t = ue()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? To(...e);
}, ya = (...e) => {
  var t, n;
  return ((n = (t = ue()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Eo(...e);
}, va = (...e) => et("downloadProtectedResource")(...e), Sa = (...e) => et("failDownloadToast")(...e), Iu = (e, t) => et("resolveMarkdownAssetUrl")(e, t), Hn = "/api/v1";
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
function wa() {
  const e = () => {
    var r;
    return No(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = _(e);
  return j(() => {
    var c, i, l, u;
    const r = () => n(e()), o = (i = (c = globalThis.history) == null ? void 0 : c.pushState) == null ? void 0 : i.bind(globalThis.history), a = (u = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const d = (f) => function(...m) {
          const g = f.apply(this, m);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), g;
        };
        globalThis.history.pushState = d(o), globalThis.history.replaceState = d(a), s = !0;
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
function Pa() {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  const e = wa(), t = X(() => ga(Lr), [e]), n = X(() => pa(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
========
  const e = wa(), t = Q(() => ga(Lr), [e]), n = Q(() => pa(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Ra(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: c
  } = e, [i, l] = _({
    documentId: "",
    jobId: ""
  }), [u, d] = _({
    documentId: "",
    jobId: ""
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  }), m = i.documentId === t ? i.jobId : "", h = u.documentId === t ? u.jobId : "", g = n || m, [f, v] = _({
    jobId: "",
    documentId: ""
  }), y = f.jobId === g ? f.documentId : "", S = t || y, P = !!t && !g, [p, w] = _(null), M = (p == null ? void 0 : p.sessionIdentity) === r && p.documentId === S ? p : null, A = P || !!M, F = $((D) => {
    const R = `${D.documentId || ""}`.trim();
    if (!R || a.current && a.current !== R) return;
    if (!a.current && s.current)
      v({
========
  }), f = i.documentId === t ? i.jobId : "", m = u.documentId === t ? u.jobId : "", g = n || f, [h, p] = _({
    jobId: "",
    documentId: ""
  }), v = h.jobId === g ? h.documentId : "", P = t || v, w = !!t && !g, [b, S] = _(null), E = (b == null ? void 0 : b.sessionIdentity) === r && b.documentId === P ? b : null, N = w || !!E, x = $((D) => {
    const R = `${D.documentId || ""}`.trim();
    if (!R || a.current && a.current !== R) return;
    if (!a.current && s.current)
      p({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        jobId: s.current,
        documentId: R
      });
    else if (!a.current)
      return;
    const I = `${D.revision || ""}`.trim() || `${Date.now()}`;
    w({
      documentId: R,
      revision: I,
      sessionIdentity: o.current
    }), c();
  }, []);
  j(() => {
    w((D) => D && D.sessionIdentity !== r ? null : D);
  }, [r]);
  const z = $((D) => {
    switch (D.type) {
      case "resolved-document-job":
        l({ documentId: D.documentId, jobId: D.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        d({ documentId: D.documentId, jobId: D.jobId });
        break;
      case "resolved-job-document":
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        v((R) => R.jobId === D.jobId && R.documentId === D.documentId ? R : { jobId: D.jobId, documentId: D.documentId });
========
        p((R) => R.jobId === D.jobId && R.documentId === D.documentId ? R : { jobId: D.jobId, documentId: D.documentId });
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        break;
      case "committed-source":
        w({
          documentId: D.documentId,
          revision: D.revision,
          sessionIdentity: D.sessionIdentity
        });
        break;
    }
  }, []);
  return {
    resolvedDocumentJob: i,
    setResolvedDocumentJob: l,
    missingDocumentJob: u,
    setMissingDocumentJob: d,
    documentJobId: f,
    rejectedDocumentJobId: m,
    sessionJobId: g,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    resolvedJobDocument: f,
    setResolvedJobDocument: v,
    jobDocumentId: y,
    documentId: S,
    sourceOnly: P,
    committedDocumentSource: p,
    setCommittedDocumentSource: w,
    activeCommittedDocumentSource: M,
    sourceViewOnly: A,
    refreshCommittedDocument: F,
========
    resolvedJobDocument: h,
    setResolvedJobDocument: p,
    jobDocumentId: v,
    documentId: P,
    sourceOnly: w,
    committedDocumentSource: b,
    setCommittedDocumentSource: S,
    activeCommittedDocumentSource: E,
    sourceViewOnly: N,
    refreshCommittedDocument: x,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    applyIdentityEvent: z
  };
}
function Wn(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Ia(e) {
  var r, o, a, s;
  if (!e || typeof e != "object") return "";
  const t = e, n = [
    t.document_id,
    t.documentId,
    (r = t.document) == null ? void 0 : r.document_id,
    (o = t.book_summary) == null ? void 0 : o.document_id,
    (s = (a = t.request_payload) == null ? void 0 : a.source) == null ? void 0 : s.document_id
  ];
  for (const c of n) {
    const i = `${c || ""}`.trim();
    if (i) return i;
  }
  return "";
}
function Vn(e, t) {
  return ia(Gt(e, t));
}
function Ta(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Ea(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !Ta(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function Zt({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: sa.progress,
        stage: n,
        percent: e,
        text: t
      },
      Lr.messageTargetOrigin()
    );
  } catch {
  }
}
function Et(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Zt({ percent: t, text: n, stage: r });
}
function ka(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  } = e, [c, i] = _(null), [l, u] = _(null), [d, m] = _(""), [h, g] = _(0), f = d === n ? c : null, v = d === n ? l : null, y = Wn(f), S = hn(y), P = $(() => {
    g((z) => z + 1);
  }, []), p = $((z) => {
    i(z.jobPayload), u(z.manifestPayload), m(z.sessionIdentity);
  }, []), w = $((z) => {
    i(null), u(null), m(z);
  }, []), M = k(""), A = k(""), F = $(async () => {
========
  } = e, [c, i] = _(null), [l, u] = _(null), [d, f] = _(""), [m, g] = _(0), h = d === n ? c : null, p = d === n ? l : null, v = Wn(h), P = hn(v), w = $(() => {
    g((z) => z + 1);
  }, []), b = $((z) => {
    i(z.jobPayload), u(z.manifestPayload), f(z.sessionIdentity);
  }, []), S = $((z) => {
    i(null), u(null), f(z);
  }, []), E = M(""), N = M(""), x = $(async () => {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    const z = o.current;
    if (!z || E.current === z) return;
    const D = Dt().loadJobPayload;
    if (typeof D != "function") return;
    const R = a.current.value;
    E.current = z;
    try {
      const I = await D(z);
      if (s.current || a.current.value !== R || o.current !== z || !I || typeof I != "object")
        return;
      const T = Wn(I);
      i(I), f(r.current), T === "succeeded" && N.current !== z && (N.current = z, g((k) => k + 1));
    } catch {
    } finally {
      E.current === z && (E.current = "");
    }
  }, []);
  return j(() => {
    N.current = "";
  }, [n]), j(() => {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    if (!t || S || !f) return;
========
    if (!t || P || !h) return;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    const z = window.setInterval(() => {
      document.visibilityState !== "hidden" && x();
    }, 1e3);
    return () => window.clearInterval(z);
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  }, [S, F, f, t]), {
========
  }, [P, x, h, t]), {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    jobPayload: c,
    setJobPayload: i,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: d,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    setPayloadSessionIdentity: m,
    scopedJobPayload: f,
    scopedManifestPayload: v,
    jobStatus: y,
    jobTerminal: S,
    jobRefreshRevision: h,
    refreshJobArtifacts: P,
    refreshJobStatus: F,
    publishPayload: p,
    clearPayload: w
========
    setPayloadSessionIdentity: f,
    scopedJobPayload: h,
    scopedManifestPayload: p,
    jobStatus: v,
    jobTerminal: P,
    jobRefreshRevision: m,
    refreshJobArtifacts: w,
    refreshJobStatus: x,
    publishPayload: b,
    clearPayload: S
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  };
}
function Yt(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Ma(e, t) {
  e(t), Yt(t);
}
function Aa(e) {
  const [t, n] = _(e ? "source" : "compare"), r = $((a) => {
    e && a !== "source" || (n(a), Yt(a));
  }, [e]), o = $((a) => {
    Ma(n, a);
  }, []);
  return j(() => (e && document.documentElement.classList.add("reader-source-only"), Yt(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Jn(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Na(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Jn(n.active_job_id),
    activeVersionId: Jn(n.active_version_id)
  };
}
function _a(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function La(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Ca(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Da = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function za(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Da.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
function xa(e) {
  return e ? { data: e.data.slice() } : null;
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
const Oa = 2, be = /* @__PURE__ */ new Map();
========
const Oa = 2, ye = /* @__PURE__ */ new Map();
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
function Xt(e, t) {
  ye.delete(e), ye.set(e, t);
}
function Fa(e) {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  if (be.size < Oa) return;
  const t = be.keys().next().value;
  t && be.delete(t);
========
  if (ye.size < Oa) return;
  const t = ye.keys().next().value;
  t && ye.delete(t);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
}
async function $a(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Cr(e, t = dt().fetchProtected, n = {}) {
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (ye.has(r)) {
    const c = ye.get(r);
    return Xt(r, c), c;
  }
  const o = await t(r, { signal: n.signal });
  if (!o.ok) {
    const c = new Error(`读取 PDF 失败 (${o.status})`);
    c.status = o.status;
    const i = await $a(o);
    throw i && (c.reason = i), c;
  }
  const a = await o.arrayBuffer(), s = { data: new Uint8Array(a) };
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  return be.has(r) ? Xt(r, s) : (Fa(), be.set(r, s)), s;
========
  return ye.has(r) ? Xt(r, s) : (Fa(), ye.set(r, s)), s;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
}
const ja = { file: null, loading: !1, error: "" }, Ba = { file: null, loading: !0, error: "" };
function Ua(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = _(null);
  if (j(() => {
    if (t || !n) return;
    const s = ye.get(n);
    if (s) {
      Xt(n, s);
      return;
    }
    const c = new AbortController();
    return Cr(n, void 0, { signal: c.signal }).then((i) => {
      c.signal.aborted || o({ url: n, file: i, loading: !1, error: "" });
    }).catch((i) => {
      c.signal.aborted || o({ url: n, file: null, loading: !1, error: (i == null ? void 0 : i.message) || String(i) });
    }), () => c.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return ja;
  if ((r == null ? void 0 : r.url) === n) return r;
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  const a = be.get(n);
========
  const a = ye.get(n);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  return a ? { file: a, loading: !1, error: "" } : Ba;
}
function Ha(e) {
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
async function Qt(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  Et(s, r, n, "download");
  const c = await Cr(t, dt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Et(s, o, n, "download"), c);
}
async function Wa(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  Et(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, c = null;
  return t && a.push(
    Qt({
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
    Qt({
      url: n,
      label: "正在下载译文 PDF…",
      percentStart: 55,
      percentEnd: 85,
      fence: r,
      setBoot: o
    }).then((u) => {
      c = u;
    })
  ), await Promise.all(a), r.isInactive() ? { status: "inactive" } : !!t && !s || !!n && !c ? { status: "incomplete" } : { status: "downloaded", sourceBytes: s, translatedBytes: c };
}
function Va(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Ja({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Fo,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Va(o.href, t, a)), !0);
}
const vt = {
  regions: null,
  metadata: null
};
function qa(e) {
  const {
    sessionJobId: t,
    jobId: n,
    routeDocumentId: r,
    documentJobId: o,
    rejectedDocumentJobId: a,
    sourceOnly: s,
    locationKey: c,
    sessionIdentity: i,
    committedSource: l,
    applyIdentityEvent: u,
    publishPayload: d,
    clearPayload: f,
    switchSessionMode: m,
    jobRefreshRevision: g,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    sessionEpochRef: f,
    closingRef: v,
    activeLoadAbortRef: y
  } = e, [S, P] = _(""), [p, w] = _(""), [M, A] = _(null), [F, z] = _(null), [D, R] = _(!1), [I, T] = _(""), [E, x] = _([]), [U, K] = _(!1), [Y, N] = _(() => ({
========
    sessionEpochRef: h,
    closingRef: p,
    activeLoadAbortRef: v
  } = e, [P, w] = _(""), [b, S] = _(""), [E, N] = _(null), [x, z] = _(null), [D, R] = _(!1), [I, T] = _(""), [k, F] = _([]), [H, V] = _(!1), [X, B] = _(() => ({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    source: null,
    translated: null
  })), [L, te] = _(
    vt
  ), [oe, A] = _({
    loading: !0,
    percent: 4,
    text: Ie.boot,
    stage: "progress",
    failed: !1
  });
  return j(() => {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    const ce = new AbortController(), le = f.current.value, H = Ha({
      sessionEpochRef: f,
      closingRef: v,
      abort: ce,
      sessionEpoch: le
    });
    y.current = ce;
    const ee = Dt();
    if (v.current)
      return ce.abort(), () => {
        y.current === ce && (y.current = null);
========
    const Z = new AbortController(), ae = h.current.value, W = Ha({
      sessionEpochRef: h,
      closingRef: p,
      abort: Z,
      sessionEpoch: ae
    });
    v.current = Z;
    const J = Dt();
    if (p.current)
      return Z.abort(), () => {
        v.current === Z && (v.current = null);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      };
    let ge = !1;
    function de(re, fe) {
      W.markFailed(), V(!0), A({
        loading: !1,
        percent: 100,
        text: re,
        stage: "failed",
        failed: !0
      }), Zt({ percent: 100, text: fe, stage: "failed" });
    }
    function Me() {
      R(!0), ge || V(!0), A({
        loading: !1,
        percent: 100,
        text: Ie.ready,
        stage: "ready",
        failed: !1
      }), Zt({ percent: 100, text: Ie.ready, stage: "ready" });
    }
    function Ft() {
      return l != null && l.documentId ? Vn(
        l.documentId,
        l.revision
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      ) : oa() ? aa : ee.resolveResourceUrl(Gt(r));
========
      ) : ra() ? oa : J.resolveResourceUrl(Gt(r));
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    }
    async function We() {
      var ie;
      let re = { activeJobId: "", activeVersionId: "" };
      try {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        const se = await ((ae = ee.fetchDocument) == null ? void 0 : ae.call(ee, r));
        se && (re = Na(se));
      } catch {
      }
      const ue = _a({
========
        const ce = await ((ie = J.fetchDocument) == null ? void 0 : ie.call(J, r));
        ce && (re = Na(ce));
      } catch {
      }
      const fe = _a({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        link: re,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (fe.kind === "follow-active-job") {
        if (W.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: fe.jobId
        }), fe.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: fe.activeVersionId,
          sessionIdentity: i
        }), m("source")) : m("compare");
        return;
      }
      if (fe.kind === "open-committed-source") {
        if (W.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: fe.revision,
          sessionIdentity: i
        }), m("source");
        return;
      }
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      const he = Ft();
      if (H.isInactive()) return;
      P(he), w(""), T(""), m(i);
      const oe = await Qt({
        url: he,
========
      const pe = Ft();
      if (W.isInactive()) return;
      w(pe), S(""), T(""), f(i);
      const se = await Qt({
        url: pe,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: W,
        setBoot: A
      });
      if (!W.isInactive()) {
        if (!se) {
          de("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        N(se), Me();
      }
    }
    async function tt() {
      var G;
      const re = !l, fe = !!(re && J.loadSessionSnapshot && J.loadReaderOptionalArtifacts), pe = fe ? J.loadReaderOptionalArtifacts(t) : null, se = await ((G = J.loadSessionSnapshot) == null ? void 0 : G.call(J, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: re && !fe
      })), ie = se ? {
        jobPayload: se.sourcePayload,
        manifestPayload: se.manifestPayload,
        readerMetadata: se.readerMetadata,
        regionsPayload: se.regions,
        readerErrors: se.readerErrors
      } : await J.loadReaderPayload(t, {
        includeOptionalArtifacts: re
      });
      if (W.isInactive()) return;
      let ce = null;
      if (n && !r)
        if (se && se.linkedDocument !== void 0)
          ce = se.linkedDocument;
        else {
          try {
            ce = await J.fetchDocumentByJobId(Hn, t);
          } catch {
          }
          if (W.isInactive()) return;
        }
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      const We = Ia(ae.jobPayload) || `${(se == null ? void 0 : se.document_id) || ""}`.trim();
      We && !r && u({
========
      const Ve = Ia(ie.jobPayload) || `${(ce == null ? void 0 : ce.document_id) || ""}`.trim();
      Ve && !r && u({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        type: "resolved-job-document",
        jobId: t,
        documentId: Ve
      });
      const Re = La({
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        payloadDocumentId: We,
        linkedActiveJobId: `${(se == null ? void 0 : se.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(se == null ? void 0 : se.active_version_id) || ""}`.trim(),
========
        payloadDocumentId: Ve,
        linkedActiveJobId: `${(ce == null ? void 0 : ce.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ce == null ? void 0 : ce.active_version_id) || ""}`.trim(),
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Re.kind === "restore-committed-source") {
        if (W.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Re.documentId,
          revision: Re.revision,
          sessionIdentity: i
        }), m("source");
        return;
      }
      const Ae = J.resolveReaderSourcePdf(ie.manifestPayload), nt = J.resolveReaderTranslatedPdfUrl(ie.jobPayload, ie.manifestPayload), $t = typeof Ae == "string" ? Ae : J.resolveReaderArtifactUrl(Ae), yt = r || Ve, rt = l != null && l.documentId ? Vn(
        l.documentId,
        l.revision
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      ) : $t || (bt ? ee.resolveResourceUrl(Gt(bt)) : ""), ot = l ? "" : nt || "";
      P(rt || ""), w(ot), T(Ea(ae.jobPayload, t)), d({
        jobPayload: ae.jobPayload || null,
        manifestPayload: ae.manifestPayload || null,
        sessionIdentity: i
      });
      const L = () => Wa({
========
      ) : $t || (yt ? J.resolveResourceUrl(Gt(yt)) : ""), ot = l ? "" : nt || "";
      w(rt || ""), S(ot), T(Ea(ie.jobPayload, t)), d({
        jobPayload: ie.jobPayload || null,
        manifestPayload: ie.manifestPayload || null,
        sessionIdentity: i
      });
      const C = () => Wa({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        sourceFinal: rt || "",
        translatedFinal: ot,
        fence: W,
        setBoot: A
      }), q = !!(rt || ot), U = pe && q ? C() : null;
      U == null || U.catch(() => {
      });
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      const G = (Z) => {
        H.isInactive() || (x(l ? [] : Lo(Z.regionsPayload)), N(l ? { source: null, translated: null } : Co(Z.readerMetadata)), C(l ? yt : Z.readerErrors ?? yt), K(!0));
========
      const K = (Y) => {
        W.isInactive() || (F(l ? [] : _o(Y.regionsPayload)), B(l ? { source: null, translated: null } : Lo(Y.readerMetadata)), te(l ? vt : Y.readerErrors ?? vt), V(!0));
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      };
      if (pe ? (ge = !0, pe.then(K)) : K(ie), !q) {
        de(Ie.failed, Ie.failed);
        return;
      }
      const ne = await (U ?? C());
      if (ne.status !== "inactive") {
        if (ne.status === "incomplete") {
          de("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        N(ne.sourceBytes), z(ne.translatedBytes), Me();
      }
    }
    async function Pe() {
      R(!1), N(null), z(null), F([]), V(!1), B({ source: null, translated: null }), te(vt), Et(A, 8, Ie.metadata, "metadata");
      try {
        if (s) {
          await We();
          return;
        }
        if (!t) {
          de(Ie.failed, Ie.failed);
          return;
        }
        await tt();
      } catch (re) {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        if (H.isClosedOrStale() || (re == null ? void 0 : re.name) === "AbortError") return;
        H.markFailed();
        const ue = Number(re == null ? void 0 : re.status), he = `${(re == null ? void 0 : re.reason) || ""}`, oe = za({ status: ue, reason: he, sessionJobId: t });
        if (oe && (await Ja({
========
        if (W.isClosedOrStale() || (re == null ? void 0 : re.name) === "AbortError") return;
        W.markFailed();
        const fe = Number(re == null ? void 0 : re.status), pe = `${(re == null ? void 0 : re.reason) || ""}`, se = za({ status: fe, reason: pe, sessionJobId: t });
        if (se && (await Ja({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          apiPrefix: Hn,
          documentId: se,
          expiredJobId: t
        }) || W.isClosedOrStale()))
          return;
        if (Ca({
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
          status: ue,
          reason: he,
========
          status: fe,
          reason: pe,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const ie = re instanceof Error ? re.message : Ie.failed;
        de(ie, ie);
      }
    }
    return Pe(), () => {
      Z.abort(), v.current === Z && (v.current = null);
    };
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  }, [t, r, o, a, s, c, l, g, n, i, u, d, m, h]), {
    sourceUrl: S,
    translatedUrl: p,
    sourceFile: M,
    translatedFile: F,
========
  }, [t, r, o, a, s, c, l, g, n, i, u, d, f, m]), {
    sourceUrl: P,
    translatedUrl: b,
    sourceFile: E,
    translatedFile: x,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    assetsReady: D,
    title: I,
    regions: k,
    regionsSettled: H,
    readerMetadata: X,
    readerErrors: L,
    boot: oe
  };
}
function Ga() {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  const e = k(!1), t = k(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Pa(), s = k({ identity: "", value: 0 });
========
  const e = M(!1), t = M(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Pa(), s = M({ identity: "", value: 0 });
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  const c = k(a), i = k(""), l = k(""), u = k(() => {
  }), d = $(() => u.current(), []), m = Ra({
========
  const c = M(a), i = M(""), l = M(""), u = M(() => {
  }), d = $(() => u.current(), []), f = Ra({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: c,
    documentIdRef: i,
    sessionJobIdRef: l,
    switchToSourceMode: d
  }), {
    sessionJobId: m,
    documentId: g,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    sourceOnly: f,
    sourceViewOnly: v
  } = m, { mode: y, setMode: S, switchSessionMode: P } = Aa(v);
  u.current = () => {
    P("source");
  }, c.current = a, i.current = g, l.current = h;
  const p = ka({
    sessionJobId: h,
========
    sourceOnly: h,
    sourceViewOnly: p
  } = f, { mode: v, setMode: P, switchSessionMode: w } = Aa(p);
  u.current = () => {
    w("source");
  }, c.current = a, i.current = g, l.current = m;
  const b = ka({
    sessionJobId: m,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    sessionIdentity: a,
    sessionIdentityRef: c,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    scopedJobPayload: w,
    scopedManifestPayload: M,
    jobStatus: A,
    jobTerminal: F,
    jobRefreshRevision: z,
    refreshJobArtifacts: D,
    refreshJobStatus: R
  } = p, I = qa({
    sessionJobId: h,
========
    scopedJobPayload: S,
    scopedManifestPayload: E,
    jobStatus: N,
    jobTerminal: x,
    jobRefreshRevision: z,
    refreshJobArtifacts: D,
    refreshJobStatus: R
  } = b, I = qa({
    sessionJobId: m,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    jobId: r,
    routeDocumentId: o,
    documentJobId: f.documentJobId,
    rejectedDocumentJobId: f.rejectedDocumentJobId,
    sourceOnly: h,
    locationKey: n,
    sessionIdentity: a,
    committedSource: f.activeCommittedDocumentSource,
    applyIdentityEvent: f.applyIdentityEvent,
    publishPayload: b.publishPayload,
    clearPayload: b.clearPayload,
    switchSessionMode: w,
    jobRefreshRevision: z,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), T = $(() => {
    var F;
    e.current = !0, (F = t.current) == null || F.abort();
  }, []), k = Q(
    () => ({
      fetchProtected: Dt().fetchProtected,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      jobId: h,
      jobPayload: w,
      manifestPayload: M,
      sourceUrl: I.sourceUrl,
      translatedUrl: I.translatedUrl,
      sourceOnly: v
    }),
    [h, w, M, I.sourceUrl, I.translatedUrl, v]
  );
  return {
    jobId: h,
    jobStatus: A,
    workflow: `${(w == null ? void 0 : w.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: F,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: f,
    mode: y,
    setMode: S,
========
      jobId: m,
      jobPayload: S,
      manifestPayload: E,
      sourceUrl: I.sourceUrl,
      translatedUrl: I.translatedUrl,
      sourceOnly: p
    }),
    [m, S, E, I.sourceUrl, I.translatedUrl, p]
  );
  return {
    jobId: m,
    jobStatus: N,
    workflow: `${(S == null ? void 0 : S.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: x,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: v,
    setMode: P,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
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
    download: k,
    refreshJobArtifacts: D,
    refreshJobStatus: R,
    refreshCommittedDocument: f.refreshCommittedDocument,
    prepareClose: T
  };
}
const Ka = 160, Za = 8, Ya = 0;
function Xa() {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  const e = k(null), [t, n] = _(null), [r, o] = _(Ya), a = $((s) => {
========
  const e = M(null), [t, n] = _(null), [r, o] = _(Ya), a = $((s) => {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    e.current = s, n(s);
  }, []);
  return j(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const c = (l) => {
      !Number.isFinite(l) || l < Ka || o((u) => Math.abs(u - l) < Za ? u : l);
    }, i = new ResizeObserver((l) => {
      var u, d;
      c(((d = (u = l[0]) == null ? void 0 : u.contentRect) == null ? void 0 : d.width) ?? s.clientWidth);
    });
    return i.observe(s), c(s.clientWidth), () => i.disconnect();
  }, [t]), {
    shellRef: e,
    shellEl: t,
    shellWidth: r,
    bindShell: a
  };
}
function Qa(e) {
  const { mode: t, sourceOnly: n, assetsReady: r, hasSource: o, hasTranslated: a } = e, s = r && o, c = r && a && !n, i = t === "source" || t === "compare", l = !n && (t === "translated" || t === "compare");
  return {
    mountSource: s,
    mountTranslated: c,
    showSource: i,
    showTranslated: l,
    compareMode: t === "compare" && i && l && s && c,
    primaryPane: t === "translated" ? "translated" : "source"
  };
}
const Bt = { source: 0, translated: 0 };
function es(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: c,
    translatedFile: i
  } = e, l = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, u = M(l);
  u.current = l;
  const [d, f] = _(() => ({
    identity: l,
    pages: Bt
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  })), [h, g] = _(() => ({ identity: l, tick: 0 })), f = d.identity === l ? d.pages : Bt, v = h.identity === l ? h.tick : 0, y = Qa({
========
  })), [m, g] = _(() => ({ identity: l, tick: 0 })), h = d.identity === l ? d.pages : Bt, p = m.identity === l ? m.tick : 0, v = Qa({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!c || !!a,
    hasTranslated: !!i
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  }), { primaryPane: S } = y, P = $((R, I) => {
    u.current === l && m((T) => {
      const E = T.identity === l ? T.pages : Bt;
      return E[I] === R && T.identity === l ? T : {
========
  }), { primaryPane: P } = v, w = $((R, I) => {
    u.current === l && f((T) => {
      const k = T.identity === l ? T.pages : Bt;
      return k[I] === R && T.identity === l ? T : {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        identity: l,
        pages: { ...k, [I]: R }
      };
    });
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  }, [l]), p = k(null), w = $(() => {
    p.current && clearTimeout(p.current);
========
  }, [l]), b = M(null), S = $(() => {
    b.current && clearTimeout(b.current);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    const R = l;
    b.current = setTimeout(() => {
      b.current = null, u.current === R && g((I) => ({
        identity: R,
        tick: I.identity === R ? I.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  j(() => (b.current && (clearTimeout(b.current), b.current = null), f((R) => R.identity === l && R.pages.source === 0 && R.pages.translated === 0 ? R : { identity: l, pages: { source: 0, translated: 0 } }), g((R) => R.identity === l && R.tick === 0 ? R : { identity: l, tick: 0 }), () => {
    b.current && (clearTimeout(b.current), b.current = null);
  }), [l]);
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  const M = X(
    () => Math.max(f.source, f.translated),
    [f]
  ), A = S === "translated" ? f.translated : f.source || f.translated, F = t == null ? void 0 : t.userZoom, z = t == null ? void 0 : t.shellWidth, D = `${l}-${v}-${F}-${n}-${f.source}-${f.translated}-${z}`;
  return {
    ...y,
    numPagesByPane: f,
    hudNumPages: M,
    primaryNumPages: A,
    metricsTick: v,
    onNumPages: P,
    onMetrics: w,
    rowSyncRevision: D
  };
}
const xe = "data-reader-page", Ye = "data-reader-pane", bn = "data-natural-height", ts = "reader-react-root", ns = "reader-react-grid", rs = "reader-react-scroll-shell", os = "reader-react-pdf-pane", Dr = "reader-react-pdf-page", Et = "reader-react-pdf-page-placeholder", yn = "reader-react-pdf-page-slot";
function kt(e, t) {
  const n = e != null ? `[${xe}="${e}"]` : `[${xe}]`;
  return t ? `${n}[${Ye}="${t}"]` : n;
}
function as() {
  return `.${yn}[${xe}]`;
========
  const E = Q(
    () => Math.max(h.source, h.translated),
    [h]
  ), N = P === "translated" ? h.translated : h.source || h.translated, x = t == null ? void 0 : t.userZoom, z = t == null ? void 0 : t.shellWidth, D = `${l}-${p}-${x}-${n}-${h.source}-${h.translated}-${z}`;
  return {
    ...v,
    numPagesByPane: h,
    hudNumPages: E,
    primaryNumPages: N,
    metricsTick: p,
    onNumPages: w,
    onMetrics: S,
    rowSyncRevision: D
  };
}
const Fe = "data-reader-page", Xe = "data-reader-pane", bn = "data-natural-height", ts = "reader-react-root", ns = "reader-react-grid", rs = "reader-react-scroll-shell", os = "reader-react-pdf-pane", Dr = "reader-react-pdf-page", kt = "reader-react-pdf-page-placeholder", yn = "reader-react-pdf-page-slot";
function Mt(e, t) {
  const n = e != null ? `[${Fe}="${e}"]` : `[${Fe}]`;
  return t ? `${n}[${Xe}="${t}"]` : n;
}
function as() {
  return `.${yn}[${Fe}]`;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
}
function vn(e) {
  return Number(e.getAttribute(Fe));
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
const zr = 0.25, Mt = 1, ss = 0.05, gt = 0.5, is = 16, cs = 8, ls = 720;
function ze() {
========
const zr = 0.25, At = 1, ss = 0.05, bt = 0.5, is = 16, cs = 8, ls = 720;
function Oe() {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function xr(e) {
  return Number.isFinite(e) && e < ls;
}
function Ge(e, t = Number.POSITIVE_INFINITY) {
  return xr(t) && (e === "source" || e === "translated") ? At : bt;
}
function zt(e) {
  return Number.isFinite(e) ? Math.min(At, Math.max(zr, e)) : bt;
}
function ft(e, t) {
  const n = zt(Number(e) + t * ss);
  return Math.round(n * 100) / 100;
}
function us(e) {
  return Math.round(zt(e) * 100);
}
function ds(e) {
  const n = (Number(e) || 0) - is - cs;
  return Math.max(160, Math.floor(n));
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
function fs(e, t = gt) {
========
function fs(e, t = bt) {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  const n = zt(t);
  return ds((Number(e) || 0) * n);
}
function ms(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${Xe}]`)
  ).map((s) => ({
    pane: s,
    cx: s.scrollLeft + s.clientWidth / 2,
    hadOverflow: s.scrollWidth > s.clientWidth + 1
  })), a = () => {
    e.scrollLeft = Math.max(0, n * t - e.clientWidth / 2), e.scrollTop = Math.max(0, r * t - e.clientHeight / 2);
    for (const { pane: s, cx: c, hadOverflow: i } of o) {
      const l = Math.max(0, s.scrollWidth - s.clientWidth);
      if (l <= 0) {
        s.scrollLeft = 0;
        continue;
      }
      i ? s.scrollLeft = Math.min(
        l,
        Math.max(0, c * t - s.clientWidth / 2)
      ) : s.scrollLeft = l / 2;
    }
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(a);
  });
}
const hs = 8;
function ps(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < hs ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
const Or = 200, Fr = [
  "markdown"
], gs = Fr;
function $r(e) {
  return gs.includes(e);
========
const gs = 200, Or = [
  "markdown"
], bs = Or;
function Fr(e) {
  return bs.includes(e);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
}
const ys = "retainpdf:reader:view:v1:", qn = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), vs = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function jr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function en(e) {
  return `${e || ""}`.trim();
}
function Ss({
  documentId: e,
  jobId: t
}) {
  const n = en(e);
  if (n) return `document:${n}`;
  const r = en(t);
  return r ? `job:${r}` : "";
}
function Br(e) {
  const t = en(e);
  return t ? `${ys}${t}` : "";
}
function ws(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function Ps(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!qn.has(t) || !qn.has(n) || t === n))
    return { left: t, right: n };
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
function Ps(e) {
  return e === null ? null : $r(e) ? e : void 0;
========
function Rs(e) {
  return e === null ? null : Fr(e) ? e : void 0;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
}
function Is(e) {
  return vs.has(e) ? e : void 0;
}
function Ur(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = ws(t.anchor), r = Number(t.zoom), o = Is(t.mode), a = Ps(t.splitLayout), s = Rs(t.assistantPanel);
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
function we(e, t = jr()) {
  const n = Br(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Ur(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function xt(e, t, n = jr()) {
  const r = Br(e);
  if (!r || !n) return null;
  const o = we(e, n), a = Ur({
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
function Ts(e, t, n = "") {
  var f;
  const [r, o] = _(() => {
    var m;
    return ((m = we(n)) == null ? void 0 : m.zoom) ?? Ge(e, Oe());
  }), a = M(r), s = M(n);
  a.current = r;
  const c = M(1), i = M(((f = we(n)) == null ? void 0 : f.zoom) !== void 0);
  j(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = we(n)) == null ? void 0 : h.zoom;
    i.current = m !== void 0;
    const g = m ?? Ge(e, Oe());
    c.current = 1, a.current = g, o(g);
  }, [e, n]), j(() => {
    if (i.current) return;
    const m = Ge(e, Oe()), g = a.current;
    Math.abs(m - g) < 5e-4 || (c.current = 1, a.current = m, o(m));
  }, [e]);
  const l = $((m) => {
    const g = zt(m), h = a.current;
    Math.abs(g - h) < 5e-4 || (c.current = g / (h || 1), i.current = !0, xt(s.current, { zoom: g }), o(g));
  }, []), u = $((m) => {
    l(ft(a.current, m));
  }, [l]), d = $((m) => {
    l(Ge(m));
  }, [l]);
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  return _e(() => {
    const h = c.current;
    Math.abs(h - 1) < 1e-3 || (c.current = 1, ms(t == null ? void 0 : t.current, h));
========
  return Ce(() => {
    const m = c.current;
    Math.abs(m - 1) < 1e-3 || (c.current = 1, ms(t == null ? void 0 : t.current, m));
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: d };
}
function Es(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = M(t), a = M(n), s = M(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: $((i) => {
    i !== o.current && (s.current(), a.current(i));
  }, []) };
}
const Sn = 48;
function Hr(e, t = Sn) {
  return e.getBoundingClientRect().top + t;
}
function Wr(e, t) {
  if (!e.length)
    return null;
  let n = null, r = -1 / 0;
  for (const i of e) {
    const l = i.getBoundingClientRect();
    l.height < 8 || l.width < 8 || l.top <= t + 1 && l.top >= r && (n = i, r = l.top);
  }
  if (!n && (n = e.find((l) => {
    const u = l.getBoundingClientRect();
    return u.height >= 8 && u.width >= 8;
  }) ?? null, n)) {
    const l = [...e].reverse().find((u) => {
      const d = u.getBoundingClientRect();
      return d.height >= 8 && d.width >= 8;
    });
    l && l.getBoundingClientRect().bottom < t && (n = l);
  }
  if (!n)
    return null;
  const o = vn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, c = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: c };
}
function Rt(e, t, n = Sn) {
  if (!e)
    return null;
  const r = Mt(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Hr(e, n), c = Wr(o, s);
  return c ? { page: c.page, fraction: c.fraction } : null;
}
function Ot(e, t, n = "auto", r, o = Sn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let c = null;
  if (r && (c = e.querySelector(Mt(a, r))), c || (c = e.querySelector(Mt(a))), !c)
    return !1;
  const i = e.getBoundingClientRect(), l = c.getBoundingClientRect();
  if (i.height <= 0 || l.height < 8 && c.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : c.offsetHeight, d = e.scrollTop + (l.top - i.top), f = Math.max(0, d + s * u - o);
  return n === "auto" ? e.scrollTop = f : e.scrollTo({ top: f, behavior: n }), !0;
}
function ks(e, t, n = "smooth", r) {
  return Ot(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function tn(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const c = [], i = () => {
    var u;
    if (a) return;
    Ot(
      e(),
      t,
      r,
      n == null ? void 0 : n.pane
    ) && !s && (s = !0, (u = n == null ? void 0 : n.onDone) == null || u.call(n));
  };
  for (const l of o)
    l <= 0 ? requestAnimationFrame(() => {
      requestAnimationFrame(i);
    }) : c.push(setTimeout(i, l));
  return () => {
    a = !0;
    for (const l of c)
      clearTimeout(l);
  };
}
function Ms(e, t, n) {
  return tn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Nt(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function be(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function As(e, t, n = !0, r = "", o) {
  const [a, s] = _(1);
  return j(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const c = e.current;
    if (!c)
      return;
    let i = !1, l = null, u = 0;
    const d = Mt(void 0, o), f = () => {
      if (i) return;
      const h = Array.from(c.querySelectorAll(d));
      if (!h.length)
        return;
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      const v = Hr(c), y = Wr(f, v);
      y && s(y.page);
    }, h = () => {
========
      const p = Ur(c), v = Hr(h, p);
      v && s(v.page);
    }, m = () => {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      i || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, f();
      }));
    }, g = () => {
      if (i) return;
      if (!Array.from(c.querySelectorAll(d)).length) {
        l = setTimeout(g, 120);
        return;
      }
      f(), c.addEventListener("scroll", m, { passive: !0 });
    };
    return g(), () => {
      i = !0, l && clearTimeout(l), u && cancelAnimationFrame(u), c.removeEventListener("scroll", m);
    };
  }, [e, t, n, r, o]), a;
}
const Ns = `canvas, .react-pdf__Page, .${Dr}, .${kt}`, Gn = /* @__PURE__ */ new WeakMap();
function _s(e) {
  const t = Number(e.getAttribute(bn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Gn.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Ns), Gn.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Ls(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Cs(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(as()).forEach((r) => {
    const o = vn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = _s(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Ds(e, t, n = "", r) {
  const [o, a] = _(() => /* @__PURE__ */ new Map()), s = M(o), c = M(r);
  return c.current = r, Ce(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let i = !1, l = 0, u = !1, d = !1;
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    const m = () => {
      var w;
      if (i) return;
      const P = e.current;
      if (!P) return;
      const p = Ls(P);
      _s(s.current, p) || (s.current = p, a(p)), u && !d && (d = !0, (w = c.current) == null || w.call(c));
    }, h = () => {
========
    const f = () => {
      var S;
      if (i) return;
      const w = e.current;
      if (!w) return;
      const b = Cs(w);
      Ls(s.current, b) || (s.current = b, a(b)), u && !d && (d = !0, (S = c.current) == null || S.call(c));
    }, m = () => {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(f);
      });
    };
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    h();
    const g = window.setTimeout(h, 100), f = window.setTimeout(() => {
      u = !0, h();
    }, 300), v = window.setTimeout(h, 700), y = e.current;
    let S = null;
    return y && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => h()), S.observe(y)), () => {
      i = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(f), window.clearTimeout(v), S == null || S.disconnect();
========
    m();
    const g = window.setTimeout(m, 100), h = window.setTimeout(() => {
      u = !0, m();
    }, 300), p = window.setTimeout(m, 700), v = e.current;
    let P = null;
    return v && typeof ResizeObserver < "u" && (P = new ResizeObserver(() => m()), P.observe(v)), () => {
      i = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(p), P == null || P.disconnect();
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    };
  }, [e, t, n]), o;
}
const zs = [0, 48, 140, 320, 560], xs = 700, Os = [80, 200, 400], Fs = 500, $s = 50, js = /* @__PURE__ */ new Set([
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
]), Bs = 180, Kn = [0, 48, 140, 320, 700, 1200];
function Us(e, t) {
  var I;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, c = M(
    ((I = we(a)) == null ? void 0 : I.anchor) || { page: 1, fraction: 0 }
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  ), i = k(null), l = k(!1), u = k(r), d = k(null), m = k(null), h = k(null), g = k(null), f = k(a), v = k(""), y = k(n);
  y.current = n;
  const S = $(() => {
    var T;
    (T = d.current) == null || T.call(d), d.current = null, m.current != null && (clearTimeout(m.current), m.current = null);
  }, []), P = $(() => {
    !l.current && i.current == null || (S(), h.current != null && (clearTimeout(h.current), h.current = null), i.current = null, l.current = !1);
  }, [S]), p = $((T = !1) => {
========
  ), i = M(null), l = M(!1), u = M(r), d = M(null), f = M(null), m = M(null), g = M(null), h = M(a), p = M(""), v = M(n);
  v.current = n;
  const P = $(() => {
    var T;
    (T = d.current) == null || T.call(d), d.current = null, f.current != null && (clearTimeout(f.current), f.current = null);
  }, []), w = $(() => {
    !l.current && i.current == null || (P(), m.current != null && (clearTimeout(m.current), m.current = null), i.current = null, l.current = !1);
  }, [P]), b = $((T = !1) => {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    g.current != null && (clearTimeout(g.current), g.current = null);
    const k = () => {
      g.current = null, xt(h.current, {
        anchor: be(c.current)
      });
    };
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    T ? E() : g.current = setTimeout(E, js);
  }, []), w = $((T) => {
    c.current = ge(T), i.current = null, h.current != null && clearTimeout(h.current), h.current = setTimeout(() => {
      h.current = null, l.current = !1;
    }, Fs);
========
    T ? k() : g.current = setTimeout(k, Bs);
  }, []), S = $((T) => {
    c.current = be(T), i.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, $s);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  }, []);
  j(() => {
    if (!o)
      return;
    let T = !1, k = null, F = null, H = null;
    const V = () => {
      if (T) return;
      const X = e.current;
      if (!X) {
        H = setTimeout(V, 50);
        return;
      }
      k = X, F = () => {
        if (l.current)
          return;
        const B = Rt(k, v.current);
        B && (c.current = B, b());
      }, k.addEventListener("scroll", F, { passive: !0 }), l.current || F();
    };
    return V(), () => {
      T = !0, H != null && clearTimeout(H), k && F && k.removeEventListener("scroll", F);
    };
  }, [o, r, n, e, b]), j(() => {
    if (!o) return;
    const T = e.current;
    if (!T) return;
    const k = (F) => {
      F.metaKey || F.ctrlKey || F.altKey || js.has(F.key) && w();
    };
    return T.addEventListener("wheel", w, { passive: !0 }), T.addEventListener("touchmove", w, { passive: !0 }), window.addEventListener("keydown", k), () => {
      T.removeEventListener("wheel", w), T.removeEventListener("touchmove", w), window.removeEventListener("keydown", k);
    };
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  }, [o, e, P]), _e(() => {
    var E;
    if (f.current === a) return;
    p(!0), S(), h.current != null && (clearTimeout(h.current), h.current = null), f.current = a, v.current = "";
    const T = (E = we(a)) == null ? void 0 : E.anchor;
    c.current = T ? ge(T) : { page: 1, fraction: 0 }, i.current = null, l.current = !!a, u.current = r;
  }, [a, r, p, S]), j(() => {
    var E;
    if (!o || !s || !a || v.current === a) return;
    v.current = a;
    const T = ge(
      ((E = we(a)) == null ? void 0 : E.anchor) || { page: 1, fraction: 0 }
    );
    return c.current = T, i.current = T, l.current = !0, S(), d.current = tn(
========
  }, [o, e, w]), Ce(() => {
    var k;
    if (h.current === a) return;
    b(!0), P(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, p.current = "";
    const T = (k = we(a)) == null ? void 0 : k.anchor;
    c.current = T ? be(T) : { page: 1, fraction: 0 }, i.current = null, l.current = !!a, u.current = r;
  }, [a, r, b, P]), j(() => {
    var k;
    if (!o || !s || !a || p.current === a) return;
    p.current = a;
    const T = be(
      ((k = we(a)) == null ? void 0 : k.anchor) || { page: 1, fraction: 0 }
    );
    return c.current = T, i.current = T, l.current = !0, P(), d.current = tn(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: v.current,
        delaysMs: Kn,
        onDone: () => w(T)
      }
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    ), m.current = setTimeout(() => {
      m.current = null, w(T);
    }, Math.max(...Kn) + 160), () => S();
  }, [o, s, a, e, w, S]), j(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, i.current = null, S();
      return;
    }
    const T = i.current ? ge(i.current) : ge(c.current);
    return l.current = !0, i.current = T, c.current = T, S(), d.current = tn(
========
    ), f.current = setTimeout(() => {
      f.current = null, S(T);
    }, Math.max(...Kn) + 160), () => P();
  }, [o, s, a, e, S, P]), j(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, i.current = null, P();
      return;
    }
    const T = i.current ? be(i.current) : be(c.current);
    return l.current = !0, i.current = T, c.current = T, P(), d.current = tn(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        delaysMs: Ds,
        onDone: () => w(T)
      }
    ), m.current = setTimeout(() => {
      m.current = null, w(T);
    }, zs), () => {
      S();
    };
  }, [r, o, n, e, w, S]), j(() => () => {
    S(), h.current != null && (clearTimeout(h.current), h.current = null), p(!0);
  }, [S, p]);
  const M = $(() => {
    const T = Pt(
========
        delaysMs: zs,
        onDone: () => S(T)
      }
    ), f.current = setTimeout(() => {
      f.current = null, S(T);
    }, xs), () => {
      P();
    };
  }, [r, o, n, e, S, P]), j(() => () => {
    P(), m.current != null && (clearTimeout(m.current), m.current = null), b(!0);
  }, [P, b]);
  const E = $(() => {
    const T = Rt(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      e.current,
      v.current
    );
    return be(T || c.current);
  }, [e]), N = $(() => {
    l.current = !0;
    const T = Rt(
      e.current,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      y.current
    ), E = ge(T ?? c.current);
    return c.current = E, i.current = E, p(), E;
  }, [e, p]), F = $((T, E, x) => {
    const U = x || y.current, K = At(T, E || 1), Y = { page: K, fraction: 0 };
    c.current = Y, l.current = !0, i.current = Y, p(), S(), Es(e.current, K, "smooth", U), d.current = ks(
========
      v.current
    ), k = be(T ?? c.current);
    return c.current = k, i.current = k, b(), k;
  }, [e, b]), x = $((T, k, F) => {
    const H = F || v.current, V = Nt(T, k || 1), X = { page: V, fraction: 0 };
    c.current = X, l.current = !0, i.current = X, b(), P(), ks(e.current, V, "smooth", H), d.current = Ms(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      () => e.current,
      V,
      {
        behavior: "auto",
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        pane: U,
        delaysMs: xs,
        onDone: () => w(Y)
      }
    ), m.current = setTimeout(() => {
      m.current = null, w(Y);
    }, Os);
  }, [e, w, S, p]), z = $(() => ge(c.current), []), D = $(() => l.current, []), R = $(() => {
========
        pane: H,
        delaysMs: Os,
        onDone: () => S(X)
      }
    ), f.current = setTimeout(() => {
      f.current = null, S(X);
    }, Fs);
  }, [e, S, P, b]), z = $(() => be(c.current), []), D = $(() => l.current, []), R = $(() => {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    if (!l.current || !i.current)
      return;
    const T = be(i.current);
    Ot(
      e.current,
      T,
      "auto",
      v.current
    );
  }, [e]);
  return {
    lockFromShell: E,
    beginModeSwitch: N,
    goToPage: x,
    getAnchor: z,
    isRestoring: D,
    repinIfRestoring: R
  };
}
function Hs(e, t) {
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
function Vr(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Ws = [0, 80, 200, 400, 800], Vs = 120, Js = 400;
function qs(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: c, jobId: i, documentId: l, regionsSettled: u = !0 } = e, d = M(a);
  d.current = a;
  const f = M(s);
  f.current = s;
  const m = M(c);
  m.current = c;
  const g = M(n);
  g.current = n, j(() => {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    var p, w;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const f = ha(), v = Us(f, m.current);
    if (v == null && (f != null && f.blockId) && !u) return;
    const y = Vr(f, v, { jobId: i, documentId: l });
    if (t.current === y)
      return;
    if (v == null) {
      t.current = y, (p = g.current) == null || p.call(g);
      return;
    }
    t.current = y, f && ((w = h.current) == null || w.call(h, f, v));
    const S = [];
    let P = 0;
    for (const M of Hs)
      P = Math.max(P, M), S.push(
        setTimeout(() => {
          d.current(v);
        }, M)
      );
    return S.push(
========
    var b, S;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = ha(), p = Hs(h, f.current);
    if (p == null && (h != null && h.blockId) && !u) return;
    const v = Wr(h, p, { jobId: i, documentId: l });
    if (t.current === v)
      return;
    if (p == null) {
      t.current = v, (b = g.current) == null || b.call(g);
      return;
    }
    t.current = v, h && ((S = m.current) == null || S.call(m, h, p));
    const P = [];
    let w = 0;
    for (const E of Ws)
      w = Math.max(w, E), P.push(
        setTimeout(() => {
          d.current(p);
        }, E)
      );
    return P.push(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      setTimeout(() => {
        var E;
        (E = g.current) == null || E.call(g);
      }, w + Vs)
    ), () => {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      for (const M of S) clearTimeout(M);
========
      for (const E of P) clearTimeout(E);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    };
  }, [r, o, i, l, t, u]);
}
function Gs(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Ks(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Js,
    jobId: c,
    documentId: i,
    applyReaderSearch: l
  } = e, u = M(a);
  u.current = a;
  const d = M(l);
  d.current = l;
  const f = M(0);
  j(() => {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || m.current === o) return;
    const h = setTimeout(() => {
      var y;
      const g = ((y = globalThis.location) == null ? void 0 : y.search) || "", f = _o(g, o, u.current);
      if (m.current = o, f === null) return;
      const v = `${new URLSearchParams(f).get("block_id") || ""}`.trim();
      t.current = Vr(
        { blockId: v },
========
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || f.current === o) return;
    const m = setTimeout(() => {
      var v;
      const g = ((v = globalThis.location) == null ? void 0 : v.search) || "", h = No(g, o, u.current);
      if (f.current = o, h === null) return;
      const p = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Wr(
        { blockId: p },
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        o,
        { jobId: c, documentId: i }
      ), (d.current || Gs)(h);
    }, s);
    return () => clearTimeout(m);
  }, [
    n,
    r,
    o,
    s,
    c,
    i,
    t
  ]);
}
function Zs(e) {
  const t = M(""), [n, r] = _(!1), o = $(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  qs(a, t, o), Ks(e, t, n);
}
const st = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Ys(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Zn(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function Jr(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Zn(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Zn(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Xs(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = Jr(r, t, n);
  if (o === "retry") return e;
  if (o === "ignore")
    return { ...e, lastSeq: t.seq, connection: "live", error: "" };
  const a = new Map(n.items.map((i) => [i.item_id, i])), s = new Map((r == null ? void 0 : r.changedAtSeqById) || []);
  for (const i of t.changed_item_ids)
    a.has(i) && s.set(i, t.seq);
  const c = new Map(e.pagesByPage);
  return c.set(t.page_idx, {
    attempt: n.attempt,
    generation: n.generation,
    pageHash: n.page_hash,
    itemsById: a,
    changedAtSeqById: s,
    lastEventSeq: t.seq
  }), {
    ...e,
    pagesByPage: c,
    lastSeq: t.seq,
    connection: "live",
    error: ""
  };
}
function Qs(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    sourcePaneToggle: t && r,
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
const Yn = [250, 500, 1e3, 2e3, 4e3], Ut = [80, 160, 320, 640, 1e3, 1500], Xn = [250, 500, 1e3, 2e3, 4e3, 5e3];
function nn(e, t) {
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
function wn(e) {
  return $o(e) ? `${e.code || ""}`.trim() : "";
}
function St(e, t) {
  const n = wn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function ei(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const i = await o.fetchPage(e, t.page_idx, { signal: r });
      if (Jr(n.pagesByPage.get(t.page_idx), t, i) !== "retry")
        return i;
      a = jo(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (i) {
      if ((i == null ? void 0 : i.name) === "AbortError") throw i;
      a = i;
      const l = wn(i);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw i;
    }
    const c = Ut[Math.min(s, Ut.length - 1)];
    if (await nn(c, r), s >= Ut.length + 2) throw a;
  }
}
function ti({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = _(st), s = M(o), c = M("");
  s.current = o;
  const i = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = hn(l) ? l : "";
  return j(() => {
    if (!n || !i) {
      c.current = "", s.current = st, a(st);
      return;
    }
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    const d = r === void 0 ? ca() : r, m = c.current === i;
========
    const d = r === void 0 ? ia() : r, f = c.current === i;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    if (c.current = i, !d) {
      const w = {
        ...f ? s.current : st,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = w, a(w);
      return;
    }
    const m = new AbortController();
    let g = !1;
    const h = {
      ...f ? s.current : st,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    s.current = f, a(f);
    const v = (P) => {
      h.signal.aborted || a((p) => {
        const w = P(p);
        return s.current = w, w;
========
    s.current = h, a(h);
    const p = (w) => {
      m.signal.aborted || a((b) => {
        const S = w(b);
        return s.current = S, S;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      });
    }, v = async () => {
      let w = 0;
      for (; !m.signal.aborted; )
        try {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
          const p = await d.fetchLayout(i, { signal: h.signal });
          g = !0, v((w) => ({
            ...w,
            layoutByPage: Zs(p),
========
          const b = await d.fetchLayout(i, { signal: m.signal });
          g = !0, p((S) => ({
            ...S,
            layoutByPage: Ys(b),
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
            jobStatus: l,
            error: ""
          }));
          return;
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        } catch (p) {
          if ((p == null ? void 0 : p.name) === "AbortError") return;
          const w = wn(p);
          if (!(w === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !w)) {
            v((A) => ({
              ...A,
========
        } catch (b) {
          if ((b == null ? void 0 : b.name) === "AbortError") return;
          const S = wn(b);
          if (!(S === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !S)) {
            p((N) => ({
              ...N,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: St(b, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
            v((A) => ({
              ...A,
========
            p((N) => ({
              ...N,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
          v((A) => ({
            ...A,
========
          p((N) => ({
            ...N,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
            connection: "connecting",
            jobStatus: l,
            error: St(b, "正在等待 OCR 版面数据")
          })), await nn(Yn[Math.min(w, Yn.length - 1)], m.signal).catch(() => {
          }), w += 1;
        }
    };
    return (async () => {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      if (await y(), !g || h.signal.aborted) return;
      let P = 0;
      for (; !h.signal.aborted; ) {
        u || v((p) => ({
          ...p,
          connection: p.lastSeq > 0 ? "reconnecting" : "connecting",
========
      if (await v(), !g || m.signal.aborted) return;
      let w = 0;
      for (; !m.signal.aborted; ) {
        u || p((b) => ({
          ...b,
          connection: b.lastSeq > 0 ? "reconnecting" : "connecting",
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          jobStatus: l,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: b.error
        }));
        try {
          await d.streamEvents(i, {
            afterSeq: s.current.lastSeq,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
            signal: h.signal,
            onEvent: async (p) => {
              if (p.seq <= s.current.lastSeq) return;
              let w;
              try {
                w = await Qs(
========
            signal: m.signal,
            onEvent: async (b) => {
              if (b.seq <= s.current.lastSeq) return;
              let S;
              try {
                S = await ei(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
                  i,
                  b,
                  s.current,
                  m.signal,
                  d
                );
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
              } catch (M) {
                if ((M == null ? void 0 : M.name) === "AbortError" || h.signal.aborted) throw M;
                v((A) => ({
                  ...A,
                  lastSeq: Math.max(A.lastSeq, p.seq),
                  error: vt(M, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              v((M) => {
                const A = Ys(M, p, w);
========
              } catch (E) {
                if ((E == null ? void 0 : E.name) === "AbortError" || m.signal.aborted) throw E;
                p((N) => ({
                  ...N,
                  lastSeq: Math.max(N.lastSeq, b.seq),
                  error: St(E, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              p((E) => {
                const N = Xs(E, b, S);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
                return u ? {
                  ...N,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...N,
                  jobStatus: l
                };
              }), w = 0;
            }
          });
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        } catch (p) {
          if ((p == null ? void 0 : p.name) === "AbortError" || h.signal.aborted) return;
          v((w) => ({
            ...w,
========
        } catch (b) {
          if ((b == null ? void 0 : b.name) === "AbortError" || m.signal.aborted) return;
          p((S) => ({
            ...S,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: St(b, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (u) {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
          v((p) => ({
            ...p,
========
          p((b) => ({
            ...b,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await nn(Xn[Math.min(w, Xn.length - 1)], m.signal).catch(() => {
        }), w += 1;
      }
    })(), () => m.abort();
  }, [n, r, i, u]), o;
}
function ni(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, c = `${s.value ?? ""}`.trim(), i = Number(s.count) || 0;
    c && i > 0 && o.set(c, i);
  }
  return o;
}
function ri(e, t = !0) {
  const [n, r] = _(() => /* @__PURE__ */ new Map());
  return j(() => {
    r((c) => c.size ? /* @__PURE__ */ new Map() : c);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Dt().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((c) => {
      !s && c && r(ni(c));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const oi = /* @__PURE__ */ new Set(), ai = () => () => {
}, si = () => oi;
function ii() {
  const e = ma(), t = (e == null ? void 0 : e.get) ?? si;
  return gt((e == null ? void 0 : e.subscribe) ?? ai, t, t);
}
const ci = 2e3;
function li(e) {
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
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
const ai = /* @__PURE__ */ new Set(["book", "translate"]);
function qr(e) {
  return !!(e.jobId && e.sourceUrl && ai.has(e.workflow));
}
function si(e) {
  return !!(qr(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function ii() {
  const e = Ga(), t = qr({
========
const ui = /* @__PURE__ */ new Set(["book", "translate"]);
function Jr(e) {
  return !!(e.jobId && e.sourceUrl && ui.has(e.workflow));
}
function di(e) {
  return !!(Jr(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function fi() {
  const e = Ga(), t = Jr({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = di({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = M({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !hn(o) && (r.current.running = !0);
  const a = ti({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  }), { shellRef: s, shellEl: c, shellWidth: i, bindShell: l } = Xa(), u = ni(e.jobId, !e.sourceOnly), d = vs({
    documentId: e.documentId,
    jobId: e.jobId
  }), m = `${d}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: h, onZoomChange: g } = Is(e.mode, s, d), f = es(
========
  }), { shellRef: s, shellEl: c, shellWidth: i, bindShell: l } = Xa(), u = ri(e.jobId, !e.sourceOnly), d = ii(), f = Ss({
    documentId: e.documentId,
    jobId: e.jobId
  }), m = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: g, onZoomChange: h } = Ts(e.mode, s, f), p = es(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: g, shellWidth: i, identityKey: m }
  ), {
    beginModeSwitch: v,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    goToPage: y,
    repinIfRestoring: S
  } = Bs(s, {
    primaryPane: f.primaryPane,
========
    goToPage: P,
    repinIfRestoring: w
  } = Us(s, {
    primaryPane: p.primaryPane,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: p.primaryNumPages > 0
  });
  j(() => {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    S();
  }, [i, S]);
  const P = Cs(
    s,
    f.compareMode,
    f.rowSyncRevision,
    S
  ), p = Ms(
========
    w();
  }, [i, w]);
  const b = Ds(
    s,
    p.compareMode,
    p.rowSyncRevision,
    w
  ), S = As(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    s,
    p.primaryNumPages,
    !e.boot.loading,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    `${e.mode}-${h}-${f.metricsTick}`,
    f.primaryPane
  ), w = $((N, B) => {
    var V, Q;
    const C = Math.max(
      Number(f.hudNumPages) || 0,
      Number(f.primaryNumPages) || 0,
      Number((V = f.numPagesByPane) == null ? void 0 : V.source) || 0,
      Number((Q = f.numPagesByPane) == null ? void 0 : Q.translated) || 0
========
    `${e.mode}-${g}-${p.metricsTick}`,
    p.primaryPane
  ), E = $((L, te) => {
    var A, Z;
    const oe = Math.max(
      Number(p.hudNumPages) || 0,
      Number(p.primaryNumPages) || 0,
      Number((A = p.numPagesByPane) == null ? void 0 : A.source) || 0,
      Number((Z = p.numPagesByPane) == null ? void 0 : Z.translated) || 0
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    );
    P(L, oe, te);
  }, [P, p.hudNumPages, p.primaryNumPages, p.numPagesByPane]), [N, x] = _(null), z = M(null), D = $((L) => {
    z.current && clearTimeout(z.current), x(L), L && (z.current = setTimeout(() => x(null), ci));
  }, []);
  j(() => () => {
    z.current && clearTimeout(z.current);
  }, []);
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  const D = $((N) => {
    const B = jt(e.regions, N);
    return B ? jn(B, f.primaryPane).page : null;
  }, [e.regions, f.primaryPane]), R = $((N, B) => {
    const C = B || f.primaryPane, V = typeof N == "object" && N ? `${N.block_id || ""}`.trim() : "", Q = typeof N == "object" && N ? `${N.image_url || ""}`.trim() : "", ce = typeof N == "object" && N ? N.page_idx != null ? Number(N.page_idx) + 1 : N.page != null ? Number(N.page) : null : typeof N == "number" ? N + 1 : null, le = Do(e.regions, Q, ce) || jt(e.regions, V) || (typeof N == "object" ? zo(e.regions, N) : null);
    let H = le ? jn(le, C).page : null;
    H == null && (H = oi(N)), !(H == null || H < 1) && (z(le), w(H, C));
  }, [z, w, f.primaryPane, e.regions]);
  Ks({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: f.hudNumPages || 0,
    currentPage: p,
    goToPage: w,
    resolveBlockPage: D,
========
  const R = $((L) => {
    const te = jt(e.regions, L);
    return te ? jn(te, p.primaryPane).page : null;
  }, [e.regions, p.primaryPane]), I = $((L, te) => {
    const oe = te || p.primaryPane, A = typeof L == "object" && L ? `${L.block_id || ""}`.trim() : "", Z = typeof L == "object" && L ? `${L.image_url || ""}`.trim() : "", ae = typeof L == "object" && L ? L.page_idx != null ? Number(L.page_idx) + 1 : L.page != null ? Number(L.page) : null : typeof L == "number" ? L + 1 : null, W = Co(e.regions, Z, ae) || jt(e.regions, A) || (typeof L == "object" ? Do(e.regions, L) : null);
    let J = W ? jn(W, oe).page : null;
    J == null && (J = li(L)), !(J == null || J < 1) && (D(W), E(J, oe));
  }, [D, E, p.primaryPane, e.regions]);
  Zs({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: p.hudNumPages || 0,
    currentPage: S,
    goToPage: E,
    resolveBlockPage: R,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (L) => {
      D(jt(e.regions, L.blockId));
    }
  });
  const T = !e.boot.loading && !e.boot.failed && e.assetsReady, k = Number(p.hudNumPages) || 0;
  j(() => {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    var N;
    I && ((N = da()) == null || N.report(p >= 1 ? p - 1 : null, T >= 1 ? T : null));
  }, [I, p, T]), j(() => {
    const N = ma();
    if (!(!N || !I || !e.jobId))
      return N.subscribe(({ jobId: B, pageIdx: C, blockId: V }) => B !== e.jobId ? !1 : (R({ ...C != null ? { page_idx: C } : {}, ...V ? { block_id: V } : {} }), !0));
  }, [I, e.jobId, R]);
  const { setModeKeepingPage: E } = Ts({
========
    var L;
    T && ((L = ua()) == null || L.report(S >= 1 ? S - 1 : null, k >= 1 ? k : null));
  }, [T, S, k]), j(() => {
    const L = fa();
    if (!(!L || !T || !e.jobId))
      return L.subscribe(({ jobId: te, pageIdx: oe, blockId: A }) => te !== e.jobId ? !1 : (I({ ...oe != null ? { page_idx: oe } : {}, ...A ? { block_id: A } : {} }), !0));
  }, [T, e.jobId, I]);
  const { setModeKeepingPage: F } = Es({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: v
  });
  j(() => {
    D(null);
  }, [m, D]);
  const H = !e.boot.loading && !e.boot.failed, V = Q(() => ({ bindShell: l, shellEl: c, shellWidth: i, shellRef: s }), [l, c, i, s]), X = Q(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), B = Q(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    userZoom: h,
    onZoomChange: g,
    shell: U,
    panes: f,
    sessionFiles: K,
    rowHeights: P,
    goToPage: w,
    activeRegion: M,
    jumpToAnchor: R,
    setModeKeepingPage: E,
========
    userZoom: g,
    onZoomChange: h,
    shell: V,
    panes: p,
    sessionFiles: X,
    rowHeights: b,
    goToPage: E,
    activeRegion: N,
    jumpToAnchor: I,
    setModeKeepingPage: F,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    download: e.download,
    showHud: H,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    revisedBlocks: u
  }), [e, U, f, K, P, w, M, R, E, x, h, g, d, a, n, u]);
  return X(() => ({
    ...Y,
    currentPage: p
  }), [Y, p]);
========
    revisedBlocks: u,
    quotedBlocks: d
  }), [e, V, p, X, b, E, N, I, F, H, g, h, f, a, n, u, d]);
  return Q(() => ({
    ...B,
    currentPage: S
  }), [B, S]);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
}
const mi = [
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
], hi = [
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
    title: "模式",
    items: [
      { actions: ["mode-source"], keys: "1", desc: "原文" },
      { actions: ["mode-compare"], keys: "2", desc: "对照" },
      { actions: ["mode-translated"], keys: "3", desc: "译文" }
    ]
  }
];
function pi(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of mi)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function gi(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const bi = ".reader-notes-panel";
function yi(e) {
  return e instanceof Element ? !!e.closest(bi) : !1;
}
function vi(e) {
  const {
    mode: t,
    sourceOnly: n,
    setMode: r,
    userZoom: o,
    onZoomChange: a,
    currentPage: s,
    numPages: c,
    goToPage: i,
    enabled: l = !0
  } = e;
  j(() => {
    if (!l)
      return;
    const u = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || gi(d.target) || yi(d.target))
        return;
      const f = d.key, m = pi(f);
      if (m) {
        if (m.mode) {
          if (n && m.mode !== "source")
            return;
          d.preventDefault(), r(m.mode);
          return;
        }
        if (!(m.requiresPages && c <= 0))
          switch (d.preventDefault(), m.action) {
            case "zoom-in":
              a(ft(o, 1));
              return;
            case "zoom-out":
              a(ft(o, -1));
              return;
            case "zoom-reset":
              a(Ge(t, Oe()));
              return;
            case "next-page":
              i(Nt(s + 1, c));
              return;
            case "prev-page":
              i(Nt(s - 1, c));
              return;
            case "first-page":
              i(1);
              return;
            case "last-page":
              i(c);
              return;
          }
      }
    };
    return window.addEventListener("keydown", u), () => window.removeEventListener("keydown", u);
  }, [
    l,
    t,
    n,
    r,
    o,
    a,
    s,
    c,
    i
  ]);
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
const pi = "retainpdf:soft-reader-close";
function Gr(e = typeof window > "u" ? "" : window.location.search) {
========
const Si = "retainpdf:soft-reader-close";
function qr(e = typeof window > "u" ? "" : window.location.search) {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  try {
    return `${new URLSearchParams(e).get("embed") || ""}`.trim();
  } catch {
    return "";
  }
}
function wi(e = typeof window > "u" ? "" : window.location.search) {
  try {
    return `${new URLSearchParams(e).get("embed_pane") || ""}`.trim();
  } catch {
    return "";
  }
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
function bi() {
  const e = new URL("./index.html", window.location.href), t = Gr();
  return t && e.searchParams.set("embed", t), e.href;
}
function yi() {
  if (typeof window > "u" || window.self === window.top || Gr()) return !1;
========
function Pi() {
  const e = new URL("./index.html", window.location.href), t = qr();
  return t && e.searchParams.set("embed", t), e.href;
}
function Ri() {
  if (typeof window > "u" || window.self === window.top || qr()) return !1;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  try {
    return window.parent.postMessage(
      { type: Si },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Ii(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Ti() {
  if (!(typeof window > "u") && !Ri()) {
    if (Ii(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Pi());
  }
}
function Kr({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  return /* @__PURE__ */ b("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function wi({ onBeforeClose: e } = {}) {
  return gi() === "beside" ? null : /* @__PURE__ */ O(Kr, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Si();
  }, children: [
    /* @__PURE__ */ b(gn, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ b("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const Pi = { available: !1, open: !1, title: null }, Ri = () => () => {
}, Ii = () => Pi;
function Ti() {
  const e = ua(), t = (e == null ? void 0 : e.getState) ?? Ii, n = Ct((e == null ? void 0 : e.subscribe) ?? Ri, t, t);
  if (!e || !n.available) return null;
  const r = n.open ? `收起笔记${n.title ? `：${n.title}` : ""}` : "打开这本书的笔记";
  return /* @__PURE__ */ b(Kr, { className: "reader-notes-toggle", label: r, pressed: n.open, onClick: e.toggle, children: /* @__PURE__ */ b(Uo, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }) });
========
  return /* @__PURE__ */ y("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Ei({ onBeforeClose: e } = {}) {
  return wi() === "beside" ? null : /* @__PURE__ */ O(Gr, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Ti();
  }, children: [
    /* @__PURE__ */ y(gn, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ y("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const ki = { available: !1, open: !1, title: null }, Mi = () => () => {
}, Ai = () => ki;
function Ni() {
  const e = la(), t = (e == null ? void 0 : e.getState) ?? Ai, n = gt((e == null ? void 0 : e.subscribe) ?? Mi, t, t);
  if (!e || !n.available) return null;
  const r = n.open ? `收起摘录${n.title ? `（摘到《${n.title}》）` : ""}` : "摘录";
  return /* @__PURE__ */ y(Gr, { className: "reader-notes-toggle", label: r, pressed: n.open, onClick: e.toggle, children: /* @__PURE__ */ y(Bo, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }) });
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
}
let Qn = !1;
function _i() {
  if (Qn)
    return;
  const e = dt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Xo.GlobalWorkerOptions.workerSrc = e, Qn = !0);
}
const Li = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Ci(e, t, n) {
  return e.flatMap((r) => {
    if (!Li.has(Mr(r.region))) return [];
    const o = pn(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function er(e, t, n) {
  let r = null, o = Number.POSITIVE_INFINITY;
  for (const a of e) {
    const { rect: s } = a;
    if (t < s.left || t > s.left + s.width || n < s.top || n > s.top + s.height)
      continue;
    const c = s.width * s.height;
    c < o && (r = a, o = c);
  }
  return r;
}
async function Di(e) {
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
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
const Ni = "reader-text-hover-copy", _i = "reader-text-hover-id", Zr = "reader-text-hover-tools", Li = "reader-text-hover-quote";
function Ci(e) {
========
const zi = "reader-text-hover-copy", xi = "reader-text-hover-id", Kr = "reader-text-hover-tools", Oi = "reader-text-hover-quote";
function Fi(e) {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  const { region: t } = e.highlight, n = `${t.translated.text || ""}`.trim();
  return {
    itemId: e.itemId,
    pageIdx: Math.max(0, t.source.page - 1),
    sourceText: `${t.source.text || ""}`,
    translatedText: n ? t.translated.text : null
  };
}
function Ht({
  className: e,
  state: t,
  label: n,
  title: r,
  onClick: o,
  children: a
}) {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  return /* @__PURE__ */ b(
========
  return /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
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
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
const Yr = 26, Nt = 190;
function Xr(e, t = Nt) {
  return e.height < Yr * 2 || e.width < t;
========
const Zr = 26, _t = 190;
function Yr(e, t = _t) {
  return e.height < Zr * 2 || e.width < t;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
}
const $i = 72;
function ji({
  target: e,
  pane: t = "source",
  revisedCount: n = 0
}) {
  const [r, o] = _("idle"), [a, s] = _("idle"), [c, i] = _("idle"), l = M([]), u = (e == null ? void 0 : e.itemId) || "";
  if (j(() => {
    o("idle"), s("idle"), i("idle");
    const w = l.current;
    return () => {
      w.forEach((b) => window.clearTimeout(b)), l.current = [];
    };
  }, [u]), !e) return null;
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  const d = xo(e.highlight.region, t), m = Mr(e.highlight.region), h = (P, p) => async (w) => {
    w.preventDefault(), w.stopPropagation();
    const M = await Ai(P);
    p(M ? "copied" : "failed"), l.current.push(window.setTimeout(() => p("idle"), 1200));
  }, g = m === "formula" ? "复制 LaTeX" : "复制", f = la(), v = !!(f != null && f.available()), y = (P) => {
    P.preventDefault(), P.stopPropagation();
    const p = !!(f != null && f.send(Ci(e)));
    i(p ? "copied" : "failed"), l.current.push(window.setTimeout(() => i("idle"), 1200));
  }, S = Xr(e.rect, v ? Nt + Di : Nt);
  return /* @__PURE__ */ b("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ b(
========
  const d = zo(e.highlight.region, t), f = Mr(e.highlight.region), m = (w, b) => async (S) => {
    S.preventDefault(), S.stopPropagation();
    const E = await Di(w);
    b(E ? "copied" : "failed"), l.current.push(window.setTimeout(() => b("idle"), 1200));
  }, g = f === "formula" ? "复制 LaTeX" : "复制", h = ca(), p = !!(h != null && h.available()), v = (w) => {
    w.preventDefault(), w.stopPropagation();
    const b = !!(h != null && h.send(Fi(e)));
    i(b ? "copied" : "failed"), l.current.push(window.setTimeout(() => i("idle"), 1200));
  }, P = Yr(e.rect, p ? _t + $i : _t);
  return /* @__PURE__ */ y("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": f,
      style: e.rect,
      children: /* @__PURE__ */ O(
        "div",
        {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
          className: Zr,
          "data-placement": S ? "outside" : "inside",
          children: [
            /* @__PURE__ */ b(
========
          className: Kr,
          "data-placement": P ? "outside" : "inside",
          children: [
            /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
              Ht,
              {
                className: xi,
                state: a,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: m(e.itemId, s),
                children: a === "copied" ? "已复制编号" : e.itemId
              }
            ),
            t === "translated" && n > 0 ? /* @__PURE__ */ O("span", { className: "reader-text-hover-revised", "data-reader-revised-count": n, children: [
              "改过 ",
              n,
              " 次"
            ] }) : null,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
            d ? /* @__PURE__ */ b(
========
            d ? /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
              Ht,
              {
                className: zi,
                state: r,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                onClick: m(d, o),
                children: r === "copied" ? "已复制" : r === "failed" ? "复制失败" : g
              }
            ) : null,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
            v ? /* @__PURE__ */ b(
========
            p ? /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
              Ht,
              {
                className: Oi,
                state: c,
                label: "把这一段摘到笔记",
                title: "摘到笔记：原文和译文一起放进打开的笔记",
                onClick: v,
                children: c === "copied" ? "已摘" : c === "failed" ? "没摘上" : "摘到笔记"
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
    const c = pn(
      Bi(e, a),
      n,
      r
    );
    c && o.push({
      itemId: a.item_id,
      translatedText: s.translated_text,
      status: s.status,
      kind: a.kind,
      sourceText: a.source_text,
      typography: a.typography,
      rect: c,
      changedAtSeq: t.changedAtSeqById.get(a.item_id) || 0,
      changedNow: t.changedAtSeqById.get(a.item_id) === t.lastEventSeq
    });
  }
  return o;
}
const Hi = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Wi = 256, it = /* @__PURE__ */ new Map();
function Vi(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
function Bi(e) {
  const t = `${e || ""}`, { text: n, slots: r } = ta(t, { bareLatex: !0 }), o = ji(n), a = na(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = it.get(t);
  if (!s && (s = ra(o, r), it.set(t, s), it.size > $i)) {
========
function Ji(e) {
  const t = `${e || ""}`, { text: n, slots: r } = ea(t, { bareLatex: !0 }), o = Vi(n), a = ta(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = it.get(t);
  if (!s && (s = na(o, r), it.set(t, s), it.size > Wi)) {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    const c = it.keys().next().value;
    c !== void 0 && it.delete(c);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Wt(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ee(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function qi(e, t) {
  const n = e.typography, r = Ee(t) || 1, o = Ee(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), c = Wt(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, i = Math.max(5.5 * r, Math.min(s, c * r)), l = Ee(n == null ? void 0 : n.fit_min_font_size_pt), u = Ee(n == null ? void 0 : n.fit_max_font_size_pt), d = Math.max(3.5, (l || 5.5) * r), f = Math.max(
    d,
    u ? u * r : o ? o * r : i
  ), m = o ? o * r : i, g = Ee(n == null ? void 0 : n.leading_em), h = [
    Ee(n == null ? void 0 : n.padding_top_pt) || 0,
    Ee(n == null ? void 0 : n.padding_right_pt) || 0,
    Ee(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ee(n == null ? void 0 : n.padding_left_pt) || 0
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  ].map((v) => v * r);
========
  ].map((p) => p * r);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Hi,
    fontSizePx: Math.max(d, Math.min(f, m)),
    minFontSizePx: d,
    maxFontSizePx: f,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Wt(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Wt(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Gi(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), c = (d) => {
    const f = s.get(d);
    if (f !== void 0) return f;
    const { width: m, height: g } = e(d), h = m <= t + 0.5 && g <= n + 0.5;
    return s.set(d, h), h;
  };
  let i = o, l = a, u = Math.min(r.requestedFontSizePx, l);
  if (c(u)) {
    if (!r.exact) {
      i = u;
      for (let d = 0; d < 6 && l > i; d += 1) {
        const f = (i + l) / 2;
        c(f) ? (u = f, i = f) : l = f;
      }
    }
  } else {
    l = u, u = i;
    for (let d = 0; d < 8 && l > i; d += 1) {
      const f = (i + l) / 2;
      c(f) ? (u = f, i = f) : l = f;
    }
  }
  return Math.max(o, u);
}
const Ki = 512, ct = /* @__PURE__ */ new Map();
let rn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  rn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  rn += 1;
}));
function Zi(e, t, n, r) {
  return [
    rn,
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
function Yi({ item: e, pageScale: t }) {
  const n = M(null), r = Q(
    () => Ji(e.translatedText),
    [e.translatedText]
  ), [o, a] = _(r.fallbackHtml), s = Q(
    () => qi(e, t),
    [e, t]
  );
  j(() => {
    let d = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((f) => {
      d && a(f);
    }), () => {
      d = !1;
    };
  }, [r]), Ce(() => {
    const d = n.current;
    if (!d) return;
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    const [m, h, g, f] = s.padding, v = Math.max(1, e.rect.width - f - h), y = Math.max(1, e.rect.height - m - g), S = Vi(o, v, y, s);
    let P = ct.get(S);
    if (P === void 0 && (P = Hi(
      (p) => (d.style.fontSize = `${p}px`, { width: d.scrollWidth, height: d.scrollHeight }),
      v,
      y,
========
    const [f, m, g, h] = s.padding, p = Math.max(1, e.rect.width - h - m), v = Math.max(1, e.rect.height - f - g), P = Zi(o, p, v, s);
    let w = ct.get(P);
    if (w === void 0 && (w = Gi(
      (b) => (d.style.fontSize = `${b}px`, { width: d.scrollWidth, height: d.scrollHeight }),
      p,
      v,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    ), ct.set(S, P), ct.size > Wi)) {
      const p = ct.keys().next().value;
      p !== void 0 && ct.delete(p);
========
    ), ct.set(P, w), ct.size > Ki)) {
      const b = ct.keys().next().value;
      b !== void 0 && ct.delete(b);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    }
    d.style.fontSize = `${w.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [c, i, l, u] = s.padding;
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  return /* @__PURE__ */ b(
========
  return /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    "div",
    {
      className: `reader-live-translation-item${e.changedNow ? " is-changed" : ""}`,
      "data-live-translation-item": e.itemId,
      "data-live-translation-kind": e.kind,
      "data-live-translation-status": e.status,
      "data-live-translation-typography": s.exact ? "typst" : "fitted",
      style: {
        ...e.rect,
        padding: `${c}px ${i}px ${l}px ${u}px`
      },
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      children: /* @__PURE__ */ b(
========
      children: /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
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
function Xi({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = Q(
    () => Ui(e, t, n, r),
    [r, e, t, n]
  );
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  return o.length ? /* @__PURE__ */ b(
========
  return o.length ? /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    "div",
    {
      className: "reader-live-translation-overlay",
      "data-live-translation-page": e == null ? void 0 : e.page_idx,
      "data-live-translation-generation": t == null ? void 0 : t.generation,
      "aria-hidden": "true",
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      children: o.map((a) => /* @__PURE__ */ b(
        Ji,
========
      children: o.map((a) => /* @__PURE__ */ y(
        Yi,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
const Gi = un(qi), Qr = dn(null), eo = dn(null);
function Ki({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ b(Qr.Provider, { value: e, children: /* @__PURE__ */ b(eo.Provider, { value: t, children: n }) });
}
function je() {
  return fn(Qr);
}
function to() {
  return fn(eo);
}
const no = 1.414;
function Zi({
========
const Qi = un(Xi), Xr = dn(null), Qr = dn(null);
function ec({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ y(Xr.Provider, { value: e, children: /* @__PURE__ */ y(Qr.Provider, { value: t, children: n }) });
}
function Le() {
  return fn(Xr);
}
function eo() {
  return fn(Qr);
}
const to = 1.414;
function tc({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  pageNumber: e,
  width: t,
  devicePixelRatio: n,
  pane: r,
  active: o = !1,
  syncedMinHeight: a = 0,
  onMetrics: s,
  cachedAspect: c,
  onAspectChange: i,
  sentinelRef: l,
  regionHighlight: u = null,
  regionTargets: d = [],
  hoveredRegionId: f,
  onHoverRegion: m,
  liveTranslationLayout: g,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  liveTranslationPage: f,
  showLiveTranslation: v = r === "source"
}) {
  var B;
  const y = (B = je()) == null ? void 0 : B.revisedBlocks, S = k(c ?? no), [P, p] = _(S.current);
  j(() => {
    c != null && Math.abs(c - S.current) >= 1e-3 && (S.current = c, p(c));
  }, [c]);
  const w = k(l);
  w.current = l;
  const M = k((C) => {
    var V;
    (V = w.current) == null || V.call(w, C);
  }).current, A = Math.max(120, Math.floor(t * P)), F = Math.max(A, Math.ceil(a || 0)), z = pn(u, t, A), D = X(
    () => Mi(d, t, A),
    [A, d, t]
  ), [R, I] = _(null), T = typeof h == "function", E = T ? m ?? null : R, x = (C) => {
    T ? C !== (m ?? null) && (h == null || h(C)) : I((V) => V === C ? V : C);
  }, U = X(
    () => D.find((C) => C.itemId === E) || null,
    [E, D]
  ), K = (C) => {
    var ee, ye;
    if (C.pointerType === "touch") return;
    if (C.buttons !== 0) {
      x(null);
      return;
    }
    if ((ye = (ee = C.target) == null ? void 0 : ee.closest) != null && ye.call(ee, `.${Zr}`)) return;
    const V = C.currentTarget.getBoundingClientRect(), Q = C.clientX - V.left, ce = C.clientY - V.top, le = U == null ? void 0 : U.rect;
    if (le && Xr(le) && Q >= le.left - 4 && Q <= le.left + Nt && ce >= le.top - Yr && ce <= le.top) return;
    const H = er(D, Q, ce);
    x((H == null ? void 0 : H.itemId) || null);
  }, Y = (C) => {
    if (C.pointerType === "mouse") return;
    const V = C.currentTarget.getBoundingClientRect(), Q = er(
      D,
      C.clientX - V.left,
      C.clientY - V.top
    );
    x((Q == null ? void 0 : Q.itemId) || null);
  }, N = (C) => {
    !Number.isFinite(C) || C <= 0 || Math.abs(S.current - C) < 1e-3 || (S.current = C, p(C), i == null || i(e, C));
========
  liveTranslationPage: h,
  showLiveTranslation: p = r === "source"
}) {
  var te, oe;
  const v = (te = Le()) == null ? void 0 : te.revisedBlocks, P = (oe = Le()) == null ? void 0 : oe.quotedBlocks, w = M(c ?? to), [b, S] = _(w.current);
  j(() => {
    c != null && Math.abs(c - w.current) >= 1e-3 && (w.current = c, S(c));
  }, [c]);
  const E = M(l);
  E.current = l;
  const N = M((A) => {
    var Z;
    (Z = E.current) == null || Z.call(E, A);
  }).current, x = Math.max(120, Math.floor(t * b)), z = Math.max(x, Math.ceil(a || 0)), D = pn(u, t, x), R = Q(
    () => Ci(d, t, x),
    [x, d, t]
  ), [I, T] = _(null), k = typeof m == "function", F = k ? f ?? null : I, H = (A) => {
    k ? A !== (f ?? null) && (m == null || m(A)) : T((Z) => Z === A ? Z : A);
  }, V = Q(
    () => R.find((A) => A.itemId === F) || null,
    [F, R]
  ), X = (A) => {
    var de, Me;
    if (A.pointerType === "touch") return;
    if (A.buttons !== 0) {
      H(null);
      return;
    }
    if ((Me = (de = A.target) == null ? void 0 : de.closest) != null && Me.call(de, `.${Kr}`)) return;
    const Z = A.currentTarget.getBoundingClientRect(), ae = A.clientX - Z.left, W = A.clientY - Z.top, J = V == null ? void 0 : V.rect;
    if (J && Yr(J) && ae >= J.left - 4 && ae <= J.left + _t && W >= J.top - Zr && W <= J.top) return;
    const ge = er(R, ae, W);
    H((ge == null ? void 0 : ge.itemId) || null);
  }, B = (A) => {
    if (A.pointerType === "mouse") return;
    const Z = A.currentTarget.getBoundingClientRect(), ae = er(
      R,
      A.clientX - Z.left,
      A.clientY - Z.top
    );
    H((ae == null ? void 0 : ae.itemId) || null);
  }, L = (A) => {
    !Number.isFinite(A) || A <= 0 || Math.abs(w.current - A) < 1e-3 || (w.current = A, S(A), i == null || i(e, A));
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  };
  return /* @__PURE__ */ O(
    "div",
    {
      ref: N,
      [Fe]: e,
      [Xe]: r,
      [bn]: x,
      className: yn,
      onPointerMoveCapture: X,
      onPointerDown: B,
      onPointerLeave: (A) => {
        A.pointerType === "mouse" && H(null);
      },
      style: {
        width: t,
        height: z,
        minHeight: z
      },
      children: [
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        o ? /* @__PURE__ */ b(
          Qo,
========
        o ? /* @__PURE__ */ y(
          Xo,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: !0,
            renderAnnotationLayer: !1,
            className: Dr,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
            loading: /* @__PURE__ */ b(
========
            loading: /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
              "div",
              {
                className: kt,
                style: { width: t, height: x }
              }
            ),
            onLoadSuccess: (A) => {
              try {
                const Z = A.getViewport({ scale: 1 });
                if (Z.width > 0) {
                  const ae = Z.height / Z.width;
                  L(ae);
                }
              } catch {
              }
              s == null || s();
            },
            onRenderSuccess: () => {
              s == null || s();
            }
          }
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        ) : /* @__PURE__ */ b(
========
        ) : /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          "div",
          {
            className: kt,
            style: { width: t, height: x },
            "aria-hidden": !0
          }
        ),
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        z ? /* @__PURE__ */ b(
========
        D ? /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": u == null ? void 0 : u.itemId,
            style: D,
            "aria-hidden": "true"
          }
        ) : null,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        o && v ? /* @__PURE__ */ b(
          Gi,
========
        o && p ? /* @__PURE__ */ y(
          Qi,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          {
            layoutPage: g,
            pageState: h,
            width: t,
            height: x
          }
        ) : null,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        o && r === "translated" && (y != null && y.size) ? /* @__PURE__ */ b("div", { className: "reader-revised-markers", "aria-hidden": "true", children: D.filter((C) => y.has(C.itemId)).map((C) => /* @__PURE__ */ b(
========
        o && (P != null && P.size) ? /* @__PURE__ */ y("div", { className: "reader-quoted-markers", "aria-hidden": "true", children: R.filter((A) => P.has(A.itemId)).map((A) => /* @__PURE__ */ y(
          "span",
          {
            className: "reader-quoted-marker",
            "data-reader-quoted-id": A.itemId,
            title: "摘过",
            style: { left: A.rect.left, top: A.rect.top, height: A.rect.height }
          },
          A.itemId
        )) }) : null,
        o && r === "translated" && (v != null && v.size) ? /* @__PURE__ */ y("div", { className: "reader-revised-markers", "aria-hidden": "true", children: R.filter((A) => v.has(A.itemId)).map((A) => /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": A.itemId,
            style: { left: A.rect.left, top: A.rect.top, height: A.rect.height }
          },
          A.itemId
        )) }) : null,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        /* @__PURE__ */ b(
          zi,
========
        /* @__PURE__ */ y(
          ji,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          {
            target: o ? V : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: V && (v == null ? void 0 : v.get(V.itemId)) || 0
          }
        )
      ]
    }
  );
}
const nc = un(tc), Vt = 5, rc = "120% 0px", oc = 120;
let tr = 1;
const nr = /* @__PURE__ */ new WeakMap();
function ac(e) {
  if (!e) return 0;
  const t = nr.get(e);
  if (t) return t;
  const n = tr;
  return tr += 1, nr.set(e, n), n;
}
function sc() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
const nc = Ro(
========
const ic = Po(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  function({
    pane: t,
    url: n = "",
    preloadedFile: r = null,
    userZoom: o = 1,
    visible: a = !0,
    emptyLabel: s = "暂无 PDF",
    scrollRoot: c = null,
    pageWidthOverride: i = null,
    rowHeights: l,
    onMetrics: u,
    onLoadSuccess: d,
    onLoadError: f,
    onNumPagesChange: m,
    activeRegion: g = null,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    regions: f = [],
    readerMetadata: v = null,
    hoveredRegionId: y = null,
    onHoverRegion: S,
    liveTranslation: P,
    showLiveTranslation: p = t === "source",
    liveTranslationPendingLabel: w = "",
    paneAction: M
  }, A) {
    Ei();
    const { file: F, loading: z, error: D } = Ua(n, r), R = `${n}\0${ec(F)}`, I = k(R);
    I.current = R;
    const T = X(
      () => xa(F),
      [F, n]
    ), [E, x] = _(0), [U, K] = _(""), [Y, N] = _(null), [B, C] = _(480), V = k(null), Q = k(0), ce = X(() => tc(), []), le = X(() => ({
========
    regions: h = [],
    readerMetadata: p = null,
    hoveredRegionId: v = null,
    onHoverRegion: P,
    liveTranslation: w,
    showLiveTranslation: b = t === "source",
    liveTranslationPendingLabel: S = "",
    paneAction: E
  }, N) {
    _i();
    const { file: x, loading: z, error: D } = Ua(n, r), R = `${n}\0${ac(x)}`, I = M(R);
    I.current = R;
    const T = Q(
      () => xa(x),
      [x, n]
    ), [k, F] = _(0), [H, V] = _(""), [X, B] = _(null), [L, te] = _(480), oe = M(null), A = M(0), Z = Q(() => sc(), []), ae = Q(() => ({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      cMapUrl: dt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: dt().resolvePdfjsVendorUrl("standard_fonts/")
    }), []);
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    mn(A, () => Y, [Y]), j(() => {
      const L = (q) => {
        Q.current = q, C(q);
      }, J = (q) => {
        const Z = ps(q, Q.current);
        if (Z !== "ignore") {
          if (V.current && clearTimeout(V.current), Z === "immediate") {
            L(q);
            return;
          }
          V.current = setTimeout(() => L(q), Or);
========
    mn(N, () => X, [X]), j(() => {
      const C = (G) => {
        A.current = G, te(G);
      }, q = (G) => {
        const Y = ps(G, A.current);
        if (Y !== "ignore") {
          if (oe.current && clearTimeout(oe.current), Y === "immediate") {
            C(G);
            return;
          }
          oe.current = setTimeout(() => C(G), gs);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        }
      }, U = !!(i && i >= 80);
      q(U ? i : (c == null ? void 0 : c.clientWidth) || 0);
      const ne = !U && c && typeof ResizeObserver < "u" ? new ResizeObserver((G) => {
        var Y, le;
        q(((le = (Y = G[0]) == null ? void 0 : Y.contentRect) == null ? void 0 : le.width) ?? c.clientWidth);
      }) : null;
      return ne && c && ne.observe(c), () => {
        ne == null || ne.disconnect(), oe.current && clearTimeout(oe.current);
      };
    }, [i, c, a]);
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    const H = X(
      () => fs(B, o),
      [B, o]
    ), [ee, ye] = _(() => /* @__PURE__ */ new Map()), [pe, et] = _(() => /* @__PURE__ */ new Set()), [Ft, He] = _(() => /* @__PURE__ */ new Set()), tt = k(/* @__PURE__ */ new Map()), Pe = k(null), re = k(/* @__PURE__ */ new Map()), ue = $((L, J) => {
      ye((W) => {
        if (W.get(L) === J) return W;
        const G = new Map(W);
        return G.set(L, J), G;
========
    const W = Q(
      () => fs(L, o),
      [L, o]
    ), [J, ge] = _(() => /* @__PURE__ */ new Map()), [de, Me] = _(() => /* @__PURE__ */ new Set()), [Ft, We] = _(() => /* @__PURE__ */ new Set()), tt = M(/* @__PURE__ */ new Map()), Pe = M(null), re = M(/* @__PURE__ */ new Map()), fe = $((C, q) => {
      ge((U) => {
        if (U.get(C) === q) return U;
        const K = new Map(U);
        return K.set(C, q), K;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      });
    }, []), pe = $((C, q) => {
      const U = tt.current, K = U.get(C);
      if (K && Pe.current)
        try {
          Pe.current.unobserve(K);
        } catch {
        }
      if (q) {
        if (U.set(C, q), Pe.current)
          try {
            Pe.current.observe(q);
          } catch {
          }
      } else
        U.delete(C);
    }, []), se = M(/* @__PURE__ */ new Map()), ie = $((C) => {
      const q = se.current;
      let U = q.get(C);
      return U || (U = (K) => pe(C, K), q.set(C, U)), U;
    }, [pe]);
    j(() => {
      if (typeof IntersectionObserver > "u") return;
      const C = re.current, q = new IntersectionObserver(
        (U) => {
          const K = [], ne = [];
          for (const G of U) {
            const Y = G.target, le = vn(Y);
            Number.isFinite(le) && (G.isIntersecting ? K : ne).push(le);
          }
          if ((K.length || ne.length) && Me((G) => {
            let Y = null;
            for (const le of K)
              G.has(le) || (Y = Y || new Set(G), Y.add(le));
            for (const le of ne)
              G.has(le) && (Y = Y || new Set(G), Y.delete(le));
            return Y || G;
          }), K.length) {
            for (const G of K) {
              const Y = C.get(G);
              Y && (clearTimeout(Y), C.delete(G));
            }
            We((G) => {
              let Y = null;
              for (const le of K)
                G.has(le) || (Y = Y || new Set(G), Y.add(le));
              return Y || G;
            });
          }
          for (const G of ne)
            C.has(G) || C.set(G, setTimeout(() => {
              C.delete(G), We((Y) => {
                if (!Y.has(G)) return Y;
                const le = new Set(Y);
                return le.delete(G), le;
              });
            }, oc));
        },
        { root: c, rootMargin: rc, threshold: 0 }
      );
      Pe.current = q;
      for (const U of tt.current.values())
        try {
          q.observe(U);
        } catch {
        }
      return () => {
        q.disconnect(), Pe.current === q && (Pe.current = null);
        for (const U of C.values()) clearTimeout(U);
        C.clear();
      };
    }, [c]), Ce(() => {
      F(0), V(""), Me(/* @__PURE__ */ new Set()), We(/* @__PURE__ */ new Set()), ge(/* @__PURE__ */ new Map()), tt.current.clear();
      const C = re.current;
      for (const q of C.values()) clearTimeout(q);
      C.clear(), m == null || m(0, t);
    }, [R, m, t]);
    const ce = $(
      ({ numPages: C }) => {
        I.current === R && (F(C), V(""), m == null || m(C, t), d == null || d({ numPages: C, pane: t }));
      },
      [R, d, m, t]
    ), Ve = $(
      (C) => {
        if (I.current !== R) return;
        const q = (C == null ? void 0 : C.message) || "PDF 解析失败";
        V(q), F(0), m == null || m(0, t), f == null || f(C, t);
      },
      [R, f, m, t]
    ), Re = Q(
      () => k > 0 ? Array.from({ length: k }, (C, q) => q + 1) : [],
      [k]
    );
    j(() => {
      typeof IntersectionObserver < "u" || We(new Set(Re));
    }, [Re]);
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    const Me = X(
      () => Bn(g, v, t),
      [g, v, t]
    ), nt = X(() => {
      const L = /* @__PURE__ */ new Map();
      for (const J of f) {
        const W = Bn(J, v, t);
        if (!W) continue;
        const G = L.get(W.box.page) || [];
        G.push(W), L.set(W.box.page, G);
      }
      return L;
    }, [t, v, f]), $t = X(() => {
      const L = /* @__PURE__ */ new Set();
      if (!y) return L;
      for (const [J, W] of nt)
        W.some((G) => G.itemId === y) && L.add(J);
      return L;
    }, [y, nt]), bt = X(() => {
      if (E === 0) return /* @__PURE__ */ new Set();
========
    const Ae = Q(
      () => Bn(g, p, t),
      [g, p, t]
    ), nt = Q(() => {
      const C = /* @__PURE__ */ new Map();
      for (const q of h) {
        const U = Bn(q, p, t);
        if (!U) continue;
        const K = C.get(U.box.page) || [];
        K.push(U), C.set(U.box.page, K);
      }
      return C;
    }, [t, p, h]), $t = Q(() => {
      const C = /* @__PURE__ */ new Set();
      if (!v) return C;
      for (const [q, U] of nt)
        U.some((K) => K.itemId === v) && C.add(q);
      return C;
    }, [v, nt]), yt = Q(() => {
      if (k === 0) return /* @__PURE__ */ new Set();
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!c && typeof IntersectionObserver < "u")) return new Set(Re);
      if (de.size === 0) {
        const U = Math.min(k, Vt * 2 + 1);
        return new Set(Array.from({ length: U }, (K, ne) => ne + 1));
      }
      const q = /* @__PURE__ */ new Set();
      for (const U of de)
        for (let K = -Vt; K <= Vt; K++) {
          const ne = U + K;
          ne >= 1 && ne <= k && q.add(ne);
        }
      return q;
    }, [k, Re, c, a, de]), rt = !n || !!D || !!H, ot = n && (D || H) || s;
    return /* @__PURE__ */ O(
      "section",
      {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        ref: N,
        className: `reader-panel ${os}${a ? "" : " is-hidden"}`,
        [Ye]: t,
========
        ref: B,
        className: `reader-panel ${os}${a ? "" : " is-hidden"}`,
        [Xe]: t,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (w == null ? void 0 : w.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
          M ? /* @__PURE__ */ b("div", { className: "reader-react-pdf-pane-action", children: M }) : null,
          w ? /* @__PURE__ */ O("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ b("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ b("span", { children: w })
          ] }) : null,
          rt && !z ? /* @__PURE__ */ b("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: ot }) : null,
          z ? /* @__PURE__ */ b("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          T && !D ? /* @__PURE__ */ b("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ b(
            ea,
========
          E ? /* @__PURE__ */ y("div", { className: "reader-react-pdf-pane-action", children: E }) : null,
          S ? /* @__PURE__ */ O("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ y("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ y("span", { children: S })
          ] }) : null,
          rt && !z ? /* @__PURE__ */ y("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: ot }) : null,
          z ? /* @__PURE__ */ y("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          T && !D ? /* @__PURE__ */ y("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ y(
            Qo,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
            {
              file: T,
              loading: null,
              error: null,
              options: ae,
              onLoadSuccess: ce,
              onLoadError: Ve,
              className: "reader-react-pdf-document",
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
              children: Re.map((L) => {
                if (bt.has(L))
                  return /* @__PURE__ */ b(
                    Yi,
========
              children: Re.map((C) => {
                if (yt.has(C))
                  return /* @__PURE__ */ y(
                    nc,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
                    {
                      pane: t,
                      pageNumber: C,
                      width: W,
                      devicePixelRatio: Z,
                      active: Ft.has(C),
                      syncedMinHeight: (l == null ? void 0 : l.get(C)) || 0,
                      onMetrics: u,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
                      cachedAspect: ee.get(L),
                      onAspectChange: ue,
                      sentinelRef: ae(L),
                      regionHighlight: (Me == null ? void 0 : Me.box.page) === L ? Me : null,
                      regionTargets: nt.get(L),
                      hoveredRegionId: y && $t.has(L) ? y : null,
                      onHoverRegion: S,
                      liveTranslationLayout: P == null ? void 0 : P.layoutByPage.get(L - 1),
                      liveTranslationPage: P == null ? void 0 : P.pagesByPage.get(L - 1),
                      showLiveTranslation: p
========
                      cachedAspect: J.get(C),
                      onAspectChange: fe,
                      sentinelRef: ie(C),
                      regionHighlight: (Ae == null ? void 0 : Ae.box.page) === C ? Ae : null,
                      regionTargets: nt.get(C),
                      hoveredRegionId: v && $t.has(C) ? v : null,
                      onHoverRegion: P,
                      liveTranslationLayout: w == null ? void 0 : w.layoutByPage.get(C - 1),
                      liveTranslationPage: w == null ? void 0 : w.pagesByPage.get(C - 1),
                      showLiveTranslation: b
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
                    },
                    `${t}-${C}`
                  );
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
                const W = ee.get(L) ?? no, G = Math.max(120, Math.floor(H * W)), ne = Math.max(G, Math.ceil((l == null ? void 0 : l.get(L)) || 0));
                return /* @__PURE__ */ b(
========
                const U = J.get(C) ?? to, K = Math.max(120, Math.floor(W * U)), ne = Math.max(K, Math.ceil((l == null ? void 0 : l.get(C)) || 0));
                return /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
                  "div",
                  {
                    ref: ie(C),
                    [Fe]: C,
                    [Xe]: t,
                    [bn]: K,
                    className: yn,
                    style: {
                      width: W,
                      height: ne,
                      minHeight: ne
                    },
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
                    children: /* @__PURE__ */ b(
========
                    children: /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
                      "div",
                      {
                        className: kt,
                        style: { width: W, height: K },
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
), rr = un(ic), cc = 2e3, lc = 6;
function uc(e, t) {
  const n = M(null), r = M(null);
  Ce(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, startHeight: a.startHeight, started: a.started } : null;
    if (!s) {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      const S = sc(e), P = Pt(e, S);
      if (!P) return;
      s = { pane: S, progress: P, startHeight: e.scrollHeight, started: performance.now() };
    }
    const { pane: c, progress: i, startHeight: l, started: u } = s;
    let d = 0, m = null, h = l, g = 0, f = u;
    const v = () => {
      var S;
      m && clearTimeout(m), cancelAnimationFrame(d);
      for (const P of or) e.removeEventListener(P, v);
      ((S = r.current) == null ? void 0 : S.stop) === v && (r.current = null);
    }, y = () => {
      Ot(e, i, "auto", c);
      const S = e.scrollHeight;
      g = S === h ? g + 1 : 0, h = S, S !== l && g >= oc || performance.now() - f > rc ? v() : d = requestAnimationFrame(y);
    };
    for (const S of or) e.addEventListener(S, v, { passive: !0 });
    r.current = { ...s, stop: v }, m = setTimeout(() => {
      m = null, f = performance.now(), d = requestAnimationFrame(y);
    }, Or);
========
      const p = dc(e), v = Rt(e, p);
      if (!v) return;
      s = { pane: p, progress: v, startHeight: e.scrollHeight, started: performance.now() };
    }
    const { pane: c, progress: i, startHeight: l, started: u } = s;
    let d = 0, f = e.scrollHeight, m = 0;
    const g = () => {
      var p;
      cancelAnimationFrame(d);
      for (const v of or) e.removeEventListener(v, g);
      ((p = r.current) == null ? void 0 : p.stop) === g && (r.current = null);
    }, h = () => {
      Ot(e, i, "auto", c);
      const p = e.scrollHeight;
      m = p === f ? m + 1 : 0, f = p, p !== l && m >= lc || performance.now() - u > cc ? g() : d = requestAnimationFrame(h);
    };
    for (const p of or) e.addEventListener(p, g, { passive: !0 });
    r.current = { ...s, stop: g }, d = requestAnimationFrame(h);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  }, [e, t]), j(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function dc(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Fe}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Xe) || null;
  }
  return null;
}
const or = ["wheel", "touchstart", "keydown", "pointerdown"], fc = () => () => {
}, ar = () => null;
function mc({
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
function hc(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function pc(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function gc(e) {
  const t = Le(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", c = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", i = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, d = e.bindShell ?? (t == null ? void 0 : t.bindShell), m = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, h = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? gt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, f = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), v = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, y = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, P = e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", p = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", w = e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, M = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, A = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), F = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), z = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), D = e.regions ?? (t == null ? void 0 : t.regions) ?? [], R = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), I = (t == null ? void 0 : t.regionHover) ?? null, [T, E] = _(null), x = Ct(
    I ? I.subscribe : ic,
========
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", c = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", i = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, d = e.bindShell ?? (t == null ? void 0 : t.bindShell), f = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? bt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), p = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, v = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, P = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, w = e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", b = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", S = e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, E = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, N = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), x = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), z = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), D = e.regions ?? (t == null ? void 0 : t.regions) ?? [], R = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), I = (t == null ? void 0 : t.regionHover) ?? null, [T, k] = _(null), F = gt(
    I ? I.subscribe : fc,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    I ? () => I.get().itemId : ar,
    I ? () => I.get().itemId : ar
  ), H = I ? F : T, V = $((te) => {
    I ? I.set(te, "pdf") : k(te);
  }, [I]), X = mc({
    mode: s,
    compareMode: c,
    showSource: i,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), L = Number.isFinite(g) && g > 0 ? hc(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  return ac(m, B), /* @__PURE__ */ b(
========
  return uc(f, L), /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    "div",
    {
      ref: d,
      className: rs,
      "data-reader-region-count": D.length,
      "data-reader-structured-region-count": D.filter(Oo).length,
      "data-reader-metadata-ready": R ? "true" : "false",
      children: /* @__PURE__ */ O(
        "main",
        {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
          className: `${ns} reader-mode-${Y.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            v ? /* @__PURE__ */ b(
              rr,
              {
                pane: "source",
                url: P,
                preloadedFile: w,
                userZoom: h,
                visible: Y.showSource,
                scrollRoot: m,
                pageWidthOverride: B,
                rowHeights: Y.compareMode ? f : void 0,
                onMetrics: A,
                emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: F,
========
          className: `${ns} reader-mode-${X.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            p ? /* @__PURE__ */ y(
              rr,
              {
                pane: "source",
                url: w,
                preloadedFile: S,
                userZoom: m,
                visible: X.showSource,
                scrollRoot: f,
                pageWidthOverride: L,
                rowHeights: X.compareMode ? h : void 0,
                onMetrics: N,
                emptyLabel: P ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: x,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
                activeRegion: z,
                regions: D,
                readerMetadata: R,
                hoveredRegionId: H,
                onHoverRegion: V,
                liveTranslation: u ? o : void 0,
                showLiveTranslation: u,
                liveTranslationPendingLabel: u ? pc(o) : "",
                paneAction: u ? /* @__PURE__ */ O(Ct, { children: [
                  e.sourcePaneAction,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
                  /* @__PURE__ */ b(
========
                  /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
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
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
            y ? /* @__PURE__ */ b(
========
            v ? /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
              rr,
              {
                pane: "translated",
                url: b,
                preloadedFile: E,
                userZoom: m,
                visible: X.showTranslated,
                scrollRoot: f,
                pageWidthOverride: L,
                rowHeights: X.compareMode ? h : void 0,
                onMetrics: N,
                emptyLabel: "暂无译文 PDF",
                onNumPagesChange: x,
                activeRegion: z,
                regions: D,
                readerMetadata: R,
                hoveredRegionId: H,
                onHoverRegion: V,
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
const bc = [
  { id: "source", label: "原文", Icon: Ar },
  { id: "compare", label: "对照", Icon: Nr },
  { id: "translated", label: "译文", Icon: _r }
];
function yc(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function vc(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Sc(e) {
  const t = Le(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? yc(a.state) : "";
  return /* @__PURE__ */ O("header", { className: "reader-workspace-bar", children: [
    a ? /* @__PURE__ */ O(
      "button",
      {
        type: "button",
        className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
        "aria-pressed": a.visible,
        "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
        title: a.state.error || c,
        onClick: a.onToggle,
        children: [
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
          /* @__PURE__ */ b(Ho, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ b("span", { className: "reader-live-translation-toggle-label", children: c })
        ]
      }
    ) : null,
    /* @__PURE__ */ b("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: fc.map(({ id: i, label: l, Icon: u }) => {
      const d = n === i, m = hc({
========
          /* @__PURE__ */ y(Uo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ y("span", { className: "reader-live-translation-toggle-label", children: c })
        ]
      }
    ) : null,
    /* @__PURE__ */ y("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: bc.map(({ id: i, label: l, Icon: u }) => {
      const d = n === i, f = vc({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        id: i,
        documentReady: r,
        sourceViewOnly: s,
        liveTranslationAvailable: !!a
      });
      return /* @__PURE__ */ O(
        "button",
        {
          type: "button",
          className: `reader-workspace-tab${d ? " is-active" : ""}`,
          role: "tab",
          "aria-selected": d,
          "aria-label": l,
          title: f ? `${l} 需要文档任务` : l,
          disabled: f,
          onClick: () => o(i),
          children: [
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
            /* @__PURE__ */ b(u, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ b("span", { className: "reader-workspace-tab-label", children: l })
========
            /* @__PURE__ */ y(u, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ y("span", { className: "reader-workspace-tab-label", children: l })
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          ]
        },
        i
      );
    }) })
  ] });
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
const gc = () => () => {
}, bc = () => !1;
function yc() {
  const e = fa(), t = (e == null ? void 0 : e.available) ?? bc, n = Ct((e == null ? void 0 : e.subscribe) ?? gc, t, t), r = $(() => !!(e != null && e.available() && e.ask()), [e]);
  return { available: n, ask: r };
}
const vc = {
  markdown: { label: "Markdown", short: "MD", Icon: Wo, needsJob: !0 }
}, Sc = Fr.map(
  (e) => ({ id: e, ...vc[e] })
========
const wc = () => () => {
}, Pc = () => !1;
function Rc() {
  const e = da(), t = (e == null ? void 0 : e.available) ?? Pc, n = gt((e == null ? void 0 : e.subscribe) ?? wc, t, t), r = $(() => !!(e != null && e.available() && e.ask()), [e]);
  return { available: n, ask: r };
}
const Ic = {
  markdown: { label: "Markdown", short: "MD", Icon: Ho, needsJob: !0 }
}, Tc = Or.map(
  (e) => ({ id: e, ...Ic[e] })
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
);
function Ec() {
  return Tc.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function kc(e) {
  const t = Le(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), c = Rc(), i = [
    ...Ec().map(({ id: l, label: u, short: d, Icon: f, needsJob: m }) => ({
      key: l,
      label: u,
      short: d,
      Icon: f,
      disabled: m && o,
      selected: n === l,
      badge: r == null ? void 0 : r[l],
      onClick: () => a(l)
    })),
    ...c.available ? [{ key: "host-ai", label: "AI", short: "AI", Icon: Vo, disabled: !1, selected: !1, onClick: () => void c.ask() }] : []
  ];
  return n ? /* @__PURE__ */ O("header", { className: "reader-assistant-dock-header", children: [
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    /* @__PURE__ */ b("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: l, label: u, Icon: d, disabled: m, selected: h, badge: g, onClick: f }) => /* @__PURE__ */ O(
========
    /* @__PURE__ */ y("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: l, label: u, Icon: d, disabled: f, selected: m, badge: g, onClick: h }) => /* @__PURE__ */ O(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": m,
        className: `reader-assistant-dock-tab${m ? " is-active" : ""}`,
        title: f ? `${u} 需打开任务阅读` : u,
        disabled: f,
        onClick: h,
        children: [
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
          /* @__PURE__ */ b(d, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ b("span", { className: "reader-assistant-dock-tab-label", children: u }),
          g ? /* @__PURE__ */ b("span", { className: "reader-assistant-dock-badge", children: g }) : null
========
          /* @__PURE__ */ y(d, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ y("span", { className: "reader-assistant-dock-tab-label", children: u }),
          g ? /* @__PURE__ */ y("span", { className: "reader-assistant-dock-badge", children: g }) : null
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        ]
      },
      l
    )) }),
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    /* @__PURE__ */ b(
========
    /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        children: /* @__PURE__ */ b(gn, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : /* @__PURE__ */ b("nav", { className: "reader-assistant-rail", "aria-label": "阅读辅助工具", children: i.map(({ key: l, label: u, short: d, Icon: m, disabled: h, badge: g, onClick: f }) => /* @__PURE__ */ O(
========
        children: /* @__PURE__ */ y(gn, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : /* @__PURE__ */ y("nav", { className: "reader-assistant-rail", "aria-label": "阅读辅助工具", children: i.map(({ key: l, label: u, short: d, Icon: f, disabled: m, badge: g, onClick: h }) => /* @__PURE__ */ O(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    "button",
    {
      type: "button",
      className: "reader-assistant-rail-button",
      "aria-label": `打开${u}`,
      title: m ? `${u} 需打开任务阅读` : u,
      disabled: m,
      onClick: h,
      children: [
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        /* @__PURE__ */ b(m, { size: 18, strokeWidth: 2, "aria-hidden": !0 }),
        /* @__PURE__ */ b("span", { children: d }),
        g ? /* @__PURE__ */ b("span", { className: "reader-assistant-dock-badge", children: g }) : null
========
        /* @__PURE__ */ y(f, { size: 18, strokeWidth: 2, "aria-hidden": !0 }),
        /* @__PURE__ */ y("span", { children: d }),
        g ? /* @__PURE__ */ y("span", { className: "reader-assistant-dock-badge", children: g }) : null
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      ]
    },
    l
  )) });
}
function Mc(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Ac(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Nc(e) {
  return e / 100 * window.innerHeight;
}
function _c(e) {
  return e / 100 * window.innerWidth;
}
function Lc(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function lt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Lc(n);
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
      r = Ac(t, o);
      break;
    }
    case "em": {
      r = Mc(t, o);
      break;
    }
    case "vh": {
      r = Nc(o);
      break;
    }
    case "vw": {
      r = _c(o);
      break;
    }
  }
  return r;
}
function he(e) {
  return parseFloat(e.toFixed(3));
}
function Qe({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function on(e) {
  const { panels: t } = e, n = Qe({ group: e });
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
      const u = lt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = he(u / n * 100);
    }
    let c;
    if (a.defaultSize !== void 0) {
      const u = lt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      c = he(u / n * 100);
    }
    let i = 0;
    if (a.minSize !== void 0) {
      const u = lt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      i = he(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = lt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = he(u / n * 100);
    }
    return {
      groupResizeBehavior: a.groupResizeBehavior,
      collapsedSize: s,
      collapsible: a.collapsible === !0,
      defaultSize: c,
      disabled: a.disabled,
      minSize: i,
      maxSize: l,
      panelId: r.id
    };
  });
}
function ee(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function an(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Cc : Dc
  );
}
function Cc(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Dc(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function ro(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function oo(e, t) {
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
function zc({
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
    const { x: c, y: i } = oo(r, s), l = e === "horizontal" ? c : i;
    l < a && (a = l, o = s);
  }
  return ee(o, "No rect found"), o;
}
let wt;
function xc() {
  return wt === void 0 && (typeof matchMedia == "function" ? wt = !!matchMedia("(pointer:coarse)").matches : wt = !1), wt;
}
function ao(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = an(
    n,
    Array.from(t.children).filter(ro).map((g) => ({ element: g }))
  ).map(({ element: g }) => g), s = [];
  let c = !1, i = !1, l = -1, u = -1, d = 0, f, m = [];
  {
    let g = -1;
    for (const h of a)
      h.hasAttribute("data-panel") && (g++, h.hasAttribute("data-disabled") || (d++, l === -1 && (l = g), u = g));
  }
  if (d > 1) {
    let g = -1;
    for (const h of a)
      if (h.hasAttribute("data-panel")) {
        g++;
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        const v = r.find(
          (y) => y.element === f
        );
        if (v) {
          if (m) {
            const y = m.element.getBoundingClientRect(), S = f.getBoundingClientRect();
            let P;
========
        const p = r.find(
          (v) => v.element === h
        );
        if (p) {
          if (f) {
            const v = f.element.getBoundingClientRect(), P = h.getBoundingClientRect();
            let w;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
            if (i) {
              const b = n === "horizontal" ? new DOMRect(
                v.right,
                v.top,
                0,
                v.height
              ) : new DOMRect(
                v.left,
                v.bottom,
                v.width,
                0
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
              ), w = n === "horizontal" ? new DOMRect(S.left, S.top, 0, S.height) : new DOMRect(S.left, S.top, S.width, 0);
              switch (h.length) {
                case 0: {
                  P = [
                    p,
                    w
========
              ), S = n === "horizontal" ? new DOMRect(P.left, P.top, 0, P.height) : new DOMRect(P.left, P.top, P.width, 0);
              switch (m.length) {
                case 0: {
                  w = [
                    b,
                    S
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
                  ];
                  break;
                }
                case 1: {
                  const E = m[0], N = zc({
                    orientation: n,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
                    rects: [y, S],
                    targetRect: M.element.getBoundingClientRect()
                  });
                  P = [
                    M,
                    A === y ? w : p
========
                    rects: [v, P],
                    targetRect: E.element.getBoundingClientRect()
                  });
                  w = [
                    E,
                    N === v ? S : b
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
                  ];
                  break;
                }
                default: {
                  w = m;
                  break;
                }
              }
            } else
              m.length ? w = m : w = [
                n === "horizontal" ? new DOMRect(
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
                  y.right,
                  S.top,
                  S.left - y.right,
                  S.height
                ) : new DOMRect(
                  S.left,
                  y.bottom,
                  S.width,
                  S.top - y.bottom
                )
              ];
            for (const p of P) {
              let w = "width" in p ? p : p.element.getBoundingClientRect();
              const M = _c() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (w.width < M) {
                const F = M - w.width;
                w = new DOMRect(
                  w.x - F / 2,
                  w.y,
                  w.width + F,
                  w.height
                );
              }
              if (w.height < M) {
                const F = M - w.height;
                w = new DOMRect(
                  w.x,
                  w.y - F / 2,
                  w.width,
                  w.height + F
========
                  v.right,
                  P.top,
                  P.left - v.right,
                  P.height
                ) : new DOMRect(
                  P.left,
                  v.bottom,
                  P.width,
                  P.top - v.bottom
                )
              ];
            for (const b of w) {
              let S = "width" in b ? b : b.element.getBoundingClientRect();
              const E = xc() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (S.width < E) {
                const x = E - S.width;
                S = new DOMRect(
                  S.x - x / 2,
                  S.y,
                  S.width + x,
                  S.height
                );
              }
              if (S.height < E) {
                const x = E - S.height;
                S = new DOMRect(
                  S.x,
                  S.y - x / 2,
                  S.width,
                  S.height + x
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
                );
              }
              const N = g <= l || g > u;
              !c && !N && s.push({
                group: e,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
                groupSize: Xe({ group: e }),
                panels: [m, v],
                separator: "width" in p ? void 0 : p,
                rect: w
              }), c = !1;
            }
          }
          i = !1, m = v, h = [];
        }
      } else if (f.hasAttribute("data-separator")) {
        f.ariaDisabled !== null && (c = !0);
        const v = o.find(
          (y) => y.element === f
        );
        v ? h.push(v) : (m = void 0, h = []);
========
                groupSize: Qe({ group: e }),
                panels: [f, p],
                separator: "width" in b ? void 0 : b,
                rect: S
              }), c = !1;
            }
          }
          i = !1, f = p, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (c = !0);
        const p = o.find(
          (v) => v.element === h
        );
        p ? m.push(p) : (f = void 0, m = []);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      } else
        i = !0;
  }
  return s;
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
var Ae;
class so {
========
var Ne;
class ao {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  constructor() {
    Fn(this, Ne, {});
  }
  addListener(t, n) {
    const r = at(this, Ne)[t];
    return r === void 0 ? at(this, Ne)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = at(this, Ne)[t];
    if (r !== void 0)
      if (r.length === 1)
        r[0].call(null, n);
      else {
        let o = !1, a = null;
        const s = Array.from(r);
        for (let c = 0; c < s.length; c++) {
          const i = s[c];
          try {
            i.call(null, n);
          } catch (l) {
            a === null && (o = !0, a = l);
          }
        }
        if (o)
          throw a;
      }
  }
  removeAllListeners() {
    $n(this, Ne, {});
  }
  removeListener(t, n) {
    const r = at(this, Ne)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Ne = new WeakMap();
let Ze = {
  cursorFlags: 0,
  state: "inactive"
};
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
const Pn = new so();
function Oe() {
  return Ke;
========
const Pn = new ao();
function $e() {
  return Ze;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
}
function Oc(e) {
  return Pn.addListener("change", e);
}
function Fc(e) {
  const t = Ze, n = { ...Ze };
  n.cursorFlags = e, Ze = n, Pn.emit("change", {
    prev: t,
    next: n
  });
}
function Ye(e) {
  const t = Ze;
  Ze = e, Pn.emit("change", {
    prev: t,
    next: e
  });
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
const Dc = (e) => e, Jt = () => {
}, io = 1, co = 2, lo = 4, uo = 8, sr = 3, ir = 12;
let wt;
========
const $c = (e) => e, Jt = () => {
}, so = 1, io = 2, co = 4, lo = 8, sr = 3, ir = 12;
let Pt;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
function cr() {
  return Pt === void 0 && (Pt = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (Pt = !0)), Pt;
}
function jc({
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
        if (e && cr()) {
          const a = (e & io) !== 0, s = (e & co) !== 0, c = (e & lo) !== 0, i = (e & uo) !== 0;
          if (a)
            return c ? "se-resize" : i ? "ne-resize" : "e-resize";
          if (s)
            return c ? "sw-resize" : i ? "nw-resize" : "w-resize";
          if (c)
            return "s-resize";
          if (i)
            return "n-resize";
        }
        break;
      }
    }
    return cr() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const lr = /* @__PURE__ */ new WeakMap();
function Rn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = lr.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = $e();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = jc({
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
  lr.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Se = /* @__PURE__ */ new Map();
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
const fo = new so();
function xc(e) {
========
const uo = new ao();
function Bc(e) {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  Se = new Map(Se), Se.delete(e);
}
function ur(e, t) {
  for (const [n] of Se)
    if (n.id === e)
      return n;
}
function _e(e, t) {
  for (const [n, r] of Se)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function Ue() {
  return Se;
}
function In(e, t) {
  return fo.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function ke(e, t, n) {
  const r = Se.get(e);
  Se = new Map(Se), Se.set(e, t), fo.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
function mo(e) {
  const t = Oe();
========
function fo(e) {
  const t = $e();
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  let n = !1;
  switch (t.state) {
    case "active":
      Ye({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Rn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = _e(r.group.id, !0);
        ke(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function dr(e) {
  e.defaultPrevented || mo(e.currentTarget);
}
function Uc(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = oo(n, a.rect);
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
function Hc(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Wc(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: hr(e),
    b: hr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  ee(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: mr(fr(n.a)),
    b: mr(fr(n.b))
  };
  if (o.a === o.b) {
    const a = r.childNodes, s = {
      a: n.a.at(-1),
      b: n.b.at(-1)
    };
    let c = a.length;
    for (; c--; ) {
      const i = a[c];
      if (i === s.a) return 1;
      if (i === s.b) return -1;
    }
  }
  return Math.sign(o.a - o.b);
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
const jc = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Bc(e) {
  const t = getComputedStyle(ho(e) ?? e).display;
========
const Vc = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Jc(e) {
  const t = getComputedStyle(mo(e) ?? e).display;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  return t === "flex" || t === "inline-flex";
}
function qc(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Jc(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Vc.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function fr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (ee(n, "Missing node"), qc(n)) return n;
  }
  return null;
}
function mr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function hr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = ho(e);
  return t;
}
function ho(e) {
  const { parentNode: t } = e;
  return Hc(t) ? t.host : t;
}
function Gc(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Kc({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!ro(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Wc(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Gc(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function Tn(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    const a = ao(o), s = Oc(o.orientation, a, {
========
    const a = oo(o), s = Uc(o.orientation, a, {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Kc({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Zc(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function me(e, t, n = 0) {
  return Math.abs(he(e) - he(t)) <= n;
}
function ve(e, t) {
  return me(e, t) ? 0 : e > t ? 1 : -1;
}
function Ke({
  overrideDisabledPanels: e,
  panelConstraints: t,
  prevSize: n,
  size: r
}) {
  const {
    collapsedSize: o = 0,
    collapsible: a,
    disabled: s,
    maxSize: c = 100,
    minSize: i = 0
  } = t;
  if (s && !e)
    return n;
  if (ve(r, i) < 0)
    if (a) {
      const l = (o + i) / 2;
      ve(r, l) < 0 ? r = o : r = i;
    } else
      r = i;
  return r = Math.min(c, r), r = he(r), r;
}
function mt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (me(e, 0))
    return t;
  const s = a === "imperative-api", c = Object.values(t), i = Object.values(o), l = [...c], [u, d] = r;
  ee(u != null, "Invalid first pivot index"), ee(d != null, "Invalid second pivot index");
  let f = 0;
  switch (a) {
    case "keyboard": {
      {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        const f = e < 0 ? d : u, v = n[f];
        te(
          v,
          `Panel constraints not found for index ${f}`
        );
        const {
          collapsedSize: y = 0,
          collapsible: S,
          minSize: P = 0
        } = v;
        if (S) {
          const p = c[f];
          if (te(
            p != null,
            `Previous layout not found for panel index ${f}`
          ), de(p, y)) {
            const w = P - p;
            ve(w, Math.abs(e)) > 0 && (e = e < 0 ? 0 - w : w);
========
        const h = e < 0 ? d : u, p = n[h];
        ee(
          p,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: v = 0,
          collapsible: P,
          minSize: w = 0
        } = p;
        if (P) {
          const b = c[h];
          if (ee(
            b != null,
            `Previous layout not found for panel index ${h}`
          ), me(b, v)) {
            const S = w - b;
            ve(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          }
        }
      }
      {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        const f = e < 0 ? u : d, v = n[f];
        te(
          v,
          `No panel constraints found for index ${f}`
        );
        const {
          collapsedSize: y = 0,
          collapsible: S,
          minSize: P = 0
        } = v;
        if (S) {
          const p = c[f];
          if (te(
            p != null,
            `Previous layout not found for panel index ${f}`
          ), de(p, P)) {
            const w = p - y;
            ve(w, Math.abs(e)) > 0 && (e = e < 0 ? 0 - w : w);
========
        const h = e < 0 ? u : d, p = n[h];
        ee(
          p,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: v = 0,
          collapsible: P,
          minSize: w = 0
        } = p;
        if (P) {
          const b = c[h];
          if (ee(
            b != null,
            `Previous layout not found for panel index ${h}`
          ), me(b, w)) {
            const S = b - v;
            ve(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          }
        }
      }
      break;
    }
    default: {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      const f = e < 0 ? d : u, v = n[f];
      te(
        v,
        `Panel constraints not found for index ${f}`
      );
      const y = c[f], { collapsible: S, collapsedSize: P, minSize: p } = v;
      if (S && ve(y, p) < 0)
        if (e > 0) {
          const w = p - P, M = w / 2, A = y + e;
          ve(A, p) < 0 && (e = ve(e, M) <= 0 ? 0 : w);
        } else {
          const w = p - P, M = 100 - w / 2, A = y - e;
          ve(A, p) < 0 && (e = ve(100 + e, M) > 0 ? 0 : -w);
========
      const h = e < 0 ? d : u, p = n[h];
      ee(
        p,
        `Panel constraints not found for index ${h}`
      );
      const v = c[h], { collapsible: P, collapsedSize: w, minSize: b } = p;
      if (P && ve(v, b) < 0)
        if (e > 0) {
          const S = b - w, E = S / 2, N = v + e;
          ve(N, b) < 0 && (e = ve(e, E) <= 0 ? 0 : S);
        } else {
          const S = b - w, E = 100 - S / 2, N = v - e;
          ve(N, b) < 0 && (e = ve(100 + e, E) > 0 ? 0 : -S);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        }
      break;
    }
  }
  {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    const f = e < 0 ? 1 : -1;
    let v = e < 0 ? d : u, y = 0;
    for (; ; ) {
      const P = c[v];
      te(
        P != null,
        `Previous layout not found for panel index ${v}`
========
    const h = e < 0 ? 1 : -1;
    let p = e < 0 ? d : u, v = 0;
    for (; ; ) {
      const w = c[p];
      ee(
        w != null,
        `Previous layout not found for panel index ${p}`
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      );
      const b = Ke({
        overrideDisabledPanels: s,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        panelConstraints: n[v],
        prevSize: P,
        size: 100
      }) - P;
      if (y += p, v += f, v < 0 || v >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(y));
    e = e < 0 ? 0 - S : S;
  }
  {
    let f = e < 0 ? u : d;
    for (; f >= 0 && f < n.length; ) {
      const v = Math.abs(e) - Math.abs(m), y = c[f];
      te(
        y != null,
        `Previous layout not found for panel index ${f}`
      );
      const S = y - v, P = Ge({
        overrideDisabledPanels: s,
        panelConstraints: n[f],
        prevSize: y,
        size: S
========
        panelConstraints: n[p],
        prevSize: w,
        size: 100
      }) - w;
      if (v += b, p += h, p < 0 || p >= n.length)
        break;
    }
    const P = Math.min(Math.abs(e), Math.abs(v));
    e = e < 0 ? 0 - P : P;
  }
  {
    let h = e < 0 ? u : d;
    for (; h >= 0 && h < n.length; ) {
      const p = Math.abs(e) - Math.abs(f), v = c[h];
      ee(
        v != null,
        `Previous layout not found for panel index ${h}`
      );
      const P = v - p, w = Ke({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: v,
        size: P
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      });
      if (!me(v, w) && (f += v - w, l[h] = w, f.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (Zc(i, l))
    return o;
  {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    const f = e < 0 ? d : u, v = c[f];
    te(
      v != null,
      `Previous layout not found for panel index ${f}`
    );
    const y = v + m, S = Ge({
      overrideDisabledPanels: s,
      panelConstraints: n[f],
      prevSize: v,
      size: y
    });
    if (l[f] = S, !de(S, y)) {
      let P = y - S, p = e < 0 ? d : u;
      for (; p >= 0 && p < n.length; ) {
        const w = l[p];
        te(
          w != null,
          `Previous layout not found for panel index ${p}`
        );
        const M = w + P, A = Ge({
          overrideDisabledPanels: s,
          panelConstraints: n[p],
          prevSize: w,
          size: M
        });
        if (de(w, A) || (P -= A - w, l[p] = A), de(P, 0))
========
    const h = e < 0 ? d : u, p = c[h];
    ee(
      p != null,
      `Previous layout not found for panel index ${h}`
    );
    const v = p + f, P = Ke({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: p,
      size: v
    });
    if (l[h] = P, !me(P, v)) {
      let w = v - P, b = e < 0 ? d : u;
      for (; b >= 0 && b < n.length; ) {
        const S = l[b];
        ee(
          S != null,
          `Previous layout not found for panel index ${b}`
        );
        const E = S + w, N = Ke({
          overrideDisabledPanels: s,
          panelConstraints: n[b],
          prevSize: S,
          size: E
        });
        if (me(S, N) || (w -= N - S, l[b] = N), me(w, 0))
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          break;
        e > 0 ? b-- : b++;
      }
    }
  }
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  const h = Object.values(l).reduce(
    (f, v) => v + f,
========
  const m = Object.values(l).reduce(
    (h, p) => p + h,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    0
  );
  if (!me(m, 100, 0.1))
    return o;
  const g = Object.keys(o);
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  return l.reduce((f, v, y) => (f[g[y]] = v, f), {});
========
  return l.reduce((h, p, v) => (h[g[v]] = p, h), {});
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
}
function je(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || ve(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function Be({
  layout: e,
  panelConstraints: t
}) {
  const n = Object.values(e), r = [...n], o = r.reduce(
    (c, i) => c + i,
    0
  );
  if (r.length !== t.length)
    throw Error(
      `Invalid ${t.length} panel layout: ${r.map((c) => `${c}%`).join(", ")}`
    );
  if (!me(o, 100) && r.length > 0)
    for (let c = 0; c < t.length; c++) {
      const i = r[c];
      ee(i != null, `No layout data found for index ${c}`);
      const l = 100 / o * i;
      r[c] = l;
    }
  let a = 0;
  for (let c = 0; c < t.length; c++) {
    const i = n[c];
    ee(i != null, `No layout data found for index ${c}`);
    const l = r[c];
    ee(l != null, `No layout data found for index ${c}`);
    const u = Ke({
      overrideDisabledPanels: !0,
      panelConstraints: t[c],
      prevSize: i,
      size: l
    });
    l != u && (a += l - u, r[c] = u);
  }
  if (!me(a, 0))
    for (let c = 0; c < t.length; c++) {
      const i = r[c];
      ee(i != null, `No layout data found for index ${c}`);
      const l = i + a, u = Ke({
        overrideDisabledPanels: !0,
        panelConstraints: t[c],
        prevSize: i,
        size: l
      });
      if (i !== u && (a -= u - i, r[c] = u, me(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((c, i, l) => (c[s[l]] = i, c), {});
}
function po({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const i = Ue();
    for (const [
      l,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: d,
        layout: f,
        groupSize: m,
        separatorToPanels: g
      }
    ] of i)
      if (l.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: d,
          group: l,
          groupSize: m,
          layout: f,
          separatorToPanels: g
        };
    throw Error(`Group ${e} not found`);
  }, r = () => {
    const i = n().derivedPanelConstraints.find(
      (l) => l.panelId === t
    );
    if (i !== void 0)
      return i;
    throw Error(`Panel constraints not found for Panel ${t}`);
  }, o = () => {
    const i = n().group.panels.find((l) => l.id === t);
    if (i !== void 0)
      return i;
    throw Error(`Layout not found for Panel ${t}`);
  }, a = () => {
    const i = n().layout[t];
    if (i !== void 0)
      return i;
    throw Error(`Layout not found for Panel ${t}`);
  }, s = ({
    nextSize: i,
    panels: l,
    prevLayout: u,
    derivedPanelConstraints: d
  }) => {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    const m = a(), h = l.findIndex((v) => v.id === t), g = h === 0, f = h === l.length - 1;
    if (f && i < m && (g || l.slice(0, h).every((v, y) => {
      const S = d[y];
      return (S == null ? void 0 : S.collapsible) && de(S.collapsedSize, u[S.panelId]);
    }))) {
      const v = l.slice(0, h).reduce((y, S) => y + u[S.id], 0);
      return {
        ...u,
        [t]: me(100 - v)
========
    const f = a(), m = l.findIndex((p) => p.id === t), g = m === 0, h = m === l.length - 1;
    if (h && i < f && (g || l.slice(0, m).every((p, v) => {
      const P = d[v];
      return (P == null ? void 0 : P.collapsible) && me(P.collapsedSize, u[P.panelId]);
    }))) {
      const p = l.slice(0, m).reduce((v, P) => v + u[P.id], 0);
      return {
        ...u,
        [t]: he(100 - p)
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      };
    }
    return mt({
      delta: h ? f - i : i - f,
      initialLayout: u,
      panelConstraints: d,
      pivotIndices: h ? [m - 1, m] : [m, m + 1],
      prevLayout: u,
      trigger: "imperative-api"
    });
  }, c = (i) => {
    const l = a();
    if (i === l)
      return;
    const {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: d,
      group: f,
      groupSize: m,
      layout: g,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      separatorToPanels: f
    } = n(), v = s({
========
      separatorToPanels: h
    } = n(), p = s({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      nextSize: i,
      panels: f.panels,
      prevLayout: g,
      derivedPanelConstraints: d
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    }), y = $e({
      layout: v,
========
    }), v = Be({
      layout: p,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      panelConstraints: d
    });
    je(g, v) || ke(f, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: d,
      groupSize: m,
      layout: v,
      separatorToPanels: h
    });
  };
  return {
    collapse: () => {
      const { collapsible: i, collapsedSize: l } = r(), { mutableValues: u } = o(), d = a();
      i && d !== l && (u.expandToSize = d, c(l));
    },
    expand: () => {
      const { collapsible: i, collapsedSize: l, minSize: u } = r(), { mutableValues: d } = o(), f = a();
      if (i && f === l) {
        let m = d.expandToSize ?? u;
        m === 0 && (m = 1), c(m);
      }
    },
    getSize: () => {
      const { group: i } = n(), l = a(), { element: u } = o(), d = i.orientation === "horizontal" ? u.offsetWidth : u.offsetHeight;
      return {
        asPercentage: l,
        inPixels: d
      };
    },
    isCollapsed: () => {
      const { collapsible: i, collapsedSize: l } = r(), u = a();
      return i && me(l, u);
    },
    resize: (i) => {
      const { group: l } = n(), { element: u } = o(), d = Qe({ group: l }), f = lt({
        groupSize: d,
        panelElement: u,
        styleProp: i
      }), m = he(f / d * 100);
      c(m);
    }
  };
}
function pr(e) {
  if (e.defaultPrevented)
    return;
  const t = Ue();
  Tn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = po({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function It(e) {
  const t = Ue();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function go({
  groupId: e
}) {
  const t = () => {
    const n = Ue();
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
        layout: c,
        separatorToPanels: i
      } = t(), l = Be({
        layout: n,
        panelConstraints: o
      });
      return r ? c : (je(c, l) || ke(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: i
      }), l);
    }
  };
}
function De(e, t) {
  const n = It(e), r = _e(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  ee(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  te(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), c = go({ groupId: n.id }).getLayout(), i = mt({
========
  ee(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), c = po({ groupId: n.id }).getLayout(), i = mt({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    delta: t,
    initialLayout: c,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: c,
    trigger: "keyboard"
  }), l = Be({
    layout: i,
    panelConstraints: r.derivedPanelConstraints
  });
  je(c, l) || ke(
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
function gr(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = It(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && De(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && De(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && De(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && De(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), De(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = It(t), o = _e(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: c } = o, i = r.separators.find(
          (f) => f.element === t
        );
        ee(i, "Matching separator not found");
        const l = c.get(i);
        ee(l, "Matching panels not found");
        const u = l[0], d = a.find(
          (f) => f.panelId === u.id
        );
        if (ee(d, "Panel metadata not found"), d.collapsible) {
          const f = s[u.id], m = d.collapsedSize === f ? r.mutableState.expandedPanelSizes[u.id] ?? d.minSize : d.collapsedSize;
          De(t, m - f);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = It(t).separators.map(
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
        e.preventDefault(), De(t, -100);
        break;
      }
    }
}
function br(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = Ue(), n = Tn(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), Ye({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function bo({
  document: e,
  event: t,
  hitRegions: n,
  initialLayoutMap: r,
  mountedGroups: o,
  pointerDownAtPoint: a,
  prevCursorFlags: s
}) {
  let c = 0;
  n.forEach((l) => {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    const { group: u, groupSize: d } = l, { orientation: m, panels: h } = u, { disableCursor: g } = u.mutableState;
    let f = 0;
    a ? m === "horizontal" ? f = (t.clientX - a.x) / d * 100 : f = (t.clientY - a.y) / d * 100 : m === "horizontal" ? f = t.clientX < 0 ? -100 : 100 : f = t.clientY < 0 ? -100 : 100;
    const v = r.get(u), y = o.get(u);
    if (!v || !y)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: P,
      groupSize: p,
      layout: w,
      separatorToPanels: M
    } = y;
    if (P && w && M) {
      const A = mt({
        delta: f,
        initialLayout: v,
        panelConstraints: P,
        pivotIndices: l.panels.map((F) => h.indexOf(F)),
        prevLayout: w,
        trigger: "mouse-or-touch"
      });
      if (Fe(A, w)) {
        if (f !== 0 && !g)
          switch (m) {
            case "horizontal": {
              c |= f < 0 ? io : co;
              break;
            }
            case "vertical": {
              c |= f < 0 ? lo : uo;
========
    const { group: u, groupSize: d } = l, { orientation: f, panels: m } = u, { disableCursor: g } = u.mutableState;
    let h = 0;
    a ? f === "horizontal" ? h = (t.clientX - a.x) / d * 100 : h = (t.clientY - a.y) / d * 100 : f === "horizontal" ? h = t.clientX < 0 ? -100 : 100 : h = t.clientY < 0 ? -100 : 100;
    const p = r.get(u), v = o.get(u);
    if (!p || !v)
      return;
    const {
      defaultLayoutDeferred: P,
      derivedPanelConstraints: w,
      groupSize: b,
      layout: S,
      separatorToPanels: E
    } = v;
    if (w && S && E) {
      const N = mt({
        delta: h,
        initialLayout: p,
        panelConstraints: w,
        pivotIndices: l.panels.map((x) => m.indexOf(x)),
        prevLayout: S,
        trigger: "mouse-or-touch"
      });
      if (je(N, S)) {
        if (h !== 0 && !g)
          switch (f) {
            case "horizontal": {
              c |= h < 0 ? so : io;
              break;
            }
            case "vertical": {
              c |= h < 0 ? co : lo;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
              break;
            }
          }
      } else
        ke(l.group, {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
          defaultLayoutDeferred: S,
          derivedPanelConstraints: P,
          groupSize: p,
          layout: A,
          separatorToPanels: M
========
          defaultLayoutDeferred: P,
          derivedPanelConstraints: w,
          groupSize: b,
          layout: N,
          separatorToPanels: E
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        });
    }
  });
  let i = 0;
  t.movementX === 0 ? i |= s & sr : i |= c & sr, t.movementY === 0 ? i |= s & ir : i |= c & ir, Fc(i), Rn(e);
}
function yr(e) {
  const t = Ue(), n = $e();
  switch (n.state) {
    case "active":
      bo({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function vr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = $e(), n = Ue();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        Ye({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = _e(a.group.id, !0);
          ke(a.group, s, {
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
      bo({
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
      const a = Tn(e, n);
      a.length === 0 ? t.state !== "inactive" && Ye({
        cursorFlags: 0,
        state: "inactive"
      }) : Ye({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Rn(e.currentTarget);
      break;
    }
  }
}
function Sr(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch ($e().state) {
      case "hover":
        Ye({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function wr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || mo(e.currentTarget) && e.preventDefault();
}
function Pr(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = he(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = he((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function Yc(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((i) => i.element === t);
  if (!r || !r.onResize)
    return;
  const o = Qe({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, c = {
    asPercentage: he(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = c, r.onResize(c, r.id, s);
}
function Xc(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Qc({
  group: e,
  nextGroupSize: t,
  prevGroupSize: n,
  prevLayout: r
}) {
  if (n <= 0 || t <= 0 || n === t)
    return r;
  let o = 0, a = 0, s = !1;
  const c = /* @__PURE__ */ new Map(), i = [];
  for (const d of e.panels) {
    const f = r[d.id] ?? 0;
    switch (d.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const m = f / 100 * n, g = he(
          m / t * 100
        );
        c.set(d.id, g), o += g;
        break;
      }
      case "preserve-relative-size":
      default: {
        i.push(d.id), a += f;
        break;
      }
    }
  }
  if (!s || i.length === 0)
    return r;
  const l = 100 - o, u = { ...r };
  if (c.forEach((d, f) => {
    u[f] = d;
  }), a > 0)
    for (const d of i) {
      const f = r[d] ?? 0;
      u[d] = he(
        f / a * l
      );
    }
  else {
    const d = he(
      l / i.length
    );
    for (const f of i)
      u[f] = d;
  }
  return u;
}
function el(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Je = /* @__PURE__ */ new Map();
function tl(e) {
  let t = !0;
  ee(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    for (const f of g) {
      const { borderBoxSize: v, target: y } = f;
      if (y === e.element) {
        if (t) {
          const S = Xe({ group: e });
          if (S === 0)
========
    for (const h of g) {
      const { borderBoxSize: p, target: v } = h;
      if (v === e.element) {
        if (t) {
          const P = Qe({ group: e });
          if (P === 0)
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
            return;
          const w = _e(e.id);
          if (!w)
            return;
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
          const p = on(e), w = P.defaultLayoutDeferred ? Pr(p) : P.layout, M = Gc({
            group: e,
            nextGroupSize: S,
            prevGroupSize: P.groupSize,
            prevLayout: w
          }), A = $e({
            layout: M,
            panelConstraints: p
          });
          if (!P.defaultLayoutDeferred && Fe(P.layout, A) && qc(
            P.derivedPanelConstraints,
            p
          ) && P.groupSize === S)
            return;
          ke(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: p,
            groupSize: S,
            layout: A,
            separatorToPanels: P.separatorToPanels
          });
        }
      } else
        Jc(e, y, v);
========
          const b = on(e), S = w.defaultLayoutDeferred ? Pr(b) : w.layout, E = Qc({
            group: e,
            nextGroupSize: P,
            prevGroupSize: w.groupSize,
            prevLayout: S
          }), N = Be({
            layout: E,
            panelConstraints: b
          });
          if (!w.defaultLayoutDeferred && je(w.layout, N) && Xc(
            w.derivedPanelConstraints,
            b
          ) && w.groupSize === P)
            return;
          ke(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: b,
            groupSize: P,
            layout: N,
            separatorToPanels: w.separatorToPanels
          });
        }
      } else
        Yc(e, v, p);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    ee(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = Qe({ group: e }), c = on(e), i = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (el(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[i] ?? l ?? Pr(c), d = Be({
    layout: u,
    panelConstraints: c
  }), f = e.element.ownerDocument;
  Je.set(
    f,
    (Je.get(f) ?? 0) + 1
  );
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  const h = /* @__PURE__ */ new Map();
  return ao(e).forEach((g) => {
    g.separator && h.set(g.separator, g.panels);
========
  const m = /* @__PURE__ */ new Map();
  return oo(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  }), ke(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: c,
    groupSize: s,
    layout: d,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    ee(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", gr);
  }), Je.get(f) === 1 && (f.addEventListener("contextmenu", dr, !0), f.addEventListener("dblclick", pr, !0), f.addEventListener("pointerdown", br, !0), f.addEventListener("pointerleave", yr), f.addEventListener("pointermove", vr), f.addEventListener("pointerout", Sr), f.addEventListener("pointerup", wr, !0)), function() {
    t = !1, Je.set(
      f,
      Math.max(0, (Je.get(f) ?? 0) - 1)
    ), Bc(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", gr);
    }), Je.get(f) || (f.removeEventListener(
      "contextmenu",
      dr,
      !0
    ), f.removeEventListener(
      "dblclick",
      pr,
      !0
    ), f.removeEventListener(
      "pointerdown",
      br,
      !0
    ), f.removeEventListener("pointerleave", yr), f.removeEventListener("pointermove", vr), f.removeEventListener("pointerout", Sr), f.removeEventListener("pointerup", wr, !0)), a.disconnect();
  };
}
function nl() {
  const [e, t] = _({}), n = $(() => t({}), []);
  return [e, n];
}
function En(e) {
  const t = kr();
  return `${e ?? t}`;
}
const He = typeof window < "u" ? Ce : j;
function ut(e) {
  const t = M(e);
  return He(() => {
    t.current = e;
  }, [e]), $(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function kn(...e) {
  return ut((t) => {
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
function Mn(e) {
  const t = M({ ...e });
  return He(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
const yo = dn(null);
function Xc(e, t) {
  const n = k({
========
const bo = dn(null);
function rl(e, t) {
  const n = M({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    getLayout: () => ({}),
    setLayout: $c
  });
  mn(t, () => n.current, []), He(() => {
    Object.assign(
      n.current,
      go({ groupId: e })
    );
  });
}
function vo({
  children: e,
  className: t,
  defaultLayout: n,
  disableCursor: r,
  disabled: o,
  elementRef: a,
  groupRef: s,
  id: c,
  onLayoutChange: i,
  onLayoutChanged: l,
  orientation: u = "horizontal",
  resizeTargetMinimumSize: d = {
    coarse: 20,
    fine: 10
  },
  style: f,
  ...m
}) {
  const g = M({
    onLayoutChange: {},
    onLayoutChanged: {}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  }), f = ut((R) => {
    Fe(g.current.onLayoutChange, R) || (g.current.onLayoutChange = R, i == null || i(R));
  }), v = ut(
========
  }), h = ut((R) => {
    je(g.current.onLayoutChange, R) || (g.current.onLayoutChange = R, i == null || i(R));
  }), p = ut(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    (R, I) => {
      je(g.current.onLayoutChanged, R) || (g.current.onLayoutChanged = R, l == null || l(R, { isUserInteraction: I }));
    }
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  ), y = En(c), S = k(null), [P, p] = Yc(), w = k({
========
  ), v = En(c), P = M(null), [w, b] = nl(), S = M({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: d,
    separators: []
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  }), M = kn(S, a);
  Xc(y, s);
  const A = ut(
========
  }), E = kn(P, a);
  rl(v, s);
  const N = ut(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    (R, I) => {
      const T = $e(), k = ur(R), F = _e(R);
      if (F) {
        let H = !1;
        switch (T.state) {
          case "active": {
            H = T.hitRegions.some(
              (V) => V.group === k
            );
            break;
          }
        }
        return {
          flexGrow: F.layout[I] ?? 1,
          pointerEvents: H ? "none" : void 0
        };
      }
      if (n != null && n[I])
        return {
          flexGrow: n == null ? void 0 : n[I]
        };
    }
  ), x = Mn({
    defaultLayout: n,
    disableCursor: r
  }), z = Q(
    () => ({
      get disableCursor() {
        return !!x.disableCursor;
      },
      getPanelStyles: N,
      id: v,
      orientation: u,
      registerPanel: (R) => {
        const I = w.current;
        return I.panels = an(u, [
          ...I.panels,
          R
        ]), b(), () => {
          I.panels = I.panels.filter(
            (T) => T !== R
          ), b();
        };
      },
      registerSeparator: (R) => {
        const I = w.current;
        return I.separators = an(u, [
          ...I.separators,
          R
        ]), b(), () => {
          I.separators = I.separators.filter(
            (T) => T !== R
          ), b();
        };
      },
      updatePanelProps: (R, { disabled: I }) => {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        const T = w.current.panels.find(
          (U) => U.id === R
========
        const T = S.current.panels.find(
          (H) => H.id === R
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        );
        T && (T.panelConstraints.disabled = I);
        const k = ur(v), F = _e(v);
        k && F && ke(k, {
          ...F,
          derivedPanelConstraints: on(k)
        });
      },
      updateSeparatorProps: (R, {
        disabled: I,
        disableDoubleClick: T
      }) => {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        const E = w.current.separators.find(
          (x) => x.id === R
========
        const k = S.current.separators.find(
          (F) => F.id === R
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        );
        k && (k.disabled = I, k.disableDoubleClick = T);
      }
    }),
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    [A, y, p, u, F]
  ), D = k(null);
  return Ue(() => {
    const R = S.current;
========
    [N, v, b, u, x]
  ), D = M(null);
  return He(() => {
    const R = P.current;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    if (R === null)
      return;
    const I = w.current;
    let T;
    if (x.defaultLayout !== void 0 && Object.keys(x.defaultLayout).length === I.panels.length) {
      T = {};
      for (const L of I.panels) {
        const te = x.defaultLayout[L.id];
        te !== void 0 && (T[L.id] = te);
      }
    }
    const k = {
      disabled: !!o,
      element: R,
      id: v,
      mutableState: {
        defaultLayout: T,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        disableCursor: !!F.disableCursor,
        expandedPanelSizes: w.current.lastExpandedPanelSizes,
        layouts: w.current.layouts
========
        disableCursor: !!x.disableCursor,
        expandedPanelSizes: S.current.lastExpandedPanelSizes,
        layouts: S.current.layouts
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      },
      orientation: u,
      panels: I.panels,
      resizeTargetMinimumSize: I.resizeTargetMinimumSize,
      separators: I.separators
    };
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    D.current = E;
    const x = Zc(E), { defaultLayoutDeferred: U, derivedPanelConstraints: K, layout: Y } = Ne(E.id, !0);
    !U && K.length > 0 && (f(Y), v(Y, !1));
    const N = In(y, (B) => {
      const { defaultLayoutDeferred: C, derivedPanelConstraints: V, layout: Q } = B.next;
      if (C || V.length === 0)
========
    D.current = k;
    const F = tl(k), { defaultLayoutDeferred: H, derivedPanelConstraints: V, layout: X } = _e(k.id, !0);
    !H && V.length > 0 && (h(X), p(X, !1));
    const B = In(v, (L) => {
      const { defaultLayoutDeferred: te, derivedPanelConstraints: oe, layout: A } = L.next;
      if (te || oe.length === 0)
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        return;
      const Z = k.panels.map(({ id: W }) => W).join(",");
      k.mutableState.layouts[Z] = A, oe.forEach((W) => {
        if (W.collapsible) {
          const { layout: J } = L.prev ?? {};
          if (J) {
            const ge = me(
              W.collapsedSize,
              A[W.panelId]
            ), de = me(
              W.collapsedSize,
              J[W.panelId]
            );
            ge && !de && (k.mutableState.expandedPanelSizes[W.panelId] = J[W.panelId]);
          }
        }
      });
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      const le = Oe().state !== "active";
      f(Q), le && v(Q, B.isUserInteraction);
========
      const ae = $e().state !== "active";
      h(A), ae && p(A, L.isUserInteraction);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    });
    return () => {
      D.current = null, F(), B();
    };
  }, [
    o,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    y,
    v,
    f,
========
    v,
    p,
    h,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    u,
    w,
    x
  ]), j(() => {
    const R = D.current;
    R && (R.mutableState.defaultLayout = n, R.mutableState.disableCursor = !!r);
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  }), /* @__PURE__ */ b(yo.Provider, { value: z, children: /* @__PURE__ */ b(
========
  }), /* @__PURE__ */ y(bo.Provider, { value: z, children: /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": v,
      id: v,
      ref: E,
      style: {
        height: "100%",
        width: "100%",
        overflow: "hidden",
        ...f,
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
vo.displayName = "Group";
function An() {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  const e = fn(yo);
  return te(
========
  const e = fn(bo);
  return ee(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function ol(e, t) {
  const { id: n } = An(), r = M({
    collapse: Jt,
    expand: Jt,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Jt
  });
  mn(t, () => r.current, []), He(() => {
    Object.assign(
      r.current,
      po({ groupId: n, panelId: e })
    );
  });
}
function sn({
  children: e,
  className: t,
  collapsedSize: n = "0%",
  collapsible: r = !1,
  defaultSize: o,
  disabled: a,
  elementRef: s,
  groupResizeBehavior: c = "preserve-relative-size",
  id: i,
  maxSize: l = "100%",
  minSize: u = "0%",
  onResize: d,
  panelRef: f,
  style: m,
  ...g
}) {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  const f = !!i, v = En(i), y = Mn({
    disabled: a
  }), S = k(null), P = kn(S, s), {
    getPanelStyles: p,
    id: w,
    orientation: M,
    registerPanel: A,
    updatePanelProps: F
========
  const h = !!i, p = En(i), v = Mn({
    disabled: a
  }), P = M(null), w = kn(P, s), {
    getPanelStyles: b,
    id: S,
    orientation: E,
    registerPanel: N,
    updatePanelProps: x
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  } = An(), z = d !== null, D = ut(
    (k, F, H) => {
      d == null || d(k, i, H);
    }
  );
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  Ue(() => {
    const E = S.current;
    if (E !== null) {
      const x = {
        element: E,
        id: v,
        idIsStable: f,
========
  He(() => {
    const k = P.current;
    if (k !== null) {
      const F = {
        element: k,
        id: p,
        idIsStable: h,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: z ? D : void 0,
        panelConstraints: {
          groupResizeBehavior: c,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: v.disabled,
          maxSize: l,
          minSize: u
        }
      };
      return N(F);
    }
  }, [
    c,
    n,
    r,
    o,
    z,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    v,
    f,
========
    p,
    h,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    l,
    u,
    D,
    N,
    v
  ]), j(() => {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    F(v, { disabled: a });
  }, [a, v, F]), Qc(v, m);
  const R = () => {
    const E = p(w, v);
    if (E)
      return JSON.stringify(E);
  }, I = Ct(
    (E) => In(w, E),
========
    x(p, { disabled: a });
  }, [a, p, x]), ol(p, f);
  const R = () => {
    const k = b(S, p);
    if (k)
      return JSON.stringify(k);
  }, I = gt(
    (k) => In(S, k),
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    R,
    R
  );
  let T;
  return I ? T = JSON.parse(I) : o !== void 0 ? T = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  } : T = { flexGrow: 1 }, /* @__PURE__ */ b(
========
  } : T = { flexGrow: 1 }, /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      "data-testid": v,
      id: v,
      ref: P,
========
      "data-testid": p,
      id: p,
      ref: w,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      style: {
        ...al,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...T
      },
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      children: /* @__PURE__ */ b(
========
      children: /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
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
            touchAction: E === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
sn.displayName = "Panel";
const al = {
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
function sl({
  layout: e,
  panelConstraints: t,
  panelId: n,
  panelIndex: r
}) {
  let o, a;
  const s = e[n], c = t.find(
    (i) => i.panelId === n
  );
  if (c) {
    const i = c.maxSize, l = c.collapsible ? c.collapsedSize : c.minSize, u = [r, r + 1];
    a = Be({
      layout: mt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = Be({
      layout: mt({
        delta: i - s,
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
function So({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...c
}) {
  const i = En(a), l = Mn({
    disabled: n,
    disableDoubleClick: r
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  }), [u, d] = _({}), [m, h] = _("inactive"), [g, f] = _(!1), v = k(null), y = kn(v, o), {
    disableCursor: S,
    id: P,
    orientation: p,
    registerSeparator: w,
    updateSeparatorProps: M
  } = An(), A = p === "horizontal" ? "vertical" : "horizontal";
  Ue(() => {
    const D = v.current;
========
  }), [u, d] = _({}), [f, m] = _("inactive"), [g, h] = _(!1), p = M(null), v = kn(p, o), {
    disableCursor: P,
    id: w,
    orientation: b,
    registerSeparator: S,
    updateSeparatorProps: E
  } = An(), N = b === "horizontal" ? "vertical" : "horizontal";
  He(() => {
    const D = p.current;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    if (D !== null) {
      const R = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: D,
        id: i
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      }, I = w(R), T = Lc(
        (x) => {
          h(
            x.next.state !== "inactive" && x.next.hitRegions.some(
              (U) => U.separator === R
            ) ? x.next.state : "inactive"
========
      }, I = S(R), T = Oc(
        (F) => {
          m(
            F.next.state !== "inactive" && F.next.hitRegions.some(
              (H) => H.separator === R
            ) ? F.next.state : "inactive"
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          );
        }
      ), k = In(
        w,
        (F) => {
          const { derivedPanelConstraints: H, layout: V, separatorToPanels: X } = F.next, B = X.get(R);
          if (B) {
            const L = B[0], te = B.indexOf(L);
            d(
              sl({
                layout: V,
                panelConstraints: H,
                panelId: L.id,
                panelIndex: te
              })
            );
          }
        }
      );
      return () => {
        T(), k(), I();
      };
    }
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  }, [P, i, w, l]), j(() => {
    M(i, { disabled: n, disableDoubleClick: r });
  }, [n, r, i, M]);
  let F;
  n && !S && (F = "not-allowed");
========
  }, [w, i, S, l]), j(() => {
    E(i, { disabled: n, disableDoubleClick: r });
  }, [n, r, i, E]);
  let x;
  n && !P && (x = "not-allowed");
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  let z;
  if (n)
    z = "disabled";
  else
    switch (f) {
      case "active": {
        z = "active";
        break;
      }
      default:
        g ? z = "focus" : z = f;
    }
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  return /* @__PURE__ */ b(
========
  return /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    "div",
    {
      ...c,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": N,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": z,
      "data-testid": i,
      id: i,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: v,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: x,
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
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
So.displayName = "Separator";
const Nn = 30, _n = 65, ht = 50, nl = 100 - _n, rl = 100 - Nn;
function ol(e) {
========
vo.displayName = "Separator";
const Nn = 30, _n = 65, ht = 50, il = 100 - _n, cl = 100 - Nn;
function ll(e) {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(_n, Math.max(Nn, t)) : ht;
}
function Ln(e) {
  return 100 - e;
}
function qe(e) {
  return `${e}%`;
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
const Cn = "reader-document", pt = "reader-assistant", wo = "retainpdf.reader.ai-split-layout.v1", al = {
========
const Cn = "reader-document", pt = "reader-assistant", So = "retainpdf.reader.ai-split-layout.v1", ul = {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  [Cn]: Ln(ht),
  [pt]: ht
};
function Dn(e) {
  const t = ll(e == null ? void 0 : e[pt]);
  return {
    [Cn]: Ln(t),
    [pt]: t
  };
}
function dl() {
  try {
    const e = JSON.parse(localStorage.getItem(wo) || "null");
    return Dn(e);
  } catch {
    return ul;
  }
}
function fl(e) {
  try {
    localStorage.setItem(wo, JSON.stringify(Dn(e)));
  } catch {
  }
}
function qt(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Dn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[pt]}vw`
  );
}
function ml() {
  const e = M(null), [t] = _(dl);
  Ce(() => {
    const o = e.current;
    return qt(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = $((o) => {
    qt(e.current, o);
  }, []), r = $((o, a) => {
    qt(e.current, o), a.isUserInteraction && fl(o);
  }, []);
  return /* @__PURE__ */ O(
    vo,
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
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        /* @__PURE__ */ b(
========
        /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          sn,
          {
            id: Cn,
            defaultSize: qe(Ln(ht)),
            minSize: qe(il),
            maxSize: qe(cl)
          }
        ),
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        /* @__PURE__ */ b(
          So,
========
        /* @__PURE__ */ y(
          vo,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
            children: /* @__PURE__ */ b("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ b(
========
            children: /* @__PURE__ */ y("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          sn,
          {
            id: pt,
            defaultSize: qe(ht),
            minSize: qe(Nn),
            maxSize: qe(_n)
          }
        )
      ]
    }
  );
}
function hl({
  regionsFailed: e = !1,
  metadataFailed: t = !1
}) {
  const [n, r] = _(!1);
  if (j(() => {
    !e && !t && r(!1);
  }, [e, t]), n || !e && !t)
    return null;
  const o = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ O("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ O("span", { className: "reader-error-notice-text", children: [
      o.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    /* @__PURE__ */ b(
========
    /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      "button",
      {
        type: "button",
        className: "reader-error-notice-dismiss",
        "aria-label": "关闭提示",
        onClick: () => r(!0),
        children: "×"
      }
    )
  ] });
}
function pl({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1
}) {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  return !e && !t ? /* @__PURE__ */ b(ll, { regionsFailed: o, metadataFailed: a }) : /* @__PURE__ */ O(Lt, { children: [
    e ? /* @__PURE__ */ b("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ O("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ b("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ b("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ b(
========
  return !e && !t ? /* @__PURE__ */ y(hl, { regionsFailed: o, metadataFailed: a }) : /* @__PURE__ */ O(Ct, { children: [
    e ? /* @__PURE__ */ y("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ O("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ y("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ y("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    t ? /* @__PURE__ */ b("div", { className: "reader-react-error", role: "alert", children: n }) : null
========
    t ? /* @__PURE__ */ y("div", { className: "reader-react-error", role: "alert", children: n }) : null
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  ] });
}
function gl(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function bl() {
  const [e, t] = _(!1), n = kr(), r = M(null);
  return j(() => {
    if (!e) return;
    const o = (s) => {
      const c = r.current;
      c && s.target instanceof Node && !c.contains(s.target) && t(!1);
    }, a = (s) => {
      s.key === "Escape" && (s.preventDefault(), t(!1));
    };
    return document.addEventListener("mousedown", o), window.addEventListener("keydown", a), () => {
      document.removeEventListener("mousedown", o), window.removeEventListener("keydown", a);
    };
  }, [e]), j(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || gl(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((c) => !c);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ O("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    /* @__PURE__ */ b(
========
    /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((o) => !o),
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        children: /* @__PURE__ */ b(Jo, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
========
        children: /* @__PURE__ */ y(Vo, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      }
    ),
    e ? /* @__PURE__ */ O(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ O("div", { className: "reader-react-shortcuts-head", children: [
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
            /* @__PURE__ */ b("strong", { children: "快捷键" }),
            /* @__PURE__ */ b(
========
            /* @__PURE__ */ y("strong", { children: "快捷键" }),
            /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
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
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
          /* @__PURE__ */ b("div", { className: "reader-react-shortcuts-body", children: li.map((o) => /* @__PURE__ */ O("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ b("h3", { children: o.title }),
            /* @__PURE__ */ b("ul", { children: o.items.map((a) => /* @__PURE__ */ O("li", { children: [
              /* @__PURE__ */ b("kbd", { children: a.keys }),
              /* @__PURE__ */ b("span", { children: a.desc })
            ] }, `${o.title}-${a.keys}`)) })
          ] }, o.title)) }),
          /* @__PURE__ */ b("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
========
          /* @__PURE__ */ y("div", { className: "reader-react-shortcuts-body", children: hi.map((o) => /* @__PURE__ */ O("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ y("h3", { children: o.title }),
            /* @__PURE__ */ y("ul", { children: o.items.map((a) => /* @__PURE__ */ O("li", { children: [
              /* @__PURE__ */ y("kbd", { children: a.keys }),
              /* @__PURE__ */ y("span", { children: a.desc })
            ] }, `${o.title}-${a.keys}`)) })
          ] }, o.title)) }),
          /* @__PURE__ */ y("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        ]
      }
    ) : null
  ] });
}
const yl = ["source", "sideBySide", "translated"], vl = { source: "", translated: "", sideBySide: "" };
function Sl(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = Tt(e.sourceUrl), n = Tt(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return ya({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function wl(e) {
  const [t, n] = _(() => /* @__PURE__ */ new Set()), r = Q(
    () => e ? Sl(e) : vl,
    [e]
  ), o = Q(
    () => yl.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = $(async (s) => {
    if (!e) return;
    const c = Tt(r[s]);
    if (!(!c || t.has(s)))
      try {
        const i = e.jobId ? ba(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await va(
          e.fetchProtected,
          c,
          i,
          i,
          null,
          (l) => n((u) => {
            const d = new Set(u);
            return l ? d.add(s) : d.delete(s), d;
          })
        );
      } catch (i) {
        const l = i instanceof Error ? i.message : "下载失败";
        Sa(l), n((u) => {
          const d = new Set(u);
          return d.delete(s), d;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Pl = {
  source: Ar,
  sideBySide: Nr,
  translated: _r
}, Rl = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Il(e) {
  const t = Le(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = wl(n), c = M(null);
  return j(() => {
    const i = () => {
      var d;
      (d = c.current) != null && d.open && (c.current.open = !1);
    }, l = (d) => {
      c.current && !c.current.contains(d.target) && i();
    }, u = (d) => {
      d.key === "Escape" && i();
    };
    return document.addEventListener("pointerdown", l), document.addEventListener("keydown", u), () => {
      document.removeEventListener("pointerdown", l), document.removeEventListener("keydown", u);
    };
  }, []), /* @__PURE__ */ O("details", { ref: c, className: "reader-download-actions", children: [
    /* @__PURE__ */ O("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      /* @__PURE__ */ b(qo, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ b("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ b(Go, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ b("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((i) => {
      const l = Mo[i], u = It(r[i]), d = a.has(i), m = !!u && !d, h = m ? "" : Ao(i, r), g = bl[i];
========
      /* @__PURE__ */ y(Jo, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ y("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ y(qo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ y("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((i) => {
      const l = ko[i], u = Tt(r[i]), d = a.has(i), f = !!u && !d, m = f ? "" : Mo(i, r), g = Pl[i];
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      return /* @__PURE__ */ O(
        "button",
        {
          type: "button",
          id: `reader-download-${i}`,
          className: `reader-download-action${d ? " is-busy" : ""}`,
          disabled: !f,
          "aria-label": f ? `下载${l.label}` : m,
          onClick: () => {
            c.current && (c.current.open = !1), s(i);
          },
          children: [
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
            /* @__PURE__ */ b(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
========
            /* @__PURE__ */ y(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
            /* @__PURE__ */ O("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ O("span", { className: "reader-download-action-label", children: [
                Rl[i],
                " PDF"
              ] }),
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
              h ? /* @__PURE__ */ b("span", { className: "reader-download-action-reason", children: h }) : null
========
              m ? /* @__PURE__ */ y("span", { className: "reader-download-action-reason", children: m }) : null
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
            ] })
          ]
        },
        i
      );
    }) })
  ] });
}
const Tl = "retainpdf:reader:bookmarks:v1:", El = 200;
function zn() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Po(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Tl}${t}` : "";
}
function kl(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
function _t(e, t = zn()) {
  const n = Po(e);
========
function Lt(e, t = zn()) {
  const n = wo(e);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = kl(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function cn(e, t, n) {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  const r = Po(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, wl);
========
  const r = wo(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, El);
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Ml(e, t, n = "", { storage: r = zn(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Lt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((c) => c.page === s) ? cn(e, a.filter((c) => c.page !== s), r) : cn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Al(e, t, n = zn()) {
  return cn(e, Lt(e, n).filter((r) => r.page !== t), n);
}
function Nl(e, t) {
  var r, o, a, s;
  let n = null;
  for (const c of e || []) {
    if (`${(c == null ? void 0 : c.regionType) || ""}` != "heading") continue;
    const i = Number(((r = c.source) == null ? void 0 : r.page) ?? ((o = c.translated) == null ? void 0 : o.page));
    if (!Number.isFinite(i) || i > t) continue;
    const l = `${((a = c.translated) == null ? void 0 : a.text) || c.markdown || ((s = c.source) == null ? void 0 : s.text) || ""}`.replace(/\s+/g, " ").trim();
    if (!l) continue;
    const u = Number(c.readingOrder) || 0;
    (!n || i > n.page || i === n.page && u >= n.order) && (n = { page: i, order: u, text: l });
  }
  return n ? n.text.slice(0, 60) : "";
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
function El({ filled: e }) {
  return /* @__PURE__ */ b("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ b("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
========
function _l({ filled: e }) {
  return /* @__PURE__ */ y("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ y("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
}
function Ll({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = _(() => Lt(e)), [c, i] = _(!1), l = M(null);
  if (j(() => {
    s(Lt(e)), i(!1);
  }, [e]), j(() => {
    if (!c) return;
    const f = (g) => {
      l.current && !l.current.contains(g.target) && i(!1);
    }, m = (g) => {
      g.key === "Escape" && i(!1);
    };
    return document.addEventListener("pointerdown", f), document.addEventListener("keydown", m), () => {
      document.removeEventListener("pointerdown", f), document.removeEventListener("keydown", m);
    };
  }, [c]), !e || n <= 0) return null;
  const u = Math.min(Math.max(t, 1), n), d = a.some((f) => f.page === u);
  return /* @__PURE__ */ O("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    /* @__PURE__ */ b(
========
    /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${d ? " is-marked" : ""}`,
        "aria-pressed": d,
        "aria-label": d ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: d ? "取消这一页的书签" : "给这一页加书签",
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        onClick: () => s(Rl(e, u, Tl(r, u))),
        children: /* @__PURE__ */ b(El, { filled: d })
      }
    ),
    /* @__PURE__ */ b(
========
        onClick: () => s(Ml(e, u, Nl(r, u))),
        children: /* @__PURE__ */ y(_l, { filled: d })
      }
    ),
    /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      "button",
      {
        type: "button",
        className: "reader-react-hud-btn reader-bookmark-list-btn",
        "aria-expanded": c,
        "aria-haspopup": "true",
        "aria-label": `书签列表，共 ${a.length} 个`,
        title: "书签列表",
        disabled: !a.length,
        onClick: () => i((f) => !f),
        children: a.length
      }
    ),
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    c && a.length ? /* @__PURE__ */ b("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ b("ol", { className: "reader-bookmark-list", children: a.map((m) => /* @__PURE__ */ O("li", { className: m.page === u ? "is-current" : "", children: [
========
    c && a.length ? /* @__PURE__ */ y("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ y("ol", { className: "reader-bookmark-list", children: a.map((f) => /* @__PURE__ */ O("li", { className: f.page === u ? "is-current" : "", children: [
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      /* @__PURE__ */ O(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(f.page, n)), i(!1);
          },
          children: [
            /* @__PURE__ */ O("span", { className: "reader-bookmark-page", children: [
              "第 ",
              f.page,
              " 页"
            ] }),
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
            m.label ? /* @__PURE__ */ b("span", { className: "reader-bookmark-label", children: m.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ b(
========
            f.label ? /* @__PURE__ */ y("span", { className: "reader-bookmark-label", children: f.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${f.page} 页的书签`,
          onClick: () => s(Al(e, f.page)),
          children: "×"
        }
      )
    ] }, f.page)) }) }) : null
  ] });
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
function Ml(e) {
  const t = je(), n = to(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? gt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), c = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, i = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = us(a), d = a > zr + 1e-3, m = a < Mt - 1e-3, h = qe(r, ze()), g = h >= Mt ? "100%（铺满阅读区）" : "50%（半屏，对照铺满）", [f, v] = _(!1), [y, S] = _(`${c}`);
  j(() => {
    f || S(`${Math.min(Math.max(c, 1), Math.max(i, 1))}`);
  }, [c, i, f]);
  const P = () => {
    if (v(!1), !l || i <= 0)
========
function Cl(e) {
  const t = Le(), n = eo(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? bt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), c = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, i = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = us(a), d = a > zr + 1e-3, f = a < At - 1e-3, m = Ge(r, Oe()), g = m >= At ? "100%（铺满阅读区）" : "50%（半屏，对照铺满）", [h, p] = _(!1), [v, P] = _(`${c}`);
  j(() => {
    h || P(`${Math.min(Math.max(c, 1), Math.max(i, 1))}`);
  }, [c, i, h]);
  const w = () => {
    if (p(!1), !l || i <= 0)
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      return;
    const b = Number(`${v}`.trim());
    l(Nt(b, i));
  };
  return /* @__PURE__ */ O("div", { className: "reader-react-hud", "data-reader-hud": "true", children: [
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    o ? /* @__PURE__ */ b("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ b("div", { className: "reader-react-hud-group", "aria-label": "页码", children: f ? /* @__PURE__ */ O(
========
    o ? /* @__PURE__ */ y("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ y("div", { className: "reader-react-hud-group", "aria-label": "页码", children: h ? /* @__PURE__ */ O(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (b) => {
          b.preventDefault(), w();
        },
        children: [
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
          /* @__PURE__ */ b(
========
          /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
            "input",
            {
              className: "reader-react-hud-page-input",
              type: "text",
              inputMode: "numeric",
              pattern: "[0-9]*",
              "aria-label": "跳转到页码",
              value: v,
              autoFocus: !0,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
              onChange: (p) => S(p.target.value.replace(/[^\d]/g, "")),
              onBlur: P,
              onKeyDown: (p) => {
                p.key === "Escape" && (p.preventDefault(), v(!1), S(`${c}`));
========
              onChange: (b) => P(b.target.value.replace(/[^\d]/g, "")),
              onBlur: w,
              onKeyDown: (b) => {
                b.key === "Escape" && (b.preventDefault(), p(!1), P(`${c}`));
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
              }
            }
          ),
          /* @__PURE__ */ O("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            i || "—"
          ] })
        ]
      }
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    ) : /* @__PURE__ */ b(
========
    ) : /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      "button",
      {
        type: "button",
        className: "reader-react-hud-page reader-react-hud-page-btn",
        "aria-label": i > 0 ? `跳转页码，当前第 ${c} 页，共 ${i} 页` : "页码",
        title: i > 0 ? "点击输入页码跳转" : void 0,
        disabled: !l || i <= 0,
        onClick: () => {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
          !l || i <= 0 || (S(`${c}`), v(!0));
========
          !l || i <= 0 || (P(`${c}`), p(!0));
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        },
        children: i > 0 ? `${Math.min(c, i)} / ${i}` : "—"
      }
    ) }),
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    e.bookmarkScope ? /* @__PURE__ */ b(
      kl,
========
    e.bookmarkScope ? /* @__PURE__ */ y(
      Ll,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      {
        scope: e.bookmarkScope,
        currentPage: c,
        numPages: i,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    /* @__PURE__ */ O("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      /* @__PURE__ */ b(
========
      /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !d,
          onClick: () => s(ft(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ O(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `重置为${g}`,
          title: g,
          onClick: () => s(m),
          children: [
            u,
            "%"
          ]
        }
      ),
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      /* @__PURE__ */ b(
========
      /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "放大",
          disabled: !f,
          onClick: () => s(ft(a, 1)),
          children: "+"
        }
      )
    ] }),
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    /* @__PURE__ */ b("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ b(fl, {}) })
========
    /* @__PURE__ */ y("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ y(bl, {}) })
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  ] });
}
function Rr(e) {
  var t, n;
  return $r(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Dl(e) {
  const [t, n] = _(() => ({
    scope: e,
    panel: Rr(we(e))
  }));
  j(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Rr(we(e))
    });
  }, [e]), j(() => {
    t.scope === e && xt(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = $((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const ln = "download-toast";
function zl({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ O("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ O("div", { className: "download-toast-head", children: [
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      /* @__PURE__ */ b("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ b("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ b("div", { className: "download-toast-track", children: /* @__PURE__ */ b("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ b("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
========
      /* @__PURE__ */ y("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ y("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ y("div", { className: "download-toast-track", children: /* @__PURE__ */ y("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ y("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  ] });
}
function xl(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Kt.dismiss(ln);
    return;
  }
  Kt.custom(
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    () => /* @__PURE__ */ b(Nl, { title: n, status: r, meta: o, percent: a, tone: s }),
========
    () => /* @__PURE__ */ y(zl, { title: n, status: r, meta: o, percent: a, tone: s }),
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    { id: ln, duration: 1 / 0 }
  );
}
function Ol() {
  const e = $((t) => {
    t && (t.setState = xl, t.hide = () => Kt.dismiss(ln));
  }, []);
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  return /* @__PURE__ */ O(Lt, { children: [
    /* @__PURE__ */ b(Bo, { position: "bottom-right" }),
    /* @__PURE__ */ b("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
========
  return /* @__PURE__ */ O(Ct, { children: [
    /* @__PURE__ */ y(jo, { position: "bottom-right" }),
    /* @__PURE__ */ y("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  ] });
}
function Fl(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : xr(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function $l(e, t) {
  return t === null || e !== t;
}
function jl(e) {
  const t = M(!1);
  return e && (t.current = !0), t.current;
}
function Bl(e, t) {
  const n = e === t;
  return { open: n, mounted: jl(n) };
}
const Ir = { itemId: null, origin: null };
function Ul() {
  let e = Ir;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Ir : { itemId: n, origin: r };
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
const xe = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Hl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Wl = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Vl = {
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
}, Tr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Jl(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Tr(o ?? a ?? "", Hl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Tr(o ?? a ?? "", Wl)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Vl[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function ql(e) {
  return xe(e.translatedBlockText) || xe(e.translated.text) || xe(e.source.text);
}
const Gl = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Kl(e) {
  const t = [];
  for (const n of e) {
    if (!Gl(n)) continue;
    const r = Jl(ql(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Zl(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Yl = 24, Xl = 60;
function Er(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Yl), o = Math.min(e.length, n + t.length + Xl), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Ql(e, t, n = 200) {
  const r = xe(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const c = xe(a.translatedBlockText) || xe(a.translated.text), i = c ? Er(c, r) : null, l = i ?? Er(xe(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: i ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
const eu = [];
function tu({ open: e, onToggle: t }) {
  return /* @__PURE__ */ O("div", { className: "reader-finder-toggles", children: [
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    /* @__PURE__ */ O(Ce, { className: "reader-finder-toggle", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: [
      /* @__PURE__ */ b(Ko, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ b("span", { children: "目录" })
    ] }),
    /* @__PURE__ */ O(Ce, { className: "reader-finder-toggle", "aria-pressed": e === "search", title: "在书里搜索（原文和译文）", onClick: () => t("search"), children: [
      /* @__PURE__ */ b(Zo, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ b("span", { children: "搜索" })
========
    /* @__PURE__ */ O(ze, { className: "reader-finder-toggle", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: [
      /* @__PURE__ */ y(Go, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ y("span", { children: "目录" })
    ] }),
    /* @__PURE__ */ O(ze, { className: "reader-finder-toggle", "aria-pressed": e === "search", title: "在书里搜索（原文和译文）", onClick: () => t("search"), children: [
      /* @__PURE__ */ y(Ko, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ y("span", { children: "搜索" })
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    ] })
  ] });
}
function nu({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r
}) {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  var h, g;
  const o = ((h = je()) == null ? void 0 : h.regions) ?? Kl, a = ((g = to()) == null ? void 0 : g.currentPage) ?? 1, s = X(() => Wl(o), [o]), c = Vl(s, a), [i, l] = _(""), u = X(() => Gl(o, i), [o, i]), d = k(null), m = k(null);
  return j(() => {
    var f, v, y;
    e === "search" ? (f = d.current) == null || f.focus() : (y = (v = m.current) == null ? void 0 : v.querySelector('[aria-current="location"]')) == null || y.scrollIntoView({ block: "center" });
  }, [e]), /* @__PURE__ */ O("aside", { className: "reader-finder", "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ O("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ O("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ b(Ce, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ b(Ce, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ b(Ce, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ b(gn, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? s.length ? /* @__PURE__ */ b("ol", { ref: m, className: "reader-finder-list", children: s.map((f, v) => /* @__PURE__ */ b("li", { children: /* @__PURE__ */ O(
      Ce,
      {
        className: "reader-finder-entry",
        "data-level": f.level,
        "aria-current": v === c ? "location" : void 0,
        onClick: () => r(f.itemId),
        children: [
          /* @__PURE__ */ b("span", { className: "reader-finder-entry-text", children: f.text }),
          /* @__PURE__ */ b("span", { className: "reader-finder-entry-page", children: f.page })
        ]
      }
    ) }, f.itemId)) }) : /* @__PURE__ */ b("p", { className: "reader-finder-empty", children: o.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ O(Lt, { children: [
      /* @__PURE__ */ O("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ b(
          Yo,
========
  var m, g;
  const o = ((m = Le()) == null ? void 0 : m.regions) ?? eu, a = ((g = eo()) == null ? void 0 : g.currentPage) ?? 1, s = Q(() => Kl(o), [o]), c = Zl(s, a), [i, l] = _(""), u = Q(() => Ql(o, i), [o, i]), d = M(null), f = M(null);
  return j(() => {
    var h, p, v;
    e === "search" ? (h = d.current) == null || h.focus() : (v = (p = f.current) == null ? void 0 : p.querySelector('[aria-current="location"]')) == null || v.scrollIntoView({ block: "center" });
  }, [e]), /* @__PURE__ */ O("aside", { className: "reader-finder", "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ O("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ O("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ y(ze, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ y(ze, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ y(ze, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ y(gn, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? s.length ? /* @__PURE__ */ y("ol", { ref: f, className: "reader-finder-list", children: s.map((h, p) => /* @__PURE__ */ y("li", { children: /* @__PURE__ */ O(
      ze,
      {
        className: "reader-finder-entry",
        "data-level": h.level,
        "aria-current": p === c ? "location" : void 0,
        onClick: () => r(h.itemId),
        children: [
          /* @__PURE__ */ y("span", { className: "reader-finder-entry-text", children: h.text }),
          /* @__PURE__ */ y("span", { className: "reader-finder-entry-page", children: h.page })
        ]
      }
    ) }, h.itemId)) }) : /* @__PURE__ */ y("p", { className: "reader-finder-empty", children: o.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ O(Ct, { children: [
      /* @__PURE__ */ O("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ y(
          Zo,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          {
            ref: d,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: i,
            onChange: (h) => l(h.target.value),
            onKeyDown: (h) => {
              h.key === "Enter" && u[0] && r(u[0].itemId), h.stopPropagation();
            }
          }
        ),
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        i.trim() ? /* @__PURE__ */ b("p", { className: "reader-finder-count", children: u.length >= 200 ? "200 处以上，只列前 200 处" : `${u.length} 处` }) : null
      ] }),
      /* @__PURE__ */ b("ol", { className: "reader-finder-list", children: u.map((f) => /* @__PURE__ */ b("li", { children: /* @__PURE__ */ O(Ce, { className: "reader-finder-entry is-hit", onClick: () => r(f.itemId), children: [
        /* @__PURE__ */ O("span", { className: "reader-finder-entry-text", children: [
          f.snippet.slice(0, f.at),
          /* @__PURE__ */ b("mark", { children: f.snippet.slice(f.at, f.at + f.length) }),
          f.snippet.slice(f.at + f.length)
        ] }),
        /* @__PURE__ */ b("span", { className: "reader-finder-entry-page", children: f.page })
      ] }) }, f.itemId)) })
    ] })
  ] });
}
const Xl = To(() => import("./ReaderMarkdownPanel-DSs4j201.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function Ql(e) {
========
        i.trim() ? /* @__PURE__ */ y("p", { className: "reader-finder-count", children: u.length >= 200 ? "200 处以上，只列前 200 处" : `${u.length} 处` }) : null
      ] }),
      /* @__PURE__ */ y("ol", { className: "reader-finder-list", children: u.map((h) => /* @__PURE__ */ y("li", { children: /* @__PURE__ */ O(ze, { className: "reader-finder-entry is-hit", onClick: () => r(h.itemId), children: [
        /* @__PURE__ */ O("span", { className: "reader-finder-entry-text", children: [
          h.snippet.slice(0, h.at),
          /* @__PURE__ */ y("mark", { children: h.snippet.slice(h.at, h.at + h.length) }),
          h.snippet.slice(h.at + h.length)
        ] }),
        /* @__PURE__ */ y("span", { className: "reader-finder-entry-page", children: h.page })
      ] }) }, h.itemId)) })
    ] })
  ] });
}
const ru = Io(() => import("./ReaderMarkdownPanel-ML80Qkj4.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function ou(e) {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  const t = e.sourceOnly || !e.translatedUrl, n = !!(e.overlayContentAvailable && e.liveTranslationVisible && !e.assistantOpen), o = e.assistantPdfPane || (e.assistantOpen && e.mode === "compare" ? "source" : e.mode), a = !t && (o === "translated" || o === "compare");
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
function au(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
function tu() {
  const e = ii(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Al(e.viewStateKey), s = a.panel, c = a.setPanel, [i, l] = _(null), [u, d] = _(!1), m = k(null), h = k(null), g = s !== null, f = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, v = Ql({
========
function su() {
  const e = fi(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Dl(e.viewStateKey), s = a.panel, c = a.setPanel, [i, l] = _(null), [u, d] = _(!1), f = M(null), m = M(null), g = s !== null, h = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, p = ou({
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: h,
    liveTranslationVisible: u,
    assistantOpen: g,
    assistantPdfPane: i
  }), v = Qs({
    hasOverlayContent: h,
    connection: e.liveTranslation.connection,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    showSource: v.showSource,
    liveTranslationVisible: u,
    assistantOpen: g
  }), S = v.sourceViewOnly, P = v.visibleMode;
========
    showSource: p.showSource,
    liveTranslationVisible: u,
    assistantOpen: g
  }), P = p.sourceViewOnly, w = p.visibleMode;
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
  j(() => {
    d(!1);
  }, [e.viewStateKey]), j(() => {
    e.session.jobTerminal && d(!1);
  }, [e.session.jobTerminal]), j(() => {
    l(null);
  }, [a.scope]), j(() => {
    if (!(t.loading || t.failed)) {
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      if (m.current !== e.viewStateKey) {
        m.current = e.viewStateKey;
        const N = we(e.viewStateKey), B = Cl({
          savedMode: N == null ? void 0 : N.mode,
          sourceViewOnly: S,
          viewportWidth: ze()
========
      if (f.current !== e.viewStateKey) {
        f.current = e.viewStateKey;
        const B = we(e.viewStateKey), L = Fl({
          savedMode: B == null ? void 0 : B.mode,
          sourceViewOnly: P,
          viewportWidth: Oe()
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
        });
        m.current = L.auto ? L.mode : null, L.mode && L.mode !== e.mode && e.setModeKeepingPage(L.mode);
        return;
      }
      $l(e.mode, m.current) && (m.current = null, xt(e.viewStateKey, { mode: e.mode }));
    }
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, S]);
  const p = s || (e.mode === "compare" ? "compare" : "reading"), w = xl(s, "markdown");
  hi({
    mode: P,
========
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, P]);
  const b = s || (e.mode === "compare" ? "compare" : "reading"), S = Bl(s, "markdown");
  vi({
    mode: w,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const E = $(() => {
    c(null), l(null);
  }, []), N = $((B) => {
    l(null);
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    const B = eu(N, e.liveTranslationAvailable);
    B !== null && d(B), e.setModeKeepingPage(N);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), F = X(() => y.sourcePaneToggle ? /* @__PURE__ */ b(
========
    const L = au(B, e.liveTranslationAvailable);
    L !== null && d(L), e.setModeKeepingPage(B);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), x = Q(() => v.sourcePaneToggle ? /* @__PURE__ */ y(
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${u ? " is-active" : ""}`,
      onClick: () => d((B) => !B),
      "aria-pressed": u,
      title: u ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [v.sourcePaneToggle, u]), z = $((B) => {
    c(B), l(null);
  }, []), [D] = _(Ul), [R, I] = _(null), T = $((B) => I((L) => L === B ? null : B), []), k = $((B) => {
    e.jumpToAnchor({ block_id: B }), Oe() < 900 && I(null);
  }, [e.jumpToAnchor]), F = $((B) => e.jumpToAnchor({ block_id: B }), [e.jumpToAnchor]), H = Q(() => ({
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
    regionHover: D,
    jumpToBlock: F,
    revisedBlocks: e.revisedBlocks,
    sourceOnly: e.sourceOnly,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    sourceViewOnly: S,
========
    sourceViewOnly: P,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: z, close: E }
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
    D,
    F,
    e.revisedBlocks,
    e.sourceOnly,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    S,
========
    P,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
    e.download,
    e.goToPage,
    z,
    E
  ]), V = Q(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
  }), [e.currentPage, n.hudNumPages]), Y = [
    ts,
    `is-workspace-${p}`,
    g ? "is-assistant-open" : "",
    R ? "is-finder-open" : "",
    v.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ b(Ki, { value: U, hud: K, children: /* @__PURE__ */ O("div", { className: Y, "data-reader-engine": "react-pdf", "data-reader-workspace": p, children: [
    /* @__PURE__ */ b(ul, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata }),
    /* @__PURE__ */ b(Zl, { open: R, onToggle: T }),
    R ? /* @__PURE__ */ b(
      Yl,
========
  }), [e.currentPage, n.hudNumPages]), X = [
    ts,
    `is-workspace-${b}`,
    g ? "is-assistant-open" : "",
    R ? "is-finder-open" : "",
    p.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ y(ec, { value: H, hud: V, children: /* @__PURE__ */ O("div", { className: X, "data-reader-engine": "react-pdf", "data-reader-workspace": b, children: [
    /* @__PURE__ */ y(pl, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata }),
    /* @__PURE__ */ y(tu, { open: R, onToggle: T }),
    R ? /* @__PURE__ */ y(
      nu,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      {
        tab: R,
        onTab: I,
        onClose: () => I(null),
        onJump: k
      }
    ) : null,
    /* @__PURE__ */ O("div", { className: "reader-chrome-tray", children: [
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
      /* @__PURE__ */ b(Ti, {}),
      /* @__PURE__ */ b(vl, {}),
      /* @__PURE__ */ b(wi, { onBeforeClose: o.prepareClose })
    ] }),
    /* @__PURE__ */ b(
      pc,
========
      /* @__PURE__ */ y(Ni, {}),
      /* @__PURE__ */ y(Il, {}),
      /* @__PURE__ */ y(Ei, { onBeforeClose: o.prepareClose })
    ] }),
    /* @__PURE__ */ y(
      Sc,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      {
        mode: w,
        documentReady: !!o.jobId,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
        sourceViewOnly: S,
        onModeChange: A,
        liveTranslation: y.topBarPill ? {
========
        sourceViewOnly: P,
        onModeChange: N,
        liveTranslation: v.topBarPill ? {
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
          visible: u,
          state: e.liveTranslation,
          onToggle: () => d((B) => !B)
        } : null
      }
    ),
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    /* @__PURE__ */ b(Pc, { active: s }),
    g ? /* @__PURE__ */ b(cl, {}) : null,
    /* @__PURE__ */ b(dc, { paneComposition: v, markdownSplit: w.open, assistantSplit: g, liveTranslation: e.liveTranslation, sourcePaneAction: F }),
    e.showHud ? /* @__PURE__ */ b(
      Ml,
========
    /* @__PURE__ */ y(kc, { active: s }),
    g ? /* @__PURE__ */ y(ml, {}) : null,
    /* @__PURE__ */ y(gc, { paneComposition: p, markdownSplit: S.open, assistantSplit: g, liveTranslation: e.liveTranslation, sourcePaneAction: x }),
    e.showHud ? /* @__PURE__ */ y(
      Cl,
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
      {
        mode: w,
        modeControls: null,
        bookmarkScope: e.viewStateKey
      }
    ) : null,
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
    /* @__PURE__ */ b(Io, { fallback: null, children: w.mounted ? /* @__PURE__ */ b(Xl, { open: w.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: M }) : null }),
    /* @__PURE__ */ b(Ll, {})
  ] }) });
}
function Su() {
  return /* @__PURE__ */ b(tu, {});
========
    /* @__PURE__ */ y(Ro, { fallback: null, children: S.mounted ? /* @__PURE__ */ y(ru, { open: S.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: E }) : null }),
    /* @__PURE__ */ y(Ol, {})
  ] }) });
}
function Tu() {
  return /* @__PURE__ */ y(su, {});
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
}
export {
  Tu as R,
  su as a,
  Ru as d,
  Pu as f,
  Iu as r,
  Le as u
};
<<<<<<<< HEAD:frontend/packages/reader/dist/ReaderApp-ChPA5zGl.js
//# sourceMappingURL=ReaderApp-ChPA5zGl.js.map
========
//# sourceMappingURL=ReaderApp-_TbWjTsJ.js.map
>>>>>>>> studio/reader-quoted:frontend/packages/reader/dist/ReaderApp-_TbWjTsJ.js
