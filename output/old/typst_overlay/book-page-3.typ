#set page(width: 595.2760009765625pt, height: 841.8900146484375pt, margin: 0pt)
#set text(font: "Droid Sans Fallback", size: 11.5pt)
#import "@preview/cmarker:0.1.8"
#import "@preview/mitex:0.2.6": mitex
#show math.equation.where(block: false): set math.frac(style: "horizontal")
#let b0_md = "通用特性与要求"
#let b0_body = block(width: 240pt)[#cmarker.render(b0_md, math: mitex)]
#context {
  let size = measure(b0_body)
  place(top + left, dx: 86pt, dy: 82pt + (18pt - size.height) / 2, b0_body)
}
#let b1_md = "1 关于程序"
#let b1_body = block(width: 149pt)[#cmarker.render(b1_md, math: mitex)]
#context {
  let size = measure(b1_body)
  place(top + left, dx: 86pt, dy: 407pt + (16pt - size.height) / 2, b1_body)
}
#let b2_md = "std2程序是stda程序经过品牌重塑和更新后的版本。最初，stda仅用于实现基于Tamm-Dancoff近似（sTDA）方法的简化含时密度泛函理论[1]。随着更多简化量子化学（sQC）方法在stda中的实现，原程序名称已不再符合其应用范围。std2程序能够使用简化含时密度泛函理论（sTD-DFT）[2]、sTDA[1]、精确积分sTD-DFT（XsTD-DFT）[3,4]以及XsTDA[3,4]方法计算激发态和响应性质。该程序最初是作为TURBOMOLE程序套件[5,6]的附加组件开发的。"
#let b2_body = block(width: 421pt)[#cmarker.render(b2_md, math: mitex)]
#context {
  let size = measure(b2_body)
  place(top + left, dx: 85pt, dy: 433pt + (120pt - size.height) / 2, b2_body)
}
#let b3_md = "自1.2版本起，该程序使用包含笛卡尔GTO基组及分子轨道系数的Molden[7]输入文件。可处理由TURBOMOLE、MOLPRO[8]和TERACHEM$[ 9 ]$生成的Molden文件。GAUSSIAN[10]可通过接口工具g2molden（见第5节）使用，Q-CHEM[11]则通过qc2molden.sh（见第6节）使用。我们致力于使程序兼容不同的量子化学程序包，并欢迎相关建议。然而，在当前版本中，std2代码仅适用于笛卡尔GTO基函数，且量子化学软件必须提供笛卡尔基函数。光谱计算功能"
#let b3_body = block(width: 421pt)[#cmarker.render(b3_md, math: mitex)]
#context {
  let size = measure(b3_body)
  place(top + left, dx: 85pt, dy: 555pt + (109pt - size.height) / 2, b3_body)
}
