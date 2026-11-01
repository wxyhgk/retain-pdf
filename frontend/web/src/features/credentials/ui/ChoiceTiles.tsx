// 接口设置里「几个里选一个」的图标卡片：OCR 服务商、Agent 运行模式、操作确认。
// 底下就是 SegmentedControl（radiogroup，方向键换选项），这里只换个样子：一排等宽的卡片，图标在上、名字在下，
// 选中的描边。说明放在悬停里，画面上不写。以前前两个是下拉框，只有名字。
import type { ReactNode } from "react";
import { SegmentedControl } from "@retainpdf/ui";

export type ChoiceTile<T extends string> = {
  value: T;
  icon: ReactNode;
  label: string;
  /** 悬停说明；不给就是名字。 */
  title?: string;
  /** 落到这个卡片按钮上的 data-*（测试按它找）。 */
  props?: Record<string, string | undefined>;
};

export function ChoiceTiles<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
}: {
  value: T;
  options: ReadonlyArray<ChoiceTile<T>>;
  onChange: (value: T) => void;
  /** 给读屏的组名。 */
  label: string;
  disabled?: boolean;
}) {
  return (
    <SegmentedControl<T>
      className="credential-choice-tiles"
      label={label}
      value={value}
      onChange={onChange}
      disabled={disabled}
      columns={options.length}
      options={options.map((option) => ({
        value: option.value,
        label: (
          <>
            <span className="credential-choice-tile-icon" aria-hidden="true">{option.icon}</span>
            <span className="credential-choice-tile-name">{option.label}</span>
          </>
        ),
        props: { title: option.title || option.label, ...option.props },
      }))}
    />
  );
}
