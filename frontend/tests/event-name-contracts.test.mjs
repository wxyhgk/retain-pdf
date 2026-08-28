import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Tên sự kiện / tên lệnh là hợp đồng chuỗi — lỗi chính tả chỉ âm thầm mất hiệu lực khi chạy.
// Hiện trạng: các sự kiện retainpdf:* đã được gom hết vào APP_EVENTS trong contracts/app-contract.js,
// hai đầu bus lệnh đều dùng hằng số RECENT_JOBS_COMMANDS. Bộ test này khóa trạng thái đó,
// cấm xuất hiện bare literal vượt qua hợp đồng trong tương lai.
// Quét bao phủ .js và .jsx (cả src/pages, src/shared mới từ quá trình React migration).

const PROJECT_ROOT = process.cwd();
const JS_ROOT = join(PROJECT_ROOT, "src/js");
const SCAN_ROOTS = [JS_ROOT, join(PROJECT_ROOT, "src/pages"), join(PROJECT_ROOT, "src/shared")];
const EVENT_CONTRACT_FILE = join(JS_ROOT, "contracts/app-contract.js");
// generated/ là sản phẩm build (literal tên sự kiện inline đến từ mã nguồn, được guard bằng quét mã nguồn)
const GENERATED_ROOT = join(JS_ROOT, "generated");

// Chuỗi tiền tố retainpdf: không dùng cho sự kiện (ví dụ localStorage key), đăng ký từng mục
const ALLOWED_LITERALS = [
  { file: join(JS_ROOT, "features/app-update/state.js"), literal: "retainpdf:update-check:v1" },
];

function walkJsFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (fullPath === GENERATED_ROOT) {
      continue;
    }
    if (statSync(fullPath).isDirectory()) {
      results.push(...walkJsFiles(fullPath));
    } else if (entry.endsWith(".js") || entry.endsWith(".jsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

const jsFiles = SCAN_ROOTS.filter((root) => existsSync(root)).flatMap(walkJsFiles);

test("retainpdf:* 事件名只允许定义在 contracts/app-contract.js", () => {
  const violations = [];
  for (const file of jsFiles) {
    if (file === EVENT_CONTRACT_FILE) {
      continue;
    }
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/["'](retainpdf:[^"']+)["']/g)) {
      const allowed = ALLOWED_LITERALS.some(
        (entry) => entry.file === file && entry.literal === match[1],
      );
      if (!allowed) {
        violations.push(`${relative(PROJECT_ROOT, file)}: "${match[1]}"`);
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `发现契约外的 retainpdf:* 字面量,请改用 APP_EVENTS 常量:\n  ${violations.join("\n  ")}`,
  );
});

test("命令总线与 CustomEvent 不允许裸字符串事件名", () => {
  const patterns = [
    [/\.dispatch\(\s*["']/, ".dispatch(\"...\")"],
    [/\.on\(\s*["']/, ".on(\"...\")"],
    [/dispatchEvent\(\s*new\s+CustomEvent\(\s*["']/, "dispatchEvent(new CustomEvent(\"...\"))"],
    [/addEventListener\(\s*["']retainpdf/, "addEventListener(\"retainpdf...\")"],
  ];
  const violations = [];
  for (const file of jsFiles) {
    const text = readFileSync(file, "utf8");
    for (const [pattern, label] of patterns) {
      if (pattern.test(text)) {
        violations.push(`${relative(PROJECT_ROOT, file)}: ${label}`);
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `发现裸字符串事件/命令名,请引用契约常量:\n  ${violations.join("\n  ")}`,
  );
});
