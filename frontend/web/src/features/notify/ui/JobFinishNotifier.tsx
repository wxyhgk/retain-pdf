// 任务跑完时告诉用户：没有界面，挂在主页上就开始盯（见 domain/job-finish-watcher）。
//
// 网页版的系统通知要用户点一次「允许」。浏览器只许在点击里问，所以等用户交了第一个任务，
// 弹一条带「开启」按钮的提示，点了才去问；用户拒了就不再提，标题记号和页面提示照样有。

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { fetchJobList, fetchJobsByIds } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";
import { getDesktopHost } from "@/platform/desktop/host.js";
import { useAppEvent } from "@/ui/hooks/use-app-event.js";
import {
  createJobFinishWatcher,
  JOB_FINISH_RECENT_LIMIT,
  type FinishedJob,
  type JobFinishWatcher,
  type WatchedJob,
} from "../domain/job-finish-watcher.js";
import { createFinishDelivery, type FinishToastOptions, type NotificationApi } from "../domain/deliver.js";
import { readJobFinishNotifyEnabled } from "../domain/notify-prefs.js";

export type JobFinishNotifierProps = {
  /** 打开这本书：成功的去阅读，失败的看详情。由主页接线。 */
  onOpenJob: (job: FinishedJob) => void;
};

function notificationApi(): NotificationApi | null {
  const api = (globalThis as { Notification?: NotificationApi }).Notification;
  return typeof api === "function" ? api : null;
}

function toastOptions({ description, action }: FinishToastOptions) {
  return { description, action, duration: 8000 };
}

async function listRecent(): Promise<WatchedJob[]> {
  const page = await fetchJobList(API_PREFIX, { limit: JOB_FINISH_RECENT_LIMIT, includeLiveStage: false });
  return Array.isArray(page?.items) ? page.items : [];
}

async function listByIds(jobIds: string[]): Promise<WatchedJob[]> {
  const page = await fetchJobsByIds(API_PREFIX, jobIds);
  return Array.isArray(page?.items) ? page.items : [];
}

export function JobFinishNotifier({ onOpenJob }: JobFinishNotifierProps) {
  const openRef = useRef(onOpenJob);
  openRef.current = onOpenJob;
  const watcherRef = useRef<JobFinishWatcher | null>(null);
  const askedPermissionRef = useRef(false);

  useEffect(() => {
    const desktop = getDesktopHost();
    const delivery = createFinishDelivery({
      doc: globalThis.document,
      notificationApi: notificationApi(),
      isEnabled: () => readJobFinishNotifyEnabled(),
      toastSuccess: (title, options) => toast.success(title, toastOptions(options)),
      toastError: (title, options) => toast.error(title, toastOptions(options)),
      focusWindow: () => {
        if (desktop) void Promise.resolve(desktop.focusWindow()).catch(() => {});
        else globalThis.window?.focus?.();
      },
      openJob: (job) => openRef.current(job),
    });
    const watcher = createJobFinishWatcher({ listRecent, listByIds, onFinished: delivery.deliver });
    watcherRef.current = watcher;
    watcher.start();
    return () => {
      watcher.stop();
      delivery.dispose();
      watcherRef.current = null;
    };
  }, []);

  useAppEvent(APP_EVENTS.libraryJobCreated, () => {
    watcherRef.current?.poke();
    const api = notificationApi() as (NotificationApi & { requestPermission?: () => Promise<string> }) | null;
    if (askedPermissionRef.current || !api?.requestPermission || api.permission !== "default") return;
    if (!readJobFinishNotifyEnabled()) return;
    askedPermissionRef.current = true;
    toast("任务跑完时要不要弹系统通知？", {
      description: "切到别的页面也能知道翻译好了。可以在 设置 → 通知 里关掉。",
      action: { label: "开启", onClick: () => void api.requestPermission!().catch(() => {}) },
      duration: 12000,
    });
  });

  return null;
}
