import "./src/js/components/index.js";
import { renderPageShell } from "./src/js/templates.js";
import { initializeApp } from "./src/js/main.js";

await renderPageShell();
await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
initializeApp();
