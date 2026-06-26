// onboarding.jsx — Welcome (Bienvenida) + Onboarding (profile) + Intention capture
const { useState: useStateOb } = React;

/* ---------------- Welcome ---------------- */
function WelcomeScreen({ tone, onBegin }) {
  const warm = tone === 'warm';
  return (
    <div className="screen" style={{ justifyContent: 'space-between' }}>
      <div className="pad-top" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center' }}>
        <div style={{ position: 'relative', marginBottom: 30 }}>
          <Alpha size={110} mood="happy" ring />
        </div>
        <p className="kicker rise" style={{ color: 'var(--accent)' }}>Hi, I’m Alpha</p>
        <h1 className="h1 rise text-wrap-pretty" style={{ marginTop: 12, fontSize: 32 }}>
          Not a task manager. A gentle nudge to begin.
        </h1>
        <p className="lead rise text-wrap-pretty" style={{ marginTop: 14, maxWidth: 300, color: 'var(--ink-2)' }}>
          {warm
            ? 'Putting things off isn’t about time — it’s about the feeling. I’ll help you shrink that feeling, one tiny step at a time.'
            : 'Procrastination is an emotion, not a schedule. I make starting smaller.'}
        </p>
        <div className="card rise" style={{ marginTop: 24, maxWidth: 310, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, flex: 'none', background: 'var(--glow-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="heart" size={20} color="var(--glow)" />
          </div>
          <p className="tiny text-wrap-pretty" style={{ textAlign: 'left' }}>
            Most people lose ~131 minutes a day circling tasks. You’re not behind, and you’re not alone.
          </p>
        </div>
      </div>
      <div style={{ flex: 'none', padding: '0 24px 18px' }}>
        <Btn kind="primary" full lg icon="arrow" onClick={onBegin}>Let’s begin, gently</Btn>
      </div>
      <div className="pad-bot" />
    </div>
  );
}

/* ---------------- Onboarding (4 light steps) ---------------- */
const ROLES = ['I build / make', 'I lead a team', 'I design', 'I write', 'A bit of everything'];
const HARD = [
  { id: 'morning', emoji: '🌅', label: 'Mornings — facing the day' },
  { id: 'afternoon', emoji: '🌤️', label: 'Afternoons — the slump' },
  { id: 'night', emoji: '🌙', label: 'Late at night' },
];
const PROFILES = [
  { id: 'rbp', emoji: '📱', label: 'I scroll late and lose sleep',
    name: 'Bedtime revenge scroll', plan: 'A calm night wind‑down to help you set the phone down and reclaim sleep.', when: 'Evenings, ~10:30pm' },
  { id: 'multi', emoji: '🌀', label: 'Too many things — I freeze',
    name: 'Multitask overload', plan: 'A daytime nudge that hides the pile and points you at one single thing.', when: 'Daytime, your first slump' },
];

function OnboardingFlow({ tone, onComplete }) {
  const [step, setStep] = useStateOb(0);
  const [role, setRole] = useStateOb(null);
  const [hard, setHard] = useStateOb(null);
  const [profile, setProfile] = useStateOb(null);
  const prof = PROFILES.find(p => p.id === profile);

  const next = () => setStep(s => s + 1);

  return (
    <div className="screen">
      <div className="pad-top" />
      <div style={{ flex: 'none', padding: '4px 18px 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {step > 0 ? <IconBtn name="back" onClick={() => setStep(s => s - 1)} label="Back" /> : <div style={{ width: 40 }} />}
        <div style={{ flex: 1 }}>
          <div className="steps">{[0, 1, 2, 3].map(i => <div key={i} className={'step-pill' + (i <= step ? ' on' : '')} />)}</div>
        </div>
        <span className="tiny" style={{ width: 40, textAlign: 'right' }}>{step + 1}/4</span>
      </div>

      <div className="scroll" style={{ padding: '14px 22px 18px' }}>
        {/* 0 — name/role */}
        {step === 0 && (
          <div>
            <Alpha size={56} mood="happy" style={{ marginBottom: 18 }} />
            <h1 className="h1">Nice to meet you.</h1>
            <p className="body" style={{ marginTop: 10 }}>What kind of work fills your days? (No wrong answer — this just helps me speak your language.)</p>
            <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
              {ROLES.map(r => (
                <button key={r} className={'opt' + (role === r ? ' sel' : '')} onClick={() => setRole(r)}>{r}</button>
              ))}
            </div>
          </div>
        )}
        {/* 1 — hardest time */}
        {step === 1 && (
          <div>
            <Alpha size={56} mood="calm" style={{ marginBottom: 18 }} />
            <h1 className="h1">When is starting hardest?</h1>
            <p className="body" style={{ marginTop: 10 }}>I’ll show up at the moment you need a hand — and stay quiet the rest of the time.</p>
            <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
              {HARD.map(h => (
                <button key={h.id} className={'opt' + (hard === h.id ? ' sel' : '')} onClick={() => setHard(h.id)}>
                  <span className="opt-emoji">{h.emoji}</span>{h.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* 2 — profile */}
        {step === 2 && (
          <div>
            <Alpha size={56} mood="thinking" style={{ marginBottom: 18 }} />
            <h1 className="h1">What pulls you off the most?</h1>
            <p className="body" style={{ marginTop: 10 }}>Be honest — I’m the only one who sees this.</p>
            <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
              {PROFILES.map(p => (
                <button key={p.id} className={'opt' + (profile === p.id ? ' sel' : '')} onClick={() => setProfile(p.id)}
                  style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: 18 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="opt-emoji">{p.emoji}</span>
                    <span style={{ fontWeight: 700 }}>{p.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* 3 — result */}
        {step === 3 && prof && (
          <div style={{ textAlign: 'center' }}>
            <Alpha size={80} mood="happy" ring style={{ margin: '6px auto 20px' }} />
            <p className="kicker" style={{ color: 'var(--accent)' }}>Here’s how I’ll show up</p>
            <h1 className="h1" style={{ marginTop: 10 }}>{prof.name}</h1>
            <p className="lead text-wrap-pretty" style={{ marginTop: 14, color: 'var(--ink-2)' }}>{prof.plan}</p>
            <div className="card" style={{ marginTop: 22, padding: 16, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
              <Icon name="clock" size={20} color="var(--glow)" />
              <div>
                <div className="tiny">I’ll gently check in</div>
                <div style={{ fontSize: 15.5, color: 'var(--ink)', fontWeight: 700 }}>{prof.when}</div>
              </div>
            </div>
            <p className="tiny text-wrap-pretty" style={{ marginTop: 14 }}>You can change this anytime in Settings. No alarms, ever.</p>
          </div>
        )}
      </div>

      <div style={{ flex: 'none', padding: '0 22px 16px' }}>
        {step < 3 ? (
          <Btn kind="primary" full lg icon="arrow"
            onClick={next}
            style={{ opacity: (step === 0 && !role) || (step === 1 && !hard) || (step === 2 && !profile) ? 0.5 : 1, pointerEvents: (step === 0 && !role) || (step === 1 && !hard) || (step === 2 && !profile) ? 'none' : 'auto' }}>
            Continue
          </Btn>
        ) : (
          <Btn kind="primary" full lg onClick={onComplete}>Take me in</Btn>
        )}
      </div>
      <div className="pad-bot" />
    </div>
  );
}

/* ---------------- Intention capture (NOT a task creator) ---------------- */
function IntentionCapture({ tone, onStart, onClose }) {
  const [text, setText] = useStateOb('');
  return (
    <Overlay onClose={onClose}>
      <div className="screen" style={{ justifyContent: 'space-between' }}>
        <div className="pad-top" />
        <div style={{ flex: 'none', padding: '0 18px', display: 'flex', justifyContent: 'flex-end' }}>
          <IconBtn name="close" onClick={onClose} label="Close" />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px' }}>
          <Alpha size={64} mood="calm" style={{ margin: '0 auto 20px' }} />
          <h1 className="h1 text-wrap-pretty" style={{ textAlign: 'center' }}>What’s on your mind?</h1>
          <p className="body text-wrap-pretty" style={{ textAlign: 'center', marginTop: 10 }}>
            Just say it plainly. Don’t organize it — that’s my job.
          </p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="e.g. I keep avoiding the budget review…"
            rows={3}
            style={{
              marginTop: 22, width: '100%', resize: 'none',
              background: 'var(--surface)', border: '1.5px solid var(--line-2)', borderRadius: 18,
              color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: 16.5, lineHeight: 1.5,
              padding: 16, outline: 'none',
            }} />
          <p className="tiny" style={{ textAlign: 'center', marginTop: 12 }}>No due dates. No labels. Just the thing.</p>
        </div>
        <div style={{ flex: 'none', padding: '0 24px 18px' }}>
          <Btn kind="primary" full lg icon="arrow"
            onClick={() => text.trim() && onStart(deriveTask(text))}
            style={{ opacity: text.trim() ? 1 : 0.5, pointerEvents: text.trim() ? 'auto' : 'none' }}>
            Shrink it to one tiny step
          </Btn>
        </div>
        <div className="pad-bot" />
      </div>
    </Overlay>
  );
}

Object.assign(window, { WelcomeScreen, OnboardingFlow, IntentionCapture, PROFILES });
