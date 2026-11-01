// 接口设置里的字段名，前面带一个小图标（地址、模型、key、并发……），扫一眼就知道是哪一格。
import type { ReactNode } from "react";

export function FieldLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="developer-label credential-field-label">
      <span className="credential-field-label-icon" aria-hidden="true">{icon}</span>
      {children}
    </span>
  );
}
