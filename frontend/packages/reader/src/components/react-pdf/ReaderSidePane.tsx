/** 第二栏的外壳：占 dock 的位置（左右可拖的那根分隔照旧），里面是宿主给的内容。
 *
 * 宿主内容出错不能把整个阅读页带崩：包一层错误边界，只在这一栏里说一句。 */
import { Component, type ErrorInfo, type ReactNode } from "react";

import type { ReaderSidePaneApi, ReaderSidePanePort } from "../../contracts/side-pane.js";
import { ReaderPanelShell } from "./ReaderPanelShell.js";

type BoundaryProps = { resetKey: string; children: ReactNode };
type BoundaryState = { error: Error | null; resetKey: string };

class SidePaneBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): Partial<BoundaryState> | null {
    // 换了书就再试一次。
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[reader] 第二栏出错", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return <p className="reader-side-pane-error" role="alert">这一栏出错了：{this.state.error.message || "未知错误"}</p>;
    }
    return this.props.children;
  }
}

export type ReaderSidePaneProps = {
  port: ReaderSidePanePort;
  api: ReaderSidePaneApi;
};

export function ReaderSidePane({ port, api }: ReaderSidePaneProps) {
  return (
    <ReaderPanelShell
      id="reader-side-pane"
      open
      ariaLabel={port.label}
      className="reader-side-pane"
      onClose={api.close}
    >
      <SidePaneBoundary resetKey={`${api.documentId}\u0000${api.jobId}`}>
        {port.render(api)}
      </SidePaneBoundary>
    </ReaderPanelShell>
  );
}
