const { randomUUID } = require('crypto');
const { buildDeck } = require('../deck/buildDeck');

const OTHER_SLOT = { 1: 2, 2: 1 };
const GRACE_MS = 2 * 60 * 1000;
const IDLE_MS = 30 * 60 * 1000;

function freshRoundState(deck) {
  return {
    deck,
    likes: { 1: new Set(), 2: new Set() },
    index: { 1: 0, 2: 0 },
    matched: false,
    matchedDish: null,
  };
}

class Room {
  constructor(code, mealTypes = []) {
    this.code = code;
    this.mealTypes = mealTypes;
    this.players = { 1: null, 2: null };
    this.round = freshRoundState(buildDeck(undefined, mealTypes));
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();
  }

  touch() {
    this.lastActivityAt = Date.now();
  }

  isFull() {
    return this.players[1] && this.players[2];
  }

  addPlayer(ws) {
    const slot = this.players[1] ? 2 : 1;
    if (this.players[slot]) return null;
    const playerToken = randomUUID();
    this.players[slot] = { ws, token: playerToken, connected: true, disconnectedAt: null };
    this.touch();
    return slot;
  }

  findSlotByToken(token) {
    if (this.players[1] && this.players[1].token === token) return 1;
    if (this.players[2] && this.players[2].token === token) return 2;
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

  bothConnected() {
    return Boolean(
      this.players[1] && this.players[1].connected &&
      this.players[2] && this.players[2].connected,
    );
  }

  anyConnected() {
    return Boolean(
      (this.players[1] && this.players[1].connected) ||
      (this.players[2] && this.players[2].connected),
    );
  }

  isStale() {
    const now = Date.now();
    if (now - this.lastActivityAt > IDLE_MS) return true;
    for (const slot of [1, 2]) {
      const p = this.players[slot];
      if (p && !p.connected && p.disconnectedAt && now - p.disconnectedAt > GRACE_MS) {
        return true;
      }
    }
    return false;
  }

  restartDeck(mealTypes) {
    if (mealTypes) this.mealTypes = mealTypes;
    this.round = freshRoundState(buildDeck(undefined, this.mealTypes));
    this.touch();
  }

  /**
   * Pure-ish reducer over this room's round state. Kept as a method operating on
   * `this.round` (not a free function) but with no I/O, so it's directly unit
   * testable by constructing a Room and calling applySwipe.
   */
  applySwipe(slot, dishId, direction) {
    const round = this.round;
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
      const otherSlot = OTHER_SLOT[slot];
      if (round.likes[otherSlot].has(dishId)) {
        round.matched = true;
        round.matchedDish = expectedDish;
        this.touch();
        return { ok: true, event: 'match_found', dish: expectedDish };
      }
    }

    round.index[slot] += 1;
    this.touch();

    const bothDone = round.index[1] >= round.deck.length && round.index[2] >= round.deck.length;
    if (bothDone) {
      return { ok: true, event: 'deck_exhausted', nextIndex: round.index[slot] };
    }

    return { ok: true, event: 'swipe_ack', nextIndex: round.index[slot] };
  }
}

module.exports = { Room, GRACE_MS, IDLE_MS };
