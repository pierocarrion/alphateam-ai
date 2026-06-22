// insights.jsx — Me hub + Insights (no guilt) + Day mode (anti-multitask) + Settings
const { useState: useStateIn } = React;

/* ---------------- Me hub ---------------- */
function MeScreen({ tone, go, onReplayWelcome }) {
  return (
    <div className="screen">
      <div className="pad-top" />
      <TopBar kicker="Just for you" title="You & Mira" trailing={<Mira size={28} mood="happy" />} />
      <div className="scroll" style={{ padding: '6px 18px 16px' }}>
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* recovered highlight */}
          <div style={{
            borderRadius: 24, padding: 20, position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(160deg, var(--sage-soft), transparent)', border: '1px solid var(--line-2)',
          }}>
            <p className="kicker">This week, together</p>
            <div className="display" style={{ fontSize: 34, color: 'var(--ink)', marginTop: 8 }}>1h 48m</div>
            <p className="body" style={{ marginTop: 4 }}>recovered from circling — yours to spend however you like.</p>
          </div>

          <HubRow icon="spark" tint="var(--accent)" title="Insights" sub="Your progress, told kindly" onClick={() => go('insights')} />
          <HubRow icon="doc" tint="var(--glow)" title="One thing at a time" sub="Hide the pile, focus the day" onClick={() => go('day')} />
          <HubRow icon="moon" tint="#9FB8E0" title="Wind down" sub="A calm close to the night" onClick={() => go('night')} />
          <HubRow icon="bell" tint="var(--sage)" title="Settings" sub="Rhythm, apps, gentle nudges" onClick={() => go('settings')} />

          <button className="btn btn-quiet" style={{ marginTop: 2 }} onClick={onReplayWelcome}>Replay the welcome</button>
        </div>
      </div>
    </div>
  );
}

function HubRow({ icon, tint, title, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 16,
    }}>
      <div style={{ width: 42, height: 42, borderRadius: 13, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)' }}>
        <Icon name={icon} size={21} color={tint} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, color: 'var(--ink)', fontWeight: 700 }}>{title}</div>
        <div className="tiny" style={{ marginTop: 2 }}>{sub}</div>
      </div>
      <Icon name="arrow" size={18} color="var(--ink-3)" />
    </button>
  );
}

/* ---------------- Insights (no guilt, no streaks) ---------------- */
const WEEK = [
  { d: 'M', v: 22 }, { d: 'T', v: 36 }, { d: 'W', v: 14 },
  { d: 'T', v: 41 }, { d: 'F', v: 18 }, { d: 'S', v: 0, calm: true }, { d: 'S', v: 8 },
];
function InsightsScreen({ tone, onBack }) {
  const max = 45;
  return (
    <div className="screen">
      <div className="pad-top" />
      <TopBar title="Insights" onBack={onBack} kicker="Told kindly" />
      <div className="scroll" style={{ padding: '6px 18px 16px' }}>
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p className="lead text-wrap-pretty">Every bar is time you took back. Quiet days aren’t failures — they’re rest.</p>

          {/* recovered-time bars */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <p className="kicker">Time recovered</p>
              <span className="tiny">minutes / day</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130, marginTop: 18 }}>
              {WEEK.map((w, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{
                    width: '100%', borderRadius: 8,
                    height: `${Math.max(w.v / max * 100, w.calm ? 0 : 4)}%`,
                    background: w.calm ? 'transparent' : 'linear-gradient(to top, var(--accent), var(--glow))',
                    border: w.calm ? '1.5px dashed var(--line-2)' : 'none',
                    minHeight: w.calm ? 22 : 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {w.calm && <span className="tiny" style={{ fontSize: 10 }}>rest</span>}
                  </div>
                  <span className="tiny">{w.d}</span>
                </div>
              ))}
            </div>
          </div>

          {/* gentle momentum — accumulating lights, never broken */}
          <div className="card" style={{ padding: 20 }}>
            <p className="kicker">Gentle starts</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 14 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 30%, #f4d6a8, var(--accent))',
                  boxShadow: '0 0 12px -2px var(--accent-soft)', opacity: 0.92,
                }} />
              ))}
            </div>
            <p className="body" style={{ marginTop: 14 }}>12 times you crossed the hardest part — the start. That’s the whole game.</p>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '0 4px' }}>
            <Mira size={30} mood="happy" />
            <p className="tiny text-wrap-pretty" style={{ flex: 1 }}>No streaks to break here. You can always begin again — that’s the point.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Day mode (anti-multitask, Millennial) ---------------- */
function DayModeScreen({ tone, onBack, onStart }) {
  const [peek, setPeek] = useStateIn(false);
  return (
    <div className="screen" style={{ background: 'radial-gradient(120% 70% at 50% -5%, #2a2333 0%, var(--bg) 55%, #110f16 100%)' }}>
      <div className="pad-top" />
      <TopBar title="Just one thing" onBack={onBack} kicker="Daytime focus" />
      <div className="scroll" style={{ padding: '8px 20px 16px', display: 'flex', flexDirection: 'column' }}>
        <p className="lead text-wrap-pretty rise" style={{ marginBottom: 18 }}>
          You’ve got a few things today. I’ve hidden the pile so it can’t pull at you. Here’s the only one that matters right now:
        </p>

        <div className="rise" style={{
          borderRadius: 28, padding: 26, textAlign: 'center',
          background: 'linear-gradient(165deg, var(--surface-2), var(--surface))',
          border: '1px solid var(--line-2)', boxShadow: '0 24px 50px -24px rgba(0,0,0,0.6)',
        }}>
          <Mira size={56} mood="calm" style={{ margin: '0 auto 18px' }} />
          <p className="kicker" style={{ color: 'var(--accent)' }}>The one thing</p>
          <h1 className="h1 text-wrap-pretty" style={{ marginTop: 10, fontSize: 26 }}>Draft the Q3 launch deck</h1>
          <p className="body" style={{ marginTop: 10 }}>First step: open it and type one messy sentence.</p>
          <div style={{ marginTop: 20 }}>
            <Btn kind="primary" full lg icon="play" onClick={onStart}>Start this one</Btn>
          </div>
        </div>

        {/* the pile, tucked away */}
        <button className="btn btn-quiet" style={{ marginTop: 18 }} onClick={() => setPeek(p => !p)}>
          {peek ? 'Tuck them back away' : '3 other things are safe with me'}
        </button>
        {peek && (
          <div className="fade" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {['Reply to Priya about timeline', 'Review Sofía’s visuals', 'Update the project doc'].map((t, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
                background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, opacity: 0.7,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-3)' }} />
                <span style={{ fontSize: 14.5, color: 'var(--ink-2)' }}>{t}</span>
              </div>
            ))}
            <p className="tiny text-wrap-pretty" style={{ textAlign: 'center', marginTop: 6 }}>They’ll wait quietly. No badges, no counters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Settings ---------------- */
function SettingsScreen({ tone, onBack }) {
  const [nudges, setNudges] = useStateIn(true);
  const [pair, setPair] = useStateIn(true);
  const [quiet, setQuiet] = useStateIn(false);
  return (
    <div className="screen">
      <div className="pad-top" />
      <TopBar title="Settings" onBack={onBack} />
      <div className="scroll" style={{ padding: '6px 18px 20px' }}>
        <SettingsGroup label="Your rhythm">
          <SettingRow title="Intervention" detail="Evenings, ~10:30pm" chevron />
          <SettingRow title="Profile" detail="Bedtime revenge scroll" chevron last />
        </SettingsGroup>

        <SettingsGroup label="Connected apps (knowledge base)">
          <SettingRow title="Acme Deck Hub" detail="Connected" tint="var(--sage)" chevron />
          <SettingRow title="Acme Docs" detail="Connected" tint="var(--sage)" chevron />
          <SettingRow title="Add an app" detail="" plus last />
        </SettingsGroup>

        <SettingsGroup label="Nudges" note="Gentle by design. Mira will never alarm, shame, or show what you missed.">
          <SettingRowToggle title="Gentle check-ins" on={nudges} onToggle={() => setNudges(v => !v)} />
          <SettingRowToggle title="Pair-start invites" on={pair} onToggle={() => setPair(v => !v)} />
          <SettingRowToggle title="Quiet mode (pause all)" on={quiet} onToggle={() => setQuiet(v => !v)} last />
        </SettingsGroup>

        <SettingsGroup label="Voice">
          <SettingRow title="Tone" detail={tone === 'warm' ? 'Warm' : 'Balanced'} chevron last />
        </SettingsGroup>

        <p className="tiny text-wrap-pretty" style={{ textAlign: 'center', marginTop: 20, padding: '0 20px' }}>
          AlphaLead never shows overdue items, broken streaks, or public scores. Promise.
        </p>
      </div>
    </div>
  );
}

function SettingsGroup({ label, note, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="kicker" style={{ padding: '0 6px 8px' }}>{label}</div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, overflow: 'hidden' }}>{children}</div>
      {note && <p className="tiny text-wrap-pretty" style={{ padding: '8px 8px 0' }}>{note}</p>}
    </div>
  );
}
function SettingRow({ title, detail, tint, chevron, plus, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px', borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <span style={{ flex: 1, fontSize: 15.5, color: 'var(--ink)' }}>{title}</span>
      {detail && <span className="tiny" style={{ color: tint || 'var(--ink-3)' }}>{detail}</span>}
      {chevron && <Icon name="arrow" size={16} color="var(--ink-3)" />}
      {plus && <Icon name="plus" size={18} color="var(--accent)" />}
    </div>
  );
}
function SettingRowToggle({ title, on, onToggle, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <span style={{ flex: 1, fontSize: 15.5, color: 'var(--ink)' }}>{title}</span>
      <button onClick={onToggle} aria-label={title} style={{
        width: 48, height: 28, borderRadius: 999, border: 0, cursor: 'pointer', padding: 3,
        background: on ? 'var(--accent)' : 'var(--surface-3)', transition: 'background var(--t-fast) var(--ease)',
        display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start',
      }}>
        <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </button>
    </div>
  );
}

Object.assign(window, { MeScreen, InsightsScreen, DayModeScreen, SettingsScreen });
