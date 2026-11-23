/** 使用说明书按模块一页（docs/guide/<模块>.md，方案见 docs/ops/planning/user-guide/）。
 *
 * 钉住三件事，免得加了模块忘了写说明、或者说明页和代码对不上：
 * 1. features/ 下每个模块都有自己的说明页；写在别的模块页里的，在下面 COVERED_ELSEWHERE 登记写在哪。
 * 2. 设置分区登记的 guide（标题旁「?」链到的那页）都有对应的说明页；功能自己登记的分区，guide 就是它所在的模块名。
 * 3. 说明书里每个模块页都对得上一个模块，不留没人认领的页。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const FEATURES = join(WEB_ROOT, "src/features");
const GUIDE = join(WEB_ROOT, "../../docs/guide");

/** 没有自己说明页的模块：值是写在哪个模块页里；null = 只有已停的多用户版才用，不写说明。 */
const COVERED_ELSEWHERE = {
  admin: null,
  auth: null,
  artifacts: "book-detail",
  "editorial-room": "book-detail",
  jobs: "book-detail",
  "job-detail": "book-detail",
};

/** 说明书里不对应模块的页。 */
const NON_MODULE_PAGES = ["README", "install"];

const features = readdirSync(FEATURES, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
const guidePage = (name) => join(GUIDE, `${name}.md`);

test("features/ 下每个模块都有说明页，或者登记了写在哪", () => {
  const missing = features.filter((name) => !existsSync(guidePage(name)) && !(name in COVERED_ELSEWHERE));
  assert.deepEqual(missing, [], `这些模块没有说明页：写 docs/guide/<模块>.md，并加进 docs/guide/README.md 的目录`);
  for (const [name, target] of Object.entries(COVERED_ELSEWHERE)) {
    assert.ok(features.includes(name), `COVERED_ELSEWHERE 里的 ${name} 已经不是模块了，删掉这一项`);
    assert.equal(existsSync(guidePage(name)), false, `${name} 已经有自己的说明页了，从 COVERED_ELSEWHERE 删掉`);
    if (target) assert.ok(existsSync(guidePage(target)), `${name} 登记写在 ${target}.md，但没有这一页`);
  }
});

test("设置分区的 guide 都有说明页；功能自己的分区写的是自己的模块名", () => {
  const sources = [join(WEB_ROOT, "src/app/home/shell/settings-sections.tsx")];
  for (const name of features) {
    const file = join(FEATURES, name, "ui/settings-section.tsx");
    if (!existsSync(file)) continue;
    sources.push(file);
    const guides = [...readFileSync(file, "utf8").matchAll(/\bguide:\s*"([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(guides, [name], `${name}/ui/settings-section.tsx 的 guide 应该是 "${name}"`);
  }
  const all = sources.flatMap((file) => [...readFileSync(file, "utf8").matchAll(/\bguide:\s*"([^"]+)"/g)].map((match) => match[1]));
  assert.ok(all.length >= 9, `只找到 ${all.length} 个 guide，设置分区的写法变了？`);
  const missing = all.filter((name) => !existsSync(guidePage(name)));
  assert.deepEqual(missing, [], "这些 guide 没有对应的 docs/guide/<模块>.md");
});

test("说明书的每个模块页都对得上一个模块，目录里都列了", () => {
  const pages = readdirSync(GUIDE).filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -3));
  const orphans = pages.filter((name) => !NON_MODULE_PAGES.includes(name) && !features.includes(name));
  assert.deepEqual(orphans, [], "这些说明页没有对应的 features/<模块>，改名或删掉");
  const index = readFileSync(guidePage("README"), "utf8");
  const unlisted = pages.filter((name) => name !== "README" && !index.includes(`(${name}.md)`));
  assert.deepEqual(unlisted, [], "这些说明页没列进 docs/guide/README.md");
});
