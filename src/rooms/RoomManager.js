const { Room } = require('./Room');
const { generateUniqueCode } = require('../utils/roomCode');

const GC_INTERVAL_MS = 60 * 1000;

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom() {
    const code = generateUniqueCode((c) => this.rooms.has(c));
    const room = new Room(code);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code) {
    return this.rooms.get(code) || null;
  }

  deleteRoom(code) {
    this.rooms.delete(code);
  }

  startGarbageCollection() {
    setInterval(() => {
      for (const [code, room] of this.rooms) {
        if (room.isStale()) {
          this.rooms.delete(code);
        }
      }
    }, GC_INTERVAL_MS).unref();
  }
}

module.exports = { RoomManager };
