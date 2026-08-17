(function () {
  'use strict';

  /* Sort: submit on change. Without JS the noscript Apply button does the same. */
  function setupSort(sectionEl) {
    const form = sectionEl.querySelector('[data-cwc-sort-form]');
    if (!form) return;

    const select = form.querySelector('[data-cwc-sort-select]');
    if (!select) return;

    select.addEventListener('change', function () {
      form.submit();
    });
  }

  /* Only one filter dropdown open at a time. */
  function setupFilters(sectionEl) {
    const panels = sectionEl.querySelectorAll('[data-cwc-filter]');
    if (!panels.length) return;

    panels.forEach(function (panel) {
      panel.addEventListener('toggle', function () {
        if (!panel.open) return;

        panels.forEach(function (other) {
          if (other !== panel) other.open = false;
        });
      });
    });

    document.addEventListener('click', function (event) {
      panels.forEach(function (panel) {
        if (panel.open && !panel.contains(event.target)) panel.open = false;
      });
    });
  }

  /* Quick add: AJAX when JS is available, plain form post when it isn't. */
  function setupQuickAdd(sectionEl) {
    const forms = sectionEl.querySelectorAll('[data-cwc-quick-add]');
    if (!forms.length) return;

    forms.forEach(function (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();

        const button = form.querySelector('button');
        if (button) button.setAttribute('aria-busy', 'true');

        fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            items: [
              {
                id: form.querySelector('input[name="id"]').value,
                quantity: 1
              }
            ]
          })
        })
          .then(function (response) {
            if (!response.ok) throw new Error('Add to cart failed');
            return response.json();
          })
          .then(function () {
            document.dispatchEvent(new CustomEvent('cwc:cart:updated'));
          })
          .catch(function () {
            /* Fall back to the product page rather than failing silently. */
            form.submit();
          })
          .finally(function () {
            if (button) button.removeAttribute('aria-busy');
          });
      });
    });
  }

  /* Load more: fetch the next page of this section and append its cards. */
  function setupLoadMore(sectionEl) {
    const button = sectionEl.querySelector('[data-cwc-load-more]');
    if (!button) return;

    const items = sectionEl.querySelector('[data-cwc-grid-items]');
    if (!items) return;

    let loading = false;

    function loadNext() {
      if (loading) return;

      const url = button.getAttribute('href');
      if (!url) return;

      loading = true;
      button.setAttribute('aria-busy', 'true');

      const sectionId = button.getAttribute('data-cwc-section-id');
      const joiner = url.indexOf('?') === -1 ? '?' : '&';

      fetch(url + joiner + 'section_id=' + sectionId)
        .then(function (response) {
          if (!response.ok) throw new Error('Load more failed');
          return response.text();
        })
        .then(function (html) {
          const parsed = new DOMParser().parseFromString(html, 'text/html');

          const newItems = parsed.querySelector('[data-cwc-grid-items]');
          if (newItems) {
            Array.prototype.forEach.call(newItems.children, function (card) {
              items.appendChild(card.cloneNode(true));
            });
          }

          /* Advance the button to the following page, or retire it. */
          const nextButton = parsed.querySelector('[data-cwc-load-more]');
          if (nextButton) {
            button.setAttribute('href', nextButton.getAttribute('href'));
          } else {
            button.remove();
          }

          const showing = sectionEl.querySelector('[data-cwc-showing-current]');
          const newShowing = parsed.querySelector('[data-cwc-showing-current]');
          if (showing && newShowing) showing.textContent = newShowing.textContent;

          setupQuickAdd(sectionEl);
        })
        .catch(function () {
          /* Leave the link intact — clicking it navigates to page 2. */
          button.removeAttribute('data-cwc-auto');
        })
        .finally(function () {
          loading = false;
          button.removeAttribute('aria-busy');
        });
    }

    button.addEventListener('click', function (event) {
      event.preventDefault();
      loadNext();
    });

    if (button.getAttribute('data-cwc-auto') === 'true' && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) loadNext();
        });
      }, { rootMargin: '400px' });

      observer.observe(button);
    }
  }

  function initSection(sectionEl) {
    if (!sectionEl) return;

    setupSort(sectionEl);
    setupFilters(sectionEl);
    setupQuickAdd(sectionEl);
    setupLoadMore(sectionEl);
  }

  function initAllSections() {
    document.querySelectorAll('[data-cwc-grid-section]').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSections);
  } else {
    initAllSections();
  }

  document.addEventListener('shopify:section:load', function (event) {
    const section = event.target.querySelector('[data-cwc-grid-section]');
    if (section) initSection(section);
  });
})();
