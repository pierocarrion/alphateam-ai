// convo.jsx — shared conversation engine: messages, typing, hardcoded replies,
// and silent AI task-detection. Used by both the mobile and web chat surfaces.
const { useState: useStateCv, useRef: useRefCv, useEffect: useEffectCv } = React;

/* the canonical seeded task (Daniel → Maya) */
const DECK_TASK = {
  title: 'Draft the Q3 launch deck',
  fromWho: 'daniel',
  fromQuote: '“a first rough draft of the launch deck”',
  category: 'Slides',
  app: 'Acme Deck Hub',
  due: 'before Thursday',
  load: 'Medium',           // estimated emotional load
  micro: 'Open the deck and type one messy sentence. That’s the whole job.',
  action: 'one messy sentence',
  resource: 'Q3 Launch Deck.key',
};

const SEED = [
  { id: 's1', who: 'daniel', time: '9:02', text: 'Morning all ☀️ Q3 launch is officially a go.' },
  { id: 's2', who: 'sofia',  time: '9:03', text: 'finally!! been waiting for this 🎉' },
  { id: 's3', who: 'theo',   time: '9:04', text: 'love it. what’s the first domino?' },
  { id: 's4', who: 'daniel', time: '9:06', text: 'We want the launch deck ready before Thursday’s sync so marketing can build from it.' },
  { id: 's5', who: 'daniel', time: '9:07', text: 'Maya — could you pull together a first rough draft of the Q3 launch deck? Honestly even messy is perfect to start. 🙏', assign: true },
];

const TASK_WORDS = ['deck','report','write','draft','finish','prepare','review','send','email',
  'fix','build','design','plan','need to','have to','should','tomorrow','friday','monday',
  'by ','before','document','spec','proposal','presentation','slides','update','ship','handle','take care'];

const TEAMMATE_REPLIES = [
  { who: 'sofia', text: 'love that 🙌 here if you need a hand' },
  { who: 'theo',  text: 'nice — go at your own pace, no rush' },
  { who: 'daniel', text: 'sounds good. whatever’s easiest to start with 🙏' },
  { who: 'sofia', text: 'you’ve got this ✨' },
];

function looksLikeTask(text) {
  const t = text.toLowerCase();
  return TASK_WORDS.some(w => t.includes(w));
}

function deriveTask(text) {
  const clean = text.trim().replace(/\s+/g, ' ');
  const words = clean.split(' ');
  let title = words.slice(0, 8).join(' ');
  title = title.charAt(0).toUpperCase() + title.slice(1);
  if (words.length > 8) title += '…';
  // naive category guess
  const t = clean.toLowerCase();
  let category = 'General', app = 'Knowledge base';
  if (/deck|slide|present/.test(t)) { category = 'Slides'; app = 'Acme Deck Hub'; }
  else if (/report|doc|spec|write|proposal/.test(t)) { category = 'Docs'; app = 'Acme Docs'; }
  else if (/email|send|reply/.test(t)) { category = 'Comms'; app = 'Mail'; }
  else if (/fix|build|ship|design/.test(t)) { category = 'Build'; app = 'Acme Tracker'; }
  return {
    title,
    fromWho: 'maya',
    fromQuote: `“${clean.length > 60 ? clean.slice(0, 60) + '…' : clean}”`,
    category, app, due: 'no deadline yet', load: 'Light',
    micro: 'Open it and do the first tiny piece — one line, one click. Then you’re free to stop.',
    action: 'the first tiny piece',
    resource: category === 'Slides' ? 'Untitled.key' : 'Untitled.doc',
    selfMade: true,
  };
}

let _mid = 100;
const nextId = () => 'm' + (_mid++);

function useConversation() {
  const [messages, setMessages] = useStateCv(SEED);
  const [typing, setTyping] = useStateCv(null);       // who is typing, or null
  const [detected, setDetected] = useStateCv(null);    // { anchorId, task }
  const timers = useRefCv([]);

  // silent detection of the seeded assignment after a beat
  useEffectCv(() => {
    const t = setTimeout(() => {
      setDetected(d => d || { anchorId: 's5', task: DECK_TASK, status: 'open' });
    }, 1600);
    timers.current.push(t);
    return () => timers.current.forEach(clearTimeout);
  }, []);

  function send(text) {
    const clean = text.trim();
    if (!clean) return;
    const id = nextId();
    const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase().replace(/(am|pm)/, '');
    setMessages(m => [...m, { id, who: 'maya', time, text: clean }]);

    if (looksLikeTask(clean)) {
      // Alpha quietly notices — no chat reply, just the inline chip
      const t = setTimeout(() => {
        setDetected({ anchorId: id, task: deriveTask(clean), status: 'open' });
      }, 1100);
      timers.current.push(t);
    } else {
      // a teammate replies warmly (hardcoded)
      const reply = TEAMMATE_REPLIES[Math.floor(Math.random() * TEAMMATE_REPLIES.length)];
      setTyping(reply.who);
      const t = setTimeout(() => {
        setTyping(null);
        setMessages(m => [...m, { id: nextId(), who: reply.who, time, text: reply.text }]);
      }, 1300);
      timers.current.push(t);
    }
  }

  const resolveDetected = (status) => setDetected(d => d ? { ...d, status } : d);

  return { messages, typing, detected, send, resolveDetected, setDetected };
}

Object.assign(window, { useConversation, DECK_TASK, deriveTask, looksLikeTask, SEED });
