// companion.jsx — Alpha (the companion orb) + shared UI primitives
// Exports to window for the other babel scripts.

const { useState, useEffect, useRef } = React;

/* ----------------------------------------------------------------
   Alpha — friendly companion. Composed of simple circles only.
   mood: 'calm' | 'happy' | 'thinking' | 'cheer'
   ---------------------------------------------------------------- */
function Alpha({ size = 64, mood = 'calm', ring = false, style = {} }) {
  const eyeStyle =
    mood === 'happy' || mood === 'cheer'
      ? { height: '14%', borderRadius: '999px 999px 0 0', transform: 'translateY(2px)' }
      : {};
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none', ...style }}>
      {ring && (
        <>
          <div className="pulse-ring" style={{ inset: 0 }} />
          <div className="pulse-ring" style={{ inset: 0, animationDelay: 'calc(1.7s * var(--m))' }} />
        </>
      )}
      <div className="alpha" style={{ width: size, height: size }}>
        <div className="alpha-eyes">
          <div className="alpha-eye" style={eyeStyle} />
          <div className="alpha-eye" style={eyeStyle} />
        </div>
        {(mood === 'happy' || mood === 'cheer') && (
          <div style={{
            position: 'absolute', left: '50%', top: '60%', transform: 'translateX(-50%)',
            width: '24%', height: '12%',
            borderBottom: '2px solid #2a2030', borderRadius: '0 0 99px 99px',
          }} />
        )}
        {mood === 'thinking' && (
          <div style={{
            position: 'absolute', left: '50%', top: '66%', transform: 'translateX(-50%)',
            width: '20%', height: '6%', borderRadius: '99px', background: '#2a2030', opacity: 0.8,
          }} />
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   Avatar — initials in a tinted circle
   ---------------------------------------------------------------- */
const PEOPLE = {
  maya:   { name: 'Maya',   initials: 'M',  color: '#E6AC73', you: true },
  daniel: { name: 'Daniel', initials: 'D',  color: '#9FB8E0' },
  sofia:  { name: 'Sofía',  initials: 'S',  color: '#E6A0B0' },
  theo:   { name: 'Theo',   initials: 'T',  color: '#93C2A2' },
  priya:  { name: 'Priya',  initials: 'P',  color: '#C7A6E0' },
};

function Avatar({ who = 'daniel', size = 38, style = {} }) {
  const p = PEOPLE[who] || PEOPLE.daniel;
  return (
    <div className="avatar" style={{
      width: size, height: size,
      fontSize: size * 0.42,
      background: `linear-gradient(150deg, ${p.color}, ${shade(p.color, -18)})`,
      ...style,
    }}>{p.initials}</div>
  );
}

function shade(hex, amt) {
  // simple lighten/darken
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/* ----------------------------------------------------------------
   Icon — minimal stroke glyphs (no decorative SVG art)
   ---------------------------------------------------------------- */
function Icon({ name, size = 22, color = 'currentColor', stroke = 2 }) {
  const p = { fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    home:    <path d="M3 11l9-7 9 7M5 10v9h5v-5h4v5h5v-9" {...p} />,
    chat:    <path d="M4 5h16v11H9l-4 3v-3H4z" {...p} />,
    crew:    <><circle cx="8" cy="9" r="3" {...p} /><circle cx="16" cy="9" r="3" {...p} /><path d="M3 19c0-2.5 2.2-4 5-4M21 19c0-2.5-2.2-4-5-4" {...p} /></>,
    spark:   <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" {...p} />,
    moon:    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" {...p} />,
    check:   <path d="M5 12.5l4.5 4.5L19 7" {...p} />,
    arrow:   <path d="M5 12h14M13 6l6 6-6 6" {...p} />,
    back:    <path d="M19 12H5M11 6l-6 6 6 6" {...p} />,
    close:   <path d="M6 6l12 12M18 6L6 18" {...p} />,
    plus:    <path d="M12 5v14M5 12h14" {...p} />,
    pause:   <path d="M9 5v14M15 5v14" {...p} />,
    play:    <path d="M7 5l12 7-12 7z" {...p} />,
    send:    <path d="M5 12l15-7-7 15-2-6-6-2z" {...p} />,
    heart:   <path d="M12 20s-7-4.6-7-9.5A3.5 3.5 0 0 1 12 7a3.5 3.5 0 0 1 7 3.5C19 15.4 12 20 12 20z" {...p} />,
    leaf:    <path d="M5 19c0-8 6-13 14-13 0 8-5 14-13 14-1 0-1-1-1-1zM6 18c4-4 7-7 9-9" {...p} />,
    link:    <path d="M9 13a4 4 0 0 0 6 .5l2-2a4 4 0 0 0-6-6l-1 1M15 11a4 4 0 0 0-6-.5l-2 2a4 4 0 0 0 6 6l1-1" {...p} />,
    shield:  <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" {...p} />,
    clock:   <><circle cx="12" cy="12" r="8.5" {...p} /><path d="M12 7.5V12l3 2" {...p} /></>,
    bell:    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0" {...p} />,
    doc:     <path d="M7 3h7l4 4v14H7zM14 3v4h4" {...p} />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
      {paths[name] || null}
    </svg>
  );
}

/* ----------------------------------------------------------------
   TopBar — minimal, optional back + title + trailing
   ---------------------------------------------------------------- */
function TopBar({ title, onBack, trailing, kicker }) {
  return (
    <div style={{
      flex: 'none', display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 18px 10px', minHeight: 48,
    }}>
      {onBack && (
        <button className="icon-btn" onClick={onBack} aria-label="Back" style={iconBtnStyle}>
          <Icon name="back" size={21} color="var(--ink-2)" />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {kicker && <div className="kicker" style={{ marginBottom: 2 }}>{kicker}</div>}
        {title && <div className="display" style={{ fontSize: 19, color: 'var(--ink)' }}>{title}</div>}
      </div>
      {trailing}
    </div>
  );
}

const iconBtnStyle = {
  width: 40, height: 40, borderRadius: 999, flex: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)',
  cursor: 'pointer', padding: 0,
};

function IconBtn({ name, onClick, label, color = 'var(--ink-2)' }) {
  return (
    <button className="icon-btn" onClick={onClick} aria-label={label} style={iconBtnStyle}>
      <Icon name={name} size={21} color={color} />
    </button>
  );
}

/* ----------------------------------------------------------------
   Button
   ---------------------------------------------------------------- */
function Btn({ kind = 'primary', children, onClick, full, lg, icon, style = {} }) {
  const cls = `btn btn-${kind}${full ? ' btn-full' : ''}${lg ? ' btn-lg' : ''}`;
  return (
    <button className={cls} onClick={onClick} style={style}>
      {children}
      {icon && <Icon name={icon} size={20} color="currentColor" />}
    </button>
  );
}

/* ----------------------------------------------------------------
   Confetti — gentle, soft particles (motion-aware)
   ---------------------------------------------------------------- */
function Sparkles({ n = 18, colors }) {
  const cols = colors || ['var(--accent)', 'var(--sage)', 'var(--glow)', '#f4d6a8'];
  const parts = Array.from({ length: n }, (_, i) => {
    const ang = (i / n) * Math.PI * 2 + Math.random();
    const dist = 70 + Math.random() * 90;
    return {
      dx: Math.cos(ang) * dist + 'px',
      dy: Math.sin(ang) * dist + 'px',
      dr: (Math.random() * 360 - 180) + 'deg',
      bg: cols[i % cols.length],
      delay: (Math.random() * 0.12) + 's',
      key: i,
    };
  });
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
      {parts.map(pt => (
        <span key={pt.key} className="spark" style={{
          background: pt.bg, '--dx': pt.dx, '--dy': pt.dy, '--dr': pt.dr,
          animationDelay: pt.delay,
          borderRadius: pt.key % 2 ? '2px' : '50%',
        }} />
      ))}
    </div>
  );
}

/* striped image placeholder (per house rules — no fake imagery) */
function Placeholder({ label, h = 120, style = {} }) {
  return (
    <div style={{
      height: h, borderRadius: 16,
      background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 10px, rgba(255,255,255,0.06) 10px 20px)',
      border: '1px solid var(--line)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      ...style,
    }}>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: 'var(--ink-3)', letterSpacing: 0.4 }}>{label}</span>
    </div>
  );
}

Object.assign(window, {
  Alpha, Avatar, Icon, TopBar, IconBtn, Btn, Sparkles, Placeholder,
  PEOPLE, shade, iconBtnStyle,
});
