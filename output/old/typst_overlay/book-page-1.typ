#set page(width: 595.2760009765625pt, height: 841.8900146484375pt, margin: 0pt)
#set text(font: "Droid Sans Fallback", size: 11.5pt)
#import "@preview/cmarker:0.1.8"
#import "@preview/mitex:0.2.6": mitex
#show math.equation.where(block: false): set math.frac(style: "horizontal")
#let b0_md = "s t d 2"
#let b0_body = block(width: 128pt)[#cmarker.render(b0_md, math: mitex)]
#context {
  let size = measure(b0_body)
  place(top + left, dx: 232pt, dy: 136pt + (33pt - size.height) / 2, b0_body)
}
#let b1_md = "一个通过简化TD-DFT方法（sTDA、sTD-DFT、SF-sTD-DFT、XsTDA、XsTD-DFT和SF-XsTD-DFT）计算激发态和响应函数的程序包"
#let b1_body = block(width: 418pt)[#cmarker.render(b1_md, math: mitex)]
#context {
  let size = measure(b1_body)
  place(top + left, dx: 88pt, dy: 186pt + (87pt - size.height) / 2, b1_body)
}
#let b2_md = "版本 2.0.0"
#let b2_body = block(width: 93pt)[#cmarker.render(b2_md, math: mitex)]
#context {
  let size = measure(b2_body)
  place(top + left, dx: 250pt, dy: 290pt + (16pt - size.height) / 2, b2_body)
}
#let b3_md = "用户手册"
#let b3_body = block(width: 160pt)[#cmarker.render(b3_md, math: mitex)]
#context {
  let size = measure(b3_body)
  place(top + left, dx: 217pt, dy: 327pt + (24pt - size.height) / 2, b3_body)
}
#let b4_md = "2025年1月9日"
#let b4_body = block(width: 79pt)[#cmarker.render(b4_md, math: mitex)]
#context {
  let size = measure(b4_body)
  place(top + left, dx: 257pt, dy: 380pt + (13pt - size.height) / 2, b4_body)
}
#let b5_md = "开发人员："
#let b5_body = block(width: 73pt)[#cmarker.render(b5_md, math: mitex)]
#context {
  let size = measure(b5_body)
  place(top + left, dx: 260pt, dy: 407pt + (13pt - size.height) / 2, b5_body)
}
#let b6_md = "Stefan Grimme*"
#let b6_body = block(width: 89pt)[#cmarker.render(b6_md, math: mitex)]
#context {
  let size = measure(b6_body)
  place(top + left, dx: 251pt, dy: 420pt + (13pt - size.height) / 2, b6_body)
}
#let b7_md = "Mulliken Center for Theoretical Chemistry"
#let b7_body = block(width: 207pt)[#cmarker.render(b7_md, math: mitex)]
#context {
  let size = measure(b7_body)
  place(top + left, dx: 193pt, dy: 443pt + (13pt - size.height) / 2, b7_body)
}
#let b8_md = "物理与理论化学研究所"
#let b8_body = block(width: 246pt)[#cmarker.render(b8_md, math: mitex)]
#context {
  let size = measure(b8_body)
  place(top + left, dx: 174pt, dy: 456pt + (13pt - size.height) / 2, b8_body)
}
#let b9_md = "波恩大学"
#let b9_body = block(width: 105pt)[#cmarker.render(b9_md, math: mitex)]
#context {
  let size = measure(b9_body)
  place(top + left, dx: 246pt, dy: 470pt + (11pt - size.height) / 2, b9_body)
}
#let b10_md = "Beringstr. 4, 53115 Bonn, Germany."
#let b10_body = block(width: 178pt)[#cmarker.render(b10_md, math: mitex)]
#context {
  let size = measure(b10_body)
  place(top + left, dx: 208pt, dy: 484pt + (13pt - size.height) / 2, b10_body)
}
#let b11_md = "Email: grimme@thch.uni-bonn.de"
#let b11_body = block(width: 171pt)[#cmarker.render(b11_md, math: mitex)]
#context {
  let size = measure(b11_body)
  place(top + left, dx: 211pt, dy: 502pt + (13pt - size.height) / 2, b11_body)
}
#let b12_md = "Marc de Wergifosse"
#let b12_body = block(width: 115pt)[#cmarker.render(b12_md, math: mitex)]
#context {
  let size = measure(b12_body)
  place(top + left, dx: 239pt, dy: 529pt + (15pt - size.height) / 2, b12_body)
}
#let b13_md = "理论化学研究组"
#let b13_body = block(width: 141pt)[#cmarker.render(b13_md, math: mitex)]
#context {
  let size = measure(b13_body)
  place(top + left, dx: 227pt, dy: 553pt + (12pt - size.height) / 2, b13_body)
}
#let b14_md = "凝聚态与纳米科学研究所"
#let b14_body = block(width: 234pt)[#cmarker.render(b14_md, math: mitex)]
#context {
  let size = measure(b14_body)
  place(top + left, dx: 180pt, dy: 566pt + (13pt - size.height) / 2, b14_body)
}
#let b15_md = "Universit´e Catholique de Louvain"
#let b15_body = block(width: 161pt)[#cmarker.render(b15_md, math: mitex)]
#context {
  let size = measure(b15_body)
  place(top + left, dx: 217pt, dy: 580pt + (12pt - size.height) / 2, b15_body)
}
#let b16_md = "比利时，1348 新鲁汶，路易·巴斯德广场 1/L4.01.02。"
#let b16_body = block(width: 318pt)[#cmarker.render(b16_md, math: mitex)]
#context {
  let size = measure(b16_body)
  place(top + left, dx: 138pt, dy: 593pt + (13pt - size.height) / 2, b16_body)
}
#let b17_md = "邮箱：marc.dewergifosse@uclouvain.be"
#let b17_body = block(width: 199pt)[#cmarker.render(b17_md, math: mitex)]
#context {
  let size = measure(b17_body)
  place(top + left, dx: 197pt, dy: 611pt + (13pt - size.height) / 2, b17_body)
}
#let b18_md = "贡献者："
#let b18_body = block(width: 123pt)[#cmarker.render(b18_md, math: mitex)]
#context {
  let size = measure(b18_body)
  place(top + left, dx: 235pt, dy: 640pt + (12pt - size.height) / 2, b18_body)
}
#let b19_md = "Christoph Bannwarth、Philip Shushkov 和 Pierre Beaujean"
#let b19_body = block(width: 338pt)[#cmarker.render(b19_md, math: mitex)]
#context {
  let size = measure(b19_body)
  place(top + left, dx: 127pt, dy: 653pt + (13pt - size.height) / 2, b19_body)
}
