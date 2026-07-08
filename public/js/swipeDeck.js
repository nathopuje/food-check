(function () {
  const VISIBLE_COUNT = 3;
  const SWIPE_THRESHOLD = 100;

  function createSwipeDeck(container, { onCommit }) {
    let deck = [];
    let index = 0;

    function cardMediaHtml(dish) {
      if (dish.imageUrl) {
        return `<div class="card-media"><img src="${dish.imageUrl}" alt="${escapeHtml(dish.name)}" onerror="this.parentElement.innerHTML='${escapeHtml(dish.emoji || '🍽️')}'" /></div>`;
      }
      return `<div class="card-media">${escapeHtml(dish.emoji || '🍽️')}</div>`;
    }

    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[c]));
    }

    function render() {
      container.innerHTML = '';
      const slice = deck.slice(index, index + VISIBLE_COUNT);
      slice.forEach((dish, i) => {
        const depth = i;
        const el = document.createElement('div');
        el.className = 'food-card';
        el.style.zIndex = String(100 - depth);
        el.style.transform = `translateY(${depth * 8}px) scale(${1 - depth * 0.03})`;
        el.innerHTML = `
          ${cardMediaHtml(dish)}
          <div class="card-info">
            <h3>${escapeHtml(dish.name)}</h3>
            <p>${escapeHtml([dish.area, dish.category].filter(Boolean).join(' · '))}</p>
          </div>
          <div class="stamp stamp-like">LIKE</div>
          <div class="stamp stamp-pass">PASS</div>
        `;
        container.appendChild(el);
        if (depth === 0) attachDrag(el, dish);
      });
    }

    function attachDrag(el, dish) {
      let startX = 0;
      let startY = 0;
      let dx = 0;
      let dragging = false;
      const likeStamp = el.querySelector('.stamp-like');
      const passStamp = el.querySelector('.stamp-pass');

      function onPointerDown(e) {
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        el.setPointerCapture(e.pointerId);
        el.style.transition = 'none';
      }

      function onPointerMove(e) {
        if (!dragging) return;
        dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const rotate = dx / 12;
        el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotate}deg)`;
        const opacity = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
        if (dx > 0) {
          likeStamp.style.opacity = opacity;
          passStamp.style.opacity = 0;
        } else {
          passStamp.style.opacity = opacity;
          likeStamp.style.opacity = 0;
        }
      }

      function onPointerUp() {
        if (!dragging) return;
        dragging = false;
        el.style.transition = 'transform 0.3s ease';
        if (Math.abs(dx) > SWIPE_THRESHOLD) {
          const direction = dx > 0 ? 'like' : 'pass';
          flyAway(el, direction, dish);
        } else {
          el.style.transform = 'translate(0, 0) rotate(0)';
          likeStamp.style.opacity = 0;
          passStamp.style.opacity = 0;
        }
        dx = 0;
      }

      el.addEventListener('pointerdown', onPointerDown);
      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', onPointerUp);
      el.addEventListener('pointercancel', onPointerUp);
    }

    function flyAway(el, direction, dish) {
      const flyX = direction === 'like' ? 600 : -600;
      el.style.transform = `translate(${flyX}px, -40px) rotate(${direction === 'like' ? 30 : -30}deg)`;
      el.style.opacity = '0';
      commit(direction, dish);
    }

    function commit(direction, dish) {
      if (!dish) return;
      index += 1;
      onCommit(dish, direction);
      setTimeout(render, 180);
    }

    function setDeck(newDeck, startIndex = 0) {
      deck = newDeck;
      index = startIndex;
      render();
    }

    function swipeCurrent(direction) {
      const dish = deck[index];
      const topEl = container.querySelector('.food-card:first-child');
      if (!dish) return;
      if (topEl) {
        flyAway(topEl, direction, dish);
      } else {
        commit(direction, dish);
      }
    }

    function remaining() {
      return Math.max(deck.length - index, 0);
    }

    function currentIndex() {
      return index;
    }

    return { setDeck, swipeCurrent, remaining, currentIndex };
  }

  window.createSwipeDeck = createSwipeDeck;
})();
