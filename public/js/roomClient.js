(function () {
  const POLL_INTERVAL_MS = 1200;

  function createRoomClient() {
    const listeners = new Map();
    let roomCode = null;
    let playerToken = null;
    let pollTimer = null;
    let prevRoundId = null;
    let prevResultsReady = false;

    function emit(type, payload) {
      const handlers = listeners.get(type);
      if (handlers) handlers.forEach((fn) => fn(payload));
    }

    function on(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    }

    async function api(path, options) {
      let res;
      try {
        res = await fetch(path, {
          headers: { 'Content-Type': 'application/json' },
          ...options,
        });
      } catch {
        return { ok: false, networkError: true };
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, status: res.status, error: data.error || { code: 'unknown', message: 'Something went wrong.' } };
      }
      return { ok: true, data };
    }

    function stopPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    }

    function startPolling() {
      stopPolling();
      pollTimer = setInterval(pollStatus, POLL_INTERVAL_MS);
      pollStatus();
    }

    async function pollStatus() {
      if (!roomCode || !playerToken) return;
      const result = await api(`/api/rooms/${roomCode}/status?token=${encodeURIComponent(playerToken)}`, { method: 'GET' });
      if (!result.ok) {
        if (result.status === 404 || result.status === 403) {
          stopPolling();
          emit('room_closed', { reason: result.error.code === 'room_not_found' ? 'not_found' : 'invalid_token' });
        }
        return;
      }
      const data = result.data;
      emit('room_status', {
        occupiedCount: data.occupiedCount,
        maxPlayers: data.maxPlayers,
        minPlayersToStart: data.minPlayersToStart,
        started: data.started,
      });

      if (data.started && data.roundId && data.roundId !== prevRoundId) {
        prevRoundId = data.roundId;
        prevResultsReady = Boolean(data.resultsReady);
        emit('deck_ready', { deck: data.deck });
        if (data.resultsReady) emit('results_ready', { results: data.results });
        return;
      }

      if (data.started && typeof data.nextIndex === 'number') {
        emit('swipe_ack', { nextIndex: data.nextIndex });
      }

      if (data.resultsReady && !prevResultsReady) {
        emit('results_ready', { results: data.results });
      }
      prevResultsReady = Boolean(data.resultsReady);
    }

    function send(type, payload = {}) {
      switch (type) {
        case 'create_room': {
          api('/api/rooms', { method: 'POST', body: JSON.stringify({ mealTypes: payload.mealTypes }) }).then((result) => {
            if (!result.ok) return emit('error', result.error);
            roomCode = result.data.roomCode;
            playerToken = result.data.playerToken;
            prevRoundId = null;
            prevResultsReady = false;
            emit('room_created', result.data);
            startPolling();
          });
          break;
        }

        case 'join_room': {
          const code = String(payload.roomCode || '').toUpperCase();
          api(`/api/rooms/${code}/join`, { method: 'POST' }).then((result) => {
            if (!result.ok) return emit('error', result.error);
            roomCode = code;
            playerToken = result.data.playerToken;
            prevRoundId = null;
            prevResultsReady = false;
            emit('joined', { ...result.data, roomCode: code });
            startPolling();
          });
          break;
        }

        case 'rejoin': {
          roomCode = payload.roomCode;
          playerToken = payload.playerToken;
          api(`/api/rooms/${roomCode}/status?token=${encodeURIComponent(playerToken)}`, { method: 'GET' }).then((result) => {
            if (!result.ok) {
              emit('room_closed', { reason: 'not_found' });
              return;
            }
            const data = result.data;
            prevRoundId = data.roundId || null;
            prevResultsReady = Boolean(data.resultsReady);
            if (data.resultsReady) {
              emit('results_ready', { results: data.results });
            } else if (data.started) {
              emit('deck_ready', { deck: data.deck });
            } else {
              emit('joined', {
                roomCode,
                playerToken,
                playerSlot: data.playerSlot,
                occupiedCount: data.occupiedCount,
                maxPlayers: data.maxPlayers,
                minPlayersToStart: data.minPlayersToStart,
                started: data.started,
              });
            }
            startPolling();
          });
          break;
        }

        case 'start_game': {
          api(`/api/rooms/${roomCode}/start`, { method: 'POST', body: JSON.stringify({ token: playerToken }) }).then((result) => {
            if (!result.ok) return emit('error', result.error);
            prevRoundId = result.data.roundId;
            prevResultsReady = false;
            emit('deck_ready', { deck: result.data.deck });
          });
          break;
        }

        case 'swipe': {
          api(`/api/rooms/${roomCode}/swipe`, {
            method: 'POST',
            body: JSON.stringify({ token: playerToken, dishId: payload.dishId, direction: payload.direction }),
          }).then((result) => {
            if (!result.ok) return emit('error', result.error);
            if (typeof result.data.nextIndex === 'number') emit('swipe_ack', { nextIndex: result.data.nextIndex });
            if (result.data.resultsReady && !prevResultsReady) {
              prevResultsReady = true;
              emit('results_ready', { results: result.data.results });
            }
          });
          break;
        }

        case 'restart_deck': {
          api(`/api/rooms/${roomCode}/restart`, {
            method: 'POST',
            body: JSON.stringify({ token: playerToken, mealTypes: payload.mealTypes }),
          }).then((result) => {
            if (!result.ok) return emit('error', result.error);
            prevRoundId = result.data.roundId;
            prevResultsReady = false;
            emit('deck_ready', { deck: result.data.deck });
          });
          break;
        }

        case 'close_room': {
          api(`/api/rooms/${roomCode}/close`, { method: 'POST', body: JSON.stringify({ token: playerToken }) }).then((result) => {
            stopPolling();
            if (!result.ok) return emit('error', result.error);
            emit('room_closed', { reason: 'closed_by_player' });
          });
          break;
        }

        default:
          break;
      }
    }

    setTimeout(() => emit('_open', {}), 0);

    return { on, send };
  }

  window.createRoomClient = createRoomClient;
})();
