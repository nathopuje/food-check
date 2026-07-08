const { WebSocketServer } = require('ws');
const { RoomManager } = require('../rooms/RoomManager');
const { createConnectionHandler } = require('./handlers');

function attachWebSocketServer(httpServer) {
  const roomManager = new RoomManager();
  roomManager.startGarbageCollection();

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  wss.on('connection', createConnectionHandler(roomManager));

  return { wss, roomManager };
}

module.exports = { attachWebSocketServer };
