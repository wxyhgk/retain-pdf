#set page(width: 595.2760009765625pt, height: 841.8900146484375pt, margin: 0pt)
#set text(font: "Droid Sans Fallback", size: 11.5pt)
#import "@preview/cmarker:0.1.8"
#import "@preview/mitex:0.2.6": mitex
#show math.equation.where(block: false): set math.frac(style: "horizontal")
#let b0_md = "目录"
#let b0_body = block(width: 63pt)[#cmarker.render(b0_md, math: mitex)]
#context {
  let size = measure(b0_body)
  place(top + left, dx: 86pt, dy: 82pt + (13pt - size.height) / 2, b0_body)
}
#let b1_md = "1 关于本程序 1"
#let b1_body = block(width: 419pt)[#cmarker.render(b1_md, math: mitex)]
#context {
  let size = measure(b1_body)
  place(top + left, dx: 87pt, dy: 108pt + (13pt - size.height) / 2, b1_body)
}
#let b2_md = "2 理论背景 2"
#let b2_body = block(width: 419pt)[#cmarker.render(b2_md, math: mitex)]
#context {
  let size = measure(b2_body)
  place(top + left, dx: 87pt, dy: 132pt + (13pt - size.height) / 2, b2_body)
}
#let b3_md = "3 程序选项 6"
#let b3_body = block(width: 419pt)[#cmarker.render(b3_md, math: mitex)]
#context {
  let size = measure(b3_body)
  place(top + left, dx: 87pt, dy: 225pt + (13pt - size.height) / 2, b3_body)
}
#let b4_md = "4 光谱绘图工具 13"
#let b4_body = block(width: 419pt)[#cmarker.render(b4_md, math: mitex)]
#context {
  let size = measure(b4_body)
  place(top + left, dx: 87pt, dy: 358pt + (13pt - size.height) / 2, b4_body)
}
#let b5_md = "5 与GAUSSIAN 13的使用"
#let b5_body = block(width: 419pt)[#cmarker.render(b5_md, math: mitex)]
#context {
  let size = measure(b5_body)
  place(top + left, dx: 87pt, dy: 382pt + (13pt - size.height) / 2, b5_body)
}
#let b6_md = "6 与Q-CHEM 14的使用"
#let b6_body = block(width: 419pt)[#cmarker.render(b6_md, math: mitex)]
#context {
  let size = measure(b6_body)
  place(top + left, dx: 87pt, dy: 407pt + (13pt - size.height) / 2, b6_body)
}
#let b7_md = "7 sTDA-xTB程序 15"
#let b7_body = block(width: 419pt)[#cmarker.render(b7_md, math: mitex)]
#context {
  let size = measure(b7_body)
  place(top + left, dx: 87pt, dy: 431pt + (13pt - size.height) / 2, b7_body)
}
