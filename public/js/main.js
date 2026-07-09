(function () {
  const views = {
    landing: document.getElementById('view-landing'),
    waiting: document.getElementById('view-waiting'),
    swipe: document.getElementById('view-swipe'),
    match: document.getElementById('view-match'),
    nomatch: document.getElementById('view-nomatch'),
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
    opponentBanner: document.getElementById('opponent-banner'),
    passBtn: document.getElementById('btn-pass'),
    likeBtn: document.getElementById('btn-like'),
    matchCard: document.getElementById('match-card'),
    restartFromMatch: document.getElementById('btn-restart-from-match'),
    restartFromNomatch: document.getElementById('btn-restart-from-nomatch'),
    mealTypeChips: document.getElementById('meal-type-chips'),
    closeRoomBtn: document.getElementById('btn-close-room'),
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
  };

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

  const ws = window.createWsClient();

  const deck = window.createSwipeDeck(el.cardStack, {
    onCommit(dish, direction) {
      ws.send('swipe', { dishId: dish.id, direction });
      updateProgress();
    },
  });

  function updateProgress() {
    const remaining = deck.remaining();
    el.progressText.textContent = remaining > 0
      ? `${remaining} dish${remaining === 1 ? '' : 'es'} left`
      : 'All done';
  }

  function renderDishCard(container, dish) {
    const mediaHtml = dish.imageUrl
      ? `<div class="card-media"><img src="${dish.imageUrl}" alt="${dish.name}" onerror="this.parentElement.textContent='${dish.emoji || '🍽️'}'" /></div>`
      : `<div class="card-media">${dish.emoji || '🍽️'}</div>`;
    container.innerHTML = `
      ${mediaHtml}
      <div class="card-info">
        <h3>${dish.name}</h3>
        <p>${[dish.area, dish.category].filter(Boolean).join(' · ')}</p>
        ${dish.description ? `<p>${dish.description}</p>` : ''}
      </div>
    `;
  }

  // --- Landing actions ---
  el.createBtn.addEventListener('click', () => {
    clearLandingError();
    ws.send('create_room', { mealTypes: getSelectedMealTypes() });
  });

  el.joinBtn.addEventListener('click', () => {
    clearLandingError();
    const code = el.roomCodeInput.value.trim().toUpperCase();
    if (code.length < 4) {
      showLandingError('Enter a valid room code.');
      return;
    }
    ws.send('join_room', { roomCode: code });
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
  el.restartFromMatch.addEventListener('click', () => ws.send('restart_deck'));
  el.restartFromNomatch.addEventListener('click', () => ws.send('restart_deck'));

  el.closeRoomBtn.addEventListener('click', () => {
    if (window.confirm('Close this room for both of you?')) {
      ws.send('close_room');
    }
  });

  // --- Server events ---
  ws.on('room_created', (msg) => {
    state.roomCode = msg.roomCode;
    state.playerToken = msg.playerToken;
    state.playerSlot = msg.playerSlot;
    saveSession();
    el.roomCodeDisplay.textContent = msg.roomCode;
    showView('waiting');
  });

  ws.on('joined', (msg) => {
    state.roomCode = msg.roomCode;
    state.playerToken = msg.playerToken;
    state.playerSlot = msg.playerSlot;
    saveSession();
    showView('waiting');
  });

  ws.on('player_joined', () => {
    // deck_ready will follow shortly and move us to the swipe view
  });

  ws.on('player_disconnected', () => {
    el.opponentBanner.textContent = 'Partner disconnected — waiting…';
    el.opponentBanner.hidden = false;
  });

  ws.on('player_reconnected', () => {
    el.opponentBanner.hidden = true;
  });

  ws.on('room_closed', (msg) => {
    clearSession();
    const messages = {
      partner_left: 'Your partner left the session.',
      closed_by_player: 'The room was closed.',
    };
    showLandingError(messages[msg.reason] || 'The session ended.');
    showView('landing');
  });

  ws.on('deck_ready', (msg) => {
    state.deckLength = msg.deck.length;
    state.lastDeck = msg.deck;
    deck.setDeck(msg.deck, 0);
    updateProgress();
    el.opponentBanner.hidden = true;
    showView('swipe');
  });

  ws.on('match_found', (msg) => {
    renderDishCard(el.matchCard, msg.dish);
    showView('match');
  });

  ws.on('deck_exhausted', () => {
    showView('nomatch');
  });

  ws.on('swipe_ack', (msg) => {
    if (typeof msg.nextIndex === 'number' && state.lastDeck && msg.nextIndex !== deck.currentIndex()) {
      deck.setDeck(state.lastDeck, msg.nextIndex);
      updateProgress();
    }
  });

  ws.on('error', (msg) => {
    if (views.landing.hidden === false) {
      showLandingError(msg.message || 'Something went wrong.');
    } else if (msg.code === 'out_of_order' && typeof msg.nextIndex === 'number' && state.lastDeck) {
      deck.setDeck(state.lastDeck, msg.nextIndex);
      updateProgress();
    }
  });

  // --- Reconnect flow ---
  ws.on('_open', () => {
    const saved = loadSession();
    if (saved.roomCode && saved.playerToken) {
      state.roomCode = saved.roomCode;
      state.playerToken = saved.playerToken;
      ws.send('rejoin', { roomCode: saved.roomCode, playerToken: saved.playerToken });
    }
  });

  showView('landing');
})();
