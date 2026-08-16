import { Pause, Play } from 'lucide-react';
import type { Command, SimulationState } from '../types';

export function Timeline({ state, command }: { state: SimulationState; command: (command: Command) => void }) {
  const points = Array.from({ length: 70 }, (_, index) => {
    const x = index / 69 * 680;
    const y = 52 + Math.sin(index * 0.17) * 10 + Math.sin(index * 0.055) * 20 + index * 0.2;
    return `${x},${Math.min(118, y)}`;
  }).join(' ');
  return (
    <footer className="timeline">
      <div className="timeline-chart">
        <div className="section-cap">Event timeline <span>Depth (m)</span></div>
        <svg viewBox="0 0 680 128" preserveAspectRatio="none" aria-label="Mission depth history">
          <defs><linearGradient id="depthFill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#20bdec" stopOpacity=".28" /><stop offset="1" stopColor="#20bdec" stopOpacity="0" /></linearGradient></defs>
          {[22, 54, 86, 118].map((y) => <line key={y} x1="0" x2="680" y1={y} y2={y} />)}
          <polyline points={points} className="timeline-line" />
          <polygon points={`0,128 ${points} 680,128`} fill="url(#depthFill)" />
          {state.events.slice(-5).map((event, i) => <g key={event.id} transform={`translate(${90 + i * 126} 0)`}><line y1="20" y2="112" className={`event-line ${event.type.toLowerCase()}`} /><circle cy={48 + i % 2 * 18} r="4" className={event.type.toLowerCase()} /></g>)}
        </svg>
      </div>
      <div className="sim-controls">
        <div className="section-cap">Current sim time</div>
        <strong>{formatClock(state.simTime)}</strong>
        <small>T+ {Math.floor(state.simTime).toString().padStart(5, '0')} SEC</small>
        <div className="time-label">Time scale</div>
        <div className="speed-buttons">{[0.5, 1, 2, 5, 10].map((speed) => <button className={state.timeScale === speed ? 'active' : ''} onClick={() => command({ type: 'SET_TIME_SCALE', value: speed })} key={speed}>{speed}×</button>)}</div>
        <button className="pause-button" onClick={() => command({ type: 'TOGGLE_PAUSE' })}>{state.paused ? <Play size={14} /> : <Pause size={14} />} {state.paused ? 'Resume' : 'Pause'}</button>
      </div>
    </footer>
  );
}

const formatClock = (seconds: number) => new Date(seconds * 1_000).toISOString().slice(11, 19);
