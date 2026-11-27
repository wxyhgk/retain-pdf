// 「对比版本」作为内置扩展（2026-11-27）：对照阅读的左栏换成这本书另一份译文，和右边正在读的这份逐段对着看。
// 登记底栏工具里的「对比版本」按钮（点了弹版本列表）、对照时左栏换成的那一份（comparedDocument）。
// 选了一份就切到对照；自己切走对照（只看原文 / 译文）就不对比了。
import { useEffect, useMemo } from "react";
import { GitCompareArrows } from "lucide-react";

import { VersionCompareMenu } from "../../components/react-pdf/ReaderVersionCompare.js";
import { useReaderVersionCompare, type VersionCompare } from "../../hooks/use-reader-version-compare.js";
import { useReaderApi, useReaderContribution } from "../registry.js";
import type { ReaderComparedDocument, ReaderContribution, ReaderExtension, ReaderToolbarItem } from "../types.js";

/** 底栏工具里的那颗按钮：这本书只有一份译文（或宿主没给版本端口）就没有。 */
export function compareToolbarItem(compare: VersionCompare): ReaderToolbarItem | null {
  if (!compare.available) return null;
  return {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: GitCompareArrows,
    pressed: Boolean(compare.compared || compare.loading),
    popup: (done) => <VersionCompareMenu compare={compare} onDone={done} />,
  };
}

/** 两栏书页上的水印：左边是对比的那份，右边是正在读的那份（名字、时间）。 */
export function comparedDocumentOf(compare: VersionCompare): ReaderComparedDocument | null {
  const { compared, versions, readingVersionId } = compare;
  if (!compared) return null;
  const left = versions.find((version) => version.versionId === compared.versionId);
  const right = versions.find((version) => version.versionId === readingVersionId);
  return {
    url: compared.url,
    regions: compared.regions,
    left: { name: compared.name, createdAt: left?.createdAt || "" },
    right: { name: right?.name || "当前译文", createdAt: right?.createdAt || "" },
  };
}

function CompareExtension(): null {
  const api = useReaderApi();
  const compare = useReaderVersionCompare({
    documentId: api.documentId,
    jobId: api.jobId,
    versions: api.translationVersions as VersionCompare["versions"],
    readingVersionId: api.versionId || "",
  });
  const { visibleMode, setWorkspace } = api;
  const comparedUrl = compare.compared?.url || "";
  useEffect(() => {
    if (comparedUrl && visibleMode !== "compare") setWorkspace("compare");
    // 只在选中另一份时切一次；之后用户自己切走由下面那个 effect 收掉对比。
  }, [comparedUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  const clear = compare.clear;
  useEffect(() => {
    if (visibleMode !== "compare") clear();
  }, [visibleMode, clear]);
  const contribution = useMemo<ReaderContribution>(() => {
    const item = compareToolbarItem(compare);
    return { toolbarItems: item ? [item] : [], comparedDocument: comparedDocumentOf(compare) };
  }, [compare]);
  useReaderContribution(contribution);
  return null;
}

export const readerCompareExtension: ReaderExtension = { id: "compare", title: "对比版本", Component: CompareExtension };
