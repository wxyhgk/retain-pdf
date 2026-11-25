// 白板演示页的示例卡片（「放几张示例」、截图测试 ?board=sample）。

import { addNote, emptyBoard, type BoardDoc } from "@retainpdf/whiteboard";

/** 示例卡片：Szabo 第 3 章里几处常写的式子（草稿）。 */
const SAMPLE_NOTES: Array<{ x: number; y: number; text: string }> = [
  {
    x: 40,
    y: 40,
    text: "## Fock 算符\n闭壳层：\n$$f(1) = h(1) + \\sum_{a}^{N/2} \\left[ 2J_a(1) - K_a(1) \\right]$$\n每个空间轨道住两个电子：库仑 **×2**，交换只和同自旋 ×1。",
  },
  {
    x: 420,
    y: 40,
    text: "**总能量 ≠ 轨道能之和**\n\n$E_0 = \\sum_a^{N/2} (h_{aa} + \\varepsilon_a)$，因为 $\\sum_a \\varepsilon_a$ 把电子之间的排斥算了两遍。",
  },
  {
    x: 40,
    y: 300,
    text: "Roothaan：$\\mathbf{F}\\mathbf{C} = \\mathbf{S}\\mathbf{C}\\boldsymbol{\\varepsilon}$\n\n- 基函数不正交 → $S \\neq 1$\n- 先 $X = S^{-1/2}$ 正交化",
  },
];

export function sampleBoard(): BoardDoc {
  let doc = emptyBoard();
  SAMPLE_NOTES.forEach((note, index) => {
    doc = addNote(doc, note, note.text, `sample-${index + 1}`).doc;
  });
  return { ...doc, view: { x: 24, y: 24, zoom: 1 } };
}

