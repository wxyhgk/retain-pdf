import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import postcss from "postcss";

const outputPaths = (process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["dist/styles.css"]
).map((value) => resolve(value));

for (const outputPath of outputPaths) {
  const source = await readFile(outputPath, "utf8");
  const root = postcss.parse(source, { from: outputPath });
  for (;;) {
    const layers = [];
    root.walkAtRules("layer", (atRule) => layers.push(atRule));
    if (layers.length === 0) break;
    for (const atRule of layers) {
      if (atRule.parent == null) continue;
      if (atRule.nodes?.length) {
        atRule.replaceWith(...atRule.nodes);
      } else {
        atRule.remove();
      }
    }
  }
  await writeFile(outputPath, root.toString());
}
