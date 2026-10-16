# Astro Starter Kit: Blog

```sh
npm create astro@latest -- --template blog
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

Features:

- ✅ Minimal styling (make it your own!)
- ✅ 100/100 Lighthouse performance
- ✅ SEO-friendly with canonical URLs and Open Graph data
- ✅ Sitemap support
- ✅ RSS Feed support
- ✅ Markdown & MDX support

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   ├── content/
│   ├── layouts/
│   └── pages/
├── astro.config.mjs
├── README.md
├── package.json
└── tsconfig.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

The `src/content/` directory contains "collections" of related Markdown and MDX documents. Use `getCollection()` to retrieve posts from `src/content/blog/`, and type-check your frontmatter using an optional schema. See [Astro's Content Collections docs](https://docs.astro.build/en/guides/content-collections/) to learn more.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |
| `npm run milkdown:setup`  | 拉取 Milkdown 源码（Studio 的编辑器）并安装依赖  |

Studio 的编辑器在 dev 时直接用 `third_party/milkdown`（git submodule，来自 fork `wxyhgk/milkdown` 的 `studio` 分支，基于 v7.22.0；`upstream` 指向官方仓库）的源码，改了保存即生效，不用构建。Studio 用到了 fork 里才有的扩展（`src/studio/editor/milkdown-fork.d.ts` 列出了它们），所以写作前要先拉取；发布的博客不含编辑器，CI 不需要它。

## 公式

博客和 Studio 用同一套规则画公式（`src/science/rendering/`），两边显示一致。

- **宏**：全站的宏写在 `src/katex-macros.json`（已有 `\dd`、`\expval`、`\Tr` 等），单篇文章可以在属性里补充或覆盖：

  ```yaml
  macros:
    Ha: \hat{H}
  ```

- **编号**：单独成块的公式（`$$…$$`、```` ```math ````、单独成行的 `\[…\]`）按顺序编号 (1)(2)…；写 `\notag` 或 `\nonumber` 的不编号，写 `\tag{…}` 的用自己的编号。`align`、`gather`、`equation` 等带编号的环境每行一个号。
- **引用**：`\label{eq:energy}` 给编号起名，正文里 `$\eqref{eq:energy}$` 显示为 (1)、`$\ref{eq:energy}$` 显示为 1，点击跳到公式；找不到名字时显示 (??)。

## 计算的输入和输出文件

这些代码块按程序的格式着色，博客上带标题栏，可以复制和下载。博客和 Studio 用同一份规则（`src/code-files/`）：

| 代码块 | 内容 |
|---|---|
| ```` ```gaussian ```` | Gaussian 输入（`g16`、`g09` 也行）；```` ```gjf ```` 仍然画分子 |
| ```` ```orca ```` | ORCA 输入 |
| ```` ```incar ````、```` ```poscar ````、```` ```kpoints ```` | VASP 输入 |
| ```` ```cp2k ```` | CP2K 输入 |
| ```` ```output ```` | 程序输出（`out` 也行）：报错、警告、正常结束和能量会突出显示 |

- **文件名**：```` ```orca title="opt.inp" ```` 给标题栏一个名字，也是下载时的文件名。任何语言的代码块都可以加 `title`。
- **引用文章里的文件**：代码块里只写一行 `@file ./assets/opt.log`，构建时读入这个文件显示，带原文件的行号，「下载」拿到完整文件。超过 400 行时只显示前 200 行和后 100 行；`lines=1200-1260` 只显示这几行，`lines=1200-` 显示到结尾。
- **折叠**：超过 30 行的代码块先显示前 15 行，点「展开」看全部；写 `open` 不折叠，写 `fold` 短的也折叠。
- **Studio**：块菜单里的「另存为文件」把代码块存成 `assets/` 里的文件（名字取标题，没有就用 `INCAR`、`input.inp` 这类常用名），代码块改成 `@file`。拖进编辑器的 `.log`、`.out`、`INCAR`、`POSCAR`、`KPOINTS`、`OUTCAR` 直接变成这样的代码块。

## 👀 Want to learn more?

Check out [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## Credit

This theme is based off of the lovely [Bear Blog](https://github.com/HermanMartinus/bearblog/).
