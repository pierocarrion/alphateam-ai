// chat.jsx — Team chat (mobile), interactive: typing + hardcoded replies + live AI interception
const { useState: useStateC, useEffect: useEffectC, useRef: useRefC } = React;

function ChatScreen({ tone, convo, onShowTask }) {
  const warm = tone === 'warm';
  const { messages, typing, detected, send, resolveDetected } = convo;
  const scrollRef = useRefC(null);
  const [draft, setDraft] = useStateC('');

  useEffectC(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, typing, detected]);

  const submit = () => { if (draft.trim()) { send(draft); setDraft(''); } };

  return (
    <div className="screen">
      <div className="pad-top" />
      <div style={{
        flex: 'none', display: 'flex', alignItems: 'center', gap: 11,
        padding: '4px 18px 12px', borderBottom: '1px solid var(--line)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="display" style={{ fontSize: 18, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>#</span> q3-launch
          </div>
          <div className="tiny" style={{ marginTop: 1 }}>Daniel, Sofía, Theo, Priya · you</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Alpha size={26} mood="calm" />
          <span className="tiny" style={{ color: 'var(--ink-3)' }}>{warm ? 'Alpha’s here' : 'Alpha'}</span>
        </div>
      </div>

      <div className="scroll" ref={scrollRef} style={{ padding: '16px 16px 8px' }}>
        <DayDivider label="Today" />
        {messages.map(m => (
          <React.Fragment key={m.id}>
            <Msg who={m.who} time={m.time} highlight={detected && detected.anchorId === m.id && detected.status === 'open'}>{m.text}</Msg>
            {detected && detected.anchorId === m.id && (
              <div style={{ margin: '2px 0 10px 50px' }}>
                {detected.status === 'open' ? (
                  <div className="rise"><InterceptCard warm={warm} task={detected.task}
                    onShow={() => onShowTask(detected.task)}
                    onDismiss={() => resolveDetected('dismissed')} /></div>
                ) : detected.status === 'dismissed' ? (
                  <span className="chip"><Icon name="close" size={14} color="var(--ink-3)" /> Set aside — no worries</span>
                ) : (
                  <span className="chip" style={{ background: 'var(--sage-soft)', borderColor: 'transparent', color: 'var(--sage)' }}>
                    <Icon name="check" size={15} color="var(--sage)" /> Saved as a tiny first step
                  </span>
                )}
              </div>
            )}
          </React.Fragment>
        ))}
        {typing && <TypingRow who={typing} />}
        <div style={{ height: 6 }} />
      </div>

      {/* interactive composer */}
      <div style={{ flex: 'none', padding: '8px 14px 12px', background: 'linear-gradient(to top, var(--bg-2), transparent)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 999, padding: '5px 5px 5px 16px',
        }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="Message #q3-launch…"
            style={{
              flex: 1, background: 'none', border: 0, outline: 'none',
              color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: 15.5, padding: '8px 0',
            }} />
          <button onClick={submit} aria-label="Send" style={{
            width: 38, height: 38, borderRadius: 999, border: 0, cursor: 'pointer', flex: 'none',
            background: draft.trim() ? 'var(--accent)' : 'var(--surface-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background var(--t-fast) var(--ease)',
          }}>
            <Icon name="send" size={18} color={draft.trim() ? 'var(--accent-ink)' : 'var(--ink-3)'} />
          </button>
        </div>
        <div className="tiny" style={{ textAlign: 'center', marginTop: 7, color: 'var(--ink-3)' }}>
          Try “I need to write the launch report” — Alpha will quietly notice.
        </div>
      </div>
    </div>
  );
}

function DayDivider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 14px' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      <span className="tiny" style={{ color: 'var(--ink-3)' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
    </div>
  );
}

function Msg({ who, time, children, highlight }) {
  const p = PEOPLE[who];
  const you = p.you;
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexDirection: you ? 'row-reverse' : 'row' }}>
      {!you && <Avatar who={who} size={38} style={{ marginTop: 2 }} />}
      <div style={{ maxWidth: '78%' }}>
        {!you && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{p.name}</span>
            <span className="tiny">{time}</span>
          </div>
        )}
        <div style={{
          padding: '11px 15px', borderRadius: you ? '18px 18px 6px 18px' : '6px 18px 18px 18px',
          background: you ? 'var(--accent-soft)' : 'var(--surface)',
          border: '1px solid', borderColor: highlight ? 'var(--glow)' : (you ? 'transparent' : 'var(--line)'),
          color: 'var(--ink)', fontSize: 15.5, lineHeight: 1.45,
          boxShadow: highlight ? '0 0 0 4px var(--glow-soft)' : 'none',
          transition: 'box-shadow var(--t) var(--ease), border-color var(--t) var(--ease)',
        }}>{children}</div>
      </div>
    </div>
  );
}

function TypingRow({ who }) {
  return (
    <div className="fade" style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
      <Avatar who={who} size={38} />
      <div style={{ display: 'flex', gap: 4, padding: '14px 16px', background: 'var(--surface)', borderRadius: '6px 18px 18px 18px', border: '1px solid var(--line)' }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 7, height: 7, borderRadius: '50%', background: 'var(--ink-3)',
            animation: `typing-dot 1.2s ease-in-out ${i * 0.18}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

function InterceptCard({ warm, task, onShow, onDismiss }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, var(--surface-2), var(--surface))',
      border: '1px solid var(--glow)', borderRadius: '6px 18px 18px 18px',
      padding: 14, maxWidth: 290,
      boxShadow: '0 12px 30px -12px var(--glow-soft)',
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Alpha size={28} mood="happy" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--glow)', marginBottom: 3 }}>Alpha · just for you</div>
          <div style={{ fontSize: 14.5, lineHeight: 1.45, color: 'var(--ink)' }}>
            {task.selfMade
              ? (warm ? 'Sounds like a real task hiding in there. Want me to shrink it into a 2‑minute start?' : 'That sounds like a task. Turn it into a 2‑minute first step?')
              : (warm ? 'I think Daniel just handed you something. Want me to shrink it into a 2‑minute start? No rush at all.' : 'Looks like a task for you here. Want me to turn it into a 2‑minute first step?')}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={onShow} style={{ fontSize: 14.5, padding: '11px 18px', flex: 1 }}>Show me</button>
        <button className="btn btn-quiet" onClick={onDismiss} style={{ fontSize: 14 }}>Not now</button>
      </div>
    </div>
  );
}

if (!document.getElementById('typing-kf')) {
  const s = document.createElement('style');
  s.id = 'typing-kf';
  s.textContent = '@keyframes typing-dot { 0%,60%,100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-4px); opacity: 1; } }';
  document.head.appendChild(s);
}

Object.assign(window, { ChatScreen, Msg, DayDivider, TypingRow, InterceptCard });
