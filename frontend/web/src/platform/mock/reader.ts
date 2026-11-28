// ===== 阅读区域(锚点/选区取文 e2e 用) =====

/** 演示 PDF 四页各一个节标题（和 live-translation.ts 的 SAMPLE_PAGES 一样）：书页区左缘的目录有东西可画（2026-11-28）。 */
const MOCK_HEADINGS = [
  ["1 Reading Documents Across Languages", "1 跨语言阅读文档"],
  ["2 How the Pages Are Processed", "2 页面是怎样处理的"],
  ["3 Checking the Result", "3 检查结果"],
  ["4 Limitations", "4 局限"],
].map(([source, translated], index) => ({
  item_id: `b-heading-${index + 1}`,
  region_type: "paragraph",
  sub_type: "title",
  heading_level: 1,
  status: "translated",
  source: { page: index + 1, bbox: [57, 52, 400, 76], text: source },
  translated: { page: index + 1, bbox: [57, 52, 400, 76], text: translated },
}));

export function getMockReaderRegions() {
  return {
    items: [
      ...MOCK_HEADINGS,
      {
        item_id: "b-intro-3",
        region_type: "paragraph",
        status: "translated",
        source: {
          page: 1,
          bbox: [57, 52, 540, 96],
          text: "Source PDF",
        },
        translated: {
          page: 1,
          bbox: [57, 52, 540, 96],
          text: "原始 PDF",
        },
      },
      {
        item_id: "b-body-1",
        region_type: "paragraph",
        status: "translated",
        source: {
          page: 1,
          bbox: [57, 100, 540, 150],
          text: "RetainPDF Mock Preview",
        },
        translated: {
          page: 1,
          bbox: [57, 100, 540, 150],
          text: "RetainPDF 联调预览",
        },
      },
    ],
  };
}
