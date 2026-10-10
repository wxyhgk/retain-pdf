// 渲染字体：只有思源宋体能用新排版引擎，选别的字体要提醒会退回 Typst。
import test from "node:test";
import assert from "node:assert/strict";
import { usesRprEngine } from "../../src/features/settings/ui/ThemeAppearancePanel.jsx";

test("思源宋体（含 Noto 同款）走新引擎，其它字体会退回 Typst", () => {
  assert.equal(usesRprEngine("Source Han Serif SC"), true);
  assert.equal(usesRprEngine(" noto serif cjk sc "), true);
  assert.equal(usesRprEngine("LXGW WenKai"), false);
  assert.equal(usesRprEngine(""), false);
});
