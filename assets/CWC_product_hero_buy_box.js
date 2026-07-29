(function () {
  'use strict';

  var SELECTED_OFFER = 'cwc_product-hero-buy-box__offer--selected';
  var SELECTED_FLAVOR = 'cwc_product-hero-buy-box__flavor--selected';
  var ACTIVE_THUMB = 'cwc_product-hero-buy-box__thumb--active';
  var HIDDEN_PANEL = 'cwc_product-hero-buy-box__detail-answer--hidden';
  var STICKY_VISIBLE = 'cwc_sticky-add-to-cart--visible';

  function parseVariants(sectionEl) {
    var raw = sectionEl.getAttribute('data-cwc-variants');
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch (error) {
      return [];
    }
  }

  function findVariant(variants, variantId) {
    for (var i = 0; i < variants.length; i++) {
      if (String(variants[i].id) === String(variantId)) return variants[i];
    }
    return null;
  }

  // Horizontal thumbnail strip: paged prev/next arrows that hide at the ends.
  function initThumbScroller(sectionEl) {
    var scroller = sectionEl.querySelector('[data-cwc-thumbs-scroller]');
    if (!scroller) return;

    var prev = sectionEl.querySelector('[data-cwc-thumbs-prev]');
    var next = sectionEl.querySelector('[data-cwc-thumbs-next]');
    if (!prev && !next) return;

    function overflowAmount() {
      return scroller.scrollWidth - scroller.clientWidth;
    }

    function syncArrows() {
      // 1px tolerance absorbs sub-pixel rounding at the extremes
      var max = overflowAmount();
      var scrollable = max > 1;
      var atStart = scroller.scrollLeft <= 1;
      var atEnd = scroller.scrollLeft >= max - 1;

      // Arrows only disappear when there is nothing to scroll at all. At the
      // ends they stay in place and disable, so the strip never shifts.
      if (prev) {
        prev.hidden = !scrollable;
        prev.disabled = atStart;
      }
      if (next) {
        next.hidden = !scrollable;
        next.disabled = atEnd;
      }
    }

    function page(direction) {
      // scroll by a viewport-width page, minus one thumb for visual continuity
      var thumb = scroller.querySelector('.cwc_product-hero-buy-box__thumb');
      var step = thumb ? scroller.clientWidth - thumb.offsetWidth : scroller.clientWidth;
      scroller.scrollBy({ left: direction * Math.max(step, 1), behavior: 'smooth' });
    }

    if (prev) {
      prev.addEventListener('click', function () {
        page(-1);
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        page(1);
      });
    }

    scroller.addEventListener('scroll', syncArrows, { passive: true });
    window.addEventListener('resize', syncArrows);

    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(syncArrows).observe(scroller);
    }

    syncArrows();
  }

  // Sticky bar: visible only while the main Add To Cart button is out of view.
  // It lives inside this section's product form now, so there is no variant or
  // plan state to mirror — only the reveal behaviour belongs here.
  function initStickyBar(sectionEl) {
    var sticky = sectionEl.querySelector('[data-cwc-sticky]');
    if (!sticky) return;

    function show() {
      sticky.classList.add(STICKY_VISIBLE);
    }
    function hide() {
      sticky.classList.remove(STICKY_VISIBLE);
    }

    // Clear anything left by a previous init (Theme Editor reloads the section)
    if (sticky._cwcObserver) {
      sticky._cwcObserver.disconnect();
      sticky._cwcObserver = null;
    }
    if (sticky._cwcScroll) {
      window.removeEventListener('scroll', sticky._cwcScroll);
      sticky._cwcScroll = null;
    }

    var cta = sectionEl.querySelector('.cwc_product-hero-buy-box__cta');

    if (cta && 'IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              hide();
            } else {
              show();
            }
          });
        },
        { threshold: 0 }
      );
      observer.observe(cta);
      sticky._cwcObserver = observer;
      return;
    }

    // No Add To Cart block on the page (it is optional) — fall back to a
    // scroll distance, and stand down near the very bottom.
    var revealAfter = parseInt(sticky.getAttribute('data-cwc-reveal-after'), 10) || 600;
    var onScroll = function () {
      var scrolled = window.pageYOffset || document.documentElement.scrollTop;
      var nearBottom = window.innerHeight + scrolled >= document.body.offsetHeight - 120;
      if (scrolled > revealAfter && !nearBottom) {
        show();
      } else {
        hide();
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    sticky._cwcScroll = onScroll;
    onScroll();
  }

  function initSection(sectionEl) {
    if (!sectionEl) return;

    var variants = parseVariants(sectionEl);
    var variantInput = sectionEl.querySelector('[data-cwc-variant-input]');
    var quantityInput = sectionEl.querySelector('[data-cwc-quantity-input]');
    var planInput = sectionEl.querySelector('[data-cwc-plan-input]');
    var offers = sectionEl.querySelectorAll('[data-cwc-offer]');
    var flavors = sectionEl.querySelectorAll('[data-cwc-variant]');
    var thumbs = sectionEl.querySelectorAll('[data-cwc-thumb]');
    var mainImage = sectionEl.querySelector('[data-cwc-gallery-image]');
    var onetime = sectionEl.querySelector('[data-cwc-onetime]');

    // The sticky bar shares this section's form, so only its display text has
    // to follow the selection — the inputs it submits are already the same ones.
    var stickyPlanLabel = sectionEl.querySelector('[data-cwc-plan-label]');
    var stickyPrice = sectionEl.querySelector('[data-cwc-button-price]');

    function syncSticky(label, price) {
      if (stickyPlanLabel && label) stickyPlanLabel.textContent = label;
      if (stickyPrice && price) stickyPrice.textContent = price;
    }

    function announce() {
      var selected = sectionEl.querySelector('.' + SELECTED_OFFER);
      var priceEl = selected ? selected.querySelector('[data-cwc-offer-now]') : null;
      var nameEl = selected ? selected.querySelector('.cwc_product-hero-buy-box__offer-name') : null;

      syncSticky(
        nameEl ? nameEl.textContent.trim() : '',
        priceEl ? priceEl.textContent.trim() : ''
      );

      sectionEl.dispatchEvent(
        new CustomEvent('cwc:buybox:change', {
          bubbles: true,
          detail: {
            sectionId: sectionEl.id,
            variantId: variantInput ? variantInput.value : '',
            sellingPlan: planInput ? planInput.value : '',
            quantity: quantityInput ? quantityInput.value : '1',
            price: priceEl ? priceEl.textContent.trim() : '',
            label: nameEl ? nameEl.textContent.trim() : ''
          }
        })
      );
    }

    function selectOffer(offerEl) {
      offers.forEach(function (item) {
        item.classList.remove(SELECTED_OFFER);
        var input = item.querySelector('.cwc_product-hero-buy-box__offer-input');
        if (input) input.checked = false;
      });

      offerEl.classList.add(SELECTED_OFFER);
      var radio = offerEl.querySelector('.cwc_product-hero-buy-box__offer-input');
      if (radio) radio.checked = true;

      if (planInput) planInput.value = offerEl.getAttribute('data-cwc-offer-plan') || '';
      if (quantityInput) quantityInput.value = offerEl.getAttribute('data-cwc-offer-quantity') || '1';

      announce();
    }

    offers.forEach(function (offerEl) {
      offerEl.addEventListener('click', function () {
        selectOffer(offerEl);
      });
    });

    if (onetime) {
      onetime.addEventListener('click', function () {
        offers.forEach(function (item) {
          item.classList.remove(SELECTED_OFFER);
          var input = item.querySelector('.cwc_product-hero-buy-box__offer-input');
          if (input) input.checked = false;
        });
        if (planInput) planInput.value = '';
        if (quantityInput) quantityInput.value = '1';
        announce();
      });
    }

    function applyVariant(variantId) {
      var variant = findVariant(variants, variantId);
      if (!variant) return;

      if (variantInput) variantInput.value = variant.id;

      // Prefer moving the carousel to the variant's own media, so the slide and
      // the thumbnail strip stay in agreement. Only fall back to swapping a
      // source when there is no carousel to move.
      var mediaIndex = -1;
      if (variant.media_id) {
        for (var s = 0; s < slides.length; s++) {
          if (slides[s].getAttribute('data-cwc-media-id') === String(variant.media_id)) {
            mediaIndex = s;
            break;
          }
        }
      }

      if (mediaIndex > -1) {
        goToSlide(mediaIndex);
      } else if (mainImage && variant.image) {
        mainImage.src = variant.image;
      }

      offers.forEach(function (offerEl) {
        var planId = offerEl.getAttribute('data-cwc-offer-plan');
        var pricing = planId && variant.plans ? variant.plans[planId] : null;
        if (!pricing) return;

        var nowEl = offerEl.querySelector('[data-cwc-offer-now]');
        var wasEl = offerEl.querySelector('[data-cwc-offer-was]');
        var savingEl = offerEl.querySelector('[data-cwc-offer-saving]');

        if (nowEl && pricing.price) nowEl.textContent = pricing.price;
        if (wasEl) {
          wasEl.textContent = pricing.compare || '';
          wasEl.style.display = pricing.compare ? '' : 'none';
        }
        if (savingEl) {
          savingEl.textContent = pricing.save ? '· save ' + pricing.save : '';
          savingEl.style.display = pricing.save ? '' : 'none';
        }
      });

      announce();
    }

    flavors.forEach(function (flavorEl) {
      flavorEl.addEventListener('click', function () {
        if (flavorEl.disabled) return;
        flavors.forEach(function (item) {
          item.classList.remove(SELECTED_FLAVOR);
        });
        flavorEl.classList.add(SELECTED_FLAVOR);
        applyVariant(flavorEl.getAttribute('data-cwc-variant'));
      });
    });

    var thumbList = Array.prototype.slice.call(thumbs);
    var scroller = sectionEl.querySelector('[data-cwc-thumbs-scroller]');
    var track = sectionEl.querySelector('[data-cwc-gallery-track]');
    var slides = track ? Array.prototype.slice.call(track.querySelectorAll('[data-cwc-slide]')) : [];

    // Scrolls the strip the minimum needed to bring a whole span of thumbs into
    // view. Taking a span rather than a single thumb is what lets the strip
    // advance before you actually reach the edge.
    function revealSpan(fromIndex, toIndex) {
      if (!scroller) return;

      var first = thumbList[Math.min(fromIndex, toIndex)];
      var last = thumbList[Math.max(fromIndex, toIndex)];
      if (!first || !last) return;

      var left = first.offsetLeft;
      var right = last.offsetLeft + last.offsetWidth;
      var viewLeft = scroller.scrollLeft;
      var viewRight = viewLeft + scroller.clientWidth;

      if (left < viewLeft) {
        scroller.scrollTo({ left: left, behavior: 'smooth' });
      } else if (right > viewRight) {
        scroller.scrollTo({ left: right - scroller.clientWidth, behavior: 'smooth' });
      }
    }

    var lastThumbIndex = 0;

    // Marks a thumb active without touching the carousel — used when the
    // carousel itself is what moved, so the two never fight each other.
    //
    // The strip keeps one thumb of look-ahead visible in whichever direction
    // you are moving. Landing on the last visible thumb therefore pulls the
    // next one into view on its own, rather than parking at the edge with no
    // hint that there is more and forcing you onto the arrow.
    function markThumb(index) {
      thumbList.forEach(function (item, i) {
        item.classList.toggle(ACTIVE_THUMB, i === index);
      });

      if (!thumbList[index]) return;

      var direction = 0;
      if (index > lastThumbIndex) direction = 1;
      else if (index < lastThumbIndex) direction = -1;

      var lookahead = Math.max(0, Math.min(index + direction, thumbList.length - 1));
      revealSpan(index, lookahead);

      lastThumbIndex = index;
    }

    // Slides are separated by a gap, so their positions are not index * width.
    // Measuring offsetLeft keeps this correct whatever the gap is set to.
    function goToSlide(index) {
      if (!track || !slides.length) return;
      var clamped = Math.max(0, Math.min(index, slides.length - 1));
      track.scrollTo({ left: slides[clamped].offsetLeft, behavior: 'smooth' });
      markThumb(clamped);
    }

    function currentSlideIndex() {
      if (!track || !slides.length) return 0;

      var position = track.scrollLeft;
      var nearest = 0;
      var shortest = Infinity;

      for (var i = 0; i < slides.length; i++) {
        var distance = Math.abs(slides[i].offsetLeft - position);
        if (distance < shortest) {
          shortest = distance;
          nearest = i;
        }
      }
      return nearest;
    }

    thumbList.forEach(function (thumb, index) {
      thumb.addEventListener('click', function () {
        if (track && slides.length) {
          goToSlide(index);
          return;
        }
        // No carousel (single image fallback) — swap the source as before.
        if (mainImage) {
          markThumb(index);
          mainImage.src = thumb.getAttribute('data-cwc-thumb');
        }
      });
    });

    if (track) {
      // Snap position is the source of truth for which thumb is active, so a
      // finger drag and a thumb click converge on the same state.
      var scrollSettle;
      track.addEventListener(
        'scroll',
        function () {
          clearTimeout(scrollSettle);
          scrollSettle = setTimeout(function () {
            markThumb(currentSlideIndex());
          }, 80);
        },
        { passive: true }
      );
    }

    // The plan chip is a shortcut back to the supply cards, which are in view
    // in this same section.
    var planChip = sectionEl.querySelector('[data-cwc-plan-chip]');
    if (planChip) {
      planChip.addEventListener('click', function () {
        sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    initThumbScroller(sectionEl);
    initStickyBar(sectionEl);

    sectionEl.querySelectorAll('[data-cwc-detail-toggle]').forEach(function (toggle) {
      toggle.addEventListener('click', function () {
        var detail = toggle.closest('.cwc_product-hero-buy-box__detail');
        if (!detail) return;
        var panel = detail.querySelector('[data-cwc-detail-panel]');
        if (!panel) return;

        var isOpen = !panel.classList.contains(HIDDEN_PANEL);
        panel.classList.toggle(HIDDEN_PANEL, isOpen);
        toggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');

        var sign = toggle.querySelector('.cwc_product-hero-buy-box__detail-sign');
        if (sign) sign.textContent = isOpen ? '+' : '−';
      });
    });

    var modal = sectionEl.querySelector('[data-cwc-nutrition-modal]');
    var modalOpen = sectionEl.querySelector('[data-cwc-nutrition-open]');
    var modalClose = sectionEl.querySelector('[data-cwc-nutrition-close]');

    if (modal && modalOpen) {
      modalOpen.addEventListener('click', function () {
        modal.hidden = false;
      });

      modal.addEventListener('click', function (event) {
        if (event.target === modal) modal.hidden = true;
      });

      if (modalClose) {
        modalClose.addEventListener('click', function () {
          modal.hidden = true;
        });
      }

      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') modal.hidden = true;
      });
    }

    var initiallySelected = sectionEl.querySelector('.' + SELECTED_OFFER);
    if (!initiallySelected && offers.length) {
      selectOffer(offers[0]);
    } else if (initiallySelected) {
      selectOffer(initiallySelected);
    }
  }

  function initAllSections() {
    document.querySelectorAll('.cwc_product-hero-buy-box').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSections);
  } else {
    initAllSections();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector('.cwc_product-hero-buy-box');
    if (section) initSection(section);
  });
})();
