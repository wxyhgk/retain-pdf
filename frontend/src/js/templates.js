async function loadPartial(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`加载页面片段失败: ${relativePath}`);
  }
  return response.text();
}

export async function renderPageShell() {
  const [mainContent, dialogs] = await Promise.all([
    loadPartial("../partials/main-content.html"),
    loadPartial("../partials/dialogs.html"),
  ]);

  document.body.innerHTML = `${mainContent}${dialogs}`;
}
