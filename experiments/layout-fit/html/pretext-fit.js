import { prepareWithSegments, layoutWithLines, layoutNextLine } from "../node_modules/@chenglou/pretext/dist/layout.js";
import { normalizeMathText } from "./pretext-math.js";

export function pretextFont(fontSizePt, fontFamily, pdfPixelsPerPt) {
  return `${fontSizePt * pdfPixelsPerPt}px ${fontFamily}`;
}

export function pretextOptionsFor(text) {
  return text.includes("\n") ? { whiteSpace: "pre-wrap" } : undefined;
}

export function orderedSamples(samples) {
  return [...samples].sort((a, b) => a.page_index - b.page_index || a.block_index - b.block_index);
}

export function preferredSampleText(sample, { currentSample, currentText } = {}) {
  if (
    currentSample &&
    sample.sample_id === currentSample.sample_id &&
    typeof currentText === "string"
  ) {
    return currentText;
  }
  return sample.translated_text || sample.translation_unit_text || sample.source_text || sample.fit_text || "";
}

export function flowTextForSamples(samples, currentSample, currentText) {
  if (typeof currentText === "string" && currentText.length) {
    return normalizeMathText(currentText);
  }
  const unitText = samples.find((sample) => sample.translation_unit_text)?.translation_unit_text;
  if (samples.length > 1 && unitText) {
    return normalizeMathText(unitText);
  }
  return normalizeMathText(samples
    .map((sample) => preferredSampleText(sample, { currentSample, currentText }))
    .join(""));
}

export function targetHeightForSamples(samples) {
  return samples.reduce((sum, item) => sum + item.target_box.height, 0);
}

export function targetLineCountForSamples(samples) {
  return samples.reduce((sum, item) => sum + (item.source_line_count || 0), 0);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function defaultBaseFontSizePt(targetHeightPt, sourceLineCount) {
  const lines = Math.max(sourceLineCount || 1, 1);
  const estimated = targetHeightPt / Math.max(lines * 1.24, 1);
  return clamp(estimated, 7.5, 18);
}

function defaultSearchBounds(options, context) {
  const {
    targetHeightPt,
    targetWidthPt,
    sourceLineCount,
  } = context;
  const baseSize = options.fontSizePt ?? defaultBaseFontSizePt(targetHeightPt, sourceLineCount);
  const widthBound = clamp(targetWidthPt / 5.5, 8, 30);
  const heightBound = clamp(targetHeightPt / Math.max((sourceLineCount || 1) * 1.05, 1), 6, 28);
  return {
    baseSize,
    minFontSizePt: options.minFontSizePt ?? clamp(Math.min(baseSize * 0.55, heightBound * 0.7), 4, 18),
    maxFontSizePt: options.maxFontSizePt ?? clamp(Math.max(baseSize * 1.8, Math.min(widthBound, heightBound * 1.25)), 8, 32),
    minLineHeightRatio: options.minLineHeightRatio ?? 1.05,
    maxLineHeightRatio: options.maxLineHeightRatio ?? 1.6,
  };
}

export function scoreFit(result, context) {
  const { targetWidthPt, targetHeightPt, sourceLineCount, baseFontSizePt } = context;
  const heightError = Math.abs(result.height - targetHeightPt) / Math.max(targetHeightPt, 1);
  const overflowY = Math.max(0, result.height - targetHeightPt) / Math.max(targetHeightPt, 1);
  const overflowX = Math.max(0, result.maxLineWidth - targetWidthPt) / Math.max(targetWidthPt, 1);
  const lastLineRatio = result.lastLineWidth / Math.max(targetWidthPt, 1);
  const lineCountDelta = sourceLineCount ? Math.abs(result.lineCount - sourceLineCount) : 0;
  const readabilityFloor = result.fontSizePt < 7.5 ? 7.5 - result.fontSizePt : 0;
  const readabilityDrift = baseFontSizePt ? Math.abs(result.fontSizePt - baseFontSizePt) / Math.max(baseFontSizePt, 1) : 0;
  const leadingLow = result.lineHeightRatio < 1.12 ? 1.12 - result.lineHeightRatio : 0;
  const leadingVeryLow = result.lineHeightRatio < 1.02 ? 1.02 - result.lineHeightRatio : 0;
  const leadingHigh = result.lineHeightRatio > 1.42 ? result.lineHeightRatio - 1.42 : 0;
  const lastLinePenalty = result.lineCount > 1 && lastLineRatio < 0.16 ? 0.16 - lastLineRatio : 0;
  const underfill = result.height < targetHeightPt * 0.82 ? (targetHeightPt * 0.82 - result.height) / Math.max(targetHeightPt, 1) : 0;

  return (
    heightError * 140 +
    overflowY * 640 +
    overflowX * 760 +
    underfill * 120 +
    lastLinePenalty * 16 +
    readabilityFloor * 60 +
    readabilityDrift * 6 +
    leadingLow * 240 +
    leadingVeryLow * 2000 +
    leadingHigh * 75 +
    lineCountDelta * 2
  );
}

function streamLinesIntoBoxes(prepared, boxes, lineHeightPt, pdfPixelsPerPt) {
  const placements = new Map();
  let cursor = { segmentIndex: 0, graphemeIndex: 0 };
  let lineCount = 0;
  let emptyBoxCount = 0;

  for (const box of boxes) {
    const capacity = Math.max(0, Math.floor((box.targetHeightPt + 0.01) / lineHeightPt));
    const lines = [];
    for (let lineIndex = 0; lineIndex < capacity; lineIndex += 1) {
      const line = layoutNextLine(prepared, cursor, box.targetWidthPt * pdfPixelsPerPt);
      if (!line) break;
      lines.push({
        ...line,
        width: line.width / pdfPixelsPerPt,
      });
      cursor = line.end;
      lineCount += 1;
    }
    if (box.sourceLineCount > 0 && lines.length === 0) {
      emptyBoxCount += 1;
    }
    placements.set(box.sample_id, lines);
  }

  const remaining = boxes.length
    ? layoutNextLine(prepared, cursor, boxes[boxes.length - 1].targetWidthPt * pdfPixelsPerPt)
    : null;
  return {
    placements,
    lineCount,
    emptyBoxCount,
    remainingLine: remaining,
    usedHeightPt: lineCount * lineHeightPt,
  };
}

function fitFlowWithPretext(samples, options) {
  const { round, pdfPixelsPerPt } = options;
  const ordered = orderedSamples(samples);
  const fontFamily = options.fontFamily;
  const boxes = ordered.map((sample) => ({
    sample_id: sample.sample_id,
    targetWidthPt: options.boxTargetWidthPt?.[sample.sample_id] ?? sample.target_box.width,
    targetHeightPt: options.boxTargetHeightPt?.[sample.sample_id] ?? sample.target_box.height,
    sourceLineCount: sample.source_line_count || 0,
  }));
  const text = normalizeMathText(options.text ?? flowTextForSamples(ordered, options.currentSample, options.currentText));
  const totalTargetHeightPt = boxes.reduce((sum, box) => sum + box.targetHeightPt, 0);
  const totalSourceLineCount = boxes.reduce((sum, box) => sum + box.sourceLineCount, 0);
  const maxTargetWidthPt = boxes.reduce((max, box) => Math.max(max, box.targetWidthPt), 0);
  const {
    baseSize,
    minFontSizePt,
    maxFontSizePt,
    minLineHeightRatio,
    maxLineHeightRatio,
  } = defaultSearchBounds(options, {
    targetHeightPt: totalTargetHeightPt,
    targetWidthPt: maxTargetWidthPt,
    sourceLineCount: totalSourceLineCount,
  });

  let best = null;
  for (let fontSizePt = minFontSizePt; fontSizePt <= maxFontSizePt + 1e-9; fontSizePt += 0.05) {
    const prepared = prepareWithSegments(
      text,
      pretextFont(fontSizePt, fontFamily, pdfPixelsPerPt),
      pretextOptionsFor(text)
    );
    for (let lineHeightRatio = minLineHeightRatio; lineHeightRatio <= maxLineHeightRatio + 1e-9; lineHeightRatio += 0.01) {
      const lineHeightPt = fontSizePt * lineHeightRatio;
      const streamed = streamLinesIntoBoxes(prepared, boxes, lineHeightPt, pdfPixelsPerPt);
      const allLines = boxes.flatMap((box) => streamed.placements.get(box.sample_id) || []);
      const maxLineWidth = allLines.reduce((max, line) => Math.max(max, line.width), 0);
      const lastLineWidth = allLines.length ? allLines[allLines.length - 1].width : 0;
      const overflowPenalty = streamed.remainingLine ? 1 : 0;
      const candidate = {
        fontSizePt: round(fontSizePt),
        lineHeightRatio: round(lineHeightRatio),
        lineHeightPt: round(lineHeightPt),
        height: round(streamed.usedHeightPt),
        lineCount: streamed.lineCount,
        maxLineWidth: round(maxLineWidth),
        lastLineWidth: round(lastLineWidth),
        lines: allLines,
        placements: streamed.placements,
        overflowLine: streamed.remainingLine,
        emptyBoxCount: streamed.emptyBoxCount,
      };
      candidate.score = scoreFit(candidate, {
        targetWidthPt: maxTargetWidthPt,
        targetHeightPt: totalTargetHeightPt,
        sourceLineCount: totalSourceLineCount,
        baseFontSizePt: baseSize,
      }) + overflowPenalty * 5000 + streamed.emptyBoxCount * 7000;
      if (!best || candidate.score < best.score) {
        best = candidate;
      }
    }
  }
  return best;
}

export function fitSampleWithPretext(sample, options) {
  const { round, flowSamples } = options;
  if (flowSamples.length > 1) {
    return fitFlowWithPretext(flowSamples, options);
  }

  const text = normalizeMathText(
    options.text ?? preferredSampleText(sample)
  );
  const targetWidthPt = options.targetWidthPt ?? sample?.target_box?.width ?? 1;
  const targetHeightPt = options.targetHeightPt ?? sample?.target_box?.height ?? 1;
  const fontFamily = options.fontFamily;
  const pdfPixelsPerPt = options.pdfPixelsPerPt;
  const {
    baseSize,
    minFontSizePt,
    maxFontSizePt,
    minLineHeightRatio,
    maxLineHeightRatio,
  } = defaultSearchBounds(options, {
    targetHeightPt,
    targetWidthPt,
    sourceLineCount: sample?.source_line_count,
  });

  let best = null;
  for (let fontSizePt = minFontSizePt; fontSizePt <= maxFontSizePt + 1e-9; fontSizePt += 0.05) {
    const prepared = prepareWithSegments(
      text,
      pretextFont(fontSizePt, fontFamily, pdfPixelsPerPt),
      pretextOptionsFor(text)
    );
    for (let lineHeightRatio = minLineHeightRatio; lineHeightRatio <= maxLineHeightRatio + 1e-9; lineHeightRatio += 0.01) {
      const lineHeightPt = fontSizePt * lineHeightRatio;
      const laidOut = layoutWithLines(
        prepared,
        targetWidthPt * pdfPixelsPerPt,
        lineHeightPt * pdfPixelsPerPt
      );
      const lines = laidOut.lines.map((line) => ({
        ...line,
        width: line.width / pdfPixelsPerPt,
      }));
      const maxLineWidth = lines.reduce((max, line) => Math.max(max, line.width), 0);
      const lastLineWidth = lines.length ? lines[lines.length - 1].width : 0;
      const candidate = {
        fontSizePt: round(fontSizePt),
        lineHeightRatio: round(lineHeightRatio),
        lineHeightPt: round(lineHeightPt),
        height: round(laidOut.height / pdfPixelsPerPt),
        lineCount: laidOut.lineCount,
        maxLineWidth: round(maxLineWidth),
        lastLineWidth: round(lastLineWidth),
        lines,
      };
      candidate.score = scoreFit(candidate, {
        targetWidthPt,
        targetHeightPt,
        sourceLineCount: sample?.source_line_count,
        baseFontSizePt: baseSize,
      });
      if (!best || candidate.score < best.score) {
        best = candidate;
      }
    }
  }
  return best;
}

export function measurePretext({ text, widthPt, fontSizePt, lineHeightPt, fontFamily, pdfPixelsPerPt, round }) {
  const normalizedText = normalizeMathText(text);
  const prepared = prepareWithSegments(
    normalizedText,
    pretextFont(fontSizePt, fontFamily, pdfPixelsPerPt),
    pretextOptionsFor(normalizedText)
  );
  const laidOut = layoutWithLines(prepared, widthPt * pdfPixelsPerPt, lineHeightPt * pdfPixelsPerPt);
  const lines = laidOut.lines.map((line) => ({
    ...line,
    width: line.width / pdfPixelsPerPt,
  }));
  const maxLineWidth = lines.reduce((max, line) => Math.max(max, line.width), 0);
  return {
    height: round(laidOut.height / pdfPixelsPerPt),
    lineCount: laidOut.lineCount,
    maxLineWidth: round(maxLineWidth),
    lastLineWidth: round(lines.length ? lines[lines.length - 1].width : 0),
    lines,
  };
}
