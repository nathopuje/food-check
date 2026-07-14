const { randomUUID } = require('crypto');
const { buildDeck } = require('../src/deck/buildDeck');
const { generateCode } = require('../src/utils/roomCode');

const MAX_PLAYERS = 5;
const MIN_PLAYERS_TO_START = 2;
const MIN_LIKES_TO_RANK = 2;

function occupiedSlots(room) {
  return Object.keys(room.players)
    .map(Number)
    .sort((a, b) => a - b);
}

function occupiedCount(room) {
  return occupiedSlots(room).length;
}

function isFull(room) {
  return occupiedCount(room) >= MAX_PLAYERS;
}

function canStart(room) {
  return !room.started && occupiedCount(room) >= MIN_PLAYERS_TO_START;
}

function createRoom(code, mealTypes = []) {
  return {
    code,
    mealTypes,
    started: false,
    players: {},
    round: null,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };
}

async function generateUniqueRoomCode(store, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateCode();
    // eslint-disable-next-line no-await-in-loop
    if (!(await store.getRoom(code))) return code;
  }
  throw new Error('Could not generate a unique room code');
}

function addPlayer(room) {
  let slot = null;
  for (let i = 1; i <= MAX_PLAYERS; i++) {
    if (!room.players[i]) {
      slot = i;
      break;
    }
  }
  if (!slot) return null;
  const token = randomUUID();
  room.players[slot] = { token, joinedAt: Date.now() };
  room.lastActivityAt = Date.now();
  return { slot, token };
}

function findSlotByToken(room, token) {
  for (const slot of occupiedSlots(room)) {
    if (room.players[slot].token === token) return slot;
  }
  return null;
}

function freshRound(deck, playerSlots) {
  const likes = {};
  const index = {};
  for (const slot of playerSlots) {
    likes[slot] = [];
    index[slot] = 0;
  }
  return {
    roundId: randomUUID(),
    deck,
    likes,
    index,
    playerSlots,
    resultsReady: false,
    results: null,
  };
}

async function startRound(room) {
  if (!canStart(room)) return false;
  const deck = await buildDeck(undefined, room.mealTypes);
  room.started = true;
  room.round = freshRound(deck, occupiedSlots(room));
  room.lastActivityAt = Date.now();
  return true;
}

async function restartRound(room, mealTypes) {
  if (mealTypes) room.mealTypes = mealTypes;
  const slots = room.round && room.round.playerSlots.length ? room.round.playerSlots : occupiedSlots(room);
  const deck = await buildDeck(undefined, room.mealTypes);
  room.round = freshRound(deck, slots);
  room.lastActivityAt = Date.now();
}

/**
 * Ranks every dish liked by 2 or more players, highest agreement first.
 * A dish liked by all N players ranks above one liked by N-1, and so on
 * down to (but not below) 2 — a single lone like never surfaces.
 */
function computeResults(round) {
  const counts = new Map();
  for (const slot of round.playerSlots) {
    for (const dishId of round.likes[slot]) {
      counts.set(dishId, (counts.get(dishId) || 0) + 1);
    }
  }
  const dishById = new Map(round.deck.map((d) => [d.id, d]));
  return [...counts.entries()]
    .filter(([, count]) => count >= MIN_LIKES_TO_RANK)
    .map(([dishId, count]) => ({ dish: dishById.get(dishId), likeCount: count }))
    .sort((a, b) => b.likeCount - a.likeCount);
}

/**
 * Pure reducer: every player swipes through the *entire* deck (no early
 * stop on a single dish), so results only settle once everyone has
 * finished, and computeResults can surface every dish with 2+ likes —
 * not just the first one every player happened to agree on.
 */
function applySwipe(room, slot, dishId, direction) {
  const round = room.round;
  if (!room.started || !round) {
    return { ok: false, error: { code: 'not_started', message: 'The host has not started swiping yet.' } };
  }
  if (round.resultsReady) {
    return { ok: false, error: { code: 'already_finished', message: 'This round already ended.' } };
  }

  const expectedDish = round.deck[round.index[slot]];
  if (!expectedDish || expectedDish.id !== dishId) {
    return {
      ok: false,
      error: { code: 'out_of_order', message: 'Swipe does not match expected card.' },
      nextIndex: round.index[slot],
    };
  }

  if (direction === 'like' && !round.likes[slot].includes(dishId)) {
    round.likes[slot].push(dishId);
  }
  round.index[slot] += 1;
  room.lastActivityAt = Date.now();

  const allDone = round.playerSlots.every((s) => round.index[s] >= round.deck.length);
  if (allDone) {
    round.resultsReady = true;
    round.results = computeResults(round);
  }

  return { ok: true, nextIndex: round.index[slot], resultsReady: round.resultsReady };
}

module.exports = {
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  MIN_LIKES_TO_RANK,
  createRoom,
  generateUniqueRoomCode,
  occupiedSlots,
  occupiedCount,
  isFull,
  canStart,
  addPlayer,
  findSlotByToken,
  startRound,
  restartRound,
  applySwipe,
  computeResults,
};
