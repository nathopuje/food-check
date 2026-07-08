# What Should We Eat?

A two-player food-swiping app for couples (or any pair) who can't agree what to eat. One person starts a session and shares a room code, the other joins, and you both swipe through the same deck of dishes at the same time. The moment you've **both** liked the same dish, that's the winner — shown instantly to both of you.

## How it works

1. One player opens the app and clicks **Start a new session** to get a 5-character room code and a shareable link.
2. The other player enters the code (or opens the link) to join.
3. Once both are in, you each see the same deck of dishes in the same order. Swipe right (or tap ♥) to like, left (or tap ✕) to pass.
4. As soon as you've both liked the same dish, it's declared the winner for both of you in real time.
5. If you get through the whole deck with no overlap, you can try again with a freshly shuffled deck.

Dishes come from [TheMealDB](https://www.themealdb.com/api.php)'s free public API; if it's ever unreachable, the app falls back to a small built-in list so it keeps working.

## Running locally

```bash
npm install
npm start
```

Then open `http://localhost:3000` in two browser tabs/windows (or on two devices on the same network) to play as both players.

## Running tests

```bash
npm test
```

## Deploying (Render)

This app needs a persistent Node process (it holds room state and a WebSocket server in memory), so it's deployed as a Render **Web Service**, not a serverless/static host.

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**, and point it at this repo. Render will pick up `render.yaml` automatically and configure the service (free plan, `npm install` build, `npm start` start command).
   - Alternatively: **New** → **Web Service**, pick this repo, and set Build Command to `npm install` and Start Command to `npm start` manually.
3. Deploy. Render assigns a public `https://<your-service>.onrender.com` URL — that's your play link. Room codes travel in query params (`?room=CODE`) so you can text the invite link straight from the Waiting screen.
4. Note: the free plan spins the service down after inactivity, so the first request after idle time takes a few extra seconds to wake up. In-memory rooms are also lost on redeploys/restarts — fine for this app since a session is just a single sitting.

## Project structure

- `server.js` — Express static file server + WebSocket upgrade, single entry point.
- `src/rooms/` — room state and the match/exhaustion detection logic.
- `src/deck/` — TheMealDB integration, meal pool caching, and deck building.
- `src/ws/` — WebSocket protocol and message handlers.
- `public/` — the frontend (plain HTML/CSS/JS, no build step).
