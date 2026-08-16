import { describe, expect, it } from 'vitest';
import { parseCommand } from '../server/commands.js';
import { oceanZone, SimulationEngine } from '../server/simulation/engine.js';

describe('simulation engine', () => {
  it('moves smoothly toward an authoritative depth target', () => {
    const engine = new SimulationEngine();
    const before = engine.snapshot().telemetry.depth;
    engine.command({ type: 'SET_DEPTH', value: 5_000 });
    expect(engine.snapshot().targetDepth).toBe(5_000);
    const after = engine.tick(0.25).telemetry;
    expect(after.depth).toBeGreaterThan(before);
    expect(after.depth - before).toBeLessThan(2);
    expect(after.verticalVelocity).toBeGreaterThan(0);
  });

  it('advances sonar confidence only for the focused contact', () => {
    const engine = new SimulationEngine();
    engine.command({ type: 'FOCUS_CONTACT', contactId: 'S-076' });
    const before = engine.snapshot().contacts.find((c) => c.id === 'S-076')!.confidence;
    const after = engine.tick(1).contacts.find((c) => c.id === 'S-076')!.confidence;
    expect(after).toBeGreaterThan(before);
  });

  it('applies drone commands on the server', () => {
    const engine = new SimulationEngine();
    engine.command({ type: 'DRONE', droneId: 'D-03', action: 'LAUNCH' });
    expect(engine.snapshot().drones[2].status).toBe('ACTIVE');
  });

  it('simulates a bounded ocean-current field that drifts active drones', () => {
    const engine = new SimulationEngine();
    const before = engine.snapshot();
    const after = engine.tick(1);
    expect(after.current.speed).toBeGreaterThan(0.25);
    expect(after.current.speed).toBeLessThan(1.36);
    expect(after.current.bearing).toBeGreaterThanOrEqual(0);
    expect(after.current.bearing).toBeLessThan(360);
    expect(after.drones[0].position).not.toEqual(before.drones[0].position);
  });

  it('emits geological events and persists terrain deformation', () => {
    const engine = new SimulationEngine();
    engine.command({ type: 'SET_TIME_SCALE', value: 10 });
    for (let index = 0; index < 3; index += 1) engine.tick(1);
    const geology = engine.snapshot().geology;
    expect(geology.events[0].kind).toBe('MICROQUAKE');
    expect(geology.deformation.fracture).toBeGreaterThan(0);
    expect(geology.revision).toBe(1);
  });
});

describe('command parser and ocean zones', () => {
  it('parses local natural-language commands', () => {
    expect(parseCommand('Descend to 5,200 m')).toEqual({ type: 'SET_DEPTH', value: 5200 });
    expect(parseCommand('Set heading 137°')).toEqual({ type: 'SET_HEADING', value: 137 });
    expect(parseCommand('Launch Drone 2')).toEqual({ type: 'DRONE', droneId: 'D-02', action: 'LAUNCH' });
  });

  it('names physical depth zones correctly', () => {
    expect(oceanZone(100)).toBe('EPIPELAGIC');
    expect(oceanZone(4_218)).toBe('ABYSSOPELAGIC');
    expect(oceanZone(8_000)).toBe('HADAL');
  });
});
