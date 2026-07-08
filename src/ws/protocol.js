const CLIENT_MESSAGE_TYPES = new Set([
  'create_room',
  'join_room',
  'rejoin',
  'swipe',
  'restart_deck',
  'leave_room',
]);

function parseClientMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Malformed JSON' };
  }
  if (!msg || typeof msg !== 'object' || !CLIENT_MESSAGE_TYPES.has(msg.type)) {
    return { ok: false, error: 'Unknown message type' };
  }
  return { ok: true, message: msg };
}

function dishForWire(dish) {
  if (!dish) return null;
  const { id, name, imageUrl, emoji, category, area, description } = dish;
  return { id, name, imageUrl, emoji, category, area, description: description || null };
}

function send(ws, type, payload = {}) {
  if (!ws || ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ type, ...payload }));
}

module.exports = { CLIENT_MESSAGE_TYPES, parseClientMessage, dishForWire, send };
