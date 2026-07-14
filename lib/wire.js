const { MAX_PLAYERS, MIN_PLAYERS_TO_START, occupiedCount } = require('./roomLogic');
const { swiggySearchUrl } = require('./swiggy');

function dishForWire(dish) {
  if (!dish) return null;
  const { id, name, imageUrl, emoji, category, area } = dish;
  return { id, name, imageUrl, emoji, category, area };
}

function resultForWire(entry) {
  return {
    dish: dishForWire(entry.dish),
    likeCount: entry.likeCount,
    swiggyUrl: swiggySearchUrl(entry.dish.name),
  };
}

function roomStatusPayload(room) {
  return {
    occupiedCount: occupiedCount(room),
    maxPlayers: MAX_PLAYERS,
    minPlayersToStart: MIN_PLAYERS_TO_START,
    started: room.started,
  };
}

module.exports = { dishForWire, resultForWire, roomStatusPayload };
