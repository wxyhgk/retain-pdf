// 原型用的写死数据：Szabo & Ostlund《Modern Quantum Chemistry》第 3 章 Hartree-Fock。
// 锚点是书库里任务 20261101161029-662f61 的 OCR 块编号（docs/ops/planning/learning-system/20261125-学习页签接进阅读器.md 的表），
// quote 只存小节标题这几个词（书有版权，不放原文）。题目、提示、讲解是草稿，物理内容等用户审。
// 起始状态是编出来的演示：会了 4、卡住 1、疑似误解 1、未测 11。

import type { LearningCourse, LearningItem, LearningPoint } from "../course/types.js";
import { SZABO_CH3_SCRIPTS } from "./szabo-ch3-scripts.js";

const PRE = "前置（第 1–2 章）";
const S31 = "3.1 Hartree-Fock 方程";
const S32 = "3.2 推导";
const S33 = "3.3 解的含义";
const S34 = "3.4 闭壳层 RHF 与 Roothaan 方程";
const S35 = "3.5 算一个：STO-3G H₂";

function point(input: Omit<LearningPoint, "prereqs" | "evidence" | "itemIds" | "status"> & Partial<Pick<LearningPoint, "prereqs" | "evidence" | "itemIds" | "status">>): LearningPoint {
  return { prereqs: [], evidence: [], itemIds: [], status: "untested", ...input };
}

const POINTS: LearningPoint[] = [
  point({
    id: "eigen", name: "本征值问题（厄米矩阵）", section: PRE,
    anchor: { page: 30, itemId: "p030-b000", quote: "1.1.6 The Eigenvalue Problem" },
    summary: "厄米矩阵的本征值是实数，本征向量可以取成正交归一的一组。",
    status: "known", evidence: [{ date: "11/20", text: "新题首次答对" }],
  }),
  point({
    id: "variation", name: "变分原理", section: PRE,
    anchor: { page: 46, itemId: "p046-b018", quote: "1.3.1 The Variation Principle" },
    summary: "任何试探波函数算出来的能量都不低于真实基态能量；能量越低，试探函数越好。",
    status: "known", evidence: [{ date: "11/20", text: "新题首次答对" }],
  }),
  point({
    id: "antisym", name: "反对称性（泡利原理）", section: PRE,
    anchor: { page: 60, itemId: "p060-b007", quote: "2.1.3 The Antisymmetry or Pauli Exclusion Principle" },
    summary: "交换任意两个电子的坐标，多电子波函数变号。",
  }),
  point({
    id: "slater", name: "Hartree 乘积与 Slater 行列式", section: PRE,
    anchor: { page: 64, itemId: "p064-b002", quote: "2.2.3 Slater Determinants" },
    summary: "把自旋轨道排成行列式，自动满足反对称；Hartree 乘积不满足。",
    prereqs: ["antisym"], status: "known", evidence: [{ date: "11/21", text: "新题首次答对 2 次" }],
  }),
  point({
    id: "det-energy", name: "单行列式的能量（矩阵元规则）", section: PRE,
    anchor: { page: 83, itemId: "p083-b013", quote: "2.3.3 General Rules for Matrix Elements" },
    summary: "单个 Slater 行列式的能量 = 每个占据轨道的单电子能 + 每一对的（库仑 − 交换）。",
    prereqs: ["slater"],
  }),
  point({
    id: "jk-integrals", name: "库仑积分与交换积分", section: PRE,
    anchor: { page: 100, itemId: "p100-b008", quote: "2.3.6 Coulomb and Exchange Integrals" },
    summary: "J 是两团电荷之间的经典排斥；K 没有经典对应，来自反对称性，只在同自旋之间。",
    prereqs: ["det-energy"],
  }),
  point({
    id: "jk-ops", name: "库仑算符与交换算符", section: S31,
    anchor: { page: 127, itemId: "p127-b007", quote: "3.1.1 The Coulomb and Exchange Operators" },
    summary: "J_b 乘上其他电子的平均静电势；K_b 把轨道「交换」进积分里，是非局域的。",
    prereqs: ["jk-integrals"], status: "known", evidence: [{ date: "11/24", text: "新题首次答对" }],
  }),
  point({
    id: "fock", name: "Fock 算符", section: S31,
    anchor: { page: 129, itemId: "p129-b000", quote: "3.1.2 The Fock Operator" },
    summary: "每个电子感受到的有效单电子算符：单电子部分 + 其他电子的库仑和交换平均场。",
    prereqs: ["jk-ops", "slater"], status: "stuck",
    evidence: [{ date: "11/25", text: "新题答错 2 次，第 2 级提示后才对" }],
    itemIds: ["fock-1", "fock-2", "fock-3"], scriptId: "fock",
  }),
  point({
    id: "derivation", name: "推导：单行列式能量最小化 → 正则 HF 方程", section: S32,
    anchor: { page: 132, itemId: "p132-b009", quote: "3.2.2 Minimization of the Energy of a Single Determinant" },
    summary: "在轨道保持正交归一的约束下让能量取极值（拉格朗日乘子），再把乘子矩阵对角化，得到 f χ_a = ε_a χ_a。",
    prereqs: ["variation", "det-energy", "fock"],
  }),
  point({
    id: "koopmans", name: "轨道能与 Koopmans 定理", section: S33,
    anchor: { page: 138, itemId: "p138-b002", quote: "3.3.1 Orbital Energies and Koopmans' Theorem" },
    summary: "占据轨道能的负值近似等于从这个轨道拿走一个电子的电离能（轨道不弛豫、没有电子相关）。",
    prereqs: ["fock"], status: "suspect",
    evidence: [{ date: "11/25", text: "信心 5 分答错：以为 Koopmans 给的是精确电离能" }],
    itemIds: ["koop-1", "koop-2"], scriptId: "koopmans", exampleScriptId: "koopmans",
  }),
  point({
    id: "rhf", name: "闭壳层 RHF 与总能量", section: S34,
    anchor: { page: 147, itemId: "p147-b001", quote: "3.4.1 Closed-Shell Hartree-Fock: Restricted Spin Orbitals" },
    summary: "每个空间轨道住一对自旋相反的电子；总能量不等于轨道能之和，电子之间的排斥会算两遍。",
    prereqs: ["fock"], itemIds: ["rhf-1"], scriptId: "energy",
  }),
  point({
    id: "roothaan", name: "Roothaan 方程（广义本征值问题）", section: S34,
    anchor: { page: 151, itemId: "p151-b003", quote: "3.4.2 Introduction of a Basis: The Roothaan Equations" },
    summary: "把空间轨道展开成基函数的组合，HF 方程变成矩阵方程 FC = SCε；基函数不正交，所以多了 S。",
    prereqs: ["rhf", "eigen"], itemIds: ["roothaan-1"], scriptId: "roothaan",
  }),
  point({
    id: "density", name: "电荷密度与密度矩阵", section: S34,
    anchor: { page: 153, itemId: "p153-b009", quote: "3.4.3 The Charge Density" },
    summary: "P_μν = 2 Σ_a C_μa C_νa*：电荷密度全由它决定，Fock 矩阵也只通过它依赖轨道。",
    prereqs: ["roothaan"],
  }),
  point({
    id: "fockmatrix", name: "Fock 矩阵的表达式", section: S34,
    anchor: { page: 155, itemId: "p155-b001", quote: "3.4.4 Expression for the Fock Matrix" },
    summary: "F = H^core + G(P)：核心哈密顿量加上由密度矩阵和双电子积分算出来的部分。",
    prereqs: ["density"],
  }),
  point({
    id: "orth", name: "基组正交化（S^{-1/2}）", section: S34,
    anchor: { page: 157, itemId: "p157-b009", quote: "3.4.5 Orthogonalization of the Basis" },
    summary: "用 X = S^{-1/2}（或正则正交化）把基换成正交的，FC = SCε 就变成普通本征值问题。",
    prereqs: ["roothaan"],
  }),
  point({
    id: "scf", name: "SCF 流程", section: S34,
    anchor: { page: 160, itemId: "p160-b014", quote: "3.4.6 The SCF Procedure" },
    summary: "猜密度矩阵 → 算 F → 正交化后对角化 → 新的 C 和 P → 直到 P 不再变。",
    prereqs: ["fockmatrix", "orth"],
  }),
  point({
    id: "h2", name: "目标：STO-3G H₂ 走一轮 SCF", section: S35,
    anchor: { page: 174, itemId: "p174-b003", quote: "3.5.2 STO-3G H2" },
    summary: "两个基函数、一个占据轨道：把上面的每一步都用具体数字走一遍。",
    prereqs: ["scf"], exampleScriptId: "koopmans",
  }),
];

const ITEMS: LearningItem[] = [
  {
    id: "fock-1", pointId: "fock",
    stem: "闭壳层里，Fock 算符的电子–电子部分 v^HF 是？",
    options: [
      { text: "\\sum_{b}^{N/2} \\left( J_b - K_b \\right)", math: true },
      { text: "\\sum_{b}^{N/2} \\left( 2J_b - K_b \\right)", math: true },
      { text: "\\sum_{b}^{N/2} 2\\left( J_b - K_b \\right)", math: true },
    ],
    answer: 1, diagnostic: true,
    hints: [
      "闭壳层里，每个空间轨道住几个电子？",
      "库仑排斥和自旋有没有关系？交换呢？",
      "交换只发生在同自旋的电子之间。",
      "同一个空间轨道里的两个电子：库仑都要算，交换只算同自旋的那一个。",
      "所以库仑前面是 2，交换前面是 1。",
    ],
    explanation: "每个空间轨道住两个自旋相反的电子：库仑作用两个都算（2J），交换只和同自旋的那一个（K）。",
  },
  {
    id: "fock-2", pointId: "fock",
    stem: "改用自旋轨道写，Fock 算符的电子–电子部分是？",
    options: [
      { text: "\\sum_{b}^{N} \\left( J_b - K_b \\right)", math: true },
      { text: "\\sum_{b}^{N} \\left( 2J_b - K_b \\right)", math: true },
      { text: "\\sum_{b}^{N/2} \\left( J_b - K_b \\right)", math: true },
    ],
    answer: 0,
    hints: [
      "自旋轨道里一个轨道住几个电子？",
      "按自旋轨道求和，每个电子各算一次，求和上限是电子数 N。",
      "每个自旋轨道只有一个电子，所以库仑前面没有 2。",
    ],
    explanation: "按自旋轨道求和，每个电子各算一次（求和到 N）；合并成空间轨道时才出现 2J − K、求和到 N/2。",
  },
  {
    id: "fock-3", pointId: "fock",
    stem: "J_a 和 K_a 作用在 χ_a 自己身上，结果是？",
    options: [
      { text: "相等，J_a χ_a − K_a χ_a = 0（自相互作用抵消）" },
      { text: "J 总比 K 大" },
      { text: "K 作用在自己身上总是 0" },
    ],
    answer: 0,
    hints: [
      "把 K_a 的定义里两个轨道都换成 χ_a 试试。",
      "交换算符把轨道「换」进积分：两个都是 χ_a 时，换了等于没换。",
    ],
    explanation: "两个轨道相同时，交换积分和库仑积分是同一个式子，所以电子和自己的作用正好抵消。",
  },
  {
    id: "koop-1", pointId: "koopmans",
    stem: "Koopmans 定理说 −ε_a 近似等于从 χ_a 拿走一个电子的电离能。这个近似没算什么？",
    options: [
      { text: "其余电子轨道的弛豫，以及电子相关" },
      { text: "原子核的运动" },
      { text: "自旋–轨道耦合" },
    ],
    answer: 0, diagnostic: true,
    hints: [
      "拿走一个电子以后，剩下的电子感受到的平均场变没变？",
      "Koopmans 假设剩下的轨道一点不变——这叫「冻结轨道」。",
      "还有一项 HF 本身就没有的东西。",
    ],
    explanation: "Koopmans 用的是中性分子的轨道，没让剩下的电子重新调整（弛豫），HF 本身也没有电子相关；两项误差常常部分抵消。",
  },
  {
    id: "koop-2", pointId: "koopmans",
    stem: "STO-3G 下 H₂ 的 ε₁ = −0.578 Hartree。按 Koopmans 定理，电离能约是？",
    options: [
      { text: "0.578 Hartree" },
      { text: "−0.578 Hartree" },
      { text: "1.156 Hartree（两个电子）" },
    ],
    answer: 0,
    hints: ["电离能是正的，是拿走一个电子要花的能量。", "IP ≈ −ε，只拿走一个电子。"],
    explanation: "IP ≈ −ε₁ = 0.578 Hartree（约 15.7 eV）；只拿走一个电子，所以不乘 2。",
  },
  {
    id: "rhf-1", pointId: "rhf",
    stem: "闭壳层 HF 的总能量 E₀ 等于？",
    options: [
      { text: "2\\sum_{a}^{N/2} \\varepsilon_a", math: true },
      { text: "\\sum_{a}^{N/2} \\left( h_{aa} + \\varepsilon_a \\right)", math: true },
      { text: "\\sum_{a}^{N/2} \\varepsilon_a", math: true },
    ],
    answer: 1, diagnostic: true,
    hints: [
      "ε_a 里已经包含了 a 和所有电子的排斥。",
      "把每个轨道的 ε 加起来，每一对电子的排斥会算几遍？",
      "要减回多算的那一份，或者写成每个轨道算一次 h 加一次 ε。",
    ],
    explanation: "轨道能之和把每一对电子的排斥算了两遍；E₀ = Σ_a (h_aa + ε_a) = 2Σ_a ε_a − Σ_ab (2J_ab − K_ab)。",
  },
  {
    id: "roothaan-1", pointId: "roothaan",
    stem: "Roothaan 方程 FC = SCε 里多出来的 S 是因为？",
    options: [
      { text: "基函数彼此不正交" },
      { text: "分子轨道没有归一化" },
      { text: "两种自旋要分开算" },
    ],
    answer: 0,
    hints: ["S_μν = ∫ φ_μ* φ_ν，它什么时候是单位矩阵？", "原子上的基函数之间有重叠。"],
    explanation: "S 是基函数的重叠矩阵；基函数不正交时 S ≠ 1，所以是广义本征值问题，先用 X = S^{-1/2} 正交化再解。",
  },
];

export const SZABO_JOB_ID = "20261101161029-662f61";

export const SZABO_CH3_COURSE: LearningCourse = {
  id: "szabo-ch3",
  jobIds: [SZABO_JOB_ID],
  chapter: "第 3 章 Hartree-Fock",
  points: POINTS,
  items: Object.fromEntries(ITEMS.map((item) => [item.id, item])),
  scripts: Object.fromEntries(SZABO_CH3_SCRIPTS.map((entry) => [entry.key, entry.script])),
  canned: [
    {
      keywords: ["自洽", "迭代", "SCF", "scf"],
      pointId: "scf",
      answer: "因为 Fock 算符里的 J、K 是用占据轨道算的，而占据轨道又是 Fock 方程的解——方程依赖它自己的解（非线性）。所以先猜一组轨道（或密度矩阵），算出 F，解出新轨道，再用新轨道算 F……直到前后两次不再变，这就是「自洽」。",
    },
    {
      keywords: ["交换", "K_", "exchange"],
      pointId: "jk-integrals",
      answer: "交换积分没有经典对应：它来自波函数的反对称性，只出现在同自旋的电子之间，效果是让同自旋电子互相避开（费米空穴），所以 HF 里已经有一部分电子相关（交换相关），缺的是库仑相关。",
    },
    {
      keywords: ["总能量", "轨道能之和", "加起来"],
      pointId: "rhf",
      scriptId: "energy",
      answer: "把占据轨道的轨道能加起来，会把每一对电子之间的排斥算两遍，所以总能量不等于轨道能之和。看白板一步步来：",
    },
  ],
};
