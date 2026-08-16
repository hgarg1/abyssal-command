import type { Mission, SimulationState, SystemEvent } from '../simulation/types.js';
import type { MissionStore } from './store.js';

type TelemetrySample = {
  simTime: number;
  telemetry: SimulationState['telemetry'];
  drones: SimulationState['drones'];
  contacts: SimulationState['contacts'];
};

export class MemoryMissionStore implements MissionStore {
  private missions = new Map<string, Mission>();
  private events = new Map<string, SystemEvent>();
  private samples: TelemetrySample[] = [];

  saveMission(mission: Mission) {
    this.missions.set(mission.id, structuredClone(mission));
  }

  listMissions() {
    return [...this.missions.values()].map((mission) => structuredClone(mission));
  }

  saveEvent(event: SystemEvent) {
    this.events.set(event.id, structuredClone(event));
  }

  sample(state: SimulationState) {
    this.samples.push(structuredClone({
      simTime: state.simTime,
      telemetry: state.telemetry,
      drones: state.drones,
      contacts: state.contacts,
    }));
    this.samples = this.samples.slice(-12_000);
  }

  history(limit = 900) {
    return structuredClone(this.samples.slice(-limit));
  }

  close() {
    this.missions.clear();
    this.events.clear();
    this.samples = [];
  }
}
