import { defineConfig } from "vite";
import path from "path";

const packageDependencyPattern = /^(?:ai|react|react-dom|react-pdf|pdfjs-dist|mathjax-full|marked|markstream-react|katex|lucide-react|sonner|@ai-sdk\/react|@assistant-ui\/react|@retainpdf\/api)(?:\/.*)?$/;

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: path.resolve(__dirname, "src/index.ts"),
        adapters: path.resolve(__dirname, "src/adapters.ts"),
        boot: path.resolve(__dirname, "src/boot.tsx"),
        ai: path.resolve(__dirname, "src/ai.ts"),
        "runtime/ai": path.resolve(__dirname, "src/runtime/ai.ts"),
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
