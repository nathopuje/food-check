const { readJsonBody, sendJson, sendError } = require('../../../lib/apiUtils');
const { findSlotByToken, restartRound } = require('../../../lib/roomLogic');
const { sanitizeMealTypes } = require('../../../src/deck/mealTypes');
const roomStore = require('../../../lib/roomStore');
const { dishForWire } = require('../../../lib/wire');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'method_not_allowed', 'Use POST to restart.');
  }

  const code = String(req.query.code || '').toUpperCase();
  const body = await readJsonBody(req);
  const room = await roomStore.getRoom(code);
  if (!room) {
    return sendError(res, 404, 'room_not_found', 'That room no longer exists.');
  }

  const slot = findSlotByToken(room, body.token);
  if (!slot) {
    return sendError(res, 403, 'invalid_token', 'Could not restore your session.');
  }
  if (!room.started) {
    return sendError(res, 409, 'not_started', 'The session has not started yet.');
  }

  await restartRound(room, body.mealTypes ? sanitizeMealTypes(body.mealTypes) : undefined);
  await roomStore.saveRoom(room);

  sendJson(res, 200, { roundId: room.round.roundId, deck: room.round.deck.map(dishForWire) });
};
