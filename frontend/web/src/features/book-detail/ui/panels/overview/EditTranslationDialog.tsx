// 「质量」页签里一条问题的「改译」：看原文、改译文、或者让模型重翻这一段，满意了保存。
//
// 存的是这一段的译文（PATCH /jobs/:id/translations/:item_id，source=user），不重排版——改几段以后在质量页上
// 点一次「重新排版」，译文 PDF 才会更新（排版期间任务是运行中，不能再改）。重翻（POST …/replay）只给候选，
// 不写回，用户看过点保存才算数。后端会检查新译文（公式符号成对、占位符对得上……），没过就不保存，这里列出原因。

import { useEffect, useRef, useState } from "react";
import {
  Button,
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
  Textarea,
} from "@retainpdf/ui";
import { Sparkles } from "lucide-react";

import {
  fetchTranslationItem,
  replayTranslationItem,
  reviseTranslationItem,
  type TranslationRevisionIssueView,
} from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { editableTranslation, issueText, replayOutcome } from "../../../domain/translation-edit-model.js";

export type TranslationEditPorts = {
  load: (jobId: string, itemId: string) => Promise<{ item?: Record<string, unknown> } | null>;
  replay: (jobId: string, itemId: string) => Promise<unknown>;
  revise: (jobId: string, itemId: string, body: {
    translated_text: string;
    source: "user";
    reason?: string;
    expected_generation?: number | null;
  }) => Promise<{ generation?: number; changed?: boolean } | unknown>;
};

export const defaultTranslationEditPorts: TranslationEditPorts = {
  load: (jobId, itemId) => fetchTranslationItem(jobId, itemId, API_PREFIX),
  replay: (jobId, itemId) => replayTranslationItem(jobId, itemId, API_PREFIX),
  revise: (jobId, itemId, body) => reviseTranslationItem(jobId, itemId, body, API_PREFIX),
};

export type EditTranslationTarget = { itemId: string; page: number; problem: string };

export function EditTranslationDialog({
  jobId,
  target,
  onClose,
  onSaved,
  expectedGeneration = null,
  ports = defaultTranslationEditPorts,
}: {
  /** 持有译文的任务。 */
  jobId: string;
  /** 要改的那一段；null 时窗口关着。 */
  target: EditTranslationTarget | null;
  onClose: () => void;
  /** 存好了（changed=false 表示和原来一样，没写）。generation 给下一次保存防冲突用。 */
  onSaved: (result: { itemId: string; changed: boolean; generation: number | null }) => void;
  expectedGeneration?: number | null;
  ports?: TranslationEditPorts;
}) {
  const open = Boolean(target);
  // 关窗有淡出动画：target 先清空、窗口还在，标题行要接着显示刚才那一段，不能闪成「第 ? 页」。
  const lastTarget = useRef<EditTranslationTarget | null>(null);
  if (target) lastTarget.current = target;
  const shown = target || lastTarget.current;
  const itemId = target?.itemId || "";
  const [source, setSource] = useState("");
  const [original, setOriginal] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"" | "replay" | "save">("");
  const [status, setStatus] = useState<{ message: string; tone: string } | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !jobId || !itemId) return undefined;
    let disposed = false;
    setLoading(true);
    setStatus(null);
    setIssues([]);
    setSource("");
    setOriginal("");
    setDraft("");
    ports.load(jobId, itemId)
      .then((view) => {
        if (disposed) return;
        const { source: src, translated } = editableTranslation(view?.item);
        setSource(src);
        setOriginal(translated);
        setDraft(translated);
      })
      .catch((cause: unknown) => {
        if (!disposed) setStatus({ message: (cause as Error)?.message || "读取这段译文失败。", tone: "error" });
      })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
    // ports 默认值不变，测试注入的也不变；只按要改的那一段重读。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobId, itemId]);

  const replay = async () => {
    setBusy("replay");
    setStatus({ message: "正在让模型重翻这一段（可能要一两分钟）…", tone: "pending" });
    setIssues([]);
    try {
      const outcome = replayOutcome(await ports.replay(jobId, itemId) as Parameters<typeof replayOutcome>[0]);
      if (outcome.kind === "candidate") {
        setDraft(outcome.text);
        setStatus({ message: "模型给的新译文已经填进框里，看看合不合适，可以再改，满意就保存。", tone: "valid" });
      } else if (outcome.kind === "keep_origin") {
        setStatus({ message: "模型认为这一段应该保留原文，没有改编辑框。", tone: "valid" });
      } else {
        setStatus({ message: outcome.message, tone: "error" });
      }
    } catch (cause) {
      setStatus({ message: (cause as Error)?.message || "重翻失败，请稍后再试。", tone: "error" });
    } finally {
      setBusy("");
    }
  };

  const save = async () => {
    setBusy("save");
    setStatus(null);
    setIssues([]);
    try {
      const result = await ports.revise(jobId, itemId, {
        translated_text: draft,
        source: "user",
        reason: "在质量页手动修改",
        ...(expectedGeneration != null ? { expected_generation: expectedGeneration } : {}),
      }) as { generation?: number; changed?: boolean } | null;
      onSaved({
        itemId,
        changed: result?.changed !== false,
        generation: Number.isFinite(Number(result?.generation)) ? Number(result?.generation) : null,
      });
      onClose();
    } catch (cause) {
      const error = cause as Error & { issues?: TranslationRevisionIssueView[] };
      setStatus({ message: error?.message || "保存失败，请稍后再试。", tone: "error" });
      setIssues((error?.issues || []).filter((issue) => issue?.severity !== "warning").map(issueText));
    } finally {
      setBusy("");
    }
  };

  const unchanged = draft === original;
  return (
    // 书籍详情本身是对话框，这里要 nested（见 ArtifactQuickDownloads 的说明）。
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <DialogContent id="book-detail-edit-translation-dialog" level="nested" showCloseButton={false} size="wide">
        <DialogShell>
          <DialogHeader>
            <DialogTitle>改这段译文</DialogTitle>
            <DialogCloseButton />
          </DialogHeader>
          <DialogBody>
            <DialogDescription>
              第 {shown?.page || "?"} 页 · {shown?.problem || ""}。存好以后在质量页点「重新排版」，译文 PDF 才会更新。
            </DialogDescription>
            {loading ? <p className="book-detail-edit-translation-note">正在读取这段译文…</p> : (
              <div className="book-detail-edit-translation-form">
                <section aria-label="原文">
                  <h4>原文</h4>
                  <p className="book-detail-edit-translation-source" data-edit-translation-source="true">{source || "（没有原文）"}</p>
                </section>
                <section aria-label="译文">
                  <h4>译文</h4>
                  <Textarea
                    id="book-detail-edit-translation-text"
                    rows={8}
                    value={draft}
                    disabled={Boolean(busy)}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <p className="book-detail-edit-translation-note">公式按框里原来的写法保留，改坏了保存时会检查不过。</p>
                </section>
              </div>
            )}
            <FormStatusLine status={status} />
            {issues.length ? (
              <ul className="book-detail-edit-translation-issues" data-edit-translation-issues="true">
                {issues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" id="book-detail-edit-translation-replay" disabled={loading || Boolean(busy)} pending={busy === "replay"} onClick={() => void replay()}>
              <Sparkles aria-hidden="true" />
              重翻这一段
            </Button>
            <Button variant="ghost" size="sm" disabled={Boolean(busy)} onClick={onClose}>取消</Button>
            <Button
              variant="primary"
              size="sm"
              id="book-detail-edit-translation-save"
              disabled={loading || Boolean(busy) || unchanged || !draft.trim()}
              pending={busy === "save"}
              onClick={() => void save()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogShell>
      </DialogContent>
    </Dialog>
  );
}
