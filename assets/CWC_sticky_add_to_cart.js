(function () {
  'use strict';

  function initSection(sectionEl) {
    if (!sectionEl) return;

    var bar = sectionEl.querySelector('.cwc_sticky-add-to-cart__bar');
    var variantInput = sectionEl.querySelector('[data-cwc-variant-input]');
    var quantityInput = sectionEl.querySelector('[data-cwc-quantity-input]');
    var planInput = sectionEl.querySelector('[data-cwc-plan-input]');
    var planChip = sectionEl.querySelector('[data-cwc-plan-chip]');
    var planLabel = sectionEl.querySelector('[data-cwc-plan-label]');
    var buttonPrice = sectionEl.querySelector('[data-cwc-button-price]');

    var revealAfter = parseInt(sectionEl.getAttribute('data-cwc-reveal-after'), 10) || 600;

    // Reveal on scroll
    function onScroll() {
      var scrolled = window.pageYOffset || document.documentElement.scrollTop;
      var nearBottom = window.innerHeight + scrolled >= document.body.offsetHeight - 120;
      if (scrolled > revealAfter && !nearBottom) {
        sectionEl.classList.add('cwc_sticky-add-to-cart--visible');
      } else {
        sectionEl.classList.remove('cwc_sticky-add-to-cart--visible');
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

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
        var buyBox = document.querySelector('.cwc_product-hero-buy-box');
        if (buyBox) {
          buyBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
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
