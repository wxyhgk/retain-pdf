import test from "node:test";
import assert from "node:assert/strict";

// 装饰包 manifest 契约测试:schema 真值在 src/ui/decor/contract.ts,
// 这里锁住校验行为——舞台引擎和资产管线门禁都只认 validateDecorManifest,
// 校验松了/紧了都会在真实资产入库前暴露。

import {
  MAX_LAYERS,
  MAX_MODEL_LAYERS,
  validateDecorManifest,
} from "../../src/ui/decor/contract.js";
import { DECOR_SLOTS, getDecorSlot, isDecorSlotId } from "../../src/ui/decor/slots.js";

/** 概念稿"国风"主题的最小合法 manifest(文档 DECOR_PACKS.md 同款示例) */
function sampleManifest() {
  return {
    version: 1,
    id: "guofeng",
    layers: [
      { type: "image", slot: "backdrop", src: "bg.webp", parallax: 0.05 },
      { type: "image", slot: "left-bottom", src: "dragon.webp" },
      {
        type: "model",
        slot: "left-top",
        src: "girl.glb",
        fallback: "girl.webp",
        idleClip: "Breathe",
        clickClip: "TurnPage",
      },
    ],
    quote: { slot: "quote", text: "知其所来\n明其所往" },
  };
}

test("slots 注册表:id 唯一,band 合法,overUi 仅限 fg 带", () => {
  const ids = DECOR_SLOTS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "slot id 不得重复");
  for (const slot of DECOR_SLOTS) {
    assert.ok(["bg", "mid", "fg"].includes(slot.band), `${slot.id} band 非法`);
    if (slot.overUi) {
      assert.equal(slot.band, "fg", `${slot.id}: 只有 fg 带允许压 UI`);
    }
  }
  assert.ok(isDecorSlotId("backdrop"));
  assert.ok(!isDecorSlotId("made-up-slot"));
  assert.ok(getDecorSlot("quote")?.textCapable, "quote 锚点必须支持文字");
});

test("合法 manifest 通过校验并原样返回", () => {
  const result = validateDecorManifest(sampleManifest());
  assert.deepEqual(result.errors, []);
  assert.ok(result.ok);
  assert.equal(result.manifest.id, "guofeng");
  assert.equal(result.manifest.layers.length, 3);
});

test("非对象 / 错误 version / 非法包名被拒", () => {
  assert.equal(validateDecorManifest(null).ok, false);
  assert.equal(validateDecorManifest([]).ok, false);

  const badVersion = { ...sampleManifest(), version: 2 };
  const r1 = validateDecorManifest(badVersion);
  assert.equal(r1.ok, false);
  assert.ok(r1.errors.some((e) => e.includes("version")));

  const badId = { ...sampleManifest(), id: "GuoFeng_1" };
  const r2 = validateDecorManifest(badId);
  assert.equal(r2.ok, false);
  assert.ok(r2.errors.some((e) => e.includes("kebab-case")));
});

test("model 层缺 fallback 被拒(降级链是硬契约)", () => {
  const m = sampleManifest();
  delete m.layers[2].fallback;
  const result = validateDecorManifest(m);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("fallback")));
});

test("未注册 slot / slot 重复占用被拒", () => {
  const unknown = sampleManifest();
  unknown.layers[1].slot = "left-middle";
  const r1 = validateDecorManifest(unknown);
  assert.equal(r1.ok, false);
  assert.ok(r1.errors.some((e) => e.includes("不在 slots.ts 注册表")));

  const dup = sampleManifest();
  dup.layers[1].slot = "left-top"; // 与 layers[2] 撞
  const r2 = validateDecorManifest(dup);
  assert.equal(r2.ok, false);
  assert.ok(r2.errors.some((e) => e.includes("重复占用")));
});

test("backdrop 禁挂 3D;3D 图层数超上限被拒", () => {
  const bg3d = sampleManifest();
  bg3d.layers[0] = { type: "model", slot: "backdrop", src: "bg.glb", fallback: "bg.webp" };
  const r1 = validateDecorManifest(bg3d);
  assert.equal(r1.ok, false);
  assert.ok(r1.errors.some((e) => e.includes("背景 slot 禁止挂 3D")));

  const slots = ["left-top", "left-bottom", "right-top", "right-bottom"];
  const many = {
    version: 1,
    id: "overload",
    layers: slots.map((slot, i) => ({
      type: "model",
      slot,
      src: `m${i}.glb`,
      fallback: `m${i}.webp`,
    })),
  };
  assert.ok(slots.length > MAX_MODEL_LAYERS, "测试前提:超过模型上限");
  const r2 = validateDecorManifest(many);
  assert.equal(r2.ok, false);
  assert.ok(r2.errors.some((e) => e.includes("3D 图层")));
});

test("路径逃逸 / 协议 / 错误扩展名被拒", () => {
  const cases = [
    { patch: { src: "../secret.webp" }, hint: "相对路径" },
    { patch: { src: "/abs/path.webp" }, hint: "相对路径" },
    { patch: { src: "https://cdn.evil/x.webp" }, hint: "相对路径" },
    { patch: { src: "photo.jpeg" }, hint: "webp/png/svg/avif" },
  ];
  for (const { patch, hint } of cases) {
    const m = sampleManifest();
    Object.assign(m.layers[1], patch);
    const result = validateDecorManifest(m);
    assert.equal(result.ok, false, `应拒绝 ${JSON.stringify(patch)}`);
    assert.ok(
      result.errors.some((e) => e.includes(hint)),
      `错误信息应包含 "${hint}",实际:${result.errors.join(" | ")}`,
    );
  }

  const badModel = sampleManifest();
  badModel.layers[2].src = "girl.fbx";
  const r = validateDecorManifest(badModel);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes(".glb")));
});

test("parallax / opacity 越界被拒", () => {
  const badParallax = sampleManifest();
  badParallax.layers[0].parallax = 0.5;
  assert.equal(validateDecorManifest(badParallax).ok, false);

  const badOpacity = sampleManifest();
  badOpacity.layers[1].opacity = 0;
  assert.equal(validateDecorManifest(badOpacity).ok, false);
});

test("quote 只能挂 textCapable 锚点", () => {
  const m = sampleManifest();
  m.quote.slot = "hero";
  const result = validateDecorManifest(m);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("textCapable")));
});

test("图层总数超上限被拒", () => {
  // slot 唯一性限制下无法真凑出 >MAX_LAYERS 个合法层,
  // 直接用重复 slot 的超长数组——应同时报"数量超限"。
  const m = {
    version: 1,
    id: "toomany",
    layers: Array.from({ length: MAX_LAYERS + 1 }, () => ({
      type: "image",
      slot: "hero",
      src: "x.webp",
    })),
  };
  const result = validateDecorManifest(m);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("超过上限")));
});
