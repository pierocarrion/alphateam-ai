// app.jsx — AlphaLead AI · router, navigation, app/web modes, tweaks, mount
const { useState: useStateA, useEffect: useEffectA, useRef: useRefA } = React;

/* ---------- palettes & fonts for tweaks ---------- */
function hexA(hex, a) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const al = Math.round(a * 255).toString(16).padStart(2, '0');
  return '#' + v + al;
}
const PALETTES = {
  Amber:    { accent: '#E6AC73', glow: '#B6A6E0', sage: '#93C2A2' },
  Rose:     { accent: '#E59CA8', glow: '#C8A6E0', sage: '#93C2A2' },
  Sage:     { accent: '#9CC6A6', glow: '#B6A6E0', sage: '#D8C49A' },
  Lavender: { accent: '#B7A7E6', glow: '#E6AC73', sage: '#93C2A2' },
};
const FONTS = {
  'Fredoka + Nunito':   { display: "'Fredoka', system-ui, sans-serif", body: "'Nunito', system-ui, sans-serif" },
  'Quicksand + Mulish': { display: "'Quicksand', system-ui, sans-serif", body: "'Mulish', system-ui, sans-serif" },
  'Baloo + Nunito Sans':{ display: "'Baloo 2', system-ui, sans-serif", body: "'Nunito Sans', system-ui, sans-serif" },
};
const MOTION  = { Subtle: 0.6, Standard: 1, Lively: 1.55 };
const DENSITY = { Cozy: 0.9, Comfortable: 1, Airy: 1.14 };

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "Amber",
  "font": "Fredoka + Nunito",
  "motion": "Standard",
  "density": "Comfortable",
  "tone": "warm"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [mode, setMode] = useStateA('app');         // app | web
  const [phase, setPhase] = useStateA(() => localStorage.getItem('alphalead-ai_onboarded') ? 'app' : 'welcome'); // welcome | onboarding | app
  const [screen, setScreen] = useStateA('home');    // home | chat | crew | me | night | insights | day | settings
  const [flow, setFlow] = useStateA(null);          // null | task | ritual | focus | reward | intention
  const [activeTask, setActiveTask] = useStateA(DECK_TASK);
  const [scale, setScale] = useStateA(1);
  const convo = useConversation();

  const DIM = mode === 'web' ? { w: 1200, h: 744 } : { w: 402, h: 874 };

  useEffectA(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 36) / DIM.h, (window.innerWidth - 36) / DIM.w));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [mode]);

  // entrance animations only when visible & motion allowed (else content is always visible)
  const rootRef = useRefA(null);
  useEffectA(() => {
    const allowMotion = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
    const enable = () => { if (allowMotion && !document.hidden && rootRef.current) rootRef.current.classList.add('animate'); };
    requestAnimationFrame(enable);
    document.addEventListener('visibilitychange', enable);
    return () => document.removeEventListener('visibilitychange', enable);
  }, []);

  const pal = PALETTES[t.palette] || PALETTES.Amber;
  const fnt = FONTS[t.font] || FONTS['Fredoka + Nunito'];
  const vars = {
    '--accent': pal.accent, '--accent-soft': hexA(pal.accent, 0.16), '--accent-ink': '#211810',
    '--glow': pal.glow, '--glow-soft': hexA(pal.glow, 0.16),
    '--sage': pal.sage, '--sage-soft': hexA(pal.sage, 0.16),
    '--font-display': fnt.display, '--font-body': fnt.body,
    '--m': MOTION[t.motion] ?? 1, '--d': DENSITY[t.density] ?? 1,
  };
  const tone = t.tone;

  // ---- flow helpers ----
  const showTask = (task) => { setActiveTask(task || DECK_TASK); setFlow('task'); };
  const ritualWith = (task) => { setActiveTask(task || DECK_TASK); setFlow('ritual'); };
  const completeFlow = () => { setFlow(null); if (mode === 'app') setScreen('home'); };
  const finishOnboarding = () => { localStorage.setItem('alphalead-ai_onboarded', '1'); setPhase('app'); setScreen('home'); };

  const navScreens = ['home', 'chat', 'crew', 'me'];
  const showNav = mode === 'app' && phase === 'app' && navScreens.includes(screen) && !flow;

  // ---- shared flow overlays (used by both app + web) ----
  const flowEl = (
    <>
      {flow === 'task' && <TaskSheet tone={tone} task={activeTask} onStart={() => setFlow('ritual')} onClose={() => setFlow(null)} onDiscard={() => { convo.resolveDetected('dismissed'); setFlow(null); }} />}
      {flow === 'ritual' && <RitualFlow tone={tone} task={activeTask} onAction={() => setFlow('focus')} onClose={() => setFlow(null)} />}
      {flow === 'focus' && <FocusScreen tone={tone} task={activeTask} onDone={() => setFlow('reward')} onClose={() => setFlow(null)} />}
      {flow === 'reward' && <RewardScreen tone={tone} onHome={() => { convo.resolveDetected('started'); completeFlow(); }} onClose={() => { convo.resolveDetected('started'); completeFlow(); }} />}
      {flow === 'intention' && <IntentionCapture tone={tone} onStart={ritualWith} onClose={() => setFlow(null)} />}
    </>
  );

  // ---- app (phone) content ----
  const phoneInner = (
    <div className="app">
      {phase === 'welcome' && <WelcomeScreen tone={tone} onBegin={() => setPhase('onboarding')} />}
      {phase === 'onboarding' && <OnboardingFlow tone={tone} onComplete={finishOnboarding} />}
      {phase === 'app' && (
        <>
          {screen === 'home' && <HomeScreen tone={tone} onStart={() => ritualWith(DECK_TASK)} onChat={() => setScreen('chat')} onCapture={() => setFlow('intention')} go={setScreen} />}
          {screen === 'chat' && <ChatScreen tone={tone} convo={convo} onShowTask={showTask} />}
          {screen === 'crew' && <CrewScreen tone={tone} onPairStart={() => ritualWith(DECK_TASK)} go={setScreen} />}
          {screen === 'me' && <MeScreen tone={tone} go={setScreen} onReplayWelcome={() => setPhase('welcome')} />}
          {screen === 'night' && <NightScreen tone={tone} onClose={() => setScreen('home')} />}
          {screen === 'insights' && <InsightsScreen tone={tone} onBack={() => setScreen('me')} />}
          {screen === 'day' && <DayModeScreen tone={tone} onBack={() => setScreen('me')} onStart={() => ritualWith(DECK_TASK)} />}
          {screen === 'settings' && <SettingsScreen tone={tone} onBack={() => setScreen('me')} />}

          {showNav && (
            <div className="nav">
              <NavItem icon="home" label="Now"  active={screen === 'home'} onClick={() => setScreen('home')} />
              <NavItem icon="chat" label="Team" active={screen === 'chat'} onClick={() => setScreen('chat')} />
              <NavItem icon="crew" label="Crew" active={screen === 'crew'} onClick={() => setScreen('crew')} />
              <NavItem icon="heart" label="You" active={screen === 'me'} onClick={() => setScreen('me')} />
            </div>
          )}
          {flowEl}
        </>
      )}
    </div>
  );

  return (
    <div className="alphalead-ai" ref={rootRef} style={{ ...vars, fontFamily: 'var(--font-body)' }}>
      <ModeToggle mode={mode} setMode={setMode} />

      <div className="stage">
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
          {mode === 'app' ? (
            <IOSDevice dark width={402} height={874}>{phoneInner}</IOSDevice>
          ) : (
            <ChromeWindow width={1200} height={744} url="alphalead-ai.team/acme/q3-launch"
              tabs={[{ title: 'AlphaLead — q3-launch' }, { title: 'Acme Deck Hub' }]} activeIndex={0}>
              <WebApp tone={tone} convo={convo} onShowTask={showTask} onStart={() => ritualWith(DECK_TASK)} onReplayWelcome={() => { setFlow(null); setMode('app'); setPhase('welcome'); }} />
            </ChromeWindow>
          )}
        </div>
      </div>

      {/* web flow overlays — centered phone-sized modal over the desktop window */}
      {mode === 'web' && flow && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setFlow(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(6,5,9,0.62)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }} />
          <div style={{ position: 'relative', width: 412, height: 'min(792px, calc(100vh - 32px))', borderRadius: 30, overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)' }}>
            {flowEl}
          </div>
        </div>
      )}

      {/* Tweaks */}
      <TweaksPanel>
        <TweakSection label="Surface" />
        <TweakRadio label="Mode" value={mode} options={['app', 'web']} onChange={setMode} />
        <TweakSection label="Palette" />
        <TweakRadio label="Mood" value={t.palette} options={Object.keys(PALETTES)} onChange={v => setTweak('palette', v)} />
        <TweakSection label="Type" />
        <TweakSelect label="Font pairing" value={t.font} options={Object.keys(FONTS)} onChange={v => setTweak('font', v)} />
        <TweakSection label="Feel" />
        <TweakRadio label="Motion" value={t.motion} options={Object.keys(MOTION)} onChange={v => setTweak('motion', v)} />
        <TweakRadio label="Density" value={t.density} options={Object.keys(DENSITY)} onChange={v => setTweak('density', v)} />
        <TweakRadio label="Voice" value={t.tone} options={['warm', 'balanced']} onChange={v => setTweak('tone', v)} />
        <TweakSection label="Jump to (app)" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <TweakButton label="Welcome" onClick={() => { setMode('app'); setFlow(null); setPhase('welcome'); }} />
          <TweakButton label="Onboarding" onClick={() => { setMode('app'); setFlow(null); setPhase('onboarding'); }} />
          <TweakButton label="Home" onClick={() => { setMode('app'); setFlow(null); setPhase('app'); setScreen('home'); }} />
          <TweakButton label="Team chat" onClick={() => { setMode('app'); setFlow(null); setPhase('app'); setScreen('chat'); }} />
          <TweakButton label="2-min ritual" onClick={() => { setPhase('app'); ritualWith(DECK_TASK); }} />
          <TweakButton label="Crew" onClick={() => { setMode('app'); setFlow(null); setPhase('app'); setScreen('crew'); }} />
          <TweakButton label="Insights" onClick={() => { setMode('app'); setFlow(null); setPhase('app'); setScreen('insights'); }} />
          <TweakButton label="Day mode" onClick={() => { setMode('app'); setFlow(null); setPhase('app'); setScreen('day'); }} />
          <TweakButton label="Night mode" onClick={() => { setMode('app'); setFlow(null); setPhase('app'); setScreen('night'); }} />
          <TweakButton label="Settings" onClick={() => { setMode('app'); setFlow(null); setPhase('app'); setScreen('settings'); }} />
        </div>
        <TweakSection label="Jump to (web)" />
        <TweakButton label="Open web mode" onClick={() => { setFlow(null); setMode('web'); }} />
      </TweaksPanel>
    </div>
  );
}

function ModeToggle({ mode, setMode }) {
  return (
    <div style={{ position: 'fixed', top: 14, left: 16, zIndex: 80 }}>
      <div style={{ display: 'flex', gap: 2, padding: 4, borderRadius: 999, background: 'rgba(28,24,34,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {[['app', 'Mobile app'], ['web', 'Web']].map(([k, lbl]) => (
          <button key={k} onClick={() => setMode(k)} style={{
            border: 0, cursor: 'pointer', padding: '7px 16px', borderRadius: 999, whiteSpace: 'nowrap',
            fontFamily: "'Fredoka', system-ui", fontWeight: 500, fontSize: 13.5,
            background: mode === k ? 'var(--accent, #E6AC73)' : 'transparent',
            color: mode === k ? '#211810' : 'rgba(243,236,225,0.6)',
            transition: 'all .2s ease',
          }}>{lbl}</button>
        ))}
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button className={'nav-item' + (active ? ' active' : '')} onClick={onClick}>
      <Icon name={icon} size={23} color="currentColor" stroke={active ? 2.3 : 2} />
      <span>{label}</span>
      <div className="nav-dot" />
    </button>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
