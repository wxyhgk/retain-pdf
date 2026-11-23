# RetainPDF: layout-preserving PDF translation

<p align="center">
  <a href="README.md">中文</a> · <a href="README.en.md">English</a> · <a href="README.vi.md">Tiếng Việt</a>
</p>

<p align="center">
  <img src="resources/brand/RetainPDF-github.svg" alt="RetainPDF" width="320" />
</p>

<p align="center">
  <a href="https://github.com/wxyhgk/retain-pdf/releases/latest"><img src="https://img.shields.io/github/v/release/wxyhgk/retain-pdf?label=latest&color=2563eb" alt="Release" /></a>
  <a href="https://github.com/wxyhgk/retain-pdf/releases"><img src="https://img.shields.io/github/downloads/wxyhgk/retain-pdf/total?label=downloads&color=16a34a" alt="Downloads" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-f59e0b" alt="MIT" /></a>
  <a href="https://github.com/wxyhgk/retain-pdf/actions/workflows/tests.yml"><img src="https://github.com/wxyhgk/retain-pdf/actions/workflows/tests.yml/badge.svg?branch=main" alt="Tests" /></a>
  <a href="https://github.com/wxyhgk/retain-pdf/stargazers"><img src="https://img.shields.io/github/stars/wxyhgk/retain-pdf?style=flat&color=eab308" alt="Stars" /></a>
</p>

Open-source PDF translation that keeps the layout, including scanned and image-only PDFs. Use the desktop app, or self-host with Docker.

- **Layout preserved**: formulas, multi-column pages, figures, headers and footers stay in place; inline formulas survive translation.
- **Scanned PDFs too**: OCR first, then translate, with or without a text layer.
- **Whole sentences, not boxes**: passages split across columns and pages are stitched back before translation; code, formulas and proper nouns are protected, and glossaries pin down terms.
- **Agent translation**: reads the whole book first to fix terms and style, then translates page by page and reviews every paragraph. Slower and costlier, for books you really need to read.

<p align="center">
  <img src="resources/brand/readme-gallery/translation-examples.webp" alt="RetainPDF translation examples: papers, scanned documents, textbooks" width="1000" />
</p>

<p align="center">
  <img src="resources/brand/readme-gallery/product/side-by-side-reader.png" alt="RetainPDF side-by-side reading" width="1000" />
</p>

## Download

From [Releases](https://github.com/wxyhgk/retain-pdf/releases/latest):

| System | File | Notes |
| --- | --- | --- |
| macOS | `RetainPDF-Mac-<version>.dmg` | Apple silicon (M1 and later), signed and notarized |
| Windows | `RetainPDF-Windows-<version>-Setup.exe` | On “Windows protected your PC”, click “More info” → “Run anyway” |
| Linux | `RetainPDF-Linux-<version>.deb` | `sudo apt install ./RetainPDF-Linux-<version>.deb` |

On first launch the app asks for your OCR and translation keys. Supported: PaddleOCR, MinerU, GLM-OCR; DeepSeek, Qwen, Zhipu, OpenAI, Anthropic, OpenCode Go, and any OpenAI- or Anthropic-compatible endpoint ([getting keys, Chinese](frontend/web/guide/credentials.md)).

Docker:

```bash
git clone https://github.com/wxyhgk/retain-pdf.git
cd retain-pdf/ops/deployment/docker/delivery
docker compose up -d   # open http://127.0.0.1:40001
```

More in the [Docker deployment guide](ops/deployment/docker/delivery/README.md).

## Docs

- [User guide (Chinese)](frontend/web/guide/README.md): library, translation, side-by-side reading, glossaries, sync, backup, LAN sharing… also under “使用说明” at the bottom of the app
- Development: [contribution guide](CONTRIBUTING.md) · [project docs](docs/README.md) · [backend guide](backend/README.md)

## Community

QQ group: `1101779791`

<p align="center">
  <img src="resources/brand/QQ_Group.JPG" alt="RetainPDF QQ group QR code" width="200" />
</p>

## License

MIT, see [LICENSE](LICENSE).
