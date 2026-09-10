# 科学仪器线标（RetainPDF）

学术/实验气质 UI 图标，**不是**中国风山水符号。

| 文件 | 语义 | 可用场景（建议） |
|------|------|------------------|
| `instrument-microscope.svg` | 显微镜 | 空状态、OCR/阅读相关 |
| `instrument-flask.svg` | 锥形瓶 | 化学/实验类标签 |
| `instrument-atom.svg` | 原子轨道 | 科学主题、AI 分析 |
| `instrument-spectrum.svg` | 光谱/信号 | 数据、图表、分析 |
| `instrument-telescope.svg` | 望远镜 | 探索、发现 |
| `instrument-balance.svg` | 天平 | 对照阅读、对比 |

## 规范

- `viewBox="0 0 24 24"`
- `stroke="currentColor"` `fill="none"`（atom 中心点除外）
- `stroke-width="1.6"` round

接入时用 CSS `color: var(--ink)` 或 `var(--accent)`，不要写死色。

## 来源

- **Kimi CLI** 生成线标（2026-07-21），已写入本目录  
- 规范：`currentColor` / 24×24 / stroke 1.6  

预览：用浏览器打开任意 `.svg`，或 `color: #1d1d1f` 套在 UI 里看。
