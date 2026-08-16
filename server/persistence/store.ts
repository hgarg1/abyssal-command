import type { Mission, SimulationState, SystemEvent } from '../simulation/types.js';

export interface MissionStore {
  saveMission(mission: Mission): void;
  listMissions(): Mission[];
  saveEvent(event: SystemEvent): void;
  sample(state: SimulationState): void;
  history(limit?: number): unknown[];
  close(): void;
}
