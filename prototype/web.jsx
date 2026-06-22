// web.jsx — Desktop/web surface: sidebar + chat + Mira rail, coordinator Backstage,
//            and the personal hub (You & Mira, Insights, Day mode, Night, Settings) + Crew.
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

function WebApp({ tone, convo, onShowTask, onStart, onReplayWelcome }) {
  const [view, setView] = useStateWeb('chat'); // chat | backstage | me | insights | day | night | settings | crew
  const go = setView;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font-body)' }}>
      <WebSidebar view={view} setView={setView} />
      {view === 'chat' ? (
        <><WebChat tone={tone} convo={convo} onShowTask={onShowTask} /><WebRail tone={tone} convo={convo} onShowTask={onShowTask} /></>
      ) : view === 'backstage' ? (
        <WebBackstage tone={tone} />
      ) : view === 'me' ? (
        <WebMe tone={tone} setView={setView} onReplayWelcome={onReplayWelcome} />
      ) : view === 'insights' ? (
        <WebInsights tone={tone} onBack={() => go('me')} />
      ) : view === 'day' ? (
        <WebDayMode tone={tone} onBack={() => go('me')} onStart={onStart} />
      ) : view === 'night' ? (
        <WebNight tone={tone} onClose={() => go('me')} />
      ) : view === 'settings' ? (
        <WebSettings tone={tone} onBack={() => go('me')} />
      ) : view === 'crew' ? (
        <WebCrew tone={tone} onPairStart={onStart} />
      ) : null}
    </div>
  );
}

/* ---------------- Sidebar ---------------- */
function WebSidebar({ view, setView }) {
  const channels = ['q3-launch', 'general', 'design'];
  const dms = ['daniel', 'sofia', 'theo', 'priya'];
  const youActive = ['me', 'insights', 'day', 'night', 'settings'].includes(view);
  return (
    <div style={{ width: 244, flex: 'none', background: 'var(--bg-2)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '18px 18px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)' }}>
        <Mira size={30} mood="calm" />
        <div>
          <div className="display" style={{ fontSize: 16, color: 'var(--ink)' }}>AlphaLead</div>
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
        <SideLabel>Team</SideLabel>
        <SideRow active={view === 'crew'} onClick={() => setView('crew')}>
          <Icon name="crew" size={16} color={view === 'crew' ? 'var(--accent)' : 'var(--ink-3)'} /> Crew
        </SideRow>
        <SideRow active={view === 'backstage'} onClick={() => setView('backstage')}>
          <Icon name="shield" size={16} color={view === 'backstage' ? 'var(--accent)' : 'var(--glow)'} /> Backstage
        </SideRow>
        <div style={{ height: 14 }} />
        <SideLabel>Just for you</SideLabel>
        <SideRow active={view === 'me'} onClick={() => setView('me')}>
          <Icon name="heart" size={16} color={view === 'me' ? 'var(--accent)' : 'var(--ink-3)'} /> You &amp; Mira
        </SideRow>
        <SideRow active={view === 'insights'} onClick={() => setView('insights')}>
          <Icon name="spark" size={16} color={view === 'insights' ? 'var(--accent)' : 'var(--ink-3)'} /> Insights
        </SideRow>
        <SideRow active={view === 'day'} onClick={() => setView('day')}>
          <Icon name="doc" size={16} color={view === 'day' ? 'var(--accent)' : 'var(--ink-3)'} /> One thing at a time
        </SideRow>
        <SideRow active={view === 'night'} onClick={() => setView('night')}>
          <Icon name="moon" size={16} color={view === 'night' ? 'var(--accent)' : 'var(--ink-3)'} /> Wind down
        </SideRow>
        <SideRow active={view === 'settings'} onClick={() => setView('settings')}>
          <Icon name="bell" size={16} color={view === 'settings' ? 'var(--accent)' : 'var(--ink-3)'} /> Settings
        </SideRow>
      </div>
      <button onClick={() => setView('me')} aria-label="You & Mira" style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
        background: youActive ? 'var(--accent-soft)' : 'transparent',
        borderTop: '1px solid var(--line)', borderRight: 0, borderBottom: 0, borderLeft: 0,
      }}>
        <Avatar who="maya" size={30} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: youActive ? 'var(--ink)' : 'var(--ink)' }}>Maya</div>
          <div className="tiny" style={{ fontSize: 11 }}>Coordinator</div>
        </div>
        <Icon name="bell" size={17} color="var(--ink-3)" />
      </button>
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

/* ---------------- Shared web top bar ---------------- */
function WebTopBar({ title, kicker, onBack, trailing }) {
  return (
    <div style={{ flex: 'none', padding: '20px 30px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
      {onBack && (
        <button className="icon-btn" onClick={onBack} aria-label="Back" style={iconBtnStyle}>
          <Icon name="back" size={21} color="var(--ink-2)" />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {kicker && <div className="kicker" style={{ marginBottom: 2 }}>{kicker}</div>}
        {title && <h1 className="display" style={{ fontSize: 24, color: 'var(--ink)', margin: 0 }}>{title}</h1>}
      </div>
      {trailing}
    </div>
  );
}

/* ---------------- You & Mira (profile hub) ---------------- */
function WebMe({ tone, setView, onReplayWelcome }) {
  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'radial-gradient(110% 50% at 50% -10%, #221c2c, var(--bg) 60%)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px 30px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Mira size={34} mood="happy" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="kicker">Just for you</div>
          <h1 className="display" style={{ fontSize: 24, color: 'var(--ink)', margin: 0 }}>You &amp; Mira</h1>
        </div>
        <button className="btn btn-quiet" onClick={onReplayWelcome}>Replay the welcome</button>
      </div>
      <div className="stagger" style={{ padding: '24px 30px 30px', display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 920 }}>
        <div style={{ borderRadius: 24, padding: 26, position: 'relative', overflow: 'hidden', background: 'linear-gradient(160deg, var(--sage-soft), transparent)', border: '1px solid var(--line-2)' }}>
          <p className="kicker">This week, together</p>
          <div className="display" style={{ fontSize: 40, color: 'var(--ink)', marginTop: 8 }}>1h 48m</div>
          <p className="body" style={{ marginTop: 6, maxWidth: 520 }}>recovered from circling — yours to spend however you like.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <WebHubCard icon="spark" tint="var(--accent)" title="Insights" sub="Your progress, told kindly" onClick={() => setView('insights')} />
          <WebHubCard icon="doc" tint="var(--glow)" title="One thing at a time" sub="Hide the pile, focus the day" onClick={() => setView('day')} />
          <WebHubCard icon="moon" tint="#9FB8E0" title="Wind down" sub="A calm close to the night" onClick={() => setView('night')} />
          <WebHubCard icon="bell" tint="var(--sage)" title="Settings" sub="Rhythm, apps, gentle nudges" onClick={() => setView('settings')} />
        </div>
      </div>
    </div>
  );
}
function WebHubCard({ icon, tint, title, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 16,
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 20,
    }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)' }}>
        <Icon name={icon} size={24} color={tint} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, color: 'var(--ink)', fontWeight: 700 }}>{title}</div>
        <div className="tiny" style={{ marginTop: 3 }}>{sub}</div>
      </div>
      <Icon name="arrow" size={18} color="var(--ink-3)" />
    </button>
  );
}

/* ---------------- Insights (no guilt, no streaks) ---------------- */
function WebInsights({ tone, onBack }) {
  const max = 45;
  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'radial-gradient(110% 50% at 50% -10%, #221c2c, var(--bg) 60%)', display: 'flex', flexDirection: 'column' }}>
      <WebTopBar title="Insights" kicker="Told kindly" onBack={onBack} />
      <div className="stagger" style={{ padding: '24px 30px 30px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 920 }}>
        <p className="lead text-wrap-pretty">Every bar is time you took back. Quiet days aren’t failures — they’re rest.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <p className="kicker">Time recovered</p>
              <span className="tiny">minutes / day</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 160, marginTop: 20 }}>
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
          <div className="card" style={{ padding: 24 }}>
            <p className="kicker">Gentle starts</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 30%, #f4d6a8, var(--accent))',
                  boxShadow: '0 0 12px -2px var(--accent-soft)', opacity: 0.92,
                }} />
              ))}
            </div>
            <p className="body" style={{ marginTop: 16 }}>12 times you crossed the hardest part — the start. That’s the whole game.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '0 4px' }}>
          <Mira size={32} mood="happy" />
          <p className="tiny text-wrap-pretty" style={{ flex: 1 }}>No streaks to break here. You can always begin again — that’s the point.</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Day mode (anti-multitask) ---------------- */
function WebDayMode({ tone, onBack, onStart }) {
  const [peek, setPeek] = useStateWeb(false);
  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'radial-gradient(120% 70% at 50% -5%, #2a2333 0%, var(--bg) 55%, #110f16 100%)', display: 'flex', flexDirection: 'column' }}>
      <WebTopBar title="Just one thing" kicker="Daytime focus" onBack={onBack} />
      <div className="stagger" style={{ padding: '24px 30px 30px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760, margin: '0 auto', width: '100%' }}>
        <p className="lead text-wrap-pretty rise">You’ve got a few things today. I’ve hidden the pile so it can’t pull at you. Here’s the only one that matters right now:</p>
        <div className="rise" style={{
          borderRadius: 28, padding: 32, textAlign: 'center',
          background: 'linear-gradient(165deg, var(--surface-2), var(--surface))',
          border: '1px solid var(--line-2)', boxShadow: '0 24px 50px -24px rgba(0,0,0,0.6)',
        }}>
          <Mira size={64} mood="calm" style={{ margin: '0 auto 20px' }} />
          <p className="kicker" style={{ color: 'var(--accent)' }}>The one thing</p>
          <h1 className="h1 text-wrap-pretty" style={{ marginTop: 12, fontSize: 30 }}>Draft the Q3 launch deck</h1>
          <p className="body" style={{ marginTop: 12 }}>First step: open it and type one messy sentence.</p>
          <div style={{ marginTop: 24 }}>
            <Btn kind="primary" full lg icon="play" onClick={onStart}>Start this one</Btn>
          </div>
        </div>
        <button className="btn btn-quiet" style={{ marginTop: 4 }} onClick={() => setPeek(p => !p)}>
          {peek ? 'Tuck them back away' : '3 other things are safe with me'}
        </button>
        {peek && (
          <div className="fade" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['Reply to Priya about timeline', 'Review Sofía’s visuals', 'Update the project doc'].map((t, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, opacity: 0.7,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-3)' }} />
                <span style={{ fontSize: 15, color: 'var(--ink-2)' }}>{t}</span>
              </div>
            ))}
            <p className="tiny text-wrap-pretty" style={{ textAlign: 'center', marginTop: 6 }}>They’ll wait quietly. No badges, no counters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Night mode / disconnection ritual ---------------- */
function WebNight({ tone, onClose }) {
  const warm = tone === 'warm';
  const [stage, setStage] = useStateWeb(0);
  useEffectWeb(() => {
    if (stage === 1) {
      const t = setTimeout(() => setStage(2), 8200);
      return () => clearTimeout(t);
    }
  }, [stage]);

  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'radial-gradient(120% 80% at 50% 30%, #1b1a28 0%, #100f17 60%, #0a0910 100%)', display: 'flex', flexDirection: 'column' }}>
      {stage !== 1 && (
        <div style={{ flex: 'none', padding: '20px 30px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-quiet" onClick={onClose}>Close</button>
        </div>
      )}
      {stage === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
          <Mira size={96} mood="calm" style={{ marginBottom: 28 }} />
          <p className="kicker fade" style={{ color: '#9FB8E0' }}>11:14 pm</p>
          <h1 className="h1 rise text-wrap-pretty" style={{ marginTop: 14, fontSize: 34 }}>The scroll can wait.</h1>
          <p className="lead rise text-wrap-pretty" style={{ marginTop: 16, maxWidth: 380, color: 'var(--ink-2)' }}>
            {warm
              ? 'You don’t owe the day anything more. Let’s set it down softly, together.'
              : 'Nothing left to do tonight. Let’s wind down.'}
          </p>
          <div className="card rise" style={{ marginTop: 28, maxWidth: 380, padding: 18 }}>
            <p className="tiny text-wrap-pretty">The late scroll quietly costs most people ~332 hours of sleep a year. You don’t have to spend yours tonight.</p>
          </div>
          <div style={{ marginTop: 30, width: '100%', maxWidth: 380 }}>
            <Btn kind="primary" full lg icon="moon" onClick={() => setStage(1)}>Breathe, then set it down</Btn>
          </div>
        </div>
      )}
      {stage === 1 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 40 }}>
            <div className="breathe-halo" />
            <Mira size={108} mood="calm" />
          </div>
          <h1 className="h1 breathe-word">Breathe in…</h1>
          <p className="body" style={{ marginTop: 12 }}>Follow the glow. Four slow rounds.</p>
        </div>
      )}
      {stage === 2 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
          <Mira size={72} mood="happy" style={{ marginBottom: 26, opacity: 0.9 }} />
          <h1 className="h1 rise">Goodnight, Maya.</h1>
          <p className="lead rise text-wrap-pretty" style={{ marginTop: 14, maxWidth: 340, color: 'var(--ink-2)' }}>I’ll be here in the morning. Rest is the most productive thing you’ll do tonight.</p>
          <button className="btn btn-quiet rise" style={{ marginTop: 32 }} onClick={onClose}>Set the phone down</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Settings ---------------- */
function WebSettings({ tone, onBack }) {
  const [nudges, setNudges] = useStateWeb(true);
  const [pair, setPair] = useStateWeb(true);
  const [quiet, setQuiet] = useStateWeb(false);
  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'radial-gradient(110% 50% at 50% -10%, #221c2c, var(--bg) 60%)', display: 'flex', flexDirection: 'column' }}>
      <WebTopBar title="Settings" onBack={onBack} />
      <div style={{ padding: '24px 30px 30px', display: 'flex', flexDirection: 'column', maxWidth: 720 }}>
        <WebSettingsGroup label="Your rhythm">
          <WebSettingRow title="Intervention" detail="Evenings, ~10:30pm" chevron />
          <WebSettingRow title="Profile" detail="Bedtime revenge scroll" chevron last />
        </WebSettingsGroup>

        <WebSettingsGroup label="Connected apps (knowledge base)">
          <WebSettingRow title="Acme Deck Hub" detail="Connected" tint="var(--sage)" chevron />
          <WebSettingRow title="Acme Docs" detail="Connected" tint="var(--sage)" chevron />
          <WebSettingRow title="Add an app" detail="" plus last />
        </WebSettingsGroup>

        <WebSettingsGroup label="Nudges" note="Gentle by design. Mira will never alarm, shame, or show what you missed.">
          <WebSettingRowToggle title="Gentle check-ins" on={nudges} onToggle={() => setNudges(v => !v)} />
          <WebSettingRowToggle title="Pair-start invites" on={pair} onToggle={() => setPair(v => !v)} />
          <WebSettingRowToggle title="Quiet mode (pause all)" on={quiet} onToggle={() => setQuiet(v => !v)} last />
        </WebSettingsGroup>

        <WebSettingsGroup label="Voice">
          <WebSettingRow title="Tone" detail={tone === 'warm' ? 'Warm' : 'Balanced'} chevron last />
        </WebSettingsGroup>

        <p className="tiny text-wrap-pretty" style={{ textAlign: 'center', marginTop: 24, padding: '0 20px' }}>
          AlphaLead never shows overdue items, broken streaks, or public scores. Promise.
        </p>
      </div>
    </div>
  );
}
function WebSettingsGroup({ label, note, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="kicker" style={{ padding: '0 6px 8px' }}>{label}</div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, overflow: 'hidden' }}>{children}</div>
      {note && <p className="tiny text-wrap-pretty" style={{ padding: '8px 8px 0' }}>{note}</p>}
    </div>
  );
}
function WebSettingRow({ title, detail, tint, chevron, plus, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <span style={{ flex: 1, fontSize: 15.5, color: 'var(--ink)' }}>{title}</span>
      {detail && <span className="tiny" style={{ color: tint || 'var(--ink-3)' }}>{detail}</span>}
      {chevron && <Icon name="arrow" size={16} color="var(--ink-3)" />}
      {plus && <Icon name="plus" size={18} color="var(--accent)" />}
    </div>
  );
}
function WebSettingRowToggle({ title, on, onToggle, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: last ? 'none' : '1px solid var(--line)' }}>
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

/* ---------------- Crew (gentle team space) ---------------- */
function WebCrew({ tone, onPairStart }) {
  const [paired, setPaired] = useStateWeb(false);
  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'radial-gradient(110% 50% at 50% -10%, #221c2c, var(--bg) 60%)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px 30px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Mira size={32} mood="calm" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="kicker">Together</div>
          <h1 className="display" style={{ fontSize: 24, color: 'var(--ink)', margin: 0 }}>Crew</h1>
        </div>
      </div>
      <div className="stagger" style={{ padding: '24px 30px 30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, maxWidth: 920 }}>
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <p className="kicker">How the crew feels</p>
            <span className="tiny">this week</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
            <Weather level={0.62} />
            <div style={{ flex: 1 }}>
              <div className="h2" style={{ fontSize: 22 }}>A little tense</div>
              <p className="tiny text-wrap-pretty" style={{ marginTop: 4 }}>The launch is bunching everyone up. That’s the system, not any one person.</p>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <p className="kicker">Next tiny milestone</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, flex: 'none', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="spark" size={22} color="var(--accent)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, color: 'var(--ink)', fontWeight: 700 }}>A rough deck skeleton</div>
              <div className="tiny" style={{ marginTop: 3 }}>In about 2 days · small and shared</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
            <div style={{ display: 'flex' }}>
              {['maya', 'sofia', 'theo'].map((w, i) => (
                <Avatar key={w} who={w} size={28} style={{ marginLeft: i ? -8 : 0, boxShadow: '0 0 0 2px var(--surface)' }} />
              ))}
            </div>
            <span className="tiny">3 of you are easing into it</span>
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1', borderRadius: 24, padding: 22, background: 'linear-gradient(180deg, var(--glow-soft), transparent)', border: '1px solid var(--glow)' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ position: 'relative' }}>
              <Avatar who="theo" size={46} />
              <div style={{ position: 'absolute', bottom: -3, right: -3, width: 22, height: 22, borderRadius: 999, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--glow)' }}>
                <Icon name="shield" size={13} color="var(--glow)" />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <p className="kicker" style={{ color: 'var(--glow)' }}>Mira noticed — quietly</p>
              <div style={{ fontSize: 18, color: 'var(--ink)', fontWeight: 700, marginTop: 6, lineHeight: 1.35 }}>Theo’s been catching most of the launch work.</div>
              <p className="tiny text-wrap-pretty" style={{ marginTop: 8 }}>He’s the one who procrastinates least — so the load drifts to him. Want to even it out?</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-primary" style={{ flex: 1, fontSize: 15, padding: '13px' }}>Share the load</button>
            <button className="btn btn-ghost" style={{ flex: 1, fontSize: 15, padding: '13px' }}>Not now</button>
          </div>
        </div>

        <div className="card" style={{ gridColumn: '1 / -1', padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar who="sofia" size={42} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, color: 'var(--ink)', fontWeight: 700 }}>
                {paired ? 'Sofía is starting too — go!' : 'Sofía is free to start with you'}
              </div>
              <div className="tiny" style={{ marginTop: 3 }}>
                {paired ? 'You’re not doing it alone.' : 'Begin the same 2 minutes side by side.'}
              </div>
            </div>
            {paired && <Mira size={28} mood="cheer" />}
          </div>
          <button
            className={'btn ' + (paired ? 'btn-primary' : 'btn-ghost')}
            style={{ width: '100%', marginTop: 16 }}
            onClick={() => { if (!paired) { setPaired(true); setTimeout(onPairStart, 700); } }}>
            {paired ? 'Starting together…' : 'Start together'}
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { WebApp });
