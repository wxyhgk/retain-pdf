import { build, context } from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "..");
const outdir = path.join(frontendRoot, "dist");

// --watch: esbuild context 增量重建(开发态:sourcemap 开、minify 关)
const watchMode = process.argv.includes("--watch");

// 导入路径仍写 .js/.jsx（兼容存量 import），解析时映射到 .ts/.tsx。
// TypeScript bundler 约定：import "./foo.js" 可对应 foo.ts。
function jsToTsResolvePlugin() {
  const map = new Map([
    [".js", [".ts", ".tsx", ".js"]],
    [".jsx", [".tsx", ".jsx"]],
    [".mjs", [".mts", ".mjs"]],
  ]);
  return {
    name: "js-to-ts-resolve",
    setup(buildApi) {
      buildApi.onResolve({ filter: /\.(jsx?|mjs)$/ }, (args) => {
        if (args.namespace !== "file" && args.namespace !== "") return;
        if (args.path.startsWith("http") || args.path.startsWith("data:")) return;
        const candidates = map.get(path.extname(args.path));
        if (!candidates) return;

        let dir = args.resolveDir;
        if (args.importer) {
          dir = path.dirname(args.importer);
        }
        const absBase = path.isAbsolute(args.path)
          ? args.path
          : path.join(dir, args.path);
        const withoutExt = absBase.replace(/\.(jsx?|mjs)$/, "");
        for (const ext of candidates) {
          const candidate = `${withoutExt}${ext}`;
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return { path: candidate };
          }
        }
        return undefined;
      });
    },
  };
}

// 三页 MPA 各自打包的入口表——home/detail/reader 均已切换到 React 新世界。
// 挂载对照（HTML → entry → 产物，?v= 由 stamp-cache-version.mjs 按内容哈希重写）：
//   index.html  → src/app/home/entry.tsx   → dist/app.bundle.js
//   detail.html → src/app/detail/entry.tsx → dist/detail.bundle.js
//   reader.html → src/app/reader/entry.tsx → dist/reader.bundle.js
// 运行时顺序：各 HTML 内 runtime-config.js → runtime-config.local.js（同步脚本，
// 先写 window.__FRONT_RUNTIME_CONFIG__）→ 对应 bundle（type=module 延迟执行）。
// 三 entry 共享启动样板见 src/app/shell-boot.ts（adapters → bootTheme →
// 找根 → createRoot，不开 StrictMode）。
// 每页独立构建(见下方 splitting 说明),入口产物名保持 `<out>.js`,
// 故 HTML 引用与 stamp-cache-version 的资源表都不用改。
const PAGE_BUNDLES = [
  {
    name: "home",
    entry: path.join(frontendRoot, "src/app/home/entry.tsx"),
    out: "app.bundle",
  },
  {
    name: "detail",
    entry: path.join(frontendRoot, "src/app/detail/entry.tsx"),
    out: "detail.bundle",
  },
  {
    name: "reader",
    entry: path.join(frontendRoot, "src/app/reader/entry.tsx"),
    out: "reader.bundle",
  },
];

// mathjax-full/js/components/version.js 在未定义 PACKAGE_VERSION 时会
// eval('require') 读 package.json —— 浏览器 ESM 里直接炸，导致全部公式回退。
// 故三 bundle 统一经 define 注入 PACKAGE_VERSION（取自 mathjax-full 的
// package.json 版本，读不到回退 3.2.1），HTML 侧无需再管。
function resolveMathJaxPackageVersion() {
  try {
    const pkgPath = path.join(
      frontendRoot,
      "node_modules/mathjax-full/package.json",
    );
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "3.2.1";
  } catch {
    return "3.2.1";
  }
}

// splitting 是必需的,不是优化选项:packages/reader 用 lazy()/动态 import()
// 把 AI 面板、Markdown 面板和 mathjax-full 排在首屏之外,单 outfile 构建会把
// 这些动态 import 全部内联回主包 —— 光 mathjax-full 就是 1.7MB(占 reader
// 包 40%),而文档没有公式时它一行都用不到。开启后 reader 首屏 4.3MB → 1.2MB,
// 产物总量基本不变,只是改为按需取用。
//
// 每页单独构建、chunk 各自进 dist/chunks/<页>/:三页合批会让 esbuild 生成跨页
// 共享 chunk,detail 没有任何懒加载点,却要为此拉入 home 才用得到的公共代码
// (实测 +13%)。隔离后每页只按自身依赖图拆分;跨页重复的 React 等在合批前就
// 已各自打包一份,故隔离不劣于原状态。
//
// 入口名由 entryPoints 的 { in, out } 指定,故仍写出 dist/<页>.bundle.js;
// chunk 名带内容哈希,天然缓存安全,无需 stamp。
function bundleOptions({ entry, out }) {
  return {
    entryPoints: [{ in: entry, out }],
    outdir,
    splitting: true,
    chunkNames: `chunks/${out.replace(/\.bundle$/, "")}/[name]-[hash]`,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["es2022"],
    // Markstream 的图表/增强代码块运行时是 optional peers。本产品当前只启用
    // KaTeX + plain <pre>，未安装的可选模块保持动态 external，不能为了让
    // esbuild 解析成功而把 Mermaid/D2/Infographic 整套塞进基础包。
    external: [
      "@antv/infographic",
      "@terrastruct/d2",
      "mermaid",
      "stream-diffs",
    ],
    jsx: "automatic",
    alias: {
      "@": path.join(frontendRoot, "src"),
    },
    // Workspace package peers resolve through the host's installed dependency tree.
    nodePaths: [path.join(frontendRoot, "node_modules")],
    // Reader 与其它 workspace 包一样只通过 package.json exports 消费；
    // 禁止在宿主构建里维护第二份 subpath→源码路径映射。
    plugins: [jsToTsResolvePlugin()],
    define: {
      PACKAGE_VERSION: JSON.stringify(resolveMathJaxPackageVersion()),
    },
    loader: {
      ".html": "text",
      ".ts": "ts",
      ".tsx": "tsx",
    },
    minify: !watchMode,
    sourcemap: watchMode ? "inline" : false,
    logLevel: "info",
    legalComments: "none",
  };
}

// 只清 JS 产物，保留 dist/css/（build:css 独立写入；整目录 rm 会把主页样式弄没）
// chunks/ 整个重建：chunk 名带内容哈希，不清会随构建次数堆积成旧版本垃圾。
fs.mkdirSync(outdir, { recursive: true });
for (const page of PAGE_BUNDLES) {
  try {
    fs.rmSync(path.join(outdir, `${page.out}.js`), { force: true });
  } catch {
    // ignore
  }
}
try {
  fs.rmSync(path.join(outdir, "chunks"), { recursive: true, force: true });
} catch {
  // ignore
}

if (watchMode) {
  const contexts = await Promise.all(
    PAGE_BUNDLES.map((page) => context(bundleOptions(page))),
  );
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log(`[watch] 监听中:${PAGE_BUNDLES.map((p) => p.name).join(", ")}(Ctrl+C 退出)`);
} else {
  for (const page of PAGE_BUNDLES) {
    await build(bundleOptions(page));
  }
}
