# RetainPDF：PDF 保留排版翻译工具

<p align="center">
  <img src="image/RetainPDF-github.svg" alt="RetainPDF" width="320" />
</p>


开源社区做保留排版的项目不少，但是都围绕可复制，可编辑的 PDF，以及行内公式不复杂的场景.

RetainPDF 从一开始就是要解决各类 PDF 的保留排版翻译问题，尤其是图片型/扫描版 PDF，以及行内公式的渲染问题.

在保留排版翻译这个领域，正面硬刚闭源模型,并且在一些场景下做得更好，比如翻译后的 PDF 体积、整体速度和字体大小控制。

此外本项目是前后端分离、OCR、翻译、排版与交付打通的全栈项目，整体结构尽量解耦，既能直接使用，也方便后续开发者继续扩展、替换模块和二次开发。


简单对比：

| 项目 | 扫描型 PDF | 复杂行内公式 | 代码不误翻 | 表格控制 | 自定义翻译策略 | 排版保留 | PDF 压缩优化 | API 自动化 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PDFMathTranslate | ❌ | ❌ | ❌ | 弱 | 弱 | 一般 | 一般 | ✅ |
| PolyglotPDF | ❌ | ❌ | ❌ | 弱 | 弱 | 一般 | 一般 | ✅ |
| Doc2X | ✅ | ✅ | ❌ | 中 | 弱 | 强 | 弱 | ❌ 不开放 |
| RetainPDF | ✅ | ✅ | ✅ | ✅ 可开关 | ✅ 可按规则配置 | 强 | ✅ 持续优化 | ✅ |

## 效果图

### SCI 论文

<p align="center">
  <img src="image/image%201.png" alt="SCI 示例 1" width="860" />
</p>

<p align="center">
  <img src="image/image%202.png" alt="SCI 示例 2" width="860" />
</p>

### 图片型 / 扫描版 PDF

<p align="center">
  <img src="image/image%203.png" alt="扫描版示例 1" width="860" />
</p>

<p align="center">
  <img src="image/image%207.png" alt="扫描版示例 2" width="860" />
</p>

### 图书类

<p align="center">
  <img src="image/image%204.png" alt="图书示例 1" width="860" />
</p>

<p align="center">
  <img src="image/image%205.png" alt="图书示例 2" width="860" />
</p>

<p align="center">
  <img src="image/image%206.png" alt="图书示例 3" width="860" />
</p>

## 快速开始

如果你只是想直接使用，先去 [GitHub Releases](https://github.com/wxyhgk/retain-pdf/releases) 下载对应平台的发布包：

- Windows：优先下载 `Setup.exe`
- macOS：下载 `.dmg`
- Linux：下载 `.deb`

如果你想给局域网、团队或多台设备一起用，优先选 Docker 部署。

### Windows 桌面端

<p align="center">
  <img src="image/RetainPDF-desktop.png" alt="RetainPDF Windows 桌面端" width="860" />
</p>

### macOS 提示

由于当前没有 Apple 开发者账号，macOS 版本第一次打开时可能会提示应用“已损坏”。这不是文件真的损坏，而是系统的签名校验导致的。把应用拖到 `/Applications` 后，执行：

```bash
sudo xattr -r -d com.apple.quarantine /Applications/RetainPDF.app
```

然后再重新打开应用即可。

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

## 交流群

如果你在使用、部署或二次开发 RetainPDF 时遇到问题，欢迎加入 QQ 交流群一起讨论。

- QQ 群号：`1101779791`

<p align="center">
  <img src="image/QQ_Group.JPG" alt="RetainPDF QQ 交流群二维码" width="280" />
</p>

## 开发者


### 文档入口

建议按下面顺序阅读。

- [文档目录](doc/README.md)
- [主线文档](doc/core/README.md)
- [参考资料](doc/reference/README.md)
- [运维与过程记录](doc/ops/README.md)
- [Pipeline 阶段契约](backend/scripts/runtime/pipeline/README.md)

### 代码与子模块说明

- [后端脚本说明](backend/scripts/README.md)
- `frontend/`：当前浏览器前端静态资源与桌面端打包输入目录

### 当前目录结构

- `frontend/`
  浏览器前端、桌面壳、预览实验页面。
- `backend/`
  Rust API、Python 脚本、嵌入式 Python、历史工作区。
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

- [工程评价与后续执行计划](doc/ops/planning/工程评价与后续执行计划.md)

### 欢迎一起参与

如果你也对下面这些方向感兴趣，欢迎一起把这个项目继续往前做：

- 高精度 OCR / 疑难版面解析
- 长文块与公式场景下的翻译稳定性
- 排版回填、字体自适应与 PDF 渲染
- 桌面端、Docker 交付与工程化完善

不管你更擅长算法、前端、后端还是部署，只要你也想把“真正能用的 PDF 保留排版翻译”这件事做深，欢迎进来一起搞。

## License

This project is distributed under the MIT License. See [LICENSE](LICENSE) for the full text.
