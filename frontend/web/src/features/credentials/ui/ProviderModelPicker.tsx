// 设置「翻译 API」的「从服务商拉取模型」：用表单里现在填的地址、Key、协议问后端（后端代调服务商的 /models，
// Key 用完不存），拉回来列成清单：默认只列对话模型，可以搜、可以「显示全部」，每个带单价。
// 勾要用的几个，标一个默认，点「用这几个」写回「模型」「其他模型」两栏；再点「保存接口」才落盘。
// 服务商不支持列模型、Key 不对时就地说原因，手填那两栏照样能用。
import { useMemo, useState } from "react";
import { Download, Star } from "lucide-react";
import { Button, Checkbox, Input } from "@retainpdf/ui";
import {
  fetchTranslationProviderModels,
  type ProviderModelListView,
} from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import {
  applyModelSelection,
  initialSelection,
  modelListStatusText,
  modelPriceText,
  visibleModels,
} from "../domain/provider-models.js";

export type ModelListRequest = { base_url: string; api_key: string; api_protocol: string };

export function ProviderModelPicker({
  readRequest,
  readCurrent,
  onApply,
  fetchModels = (request) => fetchTranslationProviderModels(API_PREFIX, request),
}: {
  /** 表单里现在填的；缺东西时给一句原因。 */
  readRequest: () => ModelListRequest | { error: string };
  readCurrent: () => { model: string; extras: string[] };
  onApply: (result: { model: string; extras: string[] }) => void;
  fetchModels?: (request: ModelListRequest) => Promise<ProviderModelListView>;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ProviderModelListView | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState("");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const models = view?.models || [];
  const shown = useMemo(() => visibleModels(models, { showAll, query }), [models, showAll, query]);
  const otherCount = models.filter((model) => model.kind === "other").length;

  const pull = async () => {
    const request = readRequest();
    setOpen(true);
    if ("error" in request) {
      setStatus({ tone: "error", text: request.error });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const result = await fetchModels(request);
      setView(result);
      setStatus(modelListStatusText(result));
      const current = readCurrent();
      setSelected(initialSelection(result.models || [], current));
      setDefaultModel(current.model);
    } catch (cause) {
      setView(null);
      setStatus({ tone: "error", text: (cause as Error)?.message || "拉取模型失败，请稍后再试。" });
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string, checked: boolean) => {
    setSelected((current) => (checked ? [...current, id] : current.filter((item) => item !== id)));
  };

  const apply = () => {
    const result = applyModelSelection(selected, defaultModel);
    if (!result) return;
    onApply(result);
    setStatus({ tone: "ok", text: `已填好：默认 ${result.model}${result.extras.length ? `，其他 ${result.extras.length} 个` : ""}。点「保存接口」才会存下来。` });
    setView(null);
  };

  return (
    <div className="credential-model-picker" data-provider-model-picker="true">
      <div className="credential-model-picker-head">
        <Button variant="secondary" size="sm" pending={loading} onClick={() => { void pull(); }} data-provider-model-action="pull">
          <Download aria-hidden="true" />
          从服务商拉取模型
        </Button>
        {status ? (
          <span className={`credential-model-picker-status is-${status.tone}`} role={status.tone === "error" ? "alert" : "status"}>
            {status.text}
          </span>
        ) : (
          <span className="credential-model-picker-status">用上面填的地址和 Key 去问服务商有哪些模型，Key 不会被保存。</span>
        )}
      </div>
      {open && view?.ok && models.length ? (
        <div className="credential-model-picker-body">
          <div className="credential-model-picker-tools">
            <Input size="sm" className="credential-model-picker-search" value={query} placeholder="搜模型" aria-label="搜模型" onChange={(event) => setQuery(event.target.value)} />
            {otherCount ? (
              <Checkbox label={`显示全部（含 ${otherCount} 个非对话模型）`} checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
            ) : null}
          </div>
          <ul className="credential-model-picker-list" aria-label="服务商的模型">
            {shown.map((model) => {
              const checked = selected.includes(model.id);
              const isDefault = model.id === defaultModel;
              const price = modelPriceText(model);
              return (
                <li key={model.id} className="credential-model-picker-row" data-model-id={model.id} data-checked={checked ? "true" : undefined}>
                  <Checkbox className="credential-model-picker-check" label={model.id} checked={checked} onChange={(event) => toggle(model.id, event.target.checked)} />
                  {price ? <span className="credential-model-picker-price">{price}</span> : <span className="credential-model-picker-price is-empty">查不到价</span>}
                  {isDefault ? (
                    <span className="credential-model-picker-default"><Star aria-hidden="true" />默认</span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="credential-model-picker-make-default"
                      data-provider-model-action="default"
                      onClick={() => {
                        setDefaultModel(model.id);
                        if (!checked) toggle(model.id, true);
                      }}
                    >设为默认</Button>
                  )}
                </li>
              );
            })}
            {!shown.length ? <li className="credential-model-picker-empty">没有匹配的模型。</li> : null}
          </ul>
          <div className="credential-model-picker-foot">
            <span>已选 {selected.length} 个</span>
            <Button variant="ghost" size="sm" onClick={() => setView(null)}>收起</Button>
            <Button variant="primary" size="sm" disabled={!selected.length} onClick={apply} data-provider-model-action="apply">
              用这几个
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
