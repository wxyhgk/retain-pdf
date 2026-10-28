// 任务跑完以后怎么告诉用户（纯逻辑，环境全由调用方注入，不碰 React）。
//
// - 用户正看着这个页面：页面里弹一条提示，带「去阅读 / 查看」按钮，不弹系统通知。
// - 页面在后台（切到别的标签页、窗口缩到托盘、被别的程序挡住）：
//   开关开着、系统也允许，就弹系统通知，点它把窗口拿到前面并打开那本书；
//   标签页标题前面加上 (✓ ✗) 记号；页面里的提示先攒着，等用户回到页面再弹
//   （提示一直挂着会盖住底栏的按钮），记号同时去掉。

import { jobFinishedBody, jobFinishedTitle, titleWithFinishMark } from "./notify-prefs.js";
import type { FinishedJob } from "./job-finish-watcher.js";

type NotificationLike = { onclick: ((this: unknown, event: unknown) => unknown) | null; close(): void };

export type NotificationApi = {
  readonly permission: string;
  new (title: string, options?: { body?: string; tag?: string }): NotificationLike;
};

export type ToastAction = { label: string; onClick: () => void };

export type FinishToastOptions = {
  description: string;
  action: ToastAction;
};

export type FinishDeliveryEnv = {
  doc: Pick<Document, "visibilityState" | "hasFocus" | "title" | "addEventListener" | "removeEventListener">;
  /** 浏览器或桌面壳的 Notification；没有（老浏览器、测试）就传 null。 */
  notificationApi: NotificationApi | null;
  isEnabled: () => boolean;
  toastSuccess: (title: string, options: FinishToastOptions) => void;
  toastError: (title: string, options: FinishToastOptions) => void;
  /** 桌面版把窗口拿到前面；网页版 window.focus()。 */
  focusWindow: () => void;
  /** 打开这本书：成功去阅读，失败看详情。 */
  openJob: (job: FinishedJob) => void;
};

export type FinishDelivery = {
  deliver(job: FinishedJob): void;
  dispose(): void;
};

// 标题前面我们自己加的那段记号，例如「(✓2 ✗) 」。
const FINISH_MARK = /^\([✓✗\d ]+\) /;

export function stripFinishMark(title: string): string {
  return `${title || ""}`.replace(FINISH_MARK, "");
}

export function createFinishDelivery(env: FinishDeliveryEnv): FinishDelivery {
  const counts = { succeeded: 0, failed: 0 };
  // 在后台时跑完的，等回到页面再弹页面提示。
  let pending: FinishedJob[] = [];

  function pageInView() {
    return env.doc.visibilityState === "visible" && env.doc.hasFocus();
  }

  function clearMark() {
    if (!counts.succeeded && !counts.failed) return;
    counts.succeeded = 0;
    counts.failed = 0;
    env.doc.title = stripFinishMark(env.doc.title);
  }

  function onBackInView() {
    if (!pageInView()) return;
    clearMark();
    const waiting = pending;
    pending = [];
    for (const job of waiting) showInPage(job);
  }

  env.doc.addEventListener("visibilitychange", onBackInView);
  // 桌面窗口从别的程序切回来时 visibilitychange 不一定触发，focus 会。
  globalThis.window?.addEventListener?.("focus", onBackInView);

  function showInPage(job: FinishedJob) {
    const options = {
      description: jobFinishedBody(job),
      action: { label: job.status === "succeeded" ? "去阅读" : "查看", onClick: () => env.openJob(job) },
    };
    if (job.status === "succeeded") env.toastSuccess(jobFinishedTitle(job), options);
    else env.toastError(jobFinishedTitle(job), options);
  }

  function showSystemNotification(job: FinishedJob) {
    const api = env.notificationApi;
    if (!api || api.permission !== "granted" || !env.isEnabled()) return;
    try {
      // tag 用任务编号：同时开着几个页面时，同一个任务的通知只留一条。
      const notification = new api(jobFinishedTitle(job), { body: jobFinishedBody(job), tag: `retainpdf-job-${job.jobId}` });
      notification.onclick = () => {
        // 点了通知就已经去打开了，回到页面时不用再弹这一条。
        pending = pending.filter((item) => item.jobId !== job.jobId);
        env.focusWindow();
        env.openJob(job);
        notification.close();
      };
    } catch {
      // 有的环境（安卓 Chrome）只许经 service worker 发通知，构造就抛；标题记号照样有。
    }
  }

  return {
    deliver(job) {
      if (pageInView()) {
        showInPage(job);
        return;
      }
      counts[job.status] += 1;
      env.doc.title = titleWithFinishMark(stripFinishMark(env.doc.title), counts);
      pending.push(job);
      showSystemNotification(job);
    },
    dispose() {
      env.doc.removeEventListener("visibilitychange", onBackInView);
      globalThis.window?.removeEventListener?.("focus", onBackInView);
      clearMark();
      pending = [];
    },
  };
}
