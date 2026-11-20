// 上传弹窗里模式切换下面的一行流程：这一种模式会经过哪几步、最后得到什么，用图标一眼看清。
// 「翻译」：上传 → 识别版面 → 翻译（Agent 翻译时写「Agent 翻译」）→ 译文 PDF；「仅 OCR」：上传 → 识别版面 → Markdown。
// 只是说明，不能点。
import type { LucideIcon } from "lucide-react";
import { Bot, ChevronRight, FileText, FileType2, FileUp, Languages, ScanText } from "lucide-react";

type FlowStep = { key: string; label: string; Icon: LucideIcon };

const UPLOAD: FlowStep = { key: "upload", label: "上传 PDF", Icon: FileUp };
const OCR: FlowStep = { key: "ocr", label: "识别版面", Icon: ScanText };

const PDF: FlowStep = { key: "pdf", label: "译文 PDF", Icon: FileText };

export const UPLOAD_FLOW_STEPS: Record<"translate" | "agent" | "ocr", readonly FlowStep[]> = {
  translate: [UPLOAD, OCR, { key: "translate", label: "翻译", Icon: Languages }, PDF],
  agent: [UPLOAD, OCR, { key: "agent", label: "Agent 翻译", Icon: Bot }, PDF],
  ocr: [UPLOAD, OCR, { key: "markdown", label: "Markdown", Icon: FileType2 }],
};

export function UploadFlowStrip({ ocrOnly, agent = false }: { ocrOnly: boolean; agent?: boolean }) {
  const flow = ocrOnly ? "ocr" : agent ? "agent" : "translate";
  const steps = UPLOAD_FLOW_STEPS[flow];
  return (
    <ol className="upload-flow" aria-label={ocrOnly ? "仅 OCR 的流程" : "翻译的流程"} data-flow={flow}>
      {steps.map(({ key, label, Icon }, index) => (
        <li key={key} className="upload-flow-step" data-step={key}>
          {index > 0 ? <ChevronRight className="upload-flow-arrow" aria-hidden="true" /> : null}
          <span className="upload-flow-icon" aria-hidden="true">
            <Icon />
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}
