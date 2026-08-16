import { AlertTriangle, Aperture, Eye, Layers3, Lightbulb, Map, Maximize2, Menu, Minimize2, Radio, Satellite, Settings2, ShipWheel, Waves } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { lazy, Suspense, useEffect, useState } from 'react';
import { CommandPalette } from './components/CommandPalette';
import { MissionRail } from './components/MissionRail';
import { PerformanceOverlay } from './components/PerformanceOverlay';
import { SonarDisplay } from './components/SonarDisplay';
import { TelemetryRail } from './components/TelemetryRail';
import { Timeline } from './components/Timeline';
import { useSimulation } from './hooks/useSimulation';
import type { Command } from './types';

type ViewMode = 'MAP' | 'SONAR' | 'EXTERNAL';
type MapLayers = { bathymetry: boolean; currents: boolean; geology: boolean; markers: boolean };
const TerrainScene = lazy(() => import('./components/TerrainScene').then((module) => ({ default: module.TerrainScene })));
type Layout = { left: number; right: number; leftOpen: boolean; rightOpen: boolean; timelineOpen: boolean };
const defaultLayout: Layout = { left: 286, right: 308, leftOpen: true, rightOpen: true, timelineOpen: true };

export default function App() {
  const { state, connection, command, messages } = useSimulation();
  const [view, setView] = useState<ViewMode>('MAP');
  const [layers, setLayers] = useState<MapLayers>({ bathymetry: true, currents: true, geology: true, markers: true });
  const [layersOpen, setLayersOpen] = useState(false);
  const [recenterToken, setRecenterToken] = useState(0);
  const [viewBearing, setViewBearing] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [layout, setLayout] = useState<Layout>(() => {
    try {
      const restored = { ...defaultLayout, ...JSON.parse(localStorage.getItem('abyssal-layout') ?? '{}') };
      return window.innerWidth <= 820 ? { ...restored, leftOpen: false, rightOpen: false } : restored;
    } catch { return window.innerWidth <= 820 ? { ...defaultLayout, leftOpen: false, rightOpen: false } : defaultLayout; }
  });
  useEffect(() => localStorage.setItem('abyssal-layout', JSON.stringify(layout)), [layout]);
  const toggleFullscreen = () => setFocusMode((active) => !active);

  const startResize = (side: 'left' | 'right', start: React.PointerEvent) => {
    start.currentTarget.setPointerCapture(start.pointerId);
    const origin = start.clientX; const initial = layout[side];
    const move = (event: PointerEvent) => setLayout((current) => ({ ...current, [side]: Math.max(236, Math.min(390, initial + (side === 'left' ? event.clientX - origin : origin - event.clientX))) }));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  if (!state) return <div className="boot-screen"><div className="boot-mark"><span /><b>N7</b></div><h1>ABYSSAL COMMAND</h1><p>Establishing acoustic link to NEREID-7</p><i /></div>;
  const t = state.telemetry;
  const screenCurrentBearing = (state.current.bearing - viewBearing + 360) % 360;
  const send = (value: Command) => command(value);

  return (
    <main className={`app-shell ${state.emergency ? 'emergency-state' : ''} ${focusMode ? 'focus-mode' : ''}`} style={{ '--left-rail': layout.leftOpen ? `${layout.left}px` : '0px', '--right-rail': layout.rightOpen ? `${layout.right}px` : '0px' } as React.CSSProperties}>
      <header className="top-rail">
        <div className="brand"><div className="brand-mark"><span /><span /><span /></div><div><h1>ABYSSAL COMMAND</h1><small>NEREID-7 COMMAND INTERFACE v2.7.4</small></div></div>
        <div className="top-metrics">
          <TopMetric label="Sim time" value={new Date(state.simTime * 1_000).toISOString().slice(11, 19)} />
          <TopMetric label="Mode" value="AUTONOMOUS" />
          <TopMetric label="Comms" value="ARGO NET" icon={<Satellite size={12} />} />
          <TopMetric label="Link" value={`${t.signalStrength.toFixed(0)}%`} tone={connection === 'live' ? 'good' : 'warn'} />
          <TopMetric label="Systems" value={state.emergency ? state.emergency.severity : 'NOMINAL'} tone={state.emergency ? 'warn' : 'good'} />
        </div>
        <div className="panel-controls" aria-label="Panel visibility controls">
          <button title="Toggle mission panel" aria-label="Toggle mission panel" aria-pressed={layout.leftOpen} className={layout.leftOpen ? 'active' : ''} onClick={() => setLayout((value) => ({ ...value, leftOpen: !value.leftOpen }))}><Menu /><span>Mission</span></button>
          <button title="Toggle telemetry panel" aria-label="Toggle telemetry panel" aria-pressed={layout.rightOpen} className={layout.rightOpen ? 'active' : ''} onClick={() => setLayout((value) => ({ ...value, rightOpen: !value.rightOpen }))}><Settings2 /><span>Telemetry</span></button>
        </div>
        <CommandPalette />
      </header>

      <AnimatePresence initial={false}>{layout.leftOpen && <motion.div className="left-shell" initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0 }}><MissionRail state={state} command={send} /><div className="resize-handle left" onPointerDown={(e) => startResize('left', e)} /></motion.div>}</AnimatePresence>

      <section className="command-canvas">
        <div className="canvas-toolbar">
          <div className="view-tabs">{(['MAP', 'SONAR', 'EXTERNAL'] as ViewMode[]).map((mode) => <button key={mode} className={view === mode ? 'active' : ''} onClick={() => setView(mode)}>{mode === 'MAP' ? <Map /> : mode === 'SONAR' ? <Radio /> : <Eye />}{mode}</button>)}</div>
          <div className="canvas-tool-cluster">
            <div className="canvas-tools">
              <CanvasTool label="Map layers" active={layersOpen} pressed={layersOpen} onClick={() => setLayersOpen((open) => !open)} icon={<Layers3 />} />
              <CanvasTool label="Recenter map" onClick={() => setRecenterToken((token) => token + 1)} icon={<Aperture />} />
              <CanvasTool label={state.floodlights ? 'Disable floodlights' : 'Enable floodlights'} active={state.floodlights} pressed={state.floodlights} onClick={() => { send({ type: 'TOGGLE_LIGHTS' }); }} icon={<Lightbulb />} />
              <CanvasTool label={focusMode ? 'Restore command layout' : 'Expand command canvas'} active={focusMode} pressed={focusMode} onClick={toggleFullscreen} icon={focusMode ? <Minimize2 /> : <Maximize2 />} />
            </div>
            <AnimatePresence>{layersOpen ? <motion.div className="layer-popover" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
              <div className="section-cap"><Layers3 size={11} /> Map layers</div>
              <LayerToggle label="Bathymetry mesh" enabled={layers.bathymetry} onToggle={() => setLayers((value) => ({ ...value, bathymetry: !value.bathymetry }))} />
              <LayerToggle label="Ocean currents" enabled={layers.currents} onToggle={() => setLayers((value) => ({ ...value, currents: !value.currents }))} />
              <LayerToggle label="Geological events" enabled={layers.geology} onToggle={() => setLayers((value) => ({ ...value, geology: !value.geology }))} />
              <LayerToggle label="Mission markers" enabled={layers.markers} onToggle={() => setLayers((value) => ({ ...value, markers: !value.markers }))} />
            </motion.div> : null}</AnimatePresence>
          </div>
        </div>
        <div className="coordinate-block"><b>N</b><ShipWheel /><span>LAT&nbsp; 11° 23.847′ N</span><span>LON&nbsp; 142° 18.392′ E</span><span>DPT&nbsp; {t.depth.toFixed(0)} m</span></div>
        <div className="main-visual" data-recenter-token={recenterToken}>
          {view === 'SONAR' ? <SonarDisplay state={state} command={send} /> : <Suspense fallback={<div className="render-loading">CALIBRATING BATHYMETRIC ARRAY</div>}><TerrainScene mission={state.mission} drones={state.drones} floodlights={state.floodlights} current={state.current} geology={state.geology} simTime={state.simTime} layers={layers} recenterToken={recenterToken} onViewBearingChange={setViewBearing} external={view === 'EXTERNAL'} /></Suspense>}
        </div>
        {view !== 'SONAR' && layers.currents ? <div className="current-hud" aria-label={`Ocean current ${state.current.speed.toFixed(2)} knots at ${state.current.bearing.toFixed(0)} degrees`}>
          <div className="current-arrow" data-screen-bearing={screenCurrentBearing.toFixed(1)} style={{ transform: `rotate(${screenCurrentBearing}deg)` }}><span /></div>
          <div><small><Waves size={10} /> Ocean current</small><b>{state.current.speed.toFixed(2)} kn</b><span>{state.current.bearing.toFixed(0).padStart(3, '0')}° · V {state.current.vertical >= 0 ? '+' : ''}{state.current.vertical.toFixed(2)} m/s</span></div>
        </div> : null}
        {view !== 'SONAR' && layers.geology ? <div className={`geology-hud ${state.geology.events.length ? 'active' : ''}`} aria-label="Geological activity monitor">
          <div className="geology-pulse"><i style={{ opacity: 0.4 + state.geology.activity * 0.6, transform: `scale(${0.8 + state.geology.activity * 0.45})` }} /></div>
          <div><small>Geological activity</small><b>{state.geology.events[0]?.label ?? 'TECTONIC BASELINE'}</b><span>{state.geology.events[0] ? `M ${state.geology.events[0].magnitude.toFixed(1)} · REV ${state.geology.revision}` : `${Math.round(state.geology.activity * 100)}% BACKGROUND`}</span></div>
        </div> : null}
        <div className="canvas-readout"><span>VEHICLE ALT&nbsp; {t.seabedDistance.toFixed(0)} m</span><span>SONAR RANGE&nbsp; {t.sonarRange.toFixed(0)} m</span><span>CURRENT&nbsp; {state.current.speed.toFixed(2)} kn / {state.current.bearing.toFixed(0)}°</span><span>MAPPED&nbsp; {state.explored.toFixed(1)}%</span></div>
      </section>

      <AnimatePresence initial={false}>{layout.rightOpen && <motion.div className="right-shell" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 30, opacity: 0 }}><div className="resize-handle right" onPointerDown={(e) => startResize('right', e)} /><TelemetryRail state={state} command={send} /></motion.div>}</AnimatePresence>

      {layout.timelineOpen && <Timeline state={state} command={send} />}
      <button className="timeline-toggle" onClick={() => setLayout((l) => ({ ...l, timelineOpen: !l.timelineOpen }))}>{layout.timelineOpen ? 'HIDE TIMELINE' : 'SHOW TIMELINE'}</button>

      <AnimatePresence>{state.emergency && <motion.div className="emergency-banner" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}><AlertTriangle /><div><b>{state.emergency.type.replaceAll('_', ' ')}</b><span>{state.emergency.message}</span></div><button onClick={() => send({ type: 'CLEAR_EMERGENCY' })}>Acknowledge</button></motion.div>}</AnimatePresence>
      <PerformanceOverlay messages={messages} />
    </main>
  );
}

function TopMetric({ label, value, icon, tone }: { label: string; value: string; icon?: React.ReactNode; tone?: string }) {
  return <div className={`top-metric ${tone ?? ''}`}><small>{label}</small><span>{icon}{value}</span></div>;
}

function CanvasTool({ label, icon, onClick, active = false, pressed }: { label: string; icon: React.ReactNode; onClick: () => void | Promise<void>; active?: boolean; pressed?: boolean }) {
  return <button type="button" className={active ? 'active' : ''} aria-label={label} aria-pressed={pressed} data-tooltip={label} onClick={onClick}>{icon}</button>;
}

function LayerToggle({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  return <button type="button" role="switch" aria-checked={enabled} onClick={onToggle}><span>{label}</span><i className={enabled ? 'enabled' : ''}><b /></i></button>;
}
