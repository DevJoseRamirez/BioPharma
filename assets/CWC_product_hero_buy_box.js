(function () {
  'use strict';

  var SELECTED_OFFER = 'cwc_product-hero-buy-box__offer--selected';
  var SELECTED_FLAVOR = 'cwc_product-hero-buy-box__flavor--selected';
  var ACTIVE_THUMB = 'cwc_product-hero-buy-box__thumb--active';
  var HIDDEN_PANEL = 'cwc_product-hero-buy-box__detail-answer--hidden';

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

    function announce() {
      var selected = sectionEl.querySelector('.' + SELECTED_OFFER);
      var priceEl = selected ? selected.querySelector('[data-cwc-offer-now]') : null;
      var nameEl = selected ? selected.querySelector('.cwc_product-hero-buy-box__offer-name') : null;

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

      if (mainImage && variant.image) {
        mainImage.src = variant.image;
        thumbs.forEach(function (thumb) {
          thumb.classList.remove(ACTIVE_THUMB);
        });
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

    thumbs.forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        if (!mainImage) return;
        thumbs.forEach(function (item) {
          item.classList.remove(ACTIVE_THUMB);
        });
        thumb.classList.add(ACTIVE_THUMB);
        mainImage.src = thumb.getAttribute('data-cwc-thumb');
      });
    });

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
