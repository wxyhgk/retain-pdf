// 对照时两栏横向一起滚：按可滚距离的比例对齐（两边页宽可能差一点）。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { syncedScrollLeft } from "../../../../frontend/packages/reader/src/hooks/use-pane-horizontal-sync.ts";

test("按比例对齐：滚到一半另一栏也在一半，两头对两头", () => {
  const target = { scrollLeft: 0, scrollWidth: 1043, clientWidth: 700 };
  assert.equal(syncedScrollLeft({ scrollLeft: 171, scrollWidth: 1042, clientWidth: 700 }, target), 171.5);
  assert.equal(syncedScrollLeft({ scrollLeft: 0, scrollWidth: 1042, clientWidth: 700 }, target), 0);
  assert.equal(syncedScrollLeft({ scrollLeft: 342, scrollWidth: 1042, clientWidth: 700 }, target), 343);
});

test("源栏不能横滚时不动目标栏；目标栏不能横滚时归零", () => {
  assert.equal(syncedScrollLeft({ scrollLeft: 0, scrollWidth: 700, clientWidth: 700 }, { scrollLeft: 50, scrollWidth: 900, clientWidth: 700 }), null);
  assert.equal(syncedScrollLeft({ scrollLeft: 100, scrollWidth: 900, clientWidth: 700 }, { scrollLeft: 0, scrollWidth: 700, clientWidth: 700 }), 0);
});

test("接线：对照网格在对照模式下开同步；缩放锚点不再自己挪另一栏", () => {
  const read = (p) => readFileSync(new URL(`../../../../frontend/packages/reader/src/${p}`, import.meta.url), "utf8");
  assert.match(read("components/react-pdf/ReaderCompareGrid.tsx"), /usePaneHorizontalSync\(shellEl, presentation\.compareMode\)/);
  const hook = read("hooks/use-pane-horizontal-sync.ts");
  assert.match(hook, /capture: true/);
  assert.match(hook, /moved\.add\(target\)/, "自己挪的那一下要跳过，不然来回拉");
  assert.doesNotMatch(read("pdf/reader-wheel-zoom.ts"), /other\.scrollLeft \+= dx/);
});
