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

  /**
   * Delivery estimate: today plus the block's max shipping days.
   *
   * Liquid already printed a date in the store's timezone, which is what a
   * no-JS shopper sees. This recomputes it in the shopper's own clock so a page
   * served from cache cannot go on promising a date that has already passed.
   */
  function initDeliveryEstimate(sectionEl) {
    sectionEl.querySelectorAll('[data-cwc-delivery-date]').forEach(function (dateEl) {
      var days = parseInt(dateEl.getAttribute('data-cwc-delivery-days'), 10);
      if (!days || days < 1) return;

      var delivery = new Date();
      delivery.setDate(delivery.getDate() + days);

      dateEl.textContent = delivery.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    });
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
     * Options and supply can each be a real product option, which makes the
     * variant a function of all of them rather than of whichever was clicked
     * last.
     *
     * There can be any number of option rows now — the auto options block emits
     * one per option the product has — so a row's position is read off the row
     * itself rather than off a single element found once. supplyPosition stays
     * a section-level lookup because the supply block is limited to one.
     */
    var optionSelects = sectionEl.querySelectorAll('[data-cwc-option-select]');
    var offersEl = sectionEl.querySelector('[data-cwc-supply-position]');
    var supplyPosition = offersEl ? parseInt(offersEl.getAttribute('data-cwc-supply-position'), 10) : 0;

    /**
     * The option row a control belongs to, and the position that row drives.
     *
     * Rows are identified by the position attribute itself rather than by a
     * wrapper class, which is what lets the flavors block and the auto options
     * block share every handler below: one puts the attribute on its swatch row,
     * the other on a row per option, and both answer the same question.
     */
    function rowOf(el) {
      return el && el.closest ? el.closest('[data-cwc-flavor-position]') : null;
    }

    function positionOf(row) {
      if (!row) return 0;
      return parseInt(row.getAttribute('data-cwc-flavor-position'), 10) || 0;
    }

    function optionRows() {
      return sectionEl.querySelectorAll('[data-cwc-flavor-position]');
    }

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
     * The supply option's own spelling of a typed value.
     *
     * Merchants type the size into the section ("30-day supply"), and the
     * variant match downstream is case-sensitive because that is how Shopify
     * holds option values. So the typed string is only ever used to find the
     * real value, and the real value is what gets recorded — the same rule the
     * supply cards follow when they resolve their Name against the option.
     *
     * Returns '' when nothing matches, which callers read as "no supply of my
     * own" and leave the current selection alone.
     */
    function resolveSupplyValue(raw) {
      var wanted = String(raw || '').trim().toLowerCase();
      var i, value;

      if (!wanted || !supplyPosition) return '';

      for (i = 0; i < variants.length; i++) {
        if (!variants[i].options) continue;
        value = variants[i].options[supplyPosition - 1];
        if (value && String(value).trim().toLowerCase() === wanted) return value;
      }

      return '';
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
      var price = priceEl ? priceEl.textContent.trim() : '';

      /**
       * No plan card is selected — an options-only product with no subscription
       * at all, or the one-time card. The bar then quotes the variant itself,
       * which is what the button will actually charge. Without this it keeps
       * whatever it was rendered with and does not follow a size change.
       */
      if (!price && variantInput) {
        var shown = findVariant(variants, variantInput.value);
        if (shown && shown.price) price = shown.price;
      }

      /**
       * With no plan card live the chip would keep the last plan's name, which
       * outright contradicts a one-time selection sitting right above it.
       */
      var label = selected ? selected.getAttribute('data-cwc-offer-name') : '';
      if (!label && onetime && onetime.classList.contains(SELECTED_ONETIME)) {
        label = onetime.getAttribute('data-cwc-onetime-label') || '';
      }

      syncSticky(label, price, selected ? selected.getAttribute('data-cwc-offer-sub') : '');

      sectionEl.dispatchEvent(
        new CustomEvent('cwc:buybox:change', {
          bubbles: true,
          detail: {
            sectionId: sectionEl.id,
            variantId: variantInput ? variantInput.value : '',
            sellingPlan: planInput ? planInput.value : '',
            quantity: quantityInput ? quantityInput.value : '1',
            price: price,
            label: label
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
      /**
       * Every detail strip in the section, not only the ones on plan cards: the
       * one-time card can carry its own now, and it is not in `offers`. The
       * card each strip belongs to is read off the strip rather than the other
       * way round, so any card wearing __offer is covered without listing them.
       */
      sectionEl.querySelectorAll('[data-cwc-offer-details]').forEach(function (details) {
        /**
         * A strip set to stand permanently is never closed, so marking it inert
         * would hide from a screen reader the one thing still plainly on screen.
         */
        if (details.getAttribute('data-cwc-offer-details') === 'static') {
          details.removeAttribute('inert');
          return;
        }

        var card = details.closest('.cwc_product-hero-buy-box__offer');
        if (!card) return;

        if (card.classList.contains(SELECTED_OFFER)) {
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
      if (onetime) {
        onetime.classList.remove(SELECTED_ONETIME);
        // The card style wears the offer card's own selected class, so picking a
        // plan has to take that off as well or two cards read as selected.
        onetime.classList.remove(SELECTED_OFFER);
      }

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
        // Card style sits among the plan cards, so it has to hold the same
        // selected state they do rather than only the link's own.
        if (onetime.hasAttribute('data-cwc-onetime-card')) {
          onetime.classList.add(SELECTED_OFFER);
        }

        // clearOffers() ran before the class went on, so the strip this card
        // just opened is still marked inert. Re-read them now the selection is
        // settled.
        syncOfferDetails();

        setPlan('');
        if (quantityInput) quantityInput.value = '1';

        /**
         * Supply is a product option, so clearing the plan is only half of it:
         * the variant is still whichever supply card was last selected, and
         * without this the link adds a 90-day supply one-time and looks like it
         * ignored the choice.
         *
         * Recording the value and re-resolving — rather than assigning a
         * variant id outright — is what keeps the flavour: syncVariant reads
         * every option the shopper has chosen, so only supply moves.
         *
         * No supply of its own, or a value that matches nothing, leaves the
         * selection exactly as it was.
         */
        var onetimeValue = resolveSupplyValue(onetime.getAttribute('data-cwc-onetime-value'));
        if (onetimeValue) {
          chosen[supplyPosition] = onetimeValue;
          syncVariant();
        }

        announce();

        /**
         * Select Only stops here. The card is now the live selection — plan
         * cleared, variant resolved — and the shopper presses Add To Cart
         * themselves, which is what a card sitting among selectable plans has to
         * do to avoid looking like a radio that buys on touch.
         */
        if (onetime.getAttribute('data-cwc-onetime-behavior') === 'select_only') return;

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
      refreshOneTimePrice(variant);
      refreshOptionAvailability();
      syncOptionLabels();
      announce();
    }

    /**
     * The one-time card quotes the variant's own price rather than a plan's, so
     * it has to follow the option pickers the way the plan cards do — a size
     * change that re-prices every card but this one is worse than not showing
     * the price at all.
     */
    function refreshOneTimePrice(variant) {
      if (!variant) return;

      var priceEl = sectionEl.querySelector('[data-cwc-onetime-price]');
      var compareEl = sectionEl.querySelector('[data-cwc-onetime-compare]');

      if (priceEl && variant.price) priceEl.textContent = variant.price;
      if (compareEl) {
        compareEl.textContent = variant.compare || '';
        compareEl.style.display = variant.compare ? '' : 'none';
      }
    }

    /**
     * Dim the option values that are not available beside the rest of the
     * current selection.
     *
     * Recomputed on every variant change rather than only at render, because
     * "Large is sold out" is only ever true of a particular flavour — picking
     * the other one has to bring it back.
     *
     * A value with no stock at all was disabled by the server and is left alone:
     * no combination is going to change it.
     */
    function refreshOptionAvailability() {
      optionRows().forEach(function (row) {
        var position = positionOf(row);
        if (!position) return;

        row.querySelectorAll('[data-cwc-flavor-value]').forEach(function (control) {
          // <option> has no class list worth toggling; the select's own list
          // already carries the sold-out wording from the server.
          if (control.tagName === 'OPTION') return;

          var match = variantMatching(
            combinationWith(position, control.getAttribute('data-cwc-flavor-value'))
          );

          control.classList.toggle(
            'cwc_product-hero-buy-box__flavor--unavailable',
            !match || !match.available
          );
        });
      });
    }

    /**
     * The "Size: Large" half of an option label, for the rows that show it.
     */
    function syncOptionLabels() {
      optionRows().forEach(function (row) {
        var currentEl = row.querySelector('[data-cwc-option-current]');
        if (!currentEl) return;

        var position = positionOf(row);
        if (position && chosen[position]) currentEl.textContent = chosen[position];
      });
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

        /**
         * A plan this variant does not carry.
         *
         * Supply cards resolve their own variant above and always land on one,
         * so this only fires for the auto plan cards on a product whose variants
         * differ in which plans they offer — where leaving the card up would
         * quote the previous variant's price for a plan that cannot be bought.
         */
        if (!pricing) {
          if (planId && offerEl.hasAttribute('data-cwc-offer-auto')) offerEl.hidden = true;
          return;
        }

        offerEl.hidden = false;

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

      /**
       * The selection may have just been hidden. Move it to the first card still
       * standing rather than leaving the form pointing at a plan that is gone.
       *
       * Only auto plan cards are ever hidden above, and those carry no supply
       * value, so selecting one does not re-resolve the variant — which is what
       * keeps this from re-entering refreshOfferPrices through selectOffer.
       */
      var selected = sectionEl.querySelector('.' + SELECTED_OFFER);
      if (selected && selected.hidden) {
        var replacement = null;
        offers.forEach(function (candidate) {
          if (!replacement && !candidate.hidden) replacement = candidate;
        });
        if (replacement) selectOffer(replacement);
      }
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

        var row = rowOf(flavorEl);

        /**
         * Selection is cleared inside the row only.
         *
         * Clearing it across the section — which is what this did when a single
         * flavour row was the only possibility — would have picking a Size
         * visually deselect the Flavor sitting above it.
         */
        var scope = row || sectionEl;
        scope.querySelectorAll('[data-cwc-variant]').forEach(function (item) {
          item.classList.remove(SELECTED_FLAVOR);
        });
        flavorEl.classList.add(SELECTED_FLAVOR);

        // Bound to a product option: record the value and resolve against every
        // choice, so the other options the shopper picked survive the change.
        // Unbound: the swatch is a variant in its own right, as before.
        var position = positionOf(row);
        var flavorValue = flavorEl.getAttribute('data-cwc-flavor-value');

        if (position && flavorValue) {
          chosen[position] = flavorValue;
          syncVariant();
        } else {
          applyVariant(flavorEl.getAttribute('data-cwc-variant'));
        }
      });
    });

    /**
     * Dropdown rows. A long value run collapses to a select rather than a wall
     * of pills, and it drives exactly the same state the buttons do.
     */
    optionSelects.forEach(function (selectEl) {
      selectEl.addEventListener('change', function () {
        var picked = selectEl.options[selectEl.selectedIndex];
        if (!picked) return;

        var position = positionOf(rowOf(selectEl));

        if (position) {
          chosen[position] = picked.value;
          syncVariant();
        } else {
          applyVariant(picked.getAttribute('data-cwc-variant'));
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
    initDeliveryEstimate(sectionEl);
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
     * Seed the option state from what the server already marked as selected —
     * every row, not just the first.
     *
     * Without this the first resolve would see only part of the combination —
     * selectOffer runs below and records the supply value — and would pick an
     * arbitrary value for every option the shopper has not touched yet.
     */
    optionRows().forEach(function (row) {
      var position = positionOf(row);
      if (position === 0) return;

      var selectEl = row.querySelector('[data-cwc-option-select]');
      if (selectEl) {
        if (selectEl.value) chosen[position] = selectEl.value;
        return;
      }

      var seed =
        row.querySelector('.' + SELECTED_FLAVOR + '[data-cwc-flavor-value]') ||
        row.querySelector('[data-cwc-flavor-value]');

      if (seed) chosen[position] = seed.getAttribute('data-cwc-flavor-value');
    });

    /**
     * The auto plan block can be set to pre-select nothing, which the fallback
     * below would otherwise undo on the next line by selecting the first card.
     */
    var noAutoSelect = sectionEl.querySelector('[data-cwc-no-autoselect]') !== null;
    var initiallySelected = sectionEl.querySelector('.' + SELECTED_OFFER);

    if (initiallySelected) {
      selectOffer(initiallySelected);
    } else if (offers.length && !noAutoSelect) {
      selectOffer(offers[0]);
    } else {
      /**
       * No plan card is live — a one-time-only product, or a deliberate "pick
       * one" start. Nothing has resolved the variant from the seeded options or
       * primed the sticky bar, so do both once here.
       *
       * Only when there is actually a seeded combination to resolve. Resolving
       * an empty one matches every variant and returns the first available,
       * which would throw away a variant the shopper arrived on through a
       * ?variant= link on any product with no option row to seed from.
       */
      var hasSeed = false;
      for (var seededPosition in chosen) {
        if (Object.prototype.hasOwnProperty.call(chosen, seededPosition)) hasSeed = true;
      }
      if (hasSeed) syncVariant();

      announce();
    }

    refreshOptionAvailability();
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
