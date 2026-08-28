import { resolveMarkedVendorUrl } from "../runtime/vendor-url.js";

// Render Markdown an toàn chuyên dụng cho câu trả lời AI: marked tải lười, và **thoát HTML gốc** —
// Output của mô hình như `**in đậm**`/`## tiêu đề`/danh sách sẽ được render, nhưng `<img>`/`<script>` đều hiển thị dưới dạng
// văn bản thô, tuyệt đối không vào DOM (chống injection). Injection nút trích dẫn được tách khỏi module này (xem chat.js).

let markedPromise = null;

function escapeHtml(value = "") {
  return `${value}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Tham số đầu vào của renderer.html trong các phiên bản marked không giống nhau (chuỗi hoặc token), thống nhất lấy văn bản gốc rồi thoát
function rawHtmlText(input) {
  if (typeof input === "string") {
    return input;
  }
  return `${input?.raw ?? input?.text ?? ""}`;
}

function loadMarked() {
  if (!markedPromise) {
    markedPromise = import(resolveMarkedVendorUrl())
      .then(({ marked, Marked }) => {
        // Sử dụng instance độc lập, tránh làm ô nhiễm cấu hình global marked của markdown-preview
        const instance = typeof Marked === "function" ? new Marked() : marked;
        instance.use({
          renderer: {
            html: (input) => escapeHtml(rawHtmlText(input)),
          },
        });
        return instance;
      })
      .catch((error) => {
        markedPromise = null;
        throw error;
      });
  }
  return markedPromise;
}

// Markdown văn bản → DocumentFragment đã làm sạch. Ném lỗi khi marked không khả dụng (như test node),
// Phía gọi chịu trách nhiệm fallback về node văn bản thuần túy.
export async function renderAiMarkdownFragment(text, { documentRef = globalThis.document } = {}) {
  const marked = await loadMarked();
  const template = documentRef.createElement("template");
  template.innerHTML = marked.parse(`${text || ""}`, { async: false });
  // Đảm bảo kép: ngay cả khi renderer.html có lỗ hổng, vẫn xóa các node kiểu script và sự kiện inline/liên kết nguy hiểm
  const content = template.content;
  content.querySelectorAll("script, iframe, object, embed, img, svg").forEach((node) => node.remove());
  content.querySelectorAll("*").forEach((node) => {
    for (const attribute of [...node.attributes]) {
      if (/^on/i.test(attribute.name)) {
        node.removeAttribute(attribute.name);
      }
    }
  });
  content.querySelectorAll("a[href]").forEach((anchor) => {
    if (/^\s*javascript:/i.test(anchor.getAttribute("href") || "")) {
      anchor.removeAttribute("href");
    }
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");
  });
  return content;
}
