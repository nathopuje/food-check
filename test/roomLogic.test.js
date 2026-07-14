const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  createRoom,
  generateUniqueRoomCode,
  addPlayer,
  canStart,
  startRound,
  applySwipe,
  computeResults,
} = require('../lib/roomLogic');

const SAMPLE_DECK = [
  { id: 'a', name: 'Pizza' },
  { id: 'b', name: 'Sushi' },
  { id: 'c', name: 'Tacos' },
  { id: 'd', name: 'Ramen' },
];

function makeStartedRoom(playerSlots, deck = SAMPLE_DECK) {
  const room = createRoom('TEST1', []);
  for (let i = 0; i < playerSlots.length; i++) addPlayer(room);
  room.started = true;
  const likes = {};
  const index = {};
  for (const slot of playerSlots) {
    likes[slot] = [];
    index[slot] = 0;
  }
  room.round = { deck, likes, index, playerSlots, resultsReady: false, results: null };
  return room;
}

test('a room accepts up to MAX_PLAYERS and rejects further joins', () => {
  const room = createRoom('FULL', []);
  const slots = [];
  for (let i = 0; i < MAX_PLAYERS; i++) slots.push(addPlayer(room).slot);
  assert.deepEqual(slots, [1, 2, 3, 4, 5]);
  assert.equal(addPlayer(room), null);
});

test('canStart requires MIN_PLAYERS_TO_START and turns off once started', async () => {
  const room = createRoom('GATE', []);
  assert.equal(canStart(room), false);
  addPlayer(room);
  assert.equal(canStart(room), false, 'a lone host should not be able to start');
  addPlayer(room);
  assert.equal(canStart(room), true);
  assert.equal(await startRound(room), true);
  assert.equal(room.started, true);
  assert.equal(canStart(room), false);
  assert.deepEqual(room.round.playerSlots, [1, 2]);
});

test('applySwipe rejects swipes before the game has started', () => {
  const room = createRoom('NOSTART', []);
  addPlayer(room);
  addPlayer(room);
  const result = applySwipe(room, 1, 'a', 'like');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'not_started');
});

test('an out-of-order swipe is rejected instead of corrupting state', () => {
  const room = makeStartedRoom([1, 2]);
  const result = applySwipe(room, 1, 'd', 'like');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'out_of_order');
  assert.equal(room.round.index[1], 0);
});

test('resultsReady flips true only once every player finishes the whole deck', () => {
  const room = makeStartedRoom([1, 2]);
  for (const dishId of ['a', 'b', 'c']) {
    const r = applySwipe(room, 1, dishId, 'pass');
    assert.equal(r.resultsReady, false);
  }
  const midway = applySwipe(room, 1, 'd', 'pass');
  assert.equal(midway.resultsReady, false, 'player 1 finished but player 2 has not');

  for (const dishId of ['a', 'b', 'c']) {
    const r = applySwipe(room, 2, dishId, 'pass');
    assert.equal(r.resultsReady, false);
  }
  const done = applySwipe(room, 2, 'd', 'pass');
  assert.equal(done.resultsReady, true);
  assert.equal(room.round.resultsReady, true);
});

test('swipes after resultsReady are rejected', () => {
  const room = makeStartedRoom([1, 2]);
  for (const slot of [1, 2]) {
    for (const dishId of ['a', 'b', 'c', 'd']) applySwipe(room, slot, dishId, 'pass');
  }
  assert.equal(room.round.resultsReady, true);
  const result = applySwipe(room, 1, 'a', 'like');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'already_finished');
});

test('computeResults ranks dishes by how many players liked them and drops lone likes', () => {
  const room = makeStartedRoom([1, 2, 3, 4]);
  // a: liked by all 4, b: liked by 3, c: liked by 2, d: liked by only 1 (excluded)
  const likePlan = {
    a: [1, 2, 3, 4],
    b: [1, 2, 3],
    c: [1, 2],
    d: [1],
  };
  for (const slot of [1, 2, 3, 4]) {
    for (const dishId of ['a', 'b', 'c', 'd']) {
      const direction = likePlan[dishId].includes(slot) ? 'like' : 'pass';
      applySwipe(room, slot, dishId, direction);
    }
  }
  assert.equal(room.round.resultsReady, true);
  const results = room.round.results;
  assert.deepEqual(results.map((r) => r.dish.id), ['a', 'b', 'c']);
  assert.deepEqual(results.map((r) => r.likeCount), [4, 3, 2]);
});

test('computeResults returns an empty list when nothing gets 2+ likes', () => {
  const room = makeStartedRoom([1, 2]);
  applySwipe(room, 1, 'a', 'like');
  applySwipe(room, 1, 'b', 'pass');
  applySwipe(room, 1, 'c', 'pass');
  applySwipe(room, 1, 'd', 'pass');
  applySwipe(room, 2, 'a', 'pass');
  applySwipe(room, 2, 'b', 'like');
  applySwipe(room, 2, 'c', 'pass');
  applySwipe(room, 2, 'd', 'pass');
  assert.deepEqual(room.round.results, []);
});

test('generateUniqueRoomCode retries past a colliding code', async () => {
  let calls = 0;
  const fakeStore = {
    async getRoom() {
      calls += 1;
      return calls === 1 ? { code: 'taken' } : null;
    },
  };
  const code = await generateUniqueRoomCode(fakeStore);
  assert.equal(typeof code, 'string');
  assert.equal(calls, 2);
});

test('MIN_PLAYERS_TO_START matches the documented lobby requirement', () => {
  assert.equal(MIN_PLAYERS_TO_START, 2);
});
