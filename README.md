# RetainPDF：PDF 保留排版翻译工具

<p align="center">
  <img src="image/RetainPDF-github.svg" alt="RetainPDF" width="320" />
</p>

科学无国界，但文献有语言墙。这个项目面向科研论文、技术手册、教材与扫描型 PDF，目标不是只把文字翻出来，而是在翻译后尽量保留原始版面、公式位置、双栏结构和阅读体验。

它当前已经打通一条完整链路：上传 PDF 或 OCR 结果，经过 OCR、翻译、排版重建与产物登记，最终输出保留排版的中文 PDF，并支持 Markdown、JSON、Typst 与调试产物下载。

除了基础链路之外，这个项目还持续在两个方向做了大量优化：

- 字体与排版侧：针对不同页面密度、框尺寸、双栏结构和覆盖区域，持续调整字体大小自适应、覆盖背景、行块回填与页面可读性，尽量避免“字太大塞不下”或“字太小看不清”
- 翻译侧：针对长文块、公式占位符、代码/命令行参数、失败重试与降级策略做了专门处理，目标不是单纯把文本翻成中文，而是尽量让结果稳定、完整、可直接阅读

## 项目特点

### 翻译侧

- 不走传统“先粗切块、再分别识别”的老路，而是尽量基于文字坐标和结构信息做原位回填
- 面向扫描型 PDF、复杂行内公式、双栏论文、教材类长文档
- 尽量避免代码块、命令行参数、公式占位符被误翻
- 支持规则配置和自定义翻译策略，可按文档类型调整翻译提示与术语倾向
- 表格识别支持按任务开关控制，适合在高精度识别和稳定性之间做取舍
- 提供仍在持续打磨的高精度模式，目标是在复杂科研文档、混排页面和疑难结构场景下进一步逼近甚至超越常见 OCR 方案的效果上限
- 高精度模式也是我后续最核心的演进方向之一

### 排版与交付侧

- 持续优化字体大小自适应、覆盖背景与页面回填效果，尽量兼顾还原度和可读性
- 支持图片型 PDF 的压缩优化，尽量在可读性和体积之间取平衡
- 支持 Markdown / JSON / Typst / PDF 多种产物下载，方便继续编辑或二次处理
- 支持 API 自动化、前端任务提交、桌面端打包与 Docker 交付

简单对比：

| 项目 | 扫描型 PDF | 复杂行内公式 | 代码不误翻 | 表格控制 | 自定义翻译策略 | 排版保留 | PDF 压缩优化 | API 自动化 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PDFMathTranslate | ❌ | ❌ | ❌ | 弱 | 弱 | 一般 | 一般 | ✅ |
| PolyglotPDF | ❌ | ❌ | ❌ | 弱 | 弱 | 一般 | 一般 | ✅ |
| Doc2X | ✅ | ✅ | ❌ | 中 | 弱 | 强 | 弱 | ❌ 不开放 |
| RetainPDF | ✅ | ✅ | ✅ | ✅ 可开关 | ✅ 可按规则配置 | 强 | ✅ 持续优化 | ✅ |

## 效果图

### SCI 论文

![SCI 示例 1](image/image%201.png)

![SCI 示例 2](image/image%202.png)

### 图片型 / 扫描版 PDF

![扫描版示例 1](image/image%203.png)

![扫描版示例 2](image/image%207.png)

### 图书类

![图书示例 1](image/image%204.png)

![图书示例 2](image/image%205.png)

![图书示例 3](image/image%206.png)

## 小白上手指南

### 下载方式

如果你只是想直接使用：

1. 打开 [GitHub Releases](https://github.com/wxyhgk/retain-pdf/releases)
2. 下载对应平台的发布包
3. Windows 用户优先下载安装版或便携版 `exe`

如果你想自己部署服务，优先用 Docker 方式。

### Windows 桌面端

![RetainPDF Windows 桌面端](image/RetainPDF-desktop.png)

### 我该选哪种方式

- 如果你只是自己在 Windows 电脑上使用，优先选 GitHub Releases 里的桌面版
- 如果你想给局域网、团队或多台设备一起用，优先选 Docker 部署
- 如果你希望后续自己更新镜像、改配置、接自己的 API key，也优先选 Docker 部署
- 如果你不想关心端口、容器、环境变量，优先选桌面版

说明：

- Windows 版本当前以安装版 `Setup.exe` 为主
- GitHub Releases 里的 Windows `Setup.exe` 会内置桌面运行所需的 Python 运行时，不要求用户自己装 Python
- macOS 版本当前先提供自动构建的测试包，主要用于验证打包链路和本机运行
### Docker 部署

当前仓库提供了 Docker 交付目录：

- [docker/delivery/README.md](docker/delivery/README.md)
- [docker/delivery/docker-compose.yml](docker/delivery/docker-compose.yml)

基本步骤：

```bash
git clone https://github.com/wxyhgk/retain-pdf.git
cd retain-pdf/docker/delivery
docker compose up -d
```

启动后默认访问：

```text
http://127.0.0.1:40001
```

默认端口：

- `40001`：前端页面
- `41000`：Rust API
- `42000`：简便同步接口

### Docker 更新

如果只是更新到最新镜像版本：

```bash
cd retain-pdf/docker/delivery
docker compose pull
docker compose up -d
```

如果你要切换到指定镜像版本，也可以这样：

```bash
cd retain-pdf/docker/delivery
APP_IMAGE=wxyhgk/retainpdf-app:latest \
WEB_IMAGE=wxyhgk/retainpdf-web:latest \
docker compose up -d
```

更新后建议执行一次状态检查：

```bash
docker compose ps
```

当前镜像地址：

- [wxyhgk/retainpdf-app](https://hub.docker.com/r/wxyhgk/retainpdf-app)
- [wxyhgk/retainpdf-web](https://hub.docker.com/r/wxyhgk/retainpdf-web)

## 开发者

### 文档入口

建议按下面顺序阅读。

- [当前 API 文档](doc/API.md)
- [文档目录](doc/README.md)
- [工程评价与后续执行计划](doc/工程评价与后续执行计划.md)
- [服务总览](doc/api-overview.md)
- [本地启动与配置](doc/api-dev.md)
- [接口说明](doc/api-endpoints.md)
- [存储结构](doc/api-storage.md)
- [错误排查](doc/api-troubleshooting.md)

### 代码与子模块说明

- [后端脚本说明](backend/scripts/README.md)
- [旧 FastAPI 包装层](backend/Fast_API/README.md)
- `frontend/`：当前浏览器前端静态资源与桌面端打包输入目录

### 当前目录结构

- `frontend/`
  浏览器前端、桌面壳、预览实验页面。
- `backend/`
  Rust API、Python 脚本、嵌入式 Python、旧 FastAPI 包装层、历史工作区。
- `docker/`
  Dockerfile、发布脚本、交付用 compose 配置。
- `data/`
  本地运行输出、任务目录、历史样本数据。

### 当前工程判断

RetainPDF 目前已经可以完成从 PDF 上传、OCR、翻译、排版重建到产物下载的完整链路。

接下来我的重点不是盲目堆功能，而是继续把下面几件事做稳：

- 工程一致性
- API 与产物契约稳定性
- 构建可复现性
- 长文块与公式场景下的翻译稳定性

如果你想了解我接下来准备怎么推进，可以看：

- [工程评价与后续执行计划](doc/工程评价与后续执行计划.md)

### 欢迎一起参与

如果你也对下面这些方向感兴趣，欢迎一起把这个项目继续往前做：

- 高精度 OCR / 疑难版面解析
- 长文块与公式场景下的翻译稳定性
- 排版回填、字体自适应与 PDF 渲染
- 桌面端、Docker 交付与工程化完善

不管你更擅长算法、前端、后端还是部署，只要你也想把“真正能用的 PDF 保留排版翻译”这件事做深，欢迎进来一起搞。
