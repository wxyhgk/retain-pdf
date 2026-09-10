// scene-translate.jsx
// 4 substeps: cross-layout detect, page strategy, batch translate, fix garble.

// ── 2.1 跨栏 / 跨页判断 ────────────────────────────────────────────────────
function SceneCrossLayout({ progress }) {
  // Two pages side by side. Lines drawn between text blocks across columns and pages.
  const linkA = animate({ from: 0, to: 1, start: 0.15, end: 0.45, ease: Easing.easeInOutCubic })(progress);
  const linkB = animate({ from: 0, to: 1, start: 0.4, end: 0.65, ease: Easing.easeInOutCubic })(progress);
  const linkC = animate({ from: 0, to: 1, start: 0.6, end: 0.85, ease: Easing.easeInOutCubic })(progress);

  // Page positions
  const p1x = 380, p1y = 60;
  const p2x = 760, p2y = 60;

  // Block bboxes (approximate within a 360x504 page, in page coords)
  // col0 = x:24-167, col1 = x:184-336
  // We'll define matched line indices to draw arrows between.

  // Coordinate helper: convert page-local to canvas coords
  const toCanvas = (px, py, x, y) => ({ x: px + x, y: py + y });

  // Row 17 of col0 in page1 → Row 0 of col1 in page1 (cross-column flow)
  const lineY0 = 122;
  const lineH = 9;
  const a1 = toCanvas(p1x, p1y, 24 + 80, lineY0 + 17 * lineH);
  const a2 = toCanvas(p1x, p1y, 184 + 6, lineY0 + 0 * lineH);

  // Row 17 of col1 in page1 → Row 0 of col0 in page2 (cross-page flow)
  const b1 = toCanvas(p1x, p1y, 184 + 80, lineY0 + 17 * lineH);
  const b2 = toCanvas(p2x, p2y, 24 + 6, lineY0 + 0 * lineH);

  // Mid-paragraph join: row 5 col0 page2 to row 6 col0 page2 (continuation)
  const c1 = toCanvas(p2x, p2y, 24 + 30, lineY0 + 5 * lineH);
  const c2 = toCanvas(p2x, p2y, 24 + 30, lineY0 + 6 * lineH);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Caption x={p1x} y={32} label="P. 1" />
      <Caption x={p2x} y={32} label="P. 2" />

      <PDFPage x={p1x} y={p1y} language="en" pageNumber={1}
        highlightLines={[
          { col: 0, idx: 17, fill: 'rgba(0,113,227,0.15)', opacity: linkA > 0.1 ? 1 : 0 },
          { col: 1, idx: 0,  fill: 'rgba(0,113,227,0.15)', opacity: linkA > 0.5 ? 1 : 0 },
          { col: 1, idx: 17, fill: 'rgba(255,138,0,0.15)', opacity: linkB > 0.1 ? 1 : 0 },
        ]}
      />
      <PDFPage x={p2x} y={p2y} language="en" pageNumber={2}
        highlightLines={[
          { col: 0, idx: 0,  fill: 'rgba(255,138,0,0.15)', opacity: linkB > 0.5 ? 1 : 0 },
          { col: 0, idx: 5,  fill: 'rgba(52,199,89,0.15)', opacity: linkC > 0.2 ? 1 : 0 },
          { col: 0, idx: 6,  fill: 'rgba(52,199,89,0.15)', opacity: linkC > 0.5 ? 1 : 0 },
        ]}
      />

      {/* Drawn arc connectors between blocks */}
      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} width="1440" height="600">
        <Arc x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y} progress={linkA} color="#0071e3" label="跨栏 cross-column" />
        <Arc x1={b1.x} y1={b1.y} x2={b2.x} y2={b2.y} progress={linkB} color="#ff8a00" label="跨页 cross-page" big />
        <Arc x1={c1.x} y1={c1.y} x2={c2.x} y2={c2.y} progress={linkC} color="#34c759" label="续段 continuation" small />
      </svg>

      {/* Right side: detected paragraphs panel */}
      <div style={{
        position: 'absolute', left: 1170, top: 100,
        width: 220, padding: 16,
        background: '#fff', borderRadius: 10,
        border: `1px solid ${HAIRLINE}`,
        fontFamily: SANS, fontSize: 12, color: INK,
        boxShadow: '0 8px 20px rgba(0,0,0,0.05)',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 11,
          color: FAINT, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: MONO }}>
          paragraphs detected
        </div>
        <ParaRow color="#0071e3" label="¶ Methods (cross-col)" active={linkA > 0.3} count={3} />
        <ParaRow color="#ff8a00" label="¶ Results (cross-page)" active={linkB > 0.3} count={2} />
        <ParaRow color="#34c759" label="¶ Discussion (cont.)" active={linkC > 0.3} count={4} />
        <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 10, color: FAINT }}>
          merged 412 blocks → <span style={{ color: INK }}>{linkC > 0.5 ? 87 : linkA > 0.5 ? 64 : 0}</span> paragraphs
        </div>
      </div>
    </div>
  );
}

function ParaRow({ color, label, active, count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 0',
      opacity: active ? 1 : 0.3,
      transition: 'opacity 200ms',
    }}>
      <div style={{ width: 4, height: 16, background: color, borderRadius: 2 }} />
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 10, color: FAINT }}>×{count}</span>
    </div>
  );
}

function Arc({ x1, y1, x2, y2, progress, color, label, big, small }) {
  // bezier curve from (x1,y1) to (x2,y2). Arc upward.
  const mx = (x1 + x2) / 2;
  const my = Math.min(y1, y2) - (big ? 60 : small ? 20 : 30);
  // Approximate length for dasharray reveal
  const approxLen = Math.hypot(x2 - x1, y2 - y1) * 1.3;
  return (
    <g opacity={progress > 0 ? 1 : 0}>
      <path d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
        fill="none" stroke={color} strokeWidth="1.4"
        strokeDasharray={approxLen}
        strokeDashoffset={approxLen * (1 - progress)}
        strokeLinecap="round" />
      {/* Arrow head */}
      {progress > 0.6 && (
        <circle cx={x2} cy={y2} r="3" fill={color} opacity={(progress - 0.6) / 0.4} />
      )}
      {progress > 0.3 && label && (
        <text x={mx} y={my - 6} textAnchor="middle"
          fontFamily={MONO} fontSize="10" fill={color}
          opacity={Math.min(1, (progress - 0.3) / 0.2)}>{label}</text>
      )}
    </g>
  );
}

// ── 2.2 页面策略 ──────────────────────────────────────────────────────────
function SceneStrategy({ progress }) {
  // Show 6 mini page thumbnails. As time progresses, each gets classified with a strategy badge.
  const pages = [
    { type: 'two-col',     strategy: '双栏整段', color: '#0071e3' },
    { type: 'figure',      strategy: '图表保留', color: '#ff8a00' },
    { type: 'two-col',     strategy: '双栏整段', color: '#0071e3' },
    { type: 'table',       strategy: '表格逐格', color: '#5e5ce6' },
    { type: 'single',      strategy: '单栏直译', color: '#34c759' },
    { type: 'figure',      strategy: '图表保留', color: '#ff8a00' },
    { type: 'two-col',     strategy: '双栏整段', color: '#0071e3' },
    { type: 'references',  strategy: '引用整理', color: '#86868b' },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, padding: '60px 80px' }}>
      <div style={{
        fontFamily: MONO, fontSize: 11, color: FAINT,
        textTransform: 'uppercase', letterSpacing: '0.05em',
        marginBottom: 24,
      }}>per-page strategy · classifier output</div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 20, justifyItems: 'center',
      }}>
        {pages.map((pg, i) => {
          const t = (i / pages.length) * 0.7;
          const reveal = clamp((progress - t) / 0.2, 0, 1);
          return (
            <div key={i} style={{
              position: 'relative',
              transform: `translateY(${(1 - reveal) * 14}px)`,
              opacity: reveal,
              transition: 'transform 200ms',
            }}>
              {/* Mini page */}
              <MiniPage type={pg.type} pageNumber={i + 1} />
              {/* Strategy pill */}
              <div style={{
                position: 'absolute', left: '50%', top: -14,
                transform: `translateX(-50%) scale(${0.8 + 0.2 * reveal})`,
                padding: '4px 10px',
                borderRadius: 999,
                background: pg.color,
                color: '#fff',
                fontFamily: SANS, fontSize: 11, fontWeight: 600,
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
              }}>{pg.strategy}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniPage({ type, pageNumber }) {
  const W = 150, H = 200;
  return (
    <div style={{
      width: W, height: H, background: '#fff',
      border: `1px solid ${HAIRLINE}`, borderRadius: 4,
      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
      position: 'relative', overflow: 'hidden',
    }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {type === 'two-col' && (
          <g>
            {Array.from({ length: 18 }).map((_, i) => (
              <g key={i}>
                <rect x="12" y={20 + i * 8} width={50 + (i % 3) * 5} height="2" fill={INK} />
                <rect x="70" y={20 + i * 8} width={48 + (i % 4) * 4} height="2" fill={INK} />
              </g>
            ))}
          </g>
        )}
        {type === 'figure' && (
          <g>
            {Array.from({ length: 4 }).map((_, i) => (
              <rect key={i} x="12" y={20 + i * 8} width={70 + (i % 3) * 8} height="2" fill={INK} />
            ))}
            <rect x="12" y="60" width="126" height="80" fill="#f2f2f4" stroke={HAIRLINE} />
            <polyline points="20,130 40,110 60,118 80,90 100,95 130,75" fill="none" stroke={INK} strokeWidth="1" />
            {Array.from({ length: 5 }).map((_, i) => (
              <rect key={i} x="12" y={150 + i * 8} width={80 + (i % 3) * 10} height="2" fill={INK} />
            ))}
          </g>
        )}
        {type === 'table' && (
          <g>
            <rect x="12" y="20" width="126" height="160" fill="none" stroke={INK} strokeWidth="0.5" />
            {Array.from({ length: 8 }).map((_, i) => (
              <line key={i} x1="12" y1={40 + i * 18} x2="138" y2={40 + i * 18} stroke={HAIRLINE} />
            ))}
            <line x1="55" y1="20" x2="55" y2="180" stroke={HAIRLINE} />
            <line x1="98" y1="20" x2="98" y2="180" stroke={HAIRLINE} />
            {Array.from({ length: 8 }).map((_, r) => (
              Array.from({ length: 3 }).map((_, c) => (
                <rect key={`${r}-${c}`} x={20 + c * 43} y={28 + r * 18} width={20 + (r * c) % 16} height="2" fill={INK} />
              ))
            ))}
          </g>
        )}
        {type === 'single' && (
          <g>
            {Array.from({ length: 22 }).map((_, i) => (
              <rect key={i} x="12" y={20 + i * 8} width={110 + (i % 5) * 4 - (i % 7) * 2} height="2" fill={INK} />
            ))}
          </g>
        )}
        {type === 'references' && (
          <g>
            {Array.from({ length: 12 }).map((_, i) => (
              <g key={i}>
                <rect x="12" y={20 + i * 14} width="6" height="2" fill={INK} />
                <rect x="22" y={20 + i * 14} width={100 + (i % 3) * 8} height="2" fill={INK} />
                <rect x="22" y={26 + i * 14} width={90 + (i % 4) * 6} height="2" fill={INK} />
              </g>
            ))}
          </g>
        )}
      </svg>
      <div style={{
        position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
        fontFamily: SERIF, fontSize: 7, color: FAINT,
      }}>{pageNumber}</div>
    </div>
  );
}

// ── 2.3 批量翻译 ──────────────────────────────────────────────────────────
function SceneBatch({ progress }) {
  // Many parallel translation calls. English on left → Chinese on right.
  // Animate text rows: each transitions from EN line bars to ZH line bars at staggered times.
  const rows = 12;

  return (
    <div style={{ position: 'absolute', inset: 0, padding: '40px 80px' }}>
      <div style={{ display: 'flex', gap: 60, alignItems: 'flex-start' }}>
        {/* EN side */}
        <div style={{ width: 380 }}>
          <div style={{
            fontFamily: MONO, fontSize: 10, color: FAINT,
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10,
          }}>SOURCE · EN</div>
          <div style={{
            background: '#fff', borderRadius: 8,
            border: `1px solid ${HAIRLINE}`,
            padding: '16px 18px',
            boxShadow: '0 6px 16px rgba(0,0,0,0.04)',
          }}>
            <svg width="344" height={rows * 18} viewBox={`0 0 344 ${rows * 18}`}>
              {Array.from({ length: rows }).map((_, i) => (
                <TextLine key={i} x={0} y={i * 18 + 14} width={250 + (i % 5) * 18} height="6" language="en" seed={i + 100} />
              ))}
            </svg>
          </div>
        </div>

        {/* Center: parallel batch indicators */}
        <div style={{ width: 220, paddingTop: 30 }}>
          <div style={{
            fontFamily: MONO, fontSize: 10, color: FAINT,
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14,
          }}>BATCH × 12 · CONCURRENT</div>
          {Array.from({ length: rows }).map((_, i) => {
            const t = i * 0.04;
            const dur = 0.45;
            const localP = clamp((progress - t) / dur, 0, 1);
            const phase = localP < 0.5 ? 'send' : localP < 0.95 ? 'translate' : 'done';
            const color = phase === 'done' ? '#34c759' : phase === 'translate' ? '#0071e3' : '#86868b';
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 4,
                fontFamily: MONO, fontSize: 10, color,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: 3, background: color,
                  boxShadow: phase === 'translate' ? `0 0 0 3px ${color}33` : 'none',
                  transition: 'box-shadow 100ms',
                }} />
                <span style={{ width: 30 }}>req-{String(i + 1).padStart(2, '0')}</span>
                <div style={{
                  flex: 1, height: 2, background: HAIRLINE, borderRadius: 1, overflow: 'hidden',
                }}>
                  <div style={{ width: `${localP * 100}%`, height: '100%', background: color }} />
                </div>
                <span style={{ width: 36, textAlign: 'right', color: FAINT }}>
                  {phase === 'done' ? 'ok' : phase === 'translate' ? '...' : 'queue'}
                </span>
              </div>
            );
          })}
        </div>

        {/* ZH side */}
        <div style={{ width: 380 }}>
          <div style={{
            fontFamily: MONO, fontSize: 10, color: FAINT,
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10,
          }}>TARGET · ZH</div>
          <div style={{
            background: '#fff', borderRadius: 8,
            border: `1px solid ${HAIRLINE}`,
            padding: '16px 18px',
            boxShadow: '0 6px 16px rgba(0,0,0,0.04)',
          }}>
            <svg width="344" height={rows * 18} viewBox={`0 0 344 ${rows * 18}`}>
              {Array.from({ length: rows }).map((_, i) => {
                const t = i * 0.04;
                const dur = 0.45;
                const localP = clamp((progress - t) / dur, 0, 1);
                const showZh = localP > 0.5;
                const opacity = showZh ? Math.min(1, (localP - 0.5) / 0.45) : 0;
                if (!showZh) return null;
                return (
                  <g key={i} opacity={opacity}>
                    <TextLine x={0} y={i * 18 + 14} width={220 + (i % 4) * 22} height="6" language="zh" seed={i + 200} />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 2.4 乱码修复 ──────────────────────────────────────────────────────────
function SceneFixGarble({ progress }) {
  // Big text: shows garbled chars being repaired one by one.
  // Then a "before/after" comparison.

  const text = '生成式翻译在长篇文档中常出现 □□□ 与 ' +
    '\\uFFFD 编码错误，本系统结合 Unicode ' +
    '范围检测与上下文重建，自动修复乱码。';

  // Marked positions to fix
  const fixIndices = [13, 14, 15, 22, 23, 24, 25, 26, 27, 28];

  // Each fix happens at staggered time
  const fixed = fixIndices.map((idx, i) => {
    const t = 0.15 + (i / fixIndices.length) * 0.6;
    return clamp((progress - t) / 0.05, 0, 1);
  });

  // The visible text — replace garbled chars based on fixed array
  let display = '';
  let fixIdx = 0;
  for (let i = 0; i < text.length; i++) {
    if (fixIndices.includes(i)) {
      const f = fixed[fixIndices.indexOf(i)];
      if (f >= 1) {
        // Replace with actual char
        const cleanText = '生成式翻译在长篇文档中常出现编码错误的字符与不可识别的字节序列编码错误，本系统结合 Unicode';
        display += cleanText[i] || text[i];
      } else {
        display += text[i];
      }
    } else {
      display += text[i];
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, padding: '60px 100px' }}>
      <div style={{
        fontFamily: MONO, fontSize: 11, color: FAINT,
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14,
      }}>unicode repair · context-aware</div>

      {/* The big rendered text block */}
      <div style={{
        background: '#fff', borderRadius: 12,
        border: `1px solid ${HAIRLINE}`,
        padding: '40px 48px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
        marginBottom: 32,
        position: 'relative',
      }}>
        <GarbleText text={text} fixIndices={fixIndices} progress={progress} />
      </div>

      {/* Stats below */}
      <div style={{ display: 'flex', gap: 40 }}>
        <Stat label="DETECTED" value={fixIndices.length} highlight={progress > 0.1} />
        <Stat label="REPAIRED"
          value={fixed.filter(f => f >= 1).length}
          highlight={progress > 0.4}
          color="#34c759" />
        <Stat label="REMAINING"
          value={fixIndices.length - fixed.filter(f => f >= 1).length}
          highlight />
        <Stat label="CONFIDENCE"
          value={progress > 0.85 ? '99.6%' : progress > 0.5 ? `${(50 + (progress - 0.5) * 130).toFixed(1)}%` : '—'}
          highlight />
      </div>
    </div>
  );
}

function GarbleText({ text, fixIndices, progress }) {
  const cleanText = '生成式翻译在长篇文档中常出现编码错误的字符与不可识别的字节序列编码错误，本系统结合 Unicode 范围检测与上下文重建，自动修复乱码。';
  return (
    <div style={{
      fontFamily: HAN, fontSize: 26, lineHeight: 1.7,
      color: INK, letterSpacing: 0.5,
    }}>
      {text.split('').map((ch, i) => {
        const fIdx = fixIndices.indexOf(i);
        const isGarbled = fIdx !== -1;
        if (!isGarbled) return <span key={i}>{ch}</span>;

        const t = 0.15 + (fIdx / fixIndices.length) * 0.6;
        const localP = clamp((progress - t) / 0.05, 0, 1);
        const beingFixed = progress >= t && progress < t + 0.05;
        const fixed = localP >= 1;

        if (fixed) {
          return (
            <span key={i} style={{
              color: '#34c759',
              animation: beingFixed ? 'flashGreen 600ms ease-out' : 'none',
            }}>
              {cleanText[i] || ch}
            </span>
          );
        }

        return (
          <span key={i} style={{
            background: '#ffe5e5',
            color: '#d70015',
            padding: '0 1px',
            borderRadius: 2,
            position: 'relative',
            display: 'inline-block',
          }}>
            <span style={{ fontFamily: MONO, fontSize: 22 }}>□</span>
          </span>
        );
      })}
      <style>{`
        @keyframes flashGreen {
          0% { background: #34c75933; transform: scale(1.4); }
          100% { background: transparent; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value, highlight, color = INK }) {
  return (
    <div style={{ opacity: highlight ? 1 : 0.3, transition: 'opacity 200ms' }}>
      <div style={{
        fontFamily: MONO, fontSize: 10, color: FAINT,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontFamily: SANS, fontSize: 28, fontWeight: 600, color,
        letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  );
}

Object.assign(window, {
  SceneCrossLayout, SceneStrategy, SceneBatch, SceneFixGarble,
});
