import { defineConfig } from "vite";
import path from "path";

// 提问窗的几个开源库（assistant-ui 及其 Markdown / KaTeX、radix、react-rnd、ACP SDK）也不打进 dist：宿主（web 的 esbuild）解析、按需拆块。
const packageDependencyPattern = /^(?:react|react-dom|react-pdf|pdfjs-dist|mathjax-full|marked|lucide-react|sonner|@retainpdf\/api|@retainpdf\/domain|@retainpdf\/ui|@assistant-ui\/[^/]+|react-rnd|katex|rehype-katex|remark-math|remark-gfm|zustand|radix-ui|class-variance-authority|clsx|tailwind-merge|@agentclientprotocol\/sdk)(?:\/.*)?$/;

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: path.resolve(__dirname, "src/index.ts"),
        adapters: path.resolve(__dirname, "src/adapters.ts"),
        boot: path.resolve(__dirname, "src/boot.tsx"),
        contracts: path.resolve(__dirname, "src/contracts/index.ts"),
        "runtime/config": path.resolve(__dirname, "src/runtime/config.ts"),
        "runtime/content": path.resolve(__dirname, "src/runtime/content.ts"),
        "runtime/data": path.resolve(__dirname, "src/runtime/data.ts"),
        "runtime/state": path.resolve(__dirname, "src/runtime/state.ts"),
      },
      name: "RetainReader",
      fileName: (_format, entryName) => `${entryName}.js`,
      formats: ["es"],
    },
    rollupOptions: {
      external: (id) => packageDependencyPattern.test(id),
    },
    sourcemap: true,
  },
});
