// 「译文版本」：一本书翻过几次就有几份译文，用户可以选读哪一份（GET/PUT/PATCH /documents/:id/translation-version(s)）。
// 不选 = 自动（逐页取最新，新译文翻完自动跟上）；选了就停在那份，后面再翻出新的只提示「有新版本」。
// 只重翻几页的版本，其余页后端自动用来源版本补齐，前端不用拼。纯函数，单测直接覆盖。
import type { TranslationVersionView, TranslationVersionsView } from "@retainpdf/contracts/library-documents";

export type VersionOption = { value: string; label: string };

/** 下拉里「自动」那一项的值（PUT 时换成 null）。 */
export const AUTO_VERSION = "";

const STATUS_NOTES: Record<string, string> = {
  running: "翻译中",
  failed: "没翻完",
  canceled: "已取消",
};

function shortDate(value: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) return "";
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${parsed.getMonth() + 1}月${parsed.getDate()}日 ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

/** 一个版本在下拉、列表里的一行：名字 · 时间 · 改过 N 处 · 翻译中。 */
export function versionLabel(version: TranslationVersionView): string {
  const parts = [version.name || version.version_id];
  const date = shortDate(version.created_at);
  if (date) parts.push(date);
  if (version.edited_blocks > 0) parts.push(`改过 ${version.edited_blocks} 处`);
  const note = STATUS_NOTES[version.status];
  if (note) parts.push(note);
  return parts.join(" · ");
}

/** 下拉：第一项「自动（最新）」，然后没隐藏的版本，新的在上。选中的版本被隐藏了也列出来，免得下拉显示空。 */
export function versionOptions(view: TranslationVersionsView | null | undefined): VersionOption[] {
  const versions = view?.versions || [];
  const current = view?.current_version_id || "";
  const listed = versions.filter((version) => !version.hidden || version.version_id === current);
  return [
    { value: AUTO_VERSION, label: "自动（最新）" },
    ...[...listed].reverse().map((version) => ({ value: version.version_id, label: versionLabel(version) })),
  ];
}

/** 只有一份译文、也没选过、没隐藏过的书不显示版本卡：没得选。 */
export function hasVersionChoice(view: TranslationVersionsView | null | undefined): boolean {
  if (!view) return false;
  if (view.current_version_id) return true;
  return view.versions.length > 1;
}

/** 选了某个版本、后面又翻出了新的：最新那份（没隐藏的），提示用。 */
export function newestVersion(view: TranslationVersionsView | null | undefined): TranslationVersionView | null {
  if (!view?.has_newer) return null;
  const visible = view.versions.filter((version) => !version.hidden);
  return visible[visible.length - 1] || null;
}

/** 改名的输入：去掉首尾空白，后端最多 80 字；空串 = 清掉、用生成的名字。 */
export const VERSION_LABEL_MAX = 80;

export function normalizeVersionLabel(value: string): string {
  return [...`${value || ""}`.trim()].slice(0, VERSION_LABEL_MAX).join("");
}
