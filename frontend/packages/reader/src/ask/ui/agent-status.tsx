// 拷自 assistant-ui 官方组件（MIT，https://r.assistant-ui.com，elements-agent-status），改了引用路径、提示文字换成中文；别的照原样，方便以后对着上游更新。

import type { ComponentProps, ReactNode } from "react";
import { CheckIcon, PauseIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { cn } from "./utils.js";
import { mono, paper } from "./surfaces.js";

export type AgentState = "working" | "waiting" | "done" | "failed";

export interface StatusStep {
  state: AgentState;
  label: string;
}

export function AgentStatus({
  state,
  label,
  elapsed,
  trailing,
  className,
  ...props
}: Omit<ComponentProps<"span">, "children" | "state" | "label" | "elapsed"> & {
  state: AgentState;
  label: string;
  elapsed?: string | undefined;
  trailing?: ReactNode | undefined;
}) {
  return (
    <span
      data-slot="agent-status"
      className={cn(
        paper,
        "flex items-center gap-2.5 rounded-full py-1.5 ps-3.5 pe-1.5",
        className,
      )}
      {...props}
    >
      {state === "done" ? (
        <CheckIcon aria-hidden className="size-3 shrink-0 text-emerald-500" />
      ) : state === "failed" ? (
        <XIcon aria-hidden className="text-destructive size-3 shrink-0" />
      ) : (
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full motion-reduce:animate-none",
            state === "working"
              ? "animate-pulse bg-blue-500 dark:bg-blue-400"
              : "border-foreground/35 border",
          )}
        />
      )}
      <span className="sr-only">{{ working: "进行中", waiting: "等着", done: "完成", failed: "失败" }[state]}</span>
      <span
        key={label}
        className="fade-in blur-in-[2px] animate-in max-w-44 truncate text-xs duration-300 motion-reduce:animate-none"
      >
        {label}
      </span>
      {elapsed !== undefined && state !== "done" && state !== "failed" && (
        <span className={cn(mono, "text-muted-foreground tabular-nums")}>
          {elapsed}
        </span>
      )}
      <span
        aria-hidden
        data-slot="agent-status-trailing"
        className="text-muted-foreground flex size-6 items-center justify-center rounded-full"
      >
        {trailing !== undefined ? (
          trailing
        ) : state === "done" || state === "failed" ? (
          <RotateCcwIcon className="size-3" />
        ) : (
          <PauseIcon className="size-3" />
        )}
      </span>
    </span>
  );
}
