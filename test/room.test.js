const test = require('node:test');
const assert = require('node:assert/strict');
const { Room, MAX_PLAYERS, MIN_PLAYERS_TO_START } = require('../src/rooms/Room');

function makeRoomWithDeck(deck, playerSlots = [1, 2]) {
  const room = new Room('TEST1');
  room.started = true;
  const likes = {};
  const index = {};
  for (const slot of playerSlots) {
    likes[slot] = new Set();
    index[slot] = 0;
  }
  room.round = {
    deck,
    likes,
    index,
    playerSlots,
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

test('a match requires every player in a >2-person room to like the dish', () => {
  const room = makeRoomWithDeck(SAMPLE_DECK, [1, 2, 3]);

  room.applySwipe(1, 'a', 'like');
  const twoOfThree = room.applySwipe(2, 'a', 'like');
  assert.notEqual(twoOfThree.event, 'match_found');
  assert.equal(room.round.matched, false);

  const allThree = room.applySwipe(3, 'a', 'like');
  assert.equal(allThree.event, 'match_found');
  assert.equal(room.round.matched, true);
});

test('applySwipe is rejected before the host starts the game', () => {
  const room = new Room('NOSTART');
  room.addPlayer({});
  room.addPlayer({});
  const result = room.applySwipe(1, 'anything', 'like');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'not_started');
});

test('a room accepts up to MAX_PLAYERS and rejects further joins', () => {
  const room = new Room('FULLROOM');
  const slots = [];
  for (let i = 0; i < MAX_PLAYERS; i++) {
    slots.push(room.addPlayer({}));
  }
  assert.deepEqual(slots, [1, 2, 3, 4, 5]);
  assert.equal(room.isFull(), true);
  assert.equal(room.addPlayer({}), null);
});

test('canStart requires at least MIN_PLAYERS_TO_START and flips off once started', () => {
  const room = new Room('STARTGATE');
  assert.equal(room.canStart(), false);
  room.addPlayer({});
  assert.equal(room.canStart(), false, 'a lone host should not be able to start');
  room.addPlayer({});
  assert.equal(room.occupiedCount() >= MIN_PLAYERS_TO_START, true);
  assert.equal(room.canStart(), true);
  const started = room.startGame();
  assert.equal(started, true);
  assert.equal(room.started, true);
  assert.equal(room.canStart(), false);
  assert.deepEqual(room.round.playerSlots, [1, 2]);
});
