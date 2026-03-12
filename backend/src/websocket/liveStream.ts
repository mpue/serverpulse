import { Server as IOServer, Socket } from 'socket.io';

export function setupLiveStream(io: IOServer): void {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('subscribe:monitor', (data: { monitorId: string | number }) => {
      const room = `monitor:${data.monitorId}`;
      socket.join(room);
      console.log(`${socket.id} joined ${room}`);
    });

    socket.on('unsubscribe:monitor', (data: { monitorId: string | number }) => {
      const room = `monitor:${data.monitorId}`;
      socket.leave(room);
      console.log(`${socket.id} left ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
