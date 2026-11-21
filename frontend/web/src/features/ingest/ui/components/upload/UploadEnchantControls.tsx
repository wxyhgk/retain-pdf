// 上传弹窗底部的「附魔」按钮（2026-11-20 用户：选模型、普通 / Agent、页数，点了像游戏里给文件附魔）：
// - 模型：设置里存好的连接挑一条（只管这一次上传，不记到本机，见 workflow-view-store 的 uploadModel）；
// - 普通 / Agent：和「选项」里「翻译质量」同一个设置（Agent = refined），选 Agent 时弹一条提示：质量大幅提升、速度很慢、token 多；
// - OCR：PaddleOCR / MinerU / GLM-OCR 挑一家（2026-11-21 用户），也只管这一次；本机没设好的灰掉；
// - 页数：页码范围（和「选项」里的页码同一份）。
// 模型、OCR 都画各家的标志（2026-11-21 用户：模型多用图标）。
// 选了什么，中间的文件卡片就叠上对应的效果（EnchantedFile）。仅 OCR 下只有 OCR 和页数。
import { useState } from "react";
import { Bot, Check, ChevronDown, Cpu, FileStack, Languages, ScanText } from "lucide-react";
import { Popover, ToggleGroup } from "radix-ui";
import { toast } from "sonner";

import { Button, Input } from "@retainpdf/ui";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { BrandLogo } from "@/ui/icons/BrandLogo.jsx";
import { modelLogoFor, vendorLogoForBaseUrl, type BrandLogo as BrandLogoEntry } from "@/platform/config/brand-logos.js";
import {
  connectionValue,
  savedDefaultTranslationModel,
  savedTranslationConnections,
} from "@/platform/config/translation-connections.js";
import { isAgentTranslation, qualityForEngine } from "../../../domain/workflow-preferences.js";
import { useIngestServices, useIngestWorkflowView } from "../../workflow-view-context.js";

/**
 * 页码范围写成一句短的（「1–10 页」「第 3 页」「12 页起」）；全部页是空串。
 * 上传完会自动填成「1 到最后一页」（upload/execution 的 writePageRanges），那也算全部页。
 */
export function pageRangeLabel(start: unknown, end: unknown, max = 0): string {
  const from = `${start ?? ""}`.trim();
  const to = `${end ?? ""}`.trim();
  const fromAll = !from || from === "1";
  const toAll = !to || (max > 0 && Number(to) >= max);
  if (fromAll && toAll) return "";
  if (from && to) return from === to ? `第 ${from} 页` : `${from}–${to} 页`;
  return from ? `${from} 页起` : `到 ${to} 页`;
}

/** 模型名短一点放按钮上：去掉「服务商/」前缀。 */
export function shortModelName(model: string): string {
  const value = `${model || ""}`.trim();
  return value.includes("/") ? value.slice(value.lastIndexOf("/") + 1) : value;
}

/** 模型的标志：先认模型家族（Claude、通义……），认不出按接口地址认厂商。 */
export function modelLogo(model: string, baseUrl = ""): BrandLogoEntry | null {
  return modelLogoFor(model) || vendorLogoForBaseUrl(baseUrl);
}

/** 按钮、选项前面的小图：有标志画标志，没有用线条图标。 */
function ChoiceIcon({ logo, fallback }: { logo: BrandLogoEntry | null; fallback: typeof Cpu }) {
  const Fallback = fallback;
  return logo ? <BrandLogo className="upload-enchant-logo" logo={logo} /> : <Fallback className="upload-enchant-logo" aria-hidden="true" />;
}

function ModelPicker() {
  const workflowView = useIngestWorkflowView();
  const workflow = useStoreSnapshot(workflowView.store);
  const [open, setOpen] = useState(false);
  // 打开时现读：设置里刚加的连接这次就能选。
  const connections = open ? savedTranslationConnections() : [];
  const defaultModel = savedDefaultTranslationModel();
  const chosen = workflow.uploadModel ? workflow.uploadModel.split("::").slice(1).join("::") : "";
  const label = shortModelName(chosen || defaultModel) || "模型";
  const pick = (value: string) => {
    workflowView.setUploadModel(value);
    setOpen(false);
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button className="upload-enchant-chip" data-enchant="model" data-active={chosen ? "true" : undefined} title="这次用哪个模型翻译">
          <ChoiceIcon logo={modelLogo(chosen || defaultModel)} fallback={Cpu} />
          <span>{label}</span>
          <ChevronDown className="upload-enchant-caret" aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="upload-enchant-pop" side="top" align="start" sideOffset={8} aria-label="选翻译模型">
          <Button className="upload-enchant-option" data-selected={!chosen || undefined} onClick={() => pick("")}>
            <ChoiceIcon logo={modelLogo(defaultModel)} fallback={Cpu} />
            <span>设置里的默认{defaultModel ? `（${shortModelName(defaultModel)}）` : ""}</span>
            {!chosen ? <Check aria-hidden="true" /> : null}
          </Button>
          {connections.map((connection) => {
            const value = connectionValue(connection);
            const selected = workflow.uploadModel === value;
            return (
              <Button key={value} className="upload-enchant-option" data-selected={selected || undefined} onClick={() => pick(value)}>
                <ChoiceIcon logo={modelLogo(connection.model, connection.baseUrl)} fallback={Cpu} />
                <span>
                  <small>{connection.label}</small>
                  {connection.model}
                </span>
                {selected ? <Check aria-hidden="true" /> : null}
              </Button>
            );
          })}
          {!connections.length ? <p className="upload-enchant-empty">设置里还没存别的模型。</p> : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function EngineToggle() {
  const workflowView = useIngestWorkflowView();
  const workflow = useStoreSnapshot(workflowView.store);
  const quality = workflow.preferences.translationQuality;
  const agent = isAgentTranslation(quality);
  const choose = (value: string) => {
    if (!value) return;
    const next = qualityForEngine(value, quality);
    if (next === quality) return;
    workflowView.setPreference("translationQuality", next);
    if (next === "refined") {
      toast("Agent 翻译", {
        id: "upload-agent-hint",
        description: "质量会大幅提升，但速度很慢，消耗的 token 也多得多。",
      });
    }
  };
  return (
    <ToggleGroup.Root type="single" value={agent ? "agent" : "standard"} onValueChange={choose} className="upload-enchant-engine" aria-label="翻译方式">
      <ToggleGroup.Item value="standard" className="upload-enchant-engine-item" aria-label="普通翻译" title="普通翻译：快、省">
        <Languages aria-hidden="true" />
        <span>普通</span>
      </ToggleGroup.Item>
      <ToggleGroup.Item value="agent" className="upload-enchant-engine-item" data-engine="agent" aria-label="Agent 翻译" title="Agent 翻译：质量大幅提升，速度很慢，token 多">
        <Bot aria-hidden="true" />
        <span>Agent</span>
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  );
}

function OcrPicker() {
  const workflowView = useIngestWorkflowView();
  const workflow = useStoreSnapshot(workflowView.store);
  const [open, setOpen] = useState(false);
  // 打开时现读：设置里刚填的 Token 这次就能选。
  const choices = workflowView.uploadOcrChoices();
  const fallback = workflowView.defaultOcr();
  const current = choices.find((choice) => choice.id === (workflow.uploadOcr || fallback)) || choices[0];
  const active = Boolean(workflow.uploadOcr) && workflow.uploadOcr !== fallback;
  const pick = (id: string) => {
    // 选回设置里那家 = 不附魔。
    workflowView.setUploadOcr(id === fallback ? "" : id);
    setOpen(false);
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button className="upload-enchant-chip" data-enchant="ocr" data-active={active ? "true" : undefined} title="这次用哪家 OCR 识别">
          <ChoiceIcon logo={current?.logo || null} fallback={ScanText} />
          <span>{current?.label || "OCR"}</span>
          <ChevronDown className="upload-enchant-caret" aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="upload-enchant-pop" side="top" align="start" sideOffset={8} aria-label="选 OCR">
          {choices.map((choice) => {
            const selected = choice.id === current?.id;
            return (
              <Button
                key={choice.id}
                className="upload-enchant-option"
                data-ocr={choice.id}
                data-selected={selected || undefined}
                disabled={!choice.ready}
                title={choice.ready ? undefined : "设置里还没填它的 Token"}
                onClick={() => pick(choice.id)}
              >
                <ChoiceIcon logo={choice.logo} fallback={ScanText} />
                <span>
                  {choice.label}
                  {choice.isDefault ? <small>设置里的默认</small> : !choice.ready ? <small>没设 Token</small> : null}
                </span>
                {selected ? <Check aria-hidden="true" /> : null}
              </Button>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function PagePicker() {
  const { uploadViewStore, features } = useIngestServices();
  const upload = useStoreSnapshot(uploadViewStore);
  const total = upload.pageRangeMax || upload.uploadedPageCount;
  const range = pageRangeLabel(upload.pageRangeStart, upload.pageRangeEnd, total);
  const max = total > 0 ? total : undefined;
  const set = (source: "start" | "end", value: string) => {
    uploadViewStore.actions.setPageRange(source === "start" ? { start: value } : { end: value });
    features.uploadFeature?.constrainPageRanges({ source });
  };
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button className="upload-enchant-chip" data-enchant="pages" data-active={range ? "true" : undefined} title="翻译哪几页">
          <FileStack aria-hidden="true" />
          <span>{range || "全部页"}</span>
          <ChevronDown className="upload-enchant-caret" aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="upload-enchant-pop is-pages" side="top" align="start" sideOffset={8} aria-label="页码范围">
          <div className="upload-enchant-range">
            <Input size="sm" type="number" inputMode="numeric" min={1} max={max} placeholder="起" aria-label="从第几页"
              value={upload.pageRangeStart || ""} onChange={(event) => set("start", event.currentTarget.value)} />
            <span aria-hidden="true">–</span>
            <Input size="sm" type="number" inputMode="numeric" min={1} max={max} placeholder={max ? `${max}` : "止"} aria-label="到第几页"
              value={upload.pageRangeEnd || ""} onChange={(event) => set("end", event.currentTarget.value)} />
          </div>
          <Button className="upload-enchant-option" data-selected={!range || undefined} onClick={() => { set("start", max ? "1" : ""); set("end", max ? `${max}` : ""); }}>
            <span>全部页{max ? `（${max} 页）` : ""}</span>
            {!range ? <Check aria-hidden="true" /> : null}
          </Button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function UploadEnchantControls({ ocrOnly = false }: { ocrOnly?: boolean }) {
  return (
    <div className="upload-enchant-controls" data-enchant-controls>
      {ocrOnly ? null : <ModelPicker />}
      {ocrOnly ? null : <EngineToggle />}
      <OcrPicker />
      <PagePicker />
    </div>
  );
}
