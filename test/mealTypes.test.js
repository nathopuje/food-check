const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDeck } = require('../src/deck/buildDeck');
const { sanitizeMealTypes, MEAL_TYPES } = require('../src/deck/mealTypes');

test('buildDeck with no meal type filter returns dishes from the full pool', async () => {
  const deck = await buildDeck(20, []);
  assert.ok(deck.length > 0);
});

test('buildDeck filtered to dessert only returns dessert dishes', async () => {
  const deck = await buildDeck(20, ['dessert']);
  assert.ok(deck.length > 0);
  for (const dish of deck) {
    assert.ok(dish.mealTypes.includes('dessert'), `${dish.name} is not tagged dessert`);
  }
});

test('buildDeck filtered to breakfast+dessert only returns matching dishes', async () => {
  const deck = await buildDeck(20, ['breakfast', 'dessert']);
  assert.ok(deck.length > 0);
  for (const dish of deck) {
    const matches = dish.mealTypes.includes('breakfast') || dish.mealTypes.includes('dessert');
    assert.ok(matches, `${dish.name} is not breakfast or dessert`);
  }
});

test('sanitizeMealTypes treats an empty selection as "no filter"', () => {
  assert.deepEqual(sanitizeMealTypes([]), []);
  assert.deepEqual(sanitizeMealTypes(undefined), []);
});

test('sanitizeMealTypes treats selecting every type as "no filter"', () => {
  assert.deepEqual(sanitizeMealTypes(MEAL_TYPES), []);
});

test('sanitizeMealTypes drops unknown values and keeps valid ones', () => {
  assert.deepEqual(sanitizeMealTypes(['dessert', 'not-a-type']), ['dessert']);
});
