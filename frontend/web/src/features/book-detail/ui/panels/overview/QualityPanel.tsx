// 书籍详情 ·「质量」页签：自动检查、精修、排版、漏翻各一行，要看的可以展开列表，点一条直接打开
// 阅读页跳到那一块。总数来自 quality-summary，明细来自通用取数接口（quality-list-loader.ts）。
import { useEffect, useState } from "react";
import { ChevronDown, ShieldCheck, TriangleAlert } from "lucide-react";

import { fetchQualitySummary } from "@/platform/api/index.js";
import type { QualitySummaryView } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { buildReaderUrl } from "@/platform/navigation/pages.js";
import { navigateToReader } from "@/features/reader/domain.js";
import { qualityModel, type QualityListLink } from "../../../domain/quality-model.js";
import {
  createQualityListLoader,
  type LoadQualityList,
  type QualityList,
  type QualityListItem,
} from "../../quality-list-loader.js";

const defaultLoadSummary = (jobId: string) => fetchQualitySummary(jobId, API_PREFIX);
const defaultLoadItems: LoadQualityList = createQualityListLoader();

function openInReader(jobId: string, documentId: string, item: QualityListItem) {
  navigateToReader(buildReaderUrl(jobId, {
    ...(item.page > 0 ? { page: item.page - 1 } : {}),
    ...(item.readerItemId ? { blockId: item.readerItemId } : {}),
  }, { documentId }));
}

function ItemList({ jobId, documentId, link, loadItems }: { jobId: string; documentId: string; link: QualityListLink; loadItems: LoadQualityList }) {
  const [state, setState] = useState<QualityList & { error: string; loading: boolean }>(
    { items: [], total: 0, error: "", loading: true },
  );
  useEffect(() => {
    let disposed = false;
    loadItems(jobId, link.kind)
      .then((view) => { if (!disposed) setState({ items: view.items || [], total: view.total || 0, error: "", loading: false }); })
      .catch((err: unknown) => {
        if (!disposed) setState({ items: [], total: 0, loading: false, error: (err as { message?: string } | null)?.message || "读取明细失败。" });
      });
    return () => { disposed = true; };
  }, [jobId, link.kind, loadItems]);
  if (state.loading) return <p className="book-detail-quality-list-note">正在读取…</p>;
  if (state.error) return <p className="book-detail-quality-list-note" role="alert">{state.error}</p>;
  if (!state.items.length) return <p className="book-detail-quality-list-note">没有明细。</p>;
  return (
    <>
      <ol className="book-detail-quality-list" data-quality-list={link.kind}>
        {state.items.map((item) => (
          <li key={item.key}>
            <button type="button" className="book-detail-quality-list-item" onClick={() => openInReader(jobId, documentId, item)}>
              <span className="book-detail-quality-list-page">第 {item.page} 页</span>
              <span className="book-detail-quality-list-body">
                <span className="book-detail-quality-list-reason">{item.title}</span>
                {item.detail ? <span className="book-detail-quality-list-detail">{item.detail}</span> : null}
              </span>
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
  loadItems?: LoadQualityList;
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
  if (!jobId) return null;
  if (!error && !summary) return <p className="book-detail-quality-list-note">正在读取质量检查结果…</p>;
  if (!error && model.empty) {
    return <p className="book-detail-quality-list-note" data-book-quality-empty="true">翻译完成后，这里会显示自动检查、精修和排版的结果。</p>;
  }

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
              {row.lists?.length ? (
                <span className="book-detail-quality-row-toggles">
                  {row.lists.map((link) => {
                    const key = `${row.key}:${link.kind}`;
                    return (
                      <button
                        key={key}
                        type="button"
                        className="book-detail-quality-row-toggle"
                        data-quality-toggle={link.kind}
                        aria-expanded={openKey === key}
                        onClick={() => setOpenKey((current) => (current === key ? "" : key))}
                      >
                        {link.label}
                        <ChevronDown aria-hidden="true" />
                      </button>
                    );
                  })}
                </span>
              ) : null}
              {row.lists?.map((link) => (openKey === `${row.key}:${link.kind}` ? (
                <ItemList key={link.kind} jobId={jobId} documentId={documentId} link={link} loadItems={loadItems} />
              ) : null))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
