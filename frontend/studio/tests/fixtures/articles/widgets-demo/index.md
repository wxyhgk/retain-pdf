---
title: "交互模块演示"
description: "笔记里直接放能运行的小页面：写在正文里的、单独成文件的、读文章里计算输出的。"
pubDate: "2026-10-17"
tags: ["交互模块"]
draft: true
---

这篇文章演示交互模块的三种写法。模块在沙盒里运行，碰不到外面的页面；配色跟着笔记的黑白和深浅色走。

## 写在正文里

代码块的语言写 `widget`，里面就是一小段 HTML：标签、样式、脚本都行。`title` 是下面的说明，`height` 是加载前先占的高度，加载后会按内容自动调整。

```widget title="Morse 势能：拖动改变阱深" height=300
<label>阱深 Dₑ <input id="depth" type="range" min="1" max="10" value="5"></label>
<canvas id="plot" width="640" height="240"></canvas>
<script>
const depth = document.querySelector('#depth');
const canvas = document.querySelector('#plot');
function draw() {
  const g = canvas.getContext('2d');
  const { width, height } = canvas;
  g.clearRect(0, 0, width, height);
  g.strokeStyle = note.color('ink');
  g.lineWidth = 2;
  g.beginPath();
  for (let x = 0; x <= width; x += 1) {
    const r = 0.6 + (x / width) * 4;
    const v = depth.value * (1 - Math.exp(-1.2 * (r - 1.5))) ** 2;
    const y = height - 12 - (v / 12) * (height - 24);
    x ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
}
depth.addEventListener('input', draw);
note.onTheme(draw);
draw();
</script>
```

画布要用 `note.color('ink')` 取颜色，并在 `note.onTheme(draw)` 里重画，切换深浅色时才跟得上。

## 单独成文件，读文章里的计算输出

大一点的模块放在 `assets/` 里，代码块里只写一行 `@file`。模块用 `note.file('assets/…')` 读文章里的文件，这里读的是一个水分子几何优化的 Gaussian 输出（示例数据），画出每一步的能量和四项收敛判据。拖动滑块看某一步的数值。

```widget title="几何优化进度（读 assets/water-opt.log）" height=420
@file ./assets/opt-progress.html
```

换一个输出文件，图就跟着变；在 Studio 里，模块文件或它读的文件一改，预览马上重新加载。

模块只能读文章 `img/` 和 `assets/` 里的文件，也就是会随文章发布的那些；读别的地方，发布前检查会提醒。
