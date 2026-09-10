import { EventsList, eventsStatusText } from "../EventsList.jsx";
import type { StatusDetailOverview } from "../../domain/status-detail-store.js";
import { STATUS_DETAIL_DIALOG_IDS } from "../../domain/status-detail-dom-ids.js";
import { StatusDetailTabPanel } from "./StatusDetailTabPanel.jsx";

type EventsPanelProps = {
  overview: StatusDetailOverview;
  active: boolean;
};

export function EventsPanel({ overview, active }: EventsPanelProps) {
  const ids = STATUS_DETAIL_DIALOG_IDS;

  return (
    <StatusDetailTabPanel value="events" id={ids.panels.events} active={active}>
      <section className="status-detail-section">
        <div className="status-detail-section-head">
          <div>
            <h3>任务活动</h3>
            <p>按时间倒序查看任务发生的变化</p>
          </div>
          <span id={ids.events.status} className="status-panel-note">
            {eventsStatusText(overview.eventsPayload)}
          </span>
        </div>
        <EventsList eventsPayload={overview.eventsPayload} />
      </section>
    </StatusDetailTabPanel>
  );
}
