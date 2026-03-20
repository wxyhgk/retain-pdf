#set page(width: 595.2760009765625pt, height: 841.8900146484375pt, margin: 0pt)
#set text(font: "Droid Sans Fallback", size: 11.5pt)
#import "@preview/cmarker:0.1.8"
#import "@preview/mitex:0.2.6": mitex
#show math.equation.where(block: false): set math.frac(style: "horizontal")
#let b0_md = "$A _ { k c , k c } ^ { \\prime }$大于能量阈值。另一方面，构型${} _ { i a }$的对角元素$A _ { i a , i a } ^ { \\prime }$小于阈值，因此从一开始就被包含在矩阵$\\mathbf { A } ^ { \\prime }$中。"
#let b0_body = block(width: 421pt)[#cmarker.render(b0_md, math: mitex)]
#context {
  let size = measure(b0_body)
  place(top + left, dx: 85pt, dy: 84pt + (41pt - size.height) / 2, b0_body)
}
#let b1_md = "如果构型$k c$的总耦合将被包含（默认：$k c$与所有构型$E _ { t h r } ^ { ( 2 ) } = 1 0 ^ { - 4 } E _ { h } ,$）。${} _ { i a }$大于$E _ { t h r } ^ { ( 2 ) }$"
#let b1_body = block(width: 421pt)[#cmarker.render(b1_md, math: mitex)]
#context {
  let size = measure(b1_body)
  place(top + left, dx: 85pt, dy: 125pt + (32pt - size.height) / 2, b1_body)
}
#let b2_md = "2.2 简化时变密度泛函理论"
#let b2_body = block(width: 328pt)[#cmarker.render(b2_md, math: mitex)]
#context {
  let size = measure(b2_body)
  place(top + left, dx: 86pt, dy: 171pt + (15pt - size.height) / 2, b2_body)
}
#let b3_md = "以同样的简化方式，完整的TD-DFT问题（方程1）可以求解$[ 2 ]$。简化矩阵$\\mathbf { B ^ { \\prime } }$的元素如下："
#let b3_body = block(width: 423pt)[#cmarker.render(b3_md, math: mitex)]
#context {
  let size = measure(b3_body)
  place(top + left, dx: 85pt, dy: 191pt + (29pt - size.height) / 2, b3_body)
}
#let b4_md = "$a _ { x }$是密度泛函中非局域Fock交换的量（例如B3LYP为0.2）。这种方法已被证明能产生更可靠的跃迁矩，因此比sTDA提供更好的UV/VIS和ECD光谱（更多信息见参考文献2）。"
#let b4_body = block(width: 421pt)[#cmarker.render(b4_md, math: mitex)]
#context {
  let size = measure(b4_body)
  place(top + left, dx: 85pt, dy: 270pt + (40pt - size.height) / 2, b4_body)
}
#let b5_md = "$\\alpha$和$\\beta$参数（见方程4和5）在sTDA和sTD-DFT中是相同的。因此，$\\gamma _ { A B } ^ { J }$和$\\gamma _ { A B } ^ { K }$在两种方法中相同。矩阵$\\mathbf { A } ^ { \\prime }$和$\\mathbf { B ^ { \\prime } }$的维度也是如此，即执行与sTDA相同的构型选择。"
#let b5_body = block(width: 420pt)[#cmarker.render(b5_md, math: mitex)]
#context {
  let size = measure(b5_body)
  place(top + left, dx: 86pt, dy: 311pt + (40pt - size.height) / 2, b5_body)
}
#let b6_md = "2.3 简化的线性和二次响应理论"
#let b6_body = block(width: 298pt)[#cmarker.render(b6_md, math: mitex)]
#context {
  let size = measure(b6_body)
  place(top + left, dx: 86pt, dy: 366pt + (14pt - size.height) / 2, b6_body)
}
#let b7_md = "线性响应矩阵方程与方程1类似，当通过对外加电场$\\big ( { \\frac { \\partial } { \\partial F _ { \\zeta } } } \\big | _ { \\vec { F } = 0 } \\big )$取一阶导数来开启微扰时："
#let b7_body = block(width: 421pt)[#cmarker.render(b7_md, math: mitex)]
#context {
  let size = measure(b7_body)
  place(top + left, dx: 85pt, dy: 387pt + (45pt - size.height) / 2, b7_body)
}
#let b8_md = "其中密度矩阵一阶微扰的导数定义了频率相关的响应向量$\\begin{array} { r } { \\frac { \\partial D _ { a i } ^ { ( 1 ) } ( \\omega ) } { \\partial { \\cal F } _ { \\zeta } } | _ { \\vec { F } = 0 } = X _ { \\zeta , a i } ( \\omega ) + Y _ { \\zeta , a i } ( \\omega ) } \\end{array}$，且其中$\\mu _ { \\zeta , a i } = \\langle \\phi _ { a } | { \\hat { \\mu } } _ { \\zeta } | \\phi _ { i } \\rangle$。在sTD-DFT框架中，用于计算极化率和第一超极化率的线性响应向量[15]通过求解方程8获得："
#let b8_body = block(width: 421pt)[#cmarker.render(b8_md, math: mitex)]
#context {
  let size = measure(b8_body)
  place(top + left, dx: 85pt, dy: 466pt + (75pt - size.height) / 2, b8_body)
}
#let b9_md = "极化率随后由下式确定"
#let b9_body = block(width: 198pt)[#cmarker.render(b9_md, math: mitex)]
#context {
  let size = measure(b9_body)
  place(top + left, dx: 86pt, dy: 562pt + (14pt - size.height) / 2, b9_body)
}
#let b10_md = "在sTD-DFT近似下，二次谐波生成的第一超极化率表示为"
#let b10_body = block(width: 420pt)[#cmarker.render(b10_md, math: mitex)]
#context {
  let size = measure(b10_body)
  place(top + left, dx: 85pt, dy: 619pt + (26pt - size.height) / 2, b10_body)
}
