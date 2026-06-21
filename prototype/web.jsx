// web.jsx — Desktop/web surface: sidebar + chat + Mira rail, and coordinator Backstage
const { useState: useStateWeb, useEffect: useEffectWeb, useRef: useRefWeb } = React;

const BACKSTAGE = [
  { title: 'Draft the Q3 launch deck', who: 'maya',  category: 'Slides', app: 'Acme Deck Hub', load: 'med',  stress: 2, owner: 'Maya',  status: 'In motion' },
  { title: 'Review marketing visuals', who: 'sofia', category: 'Slides', app: 'Acme Deck Hub', load: 'low',  stress: 1, owner: 'Sofía', status: 'In motion' },
  { title: 'Write the launch report',  who: 'maya',  category: 'Docs',   app: 'Acme Docs',     load: 'low',  stress: 1, owner: 'Maya',  status: 'New' },
  { title: 'Update the project doc',   who: 'priya', category: 'Docs',   app: 'Acme Docs',     load: 'low',  stress: 1, owner: 'Priya', status: 'New' },
  { title: 'Build the pricing page',   who: 'theo',  category: 'Build',  app: 'Acme Tracker',  load: 'high', stress: 3, owner: 'Theo',  status: 'Heavy' },
  { title: 'QA the launch checklist',  who: 'theo',  category: 'Build',  app: 'Acme Tracker',  load: 'med',  stress: 2, owner: 'Theo',  status: 'Heavy' },
  { title: 'Prep partner emails',      who: 'priya', category: 'Comms',  app: 'Mail',          load: 'low',  stress: 1, owner: 'Priya', status: 'New' },
];
const LOAD_COLOR = { low: 'var(--sage)', med: 'var(--accent)', high: 'var(--glow)' };

function WebApp({ tone, convo, onShowTask }) {
  const [view, setView] = useStateWeb('chat'); // chat | backstage
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font-body)' }}>
      <WebSidebar view={view} setView={setView} />
      {view === 'chat'
        ? <><WebChat tone={tone} convo={convo} onShowTask={onShowTask} /><WebRail tone={tone} convo={convo} onShowTask={onShowTask} /></>
        : <WebBackstage tone={tone} />}
    </div>
  );
}

/* ---------------- Sidebar ---------------- */
function WebSidebar({ view, setView }) {
  const channels = ['q3-launch', 'general', 'design'];
  const dms = ['daniel', 'sofia', 'theo', 'priya'];
  return (
    <div style={{ width: 244, flex: 'none', background: 'var(--bg-2)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '18px 18px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)' }}>
        <Mira size={30} mood="calm" />
        <div>
          <div className="display" style={{ fontSize: 16, color: 'var(--ink)' }}>AlphaTeam</div>
          <div className="tiny" style={{ fontSize: 11 }}>Acme · workspace</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 10px' }}>
        <SideLabel>Channels</SideLabel>
        {channels.map(c => (
          <SideRow key={c} active={view === 'chat' && c === 'q3-launch'} onClick={() => setView('chat')}>
            <span style={{ color: 'var(--ink-3)' }}>#</span> {c}
          </SideRow>
        ))}
        <div style={{ height: 14 }} />
        <SideLabel>Direct messages</SideLabel>
        {dms.map(d => (
          <SideRow key={d} onClick={() => setView('chat')}>
            <Avatar who={d} size={20} /> {PEOPLE[d].name}
          </SideRow>
        ))}
        <div style={{ height: 14 }} />
        <SideLabel>Coordinator</SideLabel>
        <SideRow active={view === 'backstage'} onClick={() => setView('backstage')}>
          <Icon name="shield" size={16} color={view === 'backstage' ? 'var(--accent)' : 'var(--glow)'} /> Backstage
        </SideRow>
      </div>
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar who="maya" size={30} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Maya</div>
          <div className="tiny" style={{ fontSize: 11 }}>Coordinator</div>
        </div>
        <Icon name="bell" size={17} color="var(--ink-3)" />
      </div>
    </div>
  );
}
function SideLabel({ children }) {
  return <div className="kicker" style={{ fontSize: 10.5, padding: '0 10px 8px' }}>{children}</div>;
}
function SideRow({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer', border: 0, marginBottom: 2,
      display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 10,
      background: active ? 'var(--accent-soft)' : 'transparent',
      color: active ? 'var(--ink)' : 'var(--ink-2)', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14.5,
    }}>{children}</button>
  );
}

/* ---------------- Web chat ---------------- */
function WebChat({ tone, convo, onShowTask }) {
  const warm = tone === 'warm';
  const { messages, typing, detected, send, resolveDetected } = convo;
  const scrollRef = useRefWeb(null);
  const [draft, setDraft] = useStateWeb('');
  useEffectWeb(() => { if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages.length, typing, detected]);
  const submit = () => { if (draft.trim()) { send(draft); setDraft(''); } };

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'radial-gradient(120% 60% at 50% -10%, #221c2c, var(--bg) 60%)' }}>
      <div style={{ flex: 'none', padding: '16px 26px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div className="display" style={{ fontSize: 18, color: 'var(--ink)' }}><span style={{ color: 'var(--ink-3)' }}>#</span> q3-launch</div>
          <div className="tiny">Daniel, Sofía, Theo, Priya, you · Mira is listening quietly</div>
        </div>
        <Mira size={28} mood="calm" />
      </div>

      <div ref={scrollRef} className="scroll" style={{ flex: 1, padding: '20px 26px' }}>
        {messages.map(m => (
          <React.Fragment key={m.id}>
            <WebMsg m={m} highlight={detected && detected.anchorId === m.id && detected.status === 'open'} />
            {detected && detected.anchorId === m.id && (
              <div style={{ margin: '2px 0 14px 50px', maxWidth: 440 }}>
                {detected.status === 'open' ? (
                  <WebInterceptCard warm={warm} task={detected.task} onShow={() => onShowTask(detected.task)} onDismiss={() => resolveDetected('dismissed')} />
                ) : detected.status === 'dismissed' ? (
                  <span className="chip"><Icon name="close" size={14} color="var(--ink-3)" /> Set aside</span>
                ) : (
                  <span className="chip" style={{ background: 'var(--sage-soft)', borderColor: 'transparent', color: 'var(--sage)' }}><Icon name="check" size={14} color="var(--sage)" /> Saved as a tiny first step</span>
                )}
              </div>
            )}
          </React.Fragment>
        ))}
        {typing && (
          <div className="fade" style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6 }}>
            <Avatar who={typing} size={36} />
            <div style={{ display: 'flex', gap: 4, padding: '12px 15px', background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--line)' }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ink-3)', animation: `typing-dot 1.2s ease-in-out ${i * 0.18}s infinite` }} />)}
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 'none', padding: '0 26px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 16, padding: '8px 8px 8px 18px' }}>
          <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="Message #q3-launch —  try “I need to write the launch report”"
            style={{ flex: 1, background: 'none', border: 0, outline: 'none', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: 15, padding: '10px 0' }} />
          <button onClick={submit} className="btn btn-primary" style={{ padding: '11px 20px', fontSize: 14.5 }}>Send</button>
        </div>
      </div>
    </div>
  );
}

function WebMsg({ m, highlight }) {
  const p = PEOPLE[m.who];
  return (
    <div style={{ display: 'flex', gap: 12, padding: '7px 8px', marginBottom: 2, borderRadius: 12, background: highlight ? 'var(--glow-soft)' : 'transparent', transition: 'background var(--t) var(--ease)' }}>
      <Avatar who={m.who} size={38} style={{ marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{p.name}{p.you ? ' (you)' : ''}</span>
          <span className="tiny">{m.time}</span>
        </div>
        <div style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 2 }}>{m.text}</div>
      </div>
    </div>
  );
}

function WebInterceptCard({ warm, task, onShow, onDismiss }) {
  return (
    <div style={{ background: 'linear-gradient(180deg, var(--surface-2), var(--surface))', border: '1px solid var(--glow)', borderRadius: 16, padding: 16, boxShadow: '0 14px 36px -14px var(--glow-soft)' }}>
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <Mira size={30} mood="happy" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--glow)', marginBottom: 3 }}>Mira · just for you</div>
          <div style={{ fontSize: 14.5, lineHeight: 1.45, color: 'var(--ink)' }}>
            {task.selfMade ? 'Sounds like a task hiding in there. Want me to shrink it into a 2‑minute start?' : 'Looks like Daniel handed you something. Want me to turn it into a tiny first step?'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" onClick={onShow} style={{ fontSize: 14, padding: '10px 18px' }}>Show me</button>
            <button className="btn btn-quiet" onClick={onDismiss} style={{ fontSize: 14 }}>Not now</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Right rail: Mira's quiet view ---------------- */
function WebRail({ tone, convo, onShowTask }) {
  const det = convo.detected;
  const yours = [];
  if (det && det.status === 'open') yours.push(det.task);
  if (!yours.find(t => t.title === DECK_TASK.title)) yours.unshift(DECK_TASK);

  return (
    <div style={{ width: 312, flex: 'none', borderLeft: '1px solid var(--line)', background: 'var(--bg-2)', overflowY: 'auto', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Mira size={30} mood="happy" />
        <div>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>Mira’s quiet view</div>
          <div className="tiny">Only you can see this</div>
        </div>
      </div>

      <SideLabel>Your tiny steps</SideLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {yours.map((t, i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 14.5, color: 'var(--ink)', fontWeight: 700, lineHeight: 1.3 }}>{t.title}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <span className="chip" style={{ fontSize: 11.5, padding: '5px 9px' }}>{t.category}</span>
              <span className="chip" style={{ fontSize: 11.5, padding: '5px 9px' }}>{t.app}</span>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 12, padding: '10px', fontSize: 13.5 }} onClick={() => onShowTask(t)}>Start 2‑min step</button>
          </div>
        ))}
      </div>

      <SideLabel>Team weather</SideLabel>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Weather level={0.62} />
        <div>
          <div style={{ fontSize: 14.5, color: 'var(--ink)', fontWeight: 700 }}>A little tense</div>
          <div className="tiny">Launch is bunching everyone up</div>
        </div>
      </div>

      <div style={{ background: 'linear-gradient(180deg, var(--glow-soft), transparent)', border: '1px solid var(--glow)', borderRadius: 16, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Icon name="shield" size={16} color="var(--glow)" />
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--glow)' }}>Load guardian</span>
        </div>
        <div className="tiny text-wrap-pretty" style={{ color: 'var(--ink-2)' }}>Theo is carrying the most. Suggest a pair‑start or hand one item over?</div>
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 10, padding: '9px', fontSize: 13 }}>Even it out</button>
      </div>
    </div>
  );
}

/* ---------------- Coordinator Backstage ---------------- */
function WebBackstage({ tone }) {
  const cats = ['Slides', 'Docs', 'Build', 'Comms'];
  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'radial-gradient(110% 50% at 50% -10%, #221c2c, var(--bg) 60%)' }}>
      <div style={{ padding: '24px 30px 18px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="shield" size={22} color="var(--accent)" />
          <h1 className="display" style={{ fontSize: 24, color: 'var(--ink)', margin: 0 }}>Backstage</h1>
        </div>
        <p className="body text-wrap-pretty" style={{ marginTop: 8, maxWidth: 620 }}>
          Mira graded and filed every task she overheard — automatically, so no one has to. This routes work and feeds the stress monitor. It is <b style={{ color: 'var(--ink)' }}>never</b> a public scoreboard.
        </p>
      </div>

      {/* gentle guardian banner */}
      <div style={{ margin: '18px 30px 0', background: 'linear-gradient(180deg, var(--glow-soft), transparent)', border: '1px solid var(--glow)', borderRadius: 18, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar who="theo" size={38} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, color: 'var(--ink)', fontWeight: 700 }}>Theo is holding 2 heavy items</div>
          <div className="tiny">He procrastinates least, so work drifts to him. Consider redistributing before it costs the team.</div>
        </div>
        <button className="btn btn-primary" style={{ padding: '10px 18px', fontSize: 14 }}>Suggest redistribute</button>
      </div>

      {/* categories */}
      <div style={{ padding: '20px 30px 30px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {cats.map(cat => {
          const rows = BACKSTAGE.filter(b => b.category === cat);
          if (!rows.length) return null;
          return (
            <div key={cat}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span className="kicker" style={{ fontSize: 12 }}>{cat}</span>
                <span className="tiny">· {rows.length} · {rows[0].app}</span>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr 0.8fr 1fr 0.9fr', gap: 12, padding: '10px 18px', borderBottom: '1px solid var(--line)' }}>
                  {['Task', 'Owner', 'Load', 'Stress impact', 'Status'].map(h => <span key={h} className="kicker" style={{ fontSize: 10.5 }}>{h}</span>)}
                </div>
                {rows.map((r, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr 0.8fr 1fr 0.9fr', gap: 12, padding: '14px 18px', alignItems: 'center', borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <span style={{ fontSize: 14.5, color: 'var(--ink)', fontWeight: 600 }}>{r.title}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar who={r.who} size={22} /><span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{r.owner}</span></span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: LOAD_COLOR[r.load] }} /><span className="tiny" style={{ textTransform: 'capitalize' }}>{r.load}</span></span>
                    <span style={{ display: 'flex', gap: 3 }}>{[1, 2, 3].map(n => <span key={n} style={{ width: 14, height: 5, borderRadius: 3, background: n <= r.stress ? 'var(--accent)' : 'var(--line-2)' }} />)}</span>
                    <span><span style={{ fontSize: 12, fontWeight: 700, color: r.status === 'Heavy' ? 'var(--glow)' : r.status === 'In motion' ? 'var(--sage)' : 'var(--ink-3)' }}>{r.status}</span></span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { WebApp });
