(function () {
  'use strict';

  var SELECTED_OFFER = 'cwc_product-hero-buy-box__offer--selected';
  var SELECTED_ONETIME = 'cwc_product-hero-buy-box__onetime-button--selected';
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

    /**
     * Flavour and supply can each be a real product option, which makes the
     * variant a function of both rather than of whichever was clicked last.
     * These hold the 1-based option position each control drives, or 0 when
     * that control is not bound to an option — in which case the old behaviour
     * stands and its swatches address a variant directly.
     */
    var flavorsEl = sectionEl.querySelector('[data-cwc-flavor-position]');
    var offersEl = sectionEl.querySelector('[data-cwc-supply-position]');
    var flavorPosition = flavorsEl ? parseInt(flavorsEl.getAttribute('data-cwc-flavor-position'), 10) : 0;
    var supplyPosition = offersEl ? parseInt(offersEl.getAttribute('data-cwc-supply-position'), 10) : 0;

    // position -> chosen value, for the options this section actually drives
    var chosen = {};

    /**
     * First variant whose option values match every entry in `values`.
     *
     * Availability is a preference, not a filter: a shopper who picks a
     * sold-out combination should land on it and see it is sold out, rather
     * than have the section silently swap them onto something else. So the
     * available pass runs first and the second pass accepts anything.
     */
    function variantMatching(values) {
      var pass, i, key, variant, matched;

      for (pass = 0; pass < 2; pass++) {
        for (i = 0; i < variants.length; i++) {
          variant = variants[i];
          if (pass === 0 && !variant.available) continue;
          if (!variant.options) continue;

          matched = true;
          for (key in values) {
            if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
            if (String(variant.options[key - 1]) !== String(values[key])) {
              matched = false;
              break;
            }
          }
          if (matched) return variant;
        }
      }

      return null;
    }

    /**
     * The chosen combination, plus one override — used to ask "which variant
     * would this supply option be, keeping the flavour the shopper is on?"
     * without disturbing the actual selection.
     */
    function combinationWith(position, value) {
      var probe = {};
      var key;

      for (key in chosen) {
        if (Object.prototype.hasOwnProperty.call(chosen, key)) probe[key] = chosen[key];
      }
      if (position && value) probe[position] = value;

      return probe;
    }

    // The sticky bar shares this section's form, so only its display text has
    // to follow the selection — the inputs it submits are already the same ones.
    var stickyPlanLabel = sectionEl.querySelector('[data-cwc-plan-label]');
    var stickyPlanSub = sectionEl.querySelector('[data-cwc-plan-sub]');
    var stickyPrice = sectionEl.querySelector('[data-cwc-button-price]');

    // What the chip says before anything is picked, so the one-time option can
    // fall back to it instead of leaving a stale supply sub-line behind.
    var stickySubDefault = stickyPlanSub ? stickyPlanSub.textContent.trim() : '';

    function syncSticky(label, price, sub) {
      if (stickyPlanLabel && label) stickyPlanLabel.textContent = label;
      if (stickyPrice && price) stickyPrice.textContent = price;
      // sub is allowed to be empty — an option with no sub must clear the old
      // one rather than keep showing the previous option's per-serving price
      if (stickyPlanSub) stickyPlanSub.textContent = sub || stickySubDefault;
    }

    function announce() {
      var selected = sectionEl.querySelector('.' + SELECTED_OFFER);
      var priceEl = selected ? selected.querySelector('[data-cwc-offer-now]') : null;

      syncSticky(
        selected ? selected.getAttribute('data-cwc-offer-name') : '',
        priceEl ? priceEl.textContent.trim() : '',
        selected ? selected.getAttribute('data-cwc-offer-sub') : ''
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
            label: selected ? selected.getAttribute('data-cwc-offer-name') || '' : ''
          }
        })
      );
    }

    /**
     * Cart expects selling_plan to be a bare integer, and rejects an empty
     * string outright with "expected String to be a Integer: selling_plan".
     *
     * Two things go wrong in practice. Merchants paste the id from the admin,
     * where it reads "#1861583106" and often carries a trailing non-breaking
     * space. And a one-time purchase has no plan at all. So: strip to digits,
     * and disable the field when nothing is left, since a disabled input is not
     * submitted rather than submitted empty.
     */
    function setPlan(rawValue) {
      if (!planInput) return;

      var digits = String(rawValue || '').replace(/[^0-9]/g, '');
      planInput.value = digits;
      planInput.disabled = digits === '';
    }

    /**
     * A closed option's detail panel is clipped to nothing but is still in the
     * DOM, so a screen reader would otherwise read out the perks and gifts of
     * every option at once as if they all applied.
     *
     * inert takes the closed ones out of the accessibility tree without
     * changing how they render, which is what leaves the height animation
     * intact — hidden would collapse them instantly and there would be nothing
     * left to animate.
     */
    function syncOfferDetails() {
      offers.forEach(function (item) {
        var details = item.querySelector('[data-cwc-offer-details]');
        if (!details) return;

        if (item.classList.contains(SELECTED_OFFER)) {
          details.removeAttribute('inert');
        } else {
          details.setAttribute('inert', '');
        }
      });
    }

    function clearOffers() {
      offers.forEach(function (item) {
        item.classList.remove(SELECTED_OFFER);
        var input = item.querySelector('.cwc_product-hero-buy-box__offer-input');
        if (input) input.checked = false;
      });
      syncOfferDetails();
    }

    function selectOffer(offerEl) {
      clearOffers();
      if (onetime) onetime.classList.remove(SELECTED_ONETIME);

      offerEl.classList.add(SELECTED_OFFER);
      var radio = offerEl.querySelector('.cwc_product-hero-buy-box__offer-input');
      if (radio) radio.checked = true;

      setPlan(offerEl.getAttribute('data-cwc-offer-plan'));

      // Supply is a product option too, so the card is a variant choice as much
      // as a plan choice. Record it and re-resolve, which keeps the flavour.
      var offerValue = offerEl.getAttribute('data-cwc-offer-value');

      /**
       * One unit unless a card explicitly asks for more.
       *
       * The supply size is normally carried by the variant — a 90-day variant
       * IS the ninety days — so anything above one adds that supply over and
       * over. Quantity Added stays as an escape hatch for a card that really is
       * several of the same variant, but it has to be typed in on purpose: a
       * missing, blank or nonsense value reads as one rather than carrying over
       * whatever the last card asked for.
       */
      if (quantityInput) {
        var wanted = parseInt(offerEl.getAttribute('data-cwc-offer-quantity'), 10);
        quantityInput.value = wanted > 1 ? String(wanted) : '1';
      }

      if (supplyPosition && offerValue) {
        chosen[supplyPosition] = offerValue;
        syncVariant();
      }

      syncOfferDetails();
      announce();
    }

    offers.forEach(function (offerEl) {
      offerEl.addEventListener('click', function () {
        selectOffer(offerEl);
      });
    });

    /**
     * The real product form, or null in the no-product preview where the same
     * class sits on a plain div.
     */
    function productForm() {
      var el = sectionEl.querySelector('.cwc_product-hero-buy-box__form');
      return el && el.tagName === 'FORM' ? el : null;
    }

    /**
     * Add-on items.
     *
     * A supply option can carry a second product that goes in the same basket
     * press. Shopify's add endpoint takes either one item as flat id/quantity
     * fields or a list as items[n][...], never a mix — so when an add-on is in
     * play the flat inputs are switched off for that request and the whole order
     * is restated as a list. Options without an add-on keep the flat fields and
     * the request the theme has always sent.
     *
     * This runs on the section in the capture phase, which is what guarantees it
     * finishes before the theme's own submit handler reads the form. Hanging it
     * off the form itself would put it in a registration-order race with that
     * handler, and the theme's is registered first.
     */
    function syncBundleInputs() {
      var form = productForm();
      if (!form) return;

      var host = form.querySelector('[data-cwc-bundle-inputs]');
      if (!host) {
        host = document.createElement('div');
        host.setAttribute('data-cwc-bundle-inputs', '');
        host.hidden = true;
        form.insertBefore(host, form.firstChild);
      }
      host.textContent = '';

      var selected = sectionEl.querySelector('.' + SELECTED_OFFER);
      var addonId = selected ? selected.getAttribute('data-cwc-offer-addon') : '';

      if (!addonId) {
        if (variantInput) variantInput.disabled = false;
        if (quantityInput) quantityInput.disabled = false;
        // Restore this too. A previous bundled add switched it off, and an
        // option without an add-on would otherwise submit with no plan at all —
        // which reads as a one-time purchase. Driven off the value rather than
        // switched on unconditionally, because cart rejects a blank
        // selling_plan outright.
        if (planInput) planInput.disabled = planInput.value === '';
        return;
      }

      function field(name, value) {
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        host.appendChild(input);
      }

      field('items[0][id]', variantInput ? variantInput.value : '');
      field('items[0][quantity]', quantityInput ? quantityInput.value : '1');
      // Read the value, not the disabled flag: a previous bundled add leaves the
      // flat field switched off, and testing that would silently drop the plan
      // on every add after the first.
      if (planInput && planInput.value) {
        field('items[0][selling_plan]', planInput.value);
      }

      // The add-on is deliberately plan-free: it is a one-off that accompanies
      // the subscription, not a second thing being subscribed to.
      field('items[1][id]', addonId);
      field('items[1][quantity]', selected.getAttribute('data-cwc-offer-addon-quantity') || '1');

      if (variantInput) variantInput.disabled = true;
      if (quantityInput) quantityInput.disabled = true;
      if (planInput) planInput.disabled = true;
    }

    sectionEl.addEventListener('submit', syncBundleInputs, true);

    /**
     * The theme adds to cart over fetch and reports a rejected add by firing
     * cart:error on the form — its own buy-buttons element is what normally
     * displays that, and this section does not use it. Without this the shopper
     * would press the button and see nothing happen at all.
     */
    function initCartErrors() {
      var form = productForm();
      if (!form) return;

      form.addEventListener('cart:error', function (event) {
        var message = (event.detail && event.detail.error) || 'This item could not be added to your cart.';
        var box = sectionEl.querySelector('[data-cwc-cart-error]');

        if (!box) {
          box = document.createElement('div');
          box.className = 'cwc_product-hero-buy-box__cart-error';
          box.setAttribute('data-cwc-cart-error', '');
          box.setAttribute('role', 'alert');

          var cta = sectionEl.querySelector('.cwc_product-hero-buy-box__cta');
          if (cta && cta.parentNode) {
            cta.parentNode.insertBefore(box, cta.nextSibling);
          } else {
            form.appendChild(box);
          }
        }

        box.textContent = message;
      });

      // A successful add clears whatever the last failure said.
      form.addEventListener('variant:add', function () {
        var box = sectionEl.querySelector('[data-cwc-cart-error]');
        if (box) box.textContent = '';
      });
    }

    /**
     * The one-time link is a buy action, not just a toggle: picking it drops the
     * selling plan and adds the bare product straight to the cart, one unit.
     *
     * It submits through the real Add To Cart button rather than the form, so a
     * theme cart drawer listening for that click still opens. The form is only
     * submitted directly when the Add To Cart block is absent, which is allowed.
     */
    function addOneTimeToCart() {
      var form = productForm();
      if (!form) return;

      var cta = sectionEl.querySelector('.cwc_product-hero-buy-box__cta');
      if (cta && cta.disabled) return;

      if (cta) {
        cta.click();
      } else if (form.requestSubmit) {
        form.requestSubmit();
      } else {
        form.submit();
      }
    }

    if (onetime) {
      onetime.addEventListener('click', function () {
        clearOffers();
        onetime.classList.add(SELECTED_ONETIME);
        setPlan('');
        if (quantityInput) quantityInput.value = '1';
        announce();
        addOneTimeToCart();
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

      refreshOfferPrices(variant);
      announce();
    }

    /**
     * Each card prices its OWN variant, not the selected one.
     *
     * When supply is a product option, the 30-day and 90-day cards are
     * different variants at different prices — pricing them all off whichever
     * is currently selected would show the shopper the same number on every
     * card and make the comparison meaningless. So each card resolves the
     * variant it stands for, keeping the flavour the shopper is on.
     *
     * With no supply option bound, every card resolves to `fallback` and this
     * behaves exactly as it did before.
     */
    function refreshOfferPrices(fallback) {
      offers.forEach(function (offerEl) {
        var planId = offerEl.getAttribute('data-cwc-offer-plan');
        var offerValue = offerEl.getAttribute('data-cwc-offer-value');
        var variant = fallback;

        if (supplyPosition && offerValue) {
          variant = variantMatching(combinationWith(supplyPosition, offerValue)) || fallback;
        }

        var pricing = variant && planId && variant.plans ? variant.plans[planId] : null;
        if (!pricing) return;

        var nowEl = offerEl.querySelector('[data-cwc-offer-now]');
        var wasEl = offerEl.querySelector('[data-cwc-offer-was]');
        var savingEl = offerEl.querySelector('[data-cwc-offer-saving]');
        // the undivided charge in the billing strip — the one figure on the card
        // that is not per month
        var billedEl = offerEl.querySelector('[data-cwc-offer-billed]');

        if (nowEl && pricing.price) nowEl.textContent = pricing.price;
        if (billedEl && pricing.total) billedEl.textContent = pricing.total;
        if (wasEl) {
          wasEl.textContent = pricing.compare || '';
          wasEl.style.display = pricing.compare ? '' : 'none';
        }
        if (savingEl) {
          savingEl.textContent = pricing.save ? '· save ' + pricing.save : '';
          savingEl.style.display = pricing.save ? '' : 'none';
        }
      });
    }

    /**
     * Resolve the variant from every option the shopper has chosen so far and
     * apply it. This is what keeps flavour and supply from overwriting each
     * other: whichever one was just clicked, both are read back.
     */
    function syncVariant() {
      var variant = variantMatching(chosen);
      if (variant) applyVariant(variant.id);
    }

    flavors.forEach(function (flavorEl) {
      flavorEl.addEventListener('click', function () {
        if (flavorEl.disabled) return;
        flavors.forEach(function (item) {
          item.classList.remove(SELECTED_FLAVOR);
        });
        flavorEl.classList.add(SELECTED_FLAVOR);

        // Bound to a product option: record the value and resolve against every
        // choice, so the supply size the shopper picked survives the change.
        // Unbound: the swatch is a variant in its own right, as before.
        var flavorValue = flavorEl.getAttribute('data-cwc-flavor-value');
        if (flavorPosition && flavorValue) {
          chosen[flavorPosition] = flavorValue;
          syncVariant();
        } else {
          applyVariant(flavorEl.getAttribute('data-cwc-variant'));
        }
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

    // Drag the carousel with a mouse. Touch already scrolls natively, so this
    // is limited to mouse pointers — taking over touch would throw away the
    // browser's momentum and snapping.
    if (track && slides.length > 1 && window.PointerEvent) {
      track.classList.add('cwc_product-hero-buy-box__slides--draggable');

      var dragging = false;
      var dragStartX = 0;
      var dragStartScroll = 0;
      var dragDistance = 0;
      var snapRestore;

      track.addEventListener('pointerdown', function (event) {
        if (event.pointerType !== 'mouse' || event.button !== 0) return;

        dragging = true;
        dragDistance = 0;
        dragStartX = event.clientX;
        dragStartScroll = track.scrollLeft;

        // Writing scrollLeft directly cannot be animated or snapped mid-drag,
        // or the track fights the cursor instead of following it.
        clearTimeout(snapRestore);
        track.style.scrollBehavior = 'auto';
        track.style.scrollSnapType = 'none';
        track.classList.add('cwc_product-hero-buy-box__slides--dragging');
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
        track.classList.remove('cwc_product-hero-buy-box__slides--dragging');

        if (track.hasPointerCapture && track.hasPointerCapture(event.pointerId)) {
          track.releasePointerCapture(event.pointerId);
        }

        // Settle smoothly to the nearest slide first, then hand snapping back.
        // Re-enabling it immediately would make the browser jump to the snap
        // point before the animation had a chance to run.
        track.style.scrollBehavior = '';
        goToSlide(currentSlideIndex());

        snapRestore = setTimeout(function () {
          track.style.scrollSnapType = '';
        }, 400);
      }

      track.addEventListener('pointerup', endDrag);
      track.addEventListener('pointercancel', endDrag);

      // A drag that ends on an image would otherwise fire a click too.
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

    /* ===== Sticky plan picker =====

       The chip changes the selection outright instead of scrolling back to the
       supply cards. Options are read from those cards at open time and each one
       routes through the same selectOffer() / one-time handler the cards use, so
       there is a single selection path and nothing to keep in sync.

       Falls back to scrolling to the cards only when there is nothing to pick
       from, which is the one case where the old behaviour was the useful one. */
    var planChip = sectionEl.querySelector('[data-cwc-plan-chip]');
    var planMenu = sectionEl.querySelector('[data-cwc-plan-menu]');

    function collectPlanOptions() {
      var options = [];

      offers.forEach(function (offerEl) {
        var nameEl = offerEl.querySelector('.cwc_product-hero-buy-box__offer-name');
        var priceEl = offerEl.querySelector('[data-cwc-offer-now]');
        var descEl = offerEl.querySelector('.cwc_product-hero-buy-box__offer-description');
        var saveEl = offerEl.querySelector('.cwc_product-hero-buy-box__offer-save');

        options.push({
          // the attribute is the clean name; the element's text would also pick
          // up the save badge nested inside it ("90-Day SupplySave 25%")
          label:
            offerEl.getAttribute('data-cwc-offer-name') ||
            directText(nameEl) ||
            (nameEl ? nameEl.textContent.trim() : 'Supply option'),
          note: descEl ? descEl.textContent.trim() : '',
          price: priceEl ? priceEl.textContent.trim() : '',
          save: saveEl ? saveEl.textContent.trim() : '',
          isSelected: offerEl.classList.contains(SELECTED_OFFER),
          choose: function () {
            selectOffer(offerEl);
          }
        });
      });

      // Subscription plans only. The one-time purchase stays available on the
      // card below; the sticky bar is a fast path to the plan the shopper is
      // most likely to want, not a full repeat of the buy box.
      return options;
    }

    /* Text belonging to the element itself, ignoring nested spans such as the
       save badge. */
    function directText(el) {
      if (!el) return '';
      var out = '';
      for (var i = 0; i < el.childNodes.length; i++) {
        if (el.childNodes[i].nodeType === 3) out += el.childNodes[i].textContent;
      }
      return out.trim();
    }

    function buildPlanMenu() {
      if (!planMenu) return 0;

      var options = collectPlanOptions();
      planMenu.textContent = '';

      options.forEach(function (option) {
        var row = document.createElement('button');
        row.type = 'button';
        row.className = 'cwc_sticky-add-to-cart__plan-option';
        if (option.isSelected) {
          row.className += ' cwc_sticky-add-to-cart__plan-option--selected';
        }
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', option.isSelected ? 'true' : 'false');

        var main = document.createElement('span');
        main.className = 'cwc_sticky-add-to-cart__plan-option-main';

        var name = document.createElement('span');
        name.className = 'cwc_sticky-add-to-cart__plan-option-name';
        name.textContent = option.label;
        main.appendChild(name);

        if (option.note) {
          var note = document.createElement('span');
          note.className = 'cwc_sticky-add-to-cart__plan-option-note';
          note.textContent = option.note;
          main.appendChild(note);
        }

        row.appendChild(main);

        if (option.price || option.save) {
          var meta = document.createElement('span');
          meta.className = 'cwc_sticky-add-to-cart__plan-option-meta';

          if (option.price) {
            var price = document.createElement('span');
            price.className = 'cwc_sticky-add-to-cart__plan-option-price';
            price.textContent = option.price;
            meta.appendChild(price);
          }

          if (option.save) {
            var save = document.createElement('span');
            save.className = 'cwc_sticky-add-to-cart__plan-option-save';
            save.textContent = option.save;
            meta.appendChild(save);
          }

          row.appendChild(meta);
        }

        row.addEventListener('click', function () {
          option.choose();
          closePlanMenu();
          planChip.focus();
        });

        planMenu.appendChild(row);
      });

      return options.length;
    }

    function planMenuIsOpen() {
      return planMenu && !planMenu.hidden;
    }

    function openPlanMenu() {
      if (!planMenu) return;
      if (!buildPlanMenu()) return;

      planMenu.hidden = false;
      planChip.setAttribute('aria-expanded', 'true');
      planChip.classList.add('cwc_sticky-add-to-cart__plan--open');

      var current = planMenu.querySelector('.cwc_sticky-add-to-cart__plan-option--selected');
      (current || planMenu.firstElementChild).focus();
    }

    function closePlanMenu() {
      if (!planMenu || planMenu.hidden) return;
      planMenu.hidden = true;
      planChip.setAttribute('aria-expanded', 'false');
      planChip.classList.remove('cwc_sticky-add-to-cart__plan--open');
    }

    if (planChip) {
      planChip.addEventListener('click', function (event) {
        event.stopPropagation();

        if (planMenuIsOpen()) {
          closePlanMenu();
          return;
        }

        // no plans to choose from — fall back to showing the cards
        if (!offers.length) {
          sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }

        openPlanMenu();
      });

      if (planMenu) {
        // clicks inside the panel must not reach the outside-click handler
        planMenu.addEventListener('click', function (event) {
          event.stopPropagation();
        });

        planMenu.addEventListener('keydown', function (event) {
          var rows = Array.prototype.slice.call(planMenu.children);
          var index = rows.indexOf(document.activeElement);

          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            var next = index + (event.key === 'ArrowDown' ? 1 : -1);
            if (next < 0) next = rows.length - 1;
            if (next >= rows.length) next = 0;
            if (rows[next]) rows[next].focus();
          }
        });

        document.addEventListener('click', function () {
          closePlanMenu();
        });

        document.addEventListener('keydown', function (event) {
          if (event.key === 'Escape' && planMenuIsOpen()) {
            closePlanMenu();
            planChip.focus();
          }
        });
      }
    }

    initThumbScroller(sectionEl);
    initStickyBar(sectionEl);
    initCartErrors();

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

    initMediaPopups(sectionEl);

    /**
     * Seed the option state from what the server already marked as selected.
     *
     * Without this the first resolve would see only the supply half of the
     * combination — selectOffer runs below and records its own value — and
     * would pick an arbitrary flavour for the shopper.
     */
    var initialFlavor = sectionEl.querySelector('.' + SELECTED_FLAVOR + '[data-cwc-flavor-value]');
    if (!initialFlavor) {
      initialFlavor = sectionEl.querySelector('[data-cwc-flavor-value]');
    }
    if (flavorPosition && initialFlavor) {
      chosen[flavorPosition] = initialFlavor.getAttribute('data-cwc-flavor-value');
    }

    var initiallySelected = sectionEl.querySelector('.' + SELECTED_OFFER);
    if (!initiallySelected && offers.length) {
      selectOffer(offers[0]);
    } else if (initiallySelected) {
      selectOffer(initiallySelected);
    }
  }

  /**
   * media_popup blocks: any number of trigger/overlay pairs, matched on the
   * block id. Kept separate from the section-level nutrition modal above so
   * that one keeps working exactly as before.
   */
  function initMediaPopups(sectionEl) {
    var triggers = sectionEl.querySelectorAll('[data-cwc-popup-open]');
    if (!triggers.length) return;

    /**
     * The flavour the shopper is on, as the swatch spells it.
     *
     * Read at open time rather than once at init, because the swatch can change
     * under an overlay that was already built.
     */
    function selectedFlavorName() {
      var swatch = sectionEl.querySelector('.' + SELECTED_FLAVOR);
      if (!swatch) return '';

      var value = swatch.getAttribute('data-cwc-flavor-value');
      if (!value) {
        var nameEl = swatch.querySelector('.cwc_product-hero-buy-box__flavor-name');
        value = nameEl ? nameEl.textContent : '';
      }

      return String(value || '').trim().toLowerCase();
    }

    triggers.forEach(function (trigger) {
      var id = trigger.getAttribute('data-cwc-popup-open');
      var modal = sectionEl.querySelector('[data-cwc-popup-modal="' + id + '"]');
      if (!modal) return;

      var closeButton = modal.querySelector('[data-cwc-popup-close]');
      var tabs = Array.prototype.slice.call(modal.querySelectorAll('[data-cwc-popup-tab]'));
      var panels = Array.prototype.slice.call(modal.querySelectorAll('[data-cwc-popup-panel]'));

      /**
       * One label per flavour: the buttons and the images are matched on the
       * flavour name rather than on position, so a slot left empty in the
       * middle of the four cannot pair a button with the wrong image.
       */
      function showPanel(name) {
        var wanted = String(name || '').trim().toLowerCase();
        var matched = false;

        panels.forEach(function (panel) {
          var panelName = String(panel.getAttribute('data-cwc-popup-panel') || '')
            .trim()
            .toLowerCase();
          var isWanted = panelName === wanted;
          panel.hidden = !isWanted;
          if (isWanted) matched = true;
        });

        // Nothing matched — a flavour with no label of its own. Leave whichever
        // panel was showing rather than blanking the overlay.
        if (!matched) {
          panels.forEach(function (panel, index) {
            panel.hidden = index !== 0;
          });
        }

        tabs.forEach(function (tab) {
          var tabName = String(tab.getAttribute('data-cwc-popup-tab') || '')
            .trim()
            .toLowerCase();
          var isSelected = matched ? tabName === wanted : tabs.indexOf(tab) === 0;
          tab.classList.toggle('cwc_product-hero-buy-box__modal-tab--selected', isSelected);
          tab.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
      }

      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          showPanel(tab.getAttribute('data-cwc-popup-tab'));
        });
      });

      function open() {
        // Open on the flavour already chosen, so the shopper is not asked to
        // pick it a second time. Falls through to the first panel when the
        // names do not line up.
        if (panels.length > 1) showPanel(selectedFlavorName());

        modal.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
        if (closeButton) closeButton.focus();
      }

      function close() {
        if (modal.hidden) return;
        modal.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
        trigger.focus();
      }

      trigger.addEventListener('click', open);

      // backdrop only — clicks inside the panel must not close it
      modal.addEventListener('click', function (event) {
        if (event.target === modal) close();
      });

      if (closeButton) closeButton.addEventListener('click', close);

      // document-level so Escape still closes it if focus moved off the panel
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !modal.hidden) close();
      });
    });
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
