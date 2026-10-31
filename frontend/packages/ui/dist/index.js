export { cn } from "./lib/utils.js";
// 基础组件（docs/ops/planning/frontend-migration/20261031-基础组件与刻度.md）。样子在 styles/*.css。
export { Button, IconButton } from "./primitives/button.js";
export { Field, Input, Select, Textarea } from "./primitives/field.js";
export { Checkbox, SegmentedControl } from "./primitives/choice.js";
export { Badge } from "./primitives/badge.js";
export { Menu } from "./primitives/menu.js";
export { Panel } from "./primitives/panel.js";
export { Sheet } from "./primitives/sheet.js";
// 弹窗、确认框、表单状态行（从 web/src/ui/components 搬来，原样）。
export { Dialog, DialogBody, DialogClose, DialogCloseButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogShell, DialogTitle, DialogTrigger, } from "./components/ui/dialog.js";
export { ConfirmDialog } from "./components/ui/confirm-dialog.js";
export { FormStatusLine, statusToneOf } from "./components/ui/form-status-line.js";
export { Toaster } from "./components/ui/sonner.js";
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, } from "./components/ui/tooltip.js";
/** @deprecated shadcn 默认样子的旧按钮，只给还没迁的地方用；新代码用 Button / IconButton。门禁只许它的用量减少。 */
export { LegacyButton, legacyButtonVariants } from "./components/ui/button.js";
//# sourceMappingURL=index.js.map