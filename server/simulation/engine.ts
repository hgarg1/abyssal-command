import { EventEmitter } from 'node:events';
import type { Command, GeologicalEvent, GeologicalEventKind, SimulationState, SystemEvent } from './types.js';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const approach = (value: number, target: number, maxDelta: number) =>
  value < target ? Math.min(target, value + maxDelta) : Math.max(target, value - maxDelta);

export function oceanZone(depth: number) {
  if (depth < 200) return 'EPIPELAGIC';
  if (depth < 1_000) return 'MESOPELAGIC';
  if (depth < 4_000) return 'BATHYPELAGIC';
  if (depth < 6_000) return 'ABYSSOPELAGIC';
  return 'HADAL';
}

export class SimulationEngine extends EventEmitter {
  private state: SimulationState;
  private targetDepth = 4_218;
  private targetHeading = 128.4;
  private ventStage = 0;
  private nextGeologicalEvent = 42;
  private geologicalEventIndex = 0;

  constructor() {
    super();
    this.state = seedState();
  }

  snapshot(): SimulationState {
    return structuredClone(this.state);
  }

  tick(realDeltaSeconds: number) {
    if (this.state.paused) return this.snapshot();
    const dt = Math.min(realDeltaSeconds, 1) * this.state.timeScale;
    const t = this.state.telemetry;
    this.state.simTime += dt;

    const depthBefore = t.depth;
    t.verticalVelocity = approach(t.verticalVelocity, clamp((this.targetDepth - t.depth) * 0.08, -3.2, 3.2), dt * 0.7);
    t.depth = clamp(t.depth + t.verticalVelocity * dt, 0, 10_984);
    const headingDelta = ((this.targetHeading - t.heading + 540) % 360) - 180;
    t.heading = (t.heading + clamp(headingDelta, -dt * 4, dt * 4) + 360) % 360;
    t.pitch = Math.sin(this.state.simTime * 0.13) * 0.8 + t.verticalVelocity * 0.18;
    t.roll = Math.sin(this.state.simTime * 0.09) * 1.1;
    t.forwardVelocity = approach(t.forwardVelocity, this.state.mission.phase === 'RETURNING' ? 2.4 : 1.6, dt * 0.15);
    t.hullPressure = 0.101 + t.depth * 0.01008;
    t.exteriorTemperature = 4.1 - Math.min(t.depth / 1800, 3.1) + (this.ventStage >= 2 ? 1.7 : 0);
    t.battery = clamp(t.battery - dt * 0.0008 * (t.propulsion / 60), 0, 100);
    t.oxygen = clamp(t.oxygen - dt * 0.00012, 0, 100);
    t.co2 = clamp(t.co2 + dt * 0.00002, 0, 3);
    t.signalStrength = clamp(99 - t.depth / 210 - Math.sin(this.state.simTime * 0.05) * 2, 25, 100);
    t.seabedDistance = 184 + Math.sin(this.state.simTime * 0.08) * 26 - Math.max(0, t.depth - 5_400) * 0.04;
    t.hullIntegrity = clamp(100 - Math.max(0, t.hullPressure - 58) * 0.15, 0, 100);
    t.ballast = clamp(50 + t.verticalVelocity * 10, 0, 100);

    const current = this.state.current;
    current.bearing = (68 + Math.sin(this.state.simTime * 0.013) * 17 + 360) % 360;
    current.speed = clamp(0.72 + Math.sin(this.state.simTime * 0.027) * 0.18 + t.depth / 28_000, 0.25, 1.35);
    current.vertical = Math.sin(this.state.simTime * 0.041) * 0.09;
    current.turbulence = clamp(0.2 + Math.abs(Math.sin(this.state.simTime * 0.019)) * 0.31, 0, 1);
    t.roll += Math.sin(this.state.simTime * 0.57) * current.turbulence * 0.3;
    t.pitch += Math.cos(this.state.simTime * 0.43) * current.turbulence * 0.2;
    const currentRadians = current.bearing * Math.PI / 180;
    const currentDriftX = Math.cos(currentRadians) * current.speed;
    const currentDriftZ = Math.sin(currentRadians) * current.speed;

    for (const drone of this.state.drones) {
      if (drone.status === 'ACTIVE') {
        drone.battery = clamp(drone.battery - dt * 0.004, 0, 100);
        drone.heading = (drone.heading + Math.sin(this.state.simTime * 0.07 + Number(drone.id.slice(-1))) * dt * 2 + 360) % 360;
        drone.position[0] += Math.cos(drone.heading * Math.PI / 180) * dt * 0.008;
        drone.position[1] += Math.sin(drone.heading * Math.PI / 180) * dt * 0.008;
        drone.position[0] += currentDriftX * dt * 0.0025;
        drone.position[1] += currentDriftZ * dt * 0.0025;
        drone.depth = t.depth + Math.sin(this.state.simTime * 0.11) * 18;
        drone.signal = clamp(100 - Math.hypot(...drone.position) * 2.4, 30, 100);
      } else if (drone.status === 'RETURNING') {
        drone.position[0] = approach(drone.position[0], 0, dt * 0.04);
        drone.position[1] = approach(drone.position[1], 0, dt * 0.04);
        if (Math.hypot(...drone.position) < 0.04) drone.status = 'DOCKED';
      }
    }

    if (this.state.focusedContact) {
      const contact = this.state.contacts.find((item) => item.id === this.state.focusedContact);
      if (contact) {
        contact.confidence = clamp(contact.confidence + dt * 1.4, 0, 100);
        if (contact.confidence > 72 && contact.classification === 'UNKNOWN') {
          contact.classification = 'ARTIFICIAL';
          contact.label = 'PROBABLE SHIPWRECK';
          this.addEvent('DISCOVERY', `${contact.id} CLASSIFIED`, 'Artificial structure signature resolved by focused sonar.');
        }
      }
    }

    this.state.explored = clamp(this.state.explored + dt * 0.0018, 0, 100);
    this.advanceGeology();
    this.advanceVentSequence();
    this.evaluateEmergency();
    this.state.sequence += 1;
    this.emit('tick', this.snapshot());
    if (Math.floor(depthBefore / 200) !== Math.floor(t.depth / 200)) this.emit('sample', this.snapshot());
    return this.snapshot();
  }

  command(command: Command) {
    const t = this.state.telemetry;
    switch (command.type) {
      case 'SET_DEPTH':
        this.targetDepth = clamp(command.value, 0, 10_984);
        this.state.targetDepth = this.targetDepth;
        this.state.mission.phase = this.targetDepth < t.depth ? 'RETURNING' : 'DESCENDING';
        this.addEvent('INFO', 'DEPTH ORDER ACCEPTED', `New target depth ${Math.round(this.targetDepth).toLocaleString()} m.`);
        break;
      case 'SET_HEADING':
        this.targetHeading = ((command.value % 360) + 360) % 360;
        this.addEvent('INFO', 'HEADING ORDER ACCEPTED', `Turning to ${this.targetHeading.toFixed(0)}°.`);
        break;
      case 'SET_TIME_SCALE':
        this.state.timeScale = [0.5, 1, 2, 5, 10].includes(command.value) ? command.value : 1;
        break;
      case 'TOGGLE_PAUSE': this.state.paused = !this.state.paused; break;
      case 'TOGGLE_LIGHTS':
        this.state.floodlights = !this.state.floodlights;
        this.addEvent('INFO', `FLOODLIGHTS ${this.state.floodlights ? 'ONLINE' : 'DARK'}`, 'External illumination state changed.');
        break;
      case 'FOCUS_CONTACT': this.state.focusedContact = command.contactId; break;
      case 'DRONE': this.commandDrone(command.droneId, command.action); break;
      case 'ABORT_MISSION':
        this.state.mission.phase = 'ABORTED';
        this.targetDepth = 0;
        this.state.targetDepth = 0;
        this.addEvent('CRITICAL', 'MISSION ABORTED', 'Emergency ascent protocol initiated.');
        break;
      case 'CLEAR_EMERGENCY': this.state.emergency = null; break;
    }
    this.state.sequence += 1;
    this.emit('tick', this.snapshot());
    return this.snapshot();
  }

  private commandDrone(id: string, action: 'LAUNCH' | 'RETURN' | 'HOLD' | 'SAMPLE') {
    const drone = this.state.drones.find((item) => item.id === id);
    if (!drone) throw new Error(`Unknown drone ${id}`);
    if (action === 'LAUNCH') {
      drone.status = 'ACTIVE';
      drone.objective = 'Map vent perimeter';
    } else if (action === 'RETURN') {
      drone.status = 'RETURNING';
      drone.objective = 'Return to NEREID-7';
    } else if (action === 'HOLD') {
      drone.status = 'HOLDING';
      drone.objective = 'Hold position';
    } else {
      drone.status = 'ACTIVE';
      drone.objective = 'Collect vent-fluid sample';
    }
    this.addEvent('DRONE', `${drone.id} ${action}`, drone.objective);
  }

  private advanceGeology() {
    const geology = this.state.geology;
    geology.activity = clamp(0.18 + Math.abs(Math.sin(this.state.simTime * 0.031)) * 0.34, 0, 1);
    if (this.state.simTime < this.nextGeologicalEvent) return;

    const definitions: Array<{ kind: GeologicalEventKind; label: string; magnitude: number; x: number; z: number; radius: number; duration: number }> = [
      { kind: 'MICROQUAKE', label: 'RIDGE MICROQUAKE', magnitude: 3.8, x: -0.7, z: 0.8, radius: 3.2, duration: 18 },
      { kind: 'VENT_ERUPTION', label: 'VENT PULSE', magnitude: 4.6, x: 1.4, z: -0.6, radius: 2.1, duration: 24 },
      { kind: 'SLOPE_FAILURE', label: 'TRENCH-WALL SLUMP', magnitude: 5.1, x: -3.1, z: 1.5, radius: 2.8, duration: 28 },
    ];
    const definition = definitions[this.geologicalEventIndex % definitions.length];
    const event: GeologicalEvent = { id: crypto.randomUUID(), startTime: this.state.simTime, ...definition };
    geology.events = [event, ...geology.events].slice(0, 6);
    geology.revision += 1;
    geology.activity = clamp(0.55 + definition.magnitude / 10, 0, 1);
    if (definition.kind === 'MICROQUAKE') geology.deformation.fracture = clamp(geology.deformation.fracture + 0.16, 0, 1);
    if (definition.kind === 'VENT_ERUPTION') geology.deformation.ventGrowth = clamp(geology.deformation.ventGrowth + 0.2, 0, 1);
    if (definition.kind === 'SLOPE_FAILURE') geology.deformation.slump = clamp(geology.deformation.slump + 0.18, 0, 1);
    this.addEvent('WARNING', definition.label, `Magnitude ${definition.magnitude.toFixed(1)} geological event is deforming the local bathymetry.`);
    this.geologicalEventIndex += 1;
    this.nextGeologicalEvent += 52;
  }

  private advanceVentSequence() {
    const elapsed = this.state.simTime;
    if (this.ventStage === 0 && elapsed > 38) {
      this.ventStage = 1;
      this.addEvent('WARNING', 'THERMAL GRADIENT', 'Exterior temperature rising 1.8 °C across the last 300 m.');
    } else if (this.ventStage === 1 && elapsed > 75) {
      this.ventStage = 2;
      this.addEvent('DISCOVERY', 'CHEMICAL ANOMALY', 'Elevated sulfide concentration detected below waypoint WP-04.');
    } else if (this.ventStage === 2 && elapsed > 115) {
      this.ventStage = 3;
      this.state.mission.phase = 'INVESTIGATING';
      this.addEvent('DISCOVERY', 'VENT FIELD ALPHA', 'Black-smoker chimneys and dense biological activity confirmed.');
    }
  }

  private evaluateEmergency() {
    const t = this.state.telemetry;
    if (t.hullPressure > 61 && !this.state.emergency) {
      this.state.emergency = { type: 'HULL_PRESSURE', severity: 'WARNING', message: 'Pressure approaching engineering margin.' };
      this.addEvent('WARNING', 'HULL PRESSURE MARGIN', `${t.hullPressure.toFixed(1)} MPa external load.`);
    } else if (t.seabedDistance < 45 && t.verticalVelocity > 1 && !this.state.emergency) {
      this.state.emergency = { type: 'NAVIGATION_HAZARD', severity: 'CRITICAL', message: 'Terrain closure exceeds stopping envelope.' };
      this.addEvent('CRITICAL', 'NAVIGATION HAZARD', 'Emergency ballast compensation advised.');
    }
  }

  private addEvent(type: SystemEvent['type'], title: string, detail: string) {
    const event: SystemEvent = { id: crypto.randomUUID(), simTime: this.state.simTime, type, title, detail };
    this.state.events = [...this.state.events.slice(-19), event];
    this.emit('event', event);
  }
}

function seedState(): SimulationState {
  return {
    telemetry: {
      depth: 4_218, heading: 128.4, pitch: 0.2, roll: -0.4, verticalVelocity: 0,
      forwardVelocity: 1.6, hullPressure: 42.6, internalPressure: 0.101,
      exteriorTemperature: 1.2, battery: 76, oxygen: 81, co2: 0.42,
      sonarRange: 1_200, signalStrength: 98, ballast: 51, propulsion: 64,
      seabedDistance: 184, hullIntegrity: 98,
    },
    targetDepth: 4_218,
    mission: {
      id: 'mission-black-smoker', title: 'OPERATION BLACK SMOKER',
      objective: 'Survey and sample the Pelagia hydrothermal vent field.',
      target: { lat: 11.39745, lon: 142.30532, depth: 4_217 }, priority: 'HIGH',
      assignedDrones: ['D-01', 'D-02', 'D-03'],
      waypoints: [
        { x: -3.8, z: 1.8, label: 'WP-01' }, { x: 2.6, z: 1.2, label: 'WP-02' },
        { x: 4.1, z: -2.7, label: 'WP-03' }, { x: -0.8, z: -4.1, label: 'WP-04' },
      ],
      notes: 'Prioritize vent-fluid chemistry and sensor deployment.', risk: 'HIGH', phase: 'INVESTIGATING',
    },
    drones: [
      { id: 'D-01', name: 'TRITON', battery: 78, depth: 4_326, position: [3.2, -3.8], heading: 121, signal: 91, objective: 'Map north ridge', payload: 'Multibeam sonar', status: 'ACTIVE' },
      { id: 'D-02', name: 'NEREUS', battery: 62, depth: 4_185, position: [-2.8, 1.9], heading: 84, signal: 86, objective: 'Collect chimney sample', payload: 'Sampler arm', status: 'ACTIVE' },
      { id: 'D-03', name: 'THALASSA', battery: 91, depth: 4_218, position: [0, 0], heading: 0, signal: 100, objective: 'Stand by', payload: 'Camera array', status: 'DOCKED' },
    ],
    contacts: [
      { id: 'S-041', bearing: 42, range: 740, strength: 0.84, classification: 'GEOLOGICAL', confidence: 88, label: 'HYDROTHERMAL ANOMALY' },
      { id: 'S-076', bearing: 137, range: 980, strength: 0.48, classification: 'UNKNOWN', confidence: 31, label: 'UNRESOLVED ECHO' },
      { id: 'S-118', bearing: 264, range: 520, strength: 0.36, classification: 'BIOLOGICAL', confidence: 64, label: 'PELAGIC GROUP' },
    ],
    events: [
      { id: 'e1', simTime: 0, type: 'INFO', title: 'ENTERED AOI', detail: 'NEREID-7 crossed survey boundary.' },
      { id: 'e2', simTime: 8, type: 'DRONE', title: 'D-01 DEPLOYED', detail: 'North-ridge mapping pattern active.' },
      { id: 'e3', simTime: 18, type: 'DISCOVERY', title: 'THERMAL VENT DETECTED', detail: 'Anomalous terrain return at WP-04.' },
    ],
    explored: 37, simTime: 24, timeScale: 1, paused: false, connected: true,
    floodlights: true, focusedContact: 'S-041', emergency: null,
    current: { bearing: 68, speed: 0.88, vertical: -0.04, turbulence: 0.24 }, sequence: 0,
    geology: { activity: 0.22, revision: 0, deformation: { ventGrowth: 0, fracture: 0, slump: 0 }, events: [] },
  };
}
