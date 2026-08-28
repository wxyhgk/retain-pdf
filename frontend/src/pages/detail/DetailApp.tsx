// Root điều phối React cho trang chi tiết tác vụ (bản viết lại của launcher cũ
// src/js/job-detail/index.js + view.js + modal-bindings.js + downloads.js + events.js).
//
// Chiến lược state (giữ đúng ngữ nghĩa hiện tại, không thêm store):
// - Logic thuần của thế giới cũ (overview-renderer / markdown-flow / summary / action-links /
//   resume, v.v.) ghi text qua callback setText/setActionLink/setEventsStatus. Ở đây các callback
//   được hiện thực bằng React state (hai map texts/links), JSX render theo id.
// - Danh sách artifact, context debug lỗi, lưới ảnh Markdown vẫn do module cũ giữ lại
//   (artifacts.js / failure.js, qua overview-renderer / markdown-flow) ghi innerHTML vào leaf
//   container do React render sau khi mount (xem comment ở từng component).
// - Mở/đóng modal, tải event stream và download được bảo vệ chuyển sang React quản lý
//   (trách nhiệm cũ của view.js / modal-bindings.js / launcher events.js / downloads.js).

import { useCallback, useEffect, useRef, useState } from "react";
import { DetailHeader } from "./components/DetailHeader.jsx";
import { ErrorNoticeCard, JobSummaryCard, MetaRow } from "./components/JobSummaryCard.jsx";
import { ErrorDiagnostics } from "./components/ErrorDiagnostics.jsx";
import { ArtifactsSection, MarkdownCard } from "./components/ArtifactsSection.jsx";
import {
  EventsModal,
  EventsTriggerCard,
  StageHistoryModal,
  StageHistoryTriggerCard,
} from "./components/EventsTimeline.jsx";
import { DownloadToastHost } from "../../shared/react/DownloadToastHost.jsx";
import {
  normalizeJobPayload,
  getJobIdFromQuery,
  defaultJobDetailConfigPort,
  defaultJobDetailDataPort,
  defaultJobDetailResumePort,
  bindRerunButton,
  renderJobDetailOverview,
  loadAndRenderMarkdownFlow,
  createJobDetailPageState,
  revokeJobDetailMarkdownImageUrls,
  fileNameFromDisposition,
  prepareDownloadTarget,
  saveResponseDownload,
  completeDownloadToast,
  failDownloadToast,
  showDownloadPreparing,
  updateDownloadProgress,
} from "./external.js";

const JOB_EVENTS_PAGE_SIZE = 200;

function eventsStatusText(payload) {
  const count = Array.isArray(payload?.items) ? payload.items.length : 0;
  return count > 0 ? `Tất cả sự kiện · ${count} mục` : "Tất cả sự kiện";
}

export function DetailApp({
  configPort = defaultJobDetailConfigPort,
  dataPort = defaultJobDetailDataPort,
  getJobId = getJobIdFromQuery,
  resumePort = defaultJobDetailResumePort,
} = {}) {
  const pageStateRef = useRef(null);
  if (!pageStateRef.current) {
    pageStateRef.current = createJobDetailPageState();
  }
  const [texts, setTexts] = useState({});
  const [links, setLinks] = useState({});
  const [job, setJob] = useState(null);
  const [stageHistoryOpen, setStageHistoryOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [eventsPayload, setEventsPayload] = useState(null);
  const [eventsStatus, setEventsStatus] = useState("Chưa tải");
  const [openEventsText, setOpenEventsText] = useState("Tải khi cần");

  // Ngữ nghĩa setDetailText của view.js cũ: value ?? "-".
  const setText = useCallback((id, value) => {
    setTexts((prev) => ({ ...prev, [id]: value ?? "-" }));
  }, []);

  // Ngữ nghĩa setDetailActionLink của view.js cũ: bộ ba href/disabled/aria-disabled.
  const setActionLink = useCallback((id, url, enabled) => {
    setLinks((prev) => ({ ...prev, [id]: { url, enabled: Boolean(enabled) } }));
  }, []);

  const t = useCallback(
    (id, fallback = "-") => (Object.hasOwn(texts, id) ? texts[id] : fallback),
    [texts],
  );

  // Điều phối tải trang: dựng lại hook từ initializePage của index.js cũ.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    const state = pageStateRef.current;
    window.addEventListener("beforeunload", () => {
      revokeJobDetailMarkdownImageUrls(state);
    }, { once: true });
    bindRerunButton({
      detailPageState: state,
      getJobId,
      resumePort,
      setText,
    });
    (async () => {
      const jobId = getJobId();
      if (!jobId) {
        setText("detail-head-note", "Thiếu job_id, vui lòng mở bằng detail.html?job_id=...");
        return;
      }
      setText("detail-job-id", jobId);
      setText("detail-head-note", configPort.detailShareNote());

      const {
        diagnosticsPayload,
        manifestPayload,
        payloadRaw,
        resumePlan,
      } = await dataPort.loadOverview(jobId);
      const nextJob = normalizeJobPayload(payloadRaw);
      renderJobDetailOverview({
        diagnosticsPayload,
        job: nextJob,
        manifestPayload,
        resumePlan,
        setActionLink,
        setEventsStatus,
        setText,
        state,
      });
      setJob(nextJob);

      await loadAndRenderMarkdownFlow({
        fetchProtected: dataPort.fetchProtected,
        job: nextJob,
        jobId,
        loadMarkdownPayload: dataPort.loadMarkdownPayload,
        markdownImageUrls: state.markdownImageUrls,
        setActionLink,
        setText,
        state,
      });
    })().catch((error) => {
      // Ngữ nghĩa onError của createPageRuntime cũ: ghi lỗi khởi tạo vào ghi chú header.
      setText("detail-head-note", error.message || String(error));
    });
    // Chỉ chạy một lần khi mount; các port không đổi trong vòng đời trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // modal-bindings.js cũ: Escape đóng tất cả modal.
  //
  // Quyết định ở batch kết thúc phase C (shadcn migration): sau khi đổi hai modal sang Radix Dialog,
  // vẫn giữ listener thủ công "đóng vô điều kiện cả hai", không đổi thành "chỉ đóng modal đang mở".
  // Lý do: mỗi modal là Radix Root/Content độc lập fixed inset-0; khi mở, DismissableLayer chiếm focus
  // theo kiểu focus trap. Khi StageHistoryModal mở, thẻ trigger của nó (EventsTriggerCard) bị overlay che
  // hoàn toàn, không focus/click được, và ngược lại. Vì vậy trong cấu trúc trang này hai modal luôn loại trừ nhau
  // (cùng lúc tối đa một open=true). "Đóng cả hai" và "chỉ đóng cái đang mở" cho kết quả giống nhau ở mọi trạng thái
  // có thể đạt tới: gọi setStageHistoryOpen/setEventsOpen lên phía đã false là no-op idempotent, không có nguy cơ
  // double-fire làm sụp ngữ nghĩa (khác TranslationWorkflowDialog, nơi đóng hai bước có thể thật sự hỏng nếu gọi dư).
  // Giữ nguyên là lựa chọn ít rủi ro nhất trong batch này, không thêm nhánh mới cho behavior hiện không quan sát được.
  //
  // Listener này và xử lý Escape riêng của Radix (DismissableLayer, capture phase) đều chạy trong cùng một phím:
  // Radix gọi onOpenChange(false) trước cho "modal đang mở" (setXxxOpen(false) tương ứng có hiệu lực), sau đó
  // listener bubble ở đây gọi setXxxOpen(false) cho cả hai. Phía đã false là no-op, không render thêm hay side effect;
  // hai cơ chế không xung đột.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") {
        return;
      }
      setStageHistoryOpen(false);
      setEventsOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Đã xóa body scroll lock thủ công của setDetailModalOpen trong view.js cũ: Radix Dialog ở modal mode
  // (mặc định) tự có scroll lock tương đương cho body (react-remove-scroll, gắn trên DialogPrimitive.Content,
  // tự lock/unlock theo vòng đời mount/unmount thật của Content; xem DetailModal trong EventsTimeline.jsx).
  // Giữ lệnh gán document.body.style.overflow thủ công sẽ tạo hai writer độc lập tranh cùng một CSS property:
  // react-remove-scroll ghi nhớ "overflow gốc trước khi lock" và khôi phục chính xác khi unlock; nếu ở đây lại
  // gán/xóa trực tiếp, edge case lệch thời điểm unlock có thể reset thuộc tính thành giá trị khác với Radix đã nhớ
  // (biểu hiện: đóng một modal xong body vẫn không cuộn được, hoặc ngược lại). Hai modal loại trừ nhau (như trên),
  // độ chi tiết lock theo nhu cầu của Radix (Content có mount hay không) đã bao phủ hoàn toàn ngữ nghĩa cũ, không cần tự viết nữa.

  // events.js cũ: fetchAllJobEvents + ensureEventsLoaded (kéo toàn bộ theo phân trang + cache trong trang).
  const ensureEventsLoaded = useCallback(async () => {
    const state = pageStateRef.current;
    if (state.eventsPayload) {
      return state.eventsPayload;
    }
    if (!state.job?.job_id) {
      throw new Error("Thiếu job_id, không thể tải event stream.");
    }
    if (!state.eventsLoadingPromise) {
      setEventsStatus("Đang tải tất cả sự kiện...");
      state.eventsLoadingPromise = (async () => {
        const items = [];
        let offset = 0;
        while (true) {
          const payload = await dataPort.fetchJobEvents(
            state.job.job_id,
            dataPort.apiPrefix,
            JOB_EVENTS_PAGE_SIZE,
            offset,
          );
          const page = (payload || {}) as { items?: unknown[] };
          const batch = Array.isArray(page.items) ? page.items : [];
          items.push(...batch);
          if (batch.length < JOB_EVENTS_PAGE_SIZE) {
            return {
              ...(typeof payload === "object" && payload ? payload : {}),
              items,
              offset: 0,
              limit: items.length,
            };
          }
          offset += batch.length;
        }
      })()
        .then((payload) => {
          state.eventsPayload = payload;
          return payload;
        })
        .catch((error) => {
          setEventsStatus(error.message || "Không đọc được event stream.");
          throw error;
        })
        .finally(() => {
          state.eventsLoadingPromise = null;
        });
    }
    return state.eventsLoadingPromise;
  }, [dataPort]);

  const handleOpenEvents = useCallback(async () => {
    setEventsOpen(true);
    try {
      const payload = await ensureEventsLoaded();
      setEventsPayload(payload);
      setEventsStatus(eventsStatusText(payload));
      setOpenEventsText("Xem");
    } catch (_error) {
      // Text lỗi đã được ghi trong ensureEventsLoaded.
    }
  }, [ensureEventsLoaded]);

  // Bản viết lại bằng React event cho bindProtectedDownloadLink của downloads.js cũ.
  const handleProtectedDownload = useCallback((fallbackNameFactory) => async (event) => {
    const link = event.currentTarget;
    const enabled = link?.getAttribute("aria-disabled") !== "true";
    const url = `${link?.href || ""}`.trim();
    if (!enabled || !url || url.endsWith("#")) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const state = pageStateRef.current;
    const fallbackName = fallbackNameFactory(state.job?.job_id || "job");
    const downloadTarget = await prepareDownloadTarget(fallbackName);
    if (downloadTarget.kind === "aborted") {
      return;
    }
    try {
      showDownloadPreparing(fallbackName);
      const resp = await dataPort.fetchProtected(url);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Tải xuống thất bại: ${resp.status} ${text || "unknown error"}`);
      }
      const disposition = resp.headers.get("content-disposition") || "";
      const filename = fileNameFromDisposition(disposition, fallbackName);
      await saveResponseDownload(resp, {
        target: downloadTarget,
        filename,
        onProgress: ({ receivedBytes, totalBytes, percent, done }) => {
          if (done) {
            setText("detail-head-note", `Đã bắt đầu lưu ${filename}`);
            completeDownloadToast(filename);
            return;
          }
          updateDownloadProgress({ filename, receivedBytes, totalBytes, percent });
        },
      });
    } catch (error) {
      setText("detail-head-note", error.message || "Tải xuống thất bại");
      failDownloadToast(error.message || "Tải xuống thất bại");
    }
  }, [dataPort, setText]);

  return (
    <>
      <main className="detail-page">
        <DetailHeader t={t} links={links} onProtectedDownload={handleProtectedDownload} />
        <section className="detail-grid">
          <JobSummaryCard title="Thông tin chạy">
            <MetaRow label="Giai đoạn hiện tại" id="detail-runtime-current-stage" value={t("detail-runtime-current-stage")} />
            <MetaRow label="Thời gian giai đoạn hiện tại" id="detail-runtime-stage-elapsed" value={t("detail-runtime-stage-elapsed")} />
            <MetaRow label="Tổng thời gian" id="detail-runtime-total-elapsed" value={t("detail-runtime-total-elapsed")} />
            <MetaRow label="Số lần retry" id="detail-runtime-retry-count" value={t("detail-runtime-retry-count")} />
            <MetaRow label="Lần chuyển gần nhất" id="detail-runtime-last-transition" value={t("detail-runtime-last-transition")} />
            <MetaRow label="Lý do terminal" id="detail-runtime-terminal-reason" value={t("detail-runtime-terminal-reason")} />
            <MetaRow label="Giao thức đầu vào" id="detail-runtime-input-protocol" value={t("detail-runtime-input-protocol")} />
            <MetaRow label="Stage Schema" id="detail-runtime-stage-spec-version" value={t("detail-runtime-stage-spec-version")} />
            <MetaRow label="Chế độ công thức" id="detail-runtime-math-mode" value={t("detail-runtime-math-mode")} />
          </JobSummaryCard>
          <JobSummaryCard title="Chẩn đoán lỗi">
            <MetaRow label="Tóm tắt" id="detail-failure-summary" value={t("detail-failure-summary")} />
            <MetaRow label="Phân loại" id="detail-failure-category" value={t("detail-failure-category")} />
            <MetaRow label="Giai đoạn" id="detail-failure-stage" value={t("detail-failure-stage")} />
            <MetaRow label="Nguyên nhân gốc" id="detail-failure-root-cause" value={t("detail-failure-root-cause")} />
            <MetaRow label="Đề xuất" id="detail-failure-suggestion" value={t("detail-failure-suggestion")} />
            <MetaRow label="Log gần nhất" id="detail-failure-last-log-line" value={t("detail-failure-last-log-line")} />
            <MetaRow label="Có thể retry" id="detail-failure-retryable" value={t("detail-failure-retryable")} />
          </JobSummaryCard>
          <ErrorNoticeCard t={t} />
          <ErrorDiagnostics />
          <ArtifactsSection />
          <MarkdownCard t={t} />
          <StageHistoryTriggerCard onOpen={() => setStageHistoryOpen(true)} />
          <EventsTriggerCard buttonText={openEventsText} onOpen={handleOpenEvents} />
        </section>
      </main>
      <StageHistoryModal open={stageHistoryOpen} job={job} onClose={() => setStageHistoryOpen(false)} />
      <EventsModal
        open={eventsOpen}
        eventsPayload={eventsPayload}
        status={eventsStatus}
        onClose={() => setEventsOpen(false)}
      />
      <DownloadToastHost />
    </>
  );
}
