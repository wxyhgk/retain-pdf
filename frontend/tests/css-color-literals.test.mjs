import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Cổng bánh cóc giá trị màu chữ CSS.
//
// Trạng thái mục tiêu: trong src/styles, ngoại trừ themes/(giá trị thực của giao diện), không xuất hiện bất kỳ giá trị màu chữ nào
// (hex / rgb / rgba / hsl), tất cả đều dùng biến ngữ nghĩa var(--ink|--paper|--surface|
// --shadow-color|…) hoặc color-mix dẫn xuất — nếu không, các màu này sẽ không theo đổi giao diện
// (chủ đề night từng bị hỏng một nửa vì điều này).
//
// Hiện tại còn hàng trăm chỗ, không thể dọn sạch một lần. Kiểm thử này đóng vai trò "bánh cóc":
// - Số lượng giá trị màu chữ trong mỗi tệp chỉ được ≤ baseline, thêm mới là thất bại;
// - Sau khi thu gọn, chạy UPDATE_CSS_COLOR_BASELINE=1 npm test để siết bánh cóc
//   (baseline chỉ giảm không tăng, phần giảm sẽ được cố định).
// baseline: tests/helpers/css-color-literals-baseline.json

const PROJECT_ROOT = process.cwd();
const STYLES_ROOT = join(PROJECT_ROOT, "src/styles");
const THEMES_ROOT = join(PROJECT_ROOT, "src/styles/themes");
const BASELINE_PATH = join(PROJECT_ROOT, "tests/helpers/css-color-literals-baseline.json");

// Hàm hex / rgb(a) / hsl(a). Các số trong tên biến CSS không chứa #, sẽ không bị trúng nhầm.
const COLOR_LITERAL_RE = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;

function walkCss(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (full === THEMES_ROOT) continue; // giá trị thực của giao diện, nơi duy nhất cho phép màu chữ
      walkCss(full, out);
    } else if (name.endsWith(".css")) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function countLiterals(file) {
  const css = stripComments(readFileSync(file, "utf8"));
  return (css.match(COLOR_LITERAL_RE) || []).length;
}

function currentCounts() {
  const counts = {};
  for (const file of walkCss(STYLES_ROOT).sort()) {
    const n = countLiterals(file);
    if (n > 0) counts[relative(PROJECT_ROOT, file)] = n;
  }
  return counts;
}

test("Giá trị màu chữ CSS chỉ giảm không tăng (bánh cóc, ngo��i trừ tệp giao diện)", () => {
  const counts = currentCounts();

  if (process.env.UPDATE_CSS_COLOR_BASELINE === "1") {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(counts, null, 2)}\n`);
    return; // sau khi siết bánh cóc, vòng này qua trực tiếp
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const regressions = [];
  for (const [file, n] of Object.entries(counts)) {
    const allowed = baseline[file] ?? 0; // tệp mới phải không có màu chữ
    if (n > allowed) {
      regressions.push(`${file}: ${n} 处(棘轮上限 ${allowed})`);
    }
  }

  assert.deepEqual(
    regressions,
    [],
     `Các tệp sau đây đã thêm giá trị màu chữ, vui lòng chuyển sang biến ngữ nghĩa (var(--ink|--paper|--surface|--shadow-color|…) hoặc color-mix):\n  ${regressions.join("\n  ")}\nSau khi thu gọn, chạy UPDATE_CSS_COLOR_BASELINE=1 npm test để siết bánh cóc.`,
  );
});

test("Baseline bánh cóc không bị thổi phồng (các tệp đã thu gọn phải được siết chặt)", () => {
  if (process.env.UPDATE_CSS_COLOR_BASELINE === "1") return;
  const counts = currentCounts();
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const stale = [];
  for (const [file, allowed] of Object.entries(baseline)) {
    const n = counts[file] ?? 0;
    if (n < allowed) stale.push(`${file}: 实际 ${n} < baseline ${allowed}`);
  }
  assert.deepEqual(
    stale,
    [],
     `Thành quả thu gọn chưa được cố định, chạy UPDATE_CSS_COLOR_BASELINE=1 npm test để siết bánh cóc:\n  ${stale.join("\n  ")}`,
  );
});
