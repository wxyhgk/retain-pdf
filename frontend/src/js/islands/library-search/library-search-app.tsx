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
       title={`Trang ${Number(hit.page_idx) + 1} · ${hit.block_id}`}
    >
      <Snippet text={hit.source_snippet} />
      {hit.translated_snippet ? <Snippet text={hit.translated_snippet} /> : null}
       <span className="lib-search-hit-meta">Trang {Number(hit.page_idx) + 1}</span>
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
           {doc.page_count} trang{doc.tags.length ? ` · ${doc.tags.join(" / ")}` : ""}
         </span>
      </button>
       <button
         type="button"
         className={`lib-search-doc-status is-${doc.reading_status}`}
         onClick={() => onCycleStatus(doc)}
         title="Click để chuyển trạng thái đọc"
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
          setError(searchError?.message || "Tìm kiếm thất bại");
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
      // Cập nhật lạc quan khôi phục
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
    <div className="lib-search-panel" role="region" aria-label="Kết quả tìm kiếm thư viện">
      <div className="lib-search-head">
        <strong>Tìm kiếm thư viện</strong>
        <span className="lib-search-status">{busy ? "Đang tìm..." : error || `${hits.length} kết quả khớp toàn văn · ${matchedDocuments.length} tài liệu`}</span>
        <div className="lib-search-filters" role="group" aria-label="Lọc theo trạng thái đọc">
          <button type="button" className={statusFilter === "" ? "is-active" : ""} onClick={() => setStatusFilter("")}>Tất cả</button>
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
          <h4>Kết quả khớp toàn văn</h4>
          <div className="lib-search-hits">
            {hits.map((hit) => (
              <SearchHit key={`${hit.job_id}-${hit.page_idx}-${hit.block_id}`} hit={hit} onOpenReader={ports.openReader} />
            ))}
          </div>
        </section>
      )}
      <section className="lib-search-section">
        <h4>Tài liệu</h4>
        {matchedDocuments.length === 0
          ? <p className="lib-search-empty">Không tìm thấy tài liệu phù hợp</p>
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
