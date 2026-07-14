const { readJsonBody, sendJson, sendError } = require('../../lib/apiUtils');
const { sanitizeMealTypes } = require('../../src/deck/mealTypes');
const { createRoom, generateUniqueRoomCode, addPlayer } = require('../../lib/roomLogic');
const roomStore = require('../../lib/roomStore');
const { roomStatusPayload } = require('../../lib/wire');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'method_not_allowed', 'Use POST to create a room.');
  }

  const body = await readJsonBody(req);
  const mealTypes = sanitizeMealTypes(body.mealTypes);

  const code = await generateUniqueRoomCode(roomStore);
  const room = createRoom(code, mealTypes);
  const { slot, token } = addPlayer(room);
  await roomStore.saveRoom(room);

  sendJson(res, 200, {
    roomCode: room.code,
    playerToken: token,
    playerSlot: slot,
    ...roomStatusPayload(room),
  });
};
