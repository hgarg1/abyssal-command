import { Check, Circle, Crosshair, Navigation, Radio, Rocket, RotateCcw, ScanLine } from 'lucide-react';
import type { Command, SimulationState } from '../types';

const objectives = [
  ['Survey hydrothermal vent field', true],
  ['Collect chimney samples', true],
  ['Deploy long-term sensors', true],
  ['Analyze vent-fluid chemistry', false],
  ['Return to rally point', false],
] as const;

export function MissionRail({ state, command }: { state: SimulationState; command: (command: Command) => void }) {
  const completedObjectives = objectives.filter(([, complete]) => complete).length;
  const activeDrones = state.drones.filter((drone) => drone.status !== 'DOCKED');
  const targetDelta = state.mission.target.depth - state.telemetry.depth;
  const targetStatus = Math.abs(targetDelta) < 5
    ? 'ON DEPTH'
    : `${Math.abs(targetDelta).toFixed(0)} m ${targetDelta > 0 ? 'ABOVE' : 'BELOW'}`;
  const recallAll = () => activeDrones.forEach((drone) => command({ type: 'DRONE', droneId: drone.id, action: 'RETURN' }));
  return (
    <aside className="mission-rail" aria-label="Mission and drone controls">
      <section className="instrument mission-block">
        <div className="section-cap"><Navigation size={12} /> Active mission <span className={`mission-risk ${state.mission.risk.toLowerCase()}`}>Risk {state.mission.risk}</span></div>
        <div className="mission-heading">
          <h2>{state.mission.title}</h2>
          <p>{state.mission.objective}</p>
        </div>
        <div className="mission-phase-row"><div><span>Current phase</span><strong className="phase">{state.mission.phase}</strong></div><ScanLine size={22} /></div>
        <div className="mission-facts">
          <div><span>Target depth</span><b>{state.mission.target.depth.toLocaleString()} m</b><small>{targetStatus}</small></div>
          <div><span>Objectives</span><b>{completedObjectives} / {objectives.length}</b><small>{Math.round(completedObjectives / objectives.length * 100)}% COMPLETE</small></div>
          <div><span>Drones active</span><b>{activeDrones.length} / {state.drones.length}</b><small>{state.drones.length - activeDrones.length} DOCKED</small></div>
        </div>
        <div className="mission-progress"><span style={{ width: `${completedObjectives / objectives.length * 100}%` }} /></div>
        <div className="mission-actions">
          <button onClick={() => command({ type: 'SET_DEPTH', value: state.mission.target.depth })}><Crosshair size={11} /> Set target depth</button>
          <button disabled={!activeDrones.length} onClick={recallAll}><RotateCcw size={11} /> Recall all</button>
        </div>
      </section>

      <section className="instrument objectives">
        <div className="section-cap"><Crosshair size={12} /> Mission objectives <span>3/5</span></div>
        {objectives.map(([label, complete], index) => (
          <div className={`objective ${index === 3 ? 'active' : ''}`} key={label}>
            {complete ? <Check size={13} /> : <Circle size={11} />}
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="drone-section">
        <div className="section-cap"><Radio size={12} /> Drone roster <span>{state.drones.filter((d) => d.status !== 'DOCKED').length}/3</span></div>
        {state.drones.map((drone) => (
          <article className={`drone-row ${drone.status === 'ACTIVE' ? 'online' : ''}`} key={drone.id}>
            <div className="drone-glyph"><Rocket size={21} /></div>
            <div className="drone-ident"><b>{drone.id}</b><span>{drone.name}</span><em>{drone.status}</em></div>
            <div className="drone-stat"><span>Battery</span><b>{drone.battery.toFixed(0)}%</b><i style={{ '--level': `${drone.battery}%` } as React.CSSProperties} /></div>
            <div className="drone-stat"><span>Depth</span><b>{drone.status === 'DOCKED' ? '—' : `${drone.depth.toFixed(0)} m`}</b></div>
            <div className="drone-actions">
              <button disabled={drone.status !== 'DOCKED'} onClick={() => command({ type: 'DRONE', droneId: drone.id, action: 'LAUNCH' })}>Launch</button>
              <button disabled={drone.status === 'DOCKED'} onClick={() => command({ type: 'DRONE', droneId: drone.id, action: 'RETURN' })}><RotateCcw size={11} /> Recall</button>
            </div>
          </article>
        ))}
      </section>

      <section className="instrument mission-log">
        <div className="section-cap">Mission log <span>Live</span></div>
        {state.events.slice(-5).reverse().map((event) => (
          <div className="log-row" key={event.id}>
            <time>{formatClock(event.simTime)}</time><span>{event.title}</span>
          </div>
        ))}
      </section>
    </aside>
  );
}

const formatClock = (seconds: number) => new Date(seconds * 1_000).toISOString().slice(14, 19);
