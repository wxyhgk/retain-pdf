import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Kiểm tra nhất quán đăng ký Theme Studio: mỗi
// token trong studio/token-registry.mjs phải
// thực sự tồn tại trong src/styles (sau khi phát triển hợp đồng mà quên sửa đăng ký → test này báo lỗi trước,
// chứ không phải panel nền im lặng hiển thị giá trị rỗng). Đảo ngược không khóa: phía style có thể có
// biến nội bộ chưa được đăng ký trong bảng đăng ký (biến runtime như --decor-px).

import { REQUIRED_TOKENS, SELECTOR_TOKEN_MAP, TOKEN_GROUPS } from "../studio/token-registry.mjs";

const PROJECT_ROOT = process.cwd();

function allStylesText() {
  const chunks = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".css")) chunks.push(readFileSync(full, "utf8"));
    }
  };
  walk(join(PROJECT_ROOT, "src/styles"));
  return chunks.join("\n");
}

test("token trong bảng đăng ký thực sự tồn tại trong src/styles", () => {
  const css = allStylesText();
  const missing = [];
  for (const group of TOKEN_GROUPS) {
    for (const t of group.tokens) {
      if (!css.includes(`${t.name}:`)) missing.push(`${group.id}/${t.name}`);
    }
  }
  assert.deepEqual(missing, [], "Các token sau trong bảng đăng ký không tồn tại trong src/styles (trôi hợp đồng)");
});

test("Danh sách bắt buộc nhất quán với nhóm hợp đồng màu sắc, token được bảng chọn tham chiếu đều đã đăng ký", () => {
  const registered = new Set(TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.name)));
  assert.equal(REQUIRED_TOKENS.length, 20, "Bắt buộc hợp đồng màu sắc phải là 20 mục (_contract.css)");
  const unknown = [];
  for (const entry of SELECTOR_TOKEN_MAP) {
    for (const token of entry.tokens) {
      if (!registered.has(token)) unknown.push(`${entry.match} → ${token}`);
    }
  }
  assert.deepEqual(unknown, [], "Bảng giải thích chọn tham chiếu đến token chưa đăng ký");
});
