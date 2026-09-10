import {
  Activity,
  Clock3,
  Download,
  History,
  RotateCcw,
  SlidersHorizontal,
  Timer,
} from "lucide-react";
import { useArtifactDownloadBusy } from "@/features/artifacts/index.js";
import { useHomeServices } from "@/app/home/home-services-context.js";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { StageHistoryList } from "../StageHistoryList.jsx";
import type { StatusDetailOverview } from "../../domain/status-detail-store.js";
import {
  STATUS_DETAIL_DIALOG_IDS,
  STATUS_DETAIL_MARKDOWN_BUNDLE_ID,
} from "../../domain/status-detail-dom-ids.js";
import { StatusDetailTabPanel } from "./StatusDetailTabPanel.jsx";

type DetailItemProps = {
  id: string;
  label: string;
  value: string;
  icon?: typeof Clock3;
  optional?: boolean;
  compact?: boolean;
};

function DetailItem({ id, label, value, icon: Icon, optional = false, compact = false }: DetailItemProps) {
  const text = `${value ?? "-"}`.trim();
  const rowHidden = optional && (!text || text === "-");
  return (
    <div className={`detail-item${compact ? " is-compact" : ""}${rowHidden ? " hidden" : ""}`}>
      {Icon ? <Icon className="detail-item-icon" aria-hidden="true" /> : null}
      <span className="detail-item-copy">
        <span className="label">{label}</span>
        <span id={id} className="info-value">{value}</span>
      </span>
    </div>
  );
}

function OverviewMarkdownBundleLink() {
  const services = useHomeServices();
  const cardSnapshot = useStoreSnapshot(services.statusCard.store);
  const busyState = useArtifactDownloadBusy(
    services.artifactDownloads.busyStore,
    STATUS_DETAIL_MARKDOWN_BUNDLE_ID,
  );
  const ready = Boolean(cardSnapshot.snapshot?.markdownBundleReady);
  const url = cardSnapshot.snapshot?.markdownBundleUrl || "";
  const enabled = ready && Boolean(url) && !busyState.busy;
  const label = busyState.busy ? (busyState.label || "下载中...") : "下载 Markdown ZIP";

  return (
    <a
      id={STATUS_DETAIL_MARKDOWN_BUNDLE_ID}
      className={`button-link secondary${enabled ? "" : " disabled"}`}
      href={ready && url ? url : "#"}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={enabled ? "false" : "true"}
      data-url={ready && url ? url : ""}
    >
      <Download className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </a>
  );
}

type OverviewPanelProps = {
  overview: StatusDetailOverview;
  active: boolean;
};

export function OverviewPanel({ overview, active }: OverviewPanelProps) {
  const ids = STATUS_DETAIL_DIALOG_IDS;
  const runtime = overview.runtime;

  return (
    <StatusDetailTabPanel value="overview" id={ids.panels.overview} active={active}>
      <section className="status-detail-section">
        <div className="status-detail-section-head">
          <div className="status-detail-section-title">
            <Activity aria-hidden="true" />
            <h3>运行概览</h3>
          </div>
          <OverviewMarkdownBundleLink />
        </div>
        <div className="status-detail-current-stage">
          <Activity aria-hidden="true" />
          <span className="label">当前</span>
          <span id={ids.runtime.currentStage} className="info-value">{runtime.currentStage}</span>
        </div>
        <div className="status-detail-metrics-grid">
          <DetailItem id={ids.runtime.stageElapsed} label="本阶段" value={runtime.stageElapsed} icon={Clock3} compact />
          <DetailItem id={ids.runtime.totalElapsed} label="总耗时" value={runtime.totalElapsed} icon={Timer} compact />
          <DetailItem id={ids.runtime.retryCount} label="重试" value={runtime.retryCount} icon={RotateCcw} compact />
        </div>
        <div className="status-detail-secondary-meta">
          <DetailItem id={ids.runtime.lastTransition} label="最近切换" value={runtime.lastTransition} optional compact />
          <DetailItem id={ids.runtime.terminalReason} label="终态原因" value={runtime.terminalReason} optional compact />
        </div>
        <details className="status-detail-technical-details status-detail-runtime-details">
          <summary><SlidersHorizontal aria-hidden="true" />运行参数</summary>
          <div className="status-detail-runtime-grid">
            <DetailItem id={ids.runtime.inputProtocol} label="输入协议" value={runtime.inputProtocol} compact />
            <DetailItem id={ids.runtime.stageSpecVersion} label="Stage Schema" value={runtime.stageSpecVersion} compact />
            <DetailItem id={ids.runtime.mathMode} label="公式模式" value={runtime.mathMode} compact />
          </div>
        </details>
      </section>
      <section className="status-detail-section detail-stage-panel">
        <div className="status-detail-section-head">
          <div className="status-detail-section-title">
            <History aria-hidden="true" />
            <h3>过程时间线</h3>
          </div>
        </div>
        <StageHistoryList job={overview.job} finishedAtFallback={overview.finishedAtFallback} />
      </section>
    </StatusDetailTabPanel>
  );
}
