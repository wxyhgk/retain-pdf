// 「对比版本」：选了一份就切到对照（左栏放那一份），切走对照就不对比了；两栏书页上的水印（从 ReaderAppReactPdf 拆出，2026-11-27）。
import { useEffect, useMemo } from "react";

import type { ReaderWorkspaceMode } from "../components/react-pdf/index.js";
import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import { useReaderVersionCompare } from "../hooks/use-reader-version-compare.js";
import type { ReaderPaneComposition } from "./pane-composition.js";

export function useReaderCompareVersion(
  c: ReaderReactController,
  visiblePdfMode: ReaderPaneComposition["visibleMode"],
  changeWorkspace: (next: ReaderWorkspaceMode) => void,
) {
  const { session } = c;
  const versionCompare = useReaderVersionCompare({ documentId: session.documentId, jobId: session.jobId });
  const comparedUrl = versionCompare.compared?.url || "";
  useEffect(() => {
    if (comparedUrl && visiblePdfMode !== "compare") changeWorkspace("compare");
    // 只在选中另一份时切一次；之后用户自己切走由下面那个 effect 收掉对比。
  }, [comparedUrl]);
  useEffect(() => {
    if (visiblePdfMode !== "compare") versionCompare.clear();
  }, [visiblePdfMode]);
  const compareVersion = useMemo(
    () => {
      const { compared, versions, readingVersionId } = versionCompare;
      if (!compared) return null;
      // 两栏书页上的水印：左边是对比的那份，右边是正在读的那份（名字、时间）。
      const left = versions.find((version) => version.versionId === compared.versionId);
      const right = versions.find((version) => version.versionId === readingVersionId);
      return {
        url: compared.url,
        regions: compared.regions,
        left: { name: compared.name, createdAt: left?.createdAt || "" },
        right: { name: right?.name || "当前译文", createdAt: right?.createdAt || "" },
      };
    },
    [versionCompare.compared, versionCompare.versions, versionCompare.readingVersionId],
  );
  return { versionCompare, compareVersion };
}
