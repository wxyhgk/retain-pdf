var Wn = (e) => {
  throw TypeError(e);
};
var Vn = (e, t, n) => t.has(e) || Wn("Cannot " + n);
var ut = (e, t, n) => (Vn(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Jn = (e, t, n) => t.has(e) ? Wn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), qn = (e, t, n, r) => (Vn(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsx as y, jsxs as $, Fragment as $t } from "react/jsx-runtime";
import { useMemo as Z, useState as C, useEffect as z, useCallback as j, useRef as M, useLayoutEffect as _e, useSyncExternalStore as it, memo as yn, createContext as vn, useContext as Sn, forwardRef as Do, useImperativeHandle as wn, useId as zr, Suspense as xo, lazy as zo } from "react";
import { getReaderAdapters as le, requireAdapter as ct } from "./adapters.js";
import { resolveReaderDownloadName as Oo, resolveReaderDownloadUrls as Fo, READER_PROGRESS_COPY as ke, trimString as gt, READER_DOWNLOAD_ACTIONS as Or, disabledReason as $o } from "./runtime/state.js";
import { r as jo, b as Bo } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as tn, isFinishedJobStatus as Pn } from "@retainpdf/domain/job";
import { c as Uo, n as Ho, f as Vt, j as Gn, a as Wo, b as Vo, h as Fr, p as Rn, d as Jo, k as Kn, i as qo } from "./reader-regions-CP3ZMHPc.js";
import { fetchDocumentReading as Go } from "@retainpdf/api/documents";
import { isReaderTransportError as Ko, createReaderTransportError as Zo } from "./contracts.js";
import { toast as nn, Toaster as Yo } from "sonner";
import { NotebookPen as Xo, X as In, Radio as Qo, FileText as $r, Columns2 as jr, Languages as Br, FileCode2 as ea, Sparkles as ta, Keyboard as na, Download as ra, ChevronDown as oa, ListTree as aa, Search as sa } from "lucide-react";
import { Button as $e, Input as ia } from "@retainpdf/ui";
import { pdfjs as ca, Page as la, Document as ua } from "react-pdf";
import { extractMarkdownMath as da, materializeMarkdownMathFallbackHtml as fa, materializeMarkdownMathHtml as ma } from "./runtime/content.js";
const ha = (...e) => {
  var t, n;
  return ((n = (t = le()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, pa = "", ga = Object.freeze({
  progress: "retainpdf-reader-progress"
}), ba = (e) => {
  var t, n;
  return ((n = (t = le()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, zu = (...e) => {
  var n;
  return (((n = le()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Me = () => ct("defaultReaderDataPort"), Zn = () => ct("defaultReaderPageConfigPort"), Ou = {
  get apiPrefix() {
    return Me().apiPrefix;
  },
  fetchProtected: (...e) => Me().fetchProtected(...e),
  loadMarkdownPayload: (e) => Me().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Me().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Me().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Me().loadJobPayload(e),
  loadReaderPayload: (e, t) => Me().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Me().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Me().liveTranslation;
  }
}, Ur = {
  messageTargetOrigin: () => Zn().messageTargetOrigin(),
  readerJobId: () => Zn().readerJobId()
}, ya = () => {
  var e;
  return ((e = le()) == null ? void 0 : e.liveTranslation) ?? null;
}, va = () => {
  var e;
  return ((e = le()) == null ? void 0 : e.notesQuote) ?? null;
}, Sa = () => {
  var e;
  return ((e = le()) == null ? void 0 : e.notesPanel) ?? null;
}, wa = () => {
  var e;
  return ((e = le()) == null ? void 0 : e.readingPosition) ?? null;
}, Pa = () => {
  var e;
  return ((e = le()) == null ? void 0 : e.hostAi) ?? null;
}, Ra = () => {
  var e;
  return ((e = le()) == null ? void 0 : e.hostNavigation) ?? null;
}, Ia = () => {
  var e;
  return ((e = le()) == null ? void 0 : e.quotedBlocks) ?? null;
}, rn = () => {
  var e;
  return ((e = le()) == null ? void 0 : e.hostChrome) ?? null;
}, bt = () => {
  var t;
  const e = le();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, jt = () => {
  const e = le();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => ct("fetchDocumentByJobId")(...n),
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
}, Ta = (...e) => {
  var t, n;
  return ((n = (t = le()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Ea = () => {
  var e, t;
  return ((t = (e = le()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, ka = (...e) => {
  var t, n;
  return ((n = (t = le()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Ma = (...e) => {
  var t, n;
  return ((n = (t = le()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Oo(...e);
}, Aa = (...e) => {
  var t, n;
  return ((n = (t = le()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Fo(...e);
}, Na = (...e) => ct("downloadProtectedResource")(...e), _a = (...e) => ct("failDownloadToast")(...e), Fu = (e, t) => ct("resolveMarkdownAssetUrl")(e, t), Yn = "/api/v1";
function La() {
  const e = () => {
    var r;
    return jo(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = C(e);
  return z(() => {
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
function Ca() {
  const e = La(), t = Z(() => ka(Ur), [e]), n = Z(() => Ea(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Da(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: c
  } = e, [i, l] = C({
    documentId: "",
    jobId: ""
  }), [u, d] = C({
    documentId: "",
    jobId: ""
  }), f = i.documentId === t ? i.jobId : "", m = u.documentId === t ? u.jobId : "", g = n || f, [h, b] = C({
    jobId: "",
    documentId: ""
  }), v = h.jobId === g ? h.documentId : "", w = t || v, P = !!t && !g, [p, S] = C(null), k = (p == null ? void 0 : p.sessionIdentity) === r && p.documentId === w ? p : null, _ = P || !!k, B = j((D) => {
    const T = `${D.documentId || ""}`.trim();
    if (!T || a.current && a.current !== T) return;
    if (!a.current && s.current)
      b({
        jobId: s.current,
        documentId: T
      });
    else if (!a.current)
      return;
    const R = `${D.revision || ""}`.trim() || `${Date.now()}`;
    S({
      documentId: T,
      revision: R,
      sessionIdentity: o.current
    }), c();
  }, []);
  z(() => {
    S((D) => D && D.sessionIdentity !== r ? null : D);
  }, [r]);
  const O = j((D) => {
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
        b((T) => T.jobId === D.jobId && T.documentId === D.documentId ? T : { jobId: D.jobId, documentId: D.documentId });
        break;
      case "committed-source":
        S({
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
    resolvedJobDocument: h,
    setResolvedJobDocument: b,
    jobDocumentId: v,
    documentId: w,
    sourceOnly: P,
    committedDocumentSource: p,
    setCommittedDocumentSource: S,
    activeCommittedDocumentSource: k,
    sourceViewOnly: _,
    refreshCommittedDocument: B,
    applyIdentityEvent: O
  };
}
function Xn(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function xa(e) {
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
function Qn(e, t) {
  return ba(tn(e, t));
}
function za(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Oa(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !za(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function on({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: ga.progress,
        stage: n,
        percent: e,
        text: t
      },
      Ur.messageTargetOrigin()
    );
  } catch {
  }
}
function Lt(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), on({ percent: t, text: n, stage: r });
}
function Fa(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [c, i] = C(null), [l, u] = C(null), [d, f] = C(""), [m, g] = C(0), h = d === n ? c : null, b = d === n ? l : null, v = Xn(h), w = Pn(v), P = j(() => {
    g((O) => O + 1);
  }, []), p = j((O) => {
    i(O.jobPayload), u(O.manifestPayload), f(O.sessionIdentity);
  }, []), S = j((O) => {
    i(null), u(null), f(O);
  }, []), k = M(""), _ = M(""), B = j(async () => {
    const O = o.current;
    if (!O || k.current === O) return;
    const D = jt().loadJobPayload;
    if (typeof D != "function") return;
    const T = a.current.value;
    k.current = O;
    try {
      const R = await D(O);
      if (s.current || a.current.value !== T || o.current !== O || !R || typeof R != "object")
        return;
      const E = Xn(R);
      i(R), f(r.current), E === "succeeded" && _.current !== O && (_.current = O, g((N) => N + 1));
    } catch {
    } finally {
      k.current === O && (k.current = "");
    }
  }, []);
  return z(() => {
    _.current = "";
  }, [n]), z(() => {
    if (!t || w || !h) return;
    const O = window.setInterval(() => {
      document.visibilityState !== "hidden" && B();
    }, 1e3);
    return () => window.clearInterval(O);
  }, [w, B, h, t]), {
    jobPayload: c,
    setJobPayload: i,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: d,
    setPayloadSessionIdentity: f,
    scopedJobPayload: h,
    scopedManifestPayload: b,
    jobStatus: v,
    jobTerminal: w,
    jobRefreshRevision: m,
    refreshJobArtifacts: P,
    refreshJobStatus: B,
    publishPayload: p,
    clearPayload: S
  };
}
function an(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function $a(e, t) {
  e(t), an(t);
}
function ja(e) {
  const [t, n] = C(e ? "source" : "compare"), r = j((a) => {
    e && a !== "source" || (n(a), an(a));
  }, [e]), o = j((a) => {
    $a(n, a);
  }, []);
  return z(() => (e && document.documentElement.classList.add("reader-source-only"), an(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function er(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Ba(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: er(n.active_job_id),
    activeVersionId: er(n.active_version_id)
  };
}
function Ua(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Ha(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Wa(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Va = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Ja(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Va.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
function qa(e) {
  return e ? { data: e.data.slice() } : null;
}
const Ga = 2, ve = /* @__PURE__ */ new Map();
function sn(e, t) {
  ve.delete(e), ve.set(e, t);
}
function Ka(e) {
  if (ve.size < Ga) return;
  const t = ve.keys().next().value;
  t && ve.delete(t);
}
async function Za(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Hr(e, t = bt().fetchProtected, n = {}) {
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (ve.has(r)) {
    const c = ve.get(r);
    return sn(r, c), c;
  }
  const o = await t(r, { signal: n.signal });
  if (!o.ok) {
    const c = new Error(`读取 PDF 失败 (${o.status})`);
    c.status = o.status;
    const i = await Za(o);
    throw i && (c.reason = i), c;
  }
  const a = await o.arrayBuffer(), s = { data: new Uint8Array(a) };
  return ve.has(r) ? sn(r, s) : (Ka(), ve.set(r, s)), s;
}
const Ya = { file: null, loading: !1, error: "" }, Xa = { file: null, loading: !0, error: "" };
function Qa(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = C(null);
  if (z(() => {
    if (t || !n) return;
    const s = ve.get(n);
    if (s) {
      sn(n, s);
      return;
    }
    const c = new AbortController();
    return Hr(n, void 0, { signal: c.signal }).then((i) => {
      c.signal.aborted || o({ url: n, file: i, loading: !1, error: "" });
    }).catch((i) => {
      c.signal.aborted || o({ url: n, file: null, loading: !1, error: (i == null ? void 0 : i.message) || String(i) });
    }), () => c.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Ya;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = ve.get(n);
  return a ? { file: a, loading: !1, error: "" } : Xa;
}
function es(e) {
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
async function cn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  Lt(s, r, n, "download");
  const c = await Hr(t, bt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Lt(s, o, n, "download"), c);
}
async function ts(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  Lt(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, c = null;
  return t && a.push(
    cn({
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
    cn({
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
function ns(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function rs({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Go,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(ns(o.href, t, a)), !0);
}
const Et = {
  regions: null,
  metadata: null
};
function os(e) {
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
    sessionEpochRef: h,
    closingRef: b,
    activeLoadAbortRef: v
  } = e, [w, P] = C(""), [p, S] = C(""), [k, _] = C(null), [B, O] = C(null), [D, T] = C(!1), [R, E] = C(""), [N, F] = C([]), [U, q] = C(!1), [J, re] = C(() => ({
    source: null,
    translated: null
  })), [x, K] = C(
    Et
  ), [oe, ee] = C({
    loading: !0,
    percent: 4,
    text: ke.boot,
    stage: "progress",
    failed: !1
  });
  return z(() => {
    const se = new AbortController(), pe = h.current.value, A = es({
      sessionEpochRef: h,
      closingRef: b,
      abort: se,
      sessionEpoch: pe
    });
    v.current = se;
    const I = jt();
    if (b.current)
      return se.abort(), () => {
        v.current === se && (v.current = null);
      };
    let te = !1;
    function ae(ne, de) {
      A.markFailed(), q(!0), ee({
        loading: !1,
        percent: 100,
        text: ne,
        stage: "failed",
        failed: !0
      }), on({ percent: 100, text: de, stage: "failed" });
    }
    function Te() {
      T(!0), te || q(!0), ee({
        loading: !1,
        percent: 100,
        text: ke.ready,
        stage: "ready",
        failed: !1
      }), on({ percent: 100, text: ke.ready, stage: "ready" });
    }
    function Se() {
      return l != null && l.documentId ? Qn(
        l.documentId,
        l.revision
      ) : ha() ? pa : I.resolveResourceUrl(tn(r));
    }
    async function we() {
      var fe;
      let ne = { activeJobId: "", activeVersionId: "" };
      try {
        const ce = await ((fe = I.fetchDocument) == null ? void 0 : fe.call(I, r));
        ce && (ne = Ba(ce));
      } catch {
      }
      const de = Ua({
        link: ne,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (de.kind === "follow-active-job") {
        if (A.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: de.jobId
        }), de.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: de.activeVersionId,
          sessionIdentity: i
        }), m("source")) : m("compare");
        return;
      }
      if (de.kind === "open-committed-source") {
        if (A.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: de.revision,
          sessionIdentity: i
        }), m("source");
        return;
      }
      const be = Se();
      if (A.isInactive()) return;
      P(be), S(""), E(""), f(i);
      const ie = await cn({
        url: be,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: A,
        setBoot: ee
      });
      if (!A.isInactive()) {
        if (!ie) {
          ae("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        _(ie), Te();
      }
    }
    async function ge() {
      var V;
      const ne = !l, de = !!(ne && I.loadSessionSnapshot && I.loadReaderOptionalArtifacts), be = de ? I.loadReaderOptionalArtifacts(t) : null, ie = await ((V = I.loadSessionSnapshot) == null ? void 0 : V.call(I, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: ne && !de
      })), fe = ie ? {
        jobPayload: ie.sourcePayload,
        manifestPayload: ie.manifestPayload,
        readerMetadata: ie.readerMetadata,
        regionsPayload: ie.regions,
        readerErrors: ie.readerErrors
      } : await I.loadReaderPayload(t, {
        includeOptionalArtifacts: ne
      });
      if (A.isInactive()) return;
      let ce = null;
      if (n && !r)
        if (ie && ie.linkedDocument !== void 0)
          ce = ie.linkedDocument;
        else {
          try {
            ce = await I.fetchDocumentByJobId(Yn, t);
          } catch {
          }
          if (A.isInactive()) return;
        }
      const Ge = xa(fe.jobPayload) || `${(ce == null ? void 0 : ce.document_id) || ""}`.trim();
      Ge && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ge
      });
      const Ke = Ha({
        payloadDocumentId: Ge,
        linkedActiveJobId: `${(ce == null ? void 0 : ce.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ce == null ? void 0 : ce.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Ke.kind === "restore-committed-source") {
        if (A.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Ke.documentId,
          revision: Ke.revision,
          sessionIdentity: i
        }), m("source");
        return;
      }
      const lt = I.resolveReaderSourcePdf(fe.manifestPayload), Ht = I.resolveReaderTranslatedPdfUrl(fe.jobPayload, fe.manifestPayload), Wt = typeof lt == "string" ? lt : I.resolveReaderArtifactUrl(lt), Le = r || Ge, Ce = l != null && l.documentId ? Qn(
        l.documentId,
        l.revision
      ) : Wt || (Le ? I.resolveResourceUrl(tn(Le)) : ""), Oe = l ? "" : Ht || "";
      P(Ce || ""), S(Oe), E(Oa(fe.jobPayload, t)), d({
        jobPayload: fe.jobPayload || null,
        manifestPayload: fe.manifestPayload || null,
        sessionIdentity: i
      });
      const Rt = () => ts({
        sourceFinal: Ce || "",
        translatedFinal: Oe,
        fence: A,
        setBoot: ee
      }), It = !!(Ce || Oe), Ze = be && It ? Rt() : null;
      Ze == null || Ze.catch(() => {
      });
      const Tt = (W) => {
        A.isInactive() || (F(l ? [] : Uo(W.regionsPayload)), re(l ? { source: null, translated: null } : Ho(W.readerMetadata)), K(l ? Et : W.readerErrors ?? Et), q(!0));
      };
      if (be ? (te = !0, be.then(Tt)) : Tt(fe), !It) {
        ae(ke.failed, ke.failed);
        return;
      }
      const L = await (Ze ?? Rt());
      if (L.status !== "inactive") {
        if (L.status === "incomplete") {
          ae("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        _(L.sourceBytes), O(L.translatedBytes), Te();
      }
    }
    async function Ee() {
      T(!1), _(null), O(null), F([]), q(!1), re({ source: null, translated: null }), K(Et), Lt(ee, 8, ke.metadata, "metadata");
      try {
        if (s) {
          await we();
          return;
        }
        if (!t) {
          ae(ke.failed, ke.failed);
          return;
        }
        await ge();
      } catch (ne) {
        if (A.isClosedOrStale() || (ne == null ? void 0 : ne.name) === "AbortError") return;
        A.markFailed();
        const de = Number(ne == null ? void 0 : ne.status), be = `${(ne == null ? void 0 : ne.reason) || ""}`, ie = Ja({ status: de, reason: be, sessionJobId: t });
        if (ie && (await rs({
          apiPrefix: Yn,
          documentId: ie,
          expiredJobId: t
        }) || A.isClosedOrStale()))
          return;
        if (Wa({
          status: de,
          reason: be,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const fe = ne instanceof Error ? ne.message : ke.failed;
        ae(fe, fe);
      }
    }
    return Ee(), () => {
      se.abort(), v.current === se && (v.current = null);
    };
  }, [t, r, o, a, s, c, l, g, n, i, u, d, f, m]), {
    sourceUrl: w,
    translatedUrl: p,
    sourceFile: k,
    translatedFile: B,
    assetsReady: D,
    title: R,
    regions: N,
    regionsSettled: U,
    readerMetadata: J,
    readerErrors: x,
    boot: oe
  };
}
function as() {
  const e = M(!1), t = M(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Ca(), s = M({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const c = M(a), i = M(""), l = M(""), u = M(() => {
  }), d = j(() => u.current(), []), f = Da({
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
    sourceOnly: h,
    sourceViewOnly: b
  } = f, { mode: v, setMode: w, switchSessionMode: P } = ja(b);
  u.current = () => {
    P("source");
  }, c.current = a, i.current = g, l.current = m;
  const p = Fa({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: c,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: S,
    scopedManifestPayload: k,
    jobStatus: _,
    jobTerminal: B,
    jobRefreshRevision: O,
    refreshJobArtifacts: D,
    refreshJobStatus: T
  } = p, R = os({
    sessionJobId: m,
    jobId: r,
    routeDocumentId: o,
    documentJobId: f.documentJobId,
    rejectedDocumentJobId: f.rejectedDocumentJobId,
    sourceOnly: h,
    locationKey: n,
    sessionIdentity: a,
    committedSource: f.activeCommittedDocumentSource,
    applyIdentityEvent: f.applyIdentityEvent,
    publishPayload: p.publishPayload,
    clearPayload: p.clearPayload,
    switchSessionMode: P,
    jobRefreshRevision: O,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), E = j(() => {
    var F;
    e.current = !0, (F = t.current) == null || F.abort();
  }, []), N = Z(
    () => ({
      fetchProtected: jt().fetchProtected,
      jobId: m,
      jobPayload: S,
      manifestPayload: k,
      sourceUrl: R.sourceUrl,
      translatedUrl: R.translatedUrl,
      sourceOnly: b
    }),
    [m, S, k, R.sourceUrl, R.translatedUrl, b]
  );
  return {
    jobId: m,
    jobStatus: _,
    workflow: `${(S == null ? void 0 : S.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: B,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: v,
    setMode: w,
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
    download: N,
    refreshJobArtifacts: D,
    refreshJobStatus: T,
    refreshCommittedDocument: f.refreshCommittedDocument,
    prepareClose: E
  };
}
const ss = 160, is = 8, cs = 0;
function ls() {
  const e = M(null), [t, n] = C(null), [r, o] = C(cs), a = j((s) => {
    e.current = s, n(s);
  }, []);
  return z(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const c = (l) => {
      !Number.isFinite(l) || l < ss || o((u) => Math.abs(u - l) < is ? u : l);
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
function us(e) {
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
const Jt = { source: 0, translated: 0 };
function ds(e, t) {
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
  const [d, f] = C(() => ({
    identity: l,
    pages: Jt
  })), [m, g] = C(() => ({ identity: l, tick: 0 })), h = d.identity === l ? d.pages : Jt, b = m.identity === l ? m.tick : 0, v = us({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!c || !!a,
    hasTranslated: !!i
  }), { primaryPane: w } = v, P = j((T, R) => {
    u.current === l && f((E) => {
      const N = E.identity === l ? E.pages : Jt;
      return N[R] === T && E.identity === l ? E : {
        identity: l,
        pages: { ...N, [R]: T }
      };
    });
  }, [l]), p = M(null), S = j(() => {
    p.current && clearTimeout(p.current);
    const T = l;
    p.current = setTimeout(() => {
      p.current = null, u.current === T && g((R) => ({
        identity: T,
        tick: R.identity === T ? R.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  z(() => (p.current && (clearTimeout(p.current), p.current = null), f((T) => T.identity === l && T.pages.source === 0 && T.pages.translated === 0 ? T : { identity: l, pages: { source: 0, translated: 0 } }), g((T) => T.identity === l && T.tick === 0 ? T : { identity: l, tick: 0 }), () => {
    p.current && (clearTimeout(p.current), p.current = null);
  }), [l]);
  const k = Z(
    () => Math.max(h.source, h.translated),
    [h]
  ), _ = w === "translated" ? h.translated : h.source || h.translated, B = t == null ? void 0 : t.userZoom, O = t == null ? void 0 : t.shellWidth, D = `${l}-${b}-${B}-${n}-${h.source}-${h.translated}-${O}`;
  return {
    ...v,
    numPagesByPane: h,
    hudNumPages: k,
    primaryNumPages: _,
    metricsTick: b,
    onNumPages: P,
    onMetrics: S,
    rowSyncRevision: D
  };
}
const Ue = "data-reader-page", rt = "data-reader-pane", Tn = "data-natural-height", fs = "reader-react-root", ms = "reader-react-grid", hs = "reader-react-scroll-shell", ps = "reader-react-pdf-pane", Wr = "reader-react-pdf-page", Ct = "reader-react-pdf-page-placeholder", En = "reader-react-pdf-page-slot";
function Dt(e, t) {
  const n = e != null ? `[${Ue}="${e}"]` : `[${Ue}]`;
  return t ? `${n}[${rt}="${t}"]` : n;
}
function gs() {
  return `.${En}[${Ue}]`;
}
function xt(e) {
  return Number(e.getAttribute(Ue));
}
const Vr = 0.25, ot = 1, bs = 0.05, Pt = 0.5, ys = 16, vs = 8, Ss = 720;
function Be() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Jr(e) {
  return Number.isFinite(e) && e < Ss;
}
function Qe(e, t = Number.POSITIVE_INFINITY) {
  return Jr(t) && (e === "source" || e === "translated") ? ot : Pt;
}
function Bt(e) {
  return Number.isFinite(e) ? Math.min(ot, Math.max(Vr, e)) : Pt;
}
function at(e, t) {
  const n = Bt(Number(e) + t * bs);
  return Math.round(n * 100) / 100;
}
function qr(e) {
  return Math.round(Bt(e) * 100);
}
function ws(e) {
  const n = (Number(e) || 0) - ys - vs;
  return Math.max(160, Math.floor(n));
}
function Ps(e, t = Pt) {
  const n = Bt(t);
  return ws((Number(e) || 0) * n);
}
function Rs(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${rt}]`)
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
const Is = 8;
function Ts(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Is ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const Gr = 200, Kr = [
  "markdown"
], Es = Kr;
function Zr(e) {
  return Es.includes(e);
}
const ks = "retainpdf:reader:view:v1:", tr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), Ms = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function Yr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function ln(e) {
  return `${e || ""}`.trim();
}
function As({
  documentId: e,
  jobId: t
}) {
  const n = ln(e);
  if (n) return `document:${n}`;
  const r = ln(t);
  return r ? `job:${r}` : "";
}
function Xr(e) {
  const t = ln(e);
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
  return e === null ? null : Zr(e) ? e : void 0;
}
function Cs(e) {
  return Ms.has(e) ? e : void 0;
}
function Qr(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Ns(t.anchor), r = Number(t.zoom), o = Cs(t.mode), a = _s(t.splitLayout), s = Ls(t.assistantPanel);
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
function Ie(e, t = Yr()) {
  const n = Xr(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Qr(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function Ut(e, t, n = Yr()) {
  const r = Xr(e);
  if (!r || !n) return null;
  const o = Ie(e, n), a = Qr({
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
function Ds(e, t, n = "") {
  var f;
  const [r, o] = C(() => {
    var m;
    return ((m = Ie(n)) == null ? void 0 : m.zoom) ?? Qe(e, Be());
  }), a = M(r), s = M(n);
  a.current = r;
  const c = M(1), i = M(((f = Ie(n)) == null ? void 0 : f.zoom) !== void 0);
  z(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = Ie(n)) == null ? void 0 : h.zoom;
    i.current = m !== void 0;
    const g = m ?? Qe(e, Be());
    c.current = 1, a.current = g, o(g);
  }, [e, n]), z(() => {
    if (i.current) return;
    const m = Qe(e, Be()), g = a.current;
    Math.abs(m - g) < 5e-4 || (c.current = 1, a.current = m, o(m));
  }, [e]);
  const l = j((m) => {
    const g = Bt(m), h = a.current;
    Math.abs(g - h) < 5e-4 || (c.current = g / (h || 1), i.current = !0, Ut(s.current, { zoom: g }), o(g));
  }, []), u = j((m) => {
    l(at(a.current, m));
  }, [l]), d = j((m) => {
    l(Qe(m));
  }, [l]);
  return _e(() => {
    const m = c.current;
    Math.abs(m - 1) < 1e-3 || (c.current = 1, Rs(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: d };
}
function xs(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = M(t), a = M(n), s = M(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: j((i) => {
    i !== o.current && (s.current(), a.current(i));
  }, []) };
}
const kn = 48;
function eo(e, t = kn) {
  return e.getBoundingClientRect().top + t;
}
function to(e, t) {
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
  const o = xt(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, c = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: c };
}
function Nt(e, t, n = kn) {
  if (!e)
    return null;
  const r = Dt(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = eo(e, n), c = to(o, s);
  return c ? { page: c.page, fraction: c.fraction } : null;
}
function yt(e, t, n = "auto", r, o = kn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let c = null;
  if (r && (c = e.querySelector(Dt(a, r))), c || (c = e.querySelector(Dt(a))), !c)
    return !1;
  const i = e.getBoundingClientRect(), l = c.getBoundingClientRect();
  if (i.height <= 0 || l.height < 8 && c.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : c.offsetHeight, d = e.scrollTop + (l.top - i.top), f = Math.max(0, d + s * u - o);
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
  const c = [], i = () => {
    var u;
    if (a) return;
    yt(
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
function Os(e, t, n) {
  return un(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function zt(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function ye(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Fs(e, t, n = !0, r = "", o) {
  const [a, s] = C(1);
  return z(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const c = e.current;
    if (!c)
      return;
    let i = !1, l = null, u = 0;
    const d = Dt(void 0, o), f = () => {
      if (i) return;
      const h = Array.from(c.querySelectorAll(d));
      if (!h.length)
        return;
      const b = eo(c), v = to(h, b);
      v && s(v.page);
    }, m = () => {
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
const $s = `canvas, .react-pdf__Page, .${Wr}, .${Ct}`, nr = /* @__PURE__ */ new WeakMap();
function js(e) {
  const t = Number(e.getAttribute(Tn));
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
  e.querySelectorAll(gs()).forEach((r) => {
    const o = xt(r);
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
  const [o, a] = C(() => /* @__PURE__ */ new Map()), s = M(o), c = M(r);
  return c.current = r, _e(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let i = !1, l = 0, u = !1, d = !1;
    const f = () => {
      var S;
      if (i) return;
      const P = e.current;
      if (!P) return;
      const p = Us(P);
      Bs(s.current, p) || (s.current = p, a(p)), u && !d && (d = !0, (S = c.current) == null || S.call(c));
    }, m = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(f);
      });
    };
    m();
    const g = window.setTimeout(m, 100), h = window.setTimeout(() => {
      u = !0, m();
    }, 300), b = window.setTimeout(m, 700), v = e.current;
    let w = null;
    return v && typeof ResizeObserver < "u" && (w = new ResizeObserver(() => m()), w.observe(v)), () => {
      i = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(b), w == null || w.disconnect();
    };
  }, [e, t, n]), o;
}
const Ws = [0, 48, 140, 320, 560], Vs = 700, Js = [80, 200, 400], qs = 500, Gs = 50, Ks = /* @__PURE__ */ new Set([
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
  var R;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, c = M(
    ((R = Ie(a)) == null ? void 0 : R.anchor) || { page: 1, fraction: 0 }
  ), i = M(null), l = M(!1), u = M(r), d = M(null), f = M(null), m = M(null), g = M(null), h = M(a), b = M(""), v = M(n);
  v.current = n;
  const w = j(() => {
    var E;
    (E = d.current) == null || E.call(d), d.current = null, f.current != null && (clearTimeout(f.current), f.current = null);
  }, []), P = j(() => {
    !l.current && i.current == null || (w(), m.current != null && (clearTimeout(m.current), m.current = null), i.current = null, l.current = !1);
  }, [w]), p = j((E = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const N = () => {
      g.current = null, Ut(h.current, {
        anchor: ye(c.current)
      });
    };
    E ? N() : g.current = setTimeout(N, Zs);
  }, []), S = j((E) => {
    c.current = ye(E), i.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, Gs);
  }, []);
  z(() => {
    if (!o)
      return;
    let E = !1, N = null, F = null, U = null;
    const q = () => {
      if (E) return;
      const J = e.current;
      if (!J) {
        U = setTimeout(q, 50);
        return;
      }
      N = J, F = () => {
        if (l.current)
          return;
        const re = Nt(N, v.current);
        re && (c.current = re, p());
      }, N.addEventListener("scroll", F, { passive: !0 }), l.current || F();
    };
    return q(), () => {
      E = !0, U != null && clearTimeout(U), N && F && N.removeEventListener("scroll", F);
    };
  }, [o, r, n, e, p]), z(() => {
    if (!o) return;
    const E = e.current;
    if (!E) return;
    const N = (F) => {
      F.metaKey || F.ctrlKey || F.altKey || Ks.has(F.key) && P();
    };
    return E.addEventListener("wheel", P, { passive: !0 }), E.addEventListener("touchmove", P, { passive: !0 }), window.addEventListener("keydown", N), () => {
      E.removeEventListener("wheel", P), E.removeEventListener("touchmove", P), window.removeEventListener("keydown", N);
    };
  }, [o, e, P]), _e(() => {
    var N;
    if (h.current === a) return;
    p(!0), w(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, b.current = "";
    const E = (N = Ie(a)) == null ? void 0 : N.anchor;
    c.current = E ? ye(E) : { page: 1, fraction: 0 }, i.current = null, l.current = !!a, u.current = r;
  }, [a, r, p, w]), z(() => {
    var N;
    if (!o || !s || !a || b.current === a) return;
    b.current = a;
    const E = ye(
      ((N = Ie(a)) == null ? void 0 : N.anchor) || { page: 1, fraction: 0 }
    );
    return c.current = E, i.current = E, l.current = !0, w(), d.current = un(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: v.current,
        delaysMs: rr,
        onDone: () => S(E)
      }
    ), f.current = setTimeout(() => {
      f.current = null, S(E);
    }, Math.max(...rr) + 160), () => w();
  }, [o, s, a, e, S, w]), z(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, i.current = null, w();
      return;
    }
    const E = i.current ? ye(i.current) : ye(c.current);
    return l.current = !0, i.current = E, c.current = E, w(), d.current = un(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Ws,
        onDone: () => S(E)
      }
    ), f.current = setTimeout(() => {
      f.current = null, S(E);
    }, Vs), () => {
      w();
    };
  }, [r, o, n, e, S, w]), z(() => () => {
    w(), m.current != null && (clearTimeout(m.current), m.current = null), p(!0);
  }, [w, p]);
  const k = j(() => {
    const E = Nt(
      e.current,
      v.current
    );
    return ye(E || c.current);
  }, [e]), _ = j(() => {
    l.current = !0;
    const E = Nt(
      e.current,
      v.current
    ), N = ye(E ?? c.current);
    return c.current = N, i.current = N, p(), N;
  }, [e, p]), B = j((E, N, F) => {
    const U = F || v.current, q = zt(E, N || 1), J = { page: q, fraction: 0 };
    c.current = J, l.current = !0, i.current = J, p(), w(), zs(e.current, q, "smooth", U), d.current = Os(
      () => e.current,
      q,
      {
        behavior: "auto",
        pane: U,
        delaysMs: Js,
        onDone: () => S(J)
      }
    ), f.current = setTimeout(() => {
      f.current = null, S(J);
    }, qs);
  }, [e, S, w, p]), O = j(() => ye(c.current), []), D = j(() => l.current, []), T = j(() => {
    if (!l.current || !i.current)
      return;
    const E = ye(i.current);
    yt(
      e.current,
      E,
      "auto",
      v.current
    );
  }, [e]);
  return {
    lockFromShell: k,
    beginModeSwitch: _,
    goToPage: B,
    getAnchor: O,
    isRestoring: D,
    repinIfRestoring: T
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
function no(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Qs = [0, 80, 200, 400, 800], ei = 120, ti = 400;
function ni(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: c, jobId: i, documentId: l, regionsSettled: u = !0 } = e, d = M(a);
  d.current = a;
  const f = M(s);
  f.current = s;
  const m = M(c);
  m.current = c;
  const g = M(n);
  g.current = n, z(() => {
    var p, S;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = Ta(), b = Xs(h, f.current);
    if (b == null && (h != null && h.blockId) && !u) return;
    const v = no(h, b, { jobId: i, documentId: l });
    if (t.current === v)
      return;
    if (b == null) {
      t.current = v, (p = g.current) == null || p.call(g);
      return;
    }
    t.current = v, h && ((S = m.current) == null || S.call(m, h, b));
    const w = [];
    let P = 0;
    for (const k of Qs)
      P = Math.max(P, k), w.push(
        setTimeout(() => {
          d.current(b);
        }, k)
      );
    return w.push(
      setTimeout(() => {
        var k;
        (k = g.current) == null || k.call(g);
      }, P + ei)
    ), () => {
      for (const k of w) clearTimeout(k);
    };
  }, [r, o, i, l, t, u]);
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
    jobId: c,
    documentId: i,
    applyReaderSearch: l
  } = e, u = M(a);
  u.current = a;
  const d = M(l);
  d.current = l;
  const f = M(0);
  z(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || f.current === o) return;
    const m = setTimeout(() => {
      var v;
      const g = ((v = globalThis.location) == null ? void 0 : v.search) || "", h = Bo(g, o, u.current);
      if (f.current = o, h === null) return;
      const b = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = no(
        { blockId: b },
        o,
        { jobId: c, documentId: i }
      ), (d.current || ri)(h);
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
function ai(e) {
  const t = M(""), [n, r] = C(!1), o = j(() => r(!0), []), a = {
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
function ro(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = or(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = or(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function ii(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = ro(r, t, n);
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
const ar = [250, 500, 1e3, 2e3, 4e3], qt = [80, 160, 320, 640, 1e3, 1500], sr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function dn(e, t) {
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
function Mn(e) {
  return Ko(e) ? `${e.code || ""}`.trim() : "";
}
function kt(e, t) {
  const n = Mn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function li(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const i = await o.fetchPage(e, t.page_idx, { signal: r });
      if (ro(n.pagesByPage.get(t.page_idx), t, i) !== "retry")
        return i;
      a = Zo(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (i) {
      if ((i == null ? void 0 : i.name) === "AbortError") throw i;
      a = i;
      const l = Mn(i);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw i;
    }
    const c = qt[Math.min(s, qt.length - 1)];
    if (await dn(c, r), s >= qt.length + 2) throw a;
  }
}
function ui({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = C(dt), s = M(o), c = M("");
  s.current = o;
  const i = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Pn(l) ? l : "";
  return z(() => {
    if (!n || !i) {
      c.current = "", s.current = dt, a(dt);
      return;
    }
    const d = r === void 0 ? ya() : r, f = c.current === i;
    if (c.current = i, !d) {
      const P = {
        ...f ? s.current : dt,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = P, a(P);
      return;
    }
    const m = new AbortController();
    let g = !1;
    const h = {
      ...f ? s.current : dt,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = h, a(h);
    const b = (P) => {
      m.signal.aborted || a((p) => {
        const S = P(p);
        return s.current = S, S;
      });
    }, v = async () => {
      let P = 0;
      for (; !m.signal.aborted; )
        try {
          const p = await d.fetchLayout(i, { signal: m.signal });
          g = !0, b((S) => ({
            ...S,
            layoutByPage: si(p),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (p) {
          if ((p == null ? void 0 : p.name) === "AbortError") return;
          const S = Mn(p);
          if (!(S === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !S)) {
            b((_) => ({
              ..._,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: kt(p, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            b((_) => ({
              ..._,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          b((_) => ({
            ..._,
            connection: "connecting",
            jobStatus: l,
            error: kt(p, "正在等待 OCR 版面数据")
          })), await dn(ar[Math.min(P, ar.length - 1)], m.signal).catch(() => {
          }), P += 1;
        }
    };
    return (async () => {
      if (await v(), !g || m.signal.aborted) return;
      let P = 0;
      for (; !m.signal.aborted; ) {
        u || b((p) => ({
          ...p,
          connection: p.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: l,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: p.error
        }));
        try {
          await d.streamEvents(i, {
            afterSeq: s.current.lastSeq,
            signal: m.signal,
            onEvent: async (p) => {
              if (p.seq <= s.current.lastSeq) return;
              let S;
              try {
                S = await li(
                  i,
                  p,
                  s.current,
                  m.signal,
                  d
                );
              } catch (k) {
                if ((k == null ? void 0 : k.name) === "AbortError" || m.signal.aborted) throw k;
                b((_) => ({
                  ..._,
                  lastSeq: Math.max(_.lastSeq, p.seq),
                  error: kt(k, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              b((k) => {
                const _ = ii(k, p, S);
                return u ? {
                  ..._,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ..._,
                  jobStatus: l
                };
              }), P = 0;
            }
          });
        } catch (p) {
          if ((p == null ? void 0 : p.name) === "AbortError" || m.signal.aborted) return;
          b((S) => ({
            ...S,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: kt(p, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (u) {
          b((p) => ({
            ...p,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await dn(sr[Math.min(P, sr.length - 1)], m.signal).catch(() => {
        }), P += 1;
      }
    })(), () => m.abort();
  }, [n, r, i, u]), o;
}
function di(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, c = `${s.value ?? ""}`.trim(), i = Number(s.count) || 0;
    c && i > 0 && o.set(c, i);
  }
  return o;
}
function fi(e, t = !0) {
  const [n, r] = C(() => /* @__PURE__ */ new Map());
  return z(() => {
    r((c) => c.size ? /* @__PURE__ */ new Map() : c);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = jt().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((c) => {
      !s && c && r(di(c));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const mi = /* @__PURE__ */ new Set(), hi = () => () => {
}, pi = () => mi;
function gi() {
  const e = Ia(), t = (e == null ? void 0 : e.get) ?? pi;
  return it((e == null ? void 0 : e.subscribe) ?? hi, t, t);
}
const bi = 4500;
function yi(e) {
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
const vi = /* @__PURE__ */ new Set(["book", "translate"]);
function oo(e) {
  return !!(e.jobId && e.sourceUrl && vi.has(e.workflow));
}
function Si(e) {
  return !!(oo(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function wi() {
  const e = as(), t = oo({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Si({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = M({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Pn(o) && (r.current.running = !0);
  const a = ui({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: c, shellWidth: i, bindShell: l } = ls(), u = fi(e.jobId, !e.sourceOnly), d = gi(), f = As({
    documentId: e.documentId,
    jobId: e.jobId
  }), m = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: g, onZoomChange: h } = Ds(e.mode, s, f), b = ds(
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
    goToPage: w,
    repinIfRestoring: P
  } = Ys(s, {
    primaryPane: b.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: b.primaryNumPages > 0
  });
  z(() => {
    P();
  }, [i, P]);
  const p = Hs(
    s,
    b.compareMode,
    b.rowSyncRevision,
    P
  ), S = Fs(
    s,
    b.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${g}-${b.metricsTick}`,
    b.primaryPane
  ), k = j((x, K) => {
    var ee, se;
    const oe = Math.max(
      Number(b.hudNumPages) || 0,
      Number(b.primaryNumPages) || 0,
      Number((ee = b.numPagesByPane) == null ? void 0 : ee.source) || 0,
      Number((se = b.numPagesByPane) == null ? void 0 : se.translated) || 0
    );
    w(x, oe, K);
  }, [w, b.hudNumPages, b.primaryNumPages, b.numPagesByPane]), [_, B] = C(null), O = M(null), D = j((x) => {
    O.current && clearTimeout(O.current), B(x), x && (O.current = setTimeout(() => B(null), bi));
  }, []);
  z(() => () => {
    O.current && clearTimeout(O.current);
  }, []);
  const T = j((x) => {
    const K = Vt(e.regions, x);
    return K ? Gn(K, b.primaryPane).page : null;
  }, [e.regions, b.primaryPane]), R = j((x, K) => {
    const oe = K || b.primaryPane, ee = typeof x == "object" && x ? `${x.block_id || ""}`.trim() : "", se = typeof x == "object" && x ? `${x.image_url || ""}`.trim() : "", pe = typeof x == "object" && x ? x.page_idx != null ? Number(x.page_idx) + 1 : x.page != null ? Number(x.page) : null : typeof x == "number" ? x + 1 : null, A = Wo(e.regions, se, pe) || Vt(e.regions, ee) || (typeof x == "object" ? Vo(e.regions, x) : null);
    let I = A ? Gn(A, oe).page : null;
    I == null && (I = yi(x)), !(I == null || I < 1) && (D(A), k(I, oe));
  }, [D, k, b.primaryPane, e.regions]);
  ai({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: b.hudNumPages || 0,
    currentPage: S,
    goToPage: k,
    resolveBlockPage: T,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (x) => {
      D(Vt(e.regions, x.blockId));
    }
  });
  const E = !e.boot.loading && !e.boot.failed && e.assetsReady, N = Number(b.hudNumPages) || 0;
  z(() => {
    var x;
    E && ((x = wa()) == null || x.report(S >= 1 ? S - 1 : null, N >= 1 ? N : null));
  }, [E, S, N]), z(() => {
    const x = Ra();
    if (!(!x || !E || !e.jobId))
      return x.subscribe(({ jobId: K, pageIdx: oe, blockId: ee }) => K !== e.jobId ? !1 : (R({ ...oe != null ? { page_idx: oe } : {}, ...ee ? { block_id: ee } : {} }), !0));
  }, [E, e.jobId, R]);
  const { setModeKeepingPage: F } = xs({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: v
  });
  z(() => {
    D(null);
  }, [m, D]);
  const U = !e.boot.loading && !e.boot.failed, q = Z(() => ({ bindShell: l, shellEl: c, shellWidth: i, shellRef: s }), [l, c, i, s]), J = Z(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), re = Z(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: g,
    onZoomChange: h,
    shell: q,
    panes: b,
    sessionFiles: J,
    rowHeights: p,
    goToPage: k,
    activeRegion: _,
    jumpToAnchor: R,
    setModeKeepingPage: F,
    download: e.download,
    showHud: U,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u,
    quotedBlocks: d
  }), [e, q, b, J, p, k, _, R, F, U, g, h, f, a, n, u, d]);
  return Z(() => ({
    ...re,
    currentPage: S
  }), [re, S]);
}
const Pi = [
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
], Ri = [
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
function Ii(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Pi)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Ti(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Ei = ".reader-notes-panel";
function ki(e) {
  return e instanceof Element ? !!e.closest(Ei) : !1;
}
function Mi(e) {
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
  z(() => {
    if (!l)
      return;
    const u = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || Ti(d.target) || ki(d.target))
        return;
      const f = d.key, m = Ii(f);
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
              a(at(o, 1));
              return;
            case "zoom-out":
              a(at(o, -1));
              return;
            case "zoom-reset":
              a(Qe(t, Be()));
              return;
            case "next-page":
              i(zt(s + 1, c));
              return;
            case "prev-page":
              i(zt(s - 1, c));
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
const Ai = "retainpdf:soft-reader-close";
function An(e = typeof window > "u" ? "" : window.location.search) {
  try {
    return `${new URLSearchParams(e).get("embed") || ""}`.trim();
  } catch {
    return "";
  }
}
function Ni(e = typeof window > "u" ? "" : window.location.search) {
  try {
    return `${new URLSearchParams(e).get("embed_pane") || ""}`.trim();
  } catch {
    return "";
  }
}
function _i() {
  const e = new URL("./index.html", window.location.href), t = An();
  return t && e.searchParams.set("embed", t), e.href;
}
function Li() {
  if (typeof window > "u" || window.self === window.top || An()) return !1;
  try {
    return window.parent.postMessage(
      { type: Ai },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Ci(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Di() {
  if (!(typeof window > "u") && !Li()) {
    if (Ci(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(_i());
  }
}
function ao({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ y("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function xi({ onBeforeClose: e } = {}) {
  return Ni() === "beside" ? null : /* @__PURE__ */ $(ao, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Di();
  }, children: [
    /* @__PURE__ */ y(In, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ y("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const zi = { available: !1, open: !1, title: null }, Oi = () => () => {
}, Fi = () => zi;
function $i() {
  const e = Sa(), t = (e == null ? void 0 : e.getState) ?? Fi, n = it((e == null ? void 0 : e.subscribe) ?? Oi, t, t);
  if (!e || !n.available) return null;
  const r = n.open ? `收起摘录${n.title ? `（摘到《${n.title}》）` : ""}` : "摘录";
  return /* @__PURE__ */ y(ao, { className: "reader-notes-toggle", label: r, pressed: n.open, onClick: e.toggle, children: /* @__PURE__ */ y(Xo, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }) });
}
let ir = !1;
function ji() {
  if (ir)
    return;
  const e = bt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (ca.GlobalWorkerOptions.workerSrc = e, ir = !0);
}
const Bi = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Ui(e, t, n) {
  return e.flatMap((r) => {
    if (!Bi.has(Fr(r.region))) return [];
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
    const c = s.width * s.height;
    c < o && (r = a, o = c);
  }
  return r;
}
async function Hi(e) {
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
const Wi = "reader-text-hover-copy", Vi = "reader-text-hover-id", so = "reader-text-hover-tools", Ji = "reader-text-hover-quote";
function qi(e) {
  const { region: t } = e.highlight, n = `${t.translated.text || ""}`.trim();
  return {
    itemId: e.itemId,
    pageIdx: Math.max(0, t.source.page - 1),
    sourceText: `${t.source.text || ""}`,
    translatedText: n ? t.translated.text : null
  };
}
function Gt({
  className: e,
  state: t,
  label: n,
  title: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ y(
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
const io = 26, Ot = 190;
function co(e, t = Ot) {
  return e.height < io * 2 || e.width < t;
}
const Gi = 72;
function Ki({
  target: e,
  pane: t = "source",
  revisedCount: n = 0
}) {
  const [r, o] = C("idle"), [a, s] = C("idle"), [c, i] = C("idle"), l = M([]), u = (e == null ? void 0 : e.itemId) || "";
  if (z(() => {
    o("idle"), s("idle"), i("idle");
    const P = l.current;
    return () => {
      P.forEach((p) => window.clearTimeout(p)), l.current = [];
    };
  }, [u]), !e) return null;
  const d = Jo(e.highlight.region, t), f = Fr(e.highlight.region), m = (P, p) => async (S) => {
    S.preventDefault(), S.stopPropagation();
    const k = await Hi(P);
    p(k ? "copied" : "failed"), l.current.push(window.setTimeout(() => p("idle"), 1200));
  }, g = f === "formula" ? "复制 LaTeX" : "复制", h = va(), b = !!(h != null && h.available()), v = (P) => {
    P.preventDefault(), P.stopPropagation();
    const p = !!(h != null && h.send(qi(e)));
    i(p ? "copied" : "failed"), l.current.push(window.setTimeout(() => i("idle"), 1200));
  }, w = co(e.rect, b ? Ot + Gi : Ot);
  return /* @__PURE__ */ y("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ y(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": f,
      style: e.rect,
      children: /* @__PURE__ */ $(
        "div",
        {
          className: so,
          "data-placement": w ? "outside" : "inside",
          children: [
            An() === "studio" ? null : /* @__PURE__ */ y(
              Gt,
              {
                className: Vi,
                state: a,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: m(e.itemId, s),
                children: a === "copied" ? "已复制编号" : e.itemId
              }
            ),
            t === "translated" && n > 0 ? /* @__PURE__ */ $("span", { className: "reader-text-hover-revised", "data-reader-revised-count": n, children: [
              "改过 ",
              n,
              " 次"
            ] }) : null,
            d ? /* @__PURE__ */ y(
              Gt,
              {
                className: Wi,
                state: r,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                onClick: m(d, o),
                children: r === "copied" ? "已复制" : r === "failed" ? "复制失败" : g
              }
            ) : null,
            b ? /* @__PURE__ */ y(
              Gt,
              {
                className: Ji,
                state: c,
                label: "把这一段摘到笔记",
                title: "摘到笔记：这一段的译文（没翻译的放原文）放进正在写的笔记",
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
function Zi(e, t) {
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
function Yi(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const c = Rn(
      Zi(e, a),
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
const Xi = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Qi = 256, ft = /* @__PURE__ */ new Map();
function ec(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function tc(e) {
  const t = `${e || ""}`, { text: n, slots: r } = da(t, { bareLatex: !0 }), o = ec(n), a = fa(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = ft.get(t);
  if (!s && (s = ma(o, r), ft.set(t, s), ft.size > Qi)) {
    const c = ft.keys().next().value;
    c !== void 0 && ft.delete(c);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Kt(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ae(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function nc(e, t) {
  const n = e.typography, r = Ae(t) || 1, o = Ae(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), c = Kt(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, i = Math.max(5.5 * r, Math.min(s, c * r)), l = Ae(n == null ? void 0 : n.fit_min_font_size_pt), u = Ae(n == null ? void 0 : n.fit_max_font_size_pt), d = Math.max(3.5, (l || 5.5) * r), f = Math.max(
    d,
    u ? u * r : o ? o * r : i
  ), m = o ? o * r : i, g = Ae(n == null ? void 0 : n.leading_em), h = [
    Ae(n == null ? void 0 : n.padding_top_pt) || 0,
    Ae(n == null ? void 0 : n.padding_right_pt) || 0,
    Ae(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ae(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((b) => b * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Xi,
    fontSizePx: Math.max(d, Math.min(f, m)),
    minFontSizePx: d,
    maxFontSizePx: f,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Kt(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Kt(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function rc(e, t, n, r) {
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
const oc = 512, mt = /* @__PURE__ */ new Map();
let fn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  fn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  fn += 1;
}));
function ac(e, t, n, r) {
  return [
    fn,
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
function sc({ item: e, pageScale: t }) {
  const n = M(null), r = Z(
    () => tc(e.translatedText),
    [e.translatedText]
  ), [o, a] = C(r.fallbackHtml), s = Z(
    () => nc(e, t),
    [e, t]
  );
  z(() => {
    let d = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((f) => {
      d && a(f);
    }), () => {
      d = !1;
    };
  }, [r]), _e(() => {
    const d = n.current;
    if (!d) return;
    const [f, m, g, h] = s.padding, b = Math.max(1, e.rect.width - h - m), v = Math.max(1, e.rect.height - f - g), w = ac(o, b, v, s);
    let P = mt.get(w);
    if (P === void 0 && (P = rc(
      (p) => (d.style.fontSize = `${p}px`, { width: d.scrollWidth, height: d.scrollHeight }),
      b,
      v,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), mt.set(w, P), mt.size > oc)) {
      const p = mt.keys().next().value;
      p !== void 0 && mt.delete(p);
    }
    d.style.fontSize = `${P.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [c, i, l, u] = s.padding;
  return /* @__PURE__ */ y(
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
      children: /* @__PURE__ */ y(
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
function ic({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = Z(
    () => Yi(e, t, n, r),
    [r, e, t, n]
  );
  return o.length ? /* @__PURE__ */ y(
    "div",
    {
      className: "reader-live-translation-overlay",
      "data-live-translation-page": e == null ? void 0 : e.page_idx,
      "data-live-translation-generation": t == null ? void 0 : t.generation,
      "aria-hidden": "true",
      children: o.map((a) => /* @__PURE__ */ y(
        sc,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const cc = yn(ic), lo = vn(null), uo = vn(null);
function lc({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ y(lo.Provider, { value: e, children: /* @__PURE__ */ y(uo.Provider, { value: t, children: n }) });
}
function ze() {
  return Sn(lo);
}
function fo() {
  return Sn(uo);
}
const mo = 1.414;
function uc({
  pageNumber: e,
  width: t,
  devicePixelRatio: n,
  pane: r,
  active: o = !1,
  textLayer: a = !0,
  syncedMinHeight: s = 0,
  onMetrics: c,
  cachedAspect: i,
  onAspectChange: l,
  sentinelRef: u,
  regionHighlight: d = null,
  regionTargets: f = [],
  hoveredRegionId: m,
  onHoverRegion: g,
  liveTranslationLayout: h,
  liveTranslationPage: b,
  showLiveTranslation: v = r === "source"
}) {
  var pe, A;
  const w = (pe = ze()) == null ? void 0 : pe.revisedBlocks, P = (A = ze()) == null ? void 0 : A.quotedBlocks, p = M(i ?? mo), [S, k] = C(p.current);
  z(() => {
    i != null && Math.abs(i - p.current) >= 1e-3 && (p.current = i, k(i));
  }, [i]);
  const _ = M(u);
  _.current = u;
  const B = M(null), O = M((I) => {
    var te;
    B.current = I, (te = _.current) == null || te.call(_, I);
  }).current, D = M(null), T = M(`${t}@${n}`);
  _e(() => {
    const I = `${t}@${n}`;
    T.current !== I && (T.current = I, o && fc(B.current, D.current));
  }, [o, n, t]), z(() => {
    o || Zt(D.current);
  }, [o]), z(() => () => Zt(D.current), []);
  const R = Math.max(120, Math.floor(t * S)), E = Math.max(R, Math.ceil(s || 0)), N = Rn(d, t, R), F = Z(
    () => Ui(f, t, R),
    [R, f, t]
  ), [U, q] = C(null), J = typeof g == "function", re = J ? m ?? null : U, x = (I) => {
    J ? I !== (m ?? null) && (g == null || g(I)) : q((te) => te === I ? te : I);
  }, K = Z(
    () => F.find((I) => I.itemId === re) || null,
    [re, F]
  ), oe = (I) => {
    var ge, Ee;
    if (I.pointerType === "touch") return;
    if (I.buttons !== 0) {
      x(null);
      return;
    }
    if ((Ee = (ge = I.target) == null ? void 0 : ge.closest) != null && Ee.call(ge, `.${so}`)) return;
    const te = I.currentTarget.getBoundingClientRect(), ae = I.clientX - te.left, Te = I.clientY - te.top, Se = K == null ? void 0 : K.rect;
    if (Se && co(Se) && ae >= Se.left - 4 && ae <= Se.left + Ot && Te >= Se.top - io && Te <= Se.top) return;
    const we = cr(F, ae, Te);
    x((we == null ? void 0 : we.itemId) || null);
  }, ee = (I) => {
    if (I.pointerType === "mouse") return;
    const te = I.currentTarget.getBoundingClientRect(), ae = cr(
      F,
      I.clientX - te.left,
      I.clientY - te.top
    );
    x((ae == null ? void 0 : ae.itemId) || null);
  }, se = (I) => {
    !Number.isFinite(I) || I <= 0 || Math.abs(p.current - I) < 1e-3 || (p.current = I, k(I), l == null || l(e, I));
  };
  return /* @__PURE__ */ $(
    "div",
    {
      ref: O,
      [Ue]: e,
      [rt]: r,
      [Tn]: R,
      className: En,
      onPointerMoveCapture: oe,
      onPointerDown: ee,
      onPointerLeave: (I) => {
        I.pointerType === "mouse" && x(null);
      },
      style: {
        width: t,
        height: E,
        minHeight: E
      },
      children: [
        o ? /* @__PURE__ */ y(
          la,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            renderAnnotationLayer: !1,
            className: Wr,
            loading: /* @__PURE__ */ y(
              "div",
              {
                className: Ct,
                style: { width: t, height: R }
              }
            ),
            onLoadSuccess: (I) => {
              try {
                const te = I.getViewport({ scale: 1 });
                if (te.width > 0) {
                  const ae = te.height / te.width;
                  se(ae);
                }
              } catch {
              }
              c == null || c();
            },
            onRenderSuccess: () => {
              Zt(D.current), c == null || c();
            }
          }
        ) : /* @__PURE__ */ y(
          "div",
          {
            className: Ct,
            style: { width: t, height: R },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ y("div", { ref: D, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        N ? /* @__PURE__ */ y(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": d == null ? void 0 : d.itemId,
            style: N,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && v ? /* @__PURE__ */ y(
          cc,
          {
            layoutPage: h,
            pageState: b,
            width: t,
            height: R
          }
        ) : null,
        o && (P != null && P.size) ? /* @__PURE__ */ y("div", { className: "reader-quoted-markers", "aria-hidden": "true", children: F.filter((I) => P.has(I.itemId)).map((I) => /* @__PURE__ */ y(
          "span",
          {
            className: "reader-quoted-marker",
            "data-reader-quoted-id": I.itemId,
            title: "摘过",
            style: { left: I.rect.left, top: I.rect.top, height: I.rect.height }
          },
          I.itemId
        )) }) : null,
        o && r === "translated" && (w != null && w.size) ? /* @__PURE__ */ y("div", { className: "reader-revised-markers", "aria-hidden": "true", children: F.filter((I) => w.has(I.itemId)).map((I) => /* @__PURE__ */ y(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": I.itemId,
            style: { left: I.rect.left, top: I.rect.top, height: I.rect.height }
          },
          I.itemId
        )) }) : null,
        /* @__PURE__ */ y(
          Ki,
          {
            target: o ? K : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: K && (w == null ? void 0 : w.get(K.itemId)) || 0
          }
        )
      ]
    }
  );
}
const dc = yn(uc);
function fc(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function Zt(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const Yt = 5, mc = "120% 0px", hc = 120, pc = "25% 0px";
let lr = 1;
const ur = /* @__PURE__ */ new WeakMap();
function gc(e) {
  if (!e) return 0;
  const t = ur.get(e);
  if (t) return t;
  const n = lr;
  return lr += 1, ur.set(e, n), n;
}
function bc() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const yc = Do(
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
    regions: h = [],
    readerMetadata: b = null,
    hoveredRegionId: v = null,
    onHoverRegion: w,
    liveTranslation: P,
    showLiveTranslation: p = t === "source",
    liveTranslationPendingLabel: S = "",
    paneAction: k
  }, _) {
    ji();
    const { file: B, loading: O, error: D } = Qa(n, r), T = `${n}\0${gc(B)}`, R = M(T);
    R.current = T;
    const E = Z(
      () => qa(B),
      [B, n]
    ), [N, F] = C(0), [U, q] = C(""), [J, re] = C(null), [x, K] = C(480), oe = M(null), ee = M(0), se = Z(() => bc(), []), pe = Z(() => ({
      cMapUrl: bt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: bt().resolvePdfjsVendorUrl("standard_fonts/")
    }), []);
    wn(_, () => J, [J]), z(() => {
      const L = (H) => {
        ee.current = H, K(H);
      }, V = (H) => {
        const X = Ts(H, ee.current);
        if (X !== "ignore") {
          if (oe.current && clearTimeout(oe.current), X === "immediate") {
            L(H);
            return;
          }
          oe.current = setTimeout(() => L(H), Gr);
        }
      }, W = !!(i && i >= 80);
      V(W ? i : (c == null ? void 0 : c.clientWidth) || 0);
      const Q = !W && c && typeof ResizeObserver < "u" ? new ResizeObserver((H) => {
        var X, ue;
        V(((ue = (X = H[0]) == null ? void 0 : X.contentRect) == null ? void 0 : ue.width) ?? c.clientWidth);
      }) : null;
      return Q && c && Q.observe(c), () => {
        Q == null || Q.disconnect(), oe.current && clearTimeout(oe.current);
      };
    }, [i, c, a]);
    const A = Z(
      () => Ps(x, o),
      [x, o]
    ), [I, te] = C(() => /* @__PURE__ */ new Map()), [ae, Te] = C(() => /* @__PURE__ */ new Set()), [Se, we] = C(() => /* @__PURE__ */ new Set()), ge = M(/* @__PURE__ */ new Map()), Ee = M(null), ne = M(null), [de, be] = C(() => /* @__PURE__ */ new Set()), ie = M(/* @__PURE__ */ new Map()), fe = j((L, V) => {
      te((W) => {
        if (W.get(L) === V) return W;
        const G = new Map(W);
        return G.set(L, V), G;
      });
    }, []), ce = j((L, V) => {
      const W = ge.current, G = W.get(L), Q = [Ee.current, ne.current];
      if (G)
        for (const H of Q)
          try {
            H == null || H.unobserve(G);
          } catch {
          }
      if (V) {
        W.set(L, V);
        for (const H of Q)
          try {
            H == null || H.observe(V);
          } catch {
          }
      } else
        W.delete(L);
    }, []), Ge = M(/* @__PURE__ */ new Map()), Ke = j((L) => {
      const V = Ge.current;
      let W = V.get(L);
      return W || (W = (G) => ce(L, G), V.set(L, W)), W;
    }, [ce]);
    z(() => {
      if (typeof IntersectionObserver > "u") return;
      const L = ie.current, V = new IntersectionObserver(
        (W) => {
          const G = [], Q = [];
          for (const H of W) {
            const X = H.target, ue = xt(X);
            Number.isFinite(ue) && (H.isIntersecting ? G : Q).push(ue);
          }
          if ((G.length || Q.length) && Te((H) => {
            let X = null;
            for (const ue of G)
              H.has(ue) || (X = X || new Set(H), X.add(ue));
            for (const ue of Q)
              H.has(ue) && (X = X || new Set(H), X.delete(ue));
            return X || H;
          }), G.length) {
            for (const H of G) {
              const X = L.get(H);
              X && (clearTimeout(X), L.delete(H));
            }
            we((H) => {
              let X = null;
              for (const ue of G)
                H.has(ue) || (X = X || new Set(H), X.add(ue));
              return X || H;
            });
          }
          for (const H of Q)
            L.has(H) || L.set(H, setTimeout(() => {
              L.delete(H), we((X) => {
                if (!X.has(H)) return X;
                const ue = new Set(X);
                return ue.delete(H), ue;
              });
            }, hc));
        },
        { root: c, rootMargin: mc, threshold: 0 }
      );
      Ee.current = V;
      for (const W of ge.current.values())
        try {
          V.observe(W);
        } catch {
        }
      return () => {
        V.disconnect(), Ee.current === V && (Ee.current = null);
        for (const W of L.values()) clearTimeout(W);
        L.clear();
      };
    }, [c]), z(() => {
      if (typeof IntersectionObserver > "u") return;
      const L = new IntersectionObserver(
        (V) => {
          be((W) => {
            let G = null;
            for (const Q of V) {
              const H = xt(Q.target);
              !Number.isFinite(H) || Q.isIntersecting === W.has(H) || (G = G || new Set(W), Q.isIntersecting ? G.add(H) : G.delete(H));
            }
            return G || W;
          });
        },
        { root: c, rootMargin: pc, threshold: 0 }
      );
      ne.current = L;
      for (const V of ge.current.values())
        try {
          L.observe(V);
        } catch {
        }
      return () => {
        L.disconnect(), ne.current === L && (ne.current = null);
      };
    }, [c]);
    const lt = !!c && typeof IntersectionObserver < "u";
    _e(() => {
      F(0), q(""), Te(/* @__PURE__ */ new Set()), we(/* @__PURE__ */ new Set()), te(/* @__PURE__ */ new Map()), ge.current.clear();
      const L = ie.current;
      for (const V of L.values()) clearTimeout(V);
      L.clear(), m == null || m(0, t);
    }, [T, m, t]);
    const Ht = j(
      ({ numPages: L }) => {
        R.current === T && (F(L), q(""), m == null || m(L, t), d == null || d({ numPages: L, pane: t }));
      },
      [T, d, m, t]
    ), Wt = j(
      (L) => {
        if (R.current !== T) return;
        const V = (L == null ? void 0 : L.message) || "PDF 解析失败";
        q(V), F(0), m == null || m(0, t), f == null || f(L, t);
      },
      [T, f, m, t]
    ), Le = Z(
      () => N > 0 ? Array.from({ length: N }, (L, V) => V + 1) : [],
      [N]
    );
    z(() => {
      typeof IntersectionObserver < "u" || we(new Set(Le));
    }, [Le]);
    const Ce = Z(
      () => Kn(g, b, t),
      [g, b, t]
    ), Oe = Z(() => {
      const L = /* @__PURE__ */ new Map();
      for (const V of h) {
        const W = Kn(V, b, t);
        if (!W) continue;
        const G = L.get(W.box.page) || [];
        G.push(W), L.set(W.box.page, G);
      }
      return L;
    }, [t, b, h]), Rt = Z(() => {
      const L = /* @__PURE__ */ new Set();
      if (!v) return L;
      for (const [V, W] of Oe)
        W.some((G) => G.itemId === v) && L.add(V);
      return L;
    }, [v, Oe]), It = Z(() => {
      if (N === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!c && typeof IntersectionObserver < "u")) return new Set(Le);
      if (ae.size === 0) {
        const W = Math.min(N, Yt * 2 + 1);
        return new Set(Array.from({ length: W }, (G, Q) => Q + 1));
      }
      const V = /* @__PURE__ */ new Set();
      for (const W of ae)
        for (let G = -Yt; G <= Yt; G++) {
          const Q = W + G;
          Q >= 1 && Q <= N && V.add(Q);
        }
      return V;
    }, [N, Le, c, a, ae]), Ze = !n || !!D || !!U, Tt = n && (D || U) || s;
    return /* @__PURE__ */ $(
      "section",
      {
        ref: re,
        className: `reader-panel ${ps}${a ? "" : " is-hidden"}`,
        [rt]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (P == null ? void 0 : P.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          k ? /* @__PURE__ */ y("div", { className: "reader-react-pdf-pane-action", children: k }) : null,
          S ? /* @__PURE__ */ $("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ y("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ y("span", { children: S })
          ] }) : null,
          Ze && !O ? /* @__PURE__ */ y("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Tt }) : null,
          O ? /* @__PURE__ */ y("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          E && !D ? /* @__PURE__ */ y("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ y(
            ua,
            {
              file: E,
              loading: null,
              error: null,
              options: pe,
              onLoadSuccess: Ht,
              onLoadError: Wt,
              className: "reader-react-pdf-document",
              children: Le.map((L) => {
                if (It.has(L))
                  return /* @__PURE__ */ y(
                    dc,
                    {
                      pane: t,
                      pageNumber: L,
                      width: A,
                      devicePixelRatio: se,
                      active: Se.has(L),
                      textLayer: !lt || de.has(L),
                      syncedMinHeight: (l == null ? void 0 : l.get(L)) || 0,
                      onMetrics: u,
                      cachedAspect: I.get(L),
                      onAspectChange: fe,
                      sentinelRef: Ke(L),
                      regionHighlight: (Ce == null ? void 0 : Ce.box.page) === L ? Ce : null,
                      regionTargets: Oe.get(L),
                      hoveredRegionId: v && Rt.has(L) ? v : null,
                      onHoverRegion: w,
                      liveTranslationLayout: P == null ? void 0 : P.layoutByPage.get(L - 1),
                      liveTranslationPage: P == null ? void 0 : P.pagesByPage.get(L - 1),
                      showLiveTranslation: p
                    },
                    `${t}-${L}`
                  );
                const W = I.get(L) ?? mo, G = Math.max(120, Math.floor(A * W)), Q = Math.max(G, Math.ceil((l == null ? void 0 : l.get(L)) || 0));
                return /* @__PURE__ */ y(
                  "div",
                  {
                    ref: Ke(L),
                    [Ue]: L,
                    [rt]: t,
                    [Tn]: G,
                    className: `${En} is-placeholder`,
                    style: {
                      width: A,
                      height: Q,
                      minHeight: Q
                    },
                    children: /* @__PURE__ */ y(
                      "div",
                      {
                        className: Ct,
                        style: { width: A, height: G },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${L}`
                );
              })
            },
            T
          ) }) : null
        ]
      }
    );
  }
), dr = yn(yc), vc = 2e3, Sc = 6, wc = 500, fr = "reader-react-resizing";
function Pc(e, t) {
  const n = M(null), r = M(null);
  _e(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const p = Rc(e), S = Nt(e, p);
      if (!S) return;
      s = { pane: p, progress: S, started: performance.now() };
    }
    const { pane: c, progress: i, started: l } = s;
    let u = 0, d = null, f = e.scrollHeight, m = f, g = 0, h = l;
    const b = /* @__PURE__ */ new WeakMap(), v = typeof ResizeObserver > "u" ? null : new ResizeObserver((p) => {
      let S = !1;
      for (const k of p) {
        const _ = Math.round(k.contentRect.height);
        b.has(k.target) && b.get(k.target) !== _ && (S = !0), b.set(k.target, _);
      }
      S && yt(e, i, "auto", c);
    }), w = () => {
      var p;
      d && clearTimeout(d), cancelAnimationFrame(u), v == null || v.disconnect(), e.classList.remove(fr);
      for (const S of mr) e.removeEventListener(S, w);
      ((p = r.current) == null ? void 0 : p.stop) === w && (r.current = null);
    }, P = () => {
      yt(e, i, "auto", c);
      const p = e.scrollHeight;
      g = p === m ? g + 1 : 0, m = p;
      const S = performance.now() - h;
      g >= Sc && (p !== f || S > wc) || S > vc ? w() : u = requestAnimationFrame(P);
    };
    for (const p of mr) e.addEventListener(p, w, { passive: !0 });
    for (const p of Array.from(e.children)) v == null || v.observe(p);
    e.classList.add(fr), r.current = { ...s, stop: w }, d = setTimeout(() => {
      d = null, h = performance.now(), f = e.scrollHeight, m = f, g = 0, u = requestAnimationFrame(P);
    }, Gr);
  }, [e, t]), z(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Rc(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Ue}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(rt) || null;
  }
  return null;
}
const mr = ["wheel", "touchstart", "keydown", "pointerdown"], Ic = () => () => {
}, hr = () => null;
function Tc({
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
function Ec(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function kc(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Mc(e) {
  const t = ze(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", c = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", i = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, d = e.bindShell ?? (t == null ? void 0 : t.bindShell), f = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Pt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), b = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, v = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, w = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, P = e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", p = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", S = e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, k = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, _ = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), B = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), O = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), D = e.regions ?? (t == null ? void 0 : t.regions) ?? [], T = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), R = (t == null ? void 0 : t.regionHover) ?? null, [E, N] = C(null), F = it(
    R ? R.subscribe : Ic,
    R ? () => R.get().itemId : hr,
    R ? () => R.get().itemId : hr
  ), U = R ? F : E, q = j((K) => {
    R ? R.set(K, "pdf") : N(K);
  }, [R]), J = Tc({
    mode: s,
    compareMode: c,
    showSource: i,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), x = Number.isFinite(g) && g > 0 ? Ec(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return Pc(f, x), /* @__PURE__ */ y(
    "div",
    {
      ref: d,
      className: hs,
      "data-reader-region-count": D.length,
      "data-reader-structured-region-count": D.filter(qo).length,
      "data-reader-metadata-ready": T ? "true" : "false",
      children: /* @__PURE__ */ $(
        "main",
        {
          className: `${ms} reader-mode-${J.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            b ? /* @__PURE__ */ y(
              dr,
              {
                pane: "source",
                url: P,
                preloadedFile: S,
                userZoom: m,
                visible: J.showSource,
                scrollRoot: f,
                pageWidthOverride: x,
                rowHeights: J.compareMode ? h : void 0,
                onMetrics: _,
                emptyLabel: w ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: B,
                activeRegion: O,
                regions: D,
                readerMetadata: T,
                hoveredRegionId: U,
                onHoverRegion: q,
                liveTranslation: u ? o : void 0,
                showLiveTranslation: u,
                liveTranslationPendingLabel: u ? kc(o) : "",
                paneAction: u ? /* @__PURE__ */ $($t, { children: [
                  e.sourcePaneAction,
                  /* @__PURE__ */ y(
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
            v ? /* @__PURE__ */ y(
              dr,
              {
                pane: "translated",
                url: p,
                preloadedFile: k,
                userZoom: m,
                visible: J.showTranslated,
                scrollRoot: f,
                pageWidthOverride: x,
                rowHeights: J.compareMode ? h : void 0,
                onMetrics: _,
                emptyLabel: "暂无译文 PDF",
                onNumPagesChange: B,
                activeRegion: O,
                regions: D,
                readerMetadata: T,
                hoveredRegionId: U,
                onHoverRegion: q,
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
const Ac = [
  { id: "source", label: "原文", Icon: $r },
  { id: "compare", label: "对照", Icon: jr },
  { id: "translated", label: "译文", Icon: Br }
];
function Nc(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function _c(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Lc(e) {
  const t = ze(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? Nc(a.state) : "";
  return /* @__PURE__ */ $("header", { className: "reader-workspace-bar", children: [
    a ? /* @__PURE__ */ $(
      "button",
      {
        type: "button",
        className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
        "aria-pressed": a.visible,
        "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
        title: a.state.error || c,
        onClick: a.onToggle,
        children: [
          /* @__PURE__ */ y(Qo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ y("span", { className: "reader-live-translation-toggle-label", children: c })
        ]
      }
    ) : null,
    /* @__PURE__ */ y("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Ac.map(({ id: i, label: l, Icon: u }) => {
      const d = n === i, f = _c({
        id: i,
        documentReady: r,
        sourceViewOnly: s,
        liveTranslationAvailable: !!a
      });
      return /* @__PURE__ */ $(
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
            /* @__PURE__ */ y(u, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ y("span", { className: "reader-workspace-tab-label", children: l })
          ]
        },
        i
      );
    }) })
  ] });
}
const Cc = () => () => {
}, Dc = () => !1;
function xc() {
  const e = Pa(), t = (e == null ? void 0 : e.available) ?? Dc, n = it((e == null ? void 0 : e.subscribe) ?? Cc, t, t), r = j(() => !!(e != null && e.available() && e.ask()), [e]);
  return { available: n, ask: r };
}
const zc = {
  markdown: { label: "Markdown", short: "MD", Icon: ea, needsJob: !0 }
}, Oc = Kr.map(
  (e) => ({ id: e, ...zc[e] })
);
function Fc() {
  return Oc.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function $c(e) {
  const t = ze(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), c = xc(), i = [
    ...Fc().map(({ id: l, label: u, short: d, Icon: f, needsJob: m }) => ({
      key: l,
      label: u,
      short: d,
      Icon: f,
      disabled: m && o,
      selected: n === l,
      badge: r == null ? void 0 : r[l],
      onClick: () => a(l)
    })),
    ...c.available ? [{ key: "host-ai", label: "AI", short: "AI", Icon: ta, disabled: !1, selected: !1, onClick: () => void c.ask() }] : []
  ];
  return n ? /* @__PURE__ */ $("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ y("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: l, label: u, Icon: d, disabled: f, selected: m, badge: g, onClick: h }) => /* @__PURE__ */ $(
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
          /* @__PURE__ */ y(d, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ y("span", { className: "reader-assistant-dock-tab-label", children: u }),
          g ? /* @__PURE__ */ y("span", { className: "reader-assistant-dock-badge", children: g }) : null
        ]
      },
      l
    )) }),
    /* @__PURE__ */ y(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ y(In, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : /* @__PURE__ */ y("nav", { className: "reader-assistant-rail", "aria-label": "阅读辅助工具", children: i.map(({ key: l, label: u, short: d, Icon: f, disabled: m, badge: g, onClick: h }) => /* @__PURE__ */ $(
    "button",
    {
      type: "button",
      className: "reader-assistant-rail-button",
      "aria-label": `打开${u}`,
      title: m ? `${u} 需打开任务阅读` : u,
      disabled: m,
      onClick: h,
      children: [
        /* @__PURE__ */ y(f, { size: 18, strokeWidth: 2, "aria-hidden": !0 }),
        /* @__PURE__ */ y("span", { children: d }),
        g ? /* @__PURE__ */ y("span", { className: "reader-assistant-dock-badge", children: g }) : null
      ]
    },
    l
  )) });
}
function jc(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Bc(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Uc(e) {
  return e / 100 * window.innerHeight;
}
function Hc(e) {
  return e / 100 * window.innerWidth;
}
function Wc(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function ht({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Wc(n);
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
      r = Bc(t, o);
      break;
    }
    case "em": {
      r = jc(t, o);
      break;
    }
    case "vh": {
      r = Uc(o);
      break;
    }
    case "vw": {
      r = Hc(o);
      break;
    }
  }
  return r;
}
function he(e) {
  return parseFloat(e.toFixed(3));
}
function st({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function mn(e) {
  const { panels: t } = e, n = st({ group: e });
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
      const u = ht({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = he(u / n * 100);
    }
    let c;
    if (a.defaultSize !== void 0) {
      const u = ht({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      c = he(u / n * 100);
    }
    let i = 0;
    if (a.minSize !== void 0) {
      const u = ht({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      i = he(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = ht({
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
function Y(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function hn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Vc : Jc
  );
}
function Vc(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Jc(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function ho(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function po(e, t) {
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
function qc({
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
    const { x: c, y: i } = po(r, s), l = e === "horizontal" ? c : i;
    l < a && (a = l, o = s);
  }
  return Y(o, "No rect found"), o;
}
let Mt;
function Gc() {
  return Mt === void 0 && (typeof matchMedia == "function" ? Mt = !!matchMedia("(pointer:coarse)").matches : Mt = !1), Mt;
}
function go(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = hn(
    n,
    Array.from(t.children).filter(ho).map((g) => ({ element: g }))
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
        const b = r.find(
          (v) => v.element === h
        );
        if (b) {
          if (f) {
            const v = f.element.getBoundingClientRect(), w = h.getBoundingClientRect();
            let P;
            if (i) {
              const p = n === "horizontal" ? new DOMRect(
                v.right,
                v.top,
                0,
                v.height
              ) : new DOMRect(
                v.left,
                v.bottom,
                v.width,
                0
              ), S = n === "horizontal" ? new DOMRect(w.left, w.top, 0, w.height) : new DOMRect(w.left, w.top, w.width, 0);
              switch (m.length) {
                case 0: {
                  P = [
                    p,
                    S
                  ];
                  break;
                }
                case 1: {
                  const k = m[0], _ = qc({
                    orientation: n,
                    rects: [v, w],
                    targetRect: k.element.getBoundingClientRect()
                  });
                  P = [
                    k,
                    _ === v ? S : p
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
                  w.top,
                  w.left - v.right,
                  w.height
                ) : new DOMRect(
                  w.left,
                  v.bottom,
                  w.width,
                  w.top - v.bottom
                )
              ];
            for (const p of P) {
              let S = "width" in p ? p : p.element.getBoundingClientRect();
              const k = Gc() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (S.width < k) {
                const B = k - S.width;
                S = new DOMRect(
                  S.x - B / 2,
                  S.y,
                  S.width + B,
                  S.height
                );
              }
              if (S.height < k) {
                const B = k - S.height;
                S = new DOMRect(
                  S.x,
                  S.y - B / 2,
                  S.width,
                  S.height + B
                );
              }
              const _ = g <= l || g > u;
              !c && !_ && s.push({
                group: e,
                groupSize: st({ group: e }),
                panels: [f, b],
                separator: "width" in p ? void 0 : p,
                rect: S
              }), c = !1;
            }
          }
          i = !1, f = b, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (c = !0);
        const b = o.find(
          (v) => v.element === h
        );
        b ? m.push(b) : (f = void 0, m = []);
      } else
        i = !0;
  }
  return s;
}
var De;
class bo {
  constructor() {
    Jn(this, De, {});
  }
  addListener(t, n) {
    const r = ut(this, De)[t];
    return r === void 0 ? ut(this, De)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = ut(this, De)[t];
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
    qn(this, De, {});
  }
  removeListener(t, n) {
    const r = ut(this, De)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
De = new WeakMap();
let tt = {
  cursorFlags: 0,
  state: "inactive"
};
const Nn = new bo();
function He() {
  return tt;
}
function Kc(e) {
  return Nn.addListener("change", e);
}
function Zc(e) {
  const t = tt, n = { ...tt };
  n.cursorFlags = e, tt = n, Nn.emit("change", {
    prev: t,
    next: n
  });
}
function nt(e) {
  const t = tt;
  tt = e, Nn.emit("change", {
    prev: t,
    next: e
  });
}
const Yc = (e) => e, Xt = () => {
}, yo = 1, vo = 2, So = 4, wo = 8, pr = 3, gr = 12;
let At;
function br() {
  return At === void 0 && (At = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (At = !0)), At;
}
function Xc({
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
        if (e && br()) {
          const a = (e & yo) !== 0, s = (e & vo) !== 0, c = (e & So) !== 0, i = (e & wo) !== 0;
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
    return br() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const yr = /* @__PURE__ */ new WeakMap();
function _n(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = yr.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = He();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Xc({
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
  yr.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Re = /* @__PURE__ */ new Map();
const Po = new bo();
function Qc(e) {
  Re = new Map(Re), Re.delete(e);
}
function vr(e, t) {
  for (const [n] of Re)
    if (n.id === e)
      return n;
}
function xe(e, t) {
  for (const [n, r] of Re)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function Je() {
  return Re;
}
function Ln(e, t) {
  return Po.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ne(e, t, n) {
  const r = Re.get(e);
  Re = new Map(Re), Re.set(e, t), Po.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Ro(e) {
  const t = He();
  let n = !1;
  switch (t.state) {
    case "active":
      nt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (_n(e), n = !0, t.hitRegions.forEach((r) => {
        const o = xe(r.group.id, !0);
        Ne(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Sr(e) {
  e.defaultPrevented || Ro(e.currentTarget);
}
function el(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = po(n, a.rect);
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
function tl(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function nl(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Rr(e),
    b: Rr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  Y(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: Pr(wr(n.a)),
    b: Pr(wr(n.b))
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
const rl = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function ol(e) {
  const t = getComputedStyle(Io(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function al(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || ol(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || rl.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function wr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (Y(n, "Missing node"), al(n)) return n;
  }
  return null;
}
function Pr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Rr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Io(e);
  return t;
}
function Io(e) {
  const { parentNode: t } = e;
  return tl(t) ? t.host : t;
}
function sl(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function il({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!ho(n) || n.contains(e) || e.contains(n))
    return !0;
  if (nl(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (sl(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function Cn(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = go(o), s = el(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && il({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function cl(e, t) {
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
function Pe(e, t) {
  return me(e, t) ? 0 : e > t ? 1 : -1;
}
function et({
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
  if (Pe(r, i) < 0)
    if (a) {
      const l = (o + i) / 2;
      Pe(r, l) < 0 ? r = o : r = i;
    } else
      r = i;
  return r = Math.min(c, r), r = he(r), r;
}
function vt({
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
  Y(u != null, "Invalid first pivot index"), Y(d != null, "Invalid second pivot index");
  let f = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? d : u, b = n[h];
        Y(
          b,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: v = 0,
          collapsible: w,
          minSize: P = 0
        } = b;
        if (w) {
          const p = c[h];
          if (Y(
            p != null,
            `Previous layout not found for panel index ${h}`
          ), me(p, v)) {
            const S = P - p;
            Pe(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      {
        const h = e < 0 ? u : d, b = n[h];
        Y(
          b,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: v = 0,
          collapsible: w,
          minSize: P = 0
        } = b;
        if (w) {
          const p = c[h];
          if (Y(
            p != null,
            `Previous layout not found for panel index ${h}`
          ), me(p, P)) {
            const S = p - v;
            Pe(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? d : u, b = n[h];
      Y(
        b,
        `Panel constraints not found for index ${h}`
      );
      const v = c[h], { collapsible: w, collapsedSize: P, minSize: p } = b;
      if (w && Pe(v, p) < 0)
        if (e > 0) {
          const S = p - P, k = S / 2, _ = v + e;
          Pe(_, p) < 0 && (e = Pe(e, k) <= 0 ? 0 : S);
        } else {
          const S = p - P, k = 100 - S / 2, _ = v - e;
          Pe(_, p) < 0 && (e = Pe(100 + e, k) > 0 ? 0 : -S);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let b = e < 0 ? d : u, v = 0;
    for (; ; ) {
      const P = c[b];
      Y(
        P != null,
        `Previous layout not found for panel index ${b}`
      );
      const p = et({
        overrideDisabledPanels: s,
        panelConstraints: n[b],
        prevSize: P,
        size: 100
      }) - P;
      if (v += p, b += h, b < 0 || b >= n.length)
        break;
    }
    const w = Math.min(Math.abs(e), Math.abs(v));
    e = e < 0 ? 0 - w : w;
  }
  {
    let h = e < 0 ? u : d;
    for (; h >= 0 && h < n.length; ) {
      const b = Math.abs(e) - Math.abs(f), v = c[h];
      Y(
        v != null,
        `Previous layout not found for panel index ${h}`
      );
      const w = v - b, P = et({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: v,
        size: w
      });
      if (!me(v, P) && (f += v - P, l[h] = P, f.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (cl(i, l))
    return o;
  {
    const h = e < 0 ? d : u, b = c[h];
    Y(
      b != null,
      `Previous layout not found for panel index ${h}`
    );
    const v = b + f, w = et({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: b,
      size: v
    });
    if (l[h] = w, !me(w, v)) {
      let P = v - w, p = e < 0 ? d : u;
      for (; p >= 0 && p < n.length; ) {
        const S = l[p];
        Y(
          S != null,
          `Previous layout not found for panel index ${p}`
        );
        const k = S + P, _ = et({
          overrideDisabledPanels: s,
          panelConstraints: n[p],
          prevSize: S,
          size: k
        });
        if (me(S, _) || (P -= _ - S, l[p] = _), me(P, 0))
          break;
        e > 0 ? p-- : p++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, b) => b + h,
    0
  );
  if (!me(m, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, b, v) => (h[g[v]] = b, h), {});
}
function We(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Pe(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function Ve({
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
      Y(i != null, `No layout data found for index ${c}`);
      const l = 100 / o * i;
      r[c] = l;
    }
  let a = 0;
  for (let c = 0; c < t.length; c++) {
    const i = n[c];
    Y(i != null, `No layout data found for index ${c}`);
    const l = r[c];
    Y(l != null, `No layout data found for index ${c}`);
    const u = et({
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
      Y(i != null, `No layout data found for index ${c}`);
      const l = i + a, u = et({
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
function To({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const i = Je();
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
    const f = a(), m = l.findIndex((b) => b.id === t), g = m === 0, h = m === l.length - 1;
    if (h && i < f && (g || l.slice(0, m).every((b, v) => {
      const w = d[v];
      return (w == null ? void 0 : w.collapsible) && me(w.collapsedSize, u[w.panelId]);
    }))) {
      const b = l.slice(0, m).reduce((v, w) => v + u[w.id], 0);
      return {
        ...u,
        [t]: he(100 - b)
      };
    }
    return vt({
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
      separatorToPanels: h
    } = n(), b = s({
      nextSize: i,
      panels: f.panels,
      prevLayout: g,
      derivedPanelConstraints: d
    }), v = Ve({
      layout: b,
      panelConstraints: d
    });
    We(g, v) || Ne(f, {
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
      const { group: l } = n(), { element: u } = o(), d = st({ group: l }), f = ht({
        groupSize: d,
        panelElement: u,
        styleProp: i
      }), m = he(f / d * 100);
      c(m);
    }
  };
}
function Ir(e) {
  if (e.defaultPrevented)
    return;
  const t = Je();
  Cn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = To({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function _t(e) {
  const t = Je();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Eo({
  groupId: e
}) {
  const t = () => {
    const n = Je();
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
      } = t(), l = Ve({
        layout: n,
        panelConstraints: o
      });
      return r ? c : (We(c, l) || Ne(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: i
      }), l);
    }
  };
}
function Fe(e, t) {
  const n = _t(e), r = xe(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  Y(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  Y(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), c = Eo({ groupId: n.id }).getLayout(), i = vt({
    delta: t,
    initialLayout: c,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: c,
    trigger: "keyboard"
  }), l = Ve({
    layout: i,
    panelConstraints: r.derivedPanelConstraints
  });
  We(c, l) || Ne(
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
function Tr(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = _t(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && Fe(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && Fe(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && Fe(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && Fe(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), Fe(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = _t(t), o = xe(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: c } = o, i = r.separators.find(
          (f) => f.element === t
        );
        Y(i, "Matching separator not found");
        const l = c.get(i);
        Y(l, "Matching panels not found");
        const u = l[0], d = a.find(
          (f) => f.panelId === u.id
        );
        if (Y(d, "Panel metadata not found"), d.collapsible) {
          const f = s[u.id], m = d.collapsedSize === f ? r.mutableState.expandedPanelSizes[u.id] ?? d.minSize : d.collapsedSize;
          Fe(t, m - f);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = _t(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        Y(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), Fe(t, -100);
        break;
      }
    }
}
function Er(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = Je(), n = Cn(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), nt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function ko({
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
    const { group: u, groupSize: d } = l, { orientation: f, panels: m } = u, { disableCursor: g } = u.mutableState;
    let h = 0;
    a ? f === "horizontal" ? h = (t.clientX - a.x) / d * 100 : h = (t.clientY - a.y) / d * 100 : f === "horizontal" ? h = t.clientX < 0 ? -100 : 100 : h = t.clientY < 0 ? -100 : 100;
    const b = r.get(u), v = o.get(u);
    if (!b || !v)
      return;
    const {
      defaultLayoutDeferred: w,
      derivedPanelConstraints: P,
      groupSize: p,
      layout: S,
      separatorToPanels: k
    } = v;
    if (P && S && k) {
      const _ = vt({
        delta: h,
        initialLayout: b,
        panelConstraints: P,
        pivotIndices: l.panels.map((B) => m.indexOf(B)),
        prevLayout: S,
        trigger: "mouse-or-touch"
      });
      if (We(_, S)) {
        if (h !== 0 && !g)
          switch (f) {
            case "horizontal": {
              c |= h < 0 ? yo : vo;
              break;
            }
            case "vertical": {
              c |= h < 0 ? So : wo;
              break;
            }
          }
      } else
        Ne(l.group, {
          defaultLayoutDeferred: w,
          derivedPanelConstraints: P,
          groupSize: p,
          layout: _,
          separatorToPanels: k
        });
    }
  });
  let i = 0;
  t.movementX === 0 ? i |= s & pr : i |= c & pr, t.movementY === 0 ? i |= s & gr : i |= c & gr, Zc(i), _n(e);
}
function kr(e) {
  const t = Je(), n = He();
  switch (n.state) {
    case "active":
      ko({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Mr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = He(), n = Je();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        nt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = xe(a.group.id, !0);
          Ne(a.group, s, {
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
      ko({
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
      const a = Cn(e, n);
      a.length === 0 ? t.state !== "inactive" && nt({
        cursorFlags: 0,
        state: "inactive"
      }) : nt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), _n(e.currentTarget);
      break;
    }
  }
}
function Ar(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (He().state) {
      case "hover":
        nt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Nr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Ro(e.currentTarget) && e.preventDefault();
}
function _r(e) {
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
function ll(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((i) => i.element === t);
  if (!r || !r.onResize)
    return;
  const o = st({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, c = {
    asPercentage: he(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = c, r.onResize(c, r.id, s);
}
function ul(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function dl({
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
function fl(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Ye = /* @__PURE__ */ new Map();
function ml(e) {
  let t = !0;
  Y(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: b, target: v } = h;
      if (v === e.element) {
        if (t) {
          const w = st({ group: e });
          if (w === 0)
            return;
          const P = xe(e.id);
          if (!P)
            return;
          const p = mn(e), S = P.defaultLayoutDeferred ? _r(p) : P.layout, k = dl({
            group: e,
            nextGroupSize: w,
            prevGroupSize: P.groupSize,
            prevLayout: S
          }), _ = Ve({
            layout: k,
            panelConstraints: p
          });
          if (!P.defaultLayoutDeferred && We(P.layout, _) && ul(
            P.derivedPanelConstraints,
            p
          ) && P.groupSize === w)
            return;
          Ne(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: p,
            groupSize: w,
            layout: _,
            separatorToPanels: P.separatorToPanels
          });
        }
      } else
        ll(e, v, b);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    Y(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = st({ group: e }), c = mn(e), i = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (fl(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[i] ?? l ?? _r(c), d = Ve({
    layout: u,
    panelConstraints: c
  }), f = e.element.ownerDocument;
  Ye.set(
    f,
    (Ye.get(f) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return go(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
  }), Ne(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: c,
    groupSize: s,
    layout: d,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    Y(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", Tr);
  }), Ye.get(f) === 1 && (f.addEventListener("contextmenu", Sr, !0), f.addEventListener("dblclick", Ir, !0), f.addEventListener("pointerdown", Er, !0), f.addEventListener("pointerleave", kr), f.addEventListener("pointermove", Mr), f.addEventListener("pointerout", Ar), f.addEventListener("pointerup", Nr, !0)), function() {
    t = !1, Ye.set(
      f,
      Math.max(0, (Ye.get(f) ?? 0) - 1)
    ), Qc(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Tr);
    }), Ye.get(f) || (f.removeEventListener(
      "contextmenu",
      Sr,
      !0
    ), f.removeEventListener(
      "dblclick",
      Ir,
      !0
    ), f.removeEventListener(
      "pointerdown",
      Er,
      !0
    ), f.removeEventListener("pointerleave", kr), f.removeEventListener("pointermove", Mr), f.removeEventListener("pointerout", Ar), f.removeEventListener("pointerup", Nr, !0)), a.disconnect();
  };
}
function hl() {
  const [e, t] = C({}), n = j(() => t({}), []);
  return [e, n];
}
function Dn(e) {
  const t = zr();
  return `${e ?? t}`;
}
const qe = typeof window < "u" ? _e : z;
function pt(e) {
  const t = M(e);
  return qe(() => {
    t.current = e;
  }, [e]), j(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function xn(...e) {
  return pt((t) => {
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
function zn(e) {
  const t = M({ ...e });
  return qe(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Mo = vn(null);
function pl(e, t) {
  const n = M({
    getLayout: () => ({}),
    setLayout: Yc
  });
  wn(t, () => n.current, []), qe(() => {
    Object.assign(
      n.current,
      Eo({ groupId: e })
    );
  });
}
function Ao({
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
  }), h = pt((T) => {
    We(g.current.onLayoutChange, T) || (g.current.onLayoutChange = T, i == null || i(T));
  }), b = pt(
    (T, R) => {
      We(g.current.onLayoutChanged, T) || (g.current.onLayoutChanged = T, l == null || l(T, { isUserInteraction: R }));
    }
  ), v = Dn(c), w = M(null), [P, p] = hl(), S = M({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: d,
    separators: []
  }), k = xn(w, a);
  pl(v, s);
  const _ = pt(
    (T, R) => {
      const E = He(), N = vr(T), F = xe(T);
      if (F) {
        let U = !1;
        switch (E.state) {
          case "active": {
            U = E.hitRegions.some(
              (q) => q.group === N
            );
            break;
          }
        }
        return {
          flexGrow: F.layout[R] ?? 1,
          pointerEvents: U ? "none" : void 0
        };
      }
      if (n != null && n[R])
        return {
          flexGrow: n == null ? void 0 : n[R]
        };
    }
  ), B = zn({
    defaultLayout: n,
    disableCursor: r
  }), O = Z(
    () => ({
      get disableCursor() {
        return !!B.disableCursor;
      },
      getPanelStyles: _,
      id: v,
      orientation: u,
      registerPanel: (T) => {
        const R = S.current;
        return R.panels = hn(u, [
          ...R.panels,
          T
        ]), p(), () => {
          R.panels = R.panels.filter(
            (E) => E !== T
          ), p();
        };
      },
      registerSeparator: (T) => {
        const R = S.current;
        return R.separators = hn(u, [
          ...R.separators,
          T
        ]), p(), () => {
          R.separators = R.separators.filter(
            (E) => E !== T
          ), p();
        };
      },
      updatePanelProps: (T, { disabled: R }) => {
        const E = S.current.panels.find(
          (U) => U.id === T
        );
        E && (E.panelConstraints.disabled = R);
        const N = vr(v), F = xe(v);
        N && F && Ne(N, {
          ...F,
          derivedPanelConstraints: mn(N)
        });
      },
      updateSeparatorProps: (T, {
        disabled: R,
        disableDoubleClick: E
      }) => {
        const N = S.current.separators.find(
          (F) => F.id === T
        );
        N && (N.disabled = R, N.disableDoubleClick = E);
      }
    }),
    [_, v, p, u, B]
  ), D = M(null);
  return qe(() => {
    const T = w.current;
    if (T === null)
      return;
    const R = S.current;
    let E;
    if (B.defaultLayout !== void 0 && Object.keys(B.defaultLayout).length === R.panels.length) {
      E = {};
      for (const x of R.panels) {
        const K = B.defaultLayout[x.id];
        K !== void 0 && (E[x.id] = K);
      }
    }
    const N = {
      disabled: !!o,
      element: T,
      id: v,
      mutableState: {
        defaultLayout: E,
        disableCursor: !!B.disableCursor,
        expandedPanelSizes: S.current.lastExpandedPanelSizes,
        layouts: S.current.layouts
      },
      orientation: u,
      panels: R.panels,
      resizeTargetMinimumSize: R.resizeTargetMinimumSize,
      separators: R.separators
    };
    D.current = N;
    const F = ml(N), { defaultLayoutDeferred: U, derivedPanelConstraints: q, layout: J } = xe(N.id, !0);
    !U && q.length > 0 && (h(J), b(J, !1));
    const re = Ln(v, (x) => {
      const { defaultLayoutDeferred: K, derivedPanelConstraints: oe, layout: ee } = x.next;
      if (K || oe.length === 0)
        return;
      const se = N.panels.map(({ id: A }) => A).join(",");
      N.mutableState.layouts[se] = ee, oe.forEach((A) => {
        if (A.collapsible) {
          const { layout: I } = x.prev ?? {};
          if (I) {
            const te = me(
              A.collapsedSize,
              ee[A.panelId]
            ), ae = me(
              A.collapsedSize,
              I[A.panelId]
            );
            te && !ae && (N.mutableState.expandedPanelSizes[A.panelId] = I[A.panelId]);
          }
        }
      });
      const pe = He().state !== "active";
      h(ee), pe && b(ee, x.isUserInteraction);
    });
    return () => {
      D.current = null, F(), re();
    };
  }, [
    o,
    v,
    b,
    h,
    u,
    P,
    B
  ]), z(() => {
    const T = D.current;
    T && (T.mutableState.defaultLayout = n, T.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ y(Mo.Provider, { value: O, children: /* @__PURE__ */ y(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": v,
      id: v,
      ref: k,
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
Ao.displayName = "Group";
function On() {
  const e = Sn(Mo);
  return Y(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function gl(e, t) {
  const { id: n } = On(), r = M({
    collapse: Xt,
    expand: Xt,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Xt
  });
  wn(t, () => r.current, []), qe(() => {
    Object.assign(
      r.current,
      To({ groupId: n, panelId: e })
    );
  });
}
function pn({
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
  const h = !!i, b = Dn(i), v = zn({
    disabled: a
  }), w = M(null), P = xn(w, s), {
    getPanelStyles: p,
    id: S,
    orientation: k,
    registerPanel: _,
    updatePanelProps: B
  } = On(), O = d !== null, D = pt(
    (N, F, U) => {
      d == null || d(N, i, U);
    }
  );
  qe(() => {
    const N = w.current;
    if (N !== null) {
      const F = {
        element: N,
        id: b,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: O ? D : void 0,
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
      return _(F);
    }
  }, [
    c,
    n,
    r,
    o,
    O,
    b,
    h,
    l,
    u,
    D,
    _,
    v
  ]), z(() => {
    B(b, { disabled: a });
  }, [a, b, B]), gl(b, f);
  const T = () => {
    const N = p(S, b);
    if (N)
      return JSON.stringify(N);
  }, R = it(
    (N) => Ln(S, N),
    T,
    T
  );
  let E;
  return R ? E = JSON.parse(R) : o !== void 0 ? E = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : E = { flexGrow: 1 }, /* @__PURE__ */ y(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": b,
      id: b,
      ref: P,
      style: {
        ...bl,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...E
      },
      children: /* @__PURE__ */ y(
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
            touchAction: k === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
pn.displayName = "Panel";
const bl = {
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
function yl({
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
    a = Ve({
      layout: vt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = Ve({
      layout: vt({
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
function No({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...c
}) {
  const i = Dn(a), l = zn({
    disabled: n,
    disableDoubleClick: r
  }), [u, d] = C({}), [f, m] = C("inactive"), [g, h] = C(!1), b = M(null), v = xn(b, o), {
    disableCursor: w,
    id: P,
    orientation: p,
    registerSeparator: S,
    updateSeparatorProps: k
  } = On(), _ = p === "horizontal" ? "vertical" : "horizontal";
  qe(() => {
    const D = b.current;
    if (D !== null) {
      const T = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: D,
        id: i
      }, R = S(T), E = Kc(
        (F) => {
          m(
            F.next.state !== "inactive" && F.next.hitRegions.some(
              (U) => U.separator === T
            ) ? F.next.state : "inactive"
          );
        }
      ), N = Ln(
        P,
        (F) => {
          const { derivedPanelConstraints: U, layout: q, separatorToPanels: J } = F.next, re = J.get(T);
          if (re) {
            const x = re[0], K = re.indexOf(x);
            d(
              yl({
                layout: q,
                panelConstraints: U,
                panelId: x.id,
                panelIndex: K
              })
            );
          }
        }
      );
      return () => {
        E(), N(), R();
      };
    }
  }, [P, i, S, l]), z(() => {
    k(i, { disabled: n, disableDoubleClick: r });
  }, [n, r, i, k]);
  let B;
  n && !w && (B = "not-allowed");
  let O;
  if (n)
    O = "disabled";
  else
    switch (f) {
      case "active": {
        O = "active";
        break;
      }
      default:
        g ? O = "focus" : O = f;
    }
  return /* @__PURE__ */ y(
    "div",
    {
      ...c,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": _,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": O,
      "data-testid": i,
      id: i,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: v,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: B,
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
No.displayName = "Separator";
const Fn = 30, $n = 65, St = 50, vl = 100 - $n, Sl = 100 - Fn;
function wl(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min($n, Math.max(Fn, t)) : St;
}
function jn(e) {
  return 100 - e;
}
function Xe(e) {
  return `${e}%`;
}
const Bn = "reader-document", wt = "reader-assistant", _o = "retainpdf.reader.ai-split-layout.v1", Pl = {
  [Bn]: jn(St),
  [wt]: St
};
function Un(e) {
  const t = wl(e == null ? void 0 : e[wt]);
  return {
    [Bn]: jn(t),
    [wt]: t
  };
}
function Rl() {
  try {
    const e = JSON.parse(localStorage.getItem(_o) || "null");
    return Un(e);
  } catch {
    return Pl;
  }
}
function Il(e) {
  try {
    localStorage.setItem(_o, JSON.stringify(Un(e)));
  } catch {
  }
}
function Qt(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Un(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[wt]}vw`
  );
}
function Tl() {
  const e = M(null), [t] = C(Rl);
  _e(() => {
    const o = e.current;
    return Qt(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = j((o) => {
    Qt(e.current, o);
  }, []), r = j((o, a) => {
    Qt(e.current, o), a.isUserInteraction && Il(o);
  }, []);
  return /* @__PURE__ */ $(
    Ao,
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
        /* @__PURE__ */ y(
          pn,
          {
            id: Bn,
            defaultSize: Xe(jn(St)),
            minSize: Xe(vl),
            maxSize: Xe(Sl)
          }
        ),
        /* @__PURE__ */ y(
          No,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ y("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ y(
          pn,
          {
            id: wt,
            defaultSize: Xe(St),
            minSize: Xe(Fn),
            maxSize: Xe($n)
          }
        )
      ]
    }
  );
}
function El({
  regionsFailed: e = !1,
  metadataFailed: t = !1
}) {
  const [n, r] = C(!1);
  if (z(() => {
    !e && !t && r(!1);
  }, [e, t]), n || !e && !t)
    return null;
  const o = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ $("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ $("span", { className: "reader-error-notice-text", children: [
      o.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    /* @__PURE__ */ y(
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
function kl({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1
}) {
  return !e && !t ? /* @__PURE__ */ y(El, { regionsFailed: o, metadataFailed: a }) : /* @__PURE__ */ $($t, { children: [
    e ? /* @__PURE__ */ y("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ $("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ y("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ y("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ y(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ y("div", { className: "reader-react-error", role: "alert", children: n }) : null
  ] });
}
function Ml(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Al() {
  const [e, t] = C(!1), n = zr(), r = M(null);
  return z(() => {
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
  }, [e]), z(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || Ml(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((c) => !c);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ $("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ y(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ y(na, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ $(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ $("div", { className: "reader-react-shortcuts-head", children: [
            /* @__PURE__ */ y("strong", { children: "快捷键" }),
            /* @__PURE__ */ y(
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
          /* @__PURE__ */ y("div", { className: "reader-react-shortcuts-body", children: Ri.map((o) => /* @__PURE__ */ $("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ y("h3", { children: o.title }),
            /* @__PURE__ */ y("ul", { children: o.items.map((a) => /* @__PURE__ */ $("li", { children: [
              /* @__PURE__ */ y("kbd", { children: a.keys }),
              /* @__PURE__ */ y("span", { children: a.desc })
            ] }, `${o.title}-${a.keys}`)) })
          ] }, o.title)) }),
          /* @__PURE__ */ y("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const Nl = ["source", "sideBySide", "translated"], _l = { source: "", translated: "", sideBySide: "" };
function Ll(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = gt(e.sourceUrl), n = gt(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return Aa({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Lo(e) {
  const [t, n] = C(() => /* @__PURE__ */ new Set()), r = Z(
    () => e ? Ll(e) : _l,
    [e]
  ), o = Z(
    () => Nl.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = j(async (s) => {
    if (!e) return;
    const c = gt(r[s]);
    if (!(!c || t.has(s)))
      try {
        const i = e.jobId ? Ma(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Na(
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
        _a(l), n((u) => {
          const d = new Set(u);
          return d.delete(s), d;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Cl = {
  source: $r,
  sideBySide: jr,
  translated: Br
}, Dl = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function xl(e) {
  const t = ze(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Lo(n), c = M(null);
  return z(() => {
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
  }, []), /* @__PURE__ */ $("details", { ref: c, className: "reader-download-actions", children: [
    /* @__PURE__ */ $("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ y(ra, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ y("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ y(oa, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ y("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((i) => {
      const l = Or[i], u = gt(r[i]), d = a.has(i), f = !!u && !d, m = f ? "" : $o(i, r), g = Cl[i];
      return /* @__PURE__ */ $(
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
            /* @__PURE__ */ y(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ $("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ $("span", { className: "reader-download-action-label", children: [
                Dl[i],
                " PDF"
              ] }),
              m ? /* @__PURE__ */ y("span", { className: "reader-download-action-reason", children: m }) : null
            ] })
          ]
        },
        i
      );
    }) })
  ] });
}
const zl = "retainpdf:reader:bookmarks:v1:", Ol = 200;
function Hn() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Co(e) {
  const t = `${e || ""}`.trim();
  return t ? `${zl}${t}` : "";
}
function Fl(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Ft(e, t = Hn()) {
  const n = Co(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Fl(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function gn(e, t, n) {
  const r = Co(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Ol);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function $l(e, t, n = "", { storage: r = Hn(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Ft(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((c) => c.page === s) ? gn(e, a.filter((c) => c.page !== s), r) : gn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function jl(e, t, n = Hn()) {
  return gn(e, Ft(e, n).filter((r) => r.page !== t), n);
}
function Bl(e, t) {
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
function Ul({ filled: e }) {
  return /* @__PURE__ */ y("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ y("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function Hl({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = C(() => Ft(e)), [c, i] = C(!1), l = M(null);
  if (z(() => {
    s(Ft(e)), i(!1);
  }, [e]), z(() => {
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
  return /* @__PURE__ */ $("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ y(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${d ? " is-marked" : ""}`,
        "aria-pressed": d,
        "aria-label": d ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: d ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s($l(e, u, Bl(r, u))),
        children: /* @__PURE__ */ y(Ul, { filled: d })
      }
    ),
    /* @__PURE__ */ y(
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
    c && a.length ? /* @__PURE__ */ y("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ y("ol", { className: "reader-bookmark-list", children: a.map((f) => /* @__PURE__ */ $("li", { className: f.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ $(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(f.page, n)), i(!1);
          },
          children: [
            /* @__PURE__ */ $("span", { className: "reader-bookmark-page", children: [
              "第 ",
              f.page,
              " 页"
            ] }),
            f.label ? /* @__PURE__ */ y("span", { className: "reader-bookmark-label", children: f.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ y(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${f.page} 页的书签`,
          onClick: () => s(jl(e, f.page)),
          children: "×"
        }
      )
    ] }, f.page)) }) }) : null
  ] });
}
function Wl(e) {
  const t = ze(), n = fo(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Pt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), c = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, i = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = qr(a), d = a > Vr + 1e-3, f = a < ot - 1e-3, m = Qe(r, Be()), g = m >= ot ? "100%（铺满阅读区）" : "50%（半屏，对照铺满）", [h, b] = C(!1), [v, w] = C(`${c}`);
  z(() => {
    h || w(`${Math.min(Math.max(c, 1), Math.max(i, 1))}`);
  }, [c, i, h]);
  const P = () => {
    if (b(!1), !l || i <= 0)
      return;
    const p = Number(`${v}`.trim());
    l(zt(p, i));
  };
  return /* @__PURE__ */ $("div", { className: "reader-react-hud", "data-reader-hud": "true", children: [
    o ? /* @__PURE__ */ y("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ y("div", { className: "reader-react-hud-group", "aria-label": "页码", children: h ? /* @__PURE__ */ $(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (p) => {
          p.preventDefault(), P();
        },
        children: [
          /* @__PURE__ */ y(
            "input",
            {
              className: "reader-react-hud-page-input",
              type: "text",
              inputMode: "numeric",
              pattern: "[0-9]*",
              "aria-label": "跳转到页码",
              value: v,
              autoFocus: !0,
              onChange: (p) => w(p.target.value.replace(/[^\d]/g, "")),
              onBlur: P,
              onKeyDown: (p) => {
                p.key === "Escape" && (p.preventDefault(), b(!1), w(`${c}`));
              }
            }
          ),
          /* @__PURE__ */ $("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            i || "—"
          ] })
        ]
      }
    ) : /* @__PURE__ */ y(
      "button",
      {
        type: "button",
        className: "reader-react-hud-page reader-react-hud-page-btn",
        "aria-label": i > 0 ? `跳转页码，当前第 ${c} 页，共 ${i} 页` : "页码",
        title: i > 0 ? "点击输入页码跳转" : void 0,
        disabled: !l || i <= 0,
        onClick: () => {
          !l || i <= 0 || (w(`${c}`), b(!0));
        },
        children: i > 0 ? `${Math.min(c, i)} / ${i}` : "—"
      }
    ) }),
    e.bookmarkScope ? /* @__PURE__ */ y(
      Hl,
      {
        scope: e.bookmarkScope,
        currentPage: c,
        numPages: i,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    /* @__PURE__ */ $("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ y(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !d,
          onClick: () => s(at(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ $(
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
      /* @__PURE__ */ y(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "放大",
          disabled: !f,
          onClick: () => s(at(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ y("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ y(Al, {}) })
  ] });
}
function Lr(e) {
  var t, n;
  return Zr(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Vl(e) {
  const [t, n] = C(() => ({
    scope: e,
    panel: Lr(Ie(e))
  }));
  z(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Lr(Ie(e))
    });
  }, [e]), z(() => {
    t.scope === e && Ut(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = j((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const bn = "download-toast";
function Jl({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ $("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ $("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ y("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ y("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ y("div", { className: "download-toast-track", children: /* @__PURE__ */ y("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ y("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function ql(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    nn.dismiss(bn);
    return;
  }
  nn.custom(
    () => /* @__PURE__ */ y(Jl, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: bn, duration: 1 / 0 }
  );
}
function Gl() {
  const e = j((t) => {
    t && (t.setState = ql, t.hide = () => nn.dismiss(bn));
  }, []);
  return /* @__PURE__ */ $($t, { children: [
    /* @__PURE__ */ y(Yo, { position: "bottom-right" }),
    /* @__PURE__ */ y("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const Kl = () => () => {
}, Zl = () => !1;
function Yl() {
  const e = rn(), t = (e == null ? void 0 : e.active) ?? Zl;
  return it((e == null ? void 0 : e.subscribe) ?? Kl, t, t);
}
function Xl(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Jr(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Ql(e, t) {
  return t === null || e !== t;
}
function eu(e) {
  const t = M(!1);
  return e && (t.current = !0), t.current;
}
function tu(e, t) {
  const n = e === t;
  return { open: n, mounted: eu(n) };
}
const Cr = { itemId: null, origin: null };
function nu() {
  let e = Cr;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Cr : { itemId: n, origin: r };
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
const je = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), ru = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, ou = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, au = {
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
}, Dr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function su(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Dr(o ?? a ?? "", ru)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Dr(o ?? a ?? "", ou)).replace(/\\([a-zA-Z]+)/gu, (r, o) => au[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function iu(e) {
  return je(e.translatedBlockText) || je(e.translated.text) || je(e.source.text);
}
const cu = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function lu(e) {
  const t = [];
  for (const n of e) {
    if (!cu(n)) continue;
    const r = su(iu(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function uu(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const du = 24, fu = 60;
function xr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - du), o = Math.min(e.length, n + t.length + fu), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function mu(e, t, n = 200) {
  const r = je(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const c = je(a.translatedBlockText) || je(a.translated.text), i = c ? xr(c, r) : null, l = i ?? xr(je(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: i ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
const hu = [];
function pu({ open: e, onToggle: t }) {
  return /* @__PURE__ */ $("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ $($e, { className: "reader-finder-toggle", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: [
      /* @__PURE__ */ y(aa, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ y("span", { children: "目录" })
    ] }),
    /* @__PURE__ */ $($e, { className: "reader-finder-toggle", "aria-pressed": e === "search", title: "在书里搜索（原文和译文）", onClick: () => t("search"), children: [
      /* @__PURE__ */ y(sa, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ y("span", { children: "搜索" })
    ] })
  ] });
}
function gu({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r
}) {
  var m, g;
  const o = ((m = ze()) == null ? void 0 : m.regions) ?? hu, a = ((g = fo()) == null ? void 0 : g.currentPage) ?? 1, s = Z(() => lu(o), [o]), c = uu(s, a), [i, l] = C(""), u = Z(() => mu(o, i), [o, i]), d = M(null), f = M(null);
  return z(() => {
    var h, b, v;
    e === "search" ? (h = d.current) == null || h.focus() : (v = (b = f.current) == null ? void 0 : b.querySelector('[aria-current="location"]')) == null || v.scrollIntoView({ block: "center" });
  }, [e]), /* @__PURE__ */ $("aside", { className: "reader-finder", "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ $("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ $("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ y($e, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ y($e, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ y($e, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ y(In, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? s.length ? /* @__PURE__ */ y("ol", { ref: f, className: "reader-finder-list", children: s.map((h, b) => /* @__PURE__ */ y("li", { children: /* @__PURE__ */ $(
      $e,
      {
        className: "reader-finder-entry",
        "data-level": h.level,
        "aria-current": b === c ? "location" : void 0,
        onClick: () => r(h.itemId),
        children: [
          /* @__PURE__ */ y("span", { className: "reader-finder-entry-text", children: h.text }),
          /* @__PURE__ */ y("span", { className: "reader-finder-entry-page", children: h.page })
        ]
      }
    ) }, h.itemId)) }) : /* @__PURE__ */ y("p", { className: "reader-finder-empty", children: o.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ $($t, { children: [
      /* @__PURE__ */ $("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ y(
          ia,
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
        i.trim() ? /* @__PURE__ */ y("p", { className: "reader-finder-count", children: u.length >= 200 ? "200 处以上，只列前 200 处" : `${u.length} 处` }) : null
      ] }),
      /* @__PURE__ */ y("ol", { className: "reader-finder-list", children: u.map((h) => /* @__PURE__ */ y("li", { children: /* @__PURE__ */ $($e, { className: "reader-finder-entry is-hit", onClick: () => r(h.itemId), children: [
        /* @__PURE__ */ $("span", { className: "reader-finder-entry-text", children: [
          h.snippet.slice(0, h.at),
          /* @__PURE__ */ y("mark", { children: h.snippet.slice(h.at, h.at + h.length) }),
          h.snippet.slice(h.at + h.length)
        ] }),
        /* @__PURE__ */ y("span", { className: "reader-finder-entry-page", children: h.page })
      ] }) }, h.itemId)) })
    ] })
  ] });
}
const bu = zo(() => import("./ReaderMarkdownPanel-gv8U7B-V.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), en = { source: "source", sideBySide: "compare", translated: "translated" };
function yu(e) {
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
function vu(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Su() {
  const e = wi(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Vl(e.viewStateKey), s = a.panel, c = a.setPanel, [i, l] = C(null), [u, d] = C(!1), f = M(null), m = M(null), g = s !== null, h = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, b = yu({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: h,
    liveTranslationVisible: u,
    assistantOpen: g,
    assistantPdfPane: i
  }), v = ci({
    hasOverlayContent: h,
    connection: e.liveTranslation.connection,
    showSource: b.showSource,
    liveTranslationVisible: u,
    assistantOpen: g
  }), w = b.sourceViewOnly, P = b.visibleMode;
  z(() => {
    d(!1);
  }, [e.viewStateKey]), z(() => {
    e.session.jobTerminal && d(!1);
  }, [e.session.jobTerminal]), z(() => {
    l(null);
  }, [a.scope]), z(() => {
    if (!(t.loading || t.failed)) {
      if (f.current !== e.viewStateKey) {
        f.current = e.viewStateKey;
        const A = Ie(e.viewStateKey), I = Xl({
          savedMode: A == null ? void 0 : A.mode,
          sourceViewOnly: w,
          viewportWidth: Be()
        });
        m.current = I.auto ? I.mode : null, I.mode && I.mode !== e.mode && e.setModeKeepingPage(I.mode);
        return;
      }
      Ql(e.mode, m.current) && (m.current = null, Ut(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, w]);
  const p = s || (e.mode === "compare" ? "compare" : "reading"), S = tu(s, "markdown");
  Mi({
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
  const k = j(() => {
    c(null), l(null);
  }, []), _ = j((A) => {
    l(null);
    const I = vu(A, e.liveTranslationAvailable);
    I !== null && d(I), e.setModeKeepingPage(A);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), B = Z(() => v.sourcePaneToggle ? /* @__PURE__ */ y(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${u ? " is-active" : ""}`,
      onClick: () => d((A) => !A),
      "aria-pressed": u,
      title: u ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [v.sourcePaneToggle, u]), O = j((A) => {
    c(A), l(null);
  }, []), [D] = C(nu), [T, R] = C(null), E = j((A) => R((I) => I === A ? null : A), []), N = j((A) => {
    e.jumpToAnchor({ block_id: A }), Be() < 900 && R(null);
  }, [e.jumpToAnchor]), F = j((A) => e.jumpToAnchor({ block_id: A }), [e.jumpToAnchor]), U = Yl(), q = Lo(e.download), J = P === "compare" ? ot / 2 : ot, re = M(!0);
  z(() => {
    U && re.current && Math.abs(e.userZoom - J) > 1e-3 && e.onZoomChange(J);
  }, [U, J, e.userZoom, e.onZoomChange]);
  const x = Z(
    () => q.downloadItems.filter((A) => gt(q.urls[A])).map((A) => ({ key: `download-${en[A]}`, label: `下载${Or[A].label}` })),
    [q.downloadItems, q.urls]
  ), K = Z(() => ({
    ready: !t.loading && !t.failed,
    pageIdx: e.currentPage >= 1 ? e.currentPage - 1 : null,
    pageCount: n.hudNumPages >= 1 ? n.hudNumPages : null,
    modes: w ? ["source"] : ["source", "compare", "translated"],
    mode: P ?? null,
    panels: ["outline", "search"],
    panel: T,
    zoom: { percent: qr(e.userZoom), fit: Math.abs(e.userZoom - J) < 1e-3 },
    actions: x
  }), [t.loading, t.failed, e.currentPage, n.hudNumPages, w, P, T, e.userZoom, J, x]);
  z(() => {
    var A;
    U && ((A = rn()) == null || A.report(K));
  }, [U, K]);
  const oe = M(() => {
  });
  oe.current = (A) => {
    if (A.command === "mode")
      (!w || A.mode === "source") && _(A.mode);
    else if (A.command === "page")
      e.goToPage(A.pageIdx + 1);
    else if (A.command === "panel")
      R(A.panel);
    else if (A.command === "zoom")
      re.current = A.zoom === "fit", e.onZoomChange(A.zoom === "fit" ? J : at(e.userZoom, A.zoom === "in" ? 1 : -1));
    else if (A.command === "action") {
      const I = Object.keys(en).find((te) => `download-${en[te]}` === A.key);
      I && q.handleDownload(I);
    }
  }, z(() => {
    const A = rn();
    if (!(!U || !A))
      return A.onCommand((I) => oe.current(I));
  }, [U]);
  const ee = Z(() => ({
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
    sourceViewOnly: w,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: O, close: k }
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
    w,
    e.download,
    e.goToPage,
    O,
    k
  ]), se = Z(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), pe = [
    fs,
    `is-workspace-${p}`,
    g ? "is-assistant-open" : "",
    T ? "is-finder-open" : "",
    U ? "is-host-chrome" : "",
    b.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ y(lc, { value: ee, hud: se, children: /* @__PURE__ */ $("div", { className: pe, "data-reader-engine": "react-pdf", "data-reader-workspace": p, children: [
    /* @__PURE__ */ y(kl, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata }),
    U ? null : /* @__PURE__ */ y(pu, { open: T, onToggle: E }),
    T ? /* @__PURE__ */ y(
      gu,
      {
        tab: T,
        onTab: R,
        onClose: () => R(null),
        onJump: N
      }
    ) : null,
    U ? null : /* @__PURE__ */ $("div", { className: "reader-chrome-tray", children: [
      /* @__PURE__ */ y($i, {}),
      /* @__PURE__ */ y(xl, {}),
      /* @__PURE__ */ y(xi, { onBeforeClose: o.prepareClose })
    ] }),
    U ? null : /* @__PURE__ */ y(
      Lc,
      {
        mode: P,
        documentReady: !!o.jobId,
        sourceViewOnly: w,
        onModeChange: _,
        liveTranslation: v.topBarPill ? {
          visible: u,
          state: e.liveTranslation,
          onToggle: () => d((A) => !A)
        } : null
      }
    ),
    U ? null : /* @__PURE__ */ y($c, { active: s }),
    g ? /* @__PURE__ */ y(Tl, {}) : null,
    /* @__PURE__ */ y(Mc, { paneComposition: b, markdownSplit: S.open, assistantSplit: g, liveTranslation: e.liveTranslation, sourcePaneAction: B }),
    e.showHud && !U ? /* @__PURE__ */ y(
      Wl,
      {
        mode: P,
        modeControls: null,
        bookmarkScope: e.viewStateKey
      }
    ) : null,
    /* @__PURE__ */ y(xo, { fallback: null, children: S.mounted ? /* @__PURE__ */ y(bu, { open: S.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: k }) : null }),
    /* @__PURE__ */ y(Gl, {})
  ] }) });
}
function $u() {
  return /* @__PURE__ */ y(Su, {});
}
export {
  $u as R,
  Su as a,
  Ou as d,
  zu as f,
  Fu as r,
  ze as u
};
//# sourceMappingURL=ReaderApp-CGOapKlZ.js.map
