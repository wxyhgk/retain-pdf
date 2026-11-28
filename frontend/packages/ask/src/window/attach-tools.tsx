// 输入框那一行宿主加的「带上……」按钮（2026-11-27 阅读页：带上这一页的截图），和宿主从外面塞进来的附件（框选截图）。
// 拿到的图片走和「+」贴图一样的路（AskImageAttachmentAdapter：类型、4MB 上限），发出去是 ACP 的 image 块。
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@retainpdf/ui";

import type { AskAttachTool } from "../contract.js";

export type AttachToolsUi = { tools: readonly AskAttachTool[]; add: (file: File) => Promise<void> };

export const AttachToolsContext = createContext<AttachToolsUi>({ tools: [], add: async () => {} });

function ToolButton({ tool, add }: { tool: AskAttachTool; add: (file: File) => Promise<void> }): ReactElement {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Button
      className="ask-icon ask-attach-tool"
      aria-label={tool.label}
      title={error || tool.title}
      data-state={error ? "error" : undefined}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        setError("");
        try {
          const file = await tool.run();
          if (file) await add(file);
        } catch (failure) {
          setError(`${tool.label}没成：${failure instanceof Error ? failure.message : String(failure)}`);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 size={14} className="ask-spin" aria-hidden /> : tool.icon}
    </Button>
  );
}

export function AttachTools(): ReactElement | null {
  const { tools, add } = useContext(AttachToolsContext);
  if (!tools.length) return null;
  return <>{tools.map((tool) => <ToolButton key={tool.key} tool={tool} add={add} />)}</>;
}

/** AskWindow 用：宿主的按钮、塞进来的附件（id 变了就加），都加进输入框（runtime 的附件适配器管类型、大小上限）。 */
export function useHostAttachments(
  runtime: { thread: { composer: { addAttachment: (file: File) => Promise<void> } } },
  tools: readonly AskAttachTool[] | undefined,
  request: { id: number; files: readonly File[] } | null | undefined,
) {
  const add = useCallback(async (file: File) => {
    await runtime.thread.composer.addAttachment(file);
  }, [runtime]);
  const attachUi = useMemo<AttachToolsUi>(() => ({ tools: tools || [], add }), [tools, add]);
  const [attachError, setAttachError] = useState("");
  const seen = useRef(0);
  useEffect(() => {
    if (!request || request.id === seen.current) return;
    seen.current = request.id;
    setAttachError("");
    for (const file of request.files) {
      add(file).catch((failure) => setAttachError(`截图没加上：${failure instanceof Error ? failure.message : String(failure)}`));
    }
  }, [request, add]);
  return { attachUi, attachError };
}
