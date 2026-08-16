import { Command as CommandIcon, CornerDownLeft, Search, Terminal } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { socket } from '../lib/socket';

type CommandResult = {
  ok: boolean;
  accepted?: { type: string };
  error?: string;
};

const examples = [
  'Descend to 5,200 m', 'Set heading 137°', 'Launch Drone 3', 'Focus sonar contact S-076',
  'Kill floodlights', 'Return to surface', 'Abort mission', 'Pause simulation',
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Type a command in natural language');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setOpen((value) => !value);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 60); }, [open]);

  const suggestions = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return examples.filter((example) => terms.every((term) => example.toLowerCase().includes(term))).slice(0, 5);
  }, [query]);

  const submit = (text: string) => {
    if (!text.trim()) return;
    setStatus('Transmitting to NEREID-7…');
    socket.timeout(5_000).emit('commandText', text, (error: Error | null, result?: CommandResult) => {
      if (error) return setStatus('Command link timed out');
      if (result?.ok && result.accepted) {
        setStatus(`Accepted · ${result.accepted.type.replaceAll('_', ' ')}`);
        setTimeout(() => { setOpen(false); setQuery(''); }, 650);
      } else setStatus(result?.error ?? 'Command rejected');
    });
  };

  return <>
    <button className="command-trigger" onClick={() => setOpen(true)}><CommandIcon size={12} /><span>Command</span><kbd>Ctrl K</kbd></button>
    <AnimatePresence>
      {open && <motion.div className="palette-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setOpen(false)}>
        <motion.div className="command-palette" initial={{ opacity: 0, y: -14, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} onMouseDown={(e) => e.stopPropagation()}>
          <div className="palette-input"><Search size={17} /><input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit(query || suggestions[0])} placeholder="Issue a vessel command…" /><kbd>ESC</kbd></div>
          <div className="palette-status"><Terminal size={12} /> {status}</div>
          <div className="palette-results">{suggestions.map((item, index) => <button key={item} onClick={() => submit(item)}><span><i>{String(index + 1).padStart(2, '0')}</i>{item}</span><CornerDownLeft size={13} /></button>)}</div>
          <div className="palette-hint">Commands are parsed locally and executed by the authoritative simulation server.</div>
        </motion.div>
      </motion.div>}
    </AnimatePresence>
  </>;
}
