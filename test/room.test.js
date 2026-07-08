const test = require('node:test');
const assert = require('node:assert/strict');
const { Room } = require('../src/rooms/Room');

function makeRoomWithDeck(deck) {
  const room = new Room('TEST1');
  room.round = {
    deck,
    likes: { 1: new Set(), 2: new Set() },
    index: { 1: 0, 2: 0 },
    matched: false,
    matchedDish: null,
  };
  return room;
}

const SAMPLE_DECK = [
  { id: 'a', name: 'Pizza' },
  { id: 'b', name: 'Sushi' },
  { id: 'c', name: 'Tacos' },
];

test('match_found fires the instant both players like the same dish', () => {
  const room = makeRoomWithDeck(SAMPLE_DECK);

  const r1 = room.applySwipe(1, 'a', 'pass');
  assert.equal(r1.event, 'swipe_ack');
  assert.equal(room.round.matched, false);

  const r2 = room.applySwipe(2, 'a', 'pass');
  assert.equal(r2.event, 'swipe_ack');
  assert.equal(room.round.matched, false);

  const r3 = room.applySwipe(1, 'b', 'like');
  assert.equal(r3.event, 'swipe_ack');
  assert.equal(room.round.matched, false);

  const r4 = room.applySwipe(2, 'b', 'like');
  assert.equal(r4.event, 'match_found');
  assert.equal(r4.dish.id, 'b');
  assert.equal(room.round.matched, true);
});

test('a single like from only one player never triggers a match', () => {
  const room = makeRoomWithDeck(SAMPLE_DECK);
  room.applySwipe(1, 'a', 'like');
  const result = room.applySwipe(1, 'b', 'like');
  assert.notEqual(result.event, 'match_found');
  assert.equal(room.round.matched, false);
});

test('deck_exhausted fires only once both players finish with no overlap', () => {
  const room = makeRoomWithDeck(SAMPLE_DECK);
  room.applySwipe(1, 'a', 'like');
  room.applySwipe(1, 'b', 'pass');
  const midway = room.applySwipe(1, 'c', 'pass');
  assert.notEqual(midway.event, 'deck_exhausted');

  room.applySwipe(2, 'a', 'pass');
  room.applySwipe(2, 'b', 'like');
  const final = room.applySwipe(2, 'c', 'pass');
  assert.equal(final.event, 'deck_exhausted');
  assert.equal(room.round.matched, false);
});

test('an out-of-order swipe is rejected instead of corrupting state', () => {
  const room = makeRoomWithDeck(SAMPLE_DECK);
  const result = room.applySwipe(1, 'c', 'like');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'out_of_order');
  assert.equal(room.round.index[1], 0);
});

test('swipes after a match are rejected', () => {
  const room = makeRoomWithDeck(SAMPLE_DECK);
  room.applySwipe(1, 'a', 'like');
  room.applySwipe(2, 'a', 'like');
  assert.equal(room.round.matched, true);

  const result = room.applySwipe(1, 'b', 'like');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'already_matched');
});
