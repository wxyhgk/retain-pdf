import { Check, Circle, Loader2, TriangleAlert, X } from "lucide-react";
import { operationStatusLabel } from "../../domain/operations/operation-controller.js";
import type { AgentOperationEvent, AgentOperationStatus } from "../../domain/operations/types.js";

function eventIcon(status: AgentOperationStatus) {
  if (status === "failed" || status === "ambiguous") return TriangleAlert;
  if (status === "cancelled") return X;
  if (status === "committed" || status === "result_ready") return Check;
  if (status === "queued" || status === "running" || status === "validating") return Loader2;
  return Circle;
}

export function AgentOperationTimeline({ events = [] }: { events?: AgentOperationEvent[] }) {
  if (!events.length) return null;
  return (
    <ol className="home-ask-operation-timeline" aria-label="操作步骤">
      {events.map((event) => {
        const Icon = eventIcon(event.status);
        const spinning = event.status === "queued" || event.status === "running" || event.status === "validating";
        return (
          <li key={`${event.attempt}:${event.seq}`} className="home-ask-operation-step">
            <Icon className={spinning ? "home-ask-operation-step-spin" : ""} size={13} aria-hidden />
            <span>{event.event || operationStatusLabel(event.status)}</span>
            <time>{event.ts ? new Date(event.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</time>
          </li>
        );
      })}
    </ol>
  );
}
