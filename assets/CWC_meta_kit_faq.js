(function () {
  'use strict';

  var OPEN_CLASS = 'cwc_meta_kit_faq__item--open';

  function setState(item, trigger, panel, open) {
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    item.classList.toggle(OPEN_CLASS, open);
    panel.hidden = !open;
  }

  function initSection(sectionEl) {
    if (!sectionEl) return;

    var items = sectionEl.querySelectorAll('.cwc_meta_kit_faq__item');
    if (!items.length) return;

    items.forEach(function (item) {
      var trigger = item.querySelector('.cwc_meta_kit_faq__trigger');
      var panel = item.querySelector('.cwc_meta_kit_faq__panel');
      if (!trigger || !panel) return;

      var open = trigger.getAttribute('aria-expanded') === 'true';
      setState(item, trigger, panel, open);

      trigger.addEventListener('click', function () {
        var isOpen = trigger.getAttribute('aria-expanded') === 'true';
        setState(item, trigger, panel, !isOpen);
      });
    });
  }

  function initAllSections() {
    document.querySelectorAll('.cwc_meta_kit_faq').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSections);
  } else {
    initAllSections();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector('.cwc_meta_kit_faq');
    if (section) initSection(section);
  });
})();
