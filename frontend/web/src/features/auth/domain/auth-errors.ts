// 登录、改密码、账号管理的错误说成人话（后端错误码见 AuthRequestError.code）。
export const MIN_PASSWORD_LENGTH = 8;
export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/;

export function authErrorText(error: unknown, fallback = "操作失败，请稍后再试。"): string {
  const e = (error || {}) as { status?: number; code?: string; message?: string; details?: Record<string, unknown> };
  const code = `${e.code || ""}`.toUpperCase();
  if (code === "INVALID_CREDENTIALS") return "用户名或密码不对。";
  if (code === "ACCOUNT_DISABLED") return "这个账号已停用，请联系管理员。";
  if (code === "TOO_MANY_ATTEMPTS") {
    const secs = Number(e.details?.retry_after_secs) || 0;
    return secs > 0 ? `尝试次数太多，请 ${Math.max(1, Math.ceil(secs / 60))} 分钟后再试。` : "尝试次数太多，请稍后再试。";
  }
  // 账号相关的错误后端都给了中文说明（WRONG_PASSWORD「当前密码不对」、SAME_PASSWORD、WEAK_PASSWORD、
  // INVALID_USERNAME、USERNAME_TAKEN、不能停用自己 / 最后一个管理员……），有就直接显示。
  if (e.message && /[\u4e00-\u9fff]/.test(e.message)) return e.message;
  if (code === "USERNAME_TAKEN") return "这个用户名已经有人用了。";
  if (code === "WRONG_PASSWORD") return "当前密码不对。";
  if (code === "SAME_PASSWORD") return "新密码不能和当前密码一样。";
  if (code === "WEAK_PASSWORD") return `密码至少 ${Number(e.details?.min_length) || MIN_PASSWORD_LENGTH} 位。`;
  if (code === "INVALID_USERNAME") return "用户名 3～32 位，只能用字母、数字、点、下划线、连字符。";
  if (e.status === 403) return "没有权限做这件事。";
  if (e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(`${e.message || ""}`)) {
    return "连不上服务器，请稍后再试。";
  }
  return e.message && /[一-鿿]/.test(e.message) ? e.message : fallback;
}

export function passwordProblem(next: string, confirm: string): string {
  if (next.length < MIN_PASSWORD_LENGTH) return `新密码至少 ${MIN_PASSWORD_LENGTH} 位。`;
  if (next !== confirm) return "两次输入的新密码不一样。";
  return "";
}
