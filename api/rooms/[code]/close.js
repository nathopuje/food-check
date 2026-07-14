const { readJsonBody, sendJson, sendError } = require('../../../lib/apiUtils');
const { findSlotByToken } = require('../../../lib/roomLogic');
const roomStore = require('../../../lib/roomStore');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'method_not_allowed', 'Use POST to close a room.');
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

  await roomStore.deleteRoom(code);
  sendJson(res, 200, { closed: true });
};
