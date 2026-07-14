const { sendJson, sendError } = require('../../../lib/apiUtils');
const { addPlayer, isFull, MAX_PLAYERS } = require('../../../lib/roomLogic');
const roomStore = require('../../../lib/roomStore');
const { roomStatusPayload } = require('../../../lib/wire');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'method_not_allowed', 'Use POST to join a room.');
  }

  const code = String(req.query.code || '').toUpperCase();
  const room = await roomStore.getRoom(code);
  if (!room) {
    return sendError(res, 404, 'room_not_found', 'That room code was not found.');
  }
  if (room.started) {
    return sendError(res, 409, 'room_started', 'This session has already started.');
  }
  if (isFull(room)) {
    return sendError(res, 409, 'room_full', `This room already has ${MAX_PLAYERS} players.`);
  }

  const { slot, token } = addPlayer(room);
  await roomStore.saveRoom(room);

  sendJson(res, 200, {
    roomCode: room.code,
    playerToken: token,
    playerSlot: slot,
    ...roomStatusPayload(room),
  });
};
