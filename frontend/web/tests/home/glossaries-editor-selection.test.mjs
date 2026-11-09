/** 编辑词条字段不该把批量勾选清掉。
 *
 * 事故（PR #153 评审）：GlossaryEditor 原来写的是 useEffect(..., [entries]) 清勾选，
 * 而 store 的 updateEntryField 每次都 map 出新数组，于是每敲一个字「已选 N 条」就归零，
 * 勾好的行全丢。现在只有行结构（整表替换/增删行）变化才清：靠 structureRevision 判断。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { makeDom, click } from "../helpers/dom.mjs";
import { waitFor } from "../helpers/async.mjs";

const ROW = (source, target) => ({ source, target, note: "", level: "preferred", match_mode: "exact", context: "" });

test("改字段保留勾选，增删行才清空", async () => {
  const dom = makeDom("", { html: "<!doctype html><html><body><div id='root'></div></body></html>" });
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { GlossaryEditor } = await import("../../src/features/glossaries/ui/GlossaryEditor.jsx");
  const doc = dom.window.document;

  let api = null;
  function Harness() {
    const [state, setState] = React.useState({
      entries: [ROW("cat", "猫"), ROW("dog", "狗")],
      structureRevision: 0,
    });
    api = {
      // 与 glossaries-store.updateEntryField 一致：只换被改那一行的对象，结构版本不动。
      editField: (index, field, value) => setState((prev) => ({
        ...prev,
        entries: prev.entries.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
      })),
      // 与 removeEntryRow 一致：行号会移位，结构版本 +1。
      removeEntryRow: (index) => setState((prev) => ({
        ...prev,
        entries: prev.entries.filter((_row, i) => i !== index),
        structureRevision: prev.structureRevision + 1,
      })),
    };
    return React.createElement(GlossaryEditor, {
      entries: state.entries,
      structureRevision: state.structureRevision,
      onFieldChange: () => {},
      onRemoveRow: () => {},
    });
  }

  const root = createRoot(doc.getElementById("root"));
  const box = (label) => doc.querySelector(`input[aria-label="${label}"]`);
  const toolText = () => doc.querySelector(".glossary-entry-tools").textContent;
  try {
    root.render(React.createElement(Harness));
    await waitFor(() => box("选择词条 cat"), "编辑器渲染出词条行");

    click(dom, box("选择词条 cat"));
    await waitFor(() => box("选择词条 cat").checked, "勾选第一行");
    assert.match(toolText(), /已选 1 条/);

    api.editField(0, "source", "cat1");
    await waitFor(() => box("选择词条 cat1"), "原词改成 cat1");
    assert.equal(box("选择词条 cat1").checked, true, "改字段后勾选被清空了");
    assert.match(toolText(), /已选 1 条/);

    api.removeEntryRow(0);
    await waitFor(() => box("选择词条 dog") && !box("选择词条 dog").checked, "删行后勾选清空（旧勾选不再指着新行）");
    await waitFor(() => /已选 0 条/.test(toolText()), "「已选」归零");
    assert.equal(doc.getElementById("glossary-delete-selected").disabled, true, "没勾选时「删除所选」应当禁用");
  } finally {
    root.unmount();
    dom.window.close();
  }
});
