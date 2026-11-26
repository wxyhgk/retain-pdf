/** 回答里 ```openui-lang 代码块的位置（markdown-text 按语言换掉代码块）：懒加载 OpenUIBlock，判断深浅色、是不是还在流式。 */
import { Suspense, lazy, useContext, useLayoutEffect, useRef, useState, type ReactElement } from "react";
import { useAuiState } from "@assistant-ui/react";
import type { SyntaxHighlighterProps } from "@assistant-ui/react-markdown";
import { Shapes } from "lucide-react";

import { AskSendContext } from "./ask-send.js";

const OpenUIBlock = lazy(() => import("../openui/OpenUIBlock.js"));

export const OPENUI_FENCES = ["openui-lang", "openui"] as const;

/** 底色的亮度（0–1）：提问窗不认识宿主的皮肤列表，按自己的底色判断深浅。 */
export function luminance(color: string): number | null {
  const match = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(color);
  if (!match) return null;
  const [r, g, b] = match.slice(1, 4).map((value) => Number(value) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function useColorMode(ref: { current: HTMLElement | null }): "light" | "dark" {
  const [mode, setMode] = useState<"light" | "dark">("light");
  useLayoutEffect(() => {
    const read = () => {
      const panel = ref.current?.closest(".ask-panel") || ref.current;
      if (!panel || typeof getComputedStyle !== "function") return;
      const value = luminance(getComputedStyle(panel).backgroundColor);
      if (value !== null) setMode(value < 0.45 ? "dark" : "light");
    };
    read();
    // 换皮肤是换 <html> 上的属性：跟着重新判断。
    const observer = typeof MutationObserver === "function" ? new MutationObserver(read) : null;
    observer?.observe(document.documentElement, { attributes: true });
    return () => observer?.disconnect();
  }, [ref]);
  return mode;
}

function Loading(): ReactElement {
  return (
    <div className="ask-openui-loading" role="status">
      <Shapes size={13} aria-hidden />
      在画互动块…
    </div>
  );
}

export function OpenUIFence({ code }: SyntaxHighlighterProps): ReactElement {
  const ref = useRef<HTMLDivElement | null>(null);
  const mode = useColorMode(ref);
  const streaming = useAuiState((state) => state.message.status?.type === "running");
  const send = useContext(AskSendContext);
  return (
    <div ref={ref} className="ask-openui-slot">
      <Suspense fallback={<Loading />}>
        <OpenUIBlock code={code} streaming={streaming} mode={mode} send={send} />
      </Suspense>
    </div>
  );
}

/** 互动块不要代码块的标题栏（语言名、复制）。 */
export function NoHeader(): null {
  return null;
}

/** 给 markdown-text 的 componentsByLanguage。 */
export const OPENUI_COMPONENTS_BY_LANGUAGE = Object.fromEntries(
  OPENUI_FENCES.map((language) => [language, { CodeHeader: NoHeader, SyntaxHighlighter: OpenUIFence }]),
);
