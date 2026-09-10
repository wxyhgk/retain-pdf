import { Tabs as TabsPrimitive } from "radix-ui";
import type { ReactNode } from "react";

type StatusDetailTabPanelProps = {
  value: string;
  id: string;
  active: boolean;
  children: ReactNode;
};

export function StatusDetailTabPanel({
  value,
  id,
  active,
  children,
}: StatusDetailTabPanelProps) {
  return (
    <TabsPrimitive.Content
      value={value}
      forceMount
      id={id}
      className={`detail-tab-panel${active ? " is-active" : ""}`}
      data-panel={value}
      hidden={!active}
    >
      {children}
    </TabsPrimitive.Content>
  );
}
