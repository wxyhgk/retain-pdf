#set page(width: 595.2760009765625pt, height: 841.8900146484375pt, margin: 0pt)
#set text(font: "Droid Sans Fallback", size: 11.5pt)
#import "@preview/cmarker:0.1.8"
#import "@preview/mitex:0.2.6": mitex
#show math.equation.where(block: false): set math.frac(style: "horizontal")
#let b0_md = "经过三次简化后，便得到了简化的Tamm-Dancoff方法（sTDA）[1]："
#let b0_body = block(width: 398pt)[#cmarker.render(b0_md, math: mitex)]
#context {
  let size = measure(b0_body)
  place(top + left, dx: 86pt, dy: 117pt + (15pt - size.height) / 2, b0_body)
}
#let b1_md = "在以下表示法中，下标$i j k$指代占据轨道，abc指代虚轨道，$p q$指代一般轨道（既可以是占据轨道也可以是虚轨道）。简化矩阵$\\mathbf { A } ^ { \\prime }$的元素则表示为："
#let b1_body = block(width: 423pt)[#cmarker.render(b1_md, math: mitex)]
#context {
  let size = measure(b1_body)
  place(top + left, dx: 85pt, dy: 227pt + (40pt - size.height) / 2, b1_body)
}
#let b2_md = "$q _ { p q } ^ { A }$和$q _ { p q } ^ { B }$分别是位于原子$A$和$B$上的跃迁/电荷密度单极子。这些是通过Löwdin布居分析[26]获得的。$\\epsilon _ { p }$是轨道$p$的Kohn-Sham轨道能量。在自旋限制情况下，单重态-单重态激发时$s _ { k } = 2$，单重态-三重态激发时$s _ { k } = 0$。$\\gamma _ { A B } ^ { K }$和$\\gamma _ { A B } ^ { J }$分别是交换型积分($K$)和库仑型积分(J)的Mataga-Nishimoto-Ohno-Klopman阻尼库仑算符[27,28,29]。"
#let b2_body = block(width: 423pt)[#cmarker.render(b2_md, math: mitex)]
#context {
  let size = measure(b2_body)
  place(top + left, dx: 85pt, dy: 319pt + (84pt - size.height) / 2, b2_body)
}
#let b3_md = "这里，$\\eta$是原子$A$和$B$化学硬度的算术平均值。$\\alpha$和$\\beta$是该方法的全局拟合参数，取决于泛函中非局域Fock交换量$a _ { x }$(详见参考文献1)。"
#let b3_body = block(width: 423pt)[#cmarker.render(b3_md, math: mitex)]
#context {
  let size = measure(b3_body)
  place(top + left, dx: 85pt, dy: 487pt + (42pt - size.height) / 2, b3_body)
}
#let b4_md = "矩阵$\\mathbf { A } ^ { \\prime }$包含了用户指定能量阈值以下的所有激发态（参见第3节）。为了避免遗漏超出此阈值的重要构型，这些构型将通过微扰方法进行选择："
#let b4_body = block(width: 421pt)[#cmarker.render(b4_md, math: mitex)]
#context {
  let size = measure(b4_body)
  place(top + left, dx: 85pt, dy: 541pt + (40pt - size.height) / 2, b4_body)
}
#let b5_md = "对于每个激发构型$k c$，计算其与所有激发构型ia的总耦合强度（依据方程6）。构型$k c$表示电子从占据轨道$k$激发到虚拟轨道$c$的过程，并具有对角元素"
#let b5_body = block(width: 423pt)[#cmarker.render(b5_md, math: mitex)]
#context {
  let size = measure(b5_body)
  place(top + left, dx: 85pt, dy: 635pt + (41pt - size.height) / 2, b5_body)
}
