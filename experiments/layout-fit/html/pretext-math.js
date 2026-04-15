function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isCjk(char) {
  return /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(char);
}

function isMathAscii(char) {
  return /[A-Za-z0-9\s{}_^.,;:()[\]+\-*/=|]/.test(char);
}

function previousNonSpace(text, index) {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (!/\s/.test(text[i])) {
      return text[i];
    }
  }
  return "";
}

function nextNonSpace(text, index) {
  for (let i = index; i < text.length; i += 1) {
    if (!/\s/.test(text[i])) {
      return text[i];
    }
  }
  return "";
}

function mathPrefixBefore(text, start) {
  let index = start;
  while (index > 0 && start - index < 48) {
    const char = text[index - 1];
    if (isCjk(char) || /[，。；：、!?！？]/.test(char) || char === "\n") {
      break;
    }
    if (!/[A-Za-z0-9\s{}_^.+\-*/=()[\]]/.test(char)) {
      break;
    }
    index -= 1;
  }
  const prefix = text.slice(index, start);
  if (!prefix.trim()) {
    return "";
  }
  if (!/[_^{}0-9.=+\-*/]/.test(prefix)) {
    return "";
  }
  return prefix;
}

function mathSuffixAfter(text, start, value) {
  let needCurly = 0;
  let needSquare = 0;
  let needParen = 0;
  for (const char of value) {
    if (char === "{") needCurly += 1;
    if (char === "}") needCurly = Math.max(0, needCurly - 1);
    if (char === "[") needSquare += 1;
    if (char === "]") needSquare = Math.max(0, needSquare - 1);
    if (char === "(") needParen += 1;
    if (char === ")") needParen = Math.max(0, needParen - 1);
  }
  let index = start;
  let suffix = "";
  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      suffix += char;
      index += 1;
      continue;
    }
    if (char === "}" && needCurly > 0) {
      suffix += char;
      needCurly -= 1;
      index += 1;
      continue;
    }
    if (char === "]" && needSquare > 0) {
      suffix += char;
      needSquare -= 1;
      index += 1;
      continue;
    }
    if (char === ")" && needParen > 0) {
      suffix += char;
      needParen -= 1;
      index += 1;
      continue;
    }
    break;
  }
  return { suffix, end: index };
}

function compactMathToken(value) {
  let normalized = value;

  // OCR often inserts a TeX control-space before plain letters, e.g.
  // `\mathrm { \ k c a l / m o l }`, which should become `\mathrm{kcal/mol}`.
  normalized = normalized
    .replace(/\\\s+(?=[A-Za-z0-9])/g, "")
    .replace(/\\\s+(?=\\[A-Za-z])/g, "");

  // Collapse OCR-spaced identifiers inside style commands before removing the
  // remaining whitespace, otherwise `\ k c a l` becomes `\kcal`.
  normalized = normalized.replace(
    /\\(mathrm|mathbf|mathbb|mathsf|mathcal|mathscr|operatorname|scriptsize|scriptstyle)\s*\{([^}]*)\}/g,
    (_, command, inner) => {
      const compactInner = inner
        .replace(/\\\s+/g, "")
        .replace(/\s+/g, "");
      return `\\${command}{${compactInner}}`;
    }
  );

  normalized = normalized
    .replace(/\\cal\s+([A-Za-z])/g, (_, letter) => `\\mathcal{${letter}}`)
    .replace(
      /\\(mathrm|mathbf|mathbb|mathsf|mathcal|mathscr|bar|check|dot|hat|tilde|vec)\s+([A-Za-z0-9])/g,
      (_, command, token) => `\\${command}{${token}}`
    );

  normalized = normalized
    .replace(/\\(left|right)\s+([()[\]{}|.])/g, (_, command, delimiter) => `\\${command}${delimiter}`)
    .replace(/\\([A-Za-z]+)\s+\{/g, (_, command) => `\\${command}{`)
    .replace(/\s+([{}_^()[\]=,+\-*/|])/g, "$1")
    .replace(/([{}_^()[\]=,+\-*/|])\s+/g, "$1")
    .replace(/\s+/g, "");

  normalized = normalized
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")");
  return normalized;
}

function compactDigits(value) {
  return value.replace(/\s+/g, "");
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function isDangerousMathToken(value) {
  const compact = compactMathToken(value);
  if (!compact) return false;
  if (compact.includes("\\begin{array}") || compact.includes("\\end{array}")) {
    return true;
  }
  if (compact.includes("\\right.") || compact.includes("\\left.")) {
    return true;
  }
  if (countMatches(compact, /\\left/g) !== countMatches(compact, /\\right/g)) {
    return true;
  }
  if (countMatches(compact, /\\begin\{/g) !== countMatches(compact, /\\end\{/g)) {
    return true;
  }
  if (countMatches(compact, /\{/g) !== countMatches(compact, /\}/g)) {
    return true;
  }
  if (/\\begin\{[A-Za-z]*$/.test(compact)) {
    return true;
  }
  if (/\\[A-Za-z]+\{$/.test(compact)) {
    return true;
  }
  if (/[_^]\}?$/.test(compact)) {
    return true;
  }
  if (/\\[A-Za-z]+[^A-Za-z{_^()[\]0-9\\=,+\-*/|.]/.test(compact)) {
    return true;
  }
  return false;
}

function normalizeKnownMathPatterns(text) {
  return text.replace(
    /(\d(?:\s+\d)*)\s*~\s*\^\s*\{\s*\\circ\s*\}\s*\\mathrm\s*\{\s*C\s*\}/g,
    (_, degrees) => `\\(${compactDigits(degrees)}~^{\\circ}\\mathrm{C}\\)`
  );
}

function readDelimitedMath(text, index) {
  if (text.startsWith("$$", index)) {
    const end = text.indexOf("$$", index + 2);
    if (end > index + 2) {
      return { value: text.slice(index, end + 2), end: end + 2 };
    }
  }
  if (text[index] === "$") {
    const end = text.indexOf("$", index + 1);
    if (end > index + 1) {
      return { value: text.slice(index, end + 1), end: end + 1 };
    }
  }
  if (text.startsWith("\\(", index)) {
    const end = text.indexOf("\\)", index + 2);
    if (end > index + 2) {
      return { value: text.slice(index, end + 2), end: end + 2 };
    }
  }
  if (text.startsWith("\\[", index)) {
    const end = text.indexOf("\\]", index + 2);
    if (end > index + 2) {
      return { value: text.slice(index, end + 2), end: end + 2 };
    }
  }
  return null;
}

function findMathRun(text, start) {
  let index = start;
  let sawCommand = false;
  let braceDepth = 0;

  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1] || "";
    if (char === "\\") {
      sawCommand = true;
      index += 1;
      if (/[A-Za-z]/.test(next)) {
        while (/[A-Za-z]/.test(text[index] || "")) {
          index += 1;
        }
      } else if (next) {
        index += 1;
      }
      continue;
    }
    if (char === "{") {
      braceDepth += 1;
      index += 1;
      continue;
    }
    if (char === "}") {
      if (braceDepth === 0) {
        break;
      }
      braceDepth -= 1;
      index += 1;
      continue;
    }
    if (braceDepth === 0 && sawCommand) {
      const prev = previousNonSpace(text, index);
      if (/[;:,]/.test(char)) {
        break;
      }
      if (/[A-Za-z0-9]/.test(char) && prev === "}") {
        break;
      }
      if (/\s/.test(char)) {
        const next = nextNonSpace(text, index + 1);
        if ((/[A-Za-z0-9]/.test(next) && prev === "}") || /[;:,]/.test(next)) {
          break;
        }
      }
    }
    if (isCjk(char) && braceDepth === 0) {
      break;
    }
    if (!isMathAscii(char) && braceDepth === 0) {
      break;
    }
    index += 1;
  }

  const value = text.slice(start, index).trimEnd();
  if (!sawCommand || !value || braceDepth !== 0) {
    return null;
  }
  return { value: compactMathToken(value), end: start + value.length };
}

export function normalizeMathText(text) {
  text = normalizeKnownMathPatterns(text);
  let out = "";
  let index = 0;
  while (index < text.length) {
    const delimited = readDelimitedMath(text, index);
    if (delimited) {
      out += delimited.value;
      index = delimited.end;
      continue;
    }
    if (text[index] === "\\") {
      const run = findMathRun(text, index);
      if (run) {
        const prefix = mathPrefixBefore(text, index);
        const suffixState = mathSuffixAfter(text, run.end, `${prefix}${run.value}`);
        const fullValue = `${prefix}${run.value}${suffixState.suffix}`;
        if (prefix && out.endsWith(prefix)) {
          out = out.slice(0, -prefix.length);
        }
        if (isDangerousMathToken(fullValue)) {
          out += fullValue;
        } else {
          out += `\\(${compactMathToken(fullValue)}\\)`;
        }
        index = suffixState.end;
        continue;
      }
    }
    out += text[index];
    index += 1;
  }
  return out;
}

export function textToMathHtml(text) {
  const normalized = normalizeMathText(text);
  let html = "";
  let index = 0;
  while (index < normalized.length) {
    const delimited = readDelimitedMath(normalized, index);
    if (delimited) {
      html += escapeHtml(delimited.value);
      index = delimited.end;
      continue;
    }
    html += normalized[index] === "\n" ? "<br>" : escapeHtml(normalized[index]);
    index += 1;
  }
  return html;
}

export function setMathText(node, text) {
  node.innerHTML = textToMathHtml(text);
}

export async function typesetMath(node) {
  if (!window.MathJax?.typesetPromise) {
    return;
  }
  await window.MathJax.startup?.promise;
  window.MathJax.typesetClear?.([node]);
  await window.MathJax.typesetPromise([node]);
}
