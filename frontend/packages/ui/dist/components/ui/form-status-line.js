import { jsx as _jsx } from "react/jsx-runtime";
// 表单行内状态：凭据 / 术语表 / Agent 三域同一语义收敛。
//
// tone: "valid" | "error" | ""（空 = 进行中或静默）；空文本直接 hidden。
// 各域 base 类名不同（upload-status / credential-agent-runtime-message…），
// 但 hidden/is-valid/is-error/is-pending 四态映射唯一，避免手拼分叉。
import { cn } from "../../lib/utils.js";
export function statusToneOf(status) {
    const text = `${status?.message || ""}`.trim();
    const rawTone = `${status?.tone || ""}`.trim();
    const tone = rawTone === "valid" || rawTone === "error" ? rawTone : rawTone === "pending" ? "pending" : "";
    const pending = Boolean(text) && tone !== "valid" && tone !== "error";
    return { text, tone, pending };
}
export function FormStatusLine({ id, status, className, }) {
    const { text, tone } = statusToneOf(status);
    return (_jsx("span", { id: id, className: cn(className, !text && "hidden", tone === "valid" && "is-valid", tone === "error" && "is-error", Boolean(text) && tone !== "valid" && tone !== "error" && "is-pending"), role: "status", "aria-live": "polite", children: text }));
}
//# sourceMappingURL=form-status-line.js.map