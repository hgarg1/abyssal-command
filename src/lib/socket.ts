import { io } from 'socket.io-client';

export const socket = io({
  path: '/api/realtime',
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 4_000,
});
