#set page(width: 595.2760009765625pt, height: 841.8900146484375pt, margin: 0pt)
#set text(font: "Droid Sans Fallback", size: 11.5pt)
#import "@preview/cmarker:0.1.8"
#import "@preview/mitex:0.2.6": mitex
#show math.equation.where(block: false): set math.frac(style: "horizontal")
#let b0_md = "std2 -f pbe0.molden.inp -ax 0.25 -e 6 > output"
#let b0_body = block(width: 267pt)[#cmarker.render(b0_md, math: mitex)]
#context {
  let size = measure(b0_body)
  place(top + left, dx: 86pt, dy: 99pt + (12pt - size.height) / 2, b0_body)
}
#let b1_md = "我们将标准输出重定向至文件output。程序还会生成文件tda.dat，其中包含每个态的跃迁能量以及振子强度和旋光强度的长度与速度表示（单位为$1 0 ^ { 4 0 }$erg·cm3）。若要在XsTDA理论级别运行相同计算："
#let b1_body = block(width: 420pt)[#cmarker.render(b1_md, math: mitex)]
#context {
  let size = measure(b1_body)
  place(top + left, dx: 85pt, dy: 125pt + (54pt - size.height) / 2, b1_body)
}
#let b2_md = "std2 -f pbe0.molden.inp -ax 0.25 -e 6 -XsTD > output"
#let b2_body = block(width: 301pt)[#cmarker.render(b2_md, math: mitex)]
#context {
  let size = measure(b2_body)
  place(top + left, dx: 86pt, dy: 193pt + (13pt - size.height) / 2, b2_body)
}
#let b3_md = "3.3.2 使用范围分离杂化泛函配合sTDA和sTD-DFT方案"
#let b3_body = block(width: 420pt)[#cmarker.render(b3_md, math: mitex)]
#context {
  let size = measure(b3_body)
  place(top + left, dx: 86pt, dy: 248pt + (14pt - size.height) / 2, b3_body)
}
#let b4_md = "如果我们有来自例如$\\omega$B97X单点计算的Molden输入文件（此处为wb97x.molden.inp），则可以执行相应的sTDA计算如下："
#let b4_body = block(width: 470pt)[#cmarker.render(b4_md, math: mitex)]
#context {
  let size = measure(b4_body)
  place(top + left, dx: 85pt, dy: 269pt + (29pt - size.height) / 2, b4_body)
}
#let b5_md = "std2 -f wb97x.molden.inp -ax 0.56 -be 8.00 -al 4.58 -e 10 > output"
#let b5_body = block(width: 381pt)[#cmarker.render(b5_md, math: mitex)]
#context {
  let size = measure(b5_body)
  place(top + left, dx: 86pt, dy: 311pt + (12pt - size.height) / 2, b5_body)
}
#let b6_md = "该范围分离杂化泛函的std2参数（$\\alpha$、$\\beta$和$a _ { x }$）取自参考文献30中的表1。"
#let b6_body = block(width: 421pt)[#cmarker.render(b6_md, math: mitex)]
#context {
  let size = measure(b6_body)
  place(top + left, dx: 85pt, dy: 337pt + (25pt - size.height) / 2, b6_body)
}
#let b7_md = "请注意，其中给出的$\\alpha ^ { ( 1 ) }$对应于$\\beta$，而$\\beta ^ { ( 1 ) }$对应于$\\alpha$（根据公式4和5）。因此对于$\\omega$B97X，用于计算$\\gamma _ { A B } ^ { J }$的参数是$\\beta = 8 . 0 0$。"
#let b7_body = block(width: 421pt)[#cmarker.render(b7_md, math: mitex)]
#context {
  let size = measure(b7_body)
  place(top + left, dx: 85pt, dy: 364pt + (27pt - size.height) / 2, b7_body)
}
#let b8_md = "要使用相同设置执行sTD-DFT计算，只需添加-rpa标志："
#let b8_body = block(width: 390pt)[#cmarker.render(b8_md, math: mitex)]
#context {
  let size = measure(b8_body)
  place(top + left, dx: 86pt, dy: 404pt + (13pt - size.height) / 2, b8_body)
}
#let b9_md = "std2 -f wb97x.molden.inp -ax 0.56 -be 8.00 -al 4.58 -e 10 -rpa > output 目前已有五种范围分离杂化泛函完成参数化。参数如下："
#let b9_body = block(width: 421pt)[#cmarker.render(b9_md, math: mitex)]
#context {
  let size = measure(b9_body)
  place(top + left, dx: 85pt, dy: 433pt + (38pt - size.height) / 2, b9_body)
}
#let b10_md = "3.3.3 使用范围分离杂化泛函配合XsTDA和XsTD-DFT方案"
#let b10_body = block(width: 390pt)[#cmarker.render(b10_md, math: mitex)]
#context {
  let size = measure(b10_body)
  place(top + left, dx: 86pt, dy: 590pt + (26pt - size.height) / 2, b10_body)
}
#let b11_md = "如果我们有来自例如ωB97X-D3单点计算的Molden输入文件（此处为wb97xD3.molden.inp），则可按如下方式执行相应的XsTDA计算："
#let b11_body = block(width: 420pt)[#cmarker.render(b11_md, math: mitex)]
#context {
  let size = measure(b11_body)
  place(top + left, dx: 85pt, dy: 624pt + (27pt - size.height) / 2, b11_body)
}
#let b12_md = "std2 -f wb97xD3.molden.inp -wB97XD3 -e 10 > output"
#let b12_body = block(width: 289pt)[#cmarker.render(b12_md, math: mitex)]
#context {
  let size = measure(b12_body)
  place(top + left, dx: 86pt, dy: 666pt + (12pt - size.height) / 2, b12_body)
}
