const { fetchByArea, lookupMeal } = require('./mealdbClient');
const { loadFallbackMeals } = require('./fallbackMeals');
const { categoryToMealTypes } = require('./mealTypes');

const POOL_TARGET_SIZE = 100;
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const CUISINE_AREAS = ['Indian'];
const MIN_POOL_SIZE = 10;

let pool = [];
let usingFallback = true;

function dedupById(meals) {
  const seen = new Map();
  for (const meal of meals) {
    if (meal && meal.id && !seen.has(meal.id)) seen.set(meal.id, meal);
  }
  return [...seen.values()];
}

async function enrichWithMealTypes(meals) {
  const details = await Promise.allSettled(meals.map((m) => lookupMeal(m.id)));
  return meals.map((meal, i) => {
    const detail = details[i].status === 'fulfilled' ? details[i].value : null;
    const category = detail && detail.category;
    return { ...meal, category: category || meal.category, mealTypes: categoryToMealTypes(category) };
  });
}

async function fetchFreshPool() {
  const results = await Promise.allSettled(CUISINE_AREAS.map((a) => fetchByArea(a)));

  const meals = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  return enrichWithMealTypes(dedupById(meals));
}

async function refreshPool() {
  try {
    const fresh = await fetchFreshPool();
    if (fresh.length >= MIN_POOL_SIZE) {
      pool = fresh;
      usingFallback = false;
      return;
    }
    throw new Error(`MealDB pool too small (${fresh.length})`);
  } catch (err) {
    if (pool.length === 0) {
      pool = loadFallbackMeals();
      usingFallback = true;
    }
    console.warn(`[mealPool] Using ${usingFallback ? 'fallback' : 'stale cached'} meal data: ${err.message}`);
  }
}

function startPoolRefresh() {
  refreshPool();
  setInterval(refreshPool, REFRESH_INTERVAL_MS).unref();
}

function getPool() {
  if (pool.length === 0) {
    pool = loadFallbackMeals();
    usingFallback = true;
  }
  return pool;
}

function isUsingFallback() {
  return usingFallback;
}

module.exports = { startPoolRefresh, getPool, isUsingFallback, POOL_TARGET_SIZE };
