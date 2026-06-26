// night.jsx — Night mode / disconnection ritual (Gen Z RBP). Calm, dimming, no guilt.
const { useState: useStateN, useEffect: useEffectN } = React;

function NightScreen({ tone, onClose }) {
  const warm = tone === 'warm';
  const [stage, setStage] = useStateN(0); // 0 invite, 1 breathing, 2 goodnight

  useEffectN(() => {
    if (stage === 1) {
      const t = setTimeout(() => setStage(2), 8200);
      return () => clearTimeout(t);
    }
  }, [stage]);

  return (
    <div className="screen" style={{ background: 'radial-gradient(120% 80% at 50% 30%, #1b1a28 0%, #100f17 60%, #0a0910 100%)' }}>
      <div className="pad-top" />
      {stage !== 1 && (
        <div style={{ flex: 'none', padding: '0 18px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-quiet" onClick={onClose}>Close</button>
        </div>
      )}

      {/* STAGE 0 — invitation */}
      {stage === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center' }}>
          <Alpha size={84} mood="calm" style={{ marginBottom: 26 }} />
          <p className="kicker fade" style={{ color: '#9FB8E0' }}>11:14 pm</p>
          <h1 className="h1 rise text-wrap-pretty" style={{ marginTop: 12, fontSize: 30 }}>
            The scroll can wait.
          </h1>
          <p className="lead rise text-wrap-pretty" style={{ marginTop: 14, maxWidth: 280, color: 'var(--ink-2)' }}>
            {warm
              ? 'You don’t owe the day anything more. Let’s set it down softly, together.'
              : 'Nothing left to do tonight. Let’s wind down.'}
          </p>
          <div className="card rise" style={{ marginTop: 26, maxWidth: 300, padding: 16 }}>
            <p className="tiny text-wrap-pretty">
              The late scroll quietly costs most people ~332 hours of sleep a year. You don’t have to spend yours tonight.
            </p>
          </div>
          <div style={{ marginTop: 28, width: '100%', maxWidth: 320 }}>
            <Btn kind="primary" full lg icon="moon" onClick={() => setStage(1)}>Breathe, then set it down</Btn>
          </div>
        </div>
      )}

      {/* STAGE 1 — breathing */}
      {stage === 1 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 36 }}>
            <div className="breathe-halo" />
            <Alpha size={96} mood="calm" />
          </div>
          <h1 className="h1 breathe-word">Breathe in…</h1>
          <p className="body" style={{ marginTop: 10 }}>Follow the glow. Four slow rounds.</p>
        </div>
      )}

      {/* STAGE 2 — goodnight */}
      {stage === 2 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center' }}>
          <Alpha size={64} mood="happy" style={{ marginBottom: 24, opacity: 0.9 }} />
          <h1 className="h1 rise">Goodnight, Maya.</h1>
          <p className="lead rise text-wrap-pretty" style={{ marginTop: 12, maxWidth: 260, color: 'var(--ink-2)' }}>
            I’ll be here in the morning. Rest is the most productive thing you’ll do tonight.
          </p>
          <button className="btn btn-quiet rise" style={{ marginTop: 30 }} onClick={onClose}>Set the phone down</button>
        </div>
      )}
    </div>
  );
}

// breathing keyframes
if (!document.getElementById('breathe-kf')) {
  const s = document.createElement('style');
  s.id = 'breathe-kf';
  s.textContent = `
  .breathe-halo {
    position: absolute; inset: 0; border-radius: 50%;
    background: radial-gradient(circle, var(--glow-soft), transparent 70%);
    animation: breathe-scale 8s ease-in-out infinite;
  }
  @keyframes breathe-scale {
    0%, 100% { transform: scale(0.7); opacity: 0.5; }
    25%, 50% { transform: scale(1.25); opacity: 1; }
    75% { transform: scale(0.7); opacity: 0.5; }
  }
  .breathe-word::after { content: ''; }
  .breathe-word { animation: breathe-word 8s ease-in-out infinite; }
  @keyframes breathe-word {
    0%, 100% { opacity: 0.4; } 25%, 50% { opacity: 1; } 75% { opacity: 0.4; }
  }`;
  document.head.appendChild(s);
}

Object.assign(window, { NightScreen });
