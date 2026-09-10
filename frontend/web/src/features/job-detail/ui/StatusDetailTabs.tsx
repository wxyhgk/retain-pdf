import { Activity, CircleAlert, Gauge, Wrench } from "lucide-react";
import { Tabs as TabsPrimitive } from "radix-ui";
import type { StatusDetailOverviewHook } from "./useStatusDetailOverview.js";
import { STATUS_DETAIL_DIALOG_IDS } from "../domain/status-detail-dom-ids.js";
import { OverviewPanel } from "./panels/OverviewPanel.jsx";
import { FailurePanel } from "./panels/FailurePanel.jsx";
import { EventsPanel } from "./panels/EventsPanel.jsx";
import { TranslationPanel } from "./panels/TranslationPanel.jsx";

type TabDefinition = {
  key: "overview" | "failure" | "events" | "translation";
  label: string;
  icon: typeof Gauge;
  advanced?: boolean;
};

const TABS: TabDefinition[] = [
  { key: "overview", label: "概览", icon: Gauge },
  { key: "failure", label: "问题", icon: CircleAlert },
  { key: "events", label: "活动", icon: Activity },
  { key: "translation", label: "诊断", icon: Wrench, advanced: true },
];

type StatusDetailTabsProps = Pick<
  StatusDetailOverviewHook,
  | "activeTab"
  | "overview"
  | "translation"
  | "rerunPending"
  | "ocrAmbiguityPending"
  | "controller"
>;

export function StatusDetailTabs({
  activeTab,
  overview,
  translation,
  rerunPending,
  ocrAmbiguityPending,
  controller,
}: StatusDetailTabsProps) {
  const ids = STATUS_DETAIL_DIALOG_IDS;

  return (
    <TabsPrimitive.Root
      className="status-detail-tabs-root"
      value={activeTab}
      onValueChange={(tab) => controller.activateDetailTab(tab)}
    >
      <div className="status-detail-navigation">
        <TabsPrimitive.List className="detail-tabs" aria-label="任务详情">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsPrimitive.Trigger
                key={tab.key}
                value={tab.key}
                id={ids.tabs[tab.key]}
                className={`detail-tab${tab.advanced ? " detail-tab-advanced" : ""}${activeTab === tab.key ? " is-active" : ""}`}
                data-tab={tab.key}
              >
                <Icon aria-hidden="true" />
                {tab.label}
              </TabsPrimitive.Trigger>
            );
          })}
        </TabsPrimitive.List>
      </div>

      <div className="detail-tab-panels">
        <OverviewPanel overview={overview} active={activeTab === "overview"} />
        <FailurePanel
          overview={overview}
          rerunPending={rerunPending}
          ocrAmbiguityPending={ocrAmbiguityPending}
          controller={controller}
          active={activeTab === "failure"}
        />
        <EventsPanel overview={overview} active={activeTab === "events"} />
        <TranslationPanel
          translation={translation}
          controller={controller}
          active={activeTab === "translation"}
        />
      </div>
    </TabsPrimitive.Root>
  );
}
