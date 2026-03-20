#set page(width: 595.2760009765625pt, height: 841.8900146484375pt, margin: 0pt)
#set text(font: "Droid Sans Fallback", size: 11.5pt)
#import "@preview/cmarker:0.1.8"
#import "@preview/mitex:0.2.6": mitex
#show math.equation.where(block: false): set math.frac(style: "horizontal")
#let b0_md = "-CAMB3LYP"
#let b0_body = block(width: 55pt)[#cmarker.render(b0_md, math: mitex)]
#context {
  let size = measure(b0_body)
  place(top + left, dx: 86pt, dy: 99pt + (10pt - size.height) / 2, b0_body)
}
#let b1_md = "仅用于在XsTD方案中调用CAM-B3LYP RSH泛函。此关键词隐含了-XsTD以及所有其他参数。"
#let b1_body = block(width: 419pt)[#cmarker.render(b1_md, math: mitex)]
#context {
  let size = measure(b1_body)
  place(top + left, dx: 86pt, dy: 125pt + (27pt - size.height) / 2, b1_body)
}
#let b2_md = "-wB97XD2"
#let b2_body = block(width: 49pt)[#cmarker.render(b2_md, math: mitex)]
#context {
  let size = measure(b2_body)
  place(top + left, dx: 86pt, dy: 166pt + (11pt - size.height) / 2, b2_body)
}
#let b3_md = "仅针对XsTD方案调用wB97X-D2 RSH泛函。此关键词隐含-XsTD及其他所有参数。"
#let b3_body = block(width: 418pt)[#cmarker.render(b3_md, math: mitex)]
#context {
  let size = measure(b3_body)
  place(top + left, dx: 86pt, dy: 192pt + (27pt - size.height) / 2, b3_body)
}
#let b4_md = "-wB97XD3"
#let b4_body = block(width: 49pt)[#cmarker.render(b4_md, math: mitex)]
#context {
  let size = measure(b4_body)
  place(top + left, dx: 86pt, dy: 234pt + (11pt - size.height) / 2, b4_body)
}
#let b5_md = "仅针对XsTD方案调用wB97X-D3 RSH泛函。此关键词隐含-XsTD及其他所有参数。"
#let b5_body = block(width: 419pt)[#cmarker.render(b5_md, math: mitex)]
#context {
  let size = measure(b5_body)
  place(top + left, dx: 86pt, dy: 260pt + (27pt - size.height) / 2, b5_body)
}
#let b6_md = "-wB97MV"
#let b6_body = block(width: 43pt)[#cmarker.render(b6_md, math: mitex)]
#context {
  let size = measure(b6_body)
  place(top + left, dx: 86pt, dy: 301pt + (11pt - size.height) / 2, b6_body)
}
#let b7_md = "仅用于XsTD方案调用wB97MV RSH泛函。此关键词隐含-XsTD及所有其他参数。"
#let b7_body = block(width: 419pt)[#cmarker.render(b7_md, math: mitex)]
#context {
  let size = measure(b7_body)
  place(top + left, dx: 86pt, dy: 328pt + (26pt - size.height) / 2, b7_body)
}
#let b8_md = "-SRC2R1"
#let b8_body = block(width: 43pt)[#cmarker.render(b8_md, math: mitex)]
#context {
  let size = measure(b8_body)
  place(top + left, dx: 86pt, dy: 370pt + (10pt - size.height) / 2, b8_body)
}
#let b9_md = "仅针对XsTD方案调用SRC2R1 RSH泛函。此关键词隐含了-XsTD以及所有其他参数。"
#let b9_body = block(width: 419pt)[#cmarker.render(b9_md, math: mitex)]
#context {
  let size = measure(b9_body)
  place(top + left, dx: 86pt, dy: 396pt + (27pt - size.height) / 2, b9_body)
}
#let b10_md = "-SRC2R2"
#let b10_body = block(width: 43pt)[#cmarker.render(b10_md, math: mitex)]
#context {
  let size = measure(b10_body)
  place(top + left, dx: 86pt, dy: 437pt + (11pt - size.height) / 2, b10_body)
}
#let b11_md = "仅用于调用XsTD方案的SRC2R2 RSH功能。此关键词隐含了-XsTD参数及其他所有参数。"
#let b11_body = block(width: 419pt)[#cmarker.render(b11_md, math: mitex)]
#context {
  let size = measure(b11_body)
  place(top + left, dx: 86pt, dy: 463pt + (27pt - size.height) / 2, b11_body)
}
#let b12_md = "3.3 示例程序"
#let b12_body = block(width: 144pt)[#cmarker.render(b12_md, math: mitex)]
#context {
  let size = measure(b12_body)
  place(top + left, dx: 86pt, dy: 505pt + (14pt - size.height) / 2, b12_body)
}
#let b13_md = "3.3.1 使用全局混合泛函"
#let b13_body = block(width: 193pt)[#cmarker.render(b13_md, math: mitex)]
#context {
  let size = measure(b13_body)
  place(top + left, dx: 86pt, dy: 526pt + (13pt - size.height) / 2, b13_body)
}
#let b14_md = "使用杂化密度泛函进行Kohn-Sham DFT基态计算。在本示例中，我们假设已使用TURBOMOLE执行了PBE0计算。然后运行"
#let b14_body = block(width: 418pt)[#cmarker.render(b14_md, math: mitex)]
#context {
  let size = measure(b14_body)
  place(top + left, dx: 86pt, dy: 547pt + (40pt - size.height) / 2, b14_body)
}
#let b15_md = "tm2molden"
#let b15_body = block(width: 55pt)[#cmarker.render(b15_md, math: mitex)]
#context {
  let size = measure(b15_body)
  place(top + left, dx: 86pt, dy: 602pt + (11pt - size.height) / 2, b15_body)
}
#let b16_md = "并确保将GTO/MO数据写入Molden输入文件（此处为pbe0.molden.inp）。假设我们关注所有激发态，直至$6 \\mathrm { e V }$。调用std2程序的命令为："
#let b16_body = block(width: 419pt)[#cmarker.render(b16_md, math: mitex)]
#context {
  let size = measure(b16_body)
  place(top + left, dx: 86pt, dy: 629pt + (40pt - size.height) / 2, b16_body)
}
