/* ==============================
   CWC Reason Cards
   Scroll-snap carousel. The track scrolls and swipes without JS —
   this only adds arrow buttons and active-dot state.
   ============================== */

(function () {
  'use strict';

  function initSection(sectionEl) {
    if (!sectionEl) return;

    var carousel = sectionEl.querySelector('[data-cwc-reason-carousel]');
    if (!carousel) return;

    var track = carousel.querySelector('[data-cwc-reason-track]');
    var arrows = carousel.querySelector('[data-cwc-reason-arrows]');
    var prevBtn = carousel.querySelector('[data-cwc-reason-prev]');
    var nextBtn = carousel.querySelector('[data-cwc-reason-next]');
    var dots = carousel.querySelectorAll('[data-cwc-reason-dot]');
    if (!track) return;

    var slides = track.querySelectorAll('.cwc_reason-cards__slide');
    if (!slides.length) return;

    function slideStep() {
      if (slides.length < 2) return track.clientWidth;
      return slides[1].offsetLeft - slides[0].offsetLeft;
    }

    // How many slides fit at once — drives how many scroll positions exist.
    function visibleCount() {
      var step = slideStep();
      if (!step) return 1;
      return Math.max(1, Math.round(track.clientWidth / step));
    }

    // With 5 slides and 3 in view there are only 3 reachable positions, so
    // only 3 dots are meaningful. Extra dots are hidden rather than left dead.
    function pageCount() {
      return Math.max(1, slides.length - visibleCount() + 1);
    }

    function activeIndex() {
      var step = slideStep();
      if (!step) return 0;
      var index = Math.round(track.scrollLeft / step);
      return Math.max(0, Math.min(index, pageCount() - 1));
    }

    function syncState() {
      var index = activeIndex();
      var pages = pageCount();
      var maxScroll = track.scrollWidth - track.clientWidth;

      for (var i = 0; i < dots.length; i++) {
        dots[i].hidden = i >= pages;
        dots[i].classList.toggle('cwc_reason-cards__dot--active', i === index);
      }

      // 1px tolerance — fractional scroll positions never land exactly on the edge.
      if (prevBtn) prevBtn.disabled = track.scrollLeft <= 1;
      if (nextBtn) nextBtn.disabled = track.scrollLeft >= maxScroll - 1;
      if (arrows) arrows.hidden = pages < 2;
    }

    function scrollToIndex(index) {
      track.scrollTo({ left: index * slideStep(), behavior: 'smooth' });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        scrollToIndex(Math.max(0, activeIndex() - 1));
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        scrollToIndex(Math.min(pageCount() - 1, activeIndex() + 1));
      });
    }

    for (var d = 0; d < dots.length; d++) {
      (function (dot) {
        dot.addEventListener('click', function () {
          scrollToIndex(parseInt(dot.getAttribute('data-cwc-reason-dot'), 10) || 0);
        });
      })(dots[d]);
    }

    var scrollTimer = null;
    track.addEventListener(
      'scroll',
      function () {
        if (scrollTimer) window.cancelAnimationFrame(scrollTimer);
        scrollTimer = window.requestAnimationFrame(syncState);
      },
      { passive: true }
    );

    window.addEventListener('resize', syncState);

    syncState();
  }

  function initAllSections() {
    document.querySelectorAll('.cwc_reason-cards').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSections);
  } else {
    initAllSections();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector('.cwc_reason-cards');
    if (section) initSection(section);
  });
})();
