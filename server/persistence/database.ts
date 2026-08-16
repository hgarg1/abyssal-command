import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Mission, SimulationState, SystemEvent } from '../simulation/types.js';
import type { MissionStore } from './store.js';

export class MissionDatabase implements MissionStore {
  private db: DatabaseSync;

  constructor(path = resolve('data', 'abyssal.db')) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS missions (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        sim_time REAL NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sim_time REAL NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS discoveries (
        key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        discovered_at REAL NOT NULL
      );
    `);
  }

  saveMission(mission: Mission) {
    this.db.prepare(`
      INSERT INTO missions (id, payload, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
    `).run(mission.id, JSON.stringify(mission), Date.now());
  }

  listMissions(): Mission[] {
    return this.db.prepare('SELECT payload FROM missions ORDER BY updated_at DESC').all()
      .map((row) => JSON.parse(String((row as { payload: string }).payload)) as Mission);
  }

  saveEvent(event: SystemEvent) {
    this.db.prepare(`INSERT OR IGNORE INTO events (id, sim_time, type, title, detail) VALUES (?, ?, ?, ?, ?)`)
      .run(event.id, event.simTime, event.type, event.title, event.detail);
  }

  sample(state: SimulationState) {
    this.db.prepare('INSERT INTO telemetry (sim_time, payload) VALUES (?, ?)')
      .run(state.simTime, JSON.stringify({ telemetry: state.telemetry, drones: state.drones, contacts: state.contacts }));
    this.db.prepare(`
      DELETE FROM telemetry WHERE id NOT IN (SELECT id FROM telemetry ORDER BY id DESC LIMIT 12000)
    `).run();
  }

  history(limit = 900) {
    return this.db.prepare('SELECT sim_time, payload FROM telemetry ORDER BY id DESC LIMIT ?').all(limit)
      .reverse()
      .map((row) => ({ simTime: Number((row as { sim_time: number }).sim_time), ...JSON.parse(String((row as { payload: string }).payload)) }));
  }

  close() {
    this.db.close();
  }
}
