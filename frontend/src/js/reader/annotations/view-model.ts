// Lớp logic thuần túy của trình chỉnh sửa chú thích: không tương tác với DOM/React, thuận tiện cho unit test node
// Chú thích là bản ghi chuẩn hóa từ yêu thích phía server (favorites), định dạng xem tại tests/reader-annotations-vm.test.mjs

// Ánh xạ kind đến văn bản hiển thị: đóng băng để ngăn lớp hiển thị sửa đổi bất ngờ
export const ANNOTATION_KIND_META = Object.freeze({
  sentence: { label: "Câu" },
  data: { label: "Dữ liệu" },
  figure: { label: "Biểu đồ" },
});

// Sắp xếp trước theo số trang rồi theo thời gian tạo: xuất và hiển thị danh sách đều phụ thuộc vào thứ tự ổn định này
export function sortAnnotations(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return [...list].sort((a, b) => {
    const pageDelta = Number(a?.pageIdx ?? 0) - Number(b?.pageIdx ?? 0);
    if (pageDelta !== 0) {
      return pageDelta;
    }
    // createdAt là chuỗi ISO, thứ tự từ điển chính là thứ tự thời gian
    const left = `${a?.createdAt || ""}`;
    const right = `${b?.createdAt || ""}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

// Nhóm theo trang: lớp hiển thị gập theo trang, xuất theo trang thành tiểu mục, đều tái sử dụng kết quả nhóm này
export function groupAnnotationsByPage(list) {
  const groups = [];
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

// Chuyển văn bản đa dòng sang khối trích dẫn Markdown: mỗi dòng đều phải thêm "> ", nếu không xuống dòng sẽ thoát khỏi trích dẫn
function toQuoteBlockLines(text) {
  return `${text || ""}`.split("\n").map((line) => `> ${line}`);
}

// Tạo Markdown để xuất: lắp ghép chuỗi thuần túy, thuận tiện cho unit test chính xác và tái sử dụng sao chép/tải xuống
export function buildAnnotationsMarkdown({ title = "", annotations = [] } = {}) {
  const heading = title ? `# ${title} Chú thích` : "# Chú thích";
  const groups = groupAnnotationsByPage(annotations);
  if (groups.length === 0) {
    return `${heading}\n\n(Chưa có chú thích)\n`;
  }
  const lines = [heading, ""];
  for (const group of groups) {
    // pageIdx là chỉ mục 0-based, hiển thị cho người dùng thành số trang 1-based
      lines.push(`## Trang ${group.pageIdx + 1}`, "");
    for (const annotation of group.items) {
      lines.push(...toQuoteBlockLines(annotation?.quoteText));
      if (annotation?.translatedQuoteText) {
        // Bản dịch sát với khối trích dẫn gốc, dùng —— để đánh dấu đây là bản dịch chứ không phải tiếp tục văn bản gốc
        lines.push(...toQuoteBlockLines(`—— ${annotation.translatedQuoteText}`));
      }
        if (annotation?.note) {
          lines.push("", `Ghi chú:${annotation.note}`);
        }
      // Để trống một dòng sau mỗi chú thích, "" ở cuối cũng đảm bảo toàn bộ văn bản kết thúc bằng xuống dòng
      lines.push("");
    }
  }
  return lines.join("\n");
}

// Trích xuất neo điều hướng: trình đọc chỉ cần số trang + block id là có thể định vị trở lại văn bản gốc
export function annotationAnchor(annotation) {
  return {
    pageIdx: annotation?.pageIdx,
    blockId: annotation?.blockId,
  };
}
