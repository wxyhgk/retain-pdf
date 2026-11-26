/** 回答里的互动块（```openui-lang 代码块）：OpenUI 的渲染器 + 去掉外网组件的组件库（library.ts）。单独一块，第一次出现时才加载。
 *
 * - 流式时边收边画（isStreaming 时表单不能点）。
 * - 写错了（解析出错、组件不认识）：答完以后显示原文和错误，「让它修」把错误发回给 agent。
 * - 按钮：@ToAssistant 当作用户的下一问发出去（带上表单里填的值）；@OpenUrl 只开 http(s)，新标签页、不带 opener。
 * 方案：docs/ops/planning/reader-ask/20261126-互动块分层提示词.md。
 */
import { Component, useMemo, useState, type ErrorInfo, type ReactElement, type ReactNode } from "react";
import { Renderer, type ActionEvent } from "@openuidev/react-lang";
import { ThemeProvider } from "@openuidev/intelligent-ui-library";
import { Wrench } from "lucide-react";
import { Button } from "@retainpdf/ui";

import { askOpenUILibrary } from "./library.js";

export type OpenUIBlockProps = {
  code: string;
  streaming: boolean;
  mode: "light" | "dark";
  /** 替用户发一句（@ToAssistant、「让它修」）。 */
  send: ((text: string) => void) | null;
};

type Problem = { code?: string; statementId?: string; message: string };

/** 只开 http(s)：模型写的 javascript:、data: 这类地址什么都不做。 */
export function safeUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** @ToAssistant 发出去的那句：按钮上的话，加上表单里填的值。 */
export function actionMessage(event: Pick<ActionEvent, "humanFriendlyMessage" | "formState">): string {
  const text = `${event.humanFriendlyMessage || ""}`.trim();
  const values = Object.entries(event.formState || {})
    .filter(([, value]) => value !== null && value !== undefined && `${value}` !== "")
    .map(([key, value]) => `${key}：${Array.isArray(value) ? value.join("、") : typeof value === "object" ? JSON.stringify(value) : value}`);
  return values.length ? `${text}\n（${values.join("；")}）` : text;
}

/** 「让它修」发回去的话。 */
export function fixMessage(problems: readonly Problem[]): string {
  const lines = problems.slice(0, 8).map((problem) => `- ${problem.statementId ? `${problem.statementId}：` : ""}${problem.message}`);
  return `上面的互动块画不出来，按下面的错误改一下，重新给完整的互动块：\n${lines.join("\n")}`;
}

class Boundary extends Component<{ fallback: (error: Error) => ReactNode; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // 画的时候出错：下面显示原文和「让它修」。
  }

  render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}

function Fallback({ code, problems, send }: { code: string; problems: readonly Problem[]; send: OpenUIBlockProps["send"] }): ReactElement {
  return (
    <div className="ask-openui-fallback">
      <div className="ask-openui-fallback-head">
        <span>互动块画不出来</span>
        {send ? (
          <Button className="ask-openui-fix" title="把错误发回给 agent，让它改" onClick={() => send(fixMessage(problems))}>
            <Wrench size={12} aria-hidden />
            让它修
          </Button>
        ) : null}
      </div>
      {problems.length ? <ul>{problems.slice(0, 8).map((problem, index) => <li key={index}>{problem.statementId ? `${problem.statementId}：` : ""}{problem.message}</li>)}</ul> : null}
      <pre>{code}</pre>
    </div>
  );
}

export default function OpenUIBlock({ code, streaming, mode, send }: OpenUIBlockProps): ReactElement {
  const [problems, setProblems] = useState<Problem[]>([]);
  const onAction = useMemo(() => (event: ActionEvent) => {
    if (event.type === "continue_conversation") {
      const text = actionMessage(event);
      if (text) send?.(text);
      return;
    }
    if (event.type === "open_url") {
      const url = safeUrl(event.params?.url);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    }
  }, [send]);
  const broken = !streaming && problems.length > 0;
  return (
    <div className="ask-openui" data-mode={mode}>
      <Boundary fallback={(error) => <Fallback code={code} problems={[{ message: error.message }]} send={send} />}>
        {broken ? <Fallback code={code} problems={problems} send={send} /> : null}
        <div hidden={broken}>
          <ThemeProvider mode={mode}>
            <Renderer
              response={code}
              library={askOpenUILibrary}
              isStreaming={streaming}
              onAction={onAction}
              onParseResult={(result) => setProblems(((result?.meta as { errors?: Problem[] } | undefined)?.errors || []).map((error) => ({ code: error.code, statementId: error.statementId, message: error.message })))}
              onError={(errors) => !streaming && errors.length && setProblems(errors.map((error) => ({ code: (error as { code?: string }).code, message: (error as { message?: string }).message || String(error) })))}
            />
          </ThemeProvider>
        </div>
      </Boundary>
    </div>
  );
}
