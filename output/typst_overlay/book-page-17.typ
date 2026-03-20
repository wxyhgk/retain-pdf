#set page(width: 595.2760009765625pt, height: 841.8900146484375pt, margin: 0pt)
#set text(font: "Droid Sans Fallback", size: 11.5pt)
#import "@preview/cmarker:0.1.8"
#import "@preview/mitex:0.2.6": mitex
#show math.equation.where(block: false): set math.frac(style: "horizontal")
#let b0_md = "7 sTDA-xTB 程序"
#let b0_body = block(width: 163pt)[#cmarker.render(b0_md, math: mitex)]
#context {
  let size = measure(b0_body)
  place(top + left, dx: 86pt, dy: 82pt + (14pt - size.height) / 2, b0_body)
}
#let b1_md = "sTDA方法可与半经验扩展紧束缚（xTB）程序结合用于基态计算（详见参考文献14）。xTB计算可通过独立程序xtb4stda进行，该程序及必要的参数文件可从我们的GitHub页面获取。[32]"
#let b1_body = block(width: 422pt)[#cmarker.render(b1_md, math: mitex)]
#context {
  let size = measure(b1_body)
  place(top + left, dx: 86pt, dy: 109pt + (54pt - size.height) / 2, b1_body)
}
#let b2_md = "7.1 xTB 选项"
#let b2_body = block(width: 98pt)[#cmarker.render(b2_md, math: mitex)]
#context {
  let size = measure(b2_body)
  place(top + left, dx: 86pt, dy: 178pt + (14pt - size.height) / 2, b2_body)
}
#let b3_md = "xtb4stda 程序随后需要一个几何结构文件（Xmol 或 TURBOMOLE coord）作为输入。"
#let b3_body = block(width: 421pt)[#cmarker.render(b3_md, math: mitex)]
#context {
  let size = measure(b3_body)
  place(top + left, dx: 85pt, dy: 199pt + (27pt - size.height) / 2, b3_body)
}
#let b4_md = "xtb4stda <coord>"
#let b4_body = block(width: 96pt)[#cmarker.render(b4_md, math: mitex)]
#context {
  let size = measure(b4_body)
  place(top + left, dx: 86pt, dy: 241pt + (11pt - size.height) / 2, b4_body)
}
#let b5_md = "程序随后会写入一个二进制文件 wfn.xtb，该文件可由 std2 程序直接读取，无需额外输入。对于带电体系，需要在当前目录下提供一个 .CHRG 文件，其首行包含分子电荷值。类似地，对于开壳层体系，未配对电子数可在 .UHF 文件中指定。如需查看其他选项，请使用 -h 标志运行 xtb4stda 程序。"
#let b5_body = block(width: 421pt)[#cmarker.render(b5_md, math: mitex)]
#context {
  let size = measure(b5_body)
  place(top + left, dx: 85pt, dy: 267pt + (68pt - size.height) / 2, b5_body)
}
#let b6_md = "7.2 基于xTB的sTDA"
#let b6_body = block(width: 140pt)[#cmarker.render(b6_md, math: mitex)]
#context {
  let size = measure(b6_body)
  place(top + left, dx: 86pt, dy: 349pt + (13pt - size.height) / 2, b6_body)
}
#let b7_md = "使用xTB完成基态计算后，可通过std2程序计算激发态："
#let b7_body = block(width: 423pt)[#cmarker.render(b7_md, math: mitex)]
#context {
  let size = measure(b7_body)
  place(top + left, dx: 85pt, dy: 370pt + (27pt - size.height) / 2, b7_body)
}
#let b8_md = "std2 -xtb -e 10"
#let b8_body = block(width: 90pt)[#cmarker.render(b8_md, math: mitex)]
#context {
  let size = measure(b8_body)
  place(top + left, dx: 86pt, dy: 412pt + (11pt - size.height) / 2, b8_body)
}
#let b9_md = "这将读取工作目录中的wfn.xtb文件，并计算所有激发态直至$1 0 \\mathrm { e V }$。方法特定参数$\\alpha$、$\\beta$和$a _ { x }$会自动设置。出于计算效率考虑，我们建议使用Tamm-Dancoff近似变体（即sTDA-xTB），尽管完整的线性响应处理（即sTD-DFT-xTB）可通过-rpa标志调用。由于std2默认启用的A+B/2校正[14]，即使采用原点独立的偶极速度形式主义，电子圆二色谱也能通过sTDA-xTB得到合理计算。"
#let b9_body = block(width: 421pt)[#cmarker.render(b9_md, math: mitex)]
#context {
  let size = measure(b9_body)
  place(top + left, dx: 85pt, dy: 439pt + (94pt - size.height) / 2, b9_body)
}
#let b10_md = "请注意，目前XsTD方法尚不能使用xTB基态。"
#let b10_body = block(width: 365pt)[#cmarker.render(b10_md, math: mitex)]
#context {
  let size = measure(b10_body)
  place(top + left, dx: 96pt, dy: 534pt + (12pt - size.height) / 2, b10_body)
}
#let b11_md = "参考文献"
#let b11_body = block(width: 75pt)[#cmarker.render(b11_md, math: mitex)]
#context {
  let size = measure(b11_body)
  place(top + left, dx: 86pt, dy: 565pt + (16pt - size.height) / 2, b11_body)
}
