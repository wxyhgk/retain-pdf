# RetainPDF：PDF 保留排版翻译工具

<p align="center">
  <a href="README.md">中文</a> · <a href="README.en.md">English</a> · <a href="README.vi.md">Tiếng Việt</a>
</p>

<p align="center">
  <img src="resources/brand/RetainPDF-github.svg" alt="RetainPDF" width="320" />
</p>

RetainPDF 是目前唯一面向图片型 / 扫描版 PDF、支持保留排版翻译的开源项目，翻译与排版效果对标甚至超过同类商业产品。

自研字体排版算法，支持复杂公式与多栏论文的版式还原。扫描 PDF 翻译、PDF 结构优化、代码保护、自定义翻译策略和开放 API，一并支持。

翻译系统同样自研，针对跨栏、跨页、断句和段落续接等 PDF 常见难题做了专门处理：先恢复完整语义单元，再进行翻译，避免逐框翻译造成的上下文割裂。

**在行内公式部分 RetainPDF 的断层领先：翻译后仍能稳定保留公式本体、前后文关系与行内排版，这是其他开源 PDF 翻译项目目前做不到的。**

代码、API 与部署方式全部开放，支持自部署和二次开发。

核心能力对比：

| 项目 | 扫描型 PDF | 复杂行内公式 | 代码不误翻 | 表格控制 | 自定义翻译策略 | 排版保留 | PDF 压缩优化 | API 自动化 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PDFMathTranslate | ❌ | ❌ | ❌ | 弱 | 弱 | 一般 | 一般 | ✅ |
| PolyglotPDF | ❌ | ❌ | ❌ | 弱 | 弱 | 一般 | 一般 | ✅ |
| Doc2X | ✅ | ✅ | ❌ | 中 | 弱 | 强 | 弱 | ❌ 不开放 |
| RetainPDF | ✅ | ✅ 强保留 | ✅ | ✅ 可开关 | ✅ 可按规则配置 | 强 | ✅ 持续优化 | ✅ |

## 产品界面

### 图书馆

在一个书架中管理论文、图书和扫描文档，集中查看翻译状态、合集与收藏。

<p align="center">
  <img src="resources/brand/readme-gallery/product/library.png" alt="RetainPDF 图书馆主页" width="1000" />
</p>

### 原文与译文对照阅读

原 PDF 与译文 PDF 同页并排展示，便于核对公式、图表、引用和版面位置。

<p align="center">
  <img src="resources/brand/readme-gallery/product/side-by-side-reader.png" alt="RetainPDF 原文与译文对照阅读" width="1000" />
</p>

### Markdown 阅读

PDF 与 Markdown 同屏阅读，保留公式和图片。

<p align="center">
  <img src="resources/brand/readme-gallery/product/markdown-reader.png" alt="RetainPDF Markdown 阅读" width="1000" />
</p>

### 文档 AI 问答

直接围绕当前文档提问，回答附带页码和原文引用；需要修改 PDF 时可显式切换到 PDF Agent。

<p align="center">
  <img src="resources/brand/readme-gallery/product/ai-assistant.png" alt="RetainPDF 文档 AI 问答与引用" width="1000" />
</p>

## 翻译效果

SCI 论文、图片型 / 扫描版 PDF 与图书教材的原文—译文对照样例：

<p align="center">
  <img src="resources/brand/readme-gallery/translation-examples.webp" alt="RetainPDF SCI 论文、扫描 PDF 与图书教材翻译效果合集" width="1000" />
</p>

<p align="center"><sub>第一行：SCI 论文 · 第二行：扫描与公式密集文档 · 第三行：图书教材</sub></p>

## 快速开始

从 [GitHub Releases](https://github.com/wxyhgk/retain-pdf/releases) 下载对应版本：

- Windows：`Setup.exe`
- macOS：`.dmg`
- Linux：`.deb`

### 桌面端

<p align="center">
  <img src="resources/brand/readme-gallery/product/library.png" alt="RetainPDF 桌面端图书馆" width="1000" />
</p>

macOS 若提示应用“已损坏”，将应用拖入 `/Applications` 后执行：

```bash
sudo xattr -r -d com.apple.quarantine /Applications/RetainPDF.app
```

### Docker 部署

```bash
git clone https://github.com/wxyhgk/retain-pdf.git
cd retain-pdf/ops/deployment/docker/delivery
docker compose up -d
```

启动后访问 <http://127.0.0.1:40001>。更新服务：

```bash
docker compose pull
docker compose up -d
```

更多配置见 [Docker 部署说明](ops/deployment/docker/delivery/README.md)。

## 交流

QQ 交流群：`1101779791`

<p align="center">
  <img src="resources/brand/QQ_Group.JPG" alt="RetainPDF QQ 交流群二维码" width="280" />
</p>

## 开发

参阅 [贡献指南](CONTRIBUTING.md)、[项目文档](docs/README.md)和[后端说明](backend/README.md)。

## License

This project is distributed under the MIT License. See [LICENSE](LICENSE) for the full text.
