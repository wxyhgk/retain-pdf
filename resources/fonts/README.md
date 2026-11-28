# Bundled Source Han Serif fonts

These unmodified fonts come from Adobe's Source Han Serif 2.003R release:

- Upstream: https://github.com/adobe-fonts/source-han-serif
- Release files: https://github.com/adobe-fonts/source-han-serif/tree/release/OTF/SimplifiedChinese
- License: SIL Open Font License 1.1; see `LICENSE-OFL-1.1.txt`

Tracked files:

| File | SHA-256 |
| --- | --- |
| `SourceHanSerifSC-Regular.otf` | `78aa7a328fd974df2d688c8a9fd74a33d8334dfa84ab24d9d11efb2ffc464117` |
| `SourceHanSerifSC-Bold.otf` | `706b8c0de2deff6cbc0c87e2cdedfd33a78b7ffd76cebb4549012f197ba611fe` |

## RetainPDF Serif SC W300 (derived)

`RetainPDFSerifSC-W300.otf` is a static instance of Source Han Serif SC's variable font at weight 300,
used for the body text of translated PDFs (2026-11-28: PDF viewers embolden embedded fonts with font
smoothing, so the PDF looked heavier than the reader's HTML page; the user picked 300 from samples).

- Made from `Variable/OTF/SourceHanSerifSC-VF.otf` (Source Han Serif 2.003, release branch of the upstream
  repository) with `scripts/instance-source-han-serif.py` in retain-pdf-rendering (fontTools instancer,
  CFF2 converted to CID-keyed CFF).
- It is a Modified Version under the OFL. The license reserves the font name "Source", so the instance is
  named RetainPDF Serif SC (PostScript name `RetainPDFSerifSC-W300`); Adobe's copyright and license notices
  are kept in the font, and it is distributed under the same OFL 1.1.
- SHA-256 `1df6d4f8eea80b25d9401e943a9982a853cf41739e22dd448e857f029ae72970`.

Apart from that derived instance, the font binaries are redistributed without modification. They are not covered by
RetainPDF's project license; their redistribution terms are the accompanying OFL.
