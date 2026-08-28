import test from "node:test";
import assert from "node:assert/strict";

// Kiểm thử hợp đồng manifest gói trang trí: schema thực trong src/shared/decor/contract.ts,
// ở đây khóa hành vi xác thực — cả cổng động cơ sân khấu và đường ống tài sản đều chỉ công nhận validateDecorManifest,
// việc xác thực lỏng/chặt sẽ lộ ra trước khi tài sản thực được nhập kho.

import {
  MAX_LAYERS,
  MAX_MODEL_LAYERS,
  validateDecorManifest,
} from "../src/shared/decor/contract.js";
import { DECOR_SLOTS, getDecorSlot, isDecorSlotId } from "../src/shared/decor/slots.js";

/** Manifest hợp lệ tối thiểu của chủ đề "Guofeng" (bản nháp ý tưởng, ví dụ tương tự trong tài liệu DECOR_PACKS.md) */
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
    quote: { slot: "quote", text: "Biết mình từ đâu đến\nHiểu mình đi về đâu" },
  };
}

test("Bảng đăng ký slots: id duy nhất, band hợp lệ, overUi chỉ dành cho band fg", () => {
  const ids = DECOR_SLOTS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "id slot không được trùng lặp");
  for (const slot of DECOR_SLOTS) {
    assert.ok(["bg", "mid", "fg"].includes(slot.band), `${slot.id} band không hợp lệ`);
    if (slot.overUi) {
      assert.equal(slot.band, "fg", `${slot.id}: chỉ band fg mới được phép đè lên UI`);
    }
  }
  assert.ok(isDecorSlotId("backdrop"));
  assert.ok(!isDecorSlotId("made-up-slot"));
  assert.ok(getDecorSlot("quote")?.textCapable, "điểm neo quote phải hỗ trợ văn bản");
});

test("Manifest hợp lệ vượt qua xác thực và trả về nguyên bản", () => {
  const result = validateDecorManifest(sampleManifest());
  assert.deepEqual(result.errors, []);
  assert.ok(result.ok);
  assert.equal(result.manifest.id, "guofeng");
  assert.equal(result.manifest.layers.length, 3);
});

test("Không phải object / version sai / tên gói không hợp lệ bị từ chối", () => {
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

test("Layer model thiếu fallback bị từ chối (chuỗi giảm cấp là hợp đồng cứng)", () => {
  const m = sampleManifest();
  delete m.layers[2].fallback;
  const result = validateDecorManifest(m);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("fallback")));
});

test("Slot chưa đăng ký / slot chiếm dụng trùng lặp bị từ chối", () => {
  const unknown = sampleManifest();
  unknown.layers[1].slot = "left-middle";
  const r1 = validateDecorManifest(unknown);
  assert.equal(r1.ok, false);
  assert.ok(r1.errors.some((e) => e.includes("không có trong bảng đăng ký slots.ts")));

  const dup = sampleManifest();
  dup.layers[1].slot = "left-top"; // trùng với layers[2]
  const r2 = validateDecorManifest(dup);
  assert.equal(r2.ok, false);
  assert.ok(r2.errors.some((e) => e.includes("chiếm dụng trùng lặp")));
});

test("Backdrop cấm treo 3D; số layer 3D vượt quá giới hạn bị từ chối", () => {
  const bg3d = sampleManifest();
  bg3d.layers[0] = { type: "model", slot: "backdrop", src: "bg.glb", fallback: "bg.webp" };
  const r1 = validateDecorManifest(bg3d);
  assert.equal(r1.ok, false);
  assert.ok(r1.errors.some((e) => e.includes("slot nền cấm treo 3D")));

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
  assert.ok(slots.length > MAX_MODEL_LAYERS, "tiền đề kiểm thử: vượt quá giới hạn model");
  const r2 = validateDecorManifest(many);
  assert.equal(r2.ok, false);
  assert.ok(r2.errors.some((e) => e.includes("3D layer")));
});

test("Đường dẫn thoát / giao thức / phần mở rộng sai bị từ chối", () => {
  const cases = [
    { patch: { src: "../secret.webp" }, hint: "đường dẫn tương đối" },
    { patch: { src: "/abs/path.webp" }, hint: "đường dẫn tương đối" },
    { patch: { src: "https://cdn.evil/x.webp" }, hint: "đường dẫn tương đối" },
    { patch: { src: "photo.jpeg" }, hint: "webp/png/svg/avif" },
  ];
  for (const { patch, hint } of cases) {
    const m = sampleManifest();
    Object.assign(m.layers[1], patch);
    const result = validateDecorManifest(m);
    assert.equal(result.ok, false, `nên từ chối ${JSON.stringify(patch)}`);
    assert.ok(
      result.errors.some((e) => e.includes(hint)),
      `Thông báo lỗi nên chứa "${hint}", thực tế: ${result.errors.join(" | ")}`,
    );
  }

  const badModel = sampleManifest();
  badModel.layers[2].src = "girl.fbx";
  const r = validateDecorManifest(badModel);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes(".glb")));
});

test("Parallax / opacity vượt quá giới hạn bị từ chối", () => {
  const badParallax = sampleManifest();
  badParallax.layers[0].parallax = 0.5;
  assert.equal(validateDecorManifest(badParallax).ok, false);

  const badOpacity = sampleManifest();
  badOpacity.layers[1].opacity = 0;
  assert.equal(validateDecorManifest(badOpacity).ok, false);
});

test("Quote chỉ có thể gắn vào điểm neo textCapable", () => {
  const m = sampleManifest();
  m.quote.slot = "hero";
  const result = validateDecorManifest(m);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("textCapable")));
});

test("Tổng số layer vượt quá giới hạn bị từ chối", () => {
  // Dưới giới hạn tính duy nhất của slot, không thể thực sự tạo ra >MAX_LAYERS layer hợp lệ,
  // dùng trực tiếp mảng siêu dài với slot trùng lặp — cũng nên báo "vượt quá số lượng".
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
  assert.ok(result.errors.some((e) => e.includes("vượt quá giới hạn")));
});
