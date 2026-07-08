const MEAL_TYPES = ['breakfast', 'lunch', 'snacks', 'dessert'];

const CATEGORY_MEAL_TYPE_MAP = {
  Breakfast: ['breakfast'],
  Dessert: ['dessert'],
  Starter: ['snacks'],
  Side: ['snacks'],
};

function categoryToMealTypes(category) {
  return CATEGORY_MEAL_TYPE_MAP[category] || ['lunch'];
}

function sanitizeMealTypes(input) {
  if (!Array.isArray(input) || input.length === 0) return [];
  const valid = input.filter((t) => MEAL_TYPES.includes(t));
  return valid.length === MEAL_TYPES.length ? [] : valid;
}

module.exports = { MEAL_TYPES, categoryToMealTypes, sanitizeMealTypes };
