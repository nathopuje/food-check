const { parseClientMessage, dishForWire, send } = require('./protocol');
const { lookupMeal } = require('../deck/mealdbClient');
const { sanitizeMealTypes } = require('../deck/mealTypes');

function deckForWire(deck) {
  return deck.map(dishForWire);
}

function broadcastDeckReady(room) {
  for (const slot of [1, 2]) {
    const player = room.players[slot];
    if (player && player.connected) {
      send(player.ws, 'deck_ready', { deck: deckForWire(room.round.deck) });
    }
  }
}

function broadcastToOther(room, slot, type, payload) {
  const otherSlot = slot === 1 ? 2 : 1;
  const other = room.players[otherSlot];
  if (other && other.connected) {
    send(other.ws, type, payload);
  }
}

function broadcastToRoom(room, type, payload) {
  for (const slot of [1, 2]) {
    const player = room.players[slot];
    if (player && player.connected) {
      send(player.ws, type, payload);
    }
  }
}

async function broadcastMatch(room, dish) {
  let enriched = dish;
  try {
    const detailed = await lookupMeal(dish.id);
    if (detailed && detailed.description) {
      enriched = { ...dish, description: detailed.description };
    }
  } catch {
    // best-effort only; the match still ships without a description
  }
  broadcastToRoom(room, 'match_found', { dish: dishForWire(enriched) });
}

function createConnectionHandler(roomManager) {
  return function handleConnection(ws) {
    const conn = { roomCode: null, slot: null };

    ws.on('message', (raw) => {
      const parsed = parseClientMessage(raw);
      if (!parsed.ok) {
        send(ws, 'error', { code: 'bad_message', message: parsed.error });
        return;
      }
      const msg = parsed.message;

      switch (msg.type) {
        case 'create_room': {
          const room = roomManager.createRoom(sanitizeMealTypes(msg.mealTypes));
          const slot = room.addPlayer(ws);
          conn.roomCode = room.code;
          conn.slot = slot;
          send(ws, 'room_created', {
            roomCode: room.code,
            playerToken: room.players[slot].token,
            playerSlot: slot,
          });
          break;
        }

        case 'join_room': {
          const room = roomManager.getRoom((msg.roomCode || '').toUpperCase());
          if (!room) {
            send(ws, 'error', { code: 'room_not_found', message: 'That room code was not found.' });
            return;
          }
          if (room.isFull()) {
            send(ws, 'error', { code: 'room_full', message: 'This room already has two players.' });
            return;
          }
          const slot = room.addPlayer(ws);
          conn.roomCode = room.code;
          conn.slot = slot;
          send(ws, 'joined', {
            roomCode: room.code,
            playerToken: room.players[slot].token,
            playerSlot: slot,
          });
          broadcastToOther(room, slot, 'player_joined', { playerSlot: slot, connectedCount: 2 });
          if (room.isFull()) {
            broadcastDeckReady(room);
          }
          break;
        }

        case 'rejoin': {
          const room = roomManager.getRoom((msg.roomCode || '').toUpperCase());
          if (!room) {
            send(ws, 'error', { code: 'room_not_found', message: 'That room no longer exists.' });
            return;
          }
          const slot = room.findSlotByToken(msg.playerToken);
          if (!slot) {
            send(ws, 'error', { code: 'invalid_token', message: 'Could not restore your session.' });
            return;
          }
          room.markReconnected(slot, ws);
          conn.roomCode = room.code;
          conn.slot = slot;

          if (room.round.matched) {
            send(ws, 'match_found', { dish: dishForWire(room.round.matchedDish) });
          } else if (room.isFull()) {
            const bothDone = room.round.index[1] >= room.round.deck.length &&
              room.round.index[2] >= room.round.deck.length;
            send(ws, 'deck_ready', { deck: deckForWire(room.round.deck) });
            send(ws, 'swipe_ack', { nextIndex: room.round.index[slot] });
            if (bothDone) send(ws, 'deck_exhausted', {});
          }
          broadcastToOther(room, slot, 'player_reconnected', { playerSlot: slot });
          break;
        }

        case 'swipe': {
          const room = roomManager.getRoom(conn.roomCode);
          if (!room || !conn.slot) {
            send(ws, 'error', { code: 'not_in_room', message: 'You are not in an active room.' });
            return;
          }
          const result = room.applySwipe(conn.slot, msg.dishId, msg.direction);
          if (!result.ok) {
            send(ws, 'error', { ...result.error, nextIndex: result.nextIndex });
            return;
          }
          if (result.event === 'match_found') {
            broadcastMatch(room, result.dish);
          } else if (result.event === 'deck_exhausted') {
            send(ws, 'swipe_ack', { dishId: msg.dishId, direction: msg.direction, nextIndex: result.nextIndex });
            broadcastToRoom(room, 'deck_exhausted', {});
          } else {
            send(ws, 'swipe_ack', { dishId: msg.dishId, direction: msg.direction, nextIndex: result.nextIndex });
          }
          break;
        }

        case 'restart_deck': {
          const room = roomManager.getRoom(conn.roomCode);
          if (!room || !conn.slot) {
            send(ws, 'error', { code: 'not_in_room', message: 'You are not in an active room.' });
            return;
          }
          room.restartDeck(msg.mealTypes ? sanitizeMealTypes(msg.mealTypes) : undefined);
          broadcastDeckReady(room);
          break;
        }

        case 'leave_room': {
          const room = roomManager.getRoom(conn.roomCode);
          if (room && conn.slot) {
            room.markDisconnected(conn.slot);
            broadcastToOther(room, conn.slot, 'player_disconnected', { playerSlot: conn.slot });
          }
          conn.roomCode = null;
          conn.slot = null;
          break;
        }

        case 'close_room': {
          const room = roomManager.getRoom(conn.roomCode);
          if (!room || !conn.slot) {
            send(ws, 'error', { code: 'not_in_room', message: 'You are not in an active room.' });
            return;
          }
          broadcastToRoom(room, 'room_closed', { reason: 'closed_by_player' });
          roomManager.deleteRoom(room.code);
          conn.roomCode = null;
          conn.slot = null;
          break;
        }

        default:
          break;
      }
    });

    ws.on('close', () => {
      if (!conn.roomCode || !conn.slot) return;
      const room = roomManager.getRoom(conn.roomCode);
      if (!room) return;
      room.markDisconnected(conn.slot);
      if (room.anyConnected()) {
        broadcastToOther(room, conn.slot, 'player_disconnected', { playerSlot: conn.slot });
      }
    });
  };
}

module.exports = { createConnectionHandler };
