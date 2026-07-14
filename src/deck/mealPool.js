const { fetchByArea, lookupMeal } = require('./mealdbClient');
const { loadFallbackMeals } = require('./fallbackMeals');
const { categoryToMealTypes } = require('./mealTypes');

const POOL_TARGET_SIZE = 100;
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const CUISINE_AREAS = ['Indian'];
const MIN_POOL_SIZE = 10;

let pool = [];
let poolFetchedAt = 0;
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

/**
 * Serverless functions don't keep a background process alive, so there's no
 * setInterval to lean on here. Instead this fetches on demand, per
 * invocation, with a soft time-based cache: within REFRESH_INTERVAL_MS of a
 * successful fetch (which persists across warm container reuse) it reuses
 * the in-memory pool; otherwise it fetches again before falling back.
 */
async function ensurePool() {
  const isStale = Date.now() - poolFetchedAt > REFRESH_INTERVAL_MS;
  if (pool.length > 0 && !isStale) return pool;

  try {
    const fresh = await fetchFreshPool();
    if (fresh.length < MIN_POOL_SIZE) {
      throw new Error(`MealDB pool too small (${fresh.length})`);
    }
    pool = fresh;
    usingFallback = false;
    poolFetchedAt = Date.now();
  } catch (err) {
    if (pool.length === 0) {
      pool = loadFallbackMeals();
      usingFallback = true;
      poolFetchedAt = Date.now();
    }
    console.warn(`[mealPool] Using ${usingFallback ? 'fallback' : 'stale cached'} meal data: ${err.message}`);
  }
  return pool;
}

function isUsingFallback() {
  return usingFallback;
}

module.exports = { ensurePool, isUsingFallback, POOL_TARGET_SIZE };
