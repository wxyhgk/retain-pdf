#set page(width: 595.2760009765625pt, height: 841.8900146484375pt, margin: 0pt)
#set text(font: "Droid Sans Fallback", size: 11.5pt)
#import "@preview/cmarker:0.1.8"
#import "@preview/mitex:0.2.6": mitex
#show math.equation.where(block: false): set math.frac(style: "horizontal")
#let b0_md = "最后一点是必要的，因为std2程序只能处理笛卡尔原子轨道。一个使用GAUSSIAN（针对水分子）计算的示例输入可能如下所示："
#let b0_body = block(width: 419pt)[#cmarker.render(b0_md, math: mitex)]
#context {
  let size = measure(b0_body)
  place(top + left, dx: 86pt, dy: 137pt + (38pt - size.height) / 2, b0_body)
}
#let b1_md = "水分子单点计算"
#let b1_body = block(width: 101pt)[#cmarker.render(b1_md, math: mitex)]
#context {
  let size = measure(b1_body)
  place(top + left, dx: 86pt, dy: 205pt + (11pt - size.height) / 2, b1_body)
}
#let b2_md = "0 1 xyz"
#let b2_body = block(width: 43pt)[#cmarker.render(b2_md, math: mitex)]
#context {
  let size = measure(b2_body)
  place(top + left, dx: 86pt, dy: 232pt + (12pt - size.height) / 2, b2_body)
}
#let b3_md = "H 0.000000 0.776483 -0.472981"
#let b3_body = block(width: 169pt)[#cmarker.render(b3_md, math: mitex)]
#context {
  let size = measure(b3_body)
  place(top + left, dx: 86pt, dy: 245pt + (11pt - size.height) / 2, b3_body)
}
#let b4_md = "H 0.000000 -0.776483 -0.472981"
#let b4_body = block(width: 174pt)[#cmarker.render(b4_md, math: mitex)]
#context {
  let size = measure(b4_body)
  place(top + left, dx: 86pt, dy: 259pt + (10pt - size.height) / 2, b4_body)
}
#let b5_md = "O 0.000000 0.000000 0.118245"
#let b5_body = block(width: 164pt)[#cmarker.render(b5_md, math: mitex)]
#context {
  let size = measure(b5_body)
  place(top + left, dx: 86pt, dy: 272pt + (11pt - size.height) / 2, b5_body)
}
#let b6_md = "在使用GAUSSIAN完成基态计算后，您可以通过以下方式将输出文件（此处称为g09.log）转换为Molden输入文件："
#let b6_body = block(width: 421pt)[#cmarker.render(b6_md, math: mitex)]
#context {
  let size = measure(b6_body)
  place(top + left, dx: 85pt, dy: 312pt + (27pt - size.height) / 2, b6_body)
}
#let b7_md = "g2molden g09.log > molden.input"
#let b7_body = block(width: 181pt)[#cmarker.render(b7_md, math: mitex)]
#context {
  let size = measure(b7_body)
  place(top + left, dx: 86pt, dy: 354pt + (12pt - size.height) / 2, b7_body)
}
#let b8_md = "如上所述（使用 -sty 3，参见第 3 节），molden.input 文件可作为 std2 程序的输入文件。如果您在使用 g2molden 工具或 std2 程序时遇到问题，请随时联系我们。然而，对于与 GAUSSIAN 本身相关的问题，我们无法提供任何支持。"
#let b8_body = block(width: 421pt)[#cmarker.render(b8_md, math: mitex)]
#context {
  let size = measure(b8_body)
  place(top + left, dx: 85pt, dy: 380pt + (53pt - size.height) / 2, b8_body)
}
#let b9_md = "6 与 Q-CHEM 配合使用"
#let b9_body = block(width: 160pt)[#cmarker.render(b9_md, math: mitex)]
#context {
  let size = measure(b9_body)
  place(top + left, dx: 86pt, dy: 452pt + (16pt - size.height) / 2, b9_body)
}
#let b10_md = "Q-CHEM 可在输入文件的 $rem 部分使用以下参数自动生成 molden 文件："
#let b10_body = block(width: 420pt)[#cmarker.render(b10_md, math: mitex)]
#context {
  let size = measure(b10_body)
  place(top + left, dx: 85pt, dy: 479pt + (26pt - size.height) / 2, b10_body)
}
#let b11_md = "PRINT ORBITALS$=$2000000"
#let b11_body = block(width: 138pt)[#cmarker.render(b11_md, math: mitex)]
#context {
  let size = measure(b11_body)
  place(top + left, dx: 86pt, dy: 520pt + (12pt - size.height) / 2, b11_body)
}
#let b12_md = "MOLDEN 格式$=$正确"
#let b12_body = block(width: 116pt)[#cmarker.render(b12_md, math: mitex)]
#context {
  let size = measure(b12_body)
  place(top + left, dx: 86pt, dy: 534pt + (11pt - size.height) / 2, b12_body)
}
#let b13_md = "PURECART$=$2222"
#let b13_body = block(width: 89pt)[#cmarker.render(b13_md, math: mitex)]
#context {
  let size = measure(b13_body)
  place(top + left, dx: 86pt, dy: 547pt + (12pt - size.height) / 2, b13_body)
}
#let b14_md = "PRINT ORBITALS 是打印的最大轨道数，需要设置得非常大才能打印所有轨道。PURECART = 2222 指定在计算中使用笛卡尔轨道基组。Q-CHEM 生成的 molden 文件无法被 std2 直接读取。qc2molden.sh 脚本提取并转换 molden 文件。只需运行 qc2molden.sh 你的 qchem 输出文件，即可生成 molden.input 文件。运行 std2 时需要使用 -sty 3 参数。"
#let b14_body = block(width: 421pt)[#cmarker.render(b14_md, math: mitex)]
#context {
  let size = measure(b14_body)
  place(top + left, dx: 85pt, dy: 574pt + (81pt - size.height) / 2, b14_body)
}
