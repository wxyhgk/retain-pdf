import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

// Cổng không gian tên cấp mã nguồn: bộ chọn tệp nguồn reader/detail phải có tiền tố trang.
// Việc xây dựng đã tách dist/css/{home,detail,reader}.css theo trang, rủi ro ô nhiễm giữa các trang đã giảm đáng kể;
// Kiểm thử này tiếp tục khóa "không viết bộ chọn toàn cục trần trong mã nguồn reader/detail".

const PROJECT_ROOT = process.cwd();
const STYLES_ROOT = join(PROJECT_ROOT, "src/styles");

const GROUPS = [
  {
    name: "Trang reader/thành phần trình đọc",
    files: [
      ...readdirSync(join(STYLES_ROOT, "reader"))
        .filter((f) => f.endsWith(".css"))
        .map((f) => join(STYLES_ROOT, "reader", f)),
    ],
    allowed: [
      /(\.|#)reader-/,
      /\[data-reader/,
      /^reader-dialog\b/, // bộ chọn thẻ tùy chỉnh <reader-dialog>
      /body\.reader/,
      /^:root$/,
    ],
  },
  {
    name: "Trang detail",
    files: [
      join(STYLES_ROOT, "pages.css"),
      ...readdirSync(join(STYLES_ROOT, "pages/detail"))
        .filter((f) => f.endsWith(".css"))
        .map((f) => join(STYLES_ROOT, "pages/detail", f)),
    ],
    allowed: [
      /(\.|#)detail-/,
      /\[data-detail/,
      /\.markdown-/, // khối xem trước Markdown của trang detail
      /body\.detail/,
      /^:root$/,
    ],
  },
];

// Phân tích bộ chọn quy tắc, bỏ qua bộ chọn bước bên trong @keyframes (0%/from/to).
//
// Sau khi di chuyển sang Tailwind v4, một số tệp kiểu đã chuyển sang sử dụng CSS lồng gốc (`&:hover`/`& p`/`&.foo`)
// và cú pháp `@utility <name> { ... }` (sản phẩm của công cụ di chuyển chính thức v4). Cả hai cách viết này sau khi biên dịch
// tương đương với bộ chọn tổ hợp phẳng cũ, nhưng văn bản ký tự không còn tiền tố trang, vì vậy cần mở rộng `&`
// thành ngữ cảnh bộ chọn của lớp gần nhất (`@utility <name>` được coi là `.<name>`), nếu không sẽ
// coi nhầm bộ chọn lồng hoàn toàn hợp lệ thành "không có không gian tên".
function ruleSelectors(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors = [];
  // Mỗi lớp ghi { header, resolved }: resolved là null nghĩa là lớp này là at-rule được truyền qua
  // (@media/@keyframes, v.v.), không thiết lập ngữ cảnh bộ chọn mới, `&` nên xuyên qua nó để tìm
  // ngữ cảnh bộ chọn thực/`@utility` của lớp gần nhất.
  const stack = [];
  let buffer = "";

  const nearestResolved = () => {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      if (stack[i].resolved) {
        return stack[i].resolved;
      }
    }
    return [""];
  };

  const resolveHeader = (header) => {
    const parents = nearestResolved();
    return header
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .flatMap((part) =>
        part.includes("&") ? parents.map((parent) => part.split("&").join(parent)) : [part],
      );
  };

  for (const ch of noComments) {
    if (ch === "{") {
      const header = buffer.trim();
      buffer = "";
      const inKeyframes = stack.some((frame) => frame.header.startsWith("@keyframes"));

      if (/^@utility\s+/.test(header)) {
        const name = header.replace(/^@utility\s+/, "").trim();
        stack.push({ header, resolved: [`.${name}`] });
      } else if (header.startsWith("@") || inKeyframes) {
        stack.push({ header, resolved: null });
      } else {
        const resolved = resolveHeader(header);
        selectors.push(...resolved);
        stack.push({ header, resolved });
      }
    } else if (ch === "}") {
      stack.pop();
      buffer = "";
    } else if (ch === ";") {
      buffer = "";
    } else {
      buffer += ch;
    }
  }
  return selectors;
}

for (const group of GROUPS) {
  test(`${group.name} 样式文件的选择器全部带页面命名空间`, () => {
    const violations = [];
    for (const file of group.files) {
      for (const selector of ruleSelectors(readFileSync(file, "utf8"))) {
        for (const part of selector.split(",")) {
          const trimmed = part.trim();
          if (!trimmed) {
            continue;
          }
          if (!group.allowed.some((pattern) => pattern.test(trimmed))) {
            violations.push(`${relative(PROJECT_ROOT, file)}: "${trimmed}"`);
          }
        }
      }
    }
    assert.deepEqual(
      violations,
      [],
       `Các bộ chọn sau không có không gian tên trang (nên sử dụng tiền tố reader-/detail-):\n  ${violations.join("\n  ")}`,
    );
  });
}
