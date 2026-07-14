const { getRedis, isConfigured } = require('./redis');

const ROOM_TTL_SECONDS = 2 * 60 * 60;

const memoryStore = new Map();

function memGet(code) {
  const entry = memoryStore.get(code);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(code);
    return null;
  }
  return entry.value;
}

function memSet(code, value) {
  memoryStore.set(code, { value, expiresAt: Date.now() + ROOM_TTL_SECONDS * 1000 });
}

async function getRoom(code) {
  if (isConfigured()) {
    return (await getRedis().get(`room:${code}`)) || null;
  }
  return memGet(code);
}

async function saveRoom(room) {
  if (isConfigured()) {
    await getRedis().set(`room:${room.code}`, room, { ex: ROOM_TTL_SECONDS });
    return;
  }
  memSet(room.code, room);
}

async function deleteRoom(code) {
  if (isConfigured()) {
    await getRedis().del(`room:${code}`);
    return;
  }
  memoryStore.delete(code);
}

module.exports = { getRoom, saveRoom, deleteRoom, ROOM_TTL_SECONDS };
