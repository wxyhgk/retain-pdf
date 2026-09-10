// 任务详情页 React 编排根(旧 src/js/job-detail/index.js + view.js +
// modal-bindings.js + downloads.js + events.js 启动器的重写)。
//
// 状态策略(按现状语义,不引入 store):
// - 旧世界纯逻辑(overview-renderer / markdown-flow / summary / action-links /
//   resume 等)通过 setText/setActionLink/setEventsStatus 回调写文案——这里把
//   回调实现为 React state(texts/links 两张映射表),JSX 按 id 取值渲染;
// - 产物清单、失败调试上下文、Markdown 图片网格仍由保留的旧模块
//   (artifacts.js / failure.js,经 overview-renderer / markdown-flow)在挂载后
//   命令式 innerHTML 写入 React 渲染出的叶子容器(见各组件注释);
// - 模态框开合、事件流加载、受保护下载改为 React 管理(原 view.js /
//   modal-bindings.js / events.js 启动器 / downloads.js 的职责)。

import { useCallback, useEffect, useRef, useState } from "react";
// 五个展示组件已归入 job-detail 功能（C1）；app 层跨功能引用经其 index 出口。
import {
  DetailHeader,
  ErrorNoticeCard,
  JobSummaryCard,
  MetaRow,
  ErrorDiagnostics,
  ArtifactsSection,
  MarkdownCard,
  EventsModal,
  EventsTriggerCard,
  StageHistoryModal,
  StageHistoryTriggerCard,
} from "@/features/job-detail/index.js";
import { DownloadToastHost } from "@/ui/download-toast/DownloadToastHost.jsx";
import { normalizeJobPayload } from "@retainpdf/domain/job";
import {
  getJobIdFromQuery,
  defaultJobDetailConfigPort,
  defaultJobDetailDataPort,
  defaultJobDetailResumePort,
  bindRerunButton,
  renderJobDetailOverview,
  loadAndRenderMarkdownFlow,
  createJobDetailPageState,
  revokeJobDetailMarkdownImageUrls,
} from "@/features/job-detail/index.js";
import {
  fileNameFromDisposition,
  prepareDownloadTarget,
  saveResponseDownload,
} from "@/platform/utils/downloads.js";
import {
  completeDownloadToast,
  failDownloadToast,
  showDownloadPreparing,
  updateDownloadProgress,
} from "@/platform/utils/download-feedback.js";

const JOB_EVENTS_PAGE_SIZE = 200;

function eventsStatusText(payload) {
  const count = Array.isArray(payload?.items) ? payload.items.length : 0;
  return count > 0 ? `全部事件 · ${count} 条` : "全部事件";
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
  const [eventsStatus, setEventsStatus] = useState("尚未加载");
  const [openEventsText, setOpenEventsText] = useState("按需加载");

  // 旧 view.js setDetailText 语义:value ?? "-"
  const setText = useCallback((id, value) => {
    setTexts((prev) => ({ ...prev, [id]: value ?? "-" }));
  }, []);

  // 旧 view.js setDetailActionLink 语义:href/disabled/aria-disabled 三件套
  const setActionLink = useCallback((id, url, enabled) => {
    setLinks((prev) => ({ ...prev, [id]: { url, enabled: Boolean(enabled) } }));
  }, []);

  const t = useCallback(
    (id, fallback = "-") => (Object.hasOwn(texts, id) ? texts[id] : fallback),
    [texts],
  );

  // 页面加载编排:旧 index.js initializePage 的 hooks 重建
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
        setText("detail-head-note", "缺少 job_id，请通过 detail.html?job_id=... 打开。");
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
      // 旧 createPageRuntime onError 语义:初始化异常写入头部提示
      setText("detail-head-note", error.message || String(error));
    });
    // 只在挂载时执行一次;端口在页面生命周期内不变
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 旧 modal-bindings.js:Escape 关闭全部模态框。
  //
  // 阶段 C 收官批(shadcn 改造)决策:两个模态换成 Radix Dialog 后保留这条
  // "无条件关两个"的手写监听,不改成"只关当前打开的那个"。理由:两个模态各自
  // 是 fixed inset-0 的独立 Radix Root/Content,打开时会用 DismissableLayer
  // 抢占式接管焦点(focus trap)——StageHistoryModal 打开时其触发卡片
  // (EventsTriggerCard)完全被遮罩盖住且不可聚焦/不可点击,反之亦然,所以两个
  // 模态在本页面结构下永远互斥(同一时刻至多一个 open=true)。这意味着
  // "关两个"和"只关当前这个"在所有可达状态下结果恒等——setStageHistoryOpen/
  // setEventsOpen 对已经是 false 的一侧调用是幂等 no-op,不会有 double-fire
  // 语义坍缩的风险(不同于 TranslationWorkflowDialog 的两段式关闭那种真正会
  // 被"多调一次"破坏语义的场景)。保留原样是这批改造里风险最低的选择,不
  // 引入新分支去做一个在当前 UI 下不可观测的行为收紧。
  //
  // 这条监听和 Radix 自己的 Escape 处理(DismissableLayer,capture 阶段)会
  // 在同一次按键里都跑一遍:Radix 先对"当前打开的那个"调用 onOpenChange(false)
  // (对应的 setXxxOpen(false) 生效),随后这里的 bubble 阶段监听器对两个都调
  // 一次 setXxxOpen(false)——已经是 false 的一侧是 no-op,不产生额外渲染或
  // 副作用,两套机制不冲突。
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

  // 旧 view.js setDetailModalOpen 的 body 滚动锁定手写实现已删除:Radix Dialog
  // modal 模式(默认)自带等价的 body 滚动锁定(react-remove-scroll,挂在
  // DialogPrimitive.Content 上,随 Content 真实 mount/unmount 生命周期自动
  // 加锁/解锁,见 EventsTimeline.jsx 的 DetailModal)。留着这条手写
  // document.body.style.overflow 赋值会和 Radix 自己的锁定机制形成两个独立
  // writer 同时争抢同一个 CSS 属性——react-remove-scroll 内部会记住"加锁前
  // 的原始 overflow 值"并在解锁时精确恢复,若这里再直接赋值/清空,可能会在
  // 解锁时机不一致的边界情况下把这个属性重置成与 Radix 记忆不一致的值(表现
  // 为关掉一个模态后 body 仍然滚动不了,或反过来)。两个模态互斥（同上），
  // Radix 的锁定粒度按需（对应 Content 是否挂载）已经完全覆盖旧实现想要的
  // 语义,不需要再手写。

  // 旧 events.js fetchAllJobEvents + ensureEventsLoaded(分页拉全量 + 页内缓存)
  const ensureEventsLoaded = useCallback(async () => {
    const state = pageStateRef.current;
    if (state.eventsPayload) {
      return state.eventsPayload;
    }
    if (!state.job?.job_id) {
      throw new Error("缺少 job_id，无法加载事件流。");
    }
    if (!state.eventsLoadingPromise) {
      setEventsStatus("正在加载全部事件...");
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
          setEventsStatus(error.message || "读取事件流失败。");
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
      setOpenEventsText("查看");
    } catch (_error) {
      // 失败文案已在 ensureEventsLoaded 中写入
    }
  }, [ensureEventsLoaded]);

  // 旧 downloads.js bindProtectedDownloadLink 的 React 事件重写
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
        throw new Error(`下载失败: ${resp.status} ${text || "unknown error"}`);
      }
      const disposition = resp.headers.get("content-disposition") || "";
      const filename = fileNameFromDisposition(disposition, fallbackName);
      await saveResponseDownload(resp, {
        target: downloadTarget,
        filename,
        onProgress: ({ receivedBytes, totalBytes, percent, done }) => {
          if (done) {
            setText("detail-head-note", `已开始保存 ${filename}`);
            completeDownloadToast(filename);
            return;
          }
          updateDownloadProgress({ filename, receivedBytes, totalBytes, percent });
        },
      });
    } catch (error) {
      setText("detail-head-note", error.message || "下载失败");
      failDownloadToast(error.message || "下载失败");
    }
  }, [dataPort, setText]);

  return (
    <>
      <main className="detail-page">
        <DetailHeader t={t} links={links} onProtectedDownload={handleProtectedDownload} />
        <section className="detail-grid">
          <JobSummaryCard title="运行信息">
            <MetaRow label="当前阶段" id="detail-runtime-current-stage" value={t("detail-runtime-current-stage")} />
            <MetaRow label="当前阶段耗时" id="detail-runtime-stage-elapsed" value={t("detail-runtime-stage-elapsed")} />
            <MetaRow label="累计耗时" id="detail-runtime-total-elapsed" value={t("detail-runtime-total-elapsed")} />
            <MetaRow label="重试次数" id="detail-runtime-retry-count" value={t("detail-runtime-retry-count")} />
            <MetaRow label="最近切换" id="detail-runtime-last-transition" value={t("detail-runtime-last-transition")} />
            <MetaRow label="终态原因" id="detail-runtime-terminal-reason" value={t("detail-runtime-terminal-reason")} />
            <MetaRow label="输入协议" id="detail-runtime-input-protocol" value={t("detail-runtime-input-protocol")} />
            <MetaRow label="Stage Schema" id="detail-runtime-stage-spec-version" value={t("detail-runtime-stage-spec-version")} />
            <MetaRow label="公式模式" id="detail-runtime-math-mode" value={t("detail-runtime-math-mode")} />
          </JobSummaryCard>
          <JobSummaryCard title="失败诊断">
            <MetaRow label="摘要" id="detail-failure-summary" value={t("detail-failure-summary")} />
            <MetaRow label="分类" id="detail-failure-category" value={t("detail-failure-category")} />
            <MetaRow label="阶段" id="detail-failure-stage" value={t("detail-failure-stage")} />
            <MetaRow label="根因" id="detail-failure-root-cause" value={t("detail-failure-root-cause")} />
            <MetaRow label="建议" id="detail-failure-suggestion" value={t("detail-failure-suggestion")} />
            <MetaRow label="最近日志" id="detail-failure-last-log-line" value={t("detail-failure-last-log-line")} />
            <MetaRow label="可重试" id="detail-failure-retryable" value={t("detail-failure-retryable")} />
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
