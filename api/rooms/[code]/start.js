const { readJsonBody, sendJson, sendError } = require('../../../lib/apiUtils');
const { findSlotByToken, startRound, occupiedCount, MIN_PLAYERS_TO_START } = require('../../../lib/roomLogic');
const roomStore = require('../../../lib/roomStore');
const { dishForWire } = require('../../../lib/wire');

const HOST_SLOT = 1;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'method_not_allowed', 'Use POST to start a room.');
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
  if (slot !== HOST_SLOT) {
    return sendError(res, 403, 'not_host', 'Only the host can start the session.');
  }
  if (occupiedCount(room) < MIN_PLAYERS_TO_START) {
    return sendError(res, 409, 'not_enough_players', 'Wait for at least one more player to join.');
  }

  const started = await startRound(room);
  if (!started) {
    return sendError(res, 409, 'already_started', 'This session has already started.');
  }
  await roomStore.saveRoom(room);

  sendJson(res, 200, { started: true, roundId: room.round.roundId, deck: room.round.deck.map(dishForWire) });
};
