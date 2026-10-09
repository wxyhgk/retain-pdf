import type { LoadGlossaryOptionsParams } from "./contracts.js";

/** 术语表下拉项：只读取 glossary_id，其余字段原样透传给 setDeveloperGlossaryOptions。 */
export interface GlossaryOptionItem {
  glossary_id?: string;
  [key: string]: unknown;
}

export interface CreateGlossaryOptionsLoaderOptions {
  fetchGlossaries?: (apiPrefix: string) => Promise<unknown>;
  apiPrefix: string;
  setDeveloperGlossaryOptions: (glossaries: GlossaryOptionItem[], selectedId?: string) => void;
  setText?: (id: string, text?: string) => void;
  getDefaultSelectedId?: () => string | undefined;
}

export function createGlossaryOptionsLoader({
  fetchGlossaries,
  apiPrefix,
  setDeveloperGlossaryOptions,
  setText,
  getDefaultSelectedId,
}: CreateGlossaryOptionsLoaderOptions) {
  let glossaryOptions: GlossaryOptionItem[] = [];
  let glossaryOptionsLoaded = false;
  let glossaryOptionsLoading: Promise<GlossaryOptionItem[]> | null = null;

  function currentOptions() {
    return glossaryOptions;
  }

  function applyOptions(selectedId = "") {
    setDeveloperGlossaryOptions(glossaryOptions, `${selectedId || ""}`.trim());
  }

  async function loadGlossaryOptions({ force = false, selectedId = "" }: LoadGlossaryOptionsParams = {}) {
    if ((!force && glossaryOptionsLoaded) || !fetchGlossaries) {
      const nextSelectedId = `${selectedId || ""}`.trim();
      if (nextSelectedId) {
        setDeveloperGlossaryOptions(glossaryOptions, nextSelectedId);
      }
      return glossaryOptions;
    }
    if (glossaryOptionsLoading) {
      return glossaryOptionsLoading;
    }
    glossaryOptionsLoading = fetchGlossaries(apiPrefix)
      .then((payload) => {
        const items = payload && typeof payload === "object" ? (payload as { items?: unknown }).items : undefined;
        glossaryOptions = Array.isArray(items) ? items : [];
        glossaryOptionsLoaded = true;
        const requestedSelectedId = `${selectedId || ""}`.trim();
        const fallbackSelectedId = `${getDefaultSelectedId?.() || ""}`.trim();
        // 已删除术语表的残留 id 不再回退：仅当回退 id 仍在新列表中才沿用。
        const nextSelectedId = requestedSelectedId
          || (fallbackSelectedId && glossaryOptions.some((item) => `${item?.glossary_id || ""}`.trim() === fallbackSelectedId)
            ? fallbackSelectedId
            : "");
        setDeveloperGlossaryOptions(glossaryOptions, nextSelectedId);
        return glossaryOptions;
      })
      .catch((err) => {
        setText?.("error-box", err.message || String(err));
        return glossaryOptions;
      })
      .finally(() => {
        glossaryOptionsLoading = null;
      });
    return glossaryOptionsLoading;
  }

  return {
    applyOptions,
    currentOptions,
    loadGlossaryOptions,
  };
}
