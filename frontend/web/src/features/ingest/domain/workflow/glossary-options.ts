export function createGlossaryOptionsLoader({
  fetchGlossaries,
  apiPrefix,
  setDeveloperGlossaryOptions,
  setText,
  getDefaultSelectedId,
}: any) {
  let glossaryOptions = [];
  let glossaryOptionsLoaded = false;
  let glossaryOptionsLoading = null;

  function currentOptions() {
    return glossaryOptions;
  }

  function applyOptions(selectedId = "") {
    setDeveloperGlossaryOptions(glossaryOptions, `${selectedId || ""}`.trim());
  }

  async function loadGlossaryOptions({ force = false, selectedId = "" }: any = {}) {
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
        glossaryOptions = Array.isArray(payload?.items) ? payload.items : [];
        glossaryOptionsLoaded = true;
        const nextSelectedId = `${selectedId || ""}`.trim() || getDefaultSelectedId?.() || "";
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
