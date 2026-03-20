#set page(width: 595.2760009765625pt, height: 841.8900146484375pt, margin: 0pt)
#set text(font: "Droid Sans Fallback", size: 11.5pt)
#import "@preview/cmarker:0.1.8"
#import "@preview/mitex:0.2.6": mitex
#show math.equation.where(block: false): set math.frac(style: "horizontal")
#let b0_md = "对于非常大的系统，限制扫描空间以选择重要配置可能是有用的。上述标志指定了配置被考虑的能量阈值（以eV为单位）。显然，它必须始终大于$<$<Ethr>。默认情况下，所有激发态都会被考虑，但必要时可调整，例如设置为<PTmax> = 3 · <Ethr>。"
#let b0_body = block(width: 421pt)[#cmarker.render(b0_md, math: mitex)]
#context {
  let size = measure(b0_body)
  place(top + left, dx: 85pt, dy: 84pt + (68pt - size.height) / 2, b0_body)
}
#let b1_md = "-al <alpha> -be <beta>"
#let b1_body = block(width: 129pt)[#cmarker.render(b1_md, math: mitex)]
#context {
  let size = measure(b1_body)
  place(top + left, dx: 86pt, dy: 166pt + (13pt - size.height) / 2, b1_body)
}
#let b2_md = "这为用户定义的参数$\\alpha$和$\\beta$提供了设置，它们分别用于计算$\\gamma _ { A B } ^ { K }$和$\\gamma _ { A B } ^ { J }$。默认情况下，这些参数根据Fock交换量和全局杂化泛函的标准参数计算得出[1]。对于使用sTD方法的范围分离杂化泛函，明智的做法是调整这些参数。五种广泛可用的范围分离杂化泛函的参数可在参考文献30中找到（另见第3.3.2节），适用于sTD方法。"
#let b2_body = block(width: 421pt)[#cmarker.render(b2_md, math: mitex)]
#context {
  let size = measure(b2_body)
  place(top + left, dx: 85pt, dy: 193pt + (81pt - size.height) / 2, b2_body)
}
#let b3_md = "-t"
#let b3_body = block(width: 15pt)[#cmarker.render(b3_md, math: mitex)]
#context {
  let size = measure(b3_body)
  place(top + left, dx: 86pt, dy: 290pt + (9pt - size.height) / 2, b3_body)
}
#let b4_md = "计算单重态-三重态激发（使用自旋限制基态）。"
#let b4_body = block(width: 354pt)[#cmarker.render(b4_md, math: mitex)]
#context {
  let size = measure(b4_body)
  place(top + left, dx: 86pt, dy: 314pt + (13pt - size.height) / 2, b4_body)
}
#let b5_md = "-rpa"
#let b5_body = block(width: 27pt)[#cmarker.render(b5_md, math: mitex)]
#context {
  let size = measure(b5_body)
  place(top + left, dx: 86pt, dy: 344pt + (11pt - size.height) / 2, b5_body)
}
#let b6_md = "这会调用(X)sTD-DFT程序，而非默认的(X)sTDA[2]。"
#let b6_body = block(width: 366pt)[#cmarker.render(b6_md, math: mitex)]
#context {
  let size = measure(b6_body)
  place(top + left, dx: 86pt, dy: 368pt + (15pt - size.height) / 2, b6_body)
}
#let b7_md = "可以打印出特征向量（以TURBOMOLE格式）。这通过以下方式实现："
#let b7_body = block(width: 421pt)[#cmarker.render(b7_md, math: mitex)]
#context {
  let size = measure(b7_body)
  place(top + left, dx: 85pt, dy: 396pt + (27pt - size.height) / 2, b7_body)
}
#let b8_md = "-vectm <#vec>"
#let b8_body = block(width: 78pt)[#cmarker.render(b8_md, math: mitex)]
#context {
  let size = measure(b8_body)
  place(top + left, dx: 86pt, dy: 438pt + (10pt - size.height) / 2, b8_body)
}
#let b9_md = "根据所用方法（(X)sTDA 或 (X)sTD-DFT），这会生成文件 ciss a、cist a、sing a 或 trip a，并打印出最低的 <#vec> 个特征向量（例如，-vectm 5 将打印出五个最低的特征向量）。如果未指定数字，则会打印所有已确定的特征向量，但需注意这可能导致文件非常庞大！"
#let b9_body = block(width: 420pt)[#cmarker.render(b9_md, math: mitex)]
#context {
  let size = measure(b9_body)
  place(top + left, dx: 85pt, dy: 463pt + (68pt - size.height) / 2, b9_body)
}
#let b10_md = "-xtb"
#let b10_body = block(width: 27pt)[#cmarker.render(b10_md, math: mitex)]
#context {
  let size = measure(b10_body)
  place(top + left, dx: 86pt, dy: 546pt + (10pt - size.height) / 2, b10_body)
}
#let b11_md = "调用 sTDA-xTB 或 sTD-DFT-xTB 计算方案（参见第 7 节）。在这种情况下，读取 xtb4stda 二进制波函数文件（wfn.xtb）而非 Molden 输入文件。相应的参数$\\alpha$、$\\beta$和$a _ { x }$会自动设置。"
#let b11_body = block(width: 420pt)[#cmarker.render(b11_md, math: mitex)]
#context {
  let size = measure(b11_body)
  place(top + left, dx: 85pt, dy: 571pt + (42pt - size.height) / 2, b11_body)
}
#let b12_md = "-oldtda"
#let b12_body = block(width: 43pt)[#cmarker.render(b12_md, math: mitex)]
#context {
  let size = measure(b12_body)
  place(top + left, dx: 86pt, dy: 627pt + (10pt - size.height) / 2, b12_body)
}
#let b13_md = "对于sTDA计算（即未设置-rpa参数时），此关键词要求以“传统”方式从std2计算偶极速度旋转强度，"
#let b13_body = block(width: 421pt)[#cmarker.render(b13_md, math: mitex)]
#context {
  let size = measure(b13_body)
  place(top + left, dx: 85pt, dy: 652pt + (29pt - size.height) / 2, b13_body)
}
