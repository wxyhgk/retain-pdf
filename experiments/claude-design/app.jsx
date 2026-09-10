// app.jsx
// Main shell: macOS-style app window with stage progress + main canvas + footer label.

const { useState, useEffect, useMemo } = React;

// ── Stage timing ──────────────────────────────────────────────────────────
// 15 substeps × 8s = 120s total.
const SUBSTEP = 8;
const STAGES = [
  {
    id: 'ocr', label: 'OCR', subtitle: '识别',
    substeps: [
      { id: 'upload',     name: '上传 PDF',           keyword: 'upload · multipart/form-data' },
      { id: 'cloud',      name: '云端 OCR',           keyword: 'cloud-ocr · streaming' },
      { id: 'fetch',      name: '下载 / 整理结果',    keyword: 'fetch · normalize blocks' },
      { id: 'standardize',name: '标准化',             keyword: 'schema · bbox · order' },
    ],
  },
  {
    id: 'translate', label: '翻译', subtitle: '语义',
    substeps: [
      { id: 'crosslayout',name: '跨栏 / 跨页判断',    keyword: 'paragraph · graph match' },
      { id: 'strategy',   name: '页面策略',           keyword: 'route · per-page plan' },
      { id: 'batch',      name: '批量翻译',           keyword: 'batch · concurrent · LLM' },
      { id: 'fixgarble',  name: '乱码修复',           keyword: 'unicode · repair' },
    ],
  },
  {
    id: 'render', label: '渲染', subtitle: '排版',
    substeps: [
      { id: 'mask',       name: '背景 / 遮盖处理',    keyword: 'inpaint · cover-rect' },
      { id: 'typst',      name: 'Typst overlay 编译',keyword: 'typst · pdf-overlay' },
      { id: 'merge',      name: '合成 PDF',           keyword: 'merge · pikepdf' },
      { id: 'compress',   name: '压缩',               keyword: 'compress · linearize' },
    ],
  },
  {
    id: 'done', label: '完成', subtitle: '交付',
    substeps: [
      { id: 'publish',    name: '产物发布',           keyword: 'publish · artifact' },
      { id: 'summary',    name: '写 summary',         keyword: 'summary · stats' },
      { id: 'download',   name: '可下载',             keyword: 'ready · download' },
    ],
  },
];

// Build flat substep list with absolute time windows
const FLAT = [];
let _t = 0;
for (let si = 0; si < STAGES.length; si++) {
  const s = STAGES[si];
  for (let bi = 0; bi < s.substeps.length; bi++) {
    FLAT.push({
      stageIdx: si,
      stage: s,
      substepIdx: bi,
      sub: s.substeps[bi],
      start: _t,
      end: _t + SUBSTEP,
    });
    _t += SUBSTEP;
  }
}
const TOTAL = _t; // 120
window.__FLAT = FLAT;
window.__TOTAL = TOTAL;
window.__STAGES = STAGES;

// ── Find current substep from time ─────────────────────────────────────────
function findSubAt(time) {
  for (let i = 0; i < FLAT.length; i++) {
    if (time >= FLAT[i].start && time < FLAT[i].end) return { ...FLAT[i], i };
  }
  return { ...FLAT[FLAT.length - 1], i: FLAT.length - 1 };
}

// ── App window chrome ──────────────────────────────────────────────────────
function AppWindow({ children }) {
  return (
    <div style={{
      position: 'absolute',
      left: 60, top: 60, right: 60, bottom: 60,
      background: PANEL,
      borderRadius: 14,
      boxShadow: '0 30px 80px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04)',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <TitleBar />
      {children}
    </div>
  );
}

function TitleBar() {
  return (
    <div style={{
      height: 44, flexShrink: 0,
      display: 'flex', alignItems: 'center',
      padding: '0 16px',
      borderBottom: `1px solid ${HAIRLINE}`,
      background: '#fbfbfd',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Dot color="#ff5f57" />
        <Dot color="#febc2e" />
        <Dot color="#28c840" />
      </div>
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        fontFamily: SANS, fontSize: 13, fontWeight: 600,
        color: INK, letterSpacing: '-0.01em',
      }}>保留排版翻译</div>
      <div style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, color: FAINT }}>
        layout-translate.app
      </div>
    </div>
  );
}

function Dot({ color }) {
  return <div style={{ width: 12, height: 12, borderRadius: 6, background: color }} />;
}

// ── Stage progress strip ───────────────────────────────────────────────────
function StageStrip({ time }) {
  const cur = findSubAt(time);
  return (
    <div style={{
      flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      gap: 14,
      padding: '20px 36px 14px 36px',
      borderBottom: `1px solid ${HAIRLINE}`,
      background: '#fff',
    }}>
      {/* Stage row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {STAGES.map((s, i) => {
          const stageTime = i * 4 * SUBSTEP;
          const stageEnd = stageTime + s.substeps.length * SUBSTEP;
          const isPast = time >= stageEnd;
          const isCurrent = i === cur.stageIdx;
          // Stage local progress
          const localProgress = isPast ? 1 : isCurrent ? (time - stageTime) / (s.substeps.length * SUBSTEP) : 0;

          const stepDone = isPast || isCurrent;
          return (
            <React.Fragment key={s.id}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: stepDone ? 1 : 0.35,
                transition: 'opacity 200ms',
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 13,
                  background: isPast ? INK : isCurrent ? '#fff' : '#fff',
                  border: `1.5px solid ${isPast || isCurrent ? INK : HAIRLINE}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  {isPast ? (
                    <svg width="13" height="13" viewBox="0 0 13 13">
                      <path d="M3 6.5 L5.5 9 L10 4" fill="none" stroke="#fff"
                        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <div style={{
                      fontFamily: MONO, fontSize: 11, fontWeight: 600,
                      color: isCurrent ? INK : FAINT,
                    }}>{i + 1}</div>
                  )}
                  {isCurrent && (
                    <svg style={{ position: 'absolute', inset: -3 }} width="32" height="32" viewBox="0 0 32 32">
                      <circle cx="16" cy="16" r="14.5" fill="none" stroke={ACCENT}
                        strokeWidth="1.2" opacity="0.5">
                        <animate attributeName="r" values="14;16;14" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.5;0.1;0.5" dur="2s" repeatCount="indefinite" />
                      </circle>
                    </svg>
                  )}
                </div>
                <div>
                  <div style={{
                    fontFamily: SANS, fontSize: 13, fontWeight: 600, color: INK,
                    letterSpacing: '-0.01em',
                  }}>{s.label}</div>
                  <div style={{
                    fontFamily: MONO, fontSize: 10, color: FAINT,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{s.subtitle}</div>
                </div>
              </div>
              {/* connector */}
              {i < STAGES.length - 1 && (
                <div style={{
                  flex: 1, height: 1.5, margin: '0 18px',
                  background: HAIRLINE, position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${localProgress * 100}%`,
                    background: INK,
                    transition: 'width 60ms linear',
                  }} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Substep ticks */}
      <div style={{ display: 'flex', gap: 4 }}>
        {FLAT.map((f, i) => {
          const isPast = time >= f.end;
          const isCurrent = time >= f.start && time < f.end;
          const localP = isPast ? 1 : isCurrent ? (time - f.start) / SUBSTEP : 0;
          return (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: HAIRLINE, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                width: `${localP * 100}%`,
                background: INK,
                transition: 'width 60ms linear',
              }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Footer with substep label + keyword ───────────────────────────────────
function Footer({ time }) {
  const cur = findSubAt(time);
  const stageNum = cur.stageIdx + 1;
  const subNum = cur.substepIdx + 1;
  const totalSubs = cur.stage.substeps.length;
  return (
    <div style={{
      flexShrink: 0,
      height: 64,
      display: 'flex', alignItems: 'center',
      padding: '0 36px',
      borderTop: `1px solid ${HAIRLINE}`,
      background: '#fbfbfd',
    }}>
      <div>
        <div style={{
          fontFamily: MONO, fontSize: 10, color: FAINT,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 4,
        }}>
          STAGE {stageNum}/4 · STEP {subNum}/{totalSubs}
        </div>
        <div style={{
          fontFamily: SANS, fontSize: 17, fontWeight: 600,
          color: INK, letterSpacing: '-0.01em',
        }}>{cur.sub.name}</div>
      </div>
      <div style={{
        marginLeft: 'auto', textAlign: 'right',
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 11, color: FAINT,
          letterSpacing: '0.02em',
        }}>{cur.sub.keyword}</div>
        <div style={{
          fontFamily: MONO, fontSize: 10, color: '#bbb',
          marginTop: 4,
        }}>
          <ElapsedTimer time={time} />
        </div>
      </div>
    </div>
  );
}

function ElapsedTimer({ time }) {
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  const cs = Math.floor((time * 100) % 100);
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>
    elapsed {String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}.{String(cs).padStart(2,'0')}
  </span>;
}

// ── Main canvas: routes by current substep ────────────────────────────────
function MainCanvas() {
  const time = useTime();
  const cur = findSubAt(time);
  const localTime = time - cur.start;
  const localP = localTime / SUBSTEP;
  const props = { localTime, progress: localP, duration: SUBSTEP };

  // Render the right scene component based on current substep id.
  let scene = null;
  switch (cur.sub.id) {
    case 'upload':      scene = <SceneUpload {...props} />; break;
    case 'cloud':       scene = <SceneCloud {...props} />; break;
    case 'fetch':       scene = <SceneFetch {...props} />; break;
    case 'standardize': scene = <SceneStandardize {...props} />; break;
    case 'crosslayout': scene = <SceneCrossLayout {...props} />; break;
    case 'strategy':    scene = <SceneStrategy {...props} />; break;
    case 'batch':       scene = <SceneBatch {...props} />; break;
    case 'fixgarble':   scene = <SceneFixGarble {...props} />; break;
    case 'mask':        scene = <SceneMask {...props} />; break;
    case 'typst':       scene = <SceneTypst {...props} />; break;
    case 'merge':       scene = <SceneMerge {...props} />; break;
    case 'compress':    scene = <SceneCompress {...props} />; break;
    case 'publish':     scene = <ScenePublish {...props} />; break;
    case 'summary':     scene = <SceneSummary {...props} />; break;
    case 'download':    scene = <SceneDownload {...props} />; break;
    default: scene = null;
  }

  return (
    <div style={{
      flex: 1, position: 'relative',
      background: APPBG,
      overflow: 'hidden',
    }}>
      {scene}
    </div>
  );
}

// ── Top-level App ────────────────────────────────────────────────────────
function App() {
  const [tweaks, setTweak] = useTweaks(window.TWEAK_DEFAULTS);
  const speed = parseFloat(tweaks.speed) || 1;
  const mode = tweaks.mode || 'sequence';

  // We use a custom render instead of <Stage>'s default — to inject speed and loop mode.
  return (
    <SpeedyStage speed={speed} mode={mode}>
      <ShellAndScenes />
      <TweaksPanel title="Tweaks">
        <TweakSection title="Playback">
          <TweakRadio
            label="Speed"
            value={String(tweaks.speed)}
            options={[
              { label: '0.5×', value: '0.5' },
              { label: '1×',   value: '1' },
              { label: '2×',   value: '2' },
            ]}
            onChange={(v) => setTweak('speed', parseFloat(v))}
          />
          <TweakRadio
            label="Mode"
            value={tweaks.mode}
            options={[
              { label: '顺播', value: 'sequence' },
              { label: '单步循环', value: 'loop' },
            ]}
            onChange={(v) => setTweak('mode', v)}
          />
        </TweakSection>
      </TweaksPanel>
    </SpeedyStage>
  );
}

function ShellAndScenes() {
  const time = useTime();
  return (
    <AppWindow>
      <StageStrip time={time} />
      <MainCanvas />
      <Footer time={time} />
    </AppWindow>
  );
}

// ── SpeedyStage: a custom Stage that supports speed + per-substep loop mode ──
function SpeedyStage({ speed = 1, mode = 'sequence', children }) {
  const width = 1440, height = 900;
  const duration = TOTAL;
  const [time, setTime] = useState(() => {
    try { const v = parseFloat(localStorage.getItem('lt:t') || '0'); return isFinite(v) ? v : 0; }
    catch { return 0; }
  });
  const [playing, setPlaying] = useState(true);
  const [hoverTime, setHoverTime] = useState(null);
  const [scale, setScale] = useState(1);
  const stageRef = React.useRef(null);
  const rafRef = React.useRef(null);
  const lastTsRef = React.useRef(null);

  // Persist
  useEffect(() => { try { localStorage.setItem('lt:t', String(time)); } catch {} }, [time]);

  // Auto-scale
  useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const measure = () => {
      const barH = 44;
      const s = Math.min(el.clientWidth / width, (el.clientHeight - barH) / height);
      setScale(Math.max(0.05, s));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  // Animation loop with speed + loop mode
  useEffect(() => {
    if (!playing) { lastTsRef.current = null; return; }
    const step = (ts) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setTime((t) => {
        let next = t + dt * speed;
        if (mode === 'loop') {
          // Loop within current substep
          const sub = findSubAt(t);
          if (next >= sub.end) next = sub.start + (next - sub.end);
          if (next < sub.start) next = sub.start;
        } else {
          if (next >= duration) next = next % duration;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); lastTsRef.current = null; };
  }, [playing, speed, mode, duration]);

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying(p => !p); }
      else if (e.code === 'ArrowLeft') setTime(t => Math.max(0, t - (e.shiftKey ? 8 : 1)));
      else if (e.code === 'ArrowRight') setTime(t => Math.min(duration, t + (e.shiftKey ? 8 : 1)));
      else if (e.key === '0' || e.code === 'Home') setTime(0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [duration]);

  // Notify host of current substep idx (for speaker-notes parity, harmless if none)
  useEffect(() => {
    const cur = findSubAt(time);
    try { window.parent.postMessage({ slideIndexChanged: cur.i }, '*'); } catch {}
  }, [Math.floor(time / SUBSTEP)]);

  const display = hoverTime != null ? hoverTime : time;
  const ctxValue = useMemo(() => ({ time: display, duration, playing, setTime, setPlaying }),
    [display, duration, playing]);

  return (
    <div ref={stageRef} style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', background: '#0a0a0a',
    }}>
      <div style={{
        flex: 1, width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', minHeight: 0,
      }}>
        <div style={{
          width, height,
          background: APPBG,
          position: 'relative',
          transform: `scale(${scale})`,
          transformOrigin: 'center',
          flexShrink: 0,
          overflow: 'hidden',
        }}>
          <TimelineContext.Provider value={ctxValue}>
            {children}
          </TimelineContext.Provider>
        </div>
      </div>
      <PlaybackBar
        time={display}
        actualTime={time}
        duration={duration}
        playing={playing}
        onPlayPause={() => setPlaying(p => !p)}
        onReset={() => setTime(0)}
        onSeek={setTime}
        onHover={setHoverTime}
      />
    </div>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
