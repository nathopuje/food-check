const { getPool } = require('./mealPool');

const DECK_SIZE = 20;

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildDeck(size = DECK_SIZE) {
  const pool = getPool();
  const count = Math.min(size, pool.length);
  return shuffle(pool).slice(0, count);
}

module.exports = { buildDeck, DECK_SIZE };
