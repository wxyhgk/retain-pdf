// 「翻译」模式下选普通翻译还是 Agent 翻译（2026-11-20 用户：两个都放到弹窗上）。
// 和「选项」里「翻译质量」下拉是同一个设置（translationQuality）：Agent = refined（翻译 agent），
// 普通 = standard / terms（选了「统一术语」切过来不丢）。选 Agent 时下面提示：质量大幅提升、速度很慢、token 消耗多。
import { Bot, Coins, Hourglass, Languages, Sparkles } from "lucide-react";
import { Tabs as TabsPrimitive } from "radix-ui";

import type { TranslationQuality } from "../../../domain/workflow-preferences.js";

export function isAgentTranslation(quality: TranslationQuality): boolean {
  return quality === "refined";
}

/** 点了哪一个 → 翻译质量。点普通时原来是「统一术语」就留着。 */
export function qualityForEngine(engine: string, current: TranslationQuality): TranslationQuality {
  if (engine === "agent") return "refined";
  return current === "refined" ? "standard" : current;
}

const AGENT_NOTES = [
  { key: "quality", Icon: Sparkles, title: "质量大幅提升", text: "先通读全文定好术语，再逐页翻译并审校。" },
  { key: "slow", Icon: Hourglass, title: "速度很慢", text: "比普通翻译慢很多；开头通读时进度会先停在 0。" },
  { key: "tokens", Icon: Coins, title: "消耗大量 token", text: "模型调用多好几轮，费用比普通翻译高得多。" },
] as const;

export function UploadEngineChoice({ quality, onChange }: { quality: TranslationQuality; onChange: (next: TranslationQuality) => void }) {
  const agent = isAgentTranslation(quality);
  return (
    <div className="upload-engine">
      <TabsPrimitive.Root value={agent ? "agent" : "standard"} onValueChange={(value) => onChange(qualityForEngine(value, quality))}>
        <TabsPrimitive.List className="upload-engine-list" aria-label="翻译方式">
          <TabsPrimitive.Trigger value="standard" className="upload-engine-option" data-engine="standard">
            <span className="upload-engine-icon" aria-hidden="true"><Languages /></span>
            <span className="upload-engine-copy">
              <strong>普通翻译</strong>
              <small>快、省</small>
            </span>
          </TabsPrimitive.Trigger>
          <TabsPrimitive.Trigger value="agent" className="upload-engine-option" data-engine="agent">
            <span className="upload-engine-icon" aria-hidden="true"><Bot /></span>
            <span className="upload-engine-copy">
              <strong>Agent 翻译</strong>
              <small>质量好、慢、贵</small>
            </span>
          </TabsPrimitive.Trigger>
        </TabsPrimitive.List>
      </TabsPrimitive.Root>
      {agent ? (
        <ul className="upload-engine-notes" role="note" aria-label="Agent 翻译提示" aria-live="polite">
          {AGENT_NOTES.map(({ key, Icon, title, text }) => (
            <li key={key} data-note={key}>
              <Icon aria-hidden="true" />
              <span><strong>{title}</strong>{text}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
