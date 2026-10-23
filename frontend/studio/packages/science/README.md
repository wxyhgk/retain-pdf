# @blog/science

笔记里的化学和公式：博客和 Studio 都用这一份。化学块本身（构建、页面、编辑器里怎么接）是插件 `plugins/chemistry/`，这里是它和计算块共用的库。

| 目录 | 内容 |
|---|---|
| `parsers/` | 分子（SMILES、SDF/MOL、XYZ、GJF）和 cube 文件的解析。PDB、mol2、CIF 跟着 3Dmol 去掉了：要用时先给 fast-mol 加读取器，再在 `parsers/molecule-block.ts` 的表里加上 |
| `rendering/` | 公式：KaTeX 选项、mhchem、编号和引用（`equations.mjs`）；分子绘制前的准备 |
| `browser/` | 在页面里画分子（RDKit 二维；三维和 cube 等值面用 fast-mol，`browser/fast-mol.ts`），和它们下面的视角按钮（`mountViewControls`） |
| `third-party/fast-mol/` | fast-mol 的只读单文件版（Canvas 2D，不用 WebGL），`VERSION.md` 写了是哪个提交、怎么换版本 |
| `view-state.mjs` | 文章存的视角（article.views.json）的两种样子：fast-mol 的 `{ rotation, zoom, pan }`，和以前 3Dmol 的数组（只留着，fast-mol 画的分子不读它） |
| `cube-display.mjs`、`view-key.mjs` | cube 的显示设置、分子保存视角的键 |

网站要提供的东西：

- 公式宏：`rendering/katex-options.mjs` 的 `mergeMacros(网站的宏, 文章的宏)`，网站自己的宏由网站传进来（本仓库在 `src/math-macros.mjs`）。
- RDKit 的脚本：从网站的 `/vendor/rdkit/` 加载。fast-mol 由 Vite 打成单独的一块，第一次画三维分子时才加载。

测试：`node --experimental-strip-types --test packages/science/test/*.test.ts`（仓库根目录的 `npm test` 会一起跑）。
