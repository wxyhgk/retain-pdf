// Tab「术语」：这本书翻译时用的术语表、术语冲突、风格规则和领域判断。数据全部来自通用取数接口
// （第一次点开这个页签才读）。这里不改这本书的术语；「存为我的术语表」把它存成一张用户术语表
// （SaveTermsGlossaryDialog），在「设置 → 术语表」里改，翻译时选它。
import { useEffect, useState } from "react";
import { Button, Input, SegmentedControl } from "@retainpdf/ui";
import { BookmarkPlus, Check } from "lucide-react";

import { createGlossaryApi, fetchJobData } from "@/platform/api/index.js";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";
import { SaveTermsGlossaryDialog, type CreateGlossaryFromTerms } from "../panels/SaveTermsGlossaryDialog.js";
import type { JobDataView } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import {
  CATEGORY_LABELS,
  TREATMENT_LABELS,
  conflictRows,
  filterTerms,
  termCounts,
  termRows,
  type ConflictRow,
  type TermRow,
  type TreatmentFilter,
} from "../../domain/terms-model.js";

type Row = Record<string, unknown>;
type LoadDataset = (jobId: string, dataset: string, query?: Parameters<typeof fetchJobData>[3]) => Promise<JobDataView>;

const defaultLoad: LoadDataset = (jobId, dataset, query) => fetchJobData(jobId, API_PREFIX, dataset, query);
const defaultCreateGlossary: CreateGlossaryFromTerms = (payload) => createGlossaryApi(API_PREFIX, payload);

const VISIBLE_LIMIT = 300;
const FILTERS: TreatmentFilter[] = ["all", "lock", "keep_original", "free", "drop"];

type Loaded = {
  terms: TermRow[];
  termsTotal: number;
  conflicts: ConflictRow[];
  rules: Row[];
  styleGuide: Row | null;
  domain: Row | null;
};

function text(value: unknown): string {
  return `${value ?? ""}`.trim();
}

export function BookDetailTermsTab({
  jobId,
  title = "",
  load = defaultLoad,
  createGlossary = defaultCreateGlossary,
  onOpenGlossarySettings,
}: {
  jobId: string;
  /** 书名：存成术语表时做默认表名。 */
  title?: string;
  load?: LoadDataset;
  createGlossary?: CreateGlossaryFromTerms;
  /** 存好后的「去改」：打开设置的术语表页。页签不直接碰主页服务（架构门禁），由详情弹窗传进来；不给就不画。 */
  onOpenGlossarySettings?: () => void;
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [treatment, setTreatment] = useState<TreatmentFilter>("all");
  const [search, setSearch] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saved, setSaved] = useState<{ name: string; count: number } | null>(null);

  useEffect(() => {
    let disposed = false;
    setData(null);
    setError("");
    setSaved(null);
    if (!jobId) return undefined;
    Promise.all([
      load(jobId, "terms", { sort: "-frequency", limit: 1000 }),
      load(jobId, "term_conflicts", { limit: 1000 }),
      load(jobId, "style_rules", { limit: 200 }),
      load(jobId, "style_guide"),
      load(jobId, "domain_context"),
    ])
      .then(([terms, conflicts, rules, styleGuide, domain]) => {
        if (disposed) return;
        setData({
          terms: termRows(terms.rows as Row[] | undefined),
          termsTotal: terms.total,
          conflicts: conflictRows(conflicts.rows as Row[] | undefined),
          rules: (rules.rows as Row[] | undefined) || [],
          styleGuide: styleGuide.available ? (styleGuide.object as Row) : null,
          domain: domain.available ? (domain.object as Row) : null,
        });
      })
      .catch((err: unknown) => {
        if (!disposed) setError((err as { message?: string } | null)?.message || "读取术语失败。");
      });
    return () => { disposed = true; };
    // load 默认值不变，测试注入的也不变；只按任务重读。
  }, [jobId]);

  if (error) return <p className="book-detail-terms-note" role="alert">{error}</p>;
  if (!data) return <p className="book-detail-terms-note">正在读取术语…</p>;
  if (!data.terms.length && !data.rules.length && !data.domain) {
    return <p className="book-detail-terms-note" data-book-terms-empty="true">这本书翻译时没有抽取术语。选「统一术语」重新翻译时会生成。</p>;
  }

  const counts = termCounts(data.terms);
  const visible = filterTerms(data.terms, { treatment, search });
  const domainName = text(data.domain?.domain);
  const styleFailed = data.styleGuide && text(data.styleGuide.llm_status) === "failed";

  return (
    <div className="book-detail-tab-terms" data-book-detail-tab="terms">
      {domainName || text(data.domain?.summary) ? (
        <section className="book-detail-overview-card book-detail-terms-domain" aria-label="领域">
          <div className="book-detail-overview-card-heading"><h3>领域：{domainName || "未判断"}</h3></div>
          {text(data.domain?.summary) ? <p>{text(data.domain?.summary)}</p> : null}
          {text(data.domain?.translation_guidance) ? (
            <details>
              <summary>翻译指引</summary>
              <p className="book-detail-terms-guidance">{text(data.domain?.translation_guidance)}</p>
            </details>
          ) : null}
        </section>
      ) : null}

      <section className="book-detail-overview-card book-detail-terms-list" aria-label="术语表">
        <div className="book-detail-overview-card-heading">
          <h3>术语表</h3>
          <span className="book-detail-terms-sub">{counts.all} 个 · 冲突 {data.conflicts.length} 处</span>
          {counts.lock + counts.keep_original + counts.free > 0 ? (
            <Button variant="secondary" size="sm" id="book-detail-save-terms" className="book-detail-terms-save" onClick={() => setSaveOpen(true)}>
              <BookmarkPlus aria-hidden="true" />
              存为我的术语表
            </Button>
          ) : null}
        </div>
        {saved ? (
          <p className="book-detail-terms-saved" data-terms-saved="true" role="status">
            <Check aria-hidden="true" />
            <span>已存为术语表「{saved.name}」，共 {saved.count} 条。翻译时在选项里选它就能用。</span>
            {onOpenGlossarySettings ? (
              <Button variant="ghost" size="sm" className="book-detail-terms-saved-edit" onClick={onOpenGlossarySettings}>去改</Button>
            ) : null}
          </p>
        ) : null}
        <SegmentedControl<TreatmentFilter>
          size="sm"
          label="按处理方式"
          columns={3}
          className="book-detail-terms-filters"
          value={treatment}
          onChange={setTreatment}
          options={FILTERS.map((key) => ({
            value: key,
            label: `${key === "all" ? "全部" : TREATMENT_LABELS[key]} ${counts[key]}`,
            props: { "data-terms-filter": key },
          }))}
        />
        <Input
          type="search"
          size="sm"
          className="book-detail-terms-search"
          placeholder="搜原文或译文"
          aria-label="搜索术语"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {visible.length ? (
          <ol className="book-detail-terms-rows">
            {visible.slice(0, VISIBLE_LIMIT).map((row) => (
              <li key={`${row.source}\u0000${row.target}`} className="book-detail-terms-row" data-term-source={row.source}>
                <span className="book-detail-terms-source">{row.source}</span>
                <span className="book-detail-terms-target">{row.treatment === "keep_original" ? "（保留原文）" : row.target || "—"}</span>
                <span className="book-detail-terms-meta">
                  {CATEGORY_LABELS[row.category] || row.category}
                  {row.frequency ? ` · 出现 ${row.frequency} 次` : ""}
                  {row.conflictCount ? " · 有冲突" : ""}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="book-detail-terms-note">没有符合条件的术语。</p>
        )}
        {visible.length > VISIBLE_LIMIT ? <p className="book-detail-terms-note">只列出前 {VISIBLE_LIMIT} 个，共 {visible.length} 个；可以搜索缩小范围。</p> : null}
        {data.termsTotal > data.terms.length ? <p className="book-detail-terms-note">术语表共 {data.termsTotal} 个，这里读了前 {data.terms.length} 个。</p> : null}
      </section>

      <SaveTermsGlossaryDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        terms={data.terms}
        bookTitle={title}
        createGlossary={createGlossary}
        onSaved={(result) => {
          setSaved(result);
          // 提交窗口的术语表下拉只在第一次打开时读一次列表，告诉它重读（create-lifecycle 接）。
          document.dispatchEvent(new CustomEvent(APP_EVENTS.glossariesChanged));
        }}
      />

      {data.conflicts.length ? (
        <section className="book-detail-overview-card book-detail-terms-conflicts" aria-label="术语冲突">
          <div className="book-detail-overview-card-heading"><h3>译法冲突</h3><span className="book-detail-terms-sub">抽取时各段给出的译法不一致，最后定了左边这个</span></div>
          <ol className="book-detail-terms-rows">
            {data.conflicts.map((row) => (
              <li key={row.source} className="book-detail-terms-row">
                <span className="book-detail-terms-source">{row.source}</span>
                <span className="book-detail-terms-target">{row.target}</span>
                {row.candidates ? <span className="book-detail-terms-meta">其它译法：{row.candidates}</span> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {data.rules.length ? (
        <section className="book-detail-overview-card book-detail-terms-rules" aria-label="风格规则">
          <div className="book-detail-overview-card-heading"><h3>风格规则</h3></div>
          {styleFailed ? <p className="book-detail-terms-warning">这本书的风格指南没生成成功，下面是通用规则。</p> : null}
          <ol className="book-detail-terms-rule-list">
            {data.rules.map((rule, index) => (
              <li key={text(rule.id) || index}>
                <p>{text(rule.rule)}</p>
                {text(rule.example) ? <p className="book-detail-terms-meta">例：{text(rule.example)}</p> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
