const SWIGGY_SEARCH_URL = 'https://www.swiggy.com/search';

/**
 * Swiggy has no public/documented API for third-party restaurant lookup by
 * dish name — their real listings endpoints are private, geo-session-bound,
 * and undocumented for external use. Rather than reverse-engineer or scrape
 * them (unreliable and against their terms), this builds a deep link into
 * Swiggy's own public search page, which lets the group pick a real,
 * up-to-date restaurant themselves in Swiggy's actual app/site.
 */
function swiggySearchUrl(dishName) {
  const params = new URLSearchParams({ query: dishName });
  return `${SWIGGY_SEARCH_URL}?${params.toString()}`;
}

module.exports = { swiggySearchUrl };
