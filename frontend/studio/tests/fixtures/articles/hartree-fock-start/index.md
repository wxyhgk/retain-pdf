---
title: '从 Hartree–Fock 方程开始'
description: '用一个最小示例检查博客中的公式、代码和计算化学内容展示。'
pubDate: '2026-08-09'
tags:
  - Hartree–Fock
  - 量子化学
  - Python
kind: wiki
draft: false
---

Hartree–Fock 方法用单个 Slater 行列式近似多电子波函数。轨道满足自洽场方程


$$
\sin x + \cos x
$$

$$
\hat{f}(i)\,\phi_p(i)=\varepsilon_p\,\phi_p(i),
$$


测试表格

其中 Fock 算符写成

$$
\hat{f}(i)=\hat{h}(i)+\sum_{j}^{\mathrm{occ}}\left[\hat{J}_j(i)-\hat{K}_j(i)\right].
$$

这个表达式已经足以测试块级公式、求和符号与轨道下标。行内公式也应该自然地出现在正文中，例如轨道能量 $\varepsilon_p$。

## 一个最小 SCF 迭代骨架

下面的代码不包含积分计算，只展示自洽迭代的基本结构：

```python
density = initial_guess(overlap)

for cycle in range(max_cycle):
    fock = core_hamiltonian + build_g_matrix(density)
    energy, coefficients = solve_roothaan(fock, overlap)
    new_density = make_density(coefficients, n_occupied)

    if converged(density, new_density):
        break

    density = new_density
```

### 初始密度矩阵

最小实现可以从核心 Hamiltonian 的本征矢构造初始密度。真正计算时还需要处理非正交原子轨道基组。

### 收敛判据

除了总能量变化，还应同时检查密度矩阵或误差矩阵。只检查单个数值可能导致错误地判断收敛。

## 计算结果应该记录什么

一篇可复现的计算笔记至少应记录程序版本、方法、基组、电荷与自旋多重度，以及关键收敛参数。

### 输入文件

输入文件应当直接保存在文章旁边，或者作为可下载附件提交到仓库。

### 输出摘要

正文只展示关键结果；完整输出文件可以折叠显示，避免打断推导和讨论。

## 下一步

> 后续文章会把每一个符号、矩阵维度和电子指标展开说明，并加入真实计算输出。

这篇文章目前只承担一个任务：确认 Astro 能稳定地从 Markdown 生成包含数学公式和代码块的静态页面。
