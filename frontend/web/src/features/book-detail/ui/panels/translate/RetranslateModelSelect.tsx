// 重新翻译用哪个模型：设置里存好的连接（每家服务商一套 key、地址、模型）挑一个，第一项「沿用原来的」。
// 设置里一条可用的连接都没有时不画（只能沿用原来的）。估价（约 ¥x–y）由调用方按选项给。
import { Select } from "@retainpdf/ui";
import type { RetranslateModelOption } from "../../../domain/retranslate-model.js";

export function RetranslateModelSelect({
  options,
  value,
  onChange,
  disabled = false,
  size = "sm",
  priceOf,
}: {
  options: readonly RetranslateModelOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  /** 这一项大概要花多少（「约 ¥1.20–1.80」）；没有估价给空串。 */
  priceOf?: (value: string) => string;
}) {
  if (options.length <= 1) return null;
  return (
    <Select
      id="book-detail-translation-model"
      size={size}
      aria-label="重新翻译用的模型"
      title="重新翻译用的模型（设置里存的连接）"
      className="book-detail-translation-model"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => {
        const price = option.value && priceOf ? priceOf(option.value) : "";
        return (
          <option key={option.value || "keep"} value={option.value}>
            {price ? `${option.label}　${price}` : option.label}
          </option>
        );
      })}
    </Select>
  );
}
