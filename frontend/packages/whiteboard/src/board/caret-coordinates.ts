// 文本框里光标的位置（相对文本框左上角，像素）：补全菜单、公式预览贴着光标放用。
// 做法是常见的「镜像 div」：照文本框的字体、宽度、内边距复制一份，量光标前面那段字排出来停在哪。

const COPIED = [
  "boxSizing", "width", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize", "lineHeight", "fontFamily",
  "textAlign", "textTransform", "textIndent", "letterSpacing", "wordSpacing", "tabSize",
] as const;

export type CaretPoint = { top: number; left: number; height: number };

export function caretCoordinates(textarea: HTMLTextAreaElement, position: number): CaretPoint {
  const doc = textarea.ownerDocument;
  const style = doc.defaultView?.getComputedStyle(textarea);
  const mirror = doc.createElement("div");
  const target = mirror.style as unknown as Record<string, string>;
  if (style) for (const key of COPIED) target[key] = (style as unknown as Record<string, string>)[key];
  target.position = "absolute";
  target.visibility = "hidden";
  target.whiteSpace = "pre-wrap";
  target.overflowWrap = "break-word";
  target.top = "0";
  target.left = "-9999px";
  mirror.textContent = textarea.value.slice(0, position);
  const marker = doc.createElement("span");
  marker.textContent = textarea.value.slice(position) || ".";
  mirror.appendChild(marker);
  doc.body.appendChild(mirror);
  const lineHeight = Number.parseFloat(style?.lineHeight ?? "") || Number.parseFloat(style?.fontSize ?? "16") * 1.4;
  const point = {
    top: marker.offsetTop - textarea.scrollTop,
    left: marker.offsetLeft - textarea.scrollLeft,
    height: lineHeight,
  };
  mirror.remove();
  return point;
}
