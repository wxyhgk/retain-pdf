#set page(width: 595.2760009765625pt, height: 841.8900146484375pt, margin: 0pt)
#set text(font: "Droid Sans Fallback", size: 11.5pt)
#import "@preview/cmarker:0.1.8"
#import "@preview/mitex:0.2.6": mitex
#show math.equation.where(block: false): set math.frac(style: "horizontal")
#let b0_md = "2.5 精确积分简化TD-DFT"
#let b0_body = block(width: 241pt)[#cmarker.render(b0_md, math: mitex)]
#context {
  let size = measure(b0_body)
  place(top + left, dx: 86pt, dy: 84pt + (14pt - size.height) / 2, b0_body)
}
#let b1_md = "XsTD-DFT和XsTDA[3,4]计算可以从杂化或RSH基态计算开始。为求解Casida方程1，A和$\\mathbf { B }$超矩阵不再使用半经验积分计算，而是通过以下方式获取评估A和$\\mathbf { B }$超矩阵元素所需的双电子积分："
#let b1_body = block(width: 422pt)[#cmarker.render(b1_md, math: mitex)]
#context {
  let size = measure(b1_body)
  place(top + left, dx: 85pt, dy: 105pt + (53pt - size.height) / 2, b1_body)
}
#let b2_md = "其中$Q _ { \\alpha } ^ { i a }$跃迁电荷是从每个基函数$\\alpha$的Löwdin正交化系数$C _ { \\alpha i } ^ { l o w }$中收集的。"
#let b2_body = block(width: 421pt)[#cmarker.render(b2_md, math: mitex)]
#context {
  let size = measure(b2_body)
  place(top + left, dx: 85pt, dy: 203pt + (25pt - size.height) / 2, b2_body)
}
#let b3_md = "而$( \\alpha \\alpha | \\beta \\beta )$是Mulliken表示法中的原子轨道双电子积分。考虑到RSH泛函，还需要长程双电子积分："
#let b3_body = block(width: 421pt)[#cmarker.render(b3_md, math: mitex)]
#context {
  let size = measure(b3_body)
  place(top + left, dx: 85pt, dy: 257pt + (28pt - size.height) / 2, b3_body)
}
#let b4_md = "计算以下矩阵元素："
#let b4_body = block(width: 206pt)[#cmarker.render(b4_md, math: mitex)]
#context {
  let size = measure(b4_body)
  place(top + left, dx: 86pt, dy: 327pt + (14pt - size.height) / 2, b4_body)
}
#let b5_md = "和"
#let b5_body = block(width: 22pt)[#cmarker.render(b5_md, math: mitex)]
#context {
  let size = measure(b5_body)
  place(top + left, dx: 86pt, dy: 385pt + (11pt - size.height) / 2, b5_body)
}
#let b6_md = "3 程序选项"
#let b6_body = block(width: 133pt)[#cmarker.render(b6_md, math: mitex)]
#context {
  let size = measure(b6_body)
  place(top + left, dx: 86pt, dy: 429pt + (17pt - size.height) / 2, b6_body)
}
#let b7_md = "3.1 必需输入功能"
#let b7_body = block(width: 171pt)[#cmarker.render(b7_md, math: mitex)]
#context {
  let size = measure(b7_body)
  place(top + left, dx: 86pt, dy: 455pt + (15pt - size.height) / 2, b7_body)
}
#let b8_md = "-f <molden.input>"
#let b8_body = block(width: 102pt)[#cmarker.render(b8_md, math: mitex)]
#context {
  let size = measure(b8_body)
  place(top + left, dx: 86pt, dy: 477pt + (14pt - size.height) / 2, b8_body)
}
#let b9_md = "选择一个提供GTO和MO数据的Molden输入文件。对于TURBOMOLE，该文件由转换工具tm2molden创建。由于指定GTO和MO数据没有唯一方式（即格式取决于生成输入的程序），因此会执行输入检查。可以处理来自TURBOMOLE、MOLPRO、TERACHEM、GAUSSIAN（通过g2molden，见下文）或Q-CHEM（通过qc2molden.sh，见下文）生成的Molden文件。"
#let b9_body = block(width: 423pt)[#cmarker.render(b9_md, math: mitex)]
#context {
  let size = measure(b9_body)
  place(top + left, dx: 85pt, dy: 504pt + (81pt - size.height) / 2, b9_body)
}
#let b10_md = "在开始实际计算之前，检查程序是否正确读取您的Molden文件非常重要。通过执行以下命令进行检查："
#let b10_body = block(width: 421pt)[#cmarker.render(b10_md, math: mitex)]
#context {
  let size = measure(b10_body)
  place(top + left, dx: 85pt, dy: 586pt + (27pt - size.height) / 2, b10_body)
}
#let b11_md = "std2 -f <molden.input> -chk"
#let b11_body = block(width: 160pt)[#cmarker.render(b11_md, math: mitex)]
#context {
  let size = measure(b11_body)
  place(top + left, dx: 86pt, dy: 626pt + (14pt - size.height) / 2, b11_body)
}
#let b12_md = "这将执行对输入读取的检查（通过Mulliken布居分析），并打印出在实际计算中使用的-sty标志。默认情况下，"
#let b12_body = block(width: 423pt)[#cmarker.render(b12_md, math: mitex)]
#context {
  let size = measure(b12_body)
  place(top + left, dx: 85pt, dy: 652pt + (29pt - size.height) / 2, b12_body)
}
