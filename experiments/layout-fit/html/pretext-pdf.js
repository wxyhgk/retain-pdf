import { setMathText } from "./pretext-math.js";

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function graphemeCount(text) {
  let count = 0;
  for (const _ of graphemeSegmenter.segment(text.trimEnd())) {
    count += 1;
  }
  return count;
}

export function justifyLetterSpacingPt(text, renderedWidthPt, targetWidthPt, isLastLine) {
  if (isLastLine) return 0;
  const units = graphemeCount(text);
  if (units < 2) return 0;
  const slack = targetWidthPt - renderedWidthPt;
  if (slack <= 0.5) return 0;
  return slack / (units - 1);
}

function boxTextFromLines(lines) {
  return lines.map((line) => line.text).join("");
}

export function renderPdfOverlay({
  pageWidth,
  pageHeight,
  viewportWidth,
  viewportHeight,
  samples,
  currentSample,
  currentText,
  currentTargetWidthPt,
  currentTargetHeightPt,
  fontFamily,
  pdfPixelsPerPt,
  overlayEl,
  fitSample,
}) {
  overlayEl.innerHTML = "";
  const scale = Math.min(viewportWidth / pageWidth, viewportHeight / pageHeight);
  const offsetX = (viewportWidth - pageWidth * scale) / 2;
  const offsetY = (viewportHeight - pageHeight * scale) / 2;
  const flowFitCache = new Map();

  for (const sample of samples) {
    const isCurrent = currentSample && sample.sample_id === currentSample.sample_id;
    const fitKey = sample.flow?.group_id ?? sample.sample_id;
    if (!flowFitCache.has(fitKey)) {
      flowFitCache.set(
        fitKey,
        fitSample(sample, {
          text: isCurrent ? currentText : undefined,
          currentText: isCurrent ? currentText : undefined,
          currentSample: isCurrent ? sample : undefined,
          targetWidthPt: isCurrent ? currentTargetWidthPt : sample.target_box.width,
          targetHeightPt: isCurrent ? currentTargetHeightPt : sample.target_box.height,
          fontFamily,
          pdfPixelsPerPt,
        })
      );
    }
    const fit = flowFitCache.get(fitKey);
    const boxLines = fit?.placements?.get(sample.sample_id) ?? fit?.lines ?? [];
    const box = document.createElement("div");
    box.className = "pdf-box" + (isCurrent ? " current" : "");
    box.style.left = `${offsetX + sample.target_box.x * scale}px`;
    box.style.top = `${offsetY + sample.target_box.y * scale}px`;
    box.style.width = `${sample.target_box.width * scale}px`;
    box.style.height = `${sample.target_box.height * scale}px`;

    const lines = document.createElement("div");
    lines.className = "pdf-lines" + (isCurrent ? " current" : "") + (boxLines.length ? "" : " empty");
    lines.style.fontFamily = fontFamily;

    if (fit) {
      const boxText = boxTextFromLines(boxLines);
      if (boxText) {
        const node = document.createElement("div");
        node.className = "pdf-text-block" + (isCurrent ? " current" : "");
        node.style.width = `${sample.target_box.width * scale}px`;
        node.style.height = `${sample.target_box.height * scale}px`;
        node.style.fontSize = `${fit.fontSizePt * scale}px`;
        node.style.lineHeight = `${fit.lineHeightPt * scale}px`;
        setMathText(node, boxText);
        lines.append(node);
      }
    }

    box.append(lines);
    overlayEl.append(box);
  }
}
