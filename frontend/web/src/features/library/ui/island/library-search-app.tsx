import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { SegmentedControl } from "@retainpdf/ui";
import {
  READING_STATUS_META,
  filterDocuments,
  highlightSegments,
  nextReadingStatus,
} from "./view-model.js";
import type {
  LibrarySearchAnchor,
  LibrarySearchDocumentRow,
  LibrarySearchHit,
  LibrarySearchPorts,
} from "./index.js";

function Snippet({ text }: { text?: string }) {
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

function SearchHit({ hit, onOpenReader }: { hit: LibrarySearchHit; onOpenReader: (anchor: LibrarySearchAnchor) => void }) {
  return (
    <button
      type="button"
      className="lib-search-hit"
      // 契约的 BlockSearchHit 是 interface，没有索引签名；展开成对象字面量才能当锚点传。
      onClick={() => onOpenReader({ ...hit })}
      title={`第 ${Number(hit.page_idx) + 1} 页 · ${hit.block_id}`}
    >
      <Snippet text={hit.source_snippet} />
      {hit.translated_snippet ? <Snippet text={hit.translated_snippet} /> : null}
      <span className="lib-search-hit-meta">第 {Number(hit.page_idx) + 1} 页</span>
    </button>
  );
}

function DocumentRow({ doc, onOpenReader, onCycleStatus }: {
  doc: LibrarySearchDocumentRow;
  onOpenReader: (anchor: { document_id?: string; job_id?: string }) => void;
  onCycleStatus: (doc: LibrarySearchDocumentRow) => void;
}) {
  const meta = READING_STATUS_META[doc.reading_status ?? ""] || READING_STATUS_META.unread;
  return (
    <div className="lib-search-doc">
      <button
        type="button"
        className="lib-search-doc-open"
        onClick={() => onOpenReader({ document_id: doc.document_id, job_id: doc.active_job_id })}
      >
        <span className="lib-search-doc-title">{doc.title || doc.source_filename}</span>
        <span className="lib-search-doc-meta">
          {doc.page_count} 页
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

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "全部" },
  ...Object.entries(READING_STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
];

function LibrarySearchPanel({ ports }: { ports: LibrarySearchPorts }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<LibrarySearchHit[]>([]);
  const [documents, setDocuments] = useState<LibrarySearchDocumentRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | number>(0);
  const requestSeqRef = useRef(0);
  // 书目列表在一次检索里只取一次：每敲一个键都把整份书目重拉一遍没有必要。清空查询时作废，
  // 下次打开面板重新取；取失败也作废，下一次按键再试。
  const documentsRef = useRef<Promise<LibrarySearchDocumentRow[]> | null>(null);

  useEffect(() => ports.subscribeQuery(setQuery), [ports]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      documentsRef.current = null;
      setHits([]);
      setDocuments([]);
      setError("");
      setBusy(false);
      return undefined;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const seq = requestSeqRef.current + 1;
      requestSeqRef.current = seq;
      setBusy(true);
      if (!documentsRef.current) {
        const loading = ports.fetchDocumentList().then((result) => result?.documents || []);
        documentsRef.current = loading;
        loading.catch(() => {
          if (documentsRef.current === loading) documentsRef.current = null;
        });
      }
      try {
        const [searchResult, documentRows] = await Promise.all([
          ports.searchLibrary(trimmed),
          documentsRef.current,
        ]);
        if (requestSeqRef.current !== seq) {
          return;
        }
        setHits(searchResult?.hits || []);
        // 同一次检索里已经有书目时留着它：上面带着阅读状态的乐观更新，换成缓存会被冲回去。
        setDocuments((current) => (current.length ? current : documentRows));
        setError("");
      } catch (searchError) {
        if (requestSeqRef.current === seq) {
          setError((searchError as { message?: string } | null)?.message || "检索失败");
        }
      } finally {
        if (requestSeqRef.current === seq) {
          setBusy(false);
        }
      }
    }, 250);
    return () => {
      clearTimeout(debounceRef.current);
      // 查询一变就作废还在路上的请求：不然它回来时照样写回结果，新词的防抖期间先显示上一次的命中。
      requestSeqRef.current += 1;
    };
  }, [query, ports]);

  const cycleStatus = useCallback(async (doc: LibrarySearchDocumentRow) => {
    const next = nextReadingStatus(doc.reading_status);
    setDocuments((current) => current.map((item) => (
      item.document_id === doc.document_id ? { ...item, reading_status: next } : item
    )));
    try {
      await ports.patchDocument(doc.document_id, { reading_status: next });
    } catch (_err) {
      // 回滚乐观更新，但只在状态还是这次设的值时：连点两下、第一次失败的话，
      // 不能把第二次的结果也冲掉。
      setDocuments((current) => current.map((item) => (
        item.document_id === doc.document_id && item.reading_status === next
          ? { ...item, reading_status: doc.reading_status }
          : item
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
        <SegmentedControl
          size="sm"
          label="按阅读状态过滤"
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTER_OPTIONS}
        />
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

export function mountLibrarySearchApp(host: HTMLElement, ports: LibrarySearchPorts) {
  const root = createRoot(host);
  root.render(<LibrarySearchPanel ports={ports} />);
  return {
    unmount: () => root.unmount(),
  };
}
