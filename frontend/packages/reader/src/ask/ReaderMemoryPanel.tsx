/** 记忆面板（提问窗标题栏的记忆图标打开，2026-11-26）：AI 记下的、你自己加的，分「关于你」和「这本书」两层；
 * 能搜、加、改、删（删了被它替代的旧条恢复）。最上面是「让 AI 使用记忆」：关着时 AI 用不到、也不记新的，已经记下的照样能看、改、删。
 * 术语类的记忆能「加进术语表」（2026-11-27）：在对话里和 AI 商量好的译法存进自己的术语表，以后翻译选这张表就用上。
 * 接口见 docs/api/16-AI/02-主对话和记忆.md。 */
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from "react";
import type { AskMemoryRecord, AskMemoryScope } from "@retainpdf/api/ai";
import { BookPlus, Check, Pencil, Trash2, X } from "lucide-react";
import { Button, Checkbox, Input, SegmentedControl, Select, Sheet } from "@retainpdf/ui";

import type { ReaderAskGlossaryPort, ReaderAskMemoriesPort } from "../contracts/ask.js";
import { splitTermMemory } from "./term-memory.js";

/** 能加进术语表的：AI 记成术语的，或这本书里写成「X 译为 Y」这样的（自己加的记不了类别）。 */
export function isTermMemory(memory: Pick<AskMemoryRecord, "category" | "scope" | "text">): boolean {
  return memory.category === "term" || (memory.scope === "book" && Boolean(splitTermMemory(memory.text).target));
}

/** 新建术语表时默认的名字。 */
export const NEW_GLOSSARY_NAME = "阅读时定的术语";
const NEW = "__new__";

/** 一条术语记忆 → 术语表里的一条：原文、译法先拆好，挑一张表（或新建一张）。 */
function AddToGlossary({ memory, port, onDone }: { memory: AskMemoryRecord; port: ReaderAskGlossaryPort; onDone: (message: string) => void }): ReactElement {
  const initial = splitTermMemory(memory.text);
  const [source, setSource] = useState(initial.source);
  const [target, setTarget] = useState(initial.target);
  const [tables, setTables] = useState<{ id: string; name: string; entryCount: number }[] | null>(null);
  const [into, setInto] = useState(NEW);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    port.list().then(
      (list) => {
        if (cancelled) return;
        setTables(list);
        // 上次新建的那张在就默认加进它。
        setInto(list.find((table) => table.name === NEW_GLOSSARY_NAME)?.id || NEW);
      },
      () => !cancelled && setTables([]),
    );
    return () => {
      cancelled = true;
    };
  }, [port]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!source.trim() || !target.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = await port.addEntry(into === NEW ? { name: NEW_GLOSSARY_NAME } : { id: into }, { source: source.trim(), target: target.trim(), note: "阅读页提问时定的" });
      onDone(`${result.replaced ? "换掉了" : "加进了"}「${result.name}」。以后翻译时选这张表才用得上。`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="reader-memory-glossary" onSubmit={(event) => void submit(event)}>
      <div className="reader-memory-glossary-pair">
        <Input size="sm" value={source} onChange={(event) => setSource(event.target.value)} aria-label="原文" placeholder="原文" autoFocus />
        <Input size="sm" value={target} onChange={(event) => setTarget(event.target.value)} aria-label="译法" placeholder="译法" />
      </div>
      <div className="reader-memory-glossary-pair">
        <Select size="sm" value={into} onChange={(event) => setInto(event.target.value)} aria-label="加进哪张术语表" disabled={tables === null}>
          <option value={NEW}>新建一张「{NEW_GLOSSARY_NAME}」</option>
          {(tables || []).map((table) => <option key={table.id} value={table.id}>{table.name}（{table.entryCount} 条）</option>)}
        </Select>
        <Button type="submit" variant="secondary" size="sm" disabled={busy || !source.trim() || !target.trim() || tables === null}>加进去</Button>
        <Button className="reader-memory-icon" type="button" aria-label="不加了" title="不加了" onClick={() => onDone("")}>
          <X size={13} aria-hidden />
        </Button>
      </div>
      {error ? <p className="reader-memory-note" data-tone="error">{error}</p> : null}
    </form>
  );
}

const CATEGORY: Record<string, string> = {
  preference: "偏好",
  background: "背景",
  style: "回答风格",
  progress: "读到哪",
  term: "术语",
  conclusion: "结论",
  other: "其他",
};

function MemoryRow({ memory, port, glossaries, onChanged }: { memory: AskMemoryRecord; port: ReaderAskMemoriesPort; glossaries?: ReaderAskGlossaryPort | null; onChanged: () => void }): ReactElement {
  const [editing, setEditing] = useState(false);
  const [toGlossary, setToGlossary] = useState(false);
  const [notice, setNotice] = useState("");
  const [text, setText] = useState(memory.text);
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await work();
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="reader-memory-row" data-origin={memory.origin}>
      {editing ? (
        <form
          className="reader-memory-edit"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) void run(() => port.update(memory.memory_id, { text: text.trim() })).then(() => setEditing(false));
          }}
        >
          <Input size="sm" value={text} maxLength={500} onChange={(event) => setText(event.target.value)} aria-label="改这条记忆" autoFocus />
          <Button className="reader-memory-icon" type="submit" aria-label="存" title="存" disabled={busy || !text.trim()}>
            <Check size={13} aria-hidden />
          </Button>
          <Button className="reader-memory-icon" type="button" aria-label="不改了" title="不改了" onClick={() => { setText(memory.text); setEditing(false); }}>
            <X size={13} aria-hidden />
          </Button>
        </form>
      ) : (
        <>
          <p className="reader-memory-text">{memory.text}</p>
          <div className="reader-memory-meta">
            <span>{CATEGORY[memory.category] || memory.category}</span>
            <span>{memory.origin === "agent" ? "AI 记的" : "你加的"}</span>
            <span>{memory.updated_at.slice(0, 10)}</span>
            {memory.source_page ? <span>第 {memory.source_page} 页</span> : null}
            <span className="reader-memory-gap" />
            {glossaries && isTermMemory(memory) ? (
              <Button className="reader-memory-icon" aria-label="加进术语表" title="加进术语表：以后翻译选这张表，就按这个译法译" onClick={() => { setNotice(""); setToGlossary((value) => !value); }}>
                <BookPlus size={12} aria-hidden />
              </Button>
            ) : null}
            <Button className="reader-memory-icon" aria-label="改" title="改" onClick={() => setEditing(true)}>
              <Pencil size={12} aria-hidden />
            </Button>
            <Button className="reader-memory-icon" aria-label="删" title="删（它替代的旧条会恢复）" disabled={busy} onClick={() => void run(() => port.remove(memory.memory_id))}>
              <Trash2 size={12} aria-hidden />
            </Button>
          </div>
          {toGlossary && glossaries ? <AddToGlossary memory={memory} port={glossaries} onDone={(message) => { setToGlossary(false); setNotice(message); }} /> : null}
          {notice ? <p className="reader-memory-note" data-tone="ok">{notice}</p> : null}
        </>
      )}
    </li>
  );
}

export function ReaderMemoryPanel({ port, glossaries, documentId, open, onOpenChange }: { port: ReaderAskMemoriesPort; glossaries?: ReaderAskGlossaryPort | null; documentId: string; open: boolean; onOpenChange: (open: boolean) => void }): ReactElement {
  const [scope, setScope] = useState<AskMemoryScope>("user");
  const [query, setQuery] = useState("");
  const [memories, setMemories] = useState<AskMemoryRecord[] | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const bookScope = scope === "book" && documentId;

  const reload = useCallback(async () => {
    if (scope === "book" && !documentId) return setMemories([]);
    try {
      const list = await port.list({ scope, ...(bookScope ? { document_id: documentId } : {}), ...(query.trim() ? { q: query.trim() } : {}), limit: 200 });
      setMemories(list);
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }, [port, scope, bookScope, documentId, query]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void reload(), query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [open, reload, query]);
  useEffect(() => {
    if (open) port.settings().then((settings) => setEnabled(settings.memory_enabled), () => setEnabled(null));
  }, [open, port]);

  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    try {
      await port.create({ scope, text, ...(bookScope ? { document_id: documentId } : {}) });
      setDraft("");
      await reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="记忆" description="AI 回答时参考这些；是参考不是指令，和你当下说的冲突时以你说的为准。" className="reader-memory-sheet">
      <div className="reader-memory">
        <Checkbox
          label="让 AI 使用记忆"
          checked={enabled ?? true}
          disabled={enabled === null}
          onChange={(event) => {
            const next = event.target.checked;
            setEnabled(next);
            port.setEnabled(next).then((settings) => setEnabled(settings.memory_enabled), () => setEnabled(!next));
          }}
        />
        {enabled === false ? <p className="reader-memory-note">关着：AI 现在用不到这些记忆，也不会记新的。已经记下的照样能看、改、删。</p> : null}
        <SegmentedControl
          label="哪一层"
          size="sm"
          value={scope}
          onChange={(value) => setScope(value as AskMemoryScope)}
          options={[
            { value: "user", label: "关于你" },
            { value: "book", label: "这本书", disabled: !documentId },
          ]}
        />
        <Input size="sm" type="search" placeholder="搜记忆" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜记忆" />
        <form className="reader-memory-add" onSubmit={(event) => { event.preventDefault(); void add(); }}>
          <Input size="sm" placeholder={scope === "user" ? "加一条关于你的，比如「先给结论」" : "加一条这本书的，比如术语怎么译"} value={draft} maxLength={500} onChange={(event) => setDraft(event.target.value)} aria-label="加一条记忆" />
          <Button type="submit" variant="secondary" size="sm" disabled={!draft.trim()}>记下</Button>
        </form>
        {error ? <p className="reader-memory-note" data-tone="error">{error}</p> : null}
        {memories === null ? null : memories.length ? (
          <ul className="reader-memory-list">
            {memories.map((memory) => <MemoryRow key={`${memory.memory_id}:${memory.updated_at}`} memory={memory} port={port} glossaries={glossaries} onChanged={() => void reload()} />)}
          </ul>
        ) : (
          <p className="reader-memory-note">{query ? "没搜到。" : scope === "user" ? "还没有关于你的记忆。AI 在对话里记下的、你自己加的都在这里。" : "这本书还没有记忆。"}</p>
        )}
      </div>
    </Sheet>
  );
}
