const BASE_URL = 'https://www.themealdb.com/api/json/v1/1';
const TIMEOUT_MS = 5000;

async function fetchJson(url, { retries = 1 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (attempt === retries) throw err;
    }
  }
  return null;
}

function mapMeal(raw, category, area) {
  return {
    id: raw.idMeal,
    name: raw.strMeal,
    imageUrl: raw.strMealThumb ? `${raw.strMealThumb}/preview` : null,
    emoji: null,
    category: raw.strCategory || category || null,
    area: raw.strArea || area || null,
    mealTypes: null,
  };
}

async function fetchList(kind) {
  const data = await fetchJson(`${BASE_URL}/list.php?${kind}=list`);
  const rows = data && data.meals ? data.meals : [];
  const key = kind === 'c' ? 'strCategory' : 'strArea';
  return rows.map((row) => row[key]).filter(Boolean);
}

async function fetchByCategory(category) {
  const data = await fetchJson(`${BASE_URL}/filter.php?c=${encodeURIComponent(category)}`);
  const rows = data && data.meals ? data.meals : [];
  return rows.map((row) => mapMeal(row, category, null));
}

async function fetchByArea(area) {
  const data = await fetchJson(`${BASE_URL}/filter.php?a=${encodeURIComponent(area)}`);
  const rows = data && data.meals ? data.meals : [];
  return rows.map((row) => mapMeal(row, null, area));
}

async function lookupMeal(id) {
  const data = await fetchJson(`${BASE_URL}/lookup.php?i=${encodeURIComponent(id)}`);
  const meal = data && data.meals && data.meals[0];
  if (!meal) return null;
  return {
    ...mapMeal(meal),
    description: meal.strInstructions ? meal.strInstructions.split(/\.\s|\n/)[0].trim() : null,
  };
}

module.exports = { fetchList, fetchByCategory, fetchByArea, lookupMeal };
