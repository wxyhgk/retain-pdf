// Entry React của trang detail: mount vào #detail-root trong detail.html.
// Bundle đầu ra là dist/detail.bundle.js (xem scripts/build-js-bundle.mjs).

import { createRoot } from "react-dom/client";
import { bootTheme } from "../../shared/theme/theme.js";
import { DetailApp } from "./DetailApp.jsx";

bootTheme();

const host = document.getElementById("detail-root");
if (host) {
  createRoot(host).render(<DetailApp />);
}
