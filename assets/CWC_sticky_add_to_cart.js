(function () {
  'use strict';

  // The sticky bar is shown only while the hero add-to-cart button is OUT of view.
  var HERO_CTA_SELECTOR = '.cwc_product-hero-buy-box__cta';
  var HERO_FALLBACK_SELECTOR = '.cwc_product-hero-buy-box';
  var VISIBLE_CLASS = 'cwc_sticky-add-to-cart--visible';

  function initSection(sectionEl) {
    if (!sectionEl) return;

    var variantInput = sectionEl.querySelector('[data-cwc-variant-input]');
    var quantityInput = sectionEl.querySelector('[data-cwc-quantity-input]');
    var planInput = sectionEl.querySelector('[data-cwc-plan-input]');
    var planChip = sectionEl.querySelector('[data-cwc-plan-chip]');
    var planLabel = sectionEl.querySelector('[data-cwc-plan-label]');
    var buttonPrice = sectionEl.querySelector('[data-cwc-button-price]');

    setupReveal(sectionEl);

    // Mirror the hero buy box selection
    document.addEventListener('cwc:buybox:change', function (event) {
      var detail = event.detail || {};
      if (variantInput && detail.variantId) variantInput.value = detail.variantId;
      if (quantityInput && detail.quantity) quantityInput.value = detail.quantity;
      if (planInput) planInput.value = detail.sellingPlan || '';
      if (planLabel && detail.label) planLabel.textContent = detail.label;
      if (buttonPrice && detail.price) buttonPrice.textContent = detail.price;
    });

    // Plan chip scrolls to the buy box
    if (planChip) {
      planChip.addEventListener('click', function () {
        var buyBox = document.querySelector(HERO_FALLBACK_SELECTOR);
        if (buyBox) {
          buyBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }

  function setupReveal(sectionEl) {
    var show = function () { sectionEl.classList.add(VISIBLE_CLASS); };
    var hide = function () { sectionEl.classList.remove(VISIBLE_CLASS); };

    // Clean up any listeners from a previous init (Theme Editor reloads)
    if (sectionEl._cwcObserver) {
      sectionEl._cwcObserver.disconnect();
      sectionEl._cwcObserver = null;
    }
    if (sectionEl._cwcScroll) {
      window.removeEventListener('scroll', sectionEl._cwcScroll);
      sectionEl._cwcScroll = null;
    }

    var heroCta = document.querySelector(HERO_CTA_SELECTOR) || document.querySelector(HERO_FALLBACK_SELECTOR);

    if (heroCta && 'IntersectionObserver' in window) {
      // Primary: track the hero add-to-cart button.
      // Sticky is visible whenever the hero CTA is NOT intersecting the viewport.
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
      observer.observe(heroCta);
      sectionEl._cwcObserver = observer;
      return;
    }

    // Fallback: no hero CTA on the page (or no IntersectionObserver support) —
    // reveal after a scroll distance, hide near the very bottom.
    var revealAfter = parseInt(sectionEl.getAttribute('data-cwc-reveal-after'), 10) || 600;
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
    sectionEl._cwcScroll = onScroll;
    onScroll();
  }

  function initAllSections() {
    document.querySelectorAll('.cwc_sticky-add-to-cart').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSections);
  } else {
    initAllSections();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector('.cwc_sticky-add-to-cart');
    if (section) initSection(section);
  });
})();
