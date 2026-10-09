# Fallback fonts

The faces Typst 0.15.1 embeds and falls back to for characters Source Han
Serif SC lacks (superscript digits, Latin Extended letters, Greek, math
symbols ...). The PDF output (`src/output/pdf`) draws those characters with
them, and the advance tables' `fallback` section (`scripts/build-fallback-table.js`)
records their widths, so measuring and drawing agree.

Unmodified files from typst-assets v0.15.1 (`files/fonts/`,
https://github.com/typst/typst-assets/tree/v0.15.1/files/fonts) -- the same
bytes the Typst 0.15.1 binary embeds. Upright regular and bold only.

| File | SHA-256 |
| --- | --- |
| `LibertinusSerif-Regular.otf` | `fcf06307a77367394fcb0ccb241e59eea70dba3d732be309647611224679c733` |
| `LibertinusSerif-Bold.otf` | `0264914210ed51b3231ebc92ce529e9f2e166ba9eebf0cd4a579558690a27b64` |
| `NewCM10-Regular.otf` | `328698d764ccdf7acf6bc1088aefd83a237f6a1d8b812de1e77ac5e4483bf3d1` |
| `NewCM10-Bold.otf` | `40b0b32b63655fe802679ee4a14adb29c762a4712095d9c84cf7df7852b5152e` |
| `NewCMMath-Regular.otf` | `d66ac1cc91c55c24d3636ae2df1238076debdff51841f9893fc5419cc2df3df7` |
| `NewCMMath-Bold.otf` | `c6c0e060da57d4f44274705afb956013047231dc62be5a4b02a351ab0dc43f2f` |
| `DejaVuSansMono.ttf` | `b4a6c3e4faab8773f4ff761d56451646409f29abedd68f05d38c2df667d3c582` |
| `DejaVuSansMono-Bold.ttf` | `bce60f1b4421acd9ea51ba6623d7024ecbe6817a953e3654df62a5e6bdf8f769` |

Licenses (full texts in `NOTICE`, copied from typst-assets):

- Libertinus Serif: SIL Open Font License 1.1.
- New Computer Modern: GUST Font License 1.0; NewCM10-Regular is GPL 3 or
  later with the Font Exception and Distribution Exception (embedding the
  font in a document does not put the document under the GPL).
- DejaVu Sans Mono: Bitstream Vera license; DejaVu changes are public domain.

These fonts are not covered by this repository's MIT license; their
redistribution terms are the ones above.
