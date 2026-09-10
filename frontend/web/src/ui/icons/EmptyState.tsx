// 统一空状态：科学仪器图标 + 标题 + 说明

import type { ReactNode } from "react";
import { InstrumentIcon, type InstrumentName } from "./InstrumentIcon.jsx";

export type EmptyStateProps = {
  id?: string;
  instrument: InstrumentName;
  title: string;
  hint?: string;
  children?: ReactNode;
  className?: string;
};

export function EmptyState({
  id,
  instrument,
  title,
  hint,
  children,
  className = "",
}: EmptyStateProps) {
  return (
    <div id={id} className={`events-empty empty-state ${className}`.trim()}>
      <div className="empty-state-icon" aria-hidden="true">
        <InstrumentIcon name={instrument} size={36} />
      </div>
      <p className="empty-state-title">{title}</p>
      {hint ? <p className="empty-state-hint">{hint}</p> : null}
      {children}
    </div>
  );
}
