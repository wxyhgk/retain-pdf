// AppUpdateBanner 详情 dialog 的开合态——纯 UI 瞬态(总计划「状态策略」第 5
// 条:现状不在 store 里的东西,重写后也不进 store)。本地 useState 即可,不
// 需要 dialog-store.js 那套跨子树共享机制:按钮与 dialog 现在合并进同一个
// AppUpdateBanner.jsx(蓝图 §5),不存在"跨子树"开合场景。

import { useState, type Dispatch, type SetStateAction } from "react";

export function useAppUpdateDialogOpen(
  initialOpen = false,
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [open, setOpen] = useState(initialOpen);
  return [open, setOpen];
}
