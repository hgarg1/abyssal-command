import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { parseCommand } from './commands.js';
import type { MissionStore } from './persistence/store.js';
import { SimulationEngine } from './simulation/engine.js';
import type { Command, Mission } from './simulation/types.js';

export function createSimulationRuntime(store: MissionStore) {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    path: '/api/realtime',
    cors: { origin: true, credentials: true },
  });
  const engine = new SimulationEngine();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '128kb' }));

  const sendHealth = (_req: express.Request, res: express.Response) =>
    res.json({ ok: true, service: 'NEREID-7 simulation', persistence: process.env.VERCEL ? 'ephemeral' : 'sqlite' });
  const sendState = (_req: express.Request, res: express.Response) => res.json(engine.snapshot());
  const sendMissions = (_req: express.Request, res: express.Response) => res.json(store.listMissions());
  const sendHistory = (req: express.Request, res: express.Response) =>
    res.json(store.history(Math.min(Number(req.query.limit) || 900, 5_000)));

  const saveMission = (req: express.Request, res: express.Response) => {
    const mission = req.body as Mission;
    if (!mission?.id || !mission.title || !mission.target) return res.status(400).json({ error: 'Invalid mission payload' });
    store.saveMission(mission);
    return res.status(201).json(mission);
  };

  const executeCommand = (req: express.Request, res: express.Response) => {
    try {
      const command = typeof req.body?.text === 'string' ? parseCommand(req.body.text) : req.body as Command;
      if (!command) return res.status(422).json({ error: 'Command not understood' });
      const state = engine.command(command);
      store.saveMission(state.mission);
      return res.json({ accepted: command, state });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Command failed' });
    }
  };

  app.get('/api/health', sendHealth);
  app.get('/api/state', sendState);
  app.get('/api/missions', sendMissions);
  app.get('/api/history', sendHistory);
  app.post('/api/missions', saveMission);
  app.post('/api/command', executeCommand);

  app.get('/api', (req, res) => {
    switch (req.query.route) {
      case 'state': return sendState(req, res);
      case 'missions': return sendMissions(req, res);
      case 'history': return sendHistory(req, res);
      default: return sendHealth(req, res);
    }
  });

  app.post('/api', (req, res) => {
    if (req.query.route === 'missions') return saveMission(req, res);
    if (req.query.route === 'command') return executeCommand(req, res);
    return res.status(404).json({ error: 'Unknown API route' });
  });

  io.on('connection', (socket) => {
    socket.emit('state', engine.snapshot());
    socket.on('command', (command: Command, acknowledge?: (result: unknown) => void) => {
      try {
        const state = engine.command(command);
        store.saveMission(state.mission);
        acknowledge?.({ ok: true, sequence: state.sequence });
      } catch (error) {
        acknowledge?.({ ok: false, error: error instanceof Error ? error.message : 'Command failed' });
      }
    });
    socket.on('commandText', (text: string, acknowledge?: (result: unknown) => void) => {
      try {
        const command = parseCommand(text);
        if (!command) return acknowledge?.({ ok: false, error: 'Command not understood' });
        const state = engine.command(command);
        store.saveMission(state.mission);
        return acknowledge?.({ ok: true, accepted: command, sequence: state.sequence });
      } catch (error) {
        return acknowledge?.({ ok: false, error: error instanceof Error ? error.message : 'Command failed' });
      }
    });
  });

  engine.on('tick', (state) => io.emit('telemetry', state));
  engine.on('event', (event) => store.saveEvent(event));
  engine.on('sample', (state) => store.sample(state));
  store.saveMission(engine.snapshot().mission);
  store.sample(engine.snapshot());

  let previous = performance.now();
  const timer = setInterval(() => {
    const now = performance.now();
    engine.tick((now - previous) / 1_000);
    previous = now;
  }, 250);
  timer.unref();

  const close = (callback?: () => void) => {
    clearInterval(timer);
    store.saveMission(engine.snapshot().mission);
    store.close();
    io.close();
    server.close(callback);
  };

  return { app, server, io, engine, close };
}
