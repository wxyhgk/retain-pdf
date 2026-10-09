# Fonts

- `source-han-serif-sc-{regular,bold}.json`: advance tables (`scripts/build-advance-table.js`,
  `scripts/build-fallback-table.js`); all the measurer needs.
- `source-han-serif/`: Source Han Serif SC, the text face (SIL OFL 1.1, see its README).
- `fallback/`: Typst 0.15.1's embedded faces, for characters Source Han Serif lacks
  (licenses in its README / NOTICE).

The PDF output always searches these two directories after any `--font-path`
the caller gives, so the engine renders on its own. Hosts that already ship
Source Han Serif (retain-pdf's resources/fonts) keep passing it with
`--font-path`; `sync.sh` in retain-pdf leaves `source-han-serif/` out.
