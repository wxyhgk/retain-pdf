#set page(width: 595.2760009765625pt, height: 841.8900146484375pt, margin: 0pt)
#set text(font: "Droid Sans Fallback", size: 11.5pt)
#import "@preview/cmarker:0.1.8"
#import "@preview/mitex:0.2.6": mitex
#show math.equation.where(block: false): set math.frac(style: "horizontal")
#let b0_md = "即，直接从$\\mathbf { X } _ { T D A }$特征向量得出。自版本1.5起，默认使用A+B/2校正向量（详见参考文献[14]），这使得即使对于其他方法在Tamm-Dancoff近似下存在问题的体系，也能可靠计算电子圆二色谱[31]。"
#let b0_body = block(width: 421pt)[#cmarker.render(b0_md, math: mitex)]
#context {
  let size = measure(b0_body)
  place(top + left, dx: 85pt, dy: 84pt + (54pt - size.height) / 2, b0_body)
}
#let b1_md = "-resp <#wav>"
#let b1_body = block(width: 74pt)[#cmarker.render(b1_md, math: mitex)]
#context {
  let size = measure(b1_body)
  place(top + left, dx: 86pt, dy: 153pt + (13pt - size.height) / 2, b1_body)
}
#let b2_md = "要计算sTD-DFT频率依赖的极化率和二次谐波产生的一阶超极化率，您需要在目录中创建一个名为wavelength的文件，其中包含所需的波长。在-resp参数后指定波长数量。-resp参数隐含了-rpa参数。使用比激发态稍大的能量窗口（高于10 eV，15 eV效果良好）。"
#let b2_body = block(width: 422pt)[#cmarker.render(b2_md, math: mitex)]
#context {
  let size = measure(b2_body)
  place(top + left, dx: 86pt, dy: 179pt + (69pt - size.height) / 2, b2_body)
}
#let b3_md = "-aresp <#wav>"
#let b3_body = block(width: 78pt)[#cmarker.render(b3_md, math: mitex)]
#context {
  let size = measure(b3_body)
  place(top + left, dx: 86pt, dy: 262pt + (12pt - size.height) / 2, b3_body)
}
#let b4_md = "与前述论证相同，但仅计算sTD-DFT频率依赖性极化率。"
#let b4_body = block(width: 420pt)[#cmarker.render(b4_md, math: mitex)]
#context {
  let size = measure(b4_body)
  place(top + left, dx: 86pt, dy: 288pt + (27pt - size.height) / 2, b4_body)
}
#let b5_md = "-oprot"
#let b5_body = block(width: 39pt)[#cmarker.render(b5_md, math: mitex)]
#context {
  let size = measure(b5_body)
  place(top + left, dx: 86pt, dy: 330pt + (12pt - size.height) / 2, b5_body)
}
#let b6_md = "计算sTD-DFT频率依赖的分子光学旋转，采用长度形式。使用-oprot 1参数可切换至速度表示。默认情况下，程序将在钠D线（589.3 nm）波长处计算响应，但您也可以在目录中放置名为“wavelength”的文件来指定所需波长。程序将读取“wavelength”文件的行数以确定用于光学旋转评估的波长数量。"
#let b6_body = block(width: 420pt)[#cmarker.render(b6_md, math: mitex)]
#context {
  let size = measure(b6_body)
  place(top + left, dx: 86pt, dy: 355pt + (81pt - size.height) / 2, b6_body)
}
#let b7_md = "-2PA <#states>"
#let b7_body = block(width: 84pt)[#cmarker.render(b7_md, math: mitex)]
#context {
  let size = measure(b7_body)
  place(top + left, dx: 86pt, dy: 451pt + (11pt - size.height) / 2, b7_body)
}
#let b8_md = "要计算sTD-DFT双光子吸收截面，只需在-2PA参数后指定所需的状态数量。注意，指定的状态数量必须小于或等于在给定能量阈值下sTD-DFT级别计算的状态数量。进行双光子吸收计算时，仅计算双光子吸收截面。由于激发和去激发矢量的归一化方式改变，线性性质不可用。要计算振子强度或旋转强度，应运行不带-2PA <#states>选项的std2。"
#let b8_body = block(width: 421pt)[#cmarker.render(b8_md, math: mitex)]
#context {
  let size = measure(b8_body)
  place(top + left, dx: 86pt, dy: 477pt + (94pt - size.height) / 2, b8_body)
}
#let b9_md = "-s2s <#state>"
#let b9_body = block(width: 78pt)[#cmarker.render(b9_md, math: mitex)]
#context {
  let size = measure(b9_body)
  place(top + left, dx: 86pt, dy: 587pt + (10pt - size.height) / 2, b9_body)
}
#let b10_md = "要使用未弛豫态间跃迁偶极矩计算激发态吸收光谱，请使用-s2s参数，后跟参考态编号。"
#let b10_body = block(width: 420pt)[#cmarker.render(b10_md, math: mitex)]
#context {
  let size = measure(b10_body)
  place(top + left, dx: 86pt, dy: 613pt + (27pt - size.height) / 2, b10_body)
}
#let b11_md = "-sf"
#let b11_body = block(width: 21pt)[#cmarker.render(b11_md, math: mitex)]
#context {
  let size = measure(b11_body)
  place(top + left, dx: 86pt, dy: 655pt + (9pt - size.height) / 2, b11_body)
}
