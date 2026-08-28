// Hàng thao tác kết quả (bản thiết kế §2 features/status/, phản chiếu
// syncPrimaryActions/setActionLinkState của job-status-card-rendering.js — giữ
// nguyên hợp đồng DOM theo từng id/class).
//
// Liên kết "Đọc đối chiếu" (bản thiết kế dialogs §4, phạm vi mục 6 ①): kiểm
// tra runtime xác nhận 3b chỉ render <a href="reader.html?..."> trần, không
// chặn click — chuyển cả trang làm gián đoạn trải nghiệm dialog SPA. Thêm
// onClick (preventDefault + onReaderClick) qua lối vào openReaderRequested
// thống nhất của ReaderDialog; giữ href làm dự phòng khi JS lỗi.
//
// Ba liên kết tải markdownBundle/sourcePdf/pdf (bản thiết kế dialogs §7): các
// id này được ủy quyền click ở cấp document của miền artifact-downloads (hàm
// handleProtectedArtifactClick trong controller.js, bindEvents() đã gắn ở
// composition.js). Handler chạy trước điều hướng mặc định của <a> và gọi
// event.preventDefault() — nút không cần onClick thêm. Chỉ subscribe lát cắt
// actionId tương ứng của artifact-download-busy-store.js để điều khiển nhãn
// "Đang tải..." và trạng thái vô hiệu (phương án hai, tránh component cha
// render lại do polling ghi đè nhãn tiến trình bằng label gốc).

import { useHomeServices } from "../../home-services-context.js";
import { useArtifactDownloadBusy } from "../../state/use-artifact-download-busy.js";
import { STATUS_CARD_ACTION_IDS } from "./status-card-dom-ids.js";

type ActionLinkProps = {
  id: string;
  label: string;
  ready: boolean;
  url: string;
  onClick?: () => void;
};

function ActionLink({ id, label, ready, url, onClick }: ActionLinkProps) {
  const services = useHomeServices();
  const busyState = useArtifactDownloadBusy(services.artifactDownloads.busyStore, id);
  const enabled = Boolean(ready && url) && !busyState.busy;
  const isReaderLink = id === STATUS_CARD_ACTION_IDS.reader;
  const displayLabel = busyState.busy ? (busyState.label || "Đang tải...") : label;
  return (
    <a
      id={id}
      className={`status-action-btn task-toolbar-btn-result${ready ? "" : " hidden"}${enabled ? "" : " disabled"}`}
      href={ready && url ? url : "#"}
      target={isReaderLink ? undefined : "_blank"}
      rel={isReaderLink ? undefined : "noopener noreferrer"}
      aria-label={label}
      title={label}
      aria-disabled={enabled ? "false" : "true"}
      data-url={ready && url ? url : ""}
      onClick={isReaderLink && onClick
        ? (event) => {
          if (!enabled) {
            return;
          }
          event.preventDefault();
          onClick();
        }
        : undefined}
    >
      <span>{displayLabel}</span>
    </a>
  );
}

type ResultActionsProps = {
  markdownBundleReady?: boolean;
  markdownBundleUrl?: string;
  sourcePdfReady?: boolean;
  sourcePdfUrl?: string;
  readerReady?: boolean;
  readerUrl?: string;
  pdfReady?: boolean;
  pdfUrl?: string;
  onReaderClick?: () => void;
};

export function ResultActions({
  markdownBundleReady = false,
  markdownBundleUrl = "",
  sourcePdfReady = false,
  sourcePdfUrl = "",
  readerReady = false,
  readerUrl = "",
  pdfReady = false,
  pdfUrl = "",
  onReaderClick,
}: ResultActionsProps) {
  const hasActions = markdownBundleReady || pdfReady || readerReady || sourcePdfReady;

  return (
    <div className={`status-result-actions${hasActions ? "" : " hidden"}`}>
       <ActionLink id={STATUS_CARD_ACTION_IDS.markdownBundle} label="Tải Markdown" ready={markdownBundleReady} url={markdownBundleUrl} />
       <ActionLink id={STATUS_CARD_ACTION_IDS.sourcePdf} label="Tải PDF gốc" ready={sourcePdfReady} url={sourcePdfUrl} />
       <ActionLink id={STATUS_CARD_ACTION_IDS.reader} label="Đọc đối chiếu" ready={readerReady} url={readerUrl} onClick={onReaderClick} />
       <ActionLink id={STATUS_CARD_ACTION_IDS.pdf} label="Tải PDF" ready={pdfReady} url={pdfUrl} />
    </div>
  );
}
