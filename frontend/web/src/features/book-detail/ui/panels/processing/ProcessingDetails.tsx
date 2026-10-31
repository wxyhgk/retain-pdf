// 「进度」页流水线下面的细节区：活动、错误、编辑部三页，只摆有内容的那几页，用一排带图标的小切换选。
// 只有一页时不画切换，直接是内容。默认停在最要紧的一页：有错误先看错误，其次编辑部（翻译 agent 在跑时），再次活动。
//
// 以前这三样各是一块，从上到下排着：最近活动、编辑部画面、失败卡、取消卡，一屏放不下。

import { useState, type ReactNode } from "react";
import { SegmentedControl } from "@retainpdf/ui";

export type ProcessingDetailKey = "errors" | "editorial" | "activity";

export type ProcessingDetailSection = {
  key: ProcessingDetailKey;
  label: string;
  icon: ReactNode;
  content: ReactNode;
  /** 要人注意（错误页）：切换上加一个红点。 */
  alert?: boolean;
};

export function ProcessingDetails({ sections }: { sections: ProcessingDetailSection[] }) {
  const [picked, setPicked] = useState<ProcessingDetailKey | "">("");
  if (!sections.length) return null;
  const current = sections.find((section) => section.key === picked) || sections[0];
  return (
    <div className="book-detail-processing-details" data-processing-details={current.key}>
      {sections.length > 1 ? (
        <SegmentedControl<ProcessingDetailKey>
          size="sm"
          label="进度细节"
          className="book-detail-processing-details-switch"
          value={current.key}
          onChange={setPicked}
          options={sections.map((section) => ({
            value: section.key,
            label: (
              <>
                {section.icon}
                {section.label}
                {section.alert ? <span className="book-detail-processing-details-dot" aria-label="有错误" /> : null}
              </>
            ),
            props: { "data-processing-detail": section.key },
          }))}
        />
      ) : null}
      <div className="book-detail-processing-details-body">{current.content}</div>
    </div>
  );
}
