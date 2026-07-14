const { readJsonBody, sendJson, sendError } = require('../../../lib/apiUtils');
const { findSlotByToken, applySwipe } = require('../../../lib/roomLogic');
const roomStore = require('../../../lib/roomStore');
const { resultForWire } = require('../../../lib/wire');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'method_not_allowed', 'Use POST to swipe.');
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

  const result = applySwipe(room, slot, body.dishId, body.direction);
  if (!result.ok) {
    return sendError(res, 409, result.error.code, result.error.message);
  }
  await roomStore.saveRoom(room);

  sendJson(res, 200, {
    nextIndex: result.nextIndex,
    resultsReady: result.resultsReady,
    results: result.resultsReady ? room.round.results.map(resultForWire) : undefined,
  });
};
