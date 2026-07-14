const { sendJson, sendError } = require('../../../lib/apiUtils');
const { findSlotByToken } = require('../../../lib/roomLogic');
const roomStore = require('../../../lib/roomStore');
const { roomStatusPayload, dishForWire, resultForWire } = require('../../../lib/wire');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'method_not_allowed', 'Use GET to poll room status.');
  }

  const code = String(req.query.code || '').toUpperCase();
  const token = String(req.query.token || '');
  const room = await roomStore.getRoom(code);
  if (!room) {
    return sendError(res, 404, 'room_not_found', 'That room no longer exists.');
  }

  const slot = findSlotByToken(room, token);
  if (!slot) {
    return sendError(res, 403, 'invalid_token', 'Could not restore your session.');
  }

  const payload = {
    playerSlot: slot,
    ...roomStatusPayload(room),
  };

  if (room.started && room.round) {
    payload.roundId = room.round.roundId;
    payload.deck = room.round.deck.map(dishForWire);
    payload.nextIndex = room.round.index[slot];
    payload.resultsReady = room.round.resultsReady;
    if (room.round.resultsReady) {
      payload.results = room.round.results.map(resultForWire);
    }
  }

  sendJson(res, 200, payload);
};
