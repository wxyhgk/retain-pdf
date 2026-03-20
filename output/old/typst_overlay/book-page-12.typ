#set page(width: 595.2760009765625pt, height: 841.8900146484375pt, margin: 0pt)
#set text(font: "Droid Sans Fallback", size: 11.5pt)
#import "@preview/cmarker:0.1.8"
#import "@preview/mitex:0.2.6": mitex
#show math.equation.where(block: false): set math.frac(style: "horizontal")
#let b0_md = "要使用SF-(X)sTD-DFT方法[17]配合高自旋参考态。同时计算第一SF态到SF态的跃迁。使用-spin选项获取自旋翻转态的$< S ^ { 2 } >$。"
#let b0_body = block(width: 421pt)[#cmarker.render(b0_md, math: mitex)]
#context {
  let size = measure(b0_body)
  place(top + left, dx: 85pt, dy: 84pt + (41pt - size.height) / 2, b0_body)
}
#let b1_md = "-nto <#state>"
#let b1_body = block(width: 80pt)[#cmarker.render(b1_md, math: mitex)]
#context {
  let size = measure(b1_body)
  place(top + left, dx: 86pt, dy: 140pt + (11pt - size.height) / 2, b1_body)
}
#let b2_md = "为计算#state前几个态的自然跃迁轨道。所有NTO均计算在molden文件中，其中轨道能量参数实际上是这对NTO的权重。可使用jmol.spt脚本文件配合jmol生成所有NTO图像。随后，通过打开NTOs.html文件即可轻松可视化查看。"
#let b2_body = block(width: 421pt)[#cmarker.render(b2_md, math: mitex)]
#context {
  let size = measure(b2_body)
  place(top + left, dx: 85pt, dy: 165pt + (55pt - size.height) / 2, b2_body)
}
#let b3_md = "使用此选项进行极化率或旋光性计算时，可采用RespA方法[21]计算自然响应轨道以及化学片段响应，以便于阐明结构-(光学)性质关系。在此情况下，无需指定态的数量。要计算化学片段响应，需指定名为“fragments”的文件，其内容为："
#let b3_body = block(width: 423pt)[#cmarker.render(b3_md, math: mitex)]
#context {
  let size = measure(b3_body)
  place(top + left, dx: 85pt, dy: 233pt + (81pt - size.height) / 2, b3_body)
}
#let b4_md = "如果此文件不存在，则仅计算自然响应轨道。"
#let b4_body = block(width: 338pt)[#cmarker.render(b4_md, math: mitex)]
#context {
  let size = measure(b4_body)
  place(top + left, dx: 86pt, dy: 423pt + (14pt - size.height) / 2, b4_body)
}
#let b5_md = "-rw"
#let b5_body = block(width: 22pt)[#cmarker.render(b5_md, math: mitex)]
#context {
  let size = measure(b5_body)
  place(top + left, dx: 86pt, dy: 465pt + (10pt - size.height) / 2, b5_body)
}
#let b6_md = "通过将大型临时文件写入磁盘来节省内存，在运行受限计算时。"
#let b6_body = block(width: 421pt)[#cmarker.render(b6_md, math: mitex)]
#context {
  let size = measure(b6_body)
  place(top + left, dx: 85pt, dy: 491pt + (25pt - size.height) / 2, b6_body)
}
#let b7_md = "-dual"
#let b7_body = block(width: 33pt)[#cmarker.render(b7_md, math: mitex)]
#context {
  let size = measure(b7_body)
  place(top + left, dx: 86pt, dy: 532pt + (11pt - size.height) / 2, b7_body)
}
#let b8_md = "要使用双阈值方法[22]进行受限计算（意味着使用-rw选项）。通过此选项，将使用两个能量阈值：一个用于由-e <Ethr>选项指定的内壳层，另一个用于名为“dual”的文件中指定的外壳层："
#let b8_body = block(width: 423pt)[#cmarker.render(b8_md, math: mitex)]
#context {
  let size = measure(b8_body)
  place(top + left, dx: 85pt, dy: 558pt + (41pt - size.height) / 2, b8_body)
}
