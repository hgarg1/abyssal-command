export type MissionPhase =
  | 'PLANNING' | 'DESCENDING' | 'TRANSIT' | 'SEARCHING'
  | 'INVESTIGATING' | 'SAMPLING' | 'RETURNING' | 'COMPLETE' | 'ABORTED';

export type Telemetry = {
  depth: number;
  heading: number;
  pitch: number;
  roll: number;
  verticalVelocity: number;
  forwardVelocity: number;
  hullPressure: number;
  internalPressure: number;
  exteriorTemperature: number;
  battery: number;
  oxygen: number;
  co2: number;
  sonarRange: number;
  signalStrength: number;
  ballast: number;
  propulsion: number;
  seabedDistance: number;
  hullIntegrity: number;
};

export type Drone = {
  id: string;
  name: string;
  battery: number;
  depth: number;
  position: [number, number];
  heading: number;
  signal: number;
  objective: string;
  payload: string;
  status: 'DOCKED' | 'ACTIVE' | 'RETURNING' | 'HOLDING';
};

export type SonarContact = {
  id: string;
  bearing: number;
  range: number;
  strength: number;
  classification: 'UNKNOWN' | 'BIOLOGICAL' | 'GEOLOGICAL' | 'ARTIFICIAL';
  confidence: number;
  label: string;
};

export type Mission = {
  id: string;
  title: string;
  objective: string;
  target: { lat: number; lon: number; depth: number };
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  assignedDrones: string[];
  waypoints: Array<{ x: number; z: number; label: string }>;
  notes: string;
  risk: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  phase: MissionPhase;
};

export type SystemEvent = {
  id: string;
  simTime: number;
  type: 'INFO' | 'DISCOVERY' | 'WARNING' | 'CRITICAL' | 'DRONE';
  title: string;
  detail: string;
};

export type Emergency = null | {
  type: 'HULL_PRESSURE' | 'NAVIGATION_HAZARD' | 'POWER_FAILURE' | 'COMMUNICATION_LOSS' | 'SONAR_CONTACT';
  severity: 'WARNING' | 'CRITICAL';
  message: string;
};

export type OceanCurrent = {
  bearing: number;
  speed: number;
  vertical: number;
  turbulence: number;
};

export type GeologicalEventKind = 'MICROQUAKE' | 'VENT_ERUPTION' | 'SLOPE_FAILURE';

export type GeologicalEvent = {
  id: string;
  kind: GeologicalEventKind;
  label: string;
  startTime: number;
  duration: number;
  magnitude: number;
  x: number;
  z: number;
  radius: number;
};

export type GeologyState = {
  activity: number;
  revision: number;
  deformation: { ventGrowth: number; fracture: number; slump: number };
  events: GeologicalEvent[];
};

export type SimulationState = {
  telemetry: Telemetry;
  targetDepth: number;
  mission: Mission;
  drones: Drone[];
  contacts: SonarContact[];
  events: SystemEvent[];
  explored: number;
  simTime: number;
  timeScale: number;
  paused: boolean;
  connected: boolean;
  floodlights: boolean;
  focusedContact: string | null;
  emergency: Emergency;
  current: OceanCurrent;
  geology: GeologyState;
  sequence: number;
};

export type Command =
  | { type: 'SET_DEPTH'; value: number }
  | { type: 'SET_HEADING'; value: number }
  | { type: 'SET_TIME_SCALE'; value: number }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'TOGGLE_LIGHTS' }
  | { type: 'FOCUS_CONTACT'; contactId: string }
  | { type: 'DRONE'; droneId: string; action: 'LAUNCH' | 'RETURN' | 'HOLD' | 'SAMPLE' }
  | { type: 'ABORT_MISSION' }
  | { type: 'CLEAR_EMERGENCY' };
