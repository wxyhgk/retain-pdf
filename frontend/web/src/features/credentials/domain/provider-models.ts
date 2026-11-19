// 设置「翻译 API」里「从服务商拉取」的纯逻辑：后端代调服务商的 /models（POST /providers/translation/models），
// 这里把结果说成人话、算单价、筛选，再把用户勾的几个换成「模型」（默认）和「其他模型」两栏的值。
import type { ProviderModelListView, ProviderModelView } from "@/platform/api/index.js";

/** 单价按人民币显示；和用量里一样用 7.16（后端价目里的 usd_cny，这个接口不带 pricing，先用同一个数）。 */
const USD_TO_CNY = 7.16;

const STATUS_MESSAGES: Record<string, string> = {
  unsupported: "这个接口不支持列模型，请在下面手动填。",
  unauthorized: "Key 不对或没有权限，服务商拒绝了。",
  invalid_input: "Key 里有不能用的字符（换行、全角空格之类），检查一下再拉。",
  unreachable: "连不上这个地址，检查 API URL 和网络。",
  provider_error: "服务商出错了，稍后再试。",
};

/** 拉取结果的一句话：成功说拉到几个，失败说原因（带上服务商原话）。 */
export function modelListStatusText(view: ProviderModelListView | null | undefined): { tone: "ok" | "error"; text: string } {
  if (!view) return { tone: "error", text: "没拉到模型。" };
  if (view.ok && view.status === "ok") {
    const chat = Number(view.chat_models ?? view.models.filter((model) => model.kind === "chat").length) || 0;
    const total = view.models.length;
    if (!total) return { tone: "error", text: "服务商没返回任何模型，请手动填。" };
    return { tone: "ok", text: chat === total ? `拉到 ${total} 个模型。` : `拉到 ${chat} 个对话模型（共 ${total} 个）。` };
  }
  const base = STATUS_MESSAGES[view.status] || view.summary || "没拉到模型。";
  const detail = `${view.provider_message || ""}`.trim();
  return { tone: "error", text: detail ? `${base}（${detail.slice(0, 160)}）` : base };
}

function yuan(usd: number | null | undefined): string {
  if (usd == null || !Number.isFinite(Number(usd))) return "";
  const cny = Number(usd) * USD_TO_CNY;
  return cny >= 10 ? cny.toFixed(1) : cny >= 1 ? cny.toFixed(2) : cny.toFixed(3);
}

/** 单价一行：「输入 ¥0.36 · 输出 ¥2.86 /百万 token」；查不到价是空串。 */
export function modelPriceText(model: Pick<ProviderModelView, "price">): string {
  const input = yuan(model.price?.input);
  const output = yuan(model.price?.output);
  if (!input && !output) return "";
  return [input ? `输入 ¥${input}` : "", output ? `输出 ¥${output}` : ""].filter(Boolean).join(" · ") + " /百万 token";
}

/** 列表里显示哪些：默认只列对话模型，「显示全部」才列 embedding 这类；搜索按 id、显示名包含（不分大小写）。 */
export function visibleModels(
  models: readonly ProviderModelView[],
  { showAll = false, query = "" }: { showAll?: boolean; query?: string } = {},
): ProviderModelView[] {
  const needle = query.trim().toLowerCase();
  return models.filter((model) => (showAll || model.kind !== "other")
    && (!needle || model.id.toLowerCase().includes(needle) || `${model.display_name || ""}`.toLowerCase().includes(needle)));
}

/** 打开时预先勾上：现在的默认模型和其他模型里，服务商列表里有的那些。 */
export function initialSelection(models: readonly ProviderModelView[], current: { model: string; extras: readonly string[] }): string[] {
  const ids = new Set(models.map((model) => model.id));
  return [current.model, ...current.extras].filter((id, index, list) => id && ids.has(id) && list.indexOf(id) === index);
}

/**
 * 勾好以后写回两栏：默认模型（没勾它就换成勾的第一个），其余进「其他模型」。
 * 一个都没勾时不改（返回 null）。
 */
export function applyModelSelection(selected: readonly string[], defaultModel: string): { model: string; extras: string[] } | null {
  const unique = [...new Set(selected.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return null;
  const model = unique.includes(defaultModel) ? defaultModel : unique[0];
  return { model, extras: unique.filter((id) => id !== model) };
}
