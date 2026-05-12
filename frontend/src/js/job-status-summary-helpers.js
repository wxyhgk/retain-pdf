export function numberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function looksLikeProviderPercentProgress(current, total) {
  return total === 100 && current >= 0 && current <= 100;
}

export function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function progressFromText(payload) {
  const text = firstNonEmpty(payload.stage_detail, payload.runtime?.current_stage);
  const pageMatch = text.match(/第\s*(\d+)\s*[\/／]\s*(\d+)\s*(?:页|批|步)/i);
  if (pageMatch) {
    return {
      current: numberOrNull(pageMatch[1]),
      total: numberOrNull(pageMatch[2]),
    };
  }
  const percentMatch = text.match(/(\d+)\s*%/);
  if (percentMatch) {
    const current = numberOrNull(percentMatch[1]);
    return {
      current,
      total: 100,
    };
  }
  return {
    current: null,
    total: null,
  };
}
