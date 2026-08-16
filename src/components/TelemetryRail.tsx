import { Activity, BatteryMedium, Crosshair, Gauge, Radio, Shield, Thermometer, Wind } from 'lucide-react';
import type { Command, SimulationState } from '../types';

const MAX_DEPTH = 10_984;
const DEPTH_STEP = 100;

const depthMarks = [
  [0, 'SURFACE'], [200, 'SUNLIGHT LIMIT'], [1_000, 'TWILIGHT ZONE'], [3_810, 'TITANIC WRECK'],
  [4_000, 'AVERAGE OCEAN'], [6_000, 'ABYSSAL PLAIN'], [8_848, 'EVEREST INVERTED'], [10_984, 'CHALLENGER DEEP'],
] as const;

export function TelemetryRail({ state, command }: { state: SimulationState; command: (value: Command) => void }) {
  const t = state.telemetry;
  const zone = t.depth < 200 ? 'EPIPELAGIC' : t.depth < 1_000 ? 'MESOPELAGIC' : t.depth < 4_000 ? 'BATHYPELAGIC' : t.depth < 6_000 ? 'ABYSSOPELAGIC' : 'HADAL';
  const setTargetDepth = (value: number, snap = 1) => command({ type: 'SET_DEPTH', value: Math.min(MAX_DEPTH, Math.max(0, Math.round(value / snap) * snap)) });
  const setDepthFromPointer = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTargetDepth(((event.clientY - rect.top) / rect.height) * MAX_DEPTH, 25);
  };
  const changeDepthFromKeyboard = (event: React.KeyboardEvent<HTMLElement>) => {
    const steps: Partial<Record<string, number>> = {
      ArrowUp: -DEPTH_STEP, ArrowLeft: -DEPTH_STEP, ArrowDown: DEPTH_STEP, ArrowRight: DEPTH_STEP,
      PageUp: -500, PageDown: 500, Home: -state.targetDepth, End: MAX_DEPTH - state.targetDepth,
    };
    const delta = steps[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    setTargetDepth(state.targetDepth + delta);
  };
  const targetDelta = state.targetDepth - t.depth;
  const travelState = Math.abs(targetDelta) < 5 ? 'HOLDING DEPTH' : targetDelta > 0 ? 'DESCENDING' : 'ASCENDING';
  return (
    <aside className="telemetry-rail" aria-label="Depth and vessel telemetry">
      <section className="depth-summary">
        <div className="section-cap">Depth & environment</div>
        <strong>{t.depth.toLocaleString(undefined, { maximumFractionDigits: 0 })}<small>m</small></strong>
        <div className="pressure-readout"><span>{t.hullPressure.toFixed(1)} MPa</span><small>Pressure</small></div>
        <div className="zone-readout"><span>{zone}</span><small>Ocean zone</small></div>
      </section>

      <section className="depth-scale" aria-label="Depth command control">
        <div className="depth-scale-title"><Crosshair size={10} /> Depth command</div>
        <div
          className="depth-control"
          role="slider"
          tabIndex={0}
          aria-label="Target vessel depth"
          aria-valuemin={0}
          aria-valuemax={MAX_DEPTH}
          aria-valuenow={Math.round(state.targetDepth)}
          aria-valuetext={`${Math.round(state.targetDepth).toLocaleString()} meters, ${travelState.toLowerCase()}`}
          onPointerDown={setDepthFromPointer}
          onKeyDown={changeDepthFromKeyboard}
        >
          <div className="depth-gradient"><div className="vessel-depth" style={{ top: `${t.depth / MAX_DEPTH * 100}%` }}><i /> <b>{t.depth.toFixed(0)} m</b><span>NEREID-7</span></div></div>
          <div className="target-depth" style={{ top: `${state.targetDepth / MAX_DEPTH * 100}%` }}><i /><b>TARGET {state.targetDepth.toFixed(0)} m</b></div>
          {depthMarks.map(([depth, label]) => (
            <div className="depth-mark" key={depth} style={{ top: `${Math.min(98, depth / MAX_DEPTH * 100)}%` }}><i /><b>{depth.toLocaleString()} m</b><span>{label}</span></div>
          ))}
        </div>
        <div className="depth-scale-help"><span>{travelState}</span><small>CLICK · ↑↓ 100 M</small></div>
      </section>

      <section className="telemetry-list">
        <div className="section-cap">Telemetry</div>
        <Metric icon={<Gauge />} label="Heading" value={`${t.heading.toFixed(1)}°`} />
        <Metric icon={<Activity />} label="Velocity" value={`${t.forwardVelocity.toFixed(1)} kn`} />
        <Metric icon={<Shield />} label="Hull integrity" value={`${t.hullIntegrity.toFixed(0)}%`} bar={t.hullIntegrity} />
        <Metric icon={<BatteryMedium />} label="Battery" value={`${t.battery.toFixed(0)}%`} bar={t.battery} />
        <Metric icon={<Wind />} label="Oxygen" value={`${t.oxygen.toFixed(0)}%`} />
        <Metric icon={<span className="co2">CO₂</span>} label="CO₂ level" value={`${t.co2.toFixed(2)}%`} />
        <Metric icon={<Thermometer />} label="Temperature" value={`${t.exteriorTemperature.toFixed(1)}°C`} />
        <Metric icon={<Radio />} label="Signal" value={`${t.signalStrength.toFixed(0)}%`} bar={t.signalStrength} />
        <div className="system-status">
          <div className="section-cap">System status</div>
          {['PROPULSION', 'MANIPULATOR', 'SONAR', 'SENSORS', 'COMMUNICATIONS', 'NAVIGATION'].map((system) => <div key={system}><span>{system}</span><b>NOMINAL</b><i /></div>)}
        </div>
      </section>
    </aside>
  );
}

function Metric({ icon, label, value, bar }: { icon: React.ReactNode; label: string; value: string; bar?: number }) {
  return <div className="metric"><div className="metric-icon">{icon}</div><span>{label}</span><b>{value}</b>{bar !== undefined && <i><span style={{ width: `${bar}%` }} /></i>}</div>;
}
