#set page(width: 595.2760009765625pt, height: 841.8900146484375pt, margin: 0pt)
#set text(font: "Droid Sans Fallback", size: 11.5pt)
#import "@preview/cmarker:0.1.8"
#import "@preview/mitex:0.2.6": mitex
#show math.equation.where(block: false): set math.frac(style: "horizontal")
#let b0_md = "-sty 1 选项用于兼容 TURBOMOLE。根据我们的经验，-sty 2 适用于 MOLPRO 输入文件，而 -sty 3 则适用于 TERACHEM、GAUSSIAN（通过 g2molden，见下文）或 Q-CHEM（通过 qc2molden.sh，见下文）输入文件。完成检查后，您可以通过运行不带 -chk 标志的程序来执行实际计算，但需同时使用相应的 -sty 标志以及下文列出的选项。"
#let b0_body = block(width: 418pt)[#cmarker.render(b0_md, math: mitex)]
#context {
  let size = measure(b0_body)
  place(top + left, dx: 88pt, dy: 84pt + (80pt - size.height) / 2, b0_body)
}
#let b1_md = "-ax <Fock 交换量>"
#let b1_body = block(width: 167pt)[#cmarker.render(b1_md, math: mitex)]
#context {
  let size = measure(b1_body)
  place(top + left, dx: 88pt, dy: 179pt + (13pt - size.height) / 2, b1_body)
}
#let b2_md = "指定密度泛函中Fock交换的占比（例如，PBE0使用-ax 0.25）。"
#let b2_body = block(width: 418pt)[#cmarker.render(b2_md, math: mitex)]
#context {
  let size = measure(b2_body)
  place(top + left, dx: 88pt, dy: 205pt + (27pt - size.height) / 2, b2_body)
}
#let b3_md = "-e <Ethr>"
#let b3_body = block(width: 52pt)[#cmarker.render(b3_md, math: mitex)]
#context {
  let size = measure(b3_body)
  place(top + left, dx: 88pt, dy: 247pt + (12pt - size.height) / 2, b3_body)
}
#let b4_md = "这指定了在sTDA、sTD-DFT、SF-sTD-DFT、XsTDA或XsTD-DFT程序中考虑构型所需的能量阈值（以eV为单位）。超出该阈值的重要构型将通过微扰理论进行选择，并添加到构型空间中（详见参考文献1）。默认值为7 eV，建议根据感兴趣的能量范围调整此阈值。"
#let b4_body = block(width: 418pt)[#cmarker.render(b4_md, math: mitex)]
#context {
  let size = measure(b4_body)
  place(top + left, dx: 88pt, dy: 272pt + (69pt - size.height) / 2, b4_body)
}
#let b5_md = "3.2 可选功能"
#let b5_body = block(width: 122pt)[#cmarker.render(b5_md, math: mitex)]
#context {
  let size = measure(b5_body)
  place(top + left, dx: 88pt, dy: 369pt + (15pt - size.height) / 2, b5_body)
}
#let b6_md = "-libcintOFF"
#let b6_body = block(width: 64pt)[#cmarker.render(b6_md, math: mitex)]
#context {
  let size = measure(b6_body)
  place(top + left, dx: 88pt, dy: 391pt + (12pt - size.height) / 2, b6_body)
}
#let b7_md = "自版本2.0.0起，std2使用libcint积分库[23]来计算单电子和双电子积分。此关键词可触发使用旧积分库。此选项不适用于XsTD方法。"
#let b7_body = block(width: 418pt)[#cmarker.render(b7_md, math: mitex)]
#context {
  let size = measure(b7_body)
  place(top + left, dx: 88pt, dy: 417pt + (41pt - size.height) / 2, b7_body)
}
#let b8_md = "-XsTD"
#let b8_body = block(width: 29pt)[#cmarker.render(b8_md, math: mitex)]
#context {
  let size = measure(b8_body)
  place(top + left, dx: 88pt, dy: 472pt + (12pt - size.height) / 2, b8_body)
}
#let b9_md = "为考虑全局杂化泛函而触发使用XsTD方法而非sTD方法。注意：使用xTB基态时无法使用XsTD方案。另请注意：对于XsTDA计算，默认情况下速度校正处于关闭状态，但可通过-Bvel关键词触发。"
#let b9_body = block(width: 418pt)[#cmarker.render(b9_md, math: mitex)]
#context {
  let size = measure(b9_body)
  place(top + left, dx: 88pt, dy: 498pt + (55pt - size.height) / 2, b9_body)
}
#let b10_md = "-p <Pthr>"
#let b10_body = block(width: 52pt)[#cmarker.render(b10_md, math: mitex)]
#context {
  let size = measure(b10_body)
  place(top + left, dx: 88pt, dy: 567pt + (14pt - size.height) / 2, b10_body)
}
#let b11_md = "定义用于选择重要构型能量阈值<Ethr>的选择标准。例如，输入-p 5对应$E _ { t h r } ^ { ( 2 ) } = 1 0 ^ { - 5 } E _ { h }$（见公式6）。"
#let b11_body = block(width: 418pt)[#cmarker.render(b11_md, math: mitex)]
#context {
  let size = measure(b11_body)
  place(top + left, dx: 88pt, dy: 593pt + (43pt - size.height) / 2, b11_body)
}
#let b12_md = "-lpt <PTmax>"
#let b12_body = block(width: 69pt)[#cmarker.render(b12_md, math: mitex)]
#context {
  let size = measure(b12_body)
  place(top + left, dx: 88pt, dy: 650pt + (13pt - size.height) / 2, b12_body)
}
