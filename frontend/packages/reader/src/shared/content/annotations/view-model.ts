// 共享真值（原 frontend/web/src/js/reader/annotations/view-model.ts），已抽离为 standalone 纯函数
// 不直接 import frontend/web 私有路径或 types；仅依赖最小内联类型，宿主可按需收窄

// kind 到展示文案的映射:冻结防止展示层意外改写
export const ANNOTATION_KIND_META = Object.freeze({
  sentence: { label: "句子" },
  data: { label: "数据" },
  figure: { label: "图表" },
});

export type AnnotationKind = keyof typeof ANNOTATION_KIND_META;

export type AnnotationItem = {
  favoriteId?: string;
  documentId?: string;
  jobId?: string;
  pageIdx?: number;
  blockId?: string;
  kind?: string;
  quoteText?: string;
  translatedQuoteText?: string;
  note?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export type AnnotationGroup = {
  pageIdx: number;
  items: AnnotationItem[];
};

// 先按页码再按创建时间排序:导出与列表展示都依赖这个稳定顺序
export function sortAnnotations(list: unknown): AnnotationItem[] {
  if (!Array.isArray(list)) {
    return [];
  }
  return [...(list as AnnotationItem[])].sort((a, b) => {
    const pageDelta = Number(a?.pageIdx ?? 0) - Number(b?.pageIdx ?? 0);
    if (pageDelta !== 0) {
      return pageDelta;
    }
    // createdAt 是 ISO 字符串,字典序即时间序
    const left = `${a?.createdAt || ""}`;
    const right = `${b?.createdAt || ""}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

// 按页分组:展示层按页折叠、导出按页出小节,都复用这一份分组结果
export function groupAnnotationsByPage(list: unknown): AnnotationGroup[] {
  const groups: AnnotationGroup[] = [];
  for (const annotation of sortAnnotations(list)) {
    const pageIdx = Number(annotation?.pageIdx ?? 0);
    const last = groups[groups.length - 1];
    if (last && last.pageIdx === pageIdx) {
      last.items.push(annotation);
    } else {
      groups.push({ pageIdx, items: [annotation] });
    }
  }
  return groups;
}

// 多行文本转 Markdown 引用块:每一行都要加 "> ",否则换行会跳出引用
function toQuoteBlockLines(text: unknown): string[] {
  return `${(text as string) || ""}`.split("\n").map((line) => `> ${line}`);
}

// 生成导出用 Markdown:纯字符串拼装,方便精确单测与复制/下载复用
export function buildAnnotationsMarkdown({
  title = "",
  annotations = [],
}: {
  title?: string;
  annotations?: unknown;
} = {}): string {
  const heading = title ? `# ${title} 批注` : "# 批注";
  const groups = groupAnnotationsByPage(annotations);
  if (groups.length === 0) {
    return `${heading}\n\n(暂无批注)\n`;
  }
  const lines: string[] = [heading, ""];
  for (const group of groups) {
    // pageIdx 是 0 基,展示给人看要转成 1 基页码
    lines.push(`## 第 ${group.pageIdx + 1} 页`, "");
    for (const annotation of group.items) {
      lines.push(...toQuoteBlockLines(annotation?.quoteText));
      if (annotation?.translatedQuoteText) {
        // 译文紧贴原文引用块,用 —— 标记这是译文而非原文续行
        lines.push(...toQuoteBlockLines(`—— ${annotation.translatedQuoteText}`));
      }
      if (annotation?.note) {
        lines.push("", `笔记:${annotation.note}`);
      }
      // 每条批注后留空行,末尾的 "" 也保证整篇以换行结尾
      lines.push("");
    }
  }
  return lines.join("\n");
}

// 提取跳转锚点:阅读器只需要页码 + 块 id 就能定位回原文
export function annotationAnchor(annotation: AnnotationItem | null | undefined): {
  pageIdx?: number;
  blockId?: string;
} {
  return {
    pageIdx: annotation?.pageIdx,
    blockId: annotation?.blockId,
  };
}
