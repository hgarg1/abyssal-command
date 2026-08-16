import { useCallback, useEffect, useRef, useState } from 'react';
import type { Command, SimulationState, Telemetry } from '../types';
import { socket } from '../lib/socket';

const interpolateTelemetry = (current: Telemetry, target: Telemetry, factor: number): Telemetry => {
  const result = { ...target };
  for (const key of Object.keys(target) as Array<keyof Telemetry>) {
    result[key] = current[key] + (target[key] - current[key]) * factor;
  }
  return result;
};

export function useSimulation() {
  const [state, setState] = useState<SimulationState | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'reconnecting'>('connecting');
  const target = useRef<SimulationState | null>(null);
  const visible = useRef<SimulationState | null>(null);
  const messages = useRef(0);

  useEffect(() => {
    const receive = (incoming: SimulationState) => {
      messages.current += 1;
      target.current = incoming;
      if (!visible.current) {
        visible.current = incoming;
        setState(incoming);
      }
    };
    socket.on('state', receive);
    socket.on('telemetry', receive);
    socket.on('connect', () => setConnection('live'));
    socket.on('disconnect', () => setConnection('reconnecting'));

    let frame = 0;
    let previous = performance.now();
    const animate = (now: number) => {
      if (target.current && visible.current) {
        const delta = Math.min((now - previous) / 1_000, 0.1);
        const next = {
          ...target.current,
          telemetry: interpolateTelemetry(visible.current.telemetry, target.current.telemetry, 1 - Math.exp(-delta * 8)),
        };
        visible.current = next;
        setState(next);
      }
      previous = now;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      socket.off('state', receive);
      socket.off('telemetry', receive);
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  const command = useCallback((value: Command) => socket.emit('command', value), []);
  return { state, connection, command, messages };
}
