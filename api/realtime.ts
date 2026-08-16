import { MemoryMissionStore } from '../server/persistence/memory.js';
import { createSimulationRuntime } from '../server/runtime.js';

const runtime = createSimulationRuntime(new MemoryMissionStore());

export default runtime.server;
