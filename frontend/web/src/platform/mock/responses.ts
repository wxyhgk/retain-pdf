import { MOCK_MARKDOWN_CONTENT } from "./constants.js";
import { getMockJobMarkdown } from "./markdown.js";

function mockPdfBytes(label = "Mock PDF") {
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 68 >>
stream
BT
/F1 24 Tf
72 760 Td
(${label}) Tj
0 -36 Td
(RetainPDF Mock Preview) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000063 00000 n 
0000000122 00000 n 
0000000248 00000 n 
0000000366 00000 n 
trailer
<< /Root 1 0 R /Size 6 >>
startxref
436
%%EOF`;
  return new TextEncoder().encode(pdf);
}

export async function fetchMockProtected(url) {
  const raw = `${url || ""}`.trim();
  // @retainpdf/domain/job#resolveJobMarkdownBundleAction (镜像真实后端行为)会给
  // markdown bundle 追加 ?include_job_dir=true 查询串,source_pdf 等其它
  // action 理论上也可能带查询串——mock 响应表只关心资源路径本身,统一按
  // "?" 之前的部分匹配,避免真实 URL 契约(@retainpdf/domain/job#appendResourceQuery)
  // 变化时 mock 模式下载 404(artifact-downloads 域的下载按钮在
  // ?mock=succeeded 下实测触发过此 404,详见 dialogs 蓝图 §7 验收记录)。
  const normalized = raw.split("?")[0];
  if (normalized === "mock://translated.pdf") {
    return new Response(mockPdfBytes("Translated PDF"), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
      },
    });
  }
  if (normalized === "mock://source.pdf") {
    return new Response(mockPdfBytes("Source PDF"), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
      },
    });
  }
  // 文档级源 PDF(馆藏文档 source_pdf_url,见 mock/documents.js):让"只读原文"
  // 阅读器在 ?mock= 下也能真的挂出一栏源文档。
  if (normalized === "mock://document-source.pdf") {
    return new Response(mockPdfBytes("Library Document"), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
      },
    });
  }
  // 文档封面/缩略图占位。
  //
  // 真实封面是 PDF 首页的渲染图，所以占位也画成"一页文档"：纸色底 + 标题块 +
  // 正文行，120×160（与书卡 3:4 一致）。
  //
  // 原先这里是 1×1 透明 PNG。它同时没做到两件事：URL 侧
  // normalizeJobImageUrl 会把 mock:// 当相对路径拼到 apiBase 上、且加载走的是
  // 裸 fetch 拿不到 mock 分流，所以照样 404；而即便修好加载链路，透明像素也会
  // 成功"盖掉"书卡自带的 PDF 占位图，让封面变成纯白——比 404 回退还难看。
  if (
    normalized === "mock://document-cover.png"
    || normalized === "mock://document-thumb.png"
    || /\/api\/v1\/documents\/[^/]+\/(cover|thumbnail)$/.test(normalized)
  ) {
    const png = Uint8Array.from(
      atob("iVBORw0KGgoAAAANSUhEUgAAAHgAAACgCAIAAABIaz/HAAABPElEQVR42u3asQ2FMAxAwey/ThqUJWgQJQXKEigUsIQjYU56f4ErEpuf0s9DEyrv7x6XQgMNGrRAgwYNGjRogQYNGjRo0AINGjRo0KAFGjRo0KBBC3Q26LbUlIEGDRo0aNCgjXfmaIEGDTrbZQgaNGjQoEGbOkCDFmjQAg0atECDFmjQoAUatGKg9239UKBBg3ZGuwwFGjRogbaw/CTQoEE7o12GoAUaNGjQFhbjHWjQFhZnNGjQoAUaNGgPaECDBu2MdhmCBg0atEBbWHyPBg0atECDBg0CNGgZ78zRoEFbWFyGAg0aNAvQFhYPaECDBi3QoAUaNGgZ73z4Bw3aPyzOaIEGLdCgQRvvzNGgQTujXYagBRq0QFtYPKABDdqTMIEGDVqgQQs0aNACDVqgQYMWaNACDRq0AqE1oQfEy4B0pczZSQAAAABJRU5ErkJggg=="),
      (c) => c.charCodeAt(0),
    );
    return new Response(png, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  }
  if (normalized === "mock://bundle.zip") {
    return new Response(new Uint8Array([80, 75, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
      },
    });
  }
  if (normalized === "mock://markdown.raw") {
    return new Response(MOCK_MARKDOWN_CONTENT, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
      },
    });
  }
  if (normalized === "mock://markdown.json") {
    return new Response(JSON.stringify(getMockJobMarkdown()), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  if (normalized === "mock://markdown/images/page-1/imgs/mock-figure-1.png") {
    const pixel = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
      0, 0, 0, 1, 0, 0, 0, 1, 8, 4, 0, 0, 0, 181, 28, 12,
      2, 0, 0, 0, 11, 73, 68, 65, 84, 120, 218, 99, 252, 255, 31, 0,
      3, 3, 2, 0, 239, 212, 141, 245, 0, 0, 0, 0, 73, 69, 78, 68,
      174, 66, 96, 130,
    ]);
    return new Response(pixel, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
      },
    });
  }
  return new Response("mock resource not found", { status: 404 });
}
