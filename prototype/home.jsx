// home.jsx — Home "Right now" (anti-dashboard) + Crew (team space)
const { useState: useStateH } = React;

/* ---------------- Home: one immediate micro-action ---------------- */
function HomeScreen({ tone, onStart, onChat, onCapture, go }) {
  const warm = tone === 'warm';
  return (
    <div className="screen">
      <div className="pad-top" />
      <div className="scroll" style={{ padding: '8px 20px 16px' }}>
        {/* greeting */}
        <div className="rise" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, marginTop: 6 }}>
          <Alpha size={44} mood="happy" />
          <div>
            <div className="tiny" style={{ whiteSpace: 'nowrap' }}>Good evening</div>
            <div className="display" style={{ fontSize: 22, color: 'var(--ink)' }}>Maya</div>
          </div>
        </div>

        {/* THE one thing — hero */}
        <div className="rise" style={{
          borderRadius: 30, padding: 24,
          background: 'linear-gradient(165deg, var(--surface-2), var(--surface))',
          border: '1px solid var(--line-2)',
          boxShadow: '0 24px 50px -24px rgba(0,0,0,0.6)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -40, right: -30, width: 160, height: 160, borderRadius: '50%',
            background: 'radial-gradient(circle, var(--accent-soft), transparent 70%)', pointerEvents: 'none',
          }} />
          <p className="kicker" style={{ color: 'var(--accent)' }}>Right now</p>
          <h1 className="h1 text-wrap-pretty" style={{ marginTop: 12, fontSize: 27 }}>
            Open the deck. Type one messy sentence.
          </h1>
          <p className="body text-wrap-pretty" style={{ marginTop: 12 }}>
            From Daniel’s note in #q3-launch. Alpha already shrank it down for you.
          </p>
          <div style={{ marginTop: 20 }}>
            <Btn kind="primary" full lg icon="play" onClick={onStart}>Start — 2 minutes</Btn>
          </div>
        </div>

        {/* invisible organization reassurance */}
        <div className="rise" style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 18, padding: '0 4px' }}>
          <Alpha size={22} mood="calm" />
          <p className="tiny text-wrap-pretty" style={{ flex: 1 }}>
            {warm
              ? 'I’m holding 2 other things for you. They can wait — no rush, no pile.'
              : '2 other things are filed away. They’ll keep.'}
          </p>
        </div>

        {/* gentle secondary entries — not tasks, just doors */}
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
          <DoorRow icon="plus" tint="var(--accent)" title="Something on your mind?" sub="Say it plainly — Alpha shrinks it for you" onClick={onCapture} />
          <DoorRow icon="chat" tint="var(--glow)" title="Team chat" sub="Alpha’s listening for what’s yours" onClick={onChat} />
          <DoorRow icon="moon" tint="#9FB8E0" title="Wind down" sub="A calm close to the day, when you’re ready" onClick={() => go('night')} />
        </div>
      </div>
    </div>
  );
}

function DoorRow({ icon, tint, title, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 16,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 13, flex: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface-2)',
      }}>
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

/* ---------------- Crew: gentle team space ---------------- */
function CrewScreen({ tone, onPairStart, go }) {
  const warm = tone === 'warm';
  const [paired, setPaired] = useStateH(false);

  return (
    <div className="screen">
      <div className="pad-top" />
      <TopBar kicker="Together" title="Crew" trailing={<Alpha size={28} mood="calm" />} />
      <div className="scroll" style={{ padding: '6px 18px 16px' }}>
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* collective mood — gentle weather, never per-person scores */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <p className="kicker">How the crew feels</p>
              <span className="tiny">this week</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14 }}>
              <Weather level={0.62} />
              <div style={{ flex: 1 }}>
                <div className="h2" style={{ fontSize: 20 }}>A little tense</div>
                <p className="tiny text-wrap-pretty" style={{ marginTop: 4 }}>
                  The launch is bunching everyone up. That’s the system, not any one person.
                </p>
              </div>
            </div>
          </div>

          {/* LOAD GUARDIAN — ★ */}
          <div style={{
            borderRadius: 24, padding: 18,
            background: 'linear-gradient(180deg, var(--glow-soft), transparent)',
            border: '1px solid var(--glow)',
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ position: 'relative' }}>
                <Avatar who="theo" size={42} />
                <div style={{
                  position: 'absolute', bottom: -3, right: -3, width: 20, height: 20, borderRadius: 999,
                  background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid var(--glow)',
                }}>
                  <Icon name="shield" size={12} color="var(--glow)" />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <p className="kicker" style={{ color: 'var(--glow)' }}>Alpha noticed — quietly</p>
                <div style={{ fontSize: 16, color: 'var(--ink)', fontWeight: 700, marginTop: 5, lineHeight: 1.35 }}>
                  Theo’s been catching most of the launch work.
                </div>
                <p className="tiny text-wrap-pretty" style={{ marginTop: 6 }}>
                  He’s the one who procrastinates least — so the load drifts to him. Want to even it out?
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn btn-primary" style={{ flex: 1, fontSize: 14.5, padding: '12px' }}>Share the load</button>
              <button className="btn btn-ghost" style={{ flex: 1, fontSize: 14.5, padding: '12px' }}>Not now</button>
            </div>
          </div>

          {/* short milestone — 2-3 days, framed as shared, no countdown */}
          <div className="card" style={{ padding: 18 }}>
            <p className="kicker">Next tiny milestone</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 13, flex: 'none',
                background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="spark" size={20} color="var(--accent)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, color: 'var(--ink)', fontWeight: 700 }}>A rough deck skeleton</div>
                <div className="tiny" style={{ marginTop: 2 }}>In about 2 days · small and shared</div>
              </div>
            </div>
            {/* contributors, no scores */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
              <div style={{ display: 'flex' }}>
                {['maya', 'sofia', 'theo'].map((w, i) => (
                  <Avatar key={w} who={w} size={26} style={{ marginLeft: i ? -8 : 0, boxShadow: '0 0 0 2px var(--surface)' }} />
                ))}
              </div>
              <span className="tiny">3 of you are easing into it</span>
            </div>
          </div>

          {/* PAIR-START — ★ break the starting line together */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar who="sofia" size={38} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15.5, color: 'var(--ink)', fontWeight: 700 }}>
                  {paired ? 'Sofía is starting too — go!' : 'Sofía is free to start with you'}
                </div>
                <div className="tiny" style={{ marginTop: 2 }}>
                  {paired ? 'You’re not doing it alone.' : 'Begin the same 2 minutes side by side.'}
                </div>
              </div>
              {paired && <Alpha size={26} mood="cheer" />}
            </div>
            <button
              className={'btn ' + (paired ? 'btn-primary' : 'btn-ghost')}
              style={{ width: '100%', marginTop: 14 }}
              onClick={() => { if (!paired) { setPaired(true); setTimeout(onPairStart, 700); } }}>
              {paired ? 'Starting together…' : 'Start together'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* a gentle 'weather' gauge — soft arc, no numbers */
function Weather({ level = 0.5 }) {
  const hue = level < 0.4 ? 'var(--sage)' : level < 0.7 ? 'var(--accent)' : '#E6A0B0';
  return (
    <div style={{ position: 'relative', width: 56, height: 56, flex: 'none' }}>
      <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="28" cy="28" r="24" fill="none" stroke="var(--line-2)" strokeWidth="5" />
        <circle cx="28" cy="28" r="24" fill="none" stroke={hue} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 24} strokeDashoffset={2 * Math.PI * 24 * (1 - level)} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: hue, opacity: 0.85 }} />
      </div>
    </div>
  );
}

Object.assign(window, { HomeScreen, CrewScreen, DoorRow, Weather });
