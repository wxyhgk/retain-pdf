// Trạng thái thuần view của AppUpdateBanner + store kết nối với controller.js (giữ nguyên) của features/app-update để điều khiển viewPort (bản vẽ §5, phản chiếu cách viết của credentials-view-store.js/glossaries-store.js).
//
// Thế giới cũ update-view-port.js/view.js toàn bộ là DOM trực tiếp (cũ, không import); ở đây dùng chữ ký phương thức cùng tên (bindButton/setChecking/setReady/setAvailable/setLatest/setError) để triển khai lại, chỉ thay đổi mục đích "ghi" từ DOM sang store. Hành vi từng trường được sao chép từ src/js/features/app-update/view.js:88-166 (setUpdateChecking/setUpdateReady/setUpdateAvailable/setUpdateLatest/setUpdateError), controller.js (điều phối checkForUpdates + bộ nhớ đệm 24h) được sử dụng lại không thay đổi.

import { APP_UPDATE_STATES } from "./app-update-contract.js";
import type { HandlersBag } from "../../composition/types.js";
import {
  createStore,
  APP_VERSION,
} from "../../composition/external.js";
import type { Store } from "../../composition/external.js";

export type AppUpdatePanel = {
  title: string;
  body: string;
  latestVersion: string;
  currentVersion: string;
  htmlUrl: string;
};

export type AppUpdateViewState = {
  buttonState: string;
  hasUpdate: boolean;
  buttonTitle: string;
  statusText: string;
  panel: AppUpdatePanel;
};

export type AppUpdateViewActions = {
  apply(
    _currentState: AppUpdateViewState,
    nextState: AppUpdateViewState,
  ): AppUpdateViewState;
};

export type AppUpdateViewStore = Store<AppUpdateViewState, AppUpdateViewActions>;

/** Tải trọng thông tin phát hành cho setAvailable / setLatest */
export type AppUpdateReleaseInfo = {
  latestVersion?: string;
  currentVersion?: string;
  title?: string;
  body?: string;
  htmlUrl?: string;
};

function panelOf({
  title = "Kiểm tra cập nhật",
  body = "",
  latestVersion = "",
  currentVersion = APP_VERSION,
  htmlUrl = "",
}: Partial<AppUpdatePanel> = {}): AppUpdatePanel {
  return { title, body, latestVersion, currentVersion, htmlUrl };
}

export function createAppUpdateViewFeature() {
  const store = createStore<AppUpdateViewState, AppUpdateViewActions>({
    name: "appUpdateView",
    initialState: {
      buttonState: APP_UPDATE_STATES.idle,
      hasUpdate: false,
      buttonTitle: "Kiểm tra cập nhật",
      statusText: "",
      panel: panelOf({
        title: "Kiểm tra cập nhật",
        body: "Nhấn 'Kiểm tra lại' để lấy phiên bản mới nhất từ GitHub Releases.",
      }),
    },
    actions: {
      apply(_currentState, nextState) {
        return nextState;
      },
    },
  });

  const handlersRef: { current: HandlersBag | null } = { current: null };

  const viewPort = {
    bindButton: (handlers: HandlersBag) => {
      handlersRef.current = handlers;
    },
    // Sao chép từ view.js:88-100 (setUpdateChecking)
    setChecking: () => store.actions.apply({
      buttonState: APP_UPDATE_STATES.checking,
      hasUpdate: store.getSnapshot().hasUpdate,
      buttonTitle: "Đang kiểm tra cập nhật",
      statusText: "Đang kiểm tra GitHub Releases...",
      panel: panelOf({
        title: "Đang kiểm tra cập nhật",
        body: "Đang kết nối GitHub Releases...",
      }),
    }),
    // Sao chép từ view.js:102-115 (setUpdateReady)
    setReady: () => store.actions.apply({
      buttonState: APP_UPDATE_STATES.idle,
      hasUpdate: false,
      buttonTitle: "Kiểm tra cập nhật",
      statusText: "",
      panel: panelOf({
        title: "Kiểm tra cập nhật",
        body: "Nhấn 'Kiểm tra lại' để lấy phiên bản mới nhất từ GitHub Releases.",
      }),
    }),
    // Sao chép từ view.js:117-133 (setUpdateAvailable)
    setAvailable: (info: AppUpdateReleaseInfo = {}) => store.actions.apply({
      buttonState: APP_UPDATE_STATES.available,
      hasUpdate: true,
      buttonTitle: `Phát hiện phiên bản mới ${info.latestVersion}`,
      statusText: "Phát hiện phiên bản mới",
      panel: panelOf({
        title: info.title || `RetainPDF ${info.latestVersion}`,
        body: info.body,
        latestVersion: info.latestVersion,
        currentVersion: info.currentVersion,
        htmlUrl: info.htmlUrl,
      }),
    }),
    // Sao chép từ view.js:135-151 (setUpdateLatest)
    setLatest: (info?: AppUpdateReleaseInfo | null) => store.actions.apply({
      buttonState: APP_UPDATE_STATES.latest,
      hasUpdate: false,
      buttonTitle: "Đã là phiên bản mới nhất",
      statusText: "Đã là phiên bản mới nhất",
      panel: panelOf({
        title: "Đã là phiên bản mới nhất",
        body: "Phiên bản hiện tại đã là mới nhất trên GitHub Releases.",
        latestVersion: info?.latestVersion || APP_VERSION,
        currentVersion: info?.currentVersion || APP_VERSION,
        htmlUrl: info?.htmlUrl || "",
      }),
    }),
    // Sao chép từ view.js:153-166 (setUpdateError)
    setError: (error?: { message?: string } | null) => store.actions.apply({
      buttonState: APP_UPDATE_STATES.error,
      hasUpdate: false,
      buttonTitle: "Kiểm tra cập nhật thất bại",
      statusText: "Kiểm tra thất bại",
      panel: panelOf({
        title: "Kiểm tra cập nhật thất bại",
        body: error?.message || "Không thể kết nối GitHub Releases.",
      }),
    }),
  };

  return {
    store,
    viewPort,
    handlersRef,
  };
}
