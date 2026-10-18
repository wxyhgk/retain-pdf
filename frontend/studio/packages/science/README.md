# @blog/science

笔记里的化学和公式：博客和 Studio 都用这一份。

| 目录 | 内容 |
|---|---|
| `parsers/` | 分子（SMILES、SDF/MOL、XYZ、GJF、PDB、MOL2、CIF）和 cube 文件的解析 |
| `rendering/` | 公式：KaTeX 选项、mhchem、编号和引用（`equations.mjs`）；分子绘制前的准备 |
| `browser/` | 在页面里画分子（RDKit 二维、3Dmol 三维）和 cube 等值面 |
| `cube-display.mjs`、`view-key.mjs` | cube 的显示设置、分子保存视角的键 |

网站要提供的东西：

- 公式宏：`rendering/katex-options.mjs` 的 `mergeMacros(网站的宏, 文章的宏)`，网站自己的宏由网站传进来（本仓库在 `src/math-macros.mjs`）。
- RDKit 和 3Dmol 的脚本：从网站的 `/vendor/rdkit/`、`/vendor/3dmol/` 加载。

测试：`node --experimental-strip-types --test packages/science/test/*.test.ts`（仓库根目录的 `npm test` 会一起跑）。
