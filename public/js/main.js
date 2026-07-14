(function () {
  const views = {
    landing: document.getElementById('view-landing'),
    waiting: document.getElementById('view-waiting'),
    swipe: document.getElementById('view-swipe'),
    results: document.getElementById('view-results'),
  };

  const el = {
    createBtn: document.getElementById('btn-create-room'),
    joinBtn: document.getElementById('btn-join-room'),
    roomCodeInput: document.getElementById('input-room-code'),
    landingError: document.getElementById('landing-error'),
    roomCodeDisplay: document.getElementById('room-code-display'),
    copyLinkBtn: document.getElementById('btn-copy-link'),
    cardStack: document.getElementById('card-stack'),
    progressText: document.getElementById('progress-text'),
    passBtn: document.getElementById('btn-pass'),
    likeBtn: document.getElementById('btn-like'),
    resultsHeading: document.getElementById('results-heading'),
    resultsList: document.getElementById('results-list'),
    restartFromResults: document.getElementById('btn-restart-from-results'),
    mealTypeChips: document.getElementById('meal-type-chips'),
    closeRoomBtn: document.getElementById('btn-close-room'),
    memberCountText: document.getElementById('member-count-text'),
    startGameBtn: document.getElementById('btn-start-game'),
    waitingHint: document.getElementById('waiting-hint'),
  };

  const MEAL_TYPES = ['breakfast', 'lunch', 'snacks', 'dessert'];
  let selectedMealTypes = new Set(['all']);

  function renderMealTypeChips() {
    el.mealTypeChips.querySelectorAll('.chip').forEach((chip) => {
      chip.classList.toggle('active', selectedMealTypes.has(chip.dataset.mealType));
    });
  }

  el.mealTypeChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const type = chip.dataset.mealType;
    if (type === 'all') {
      selectedMealTypes = new Set(['all']);
    } else {
      selectedMealTypes.delete('all');
      if (selectedMealTypes.has(type)) {
        selectedMealTypes.delete(type);
      } else {
        selectedMealTypes.add(type);
      }
      if (selectedMealTypes.size === 0 || selectedMealTypes.size === MEAL_TYPES.length) {
        selectedMealTypes = new Set(['all']);
      }
    }
    renderMealTypeChips();
  });

  function getSelectedMealTypes() {
    return selectedMealTypes.has('all') ? [] : [...selectedMealTypes];
  }

  const state = {
    roomCode: null,
    playerToken: null,
    playerSlot: null,
    deckLength: 0,
    occupiedCount: 1,
    maxPlayers: 5,
    minPlayersToStart: 2,
    started: false,
  };

  const HOST_SLOT = 1;

  function updateLobbyUI() {
    const isHost = state.playerSlot === HOST_SLOT;
    el.memberCountText.textContent = `${state.occupiedCount} of ${state.maxPlayers} joined`;
    const canStart = isHost && !state.started && state.occupiedCount >= state.minPlayersToStart;
    el.startGameBtn.hidden = !canStart;
    if (isHost) {
      el.waitingHint.hidden = canStart;
      el.waitingHint.textContent = 'Waiting for at least one more player to join…';
    } else {
      el.waitingHint.hidden = false;
      el.waitingHint.textContent = 'Waiting for the host to start…';
    }
  }

  function enterWaitingRoom(msg) {
    state.roomCode = msg.roomCode;
    state.playerToken = msg.playerToken;
    state.playerSlot = msg.playerSlot;
    state.occupiedCount = msg.occupiedCount;
    state.maxPlayers = msg.maxPlayers;
    state.minPlayersToStart = msg.minPlayersToStart;
    state.started = msg.started;
    saveSession();
    el.roomCodeDisplay.textContent = msg.roomCode;
    updateLobbyUI();
    showView('waiting');
  }

  function showView(name) {
    Object.entries(views).forEach(([key, section]) => {
      section.hidden = key !== name;
    });
    el.closeRoomBtn.hidden = name === 'landing';
  }

  function showLandingError(message) {
    el.landingError.textContent = message;
    el.landingError.hidden = false;
  }

  function clearLandingError() {
    el.landingError.hidden = true;
  }

  function saveSession() {
    sessionStorage.setItem('foodMatch.roomCode', state.roomCode);
    sessionStorage.setItem('foodMatch.playerToken', state.playerToken);
  }

  function loadSession() {
    return {
      roomCode: sessionStorage.getItem('foodMatch.roomCode'),
      playerToken: sessionStorage.getItem('foodMatch.playerToken'),
    };
  }

  function clearSession() {
    sessionStorage.removeItem('foodMatch.roomCode');
    sessionStorage.removeItem('foodMatch.playerToken');
  }

  const room = window.createRoomClient();

  const deck = window.createSwipeDeck(el.cardStack, {
    onCommit(dish, direction) {
      room.send('swipe', { dishId: dish.id, direction });
      updateProgress();
    },
  });

  function updateProgress() {
    const remaining = deck.remaining();
    el.progressText.textContent = remaining > 0
      ? `${remaining} dish${remaining === 1 ? '' : 'es'} left`
      : 'All done';
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function renderResults(results) {
    const total = state.occupiedCount;
    if (results.length === 0) {
      el.resultsHeading.textContent = 'No dish got 2 or more likes 🤷';
      el.resultsList.innerHTML = '<p class="results-empty">Try again with a fresh deck?</p>';
      return;
    }

    el.resultsHeading.textContent = "Here's what you all agreed on! 🎉";
    el.resultsList.innerHTML = '';
    let lastCount = null;
    results.forEach((entry) => {
      if (entry.likeCount !== lastCount) {
        const heading = document.createElement('h3');
        heading.className = 'results-tier-heading';
        heading.textContent = entry.likeCount === total
          ? `Everyone agreed (${entry.likeCount}/${total})`
          : `${entry.likeCount} of ${total} liked this`;
        el.resultsList.appendChild(heading);
        lastCount = entry.likeCount;
      }

      const dish = entry.dish;
      const mediaHtml = dish.imageUrl
        ? `<div class="card-media"><img src="${dish.imageUrl}" alt="${escapeHtml(dish.name)}" onerror="this.parentElement.innerHTML='${escapeHtml(dish.emoji || '🍽️')}'" /></div>`
        : `<div class="card-media">${escapeHtml(dish.emoji || '🍽️')}</div>`;

      const item = document.createElement('div');
      item.className = 'result-item';
      item.innerHTML = `
        ${mediaHtml}
        <div class="result-info">
          <h4>${escapeHtml(dish.name)}</h4>
          <p>${escapeHtml([dish.area, dish.category].filter(Boolean).join(' · '))}</p>
          <a class="btn btn-secondary" href="${entry.swiggyUrl}" target="_blank" rel="noopener noreferrer">Order on Swiggy</a>
        </div>
      `;
      el.resultsList.appendChild(item);
    });
  }

  // --- Landing actions ---
  el.createBtn.addEventListener('click', () => {
    clearLandingError();
    room.send('create_room', { mealTypes: getSelectedMealTypes() });
  });

  el.joinBtn.addEventListener('click', () => {
    clearLandingError();
    const code = el.roomCodeInput.value.trim().toUpperCase();
    if (code.length < 4) {
      showLandingError('Enter a valid room code.');
      return;
    }
    room.send('join_room', { roomCode: code });
  });

  const urlRoom = new URLSearchParams(window.location.search).get('room');
  if (urlRoom) {
    el.roomCodeInput.value = urlRoom.toUpperCase();
  }

  el.copyLinkBtn.addEventListener('click', () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${state.roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      el.copyLinkBtn.textContent = 'Copied!';
      setTimeout(() => { el.copyLinkBtn.textContent = 'Copy invite link'; }, 1500);
    }).catch(() => {
      window.prompt('Copy this link:', url);
    });
  });

  // --- Swipe actions ---
  el.likeBtn.addEventListener('click', () => deck.swipeCurrent('like'));
  el.passBtn.addEventListener('click', () => deck.swipeCurrent('pass'));
  el.restartFromResults.addEventListener('click', () => room.send('restart_deck'));

  el.closeRoomBtn.addEventListener('click', () => {
    if (window.confirm('Close this room for everyone?')) {
      room.send('close_room');
    }
  });

  el.startGameBtn.addEventListener('click', () => {
    room.send('start_game');
  });

  // --- Server events ---
  room.on('room_created', enterWaitingRoom);
  room.on('joined', enterWaitingRoom);

  room.on('room_status', (msg) => {
    state.occupiedCount = msg.occupiedCount;
    state.maxPlayers = msg.maxPlayers;
    state.minPlayersToStart = msg.minPlayersToStart;
    state.started = msg.started;
    if (views.waiting.hidden === false) updateLobbyUI();
  });

  room.on('room_closed', (msg) => {
    clearSession();
    const messages = {
      not_found: 'This session no longer exists.',
      invalid_token: 'This session no longer exists.',
      closed_by_player: 'The room was closed.',
    };
    showLandingError(messages[msg.reason] || 'The session ended.');
    showView('landing');
  });

  room.on('deck_ready', (msg) => {
    state.started = true;
    state.deckLength = msg.deck.length;
    state.lastDeck = msg.deck;
    deck.setDeck(msg.deck, 0);
    updateProgress();
    showView('swipe');
  });

  room.on('results_ready', (msg) => {
    renderResults(msg.results);
    showView('results');
  });

  room.on('swipe_ack', (msg) => {
    if (typeof msg.nextIndex === 'number' && state.lastDeck && msg.nextIndex !== deck.currentIndex()) {
      deck.setDeck(state.lastDeck, msg.nextIndex);
      updateProgress();
    }
  });

  room.on('error', (msg) => {
    if (views.landing.hidden === false) {
      showLandingError(msg.message || 'Something went wrong.');
    } else if (msg.code === 'out_of_order' && typeof msg.nextIndex === 'number' && state.lastDeck) {
      deck.setDeck(state.lastDeck, msg.nextIndex);
      updateProgress();
    } else if (['not_host', 'not_enough_players', 'not_started'].includes(msg.code)) {
      window.alert(msg.message || 'Something went wrong.');
    }
  });

  // --- Reconnect flow ---
  room.on('_open', () => {
    const saved = loadSession();
    if (saved.roomCode && saved.playerToken) {
      state.roomCode = saved.roomCode;
      state.playerToken = saved.playerToken;
      room.send('rejoin', { roomCode: saved.roomCode, playerToken: saved.playerToken });
    }
  });

  showView('landing');
})();
