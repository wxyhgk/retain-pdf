import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveLottieVendorUrl,
  resolvePdfjsVendorUrl,
  resolveVendorUrl,
} from "@/platform/runtime/vendor-url.js";

test("vendor resolver is rooted at page base URI instead of module path", () => {
  const documentRef = {
    baseURI: "file:///Applications/RetainPDF.app/Contents/Resources/app.asar/app/frontend/index.html",
  };

  assert.equal(
    resolvePdfjsVendorUrl("build/pdf.mjs", { documentRef }),
    "file:///Applications/RetainPDF.app/Contents/Resources/app.asar/app/frontend/vendor/pdfjs-dist/build/pdf.mjs",
  );
});

test("vendor resolver normalizes leading slashes and dot prefixes", () => {
  const documentRef = {
    baseURI: "http://127.0.0.1:40001/index.html",
  };

  assert.equal(
    resolveVendorUrl("./pdf-lib/dist/pdf-lib.esm.js", { documentRef }),
    "http://127.0.0.1:40001/vendor/pdf-lib/dist/pdf-lib.esm.js",
  );
  assert.equal(
    resolveLottieVendorUrl("/build/player/lottie.min.js", { documentRef }),
    "http://127.0.0.1:40001/vendor/lottie-web/build/player/lottie.min.js",
  );
});
