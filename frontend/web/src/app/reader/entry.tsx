// reader 页宿主入口（产物 dist/reader.bundle.js，由 reader.html 挂载）。
// shell-boot 副作用先注册 job-domain adapters，再注入 reader 宿主 adapters，
// 最后经公开 boot 入口显式启动（包内自带 bootTheme + 建根 + 挂载，不开 StrictMode）。
// 业务组装：入参归一化（三页统一契约）+ 一行 bootReader()。

import "../shell-boot.js";
import "./adapters/retainpdf.js";
import { bootReader } from "@retainpdf/reader/boot";
import { parseReaderParams } from "@/platform/navigation/pages.js";

// 入参走三页统一契约：camelCase ?page=&blockId= 补齐运行时读取的
// page_idx/block_id（replaceState，无刷新；双 key 并存时不动）。
try {
  const search = globalThis.location?.search || "";
  const parsed = parseReaderParams(search);
  const params = new URLSearchParams(search);
  let dirty = false;
  if (parsed.page !== null && !params.has("page_idx")) {
    params.set("page_idx", `${parsed.page}`);
    dirty = true;
  }
  if (parsed.blockId && !params.has("block_id")) {
    params.set("block_id", parsed.blockId);
    dirty = true;
  }
  if (dirty) {
    globalThis.history?.replaceState?.(
      null,
      "",
      `${globalThis.location.pathname}?${params.toString()}${globalThis.location.hash || ""}`,
    );
  }
} catch {
  /* 保持直启，解析失败不拦 boot */
}

bootReader();
