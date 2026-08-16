import type { Command } from './simulation/types.js';

export function parseCommand(input: string): Command | null {
  const value = input.trim().toLowerCase();
  let match = value.match(/(?:descend|dive|depth|ascend)(?:\s+to)?\s+([\d,]+)/);
  if (match) return { type: 'SET_DEPTH', value: Number(match[1].replaceAll(',', '')) };
  match = value.match(/(?:set\s+)?heading\s+([\d.]+)/);
  if (match) return { type: 'SET_HEADING', value: Number(match[1]) };
  match = value.match(/(?:launch|deploy)\s+(?:drone\s+)?(?:d-?)?(\d+)/);
  if (match) return { type: 'DRONE', droneId: `D-0${match[1]}`, action: 'LAUNCH' };
  match = value.match(/(?:recall|return)\s+(?:drone\s+)?(?:d-?)?(\d+)/);
  if (match) return { type: 'DRONE', droneId: `D-0${match[1]}`, action: 'RETURN' };
  match = value.match(/focus(?:\s+sonar)?(?:\s+contact)?\s+(s-?\d+)/);
  if (match) return { type: 'FOCUS_CONTACT', contactId: match[1].toUpperCase().replace(/^S(\d)/, 'S-$1') };
  if (/kill|disable|toggle.*light|floodlight/.test(value)) return { type: 'TOGGLE_LIGHTS' };
  if (/return to surface|surface/.test(value)) return { type: 'SET_DEPTH', value: 0 };
  if (/abort/.test(value)) return { type: 'ABORT_MISSION' };
  if (/pause|resume/.test(value)) return { type: 'TOGGLE_PAUSE' };
  return null;
}
