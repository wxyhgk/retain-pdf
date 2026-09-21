// 门禁：@retainpdf/domain 的公开导出里不许躺着一份 frontend/web 的过期拷贝。
//
// 为什么要有这条：包里曾经有一个 `@retainpdf/domain/library` 入口，导出的
// assembleTranslatePayload 与 web 侧 features/library/domain/documents/submit-payloads.ts
// 同名同签名，但停在 mergeTranslatePayload 引入之前。对同一个「复用 OCR 产物
// 再翻译」的输入实测：
//     web    → top=[workflow, translation, source]   has ocr: false
//     package→ top=[ocr, translation]                has ocr: true
// 包里那份丢掉了 workflow/source、又留下本该删掉的 ocr 段。照它文件头注释把
// web alias 过去，「复用 OCR 翻译」就会退化成整本重新 OCR（重烧 OCR 配额）。
// 它没有任何生产消费者，所以两年都没人发现。
//
// 这条门禁不禁止重名本身（numberOrNull 这类小工具重名是合理的），它禁止的是
// **没人审过的重名**：包和 web 同时导出一个名字时，必须在下面的表里登记，
// 要么给出一组 fixture 断言两边行为一致，要么写清为什么它们本就不是一回事。
// 没登记的新重名 = 红。

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const PROJECT_ROOT = process.cwd();
const WEB_SRC = join(PROJECT_ROOT, "src");

/** 本包所有公开入口（与 packages/domain/package.json 的 exports 一一对应）。 */
const PACKAGE_ENTRIES = [
  "@retainpdf/domain",
  "@retainpdf/domain/job",
  "@retainpdf/domain/job-status",
  "@retainpdf/domain/ai",
  "@retainpdf/domain/session",
];

/**
 * 已审阅的重名登记表。每条要么带 fixtures（断言行为一致），要么带
 * divergentBecause（说明为什么两边不是同一个函数）。
 */
const REVIEWED_DUPLICATES = {
  numberOrNull: {
    divergentBecause:
      "同名不同义：包里是通用数字解析；web/features/book-detail 那份额外拒绝负数"
      + "（产物字节数/页数没有负值），web/features/library 那份是 recent-jobs 的本地小工具。",
  },
  firstNonEmpty: {
    divergentBecause:
      "同名不同义：两侧都是三五行的字符串兜底工具，包里的服务 job/job-status 归一化，"
      + "web 那份服务 recent-jobs 卡片取值。共用它反而要把包的内部工具变成公开面。",
  },
  buildReaderPageUrl: {
    divergentBecause:
      "web 侧的两份都是 config port 的转发壳（defaultReaderDialogConfigPort / "
      + "defaultJobDetailConfigPort），真正的实现只有包里那一份；壳的存在是为了让页面"
      + "注入运行时配置，不是第二份实现。",
  },
  isReaderActionEnabled: {
    divergentBecause:
      "签名就不同：包里是 (job, manifestPayload)，自己算 actions 与 source_pdf 就绪；"
      + "web/job-detail 那份是 ({ actions, job, manifestPayload })，由调用方把已算好的 "
      + "actions 传进来。",
  },
  summarizeResumePlan: {
    divergentBecause:
      "已知的第二处分叉，尚未收敛：plan 为空时包里返回「当前任务暂不可恢复。」而 web 返回"
      + " 空串，不可恢复的兜底文案也差一个「从断点」。两份都在用，收敛前先登记在案，"
      + "别再加第三份。",
  },
};

function walkSourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walkSourceFiles(path, out);
    } else if (/\.(ts|tsx)$/.test(path) && !path.endsWith(".d.ts")) {
      out.push(path);
    }
  }
  return out;
}

const EXPORTED_FUNCTION = /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm;

async function collectDuplicates() {
  const packageExports = new Map();
  for (const entry of PACKAGE_ENTRIES) {
    const mod = await import(entry);
    for (const [name, value] of Object.entries(mod)) {
      if (typeof value !== "function") continue;
      if (!packageExports.has(name)) packageExports.set(name, new Set());
      packageExports.get(name).add(entry);
    }
  }

  const duplicates = new Map();
  for (const file of walkSourceFiles(WEB_SRC)) {
    const source = readFileSync(file, "utf8");
    for (const [, name] of source.matchAll(EXPORTED_FUNCTION)) {
      if (!packageExports.has(name)) continue;
      if (!duplicates.has(name)) duplicates.set(name, new Set());
      duplicates.get(name).add(relative(PROJECT_ROOT, file));
    }
  }
  return { packageExports, duplicates };
}

test("@retainpdf/domain 与 frontend/web 的同名导出必须逐条审阅登记", async () => {
  const { packageExports, duplicates } = await collectDuplicates();
  assert.ok(packageExports.size > 0, "包的公开入口一个函数都没导出，扫描逻辑坏了");

  const unreviewed = [...duplicates.keys()]
    .filter((name) => !(name in REVIEWED_DUPLICATES))
    .sort();

  assert.deepEqual(
    unreviewed,
    [],
    "以下名字同时被 @retainpdf/domain 和 frontend/web/src 导出，但没在 REVIEWED_DUPLICATES 登记。\n"
    + "包里的实现没有生产消费者时会静默腐化（library 那次就是这么烂掉的）。\n"
    + "请确认哪一份是唯一真相：要么删掉包里那份，要么在表里登记并说明。\n"
    + unreviewed
      .map((name) => `  ${name}: 包入口 ${[...packageExports.get(name)].join(", ")}`
        + ` | web ${[...duplicates.get(name)].join(", ")}`)
      .join("\n"),
  );

  // 表里不许留下已经不存在的登记，否则这张表会慢慢变成谎言。
  const stale = Object.keys(REVIEWED_DUPLICATES)
    .filter((name) => !duplicates.has(name))
    .sort();
  assert.deepEqual(stale, [], "REVIEWED_DUPLICATES 里这些重名已经不存在了，请删掉对应条目");

  for (const [name, entry] of Object.entries(REVIEWED_DUPLICATES)) {
    assert.equal(
      typeof entry.divergentBecause === "string" && entry.divergentBecause.trim().length > 20,
      true,
      `${name} 的登记必须写清理由`,
    );
  }
});

// 上一条只看名字。这条盯住真正烧配额的那个行为：复用 OCR 产物再翻译时，
// 组装出来的 payload 不得再带 ocr 段——无论这份逻辑将来搬到哪一层。
test("复用 OCR 的翻译 payload 只有一份实现，且不带 ocr 段", async () => {
  const { assembleTranslatePayload } = await import(
    "../../src/features/library/domain/documents/submit-payloads.js"
  );
  const baseTranslate = (pageRanges = "") => ({
    workflow: "book",
    ocr: { provider: "paddle", page_ranges: pageRanges },
    translation: { model: "deepseek" },
  });
  const reuse = assembleTranslatePayload(
    {
      workflow: "translate",
      source: { artifact_job_id: "job-ocr" },
      translation: { page_ranges: [3, 4, 5] },
    },
    baseTranslate,
  );
  assert.equal("ocr" in reuse, false, "带 ocr 段会让后端整本重新 OCR，重烧配额");
  assert.equal(reuse.workflow, "translate", "丢掉 workflow 就回落成整本流程");
  assert.deepEqual(reuse.source, { artifact_job_id: "job-ocr" }, "丢掉 source 就找不到要复用的产物");

  // 包里不许再出现第二份组装器（它没有消费者，坏了也没人发现）。
  const domain = await import("@retainpdf/domain");
  assert.equal(
    "assembleTranslatePayload" in domain,
    false,
    "@retainpdf/domain 不再拥有 assembleTranslatePayload，见 packages/domain/src/index.ts 的说明",
  );
  await assert.rejects(
    import("@retainpdf/domain/library"),
    ({ code }) => code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
    "./library 入口已删除，不要加回来",
  );
});
