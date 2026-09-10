const VENDOR_ROOT = "./vendor/";

function normalizeVendorPath(relativePath = "") {
  return `${relativePath || ""}`.trim().replace(/^\.?\/*/, "");
}

function resolveBaseUrl({ documentRef = globalThis.document } = {}) {
  const baseUri = documentRef?.baseURI || globalThis.location?.href || "";
  if (baseUri) {
    return baseUri;
  }
  return "http://localhost/";
}

export function resolveVendorUrl(relativePath = "", options = {}) {
  const vendorPath = normalizeVendorPath(relativePath);
  if (!vendorPath) {
    return new URL(VENDOR_ROOT, resolveBaseUrl(options)).toString();
  }
  return new URL(`${VENDOR_ROOT}${vendorPath}`, resolveBaseUrl(options)).toString();
}

export function resolvePdfjsVendorUrl(relativePath = "", options = {}) {
  return resolveVendorUrl(`pdfjs-dist/${normalizeVendorPath(relativePath)}`, options);
}

export function resolvePdfLibVendorUrl(relativePath = "", options = {}) {
  return resolveVendorUrl(`pdf-lib/${normalizeVendorPath(relativePath)}`, options);
}

export function resolveLottieVendorUrl(relativePath = "", options = {}) {
  return resolveVendorUrl(`lottie-web/${normalizeVendorPath(relativePath)}`, options);
}

export function resolveMarkedVendorUrl(options = {}) {
  return resolveVendorUrl("marked/lib/marked.esm.js", options);
}
