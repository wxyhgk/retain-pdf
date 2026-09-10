import { register } from "node:module";

// React 19 reads navigator.userAgent while react-dom/client is initialized.
// Node 21+ provides navigator, while the supported Node 20 line does not.
if (!("navigator" in globalThis)) {
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent: "node.js" },
    configurable: true,
    writable: true,
  });
}

register(new URL("./jsx-loader.mjs", import.meta.url));
