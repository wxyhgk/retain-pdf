#set page(width: 595.2760009765625pt, height: 841.8900146484375pt, margin: 0pt)
#set text(font: "Droid Sans Fallback", size: 11.5pt)
#import "@preview/cmarker:0.1.8"
#import "@preview/mitex:0.2.6": mitex
#show math.equation.where(block: false): set math.frac(style: "horizontal")
#let b0_md = "使用SpecDis[12,13]程序1。或者，也可以使用提供的绘图工具（g spec，见下文）。"
#let b0_body = block(width: 421pt)[#cmarker.render(b0_md, math: mitex)]
#context {
  let size = measure(b0_body)
  place(top + left, dx: 85pt, dy: 83pt + (27pt - size.height) / 2, b0_body)
}
#let b1_md = "自版本1.5起，sTDA计算默认计算A+B/2校正的$\\lfloor 1 4 \\rfloor$偶极速度旋转强度。代码大部分利用OpenMP并行化和Intel MKL，因此将环境变量OMP_NUM_THREADS和MKL_NUM_THREADS设置为可用CPU数量可加速计算。从版本1.6开始，std2程序能够计算线性和二次响应函数[15]，以评估动态（超）极化率和激发态吸收光谱[16]。"
#let b1_body = block(width: 423pt)[#cmarker.render(b1_md, math: mitex)]
#context {
  let size = measure(b1_body)
  place(top + left, dx: 85pt, dy: 111pt + (94pt - size.height) / 2, b1_body)
}
#let b2_md = "自版本1.6.1起，实现了sTD-DFT的自旋翻转版本（SF-sTD-DFT）方法[17]以及自然跃迁轨道分析[18]。"
#let b2_body = block(width: 421pt)[#cmarker.render(b2_md, math: mitex)]
#context {
  let size = measure(b2_body)
  place(top + left, dx: 85pt, dy: 206pt + (26pt - size.height) / 2, b2_body)
}
#let b3_md = "从版本1.6.2开始，可以在sTD-DFT水平计算分子光学旋转[19]，并且整个线性和二次响应模块得到了加速。"
#let b3_body = block(width: 421pt)[#cmarker.render(b3_md, math: mitex)]
#context {
  let size = measure(b3_body)
  place(top + left, dx: 85pt, dy: 232pt + (28pt - size.height) / 2, b3_body)
}
#let b4_md = "在版本1.6.3中，我们能够计算双光子吸收截面[20]，使用RespA方法解释分子响应性质[21]，并且还提供了一种双阈值方案，用于高效处理具有中心发色团的超大型体系[22]。随着版本2.0.0的发布，主要更新包括引入了XsTD-DFT和XsTDA方法，这些方法不再使用半经验积分。std2程序还与libcint积分库[23]原生接口，用于计算单电子和双电子积分。范围分离杂化泛函也原生支持XsTD-DFT和XsTDA方案。"
#let b4_body = block(width: 426pt)[#cmarker.render(b4_md, math: mitex)]
#context {
  let size = measure(b4_body)
  place(top + left, dx: 85pt, dy: 260pt + (107pt - size.height) / 2, b4_body)
}
#let b5_md = "接下来将简要概述理论，随后提供程序文档。"
#let b5_body = block(width: 421pt)[#cmarker.render(b5_md, math: mitex)]
#context {
  let size = measure(b5_body)
  place(top + left, dx: 85pt, dy: 369pt + (27pt - size.height) / 2, b5_body)
}
#let b6_md = "2 理论背景"
#let b6_body = block(width: 174pt)[#cmarker.render(b6_md, math: mitex)]
#context {
  let size = measure(b6_body)
  place(top + left, dx: 86pt, dy: 414pt + (17pt - size.height) / 2, b6_body)
}
#let b7_md = "要通过std2（第2.1节）或sTD-DFT（第2.2节）计算激发态，需要使用上述提到的程序之一进行基态Kohn-Sham（或Hartree-Fock）计算。该计算获得的轨道随后用于sTDA/sTD-DFT过程。除了Kohn-Sham参考外，轨道也可以通过半经验扩展紧束缚（xTB）方案获得（参见第7节）。"
#let b7_body = block(width: 421pt)[#cmarker.render(b7_md, math: mitex)]
#context {
  let size = measure(b7_body)
  place(top + left, dx: 85pt, dy: 441pt + (67pt - size.height) / 2, b7_body)
}
#let b8_md = "2.1 时间相关密度泛函理论的简化Tamm-Dancoff近似"
#let b8_body = block(width: 316pt)[#cmarker.render(b8_md, math: mitex)]
#context {
  let size = measure(b8_body)
  place(top + left, dx: 86pt, dy: 523pt + (15pt - size.height) / 2, b8_body)
}
#let b9_md = "时间相关密度泛函理论（TD-DFT）的响应问题可以表示为以下非厄米特征值问题[24]。"
#let b9_body = block(width: 421pt)[#cmarker.render(b9_md, math: mitex)]
#context {
  let size = measure(b9_body)
  place(top + left, dx: 85pt, dy: 544pt + (28pt - size.height) / 2, b9_body)
}
#let b10_md = "在Tamm-Dancoff近似（TDA）中，矩阵$\\mathbf { B }$被忽略$[ 2 5 ]$，从而得到："
#let b10_body = block(width: 421pt)[#cmarker.render(b10_md, math: mitex)]
#context {
  let size = measure(b10_body)
  place(top + left, dx: 85pt, dy: 619pt + (26pt - size.height) / 2, b10_body)
}
