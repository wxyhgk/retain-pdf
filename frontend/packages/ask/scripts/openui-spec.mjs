// 生成提问窗互动块（OpenUI Lang）的分层说明，给后端教 agent 用（方案：docs/ops/planning/reader-ask/20261126-互动块分层提示词.md）。
//
// 出两份，放在 contracts/openui/（前后端共用，前端生成、后端读）：
// - ask-openui-prompt.v1.json：L0 能力声明（intro，每个会话都带）+ 分层的说明（sections，agent 用 openui_spec 按 id 取）。
// - ask-openui-library.v1.json：组件库的 JSON 规格（library.toJSONSchema()），后端的 openui_check 交给 @openuidev/lang-core 的 createParser 校验程序。
//
// 来源是前端画互动块用的同一个组件库（src/openui/library.ts：Intelligent UI 组件库去掉 Image、YouTube），所以前端能画什么、后端教什么一致。
// 用法：npm run generate:openui --workspace @retainpdf/ask。测试会重新算一遍和提交的比（frontend/web/tests/ask/ask-openui.test.mjs）。
//
// OpenUI 的 lang-core 在 Node 里有抽样遥测（默认关，要设 OPENUI_RUNTIME_TELEMETRY_ENABLED=1 才发）；这里再显式关一次。
process.env.OPENUI_TELEMETRY_DISABLED = "1";
process.env.DO_NOT_TRACK = "1";

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// 和 src/openui/library.ts 的 OPENUI_REMOVED_COMPONENTS 一致（测试钉着）。
export const REMOVED = ["Image", "YouTube"];
export const FENCE = "openui-lang";

const CONTRACTS = new URL("../../../../contracts/openui/", import.meta.url);
export const PROMPT_FILE = fileURLToPath(new URL("ask-openui-prompt.v1.json", CONTRACTS));
export const LIBRARY_FILE = fileURLToPath(new URL("ask-openui-library.v1.json", CONTRACTS));

/** 组件库的函数按类分（库里就是按这个顺序排的；升级多了函数会在这里报错，归一下类再生成）。 */
const FUNCTION_GROUPS = {
  lists: ["Append", "Prepend", "Concat", "Remove", "RemoveAt", "Update", "Toggle", "Includes", "Find", "IndexOf", "Take", "Slice", "Unique", "Reverse", "Range", "Pick", "Shuffle", "Flatten", "Chunk"],
  numbers: ["Pow", "Sqrt", "Random", "Clamp", "Percent", "Lerp", "Allocate", "Payment", "Convert"],
  text: ["Format", "Join", "Plural", "Pad", "Upper", "Lower", "Trim", "Capitalize", "Split", "Replace", "Duration", "Default", "MixColor"],
  dates: ["Now", "Today", "FormatDate", "AddDays", "AddMonths", "DaysBetween", "MonthsBetween", "StartOf"],
  data: ["GroupBy", "Pivot", "Top", "Between", "Bucket", "Cumulative", "MovingAvg", "Change", "Histogram", "Stats"],
};

/** 组件组的段名（短、没空格，模型调 openui_spec 时好写）。 */
const GROUP_IDS = { Layout: "layout", Text: "text", Inputs: "inputs", "Media and data": "data", Play: "play", Drawing: "drawing" };

const GROUP_SUMMARY = {
  Layout: "布局：Col、Row、Box、Grid、Card、Carousel、Popover……",
  Text: "文字：Title、Text、List、Markdown、Quote、Code、Math（公式）……",
  Inputs: "输入：Button、Slider、Select、Checkbox、Input、Form、Timer……（配 $变量 做能动手的小工具）",
  "Media and data": "数据：Icon、Table、Chart（柱、线、面积、饼、散点）",
  Play: "学习和游戏：Flashcard（闪卡）、Celebration",
  Drawing: "画图：Svg 及 Circle、Rect、Line、Path、Polygon、SvgText……；HtmlView（沙盒里的小网页，只给动画、游戏）",
};

const FUNCTION_SUMMARY = {
  builtin: "内置：@Count、@Sum、@Each、@Set、@Filter、@Round……（几乎都要用）",
  lists: "列表：@Append、@Remove、@Toggle、@Includes、@Range、@Chunk……",
  numbers: "数字：@Pow、@Sqrt、@Clamp、@Percent、@Lerp、@Convert……",
  text: "文字和颜色：@Format、@Join、@Plural、@Split、@Replace、@Duration、@MixColor……",
  dates: "日期：@Today、@FormatDate、@AddDays、@DaysBetween……",
  data: "数据：@GroupBy、@Pivot、@Top、@Bucket、@Cumulative、@Stats……",
};

/** 我们补的规则：读书场景、中文、不要外网。 */
const OUR_RULES = [
  "Interactive blocks are optional: most questions about a book need plain Markdown. Add a block only when interaction shows the idea better than text, and keep it focused on the passage being discussed.",
  "Write every user-facing string inside the block in Simplified Chinese, unless the user writes in another language.",
  "Do not use image URLs or videos: the reader may be offline. Draw with Svg instead. Use HtmlView only for an animation or game that Svg cannot do.",
  "An @ToAssistant message becomes the user's next question: write it as a short first-person sentence in Chinese.",
  "Strings inside the block are not LaTeX: never write $...$ in Text, Title, Flashcard or any other string. Put every formula in Math(tex), or Math(tex, true) inside a Text list for an inline formula.",
];

function keepRule(rule) {
  return !/^Use Image only|^A photo beside text/.test(rule);
}

function stripImage(rule) {
  return rule.replace(/ and the same Image aspect ratio/g, "");
}

const estimateTokens = (text) => Math.ceil(text.length / 4);

/** 生成的整份说明按标题切开。 */
function splitHeadings(text) {
  const parts = {};
  for (const block of text.split(/\n(?=#{2,3} )/)) {
    const title = block.split("\n")[0].replace(/^#+\s*/, "").trim();
    parts[title] = block.trim();
  }
  return parts;
}

function intro(sections) {
  const catalog = sections.map((section) => `- \`${section.id}\`：${section.summary}（约 ${section.tokens} token）`).join("\n");
  return `## 互动块

回答照常用简体中文 Markdown。讲公式、数据、步骤、参数变化、要记住的要点时，如果一个能动手的小界面比文字更清楚（拖滑块看结果怎么变、闪卡、对比表、图表、示意图、分步演示），可以在回答里插一个互动块：用 \`\`\`${FENCE} 代码块包住一段 OpenUI Lang 程序，阅读页会把它画成能操作的界面。不需要就别写；一个回答最多一两个互动块。

写之前先用 openui_spec 取说明（一次取齐要用的几段，取过的不用再取）：第一次一定要取 \`core\`，再按要用的组件和函数取对应的段。写完先用 openui_check 检查，有错改完再放进回答。

互动块里的字符串不认 \`$…$\`，下划线还会被当成斜体：公式（包括带下标、上标的符号）一律用 \`Math("…")\` 组件（行内用 \`Math("…", true)\` 放进 Text 的列表里）。没取过说明、没检查过的互动块不要写。

可取的段：
${catalog}`;
}

export async function buildOpenUISpec() {
  const require = createRequire(import.meta.url);
  // 包的 exports 不给 package.json：从入口文件往上找它自己的 package.json。
  const versionOf = (name) => {
    let dir = dirname(require.resolve(name));
    while (dir !== dirname(dir)) {
      const file = join(dir, "package.json");
      if (existsSync(file)) {
        const pkg = JSON.parse(readFileSync(file, "utf8"));
        if (pkg.name === name) return pkg.version;
      }
      dir = dirname(dir);
    }
    throw new Error(`找不到 ${name} 的 package.json`);
  };
  const { library, promptOptions } = await import("@openuidev/intelligent-ui-library");
  const askLibrary = library.extend({ components: { remove: REMOVED } });

  const full = askLibrary.prompt({ ...promptOptions, preamble: "", additionalRules: [], examples: [] });
  const parts = splitHeadings(full);
  const take = (title) => {
    if (!parts[title]) throw new Error(`OpenUI 说明里没有「${title}」这一节：库升级了，改 scripts/openui-spec.mjs 的切法`);
    return parts[title];
  };

  const sections = [];
  const add = (id, summary, text) => sections.push({ id, summary, tokens: estimateTokens(text), text });

  // core：语法、组件签名的读法、动作、流式顺序、最后检查。
  add("core", "语法、动作（按钮做什么）、书写顺序、写完的检查清单——第一次写一定要取",
    [take("Syntax Rules"), take("Component Signatures"), take("Action — Button Behavior"), take("Hoisting & Streaming (CRITICAL)"), take("Important Rules"), take("Final Verification")].join("\n\n"));

  // 组件：按组。
  for (const group of askLibrary.componentGroups) {
    if (!group.components.length) continue;
    add(`components:${GROUP_IDS[group.name] || group.name.toLowerCase().replace(/[^a-z]+/g, "-")}`, GROUP_SUMMARY[group.name] || group.components.join("、"), take(group.name));
  }
  const grouped = new Set(askLibrary.componentGroups.flatMap((group) => group.components));
  const loose = Object.keys(askLibrary.components).filter((name) => !grouped.has(name) && name !== askLibrary.root);
  if (loose.length) throw new Error(`这些组件不在任何组里：${loose.join("、")}`);

  // 函数：内置的（不在组件库里的 @ 函数和说明文字）一段，组件库的按类分段。
  const libraryFunctions = Object.keys(askLibrary.functions || {});
  const named = new Set(Object.values(FUNCTION_GROUPS).flat());
  const unknown = libraryFunctions.filter((name) => !named.has(name));
  if (unknown.length) throw new Error(`这些函数没归类：${unknown.join("、")}（改 FUNCTION_GROUPS）`);
  const byGroup = Object.fromEntries(Object.keys(FUNCTION_GROUPS).map((key) => [key, []]));
  const builtin = [];
  for (const line of take("Built-in Functions").split("\n")) {
    const name = /^@([A-Za-z]+)\(/.exec(line)?.[1];
    const group = name ? Object.keys(FUNCTION_GROUPS).find((key) => FUNCTION_GROUPS[key].includes(name)) : null;
    (group ? byGroup[group] : builtin).push(line);
  }
  add("functions:builtin", FUNCTION_SUMMARY.builtin, builtin.join("\n").trim());
  for (const [key, lines] of Object.entries(byGroup)) {
    if (lines.length) add(`functions:${key}`, FUNCTION_SUMMARY[key], `## Functions: ${key}\n\n${lines.join("\n")}`);
  }

  // 风格规则（组件库的，去掉讲图片的，加我们的）和示例。
  const rules = [...promptOptions.additionalRules.filter(keepRule).map(stripImage), ...OUR_RULES];
  add("rules", "怎么排得好看、什么时候用哪种组件（风格规则）", `## Style rules\n\n${rules.map((rule) => `- ${rule}`).join("\n")}`);
  promptOptions.examples.forEach((example, index) => {
    const head = example.split("\n")[0].replace(/^Example \d+:\s*/, "").replace(/:$/, "");
    add(`examples:${index + 1}`, `完整示例：${head}`, `## Example ${index + 1}\n\n${example}`);
  });

  const prompt = {
    version: 1,
    generator: "frontend/packages/ask/scripts/openui-spec.mjs",
    sources: {
      "@openuidev/intelligent-ui-library": versionOf("@openuidev/intelligent-ui-library"),
      "@openuidev/lang-core": versionOf("@openuidev/lang-core"),
    },
    fence: FENCE,
    root: askLibrary.root,
    removed_components: REMOVED,
    intro: intro(sections),
    intro_tokens: 0,
    sections,
  };
  prompt.intro_tokens = estimateTokens(prompt.intro);
  const librarySchema = { version: 1, generator: prompt.generator, root: askLibrary.root, schema: askLibrary.toJSONSchema() };
  return { prompt, library: librarySchema };
}

export const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { prompt, library } = await buildOpenUISpec();
  writeFileSync(PROMPT_FILE, serialize(prompt));
  writeFileSync(LIBRARY_FILE, serialize(library));
  const total = prompt.sections.reduce((sum, section) => sum + section.tokens, 0);
  console.log(`[openui-spec] intro 约 ${prompt.intro_tokens} token，${prompt.sections.length} 段共约 ${total} token → ${PROMPT_FILE}`);
}
