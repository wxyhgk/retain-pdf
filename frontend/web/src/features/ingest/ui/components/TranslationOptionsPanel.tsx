// 翻译选项面板（主弹窗内联展开，非第二层 Dialog）。
//
// DOM id "page-range-dialog" / "page-range-title" 为历史契约（测试与样式锚点），保留不改。

import type { FormEvent } from "react";
import { BookOpen, FileText, LayoutTemplate, Sparkles, SlidersHorizontal, Table, X } from "lucide-react";

import { LegacyButton } from "@retainpdf/ui";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { useIngestServices, useIngestWorkflowView } from "../workflow-view-context.js";

const QUALITY_HINTS: Record<string, string> = {
  standard: "直接翻译，速度最快、费用最低。",
  terms: "先通读全书定好术语和文风再翻译，译法更一致；模型费用多约 0.4 倍。",
  refined: "用翻译 agent：先通读全文定好术语，再逐页翻译并审校，费用和耗时都比普通高。开头通读要一会儿，进度会先停在 0。",
};

const ENGINE_HINTS: Record<string, string> = {
  auto: "目前默认用自研排版引擎；以后服务端换默认，这里跟着换。",
  rpr_fit: "自研排版引擎：公式不再转换成 Typst，字号按实际放得下的大小来定，放不下会报告。出问题自动退回 Typst。",
  typst: "原来的 Typst 排版，公式要先转换一遍，个别公式可能出错。",
};

const TABLE_HINTS: Record<string, string> = {
  keep: "表格保留原文。",
  translate: "试验：正文翻完后逐张翻表格，只翻有文字层的表；阅读页能看到，译文 PDF 里表格还是原文。会多花一些 token，用量页记在「表格翻译」。",
};

/** hidePageRange：一次上传多本时每本整本处理，不给页码范围。 */
export function TranslationOptionsPanel({ hidePageRange = false }: { hidePageRange?: boolean } = {}) {
  const { uploadViewStore, features } = useIngestServices();
  const workflowView = useIngestWorkflowView();
  const upload = useStoreSnapshot(uploadViewStore);
  const workflow = useStoreSnapshot(workflowView.store);

  if (!upload.translationOptionsOpen) return null;

  const selectedId = `${workflow.selectedGlossaryId || ""}`.trim();
  const hasSelected = !selectedId
    || workflow.glossaries.some((glossary) => glossary.glossaryId === selectedId);
  const maxAttr = upload.pageRangeMax > 0 ? { max: `${upload.pageRangeMax}` } : {};

  function handlePageInput(source: "start" | "end", event: FormEvent<HTMLInputElement>) {
    const value = event.currentTarget.value;
    uploadViewStore.actions.setPageRange(
      source === "start" ? { start: value } : { end: value },
    );
    features.uploadFeature?.constrainPageRanges({ source });
  }

  return (
    <section
      id="page-range-dialog"
      className="translation-options-panel"
      aria-labelledby="page-range-title"
    >
      <div className="translation-options-head">
        <div>
          <h3 id="page-range-title">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            翻译选项
          </h3>
          <p id="page-range-limit-text">
            {hidePageRange
              ? "这一批每本都整本处理；术语表、翻译质量、排版引擎和表格对每本都一样。"
              : "按需设置页码范围、术语表和翻译质量；页码留空表示处理整份 PDF。"}
          </p>
        </div>
        <LegacyButton
          id="page-range-close-btn"
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="收起翻译选项"
          onClick={() => uploadViewStore.actions.closeTranslationOptions()}
        >
          <X aria-hidden="true" />
        </LegacyButton>
      </div>

      <div className="translation-options-grid">
        <fieldset className={`translation-options-range${hidePageRange ? " hidden" : ""}`}>
          <legend>
            <FileText className="h-4 w-4" aria-hidden="true" />
            页码范围
          </legend>
          <div>
            <label htmlFor="page-range-start">起始页</label>
            <input
              id="page-range-start"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              autoComplete="off"
              placeholder="1"
              {...maxAttr}
              value={upload.pageRangeStart}
              onInput={(event) => handlePageInput("start", event)}
            />
          </div>
          <span className="translation-options-range-separator" aria-hidden="true">—</span>
          <div>
            <label htmlFor="page-range-end">结束页</label>
            <input
              id="page-range-end"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              autoComplete="off"
              placeholder={upload.pageRangeMax > 0 ? `${upload.pageRangeMax}` : "总页数"}
              {...maxAttr}
              value={upload.pageRangeEnd}
              onInput={(event) => handlePageInput("end", event)}
            />
          </div>
        </fieldset>

        <label className="translation-options-glossary" htmlFor="job-glossary-id">
          <span>
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            术语表
          </span>
          <select
            id="job-glossary-id"
            value={selectedId}
            onChange={(event) => workflowView.setSelectedGlossaryId(event.target.value)}
          >
            <option value="">不使用术语表</option>
            {workflow.glossaries.map((glossary) => (
              <option key={glossary.glossaryId} value={glossary.glossaryId}>
                {glossary.name}
                {Number.isFinite(glossary.entryCount) ? ` (${glossary.entryCount})` : ""}
              </option>
            ))}
            {!hasSelected ? (
              <option value={selectedId}>{`已删除或不可用: ${selectedId}`}</option>
            ) : null}
          </select>
        </label>

        <label className="translation-options-glossary" htmlFor="job-translation-quality">
          <span>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            翻译质量
          </span>
          <select
            id="job-translation-quality"
            value={workflow.preferences.translationQuality}
            onChange={(event) => workflowView.setPreference("translationQuality", event.target.value)}
          >
            <option value="standard">普通</option>
            <option value="terms">统一术语</option>
            <option value="refined">精翻（翻译 agent）</option>
          </select>
          <small id="job-translation-quality-hint">
            {QUALITY_HINTS[workflow.preferences.translationQuality] || QUALITY_HINTS.standard}
          </small>
        </label>

        <label className="translation-options-glossary" htmlFor="job-render-engine">
          <span>
            <LayoutTemplate className="h-4 w-4" aria-hidden="true" />
            排版引擎
          </span>
          <select
            id="job-render-engine"
            value={workflow.preferences.renderEngine}
            onChange={(event) => workflowView.setPreference("renderEngine", event.target.value)}
          >
            <option value="auto">默认（新引擎）</option>
            <option value="rpr_fit">新引擎</option>
            <option value="typst">Typst（旧）</option>
          </select>
          <small id="job-render-engine-hint">
            {ENGINE_HINTS[workflow.preferences.renderEngine] || ENGINE_HINTS.auto}
          </small>
        </label>

        <label className="translation-options-glossary" htmlFor="job-table-translation">
          <span>
            <Table className="h-4 w-4" aria-hidden="true" />
            表格
          </span>
          <select
            id="job-table-translation"
            value={workflow.preferences.tableTranslation}
            onChange={(event) => workflowView.setPreference("tableTranslation", event.target.value)}
          >
            <option value="keep">保留原文</option>
            <option value="translate">翻译表格（试验）</option>
          </select>
          <small id="job-table-translation-hint">
            {TABLE_HINTS[workflow.preferences.tableTranslation] || TABLE_HINTS.keep}
          </small>
        </label>
      </div>

      <div className="translation-options-actions">
        <LegacyButton
          id="page-range-clear-btn"
          type="button"
          variant="outline"
          className={hidePageRange ? "hidden" : undefined}
          onClick={() => features.uploadFeature?.clearPageRanges()}
        >
          清除页码
        </LegacyButton>
        <LegacyButton
          id="page-range-apply-btn"
          type="button"
          onClick={() => features.uploadFeature?.applyPageRanges()}
        >
          完成
        </LegacyButton>
      </div>
    </section>
  );
}
