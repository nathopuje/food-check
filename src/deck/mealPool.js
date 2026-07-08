const { fetchList, fetchByCategory, fetchByArea } = require('./mealdbClient');
const { loadFallbackMeals } = require('./fallbackMeals');

const POOL_TARGET_SIZE = 100;
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const SOURCES_PER_REFRESH = 3;

let pool = [];
let usingFallback = true;

function pickRandom(arr, count) {
  const copy = [...arr];
  const picked = [];
  while (copy.length && picked.length < count) {
    const i = Math.floor(Math.random() * copy.length);
    picked.push(copy.splice(i, 1)[0]);
  }
  return picked;
}

function dedupById(meals) {
  const seen = new Map();
  for (const meal of meals) {
    if (meal && meal.id && !seen.has(meal.id)) seen.set(meal.id, meal);
  }
  return [...seen.values()];
}

async function fetchFreshPool() {
  const [categories, areas] = await Promise.all([fetchList('c'), fetchList('a')]);
  const chosenCategories = pickRandom(categories, SOURCES_PER_REFRESH);
  const chosenAreas = pickRandom(areas, SOURCES_PER_REFRESH);

  const results = await Promise.allSettled([
    ...chosenCategories.map((c) => fetchByCategory(c)),
    ...chosenAreas.map((a) => fetchByArea(a)),
  ]);

  const meals = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  return dedupById(meals);
}

async function refreshPool() {
  try {
    const fresh = await fetchFreshPool();
    if (fresh.length >= 20) {
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
