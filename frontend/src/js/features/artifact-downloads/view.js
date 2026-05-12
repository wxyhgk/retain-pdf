export function isActionLinkDisabled(link) {
  return link.classList.contains("disabled") || link.getAttribute("aria-disabled") === "true";
}

export function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export function bindProtectedArtifactLinks(handler) {
  document.querySelectorAll("#download-btn, #markdown-bundle-btn, #pdf-btn, #markdown-btn, #markdown-raw-btn")
    .forEach((node) => {
      node.addEventListener("click", handler);
    });
}
