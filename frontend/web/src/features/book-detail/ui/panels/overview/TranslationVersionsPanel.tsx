// 概览里的「译文版本」卡：读哪一份译文（下拉，第一项「自动（最新）」），选了固定版本后又翻出新的时提示，
// 「改名、隐藏」收在下面的折叠区（版本不能删，隐藏了随时能恢复）。只有一份译文的书不显示（hasVersionChoice）。
// TranslationVersionsCard 接上 useTranslationVersions（详情弹窗只放一行）；TranslationVersionsPanel 只管画，测试直接喂数据。
import { useState } from "react";
import { Button, Input, Select } from "@retainpdf/ui";
import type { TranslationVersionsView } from "@retainpdf/contracts/library-documents";

import {
  AUTO_VERSION,
  VERSION_LABEL_MAX,
  hasVersionChoice,
  newestVersion,
  normalizeVersionLabel,
  versionLabel,
  versionOptions,
} from "../../../domain/translation-versions-model.js";
import { useTranslationVersions, type TranslationVersionsApi } from "../../use-translation-versions.js";

export type TranslationVersionsPanelProps = {
  view: TranslationVersionsView | null;
  busy?: boolean;
  error?: string;
  onSelect: (versionId: string | null) => unknown;
  onRename: (versionId: string, label: string) => Promise<boolean> | unknown;
  onSetHidden: (versionId: string, hidden: boolean) => unknown;
};

export function TranslationVersionsPanel({ view, busy = false, error = "", onSelect, onRename, onSetHidden }: TranslationVersionsPanelProps) {
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);
  if (!view || !hasVersionChoice(view)) return null;

  const current = view.current_version_id || AUTO_VERSION;
  const newer = newestVersion(view);
  const saveRename = async () => {
    if (!editing) return;
    const ok = await onRename(editing.id, normalizeVersionLabel(editing.draft));
    if (ok !== false) setEditing(null);
  };

  return (
    <section className="book-detail-overview-card book-detail-versions" aria-label="译文版本" data-book-detail-section="versions">
      <div className="book-detail-overview-card-heading">
        <h3>译文版本</h3>
        <span className="book-detail-versions-sub">{view.versions.filter((v) => !v.hidden).length} 份</span>
      </div>
      <Select
        id="book-detail-translation-version"
        size="sm"
        aria-label="阅读用哪一份译文"
        className="book-detail-versions-select"
        value={current}
        disabled={busy}
        onChange={(event) => { void onSelect(event.target.value || null); }}
      >
        {versionOptions(view).map((option) => (
          <option key={option.value || "auto"} value={option.value}>{option.label}</option>
        ))}
      </Select>
      <p className="book-detail-versions-hint">
        {current === AUTO_VERSION
          ? "每页用最新翻好的译文，新译文翻完自动换上。"
          : "阅读固定用这一份；只翻了几页的版本，其余页用它的来源版本。之后再翻出新译文只提示，不自动换。"}
      </p>
      {newer ? (
        <p className="book-detail-versions-newer" role="status" data-versions-newer="true">
          <span>有新版本：{newer.name}</span>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => { void onSelect(null); }}>换到最新</Button>
        </p>
      ) : null}
      {error ? <p className="book-detail-versions-error" role="alert">{error}</p> : null}

      <details className="book-detail-versions-manage">
        <summary>改名、隐藏</summary>
        <ol className="book-detail-versions-list">
          {[...view.versions].reverse().map((version) => {
            const isEditing = editing?.id === version.version_id;
            return (
              <li key={version.version_id} className="book-detail-versions-item" data-version-id={version.version_id} data-hidden={version.hidden ? "true" : undefined}>
                {isEditing ? (
                  <form
                    className="book-detail-versions-rename"
                    onSubmit={(event) => { event.preventDefault(); void saveRename(); }}
                  >
                    <Input
                      size="sm"
                      aria-label="版本名"
                      placeholder="留空用自动生成的名字"
                      maxLength={VERSION_LABEL_MAX}
                      value={editing.draft}
                      autoFocus
                      onChange={(event) => setEditing({ id: version.version_id, draft: event.target.value })}
                    />
                    <Button type="submit" size="sm" disabled={busy}>保存</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>取消</Button>
                  </form>
                ) : (
                  <>
                    <span className="book-detail-versions-name">
                      {versionLabel(version)}
                      {version.hidden ? <em>（已隐藏）</em> : null}
                    </span>
                    <span className="book-detail-versions-actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        data-version-action="rename"
                        onClick={() => setEditing({ id: version.version_id, draft: version.label })}
                      >改名</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        data-version-action={version.hidden ? "unhide" : "hide"}
                        onClick={() => { void onSetHidden(version.version_id, !version.hidden); }}
                      >{version.hidden ? "恢复" : "隐藏"}</Button>
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
        <p className="book-detail-versions-hint">版本不能删，只能隐藏；隐藏的是正在用的那份时，阅读回到「自动」。</p>
      </details>
    </section>
  );
}

/** 概览里放的那张卡：概览页签显示时才读版本，之后任务状态一变重读。 */
export function TranslationVersionsCard({
  open,
  documentId,
  jobs,
  ready = true,
  api,
}: {
  open: boolean;
  documentId: string;
  jobs: Array<{ job_id?: string; id?: string; status?: string }>;
  ready?: boolean;
  api?: TranslationVersionsApi;
}) {
  const versions = useTranslationVersions({ open, documentId, jobs, ready, api });
  return (
    <TranslationVersionsPanel
      view={versions.view}
      busy={versions.busy}
      error={versions.error}
      onSelect={versions.select}
      onRename={versions.rename}
      onSetHidden={versions.setHidden}
    />
  );
}
