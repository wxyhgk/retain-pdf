// scene-ocr.jsx
// 4 substeps: upload, cloud OCR, fetch results, standardize.

const PAGE_X = 540;     // center the PDF page in 1440-wide canvas (offset within MainCanvas)
const PAGE_Y = 56;
// MainCanvas is 1440 wide × ~580 tall (after chrome)

// ── 1.1 上传 PDF ──────────────────────────────────────────────────────────
function SceneUpload({ progress, localTime }) {
  // 0.0–0.2: file appears bottom-left
  // 0.2–0.5: file flies up into a "drop zone"
  // 0.5–0.8: progress bar fills
  // 0.8–1.0: cloud upload check

  const fileFly = animate({ from: 0, to: 1, start: 0.18, end: 0.5, ease: Easing.easeInOutCubic })(progress);
  const barP    = animate({ from: 0, to: 1, start: 0.5, end: 0.85, ease: Easing.easeOutCubic })(progress);
  const checkP  = animate({ from: 0, to: 1, start: 0.85, end: 1.0, ease: Easing.easeOutCubic })(progress);

  const fileX = 200 + (640 - 200) * fileFly;
  const fileY = 380 - 220 * fileFly;
  const fileScale = 1 + 0.2 * (1 - Math.abs(fileFly - 0.5) * 2) * fileFly;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Drop zone */}
      <div style={{
        position: 'absolute', left: 540, top: 110,
        width: 360, height: 240,
        border: `1.5px dashed ${HAIRLINE}`,
        borderRadius: 16,
        background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 12,
        opacity: 1 - 0.3 * fileFly,
      }}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <path d="M20 26 V8 M14 14 L20 8 L26 14" stroke={FAINT} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 28 V32 a2 2 0 0 0 2 2 H30 a2 2 0 0 0 2-2 V28"
            stroke={FAINT} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <div style={{ fontFamily: SANS, fontSize: 14, color: FAINT }}>
          拖拽 PDF 到此处
        </div>
      </div>

      {/* The flying file */}
      <div style={{
        position: 'absolute',
        left: fileX, top: fileY,
        transform: `scale(${fileScale}) rotate(${(1-fileFly) * -8}deg)`,
        transformOrigin: 'center',
        filter: `drop-shadow(0 ${4 + 12 * fileFly}px ${8 + 16 * fileFly}px rgba(0,0,0,${0.1 + 0.15 * fileFly}))`,
        opacity: progress < 0.85 ? 1 : 1 - (progress - 0.85) / 0.15,
      }}>
        <PDFFileIcon size={64} />
        <div style={{
          position: 'absolute', left: '50%', top: '100%', marginTop: 6,
          transform: 'translateX(-50%)',
          fontFamily: MONO, fontSize: 10, color: FAINT,
          whiteSpace: 'nowrap',
        }}>paper.pdf · 12.4 MB</div>
      </div>

      {/* Progress bar appearing after drop */}
      {progress > 0.5 && (
        <div style={{
          position: 'absolute', left: 540, top: 380, width: 360,
          opacity: Math.min(1, (progress - 0.5) / 0.1),
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: MONO, fontSize: 11, color: FAINT, marginBottom: 8,
          }}>
            <span>uploading…</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: INK }}>
              {Math.round(barP * 100)}%
            </span>
          </div>
          <div style={{ height: 4, background: HAIRLINE, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${barP * 100}%`, background: INK,
              transition: 'width 30ms linear',
            }} />
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginTop: 8,
            fontFamily: MONO, fontSize: 10, color: '#bbb',
          }}>
            <span>chunk {Math.min(48, Math.floor(barP * 48))}/48</span>
            <span>{(barP * 12.4).toFixed(1)} / 12.4 MB</span>
          </div>
        </div>
      )}

      {/* Cloud target */}
      <div style={{
        position: 'absolute', left: 1100, top: 200,
        opacity: 0.3 + 0.7 * fileFly,
      }}>
        <CloudIcon size={120} color={INK} />
        <div style={{
          marginTop: 10, fontFamily: MONO, fontSize: 11, color: FAINT,
          textAlign: 'center', letterSpacing: '0.04em',
        }}>OCR ENDPOINT</div>
        {checkP > 0 && (
          <div style={{
            position: 'absolute', right: -8, top: -8,
            background: '#fff', borderRadius: 16,
            transform: `scale(${checkP})`,
          }}>
            <CheckCircle size={28} color="#34c759" progress={checkP} />
          </div>
        )}
      </div>

      {/* Animated trail / dotted path from file to cloud */}
      {progress > 0.55 && (
        <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} width="1440" height="580">
          <path d="M 720 200 Q 950 80 1140 220" fill="none" stroke={ACCENT}
            strokeWidth="1.2" strokeDasharray="3 4"
            strokeDashoffset={progress * -40} opacity={0.6} />
        </svg>
      )}
    </div>
  );
}

// ── 1.2 云端 OCR ───────────────────────────────────────────────────────────
function SceneCloud({ progress }) {
  // Page on left being scanned. As scan passes a row, glyphs appear in JSON tray on right.
  const scanY = animate({ from: 0, to: 1, start: 0.05, end: 0.95, ease: Easing.linear })(progress);
  // Number of OCR rows recognized = function of scan position
  const recognized = Math.floor(scanY * 18);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* PDF page on left */}
      <PDFPage x={300} y={48} language="en" scanLineY={scanY} />

      {/* OCR JSON tray on right */}
      <div style={{
        position: 'absolute', left: 760, top: 48,
        width: 600, height: 480,
        background: '#1d1d1f',
        borderRadius: 10,
        padding: 20,
        boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 14,
          fontFamily: MONO, fontSize: 11, color: '#a8a8ad',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: '#34c759' }}>
            <div style={{
              width: '100%', height: '100%', borderRadius: 4,
              background: '#34c759',
              animation: 'pulse 1.4s ease-in-out infinite',
            }} />
          </div>
          <span>POST /v1/ocr · streaming</span>
          <span style={{ marginLeft: 'auto', color: '#86868b' }}>
            page 1/12 · {recognized} blocks
          </span>
        </div>

        <div style={{
          fontFamily: MONO, fontSize: 11, lineHeight: 1.55,
          color: '#e6e6e6', whiteSpace: 'pre',
          flex: 1, overflow: 'hidden',
        }}>
          {Array.from({ length: recognized }).map((_, i) => (
            <OCRJsonRow key={i} idx={i} fresh={i === recognized - 1} />
          ))}
          {recognized < 18 && (
            <div style={{ color: '#5e5e63' }}>
              <span style={{ borderLeft: '6px solid #34c759', paddingLeft: 6, animation: 'blink 1s step-end infinite' }}>{'  '}</span>
            </div>
          )}
        </div>

        <style>{`
          @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
          @keyframes blink { 0%, 50% { opacity: 1 } 50.01%, 100% { opacity: 0 } }
        `}</style>
      </div>
    </div>
  );
}

function OCRJsonRow({ idx, fresh }) {
  const samples = [
    { bbox: [62, 102, 280, 12], txt: 'Layout-Preserving Document Tra…' },
    { bbox: [62, 130, 240, 10], txt: 'Z. Lin, Y. Chen — May 2024' },
    { bbox: [62, 168, 280, 9],  txt: 'We propose an end-to-end pipe…' },
    { bbox: [62, 180, 274, 9],  txt: 'line that preserves typograph…' },
    { bbox: [62, 192, 260, 9],  txt: 'and supports cross-column flo…' },
    { bbox: [62, 215, 130, 9],  txt: '1  Introduction' },
    { bbox: [62, 230, 268, 9],  txt: 'Document translation has long…' },
    { bbox: [62, 242, 270, 9],  txt: 'suffered from layout collapse,' },
    { bbox: [62, 254, 264, 9],  txt: 'where the resulting PDF loses' },
    { bbox: [62, 266, 256, 9],  txt: 'figure positions and column…' },
    { bbox: [62, 278, 250, 9],  txt: 'spreads over its original geo…' },
    { bbox: [62, 290, 246, 9],  txt: 'metry. We address this with…' },
    { bbox: [200, 168, 130, 9], txt: 'a Typst-based overlay…' },
    { bbox: [200, 180, 132, 9], txt: 'that re-flows transla…' },
    { bbox: [200, 192, 124, 9], txt: 'tions while keeping…' },
    { bbox: [200, 215, 110, 9], txt: '2  Method' },
    { bbox: [200, 230, 132, 9], txt: 'Our system has three…' },
    { bbox: [200, 242, 130, 9], txt: 'major stages, illustrat…' },
  ];
  const s = samples[idx % samples.length];
  return (
    <div style={{
      opacity: fresh ? 0 : 1,
      animation: fresh ? 'fadeIn 280ms ease-out forwards' : 'none',
      color: '#d2d2d7',
    }}>
      <span style={{ color: '#5e5e63' }}>{String(idx).padStart(3, '0')}</span>
      <span>{'  '}</span>
      <span style={{ color: '#94d2bd' }}>bbox</span>
      <span style={{ color: '#5e5e63' }}>=</span>
      <span style={{ color: '#f9c74f' }}>[{s.bbox.join(', ')}]</span>
      <span style={{ color: '#5e5e63' }}> · </span>
      <span>"{s.txt}"</span>
      <style>{`@keyframes fadeIn { to { opacity: 1 } }`}</style>
    </div>
  );
}

// ── 1.3 下载/整理 OCR 结果 ─────────────────────────────────────────────────
function SceneFetch({ progress }) {
  // Lots of JSON snippets stream from a "cloud" icon, fall down, organize into rows.
  // 0–0.4: streaming particles fall down
  // 0.4–0.8: they arrange into ordered rows in a "tray"
  // 0.8–1.0: tray title + count

  const drift = animate({ from: 0, to: 1, start: 0, end: 0.5, ease: Easing.easeOutCubic })(progress);
  const settle = animate({ from: 0, to: 1, start: 0.4, end: 0.85, ease: Easing.easeInOutCubic })(progress);
  const titleP = animate({ from: 0, to: 1, start: 0.85, end: 1.0, ease: Easing.easeOutCubic })(progress);

  const blocks = Array.from({ length: 24 }).map((_, i) => {
    const targetCol = i % 2;
    const targetRow = Math.floor(i / 2);
    const targetX = 480 + targetCol * 220;
    const targetY = 130 + targetRow * 32;

    // origin: random near the top center
    const ox = 720 + Math.cos(i * 1.7) * 40;
    const oy = -40 + Math.sin(i * 2.3) * 10;

    const startDelay = (i / 24) * 0.5;
    const blockDrift = clamp((progress - startDelay) / 0.5, 0, 1);
    const blockSettle = clamp((progress - startDelay - 0.4) / 0.45, 0, 1);

    const driftP = Easing.easeOutCubic(blockDrift);
    const settleP = Easing.easeInOutCubic(blockSettle);

    const driftX = ox + (700 - ox) * driftP;
    const driftY = oy + (260 + Math.sin(i * 1.3) * 50 - oy) * driftP;
    const x = driftX + (targetX - driftX) * settleP;
    const y = driftY + (targetY - driftY) * settleP;

    const opacity = blockDrift > 0 ? Math.min(1, blockDrift * 4) : 0;
    return { x, y, opacity, idx: i, settled: blockSettle > 0.95 };
  });

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Cloud source at top */}
      <div style={{ position: 'absolute', left: 700, top: 30 }}>
        <CloudIcon size={70} color={INK} />
      </div>

      {/* Tray */}
      <div style={{
        position: 'absolute', left: 460, top: 110,
        width: 520, height: 410,
        background: '#fff',
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 12,
        opacity: 0.3 + 0.7 * settle,
        boxShadow: settle > 0 ? '0 8px 28px rgba(0,0,0,0.06)' : 'none',
      }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${HAIRLINE}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          opacity: titleP,
        }}>
          <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: INK }}>
            ocr-result.jsonl
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: FAINT }}>
            {Math.floor(settle * 24)}/24 blocks · sorted by reading order
          </div>
        </div>
      </div>

      {/* Falling blocks */}
      {blocks.map((b) => (
        <div key={b.idx} style={{
          position: 'absolute',
          left: b.x, top: b.y,
          width: 200, height: 24,
          background: b.settled ? '#fafafa' : '#fff',
          border: `1px solid ${HAIRLINE}`,
          borderRadius: 4,
          padding: '0 8px',
          display: 'flex', alignItems: 'center', gap: 6,
          opacity: b.opacity,
          boxShadow: b.settled ? 'none' : '0 4px 12px rgba(0,0,0,0.08)',
          fontFamily: MONO, fontSize: 9, color: INK,
          whiteSpace: 'nowrap', overflow: 'hidden',
        }}>
          <span style={{ color: '#86868b' }}>{String(b.idx).padStart(2, '0')}</span>
          <span style={{ background: '#f0f0f3', padding: '1px 4px', borderRadius: 2, color: '#0071e3' }}>
            p{Math.floor(b.idx / 6) + 1}
          </span>
          <div style={{
            flex: 1, height: 2, background: '#d2d2d7', borderRadius: 1,
          }}/>
        </div>
      ))}
    </div>
  );
}

// ── 1.4 标准化 ─────────────────────────────────────────────────────────────
function SceneStandardize({ progress }) {
  // Messy boxes → clean grid; coords cleaned up.
  // Show a "before" set of bboxes (rotated/jittered) → "after" (aligned)
  const cleanup = animate({ from: 0, to: 1, start: 0.2, end: 0.85, ease: Easing.easeInOutCubic })(progress);

  const items = Array.from({ length: 8 }).map((_, i) => {
    const row = Math.floor(i / 2), col = i % 2;
    // Messy origin
    const mx = 460 + col * 220 + (Math.sin(i * 2.1) * 14);
    const my = 130 + row * 60 + (Math.cos(i * 1.5) * 8);
    const mr = Math.sin(i * 1.7) * 3;
    const mw = 200 + Math.cos(i * 2.3) * 6;
    // Clean target
    const tx = 460 + col * 220;
    const ty = 130 + row * 50;
    const tw = 200;
    const tr = 0;
    return {
      x: mx + (tx - mx) * cleanup,
      y: my + (ty - my) * cleanup,
      r: mr + (tr - mr) * cleanup,
      w: mw + (tw - mw) * cleanup,
      idx: i,
      // Show before/after coord labels
    };
  });

  // Schema panel on the right reveals progressively
  const schemaReveal = clamp((progress - 0.4) / 0.5, 0, 1);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Left side: bboxes settling into grid */}
      <div style={{ position: 'absolute', left: 0, top: 70 }}>
        <div style={{
          position: 'absolute', left: 460, top: 0,
          fontFamily: MONO, fontSize: 10, color: FAINT,
          letterSpacing: '0.05em', textTransform: 'uppercase',
        }}>raw bboxes → normalized</div>
      </div>

      {items.map((it) => (
        <div key={it.idx} style={{
          position: 'absolute',
          left: it.x, top: it.y,
          width: it.w, height: 36,
          transform: `rotate(${it.r}deg)`,
          background: '#fff',
          border: `1.5px solid ${cleanup > 0.9 ? INK : '#e0d6d2'}`,
          borderRadius: 4,
          padding: '0 8px',
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: MONO, fontSize: 9, color: INK,
          transition: 'border-color 200ms',
        }}>
          <span style={{ color: '#86868b' }}>{String(it.idx + 1).padStart(2, '0')}</span>
          <div style={{ flex: 1 }}>
            <div style={{ height: 3, background: '#1d1d1f', borderRadius: 1, width: `${70 + (it.idx % 3) * 8}%` }} />
            <div style={{ height: 2, background: '#86868b', borderRadius: 1, width: `${50 + (it.idx % 4) * 6}%`, marginTop: 4 }} />
          </div>
        </div>
      ))}

      {/* Schema panel on the right */}
      <div style={{
        position: 'absolute', left: 920, top: 90,
        width: 440, padding: 22,
        background: '#fff',
        borderRadius: 12,
        border: `1px solid ${HAIRLINE}`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
        fontFamily: MONO, fontSize: 11.5, lineHeight: 1.7,
        color: INK,
        opacity: schemaReveal,
        transform: `translateY(${(1 - schemaReveal) * 12}px)`,
      }}>
        <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: FAINT, marginBottom: 12,
          textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          standardized schema
        </div>
        <div><span style={{ color: '#a44' }}>id</span>:    <span style={{ color: '#0071e3' }}>"p1.b04"</span></div>
        <div><span style={{ color: '#a44' }}>type</span>:  <span style={{ color: '#0071e3' }}>"text"</span></div>
        <div><span style={{ color: '#a44' }}>bbox</span>:  [<span style={{ color: '#0071e3' }}>62, 168, 280, 9</span>]</div>
        <div><span style={{ color: '#a44' }}>font</span>:  <span style={{ color: '#0071e3' }}>"Times-Roman"</span> <span style={{ color: FAINT }}>· 9.5pt</span></div>
        <div><span style={{ color: '#a44' }}>order</span>: <span style={{ color: '#0071e3' }}>4</span> <span style={{ color: FAINT }}>· col=0</span></div>
        <div><span style={{ color: '#a44' }}>lang</span>:  <span style={{ color: '#0071e3' }}>"en"</span></div>
        <div><span style={{ color: '#a44' }}>text</span>:  <span style={{ color: INK }}>"We propose an…"</span></div>
        <div style={{ marginTop: 12, color: FAINT, fontSize: 10 }}>
          ✓ 412 blocks normalized · 12 pages · 2 columns
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  SceneUpload, SceneCloud, SceneFetch, SceneStandardize,
});
