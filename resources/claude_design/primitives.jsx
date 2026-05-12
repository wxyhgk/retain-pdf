// primitives.jsx
// Shared primitives for all scenes.

const PAGE_W = 360;
const PAGE_H = 504;     // ~A4-ish
const SERIF = '"Charter", "Iowan Old Style", "Times New Roman", ui-serif, serif';
const SANS  = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif';
const MONO  = '"SF Mono", "JetBrains Mono", Menlo, ui-monospace, monospace';
const HAN   = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

const INK = '#1d1d1f';
const FAINT = '#86868b';
const HAIRLINE = '#e7e7e7';
const PAPER = '#ffffff';
const PANEL = '#ffffff';
const APPBG = '#f5f5f7';
const ACCENT = '#0071e3';

// ── PDFPage ────────────────────────────────────────────────────────────────
// A realistic-looking academic page. Many flags to control its state.
function PDFPage({
  x = 0, y = 0,
  width = PAGE_W, height = PAGE_H,
  scale = 1,
  rotate = 0,
  shadow = true,
  language = 'en',           // 'en' | 'zh' | 'mixed'
  showOriginal = true,       // show original text layer
  highlightLines = [],       // array of {col, idx, type}
  bboxes = [],               // [{x, y, w, h, opacity?}]
  scanLineY = null,          // 0..1 if showing scan
  maskedRects = [],          // [{col, idx}] — paint white over
  garbleSet = new Set(),     // {col-idx} that are garbled
  twoColumn = true,
  showFigure = true,
  showFooter = true,
  pageNumber = 1,
  opacity = 1,
  children,
}) {
  const colW = (width - 24 - 24 - 12) / 2;     // 24 outer padding, 12 gutter
  const colX1 = 24;
  const colX2 = 24 + colW + 12;

  // Body lines per column
  const linesPerCol = 18;
  const lineY0 = 122;
  const lineH = 9;

  const renderLine = (col, idx) => {
    const cx = col === 0 ? colX1 : colX2;
    const yy = lineY0 + idx * lineH;
    if (showFigure && col === 1 && idx >= 4 && idx <= 11) return null; // figure occupies these slots
    const isMasked = maskedRects.some(r => r.col === col && r.idx === idx);
    const isGarbled = garbleSet.has(`${col}-${idx}`);
    const widthFrac = 0.55 + ((idx * 13 + col * 7) % 45) / 100;
    const w = colW * widthFrac;

    return (
      <g key={`${col}-${idx}`}>
        {/* background mask (white rect) appears when 'masked' */}
        {isMasked ? (
          <rect x={cx - 1} y={yy - 6} width={colW + 2} height={lineH} fill="#fff" />
        ) : null}
        {!isMasked && (
          <TextLine
            x={cx} y={yy} width={w} height={5}
            language={isGarbled ? 'garbled' : language}
            seed={col * 100 + idx}
          />
        )}
      </g>
    );
  };

  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      width, height,
      transform: `scale(${scale}) rotate(${rotate}deg)`,
      transformOrigin: 'top left',
      background: PAPER,
      boxShadow: shadow ? '0 8px 24px rgba(0,0,0,0.10), 0 1px 0 rgba(0,0,0,0.04)' : 'none',
      borderRadius: 2,
      overflow: 'hidden',
      opacity,
    }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Title (1-2 lines centered) */}
        <text x={width / 2} y={48} textAnchor="middle"
          fontFamily={SERIF} fontSize={13} fontWeight={700} fill={INK}>
          {language === 'zh' ? '保留排版的文档翻译方法综述'
           : language === 'mixed' ? '保留排版的文档翻译方法综述'
           : 'Layout-Preserving Document Translation'}
        </text>
        <text x={width / 2} y={64} textAnchor="middle"
          fontFamily={SERIF} fontSize={9} fill={FAINT}>
          {language === 'zh' || language === 'mixed' ? '林知行  ·  陈雨桐  ·  2024' : 'Z. Lin · Y. Chen · 2024'}
        </text>

        {/* Abstract block — single column above the two columns */}
        <text x={24} y={86} fontFamily={SERIF} fontSize={8} fontWeight={700} fill={INK}>
          {language === 'zh' || language === 'mixed' ? '摘要' : 'Abstract'}
        </text>
        <TextLine x={24} y={94} width={width - 48} language={language === 'mixed' ? 'zh' : language} seed={9001} />
        <TextLine x={24} y={103} width={width - 48 - 30} language={language === 'mixed' ? 'zh' : language} seed={9002} />

        {/* Body lines */}
        {twoColumn && Array.from({ length: linesPerCol }).map((_, i) => renderLine(0, i))}
        {twoColumn && Array.from({ length: linesPerCol }).map((_, i) => renderLine(1, i))}

        {/* Figure placeholder in col 1 */}
        {showFigure && (
          <g>
            <rect x={colX2} y={lineY0 + 4 * lineH - 6} width={colW} height={lineH * 8 - 4}
              fill="#f2f2f4" stroke={HAIRLINE} />
            {/* fake plot */}
            <polyline points={`
              ${colX2 + 8},${lineY0 + 11 * lineH - 12}
              ${colX2 + colW * 0.25},${lineY0 + 9 * lineH - 8}
              ${colX2 + colW * 0.5},${lineY0 + 7 * lineH - 4}
              ${colX2 + colW * 0.75},${lineY0 + 6 * lineH - 2}
              ${colX2 + colW - 8},${lineY0 + 5 * lineH - 6}
            `} fill="none" stroke={INK} strokeWidth="0.8" />
            <line x1={colX2 + 8} y1={lineY0 + 11 * lineH - 4}
              x2={colX2 + colW - 8} y2={lineY0 + 11 * lineH - 4}
              stroke={FAINT} strokeWidth="0.4" />
            <text x={colX2 + colW / 2} y={lineY0 + 11 * lineH + 4} textAnchor="middle"
              fontFamily={SERIF} fontSize={6} fill={FAINT} fontStyle="italic">
              Fig. 1
            </text>
          </g>
        )}

        {/* Bounding boxes overlay */}
        {bboxes.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h}
            fill={b.fill || 'none'}
            stroke={b.stroke || ACCENT}
            strokeWidth={b.strokeWidth || 0.8}
            strokeDasharray={b.dashed ? '2 2' : undefined}
            opacity={b.opacity ?? 1} />
        ))}

        {/* Highlight rows */}
        {highlightLines.map((h, i) => {
          const cx = h.col === 0 ? colX1 : colX2;
          const yy = lineY0 + h.idx * lineH - 6;
          return (
            <rect key={i} x={cx - 2} y={yy} width={colW + 4} height={lineH}
              fill={h.fill || 'rgba(0,113,227,0.12)'}
              stroke={h.stroke || 'none'}
              opacity={h.opacity ?? 1} />
          );
        })}

        {/* Scan line */}
        {scanLineY != null && (
          <g>
            <rect x={0} y={scanLineY * height - 16} width={width} height={32}
              fill="url(#scanGrad)" opacity={0.55} />
            <line x1={0} y1={scanLineY * height} x2={width} y2={scanLineY * height}
              stroke={ACCENT} strokeWidth="0.8" />
            <defs>
              <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity="0" />
                <stop offset="50%" stopColor={ACCENT} stopOpacity="0.25" />
                <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
              </linearGradient>
            </defs>
          </g>
        )}

        {/* Page number */}
        {showFooter && (
          <text x={width / 2} y={height - 18} textAnchor="middle"
            fontFamily={SERIF} fontSize={7} fill={FAINT}>
            {pageNumber}
          </text>
        )}
      </svg>
      {children}
    </div>
  );
}

// A "text line" rendered as little glyph rectangles — looks like real type
// from a few feet away. For zh, characters are square; for en, varied widths.
function TextLine({ x, y, width, height = 4, language = 'en', seed = 0 }) {
  // Deterministic pseudo-random using seed
  const rand = (n) => {
    const x = Math.sin(seed * 9301 + n * 49297) * 233280;
    return x - Math.floor(x);
  };

  const glyphs = [];
  let cursor = 0;
  let i = 0;
  while (cursor < width) {
    let w;
    if (language === 'zh') {
      w = 4.5 + rand(i) * 0.8;
    } else if (language === 'garbled') {
      w = 3.5 + rand(i) * 1.5;
    } else {
      // english-ish varied widths
      w = 1.6 + rand(i) * 4.8;
    }
    if (cursor + w > width) break;
    if (language === 'garbled') {
      // little hatched/broken glyph
      glyphs.push(
        <g key={i}>
          <rect x={x + cursor} y={y - height + 0.5} width={w} height={height} fill="#9b9b9b" />
          <rect x={x + cursor + 0.5} y={y - height + 1} width={Math.max(0, w - 1)} height={Math.max(0, height - 2)} fill="#fff" />
          <line x1={x + cursor} y1={y - 0.5} x2={x + cursor + w} y2={y - 0.5} stroke="#9b9b9b" strokeWidth="0.3" />
        </g>
      );
    } else {
      glyphs.push(
        <rect key={i} x={x + cursor} y={y - height} width={w} height={height} fill={INK} />
      );
    }
    const space = language === 'zh' ? 0.6 : (language === 'garbled' ? 0.8 : 1.2 + rand(i + 100) * 0.8);
    cursor += w + space;
    i++;
  }
  return <g>{glyphs}</g>;
}

// ── Cloud icon ─────────────────────────────────────────────────────────────
function CloudIcon({ size = 60, color = INK }) {
  const s = size / 60;
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 60 42" fill="none">
      <path d="M14 30 a8 8 0 0 1 0-16 a10 10 0 0 1 19-3 a8 8 0 0 1 13 9 a7 7 0 0 1-3 13 H17 a7 7 0 0 1-3-3z"
        fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

// ── PDF file icon ─────────────────────────────────────────────────────────
function PDFFileIcon({ size = 56, color = INK, label = 'PDF' }) {
  const w = size, h = size * 1.25;
  return (
    <svg width={w} height={h} viewBox="0 0 48 60" fill="none">
      <path d="M6 2 H32 L42 12 V56 a2 2 0 0 1-2 2 H6 a2 2 0 0 1-2-2 V4 a2 2 0 0 1 2-2 z"
        fill="#fff" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M32 2 V12 H42" stroke={color} strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      <rect x="10" y="38" width="28" height="14" rx="2" fill={color} />
      <text x="24" y="48" textAnchor="middle" fontFamily={MONO} fontSize="8" fontWeight="700" fill="#fff">{label}</text>
    </svg>
  );
}

// ── Check icon ─────────────────────────────────────────────────────────────
function CheckCircle({ size = 24, color = '#34c759', progress = 1 }) {
  const r = size / 2 - 1;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="1.5"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - progress)}
        transform={`rotate(-90 ${c} ${c})`} />
      {progress > 0.85 && (
        <path d={`M ${size * 0.3} ${size * 0.5} L ${size * 0.45} ${size * 0.65} L ${size * 0.7} ${size * 0.38}`}
          stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"
          opacity={(progress - 0.85) / 0.15} />
      )}
    </svg>
  );
}

// ── Caption (under the page) ──────────────────────────────────────────────
function Caption({ x, y, label, value, align = 'left', color = INK }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      transform: align === 'center' ? 'translateX(-50%)' : align === 'right' ? 'translateX(-100%)' : 'none',
      fontFamily: MONO, fontSize: 11, color: FAINT,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>
      <span>{label}</span>
      {value != null && <span style={{ color, marginLeft: 8 }}>{value}</span>}
    </div>
  );
}

// ── A small label tag/pill ────────────────────────────────────────────────
function Pill({ x, y, children, color = INK, bg = '#fff', border = HAIRLINE, opacity = 1, font = MONO }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      padding: '4px 10px',
      borderRadius: 999,
      fontFamily: font, fontSize: 11, fontWeight: 500,
      color, background: bg,
      border: `1px solid ${border}`,
      whiteSpace: 'nowrap',
      opacity,
      letterSpacing: 0,
    }}>
      {children}
    </div>
  );
}

// ── Connector line (dashed) ────────────────────────────────────────────────
function Connector({ x1, y1, x2, y2, progress = 1, dashed = true, color = ACCENT, width = 1 }) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const drawn = len * progress;
  const angle = Math.atan2(dy, dx);
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
      width="0" height="0">
      <line x1={x1} y1={y1}
        x2={x1 + Math.cos(angle) * drawn}
        y2={y1 + Math.sin(angle) * drawn}
        stroke={color} strokeWidth={width}
        strokeDasharray={dashed ? '4 3' : undefined}
        strokeLinecap="round" />
    </svg>
  );
}

function Dot({ color, size = 12 }) {
  return <div style={{ width: size, height: size, borderRadius: size / 2, background: color }} />;
}

Object.assign(window, {
  PAGE_W, PAGE_H, SERIF, SANS, MONO, HAN,
  INK, FAINT, HAIRLINE, PAPER, PANEL, APPBG, ACCENT,
  PDFPage, TextLine, CloudIcon, PDFFileIcon, CheckCircle, Caption, Pill, Connector, Dot,
});
