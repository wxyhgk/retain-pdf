// scene-render.jsx
// 4 substeps: mask, typst overlay, merge, compress.

// ── 3.1 背景 / 遮盖处理 ───────────────────────────────────────────────────
function SceneMask({ progress }) {
  // PDF page on left: original English text being covered by white rectangles, line by line.
  // On the right: a "background" extracted (figure stays, text gone).

  const reveal = animate({ from: 0, to: 1, start: 0.1, end: 0.9, ease: Easing.linear })(progress);

  // We mask all text rows progressively (left → right, top → bottom)
  const totalLines = 18 * 2;
  const maskedCount = Math.floor(reveal * totalLines);
  const maskedRects = [];
  for (let i = 0; i < maskedCount; i++) {
    const col = i % 2;
    const idx = Math.floor(i / 2);
    if (idx < 18) maskedRects.push({ col, idx });
  }

  // Also mask abstract progressively at the start
  const showAbstractMask = reveal > 0.05;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Caption x={300} y={28} label="ORIGINAL" />
      <Caption x={840} y={28} label="MASK · CLEAN PLATE" />

      {/* Left page: as-is with progressive masking */}
      <PDFPage x={300} y={56} language="en" maskedRects={maskedRects} />

      {/* Right page: same layout but stripped of text — only figure + masks */}
      <div style={{
        position: 'absolute', left: 840, top: 56,
        width: PAGE_W, height: PAGE_H,
        background: PAPER,
        boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
        borderRadius: 2, overflow: 'hidden',
      }}>
        <svg width={PAGE_W} height={PAGE_H}>
          {/* Just the figure, paper background */}
          {/* Figure box */}
          <g opacity={reveal}>
            <rect x="184" y={122 + 4 * 9 - 6} width={(PAGE_W - 24 - 24 - 12) / 2} height={9 * 8 - 4}
              fill="#f2f2f4" stroke={HAIRLINE} />
            <polyline points={`
              ${184 + 8},${122 + 11 * 9 - 12}
              ${184 + 36},${122 + 9 * 9 - 8}
              ${184 + 78},${122 + 7 * 9 - 4}
              ${184 + 117},${122 + 6 * 9 - 2}
              ${184 + 154 - 8},${122 + 5 * 9 - 6}
            `} fill="none" stroke={INK} strokeWidth="0.8" />
            <text x={184 + 154 / 2 + 8} y={122 + 11 * 9 + 4} textAnchor="middle"
              fontFamily={SERIF} fontSize={6} fill={FAINT} fontStyle="italic">
              Fig. 1
            </text>
          </g>
          {/* Show "removed text" outline rectangles where the original text was — light grey */}
          {showAbstractMask && (
            <g opacity={reveal}>
              <rect x="24" y="88" width={PAGE_W - 48} height="6" fill="#f5f5f7" />
              <rect x="24" y="98" width={PAGE_W - 48 - 30} height="6" fill="#f5f5f7" />
            </g>
          )}
          {Array.from({ length: 18 }).map((_, i) => (
            <g key={i} opacity={reveal}>
              <rect x="22" y={122 + i * 9 - 6} width={(PAGE_W - 24 - 24 - 12) / 2 + 2} height="6" fill="#f5f5f7" />
              {!(i >= 4 && i <= 11) && (
                <rect x="184" y={122 + i * 9 - 6} width={(PAGE_W - 24 - 24 - 12) / 2 + 2} height="6" fill="#f5f5f7" />
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Status pill */}
      <Pill x={300} y={580} bg="#fff" border={HAIRLINE} color={INK}>
        masking text · {maskedCount}/{totalLines} lines · keep figures
      </Pill>
    </div>
  );
}

// ── 3.2 Typst overlay 编译 ────────────────────────────────────────────────
function SceneTypst({ progress }) {
  // Left: code editor showing Typst overlay code being typed/processed line by line.
  // Right: PDF page with Chinese text appearing in the same layout positions.

  const codeP = animate({ from: 0, to: 1, start: 0.0, end: 0.7, ease: Easing.linear })(progress);
  const renderP = animate({ from: 0, to: 1, start: 0.2, end: 0.95, ease: Easing.linear })(progress);

  const codeLines = [
    { text: '#set page(width: 595pt, height: 842pt, margin: 0pt)', kind: 'directive' },
    { text: '#set text(font: "Source Han Serif SC", size: 9.5pt)', kind: 'directive' },
    { text: '', kind: 'blank' },
    { text: '#place(dx: 62pt, dy: 88pt)[摘要]', kind: 'place', col: -1, idx: -1 },
    { text: '#place(dx: 62pt, dy: 98pt)[我们提出一种端到端流水线…]', kind: 'place', col: -1, idx: -1 },
    { text: '#place(dx: 62pt, dy: 122pt)[1 引言]', kind: 'place', col: 0, idx: 0 },
    { text: '#place(dx: 62pt, dy: 131pt)[文档翻译长期受困于排版崩塌…]', kind: 'place', col: 0, idx: 1 },
    { text: '#place(dx: 62pt, dy: 140pt)[结果 PDF 丢失图片位置与栏目…]', kind: 'place', col: 0, idx: 2 },
    { text: '#place(dx: 62pt, dy: 149pt)[本工作以 Typst overlay 解决…]', kind: 'place', col: 0, idx: 3 },
    { text: '#place(dx: 184pt, dy: 122pt)[图 1: 系统架构]', kind: 'place', col: 1, idx: 0 },
    { text: '#place(dx: 184pt, dy: 230pt)[2 方法]', kind: 'place', col: 1, idx: 12 },
    { text: '#place(dx: 184pt, dy: 239pt)[流水线分为三个阶段…]', kind: 'place', col: 1, idx: 13 },
  ];

  const visibleLines = Math.floor(codeP * codeLines.length);
  const partialChars = Math.floor((codeP * codeLines.length - visibleLines) * 60);
  const linesRendered = Math.floor(renderP * 16);

  return (
    <div style={{ position: 'absolute', inset: 0, padding: '40px 60px', display: 'flex', gap: 40 }}>
      {/* Code editor */}
      <div style={{
        flex: '0 0 720px',
        background: '#1d1d1f', borderRadius: 10,
        boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '10px 16px',
          background: '#2a2a2d',
          borderBottom: '1px solid #3a3a3d',
          fontFamily: MONO, fontSize: 11, color: '#a8a8ad',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <Dot color="#ff5f57" />
            <Dot color="#febc2e" />
            <Dot color="#28c840" />
          </div>
          <span style={{ marginLeft: 8 }}>overlay.typ</span>
          <span style={{ marginLeft: 'auto', color: '#5e5e63' }}>
            typst compile · {linesRendered} blocks placed
          </span>
        </div>
        <div style={{
          flex: 1, padding: '14px 18px',
          fontFamily: MONO, fontSize: 11.5, lineHeight: 1.7,
          color: '#e6e6e6',
          minHeight: 480,
        }}>
          {codeLines.slice(0, visibleLines + 1).map((ln, i) => {
            const isCurrent = i === visibleLines;
            const txt = isCurrent ? ln.text.slice(0, partialChars) : ln.text;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ color: '#5e5e63', width: 22, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1 }}>
                  <TypstHighlight text={txt} />
                  {isCurrent && (
                    <span style={{ background: '#34c759', display: 'inline-block', width: 6, height: 13,
                      verticalAlign: 'middle', marginLeft: 1, animation: 'blink 1s step-end infinite' }} />
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rendered PDF on the right */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Caption x={0} y={0} label="OUTPUT" />
        <div style={{ marginTop: 28, position: 'relative' }}>
          <RenderingPage progress={renderP} />
        </div>
      </div>

      <style>{`@keyframes blink { 0%, 50% { opacity: 1 } 50.01%, 100% { opacity: 0 } }`}</style>
    </div>
  );
}

function RenderingPage({ progress }) {
  const linesPerCol = 18;
  const totalLines = linesPerCol * 2;
  const linesRendered = Math.floor(progress * totalLines);

  const colW = (PAGE_W - 24 - 24 - 12) / 2;
  const colX1 = 24, colX2 = 24 + colW + 12;
  const lineY0 = 122, lineH = 9;

  return (
    <div style={{
      width: PAGE_W, height: PAGE_H, background: PAPER,
      boxShadow: '0 8px 24px rgba(0,0,0,0.10)', borderRadius: 2,
      position: 'relative', overflow: 'hidden',
    }}>
      <svg width={PAGE_W} height={PAGE_H} viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}>
        <text x={PAGE_W / 2} y={48} textAnchor="middle"
          fontFamily={SERIF} fontSize={13} fontWeight={700} fill={INK} opacity={progress > 0.05 ? 1 : 0}>
          保留排版的文档翻译方法综述
        </text>
        <text x={PAGE_W / 2} y={64} textAnchor="middle"
          fontFamily={SERIF} fontSize={9} fill={FAINT} opacity={progress > 0.07 ? 1 : 0}>
          林知行 · 陈雨桐 · 2024
        </text>

        <text x={24} y={86} fontFamily={SERIF} fontSize={8} fontWeight={700} fill={INK} opacity={progress > 0.1 ? 1 : 0}>摘要</text>
        {progress > 0.1 && <TextLine x={24} y={94} width={PAGE_W - 48} language="zh" seed={9001} />}
        {progress > 0.12 && <TextLine x={24} y={103} width={PAGE_W - 48 - 30} language="zh" seed={9002} />}

        {Array.from({ length: linesPerCol }).map((_, i) => {
          if (i >= linesRendered) return null;
          const w = colW * (0.55 + ((i * 13) % 45) / 100);
          // Highlight just-placed line with light blue flash
          const isFresh = i === linesRendered - 1;
          return (
            <g key={`l-${i}`}>
              {isFresh && (
                <rect x={colX1 - 2} y={lineY0 + i * lineH - 6} width={colW + 4} height={lineH}
                  fill="rgba(0,113,227,0.15)">
                  <animate attributeName="opacity" values="1;0" dur="400ms" fill="freeze" />
                </rect>
              )}
              <TextLine x={colX1} y={lineY0 + i * lineH} width={w} height={5} language="zh" seed={i} />
            </g>
          );
        })}
        {Array.from({ length: linesPerCol }).map((_, i) => {
          const linearIdx = linesPerCol + i;
          if (linearIdx >= linesRendered) return null;
          if (i >= 4 && i <= 11) return null;
          const w = colW * (0.55 + ((i * 13 + 7) % 45) / 100);
          const isFresh = linearIdx === linesRendered - 1;
          return (
            <g key={`r-${i}`}>
              {isFresh && (
                <rect x={colX2 - 2} y={lineY0 + i * lineH - 6} width={colW + 4} height={lineH}
                  fill="rgba(0,113,227,0.15)">
                  <animate attributeName="opacity" values="1;0" dur="400ms" fill="freeze" />
                </rect>
              )}
              <TextLine x={colX2} y={lineY0 + i * lineH} width={w} height={5} language="zh" seed={100 + i} />
            </g>
          );
        })}

        {/* Figure: appears early */}
        {progress > 0.4 && (
          <g>
            <rect x={colX2} y={lineY0 + 4 * lineH - 6} width={colW} height={lineH * 8 - 4}
              fill="#f2f2f4" stroke={HAIRLINE} />
            <polyline points={`
              ${colX2 + 8},${lineY0 + 11 * lineH - 12}
              ${colX2 + colW * 0.25},${lineY0 + 9 * lineH - 8}
              ${colX2 + colW * 0.5},${lineY0 + 7 * lineH - 4}
              ${colX2 + colW * 0.75},${lineY0 + 6 * lineH - 2}
              ${colX2 + colW - 8},${lineY0 + 5 * lineH - 6}
            `} fill="none" stroke={INK} strokeWidth="0.8" />
            <text x={colX2 + colW / 2} y={lineY0 + 11 * lineH + 4} textAnchor="middle"
              fontFamily={SERIF} fontSize={6} fill={FAINT} fontStyle="italic">
              图 1
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function TypstHighlight({ text }) {
  const tokens = [];
  let rest = text;
  let key = 0;
  // Highlight #set, #place, "..." strings, [...] content, numbers + units
  const patterns = [
    { re: /^#(set|place|let|import)/, color: '#ff7ab2' },
    { re: /^"[^"]*"/, color: '#94d2bd' },
    { re: /^\[[^\]]*\]/, color: '#f9c74f' },
    { re: /^\d+(\.\d+)?(pt|cm|mm|em)?/, color: '#ffb380' },
    { re: /^[a-zA-Z_]+(?=:)/, color: '#a8c5ff' },
    { re: /^[\s,():]+/, color: '#a8a8ad' },
    { re: /^./, color: '#e6e6e6' },
  ];
  while (rest.length > 0) {
    let matched = false;
    for (const p of patterns) {
      const m = rest.match(p.re);
      if (m) {
        tokens.push(<span key={key++} style={{ color: p.color }}>{m[0]}</span>);
        rest = rest.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) break;
  }
  return <span>{tokens}</span>;
}

// ── 3.3 合成 PDF ──────────────────────────────────────────────────────────
function SceneMerge({ progress }) {
  // 12 pages fly in from off-canvas and stack into one PDF.
  const pages = 12;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Caption x={720} y={32} label="MERGE · pikepdf" align="center" />

      {Array.from({ length: pages }).map((_, i) => {
        const t = i * 0.045;
        const localP = clamp((progress - t) / 0.45, 0, 1);
        const ease = Easing.easeOutCubic(localP);

        // Origin: spread out across the top in a wide arc
        const ox = 200 + (i / pages) * 1040;
        const oy = -PAGE_H - 30;

        // Target: stacked with slight offset
        const tx = 720 - PAGE_W / 2 + (i - pages / 2) * 1.5;
        const ty = 56 + (i - pages / 2) * 0.8;

        const x = ox + (tx - ox) * ease;
        const y = oy + (ty - oy) * ease;
        const rotation = (1 - ease) * (Math.sin(i * 1.3) * 8);

        return (
          <div key={i} style={{
            position: 'absolute',
            left: x, top: y,
            transform: `rotate(${rotation}deg)`,
            transformOrigin: 'center',
          }}>
            <PDFPage x={0} y={0} language="zh" pageNumber={i + 1}
              shadow={localP > 0.9}
              showFigure={i === 0}
            />
          </div>
        );
      })}

      {/* Counter */}
      <div style={{
        position: 'absolute', left: 720, top: 580,
        transform: 'translateX(-50%)',
        fontFamily: MONO, fontSize: 13, color: INK,
        background: '#fff', border: `1px solid ${HAIRLINE}`,
        borderRadius: 999, padding: '6px 16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
      }}>
        合成 <span style={{ fontWeight: 600 }}>{Math.min(pages, Math.floor(progress * pages * 1.2))}</span> / 12 页
      </div>
    </div>
  );
}

// ── 3.4 压缩 ──────────────────────────────────────────────────────────────
function SceneCompress({ progress }) {
  // A box visualization: starts large (28.4 MB), compresses down (3.1 MB).
  // Show a sliding crusher/ratio + filesize numbers + bytes "vacuumed" particles.

  const compress = animate({ from: 0, to: 1, start: 0.15, end: 0.85, ease: Easing.easeInOutCubic })(progress);

  const startSize = 28.4;
  const endSize = 3.1;
  const curSize = startSize + (endSize - startSize) * compress;

  const startW = 540, endW = 220;
  const w = startW + (endW - startW) * compress;
  const startH = 380, endH = 200;
  const h = startH + (endH - startH) * compress;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Caption x={720} y={32} label="COMPRESS · LINEARIZE" align="center" />

      {/* Box being squished */}
      <div style={{
        position: 'absolute',
        left: 720 - w / 2, top: 280 - h / 2 + 50,
        width: w, height: h,
        background: '#fff',
        border: `1.5px solid ${INK}`,
        borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 8,
        transition: 'none',
        boxShadow: '0 12px 32px rgba(0,0,0,0.10)',
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 14, color: FAINT,
          letterSpacing: '0.04em',
        }}>OUTPUT.PDF</div>
        <div style={{
          fontFamily: SANS, fontSize: 36 + 12 * (1 - compress),
          fontWeight: 600, color: INK,
          letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
        }}>{curSize.toFixed(1)} MB</div>
      </div>

      {/* Compression "jaws" — left and right wedges that close in */}
      <div style={{
        position: 'absolute',
        left: 720 - w / 2 - 20 - (1 - compress) * 220,
        top: 280 - h / 2 + 50,
        height: h,
        width: 16,
        background: '#1d1d1f',
        borderRadius: 2,
      }} />
      <div style={{
        position: 'absolute',
        left: 720 + w / 2 + 4 + (1 - compress) * 220,
        top: 280 - h / 2 + 50,
        height: h,
        width: 16,
        background: '#1d1d1f',
        borderRadius: 2,
      }} />

      {/* Vacuum/byte particles flying away */}
      {compress > 0.1 && Array.from({ length: 20 }).map((_, i) => {
        const seed = i * 0.7;
        const start = 0.1 + (i / 20) * 0.7;
        const localP = clamp((progress - start) / 0.25, 0, 1);
        if (localP <= 0 || localP >= 1) return null;
        const angle = (i / 20) * Math.PI * 2;
        const dx = Math.cos(angle) * (60 + localP * 200);
        const dy = Math.sin(angle) * (60 + localP * 100);
        return (
          <div key={i} style={{
            position: 'absolute',
            left: 720 + dx, top: 280 + dy + 50,
            fontFamily: MONO, fontSize: 9, color: FAINT,
            opacity: 1 - localP,
            transform: `translate(-50%, -50%) scale(${1 - localP * 0.4})`,
          }}>{['0x4F', '0xA2', '0xFF', '0x00', '0x12', '0x9E'][i % 6]}</div>
        );
      })}

      {/* Stats below */}
      <div style={{
        position: 'absolute', left: 720, top: 560,
        transform: 'translateX(-50%)',
        display: 'flex', gap: 60, alignItems: 'center',
      }}>
        <Stat label="BEFORE" value="28.4 MB" highlight />
        <div style={{ fontFamily: MONO, fontSize: 22, color: FAINT }}>→</div>
        <Stat label="AFTER" value={`${curSize.toFixed(1)} MB`} highlight color="#34c759" />
        <div style={{ fontFamily: MONO, fontSize: 22, color: FAINT }}>·</div>
        <Stat label="RATIO"
          value={`${(curSize / startSize * 100).toFixed(0)}%`}
          highlight />
      </div>
    </div>
  );
}

Object.assign(window, {
  SceneMask, SceneTypst, SceneMerge, SceneCompress,
});
