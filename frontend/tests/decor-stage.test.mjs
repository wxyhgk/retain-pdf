import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Test stage planner: manifest → render plan thuần hàm (không gắn component jsdom).
// Ràng buộc then chốt: manifest.json đi kèm package phải luôn vượt kiểm định hợp đồng —
// sửa manifest hư sẽ báo đỏ ở đây trước, thay vì không render âm thầm khi chạy.

import { planStage } from "../src/shared/decor/stage-plan.js";

const PROJECT_ROOT = process.cwd();

function shippedManifest(pack) {
  return JSON.parse(readFileSync(join(PROJECT_ROOT, `decor/${pack}/manifest.json`), "utf8"));
}

test("随包发布的 jiangnan manifest 通过契约校验并产出计划", () => {
  const result = planStage(shippedManifest("jiangnan"), { assetBase: "decor/jiangnan" });
  assert.deepEqual(result.errors, []);
  assert.ok(result.ok);
  const { plan } = result;
  assert.equal(plan.layers.length, 3);
  // Đường dẫn đã ghép thêm assetBase
  assert.ok(plan.layers.every((l) => l.src.startsWith("decor/jiangnan/")));
  // band đến từ slots registry: backdrop=bg, props=mid
  assert.equal(plan.layers.find((l) => l.slot === "backdrop")?.band, "bg");
  assert.equal(plan.layers.find((l) => l.slot === "left-bottom")?.band, "mid");
  // Câu đề
  assert.equal(plan.quote?.text.includes("书藏万卷"), true);
  assert.equal(plan.quote?.writingMode, "vertical");
});

test("model 层在图片版舞台渲染 fallback 静态图", () => {
  const manifest = {
    version: 1,
    id: "demo",
    layers: [
      { type: "image", slot: "backdrop", src: "bg.webp" },
      {
        type: "model",
        slot: "hero",
        src: "girl.glb",
        fallback: "girl.webp",
        idleClip: "Breathe",
      },
    ],
  };
  const result = planStage(manifest, { assetBase: "decor/demo" });
  assert.ok(result.ok);
  const hero = result.plan.layers.find((l) => l.slot === "hero");
  assert.equal(hero.src, "decor/demo/girl.webp", "model 层应落到 fallback 图");
});

test("reduced-motion 下 parallax 全部归零", () => {
  const result = planStage(shippedManifest("jiangnan"), {
    assetBase: "decor/jiangnan",
    reducedMotion: true,
  });
  assert.ok(result.ok);
  assert.ok(result.plan.layers.every((l) => l.parallax === 0));
});

test("非法 manifest 返回错误清单而非计划", () => {
  const result = planStage({ version: 1, id: "bad", layers: [] }, { assetBase: "x" });
  assert.equal(result.ok, false);
  assert.equal(result.plan, null);
  assert.ok(result.errors.length > 0);
});

test("assetBase 尾斜杠被规整,不产生双斜杠路径", () => {
  const result = planStage(shippedManifest("jiangnan"), { assetBase: "decor/jiangnan/" });
  assert.ok(result.ok);
  assert.ok(result.plan.layers.every((l) => !l.src.includes("//")));
});

test("clickQuote 通过校验并随计划下发,非法值被拒", () => {
  const manifest = {
    version: 1,
    id: "demo",
    layers: [{ type: "image", slot: "right-bottom", src: "a.webp", clickQuote: "甲\n\n乙" }],
  };
  const result = planStage(manifest, { assetBase: "decor/demo" });
  assert.ok(result.ok);
  assert.equal(result.plan.layers[0].clickQuote, "甲\n\n乙");

  const bad = planStage(
    { version: 1, id: "demo", layers: [{ type: "image", slot: "right-bottom", src: "a.webp", clickQuote: "  " }] },
    { assetBase: "decor/demo" },
  );
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.includes("clickQuote")));
});
