// task.jsx — Task detected → confirmation. Accepts any task; never forced.

function TaskSheet({ tone, task = DECK_TASK, onStart, onClose, onDiscard }) {
  const warm = tone === 'warm';
  const self = task.selfMade;
  return (
    <Overlay onClose={onClose}>
      <div className="screen">
        <div className="pad-top" />
        <TopBar
          kicker="Alpha noticed"
          title="Is this yours?"
          trailing={<IconBtn name="close" onClick={onClose} label="Close" />}
        />
        <div className="scroll" style={{ padding: '6px 18px 18px' }}>
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
              {!self && <Avatar who={task.fromWho} size={40} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tiny">{self ? 'You mentioned' : 'Daniel asked, gently'}</div>
                <div style={{ fontSize: 15, color: 'var(--ink)', marginTop: 2 }}>{task.fromQuote}</div>
              </div>
              {!self && <Icon name="arrow" size={18} color="var(--ink-3)" />}
              <Avatar who="maya" size={40} />
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div className="kicker" style={{ marginBottom: 8 }}>What Alpha heard</div>
              <div className="h2" style={{ fontSize: 22 }}>{task.title}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                <span className="chip"><Icon name="doc" size={14} color="var(--glow)" /> {task.category}</span>
                <span className="chip"><Icon name="link" size={14} color="var(--glow)" /> {task.app}</span>
                <span className="chip"><Icon name="clock" size={14} color="var(--ink-3)" /> {task.due}</span>
              </div>
              <div className="tiny" style={{ marginTop: 12, lineHeight: 1.5 }}>
                Filed under <b style={{ color: 'var(--ink-2)' }}>{task.category}</b> automatically — you don’t have to sort anything.
              </div>
            </div>

            <div style={{
              borderRadius: 24, padding: 18,
              background: 'linear-gradient(180deg, var(--accent-soft), transparent)',
              border: '1px solid var(--accent)',
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <Alpha size={34} mood="happy" />
                <div style={{ flex: 1 }}>
                  <div className="kicker" style={{ color: 'var(--accent)', marginBottom: 6 }}>Your first step, already tiny</div>
                  <div style={{ fontSize: 17, color: 'var(--ink)', fontWeight: 600, lineHeight: 1.4 }}>{task.micro}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11 }}>
                    <Icon name="link" size={15} color="var(--ink-3)" />
                    <span className="tiny" style={{ color: 'var(--ink-2)' }}>{task.resource} — ready to open</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="tiny text-wrap-pretty" style={{ textAlign: 'center', padding: '2px 16px' }}>
              {warm ? 'Nothing’s scheduled, nothing’s assigned. You’re just deciding if it’s yours.' : 'Nothing is scheduled until you say so.'}
            </div>
          </div>
        </div>

        <div style={{ flex: 'none', padding: '6px 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Btn kind="primary" full lg icon="arrow" onClick={onStart}>Start the 2‑minute unlock</Btn>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1, fontSize: 15.5, padding: '13px' }}>Tweak it</button>
            <button className="btn btn-quiet" onClick={onDiscard} style={{ flex: 1 }}>Not mine</button>
          </div>
        </div>
        <div className="pad-bot" />
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }) {
  return (
    <div className="overlay" style={{ position: 'absolute', inset: 0, zIndex: 40 }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(8,7,11,0.55)',
        backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(140% 70% at 50% -8%, #241d2e 0%, var(--bg) 52%, #110f16 100%)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, { TaskSheet, Overlay });
