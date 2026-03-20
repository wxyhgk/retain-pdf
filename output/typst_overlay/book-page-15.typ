#set page(width: 595.2760009765625pt, height: 841.8900146484375pt, margin: 0pt)
#set text(font: "Droid Sans Fallback", size: 11.5pt)
#import "@preview/cmarker:0.1.8"
#import "@preview/mitex:0.2.6": mitex
#show math.equation.where(block: false): set math.frac(style: "horizontal")
#let b0_md = "对于XsTD-DFT计算："
#let b0_body = block(width: 155pt)[#cmarker.render(b0_md, math: mitex)]
#context {
  let size = measure(b0_body)
  place(top + left, dx: 86pt, dy: 98pt + (12pt - size.height) / 2, b0_body)
}
#let b1_md = "std2 -f wb97xD3.molden.inp -wB97XD3 -e 10 -rpa > output"
#let b1_body = block(width: 318pt)[#cmarker.render(b1_md, math: mitex)]
#context {
  let size = measure(b1_body)
  place(top + left, dx: 86pt, dy: 126pt + (13pt - size.height) / 2, b1_body)
}
#let b2_md = "4 光谱绘图工具"
#let b2_body = block(width: 206pt)[#cmarker.render(b2_md, math: mitex)]
#context {
  let size = measure(b2_body)
  place(top + left, dx: 86pt, dy: 184pt + (16pt - size.height) / 2, b2_body)
}
#let b3_md = "光谱可通过SpecDis程序进行绘制和可视化。此外，我们还提供了一个名为g spec的处理工具。该工具以tda.dat文件（由std2程序生成）作为输入。运行该工具的命令为："
#let b3_body = block(width: 423pt)[#cmarker.render(b3_md, math: mitex)]
#context {
  let size = measure(b3_body)
  place(top + left, dx: 85pt, dy: 211pt + (41pt - size.height) / 2, b3_body)
}
#let b4_md = "g spec < tda.dat"
#let b4_body = block(width: 94pt)[#cmarker.render(b4_md, math: mitex)]
#context {
  let size = measure(b4_body)
  place(top + left, dx: 86pt, dy: 266pt + (13pt - size.height) / 2, b4_body)
}
#let b5_md = "它将生成两个文件：spec.dat 和 rots.dat。第一个文件包含通过高斯曲线展宽的谱图，后一个文件包含可用于绘制棒状谱的纯振子/旋光强度。"
#let b5_body = block(width: 420pt)[#cmarker.render(b5_md, math: mitex)]
#context {
  let size = measure(b5_body)
  place(top + left, dx: 85pt, dy: 292pt + (40pt - size.height) / 2, b5_body)
}
#let b6_md = "tda.dat 文件的头部定义了 g spec 的选项。重要特性包括："
#let b6_body = block(width: 394pt)[#cmarker.render(b6_md, math: mitex)]
#context {
  let size = measure(b6_body)
  place(top + left, dx: 86pt, dy: 333pt + (13pt - size.height) / 2, b6_body)
}
#let b7_md = "UV 计算吸收光谱（如未指定，则计算 CD）"
#let b7_body = block(width: 330pt)[#cmarker.render(b7_md, math: mitex)]
#context {
  let size = measure(b7_body)
  place(top + left, dx: 121pt, dy: 357pt + (13pt - size.height) / 2, b7_body)
}
#let b8_md = "VELO 使用R和f的速度表示（如果同时指定了UV，则包括f）。"
#let b8_body = block(width: 404pt)[#cmarker.render(b8_md, math: mitex)]
#context {
  let size = measure(b8_body)
  place(top + left, dx: 110pt, dy: 371pt + (12pt - size.height) / 2, b8_body)
}
#let b9_md = "NM 以纳米尺度而非电子伏特绘制光谱。"
#let b9_body = block(width: 255pt)[#cmarker.render(b9_md, math: mitex)]
#context {
  let size = measure(b9_body)
  place(top + left, dx: 121pt, dy: 385pt + (11pt - size.height) / 2, b9_body)
}
#let b10_md = "WIDTH 高斯曲线在1/e最大值处的半宽度（以eV为单位）。"
#let b10_body = block(width: 305pt)[#cmarker.render(b10_md, math: mitex)]
#context {
  let size = measure(b10_body)
  place(top + left, dx: 104pt, dy: 398pt + (12pt - size.height) / 2, b10_body)
}
#let b11_md = "SHIFT 应用于整个光谱的能量偏移（以eV为单位）。"
#let b11_body = block(width: 272pt)[#cmarker.render(b11_md, math: mitex)]
#context {
  let size = measure(b11_body)
  place(top + left, dx: 104pt, dy: 412pt + (12pt - size.height) / 2, b11_body)
}
#let b12_md = "LFAKTOR 打印到rots.dat文件的棒状谱缩放因子。"
#let b12_body = block(width: 331pt)[#cmarker.render(b12_md, math: mitex)]
#context {
  let size = measure(b12_body)
  place(top + left, dx: 93pt, dy: 425pt + (12pt - size.height) / 2, b12_body)
}
#let b13_md = "RFAKTOR 打印到spec.dat文件的展宽谱缩放因子。"
#let b13_body = block(width: 365pt)[#cmarker.render(b13_md, math: mitex)]
#context {
  let size = measure(b13_body)
  place(top + left, dx: 93pt, dy: 439pt + (12pt - size.height) / 2, b13_body)
}
#let b14_md = "高斯展宽光谱（spec.dat）包含摩尔消光系数（用于吸收）或摩尔圆二色谱（用于CD），两者均以$\\mathrm { L \\cdot m o l ^ { - 1 } \\cdot c m ^ { - 1 } }$为单位给出。单个跃迁强度在rots.dat中以相同单位给出。请注意，默认情况下LFAKTOR设置为0.5，即这些值被缩小以便于绘制展宽光谱与单个跃迁强度的对比图。"
#let b14_body = block(width: 422pt)[#cmarker.render(b14_md, math: mitex)]
#context {
  let size = measure(b14_body)
  place(top + left, dx: 85pt, dy: 462pt + (67pt - size.height) / 2, b14_body)
}
#let b15_md = "5 与GAUSSIAN配合使用"
#let b15_body = block(width: 173pt)[#cmarker.render(b15_md, math: mitex)]
#context {
  let size = measure(b15_body)
  place(top + left, dx: 86pt, dy: 548pt + (16pt - size.height) / 2, b15_body)
}
#let b16_md = "从版本1.3开始，std2程序可以通过g2molden工具与GAUSSIAN程序[10]进行接口。该工具将GAUSSIAN输出文件转换为Molden[7]输入文件，该文件可由std2程序处理。请确保在您的GAUSSIAN输入文件中设置以下关键词："
#let b16_body = block(width: 421pt)[#cmarker.render(b16_md, math: mitex)]
#context {
  let size = measure(b16_body)
  place(top + left, dx: 85pt, dy: 575pt + (54pt - size.height) / 2, b16_body)
}
