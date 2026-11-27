// 提问窗标题栏左边的对话菜单（2026-11-27）：用户心里的东西是「对话」——现在这段、开个新的、以前的——不是「归档」这个动作。
// 以前标题栏上是面包屑 + 「以前的对话」图标 + 「归档」图标（点了先确认），现在收成一个「主对话 ▾」：
// - 按钮上写现在看的是哪段：主对话 / 副对话 · 标题 / 以前的对话 · 日期；
// - 点开：不在主对话时最上面「回主对话」；在主对话时「开个新对话」（这段收进「以前的对话」，记忆不受影响；点了先问一句，11-27 用户要的二次确认）；
//   下面列这本书以前的对话，点了只读地看。
import { useEffect, useState, type ReactElement } from "react";
import { ChevronDown, CornerUpLeft, History, SquarePen } from "lucide-react";
import { Button } from "@retainpdf/ui";
import { AskHeadMenu, AskHeadMenuItem, AskSpinner } from "@retainpdf/ask/window";

import type { AskConversationRecord } from "@retainpdf/api/ai";
import type { useAskConversation } from "./use-ask-conversation.js";

type AskState = ReturnType<typeof useAskConversation>;

/** 以前的主对话叫什么：有自己的标题写标题，日期是最后一次说话那天。 */
export function archivedLabel(record: AskConversationRecord): string {
  const title = record.title && record.title !== "主对话" ? `${record.title} · ` : "";
  return `${title}${record.updated_at.slice(0, 10)}`;
}

/** 按钮上写的：现在看的是哪段对话。 */
export function conversationLabel(conversation: AskConversationRecord | null | undefined): string {
  if (conversation?.kind === "main" && conversation.status === "archived") return `以前的对话 · ${archivedLabel(conversation)}`;
  if (conversation?.kind === "side") return `副对话 · ${conversation.title || "未命名"}`;
  return "主对话";
}

function NewConversation({ onArchive, close }: { onArchive: () => Promise<void>; close: () => void }): ReactElement {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!confirming) {
    return (
      <AskHeadMenuItem
        icon={<SquarePen size={14} aria-hidden />}
        label="开个新对话"
        hint="现在这段收进下面「以前的对话」，还能看；AI 记住的不受影响"
        onClick={() => setConfirming(true)}
      />
    );
  }
  return (
    <div className="reader-ask-confirm" role="group" aria-label="确认开新对话">
      <span>现在这段收起来，开个新的？</span>
      <Button
        className="reader-ask-confirm-yes"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onArchive();
            close();
          } finally {
            setBusy(false);
            setConfirming(false);
          }
        }}
      >
        {busy ? <AskSpinner /> : null}
        开新的
      </Button>
      <Button className="reader-ask-confirm-no" onClick={() => setConfirming(false)}>算了</Button>
    </div>
  );
}

function PastConversations({ ask, open, close }: { ask: AskState; open: boolean; close: () => void }): ReactElement {
  const [list, setList] = useState<AskConversationRecord[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setError("");
    ask.listArchived().then(
      (records) => !cancelled && setList(records),
      (failure) => !cancelled && setError(failure instanceof Error ? failure.message : String(failure)),
    );
    return () => {
      cancelled = true;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = ask.view.conversation?.conversation_id;
  return (
    <section className="reader-ask-history" aria-label="以前的对话">
      <p className="reader-ask-history-head"><History size={12} aria-hidden /> 以前的对话</p>
      {error ? <p className="reader-ask-history-note">{error}</p> : list === null ? <p className="reader-ask-history-note">在读……</p> : list.length ? list.map((record) => (
        <AskHeadMenuItem
          key={record.conversation_id}
          label={archivedLabel(record)}
          trailing={`${record.message_count} 条`}
          current={record.conversation_id === shown}
          onClick={() => {
            close();
            void ask.viewArchived(record);
          }}
        />
      )) : <p className="reader-ask-history-note">这本书还没有以前的对话。</p>}
    </section>
  );
}

/** 标题栏左边的「主对话 ▾」。没有按书存的对话（宿主没给接口）时只是一行字。 */
export function ReaderAskConversationMenu({ ask, canArchive, canList }: { ask: AskState; canArchive: boolean; canList: boolean }): ReactElement {
  const [open, setOpen] = useState(false);
  const conversation = ask.view.conversation;
  const label = conversationLabel(conversation);
  const elsewhere = Boolean(conversation && (conversation.kind === "side" || conversation.status === "archived"));
  const inMain = conversation?.kind === "main" && conversation.status !== "archived";
  if (!ask.persistent || (!canArchive && !canList && !elsewhere)) {
    return <span className="reader-ask-crumb" title="一直延续的主对话：换书、换 agent 都接着聊">{label}</span>;
  }
  return (
    <AskHeadMenu
      className="reader-ask-conversations"
      title={`${label}：开个新对话、看以前的对话`}
      onOpenChange={setOpen}
      label={<><span className="reader-ask-crumb">{label}</span><ChevronDown size={12} aria-hidden /></>}
    >
      {(close) => (
        <>
          {elsewhere ? (
            <AskHeadMenuItem
              icon={<CornerUpLeft size={14} aria-hidden />}
              label="回主对话"
              hint={conversation?.kind === "side" ? "这个副对话留着，之后能回来" : "回到这本书现在的这段"}
              onClick={() => { close(); void ask.backToMain(); }}
            />
          ) : null}
          {inMain && canArchive ? <NewConversation onArchive={ask.archiveMain} close={close} /> : null}
          {canList ? <PastConversations ask={ask} open={open} close={close} /> : null}
        </>
      )}
    </AskHeadMenu>
  );
}
