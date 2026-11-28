# Fonts

- `source-han-serif-sc-{regular,bold}.json`: advance tables (`scripts/build-advance-table.js`,
  `scripts/build-fallback-table.js`); all the measurer needs.
- `source-han-serif-sc-w300.json`: the advance table of a static instance of Source Han Serif SC's
  variable font at weight 300 (`scripts/instance-source-han-serif.py`, then
  `scripts/build-advance-table.js`; `fallback` copied from the regular table), for
  `--pdf-font-weight 300`. The instance font itself is not here: the host passes it with `--font-path`
  (retain-pdf: resources/fonts/RetainPDFSerifSC-W300.otf). It is named RetainPDF Serif SC, not Source
  Han Serif: the OFL reserves the name "Source" and an instance is a modified version.
- `source-han-serif/`: Source Han Serif SC, the text face (SIL OFL 1.1, see its README).
- `fallback/`: Typst 0.15.1's embedded faces, for characters Source Han Serif lacks
  (licenses in its README / NOTICE).

The PDF output always searches these two directories after any `--font-path`
the caller gives, so the engine renders on its own. Hosts that already ship
Source Han Serif (retain-pdf's resources/fonts) keep passing it with
`--font-path`; `sync.sh` in retain-pdf leaves `source-han-serif/` out.
