#set page(width: 595.2760009765625pt, height: 841.8900146484375pt, margin: 0pt)
#set text(font: "Droid Sans Fallback", size: 11.5pt)
#import "@preview/cmarker:0.1.8"
#import "@preview/mitex:0.2.6": mitex
#show math.equation.where(block: false): set math.frac(style: "horizontal")
#let b0_md = "其中，线性响应向量是针对$\\omega$和$- 2 \\omega$确定的。双光子吸收截面通过第一超极化率的单残差获得，而态间未弛豫偶极矩则通过双残差获得。"
#let b0_body = block(width: 421pt)[#cmarker.render(b0_md, math: mitex)]
#context {
  let size = measure(b0_body)
  place(top + left, dx: 85pt, dy: 178pt + (40pt - size.height) / 2, b0_body)
}
#let b1_md = "2.4 简化自旋翻转TD-DFT"
#let b1_body = block(width: 185pt)[#cmarker.render(b1_md, math: mitex)]
#context {
  let size = measure(b1_body)
  place(top + left, dx: 86pt, dy: 232pt + (15pt - size.height) / 2, b1_body)
}
#let b2_md = "在自旋翻转形式中，仅考虑从$\\alpha$空间到$\\beta$空间的单激发。对于共线泛函，仅保留$\\left( i _ { \\alpha } j _ { \\alpha } | a _ { \\beta } b _ { \\beta } \\right)$双电子积分，SF-sTD-DFT[17]特征值方程变为："
#let b2_body = block(width: 421pt)[#cmarker.render(b2_md, math: mitex)]
#context {
  let size = measure(b2_body)
  place(top + left, dx: 85pt, dy: 254pt + (41pt - size.height) / 2, b2_body)
}
#let b3_md = "是"
#let b3_body = block(width: 26pt)[#cmarker.render(b3_md, math: mitex)]
#context {
  let size = measure(b3_body)
  place(top + left, dx: 86pt, dy: 332pt + (10pt - size.height) / 2, b3_body)
}
#let b4_md = "对于简化的自旋翻转双电子积分，阻尼库仑算符的形式为："
#let b4_body = block(width: 421pt)[#cmarker.render(b4_md, math: mitex)]
#context {
  let size = measure(b4_body)
  place(top + left, dx: 85pt, dy: 364pt + (24pt - size.height) / 2, b4_body)
}
#let b5_md = "其中"
#let b5_body = block(width: 32pt)[#cmarker.render(b5_md, math: mitex)]
#context {
  let size = measure(b5_body)
  place(top + left, dx: 86pt, dy: 423pt + (10pt - size.height) / 2, b5_body)
}
#let b6_md = "根据sTD-DFT态间跃迁偶极矩表达式[16]，其自旋翻转版本可表述为"
#let b6_body = block(width: 423pt)[#cmarker.render(b6_md, math: mitex)]
#context {
  let size = measure(b6_body)
  place(top + left, dx: 85pt, dy: 455pt + (28pt - size.height) / 2, b6_body)
}
#let b7_md = "此外，我们已实现了紧束缚sTD-DFT-xTB方法的自旋翻转版本$\\lfloor 1 4 \\rfloor$。其中，sTDA部分的有效福克交换参数被修改为$a _ { x } = 0 . 3 6$，而$y _ { \\alpha \\to \\beta } = 3 . 0$。需要明确说明的是，在SF-sTD-DFT-xTB中，“交换型”（库仑响应）积分的单极校正$\\Delta _ { K }$为零。对于开壳层体系，vTB和xTB部分仍保持与原方法一致。[14]"
#let b7_body = block(width: 423pt)[#cmarker.render(b7_md, math: mitex)]
#context {
  let size = measure(b7_body)
  place(top + left, dx: 85pt, dy: 543pt + (81pt - size.height) / 2, b7_body)
}
