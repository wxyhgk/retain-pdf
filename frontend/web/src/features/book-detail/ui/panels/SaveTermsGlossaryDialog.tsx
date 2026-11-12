// 「术语」页签的「存为我的术语表」：把这本书翻译时抽出来的术语存成一张用户术语表，
// 下次翻译别的书（或重翻这本）时在选项里选它，译法就和这本一致。
//
// 用户反馈：#99（想先让模型提炼术语、再人工增删改）、#145（怎么自动生成术语表）。这本书的术语已经是
// 模型提炼 + 术语专员审过的，存成术语表以后在「设置 → 术语表」里就能增删改。
// 后端接口是现成的 POST /glossaries；存好以后发 glossariesChanged，提交窗口的术语表下拉会重读。

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogShell,
  DialogTitle,
  FormStatusLine,
  Input,
} from "@retainpdf/ui";

import {
  SAVEABLE_TREATMENTS,
  TREATMENT_LABELS,
  defaultGlossaryName,
  glossaryEntriesFromTerms,
  type GlossaryEntryDraft,
  type SaveableTreatment,
  type TermRow,
} from "../../domain/terms-model.js";

export type CreateGlossaryFromTerms = (payload: {
  name: string;
  description: string;
  entries: GlossaryEntryDraft[];
}) => Promise<{ glossary_id?: string; name?: string } | unknown>;

export type SaveTermsGlossaryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terms: readonly TermRow[];
  bookTitle: string;
  createGlossary: CreateGlossaryFromTerms;
  /** 存好了：表名、条数。 */
  onSaved: (result: { name: string; count: number }) => void;
};

const DEFAULT_INCLUDE: readonly SaveableTreatment[] = ["lock", "keep_original"];

export function SaveTermsGlossaryDialog({
  open,
  onOpenChange,
  terms,
  bookTitle,
  createGlossary,
  onSaved,
}: SaveTermsGlossaryDialogProps) {
  const [name, setName] = useState("");
  const [include, setInclude] = useState<readonly SaveableTreatment[]>(DEFAULT_INCLUDE);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  // 每次打开都从默认值开始：上次没存成的半截输入不留。
  useEffect(() => {
    if (!open) return;
    setName(defaultGlossaryName(bookTitle));
    setInclude(DEFAULT_INCLUDE);
    setError("");
    setPending(false);
  }, [open, bookTitle]);

  const counts = useMemo(() => {
    const result: Record<SaveableTreatment, number> = { lock: 0, keep_original: 0, free: 0 };
    for (const row of terms) if (row.treatment in result) result[row.treatment as SaveableTreatment] += 1;
    return result;
  }, [terms]);
  const draft = useMemo(() => glossaryEntriesFromTerms(terms, include), [terms, include]);
  const trimmedName = name.trim();
  const canSave = Boolean(trimmedName) && draft.entries.length > 0 && !pending;

  const toggle = (treatment: SaveableTreatment, checked: boolean) => {
    setInclude((previous) => (checked
      ? SAVEABLE_TREATMENTS.filter((key) => key === treatment || previous.includes(key))
      : previous.filter((key) => key !== treatment)));
  };

  const save = async () => {
    if (!canSave) return;
    setPending(true);
    setError("");
    try {
      await createGlossary({
        name: trimmedName,
        description: `从《${`${bookTitle || ""}`.trim() || "这本书"}》翻译时抽取的术语生成`,
        entries: draft.entries,
      });
      onSaved({ name: trimmedName, count: draft.entries.length });
      onOpenChange(false);
    } catch (cause) {
      setError((cause as { message?: string } | null)?.message || "保存术语表失败，请稍后重试。");
    } finally {
      setPending(false);
    }
  };

  return (
    // 书籍详情本身是对话框，这里要 nested（见 ArtifactQuickDownloads 的说明）。
    <Dialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next); }}>
      <DialogContent id="book-detail-save-terms-dialog" level="nested" showCloseButton={false} size="compact">
        <DialogShell>
          <DialogHeader>
            <DialogTitle>存为我的术语表</DialogTitle>
            <DialogCloseButton />
          </DialogHeader>
          <DialogBody>
            <DialogDescription>
              存好以后在「设置 → 术语表」里可以增删改；翻译时在选项里选它，译法就和这本书一致。
            </DialogDescription>
            <div className="book-detail-save-terms-form">
              <label className="book-detail-save-terms-field">
                <span>表名</span>
                <Input
                  size="sm"
                  id="book-detail-save-terms-name"
                  value={name}
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <fieldset className="book-detail-save-terms-kinds">
                <legend>存哪些</legend>
                {SAVEABLE_TREATMENTS.map((treatment) => (
                  <Checkbox
                    key={treatment}
                    data-save-terms-kind={treatment}
                    label={`${TREATMENT_LABELS[treatment]}（${counts[treatment]}）${treatment === "free" ? "：模型本来就能自己翻，一般不用存" : ""}`}
                    checked={include.includes(treatment)}
                    disabled={!counts[treatment]}
                    onChange={(event) => toggle(treatment, event.target.checked)}
                  />
                ))}
              </fieldset>
              <p className="book-detail-terms-note" data-save-terms-summary="true">
                将存 {draft.entries.length} 条
                {draft.truncated ? `；一张表最多 1000 条，出现次数少的 ${draft.truncated} 条没放进去` : ""}
                {draft.skipped ? `；${draft.skipped} 条没有译文或太长，跳过` : ""}
                。
              </p>
            </div>
            <FormStatusLine status={error ? { message: error, tone: "error" } : null} />
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => onOpenChange(false)}>取消</Button>
            <Button variant="primary" size="sm" id="book-detail-save-terms-submit" pending={pending} disabled={!canSave} onClick={() => void save()}>
              保存
            </Button>
          </DialogFooter>
        </DialogShell>
      </DialogContent>
    </Dialog>
  );
}
