const { randomUUID } = require('crypto');
const { buildDeck } = require('../deck/buildDeck');

const MAX_PLAYERS = 5;
const MIN_PLAYERS_TO_START = 2;
const GRACE_MS = 2 * 60 * 1000;
const IDLE_MS = 30 * 60 * 1000;

function freshRoundState(deck, playerSlots) {
  const likes = {};
  const index = {};
  for (const slot of playerSlots) {
    likes[slot] = new Set();
    index[slot] = 0;
  }
  return {
    deck,
    likes,
    index,
    playerSlots,
    matched: false,
    matchedDish: null,
  };
}

class Room {
  constructor(code, mealTypes = []) {
    this.code = code;
    this.mealTypes = mealTypes;
    this.started = false;
    this.players = {};
    for (let i = 1; i <= MAX_PLAYERS; i++) this.players[i] = null;
    this.round = freshRoundState([], []);
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();
  }

  touch() {
    this.lastActivityAt = Date.now();
  }

  occupiedSlots() {
    const slots = [];
    for (let i = 1; i <= MAX_PLAYERS; i++) {
      if (this.players[i]) slots.push(i);
    }
    return slots;
  }

  occupiedCount() {
    return this.occupiedSlots().length;
  }

  isFull() {
    return this.occupiedCount() >= MAX_PLAYERS;
  }

  canStart() {
    return !this.started && this.occupiedCount() >= MIN_PLAYERS_TO_START;
  }

  addPlayer(ws) {
    let slot = null;
    for (let i = 1; i <= MAX_PLAYERS; i++) {
      if (!this.players[i]) {
        slot = i;
        break;
      }
    }
    if (!slot) return null;
    const playerToken = randomUUID();
    this.players[slot] = { ws, token: playerToken, connected: true, disconnectedAt: null };
    this.touch();
    return slot;
  }

  findSlotByToken(token) {
    for (let i = 1; i <= MAX_PLAYERS; i++) {
      if (this.players[i] && this.players[i].token === token) return i;
    }
    return null;
  }

  markDisconnected(slot) {
    if (!this.players[slot]) return;
    this.players[slot].connected = false;
    this.players[slot].disconnectedAt = Date.now();
    this.players[slot].ws = null;
  }

  markReconnected(slot, ws) {
    if (!this.players[slot]) return;
    this.players[slot].ws = ws;
    this.players[slot].connected = true;
    this.players[slot].disconnectedAt = null;
    this.touch();
  }

  anyConnected() {
    return this.occupiedSlots().some((slot) => this.players[slot].connected);
  }

  isStale() {
    const now = Date.now();
    if (now - this.lastActivityAt > IDLE_MS) return true;
    for (const slot of this.occupiedSlots()) {
      const p = this.players[slot];
      if (!p.connected && p.disconnectedAt && now - p.disconnectedAt > GRACE_MS) {
        return true;
      }
    }
    return false;
  }

  startGame() {
    if (!this.canStart()) return false;
    this.started = true;
    this.round = freshRoundState(buildDeck(undefined, this.mealTypes), this.occupiedSlots());
    this.touch();
    return true;
  }

  restartDeck(mealTypes) {
    if (mealTypes) this.mealTypes = mealTypes;
    const slots = this.round.playerSlots.length ? this.round.playerSlots : this.occupiedSlots();
    this.round = freshRoundState(buildDeck(undefined, this.mealTypes), slots);
    this.touch();
  }

  /**
   * Pure-ish reducer over this room's round state. Kept as a method operating on
   * `this.round` (not a free function) but with no I/O, so it's directly unit
   * testable by constructing a Room and calling applySwipe.
   */
  applySwipe(slot, dishId, direction) {
    const round = this.round;
    if (!this.started) {
      return { ok: false, error: { code: 'not_started', message: 'The host has not started swiping yet.' } };
    }
    if (round.matched) {
      return { ok: false, error: { code: 'already_matched', message: 'This round already ended.' } };
    }

    const expectedDish = round.deck[round.index[slot]];
    if (!expectedDish || expectedDish.id !== dishId) {
      return {
        ok: false,
        error: { code: 'out_of_order', message: 'Swipe does not match expected card.' },
        nextIndex: round.index[slot],
      };
    }

    if (direction === 'like') {
      round.likes[slot].add(dishId);
      const allLiked = round.playerSlots.every((s) => round.likes[s].has(dishId));
      if (allLiked) {
        round.matched = true;
        round.matchedDish = expectedDish;
        this.touch();
        return { ok: true, event: 'match_found', dish: expectedDish };
      }
    }

    round.index[slot] += 1;
    this.touch();

    const allDone = round.playerSlots.every((s) => round.index[s] >= round.deck.length);
    if (allDone) {
      return { ok: true, event: 'deck_exhausted', nextIndex: round.index[slot] };
    }

    return { ok: true, event: 'swipe_ack', nextIndex: round.index[slot] };
  }
}

module.exports = { Room, MAX_PLAYERS, MIN_PLAYERS_TO_START, GRACE_MS, IDLE_MS };
