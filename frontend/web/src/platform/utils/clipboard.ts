export async function copyText(text) {
  const normalizedText = `${text || ""}`;
  if (!normalizedText) {
    throw new Error("empty_copy_text");
  }

  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(normalizedText);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = normalizedText;
  textarea.setAttribute("readonly", "true");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, normalizedText.length);

  try {
    const success = document.execCommand("copy");
    if (!success) {
      throw new Error("exec_command_copy_failed");
    }
  } finally {
    textarea.remove();
  }
}
