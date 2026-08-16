import express from 'express';
import { resolve } from 'node:path';
import { MissionDatabase } from './persistence/database.js';
import { createSimulationRuntime } from './runtime.js';

const PORT = Number(process.env.PORT ?? 3001);
const runtime = createSimulationRuntime(new MissionDatabase());

if (process.env.NODE_ENV === 'production') {
  const dist = resolve('dist');
  runtime.app.use(express.static(dist));
  runtime.app.use((_req, res) => res.sendFile(resolve(dist, 'index.html')));
}

const shutdown = () => runtime.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

runtime.server.listen(PORT, '127.0.0.1', () => {
  console.log(`ABYSSAL COMMAND simulation online at http://127.0.0.1:${PORT}`);
});
