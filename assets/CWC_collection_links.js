/* ==============================
   CWC Collection Links
   ------------------------------
   The pill row is a horizontal scroller. Two jobs here:

   1. Bring the active pill into view. On a long row the pill for the
      collection the shopper is actually on can start off-screen, which loses
      the whole point of highlighting it.
   2. Drag to scroll with a mouse. Touch and trackpad already work natively;
      desktop mouse users otherwise have only the scrollbar.
   ============================== */

(function () {
  'use strict';

  var NAV = '[data-cwc-links-nav]';
  var ACTIVE = '.cwc_collection-links__pill--active';
  var DRAGGING = 'cwc_collection-links__nav--dragging';

  /* Centre the active pill in the visible strip, clamped to the ends so we
     never leave a gap. Written as a direct scrollLeft set rather than
     scrollIntoView, which would also scroll the page vertically. */
  function revealActive(nav) {
    var active = nav.querySelector(ACTIVE);
    if (!active) return;
    if (nav.scrollWidth <= nav.clientWidth) return;

    var target = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    var max = nav.scrollWidth - nav.clientWidth;

    if (target < 0) target = 0;
    if (target > max) target = max;

    // jump, not glide — this is initial position, not a user action
    var previous = nav.style.scrollBehavior;
    nav.style.scrollBehavior = 'auto';
    nav.scrollLeft = target;
    nav.style.scrollBehavior = previous || '';
  }

  function enableDragScroll(nav) {
    var down = false;
    var moved = false;
    var startX = 0;
    var startScroll = 0;

    nav.addEventListener('mousedown', function (event) {
      // left button only
      if (event.button !== 0) return;
      down = true;
      moved = false;
      startX = event.pageX;
      startScroll = nav.scrollLeft;
    });

    nav.addEventListener('mousemove', function (event) {
      if (!down) return;
      var delta = event.pageX - startX;
      if (!moved && Math.abs(delta) > 4) {
        moved = true;
        nav.classList.add(DRAGGING);
      }
      if (moved) {
        event.preventDefault();
        nav.scrollLeft = startScroll - delta;
      }
    });

    function end() {
      down = false;
      nav.classList.remove(DRAGGING);
    }

    nav.addEventListener('mouseup', end);
    nav.addEventListener('mouseleave', end);

    /* A drag that ends on a pill must not follow its link. Capture phase so we
       stop it before the anchor's default action. */
    nav.addEventListener(
      'click',
      function (event) {
        if (moved) {
          event.preventDefault();
          event.stopPropagation();
          moved = false;
        }
      },
      true
    );
  }

  function initSection(sectionEl) {
    if (!sectionEl) return;

    var nav = sectionEl.querySelector(NAV);
    if (!nav) return;

    revealActive(nav);
    enableDragScroll(nav);

    // fonts and images settling can change pill widths after first paint
    window.addEventListener('load', function () {
      revealActive(nav);
    });
  }

  function initAllSections() {
    document.querySelectorAll('.cwc_collection-links').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSections);
  } else {
    initAllSections();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector('.cwc_collection-links');
    if (section) initSection(section);
  });
})();
