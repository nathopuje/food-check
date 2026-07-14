# What Should We Eat?

A group food-swiping app for up to 5 people who can't agree what to eat. One person creates a room and shares a code, up to 4 others join, and the host starts the round once at least one other person is in. Everyone swipes through the same deck of dishes at the same time — like right, pass left. Once everyone's finished the deck, you get a ranked list of every dish 2 or more people liked (dishes everyone agreed on rank first), each with a one-tap link to search for it on Swiggy.

## How it works

1. One player opens the app, optionally narrows the deck to a meal type (breakfast/lunch/snacks/dessert), and clicks **Start a new session** to get a 5-character room code and a shareable link.
2. Up to 4 more people join with that code (or the link). The lobby shows a live "X of 5 joined" count.
3. Once at least one other person has joined, the host can hit **Start Swiping** — no need to wait for the room to fill up.
4. Everyone swipes through the same deck in the same order. Swipe right (or tap ♥) to like, left (or tap ✕) to pass.
5. Once everyone's swiped through the whole deck, you get a **ranked results list**: dishes liked by all of you first, then dishes liked by all-but-one, and so on down to (but not below) 2 likes — a dish only one person liked never shows up. Each result has an **Order on Swiggy** button that opens Swiggy's own search for that dish so you can actually pick a restaurant and order.
6. Anyone can **Close Room** at any point to send the whole group back to the home screen.

Dishes come from [TheMealDB](https://www.themealdb.com/api.php)'s free public API (Indian cuisine); if it's ever unreachable, the app falls back to a small built-in list so it keeps working.

**On Swiggy:** there's no public API for third-party restaurant lookup by dish name, so this links out to Swiggy's own public search page (`swiggy.com/search?query=...`) rather than scraping or reverse-engineering their private endpoints — you still land on real, current restaurants, just picked by you on Swiggy itself.

## Running locally

```bash
npm install
npm start
```

Then open `http://localhost:3000` in a few browser tabs/windows to play as multiple people. No Redis/Upstash setup is needed locally — without the env vars below, room state just lives in an in-memory Map, which is fine for a single dev server process.

## Running tests

```bash
npm test
```

## Deploying (Vercel)

This app is serverless-friendly: room state lives in Redis (not in server memory), and the frontend polls a REST API instead of holding a WebSocket open, so it runs on Vercel's stateless functions.

1. **Create a free Redis database on [Upstash](https://console.upstash.com/)** (Vercel's marketplace has a one-click Upstash integration, or create one directly on upstash.com). Grab the **REST URL** and **REST token** it gives you.
2. Push this repo to GitHub (already done if you're reading this from the repo).
3. Go to [vercel.com/new](https://vercel.com/new) and import this repo.
4. In the project's **Environment Variables**, add:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
5. Deploy. Vercel serves `public/` as static assets and everything under `api/` as serverless functions automatically — no build step needed. Room codes travel in query params (`?room=CODE`) so you can share the invite link straight from the lobby.
6. Without the Upstash env vars set, the app still runs but each serverless invocation gets its own in-memory store — rooms won't sync between players. The env vars are required for real multi-player use in production.

## Project structure

- `server.js` — **local dev only.** An Express harness that mounts the same `api/` handlers Vercel runs in production, so `npm start` behaves identically to the deployed app.
- `api/rooms/` — the serverless API: create/join/status(poll)/start/swipe/restart/close.
- `lib/roomLogic.js` — pure room/round state transitions: joining, starting, swiping, and ranking results by like count.
- `lib/roomStore.js` — Redis-backed room persistence (Upstash), with an in-memory fallback when no Redis env vars are set.
- `lib/swiggy.js` — builds the Swiggy search deep link for a dish.
- `src/deck/` — TheMealDB integration, meal pool caching, and deck building.
- `public/` — the frontend (plain HTML/CSS/JS, no build step). `public/js/roomClient.js` polls the API and exposes the same `on()/send()` shape the UI code uses.
