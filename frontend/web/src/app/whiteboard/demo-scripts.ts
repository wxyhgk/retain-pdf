// 白板演示页「讲解脚本」用的脚本：Szabo & Ostlund 第 3 章（Hartree-Fock）几个典型卡点（@retainpdf/whiteboard 格式）。
// 这是草稿，物理内容等用户审。
// 数字：STO-3G H₂（R = 1.4 a.u.）的轨道能 ε₁ = −0.578、ε₂ = 0.670 Hartree（Szabo 3.5.2）。

export type DemoScript = {
  key: string;
  label: string;
  script: unknown;
};

export const DEMO_SCRIPTS: DemoScript[] = [
  {
    key: "energy",
    label: "总能量 ≠ 轨道能之和",
    script: {
      version: 1,
      title: "HF 总能量为什么不等于轨道能之和",
      steps: [
        {
          id: "orbital",
          say: "闭壳层里，每个占据轨道的轨道能是这样的：单电子部分，加上它和所有占据轨道的库仑、交换作用。",
          ops: [{ op: "write", id: "eps", math: "\\varepsilon_a = h_{aa} + \\sum_{b}^{N/2} \\left(2J_{ab} - K_{ab}\\right)" }],
        },
        {
          id: "sum",
          say: "把所有占据轨道的轨道能加起来（每个空间轨道住两个电子，所以乘 2）……",
          ops: [{ op: "write", id: "sum", math: "2\\sum_{a}^{N/2} \\varepsilon_a = 2\\sum_{a} h_{aa} + 2\\sum_{a}\\sum_{b} \\left(2J_{ab} - K_{ab}\\right)" }],
        },
        {
          id: "true",
          say: "可真正的 HF 能量里，电子之间的排斥只算一次。加起来的那个式子把每一对都算了两遍。",
          ops: [
            { op: "write", id: "e0", math: "E_0 = 2\\sum_{a} h_{aa} + \\sum_{a}\\sum_{b} \\left(2J_{ab} - K_{ab}\\right)" },
            { op: "mark", target: "sum", tone: "wrong" },
            { op: "note", target: "sum", text: "电子–电子排斥算了两遍", tone: "wrong" },
          ],
        },
        {
          id: "fix",
          say: "所以要把多算的那一份减回去。",
          ops: [
            { op: "write", id: "fix", math: "E_0 = 2\\sum_{a} \\varepsilon_a - \\sum_{a}\\sum_{b} \\left(2J_{ab} - K_{ab}\\right)" },
            { op: "arrow", from: "e0", to: "fix", label: "代入 ε" },
            { op: "mark", target: "fix", tone: "correct" },
          ],
        },
        {
          id: "alt",
          say: "同一件事的另一种写法：每个占据轨道算一次 h 加一次 ε。",
          ops: [
            { op: "write", id: "alt", math: "E_0 = \\sum_{a}^{N/2} \\left(h_{aa} + \\varepsilon_a\\right)", below: "fix" },
            { op: "note", target: "alt", text: "等价写法" },
          ],
        },
      ],
    },
  },
  {
    key: "roothaan",
    label: "Roothaan 方程里的 S",
    script: {
      version: 1,
      title: "Roothaan 方程为什么多了一个 S",
      steps: [
        {
          id: "expand",
          say: "把每个空间轨道展开成 K 个基函数的线性组合。",
          ops: [{ op: "write", id: "lcao", math: "\\psi_i = \\sum_{\\nu=1}^{K} C_{\\nu i}\\, \\phi_\\nu" }],
        },
        {
          id: "plug",
          say: "代进 Hartree-Fock 方程。",
          ops: [{ op: "write", id: "hf", math: "f\\,\\psi_i = \\varepsilon_i\\, \\psi_i" }],
        },
        {
          id: "project",
          say: "两边左乘 φ_μ* 再积分。",
          ops: [{ op: "write", id: "int", math: "\\sum_{\\nu} C_{\\nu i} \\int \\phi_\\mu^{*} f \\phi_\\nu = \\varepsilon_i \\sum_{\\nu} C_{\\nu i} \\int \\phi_\\mu^{*} \\phi_\\nu" }],
        },
        {
          id: "matrix",
          say: "左边的积分是 Fock 矩阵 F，右边的积分是重叠矩阵 S。基函数彼此不正交，S 不是单位矩阵。",
          ops: [
            { op: "write", id: "fcsce", math: "\\mathbf{F}\\mathbf{C} = \\mathbf{S}\\mathbf{C}\\boldsymbol{\\varepsilon}", size: "l" },
            { op: "note", target: "fcsce", text: "S_μν = ∫φ_μ* φ_ν，基函数不正交时 S ≠ 1", tone: "focus" },
            { op: "mark", target: "fcsce", tone: "focus" },
          ],
        },
        {
          id: "orth",
          say: "先用 X = S^{-1/2} 把基正交化，就变回普通的本征值问题。",
          ops: [
            { op: "write", id: "x", math: "\\mathbf{F}' = \\mathbf{X}^{\\dagger}\\mathbf{F}\\mathbf{X},\\quad \\mathbf{F}'\\mathbf{C}' = \\mathbf{C}'\\boldsymbol{\\varepsilon},\\quad \\mathbf{C} = \\mathbf{X}\\mathbf{C}'" },
            { op: "arrow", from: "fcsce", to: "x", label: "正交化" },
            { op: "mark", target: "x", tone: "correct", style: "underline" },
          ],
        },
      ],
    },
  },
  {
    key: "koopmans",
    label: "H₂ 能级与 Koopmans",
    script: {
      version: 1,
      title: "STO-3G H₂ 的轨道能与 Koopmans 定理",
      steps: [
        {
          id: "levels",
          say: "STO-3G 下 H₂（R = 1.4 a.u.）只有两个分子轨道：成键 σg 住满两个电子，反键 σu* 空着。",
          ops: [{
            op: "levels",
            id: "h2",
            axis: "轨道能 / Hartree",
            levels: [
              { label: "σg   ε₁ = −0.578", energy: -0.578, electrons: 2 },
              { label: "σu*  ε₂ = 0.670", energy: 0.67, electrons: 0 },
            ],
          }],
        },
        {
          id: "koopmans",
          say: "按 Koopmans 定理，拿走一个电子要的能量约等于 −ε₁。",
          ops: [
            { op: "write", id: "ip", math: "\\mathrm{IP} \\approx -\\varepsilon_1 = 0.578\\ \\mathrm{Hartree}", right_of: "h2" },
            { op: "arrow", from: "h2", to: "ip", tone: "focus" },
          ],
        },
        {
          id: "caveat",
          say: "这只是近似：它假设拿走一个电子以后，其余电子的轨道一点不变（没算弛豫），也没算电子相关。",
          ops: [
            { op: "write", id: "caveat", text: "近似：轨道不弛豫、没有电子相关", below: "ip", size: "s" },
            { op: "mark", target: "caveat", tone: "wrong", style: "highlight" },
          ],
        },
      ],
    },
  },
  {
    key: "fock",
    label: "Fock 算符怎么来的",
    script: {
      version: 1,
      title: "Fock 算符：单电子部分 + 其他电子的平均场",
      steps: [
        {
          id: "split",
          say: "Fock 算符 = 单电子部分 h，加上所有电子给的平均场 v^HF。",
          ops: [{ op: "write", id: "f", math: "f(1) = h(1) + v^{\\mathrm{HF}}(1)" }],
        },
        {
          id: "spin",
          say: "用自旋轨道写，平均场是每个占据自旋轨道的库仑减交换，求和到 N。",
          ops: [
            { op: "write", id: "vso", math: "v^{\\mathrm{HF}}(1) = \\sum_{b}^{N} \\left[ J_b(1) - K_b(1) \\right]" },
            { op: "note", target: "vso", text: "自旋轨道写法：每个电子各算一次" },
          ],
        },
        {
          id: "closed",
          say: "闭壳层里每个空间轨道住两个电子：库仑作用两个都算，交换只和同自旋的那一个，所以是 2J − K，求和到 N/2。",
          ops: [
            { op: "write", id: "vcs", math: "v^{\\mathrm{HF}}(1) = \\sum_{a}^{N/2} \\left[ 2J_a(1) - K_a(1) \\right]" },
            { op: "arrow", from: "vso", to: "vcs", label: "按空间轨道合并" },
            { op: "mark", target: "vcs", tone: "focus" },
            { op: "note", target: "vcs", text: "库仑 ×2，交换 ×1（只有同自旋）", tone: "focus" },
          ],
        },
        {
          id: "self",
          say: "顺带一个好性质：电子和自己的作用里，库仑和交换正好抵消。",
          ops: [
            { op: "write", id: "self", math: "\\left[ J_a - K_a \\right] \\chi_a = 0" },
            { op: "note", target: "self", text: "自相互作用抵消", tone: "correct" },
          ],
        },
      ],
    },
  },
];
