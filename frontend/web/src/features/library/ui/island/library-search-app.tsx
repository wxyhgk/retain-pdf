import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  READING_STATUS_META,
  filterDocuments,
  highlightSegments,
  nextReadingStatus,
} from "./view-model.js";

function Snippet({ text }) {
  return (
    <p className="lib-search-snippet">
      {highlightSegments(text).map((segment, index) => (
        segment.hit
          ? <mark key={index}>{segment.text}</mark>
          : <span key={index}>{segment.text}</span>
      ))}
    </p>
  );
}

function SearchHit({ hit, onOpenReader }) {
  return (
    <button
      type="button"
      className="lib-search-hit"
      onClick={() => onOpenReader(hit)}
      title={`第 ${Number(hit.page_idx) + 1} 页 · ${hit.block_id}`}
    >
      <Snippet text={hit.source_snippet} />
      {hit.translated_snippet ? <Snippet text={hit.translated_snippet} /> : null}
      <span className="lib-search-hit-meta">第 {Number(hit.page_idx) + 1} 页</span>
    </button>
  );
}

function DocumentRow({ doc, onOpenReader, onCycleStatus }) {
  const meta = READING_STATUS_META[doc.reading_status] || READING_STATUS_META.unread;
  return (
    <div className="lib-search-doc">
      <button
        type="button"
        className="lib-search-doc-open"
        onClick={() => onOpenReader({ document_id: doc.document_id, job_id: doc.active_job_id })}
      >
        <span className="lib-search-doc-title">{doc.title || doc.source_filename}</span>
        <span className="lib-search-doc-meta">
          {doc.page_count} 页{doc.tags.length ? ` · ${doc.tags.join(" / ")}` : ""}
        </span>
      </button>
      <button
        type="button"
        className={`lib-search-doc-status is-${doc.reading_status}`}
        onClick={() => onCycleStatus(doc)}
        title="点击切换阅读状态"
      >
        {meta.label}
      </button>
    </div>
  );
}

function LibrarySearchPanel({ ports }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | number>(0);
  const requestSeqRef = useRef(0);

  useEffect(() => ports.subscribeQuery(setQuery), [ports]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setHits([]);
      setError("");
      return undefined;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const seq = requestSeqRef.current + 1;
      requestSeqRef.current = seq;
      setBusy(true);
      try {
        const [searchResult, documentsResult] = await Promise.all([
          ports.searchLibrary(trimmed),
          ports.fetchDocumentList(),
        ]);
        if (requestSeqRef.current !== seq) {
          return;
        }
        setHits(searchResult?.hits || []);
        setDocuments(documentsResult?.documents || []);
        setError("");
      } catch (searchError) {
        if (requestSeqRef.current === seq) {
          setError(searchError?.message || "检索失败");
        }
      } finally {
        if (requestSeqRef.current === seq) {
          setBusy(false);
        }
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, ports]);

  const cycleStatus = useCallback(async (doc) => {
    const next = nextReadingStatus(doc.reading_status);
    setDocuments((current) => current.map((item) => (
      item.document_id === doc.document_id ? { ...item, reading_status: next } : item
    )));
    try {
      await ports.patchDocument(doc.document_id, { reading_status: next });
    } catch (_err) {
      // 回滚乐观更新
      setDocuments((current) => current.map((item) => (
        item.document_id === doc.document_id ? { ...item, reading_status: doc.reading_status } : item
      )));
    }
  }, [ports]);

  const trimmed = query.trim();
  if (!trimmed) {
    return null;
  }
  const matchedDocuments = filterDocuments(documents, { query: trimmed, readingStatus: statusFilter });

  return (
    <div className="lib-search-panel" role="region" aria-label="库检索结果">
      <div className="lib-search-head">
        <strong>库检索</strong>
        <span className="lib-search-status">{busy ? "检索中…" : error || `${hits.length} 条全文命中 · ${matchedDocuments.length} 篇文档`}</span>
        <div className="lib-search-filters" role="group" aria-label="按阅读状态过滤">
          <button type="button" className={statusFilter === "" ? "is-active" : ""} onClick={() => setStatusFilter("")}>全部</button>
          {Object.entries(READING_STATUS_META).map(([value, meta]) => (
            <button
              key={value}
              type="button"
              className={statusFilter === value ? "is-active" : ""}
              onClick={() => setStatusFilter(value)}
            >
              {meta.label}
            </button>
          ))}
        </div>
      </div>
      {hits.length > 0 && (
        <section className="lib-search-section">
          <h4>全文命中</h4>
          <div className="lib-search-hits">
            {hits.map((hit) => (
              <SearchHit key={`${hit.job_id}-${hit.page_idx}-${hit.block_id}`} hit={hit} onOpenReader={ports.openReader} />
            ))}
          </div>
        </section>
      )}
      <section className="lib-search-section">
        <h4>文档</h4>
        {matchedDocuments.length === 0
          ? <p className="lib-search-empty">没有匹配的文档</p>
          : (
            <div className="lib-search-docs">
              {matchedDocuments.map((doc) => (
                <DocumentRow key={doc.document_id} doc={doc} onOpenReader={ports.openReader} onCycleStatus={cycleStatus} />
              ))}
            </div>
          )}
      </section>
    </div>
  );
}

export function mountLibrarySearchApp(host, ports) {
  const root = createRoot(host);
  root.render(<LibrarySearchPanel ports={ports} />);
  return {
    unmount: () => root.unmount(),
  };
}
