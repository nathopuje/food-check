const fs = require('fs');
const path = require('path');

const FALLBACK_PATH = path.join(__dirname, '..', '..', 'data', 'fallback-meals.json');

let cached = null;

function loadFallbackMeals() {
  if (!cached) {
    const raw = fs.readFileSync(FALLBACK_PATH, 'utf8');
    cached = JSON.parse(raw).map((meal) => ({
      id: meal.id,
      name: meal.name,
      imageUrl: null,
      emoji: meal.emoji,
      category: meal.category,
      area: meal.area,
    }));
  }
  return cached;
}

module.exports = { loadFallbackMeals };
