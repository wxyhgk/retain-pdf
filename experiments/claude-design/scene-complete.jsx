// scene-complete.jsx
// 3 substeps: publish, summary, download.

// ── 4.1 产物发布 ──────────────────────────────────────────────────────────
function ScenePublish({ progress }) {
  // PDF artifact card flies in and gets a "Published" stamp.
  const cardP = animate({ from: 0, to: 1, start: 0.05, end: 0.4, ease: Easing.easeOutCubic })(progress);
  const stampP = animate({ from: 0, to: 1, start: 0.5, end: 0.75, ease: Easing.easeOutBack })(progress);
  const checkP = animate({ from: 0, to: 1, start: 0.75, end: 0.9, ease: Easing.easeOutCubic })(progress);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Center: artifact card */}
      <div style={{
        position: 'absolute', left: 720, top: 290,
        transform: `translate(-50%, -50%) translateY(${(1 - cardP) * 40}px) scale(${0.9 + 0.1 * cardP})`,
        opacity: cardP,
      }}>
        <div style={{
          width: 480, padding: '32px 36px',
          background: '#fff',
          borderRadius: 16,
          border: `1px solid ${HAIRLINE}`,
          boxShadow: '0 30px 80px rgba(0,0,0,0.18), 0 1px 0 rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', gap: 24,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <PDFFileIcon size={72} />
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: SANS, fontSize: 18, fontWeight: 600, color: INK,
              letterSpacing: '-0.01em', marginBottom: 4,
            }}>保留排版的文档翻译方法综述</div>
            <div style={{
              fontFamily: MONO, fontSize: 11, color: FAINT,
            }}>output_zh.pdf · 12 pages · 3.1 MB</div>
            <div style={{
              fontFamily: MONO, fontSize: 10, color: '#bbb', marginTop: 6,
            }}>sha256:7f4a…d2e8</div>
          </div>

          {/* Published stamp */}
          {stampP > 0 && (
            <div style={{
              position: 'absolute', right: -24, top: -24,
              transform: `rotate(${-12 + (1 - stampP) * 30}deg) scale(${stampP})`,
              padding: '10px 18px',
              border: `2px solid #34c759`,
              borderRadius: 6,
              fontFamily: SANS, fontSize: 14, fontWeight: 700,
              color: '#34c759',
              letterSpacing: '0.05em',
              background: 'rgba(52,199,89,0.06)',
              opacity: stampP,
            }}>PUBLISHED</div>
          )}
        </div>
      </div>

      {/* Artifact registry list — appears below */}
      <div style={{
        position: 'absolute', left: 720 - 240, top: 410,
        width: 480,
        opacity: checkP,
        transform: `translateY(${(1 - checkP) * 12}px)`,
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 10, color: FAINT,
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
        }}>artifacts registry</div>
        <RegistryRow icon="pdf" name="output_zh.pdf" meta="3.1 MB · primary" check={checkP} />
        <RegistryRow icon="json" name="ocr-result.jsonl" meta="412 blocks" check={checkP - 0.1} />
        <RegistryRow icon="typ" name="overlay.typ" meta="source" check={checkP - 0.2} />
        <RegistryRow icon="log" name="run.log" meta="diagnostics" check={checkP - 0.3} />
      </div>
    </div>
  );
}

function RegistryRow({ icon, name, meta, check }) {
  const c = clamp(check, 0, 1);
  if (c <= 0) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 12px',
      borderBottom: `1px solid ${HAIRLINE}`,
      opacity: c,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: 4,
        background: '#f5f5f7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: MONO, fontSize: 9, color: INK, fontWeight: 600,
      }}>{icon}</div>
      <span style={{ fontFamily: SANS, fontSize: 13, color: INK, flex: 1 }}>{name}</span>
      <span style={{ fontFamily: MONO, fontSize: 10, color: FAINT, marginRight: 12 }}>{meta}</span>
      <CheckCircle size={16} color="#34c759" progress={c} />
    </div>
  );
}

// ── 4.2 写 summary ────────────────────────────────────────────────────────
function SceneSummary({ progress }) {
  // A summary card with stats appearing line by line.
  const stats = [
    { label: '页数', value: '12', detail: 'pages' },
    { label: '字数', value: '8,420', detail: 'words translated' },
    { label: '段落', value: '87', detail: 'paragraphs · cross-flow merged' },
    { label: '图表', value: '6', detail: 'figures preserved' },
    { label: '表格', value: '3', detail: 'tables · cell-by-cell' },
    { label: '乱码修复', value: '14', detail: 'unicode fixes' },
    { label: '耗时', value: '2 分 47 秒', detail: 'wall-clock' },
    { label: '体积', value: '28.4 → 3.1 MB', detail: 'compressed 89%' },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, padding: '50px 100px', display: 'flex', gap: 60 }}>
      {/* Left: title */}
      <div style={{ flex: '0 0 320px', paddingTop: 30 }}>
        <div style={{
          fontFamily: MONO, fontSize: 11, color: FAINT,
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14,
        }}>summary.md</div>
        <div style={{
          fontFamily: SANS, fontSize: 38, fontWeight: 700,
          color: INK, letterSpacing: '-0.025em', lineHeight: 1.1,
          marginBottom: 18,
        }}>翻译完成</div>
        <div style={{
          fontFamily: SANS, fontSize: 14, color: FAINT, lineHeight: 1.6,
        }}>
          已生成保留排版的中文版 PDF。可下载产物、查看运行日志，或导出 Typst 源文件继续编辑。
        </div>

        {/* Sparkle / signature */}
        <div style={{ marginTop: 36, display: 'flex', alignItems: 'center', gap: 10,
          opacity: progress > 0.7 ? 1 : 0,
          transition: 'opacity 200ms',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: 3, background: '#34c759',
          }} />
          <span style={{ fontFamily: MONO, fontSize: 11, color: FAINT }}>
            written at <span style={{ color: INK }}>14:32:08</span> · 0 errors · 0 warnings
          </span>
        </div>
      </div>

      {/* Right: stats list, line by line */}
      <div style={{ flex: 1, paddingTop: 14 }}>
        {stats.map((s, i) => {
          const t = 0.05 + (i / stats.length) * 0.7;
          const localP = clamp((progress - t) / 0.15, 0, 1);
          if (localP <= 0) return null;
          const ease = Easing.easeOutCubic(localP);
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'baseline', gap: 16,
              padding: '14px 0',
              borderBottom: `1px solid ${HAIRLINE}`,
              opacity: ease,
              transform: `translateY(${(1 - ease) * 8}px)`,
            }}>
              <div style={{
                fontFamily: SANS, fontSize: 13, color: FAINT,
                width: 100, flexShrink: 0,
              }}>{s.label}</div>
              <div style={{
                fontFamily: SANS, fontSize: 24, fontWeight: 600,
                color: INK, letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
                minWidth: 160,
              }}>{s.value}</div>
              <div style={{
                fontFamily: MONO, fontSize: 11, color: FAINT,
                marginLeft: 'auto',
              }}>{s.detail}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 4.3 可下载 ────────────────────────────────────────────────────────────
function SceneDownload({ progress }) {
  // Big download button activates and pulses; PDF preview behind.
  const buttonReveal = animate({ from: 0, to: 1, start: 0.0, end: 0.3, ease: Easing.easeOutBack })(progress);
  const ready = animate({ from: 0, to: 1, start: 0.3, end: 0.55, ease: Easing.easeOutCubic })(progress);
  const click = animate({ from: 0, to: 1, start: 0.6, end: 0.7, ease: Easing.easeInOutCubic })(progress);
  const flying = animate({ from: 0, to: 1, start: 0.7, end: 0.95, ease: Easing.easeOutCubic })(progress);
  const isClicking = progress > 0.6 && progress < 0.7;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* PDF preview behind */}
      <div style={{
        position: 'absolute', left: 720, top: 280,
        transform: `translate(-50%, -50%) scale(${0.85 + 0.15 * buttonReveal})`,
        opacity: 0.5 + 0.5 * buttonReveal,
      }}>
        <div style={{ display: 'flex', gap: 18 }}>
          <PDFPage x={0} y={0} language="zh" pageNumber={1} />
          <PDFPage x={0} y={0} language="zh" pageNumber={2} />
        </div>
      </div>

      {/* Big download button */}
      <div style={{
        position: 'absolute', left: 720, top: 480,
        transform: `translate(-50%, -50%) scale(${buttonReveal * (isClicking ? 0.96 : 1)})`,
        opacity: buttonReveal,
      }}>
        <div style={{
          padding: '18px 32px',
          background: ready > 0.5 ? '#1d1d1f' : '#86868b',
          color: '#fff',
          borderRadius: 999,
          fontFamily: SANS, fontSize: 17, fontWeight: 600,
          letterSpacing: '-0.01em',
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: ready > 0.5
            ? `0 12px 32px rgba(0,0,0,0.25), 0 0 0 ${(1 - ((progress * 4) % 1)) * 8}px rgba(0,113,227,0.15)`
            : '0 6px 16px rgba(0,0,0,0.12)',
          transition: 'background 300ms',
          position: 'relative',
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 3 V14 M6 9 L11 14 L16 9" stroke="#fff" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 17 H18" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>下载 output_zh.pdf</span>
          <span style={{
            fontFamily: MONO, fontSize: 12, fontWeight: 400,
            color: '#a8a8ad',
            paddingLeft: 14,
            borderLeft: '1px solid #3a3a3d',
            marginLeft: 4,
          }}>3.1 MB</span>
        </div>

        {/* Cursor */}
        <div style={{
          position: 'absolute',
          left: '50%', top: '50%',
          transform: `translate(${-30 + click * 40}px, ${-30 + click * 40}px)`,
          pointerEvents: 'none',
          transition: 'none',
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M3 2 L18 11 L11 12 L14 18 L11 19 L8 13 L3 16 Z"
              fill="#fff" stroke="#1d1d1f" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Click ripple */}
        {isClicking && (
          <div style={{
            position: 'absolute',
            left: '50%', top: '50%',
            width: (progress - 0.6) * 600,
            height: (progress - 0.6) * 600,
            transform: 'translate(-50%, -50%)',
            border: '2px solid rgba(0,113,227,0.4)',
            borderRadius: '50%',
            opacity: 1 - (progress - 0.6) * 10,
          }} />
        )}
      </div>

      {/* Flying download icon */}
      {flying > 0 && (
        <div style={{
          position: 'absolute',
          left: 720 + (1100 - 720) * flying,
          top: 480 + (560 - 480) * flying,
          transform: `translate(-50%, -50%) scale(${1 - flying * 0.3})`,
          opacity: 1 - flying * 0.4,
        }}>
          <PDFFileIcon size={48} />
        </div>
      )}

      {/* Browser-like download tray bottom-right */}
      {flying > 0.3 && (
        <div style={{
          position: 'absolute', right: 80, bottom: 60,
          background: '#1d1d1f', color: '#fff',
          padding: '14px 20px',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
          transform: `translateY(${(1 - clamp((flying - 0.3) / 0.3, 0, 1)) * 20}px)`,
          opacity: clamp((flying - 0.3) / 0.3, 0, 1),
          minWidth: 320,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: '#34c759',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 9 L8 13 L14 5" stroke="#fff" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600 }}>
              已下载 · output_zh.pdf
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: '#a8a8ad', marginTop: 2 }}>
              ~/Downloads · 3.1 MB
            </div>
          </div>
          <div style={{
            fontFamily: SANS, fontSize: 12, color: '#a8a8ad',
          }}>打开</div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  ScenePublish, SceneSummary, SceneDownload,
});
