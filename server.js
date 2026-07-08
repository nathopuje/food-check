const path = require('path');
const http = require('http');
const express = require('express');

const { attachWebSocketServer } = require('./src/ws/wsServer');
const { startPoolRefresh } = require('./src/deck/mealPool');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
attachWebSocketServer(server);
startPoolRefresh();

server.listen(PORT, () => {
  console.log(`Food-match app listening on http://localhost:${PORT}`);
});
