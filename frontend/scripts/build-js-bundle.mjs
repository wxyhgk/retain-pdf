import { build, context } from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "..");
const outdir = path.join(frontendRoot, "dist");

// --watch: esbuild context Xây dựng lại gia tăng(Trạng thái phát triển:sourcemap mở、minify bên ngoài)
const watchMode = process.argv.includes("--watch");

// Đường dẫn nhập vẫn được ghi .js/.jsx（Cổ phiếu tương thích import），Ánh xạ tới khi phân tích cú pháp .ts/.tsx。
// TypeScript bundler Quy ước：import "./foo.js" Tương ứng với foo.ts。
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

// Ba Trang MPA Bảng mục nhập được đóng gói riêng——home/detail/reader được chuyển sang React Thế giới mới
const PAGE_BUNDLES = [
  {
    name: "home",
    entry: path.join(frontendRoot, "src/pages/home/entry.tsx"),
    outfile: path.join(outdir, "app.bundle.js"),
  },
  {
    name: "detail",
    entry: path.join(frontendRoot, "src/pages/detail/entry.tsx"),
    outfile: path.join(outdir, "detail.bundle.js"),
  },
  {
    name: "reader",
    entry: path.join(frontendRoot, "src/pages/reader/entry.tsx"),
    outfile: path.join(outdir, "reader.bundle.js"),
  },
];

// mathjax-full/js/components/version.js không xác định PACKAGE_VERSION thì sẽ
// eval('require') đọc package.json —— Trình duyệt ESM Chiên trực tiếp bên trong，Làm cho tất cả các công thức rơi trở lại。
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

function bundleOptions({ entry, outfile }) {
  return {
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["es2022"],
    jsx: "automatic",
    alias: {
      "@": path.join(frontendRoot, "src"),
    },
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

// Chỉ có Qing JS Sản phẩm，Giữ dist/css/（build:css Viết độc lập；Toàn bộ Mục lục rm sẽ xử lý sai phong cách trang chủ）
fs.mkdirSync(outdir, { recursive: true });
for (const page of PAGE_BUNDLES) {
  try {
    fs.rmSync(page.outfile, { force: true });
  } catch {
    // ignore
  }
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
