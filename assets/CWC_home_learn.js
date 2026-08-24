/* ==============================
   CWC Home Learn — mobile card carousel
   ==============================

   The track scrolls natively (CSS scroll-snap does the swiping). This file
   only keeps the dots in sync with the scroll position, moves the track when
   a dot is clicked, and adds mouse-drag so the carousel is usable in the
   theme editor's mobile preview, where there is no touch.
   ============================== */

(function () {
  'use strict';

  function initSection(sectionEl) {
    if (!sectionEl) return;

    var track = sectionEl.querySelector('[data-cwc-learn-track]');
    if (!track) return;

    var slides = Array.prototype.slice.call(
      sectionEl.querySelectorAll('[data-cwc-learn-slide]')
    );
    if (slides.length < 2) return;

    var dots = Array.prototype.slice.call(
      sectionEl.querySelectorAll('[data-cwc-learn-dot]')
    );

    // Distance from the resting position (slide 0) to the given slide. Measured
    // against slide 0 rather than the track box so the track's own padding and
    // scroll-padding cancel out.
    function offsetFor(index) {
      return slides[index].offsetLeft - slides[0].offsetLeft;
    }

    function currentIndex() {
      var scrolled = track.scrollLeft;
      var nearest = 0;
      var shortest = Infinity;

      for (var i = 0; i < slides.length; i++) {
        var distance = Math.abs(scrolled - offsetFor(i));
        if (distance < shortest) {
          shortest = distance;
          nearest = i;
        }
      }

      return nearest;
    }

    function setActiveDot(index) {
      dots.forEach(function (dot, i) {
        var active = i === index;
        dot.classList.toggle('cwc_home-learn__dot--active', active);
        if (active) {
          dot.setAttribute('aria-current', 'true');
        } else {
          dot.removeAttribute('aria-current');
        }
      });
    }

    function goToSlide(index) {
      track.scrollLeft = offsetFor(index);
    }

    // === Scroll -> dots ===
    var syncing = false;

    track.addEventListener(
      'scroll',
      function () {
        if (syncing) return;
        syncing = true;

        window.requestAnimationFrame(function () {
          syncing = false;
          setActiveDot(currentIndex());
        });
      },
      { passive: true }
    );

    // === Dots -> scroll ===
    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        var index = parseInt(dot.getAttribute('data-cwc-learn-dot'), 10);
        if (isNaN(index) || !slides[index]) return;
        goToSlide(index);
        setActiveDot(index);
      });
    });

    // === Mouse drag ===
    // Touch already scrolls natively, so this is limited to mouse pointers —
    // taking over touch would throw away the browser's momentum and snapping.
    if (!window.PointerEvent) return;

    track.classList.add('cwc_home-learn__grid--draggable');

    /**
     * Whether the track can actually scroll.
     *
     * Above the breakpoint this element is a grid, not a carousel — every card
     * is already on screen and there is nothing to drag. That matters more here
     * than in the other carousels because these cards are links: without this
     * check, a mousedown-and-twitch on a desktop card would trip the
     * drag-cancels-click guard below and swallow the navigation.
     *
     * Measured per press rather than cached, so it follows a resize with no
     * listener of its own.
     */
    function isScrollable() {
      return track.scrollWidth > track.clientWidth + 1;
    }

    var dragging = false;
    var dragStartX = 0;
    var dragStartScroll = 0;
    var dragDistance = 0;
    var snapRestore;

    track.addEventListener('pointerdown', function (event) {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      if (!isScrollable()) return;

      dragging = true;
      dragDistance = 0;
      dragStartX = event.clientX;
      dragStartScroll = track.scrollLeft;

      // Writing scrollLeft directly cannot be animated or snapped mid-drag,
      // or the track fights the cursor instead of following it.
      clearTimeout(snapRestore);
      track.style.scrollBehavior = 'auto';
      track.style.scrollSnapType = 'none';
      track.classList.add('cwc_home-learn__grid--dragging');
      track.setPointerCapture(event.pointerId);
    });

    track.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      var delta = event.clientX - dragStartX;
      dragDistance = Math.abs(delta);
      track.scrollLeft = dragStartScroll - delta;
    });

    function endDrag(event) {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('cwc_home-learn__grid--dragging');

      if (track.hasPointerCapture && track.hasPointerCapture(event.pointerId)) {
        track.releasePointerCapture(event.pointerId);
      }

      // Settle smoothly to the nearest card first, then hand snapping back.
      // Re-enabling it immediately would make the browser jump to the snap
      // point before the animation had a chance to run.
      track.style.scrollBehavior = '';
      var index = currentIndex();
      goToSlide(index);
      setActiveDot(index);

      snapRestore = setTimeout(function () {
        track.style.scrollSnapType = '';
      }, 400);
    }

    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);

    // A drag that ends on a card would otherwise fire a click too — and every
    // card here is a link, so the drag would navigate away.
    track.addEventListener(
      'click',
      function (event) {
        if (dragDistance > 5) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      true
    );
  }

  function initAllSections() {
    document.querySelectorAll('.cwc_home-learn').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSections);
  } else {
    initAllSections();
  }

  // Theme Editor: re-initialize when the section is loaded/reloaded
  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector('.cwc_home-learn');
    if (section) initSection(section);
  });
})();
