# Pretext PoC Results

日期：

- 2026-04-07

环境：

- 本地静态服务：`python3 -m http.server 4173`
- 浏览器：`chromium --headless --disable-gpu --no-sandbox`
- 依赖安装：`npm install --registry=https://registry.npmmirror.com`

## 已验证页面

- `html/index.html`
- `html/pretext.html`

两页都支持 URL 参数自动运行：

- `?autoload=1`
- `&sample=<sample_id>`
- `&autorun=1`

例如：

- `http://127.0.0.1:4173/html/index.html?autoload=1&sample=20260407033349-ffe2e4:p002-b0002&autorun=1`
- `http://127.0.0.1:4173/html/pretext.html?autoload=1&sample=20260407033349-ffe2e4:p002-b0002&autorun=1`

## 首个浏览器侧对照结果

样本：

- `20260407033349-ffe2e4:p002-b0002`

输入参数：

- 宽度：`447.45pt`
- 字号：`11.06pt`
- 行高：约 `6.64pt`
  这里沿用了当前页面里“用字号乘 Typst 的 `max_leading_em`”的近似方式，仅作为第一轮 PoC 对照输入。

结果：

- DOM height: `53.16pt`
- Pretext height: `53.12pt`
- height diff: `0.04pt`
- DOM lineCount: `8`
- Pretext lineCount: `8`
- DOM maxLineWidth: `597pt`
- Pretext maxLineWidth: `442.03pt`

## 当前结论

可以先确认三件事：

1. `@chenglou/pretext` 已经可以在本实验目录本地安装并被浏览器页面导入。
2. 在同一批 `fixtures` 上，DOM 和 `pretext` 的块级高度与行数已经可以直接做自动对照。
3. 至少在样本 `p002-b0002` 上，`pretext` 与 DOM 的高度和行数非常接近。

同时也暴露出一个重要问题：

- 当前 DOM 页面对 `maxLineWidth` 的读取是 `scrollWidth`，它反映的是整个块盒子的滚动宽度，不一定是“最宽一行文字”的真实宽度。
- `pretext` 的 `maxLineWidth` 是逐行计算出来的文本宽度，因此两者目前还不是严格同口径。

这意味着下一步应优先统一“最宽行”指标口径，再继续扩展更多样本。

## 下一步建议

- 把 DOM 基线页的宽度指标从 `scrollWidth` 改成逐行口径，和 `pretext` 对齐。
- 用当前 5 个样本全量跑一遍 DOM / `pretext` 对照，记录高度差、行数差和最宽行差。
- 再引入 Typst 对照，判断是 DOM 还是 `pretext` 更接近 Typst 结果。
