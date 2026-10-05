import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';

let socketServer: Server | undefined;

export function initializeSocketServer(httpServer: HttpServer, allowedOrigins: string[]) {
  socketServer = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  });

  socketServer.on('connection', (socket) => {
    socket.emit('connection:ready', { connectedAt: new Date().toISOString() });
  });

  return socketServer;
}

export function emitSocketEvent(event: string, payload: unknown) {
  socketServer?.emit(event, payload);
}