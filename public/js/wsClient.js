(function () {
  function createWsClient() {
    const listeners = new Map();
    let socket = null;
    let reconnectAttempts = 0;
    let intentionalClose = false;
    let onOpenQueue = [];

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

      socket.addEventListener('open', () => {
        reconnectAttempts = 0;
        const queued = onOpenQueue;
        onOpenQueue = [];
        queued.forEach((fn) => fn());
        emit('_open', {});
      });

      socket.addEventListener('message', (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        emit(msg.type, msg);
      });

      socket.addEventListener('close', () => {
        emit('_close', {});
        if (!intentionalClose) {
          reconnectAttempts += 1;
          const delay = Math.min(1000 * 2 ** reconnectAttempts, 8000);
          setTimeout(connect, delay);
        }
      });
    }

    function emit(type, payload) {
      const handlers = listeners.get(type);
      if (handlers) handlers.forEach((fn) => fn(payload));
    }

    function on(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    }

    function send(type, payload = {}) {
      const doSend = () => socket.send(JSON.stringify({ type, ...payload }));
      if (socket && socket.readyState === WebSocket.OPEN) {
        doSend();
      } else {
        onOpenQueue.push(doSend);
      }
    }

    connect();
    return { on, send };
  }

  window.createWsClient = createWsClient;
})();
