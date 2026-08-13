(function () {
  'use strict';

  /* Arrows only enhance the native scroll-snap track — the section
     scrolls and swipes fine with JS disabled. */

  function initSection(sectionEl) {
    if (!sectionEl) return;
    if (!sectionEl.classList.contains('cwc_home-best-sellers--carousel')) return;

    var track = sectionEl.querySelector('[data-cwc-track]');
    var prev = sectionEl.querySelector('[data-cwc-prev]');
    var next = sectionEl.querySelector('[data-cwc-next]');
    if (!track || !prev || !next) return;

    function step() {
      var card = track.querySelector('.cwc_home-best-sellers__card');
      if (!card) return track.clientWidth;
      var gap = parseFloat(getComputedStyle(track).columnGap || '0') || 0;
      return card.getBoundingClientRect().width + gap;
    }

    function sync() {
      var scrollable = track.scrollWidth - track.clientWidth > 2;
      prev.hidden = !scrollable || track.scrollLeft <= 2;
      next.hidden = !scrollable || track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
    }

    prev.addEventListener('click', function () {
      track.scrollBy({ left: -step(), behavior: 'smooth' });
    });

    next.addEventListener('click', function () {
      track.scrollBy({ left: step(), behavior: 'smooth' });
    });

    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }

  function initAllSections() {
    document.querySelectorAll('.cwc_home-best-sellers').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSections);
  } else {
    initAllSections();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector('.cwc_home-best-sellers');
    if (section) initSection(section);
  });
})();
