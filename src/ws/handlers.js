const { parseClientMessage, dishForWire, send } = require('./protocol');
const { lookupMeal } = require('../deck/mealdbClient');
const { sanitizeMealTypes } = require('../deck/mealTypes');
const { MAX_PLAYERS, MIN_PLAYERS_TO_START } = require('../rooms/Room');

const HOST_SLOT = 1;

function deckForWire(deck) {
  return deck.map(dishForWire);
}

function connectedSlots(room) {
  return room.occupiedSlots().filter((slot) => room.players[slot].connected);
}

function broadcastDeckReady(room) {
  for (const slot of connectedSlots(room)) {
    send(room.players[slot].ws, 'deck_ready', { deck: deckForWire(room.round.deck) });
  }
}

function broadcastToOthers(room, senderSlot, type, payload) {
  for (const slot of connectedSlots(room)) {
    if (slot !== senderSlot) send(room.players[slot].ws, type, payload);
  }
}

function broadcastToRoom(room, type, payload) {
  for (const slot of connectedSlots(room)) {
    send(room.players[slot].ws, type, payload);
  }
}

function roomStatusPayload(room) {
  return {
    occupiedCount: room.occupiedCount(),
    maxPlayers: MAX_PLAYERS,
    minPlayersToStart: MIN_PLAYERS_TO_START,
    started: room.started,
  };
}

function broadcastRoomStatus(room) {
  broadcastToRoom(room, 'room_status', roomStatusPayload(room));
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
            ...roomStatusPayload(room),
          });
          break;
        }

        case 'join_room': {
          const room = roomManager.getRoom((msg.roomCode || '').toUpperCase());
          if (!room) {
            send(ws, 'error', { code: 'room_not_found', message: 'That room code was not found.' });
            return;
          }
          if (room.started) {
            send(ws, 'error', { code: 'room_started', message: 'This session has already started.' });
            return;
          }
          if (room.isFull()) {
            send(ws, 'error', { code: 'room_full', message: `This room already has ${MAX_PLAYERS} players.` });
            return;
          }
          const slot = room.addPlayer(ws);
          conn.roomCode = room.code;
          conn.slot = slot;
          send(ws, 'joined', {
            roomCode: room.code,
            playerToken: room.players[slot].token,
            playerSlot: slot,
            ...roomStatusPayload(room),
          });
          broadcastRoomStatus(room);
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
          } else if (room.started) {
            const allDone = room.round.playerSlots.every((s) => room.round.index[s] >= room.round.deck.length);
            send(ws, 'deck_ready', { deck: deckForWire(room.round.deck) });
            send(ws, 'swipe_ack', { nextIndex: room.round.index[slot] });
            if (allDone) send(ws, 'deck_exhausted', {});
          } else {
            send(ws, 'joined', {
              roomCode: room.code,
              playerToken: msg.playerToken,
              playerSlot: slot,
              ...roomStatusPayload(room),
            });
          }
          broadcastRoomStatus(room);
          break;
        }

        case 'start_game': {
          const room = roomManager.getRoom(conn.roomCode);
          if (!room || !conn.slot) {
            send(ws, 'error', { code: 'not_in_room', message: 'You are not in an active room.' });
            return;
          }
          if (conn.slot !== HOST_SLOT) {
            send(ws, 'error', { code: 'not_host', message: 'Only the host can start the session.' });
            return;
          }
          if (room.occupiedCount() < MIN_PLAYERS_TO_START) {
            send(ws, 'error', { code: 'not_enough_players', message: 'Wait for at least one more player to join.' });
            return;
          }
          const started = room.startGame();
          if (started) broadcastDeckReady(room);
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
          if (!room.started) {
            send(ws, 'error', { code: 'not_started', message: 'The session has not started yet.' });
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
            broadcastToOthers(room, conn.slot, 'player_disconnected', { playerSlot: conn.slot });
            broadcastRoomStatus(room);
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
        broadcastToOthers(room, conn.slot, 'player_disconnected', { playerSlot: conn.slot });
        broadcastRoomStatus(room);
      }
    });
  };
}

module.exports = { createConnectionHandler };
