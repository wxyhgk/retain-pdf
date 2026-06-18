# RetainPDF：PDF 保留排版翻译工具

<p align="center">
  <img src="resources/brand/RetainPDF-github.svg" alt="RetainPDF" width="320" />
</p>

<p align="center">
  <a href="https://www.atlascloud.ai/?utm_source=github&utm_medium=link&utm_campaign=retain-pdf">
    <img src="resources/brand/atlas-cloud-logo.svg" alt="Atlas Cloud" width="200" />
  </a>
</p>

> 🎁 **[Atlas Cloud](https://www.atlascloud.ai/?utm_source=github&utm_medium=link&utm_campaign=retain-pdf)** 为 RetainPDF 的翻译环节提供了一个可选的、OpenAI 兼容的推理后端：一个 API 即可调用 DeepSeek、Qwen、GLM、Kimi、MiniMax 等多家模型，无需维护多个厂商的接入。设 `RETAIN_TRANSLATION_PROVIDER=atlascloud` 即可把翻译切到 Atlas Cloud（默认仍是 DeepSeek，行为不变）。
>
> 接入只需把翻译的 OpenAI 兼容入口指向 Atlas：`base_url=https://api.atlascloud.ai/v1`、`model=deepseek-ai/deepseek-v4-pro`（key 用占位符，从环境变量读取）。`deepseek-ai/deepseek-v4-pro` 是带推理（reasoning）的模型，调用时把 `max_tokens` 给足（≥ 512），否则 token 可能先耗在思维链上、`content` 返回为空。
>
> 预算友好：[coding plan](https://www.atlascloud.ai/console/coding-plan)。接入细节见 [doc/core/api/local-dev.md](doc/core/api/local-dev.md#翻译-provider)。

```env
# 可选：把翻译切到 Atlas Cloud（OpenAI 兼容）
RETAIN_TRANSLATION_PROVIDER=atlascloud
ATLASCLOUD_API_KEY=<atlascloud-api-key>
# base_url=https://api.atlascloud.ai/v1
# model=deepseek-ai/deepseek-v4-pro
```

<details>
<summary>Atlas Cloud 全部 LLM 模型（59 个，来源 <code>api.md</code> / <code>/zh/models/list/llm</code>）</summary>

- Anthropic (Claude): `anthropic/claude-haiku-4.5-20251001`, `anthropic/claude-opus-4.8`, `anthropic/claude-sonnet-4.6`
- OpenAI (GPT): `openai/gpt-5.4`, `openai/gpt-5.5`
- Google (Gemini): `google/gemini-3.1-flash-lite`, `google/gemini-3.1-pro-preview`, `google/gemini-3.5-flash`
- 阿里 Qwen: `qwen/qwen2.5-7b-instruct`, `Qwen/Qwen3-235B-A22B-Instruct-2507`, `qwen/qwen3-235b-a22b-thinking-2507`, `qwen/qwen3-30b-a3b`, `Qwen/Qwen3-30B-A3B-Instruct-2507`, `qwen/qwen3-30b-a3b-thinking-2507`, `qwen/qwen3-32b`, `qwen/qwen3-8b`, `Qwen/Qwen3-Coder`, `qwen/qwen3-coder-next`, `qwen/qwen3-max-2026-01-23`, `Qwen/Qwen3-Next-80B-A3B-Instruct`, `Qwen/Qwen3-Next-80B-A3B-Thinking`, `Qwen/Qwen3-VL-235B-A22B-Instruct`, `qwen/qwen3-vl-235b-a22b-thinking`, `qwen/qwen3-vl-30b-a3b-instruct`, `qwen/qwen3-vl-30b-a3b-thinking`, `qwen/qwen3-vl-8b-instruct`, `qwen/qwen3.5-122b-a10b`, `qwen/qwen3.5-27b`, `qwen/qwen3.5-35b-a3b`, `qwen/qwen3.5-397b-a17b`, `qwen/qwen3.6-35b-a3b`, `qwen/qwen3.6-plus`
- DeepSeek: `deepseek-ai/deepseek-ocr`, `deepseek-ai/deepseek-r1-0528`, `deepseek-ai/DeepSeek-V3-0324`, `deepseek-ai/DeepSeek-V3.1`, `deepseek-ai/DeepSeek-V3.1-Terminus`, `deepseek-ai/deepseek-v3.2`, `deepseek-ai/DeepSeek-V3.2-Exp`, `deepseek-ai/deepseek-v4-flash`, `deepseek-ai/deepseek-v4-pro`
- Moonshot (Kimi): `moonshotai/Kimi-K2-Instruct`, `moonshotai/Kimi-K2-Instruct-0905`, `moonshotai/Kimi-K2-Thinking`, `moonshotai/kimi-k2.5`, `moonshotai/kimi-k2.6`
- 智谱 GLM: `zai-org/GLM-4.6`, `zai-org/glm-4.7`, `zai-org/glm-5`, `zai-org/glm-5-turbo`, `zai-org/glm-5.1`, `zai-org/glm-5v-turbo`
- MiniMax: `MiniMaxAI/MiniMax-M2`, `minimaxai/minimax-m2.1`, `minimaxai/minimax-m2.5`, `minimaxai/minimax-m2.7`
- xAI: `xai/grok-4.3`
- 快手 KAT: `kwaipilot/kat-coder-pro-v2`
- 其他: `owl`

</details>


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
  <img src="resources/brand/readme-gallery/image%201.png" alt="SCI 示例 1" width="860" />
</p>

<p align="center">
  <img src="resources/brand/readme-gallery/image%202.png" alt="SCI 示例 2" width="860" />
</p>

### 图片型 / 扫描版 PDF

<p align="center">
  <img src="resources/brand/readme-gallery/image%203.png" alt="扫描版示例 1" width="860" />
</p>

<p align="center">
  <img src="resources/brand/readme-gallery/image%207.png" alt="扫描版示例 2" width="860" />
</p>

### 图书类

<p align="center">
  <img src="resources/brand/readme-gallery/image%204.png" alt="图书示例 1" width="860" />
</p>

<p align="center">
  <img src="resources/brand/readme-gallery/image%205.png" alt="图书示例 2" width="860" />
</p>

<p align="center">
  <img src="resources/brand/readme-gallery/image%206.png" alt="图书示例 3" width="860" />
</p>

## 快速开始

如果你只是想直接使用，先去 [GitHub Releases](https://github.com/wxyhgk/retain-pdf/releases) 下载对应平台的发布包：

- Windows：优先下载 `Setup.exe`
- macOS：下载 `.dmg`
- Linux：下载 `.deb`

如果你想给局域网、团队或多台设备一起用，优先选 Docker 部署。

### Windows 桌面端

<p align="center">
  <img src="resources/brand/RetainPDF-desktop.png" alt="RetainPDF Windows 桌面端" width="860" />
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
- `42000`：multipart 异步提交接口

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
APP_IMAGE=wxyhgk/retainpdf-app:<version> \
WEB_IMAGE=wxyhgk/retainpdf-web:<version> \
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
  <img src="resources/brand/QQ_Group.JPG" alt="RetainPDF QQ 交流群二维码" width="280" />
</p>

## 开发者


### 文档入口

建议按下面顺序阅读。

- [贡献指南](CONTRIBUTING.md)
- [文档目录](doc/README.md)
- [主线文档](doc/core/README.md)
- [参考资料](doc/reference/README.md)
- [运维与过程记录](doc/ops/README.md)
- [Pipeline 阶段契约](backend/scripts/runtime/pipeline/README.md)

### 代码与子模块说明

- [后端脚本说明](backend/scripts/README.md)
- `frontend/`：当前生产使用的静态浏览器前端，也是桌面端 bundle 的输入目录。
- `frontend-react/`：React 前端迁移区，当前不直接替代 `frontend/`。
- `desktop/`：Electron 桌面端打包与运行壳。

### 当前目录结构

- `frontend/`
  当前生产使用的静态浏览器前端。
- `frontend-react/`
  React 前端迁移区。
- `desktop/`
  Electron 桌面端打包、运行壳和桌面端前端 bundle。
- `backend/`
  Rust API、Python 脚本、嵌入式 Python、历史工作区。
- `docker/`
  Dockerfile、发布脚本、交付用 compose 配置。
- `experiments/`
  独立实验、验证记录和临时 POC。
- `data/`
  本地运行输出、任务目录、历史样本数据。
- `resources/`
  仓库级品牌图、README 展示图、动画、示例文件和后续本地 runtime 归档入口。

### 当前开发状态

RetainPDF 目前已经形成完整产品链路：

- Rust API 负责上传、任务、图书馆、事件、产物、断点恢复和 Provider 调度。
- Python pipeline 负责 OCR 归一化、翻译、诊断、渲染和 PDF 处理。
- 静态前端是当前生产入口，React 前端仍在迁移区。
- Docker 和桌面端是当前主要交付形态。
- API、数据库、artifact、reader、glossary 和 stage spec 已有主线文档维护。

当前开发优先级以主线契约为准，主要集中在：

- 前端图书馆、reader、任务进度和术语表体验。
- Rust API 的边界收口、数据库持久化和 artifact 管理。
- Python 翻译一致性、公式保护、渲染稳定性和诊断能力。
- Docker、桌面端、CI 和测试样本的可复现交付。
- 文档与真实 API / 配置 / 目录结构保持同步。

### 欢迎一起参与

如果你也对下面这些方向感兴趣，欢迎一起把这个项目继续往前做：

- 高精度 OCR / 疑难版面解析
- 长文块与公式场景下的翻译稳定性
- 排版回填、字体自适应与 PDF 渲染
- 桌面端、Docker 交付与工程化完善

不管你更擅长算法、前端、后端还是部署，只要你也想把“真正能用的 PDF 保留排版翻译”这件事做深，欢迎进来一起搞。

## License

This project is distributed under the MIT License. See [LICENSE](LICENSE) for the full text.
