(function () {
  'use strict';

  var SECTION_ID = 'CWC_predictive_search';
  var DEBOUNCE_MS = 250;

  /* ==============================
     Mobile nav
     ============================== */
  function initNav(sectionEl) {
    var toggle = sectionEl.querySelector('[data-cwc-toggle]');
    var menu = sectionEl.querySelector('[data-cwc-menu]');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', function () {
      var isOpen = menu.classList.toggle('cwc_header__links--open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  /* ==============================
     Predictive search panel

     Results are rendered by the CWC_predictive_search section and fetched
     through the predictive search URL, so nothing here has to format money or
     build product markup.
     ============================== */
  function initSearch(sectionEl) {
    var trigger = sectionEl.querySelector('[data-cwc-search-open]');
    var panel = sectionEl.querySelector('[data-cwc-search-panel]');
    if (!trigger || !panel) return;

    var overlay = sectionEl.querySelector('[data-cwc-search-overlay]');
    var input = panel.querySelector('[data-cwc-search-input]');
    var results = panel.querySelector('[data-cwc-search-results]');
    var popular = panel.querySelector('[data-cwc-search-popular]');
    var status = panel.querySelector('[data-cwc-search-status]');
    var closeButton = panel.querySelector('[data-cwc-search-close]');
    if (!input || !results) return;

    var baseUrl = panel.getAttribute('data-cwc-search-url') || '/search/suggest';
    var limit = parseInt(panel.getAttribute('data-cwc-search-limit'), 10) || 6;
    var minChars = parseInt(panel.getAttribute('data-cwc-search-min'), 10) || 3;

    var timer = null;
    var controller = null;
    var lastQuery = '';

    /* --- open / close --- */

    function open() {
      panel.hidden = false;
      if (overlay) overlay.hidden = false;

      // next frame, so the transition has a start value to animate from
      requestAnimationFrame(function () {
        panel.classList.add('cwc_header__search--visible');
        if (overlay) overlay.classList.add('cwc_header__search-overlay--visible');
      });

      trigger.setAttribute('aria-expanded', 'true');
      input.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      input.focus();
    }

    function close() {
      if (panel.hidden) return;

      panel.classList.remove('cwc_header__search--visible');
      if (overlay) overlay.classList.remove('cwc_header__search-overlay--visible');

      panel.hidden = true;
      if (overlay) overlay.hidden = true;

      trigger.setAttribute('aria-expanded', 'false');
      input.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';

      abort();
      trigger.focus();
    }

    function isOpen() {
      return !panel.hidden;
    }

    /* --- fetching --- */

    function abort() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (controller) {
        controller.abort();
        controller = null;
      }
    }

    function showPopular() {
      results.innerHTML = '';
      if (popular) popular.hidden = false;
      setStatus('');
      input.setAttribute('aria-expanded', 'false');
    }

    function setStatus(message) {
      if (!status) return;
      status.textContent = message;
      status.hidden = !message;
    }

    function search(query) {
      // a new request supersedes any in flight, so a slow early response can
      // never overwrite a fast later one
      abort();

      controller = 'AbortController' in window ? new AbortController() : null;

      var url =
        baseUrl +
        '?q=' +
        encodeURIComponent(query) +
        '&resources[type]=product' +
        '&resources[limit]=' +
        limit +
        '&section_id=' +
        SECTION_ID;

      fetch(url, controller ? { signal: controller.signal } : undefined)
        .then(function (response) {
          if (!response.ok) throw new Error('Search failed');
          return response.text();
        })
        .then(function (html) {
          // ignore anything that is no longer the current query
          if (query !== lastQuery) return;

          if (popular) popular.hidden = true;
          results.innerHTML = extractPayload(html);
          setStatus('');
          input.setAttribute('aria-expanded', 'true');
        })
        .catch(function (error) {
          if (error && error.name === 'AbortError') return;
          setStatus('Search is unavailable right now.');
        });
    }

    /* The section response is wrapped in Shopify's section div. Take our own
       payload node when it is there so the wrapper never nests. */
    function extractPayload(html) {
      var holder = document.createElement('div');
      holder.innerHTML = html;

      var payload = holder.querySelector('[data-cwc-search-payload]');
      return payload ? payload.innerHTML : holder.innerHTML;
    }

    function onInput() {
      var query = input.value.trim();
      lastQuery = query;

      if (query.length < minChars) {
        abort();
        showPopular();
        return;
      }

      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        search(query);
      }, DEBOUNCE_MS);
    }

    /* --- keyboard --- */

    function resultLinks() {
      return Array.prototype.slice.call(
        results.querySelectorAll('.cwc_header__search-result')
      );
    }

    function moveFocus(direction) {
      var links = resultLinks();
      if (!links.length) return;

      var index = links.indexOf(document.activeElement);
      var next = index + direction;

      if (index === -1) next = direction > 0 ? 0 : links.length - 1;
      if (next < 0) next = links.length - 1;
      if (next >= links.length) next = 0;

      links.forEach(function (link) {
        link.classList.remove('cwc_header__search-result--active');
        link.setAttribute('aria-selected', 'false');
      });
      links[next].classList.add('cwc_header__search-result--active');
      links[next].setAttribute('aria-selected', 'true');
      links[next].focus();
    }

    /* --- wiring --- */

    trigger.addEventListener('click', function (event) {
      // the href is the no-script fallback; take over when we can do better
      event.preventDefault();
      if (isOpen()) {
        close();
      } else {
        open();
      }
    });

    if (closeButton) closeButton.addEventListener('click', close);
    if (overlay) overlay.addEventListener('click', close);

    input.addEventListener('input', onInput);

    panel.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        close();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveFocus(1);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveFocus(-1);
      }
    });

    // popular chips stay real links, but run the search inline instead
    if (popular) {
      popular.addEventListener('click', function (event) {
        var chip = event.target.closest('[data-cwc-search-term]');
        if (!chip) return;

        event.preventDefault();
        input.value = chip.getAttribute('data-cwc-search-term') || '';
        input.focus();
        onInput();
      });
    }

    showPopular();
  }

  function initSection(sectionEl) {
    if (!sectionEl) return;
    // independent, so a header without nav still gets search and vice versa
    initNav(sectionEl);
    initSearch(sectionEl);
  }

  function initAllSections() {
    document.querySelectorAll('.cwc_header').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSections);
  } else {
    initAllSections();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector('.cwc_header');
    if (section) initSection(section);
  });
})();
