// 书籍详情 · 概览里的「译文质量」卡：自动检查、精修、排版、漏翻各一行，要看的可以展开列表，
// 点一条直接打开阅读页跳到那一块。规则见 domain/quality-model.ts。
import { useEffect, useState } from "react";
import { ChevronDown, ShieldCheck, TriangleAlert } from "lucide-react";

import { fetchQualityItems, fetchQualitySummary } from "@/platform/api/index.js";
import type { QualityItem, QualitySummaryView } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { buildReaderUrl } from "@/platform/navigation/pages.js";
import { navigateToReader } from "@/features/reader/domain.js";
import { qualityItemReason, qualityModel, type QualityListKind, type QualityRow } from "../../../domain/quality-model.js";

const LIST_LIMIT = 50;

type LoadItems = (jobId: string, kind: QualityListKind) => Promise<{ total: number; items: QualityItem[] }>;

const defaultLoadSummary = (jobId: string) => fetchQualitySummary(jobId, API_PREFIX);
const defaultLoadItems: LoadItems = (jobId, kind) =>
  fetchQualityItems(jobId, API_PREFIX, { kind, limit: LIST_LIMIT, ...(kind === "qa" ? { severity: "major" } : {}) });

function openInReader(jobId: string, documentId: string, item: QualityItem) {
  const page = Number(item.page);
  navigateToReader(buildReaderUrl(jobId, {
    ...(Number.isFinite(page) && page > 0 ? { page: page - 1 } : {}),
    blockId: item.item_id,
  }, { documentId }));
}

function ItemList({ jobId, documentId, row, loadItems }: { jobId: string; documentId: string; row: QualityRow; loadItems: LoadItems }) {
  const [state, setState] = useState<{ items: QualityItem[]; total: number; error: string; loading: boolean }>(
    { items: [], total: 0, error: "", loading: true },
  );
  useEffect(() => {
    let disposed = false;
    loadItems(jobId, row.list!.kind)
      .then((view) => { if (!disposed) setState({ items: view.items || [], total: view.total || 0, error: "", loading: false }); })
      .catch((err: unknown) => {
        if (!disposed) setState({ items: [], total: 0, loading: false, error: (err as { message?: string } | null)?.message || "读取明细失败。" });
      });
    return () => { disposed = true; };
  }, [jobId, row.list, loadItems]);
  if (state.loading) return <p className="book-detail-quality-list-note">正在读取…</p>;
  if (state.error) return <p className="book-detail-quality-list-note" role="alert">{state.error}</p>;
  if (!state.items.length) return <p className="book-detail-quality-list-note">没有明细。</p>;
  return (
    <>
      <ol className="book-detail-quality-list" data-quality-list={row.list!.kind}>
        {state.items.map((item, index) => (
          <li key={`${item.id || item.item_id}-${index}`}>
            <button type="button" className="book-detail-quality-list-item" onClick={() => openInReader(jobId, documentId, item)}>
              <span className="book-detail-quality-list-page">第 {item.page} 页</span>
              <span className="book-detail-quality-list-reason">{qualityItemReason(item)}</span>
            </button>
          </li>
        ))}
      </ol>
      {state.total > state.items.length ? (
        <p className="book-detail-quality-list-note">只列出前 {state.items.length} 条，共 {state.total} 条。</p>
      ) : null}
    </>
  );
}

export function QualityPanel({
  jobId,
  documentId,
  loadSummary = defaultLoadSummary,
  loadItems = defaultLoadItems,
}: {
  jobId: string;
  documentId: string;
  loadSummary?: (jobId: string) => Promise<QualitySummaryView>;
  loadItems?: LoadItems;
}) {
  const [summary, setSummary] = useState<QualitySummaryView | null>(null);
  const [error, setError] = useState("");
  const [openKey, setOpenKey] = useState("");
  useEffect(() => {
    let disposed = false;
    setSummary(null);
    setError("");
    setOpenKey("");
    if (!jobId) return undefined;
    loadSummary(jobId)
      .then((view) => { if (!disposed) setSummary(view); })
      .catch((err: unknown) => {
        if (!disposed) setError((err as { message?: string } | null)?.message || "读取质量摘要失败。");
      });
    return () => { disposed = true; };
    // loadSummary 默认值每次渲染都是同一个函数；测试注入的也不变。只按任务重读。
  }, [jobId]);

  const model = qualityModel(summary);
  // 没报告（还没翻译完）就整张卡不出现；读失败给一句，不占大块地方。
  if (!jobId || (!error && (model.empty || !summary))) return null;

  return (
    <section className="book-detail-overview-card book-detail-quality-card" aria-label="译文质量" data-book-quality="true">
      <div className="book-detail-overview-card-heading">
        <h3><ShieldCheck aria-hidden="true" />译文质量</h3>
        {model.attentionCount ? <span className="book-detail-quality-attention">{model.attentionCount} 处要看</span> : null}
      </div>
      {error ? <p className="book-detail-quality-list-note" role="alert">{error}</p> : null}
      {model.warnings.length ? (
        <ul className="book-detail-quality-warnings">
          {model.warnings.map((warning) => (
            <li key={warning}><TriangleAlert aria-hidden="true" />{warning}</li>
          ))}
        </ul>
      ) : null}
      <dl className="book-detail-quality-rows">
        {model.rows.map((row) => (
          <div key={row.key} className={`book-detail-quality-row is-${row.tone}`} data-quality-row={row.key}>
            <dt>{row.label}</dt>
            <dd>
              <strong>{row.value}</strong>
              {row.detail ? <span className="book-detail-quality-row-detail">{row.detail}</span> : null}
              {row.breakdown?.length ? (
                <span className="book-detail-quality-row-breakdown">
                  {row.breakdown.map((part) => `${part.label} ${part.value}`).join(" · ")}
                </span>
              ) : null}
              {row.list ? (
                <button
                  type="button"
                  className="book-detail-quality-row-toggle"
                  aria-expanded={openKey === row.key}
                  onClick={() => setOpenKey((key) => (key === row.key ? "" : row.key))}
                >
                  {row.list.label}
                  <ChevronDown aria-hidden="true" />
                </button>
              ) : null}
              {openKey === row.key && row.list ? (
                <ItemList jobId={jobId} documentId={documentId} row={row} loadItems={loadItems} />
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
