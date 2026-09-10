import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/reader.html?document_id=doc-ocr",
  pretendToBeVisual: true,
});
for (const key of ["window", "document", "history", "location", "HTMLElement", "Event", "Node"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    writable: true,
    configurable: true,
  });
}
globalThis.dispatchEvent = dom.window.dispatchEvent.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { setReaderAdapters } = await import("../../../../frontend/packages/reader/src/adapters.ts");
const { useReaderSession } = await import("../../../../frontend/packages/reader/src/hooks/use-reader-session.ts");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await wait(10);
  }
  assert.fail(`等待超时：${description}`);
}

test("document active_job becomes the effective reader job and keeps the document source PDF", async () => {
  const calls = [];
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  setReaderAdapters({
    isMockMode: () => false,
    resolveResourceUrl: (url) => url,
    resolveReaderJobId: () => "",
    resolveReaderDocumentId: () => "doc-ocr",
    resolveReaderSourcePdf: () => "",
    resolveReaderTranslatedPdfUrl: () => "",
    resolveReaderArtifactUrl: () => "",
    defaultReaderPageConfigPort: {
      messageTargetOrigin: () => "*",
    },
    defaultReaderDataPort: {
      fetchProtected: async (url) => {
        calls.push(url);
        if (url === "/api/v1/documents/doc-ocr") {
          return {
            ok: true,
            json: async () => ({ data: { active_job_id: "job-ocr" } }),
          };
        }
        assert.equal(url, "/api/v1/documents/doc-ocr/source.pdf");
        return {
          ok: true,
          arrayBuffer: async () => pdfBytes.buffer.slice(0),
        };
      },
      loadReaderPayload: async (jobId) => {
        calls.push(`payload:${jobId}`);
        return {
          jobPayload: { title: "OCR document" },
          manifestPayload: {},
        };
      },
    },
  });

  const sessions = [];
  function HookHost() {
    const session = useReaderSession();
    React.useEffect(() => {
      sessions.push(session);
    }, [session]);
    return null;
  }

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(HookHost));

  await waitFor(
    () => sessions.some((session) => session.assetsReady && session.jobId === "job-ocr"),
    "active job session ready",
  );

  const session = sessions.at(-1);
  assert.equal(session.jobId, "job-ocr");
  assert.equal(session.documentId, "doc-ocr");
  assert.equal(session.sourceOnly, false, "真实 active job 不应继续被标记为纯源文档");
  assert.equal(session.sourceUrl, "/api/v1/documents/doc-ocr/source.pdf");
  assert.equal(session.download.jobId, "job-ocr");
  assert.equal(session.download.sourceOnly, false);
  assert.ok(session.sourceFile, "OCR-only 没有 PDF artifact 时仍应加载馆藏源 PDF");
  assert.deepEqual(calls, [
    "/api/v1/documents/doc-ocr",
    "payload:job-ocr",
    "/api/v1/documents/doc-ocr/source.pdf",
  ]);

  root.unmount();
  host.remove();
  setReaderAdapters(null);
});

test("explicit in-progress translation job falls back to its document source before artifacts exist", async () => {
  const calls = [];
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  setReaderAdapters({
    apiPrefix: "/api/v1",
    isMockMode: () => false,
    resolveResourceUrl: (url) => url,
    resolveReaderJobId: () => "job-live-ocr",
    resolveReaderDocumentId: () => "",
    resolveReaderSourcePdf: () => "",
    resolveReaderTranslatedPdfUrl: () => "",
    resolveReaderArtifactUrl: () => "",
    fetchDocumentByJobId: async () => ({
      document_id: "doc-live-ocr",
      active_job_id: "job-live-ocr",
    }),
    defaultReaderPageConfigPort: { messageTargetOrigin: () => "*" },
    defaultReaderDataPort: {
      fetchProtected: async (url) => {
        calls.push(url);
        assert.equal(url, "/api/v1/documents/doc-live-ocr/source.pdf");
        return {
          ok: true,
          arrayBuffer: async () => pdfBytes.buffer.slice(0),
        };
      },
      loadReaderPayload: async () => ({
        jobPayload: {
          job_id: "job-live-ocr",
          document_id: "doc-live-ocr",
          workflow: "book",
          status: "running",
        },
        manifestPayload: { items: [] },
        regionsPayload: { items: [] },
        readerMetadata: null,
      }),
    },
  });

  const sessions = [];
  function HookHost() {
    const session = useReaderSession();
    React.useEffect(() => {
      sessions.push(session);
    }, [session]);
    return null;
  }

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(HookHost));

  await waitFor(
    () => sessions.some((session) => session.assetsReady && session.jobId === "job-live-ocr"),
    "in-progress source fallback ready",
  );
  const session = sessions.at(-1);
  assert.equal(session.boot.failed, false);
  assert.equal(session.sourceUrl, "/api/v1/documents/doc-live-ocr/source.pdf");
  assert.equal(session.translatedUrl, "");
  assert.ok(session.sourceFile);
  assert.deepEqual(calls, ["/api/v1/documents/doc-live-ocr/source.pdf"]);

  root.unmount();
  host.remove();
  setReaderAdapters(null);
});

test("stale document active_job falls back to the source PDF instead of a fatal 404", async () => {
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  const calls = [];
  setReaderAdapters({
    isMockMode: () => false,
    resolveResourceUrl: (url) => url,
    resolveReaderJobId: () => "",
    resolveReaderDocumentId: () => "doc-ocr",
    resolveReaderSourcePdf: () => "",
    resolveReaderTranslatedPdfUrl: () => "",
    resolveReaderArtifactUrl: () => "",
    defaultReaderPageConfigPort: { messageTargetOrigin: () => "*" },
    defaultReaderDataPort: {
      fetchProtected: async (url) => {
        calls.push(url);
        if (url === "/api/v1/documents/doc-ocr") {
          return {
            ok: true,
            json: async () => ({ data: { active_job_id: "job-deleted" } }),
          };
        }
        assert.equal(url, "/api/v1/documents/doc-ocr/source.pdf");
        return {
          ok: true,
          arrayBuffer: async () => pdfBytes.buffer.slice(0),
        };
      },
      loadReaderPayload: async () => {
        throw Object.assign(new Error("未找到该任务，请检查 job_id 是否正确。"), { status: 404 });
      },
    },
  });

  const sessions = [];
  function HookHost() {
    const session = useReaderSession();
    React.useEffect(() => {
      sessions.push(session);
    }, [session]);
    return null;
  }

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(HookHost));

  await waitFor(
    () => sessions.some((session) => session.assetsReady && session.sourceOnly),
    "source fallback ready",
  );
  const session = sessions.at(-1);
  assert.equal(session.jobId, "");
  assert.equal(session.sourceOnly, true);
  assert.equal(session.mode, "source");
  assert.equal(session.sourceUrl, "/api/v1/documents/doc-ocr/source.pdf");
  assert.equal(session.boot.failed, false);
  assert.ok(calls.filter((url) => url === "/api/v1/documents/doc-ocr").length >= 2);

  root.unmount();
  host.remove();
  setReaderAdapters(null);
});

test("committed Agent operation reloads the authoritative document source instead of the immutable job artifact", async () => {
  const calls = [];
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  setReaderAdapters({
    isMockMode: () => false,
    resolveResourceUrl: (url) => url,
    resolveReaderJobId: () => "job-agent",
    resolveReaderDocumentId: () => "",
    resolveReaderSourcePdf: () => "/api/v1/jobs/job-agent/artifacts/source_pdf",
    resolveReaderTranslatedPdfUrl: () => "/api/v1/jobs/job-agent/pdf",
    resolveReaderArtifactUrl: () => "",
    defaultReaderPageConfigPort: {
      messageTargetOrigin: () => "*",
    },
    defaultReaderDataPort: {
      fetchProtected: async (url) => {
        calls.push(url);
        return {
          ok: true,
          arrayBuffer: async () => pdfBytes.buffer.slice(0),
        };
      },
      loadReaderPayload: async (jobId) => ({
        jobPayload: { job_id: jobId, title: "Agent document" },
        manifestPayload: {},
        regionsPayload: [{ block_id: "old-region" }],
        readerMetadata: { source: { page_count: 1 } },
      }),
    },
  });

  const sessions = [];
  function HookHost() {
    const session = useReaderSession();
    React.useEffect(() => {
      sessions.push(session);
    }, [session]);
    return null;
  }

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(HookHost));

  await waitFor(
    () => sessions.some((session) => session.assetsReady && !session.sourceOnly),
    "immutable job artifacts ready",
  );
  const before = sessions.at(-1);
  assert.equal(before.sourceUrl, "/api/v1/jobs/job-agent/artifacts/source_pdf");
  assert.equal(before.translatedUrl, "/api/v1/jobs/job-agent/pdf");

  before.refreshCommittedDocument({ documentId: "doc-agent", revision: "version-2" });
  await waitFor(
    () => sessions.some((session) => session.assetsReady
      && session.sourceUrl === "/api/v1/documents/doc-agent/source.pdf?version=version-2"),
    "committed document source ready",
  );

  const after = sessions.at(-1);
  assert.equal(after.sourceOnly, false, "保留真实 job 后 Markdown/AI 仍应可用");
  assert.equal(after.jobId, "job-agent");
  assert.equal(after.download.sourceOnly, true, "下载和视图仍只使用新的文档源版本");
  assert.equal(after.mode, "source");
  assert.equal(after.translatedUrl, "", "旧 job 的译文不能继续与新源版本并排显示");
  assert.deepEqual(after.regions, [], "旧页序的区域坐标应失效");
  assert.equal(after.readerMetadata.source, null, "旧页序的 reader metadata 应失效");
  assert.ok(calls.includes("/api/v1/documents/doc-agent/source.pdf?version=version-2"));

  root.unmount();
  host.remove();
  setReaderAdapters(null);
});

test("explicit job snapshot keeps comparison even when its document has an active Agent version", async () => {
  const calls = [];
  let documentLookupCount = 0;
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  setReaderAdapters({
    apiPrefix: "/api/v1",
    isMockMode: () => false,
    resolveResourceUrl: (url) => url,
    resolveReaderJobId: () => "job-from-library",
    resolveReaderDocumentId: () => "",
    resolveReaderSourcePdf: () => "/api/v1/jobs/job-from-library/artifacts/source_pdf",
    resolveReaderTranslatedPdfUrl: () => "/api/v1/jobs/job-from-library/pdf",
    resolveReaderArtifactUrl: () => "",
    fetchDocumentByJobId: async () => {
      documentLookupCount += 1;
      return {
        document_id: "doc-from-library",
        active_job_id: "job-newer-than-library-snapshot",
        active_version_id: "active-version-7",
      };
    },
    defaultReaderPageConfigPort: {
      messageTargetOrigin: () => "*",
    },
    defaultReaderDataPort: {
      fetchProtected: async (url) => {
        calls.push(url);
        return {
          ok: true,
          arrayBuffer: async () => pdfBytes.buffer.slice(0),
        };
      },
      loadReaderPayload: async (jobId) => ({
        jobPayload: { job_id: jobId, title: "Committed document" },
        manifestPayload: {},
      }),
    },
  });

  const sessions = [];
  function HookHost() {
    const session = useReaderSession();
    React.useEffect(() => {
      sessions.push(session);
    }, [session]);
    return null;
  }

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(HookHost));

  await waitFor(
    () => sessions.some((session) => session.assetsReady
      && session.sourceUrl === "/api/v1/jobs/job-from-library/artifacts/source_pdf"
      && session.translatedUrl === "/api/v1/jobs/job-from-library/pdf"),
    "immutable job comparison loaded",
  );

  const session = sessions.at(-1);
  assert.equal(session.sourceOnly, false);
  assert.equal(session.jobId, "job-from-library");
  assert.equal(session.download.sourceOnly, false);
  assert.equal(session.mode, "compare");
  assert.equal(session.sourceUrl, "/api/v1/jobs/job-from-library/artifacts/source_pdf");
  assert.equal(session.translatedUrl, "/api/v1/jobs/job-from-library/pdf");
  assert.ok(calls.includes("/api/v1/jobs/job-from-library/artifacts/source_pdf"));
  assert.ok(calls.includes("/api/v1/jobs/job-from-library/pdf"));
  assert.equal(documentLookupCount, 1, "应查询文档身份，但历史 job 快照不能被活动版本覆盖");

  root.unmount();
  host.remove();
  setReaderAdapters(null);
});

test("reopening the current active job restores its committed Agent document source", async () => {
  const calls = [];
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  setReaderAdapters({
    apiPrefix: "/api/v1",
    isMockMode: () => false,
    resolveResourceUrl: (url) => url,
    resolveReaderJobId: () => "job-current",
    resolveReaderDocumentId: () => "",
    resolveReaderSourcePdf: () => "/api/v1/jobs/job-current/artifacts/source_pdf",
    resolveReaderTranslatedPdfUrl: () => "/api/v1/jobs/job-current/pdf",
    resolveReaderArtifactUrl: () => "",
    fetchDocumentByJobId: async (_apiPrefix, jobId) => {
      assert.equal(jobId, "job-current");
      return {
        document_id: "doc-current",
        active_job_id: "job-current",
        active_version_id: "agent-version-9",
      };
    },
    defaultReaderPageConfigPort: { messageTargetOrigin: () => "*" },
    defaultReaderDataPort: {
      fetchProtected: async (url) => {
        calls.push(url);
        return {
          ok: true,
          arrayBuffer: async () => pdfBytes.buffer.slice(0),
        };
      },
      loadReaderPayload: async () => ({
        jobPayload: { job_id: "job-current", status: "succeeded", workflow: "book" },
        manifestPayload: {},
        regionsPayload: [{ block_id: "old-region" }],
        readerMetadata: { source: { page_count: 1 } },
      }),
    },
  });

  const sessions = [];
  function HookHost() {
    const session = useReaderSession();
    React.useEffect(() => {
      sessions.push(session);
    }, [session]);
    return null;
  }

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(HookHost));

  await waitFor(
    () => sessions.some((session) => session.assetsReady
      && session.documentId === "doc-current"
      && session.sourceUrl === "/api/v1/documents/doc-current/source.pdf?version=agent-version-9"),
    "committed source restored after reopening current job",
  );
  const session = sessions.at(-1);
  assert.equal(session.jobId, "job-current");
  assert.equal(session.mode, "source");
  assert.equal(session.translatedUrl, "");
  assert.deepEqual(session.regions, []);
  assert.equal(calls.includes("/api/v1/jobs/job-current/artifacts/source_pdf"), false);
  assert.equal(calls.includes("/api/v1/jobs/job-current/pdf"), false);

  root.unmount();
  host.remove();
  setReaderAdapters(null);
});

test("session status refresh is authoritative and reloads final artifacts once on success", async () => {
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  let liveStatus = "running";
  let readerPayloadLoads = 0;
  let statusLoads = 0;
  setReaderAdapters({
    isMockMode: () => false,
    resolveResourceUrl: (url) => url,
    resolveReaderJobId: () => "job-status-authority",
    resolveReaderDocumentId: () => "",
    resolveReaderSourcePdf: () => "/status-authority-source.pdf",
    resolveReaderTranslatedPdfUrl: () => liveStatus === "succeeded"
      ? "/status-authority-translated.pdf"
      : "",
    resolveReaderArtifactUrl: () => "",
    defaultReaderPageConfigPort: { messageTargetOrigin: () => "*" },
    defaultReaderDataPort: {
      fetchProtected: async () => ({
        ok: true,
        arrayBuffer: async () => pdfBytes.buffer.slice(0),
      }),
      loadJobPayload: async () => {
        statusLoads += 1;
        return {
          job_id: "job-status-authority",
          document_id: "doc-status-authority",
          status: liveStatus,
          workflow: "translate",
        };
      },
      loadReaderPayload: async () => {
        readerPayloadLoads += 1;
        return {
          jobPayload: {
            job_id: "job-status-authority",
            document_id: "doc-status-authority",
            status: liveStatus,
            workflow: "translate",
          },
          manifestPayload: {},
        };
      },
    },
  });

  const sessions = [];
  function HookHost() {
    const session = useReaderSession();
    React.useEffect(() => {
      sessions.push(session);
    }, [session]);
    return null;
  }

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(HookHost));

  await waitFor(
    () => sessions.some((session) => session.assetsReady && session.jobStatus === "running"),
    "running session ready",
  );
  liveStatus = "succeeded";
  await sessions.at(-1).refreshJobStatus();
  await waitFor(
    () => sessions.some((session) => session.assetsReady
      && session.jobStatus === "succeeded"
      && session.jobTerminal
      && session.translatedUrl === "/status-authority-translated.pdf"),
    "terminal session and final artifact ready",
  );

  const session = sessions.at(-1);
  assert.equal(session.workflow, "translate");
  assert.equal(statusLoads, 1);
  assert.equal(readerPayloadLoads, 2, "终态成功只触发一次最终产物刷新");

  root.unmount();
  host.remove();
  setReaderAdapters(null);
});

test("prepareClose aborts the active PDF request and suppresses its late failure UI", async () => {
  let requestSignal = null;
  let rejectPdfRequest = null;
  setReaderAdapters({
    isMockMode: () => false,
    resolveResourceUrl: (url) => url,
    resolveReaderJobId: () => "job-closing",
    resolveReaderDocumentId: () => "",
    resolveReaderSourcePdf: () => "/api/v1/jobs/job-closing/artifacts/source_pdf",
    resolveReaderTranslatedPdfUrl: () => "",
    resolveReaderArtifactUrl: () => "",
    defaultReaderPageConfigPort: {
      messageTargetOrigin: () => "*",
    },
    defaultReaderDataPort: {
      fetchProtected: async (_url, init = {}) => new Promise((_resolve, reject) => {
        requestSignal = init.signal;
        rejectPdfRequest = reject;
        init.signal?.addEventListener("abort", () => {
          reject(new Error("late close failure"));
        }, { once: true });
      }),
      loadReaderPayload: async (jobId) => ({
        jobPayload: { job_id: jobId, title: "Closing document" },
        manifestPayload: {},
      }),
    },
  });

  const sessions = [];
  function HookHost() {
    const session = useReaderSession();
    React.useEffect(() => {
      sessions.push(session);
    }, [session]);
    return null;
  }

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(HookHost));

  await waitFor(() => Boolean(requestSignal) && sessions.length > 0, "PDF request started");
  sessions.at(-1).prepareClose();
  assert.equal(requestSignal.aborted, true, "关闭动作必须立即中止 PDF 请求");
  assert.equal(typeof rejectPdfRequest, "function");

  await wait(30);
  assert.equal(sessions.at(-1).boot.failed, false, "关闭后的迟到失败不能渲染错误提示");

  root.unmount();
  host.remove();
  setReaderAdapters(null);
});

test("same mounted Reader fences stale job loads, backfills document identity, and drops old committed sources", async () => {
  dom.window.history.replaceState({}, "", "/reader.html?job_id=job-a");
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  const calls = [];
  let resolveJobA;
  const jobA = new Promise((resolve) => {
    resolveJobA = resolve;
  });
  const currentParam = (name) => new URLSearchParams(dom.window.location.search).get(name) || "";

  setReaderAdapters({
    isMockMode: () => false,
    resolveResourceUrl: (url) => url,
    resolveReaderJobId: () => currentParam("job_id"),
    resolveReaderDocumentId: () => currentParam("document_id"),
    resolveReaderSourcePdf: (manifest) => manifest?.source || "",
    resolveReaderTranslatedPdfUrl: () => "",
    resolveReaderArtifactUrl: () => "",
    defaultReaderPageConfigPort: { messageTargetOrigin: () => "*" },
    defaultReaderDataPort: {
      fetchProtected: async (url) => {
        calls.push(url);
        return {
          ok: true,
          arrayBuffer: async () => pdfBytes.buffer.slice(0),
        };
      },
      loadReaderPayload: async (jobId) => {
        calls.push(`payload:${jobId}`);
        if (jobId === "job-a") return jobA;
        return {
          jobPayload: { job_id: jobId, document_id: `doc-${jobId}` },
          manifestPayload: { source: `/source-${jobId}.pdf` },
        };
      },
    },
  });

  const sessions = [];
  function HookHost() {
    const session = useReaderSession();
    React.useEffect(() => {
      sessions.push(session);
    }, [session]);
    return null;
  }

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(HookHost));

  await waitFor(() => calls.includes("payload:job-a"), "job A request started");
  dom.window.history.replaceState({}, "", "/reader.html?job_id=job-b");
  await waitFor(
    () => sessions.some((session) => session.assetsReady
      && session.jobId === "job-b"
      && session.documentId === "doc-job-b"),
    "job B became authoritative",
  );

  resolveJobA({
    jobPayload: { job_id: "job-a", document_id: "doc-job-a" },
    manifestPayload: { source: "/source-job-a.pdf" },
  });
  await wait(30);
  let current = sessions.at(-1);
  assert.equal(current.jobId, "job-b");
  assert.equal(current.documentId, "doc-job-b", "document_id 应从当前 job payload 回填");
  assert.equal(current.sourceUrl, "/source-job-b.pdf");
  assert.equal(calls.includes("/source-job-a.pdf"), false, "迟到的 job A 不得继续加载 PDF");

  current.refreshCommittedDocument({ documentId: "doc-job-b", revision: "commit-b" });
  await waitFor(
    () => sessions.some((session) => session.assetsReady
      && session.sourceUrl === "/api/v1/documents/doc-job-b/source.pdf?version=commit-b"),
    "job B committed source loaded",
  );

  dom.window.history.replaceState({}, "", "/reader.html?job_id=job-c");
  await waitFor(
    () => sessions.some((session) => session.assetsReady
      && session.jobId === "job-c"
      && session.documentId === "doc-job-c"
      && session.sourceUrl === "/source-job-c.pdf"),
    "job C loaded without job B committed source",
  );
  current = sessions.at(-1);
  assert.equal(current.translatedUrl, "");

  root.unmount();
  host.remove();
  setReaderAdapters(null);
  dom.window.history.replaceState({}, "", "/reader.html?document_id=doc-ocr");
});

test("a late successful sibling PDF download cannot overwrite a terminal download failure", async () => {
  dom.window.history.replaceState({}, "", "/reader.html?job_id=job-parallel-failure");
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  let resolveTranslated;
  const translatedResponse = new Promise((resolve) => {
    resolveTranslated = resolve;
  });
  const calls = [];

  setReaderAdapters({
    isMockMode: () => false,
    resolveResourceUrl: (url) => url,
    resolveReaderJobId: () => "job-parallel-failure",
    resolveReaderDocumentId: () => "",
    resolveReaderSourcePdf: () => "/parallel-source-failure.pdf",
    resolveReaderTranslatedPdfUrl: () => "/parallel-translated-late.pdf",
    resolveReaderArtifactUrl: () => "",
    defaultReaderPageConfigPort: { messageTargetOrigin: () => "*" },
    defaultReaderDataPort: {
      fetchProtected: async (url) => {
        calls.push(url);
        if (url === "/parallel-source-failure.pdf") {
          return { ok: false, status: 502 };
        }
        return translatedResponse;
      },
      loadReaderPayload: async () => ({
        jobPayload: {
          job_id: "job-parallel-failure",
          document_id: "doc-parallel-failure",
        },
        manifestPayload: {},
      }),
    },
  });

  const sessions = [];
  function HookHost() {
    const session = useReaderSession();
    React.useEffect(() => {
      sessions.push(session);
    }, [session]);
    return null;
  }

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(HookHost));

  await waitFor(
    () => calls.includes("/parallel-translated-late.pdf")
      && sessions.some((session) => session.boot.failed),
    "source failure published while translated download is pending",
  );
  const failedText = sessions.at(-1).boot.text;
  resolveTranslated({
    ok: true,
    arrayBuffer: async () => pdfBytes.buffer.slice(0),
  });
  await wait(40);

  const current = sessions.at(-1);
  assert.equal(current.boot.failed, true);
  assert.equal(current.boot.loading, false);
  assert.equal(current.boot.text, failedText);
  assert.equal(current.assetsReady, false);

  root.unmount();
  host.remove();
  setReaderAdapters(null);
  dom.window.history.replaceState({}, "", "/reader.html?document_id=doc-ocr");
});
