// 一块卡片：设置页的一个面板、书详情里的一块。标题、说明、操作区三个槽。样子在 styles/panel.css。

import type { ComponentProps, ReactNode } from "react";

import { cn } from "../lib/utils.js";

export type PanelProps = Omit<ComponentProps<"section">, "title"> & {
  title?: ReactNode;
  description?: ReactNode;
  /** 标题右边的按钮。 */
  actions?: ReactNode;
  /** 标题用哪一级，按它在页面里的位置给。 */
  titleAs?: "h2" | "h3" | "h4";
};

export function Panel({ title, description, actions, titleAs: Title = "h3", className, children, ...props }: PanelProps) {
  const hasHead = Boolean(title || description || actions);
  return (
    <section className={cn("ui-panel", className)} {...props}>
      {hasHead ? (
        <header className="ui-panel-head">
          <div className="ui-panel-heading">
            {title ? <Title className="ui-panel-title">{title}</Title> : null}
            {description ? <p className="ui-panel-description">{description}</p> : null}
          </div>
          {actions ? <div className="ui-panel-actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
