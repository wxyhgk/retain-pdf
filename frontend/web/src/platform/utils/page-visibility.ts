// 页面在后台（标签页切走、窗口最小化）时，轮询跳过这一轮：没人看的进度不用每秒去问，切回来再继续。
export function isPageHidden(): boolean {
  try {
    return typeof document !== "undefined" && document.visibilityState === "hidden";
  } catch {
    return false;
  }
}
