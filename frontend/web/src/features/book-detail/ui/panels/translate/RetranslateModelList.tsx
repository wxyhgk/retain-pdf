// 「重新处理」清单里重新翻译用哪个模型：一张单选列表，代替原来那个塞满长字的下拉。
//
// 第一行「用设置里的默认」（重新翻译以设置为底，什么都不选就用设置里的模型）；下面按服务商分组（服务商标志 + 名字），每个模型一行，估价靠右（约 ¥x–y），
// 最便宜的那个标「最省」。上下方向键换选项（选中跟着走），和系统单选一样只有选中那行能 Tab 到。
// 模型来自设置里存了 key 的服务商（默认模型和「其他模型」各一行）。
import { useRef, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { Button } from "@retainpdf/ui";
import { BrandLogo } from "@/ui/icons/BrandLogo.jsx";
import { modelLogoFor, vendorLogoForBaseUrl } from "@/platform/config/brand-logos.js";
import { KEEP_MODEL, type RetranslateModelOption } from "../../../domain/retranslate-model.js";

type Group = { key: string; label: string; baseUrl: string; options: RetranslateModelOption[] };

function groupsOf(options: readonly RetranslateModelOption[]): Group[] {
  const groups: Group[] = [];
  for (const option of options) {
    const connection = option.connection;
    if (!connection) continue;
    const key = `${connection.provider}@${connection.baseUrl}`;
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = { key, label: connection.label, baseUrl: connection.baseUrl, options: [] };
      groups.push(group);
    }
    group.options.push(option);
  }
  return groups;
}

/** 估价的下限（排「最省」用）；没有估价是 Infinity。 */
function lowOf(price: string): number {
  const match = /¥\s*([<\d.,]+)/.exec(price);
  if (!match) return Number.POSITIVE_INFINITY;
  const value = Number(match[1].replace(/[<,]/g, ""));
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

export function RetranslateModelList({
  options,
  value,
  onChange,
  disabled = false,
  priceOf,
  currentModel = "",
  settingsModel = "",
}: {
  options: readonly RetranslateModelOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  priceOf?: (value: string) => string;
  /** 这本书上次翻译用的模型：同名那一行标「原来用的」。 */
  currentModel?: string;
  /** 设置里的默认模型：什么都不选时用它，第一行写出来。 */
  settingsModel?: string;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  if (options.length <= 1) return null;
  const groups = groupsOf(options);
  const order = [KEEP_MODEL, ...groups.flatMap((group) => group.options.map((option) => option.value))];
  const prices = Object.fromEntries(order.map((item) => [item, item && priceOf ? priceOf(item) : ""]));
  const cheapest = order
    .filter((item) => item && prices[item])
    .reduce<{ value: string; low: number }>((best, item) => {
      const low = lowOf(prices[item]);
      return low < best.low ? { value: item, low } : best;
    }, { value: "", low: Number.POSITIVE_INFINITY });
  const pricedCount = order.filter((item) => item && prices[item]).length;

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const index = Math.max(0, order.indexOf(value));
    const next = order[(index + (event.key === "ArrowDown" ? 1 : order.length - 1)) % order.length];
    onChange(next);
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>(`[data-model-value="${CSS.escape(next)}"]`)?.focus();
    });
  };

  const row = (option: RetranslateModelOption, label: string) => {
    const selected = option.value === value;
    const price = prices[option.value] || "";
    return (
      <Button
        key={option.value || "keep"}
        role="radio"
        aria-checked={selected}
        tabIndex={selected ? 0 : -1}
        disabled={disabled}
        className="book-detail-model-option"
        data-model-value={option.value}
        data-selected={selected ? "true" : undefined}
        onClick={() => onChange(option.value)}
      >
        <span className="book-detail-model-radio" aria-hidden="true">{selected ? <Check /> : null}</span>
        <span className="book-detail-model-name">{label}</span>
        {option.value && currentModel && option.connection?.model === currentModel
          ? <span className="book-detail-model-tag is-current">原来用的</span>
          : null}
        {pricedCount > 1 && cheapest.value === option.value ? <span className="book-detail-model-tag">最省</span> : null}
        {price ? <span className="book-detail-model-price">{price}</span> : null}
      </Button>
    );
  };

  return (
    <div
      ref={listRef}
      className="book-detail-model-list"
      role="radiogroup"
      aria-label="重新翻译用的模型"
      data-retranslate-model-list="true"
      onKeyDown={move}
    >
      {row(options.find((option) => option.value === KEEP_MODEL) || { value: KEEP_MODEL, label: "", connection: null }, settingsModel ? `用设置里的默认（${settingsModel}）` : "用设置里的默认模型")}
      {groups.map((group) => (
        <div key={group.key} className="book-detail-model-group" role="presentation" data-model-group={group.label}>
          <div className="book-detail-model-group-head" aria-hidden="true">
            <BrandLogo className="book-detail-model-logo" logo={vendorLogoForBaseUrl(group.baseUrl) || modelLogoFor(group.options[0]?.connection?.model)} />
            <span>{group.label}</span>
          </div>
          {group.options.map((option) => row(option, option.connection?.model || option.label))}
        </div>
      ))}
    </div>
  );
}
