const path = require('path');
const express = require('express');

const createRoom = require('./api/rooms/index');
const joinRoom = require('./api/rooms/[code]/join');
const roomStatus = require('./api/rooms/[code]/status');
const startRoom = require('./api/rooms/[code]/start');
const swipeRoom = require('./api/rooms/[code]/swipe');
const restartRoom = require('./api/rooms/[code]/restart');
const closeRoom = require('./api/rooms/[code]/close');

const PORT = process.env.PORT || 3000;

/**
 * Local dev-only harness. Production runs these same handler modules
 * directly as Vercel serverless functions (see api/) — this Express app
 * just merges route params into req.query the way Vercel's runtime does,
 * so the handlers behave identically in both places.
 */
function mount(handler) {
  return (req, res) => {
    req.query = { ...req.query, ...req.params };
    handler(req, res);
  };
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/rooms', mount(createRoom));
app.post('/api/rooms/:code/join', mount(joinRoom));
app.get('/api/rooms/:code/status', mount(roomStatus));
app.post('/api/rooms/:code/start', mount(startRoom));
app.post('/api/rooms/:code/swipe', mount(swipeRoom));
app.post('/api/rooms/:code/restart', mount(restartRoom));
app.post('/api/rooms/:code/close', mount(closeRoom));

app.listen(PORT, () => {
  console.log(`Food-match app listening on http://localhost:${PORT}`);
});
