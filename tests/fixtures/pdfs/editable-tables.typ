// Synthetic test document for table translation.
// All content (study, data, authors, institutions) is invented.

#set document(
  title: "Niobium Phosphate Surface Coatings for Lithium-Rich Layered Oxide Cathodes",
  author: ("Mara L. Ostrander", "Tobias J. Wennerholm", "Priya S. Halvorsen"),
)
#set page(
  paper: "a4",
  margin: (x: 2.3cm, top: 2.4cm, bottom: 2.4cm),
  numbering: "1",
  number-align: center,
)
#set text(font: "Libertinus Serif", size: 10.5pt, lang: "en")
#set par(justify: true, leading: 0.62em, spacing: 0.9em, first-line-indent: (amount: 1.2em, all: false))
#show heading.where(level: 1): it => {
  set text(size: 12pt, weight: "bold")
  v(1.3em, weak: true)
  it
  v(0.5em, weak: true)
}
#show heading.where(level: 2): it => {
  set text(size: 10.5pt, weight: "bold", style: "italic")
  v(1.0em, weak: true)
  it
  v(0.4em, weak: true)
}
#set heading(numbering: "1.1")
#show table: set par(justify: false)
#show table: set text(hyphenate: false)

// ---------- table helpers ----------
#let thick = 0.9pt
#let thin = 0.5pt
#let toprule = table.hline(stroke: thick)
#let midrule = table.hline(stroke: thin)
#let bottomrule = table.hline(stroke: thick)
#let cmid(start, end) = table.hline(start: start, end: end, stroke: thin)

#let caption(num, body) = block(width: 100%, above: 0pt, below: 0.55em)[
  #set par(justify: false, first-line-indent: 0pt)
  #set text(size: 9.5pt)
  *Table #num.* #body
]
#let tnote(body) = block(width: 100%, above: 0.45em, below: 0pt)[
  #set par(justify: false, first-line-indent: 0pt, spacing: 0.3em)
  #set text(size: 8.5pt)
  #body
]
#let fn(m) = super[#m]

// ---------- title block ----------
#align(center)[
  #block(below: 0.8em)[
    #set text(size: 16pt, weight: "bold")
    #set par(justify: false)
    Niobium Phosphate Surface Coatings for Lithium-Rich Layered \ Oxide Cathodes: Cycling Stability, Kinetics and Voltage Decay
  ]
  #block(below: 0.4em)[
    #set text(size: 11pt)
    Mara L. Ostrander#super[1], Tobias J. Wennerholm#super[1,2], Priya S. Halvorsen#super[2]
  ]
  #block(below: 1.2em)[
    #set text(size: 9pt, style: "italic")
    #super[1]Department of Energy Materials, Northvale Institute of Technology, Lindqvist, Fictland \
    #super[2]Coastal Laboratory for Electrochemical Storage, Port Averell, Fictland
  ]
]

#block(inset: (x: 1.2cm), below: 1.2em)[
  #set par(first-line-indent: 0pt)
  #set text(size: 9.5pt)
  *Abstract.* Lithium-rich layered oxides offer specific capacities above 250 mAh g#super[−1], but their
  practical use is limited by surface degradation, transition-metal dissolution and a gradual decay of the
  average discharge voltage. In this work we compare three routes for depositing an amorphous niobium
  phosphate (NbPO#sub[4]) layer on Li#sub[1.2]Ni#sub[0.2]Mn#sub[0.6]O#sub[2] particles: a wet-chemical
  sol–gel process, atomic layer deposition (ALD) and a dry mechanofusion step. Coatings between 2 and 9 nm
  thick were evaluated in coin cells over 200 cycles at 25 °C. The ALD-coated material retained 91.4% of its
  initial capacity, compared with 72.8% for the uncoated reference, and the voltage decay was reduced by
  roughly one third. Impedance and titration measurements indicate that the coating suppresses the growth of
  the cathode–electrolyte interphase without slowing lithium diffusion. All data reported here are tabulated
  in full to support independent comparison.

  *Keywords:* lithium-rich cathode; surface coating; niobium phosphate; atomic layer deposition; voltage decay
]

= Introduction

Layered oxide cathodes with an excess of lithium in the transition-metal layer have attracted sustained
interest because the additional oxygen redox activity raises the accessible capacity well beyond that of
conventional nickel-rich materials. The same oxygen activity, however, makes the particle surface reactive
towards the liquid electrolyte. Released oxygen species oxidise the solvent, acidic by-products attack the
oxide, and manganese ions dissolve and migrate to the anode. Over many cycles these processes lower the
capacity and shift the discharge plateau to lower voltages.

Thin inorganic coatings are a common mitigation strategy. An ideal coating is chemically inert, conducts
lithium ions, and is thin enough not to add significant mass or impedance. Phosphates of high-valence
metals are attractive because the strong P–O bonds resist attack by hydrofluoric acid. In this report we
focus on niobium phosphate and ask a practical question: does the deposition method matter more than the
coating thickness? Section 2 describes the materials and methods, Section 3 presents the electrochemical
results, and Section 4 discusses the kinetic data and the remaining limitations.

Previous reports on phosphate coatings have often varied several parameters at once, such as the
annealing temperature, the coating fraction and the electrolyte, which makes it difficult to attribute an
improvement to a single cause. We have therefore kept the cathode powder, the electrode formulation and
the test protocol identical for all samples, and changed only the coating route and the coating thickness.
Wherever possible, each value is the mean of at least three independent cells, and the individual results
are reported in full so that readers can judge the scatter themselves.

= Materials and Methods

== Synthesis of the pristine cathode

The pristine Li#sub[1.2]Ni#sub[0.2]Mn#sub[0.6]O#sub[2] powder was prepared by co-precipitation of a
carbonate precursor followed by calcination with lithium carbonate at 900 °C for 12 h in air. The
resulting secondary particles had a median diameter of about 9 µm. Four batches were produced to check
reproducibility; their basic properties are listed in Table 1.

#place(auto, float: true, clearance: 1.4em, block(breakable: false, width: 100%)[
#set align(left)
#caption(1)[Basic properties of four pristine cathode batches.]
#table(
  columns: (1.4fr, 1.6fr, 1.6fr, 1.4fr),
  align: (left, center, center, center),
  stroke: none,
  inset: (x: 6pt, y: 4.5pt),
  toprule,
  table.header(
    [*Batch*], [*Capacity (mAh g#super[−1])*], [*Initial efficiency (%)*], [*Tap density (g cm#super[−3])*],
  ),
  midrule,
  [B-01], [268.4], [84.1], [1.92],
  [B-02], [265.9], [83.7], [1.95],
  [B-03], [270.2], [85.0], [1.89],
  [B-04], [266.7], [84.4], [1.93],
  [Mean], [267.8], [84.3], [1.92],
  bottomrule,
)
#tnote[
  #fn[a] Measured at 25 °C between 2.0 and 4.8 V at a rate of 0.1C (1C = 250 mA g#super[−1]). \
  #fn[b] Tap density after 3000 taps in a 10 mL graduated cylinder.
]
])

== Coating procedures

Three coating routes were used. In the wet route, the powder was dispersed in an ethanol solution of
niobium ethoxide and ammonium dihydrogen phosphate, dried, and annealed. In the ALD route, alternating
pulses of a niobium precursor and trimethyl phosphate were applied in a fluidised-bed reactor. In the dry
route, nanosized NbPO#sub[4] powder was fused onto the particles in a high-shear mixer. The principles and
practical trade-offs of the three methods are summarised in Table 2.

#place(auto, float: true, clearance: 1.4em, block(breakable: false, width: 100%)[
#set align(left)
#caption(2)[Comparison of the three coating routes used in this study.]
#table(
  columns: (1.05fr, 2fr, 1.8fr, 1.8fr),
  align: (left + top, left + top, left + top, left + top),
  stroke: none,
  inset: (x: 5pt, y: 4.5pt),
  toprule,
  table.header([*Method*], [*Principle*], [*Advantages*], [*Limitations*]),
  midrule,
  [Wet sol–gel],
  [Particles are soaked in a precursor solution, dried, and annealed at 450 °C so that an amorphous layer forms.],
  [Simple equipment; easy to scale up; thickness can be adjusted by the precursor concentration.],
  [Layer is often uneven; residual solvent may react with the surface during annealing.],
  [Atomic layer deposition],
  [Two gaseous precursors react with the surface one after the other, adding less than one atomic layer per cycle.],
  [Very uniform and conformal coating; thickness is controlled with sub-nanometre precision.],
  [Slow and expensive; requires vacuum equipment and careful handling of reactive precursors.],
  [Dry mechanofusion],
  [Fine coating powder is pressed onto the larger cathode particles by strong shear forces in a mixer.],
  [No solvent and no annealing; fast and inexpensive.],
  [Coverage is incomplete; the mechanical stress can crack the secondary particles.],
  bottomrule,
)
#tnote[
  #fn[a] Typical batch size in our laboratory: 200 g (wet), 20 g (ALD), 500 g (dry).
]
])

== Electrochemical testing

Electrodes were cast from a slurry of 90 wt% active material, 5 wt% carbon black and 5 wt% binder on
aluminium foil. CR2032 coin cells were assembled in an argon glovebox with lithium metal counter
electrodes and 1 M LiPF#sub[6] in a carbonate electrolyte. Unless stated otherwise, cells were cycled at
0.5C after two formation cycles at 0.1C. Impedance spectra were recorded at 50% state of charge, and
diffusion coefficients were obtained by the galvanostatic intermittent titration technique (GITT).

Before each test series, a reference cell with the pristine powder was assembled from the same electrolyte
bottle and the same lithium foil to rule out batch effects in the consumables. Cells whose open-circuit
voltage after resting for 12 h deviated by more than 30 mV from the group mean were discarded before
cycling; this affected four of the 85 cells assembled in total. All potentials in this report are given
against the Li#super[+]/Li couple.

= Results

== Capacity and efficiency over cycling

Table 3 compares the charge and discharge capacities of the four sample types in the first cycle and after
100 cycles. All coated samples deliver a slightly lower first-cycle capacity than the pristine material,
which is expected because the coating itself is electrochemically inactive. After 100 cycles the order is
reversed: the ALD-coated sample retains the largest discharge capacity, followed by the wet-coated sample.

#place(auto, float: true, clearance: 1.4em, block(breakable: false, width: 100%)[
#set align(left)
#caption(3)[Charge and discharge capacities (mAh g#super[−1]) in the first and the 100th cycle.]
#table(
  columns: (1.6fr, 1fr, 1fr, 1fr, 1fr, 1.2fr),
  align: (left, center, center, center, center, center),
  stroke: none,
  inset: (x: 6pt, y: 4.5pt),
  toprule,
  table.header(
    table.cell(rowspan: 2, align: left + horizon)[*Sample*],
    table.cell(colspan: 2)[*Cycle 1*],
    table.cell(colspan: 2)[*Cycle 100*],
    table.cell(rowspan: 2, align: center + horizon)[*Retention (%)*],
    cmid(1, 3), cmid(3, 5),
    [Charge], [Discharge], [Charge], [Discharge],
  ),
  midrule,
  [Pristine], [319.6], [268.4], [203.1], [199.8], [74.4],
  [Wet-coated], [311.2], [262.0], [228.7], [225.9], [86.2],
  [ALD-coated], [306.8], [259.5], [240.3], [237.6], [91.6],
  [Dry-coated], [314.5], [264.1], [214.9], [211.0], [79.9],
  bottomrule,
)
#tnote[
  #fn[a] Mean of three cells per sample; the standard deviation was below 2.5 mAh g#super[−1] in all cases. \
  #fn[b] Retention is the discharge capacity in cycle 100 divided by that in cycle 1.
]
])

== Influence of coating thickness

For each coating route, three thicknesses were prepared. The thickness was estimated from transmission
electron microscopy on at least twenty particles. Table 4 groups the results by coating route. For the
wet and ALD routes there is a clear optimum near 4–5 nm; thicker layers increase the polarisation and
reduce the capacity at high rate. For the dry route, the effect of thickness is weak because the coverage
remains incomplete in all cases.

The capacity at 5C is particularly sensitive to the coating. A thin ALD layer of 3.9 nm raises it by
roughly 18% relative to the pristine material, whereas the thickest wet coating lowers it by about 8%. We
attribute the improvement at moderate thickness to a more stable interphase, which keeps the surface
resistance low during the rate test, and the decline at larger thickness to the limited ionic conductivity
of the amorphous phosphate itself.

#place(auto, float: true, clearance: 1.4em, block(breakable: false, width: 100%)[
#set align(left)
#caption(4)[Effect of coating thickness on rate capability, grouped by coating route.]
#table(
  columns: (1.5fr, 1.2fr, 1.2fr, 1.2fr, 1.2fr),
  align: (left + horizon, center + horizon, center + horizon, center + horizon, center + horizon),
  stroke: 0.5pt,
  inset: (x: 6pt, y: 5pt),
  table.header(
    [*Coating route*], [*Thickness (nm)*], [*0.1C (mAh g#super[−1])*], [*2C (mAh g#super[−1])*], [*5C (mAh g#super[−1])*],
  ),
  [None (pristine)], [—], [268.4], [181.2], [132.6],
  table.cell(rowspan: 3)[Wet sol–gel], [2.1], [265.3], [186.4], [140.1],
  [4.6], [262.0], [190.8], [146.7],
  [8.9], [255.7], [172.3], [121.5],
  table.cell(rowspan: 3)[Atomic layer deposition], [1.8], [263.9], [192.5], [149.8],
  [3.9], [259.5], [197.1], [156.2],
  [7.2], [251.8], [183.0], [137.4],
  table.cell(rowspan: 2)[Dry mechanofusion], [5 ± 3], [264.1], [179.6], [130.9],
  [9 ± 4], [261.4], [176.2], [127.3],
)
#tnote[
  #fn[a] Thickness of the mechanofusion coatings varies strongly between particles; the range is one standard deviation.
]
])

== Composition and transport properties

To place the results in context, we measured the ionic conductivity and the change of average discharge
voltage for the coated material, the pristine cathode, and three reference cathodes prepared in the same
laboratory. The values in Table 5 show that the NbPO#sub[4] layer adds little resistance and that the voltage
fade of the coated lithium-rich material approaches that of conventional layered oxides.
The activation energy for ionic transport changes only marginally upon coating, which again points to a
surface effect rather than a change in the bulk.

#place(auto, float: true, clearance: 1.4em, block(breakable: false, width: 100%)[
#set align(left)
#caption(5)[Composition, conductivity and voltage stability of the coated cathode and reference materials.]
#table(
  columns: (1.6fr, 0.95fr, 1.55fr, 1.05fr, 0.75fr, 1.3fr),
  align: (left, center, center, center, center, center),
  stroke: none,
  inset: (x: 5pt, y: 4.5pt),
  toprule,
  table.header(
    [*Material*],
    [*Coating*],
    [*$sigma$ (S cm#super[−1])*],
    [*$Delta V$#sub[200] (mV)*],
    [*$E_a$ (eV)*],
    [*Retention (%)*],
  ),
  midrule,
  [LiFePO#sub[4]], [Carbon], [(2.3 ± 0.4) × 10#super[−9]], [−8 ± 2], [0.54], [98.1],
  [LiNi#sub[0.8]Mn#sub[0.1]Co#sub[0.1]O#sub[2]], [None], [(1.1 ± 0.2) × 10#super[−5]], [−41 ± 5], [0.38], [88.6],
  [LiMn#sub[2]O#sub[4]], [Al#sub[2]O#sub[3]], [(4.7 ± 0.6) × 10#super[−6]], [−22 ± 4], [0.43], [90.3],
  [Li#sub[1.2]Ni#sub[0.2]Mn#sub[0.6]O#sub[2]], [None], [(3.8 ± 0.5) × 10#super[−7]], [−312 ± 18], [0.61], [72.8],
  [Li#sub[1.2]Ni#sub[0.2]Mn#sub[0.6]O#sub[2]], [NbPO#sub[4]], [(3.5 ± 0.4) × 10#super[−7]], [−204 ± 11], [0.59], [91.4],
  bottomrule,
)
#tnote[
  #fn[a] $sigma$: room-temperature ionic conductivity of pressed pellets; $E_a$: activation energy from measurements between 0 and 60 °C. \
  #fn[b] $Delta V$#sub[200]: change of the average discharge voltage after 200 cycles; cells with $Delta V$#sub[200] ≤ −100 mV were classed as unstable. \
  #fn[c] Coating fraction for the NbPO#sub[4] sample ≈ 1.5 wt%.
]
])

= Discussion

== Kinetic and interfacial parameters

A coating that protects the surface but blocks lithium transport would be of little practical value.
We therefore extracted the lithium diffusion coefficient, the charge-transfer resistance and the resistance of
the surface film for all four sample types before and after cycling. Table 6 collects these values together
with physical properties and the amount of manganese found on the lithium anode after 200 cycles. The
diffusion coefficients of all samples lie within a factor of two, which indicates that the coating does not
limit bulk transport. In contrast, the growth of the surface film resistance during cycling is reduced by
more than half in the ALD-coated sample.

The amount of manganese detected on the anode follows the same order as the capacity retention. This
correlation is consistent with the view that dissolved manganese, once deposited on the negative
electrode, catalyses further electrolyte decomposition and thus accelerates the loss of cyclable lithium.
The dry-coated sample, whose coverage is incomplete, shows an intermediate value.

#place(auto, float: true, clearance: 1.4em, block(breakable: false, width: 100%)[
#set align(left)
#caption(6)[Kinetic, interfacial and physical parameters of the four sample types before and after 200 cycles.]
#block[
  #set text(size: 8.5pt)
  #table(
    columns: (1.25fr, 1.25fr, 0.95fr, 0.95fr, 0.95fr, 0.95fr, 0.95fr, 1fr),
    align: (left, center, center, center, center, center, center, center),
    stroke: none,
    inset: (x: 4pt, y: 4pt),
    toprule,
    table.header(
      table.cell(rowspan: 2, align: left + horizon)[*Sample*],
      table.cell(rowspan: 2, align: center + horizon)[*D#sub[Li] (cm#super[2] s#super[−1])*],
      table.cell(colspan: 2)[*R#sub[ct] (Ω)*],
      table.cell(colspan: 2)[*R#sub[SEI] (Ω)*],
      table.cell(rowspan: 2, align: center + horizon)[*BET area (m#super[2] g#super[−1])*],
      table.cell(rowspan: 2, align: center + horizon)[*Mn on anode (ppm)*],
      cmid(2, 4), cmid(4, 6),
      [Before], [After], [Before], [After],
    ),
    midrule,
    [Pristine], [2.4 × 10#super[−12]], [38.2], [164.5], [11.6], [87.3], [3.41], [412],
    [Wet-coated], [2.1 × 10#super[−12]], [41.7], [96.8], [12.9], [44.1], [3.18], [188],
    [ALD-coated], [2.2 × 10#super[−12]], [40.3], [71.4], [12.2], [33.6], [3.27], [121],
    [Dry-coated], [1.6 × 10#super[−12]], [45.9], [128.0], [14.8], [65.2], [2.86], [305],
    bottomrule,
  )
]
#tnote[
  #fn[a] D#sub[Li] from GITT at 50% state of charge; R#sub[ct] and R#sub[SEI] from fitting impedance spectra to an equivalent circuit. \
  #fn[b] Mn on anode: manganese content of the lithium counter electrode, determined by inductively coupled plasma analysis.
]
])

== Reproducibility across individual cells

Because coin-cell results can scatter considerably, we report every cell that completed the 200-cycle test
rather than only the best ones. Table 7 lists the mass loading, the electrolyte, the first-cycle discharge
capacity and the retention for each cell, together with a short remark where something unusual was noticed
during assembly or testing. Cells that failed before cycle 200 are included and marked. Overall, the spread
within each group is small compared with the differences between groups, which supports the conclusions
drawn from the averaged data above.

#v(1.0em)
#metadata(none) <t7-start>
#caption(7)[Results of all individual coin cells tested for 200 cycles at 0.5C and 25 °C.]
#{
  let rows = (
    ("P-01", "Pristine", "8.1", "Std", "268.9", "73.5", "—"),
    ("P-02", "Pristine", "8.3", "Std", "267.2", "72.1", "—"),
    ("P-03", "Pristine", "7.9", "Std", "269.4", "74.0", "—"),
    ("P-04", "Pristine", "8.0", "FEC", "266.8", "78.9", "Additive improves retention"),
    ("P-05", "Pristine", "8.2", "FEC", "267.5", "79.6", "—"),
    ("P-06", "Pristine", "12.4", "Std", "262.1", "68.3", "High loading"),
    ("W-01", "Wet", "8.0", "Std", "262.4", "86.9", "—"),
    ("W-02", "Wet", "8.2", "Std", "261.7", "85.8", "—"),
    ("W-03", "Wet", "8.1", "Std", "263.0", "86.4", "—"),
    ("W-04", "Wet", "7.8", "FEC", "260.9", "88.7", "—"),
    ("W-05", "Wet", "8.3", "FEC", "261.5", "89.1", "—"),
    ("W-06", "Wet", "12.2", "Std", "255.3", "81.2", "High loading"),
    ("W-07", "Wet", "8.0", "Std", "259.8", "—", "Short circuit at cycle 143"),
    ("A-01", "ALD", "8.1", "Std", "259.9", "91.7", "—"),
    ("A-02", "ALD", "7.9", "Std", "258.8", "91.2", "—"),
    ("A-03", "ALD", "8.2", "Std", "260.3", "92.0", "—"),
    ("A-04", "ALD", "8.0", "FEC", "258.1", "93.4", "Best cell in this study"),
    ("A-05", "ALD", "8.1", "FEC", "259.0", "92.8", "—"),
    ("A-06", "ALD", "12.5", "Std", "253.6", "87.5", "High loading"),
    ("A-07", "ALD", "8.0", "Std", "257.4", "90.6", "Separator slightly wrinkled"),
    ("D-01", "Dry", "8.2", "Std", "264.6", "80.3", "—"),
    ("D-02", "Dry", "8.0", "Std", "263.8", "79.1", "—"),
    ("D-03", "Dry", "8.1", "Std", "264.9", "80.8", "—"),
    ("D-04", "Dry", "7.9", "FEC", "262.7", "83.5", "—"),
    ("D-05", "Dry", "8.3", "FEC", "263.2", "84.0", "—"),
    ("D-06", "Dry", "12.3", "Std", "257.9", "74.6", "High loading"),
    ("D-07", "Dry", "8.1", "Std", "262.0", "—", "Gas evolution, test stopped"),
    ("D-08", "Dry", "8.0", "Std", "263.5", "78.4", "Cracked particles seen in SEM"),
    ("D-09", "Dry", "8.2", "FEC", "262.9", "82.7", "—"),
    ("R-01", "Pristine", "8.0", "Std", "268.1", "73.0", "Reference cell, series 2"),
    ("R-02", "Pristine", "8.1", "Std", "267.9", "72.6", "Reference cell, series 3"),
    ("R-03", "Pristine", "8.0", "Std", "268.6", "73.8", "Reference cell, series 4"),
  )
  set text(size: 9.5pt)
  table(
    columns: (0.65fr, 0.9fr, 1.45fr, 1.05fr, 1.55fr, 1.05fr, 2.45fr),
    align: (left, left, center, center, center, center, left),
    stroke: none,
    inset: (x: 5pt, y: 3.6pt),
    table.header(
      table.cell(colspan: 7, inset: 0pt, stroke: none, align: left, context {
        if here().page() > locate(<t7-start>).page() {
          pad(bottom: 0.55em)[
            #set text(size: 9.5pt)
            *Table 7 (continued).* Results of all individual coin cells tested for 200 cycles.
          ]
        }
      }),
      toprule,
      [*Cell*], [*Coating*], [*Loading (mg cm#super[−2])*], [*Electrolyte*], [*Initial capacity (mAh g#super[−1])*], [*Retention (%)*], [*Remarks*],
      midrule,
      repeat: true,
    ),
    ..rows.map(r => r.map(c => [#c])).flatten(),
    bottomrule,
  )
}
#tnote[
  #fn[a] Std: 1 M LiPF#sub[6] in ethylene carbonate / ethyl methyl carbonate (3:7 by volume); FEC: the same with 5 wt% fluoroethylene carbonate. \
  #fn[b] A dash in the retention column means the cell did not reach cycle 200.
]

== Limitations

The present study is limited to coin cells with lithium metal counter electrodes and a single temperature.
Full cells with graphite anodes may behave differently, because manganese deposited on graphite has a
stronger effect on the interphase than on lithium metal. The ALD route also remains costly at the batch
sizes used here, and a scaled process would need to be verified separately.

= Conclusions

An amorphous NbPO#sub[4] coating improves the cycling stability of a lithium-rich layered oxide cathode
without reducing lithium diffusion. The deposition method matters more than the exact thickness: the
conformal ALD layer gives the highest retention and the lowest manganese dissolution, while the dry route
offers only modest gains. A thickness of about 4 nm is a good compromise between protection and rate
capability. Future work will examine full cells and elevated temperatures.

#v(0.6em)
#block[
  #set par(first-line-indent: 0pt)
  #set text(size: 9pt)
  *Data availability.* This document is a synthetic test file. The study, the authors, the institutions and
  all numerical values are fictitious and were created only to test document-processing software.
]
