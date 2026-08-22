/* ==============================
   CWC Home Reviews — load more
   ==============================

   Review cards past the fourth are rendered with `hidden` by the section. This
   file takes that attribute off a batch at a time, then drops the button once
   the last card is out, so the button is never left sitting there doing
   nothing.

   The batch size comes off the button rather than living here, so the section
   stays the one place that decides how many cards a click is worth.
   ============================== */

(function () {
  'use strict';

  // Shared by the click handler and by the theme editor's block-select, which
  // has to be able to skip straight to the end.
  function hiddenCards(sectionEl) {
    return Array.prototype.slice.call(
      sectionEl.querySelectorAll('[data-cwc-reviews-card][hidden]')
    );
  }

  function revealAll(sectionEl) {
    hiddenCards(sectionEl).forEach(function (card) {
      card.removeAttribute('hidden');
    });

    var button = sectionEl.querySelector('[data-cwc-reviews-more]');
    if (button) button.hidden = true;
  }

  function initSection(sectionEl) {
    if (!sectionEl) return;

    var button = sectionEl.querySelector('[data-cwc-reviews-more]');
    if (!button) return;

    // A section reload hands back fresh DOM, but a stray second init over the
    // same nodes would bind the handler twice and reveal two batches a click.
    if (button.getAttribute('data-cwc-bound') === 'true') return;
    button.setAttribute('data-cwc-bound', 'true');

    var batch = parseInt(button.getAttribute('data-cwc-reveal-batch'), 10);
    if (!batch || batch < 1) batch = 4;

    button.addEventListener('click', function () {
      // Taken in DOM order, so a click always reveals the next cards down the
      // grid rather than an arbitrary set of them.
      var revealed = hiddenCards(sectionEl).slice(0, batch);
      if (!revealed.length) {
        button.hidden = true;
        return;
      }

      revealed.forEach(function (card) {
        card.removeAttribute('hidden');
      });

      if (hiddenCards(sectionEl).length === 0) {
        button.hidden = true;
      }

      // Focus moves to the first card of the new batch. Without it, hiding the
      // button destroys the focused element and drops a keyboard user back at
      // the top of the document — past everything they had just revealed.
      var first = revealed[0];
      first.setAttribute('tabindex', '-1');
      first.focus();
    });
  }

  function initAllSections() {
    document.querySelectorAll('.cwc_home-reviews').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSections);
  } else {
    initAllSections();
  }

  // Theme Editor: re-initialize when the section is loaded/reloaded
  document.addEventListener('shopify:section:load', function (event) {
    var sectionEl = event.target.querySelector('.cwc_home-reviews');
    if (sectionEl) initSection(sectionEl);
  });

  // Theme Editor: selecting a review block past the fourth would otherwise
  // scroll the merchant to a card that is still hidden, which reads as the
  // block having vanished. Everything opens instead.
  document.addEventListener('shopify:block:select', function (event) {
    var sectionEl = event.target.closest
      ? event.target.closest('.cwc_home-reviews')
      : null;
    if (sectionEl) revealAll(sectionEl);
  });
})();
