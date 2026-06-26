// ritual.jsx — ★ The 2-minute Unlock (affective labeling → ridiculous subdivision),
//               Focus companion, and the Reward / Momentum moment.
const { useState: useStateR, useEffect: useEffectR, useRef: useRefR } = React;

const FEELINGS = [
  { id: 'anxious', emoji: '😮‍💨', label: 'A little anxious',
    val: 'That makes total sense. A blank deck stares back. Naming the feeling already loosens its grip.' },
  { id: 'bored', emoji: '🥱', label: 'Honestly, bored',
    val: 'Fair. Boredom is the brain asking for something easier. We’ll make the first move so small it’s almost silly.' },
  { id: 'over', emoji: '🌊', label: 'A bit overwhelmed',
    val: 'Of course — “the whole deck” is a lot to hold. So we won’t. We’ll hold one sentence.' },
  { id: 'avoid', emoji: '🛑', label: 'I’m avoiding it',
    val: 'You noticed that, which is the hard part. No guilt here. Let’s just crack the lid open together.' },
  { id: 'unsure', emoji: '🤍', label: 'Not really sure',
    val: 'That’s okay too. We don’t need to know. We just need a first, tiny motion.' },
];

/* ---------------- The 2-minute Unlock ---------------- */
function RitualFlow({ tone, task = DECK_TASK, onAction, onClose }) {
  const warm = tone === 'warm';
  const [step, setStep] = useStateR(0);        // 0 feeling, 1 validation, 2 subdivide
  const [feeling, setFeeling] = useStateR(null);
  const f = FEELINGS.find(x => x.id === feeling);

  return (
    <Overlay onClose={onClose}>
      <div className="screen">
        <div className="pad-top" />
        <div style={{ flex: 'none', padding: '4px 18px 6px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconBtn name="close" onClick={onClose} label="Close" />
          <div style={{ flex: 1 }}>
            <div className="steps">
              {[0, 1, 2].map(i => (
                <div key={i} className={'step-pill' + (i <= step ? ' on' : '')} />
              ))}
            </div>
          </div>
          <span className="tiny" style={{ width: 64, textAlign: 'right' }}>2‑min unlock</span>
        </div>

        {/* STEP 0 — affective labeling */}
        {step === 0 && (
          <div className="scroll" style={{ padding: '14px 20px 18px' }}>
            <div style={{ textAlign: 'center', marginBottom: 22 }} className="rise">
              <Alpha size={72} mood="calm" style={{ margin: '6px auto 16px' }} />
              <h1 className="h1">Before we start…</h1>
              <p className="lead text-wrap-pretty" style={{ marginTop: 10, color: 'var(--ink-2)' }}>
                What comes up when you picture the launch deck?
              </p>
            </div>
            <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {FEELINGS.map(opt => (
                <button key={opt.id} className={'opt' + (feeling === opt.id ? ' sel' : '')}
                  onClick={() => { setFeeling(opt.id); setTimeout(() => setStep(1), 240); }}>
                  <span className="opt-emoji">{opt.emoji}</span>
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="tiny" style={{ textAlign: 'center', marginTop: 18 }}>
              There’s no wrong answer. Alpha won’t share this.
            </p>
          </div>
        )}

        {/* STEP 1 — validation */}
        {step === 1 && f && (
          <div className="scroll" style={{ padding: '14px 24px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <Alpha size={80} mood="happy" style={{ margin: '0 auto 22px' }} ring />
              <div className="chip rise" style={{ margin: '0 auto 18px', background: 'var(--glow-soft)', color: 'var(--glow)', borderColor: 'transparent' }}>
                <span>{f.emoji}</span> {f.label}
              </div>
              <h1 className="h1 rise text-wrap-pretty" style={{ fontSize: 25, lineHeight: 1.3 }}>{f.val}</h1>
            </div>
            <div style={{ marginTop: 30 }}>
              <Btn kind="primary" full lg icon="arrow" onClick={() => setStep(2)}>I’m ready</Btn>
            </div>
          </div>
        )}

        {/* STEP 2 — ridiculous subdivision */}
        {step === 2 && (
          <div className="scroll" style={{ padding: '14px 22px 18px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }} className="rise">
              <p className="kicker">We’re not doing this</p>
              <div style={{
                margin: '10px auto', maxWidth: 290, padding: '12px 16px', borderRadius: 16,
                border: '1px dashed var(--line-2)', color: 'var(--ink-3)',
                textDecoration: 'line-through', textDecorationColor: 'var(--ink-3)',
                fontSize: 16,
              }}>
                {task.title} — the whole thing
              </div>
            </div>

            <div className="rise" style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 14px' }}>
              <div style={{ transform: 'rotate(90deg)' }}><Icon name="arrow" size={22} color="var(--accent)" /></div>
            </div>

            <p className="kicker rise" style={{ textAlign: 'center', color: 'var(--accent)' }}>We’re doing this</p>
            <div className="rise" style={{
              marginTop: 12, padding: 24, borderRadius: 26, textAlign: 'center',
              background: 'linear-gradient(180deg, var(--accent-soft), transparent)',
              border: '1px solid var(--accent)',
            }}>
              <Alpha size={56} mood="happy" style={{ margin: '0 auto 16px' }} />
              <div className="h2 text-wrap-pretty" style={{ fontSize: 24, lineHeight: 1.3 }}>
                {task.micro}
              </div>
              <p className="body text-wrap-pretty" style={{ marginTop: 12 }}>
                That’s the entire ask. You’re allowed to stop right after — really.
              </p>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 18,
                padding: '10px 16px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--line)',
              }}>
                <Icon name="doc" size={16} color="var(--accent)" />
                <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>{task.resource}</span>
                <span className="tiny">· linked</span>
              </div>
            </div>

            <div style={{ marginTop: 22 }}>
              <Btn kind="primary" full lg icon="play" onClick={onAction}>Open it with me</Btn>
              <p className="tiny" style={{ textAlign: 'center', marginTop: 12 }}>
                {warm ? 'I’ll sit with you the whole time. No timer pressure.' : 'No countdown pressure. Stop anytime.'}
              </p>
            </div>
          </div>
        )}
        <div className="pad-bot" />
      </div>
    </Overlay>
  );
}

/* ---------------- Focus companion ---------------- */
function FocusScreen({ tone, task = DECK_TASK, onDone, onClose }) {
  const warm = tone === 'warm';
  const TOTAL = 120;
  const [left, setLeft] = useStateR(TOTAL);
  const [paused, setPaused] = useStateR(false);
  const tick = useRefR(null);

  useEffectR(() => {
    if (paused) return;
    tick.current = setInterval(() => {
      setLeft(v => {
        if (v <= 1) { clearInterval(tick.current); setTimeout(onDone, 400); return 0; }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(tick.current);
  }, [paused]);

  const mm = String(Math.floor(left / 60)).padStart(1, '0');
  const ss = String(left % 60).padStart(2, '0');
  const prog = 1 - left / TOTAL;
  const R = 86, C = 2 * Math.PI * R;

  return (
    <Overlay onClose={onClose}>
      <div className="screen" style={{ justifyContent: 'space-between' }}>
        <div className="pad-top" />
        <div style={{ flex: 'none', padding: '0 18px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-quiet" onClick={onClose}>I’ll come back</button>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <p className="kicker fade" style={{ marginBottom: 8 }}>{task.action}</p>
          <h1 className="h1 fade text-wrap-pretty" style={{ textAlign: 'center', marginBottom: 28 }}>You’re in it now.</h1>

          {/* Alpha inside a soft progress ring */}
          <div style={{ position: 'relative', width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="220" height="220" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
              <circle cx="110" cy="110" r={R} fill="none" stroke="var(--line-2)" strokeWidth="3" />
              <circle cx="110" cy="110" r={R} fill="none" stroke="var(--accent)" strokeWidth="3"
                strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - prog)}
                style={{ transition: 'stroke-dashoffset 1s linear' }} />
            </svg>
            <Alpha size={132} mood="calm" ring />
          </div>

          <div className="display" style={{ fontSize: 34, color: 'var(--ink)', marginTop: 26, letterSpacing: '0.02em' }}>
            {mm}:{ss}
          </div>
          <p className="body text-wrap-pretty" style={{ textAlign: 'center', marginTop: 8, maxWidth: 260 }}>
            {paused
              ? 'Paused. Stopping is fine — you still showed up.'
              : (warm ? 'I’m right here with you. Take your time.' : 'Just keep going. The timer isn’t a deadline.')}
          </p>
        </div>

        <div style={{ flex: 'none', padding: '0 20px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Btn kind="primary" full lg icon="check" onClick={onDone}>{task.selfMade ? 'I did the first bit' : 'I did the messy sentence'}</Btn>
          <button className="btn btn-ghost" onClick={() => setPaused(p => !p)} style={{ width: '100%' }}>
            {paused ? 'Resume' : 'Pause — no pressure'}
          </button>
        </div>
        <div className="pad-bot" />
      </div>
    </Overlay>
  );
}

/* ---------------- Reward / Momentum ---------------- */
function RewardScreen({ tone, onHome, onClose }) {
  const warm = tone === 'warm';
  const [boom, setBoom] = useStateR(false);
  useEffectR(() => { const t = setTimeout(() => setBoom(true), 220); return () => clearTimeout(t); }, []);

  return (
    <Overlay onClose={onClose}>
      <div className="screen" style={{ justifyContent: 'center' }}>
        <div className="pad-top" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center' }}>
          <div style={{ position: 'relative', marginBottom: 26 }}>
            {boom && <Sparkles n={20} />}
            <Alpha size={104} mood="cheer" />
          </div>

          <h1 className="h1 rise" style={{ fontSize: 32 }}>You did it.</h1>
          <p className="lead rise text-wrap-pretty" style={{ marginTop: 12, maxWidth: 290, color: 'var(--ink-2)' }}>
            {warm
              ? 'That counts — fully. The hardest part was starting, and you just did. The rest is easier from here.'
              : 'That counts. Starting was the hard part, and it’s done.'}
          </p>

          {/* a gentle, no-streak momentum note */}
          <div className="card rise" style={{ marginTop: 26, width: '100%', maxWidth: 300, padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14, flex: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--sage-soft)',
            }}>
              <Icon name="leaf" size={22} color="var(--sage)" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 15.5, color: 'var(--ink)', fontWeight: 700 }}>~14 minutes recovered</div>
              <div className="tiny" style={{ marginTop: 2 }}>Time you’d have spent circling it. Yours again.</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 'none', padding: '0 22px 18px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <Btn kind="primary" full lg onClick={onHome}>Back to my day</Btn>
          <button className="btn btn-quiet" onClick={onHome}>Keep the momentum — one more later</button>
        </div>
        <div className="pad-bot" />
      </div>
    </Overlay>
  );
}

Object.assign(window, { RitualFlow, FocusScreen, RewardScreen, FEELINGS });
