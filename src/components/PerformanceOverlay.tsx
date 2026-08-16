import { useEffect, useRef, useState } from 'react';

export function PerformanceOverlay({ messages }: { messages: React.RefObject<number> }) {
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState({ fps: 60, frame: 16.7, mps: 0, memory: '—' });
  const frames = useRef(0);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => { if (event.key === '`') setVisible((v) => !v); };
    window.addEventListener('keydown', keydown);
    let raf = 0; let previous = performance.now(); let lastMessages = messages.current ?? 0;
    const measure = (now: number) => {
      frames.current += 1;
      if (now - previous >= 1_000) {
        const fps = frames.current * 1_000 / (now - previous);
        const currentMessages = messages.current ?? 0;
        const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
        setStats({ fps: Math.round(fps), frame: 1_000 / fps, mps: currentMessages - lastMessages, memory: heap ? `${(heap / 1048576).toFixed(1)} MB` : 'N/A' });
        frames.current = 0; previous = now; lastMessages = currentMessages;
      }
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', keydown); };
  }, [messages]);
  if (!visible) return <div className="perf-hint">` PERF</div>;
  return <div className="performance-overlay"><b>RENDER DIAGNOSTICS</b><span>FPS <em>{stats.fps}</em></span><span>FRAME <em>{stats.frame.toFixed(1)} ms</em></span><span>WS RATE <em>{stats.mps}/s</em></span><span>TERRAIN <em>5,655 vtx</em></span><span>PARTICLES <em>840</em></span><span>HEAP <em>{stats.memory}</em></span></div>;
}
